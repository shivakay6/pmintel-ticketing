// Ticket lifecycle: statuses, allowed moves, SLA, history and the single update function.
import { computeDueAt, HOUR } from './time.js';

export const STATUSES = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Junked'];
export const OPEN_STATUSES = ['New', 'In Progress', 'On Hold'];
export const AUTO_CLOSE_HOURS = 72;          // a Resolved ticket closes by itself after 72 calendar hours
export const NEXT = {
  New: ['In Progress', 'On Hold', 'Resolved', 'Junked'],
  'In Progress': ['On Hold', 'Resolved', 'Junked'],
  'On Hold': ['In Progress', 'Resolved', 'Junked'],
  Resolved: ['In Progress', 'Closed'],        // In Progress here is a reopen
  Closed: ['In Progress'],                    // reopen
  Junked: ['In Progress'],                    // reopen
};
export const isFinal = (st) => st === 'Resolved' || st === 'Closed' || st === 'Junked';
export const isReopen = (from, to) => isFinal(from) && to === 'In Progress';
export const needsComment = (from, to) => to === 'On Hold' || to === 'Resolved' || to === 'Junked' || isReopen(from, to);
export const statusTone = { New: 'blue', 'In Progress': 'amber', 'On Hold': 'gray', Resolved: 'green', Closed: 'navy', Junked: 'red' };

// SLA is derived, never stored: it follows the clock and the status.
export function slaOf(t, now) {
  if (!t.dueAt) return { key: 'none', label: 'No due date', tone: 'gray' };
  if (t.status === 'Junked') return { key: 'none', label: 'Not applicable', tone: 'gray' };
  if (isFinal(t.status)) { const met = (t.closedAt ?? now) <= t.dueAt; return met ? { key: 'met', label: 'Met', tone: 'green' } : { key: 'breached', label: 'Breached', tone: 'red' }; }
  if (now > t.dueAt) return { key: 'overdue', label: 'Overdue', tone: 'red' };
  const total = t.dueAt - t.createdAt, left = t.dueAt - now;
  if (left <= 4 * HOUR || left <= total * 0.25) return { key: 'soon', label: 'Due soon', tone: 'amber' };
  return { key: 'track', label: 'On track', tone: 'green' };
}
export const SLA_KEYS = [['track', 'On track'], ['soon', 'Due soon'], ['overdue', 'Overdue'], ['met', 'Met'], ['breached', 'Breached']];
export const URGENCY = { overdue: 0, soon: 1, track: 2, none: 3, breached: 4, met: 5 };

export function timeLeft(t, now) {
  if (!t.dueAt || t.status === 'Junked') return '';
  const ms = (isFinal(t.status) ? (t.closedAt ?? now) : now) - t.dueAt;
  const over = ms > 0, h = Math.round(Math.abs(ms) / HOUR);
  const txt = h < 48 ? `${Math.max(h, 0)}h` : `${Math.round(h / 24)}d`;
  if (isFinal(t.status)) return over ? `Closed ${txt} late` : 'Within due date';
  return over ? `${txt} overdue` : `${txt} left`;
}

const nameOf = (users, id) => (id ? users.find((u) => u.id === id)?.name || 'Unknown user' : 'Unassigned');
let hid = 0;
export const mkEvent = (type, at, by, extra = {}) => ({ id: 'H' + (++hid) + '-' + at, type, at, by, ...extra });

// Apply one save from the details panel. Returns the new ticket and whether the assignee changed.
export function applyUpdate(t, p, { now, by, users }) {
  const n = { ...t, history: [...(t.history || [])], comments: [...(t.comments || [])] };
  const push = (type, extra) => n.history.push(mkEvent(type, now, by, extra));
  let assigneeChanged = false;
  if (p.assignee !== undefined && (p.assignee || null) !== (t.assignee || null)) {
    push('assign', { from: nameOf(users, t.assignee), to: nameOf(users, p.assignee) });
    n.assignee = p.assignee || null; n.unassignedReason = null; assigneeChanged = !!p.assignee;
  }
  if (p.attributes) {
    const a = [...(t.attributes || [])].sort(), b = [...p.attributes].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) { push('attributes', { from: (t.attributes || []).join(', ') || 'None', to: p.attributes.join(', ') || 'None' }); n.attributes = [...p.attributes]; }
  }
  if (p.priority && p.priority !== t.priority) { push('priority', { from: t.priority, to: p.priority }); n.priority = p.priority; }
  if (p.status && p.status !== t.status && NEXT[t.status].includes(p.status)) {
    const reopen = isReopen(t.status, p.status);
    push('status', { from: t.status, to: p.status, reopen });
    n.status = p.status;
    if (p.status === 'Resolved' || p.status === 'Junked') n.closedAt = now;
    if (reopen) { n.closedAt = null; n.reopenedAt = now; n.reopenCount = (t.reopenCount || 0) + 1; }
  }
  if (p.due && Number(p.due.value) > 0 && !isFinal(n.status)) {
    n.dueAt = computeDueAt(now, p.due); n.dueSpec = { value: Number(p.due.value), unit: p.due.unit };
    n.dueSetAt = now; n.cycle = (t.cycle || 0) + 1;                       // reminders and escalation start over for the new due date
    push('due', { to: n.dueAt, value: Number(p.due.value), unit: p.due.unit });
  }
  const text = (p.comment || '').trim();
  if (text || (p.attachments && p.attachments.length)) {
    n.comments.push({ id: 'C' + (n.comments.length + 1) + '-' + now, by, at: now, text, attachments: p.attachments || [], edited: false });
    push('comment', { text });
    // Work has started: the first comment on a New ticket moves it to In Progress.
    if (n.status === 'New') { n.status = 'In Progress'; push('auto', { text: 'Moved from New to In Progress after the first comment.' }); }
  }
  return { ticket: n, assigneeChanged, changed: n.history.length !== (t.history || []).length };
}

// Resolved tickets close by themselves after 72 calendar hours.
export function autoClose(tickets, now) {
  let count = 0;
  const out = tickets.map((t) => {
    if (t.status !== 'Resolved' || !t.closedAt) return t;
    const at = t.closedAt + AUTO_CLOSE_HOURS * HOUR;
    if (at > now) return t;
    count++;
    return { ...t, status: 'Closed', history: [...(t.history || []), mkEvent('auto', at, 'System', { text: `Closed automatically ${AUTO_CLOSE_HOURS} hours after it was resolved.`, status: 'Closed' })] };
  });
  return { tickets: out, count };
}

// One flat, time-ordered timeline for the history panel: ticket events plus every email sent about the ticket.
export function timelineOf(t, sent) {
  const mails = sent.filter((m) => m.ticketId === t.id && m.status === 'Sent').map((m) => ({ id: 'M-' + m.id, type: 'email', at: m.at, by: 'System', mail: m }));
  return [...(t.history || []), ...mails].reverse().sort((a, b) => b.at - a.at);
}
