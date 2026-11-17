// Reminders and escalation: timing, templates, recipients and the scheduler.
import { addHours, subHours } from './time.js';
import { fmtDT, fmtDate, fmtTime } from './engine.js';

export const DAY_KINDS = [{ key: 'calendar', label: 'Calendar hours' }, { key: 'business', label: 'Business hours' }];
export const emailOf = (u) => u ? u.name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@acmeretail.com' : '';

// ── Template variables (kept basic) ──────────────────────────
export const VARS_REMINDER = [
  ['recipient_name', 'Recipient name'], ['ticket_number', 'Ticket number'], ['ticket_priority', 'Priority'],
  ['due_date', 'Due date'], ['location_name', 'Location'], ['ticket_link', 'Ticket link'],
];
export const VARS_ASSIGNMENT = [...VARS_REMINDER, ['review_rating', 'Review rating'], ['review_text', 'Review text']];
export const VARS_ESCALATION = [
  ...VARS_REMINDER, ['assignee_name', 'Assignee name'], ['escalation_level', 'Escalation level'], ['overdue_by', 'Overdue by'],
];
export const renderTemplate = (str, vars) => (str || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
export const unknownVars = (str, allowed) => [...new Set([...(str || '').matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]).filter((k) => !allowed.includes(k)))];

const DEFAULT_BODY_R = 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} ({{ticket_priority}} priority) at {{location_name}} is due on {{due_date}}.\n\nOpen the ticket: {{ticket_link}}';
const DEFAULT_BODY_E = 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} ({{ticket_priority}} priority) at {{location_name}} was due on {{due_date}} and is still open. It is overdue by {{overdue_by}} and is assigned to {{assignee_name}}.\n\nOpen the ticket: {{ticket_link}}';
import { emptyAssignEmail } from './data.js';
export { emptyAssignEmail };
export const emptyReminder = () => ({ name: '', when: 'before', value: 24, dayType: 'calendar', cc: '', replyTo: '', bcc: '', subject: 'Reminder: ticket {{ticket_number}} is due on {{due_date}}', body: DEFAULT_BODY_R });
export const emptyLevel = () => ({ userType: 'role', recipient: '', hours: 4, dayType: 'calendar', cc: '', replyTo: '', bcc: '', subject: 'Escalation level {{escalation_level}}: ticket {{ticket_number}} is overdue', body: DEFAULT_BODY_E });

export const reminderWhenText = (r) => r.when === 'on' ? 'On the due date' : `${r.value} ${r.dayType} hour${Number(r.value) === 1 ? '' : 's'} ${r.when} the due date`;
export const levelWhenText = (lv, n) => `${lv.hours} ${lv.dayType} hour${Number(lv.hours) === 1 ? '' : 's'} ${n === 1 ? 'after the last reminder (or the due date)' : `after Level ${n - 1} is sent`}`;
export const reminderAt = (dueAt, r) => r.when === 'on' ? dueAt : r.when === 'before' ? subHours(dueAt, Number(r.value), r.dayType) : addHours(dueAt, Number(r.value), r.dayType);

// ── Validation ───────────────────────────────────────────────
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const list = (s) => (s || '').split(/[,;\s]+/).filter(Boolean);
export function validateEmail(d, allowed) {
  const e = {};
  const chk = (k, label, max) => { const l = list(d[k]); if (l.length > max) e[k] = `Up to ${max} address${max === 1 ? '' : 'es'}.`; else if (l.some((x) => !EMAIL.test(x))) e[k] = `${label} has an invalid email address.`; };
  chk('cc', 'CC', 5); chk('bcc', 'BCC', 5); chk('replyTo', 'Reply to', 1);
  if (!d.subject.trim()) e.subject = 'Subject is required.';
  else if (d.subject.length > 150) e.subject = 'Up to 150 characters.';
  else { const u = unknownVars(d.subject, allowed); if (u.length) e.subject = `Unknown variable {{${u[0]}}}.`; }
  if (!d.body.trim()) e.body = 'Body is required.';
  else if (d.body.length > 2000) e.body = 'Up to 2000 characters.';
  else { const u = unknownVars(d.body, allowed); if (u.length) e.body = `Unknown variable {{${u[0]}}}.`; }
  return e;
}
export const validateAssignEmail = (d) => validateEmail(d, VARS_ASSIGNMENT.map((x) => x[0]));
export function validateReminder(d, all, editingId) {
  const e = {};
  const n = d.name.trim();
  if (!n) e.name = 'Name is required.';
  else if (n.length < 3 || n.length > 60) e.name = 'Use 3 to 60 characters.';
  else if (all.some((r) => r.id !== editingId && r.name.toLowerCase() === n.toLowerCase())) e.name = 'A reminder with this name already exists.';
  if (d.when !== 'on') { const v = Number(d.value); if (!Number.isInteger(v) || v < 1) e.value = 'Enter a number of hours.'; else if (v > 720) e.value = 'Up to 720 hours (30 days).'; }
  return { ...e, ...validateEmail(d, VARS_REMINDER.map((x) => x[0])) };
}
export function validateLevel(d) {
  const e = {};
  if (!d.recipient) e.recipient = d.userType === 'role' ? 'Select a role.' : 'Select a user.';
  const v = Number(d.hours);
  if (!Number.isInteger(v) || v < 1) e.hours = 'Enter a number of hours.'; else if (v > 720) e.hours = 'Up to 720 hours.';
  return { ...e, ...validateEmail(d, VARS_ESCALATION.map((x) => x[0])) };
}

