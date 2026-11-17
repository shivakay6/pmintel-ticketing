import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { latest, healthFlags, resolveScope, scopeLabel, assigneeLabel, fmtDate, fmtTime, dueText } from './engine.js';
import { Modal, Popup, Pills, statusTag, prioTag } from './ui.jsx';
import { MODULES, TEMPLATES, emptyDraft, emptyAssignEmail, DAY } from './data.js';
import Wizard from './Wizard.jsx';

export function ConditionList({ c }) {
  const type = c.reviewType === 'All' ? 'All reviews' : c.reviewType === 'Rating Only' ? 'Rating only' : 'With review text';
  const items = [
    ['Review type', type],
    ['Rating', c.ratings.length ? [...c.ratings].sort().map((n) => n + '★').join(', ') : 'Any'],
    ...(c.reviewType !== 'Rating Only' ? [['Sentiment', c.sentiments.length ? c.sentiments.join(', ') : 'Any'], ['Review attributes', (c.attributes || []).length ? c.attributes.join(', ') : 'Any']] : []),
    ['Source', c.sources.length ? c.sources.join(', ') : 'All sources'],
  ];
  return <div className="conds">{items.map(([k, v]) => <div className="cd" key={k}><span>{k}</span><b>{v}</b></div>)}</div>;
}

export function LocationsModal({ scope, onClose }) {
  const { state: s } = useStore();
  const ids = [...resolveScope(scope, s.locations)];
  return (
    <Modal title={`Locations (${ids.length})`} size="md" onClose={onClose}>
      <div className="mb">
        <p className="muted" style={{ marginTop: 0 }}>Read-only list of locations this rule currently covers.{scope.all || Object.values(scope.groups).some((a) => a.length) ? ' Group selections update automatically when locations are added.' : ''}</p>
        <div className="llist">{ids.map((id) => { const l = s.locations.find((x) => x.id === id); return <label key={id}><span>{l.name}</span><span className="c">{l.city}, {l.state}</span></label>; })}{!ids.length && <label>No locations left</label>}</div>
      </div>
      <div className="mf"><span className="sp" /><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

function FilterModal({ filters, onApply, onClose }) {
  const { state: s } = useStore();
  const [f, setF] = useState(filters);
  const [q, setQ] = useState('');
  const creators = [...new Set(s.rules.map((r) => r.createdBy))].filter((n) => n.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Filter rules" size="md" onClose={onClose}>
      <div className="mb">
        <div className="field"><label>Module</label><Pills multi options={MODULES} value={f.modules} onChange={(modules) => setF({ ...f, modules })} /><div className="hint">Other modules appear here when they are added.</div></div>
        <div className="field"><label>Status</label><Pills multi options={['Active', 'Paused']} value={f.statuses} onChange={(statuses) => setF({ ...f, statuses })} /><div className="hint">Stopped versions are visible on the History page.</div></div>
        <div className="field"><label>Created by</label><input placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} /><Pills multi options={creators} value={f.creators} onChange={(creators) => setF({ ...f, creators })} /></div>
      </div>
      <div className="mf"><button className="btn ghost" onClick={() => setF({ modules: [], statuses: [], creators: [] })}>Clear all</button><span className="sp" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onApply(f)}>Apply</button></div>
    </Modal>
  );
}

