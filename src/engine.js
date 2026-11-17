// Rule engine: matching, precedence, assignment, preview, overlap, diff, health, placeholders.
import { DAY } from './data.js';
export { computeDueAt } from './time.js';

export const isOpen = (t) => ['New', 'In Progress', 'On Hold'].includes(t.status);
export const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 };
export const latest = (rule) => rule.versions[rule.versions.length - 1];
export const isLive = (rule) => latest(rule).status === 'Active';

// ── Location scope ───────────────────────────────────────────
export function resolveScope(scope, locations) {
  const act = locations.filter((l) => l.active);
  if (scope.all) return new Set(act.map((l) => l.id));
  const g = scope.groups;
  const out = new Set();
  act.forEach((l) => {
    if (g.custom.some((c) => l.custom.includes(c)) || g.region.includes(l.region) || g.state.includes(l.state) || g.city.includes(l.city) || g.locality.includes(l.locality)) out.add(l.id);
  });
  scope.stores.forEach((id) => { if (act.find((l) => l.id === id)) out.add(id); });
  return out;
}
export const scopeIsDynamic = (s) => s.all || Object.values(s.groups).some((a) => a.length);
export const scopeHasFixed = (s) => s.stores.length > 0;
export const scopeCount = (s, locations) => resolveScope(s, locations).size;
export const scopeLabel = (s, locations) => {
  const n = scopeCount(s, locations);
  return s.all ? `All locations (${n})` : `${n} location${n === 1 ? '' : 's'}`;
};

// ── Conditions: AND across fields, OR within a field ─────────
export function matchesConditions(review, c) {
  if (c.sources.length && !c.sources.includes(review.source)) return false;
  if (c.ratings.length && !c.ratings.includes(review.rating)) return false;
  if (c.reviewType === 'Rating Only') return !review.hasText;
  const sentOk = !c.sentiments.length || c.sentiments.includes(review.sentiment);
  const attrOk = !(c.attributes || []).length || (review.attributes || []).some((a) => c.attributes.includes(a));
  if (c.reviewType === 'With Review Text') return review.hasText && sentOk && attrOk;
  // All: sentiment and attributes apply to reviews with text only; rating-only reviews match on rating alone
  if (!review.hasText) return true;
  return sentOk && attrOk;
}
export const matchesVersion = (v, review, locations) => resolveScope(v.scope, locations).has(review.locationId) && matchesConditions(review, v.conditions);

// ── Precedence: ticket priority first, then older (lower) rule id ──
export function pickWinner(matches) {
  return [...matches].sort((a, b) => PRIORITY_RANK[latest(b).priority] - PRIORITY_RANK[latest(a).priority] || a.id - b.id)[0];
}
export function evaluateReview(review, rules, locations, now) {
  const matches = rules.filter((r) => isLive(r) && matchesVersion(latest(r), review, locations));
  return { matches, winner: matches.length ? pickWinner(matches) : null };
}

// ── Assignment ───────────────────────────────────────────────
export function workload(userId, tickets) {
  const mine = tickets.filter((t) => t.assignee === userId && isOpen(t));
  const lastAuto = tickets.filter((t) => t.assignee === userId && t.auto).reduce((m, t) => Math.max(m, t.createdAt), 0);
  return { open: mine.length, high: mine.filter((t) => t.priority === 'High').length, medium: mine.filter((t) => t.priority === 'Medium').length, lastAuto };
}
export function rolePool(role, locationId, users) {
  return users.filter((u) => u.active && u.role === role && u.locs.includes(locationId));
}
export function rankPool(pool, tickets) {
  return pool.map((u) => ({ user: u, ...workload(u.id, tickets) })).sort((a, b) =>
    a.open - b.open || a.high - b.high || a.medium - b.medium || a.lastAuto - b.lastAuto || a.user.name.localeCompare(b.user.name));
}
export function resolveAssignee(assignee, review, users, tickets) {
  if (assignee.type === 'user') {
    const u = users.find((x) => x.id === assignee.id);
    return u && u.active ? { userId: u.id, ranking: null } : { userId: null, reason: 'Assignee is inactive' };
  }
  const pool = rolePool(assignee.id, review.locationId, users);
  if (!pool.length) return { userId: null, reason: 'No eligible users in this role' };
  const ranking = rankPool(pool, tickets);
  return { userId: ranking[0].user.id, ranking, pool };
}

