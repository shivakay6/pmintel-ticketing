import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { RULES, TICKETS, USERS, LOCATIONS, REVIEWS, INCOMING, NEXT_RULE_ID, NEXT_TICKET_NUM, CURRENT_USER, NOW, REMINDERS, NEXT_REMINDER_ID, ESCALATION, NEXT_LEVEL_ID } from './data.js';
import { latest, evaluateReview, resolveAssignee, computeDueAt } from './engine.js';
import { runSchedule, assignmentEntry, manualAssignEntry } from './schedule.js';
import { applyUpdate, autoClose, mkEvent } from './tickets.js';

const initial = () => {
  const s = {
    rules: RULES, tickets: TICKETS, users: USERS, locations: LOCATIONS, reviews: REVIEWS, incoming: INCOMING,
    nextRuleId: NEXT_RULE_ID, nextTicketNum: NEXT_TICKET_NUM, runs: {},
    now: NOW, reminders: REMINDERS, nextReminderId: NEXT_REMINDER_ID, escalation: ESCALATION, nextLevelId: NEXT_LEVEL_ID, sent: [], rr: {},
    page: { name: 'rules' },
    toast: null,
    demo: { canManage: true, failNextSave: false, emptyDashboard: false },
  };
  return { ...s, ...runSchedule(s, NOW) };   // history up to "now"
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function reducer(s, a) {
  const now = s.now;
  switch (a.type) {
    case 'NAV': return { ...s, page: a.page };
    case 'TOAST': return { ...s, toast: a.msg ? { msg: a.msg, at: Date.now() } : null };
    case 'DEMO': return { ...s, demo: { ...s.demo, ...a.patch } };

    case 'SAVE_RULE': {
      const { draft, editingId } = a;
      const base = { name: draft.name.trim(), module: draft.module, scope: clone(draft.scope), conditions: clone(draft.conditions), assignee: { ...draft.assignee }, comment: draft.comment.trim(), priority: draft.priority, email: { ...draft.email }, due: { value: Number(draft.due.value), unit: draft.due.unit }, createdAt: now, createdBy: CURRENT_USER };
      if (!editingId) {
        const id = s.nextRuleId;
        const status = draft.startPaused ? 'Paused' : 'Active';
        const rule = { id, module: draft.module, createdAt: now, createdBy: CURRENT_USER, versions: [{ v: 1, status, ...base }], events: [{ type: 'created', version: 1, user: CURRENT_USER, at: now }, ...(draft.startPaused ? [{ type: 'paused', version: 1, user: CURRENT_USER, at: now }] : [])] };
        return { ...s, rules: [rule, ...s.rules], nextRuleId: id + 1 };
      }
      return {
        ...s,
        rules: s.rules.map((r) => {
          if (r.id !== editingId) return r;
          const cur = latest(r);
          const versions = [...r.versions.map((v) => (v.v === cur.v ? { ...v, status: 'Stopped' } : v)), { v: cur.v + 1, status: cur.status, ...base, module: r.module }];
          return { ...r, versions, events: [...r.events, { type: 'edited', version: cur.v + 1, user: CURRENT_USER, at: now }] };
        }),
      };
    }

    case 'PAUSE':
    case 'RESUME': {
      const to = a.type === 'PAUSE' ? 'Paused' : 'Active';
      return {
        ...s,
        rules: s.rules.map((r) => {
          if (r.id !== a.id) return r;
          const cur = latest(r);
          return { ...r, versions: r.versions.map((v) => (v.v === cur.v ? { ...v, status: to } : v)), events: [...r.events, { type: to === 'Paused' ? 'paused' : 'resumed', version: cur.v, user: CURRENT_USER, at: now }] };
        }),
      };
    }

    case 'ADD_REVIEW': return { ...s, incoming: [a.review, ...s.incoming] };

    // Run one incoming review through the engine and create a ticket if it matches
    case 'PROCESS_REVIEW': {
      const review = s.incoming.find((r) => r.id === a.id) && { ...s.incoming.find((r) => r.id === a.id), postedAt: now };
      if (!review) return s;
      const ev = evaluateReview(review, s.rules, s.locations, now);
      const rest = s.incoming.filter((r) => r.id !== a.id);
      if (!ev.winner) {
        return { ...s, incoming: rest, runs: { ...s.runs, [review.id]: { review, outcome: ev.skipped ? 'skipped' : 'nomatch', reason: ev.skipped, matches: [] } }, toast: { msg: ev.skipped ? `Review ${review.id} skipped: ${ev.skipped}` : `Review ${review.id} matched no active rule`, at: Date.now() } };
      }
      const rule = ev.winner, v = latest(rule);
      const asg = resolveAssignee(v.assignee, review, s.users, s.tickets);
      const ticket = {
        id: 'T-' + s.nextTicketNum, auto: true, platform: 'Reviews', status: 'New', priority: v.priority, assignee: asg.userId, unassignedReason: asg.reason || null, createdBy: 'Automation', cycle: 0, reopenCount: 0, closedAt: null, attachments: [], dueSpec: { value: v.due.value, unit: v.due.unit },
        history: [mkEvent('created', now, 'Automation', { auto: true, ruleId: rule.id, version: v.v }), ...(asg.userId ? [mkEvent('assign', now, 'Automation', { from: 'Unassigned', to: s.users.find((u) => u.id === asg.userId)?.name })] : [])],
        comments: v.comment ? [{ id: 'C1-' + now, by: 'Automation', at: now, text: v.comment, attachments: [], edited: false }] : [],
        ruleId: rule.id, version: v.v, createdAt: now, reviewId: review.id, rating: review.rating, text: review.text, sentiment: review.sentiment, attributes: review.attributes || [],
        locationId: review.locationId, source: review.source, reviewer: review.author, reviewPostedAt: now,
        comment: v.comment, dueAt: computeDueAt(now, v.due),
      };
      const mail = assignmentEntry({ ticket, rule, version: v, users: s.users, locations: s.locations, seq: s.sent.length + 1, at: now });
      return {
        ...s, sent: [...s.sent, mail], incoming: rest, reviews: [review, ...s.reviews], tickets: [ticket, ...s.tickets], nextTicketNum: s.nextTicketNum + 1,
        runs: { ...s.runs, [review.id]: { review, outcome: 'ticket', ticketId: ticket.id, rule, version: v.v, matches: ev.matches, assignment: asg } },
        toast: { msg: `Ticket ${ticket.id} created from rule #${rule.id} V${v.v}`, at: Date.now() },
      };
    }

    case 'TOGGLE_USER': return { ...s, users: s.users.map((u) => (u.id === a.id ? { ...u, active: !u.active } : u)) };
    // Ticket created by hand from a review (Reviews page)
    case 'CREATE_TICKET': {
      const rv = s.reviews.find((r) => r.id === a.reviewId);
      if (!rv || s.tickets.some((t) => t.reviewId === rv.id)) return s;
      const id = 'T-' + s.nextTicketNum, by = CURRENT_USER;
      const ticket = {
        id, auto: false, platform: 'Reviews', status: 'New', priority: a.priority, assignee: a.assignee, unassignedReason: null, ruleId: null, version: null, createdAt: now, createdBy: by,
        reviewId: rv.id, rating: rv.rating, text: rv.text, sentiment: rv.sentiment, attributes: a.attributes || rv.attributes || [], locationId: rv.locationId, source: rv.source, reviewer: rv.author, reviewPostedAt: rv.postedAt,
        dueAt: computeDueAt(now, a.due), dueSpec: { value: Number(a.due.value), unit: a.due.unit }, closedAt: null, cycle: 0, reopenCount: 0, attachments: [],
        history: [mkEvent('created', now, by, { auto: false }), mkEvent('assign', now, by, { from: 'Unassigned', to: s.users.find((u) => u.id === a.assignee)?.name })],
        comments: (a.comment || '').trim() || (a.attachments || []).length ? [{ id: 'C1-' + now, by, at: now, text: (a.comment || '').trim(), attachments: a.attachments || [], edited: false }] : [],
      };
      const mail = manualAssignEntry({ ticket, users: s.users, locations: s.locations, seq: s.sent.length + 1, at: now, reason: 'Manual ticket' });
      return { ...s, tickets: [ticket, ...s.tickets], nextTicketNum: s.nextTicketNum + 1, sent: [...s.sent, mail], toast: { msg: `Ticket ${id} created and assigned to ${s.users.find((u) => u.id === a.assignee)?.name}`, at: Date.now() } };
    }
    // Save from the View Details panel: assignee, status, priority, due date and a comment in one go
    case 'UPDATE_TICKET': {
      const t = s.tickets.find((x) => x.id === a.id); if (!t) return s;
      const r = applyUpdate(t, a.patch, { now, by: CURRENT_USER, users: s.users });
      if (!r.changed) return { ...s, toast: { msg: 'Nothing to save.', at: Date.now() } };
      let sent = s.sent;
      if (r.assigneeChanged) sent = [...sent, manualAssignEntry({ ticket: r.ticket, users: s.users, locations: s.locations, seq: sent.length + 1, at: now, reason: 'Reassigned' })];
      return { ...s, sent, tickets: s.tickets.map((x) => (x.id === a.id ? r.ticket : x)), toast: { msg: `Ticket ${t.id} updated${r.ticket.status !== t.status ? '. Status is now ' + r.ticket.status : ''}`, at: Date.now() } };
    }
    case 'EDIT_COMMENT': return { ...s, tickets: s.tickets.map((t) => (t.id !== a.id ? t : { ...t, comments: t.comments.map((c) => (c.id === a.commentId ? { ...c, text: a.text.trim(), edited: true } : c)) })), toast: { msg: 'Comment updated', at: Date.now() } };

    // Reminders
    case 'SAVE_REMINDER': {
      const { draft, editingId } = a;
      const body = { ...draft, name: draft.name.trim(), value: draft.when === 'on' ? 0 : Number(draft.value), since: now };
      if (!editingId) return { ...s, reminders: [...s.reminders, { ...body, id: s.nextReminderId, active: true }], nextReminderId: s.nextReminderId + 1 };
      return { ...s, reminders: s.reminders.map((r) => (r.id === editingId ? { ...r, ...body, id: r.id, active: r.active } : r)) };
    }
    case 'DELETE_REMINDER': return { ...s, reminders: s.reminders.filter((r) => r.id !== a.id) };
    case 'TOGGLE_REMINDER': return { ...s, reminders: s.reminders.map((r) => (r.id === a.id ? { ...r, active: !r.active, since: now } : r)) };

    // Escalation levels (position = level number)
    case 'SAVE_LEVEL': {
      const { draft, index } = a;
      const body = { ...draft, hours: Number(draft.hours), since: now };
      const levels = [...s.escalation.levels];
      let nextLevelId = s.nextLevelId;
      if (index == null) { levels.push({ ...body, id: nextLevelId }); nextLevelId++; }
      else levels[index] = { ...levels[index], ...body, id: levels[index].id };
      return { ...s, escalation: { levels }, nextLevelId };
    }
    case 'REMOVE_LEVEL': return { ...s, escalation: { levels: s.escalation.levels.filter((_, i) => i !== a.index) } };

    // Prototype clock: move time forward and let reminders and escalation fire
    case 'ADVANCE': {
      const to = s.now + a.ms;
      const before = s.sent.length;
      const ac = autoClose(s.tickets, to);
      const r = runSchedule({ ...s, tickets: ac.tickets, now: to }, to);
      const sent = r.sent.length - before;
      const extra = ac.count ? ` ${ac.count} resolved ticket${ac.count === 1 ? '' : 's'} closed automatically.` : '';
      return { ...s, ...r, tickets: ac.tickets, now: to, toast: { msg: (sent ? `Time moved forward. ${sent} email${sent === 1 ? '' : 's'} sent or skipped.` : 'Time moved forward. Nothing was due.') + extra, at: Date.now() } };
    }
    default: return s;
  }
}

const Ctx = createContext(null);
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);
