/**
 * CAB Student Market — Gmail Inbox bridge (Google Apps Script)
 *
 * Powers the "Mail" tab in the admin dashboard. It runs as the Gmail account that
 * deploys it and lets the dashboard list, read, reply to, send, archive, delete,
 * star and label that account's email. It does NOT touch Brevo — outgoing status
 * emails still go through Brevo exactly as before.
 *
 * SETUP (one time, signed in as the Gmail account you want in the dashboard):
 *  1. Go to https://script.google.com → New project. Paste this whole file into Code.gs.
 *  2. Project Settings (gear icon) → Script Properties → Add property:
 *        Name:  APP_SECRET
 *        Value: a long random password (e.g. 30+ random letters/numbers).
 *     Optional: add SENDER_NAME (e.g. "Canyon Activities Board") to set the
 *     "From" name on replies and new emails.
 *  3. Deploy → New deployment → type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *     Click Deploy and approve the Gmail permissions. Copy the Web app URL (ends in /exec).
 *  4. In the dashboard: Settings → System & Data → paste the Web app URL and the same
 *     APP_SECRET into the Gmail Inbox fields → Save System Settings.
 *
 * After editing this script later: Deploy → Manage deployments → edit (pencil) →
 * Version: "New version" → Deploy. The URL stays the same.
 *
 * "Anyone" access is required so the dashboard can call it from the browser; every
 * request must carry APP_SECRET, and requests without it are rejected.
 */

const PAGE_SIZE_MAX = 50;
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
const OUTGOING_ATTACHMENTS_MAX_BYTES = 20 * 1024 * 1024; // Gmail's limit is 25 MB per email

function doGet() {
  return json_({ ok: true, service: 'cab-gmail-inbox' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request body' });
  }

  const secret = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!secret) return json_({ ok: false, error: 'APP_SECRET is not set in Script Properties' });
  if (!safeEqual_(String(req.secret || ''), secret)) return json_({ ok: false, error: 'unauthorized' });

  try {
    const handler = ACTIONS[req.action];
    if (!handler) return json_({ ok: false, error: 'Unknown action: ' + req.action });
    return json_(Object.assign({ ok: true }, handler(req) || {}));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

const ACTIONS = {
  ping: function () {
    return { email: Session.getEffectiveUser().getEmail() };
  },

  // { query, start, pageSize } → { threads: [...], hasMore }
  list: function (req) {
    const start = Math.max(0, Number(req.start) || 0);
    const size = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(req.pageSize) || 25));
    const threads = GmailApp.search(req.query || 'in:inbox', start, size + 1);
    const hasMore = threads.length > size;
    return { threads: threads.slice(0, size).map(summarizeThread_), hasMore: hasMore };
  },

  // { threadId, markRead } → { thread: {..., messages: [...] } }
  thread: function (req) {
    const thread = getThread_(req.threadId);
    if (req.markRead !== false && thread.isUnread()) thread.markRead();
    const summary = summarizeThread_(thread);
    summary.messages = thread.getMessages().map(function (m) {
      return {
        id: m.getId(),
        from: m.getFrom(),
        to: m.getTo(),
        cc: m.getCc(),
        replyTo: m.getReplyTo(),
        date: m.getDate().toISOString(),
        subject: m.getSubject(),
        html: m.getBody(),
        text: m.getPlainBody(),
        unread: m.isUnread(),
        starred: m.isStarred(),
        inTrash: m.isInTrash(),
        attachments: m.getAttachments({ includeInlineImages: false }).map(function (a, i) {
          return { index: i, name: a.getName(), type: a.getContentType(), size: a.getSize() };
        })
      };
    });
    return { thread: summary };
  },

  // { messageId, index } → { name, type, data (base64) }
  attachment: function (req) {
    const msg = GmailApp.getMessageById(req.messageId);
    if (!msg) throw new Error('Message not found');
    const att = msg.getAttachments({ includeInlineImages: false })[Number(req.index)];
    if (!att) throw new Error('Attachment not found');
    if (att.getSize() > ATTACHMENT_MAX_BYTES) throw new Error('Attachment is too large to preview here — open it in Gmail.');
    return { name: att.getName(), type: att.getContentType(), data: Utilities.base64Encode(att.getBytes()) };
  },

  // { threadId, body, html, replyAll, cc, attachments: [{ name, type, data (base64) }] } — replies to the latest message not sent by this account
  reply: function (req) {
    const thread = getThread_(req.threadId);
    const messages = thread.getMessages();
    const mine = myAddresses_();
    let target = messages[messages.length - 1];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (mine.indexOf(extractEmail_(messages[i].getFrom())) === -1) { target = messages[i]; break; }
    }
    const opts = composeOptions_(req);
    if (req.replyAll) target.replyAll(req.body || '', opts);
    else target.reply(req.body || '', opts);
    return {};
  },

  // { to, cc, bcc, subject, body, html, attachments: [{ name, type, data (base64) }] }
  send: function (req) {
    if (!req.to) throw new Error('Recipient is required');
    const opts = composeOptions_(req);
    if (req.bcc) opts.bcc = req.bcc;
    GmailApp.sendEmail(req.to, req.subject || '(no subject)', req.body || '', opts);
    return {};
  },

  // { threadIds, op, label } — bulk-safe organize operations
  modify: function (req) {
    const ids = [].concat(req.threadIds || []);
    if (!ids.length) throw new Error('No threads selected');
    const threads = ids.map(getThread_);
    const label = req.label ? (GmailApp.getUserLabelByName(req.label) || GmailApp.createLabel(req.label)) : null;
    threads.forEach(function (t) {
      switch (req.op) {
        case 'archive': t.moveToArchive(); break;
        case 'inbox': t.moveToInbox(); break;
        case 'trash': t.moveToTrash(); break;
        case 'spam': t.moveToSpam(); break;
        case 'read': t.markRead(); break;
        case 'unread': t.markUnread(); break;
        case 'star': t.getMessages().forEach(function (m) { m.star(); }); break;
        case 'unstar': t.getMessages().forEach(function (m) { if (m.isStarred()) m.unstar(); }); break;
        case 'important': t.markImportant(); break;
        case 'unimportant': t.markUnimportant(); break;
        case 'addLabel': if (!label) throw new Error('Label required'); t.addLabel(label); break;
        case 'removeLabel': if (!label) throw new Error('Label required'); t.removeLabel(label); break;
        default: throw new Error('Unknown operation: ' + req.op);
      }
    });
    return {};
  },

  // → { labels: [name...], unread: n, email }
  labels: function () {
    return {
      labels: GmailApp.getUserLabels().map(function (l) { return l.getName(); }).sort(),
      unread: GmailApp.getInboxUnreadCount(),
      email: Session.getEffectiveUser().getEmail()
    };
  },

  createLabel: function (req) {
    if (!req.label) throw new Error('Label name required');
    GmailApp.createLabel(req.label);
    return {};
  },

  deleteLabel: function (req) {
    const label = GmailApp.getUserLabelByName(req.label);
    if (label) label.deleteLabel();
    return {};
  }
};

