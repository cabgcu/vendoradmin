// Supabase Edge Function: brevo-webhook
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const SUPABASE_URL = 'https://xdfbjusrwbxoxbcocxkp.supabase.co'

const eventMap = {
  'sent': 'sent',
  'request': 'sent',
  'delivered': 'delivered',
  'opened': 'opened',
  'unique_opened': 'opened',
  'click': 'clicked',
  'clicks': 'clicked',
  'hardBounce': 'hardBounce',
  'softBounce': 'softBounce',
  'blocked': 'blocked',
  'unsubscribed': 'unsubscribed',
  'error': 'error'
}

Deno.serve(async (req) => {
  console.log('WEBHOOK_REQUEST: method=' + req.method + ' url=' + req.url)

  try {
    if (req.method !== 'POST') {
      console.log('REJECT: not POST')
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const event = await req.json()
    console.log('EVENT_RECEIVED: type=' + event.event + ' email=' + event.email)

    const email = event.email || event.recipient
    const eventType = event.event
    const messageId = event.messageId || event['message-id']

    if (!email || !eventType) {
      console.log('INVALID: missing email or event')
      return new Response(JSON.stringify({ error: 'Missing email or event' }), { status: 400 })
    }

    const status = eventMap[eventType] || eventType
    console.log('STATUS_MAPPED: ' + eventType + ' -> ' + status)

    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY')
    if (!serviceKey) {
      console.log('ERROR: SERVICE_ROLE_KEY not set')
      return new Response(JSON.stringify({ error: 'Service key missing' }), { status: 500 })
    }

    console.log('SUPABASE: initializing client')
    const supabase = createClient(SUPABASE_URL, serviceKey)

    console.log('DATABASE: querying vendors for ' + email)
    const { data: vendors, error: queryErr } = await supabase
      .from('vendors')
      .select('id, email_delivery_status, brevo_message_id, preferred_email')
      .ilike('preferred_email', email)

    if (queryErr) {
      console.log('QUERY_ERROR: ' + queryErr.message)
      return new Response(JSON.stringify({ message: 'Query error' }), { status: 200 })
    }

    if (!vendors || vendors.length === 0) {
      console.log('NO_VENDORS: found 0 vendors')
      return new Response(JSON.stringify({ message: 'No matching vendor' }), { status: 200 })
    }

    console.log('VENDORS_FOUND: ' + vendors.length + ' vendor(s)')

    let updated = 0
    for (const vendor of vendors) {
      console.log('PROCESSING: vendor ' + vendor.id)

      if (messageId && vendor.brevo_message_id) {
        const stored = String(vendor.brevo_message_id).trim().replace(/^<|>$/g, '')
        const event_id = String(messageId).trim().replace(/^<|>$/g, '')
        if (stored !== event_id) {
          console.log('SKIP: messageId mismatch')
          continue
        }
      }

      console.log('UPDATE: vendor ' + vendor.id + ' to status ' + status)
      const { error: updateErr } = await supabase
        .from('vendors')
        .update({ email_delivery_status: status })
        .eq('id', vendor.id)

      if (updateErr) {
        console.log('UPDATE_ERROR: ' + updateErr.message)
      } else {
        console.log('UPDATE_SUCCESS: vendor ' + vendor.id)
        updated++
      }
    }

    console.log('COMPLETE: updated ' + updated + ' vendor(s)')
    return new Response(
      JSON.stringify({ success: true, status, email, updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.log('EXCEPTION: ' + error.message)
    return new Response(JSON.stringify({ error: 'Internal error', details: error.message }), { status: 500 })
  }
})
