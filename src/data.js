// ───────────────────────────────────────────────────────────────
// Seed data for the PMIntel Ticket Automation prototype.
// Everything here is in-memory. A browser refresh rebuilds it from scratch.
// ───────────────────────────────────────────────────────────────
import { computeDueAt } from './time.js';
import { mkEvent, autoClose } from './tickets.js';
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOW = Date.now();
const todayAt = (h, m) => { const d = new Date(NOW); d.setHours(h, m, 0, 0); return d.getTime(); };
const ago = (days, h = 11, m = 0) => { const d = new Date(NOW - days * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };

export const CURRENT_USER = 'Shiva Karthikeyan';
export const SOURCES = ['Google', 'Facebook', 'Zomato', 'Justdial'];
export const MODULES = ['Reviews'];                 // extensible: new modules appear here
export const ROLES = ['Store Manager', 'Area Manager', 'Marketing', 'Customer Care'];
export const DUE_UNITS = [{ key: 'calendar', label: 'Calendar hours' }, { key: 'business', label: 'Business hours' }];

export const LOCATIONS = [
  ['L1', 'T Nagar', 'Chennai', 'Tamil Nadu', 'South', 'T Nagar', ['Flagship stores']],
  ['L2', 'Adyar', 'Chennai', 'Tamil Nadu', 'South', 'Adyar', []],
  ['L3', 'Anna Nagar', 'Chennai', 'Tamil Nadu', 'South', 'Anna Nagar', []],
  ['L4', 'Velachery', 'Chennai', 'Tamil Nadu', 'South', 'Velachery', []],
  ['L5', 'OMR Sholinganallur', 'Chennai', 'Tamil Nadu', 'South', 'Sholinganallur', ['Mall outlets']],
  ['L6', 'RS Puram', 'Coimbatore', 'Tamil Nadu', 'South', 'RS Puram', []],
  ['L7', 'Gandhipuram', 'Coimbatore', 'Tamil Nadu', 'South', 'Gandhipuram', ['Mall outlets']],
  ['L8', 'Peelamedu', 'Coimbatore', 'Tamil Nadu', 'South', 'Peelamedu', []],
  ['L9', 'Koramangala', 'Bengaluru', 'Karnataka', 'South', 'Koramangala', ['Flagship stores']],
  ['L10', 'Indiranagar', 'Bengaluru', 'Karnataka', 'South', 'Indiranagar', []],
  ['L11', 'Whitefield', 'Bengaluru', 'Karnataka', 'South', 'Whitefield', ['Mall outlets']],
  ['L12', 'Jayanagar', 'Bengaluru', 'Karnataka', 'South', 'Jayanagar', []],
  ['L13', 'Andheri', 'Mumbai', 'Maharashtra', 'West', 'Andheri', ['Flagship stores']],
  ['L14', 'Bandra', 'Mumbai', 'Maharashtra', 'West', 'Bandra', ['Flagship stores']],
  ['L15', 'Powai', 'Mumbai', 'Maharashtra', 'West', 'Powai', ['Mall outlets']],
  ['L16', 'Lower Parel', 'Mumbai', 'Maharashtra', 'West', 'Lower Parel', []],
].map(([id, name, city, state, region, locality, custom]) => ({ id, name, city, state, region, locality, custom, active: true }));

const ids = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => 'L' + (a + i));

export const USERS = [
  { id: 'U1', name: 'Anita Raman', role: 'Store Manager', active: true, locs: ids(1, 5) },
  { id: 'U2', name: 'Bala Krishnan', role: 'Store Manager', active: true, locs: ids(1, 5) },
  { id: 'U3', name: 'Charan Kumar', role: 'Store Manager', active: true, locs: ids(1, 5) },
  { id: 'U4', name: 'Divya Nair', role: 'Store Manager', active: true, locs: ids(1, 5) },
  { id: 'U5', name: 'Esha Patel', role: 'Store Manager', active: true, locs: ids(1, 5) },
  { id: 'U6', name: 'Farhan Sheikh', role: 'Store Manager', active: true, locs: ids(6, 12) },
  { id: 'U7', name: 'Gayathri Iyer', role: 'Store Manager', active: true, locs: ids(13, 16) },
  { id: 'U8', name: 'Hari Prasad', role: 'Store Manager', active: false, locs: ids(9, 12) },
  { id: 'U9', name: 'Ishaan Mehta', role: 'Area Manager', active: true, locs: ids(1, 12) },
  { id: 'U10', name: 'Jaya Menon', role: 'Area Manager', active: true, locs: ids(13, 16) },
  { id: 'U11', name: 'Kavya Rao', role: 'Marketing', active: true, locs: ids(1, 16) },
  { id: 'U12', name: 'Lokesh Varma', role: 'Marketing', active: true, locs: ids(1, 16) },
  { id: 'U13', name: 'Meera Joshi', role: 'Customer Care', active: true, locs: ids(1, 16) },
  { id: 'U14', name: 'Naveen Das', role: 'Area Manager', active: false, locs: ids(13, 16) },
  { id: 'U15', name: 'Shiva Karthikeyan', role: 'Admin', active: true, locs: ids(1, 16) },
  { id: 'U16', name: 'Dev Anand', role: 'Area Manager', active: true, locs: ids(1, 12) },
];