// ── Recipients ───────────────────────────────────────────────
export const sortedAZ = (users) => [...users].sort((a, b) => a.name.localeCompare(b.name));
export const rolePoolAZ = (role, locationId, users) => sortedAZ(users.filter((u) => u.active && u.role === role && (!locationId || u.locs.includes(locationId))));
// Round robin in alphabetical order: the next user after the last recipient, wrapping around.
export function nextRoundRobin(pool, lastName) {
  if (!pool.length) return null;
  if (!lastName) return pool[0];
  return pool.find((u) => u.name.localeCompare(lastName) > 0) || pool[0];
}
export const levelToText = (lv, users) => lv.userType === 'role' ? `Round robin through active users in the ${lv.recipient} role who cover the ticket's location, A to Z` : (users.find((u) => u.id === lv.recipient)?.name || 'Unknown user');

// ── Building an email ────────────────────────────────────────
const overdueText = (ms) => { const h = Math.max(0, Math.round(ms / 3600000)); return h < 48 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.round(h / 24)} days`; };
export function varsFor(t, to, assignee, locations, extra = {}) {
  return {
    recipient_name: to ? to.name : '', ticket_number: t.id, ticket_priority: t.priority, due_date: fmtDT(t.dueAt),
    location_name: locations.find((l) => l.id === t.locationId)?.name || '', ticket_link: 'https://app.pmintel.example/tickets/' + t.id,
    assignee_name: assignee ? assignee.name : 'Unassigned',
    review_rating: t.rating != null ? String(t.rating) : '', review_text: t.text || '', ...extra,
  };
}
export const SAMPLE_TICKET = { id: 'T-1042', priority: 'High', locationId: 'L1', rating: 2, text: 'Waited 40 minutes and nobody helped me at the counter.', dueAt: new Date(2026, 10, 16, 17, 0).getTime() };

// ── The scheduler ────────────────────────────────────────────
// Fires, in time order, every reminder and escalation level that is due up to `toNow` for open tickets.
// Nothing is sent retroactively: an event only fires if it falls after the time its configuration was saved (`since`).
const kp = (t) => t.id + (t.cycle ? '#' + t.cycle : '');
export function runSchedule(s, toNow) {
  const { tickets, users, locations, reminders, escalation } = s;
  const levels = escalation.levels;
  const log = [...s.sent];
  const rr = { ...s.rr };
  const keys = new Map(log.map((e) => [e.key, e]));
  let seq = log.length;
  const byId = (id) => users.find((u) => u.id === id);

  const candidates = () => {
    const out = [];
    for (const t of tickets) {
      if (!t.dueAt) continue;
      const end = t.closedAt ?? Infinity;
      for (const r of reminders) {
        if (!r.active) continue;
        const key = `${kp(t)}|R${r.id}`;
        if (keys.has(key)) continue;
        const at = reminderAt(t.dueAt, r);
        if (at <= toNow && at <= end && at > Math.max(t.createdAt, t.reopenedAt || 0, t.dueSetAt || 0) && at > r.since) out.push({ at, t, kind: 'reminder', r, key, order: 0 });
      }
      // Level 1 is timed from the last reminder that actually went out for this ticket, or from the due date if none did.
      // It waits until every reminder that is still to come for this ticket has been dealt with.
      const floor = Math.max(t.createdAt, t.reopenedAt || 0, t.dueSetAt || 0);
      const pending = reminders.some((r) => { if (!r.active || keys.has(`${kp(t)}|R${r.id}`)) return false; const at = reminderAt(t.dueAt, r); return at > floor && at > r.since && at <= end; });
      let prev = t.dueAt;
      for (const e of keys.values()) if (e.kind === 'reminder' && e.status === 'Sent' && e.ticketId === t.id && e.key.startsWith(kp(t) + '|R') && e.at > prev) prev = e.at;
      for (const lv of levels) {
        const key = `${kp(t)}|E${lv.id}`;
        const done = keys.get(key);
        if (done) { prev = done.at; continue; }
        if (lv === levels[0] && pending) break;
        const at = addHours(prev, Number(lv.hours), lv.dayType);
        if (at <= toNow && at <= end && at > Math.max(t.reopenedAt || 0, t.dueSetAt || 0) && at > lv.since) out.push({ at, t, kind: 'escalation', lv, key, order: 1 });
        break;
      }
    }
    return out;
  };

  for (let guard = 0; guard < 4000; guard++) {
    const c = candidates();
    if (!c.length) break;
    c.sort((a, b) => a.at - b.at || a.order - b.order || a.t.id.localeCompare(b.t.id));
    const ev = c[0], t = ev.t;
    const assignee = byId(t.assignee);
    let entry;
    if (ev.kind === 'reminder') {
      const r = ev.r;
      const base = { id: 'M' + (++seq), key: ev.key, kind: 'reminder', refName: r.name, at: ev.at, ticketId: t.id };
      if (!assignee) entry = { ...base, status: 'Skipped', reason: 'Ticket was unassigned', to: null };
      else if (!assignee.active) entry = { ...base, status: 'Skipped', reason: 'Assignee is inactive', to: { name: assignee.name, email: emailOf(assignee) } };
      else {
        const v = varsFor(t, assignee, assignee, locations);
        entry = { ...base, status: 'Sent', to: { name: assignee.name, email: emailOf(assignee) }, cc: r.cc, bcc: r.bcc, replyTo: r.replyTo, subject: renderTemplate(r.subject, v), body: renderTemplate(r.body, v) };
      }
    } else {
      const lv = ev.lv, n = levels.indexOf(lv) + 1;
      const base = { id: 'M' + (++seq), key: ev.key, kind: 'escalation', refName: `Level ${n}`, level: n, at: ev.at, ticketId: t.id };
      let to = null, reason = null;
      if (lv.userType === 'user') { const u = byId(lv.recipient); if (!u || !u.active) reason = 'Recipient is inactive'; else to = u; }
      else {
        const pool = rolePoolAZ(lv.recipient, t.locationId, users);
        to = nextRoundRobin(pool, rr[lv.id]);
        if (!to) reason = 'No eligible user in this role';
        else rr[lv.id] = to.name;
      }
      if (!to) entry = { ...base, status: 'Skipped', reason, to: null };
      else {
        const v = varsFor(t, to, assignee, locations, { escalation_level: String(n), overdue_by: overdueText(ev.at - t.dueAt) });
        entry = { ...base, status: 'Sent', to: { name: to.name, email: emailOf(to) }, cc: lv.cc, bcc: lv.bcc, replyTo: lv.replyTo, subject: renderTemplate(lv.subject, v), body: renderTemplate(lv.body, v) };
      }
    }
    log.push(entry); keys.set(entry.key, entry);
  }
  return { sent: log, rr };
}
export { fmtDate, fmtTime, fmtDT };

// Assignment email: goes to the assignee every time a rule creates a ticket.
export function assignmentEntry({ ticket, rule, version, users, locations, seq, at }) {
  const base = { id: 'A' + seq, key: `${ticket.id}|A`, kind: 'assignment', refName: `${version.name} (#${rule.id})`, at, ticketId: ticket.id };
  const to = users.find((u) => u.id === ticket.assignee);
  if (!to) return { ...base, status: 'Skipped', reason: 'Ticket was created unassigned', to: null };
  const m = version.email || emptyAssignEmail();
  const v = varsFor(ticket, to, to, locations);
  return { ...base, status: 'Sent', to: { name: to.name, email: emailOf(to) }, cc: m.cc, bcc: m.bcc, replyTo: m.replyTo, subject: renderTemplate(m.subject, v), body: renderTemplate(m.body, v) };
}

// Assignment email for a ticket created or reassigned by hand. Uses the default assignment template.
export function manualAssignEntry({ ticket, users, locations, seq, at, reason }) {
  const to = users.find((u) => u.id === ticket.assignee);
  const base = { id: 'A' + seq, key: `${ticket.id}|A${seq}`, kind: 'assignment', refName: reason, at, ticketId: ticket.id };
  if (!to) return { ...base, status: 'Skipped', reason: 'Ticket is unassigned', to: null };
  const m = emptyAssignEmail(), v = varsFor(ticket, to, to, locations);
  return { ...base, status: 'Sent', to: { name: to.name, email: emailOf(to) }, cc: m.cc, bcc: m.bcc, replyTo: m.replyTo, subject: renderTemplate(m.subject, v), body: renderTemplate(m.body, v) };
}
