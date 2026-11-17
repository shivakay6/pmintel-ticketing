# PMIntel · Ticket Automation (working prototype)

A clickable, working prototype of the Ticket Automation PRD (Settings > Automation > Ticket Automation).
No backend: all state lives in the browser tab, so **a refresh resets everything to the seeded default state**.

## Deploy on Vercel
1. Push this folder to a Git repo (or drag it into Vercel) and import it as a project.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (already set in `vercel.json`).
3. Deploy. No environment variables needed.

Local: `npm install && npm run dev` (or `npm run build && npm run preview`).

## What people see on first load
Five pre-loaded rules, so nobody sees a blank state:
| Rule | State | Why it is there |
|---|---|---|
| #112 Negative Reviews – Chennai | Active, **V3** (V1, V2 Stopped) | Versions, "Edited" ribbon, change diff, activity log, High priority, due date |
| #109 Positive Advocates to Marketing | Active, V2 | Source filter (Google), role assignment to Marketing |
| #118 Unexplained Low Ratings | **Paused**, V1 | Resume flow, Rating Only |
| #121 Hidden Dissatisfaction – Mumbai | Active, V1, **health banner** | Assigned to an inactive user ("Assignee is inactive") |
| #124 Neutral Feedback Follow-up | Active, V1 | Overlap and load-balancing demos |

Plus 16 locations, 14 users in 4 roles, ~100 tickets (auto and manual).

## What to click (maps to PRD IDs)
**Dashboard (D1–D14):** search (debounced), sort Newest/Oldest/Recently edited, filter modal with removable chips, three-dot menu (Active: Edit, Pause, Duplicate. Paused: Edit, Resume, Duplicate), clickable location list, ticket counts (Overall and current version) that open the Tickets list filtered by rule and version, health banner, 20-at-a-time loading, no-results state, empty state with 3 starter templates.

**Create / Edit:** 5-step modal with stepper and Back. Basics (unique name, module, location filter with 6 tabs, dynamic vs fixed hint), Conditions (type, ratings, sentiment rules, source, and a "This rule will create a ticket for a review that matches all of these" box), Action (role or user, "How it works", plain comment, priority, **mandatory due date** (numbers only, in hours, as Calendar hours or Business hours; business hours skip Saturday and Sunday, public holidays not excluded)), Email (the assignment email: To is locked to the assignee; CC, BCC, Reply to, Subject, Body, variables; it goes out every time the rule creates a ticket), Review and Activate (plain-language summary, a preview of the assignment email, Start in Paused state). Editing locks Module and keeps the previous status. Rules start working from the time of activation: every matching review that comes in after that creates a ticket.

**History (H1–H5):** version cards, "What changed" strip from V2 on, activity log, Active/Paused/Stopped filter.

**Popups (P1–P9):** Edit, Pause, Resume, Discard (also on Esc), Overlapping rule, Created / New version saved, Could not save, Assignee unavailable.

**Reminders** (Settings > Automation > Reminders): any number of reminders, each Before, On or After the ticket's due date, with a number of hours (numbers only), Calendar or Business hours. Email template: To is locked to whoever is assigned to the ticket at the moment of sending; CC, BCC, Reply to, Subject and Body are editable, with basic variables (recipient name, ticket number, priority, due date, location, ticket link). Reminders can be paused, resumed and deleted. The Reminder and Escalation editors are 3-step popups (Timing, Email, Preview). Assignment emails from rules appear on the Sent emails page. Duplicating a rule keeps all other rules visible.

**Escalation** (Settings > Automation > Escalation): Level 1, 2, 3 and so on (up to 5). Each level picks a User Role or a User Name, a delay in hours (numbers only, Calendar or Business hours), and an email template whose To is locked by that choice. Level 1 is timed from the due date; each later level is timed from when the previous level was sent. A role is shared in round robin, A to Z. It stops when the ticket is Resolved or Closed. Escalation only notifies; it does not reassign.