// ── Reviews (last 30 days) ──────────────────────────────────────
const TEXT = {
  Positive: ['Amazing service, the staff were so warm and helpful.', 'Loved the experience, will definitely come back!', 'Clean, quick and friendly. Highly recommend.', 'Best branch in the city. The team went the extra mile.', 'Fantastic ambience and great value for money.'],
  Neutral: ['It was okay. Nothing special but nothing wrong either.', 'Average experience, the wait was a bit long.', 'Decent service, could be better on cleanliness.', 'Fine overall. Staff were polite but slow.'],
  Negative: ['Terrible experience. Waited 40 minutes and nobody apologised.', 'Rude staff and a dirty place. Very disappointed.', 'Wrong order, no refund. Will not return.', 'Billing was wrong and the manager did not help at all.', 'Very slow service and the product was damaged.'],
};
const NAMES = ['Arjun S', 'Priya M', 'Rohit K', 'Sneha R', 'Vikram P', 'Ananya D', 'Karthik N', 'Pooja T', 'Imran Q', 'Deepa L', 'Suresh B', 'Neha G', 'Rahul V', 'Lakshmi C', 'Mohan E'];
const rnd = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

// Review attributes: configured per customer in Reputation Management and pulled in here.
export const ATTRIBUTES = ['Staff behaviour', 'Wait time', 'Cleanliness', 'Billing', 'Product quality', 'Pricing', 'Ambience', 'Refund and returns'];
const ATTR_WORDS = {
  'Staff behaviour': /staff|rude|manager|team|polite|helpful|friendly|apolog|warm/i,
  'Wait time': /wait|slow|queue|long|quick/i,
  'Cleanliness': /dirty|clean|hygien/i,
  'Billing': /billing|bill|charged|invoice/i,
  'Product quality': /order|quality|stale|fresh|product/i,
  'Pricing': /price|value|expensive|cost/i,
  'Ambience': /ambience|atmosphere|music|decor/i,
  'Refund and returns': /refund|return|exchange/i,
};
export const deriveAttrs = (text) => (text ? ATTRIBUTES.filter((a) => ATTR_WORDS[a].test(text)) : []);

function genReviews() {
  const r = rnd(42), out = [];
  for (let i = 0; i < 420; i++) {
    const x = r();
    const rating = x < 0.33 ? 5 : x < 0.55 ? 4 : x < 0.68 ? 3 : x < 0.8 ? 2 : 1;
    const loc = LOCATIONS[Math.floor(r() * 16)];
    const hasText = r() < 0.68;
    let sentiment = null, text = '';
    if (hasText) {
      sentiment = rating >= 4 ? 'Positive' : rating === 3 ? 'Neutral' : 'Negative';
      if (rating >= 4 && i % 9 === 0) sentiment = 'Negative';   // hidden dissatisfaction
      const pool = TEXT[sentiment];
      text = pool[Math.floor(r() * pool.length)];
    }
    const daysAgo = Math.floor(i * 30 / 420);
    out.push({
      id: 'R' + (2001 + i), locationId: loc.id, rating, hasText, text, sentiment, attributes: deriveAttrs(text),
      source: SOURCES[Math.floor(r() * r() * 4)],
      author: NAMES[Math.floor(r() * NAMES.length)],
      postedAt: ago(daysAgo, 8 + Math.floor(r() * 12), Math.floor(r() * 60)),
    });
  }
  return out.sort((a, b) => b.postedAt - a.postedAt);
}
export const REVIEWS = genReviews();

// Fresh reviews the simulator can "receive" (not yet turned into tickets)
const inc = (id, loc, rating, text, sentiment, source, author, hoursAgo) => ({
  id, locationId: loc, rating, hasText: !!text, text, sentiment, attributes: deriveAttrs(text), source, author, postedAt: NOW - hoursAgo * HOUR,
});
export const INCOMING = [
  inc('R3001', 'L2', 1, 'Terrible experience. Waited 40 minutes and nobody apologised.', 'Negative', 'Google', 'Arjun S', 1),
  inc('R3002', 'L9', 5, 'Best branch in the city. The team went the extra mile.', 'Positive', 'Google', 'Priya M', 2),
  inc('R3003', 'L13', 5, 'Billing was wrong and the manager did not help at all.', 'Negative', 'Facebook', 'Rohit K', 3),
  inc('R3004', 'L3', 2, '', null, 'Google', 'Sneha R', 3),
  inc('R3005', 'L4', 3, 'Average experience, the wait was a bit long.', 'Neutral', 'Zomato', 'Vikram P', 4),
  inc('R3006', 'L6', 1, 'Rude staff and a dirty place. Very disappointed.', 'Negative', 'Justdial', 'Ananya D', 5),
  inc('R3007', 'L1', 1, 'Wrong order, no refund. Will not return.', 'Negative', 'Google', 'Karthik N', 6),
  inc('R3008', 'L14', 5, 'Loved the experience, will definitely come back!', 'Positive', 'Google', 'Pooja T', 7),
  inc('R3009', 'L5', 2, 'Very slow service and the product was damaged.', 'Negative', 'Facebook', 'Imran Q', 8),
  inc('R3010', 'L10', 4, '', null, 'Google', 'Deepa L', 9),
];