// ── Preview (last 30 days, creates nothing) ──────────────────
export function previewDraft(draft, ctx, selfRuleId) {
  const { reviews, users, tickets, locations, rules, now } = ctx;
  const cutoff = now - 30 * DAY;
  const pool = reviews.filter((r) => r.postedAt >= cutoff);
  const asVersion = { scope: draft.scope, conditions: draft.conditions };
  const matched = pool.filter((r) => matchesVersion(asVersion, r, locations)).sort((a, b) => a.postedAt - b.postedAt);
  const byLocation = {};
  matched.forEach((r) => { byLocation[r.locationId] = (byLocation[r.locationId] || 0) + 1; });
  // Simulate assignment sequentially so the spread reflects load balancing
  const virtual = tickets.map((t) => ({ ...t }));
  const spread = {};
  let unassigned = 0;
  matched.forEach((r, i) => {
    const res = resolveAssignee(draft.assignee, r, users, virtual);
    if (res.userId) {
      spread[res.userId] = (spread[res.userId] || 0) + 1;
      virtual.push({ id: 'v' + i, assignee: res.userId, status: 'New', priority: draft.priority, auto: true, createdAt: now + i });
    } else unassigned++;
  });
  // Overlap with other live rules: reviews both would match
  const overlaps = [];
  rules.filter((r) => r.id !== selfRuleId && isLive(r)).forEach((r) => {
    const both = matched.filter((rev) => matchesVersion(latest(r), rev, locations));
    if (both.length) {
      const otherWins = PRIORITY_RANK[latest(r).priority] > PRIORITY_RANK[draft.priority] || (PRIORITY_RANK[latest(r).priority] === PRIORITY_RANK[draft.priority] && (selfRuleId ? r.id < selfRuleId : true));
      overlaps.push({ rule: r, count: both.length, otherWins });
    }
  });
  // Eligible assignees (open workload) for a role
  let eligible = [];
  if (draft.assignee.type === 'role' && draft.assignee.id) {
    const locIds = [...resolveScope(draft.scope, locations)];
    const seen = new Map();
    users.filter((u) => u.active && u.role === draft.assignee.id && u.locs.some((l) => locIds.includes(l))).forEach((u) => seen.set(u.id, u));
    eligible = rankPool([...seen.values()], tickets);
  }
  return { total: matched.length, perDay: matched.length / 30, byLocation, spread, unassigned, overlaps, eligible };
}

// ── Human-readable summary ───────────────────────────────────
export function conditionText(c) {
  const stars = c.ratings.length ? [...c.ratings].sort().join(', ') + '-star' : 'any-rating';
  const type = c.reviewType === 'Rating Only' ? 'rating-only' : c.reviewType === 'With Review Text' ? 'with-text' : '';
  const sent = c.reviewType !== 'Rating Only' && c.sentiments.length ? c.sentiments.join(' or ') + ' sentiment' : '';
  const src = c.sources.length ? 'on ' + c.sources.join(' or ') : '';
  const att = c.reviewType !== 'Rating Only' && (c.attributes || []).length ? 'about ' + c.attributes.join(' or ') : '';
  return [stars, type, 'review', sent && 'with ' + sent, att, src].filter(Boolean).join(' ').replace('review with', 'review,').trim();
}
export function assigneeText(a, users) {
  if (a.type === 'role') return `the least-loaded ${a.id}`;
  const u = users.find((x) => x.id === a.id);
  return u ? u.name : 'a user';
}
export const assigneeLabel = (a, users) => (a.type === 'role' ? `${a.id} (role)` : (users.find((u) => u.id === a.id)?.name || 'Unknown user') + ' (user)');

