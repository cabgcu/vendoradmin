# CAB Student Market — Admin Handbook
### A Guide for Staff & Administrators

---

## Table of Contents

1. [Overview](#1-overview)
2. [Logging In](#2-logging-in)
3. [The Dashboard](#3-the-dashboard)
4. [Navigating the App](#4-navigating-the-app)
5. [Reviewing Applications](#5-reviewing-applications)
6. [Approving, Denying & Flagging Vendors](#6-approving-denying--flagging-vendors)
7. [Sending Emails](#7-sending-emails)
8. [Bulk Email](#8-bulk-email)
9. [Vendor Confirmation & Attendance](#9-vendor-confirmation--attendance)
10. [Check-In on Event Day](#10-check-in-on-event-day)
11. [Vendor Profiles](#11-vendor-profiles)
12. [Settings — Event Setup](#12-settings--event-setup)
13. [Settings — Email Templates](#13-settings--email-templates)
14. [Settings — Form Builder](#14-settings--form-builder)
15. [Settings — System & Data](#15-settings--system--data)
16. [Settings — User Management](#16-settings--user-management)
17. [Settings — Automations](#17-settings--automations)
18. [Tips, Warnings & Common Questions](#18-tips-warnings--common-questions)

---

## 1. Overview

**CAB Student Market Admin** is the back-office system for managing student market events at GCU. It covers the full lifecycle of a vendor application:

```
Application Submitted → Staff Reviews → Approved or Denied
       → Email Sent → Vendor Confirms Attendance → Check-In on Event Day
```

You can manage multiple market events, send templated emails, track who confirmed and who showed up, scan QR codes at the door, and export data for reporting — all from one place.

---

## 2. Logging In

Open the admin site in your browser. You will see a login screen asking for your email and password.

- **Admin accounts** have full access to everything.
- **Staff accounts** can view applications and vendor details but cannot change statuses, send emails, or access Settings.

If you need an account created, ask your admin to whitelist your email in **Settings → User Management**, then use the sign-up link on the login page.

> **Forgot your password?** Contact your admin — they can reset the master password in **Settings → System & Data**.

---

## 3. The Dashboard

After logging in you land on the **Vendors** view. At the top you'll see three stat cards:

| Card | What it shows |
|------|--------------|
| **New Apps** | Applications you haven't reviewed yet |
| **Application Status** | Total approved / in review / denied counts |
| **Event Attendance** | How many vendors have confirmed or declined |

These update in real time as you work through applications.

The active market event is shown in the top bar next to the logo. If you manage multiple markets, click the dropdown there to switch between them.

---

## 4. Navigating the App

### Top Navigation

| Button | What it does |
|--------|-------------|
| **Vendors** | Main application list (where you spend most of your time) |
| **Profiles** | Archive of all vendors across all past markets |
| **Check In** | Event-day scanner and manual check-in |
| **Settings** | Configuration, templates, user management |
| **Logout** | Signs you out |

On mobile, these same options appear as tabs along the bottom of the screen.

### Filter Tabs (inside Vendors view)

Once you're in the Vendors view, a second row of tabs lets you narrow the list:

| Tab | Shows |
|-----|-------|
| **All** | Every application for this market |
| **New** | Fresh applications not yet reviewed |
| **Approved** | Vendors you've approved |
| **Review** | Vendors flagged as "Needs Review" |
| **Power** | Approved vendors who requested a power outlet |
| **Denied** | Rejected applications |

### Search & Filter

- **Search bar** — type a vendor's name, email, or student ID to instantly filter the list.
- **Filter dropdown** — for more targeted views: Food License vendors, Confirmed attendees, Can't Attend, or by vendor theme/category.
- **Sort dropdown** — sort by name (A–Z or Z–A), by color tag, or drag rows manually into a custom order.

---

## 5. Reviewing Applications

Click any row in the vendor list to open that vendor's full **Review Modal**. This is where you'll spend most of your time.

### What you'll see on the left:

- **Personal info** — Student ID, phone, preferred email, GCU email
- **Vendor description** — What they're selling or making
- **Special requests** — Power outlet, food license, social media link
- **Additional comments** — Anything they added at the end of the form
- **Agreements** — Which consent boxes they checked on the form
- **AI Insights** — If AI is enabled, this shows an auto-categorization of their vendor type and any food license scan results
- **Duplicate Detection** — A red 🚨 alert appears if another application looks like the same person. Click the linked name to compare side-by-side.

### What you'll see on the right:

- **Status buttons** — Approve, Needs Review, Deny
- **Check-In button** — Mark the vendor as physically present (on event day)
- **Email status tracker** — Shows whether their approval/denial email was sent and when

### Internal Notes

At the bottom of the modal there is a **notes feed** — a private comment thread that only staff can see. Use it to leave context for your team ("confirmed food license by phone," "spoke with vendor, they'll be late," etc.).

- Type in the notes box and press **Save Comment**.
- Every note shows who wrote it and when.
- You can delete your own notes using the trash icon.
- Status changes (approve, deny, etc.) are also logged here automatically as system notes.

---

## 6. Approving, Denying & Flagging Vendors

You can change a vendor's status in two ways:

**From the list view** — use the three quick-action buttons on the right side of each row:
- ✓ → Approve
- ··· → Needs Review
- ✕ → Deny

**From inside the review modal** — use the larger Approve / Needs Review / Deny buttons on the right side.

When you **Deny** a vendor, a popup will ask you to enter a reason. That reason is automatically saved as an internal note.

### Status Meanings

| Status | Meaning |
|--------|---------|
| **Pending** | Just submitted, not yet reviewed |
| **Needs Review** | Flagged by a staff member for closer look |
| **Approved** | Accepted to the market |
| **Denied** | Rejected |
| **Checked In** | Physically arrived at the event |

---

## 7. Sending Emails

Emails are sent through the Brevo email service and require the Brevo API key to be configured in Settings. Only **admins** can send emails.

### Sending a Single Email

When you approve or deny a vendor, you can send their notification email directly from the review modal. Look for the **Email Status** section on the right side — it shows whether an email has been sent.

- If no email has been sent yet, there will be a **Send Email** button.
- If an email was already sent, you'll see the send date and a **Resend** button.

The email is built automatically from the relevant template (Approved, Power, Power Denied, or Denied) and includes the vendor's name, event details, and their unique confirmation/decline links.

### Email Delivery Tracking

After sending, the email status icon in the vendor list and inside the review modal will update as Brevo reports back:

| Icon/Status | Meaning |
|-------------|---------|
| Empty | Not sent yet |
| Sent | Email left our system |
| Delivered | Brevo confirmed delivery |
| Opened | Vendor opened the email |
| Clicked | Vendor clicked a link |
| Bounced | Email address invalid or rejected |

---

## 8. Bulk Email

The **Bulk Email** button appears in the top-right of the vendor list when you're on the **Approved**, **Power**, or **Denied** tabs. It lets you send a batch of emails at once.

### How to use it:

1. Navigate to the tab for the group you want to email (e.g., **Approved**).
2. Click **Bulk Email** in the top right.
3. A modal opens. At the top, choose which **template** to send:
   - Approved Template (Standard)
   - Approved (Power Granted)
   - Approved (Power Denied)
   - Denied Template
   - Custom Mass Email
4. Below the template selector, you'll see a checklist of eligible vendors. Vendors who have already received that email type are marked **[Already Sent]** and are unchecked by default. Vendors who haven't received an email are marked **[Unsent]** and are pre-checked.
5. Use **Select All** or **Deselect All** to adjust, or check/uncheck individual vendors.
6. Click **Send Selected Emails**. A confirmation dialog will tell you how many emails you're about to send — confirm to proceed.

A loading indicator shows progress (e.g., "SENDING 10 / 47"). When done, you'll see a summary of how many succeeded or failed.

> **Warning:** Once you click confirm, emails go out immediately. Double-check your template selection and recipient list before confirming.

> **Needs Review vendors are excluded** from bulk sends automatically. If there are unreviewed vendors when you try to bulk-email from the Approved tab, you'll see a warning — you can bypass it or go review those vendors first.

---

## 9. Vendor Confirmation & Attendance

After a vendor receives their approval email, they'll see two buttons:

- **✓ Confirm Attendance** — they're in, see you at the market
- **✕ Can't Make It** — they need to give up their spot

Clicking either link updates your dashboard automatically. No manual follow-up needed.

If a vendor requested a **power outlet**, the Power template includes two additional buttons:

- **⚡ Confirm Power** — they still need it
- **🔌 No Longer Need Power** — they've changed their mind

### Tracking Responses

The **Event Attendance** stat card on the dashboard shows your running count. You can also filter the vendor list by **Confirmed**, **Can't Attend**, or **Awaiting Reply** using the filter dropdown.

The **Confirmed** column in the table shows each vendor's current response:
- ✓ — Confirmed
- ✕ — Can't Make It / Declined
- (empty) — No response yet

---

## 10. Check-In on Event Day

Navigate to the **Check In** tab. This view is designed for event-day use.

At the top you'll see live counters:
- **Checked In** — vendors who have physically arrived
- **Confirmed** — vendors who confirmed but haven't arrived yet

### Scanning QR Codes

1. Click **📷 Scan QR Code with Camera** (works best on a phone or tablet).
2. Point the camera at the vendor's QR ticket (sent to them in their approval email).
3. When a valid code is detected, a full-screen confirmation flashes showing the vendor's name, type, and any special flags (Power, Food).

### Manual Search

If scanning isn't working, use the **Universal Search & Scanner** bar:

1. Type the vendor's name, or have them type it themselves.
2. Matching vendors appear as a dropdown list.
3. Click their name to check them in.

Checking a vendor in automatically updates their status to **Checked In** and logs the timestamp.

### Form Access Control

At the top of the Check In view there are three buttons to control the public application form:

| Button | Effect |
|--------|--------|
| **Auto** | Form opens and closes based on your scheduled dates |
| **Force Open** | Overrides schedule — form stays open regardless of date |
| **Force Closed** | Overrides schedule — form stays closed regardless of date |

This is useful if you need to extend the deadline or cut off applications early.

---

## 11. Vendor Profiles

The **Profiles** tab shows a master archive of every vendor who has ever applied across all markets — not just the current one.

Use it to:
- Look up a repeat vendor's history
- Find someone's student ID or contact info
- See how many times someone has applied

**Search** works the same as the main vendor list — type a name, email, or student ID.

Click any row to see that vendor's full profile summary, including which markets they applied to and their application outcomes.

---

## 12. Settings — Event Setup

Go to **Settings** and click the **Event Setup** tab.

### Edit the Active Market

Fill in or update the fields for your current market:

| Field | Example |
|-------|---------|
| Student Market Name | Spring 2025 Student Market |
| Location | Antelope Gym |
| Date of Market | 2025-04-15 |
| Time | 6:30–9:00pm |
| App Opens | 2025-03-01 12:00 PM |
| App Closes Deadline | 2025-04-01 11:59 PM |
| Vendor Contact Date | 2025-04-05 |
| Vendor Confirm Deadline | 2025-04-10 |

Click **Update ACTIVE Event** to save changes to the current market.

Click **Create as NEW Event** to create a brand-new market without touching the current one.

### Danger Zone

At the bottom of this tab is a **Delete Current Event** button. This permanently deletes the market and all associated applications. There is no undo. Use only if you created a test event and need to remove it.

---

## 13. Settings — Email Templates

Go to **Settings** and click the **Email Templates** tab.

You have five templates:

| Template | When it's used |
|----------|---------------|
| **Approved** | Standard approval for vendors without power |
| **Approved (Power Granted)** | Approval where power is confirmed |
| **Approved (Power Denied)** | Approval, but power not available |
| **Denied** | Rejection notice |
| **Custom Mass Email** | One-time message to any group of vendors |

### Editing a Template

1. Select the template you want to edit from the dropdown at the top.
2. Edit the **Subject** line.
3. Edit the **body** in the text area below.
4. Use the **Insert Variable** buttons to drop in placeholders:

| Variable | Replaced with |
|----------|--------------|
| `{{FIRST}}` | Vendor's first name |
| `{{MARKET_NAME}}` | Event name |
| `{{LOCATION}}` | Event location |
| `{{MARKET_DATE}}` | Event date |
| `{{MARKET_TIME}}` | Event time |
| `{{CONFIRM_DEADLINE}}` | Deadline to confirm attendance |
| `{{CONFIRM_LINK}}` | Button for vendor to confirm attendance |
| `{{DECLINE_LINK}}` | Button for vendor to decline |
| `{{POWER_CONFIRM_LINK}}` | Button for vendor to confirm power need |
| `{{POWER_DECLINE_LINK}}` | Button for vendor to release power request |

5. Use **Bold** to apply bold formatting to selected text.
6. Click **Save Template** when done.
7. Use **Reset Default** to restore the system's built-in wording.

### Banner Image & Heading

- **Banner URL** — paste a direct image link to show a header image at the top of every email.
- **Heading Text** — the large title that appears in the email header (e.g., "Spring 2025 Student Market").

### Live Preview

Click **Preview** (or the preview icon) to see exactly how the email will look in a real inbox, complete with your banner, variables filled in, and QR code (for approved emails).

### Custom Mass Email

Select the **Custom Mass Email** template to write a one-time message — a market update, reminder, or announcement. Once written, click **Send Custom Blast** and choose your target audience:

- All Active (Approved + Checked In)
- Approved only
- Checked In only
- Denied only
- Pending only
- Everyone

---

## 14. Settings — Form Builder

Go to **Settings** and click the **Form Builder** tab.

This controls what questions appear on the **public vendor application form** that vendors fill out when they apply.

- Some fields (name, student ID, email, etc.) are built-in and cannot be removed.
- You can **add** custom questions, **reorder** them by dragging, and **remove** ones you don't need.
- Questions can be made required or optional.
- A live preview shows exactly how the form looks to applicants.

Click **Save** when you're happy with the form layout.

---

## 15. Settings — System & Data

Go to **Settings** and click the **System & Data** tab.

### Exporting Data

| Button | What it exports |
|--------|----------------|
| **Download Full CSV Backup** | All vendor data, notes, statuses, emails — everything |
| **Download Checked-In Vendors (CSV)** | Only vendors who checked in: name, student ID, GCU email |

The Checked-In CSV is useful for post-event reporting, verifying attendance, or sharing with the venue.

### Changing the Admin Password

Enter a new password and click **Update Password**. This affects all admin accounts. Make sure you share the new password with your team before changing it.

### Storage Cleanup

If your Supabase storage is getting full (free tier limit is 50 MB), click **Delete Old Files** to remove food license images uploaded more than 12 months ago. Vendor profiles and application data are not affected — only the image files are deleted.

---

## 16. Settings — User Management

Go to **Settings** and click the **User Management** tab.

### Adding a New Staff Member

1. Enter their GCU email address in the **Authorized Emails** field.
2. Click **Add Email**.
3. Send them the link to the admin site.
4. They can create their own account by clicking the sign-up link on the login page.

Accounts created through this process are **staff-level** (read-only) by default. Contact your system administrator if someone needs full admin access.

### Removing Access

Click **Remove** next to any email in the authorized list to revoke their ability to sign up. If they already have an account, contact your system administrator to remove it.

---

## 17. Settings — Automations

Go to **Settings** and click the **Automations** tab.

Automations let the system take actions automatically when certain things happen — so you don't have to.

### Built-In Automations

These come pre-configured and can be toggled on or off:

| Automation | What it does |
|------------|-------------|
| **Duplicate Detection** | Flags applications that look like the same person applied twice |
| **AI Vendor Categorization** | Automatically categorizes what each vendor is selling |
| **Late Application Tracking** | Assigns a "strike" to vendors who apply after the deadline |
| **Auto-Confirmation Reminders** | Sends reminder emails to vendors who haven't confirmed yet |

### Creating a Custom Automation

Click **+ New Automation**. You can either:

**Option A — Describe it in plain English:**
Type what you want (e.g., "When a vendor is approved, send them the approved email after a 1-hour delay") and click **Generate from Prompt**. The AI will build the automation for you.

**Option B — Set it up manually:**

1. Give the automation a name.
2. Choose a **Trigger** (what causes it to run):
   - When a new application is received
   - When a vendor is approved or denied
   - When a vendor checks in
   - Before the market date (as a reminder)
   - When the application deadline passes
   - When a vendor reaches 1, 2, or 3+ strikes
   - After the market (post-event follow-up)

3. Choose an **Action** (what it should do):
   - Send a specific email template
   - Change the vendor's status
   - Add an internal note
   - Add a label/tag

4. Optionally set a **Delay** — e.g., wait 2 hours after the trigger before running.

5. Click **Create Automation**.

### Automation Log

Below the automation list there's a log showing recent automation activity — useful for confirming that things ran correctly.

---

## 18. Tips, Warnings & Common Questions

### "The Bulk Email button isn't showing up."
The Bulk Email button only appears when you're on the **Approved**, **Power**, or **Denied** filter tabs. Switch to one of those tabs first.

### "I approved a vendor but they didn't get an email."
Check a few things:
1. Is the Brevo API key configured in Settings?
2. Is the Public URL set in Settings? (Without it, confirmation links in emails will be broken and the system may block sending.)
3. Check the email status icon in the review modal — it will show if sending failed.

### "A vendor says they confirmed but the dashboard doesn't show it."
The confirmation links in emails update the database in real time. Try refreshing your browser. If it still doesn't show, check the vendor's row in the list — the Confirmed column should reflect their response.

### "How do I switch to a different market?"
Click the event name dropdown in the top bar (next to the CAB logo). All data — vendors, emails, check-ins — is scoped to whichever event is selected.

### "What's the difference between Approved and Checked In?"
- **Approved** = their application was accepted; they may or may not be coming.
- **Confirmed** = they clicked the confirmation link in their email saying they'll be there.
- **Checked In** = they physically showed up at the event and were scanned/marked in.

### "I see a 🚨 Duplicate flag on a vendor. What do I do?"
Click the linked name in the alert to open the other application and compare. Decide which application is the "real" one, deny or delete the duplicate, and add an internal note explaining the situation.

### "Can I undo a status change?"
Yes — just click a different status button. There's no lock-in. The activity log in internal notes will keep a record of every change for accountability.

### "What happens when I delete a market event?"
Everything is gone — applications, statuses, internal notes, email records, all of it. This cannot be undone. Export a CSV backup before deleting if you need to keep the data.

### "Who can see internal notes?"
Only staff and admins who are logged in. Vendors never see internal notes.

### "What does 'Needs Review' mean? Can I use it for anything?"
It's a general-purpose flag. Use it however works for your team — common uses are "food license needs manual verification," "application info looks incomplete," or "waiting on a follow-up from the vendor." You can filter the entire list to just Needs Review to work through your flagged cases.

---

*CAB Student Market Admin — for questions or issues, contact your system administrator.*
