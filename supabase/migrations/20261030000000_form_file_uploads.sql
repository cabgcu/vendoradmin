-- =====================================================================
-- CAB Student Markets — "File upload" form questions
-- =====================================================================
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste
-- this whole file -> Run.
--
-- Creates the public "form-uploads" bucket used by File upload questions
-- in the Form Builder. Like license images, files get random unguessable
-- names; applicants can only add files (images, PDF, Word, 10 MB max),
-- and only staff can list or delete them.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'form-uploads', 'form-uploads', true, 10485760,
    array[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public uploads form files" on storage.objects;
create policy "public uploads form files" on storage.objects
    for insert to anon, authenticated
    with check (
        bucket_id = 'form-uploads'
        and storage.extension(name) in ('jpg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx')
    );

drop policy if exists "staff manage form files" on storage.objects;
create policy "staff manage form files" on storage.objects
    for all to authenticated
    using (bucket_id = 'form-uploads' and public.cab_is_staff())
    with check (bucket_id = 'form-uploads' and public.cab_is_staff());
