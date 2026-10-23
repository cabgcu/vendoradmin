-- =====================================================================
-- CAB Student Markets — security lockdown
-- =====================================================================
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run. It runs in a single transaction: if anything
-- fails, nothing is changed.
--
-- What it does:
--   1. Moves every login (master admin + staff) into Supabase Auth, where
--      passwords are stored bcrypt-hashed. The plaintext `cab_users.password`
--      column and the `ADMIN_PASSWORD` secret are removed.
--   2. Turns on Row Level Security so the public (anon) key in the website
--      can no longer read vendors/students, staff accounts, or API keys.
--   3. Adds narrow SECURITY DEFINER functions the public application form
--      uses instead of touching tables directly. They never return a
--      student's name, email, phone or license image.
--
-- BEFORE RUNNING: pick the master admin password on the next line.
-- Leave it '' to keep the current ADMIN_PASSWORD secret — unless that is
-- still the old built-in default, which is public in the git history and
-- will be rejected.
-- =====================================================================

begin;

do $$ begin
    perform set_config('cab.new_admin_password', '', true);   -- <<< new master admin password goes between the quotes
    perform set_config('cab.master_admin_email', 'studentmarkets@cabgcu.com', true);
end $$;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Staff accounts -> Supabase Auth
-- ---------------------------------------------------------------------

alter table public.cab_users add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.cab_users alter column password drop not null;

-- Creates (or re-passwords) a confirmed email/password Auth user. Internal only.
create or replace function public._cab_create_auth_user(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
    v_email text := lower(btrim(p_email));
    v_id uuid;
begin
    select id into v_id from auth.users where lower(email) = v_email;
    if v_id is not null then
        update auth.users
           set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
               email_confirmed_at = coalesce(email_confirmed_at, now()),
               updated_at = now()
         where id = v_id;
        return v_id;
    end if;

    v_id := gen_random_uuid();
    insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
    return v_id;
end $$;

-- Migrate existing staff, keeping their current passwords.
do $$
declare u record;
begin
    for u in select id, email, password from public.cab_users
             where auth_user_id is null and coalesce(email, '') <> '' and coalesce(password, '') <> ''
    loop
        update public.cab_users set auth_user_id = public._cab_create_auth_user(u.email, u.password) where id = u.id;
    end loop;
end $$;

-- Master admin account (the "leave email blank" login).
do $$
declare
    v_email text := lower(current_setting('cab.master_admin_email'));
    v_pw text := nullif(current_setting('cab.new_admin_password', true), '');
    v_uid uuid;
begin
    if v_pw is null then
        select nullif(value, '') into v_pw from public.secrets where name = 'ADMIN_PASSWORD';
    end if;
    if v_pw is null or v_pw = 'Vendor49!' then
        raise exception 'Choose a new master admin password: put it in the set_config(''cab.new_admin_password'', ...) line at the top of this script, then run it again.';
    end if;
    if length(v_pw) < 8 then
        raise exception 'The master admin password must be at least 8 characters.';
    end if;

    v_uid := public._cab_create_auth_user(v_email, v_pw);
    if exists (select 1 from public.cab_users where lower(email) = v_email) then
        update public.cab_users set auth_user_id = v_uid, role = 'admin' where lower(email) = v_email;
    else
        insert into public.cab_users (email, name, role, auth_user_id) values (v_email, 'Master Admin', 'admin', v_uid);
    end if;
end $$;

-- Passwords now live only (hashed) in Supabase Auth.
alter table public.cab_users drop column password;
delete from public.secrets where name = 'ADMIN_PASSWORD';

-- Deleting a staff row also deletes their Auth login.
create or replace function public._cab_users_delete_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if old.auth_user_id is not null then
        delete from auth.users where id = old.auth_user_id;
    end if;
    return old;
end $$;

drop trigger if exists cab_users_delete_auth on public.cab_users;
create trigger cab_users_delete_auth after delete on public.cab_users
    for each row execute function public._cab_users_delete_auth();

-- ---------------------------------------------------------------------
-- 2. Role helpers used by the policies
-- ---------------------------------------------------------------------

create or replace function public.cab_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.cab_users where auth_user_id = auth.uid());
$$;