// ── Rules and versions ──────────────────────────────────────────
const scope = (g = {}, stores = [], all = false) => ({ all, groups: { custom: [], region: [], state: [], city: [], locality: [], ...g }, stores });
const cond = (reviewType, ratings, sentiments, sources = [], attributes = []) => ({ reviewType, ratings, sentiments, attributes, sources });
const CMT_NEG = 'Negative review received. Please reply to the guest and recover the situation within 24 hours.';
/* Assignment email: goes to the assignee when a rule creates a ticket */
const DEFAULT_BODY_A = 'Hi {{recipient_name}},\n\nA new ticket {{ticket_number}} ({{ticket_priority}} priority) has been assigned to you for {{location_name}}.\n\nRating: {{review_rating}} out of 5\nReview: {{review_text}}\n\nPlease resolve it by {{due_date}}.\n\nOpen the ticket: {{ticket_link}}';
export const emptyAssignEmail = () => ({ cc: '', replyTo: '', bcc: '', subject: 'New ticket {{ticket_number}} assigned to you ({{ticket_priority}} priority)', body: DEFAULT_BODY_A });
const ver = (v, status, name, o) => ({ v, status, name, module: 'Reviews', email: emptyAssignEmail(), ...o });

export const RULES = [
  {
    id: 112, module: 'Reviews', createdAt: ago(48), createdBy: 'Shiva Karthikeyan',
    versions: [
      ver(1, 'Stopped', 'Negative Reviews – Chennai', { scope: scope({ city: ['Chennai'] }), conditions: cond('With Review Text', [1], ['Negative']), assignee: { type: 'user', id: 'U1' }, comment: 'Please look at this 1★ review.', priority: 'Medium', due: { value: 48, unit: 'calendar' }, createdAt: ago(48), createdBy: 'Shiva Karthikeyan' }),
      ver(2, 'Stopped', 'Negative Reviews – Chennai', { scope: scope({ city: ['Chennai'] }), conditions: cond('With Review Text', [1, 2], ['Negative']), assignee: { type: 'role', id: 'Store Manager' }, comment: 'Negative review received. Please reply to the guest.', priority: 'Medium', due: { value: 48, unit: 'calendar' }, createdAt: ago(31), createdBy: 'Shiva Karthikeyan' }),
      ver(3, 'Active', 'Negative Reviews – Chennai', { scope: scope({ city: ['Chennai'] }), conditions: cond('With Review Text', [1, 2], ['Negative']), assignee: { type: 'role', id: 'Store Manager' }, comment: CMT_NEG, priority: 'High', due: { value: 24, unit: 'calendar' }, createdAt: ago(12), createdBy: 'Shiva Karthikeyan' }),
    ],
    events: [
      { type: 'created', version: 1, user: 'Shiva Karthikeyan', at: ago(48) },
      { type: 'edited', version: 2, user: 'Shiva Karthikeyan', at: ago(31) },
      { type: 'edited', version: 3, user: 'Shiva Karthikeyan', at: ago(12) },
    ],
  },
  {
    id: 109, module: 'Reviews', createdAt: ago(60), createdBy: 'Kavya Rao',
    versions: [
      ver(1, 'Stopped', 'Positive Advocates to Marketing', { scope: scope({}, [], true), conditions: cond('With Review Text', [5], ['Positive']), assignee: { type: 'user', id: 'U11' }, comment: 'Thank this reviewer.', priority: 'Low', due: { value: 48, unit: 'calendar' }, createdAt: ago(60), createdBy: 'Kavya Rao' }),
      ver(2, 'Active', 'Positive Advocates to Marketing', { scope: scope({}, [], true), conditions: cond('With Review Text', [4, 5], ['Positive'], ['Google']), assignee: { type: 'role', id: 'Marketing' }, comment: 'Positive review received. Thank the guest and consider it for a testimonial.', priority: 'Low', due: { value: 72, unit: 'business' }, createdAt: ago(20), createdBy: 'Shiva Karthikeyan' }),
    ],
    events: [
      { type: 'created', version: 1, user: 'Kavya Rao', at: ago(60) },
      { type: 'edited', version: 2, user: 'Shiva Karthikeyan', at: ago(20) },
    ],
  },
  {
    id: 118, module: 'Reviews', createdAt: ago(35), createdBy: 'Shiva Karthikeyan',
    versions: [
      ver(1, 'Paused', 'Unexplained Low Ratings', { scope: scope({ region: ['South'] }), conditions: cond('Rating Only', [1, 2], []), assignee: { type: 'role', id: 'Area Manager' }, comment: 'Low rating with no explanation. Please find out what went wrong.', priority: 'Medium', due: { value: 48, unit: 'calendar' }, createdAt: ago(35), createdBy: 'Shiva Karthikeyan' }),
    ],
    events: [
      { type: 'created', version: 1, user: 'Shiva Karthikeyan', at: ago(35) },
      { type: 'paused', version: 1, user: 'Shiva Karthikeyan', at: ago(9) },
    ],
  },
  {
    id: 121, module: 'Reviews', createdAt: ago(25), createdBy: 'Shiva Karthikeyan',
    versions: [
      ver(1, 'Active', 'Hidden Dissatisfaction – Mumbai', { scope: scope({ city: ['Mumbai'] }), conditions: cond('With Review Text', [4, 5], ['Negative']), assignee: { type: 'user', id: 'U14' }, comment: 'A high rating hides a complaint. Please follow up with the guest.', priority: 'Medium', due: { value: 48, unit: 'calendar' }, createdAt: ago(25), createdBy: 'Shiva Karthikeyan' }),
    ],
    events: [{ type: 'created', version: 1, user: 'Shiva Karthikeyan', at: ago(25) }],
  },
  {
    id: 124, module: 'Reviews', createdAt: ago(16), createdBy: 'Kavya Rao',
    versions: [
      ver(1, 'Active', 'Neutral Feedback Follow-up', { scope: scope({ state: ['Karnataka', 'Tamil Nadu'] }), conditions: cond('With Review Text', [3], ['Neutral']), assignee: { type: 'role', id: 'Store Manager' }, comment: 'Neutral feedback received. A thoughtful reply can convert this guest.', priority: 'Low', due: { value: 48, unit: 'business' }, createdAt: ago(16), createdBy: 'Kavya Rao' }),
    ],
    events: [{ type: 'created', version: 1, user: 'Kavya Rao', at: ago(16) }],
  },
];
export const NEXT_RULE_ID = 145;

