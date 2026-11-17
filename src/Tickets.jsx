import React, { useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { latest, fmtDT } from './engine.js';
import { prioTag, Stars, Modal, Pills, Dropdown } from './ui.jsx';
import { STATUSES, statusTone, slaOf, SLA_KEYS, URGENCY, timeLeft, isFinal } from './tickets.js';
import TicketModal from './TicketModal.jsx';

const EMPTY = { status: [], priority: [], sla: [], assignee: '', platform: '', origin: '' };
const count = (f) => ['status', 'priority', 'sla'].reduce((n, k) => n + (f[k].length ? 1 : 0), 0) + ['assignee', 'platform', 'origin'].filter((k) => f[k]).length;

function FilterModal({ value, onApply, onClose }) {
  const { state: s } = useStore();
  const [f, setF] = useState(value);
  const up = (p) => setF({ ...f, ...p });
  const opts = (arr) => [{ value: '', label: 'All' }, ...arr];
  return (
    <Modal title="Filter tickets" size="md" onClose={onClose} footer={<div className="mf"><button className="btn" onClick={() => setF(EMPTY)}>Clear all</button><span className="sp" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { onApply(f); onClose(); }}>Apply filters</button></div>}>
      <div className="mb">
        <div className="field"><label>Status</label><Pills multi options={STATUSES} value={f.status} onChange={(status) => up({ status })} /></div>
        <div className="field"><label>Priority</label><Pills multi options={['High', 'Medium', 'Low']} value={f.priority} onChange={(priority) => up({ priority })} /></div>
        <div className="field"><label>SLA status</label><Pills multi options={SLA_KEYS.map((x) => x[1])} value={f.sla.map((k) => SLA_KEYS.find((x) => x[0] === k)[1])} onChange={(v) => up({ sla: v.map((l) => SLA_KEYS.find((x) => x[1] === l)[0]) })} /></div>
        <div className="field"><label>Assigned to</label><Dropdown searchable value={f.assignee} onChange={(assignee) => up({ assignee })} options={opts([{ value: 'none', label: 'Unassigned' }, ...s.users.filter((u) => u.role !== 'Admin').map((u) => ({ value: u.id, label: u.name }))])} /></div>
        <div className="row2" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}><label>Platform</label><Dropdown value={f.platform} onChange={(platform) => up({ platform })} options={opts(PLATFORMS.map((x) => ({ value: x, label: x })))} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Created by</label><Dropdown value={f.origin} onChange={(origin) => up({ origin })} options={opts([{ value: 'auto', label: 'Automation' }, { value: 'manual', label: 'A person (manual)' }])} /></div>
        </div>
      </div>
    </Modal>
  );
}