create or replace function public.cab_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.cab_users where auth_user_id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------

-- Start from a clean slate: drop whatever (likely wide-open) policies exist.
do $$
declare p record;
begin
    for p in select schemaname, tablename, policyname from pg_policies
             where (schemaname = 'public' and tablename in ('vendors', 'events', 'secrets', 'cab_users', 'allowed_emails'))
                or (schemaname = 'storage' and tablename = 'objects')
    loop
        execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    end loop;
end $$;

alter table public.vendors        enable row level security;
alter table public.events         enable row level security;
alter table public.secrets        enable row level security;
alter table public.cab_users      enable row level security;
alter table public.allowed_emails enable row level security;

-- Belt and braces: the anon key gets no direct table access to student or staff data at all.
revoke all on public.vendors, public.cab_users, public.allowed_emails from anon;
revoke insert, update, delete, truncate on public.events, public.secrets from anon;

-- vendors (student applications): staff only. The public form goes through the sm_* functions below.
create policy "staff manage vendors" on public.vendors
    for all to authenticated using (public.cab_is_staff()) with check (public.cab_is_staff());

-- events: public can read the market schedule; staff manage it.
create policy "anyone reads events" on public.events
    for select to anon, authenticated using (true);
create policy "staff manage events" on public.events
    for all to authenticated using (public.cab_is_staff()) with check (public.cab_is_staff());

-- secrets: only the public form layout is public. API keys are admin-only.
create policy "anyone reads form config" on public.secrets
    for select to anon, authenticated using (name in ('MARKET_FORM_CONFIG_V8', 'MARKET_FORM_CONFIG_V3'));
create policy "staff manage app settings" on public.secrets
    for all to authenticated
    using (public.cab_is_staff() and name not in ('BREVO_API_KEY', 'GMAIL_SCRIPT_URL', 'GMAIL_SCRIPT_SECRET', 'ADMIN_PASSWORD'))
    with check (public.cab_is_staff() and name not in ('BREVO_API_KEY', 'GMAIL_SCRIPT_URL', 'GMAIL_SCRIPT_SECRET', 'ADMIN_PASSWORD'));
create policy "admin manages all secrets" on public.secrets
    for all to authenticated using (public.cab_is_admin()) with check (public.cab_is_admin());

-- cab_users: you can see your own profile; admins manage everyone. New accounts go through cab_register_staff().
create policy "read own staff profile" on public.cab_users
    for select to authenticated using (auth_user_id = auth.uid());
create policy "admin manages staff" on public.cab_users
    for all to authenticated using (public.cab_is_admin()) with check (public.cab_is_admin());

-- allowed_emails: admins only (registration checks it inside cab_register_staff()).
create policy "admin manages allowed emails" on public.allowed_emails
    for all to authenticated using (public.cab_is_admin()) with check (public.cab_is_admin());

-- Storage. Both buckets stay "public" so existing image links keep working, but nobody
-- outside staff can list or delete files, and new license uploads get unguessable names.
create policy "public uploads license images" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'licenses' and storage.extension(name) = 'jpg');
create policy "staff manage market files" on storage.objects
    for all to authenticated
    using (bucket_id in ('licenses', 'banners') and public.cab_is_staff())
    with check (bucket_id in ('licenses', 'banners') and public.cab_is_staff());

-- ---------------------------------------------------------------------
-- 4. Staff account functions
-- ---------------------------------------------------------------------