// ── Tickets ─────────────────────────────────────────────────────
// Open workload for the five Chennai store managers reproduces the PRD worked example:
// Anita 3 open (1 High, 1 Medium), Bala 2 (1 High, 1 Medium), Charan 2 (0 High, 2 Medium),
// Divya 2 (0 High, 1 Medium), Esha 2 (0 High, 1 Medium). Divya was last assigned 11:20, Esha 09:00.
let tn = 1000;
const T = (o) => ({ id: 'T-' + (++tn), auto: true, ...o });
const snap = (rating, text, sentiment, locationId, source, author, daysAgo) => ({ rating, text, sentiment, attributes: deriveAttrs(text), locationId, source, reviewer: author, reviewPostedAt: ago(daysAgo) });
const open = (assignee, priority, hh, mm, ruleId, version, locationId, rating, text, author) => T({
  status: 'New', priority, assignee, ruleId, version, createdAt: todayAt(hh, mm), reviewId: 'R-S' + tn,
  ...snap(rating, text, text ? 'Negative' : null, locationId, 'Google', author, 0),
});
const seedOpen = [
  open('U1', 'High', 10, 5, 112, 3, 'L1', 1, 'Terrible experience. Waited 40 minutes and nobody apologised.', 'Arjun S'),
  open('U1', 'Medium', 7, 45, 124, 1, 'L2', 3, 'Average experience, the wait was a bit long.', 'Priya M'),
  open('U1', 'Low', 7, 10, 124, 1, 'L3', 3, 'Fine overall. Staff were polite but slow.', 'Rohit K'),
  open('U2', 'High', 9, 40, 112, 3, 'L4', 2, 'Rude staff and a dirty place. Very disappointed.', 'Sneha R'),
  open('U2', 'Medium', 6, 55, 124, 1, 'L5', 3, 'Decent service, could be better on cleanliness.', 'Vikram P'),
  open('U3', 'Medium', 8, 10, 124, 1, 'L1', 3, 'It was okay. Nothing special but nothing wrong either.', 'Ananya D'),
  open('U3', 'Medium', 6, 30, 124, 1, 'L2', 3, 'Average experience, the wait was a bit long.', 'Karthik N'),
  open('U4', 'Medium', 11, 20, 124, 1, 'L3', 3, 'Fine overall. Staff were polite but slow.', 'Pooja T'),
  open('U4', 'Low', 5, 50, 124, 1, 'L4', 3, 'It was okay. Nothing special but nothing wrong either.', 'Imran Q'),
  open('U5', 'Medium', 9, 0, 124, 1, 'L5', 3, 'Decent service, could be better on cleanliness.', 'Deepa L'),
  open('U5', 'Low', 5, 20, 124, 1, 'L1', 3, 'Average experience, the wait was a bit long.', 'Suresh B'),
  // Others
  open('U6', 'Medium', 9, 20, 124, 1, 'L9', 3, 'Average experience, the wait was a bit long.', 'Neha G'),
  open('U7', 'Medium', 8, 5, 121, 1, 'L13', 5, 'Billing was wrong and the manager did not help at all.', 'Rahul V'),
  open('U10', 'Medium', 6, 15, 121, 1, 'L14', 4, 'Wrong order, no refund. Will not return.', 'Lakshmi C'),
  open('U11', 'Low', 7, 35, 109, 2, 'L9', 5, 'Fantastic ambience and great value for money.', 'Mohan E'),
  open('U12', 'Low', 4, 25, 109, 2, 'L1', 5, 'Loved the experience, will definitely come back!', 'Arjun S'),
  open('U9', 'Medium', 3, 40, 118, 1, 'L2', 1, '', 'Priya M'),
];
// Tickets that are already past due, so Reminders and Escalation have history on first load
const overdue = (assignee, priority, ruleId, version, days, hh, mm, locationId, rating, text, sentiment, author) => T({
  status: 'New', priority, assignee, ruleId, version, createdAt: ago(days, hh, mm), reviewId: 'R-O' + tn,
  ...snap(rating, text, sentiment, locationId, 'Google', author, days),
});
seedOpen.push(
  overdue('U9', 'Medium', 118, 1, 6, 10, 15, 'L2', 1, '', null, 'Priya M'),
  overdue('U10', 'Medium', 121, 1, 3, 11, 30, 'L14', 5, 'Billing was wrong and the manager did not help at all.', 'Negative', 'Lakshmi C'),
  overdue('U11', 'Low', 109, 2, 5, 9, 40, 'L9', 5, 'Fantastic ambience and great value for money.', 'Positive', 'Mohan E'),
);
// Manual tickets (not created by automation) that also count toward workload
const manual = [
  T({ auto: false, status: 'In Progress', priority: 'High', assignee: 'U3', ruleId: null, version: null, createdAt: ago(2), reviewId: 'R-M1', ...snap(2, 'Order was cold and the staff ignored my complaint at the counter.', 'Negative', 'L1', 'Google', 'Meenakshi R', 2) }),
  T({ auto: false, status: 'New', priority: 'Medium', assignee: 'U4', ruleId: null, version: null, createdAt: ago(1), reviewId: 'R-M2', ...snap(3, 'Hard to find the entrance, the signage outside is confusing.', 'Neutral', 'L4', 'Google', 'Tarun V', 1) }),
];
// Make the two manual tickets consistent with the worked example (Charan: High must stay 0 -> keep manual one Medium)
manual[0].priority = 'Medium';
manual[0].assignee = 'U6';
manual[1].assignee = 'U7';

