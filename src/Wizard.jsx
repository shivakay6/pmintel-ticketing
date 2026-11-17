import React, { useMemo, useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { latest, resolveScope, scopeIsDynamic, scopeHasFixed, previewDraft, validateStep, conditionText, assigneeText, PRIORITY_RANK, dueText } from './engine.js';
import { NumInput, Modal, Popup, Pills, Seg, Dropdown } from './ui.jsx';
import { ConditionList } from './Dashboard.jsx';
import { SOURCES, ATTRIBUTES, MODULES, ROLES, DUE_UNITS, emptyDraft, emptyAssignEmail, NOW } from './data.js';
import { EmailFields, MailPreview, SectionCard } from './Notify.jsx';
import { validateAssignEmail, VARS_ASSIGNMENT, renderTemplate, varsFor, SAMPLE_TICKET } from './schedule.js';

const STEPS = ['Basics', 'Conditions', 'Action', 'Email', 'Review and Activate'];
const clone = (o) => JSON.parse(JSON.stringify(o));
// Duplicate: which of the counted parameters differ from the original rule (name, comment and email are not counted here).
const nz = (x) => JSON.stringify(x, (k, v) => (Array.isArray(v) ? [...v].sort() : v));
function dupChanges(o, d) {
  const out = [];
  if (nz(o.scope) !== nz(d.scope)) out.push('Locations');
  const a = { attributes: [], ...o.conditions }, b = { attributes: [], ...d.conditions };
  if (a.reviewType !== b.reviewType) out.push('Review type');
  if (nz(a.ratings) !== nz(b.ratings)) out.push('Ratings');
  if (nz(a.sentiments) !== nz(b.sentiments)) out.push('Sentiment');
  if (nz(a.attributes || []) !== nz(b.attributes || [])) out.push('Review attributes');
  if (nz(a.sources) !== nz(b.sources)) out.push('Source');
  if (o.assignee.type !== d.assignee.type || o.assignee.id !== d.assignee.id) out.push('Assign to');
  if (o.priority !== d.priority) out.push('Priority');
  if (Number(o.due.value) !== Number(d.due.value) || o.due.unit !== d.due.unit) out.push('Due date');
  return out;
}

/* ───────── Location filter ───────── */
const TABS = [['custom', 'Custom Group'], ['region', 'Region/Zone'], ['state', 'State/Province'], ['city', 'City'], ['locality', 'Locality'], ['store', 'Store']];
function LocationFilter({ scope, onApply, onClose }) {
  const { state: s } = useStore();
  const [sc, setSc] = useState(clone(scope));
  const [tab, setTab] = useState('region');
  const [q, setQ] = useState('');
  const act = s.locations.filter((l) => l.active);
  const items = useMemo(() => {
    const map = new Map();
    if (tab === 'store') act.forEach((l) => map.set(l.id, { key: l.id, label: l.name, count: 1 }));
    else if (tab === 'custom') act.forEach((l) => l.custom.forEach((c) => map.set(c, { key: c, label: c, count: (map.get(c)?.count || 0) + 1 })));
    else act.forEach((l) => map.set(l[tab], { key: l[tab], label: l[tab], count: (map.get(l[tab])?.count || 0) + 1 }));
    return [...map.values()].filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  }, [tab, q]);
  const sel = (t) => (t === 'store' ? sc.stores : sc.groups[t]);
  const setSel = (t, arr) => setSc(t === 'store' ? { ...sc, all: false, stores: arr } : { ...sc, all: false, groups: { ...sc.groups, [t]: arr } });
  const toggle = (k) => setSel(tab, sel(tab).includes(k) ? sel(tab).filter((x) => x !== k) : [...sel(tab), k]);
  const allOn = items.length > 0 && items.every((i) => sel(tab).includes(i.key));
  const selectAll = () => setSel(tab, allOn ? sel(tab).filter((k) => !items.find((i) => i.key === k)) : [...new Set([...sel(tab), ...items.map((i) => i.key)])]);
  const count = resolveScope(sc, s.locations).size;
  return (
    <Modal title="Select locations" onClose={onClose} size="md">
      <div className="mb">
        <label className="check" style={{ marginBottom: 10 }}><input type="checkbox" checked={sc.all} onChange={(e) => setSc(e.target.checked ? { all: true, groups: { custom: [], region: [], state: [], city: [], locality: [] }, stores: [] } : { ...sc, all: false })} /> <b>All locations</b></label>
        <div className="ltabs">{TABS.map(([k, l]) => { const n = sel(k).length; return <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setQ(''); }}>{l}{n > 0 && <span className="cnt">{n}</span>}</button>; })}</div>
        <div className="toolbar"><div className="search"><input placeholder={`Search ${TABS.find((t) => t[0] === tab)[1]}`} value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn" onClick={selectAll}>{allOn ? 'Unselect all' : 'Select All'}</button></div>
        <div className="llist">{items.map((i) => <label key={i.key}><input type="checkbox" checked={sel(tab).includes(i.key)} onChange={() => toggle(i.key)} />{i.label}<span className="c">{i.count} location{i.count > 1 ? 's' : ''}</span></label>)}{!items.length && <label className="muted">No results</label>}</div>
      </div>
      <div className="mf"><b>{count} Locations Selected</b><button className="btn ghost" onClick={() => setSc({ all: false, groups: { custom: [], region: [], state: [], city: [], locality: [] }, stores: [] })}>Clear All</button><span className="sp" /><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onApply(sc)}>Apply</button></div>
    </Modal>
  );
}