const PLATFORMS = ['Reviews', 'Voice AI'];
const PAGE = 10;
export default function Tickets() {
  const { state: s, dispatch } = useStore();
  const rf = s.page.filter;
  const [q, setQ] = useState(''), [sort, setSort] = useState('newest'), [f, setF] = useState(EMPTY), [filtering, setFiltering] = useState(false);
  const [page, setPage] = useState(1), [openId, setOpenId] = useState(s.page.open || null);
  const name = (id) => s.users.find((u) => u.id === id)?.name;
  const rule = rf?.ruleId && s.rules.find((r) => r.id === rf.ruleId);
  const base = rf?.ruleId ? s.tickets.filter((t) => t.ruleId === rf.ruleId && (!rf.version || t.version === rf.version)) : s.tickets;

  const kpi = useMemo(() => {
    const k = { all: base.length, overdue: 0, unassigned: 0 };
    STATUSES.forEach((x) => { k[x] = 0; });
    base.forEach((t) => { k[t.status]++; const sl = slaOf(t, s.now).key; if (sl === 'overdue') k.overdue++; if (!t.assignee) k.unassigned++; });
    return k;
  }, [base, s.now]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out = base.filter((t) => {
      if (ql && !(`${t.id} ${t.text} ${t.reviewer} ${name(t.assignee) || ''}`.toLowerCase().includes(ql))) return false;
      if (f.status.length && !f.status.includes(t.status)) return false;
      if (f.priority.length && !f.priority.includes(t.priority)) return false;
      if (f.sla.length && !f.sla.includes(slaOf(t, s.now).key)) return false;
      if (f.assignee && (f.assignee === 'none' ? t.assignee : t.assignee !== f.assignee)) return false;
      if (f.platform && t.platform !== f.platform) return false;
      if (f.origin && (f.origin === 'auto') !== !!t.auto) return false;
      return true;
    });
    const key = (t) => URGENCY[slaOf(t, s.now).key];
    return out.sort(sort === 'oldest' ? (a, b) => a.createdAt - b.createdAt : sort === 'urgency' ? (a, b) => key(a) - key(b) || (a.dueAt || 0) - (b.dueAt || 0) : (a, b) => b.createdAt - a.createdAt);
  }, [base, q, f, sort, s.now, s.users]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE)), cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * PAGE, cur * PAGE);
  const pickStatus = (st) => { setF({ ...EMPTY, status: st ? [st] : [] }); setQ(''); setPage(1); };
  const pickSla = (k) => { setF({ ...EMPTY, sla: [k] }); setQ(''); setPage(1); };
  const activeStatus = f.status.length === 1 && !f.sla.length && count(f) === 1 ? f.status[0] : null;
  const pickUn = () => { setF({ ...EMPTY, assignee: 'none' }); setQ(''); setPage(1); };
  const activeUn = f.assignee === 'none' && count(f) === 1;
  const activeSla = f.sla.length === 1 && !f.status.length && count(f) === 1 ? f.sla[0] : null;
  const clear = () => dispatch({ type: 'NAV', page: { name: 'tickets' } });
  const close = () => { setOpenId(null); if (s.page.open) dispatch({ type: 'NAV', page: { ...s.page, open: undefined } }); };

  const Kpi = ({ label, n, tone, on, onClick }) => <button className={'kpi ' + tone + (on ? ' on' : '')} onClick={onClick}><b>{n}</b><span>{label}</span></button>;
  return (
    <div>
      <div className="page-h"><h1>Review Tickets</h1><span className="muted">Tickets raised from reviews</span></div>
      <div className="kpis">
        <Kpi label="All" n={kpi.all} tone="navy" on={!count(f)} onClick={() => pickStatus(null)} />
        {STATUSES.map((x) => <Kpi key={x} label={x} n={kpi[x]} tone={statusTone[x]} on={activeStatus === x} onClick={() => pickStatus(x)} />)}
        <Kpi label="Unassigned" n={kpi.unassigned} tone="gray" on={activeUn} onClick={pickUn} />
        <Kpi label="Overdue" n={kpi.overdue} tone="red" on={activeSla === 'overdue'} onClick={() => pickSla('overdue')} />
      </div>
      {rf?.ruleId && <div className="chips"><span className="chip">Rule #{rf.ruleId}{rule ? ` · ${latest(rule).name}` : ''}{rf.version ? ` · V${rf.version}` : ' · all versions'}<button aria-label="Clear filter" onClick={clear}>✕</button></span><a onClick={() => dispatch({ type: 'NAV', page: { name: 'history', ruleId: rf.ruleId } })}>View rule history</a></div>}
      <div className="toolbar">
        <div className="search"><input placeholder="Search ticket, review or assignee" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search tickets" /></div>
        <span className="sp" />
        <label className="muted" htmlFor="sortsel">Sort by</label>
        <select id="sortsel" className="sel" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="urgency">Urgency</option></select>
        <button className="btn" onClick={() => setFiltering(true)}>⚲ Filter{count(f) ? <span className="badge">{count(f)}</span> : null}</button>
        {count(f) > 0 && <button className="btn ghost" onClick={() => { setF(EMPTY); setPage(1); }}>Clear</button>}
      </div>
      <div className="tablewrap"><table className="t tk"><thead><tr><th>Ticket</th><th>Review</th><th>Priority</th><th>Created by</th><th>Assigned to</th><th>Status</th><th>SLA and due</th></tr></thead>
        <tbody>
          {rows.map((t) => { const sl = slaOf(t, s.now); const loc = s.locations.find((l) => l.id === t.locationId); return (
            <tr key={t.id} className="click" onClick={() => setOpenId(t.id)}>
              <td><a onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}><b>{t.id}</b></a><div className="muted sub">{fmtDT(t.createdAt)}</div></td>
              <td style={{ maxWidth: 340 }}><div className="clamp">{t.text || <i className="muted">Rating only, no text</i>}</div><div className="muted sub"><Stars n={t.rating || 0} /> {t.reviewer} · {loc?.name}</div></td>
              <td>{prioTag(t.priority)}</td>
              <td>{t.auto ? 'Automation' : t.createdBy}<div className="muted sub">{t.auto ? `Rule #${t.ruleId}` : 'Manual'}</div></td>
              <td>{name(t.assignee) || <span className="muted">Unassigned</span>}</td>
              <td><span className={'tag ' + statusTone[t.status]}>{t.status}</span></td>
              <td><span className={'tag ' + sl.tone}>{sl.label}</span><div className="muted sub">{t.status === 'Junked' || !t.dueAt ? '' : (timeLeft(t, s.now) + ' · ' + fmtDT(t.dueAt))}</div></td>
            </tr>); })}
          {!rows.length && <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 30 }}>No tickets match these filters</td></tr>}
        </tbody></table></div>
      <div className="pager"><span className="muted">{list.length} ticket{list.length === 1 ? '' : 's'}</span><span className="sp" />
        {pages > 1 && <><button className="btn sm" disabled={cur === 1} onClick={() => setPage(cur - 1)}>‹ Previous</button><span className="muted">Page {cur} of {pages}</span><button className="btn sm" disabled={cur === pages} onClick={() => setPage(cur + 1)}>Next ›</button></>}</div>
      {filtering && <FilterModal value={f} onApply={(v) => { setF(v); setPage(1); }} onClose={() => setFiltering(false)} />}
      {openId && <TicketModal id={openId} onClose={close} />}
    </div>
  );
}