// Historic, resolved/closed automation tickets so every rule version shows real numbers
function history(ruleId, version, n, assigneePool, priority, rating, sentiment, locs, daysFrom, daysTo) {
  const r = rnd(ruleId * 10 + version), out = [];
  for (let i = 0; i < n; i++) {
    const d = daysFrom + Math.floor(((daysTo - daysFrom) * i) / Math.max(1, n - 1));
    const loc = locs[Math.floor(r() * locs.length)];
    const pool = TEXT[sentiment || 'Negative'];
    out.push(T({
      status: i % 4 === 0 ? 'Closed' : 'Resolved', priority, assignee: assigneePool[i % assigneePool.length],
      ruleId, version, createdAt: ago(d, 9 + (i % 8), (i * 7) % 60), reviewId: 'R-H' + tn,
      ...snap(Array.isArray(rating) ? rating[i % rating.length] : rating, pool[i % pool.length], sentiment, loc, SOURCES[i % 2], NAMES[(i * 3) % NAMES.length], d + 1),
    }));
  }
  return out;
}
const C = ['L1', 'L2', 'L3', 'L4', 'L5'];
const hist = [
  ...history(112, 1, 6, ['U1'], 'Medium', 1, 'Negative', C, 46, 33),
  ...history(112, 2, 9, ['U1', 'U2', 'U3', 'U4', 'U5'], 'Medium', [1, 2], 'Negative', C, 30, 13),
  ...history(112, 3, 5, ['U2', 'U3', 'U5', 'U4', 'U1'], 'High', [1, 2], 'Negative', C, 10, 1),
  ...history(109, 1, 8, ['U11'], 'Low', 5, 'Positive', ['L1', 'L9', 'L13', 'L14'], 58, 22),
  ...history(109, 2, 11, ['U11', 'U12'], 'Low', [5, 4], 'Positive', ['L1', 'L9', 'L13', 'L14', 'L5'], 19, 1),
  ...history(118, 1, 5, ['U9'], 'Medium', [1, 2], null, ['L1', 'L6', 'L9', 'L10'], 33, 10).map((t) => ({ ...t, text: '' })),
  ...history(121, 1, 3, ['U7', 'U10'], 'Medium', [4, 5], 'Negative', ['L13', 'L14', 'L15'], 23, 6),
  ...history(124, 1, 6, ['U6', 'U1', 'U2'], 'Low', 3, 'Neutral', ['L1', 'L9', 'L6', 'L8'], 14, 2),
];
const ruleVer = (t) => { const r = RULES.find((x) => x.id === t.ruleId); return r && r.versions.find((x) => x.v === t.version); };
const dueOf = (t) => { const v = ruleVer(t); return v ? computeDueAt(t.createdAt, v.due) : t.createdAt + 48 * HOUR; };
const RESOLVE_NOTES = ['Spoke to the guest, apologised and fixed the issue.', 'Called the guest and offered a replacement. Guest is satisfied.', 'Reviewed with the team and replied to the guest publicly.'];
// Give every seed ticket a realistic life: created, assigned, worked on, resolved or closed.
function lifecycle(t0, i) {
  let t = t0;
  const v = ruleVer(t), by = 'Automation';
  const hist = [mkEvent('created', t.createdAt, t.auto ? by : CURRENT_USER, { auto: t.auto, ruleId: t.ruleId, version: t.version })];
  const comments = [];
  const initial = t.auto ? (v && v.comment) : 'Please follow up with this guest.';
  if (initial) { comments.push({ id: 'C1-' + t.createdAt, by: t.auto ? by : CURRENT_USER, at: t.createdAt, text: initial, attachments: [], edited: false }); }
  let status = t.status;
  if ((status === 'Resolved' || status === 'Closed') && i % 9 === 4 && !t.fixed) status = 'Junked';
  const isOpenSeed = status === 'New';
  if (isOpenSeed && t.auto && !t.fixed) { if (i % 4 === 1) status = 'In Progress'; else if (i % 7 === 3) status = 'On Hold'; }
  const workAt = t.createdAt + 90 * MIN;
  if (status === 'In Progress' || status === 'On Hold') {
    comments.push({ id: 'C2-' + workAt, by: USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER, at: workAt, text: 'Looking into this now.', attachments: [], edited: false });
    hist.push(mkEvent('comment', workAt, USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER, { text: 'Looking into this now.' }));
    hist.push(mkEvent('auto', workAt, 'System', { text: 'Moved from New to In Progress after the first comment.' }));
    if (status === 'On Hold') hist.push(mkEvent('status', workAt + 30 * MIN, USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER, { from: 'In Progress', to: 'On Hold' }));
    if (status === 'On Hold') comments.push({ id: 'C3-' + workAt, by: USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER, at: workAt + 30 * MIN, text: 'Waiting for the guest to share their order number.', attachments: [], edited: false });
  }
  let closedAt = null;
  if (status === 'Junked') {
    closedAt = t.createdAt + 2 * HOUR;
    const who = USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER;
    comments.push({ id: 'C2-' + closedAt, by: who, at: closedAt, text: 'Not actionable. Review is about another brand.', attachments: [], edited: false });
    hist.push(mkEvent('comment', closedAt, who, { text: 'Not actionable. Review is about another brand.' }));
    hist.push(mkEvent('auto', t.createdAt + 60 * MIN, 'System', { text: 'Moved from New to In Progress after the first comment.' }));
    hist.push(mkEvent('status', closedAt, who, { from: 'In Progress', to: 'Junked' }));
  }
  if (status === 'Resolved' || status === 'Closed') {
    closedAt = t.createdAt + 3 * HOUR;
    const who = USERS.find((u) => u.id === t.assignee)?.name || CURRENT_USER;
    comments.push({ id: 'C2-' + closedAt, by: who, at: closedAt, text: RESOLVE_NOTES[i % 3], attachments: [], edited: false });
    hist.push(mkEvent('comment', closedAt, who, { text: RESOLVE_NOTES[i % 3] }));
    hist.push(mkEvent('auto', t.createdAt + 90 * MIN, 'System', { text: 'Moved from New to In Progress after the first comment.' }));
    hist.push(mkEvent('status', closedAt, who, { from: 'In Progress', to: 'Resolved' }));
    status = 'Resolved';
  }
  if (status === 'New' && t.auto && i === 6) { t = { ...t, assignee: null, unassignedReason: 'No eligible users in this role' }; }
  return { ...t, platform: 'Reviews', status, closedAt, history: hist, comments, createdBy: t.auto ? by : CURRENT_USER, dueAt: dueOf(t), dueSpec: v ? { value: v.due.value, unit: v.due.unit } : { value: 48, unit: 'calendar' }, cycle: 0, reopenCount: 0, attachments: [] };
}