**Prototype clock:** use Demo controls or the yellow bar on the Tickets page to move time forward (+1 hour to +7 days). Due reminders and escalations then fire and appear under Prototype tools > Sent emails (a demo page, not part of the product). On the Tickets page you can change an assignee or resolve a ticket first to see the effect.

Assumptions to confirm (see the PRD when written): escalation round robin only uses users who cover the ticket's location; business hours skip Saturday and Sunday and ignore public holidays; changes apply from the time they are saved and are never sent late for the past; reminders that would fall before a ticket was created are not sent.

## Prototype tools (not part of the product)
- **Review simulator:** stands in for Reputation Management. Processing a review means it arrives now. It runs through the real engine: active rules only, location scope, conditions, one ticket per review (priority, then older rule), role pool + 5-key ranking, unassigned handling. Try it: process the first review (Adyar, 1★ Negative). Esha Patel gets it, exactly the PRD worked example. Pause #112 and process again to see the difference.
- **Team and workload:** shows the numbers the ranking uses; toggle a user inactive to trigger health flags, unassigned tickets and the "Assignee unavailable" popup (do it while on step 3 with that user selected).
- **Tickets:** minimal list; change a status to Resolved/Closed to see open counts and the next assignment change.
- **Demo controls** (bottom right): view-only user (hides Create Rule), empty dashboard, make the next save fail, reset.

## Code map
`src/data.js` seed data · `src/engine.js` rule engine (matching, precedence, assignment, preview, overlap, diff, health, validation) · `src/store.jsx` reducer · `Dashboard.jsx`, `Wizard.jsx`, `History.jsx`, `Tickets.jsx`, `Simulator.jsx`, `Team.jsx`, `Reminders.jsx`, `Escalation.jsx`, `Notify.jsx` (email fields, live preview, clock), `EmailLog.jsx`, `schedule.js` (reminder and escalation scheduler), `time.js` (calendar and business date maths).
`engine.js` is plain JS with no React and can be lifted into backend tests as the reference for rule behaviour.

## Known prototype limits
Timezone is the browser's. Permissions are a demo toggle. Due dates are shown on tickets but there are no timers. Notifications (e.g. "notify the rule creator") are not simulated.

## Tickets dashboard (Reviews → Tickets)

- **Reviews** (sidebar): browse reviews and click *Create ticket*. Required: assignee. Optional: comment (300), up to 3 attachments. Priority defaults to Medium. **Due date is in hours only (1 to 720), counted as Calendar or Business hours**, with the resulting date shown live. One ticket per review.
- **Tickets**: status tiles (All, New, In Progress, On Hold, Resolved, Closed, Due soon, Overdue), search, sort (Newest, Oldest, Urgency), filter popup, paging, and a View Details panel with the review, update form, comments (edit your own) and a full history.
- **Statuses**: New, In Progress, On Hold, Resolved, Closed. A comment is required for On Hold, Resolved and Reopen. The first comment on a New ticket moves it to In Progress. Resolved closes automatically after 72 hours. Reopening a ticket whose due date has passed needs a new due date.
- **SLA** is derived from the clock: On track, Due soon (last 25% of the window or 4 hours), Overdue, Met, Breached. On Hold does not pause it.
- **Emails**: creating a ticket by hand or reassigning one sends the default assignment email. Changing the due date or reopening restarts reminders and escalation for the new due date.
- Use the clock bar (+1 hour … +7 days) to watch statuses, SLA and auto-close change.

## v10 changes
- Review attributes: new optional condition under Sentiment (Create, Edit, Duplicate rule; only for reviews with text). Attributes also show on reviews, the Create ticket popup and ticket details.
- Reminders go only to the ticket holder (first assignee, or the new assignee after a reassignment), never to Escalation recipients.
- Escalation Level 1 is timed from the last reminder that was actually sent, or from the due date if none was sent. Later levels still follow the previous level.
- Duplicate rule: new name required, and at least one of Locations, any Condition, Assign to, Priority or Due date must change. Comment and Email do not count.
- v10.1: Review attributes are now a field in Create ticket (Reviews page, pre-filled from the review, editable) and in Update ticket (Review Tickets details, editable). Changes are recorded in the ticket history.
