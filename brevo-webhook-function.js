// Supabase Edge Function: brevo-webhook
// Deploy this in your Supabase dashboard at Functions > Create Function
// Name it "brevo-webhook"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const SUPABASE_URL = 'https://xdfbjusrwbxoxbcocxkp.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') // Set this in Supabase settings

// Map Brevo event types to our status
const eventMap = {
  'sent': 'sent',
  'delivered': 'delivered',
  'opened': 'opened',
  'click': 'clicked',
  'clicks': 'clicked',
  'hardBounce': 'hardBounce',
  'softBounce': 'softBounce',
  'blocked': 'blocked',
  'unsubscribed': 'unsubscribed',
  'error': 'error'
}

Deno.serve(async (req) => {
  console.log('Webhook received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('Rejecting non-POST request')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const event = await req.json()
    console.log('Parsed JSON event:', JSON.stringify(event, null, 2))
    console.log('Brevo webhook received:', {
      event: event.event,
      email: event.email,
      messageId: event.messageId || event['message-id']
    })

    // Extract data from Brevo event
    const email = event.email || event.recipient
    const eventType = event.event
    const messageId = event.messageId || event['message-id']

    if (!email || !eventType) {
      console.warn('Invalid webhook payload: missing email or event')
      return new Response(JSON.stringify({ error: 'Missing email or event' }), { status: 400 })
    }

    // Map to our status
    const status = eventMap[eventType] || eventType

    // Initialize Supabase client with service key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Find vendors with this email
    const { data: vendors, error: queryErr } = await supabase
      .from('vendors')
      .select('id, email_delivery_status, brevo_message_id')
      .eq('preferred_email', email)

    if (queryErr) {
      console.error('Query error:', queryErr)
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 })
    }

    if (!vendors || vendors.length === 0) {
      console.log(`No vendors found for email: ${email}`)
      return new Response(JSON.stringify({ message: 'No matching vendor' }), { status: 200 })
    }

    // Update each matching vendor
    let updated = 0
    for (const vendor of vendors) {
      // If messageId provided, verify it matches
      if (messageId && vendor.brevo_message_id) {
        const stored = String(vendor.brevo_message_id).trim().replace(/^<|>$/g, '')
        const event_id = String(messageId).trim().replace(/^<|>$/g, '')
        if (stored !== event_id) {
          console.log(`MessageId mismatch for vendor ${vendor.id}: ${stored} !== ${event_id}`)
          continue
        }
      }

      // Update the vendor
      const { error: updateErr } = await supabase
        .from('vendors')
        .update({ email_delivery_status: status })
        .eq('id', vendor.id)

      if (updateErr) {
        console.error(`Failed to update vendor ${vendor.id}:`, updateErr)
      } else {
        console.log(`Updated vendor ${vendor.id} to status: ${status}`)
        updated++
      }
    }

    return new Response(
      JSON.stringify({ success: true, status, email, updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook error:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    })
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500 })
  }
})

console.log('Brevo webhook Edge Function loaded and ready')
})