// ── Scenario tickets: one for every SLA situation, so the dashboard can be reviewed at a glance ──
const SC = [
  // [label, status, created h ago, due in h (negative = past), closed h ago, assignee, priority, loc, rating, text, author, source, total due hours, auto]
  ['On track, just created', 'New', 2, 46, null, 'U6', 'Medium', 'L6', 2, 'Order took too long and the staff did not explain why.', 'Lavanya K', 'Google', 48, true],
  ['On track, being worked on', 'In Progress', 10, 38, null, 'U9', 'High', 'L9', 1, 'Rude behaviour at the billing counter. Not coming back.', 'Dinesh P', 'Google', 48, true],
  ['Due soon, under 4 hours left', 'New', 20, 3, null, 'U7', 'High', 'L13', 1, 'Product was damaged and nobody picked up my calls.', 'Sunita M', 'Facebook', 24, true],
  ['Due soon, last quarter of the window', 'In Progress', 40, 8, null, 'U10', 'Medium', 'L14', 2, 'Refund promised a week ago and I have heard nothing since.', 'Ajay R', 'Google', 48, true],
  ['Due soon, on hold', 'On Hold', 30, 5, null, 'U13', 'Medium', 'L10', 3, 'Waited long at the counter. Staff were polite though.', 'Revathi S', 'Zomato', 36, false],
  ['Overdue by one hour', 'New', 49, -1, null, 'U16', 'High', 'L11', 1, 'Dirty tables and a very long wait. Please fix this.', 'Harish B', 'Google', 48, true],
  ['Overdue, unassigned', 'New', 60, -6, null, null, 'High', 'L12', 1, 'Billing error and the manager refused to help.', 'Geeta N', 'Justdial', 48, true],
  ['Overdue, in progress', 'In Progress', 80, -20, null, 'U6', 'Medium', 'L7', 2, 'Cold food and slow service on a weekend evening.', 'Mahesh V', 'Google', 48, true],
  ['Met, resolved well before due', 'Resolved', 20, 28, 5, 'U9', 'Medium', 'L8', 2, 'Staff ignored us for ten minutes. Disappointing visit.', 'Farida A', 'Google', 48, true],
  ['Met, resolved just in time', 'Resolved', 47, 1, 1.5, 'U6', 'High', 'L15', 1, 'Wrong item delivered twice in a row.', 'Prakash T', 'Facebook', 48, true],
  ['Breached, resolved late', 'Resolved', 30, -10, 2, 'U10', 'High', 'L16', 1, 'Nobody replied to my complaint for two days.', 'Bhavna L', 'Google', 24, true],
  ['Met, closed', 'Resolved', 160, -100, 165, 'U7', 'Medium', 'L13', 3, 'Average visit. Parking was a problem.', 'Chetan J', 'Google', 48, false],
  ['Breached, closed', 'Resolved', 170, -100, 90, 'U6', 'Low', 'L6', 2, 'Long queue and no one to guide us.', 'Indu W', 'Zomato', 24, true],
  ['Junked', 'Junked', 26, 22, 20, 'U9', 'Low', 'L9', 4, 'Posted by mistake. This review is for another brand.', 'Kiran Z', 'Justdial', 48, true],
  ['Business hours, due over the weekend', 'New', 6, 40, null, 'U13', 'Medium', 'L1', 2, 'The queue was long and nobody apologised.', 'Mythili D', 'Google', 12, false],
];
const scenarios = SC.map(([label, status, cAgo, dueIn, closedAgo, assignee, priority, loc, rating, text, author, source, total, auto], k) => {
  const created = NOW - cAgo * HOUR;
  const base = T({ auto, fixed: true, status: status === 'Junked' ? 'Junked' : status, priority, assignee, ruleId: auto ? 112 : null, version: auto ? 3 : null, createdAt: created, reviewId: 'R-X' + (k + 1), ...snap(rating, text, 'Negative', loc, source, author, Math.ceil(cAgo / 24)) });
  const t = lifecycle(base, 200 + k);
  const orig = t.closedAt, closed = closedAgo != null ? NOW - closedAgo * HOUR : null;
  const fix = (x) => (orig && x.at === orig ? { ...x, at: closed } : x);
  const out = { ...t, scenario: label, closedAt: closed, dueAt: NOW + dueIn * HOUR, dueSpec: { value: total, unit: label.startsWith('Business') ? 'business' : 'calendar' }, history: t.history.map(fix), comments: t.comments.map(fix) };
  if (!assignee) { out.unassignedReason = 'No eligible users in this role'; out.history = out.history.filter((h) => h.type !== 'assign'); }
  return out;
});
// One reopened ticket
{
  const base = T({ auto: false, fixed: true, status: 'In Progress', priority: 'Medium', assignee: 'U13', ruleId: null, version: null, createdAt: NOW - 60 * HOUR, reviewId: 'R-X99', ...snap(2, 'Staff were rude when I asked about my refund.', 'Negative', 'L5', 'Google', 'Vimala S', 3) });
  const t = lifecycle(base, 300);
  const who = 'Meera Joshi';
  t.history.push(mkEvent('comment', NOW - 30 * HOUR, who, { text: 'Called the guest and explained the refund process.' }), mkEvent('status', NOW - 30 * HOUR, who, { from: 'In Progress', to: 'Resolved' }),
    mkEvent('comment', NOW - 5 * HOUR, who, { text: 'Guest says the refund has still not arrived.' }), mkEvent('status', NOW - 5 * HOUR, who, { from: 'Resolved', to: 'In Progress', reopen: true }), mkEvent('due', NOW - 5 * HOUR, who, { to: NOW + 20 * HOUR, value: 25, unit: 'calendar' }));
  t.comments.push({ id: 'C8', by: who, at: NOW - 30 * HOUR, text: 'Called the guest and explained the refund process.', attachments: [], edited: false }, { id: 'C9', by: who, at: NOW - 5 * HOUR, text: 'Guest says the refund has still not arrived.', attachments: [], edited: false });
  scenarios.push({ ...t, scenario: 'Reopened', closedAt: null, reopenedAt: NOW - 5 * HOUR, reopenCount: 1, cycle: 1, dueAt: NOW + 20 * HOUR, dueSpec: { value: 25, unit: 'calendar' } });
}
const seeded = [...[...seedOpen, ...manual, ...hist].map((t, i) => lifecycle(t, i)), ...scenarios];
export const TICKETS = autoClose(seeded, NOW).tickets.sort((a, b) => b.createdAt - a.createdAt);
export const NEXT_TICKET_NUM = tn + 1;