-- Self-registration for emails an admin has pre-authorized.
create or replace function public.cab_register_staff(p_name text, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_name text := btrim(coalesce(p_name, ''));
begin
    if v_name = '' or v_email = '' or coalesce(p_password, '') = '' then
        raise exception 'All fields are required.';
    end if;
    if length(p_password) < 8 then
        raise exception 'Password must be at least 8 characters.';
    end if;
    if not exists (select 1 from public.allowed_emails where lower(email) = v_email) then
        raise exception 'This email is not authorized to register.';
    end if;
    if exists (select 1 from public.cab_users where lower(email) = v_email) then
        raise exception 'Account already exists for this email.';
    end if;
    insert into public.cab_users (email, name, role, auth_user_id)
    values (v_email, v_name, 'user', public._cab_create_auth_user(v_email, p_password));
end $$;

-- Admins set any staff member's password (including the master admin's).
create or replace function public.cab_admin_set_password(p_email text, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_uid uuid;
begin
    if not public.cab_is_admin() then
        raise exception 'Only admins can change passwords.';
    end if;
    if length(coalesce(p_new_password, '')) < 8 then
        raise exception 'Password must be at least 8 characters.';
    end if;
    if not exists (select 1 from public.cab_users where lower(email) = v_email) then
        raise exception 'No staff account for %.', v_email;
    end if;
    v_uid := public._cab_create_auth_user(v_email, p_new_password);
    update public.cab_users set auth_user_id = v_uid where lower(email) = v_email;
end $$;

-- ---------------------------------------------------------------------
-- 5. Public application form functions (anon)
-- ---------------------------------------------------------------------

create or replace function public._sm_try_jsonb(p text)
returns jsonb language plpgsql immutable as $$
begin
    return p::jsonb;
exception when others then
    return null;
end $$;

create or replace function public._sm_try_ts(p text)
returns timestamptz language plpgsql stable as $$
begin
    return p::timestamptz;
exception when others then
    return null;
end $$;

-- internal_notes is a JSON array stored as text (legacy rows may be plain text).
create or replace function public._sm_notes(p text)
returns jsonb language plpgsql volatile as $$
declare v jsonb := public._sm_try_jsonb(p);
begin
    if v is not null and jsonb_typeof(v) = 'array' then return v; end if;
    if coalesce(btrim(p), '') = '' then return '[]'::jsonb; end if;
    return jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'text', p, 'author', 'Legacy Data', 'type', 'legacy'));
end $$;

create or replace function public._sm_note(p_text text, p_type text, p_status text default null)
returns jsonb language sql volatile as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'text', p_text, 'author', 'System', 'type', p_type, 'status', p_status));
$$;

