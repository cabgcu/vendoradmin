// Supabase Edge Function: brevo-webhook
// Deploy this in your Supabase dashboard at Functions > Create Function
// Name it "brevo-webhook"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const SUPABASE_URL = 'https://xdfbjusrwbxoxbcocxkp.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY') // Set this in Supabase settings

// Map Brevo event types to our status
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
    console.log('Event type mapping:', {
      received: eventType,
      mapped: status,
      mapped_correctly: eventType in eventMap
    })

    // Initialize Supabase client with service key
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_KEY')
    if (!serviceKey) {
      console.error('ERROR: SUPABASE_SERVICE_KEY not set in environment')
      return new Response(JSON.stringify({ error: 'Service key missing' }), { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, serviceKey)
    console.log('Supabase client initialized')

    // Find vendors with this email
    console.log(`Querying vendors with email: ${email}`)
    const { data: vendors, error: queryErr } = await supabase
      .from('vendors')
      .select('id, email_delivery_status, brevo_message_id, preferred_email')
      .eq('preferred_email', email)

    console.log('Query result:', { queryErr, vendorCount: vendors?.length || 0 })

    if (queryErr) {
      console.error('Query error:', queryErr)
      return new Response(JSON.stringify({ error: 'Database error', details: queryErr.message }), { status: 500 })
    }

    if (!vendors || vendors.length === 0) {
      console.log(`No vendors found for email: ${email}`)
      return new Response(JSON.stringify({ message: 'No matching vendor' }), { status: 200 })
    }

    console.log(`Found ${vendors.length} vendor(s) for ${email}:`, vendors.map(v => ({ id: v.id, current_status: v.email_delivery_status })))

    // Update each matching vendor
    let updated = 0
    for (const vendor of vendors) {
      console.log(`Processing vendor ${vendor.id}, checking messageId...`)
      // If messageId provided, verify it matches
      if (messageId && vendor.brevo_message_id) {
        const stored = String(vendor.brevo_message_id).trim().replace(/^<|>$/g, '')
        const event_id = String(messageId).trim().replace(/^<|>$/g, '')
        console.log(`MessageId check: stored="${stored}" vs event="${event_id}"`)
        if (stored !== event_id) {
          console.log(`MessageId mismatch for vendor ${vendor.id}, skipping`)
          continue
        }
      }

      // Update the vendor
      console.log(`Updating vendor ${vendor.id} to status: ${status}`)
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

    console.log(`Webhook processing complete: ${updated} vendor(s) updated`)
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