export const TEMPLATES = [
  { key: 't1', title: 'Negative reviews to Store Manager', desc: '1–2★ with text, Negative', draft: { name: 'Negative reviews to Store Manager', conditions: cond('With Review Text', [1, 2], ['Negative']), assignee: { type: 'role', id: 'Store Manager' }, priority: 'High', comment: CMT_NEG, due: { value: 24, unit: 'calendar' } } },
  { key: 't2', title: 'Positive reviews to Marketing', desc: '5★ with text, Positive', draft: { name: 'Positive reviews to Marketing', conditions: cond('With Review Text', [5], ['Positive']), assignee: { type: 'role', id: 'Marketing' }, priority: 'Low', comment: 'Positive review received. Thank the guest and consider it for a testimonial.', due: { value: 72, unit: 'calendar' } } },
  { key: 't3', title: 'Low rating without text to Area Manager', desc: '1–2★ rating only', draft: { name: 'Low rating without text to Area Manager', conditions: cond('Rating Only', [1, 2], []), assignee: { type: 'role', id: 'Area Manager' }, priority: 'Medium', comment: 'Low rating with no explanation. Please find out what went wrong.', due: { value: 48, unit: 'calendar' } } },
];
export const emptyDraft = () => ({
  name: '', module: 'Reviews', scope: { all: false, groups: { custom: [], region: [], state: [], city: [], locality: [] }, stores: [] },
  conditions: { reviewType: 'With Review Text', ratings: [], sentiments: [], attributes: [], sources: [] },
  assignee: { type: 'role', id: '' }, comment: '', priority: 'Medium', due: { value: 0, unit: 'calendar' }, email: emptyAssignEmail(), startPaused: false,
});
export { NOW, HOUR, DAY, MIN };