function HowItWorks({ onClose }) {
  return (
    <Modal title="How role assignment works" size="md" onClose={onClose}>
      <div className="mb">
        <ol style={{ lineHeight: 1.8, paddingLeft: 20, marginTop: 0 }}>
          <li><b>Build the pool.</b> Active users in the role who cover the review’s location.</li>
          <li><b>If the pool is empty,</b> the ticket is created unassigned and the rule is flagged “No eligible users”.</li>
          <li><b>Rank the pool</b> and stop at the first key that separates users:
            <ol type="a"><li>Fewest open tickets (all sources, all priorities)</li><li>Fewest open High priority tickets</li><li>Fewest open Medium priority tickets</li><li>Longest time since the user last received an auto-assigned ticket</li><li>Name, A to Z</li></ol></li>
          <li><b>Assign and count.</b> One ticket at a time per role, so two reviews arriving together never pick the same user from stale counts.</li>
        </ol>
        <p className="muted">“Open” means any ticket that is not Resolved, Closed or Junked.</p>
      </div>
      <div className="mf"><span className="sp" /><button className="btn primary" onClick={onClose}>Got it</button></div>
    </Modal>
  );
}

/* ───────── Wizard ───────── */
export default function Wizard({ mode, rule, prefill, template, dup, onClose, onView }) {
  const { state: s, dispatch } = useStore();
  const editing = mode === 'edit';
  const initial = useMemo(() => {
    if (editing) { const v = latest(rule); return { ...emptyDraft(), name: v.name, module: rule.module, scope: clone(v.scope), conditions: clone(v.conditions), assignee: { ...v.assignee }, comment: v.comment, priority: v.priority, due: { ...v.due }, email: { ...(v.email || emptyAssignEmail()) } }; }
    return prefill ? clone(prefill) : emptyDraft();
  }, []);
  const [d, setD] = useState(initial);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState({});
  const [pop, setPop] = useState(null);       // discard | overlap | confirm | fail | done | unavailable
  const [showLoc, setShowLoc] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [done, setDone] = useState(null);
  const dirty = (!editing && !!prefill) || JSON.stringify(d) !== JSON.stringify(initial);
  const curVer = editing ? latest(rule) : null;
  const errs = validateStep(step, d, s.rules, editing ? rule.id : null, validateAssignEmail);
  const dupSrc = !editing && dup && typeof dup === 'object' ? dup : null;
  const dupDone = dupSrc ? dupChanges(dupSrc, d) : [];
  const dupBlock = !!dupSrc && dupDone.length === 0;
  if (dupSrc && step === 1 && d.name.trim().toLowerCase() === dupSrc.name.trim().toLowerCase()) errs.name = 'Enter a new name. A duplicate cannot keep the name of the original rule.';
  const set = (patch, keys = []) => { setD((x) => ({ ...x, ...patch })); setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) })); };
  const setC = (patch, keys) => set({ conditions: { ...d.conditions, ...patch } }, keys);
  const tryClose = () => (dirty ? setPop('discard') : onClose());

  const preview = useMemo(() => (step === 5 ? previewDraft(d, { reviews: s.reviews, users: s.users, tickets: s.tickets, locations: s.locations, rules: s.rules, now: Date.now() }, editing ? rule.id : null) : null), [step]);

  const next = () => {
    if (step === 3 && d.assignee.type === 'user') {
      const u = s.users.find((x) => x.id === d.assignee.id);
      if (!u || !u.active) { setPop('unavailable'); return; }
    }
    setStep(step + 1);
  };
  const submit = () => {
    if (preview.overlaps.length) setPop('overlap'); else afterOverlap();
  };
  const afterOverlap = () => (editing ? setPop('confirm') : save());
  const save = () => {
    if (s.demo.failNextSave) { dispatch({ type: 'DEMO', patch: { failNextSave: false } }); setPop('fail'); return; }
    const id = editing ? rule.id : s.nextRuleId;
    const ver = editing ? curVer.v + 1 : 1;
    dispatch({ type: 'SAVE_RULE', draft: d, editingId: editing ? rule.id : null });
    setDone({ id, ver, name: d.name.trim() });
    setPop('done');
  };

  const roleCounts = ROLES.map((r) => ({ value: r, label: `${r} (${s.users.filter((u) => u.active && u.role === r).length})` }));
  const userOpts = s.users.filter((u) => u.active && u.role !== 'Admin').map((u) => ({ value: u.id, label: u.name, note: u.role }));
  const err = (k) => touched[k] && errs[k];
  const valid = Object.keys(errs).length === 0;
  const nL = resolveScope(d.scope, s.locations).size;
  const c = d.conditions;

  return (
    <Modal title={editing ? 'Edit Rule' : 'Create Rule'} onClose={tryClose} header={
      <div className="mh"><h2>{editing ? 'Edit Rule' : 'Create Rule'}</h2>{editing && <><span className="tag gray">#{rule.id}</span><span className="tag navy">V{curVer.v} → V{curVer.v + 1}</span></>}<button className="icon-btn" aria-label="Close" onClick={tryClose}>✕</button></div>}
      footer={
        <div className="mf">
          <button className="btn" onClick={tryClose}>Cancel</button><span className="sp" />
          {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 5 ? <button className="btn primary" disabled={!valid || (step === 3 && dupBlock)} onClick={next}>Next</button> : <button className="btn primary" disabled={dupBlock} onClick={submit}>{editing ? 'Save New Version' : 'Create Rule'}</button>}
        </div>}>
      <div className="stepper">{STEPS.map((l, i) => <React.Fragment key={l}>{i > 0 && <div className="bar" />}<div className={'st ' + (step === i + 1 ? 'on' : step > i + 1 ? 'done' : '')}><span className="n">{step > i + 1 ? '✓' : i + 1}</span>{l}</div></React.Fragment>)}</div>
      <div className="mb">
        {dupSrc && <div className="banner dupbox" style={{ marginBottom: 14, display: 'block' }}>
          <div><b>Duplicating “{dupSrc.name}”.</b> A duplicate must differ from the original:</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 0, listStyle: 'none', lineHeight: 1.7 }}>
            <li>{d.name.trim() && d.name.trim().toLowerCase() !== dupSrc.name.trim().toLowerCase() ? '✓' : '○'} Enter a new <b>name</b> (step 1).</li>
            <li>{dupDone.length ? '✓' : '○'} Change <b>at least one</b> of: Locations (step 1), any Condition (step 2), or Assign to, Priority or Due date (step 3). Comment and Email changes do not count.{dupDone.length > 0 && <> Changed so far: <b>{dupDone.join(', ')}</b>.</>}</li>
          </ul>
          {dupBlock && step >= 3 && <div className="err" style={{ marginTop: 6 }}>Change at least one of the settings above to continue.</div>}
        </div>}
        {step === 1 && <>
          <div className="field"><label>Rule name</label>
            <div className={err('name') ? 'bad' : ''}><input autoFocus placeholder={dupSrc ? 'Enter a new name for the duplicate' : 'e.g. Negative reviews to Store Manager'} value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value }, ['name'])} /></div>
            {err('name') ? <div className="err">{errs.name}</div> : <div className="hint">{editing ? <>Rule ID <b>#{rule.id}</b> and the new version are shown separately from the name.</> : <>The rule ID and version are added automatically as separate badges.</>}</div>}
          </div>
          <div className="field"><label>Module</label><Dropdown value={d.module} options={MODULES.map((m) => ({ value: m, label: m }))} onChange={(module) => set({ module })} disabled={editing} /><div className="hint">{editing ? 'Module is locked when editing because it decides the available conditions.' : 'Reviews is the first module. Others appear here as they are added.'}</div></div>
          <div className={'field ' + (err('scope') ? 'bad' : '')}><label>Locations</label>
            <button type="button" className="locbtn" onClick={() => { setShowLoc(true); }}><span style={{ color: nL ? 'inherit' : 'var(--muted)' }}>{nL ? `${nL} Locations Selected` : 'Select locations'}</span><span className="sp" /><span className="tag green">{d.scope.all ? 'All' : 'Edit'}</span></button>
            {err('scope') && <div className="err">{errs.scope}</div>}
            {nL > 0 && <div className="hint">{scopeIsDynamic(d.scope) && !scopeHasFixed(d.scope) ? 'Dynamic: locations added to the selected group later are included automatically.' : scopeHasFixed(d.scope) && !scopeIsDynamic(d.scope) ? 'Fixed: only the individual stores you picked.' : 'Mixed: group selections are dynamic, individually picked stores are fixed.'}</div>}
          </div>
        </>}

        {step === 2 && <>
          <div className="field"><label>Review type</label><Seg options={[['All', 'All'], ['Rating Only', 'Rating Only'], ['With Review Text', 'With Review Text']]} value={c.reviewType} onChange={(reviewType) => setC({ reviewType, sentiments: reviewType === 'Rating Only' ? [] : c.sentiments, attributes: reviewType === 'Rating Only' ? [] : (c.attributes || []) }, [])} /></div>
          <div className={'field ' + (err('ratings') ? 'bad' : '')}><label>Ratings</label><Pills multi options={[1, 2, 3, 4, 5]} value={c.ratings} onChange={(ratings) => setC({ ratings }, ['ratings'])} render={(n) => '★'.repeat(n)} />{err('ratings') && <div className="err">{errs.ratings}</div>}</div>
          {c.reviewType !== 'Rating Only' && <div className={'field ' + (err('sentiments') ? 'bad' : '')}><label>Sentiment {c.reviewType === 'All' && <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>}</label><Pills multi options={['Positive', 'Neutral', 'Negative']} value={c.sentiments} onChange={(sentiments) => setC({ sentiments }, ['sentiments'])} />
            {c.reviewType === 'All' && <div className="hint">Sentiment applies to reviews with text only. Rating-only reviews with the selected ratings will also create tickets.</div>}{err('sentiments') && <div className="err">{errs.sentiments}</div>}</div>}
          {c.reviewType !== 'Rating Only' && <div className="field"><label>Review attributes <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><Pills multi options={ATTRIBUTES} value={c.attributes || []} onChange={(attributes) => setC({ attributes })} />
            <div className="hint">{(c.attributes || []).length ? `Only reviews that mention ${c.attributes.join(' or ')}.` : 'Any attribute. Pick one or more to narrow it down. This list is pulled from the attributes configured for your account in Reputation Management.'}</div></div>}
          <div className="field"><label>Source <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><Pills multi options={SOURCES} value={c.sources} onChange={(sources) => setC({ sources })} /><div className="hint">{c.sources.length ? `Only reviews from ${c.sources.join(', ')}.` : 'All sources. Pick one or more to narrow it down. Lists the platforms connected in Reputation Management.'}</div></div>
          <div className="matchbox">
            <div className="mt">This rule will create a ticket for a review that matches all of these:</div>
            <div className="mrow"><span>Review type</span><b>{c.reviewType === 'All' ? 'All reviews (with or without text)' : c.reviewType === 'Rating Only' ? 'Rating only (no text)' : 'With review text'}</b></div>
            <div className="mrow"><span>Rating</span><b>{c.ratings.length ? [...c.ratings].sort().map((n) => n + '★').join(' or ') : <i className="muted">Select at least one</i>}</b></div>
            {c.reviewType !== 'Rating Only' && <div className="mrow"><span>Sentiment</span><b>{c.sentiments.length ? c.sentiments.join(' or ') : 'Any'}</b></div>}
            {c.reviewType !== 'Rating Only' && <div className="mrow"><span>Review attributes</span><b>{(c.attributes || []).length ? c.attributes.join(' or ') : 'Any'}</b></div>}
            <div className="mrow"><span>Source</span><b>{c.sources.length ? c.sources.join(' or ') : 'Any source'}</b></div>
            <div className="mnote">Each row must match (AND). Within a row, any one value is enough (OR).</div>
          </div>
        </>}

        {step === 3 && <>
          <div className="field"><label>Assign to</label><Seg options={[['role', 'User Role'], ['user', 'User Name']]} value={d.assignee.type} onChange={(type) => set({ assignee: { type, id: '' } })} /></div>
          <div className={'field ' + (err('assignee') ? 'bad' : '')}>
            {d.assignee.type === 'role'
              ? <><Dropdown value={d.assignee.id} options={roleCounts} placeholder="Select a role" onChange={(id) => set({ assignee: { type: 'role', id } }, ['assignee'])} /><div className="hint">Each ticket goes to the least-loaded eligible user. <a onClick={() => setShowHow(true)}>How it works</a></div></>
              : <Dropdown searchable value={d.assignee.id} options={userOpts} placeholder="Select a user" onChange={(id) => set({ assignee: { type: 'user', id } }, ['assignee'])} />}
            {err('assignee') && <div className="err">{errs.assignee}</div>}
          </div>
          <div className={'field ' + (err('comment') ? 'bad' : '')}><label>Comment</label>
            <textarea value={d.comment} maxLength={600} onChange={(e) => set({ comment: e.target.value }, ['comment'])} placeholder="Write the note the assignee will see on the ticket" />
            <div style={{ display: 'flex' }}>{err('comment') ? <div className="err">{errs.comment}</div> : <div className="hint">The ticket always carries the review text and a link to the review.</div>}<span style={{ flex: 1 }} /><span className="hint" style={{ color: d.comment.length > 500 ? 'var(--red)' : undefined }}>{d.comment.length}/500</span></div>
          </div>
          <div className="row2">
            <div className="field"><label>Priority</label><Pills options={['High', 'Medium', 'Low']} value={d.priority} onChange={(priority) => set({ priority })} /><div className="hint">Mark this ticket as high priority when immediate attention is required to close it.</div></div>
            <div className={'field ' + (err('due') ? 'bad' : '')}><label>Due date</label>
              <div className="dueRow">
                <NumInput value={d.due.value} placeholder="e.g. 24" onChange={(value) => set({ due: { ...d.due, value } }, ['due'])} aria-label="Due in hours" />
                <select value={d.due.unit} onChange={(e) => set({ due: { ...d.due, unit: e.target.value } }, ['due'])}>{DUE_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}</select>
              </div>
              {err('due') ? <div className="err">{errs.due}</div> : <div className="hint">{d.due.unit === 'business' ? 'Business hours skip Saturday and Sunday; public holidays are not excluded. Counted from the moment the ticket is created.' : 'Every hour counts, including weekends. Counted from the moment the ticket is created.'}</div>}</div>
          </div>
        </>}

        {step === 4 && <>
          <div className="mnote">This email goes to the assignee every time this rule creates a ticket.</div>
          <SectionCard title="Assignment email" sub="What the assignee receives.">
            <EmailFields d={d.email} set={(patch, keys = []) => set({ email: { ...d.email, ...patch } }, keys.map((k) => 'email.' + k))} errs={Object.fromEntries(Object.entries(errs).filter(([k]) => touched['email.' + k]))} vars={VARS_ASSIGNMENT}
              toText={d.assignee.type === 'role' ? `The user the ticket is assigned to, from the ${d.assignee.id} role` : (s.users.find((u) => u.id === d.assignee.id)?.name || 'The assignee')}
              toHint="Fixed. It always goes to the person the ticket is assigned to." />
          </SectionCard>
        </>}

        {step === 5 && preview && <>
          <div className="sumbox">
            <div className="srow"><span className="sl">When a review arrives</span><div className="sv"><ConditionList c={c} /><a className="elink" onClick={() => setStep(2)}>Edit</a></div></div>
            <div className="srow"><span className="sl">At</span><div className="sv"><b>{nL} location{nL === 1 ? '' : 's'}</b><a className="elink" onClick={() => setStep(1)}>Edit</a></div></div>
            <div className="srow"><span className="sl">Create a ticket</span><div className="sv"><b>{d.priority} priority</b><span className="muted"> · due within </span><b>{dueText(d.due)}</b><a className="elink" onClick={() => setStep(3)}>Edit</a></div></div>
            <div className="srow"><span className="sl">Assign it to</span><div className="sv"><b>{assigneeText(d.assignee, s.users)}</b><a className="elink" onClick={() => setStep(3)}>Edit</a></div></div>
            <div className="srow"><span className="sl">Email the assignee</span><div className="sv"><b>{renderTemplate(d.email.subject, varsFor(SAMPLE_TICKET, { name: 'the assignee' }, null, s.locations))}</b><a className="elink" onClick={() => setStep(4)}>Edit</a></div></div>
          </div>
          <div style={{ marginTop: 16 }}><MailPreview d={d.email} toName={d.assignee.type === 'user' ? (s.users.find((u) => u.id === d.assignee.id)?.name || 'Assignee') : (preview.eligible[0]?.user.name || 'Assignee')} title="Assignment email preview" sub="Sent to the assignee when a ticket is created." /></div>
          <div className="banner green" style={{ marginTop: 16 }}>ⓘ <span><b>{d.name}</b> starts working from the time it is activated. Every matching review that comes in after that creates a ticket.</span></div>
          {d.assignee.type === 'role' && preview.eligible.length === 0 && <div className="banner amber" style={{ marginTop: 20 }}>⚠ No active user in this role covers the selected locations. Tickets would be created unassigned.</div>}
          {!editing ? <label className="check" style={{ marginTop: 22 }}><input type="checkbox" checked={d.startPaused} onChange={(e) => set({ startPaused: e.target.checked })} /> Start in Paused state</label> : <div className="hint" style={{ marginTop: 22 }}>The new version keeps the current status ({curVer.status}).</div>}
        </>}
      </div>

      {showLoc && <LocationFilter scope={d.scope} onClose={() => setShowLoc(false)} onApply={(scope) => { set({ scope }, ['scope']); setShowLoc(false); }} />}
      {showHow && <HowItWorks onClose={() => setShowHow(false)} />}
      {pop === 'discard' && <Popup title="Discard changes?" cancel="Keep editing" onCancel={() => setPop(null)} confirm="Discard" danger onConfirm={onClose}>The rule has not been saved. If you leave now, your changes will be lost.</Popup>}
      {pop === 'unavailable' && <Popup title="Assignee unavailable" cancel={null} confirm="Ok" onConfirm={() => { set({ assignee: { type: 'user', id: '' } }, ['assignee']); setPop(null); }}>The selected user is no longer active. Choose another user or a role.</Popup>}
      {pop === 'overlap' && <Popup title="Overlapping rule" cancel="Back" onCancel={() => setPop(null)} confirm="Continue" onConfirm={() => { setPop(null); afterOverlap(); }}>This rule matches some of the same reviews as “{latest(preview.overlaps[0].rule).name} (#{preview.overlaps[0].rule.id})”. A review that matches both creates one ticket, using the rule with the higher priority; if equal, the older rule.</Popup>}
      {pop === 'confirm' && <Popup title="Edit Rule" onCancel={() => setPop(null)} confirm="Confirm" onConfirm={() => { setPop(null); save(); }}>Editing a rule will result in tickets being sent only according to the updated automation rule. The rule ID will be updated to a new version. No tickets will be generated based on the previous version.{curVer?.status === 'Paused' && <> <b>This rule is paused, so the new version will also be paused.</b></>}</Popup>}
      {pop === 'fail' && <Popup icon="bad" title="Could not save" onCancel={() => setPop(null)} confirm="Retry" onConfirm={() => { setPop(null); save(); }}>Something went wrong and the rule was not saved. Try again.</Popup>}
      {pop === 'done' && done && <Popup icon="ok" title={editing ? 'Edit Rule' : 'Create Rule'} cancel="Ok" onCancel={onClose} confirm="View Rule" onConfirm={() => { onClose(); onView && onView(done.name); }}>{editing ? <>New version saved: “{done.name}, #{done.id}, V{done.ver}”. The previous version is now Stopped.</> : <>Rule created successfully. “{done.name}, #{done.id}, V{done.ver}”{d.startPaused ? '. It is currently paused.' : '.'}</>}</Popup>}
    </Modal>
  );
}
