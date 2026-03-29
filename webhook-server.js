const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Supabase setup
const SUPABASE_URL = 'https://xdfbjusrwbxoxbcocxkp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ylaFmuuSPD2UcKdF1yKw4g_UPXiRRef';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
};

// Webhook endpoint for Brevo events
app.post('/webhook/brevo', async (req, res) => {
  try {
    const event = req.body;

    console.log('Brevo webhook received:', {
      event: event.event,
      email: event.email,
      messageId: event.messageId || event['message-id'],
      timestamp: new Date().toISOString()
    });

    // Extract email and event type
    const email = event.email || event.recipient;
    const eventType = event.event;
    const messageId = event.messageId || event['message-id'];

    if (!email || !eventType) {
      console.warn('Invalid webhook payload:', event);
      return res.status(400).json({ error: 'Missing email or event type' });
    }

    // Map Brevo event to our status
    const status = eventMap[eventType] || eventType;

    // Find vendor by email
    const { data: vendors, error: queryErr } = await supabase
      .from('vendors')
      .select('id, email_delivery_status, brevo_message_id')
      .eq('preferred_email', email);

    if (queryErr || !vendors || vendors.length === 0) {
      console.warn(`No vendor found for email: ${email}`);
      return res.status(200).json({ message: 'No matching vendor' });
    }

    // Update each vendor with matching email
    for (const vendor of vendors) {
      // Only update if this is the right message
      if (messageId && vendor.brevo_message_id) {
        const normalizedStored = String(vendor.brevo_message_id).trim().replace(/^<|>$/g, '');
        const normalizedEvent = String(messageId).trim().replace(/^<|>$/g, '');
        if (normalizedStored !== normalizedEvent) continue;
      }

      // Update status in database
      const { error: updateErr } = await supabase
        .from('vendors')
        .update({ email_delivery_status: status })
        .eq('id', vendor.id);

      if (updateErr) {
        console.error(`Failed to update vendor ${vendor.id}:`, updateErr);
      } else {
        console.log(`Updated vendor ${vendor.id} to status: ${status}`);
      }
    }

    res.status(200).json({ success: true, status, email });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Brevo webhook: POST http://localhost:${PORT}/webhook/brevo`);
});