// ── Reminders and Escalation (seed configuration) ───────────────
const R_FOOT = '\n\nOpen the ticket: {{ticket_link}}';
export const REMINDERS = [
  { id: 1, name: 'Due soon', when: 'before', value: 48, dayType: 'business', active: true, since: 0, cc: '', replyTo: '', bcc: '', subject: 'Reminder: ticket {{ticket_number}} is due on {{due_date}}', body: 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} ({{ticket_priority}} priority) at {{location_name}} is due on {{due_date}}.' + R_FOOT },
  { id: 2, name: 'Due today', when: 'on', value: 0, dayType: 'calendar', active: true, since: 0, cc: '', replyTo: '', bcc: '', subject: 'Due now: ticket {{ticket_number}}', body: 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} at {{location_name}} is due now. Please update it before it becomes overdue.' + R_FOOT },
  { id: 3, name: 'Overdue nudge', when: 'after', value: 24, dayType: 'calendar', active: true, since: 0, cc: 'support.lead@acmeretail.com', replyTo: '', bcc: '', subject: 'Overdue: ticket {{ticket_number}} was due on {{due_date}}', body: 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} ({{ticket_priority}} priority) at {{location_name}} is overdue. It was due on {{due_date}}.' + R_FOOT },
  { id: 4, name: 'Early heads-up', when: 'before', value: 72, dayType: 'business', active: false, since: 0, cc: '', replyTo: '', bcc: '', subject: 'Heads-up: ticket {{ticket_number}} is due on {{due_date}}', body: 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} at {{location_name}} is due on {{due_date}}.' + R_FOOT },
];
export const NEXT_REMINDER_ID = 5;
const E_BODY = 'Hi {{recipient_name}},\n\nTicket {{ticket_number}} ({{ticket_priority}} priority) at {{location_name}} was due on {{due_date}} and is still open. It is overdue by {{overdue_by}} and is assigned to {{assignee_name}}.' + R_FOOT;
export const ESCALATION = {
  levels: [
    { id: 1, userType: 'role', recipient: 'Area Manager', hours: 4, dayType: 'calendar', since: 0, cc: '', replyTo: '', bcc: '', subject: 'Escalation level {{escalation_level}}: ticket {{ticket_number}} is overdue', body: E_BODY },
    { id: 2, userType: 'user', recipient: 'U15', hours: 24, dayType: 'business', since: 0, cc: '', replyTo: '', bcc: '', subject: 'Escalation level {{escalation_level}}: ticket {{ticket_number}} is still open', body: E_BODY },
    { id: 3, userType: 'role', recipient: 'Customer Care', hours: 24, dayType: 'calendar', since: 0, cc: '', replyTo: '', bcc: '', subject: 'Final escalation: ticket {{ticket_number}} needs action', body: E_BODY },
  ],
};
export const NEXT_LEVEL_ID = 4;
