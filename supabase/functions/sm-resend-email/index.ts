// Supabase Edge Function: sm-resend-email
//
// Lets a student re-send their own status email from the public form's
// "Check Status" screen. Runs server-side so the Brevo API key never reaches
// a visitor's browser (it used to be read from the secrets table with the
// public key).
//
// Deploy (from the vendoradmin repo root):
//   supabase functions deploy sm-resend-email --no-verify-jwt
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SENDER_EMAIL = 'studentmarkets@cabgcu.com'
const SENDER_NAME = 'Canyon Activities Board'
const REPLY_TO_EMAIL = 'lopetownmarket@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function safeTrackingSlug(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'na'
}

function processImageUrl(u: string) {
  if (!u) return ''
  if (u.includes('drive.google.com')) {
    const m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`
  }
  return u
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { appId, eventId, publicFormUrl } = await req.json().catch(() => ({}))
    if (!appId || !eventId) return json({ error: 'Missing application.' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: vendor } = await supabase.from('vendors').select('*').eq('id', appId).maybeSingle()
    if (!vendor || String(vendor.event_id) !== String(eventId)) return json({ error: 'Application not found.' }, 404)
    // Only re-send a decision that was already emailed; never send one early.
    if (!vendor.email_sent || vendor.email_sent === 'No') return json({ error: 'No status email has been sent yet.' }, 400)
    if (!vendor.preferred_email) return json({ error: 'No email on file.' }, 400)

    const { data: evt } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
    if (!evt) return json({ error: 'Market not found.' }, 404)

    const { data: secrets } = await supabase.from('secrets').select('name, value').in('name', ['BREVO_API_KEY', 'PUBLIC_APP_URL'])
    const apiKey = secrets?.find((s) => s.name === 'BREVO_API_KEY')?.value?.trim()
    if (!apiKey) return json({ error: 'API Key missing' }, 500)
    const publicUrlConfig = secrets?.find((s) => s.name === 'PUBLIC_APP_URL')?.value

    let targetTemplate = vendor.email_sent
    const isApproved = vendor.status === 'Approved' || vendor.status === 'Checked In'
    if (!targetTemplate || targetTemplate === 'Yes' || targetTemplate === 'No') {
      targetTemplate = isApproved ? (vendor.needs_power === 'Yes' ? 'power' : 'approved') : 'denied'
    }

    let subj = '', body = ''
    if (targetTemplate === 'approved') { subj = evt.template_approved_subject; body = evt.template_approved_body }
    else if (targetTemplate === 'power') { subj = evt.template_power_subject || evt.template_approved_subject; body = evt.template_power_body || evt.template_approved_body }
    else if (targetTemplate === 'power_denied') { subj = evt.template_power_denied_subject || evt.template_approved_subject; body = evt.template_power_denied_body || evt.template_approved_body }
    else if (targetTemplate === 'denied') { subj = evt.template_denied_subject; body = evt.template_denied_body }

    if (['approved', 'power', 'power_denied'].includes(targetTemplate) && body && !body.includes('{{CONFIRM_LINK}}')) {
      body += '\n\n**Please click a link below to confirm your status by {{CONFIRM_DEADLINE}}:**\n{{CONFIRM_LINK}}\n{{DECLINE_LINK}}'
    }

    // PUBLIC_APP_URL (Settings) wins; the caller's page URL is only a fallback and must be a real http(s) URL.
    let baseUrl = publicUrlConfig || ''
    if (!baseUrl && typeof publicFormUrl === 'string' && /^https?:\/\//.test(publicFormUrl)) baseUrl = publicFormUrl
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    if (baseUrl && !baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl
    const confirmUrl = `${baseUrl}?confirm=${vendor.id}`
    const declineUrl = `${baseUrl}?decline=${vendor.id}`
    const powerConfirmUrl = `${baseUrl}?confirm_power=${vendor.id}`
    const powerDeclineUrl = `${baseUrl}?decline_power=${vendor.id}`
    const finalConfirmLink = `<a href="${confirmUrl}" style="display:inline-block; padding:12px 24px; background-color:#34C759; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:8px; margin: 10px 5px 10px 0;">✓ Confirm Attendance</a>`
    const finalDeclineLink = `<a href="${declineUrl}" style="display:inline-block; padding:12px 24px; background-color:#FF3B30; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:8px; margin: 10px 0;">✕ Can't Make It</a>`
    const finalPowerConfirmLink = `<a href="${powerConfirmUrl}" style="display:inline-block; padding:12px 24px; background-color:#0A84FF; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:8px; margin: 10px 5px 10px 0;">⚡ Confirm Power</a>`
    const finalPowerDeclineLink = `<a href="${powerDeclineUrl}" style="display:inline-block; padding:12px 24px; background-color:#FF9500; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:8px; margin: 10px 0;">🔌 No Longer Need Power</a>`

    const tz = { timeZone: 'America/Phoenix' }
    const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { ...tz, month: 'long', day: 'numeric', year: 'numeric' }) : ''
    const fmtDT = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { ...tz, month: 'long', day: 'numeric' }) + ' at ' + new Date(d).toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' }) : ''

    const rawBody = (body || '')
      .replace(/\{\{FIRST\}\}/g, vendor.first_name)
      .replace(/\{\{MARKET_NAME\}\}/g, evt.name)
      .replace(/\{\{LOCATION\}\}/g, evt.location)
      .replace(/\{\{MARKET_DATE\}\}/g, fmtDate(evt.market_date))
      .replace(/\{\{MARKET_TIME\}\}/g, evt.market_time || 'TBD')
      .replace(/\{\{APP_OPENS\}\}/g, fmtDT(evt.app_open))
      .replace(/\{\{APP_CLOSES\}\}/g, fmtDT(evt.app_close))
      .replace(/\{\{CONTACT_DATE\}\}/g, fmtDate(evt.contact_date))
      .replace(/\{\{CONFIRM_DEADLINE\}\}/g, fmtDate(evt.confirm_date))
      .replace(/\{\{CONFIRM_LINK\}\}/g, finalConfirmLink)
      .replace(/\{\{DECLINE_LINK\}\}/g, finalDeclineLink)
      .replace(/\{\{POWER_CONFIRM_LINK\}\}/g, finalPowerConfirmLink)
      .replace(/\{\{POWER_DECLINE_LINK\}\}/g, finalPowerDeclineLink)
      .replace(/\{\{EVENT\}\}/g, evt.name)

    let plainText = rawBody.replace(/\*\*(.*?)\*\*/g, '$1')
    plainText = plainText.replace(finalConfirmLink, `\n\nConfirm Attendance Here: ${confirmUrl}\n`)
    plainText = plainText.replace(finalDeclineLink, `\nDecline/Cancel Spot Here: ${declineUrl}\n`)
    plainText = plainText.replace(finalPowerConfirmLink, `\n\nConfirm Power Here: ${powerConfirmUrl}\n`)
    plainText = plainText.replace(finalPowerDeclineLink, `\nNo Longer Need Power: ${powerDeclineUrl}\n`)
    const htmlBody = rawBody.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
    const parsedSubj = (subj || '').replace(/\{\{FIRST\}\}/g, vendor.first_name).replace(/\{\{MARKET_NAME\}\}/g, evt.name).replace(/\{\{EVENT\}\}/g, evt.name)

    const bannerUrl = processImageUrl(evt.banner_url || '')
    const headingText = evt.heading_text || 'Market Status Update'
    const statusColor = isApproved ? '#34C759' : '#FF3B30'
    const statusBadgeText = isApproved ? 'APPROVED' : 'STATUS UPDATE'
    const barcodeData = vendor.student_id || String(vendor.id).substring(0, 8)
    const qrHtml = isApproved ? `<tr><td style="padding:0 15px;background-color:#ffffff;"><div style="border-top:2px dashed #e5e7eb;width:100%;height:1px;"></div></td></tr><tr><td align="center" style="padding:40px 30px;background-color:#ffffff;"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td align="center" style="background:#ffffff;padding:25px;border-radius:16px;border:2px solid #eeeeee;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${barcodeData}&format=png&bgcolor=FFFFFF&color=000000&margin=10" alt="QR" width="250" style="display:block;margin:0 auto;max-width:100%;border:0;"></td></tr></table><p style="margin:25px 0 0;font-size:14px;color:#1a1a1a;font-weight:700;text-transform:uppercase;letter-spacing:2px;">SCAN AT CHECK-IN</p><p style="margin:8px 0 0;font-size:12px;color:#888;font-family:monospace;">ID: #${String(barcodeData).toUpperCase()}</p></td></tr>` : ''

    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:20px;"><tr><td align="center"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);">${bannerUrl ? `<tr><td align="center" style="padding:0;"><img src="${bannerUrl}" width="600" style="display:block;width:100%;max-width:100%;height:auto;border:0;"></td></tr>` : ''}<tr><td align="center" style="background-color:#ffffff;padding:40px 30px 20px;"><h1 style="margin:0;font-size:24px;font-weight:800;color:#111;text-transform:uppercase;">${headingText}</h1><p style="margin:12px 0 0;font-size:12px;font-weight:700;color:#fff;background-color:${statusColor};display:inline-block;padding:6px 16px;text-transform:uppercase;letter-spacing:1px;border-radius:20px;">${statusBadgeText}</p></td></tr><tr><td style="padding:10px 40px 40px;background-color:#ffffff;font-size:16px;color:#333;line-height:1.6;">${htmlBody}</td></tr>${qrHtml}<tr><td align="center" style="background-color:#f9fafb;padding:20px;border-top:1px solid #eaeaea;"><p style="margin:0;font-size:12px;font-weight:600;color:#aaa;text-transform:uppercase;">&copy; Canyon Activities Board</p></td></tr></table></td></tr></table></body></html>`

    const marketSlug = safeTrackingSlug(eventId)
    const templateSlug = safeTrackingSlug(targetTemplate)
    const trackingToken = `sm-${marketSlug}-${templateSlug}-${safeTrackingSlug(vendor.id)}-${Date.now()}`
    const trackingTags = [`market-${marketSlug}`, `template-${templateSlug}`, 'cab-student-market', trackingToken]

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        replyTo: { name: SENDER_NAME, email: REPLY_TO_EMAIL },
        to: [{ email: vendor.preferred_email, name: `${vendor.first_name} ${vendor.last_name}` }],
        subject: parsedSubj,
        htmlContent: fullHtml,
        textContent: plainText,
        tags: trackingTags,
        headers: {
          'X-CAB-Tracking': trackingToken,
          'X-CAB-Market-ID': String(eventId || ''),
          'X-CAB-Template': String(targetTemplate || '')
        }
      })
    })
    if (!resp.ok) return json({ error: 'Email service failed' }, 502)
    const respData = await resp.json().catch(() => ({}))
    const brevoMessageId = respData.messageId || respData.messageIds?.[0] || respData.id || null

    await supabase.from('vendors').update({
      brevo_message_id: brevoMessageId,
      email_delivery_status: 'sent',
      email_sent_at: new Date().toISOString(),
      email_sent_event_id: eventId,
      email_tracking_token: trackingToken,
      email_subject: parsedSubj
    }).eq('id', vendor.id)

    return json({ success: true })
  } catch (e) {
    console.error('sm-resend-email failed:', e)
    return json({ error: 'Could not resend the email.' }, 500)
  }
})
