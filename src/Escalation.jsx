import React, { useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { Popup, Seg, NumInput } from './ui.jsx';
import { EmailFields, MailPreview, SectionCard, EditorShell, SummaryRows } from './Notify.jsx';
import { emptyLevel, validateLevel, levelWhenText, levelToText, VARS_ESCALATION, DAY_KINDS } from './schedule.js';
import { ROLES } from './data.js';

const MAX_LEVELS = 5;
const STEPS = ['Recipient and timing', 'Email', 'Preview'];

function LevelEditor({ index, onClose }) {      // index null = add a new level at the end
  const { state: s, dispatch } = useStore();
  const levels = s.escalation.levels;
  const n = (index == null ? levels.length : index) + 1;
  const editing = index != null ? levels[index] : null;
  const init = useMemo(() => editing ? { ...emptyLevel(), ...JSON.parse(JSON.stringify(editing)) } : emptyLevel(), []);
  const [d, setD] = useState(init);
  const [touched, setTouched] = useState({});
  const [askDiscard, setAskDiscard] = useState(false);
  const [step, setStep] = useState(1);
  const errs = validateLevel(d);
  const set = (patch, keys = []) => { setD((x) => ({ ...x, ...patch })); setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) })); };
  const shown = Object.fromEntries(Object.entries(errs).filter(([k]) => touched[k]));
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  const close = () => (dirty ? setAskDiscard(true) : onClose());
  const valid = Object.keys(errs).length === 0;
  const save = () => { dispatch({ type: 'SAVE_LEVEL', draft: d, index }); dispatch({ type: 'TOAST', msg: `Level ${n} ${editing ? 'updated' : 'created'}` }); onClose(); };
  const roleCount = (r) => s.users.filter((u) => u.active && u.role === r).length;
  const users = s.users.filter((u) => u.active || u.id === d.recipient);
  const hOk = Number.isInteger(Number(d.hours)) && Number(d.hours) >= 1 && Number(d.hours) <= 720;
  const hv = Number(d.hours);
  const kind = d.dayType === 'business' ? 'business' : 'calendar';
  const note = `Goes out ${Number.isInteger(hv) && hv >= 1 ? hv : '…'} ${kind} hour${hv === 1 ? '' : 's'} ${n === 1 ? 'after the last reminder that was sent, or after the due date if no reminder was sent' : `after Level ${n - 1} is sent, not after the due date`}. ${kind === 'business' ? 'Business hours skip Saturday and Sunday; public holidays are not excluded.' : 'Every hour counts, including weekends.'} Stops once the ticket is Resolved or Closed.`;
  const toName = d.userType === 'user' ? s.users.find((u) => u.id === d.recipient)?.name : [...s.users].filter((u) => u.active && u.role === d.recipient).sort((a, b) => a.name.localeCompare(b.name))[0]?.name;
  const timingKeys = ['recipient', 'hours'];
  const ok1 = !timingKeys.some((k) => errs[k]), ok2 = !Object.keys(errs).some((k) => !timingKeys.includes(k));
  const reveal = (keys) => setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
  const title = `${editing ? 'Edit' : 'Create'} Level ${n}`;
  return (
    <>
      <EditorShell title={title} sub={n === 1 ? 'Who is told first when a ticket goes past its due date.' : `Who is told next if the ticket is still open after Level ${n - 1}.`} steps={STEPS} step={step}
        setStep={(k) => (k > step && step === 1 && !ok1 ? reveal(timingKeys) : setStep(k))} onClose={close}
        canNext={step === 1 ? ok1 : ok2} finalLabel={editing ? 'Save Level' : 'Create Level'} onFinish={save}>
        {step === 1 && (
          <SectionCard title="Recipient and timing" sub="Who is emailed, and when.">
            <div className="stack">
              <div className="field"><label>Escalate to</label>
                <Seg options={[['role', 'User Role'], ['user', 'User Name']]} value={d.userType} onChange={(userType) => set({ userType, recipient: '' })} /></div>
              <div className={'field ' + (shown.recipient ? 'bad' : '')}><label>{d.userType === 'role' ? 'User Role' : 'User Name'}</label>
                <select value={d.recipient} onChange={(e) => set({ recipient: e.target.value }, ['recipient'])}>
                  <option value="" disabled>{d.userType === 'role' ? 'Select a role' : 'Select a user'}</option>
                  {d.userType === 'role' ? ROLES.map((r) => <option key={r} value={r}>{r} ({roleCount(r)})</option>) : users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}{u.active ? '' : ' (inactive)'}</option>)}
                </select>
                {shown.recipient && <div className="err">{shown.recipient}</div>}</div>
              <div className={'field ' + (shown.hours ? 'bad' : '')}><label>{n === 1 ? 'Hours after the last reminder' : `Hours after Level ${n - 1}`}</label>
                <div className="dueRow">
                  <NumInput value={d.hours} placeholder="e.g. 4" onChange={(hours) => set({ hours }, ['hours'])} aria-label="Hours" />
                  <select value={d.dayType} onChange={(e) => set({ dayType: e.target.value })}>{DAY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
                </div>
                {shown.hours && <div className="err">{shown.hours}</div>}</div>
            </div>
            <div className="enote">{note}</div>
          </SectionCard>)}
        {step === 2 && (
          <SectionCard title="Email" sub="What they receive." className="emailcard">
            <EmailFields d={d} set={set} errs={shown} vars={VARS_ESCALATION}
              toText={d.recipient ? levelToText(d, s.users) : (d.userType === 'role' ? 'Select a role above' : 'Select a user above')}
              toHint="Fixed by your choice in the Timing step. The To address cannot be edited here." />
          </SectionCard>)}
        {step === 3 && <>
          <SummaryRows rows={[['Level', <b>Level {n}</b>], ['Goes out', <b>{levelWhenText(d, n)}</b>], ['To', <b>{levelToText(d, s.users)}</b>]]} />
          <MailPreview d={d} toName={toName || 'Recipient'} extra={{ escalation_level: String(n), overdue_by: '4 hours' }} />
        </>}
      </EditorShell>
      {askDiscard && <Popup title="Discard changes?" onCancel={() => setAskDiscard(false)} cancel="Keep editing" confirm="Discard" onConfirm={onClose}>The level has not been saved. If you leave now, your changes will be lost.</Popup>}
    </>
  );
}