// ── Diff between versions ────────────────────────────────────
export function diffVersions(a, b, users, locations) {
  const out = [];
  const j = (x) => (x.length ? x.join(', ') : 'Any');
  if (a.name !== b.name) out.push(['Name', a.name, b.name]);
  const sa = scopeLabel(a.scope, locations), sb = scopeLabel(b.scope, locations);
  if (JSON.stringify(a.scope) !== JSON.stringify(b.scope)) out.push(['Locations', sa, sb]);
  if (a.conditions.reviewType !== b.conditions.reviewType) out.push(['Review type', a.conditions.reviewType, b.conditions.reviewType]);
  if (j(a.conditions.ratings) !== j(b.conditions.ratings)) out.push(['Ratings', j(a.conditions.ratings), j(b.conditions.ratings)]);
  if (j(a.conditions.sentiments) !== j(b.conditions.sentiments)) out.push(['Sentiment', j(a.conditions.sentiments), j(b.conditions.sentiments)]);
  if (j(a.conditions.attributes || []) !== j(b.conditions.attributes || [])) out.push(['Review attributes', j(a.conditions.attributes || []), j(b.conditions.attributes || [])]);
  if (j(a.conditions.sources) !== j(b.conditions.sources)) out.push(['Source', j(a.conditions.sources), j(b.conditions.sources)]);
  if (JSON.stringify(a.assignee) !== JSON.stringify(b.assignee)) out.push(['Assigned to', assigneeLabel(a.assignee, users), assigneeLabel(b.assignee, users)]);
  if (a.priority !== b.priority) out.push(['Priority', a.priority, b.priority]);
  if (a.comment !== b.comment) out.push(['Comment', 'previous text', 'updated text']);
  if (JSON.stringify(a.email || null) !== JSON.stringify(b.email || null)) out.push(['Assignment email', 'previous template', 'updated template']);
  if (dueText(a.due) !== dueText(b.due)) out.push(['Due date', dueText(a.due), dueText(b.due)]);
  return out;
}

// ── Health flags ─────────────────────────────────────────────
export function healthFlags(rule, users, locations) {
  const v = latest(rule);
  const flags = [];
  const locs = resolveScope(v.scope, locations);
  if (locs.size === 0) flags.push('No locations left');
  if (v.assignee.type === 'user') {
    const u = users.find((x) => x.id === v.assignee.id);
    if (!u || !u.active) flags.push('Assignee is inactive');
  } else {
    const anyCovered = [...locs].some((l) => rolePool(v.assignee.id, l, users).length);
    if (locs.size && !anyCovered) flags.push('No eligible users in this role');
  }
  return flags;
}

// ── Validation ───────────────────────────────────────────────
export function validateStep(step, d, rules, editingId, emailErrs = () => ({})) {
  const e = {};
  if (step === 1) {
    const n = d.name.trim();
    if (!n) e.name = 'Rule name is required.';
    else if (n.length < 3 || n.length > 60) e.name = 'Use 3 to 60 characters.';
    else if (rules.some((r) => r.id !== editingId && latest(r).name.trim().toLowerCase() === n.toLowerCase())) e.name = 'A rule with this name already exists.';
    if (!d.scope.all && !Object.values(d.scope.groups).some((a) => a.length) && !d.scope.stores.length) e.scope = 'Select at least one location.';
  }
  if (step === 2) {
    if (!d.conditions.ratings.length) e.ratings = 'Select at least one rating.';
    if (d.conditions.reviewType === 'With Review Text' && !d.conditions.sentiments.length) e.sentiments = 'Select at least one sentiment.';
  }
  if (step === 3) {
    if (!d.assignee.id) e.assignee = d.assignee.type === 'role' ? 'Select a role.' : 'Select a user.';
    if (!d.comment.trim()) e.comment = 'Comment is required.';
    else if (d.comment.length > 500) e.comment = 'Up to 500 characters.';
    const dv = Number(d.due && d.due.value);
    if (!d.due || d.due.value === '' || !Number.isInteger(dv) || dv < 1) e.due = 'Due date is required.';
    else if (dv > 720) e.due = 'Up to 720 hours (30 days).';
  }
  if (step === 4) return emailErrs(d.email);
  return e;
}

// ── Dates (DD/MM/YYYY, 12-hour) ──────────────────────────────
const p2 = (n) => String(n).padStart(2, '0');
export const fmtDate = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtTime = (ms) => { const d = new Date(ms); const h = d.getHours() % 12 || 12; return `${p2(h)}:${p2(d.getMinutes())} ${d.getHours() >= 12 ? 'PM' : 'AM'}`; };
export const fmtDT = (ms) => `${fmtDate(ms)}, ${fmtTime(ms)}`;

// ---- Due date helpers -------------------------------------------------------
export const dueText = (due) => {
  if (!due || !due.value) return 'None';
  const n = Number(due.value);
  return n + ' ' + (due.unit === 'business' ? 'business' : 'calendar') + ' hour' + (n === 1 ? '' : 's');
};