function RuleCard({ rule, onEdit, onPause, onResume, onDup, onLocs }) {
  const { state: s, dispatch } = useStore();
  const [menu, setMenu] = useState(false);
  const v = latest(rule);
  const flags = healthFlags(rule, s.users, s.locations);
  const mine = s.tickets.filter((t) => t.ruleId === rule.id);
  const overall = mine.length, cur = mine.filter((t) => t.version === v.v).length;
  const goT = (version) => dispatch({ type: 'NAV', page: { name: 'tickets', filter: { ruleId: rule.id, version } } });
  const wrap = useRef(null);
  useEffect(() => { const h = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setMenu(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const cnt = (n, version, label) => (n > 0 ? <a onClick={() => goT(version)}>{label}{n}</a> : <span className="muted">{label}0</span>);
  return (
    <div className="card rcard" ref={wrap}>
      {v.v > 1 && <div className="ribbon">Edited</div>}
      {s.demo.canManage && <div className="dots"><button className="icon-btn" aria-label="Rule actions" onClick={() => setMenu(!menu)}>⋮</button></div>}
      {menu && (
        <div className="menu" role="menu">
          <button onClick={() => { setMenu(false); onEdit(rule); }}>Edit</button>
          {v.status === 'Active' ? <button onClick={() => { setMenu(false); onPause(rule); }}>Pause</button> : <button onClick={() => { setMenu(false); onResume(rule); }}>Resume</button>}
          <button onClick={() => { setMenu(false); onDup(rule); }}>Duplicate</button>
        </div>
      )}
      <div className="head">
        <h3>{v.name}</h3><span className="tag blue">{rule.module}</span>{prioTag(v.priority)}{statusTag(v.status)}
        <span className="tag navy">V{v.v}</span><span className="tag gray">#{rule.id}</span>
      </div>
      {flags.length > 0 && <div className="hbanner" role="button" tabIndex={0} onClick={() => s.demo.canManage && onEdit(rule)} onKeyDown={(e) => e.key === 'Enter' && s.demo.canManage && onEdit(rule)}>⚠ {flags.join(' · ')} <span className="muted" style={{ marginLeft: 'auto' }}>{s.demo.canManage ? 'Click to edit' : ''}</span></div>}
      <div className="rgrid g3">
        <div className="kv"><label>Locations</label><div><a onClick={() => onLocs(v.scope)}>{scopeLabel(v.scope, s.locations)}</a></div></div>
        <div className="kv"><label>Assigned to</label><div>{assigneeLabel(v.assignee, s.users)}</div></div>
        <div className="kv"><label>Due date</label><div>Within {dueText(v.due)}</div></div>
        <div className="kv" style={{ gridColumn: '1 / -1' }}><label>Conditions</label><ConditionList c={v.conditions} /></div>
      </div>
      <div className="rfoot">
        <div className="kv"><label>Tickets created</label><div>Overall {cnt(overall, undefined, '')}<span className="sep">|</span>This version (V{v.v}) {cnt(cur, v.v, '')}</div></div>
        <div className="kv"><label>Created on</label><div>{fmtDate(rule.createdAt)}, {fmtTime(rule.createdAt)}</div></div>
        <div className="kv"><label>Created by</label><div>{rule.createdBy}</div></div>
        <span className="sp" />
        <button className="btn sm" onClick={() => dispatch({ type: 'NAV', page: { name: 'history', ruleId: rule.id } })}>View History</button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state: s, dispatch } = useStore();
  const [q, setQ] = useState(''), [dq, setDq] = useState('');
  const [sort, setSort] = useState('newest');
  const [filters, setFilters] = useState({ modules: [], statuses: [], creators: [] });
  const [showFilter, setShowFilter] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [confirm, setConfirm] = useState(null);   // {kind, rule}
  const [locs, setLocs] = useState(null);
  const [visible, setVisible] = useState(20);
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);

  const rules = s.demo.emptyDashboard ? [] : s.rules;
  const list = useMemo(() => {
    let r = rules.filter((x) => latest(x).name.toLowerCase().includes(dq.trim().toLowerCase()));
    if (filters.modules.length) r = r.filter((x) => filters.modules.includes(x.module));
    if (filters.statuses.length) r = r.filter((x) => filters.statuses.includes(latest(x).status));
    if (filters.creators.length) r = r.filter((x) => filters.creators.includes(x.createdBy));
    const lastEdit = (x) => latest(x).createdAt;
    r = [...r].sort(sort === 'oldest' ? (a, b) => a.createdAt - b.createdAt : sort === 'edited' ? (a, b) => lastEdit(b) - lastEdit(a) : (a, b) => b.createdAt - a.createdAt);
    return r;
  }, [rules, dq, filters, sort]);
  const active = filters.modules.length + filters.statuses.length + filters.creators.length > 0;
  const clearAll = () => { setFilters({ modules: [], statuses: [], creators: [] }); setQ(''); };
  const removeChip = (k, val) => setFilters({ ...filters, [k]: filters[k].filter((x) => x !== val) });

  const onScroll = (e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) setVisible((v) => v + 20); };
  useEffect(() => { const el = document.querySelector('.content'); if (!el) return; el.addEventListener('scroll', onScroll); return () => el.removeEventListener('scroll', onScroll); });

  const doConfirm = () => {
    const { kind, rule } = confirm;
    dispatch({ type: kind === 'pause' ? 'PAUSE' : 'RESUME', id: rule.id });
    dispatch({ type: 'TOAST', msg: `“${latest(rule).name}” ${kind === 'pause' ? 'paused' : 'resumed'}` });
    setConfirm(null);
  };
  const openEdit = (rule) => setWizard({ mode: 'edit', rule });
  const openDup = (rule) => { const v = latest(rule); setWizard({ mode: 'create', prefill: { ...emptyDraft(), name: '', scope: JSON.parse(JSON.stringify(v.scope)), conditions: JSON.parse(JSON.stringify(v.conditions)), assignee: { ...v.assignee }, comment: v.comment, priority: v.priority, due: { ...v.due }, email: { ...(v.email || emptyAssignEmail()) } }, dup: { name: v.name, scope: JSON.parse(JSON.stringify(v.scope)), conditions: JSON.parse(JSON.stringify(v.conditions)), assignee: { ...v.assignee }, priority: v.priority, due: { ...v.due } } }); };

  return (
    <div>
      <div className="page-h"><h1>Ticket Automation</h1><span className="sp" />{s.demo.canManage && <button className="btn primary" onClick={() => setWizard({ mode: 'create' })}>＋ Create Rule</button>}</div>
      <div className="banner">ⓘ <span>Rules turn matching reviews into owned, prioritised tickets. A rule starts working from the time it is activated: every matching review that comes in after that creates a ticket. Editing a rule creates a new version.</span></div>

      {rules.length === 0 ? (
        <div className="empty">
          <h3 style={{ marginTop: 0 }}>No rules yet</h3>
          <p className="muted" style={{ maxWidth: 560, margin: '0 auto' }}>Ticket Automation creates a ticket, with an owner and a priority, whenever a review matches a rule. Start from a template or build your own.</p>
          <div className="tmpls">{TEMPLATES.map((t) => <div key={t.key} className="tmpl" role="button" tabIndex={0} onClick={() => s.demo.canManage && setWizard({ mode: 'create', prefill: { ...emptyDraft(), ...JSON.parse(JSON.stringify(t.draft)) }, template: t.key })}><b>{t.title}</b><div className="muted">{t.desc}</div></div>)}</div>
          {s.demo.canManage && <button className="btn primary" onClick={() => setWizard({ mode: 'create' })}>＋ Create Rule</button>}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search"><input aria-label="Search rules" placeholder="Search by rule name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="sel" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="edited">Recently edited</option></select>
            <button className="btn" onClick={() => setShowFilter(true)}>⚲ Filter{active ? ` (${filters.modules.length + filters.statuses.length + filters.creators.length})` : ''}</button>
          </div>
          {active && <div className="chips">{['modules', 'statuses', 'creators'].flatMap((k) => filters[k].map((v) => <span className="chip" key={k + v}>{v}<button aria-label={'Remove ' + v} onClick={() => removeChip(k, v)}>✕</button></span>))}<a onClick={clearAll}>Clear all</a></div>}
          {list.length === 0 ? (
            <div className="empty"><h3 style={{ marginTop: 0 }}>No rules match</h3><a onClick={clearAll}>Clear filters</a></div>
          ) : (
            <div className="cards">{list.slice(0, visible).map((r) => <RuleCard key={r.id} rule={r} onEdit={openEdit} onPause={(rule) => setConfirm({ kind: 'pause', rule })} onResume={(rule) => setConfirm({ kind: 'resume', rule })} onDup={openDup} onLocs={setLocs} />)}
              {list.length > visible && <button className="btn" onClick={() => setVisible(visible + 20)}>Load more ({list.length - visible})</button>}
            </div>
          )}
        </>
      )}

      {showFilter && <FilterModal filters={filters} onClose={() => setShowFilter(false)} onApply={(f) => { setFilters(f); setShowFilter(false); }} />}
      {locs && <LocationsModal scope={locs} onClose={() => setLocs(null)} />}
      {confirm?.kind === 'pause' && <Popup title="Pause Rule" onCancel={() => setConfirm(null)} confirm="Pause" onConfirm={doConfirm}>No tickets will be created for new reviews while this rule is paused. Reviews that arrive during the pause will not create tickets after you resume.</Popup>}
      {confirm?.kind === 'resume' && <Popup icon="ok" title="Resume Rule" onCancel={() => setConfirm(null)} confirm="Resume" onConfirm={doConfirm}>Tickets will be created for matching reviews that arrive from now on. Reviews received while the rule was paused will not be turned into tickets.</Popup>}
      {wizard && <Wizard {...wizard} onClose={() => setWizard(null)} onView={() => { setQ(''); setDq(''); setFilters({ modules: [], statuses: [], creators: [] }); setSort('newest'); const c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0 }); }} />}
    </div>
  );
}
