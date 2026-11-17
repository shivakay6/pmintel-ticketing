// Date arithmetic shared by due dates, reminders and escalation. No imports, so data.js can use it.
export const HOUR = 3600000, DAY = 24 * HOUR;

// Move forward by hours. 'calendar' counts every hour; 'business' counts only hours that fall
// on Monday to Friday (Saturday and Sunday are skipped as whole days).
export function addHours(from, n, kind) {
  if (kind !== 'business') return from + n * HOUR;
  let t = from, left = n * HOUR;
  while (left > 0) {
    const w = new Date(t).getDay();
    if (w === 6 || w === 0) { const m = new Date(t); m.setDate(m.getDate() + (w === 6 ? 2 : 1)); m.setHours(0, 0, 0, 0); t = m.getTime(); continue; }
    const sat = new Date(t); sat.setDate(sat.getDate() + (6 - w)); sat.setHours(0, 0, 0, 0);
    const use = Math.min(sat.getTime() - t, left); t += use; left -= use;
  }
  return t;
}

// Move backward by hours (same rules, mirrored).
export function subHours(from, n, kind) {
  if (kind !== 'business') return from - n * HOUR;
  let t = from, left = n * HOUR;
  while (left > 0) {
    const w = new Date(t - 1).getDay(), s = new Date(t - 1);
    if (w === 6 || w === 0) { s.setDate(s.getDate() - (w === 0 ? 1 : 0)); s.setHours(0, 0, 0, 0); t = s.getTime(); continue; }
    s.setHours(0, 0, 0, 0);
    const use = Math.min(t - s.getTime(), left); t -= use; left -= use;
  }
  return t;
}

// Ticket due date from the rule's due setting: { value (hours), unit: 'calendar' | 'business' }
export const computeDueAt = (from, due) => (!due || !due.value ? null : addHours(from, Number(due.value), due.unit));