export default function Escalation() {
  const { state: s, dispatch } = useStore();
  const [edit, setEdit] = useState(undefined);   // undefined closed, null = add, number = edit index
  const [rm, setRm] = useState(null);
  const levels = s.escalation.levels, can = s.demo.canManage;
  const remove = () => { dispatch({ type: 'REMOVE_LEVEL', index: rm }); dispatch({ type: 'TOAST', msg: `Level ${rm + 1} deleted` }); setRm(null); };
  return (
    <div>
      <div className="page-h"><h1>Escalation</h1><span className="sp" />{can && levels.length < MAX_LEVELS && <button className="btn primary" onClick={() => setEdit(null)}>＋ Create Level {levels.length + 1}</button>}</div>
      <div className="banner">ⓘ <span>If a ticket is still open after its due date, Escalation emails the next person up, level by level. Level 1 goes out after the last reminder that was sent, or after the due date if none was sent. It stops once the ticket is Resolved, Closed or Junked. It only notifies: the ticket stays with its assignee.</span></div>
      {levels.length === 0 ? (
        <div className="empty"><h3 style={{ marginTop: 0 }}>No escalation levels yet</h3><p className="muted" style={{ maxWidth: 520, margin: '8px auto' }}>Create Level 1 to choose who is told when a ticket goes past its due date, and when.</p>{can && <button className="btn primary" onClick={() => setEdit(null)}>＋ Create Level 1</button>}</div>
      ) : (
        <div className="levels">
          {levels.map((lv, i) => (
            <React.Fragment key={lv.id}>
              {i > 0 && <div className="conn">↓ then {levelWhenText(lv, i + 1)}</div>}
              {i === 0 && <div className="conn first">Ticket is past its due date and still open, and the last reminder has been sent</div>}
              <div className="lvl">
                <div className="lvlh"><span className="lvlno">Level {i + 1}</span><b>{lv.userType === 'role' ? `${lv.recipient} (role)` : s.users.find((u) => u.id === lv.recipient)?.name || 'Unknown user'}</b><span className="sp" />{can && <span><a className="elink" onClick={() => setEdit(i)}>Edit</a>{' · '}<a className="elink danger-link" onClick={() => setRm(i)}>Delete</a></span>}</div>
                <div className="rgrid g3" style={{ gridTemplateColumns: '1fr 2fr' }}>
                  <div className="kv"><label>When</label><div>{levelWhenText(lv, i + 1)}</div></div>
                  <div className="kv"><label>Subject</label><div className="muted">{lv.subject}</div></div>
                </div>
              </div>
            </React.Fragment>
          ))}
          <div className="conn last">After the last level, nothing more is sent.</div>
        </div>
      )}
      {edit !== undefined && <LevelEditor index={edit} onClose={() => setEdit(undefined)} />}
      {rm != null && <Popup title={`Delete Level ${rm + 1}`} onCancel={() => setRm(null)} confirm="Delete" danger onConfirm={remove}>{rm + 1 < levels.length ? `Level ${rm + 2} becomes Level ${rm + 1}. ` : ''}Tickets that already received this level are not affected. Levels after it are timed from the level before.</Popup>}
    </div>
  );
}