-- Returning-vendor autofill. Contact details and the license image are never sent back:
-- they come back as '__ON_FILE__' and sm_submit_application swaps the real values in.
create or replace function public.sm_prefill_vendor(p_student_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sid text := btrim(coalesce(p_student_id, ''));
    v public.vendors%rowtype;
    vj jsonb;
    v_out jsonb;
    k text;
    v_link text;
    v_license_status text;
    v_email_key text;
    v_forgiven jsonb;
    v_manual jsonb;
    v_late jsonb;
begin
    if length(v_sid) < 4 then return null; end if;

    select * into v from public.vendors where student_id = v_sid order by created_at desc limit 1;
    if not found then return null; end if;
    vj := to_jsonb(v);

    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_out
      from jsonb_each(vj)
     where key in ('student_id', 'communication_method', 'year', 'availability', 'food_license',
                   'past_vendor', 'description', 'link', 'needs_power', 'custom_answers');

    foreach k in array array['first_name', 'last_name', 'preferred_email', 'gcu_email', 'phone'] loop
        if coalesce(vj->>k, '') <> '' then
            v_out := v_out || jsonb_build_object(k, '__ON_FILE__');
        end if;
    end loop;

    -- Only a license the AI scan marked valid counts as "on file"; otherwise ask for a re-upload.
    v_link := vj->>'food_license_link';
    if coalesce(v_link, '') <> '' then
        if v_link not in ('Deleted to save space', 'Archived Google Drive Link') and v_link not like '%drive.google.com%' then
            select n->'ai_data'->>'license_status' into v_license_status
              from jsonb_array_elements(public._sm_notes(v.internal_notes)) with ordinality as t(n, i)
             where n->>'type' = 'ai_analysis' and n->'ai_data'->>'license_status' is not null
             order by i limit 1;
        end if;
        if coalesce(v_license_status, '') like '%✅%' then
            v_out := v_out || '{"food_license_link": "__ON_FILE__"}'::jsonb;
        else
            v_out := v_out || '{"food_license_link": null, "_food_license_needs_resubmit": true}'::jsonb;
        end if;
    end if;

    -- The vendor's own strikes (late applications + manual strikes), same as the admin view.
    v_email_key := lower(btrim(coalesce(nullif(vj->>'preferred_email', ''), vj->>'gcu_email', '')));
    if v_email_key <> '' then
        select public._sm_try_jsonb(value)->v_email_key into v_forgiven from public.secrets where name = 'MARKET_STRIKE_OVERRIDES';
        select public._sm_try_jsonb(value)->v_email_key into v_manual from public.secrets where name = 'MARKET_MANUAL_STRIKES';
        if v_forgiven is null or jsonb_typeof(v_forgiven) <> 'array' then v_forgiven := '[]'::jsonb; end if;
        if v_manual is null or jsonb_typeof(v_manual) <> 'array' then v_manual := '[]'::jsonb; end if;

        select coalesce(jsonb_agg(distinct e.name), '[]'::jsonb) into v_late
          from public.vendors a
          join public.events e on e.id::text = a.event_id::text
         where a.student_id = v_sid
           and e.name is not null
           and public._sm_try_ts(e.app_close::text) is not null
           and a.created_at > public._sm_try_ts(e.app_close::text)
           and not (v_forgiven ? e.name);

        v_out := v_out || jsonb_build_object('_strikeInfo', jsonb_build_object(
            'total', jsonb_array_length(v_late) + jsonb_array_length(v_manual),
            'late', v_late,
            'manual', coalesce((select jsonb_agg(jsonb_build_object('reason', m->>'reason', 'addedAt', m->'addedAt'))
                                  from jsonb_array_elements(v_manual) m), '[]'::jsonb)));
    else
        v_out := v_out || '{"_strikeInfo": {"total": 0, "late": [], "manual": []}}'::jsonb;
    end if;

    return v_out;
end $$;

-- Create or update the applicant's row for each selected market. Only application
-- fields are accepted; status always resets to Pending like the original form did.
create or replace function public.sm_submit_application(p_payload jsonb, p_event_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_allowed text[] := array['student_id', 'first_name', 'last_name', 'preferred_email', 'gcu_email', 'phone',
                              'communication_method', 'year', 'availability', 'food_license', 'past_vendor',
                              'description', 'link', 'needs_power', 'food_license_link', 'additional_comments',
                              'custom_answers', 'agreements_checked'];
    v_on_file text[] := array['first_name', 'last_name', 'preferred_email', 'gcu_email', 'phone', 'food_license_link'];
    v_sid text := btrim(coalesce(p_payload->>'student_id', ''));
    p jsonb;
    prev jsonb;
    k text;
    v_event text;
    v_existing text;
    v_row jsonb;
    v_cols text;
begin
    if length(v_sid) < 4 then raise exception 'A valid student ID is required.'; end if;
    if p_event_ids is null or cardinality(p_event_ids) = 0 then raise exception 'Select at least one market.'; end if;
    if cardinality(p_event_ids) > 20 then raise exception 'Too many markets selected.'; end if;

    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into p
      from jsonb_each(coalesce(p_payload, '{}'::jsonb))
     where key = any(v_allowed);
    p := p || jsonb_build_object('student_id', v_sid, 'status', 'Pending', 'email_sent', 'No');

    select to_jsonb(x) into prev from (
        select * from public.vendors where student_id = v_sid order by created_at desc limit 1
    ) x;
    foreach k in array v_on_file loop
        if p->>k = '__ON_FILE__' then
            p := p || jsonb_build_object(k, prev->k);
        end if;
    end loop;

    foreach v_event in array p_event_ids loop
        if not exists (select 1 from public.events where id::text = v_event) then
            raise exception 'Unknown market selected.';
        end if;
        v_row := p || jsonb_build_object('event_id', v_event);
        select string_agg(quote_ident(c), ', ') into v_cols from jsonb_object_keys(v_row) c;

        select id::text into v_existing from public.vendors
         where student_id = v_sid and event_id::text = v_event
         order by created_at desc limit 1;

        if v_existing is not null then
            execute format('update public.vendors set (%s) = (select %s from jsonb_populate_record(null::public.vendors, $1)) where id::text = $2',
                           v_cols, v_cols) using v_row, v_existing;
        else
            execute format('insert into public.vendors (%s) select %s from jsonb_populate_record(null::public.vendors, $1)',
                           v_cols, v_cols) using v_row;
        end if;
    end loop;
end $$;

-- Status lookup: just enough to show In Review / Approved / Denied per upcoming market.
create or replace function public.sm_check_status(p_student_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'apps', coalesce((
            select jsonb_agg(jsonb_build_object('id', id, 'event_id', event_id, 'status', status,
                                                'email_sent', email_sent, 'created_at', created_at)
                             order by created_at desc)
              from public.vendors
             where length(btrim(coalesce(p_student_id, ''))) >= 3 and student_id = btrim(p_student_id)
        ), '[]'::jsonb),
        'events', coalesce((select jsonb_agg(to_jsonb(e)) from public.events e), '[]'::jsonb)
    );
$$;

-- Email "Confirm attendance" / "Can't make it" links. The vendor id in the link is the key.
create or replace function public.sm_set_attendance(p_vendor_id text, p_attending boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_notes jsonb;
begin
    select public._sm_notes(internal_notes) into v_notes from public.vendors where id::text = p_vendor_id;
    if not found then raise exception 'We could not find your application. Please reply directly to the email instead.'; end if;

    if p_attending then
        update public.vendors set attendance_confirmed = true where id::text = p_vendor_id;
    else
        if not exists (select 1 from jsonb_array_elements(v_notes) n
                        where n->>'type' = 'status_change' and n->>'status' = 'Declined' and n->>'text' like '%Can''t Make It%') then
            v_notes := jsonb_build_array(public._sm_note('❌ Vendor clicked the ''Can''t Make It'' link in their email.', 'status_change', 'Declined')) || v_notes;
        end if;
        update public.vendors set attendance_confirmed = false, internal_notes = v_notes::text where id::text = p_vendor_id;
    end if;
end $$;

-- Email "Confirm power" / "No longer need power" links.
create or replace function public.sm_set_power(p_vendor_id text, p_needs_power boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_notes jsonb;
begin
    select public._sm_notes(internal_notes) into v_notes from public.vendors where id::text = p_vendor_id;
    if not found then raise exception 'We could not find your application. Please reply directly to the email instead.'; end if;

    v_notes := jsonb_build_array(public._sm_note(
        case when p_needs_power then '⚡ Vendor confirmed they still need power access.'
             else '🔌 Vendor indicated they no longer need power access.' end,
        'power_update')) || v_notes;
    update public.vendors
       set needs_power = case when p_needs_power then 'Yes' else 'No' end,
           power_confirmed = p_needs_power,
           internal_notes = v_notes::text
     where id::text = p_vendor_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. Function permissions (Supabase grants EXECUTE to everyone by default)
-- ---------------------------------------------------------------------

revoke execute on function public._cab_create_auth_user(text, text) from public, anon, authenticated;
revoke execute on function public._cab_users_delete_auth() from public, anon, authenticated;
revoke execute on function public._sm_try_jsonb(text) from public, anon, authenticated;
revoke execute on function public._sm_try_ts(text) from public, anon, authenticated;
revoke execute on function public._sm_notes(text) from public, anon, authenticated;
revoke execute on function public._sm_note(text, text, text) from public, anon, authenticated;

revoke execute on function public.cab_admin_set_password(text, text) from public, anon;
grant  execute on function public.cab_admin_set_password(text, text) to authenticated;

grant execute on function public.cab_is_staff() to anon, authenticated;
grant execute on function public.cab_is_admin() to anon, authenticated;
grant execute on function public.cab_register_staff(text, text, text) to anon, authenticated;
grant execute on function public.sm_prefill_vendor(text) to anon, authenticated;
grant execute on function public.sm_submit_application(jsonb, text[]) to anon, authenticated;
grant execute on function public.sm_check_status(text) to anon, authenticated;
grant execute on function public.sm_set_attendance(text, boolean) to anon, authenticated;
grant execute on function public.sm_set_power(text, boolean) to anon, authenticated;

commit;