function summarizeThread_(t) {
  const messages = t.getMessages();
  const first = messages[0];
  const last = messages[messages.length - 1];
  const participants = [];
  messages.forEach(function (m) {
    const name = displayName_(m.getFrom());
    if (participants.indexOf(name) === -1) participants.push(name);
  });
  return {
    id: t.getId(),
    subject: t.getFirstMessageSubject() || first.getSubject() || '(no subject)',
    from: last.getFrom(),
    fromEmail: extractEmail_(first.getFrom()),
    participants: participants,
    snippet: (last.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    date: t.getLastMessageDate().toISOString(),
    count: t.getMessageCount(),
    unread: t.isUnread(),
    starred: t.hasStarredMessages(),
    important: t.isImportant(),
    inInbox: t.isInInbox(),
    inTrash: t.isInTrash(),
    inSpam: t.isInSpam(),
    hasAttachments: messages.some(function (m) { return m.getAttachments({ includeInlineImages: false }).length > 0; }),
    labels: t.getLabels().map(function (l) { return l.getName(); })
  };
}

function composeOptions_(req) {
  const opts = { htmlBody: req.html || textToHtml_(req.body || '') };
  if (req.cc) opts.cc = req.cc;
  const files = [].concat(req.attachments || []);
  if (files.length) {
    let total = 0;
    opts.attachments = files.map(function (f) {
      const bytes = Utilities.base64Decode(String(f.data || ''));
      total += bytes.length;
      return Utilities.newBlob(bytes, f.type || 'application/octet-stream', f.name || 'attachment');
    });
    if (total > OUTGOING_ATTACHMENTS_MAX_BYTES) throw new Error('Attachments are over 20 MB — Gmail will not send them.');
  }
  const name = PropertiesService.getScriptProperties().getProperty('SENDER_NAME');
  if (name) opts.name = name;
  return opts;
}

function getThread_(id) {
  const t = GmailApp.getThreadById(String(id || ''));
  if (!t) throw new Error('Conversation not found (it may have been deleted)');
  return t;
}

function myAddresses_() {
  return [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(function (a) { return a.toLowerCase(); });
}

function extractEmail_(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}

function displayName_(from) {
  const s = String(from || '');
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : extractEmail_(s);
}

function textToHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
