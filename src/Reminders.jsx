import React, { useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { Popup, Seg, NumInput } from './ui.jsx';
import { EmailFields, MailPreview, SectionCard, EditorShell, SummaryRows } from './Notify.jsx';
import { emptyReminder, validateReminder, reminderWhenText, VARS_REMINDER, DAY_KINDS } from './schedule.js';

const STEPS = ['Timing', 'Email', 'Preview'];
function Editor({ editing, onClose }) {
  const { state: s, dispatch } = useStore();
  const init = useMemo(() => editing ? { ...emptyReminder(), ...JSON.parse(JSON.stringify(editing)) } : emptyReminder(), []);
  const [d, setD] = useState(init);
  const [touched, setTouched] = useState({});
  const [askDiscard, setAskDiscard] = useState(false);
  const [step, setStep] = useState(1);
  const errs = validateReminder(d, s.reminders, editing?.id);
  const set = (patch, keys = []) => { setD((x) => ({ ...x, ...patch })); setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) })); };
  const shown = Object.fromEntries(Object.entries(errs).filter(([k]) => touched[k]));
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  const close = () => (dirty ? setAskDiscard(true) : onClose());
  const valid = Object.keys(errs).length === 0;
  const save = () => {
    dispatch({ type: 'SAVE_REMINDER', draft: d, editingId: editing?.id });
    dispatch({ type: 'TOAST', msg: editing ? `“${d.name.trim()}” updated` : `“${d.name.trim()}” created` });
    onClose();
  };
  const v = Number(d.value);
  const kind = d.dayType === 'business' ? 'business' : 'calendar';
  const note = d.when === 'on' ? 'Goes out at each ticket’s due date.' : `Goes out ${Number.isInteger(v) && v >= 1 ? v : '…'} ${kind} hour${v === 1 ? '' : 's'} ${d.when} each ticket’s due date. ${kind === 'business' ? 'Business hours skip Saturday and Sunday; public holidays are not excluded.' : 'Every hour counts, including weekends.'}`;
  const timingKeys = ['name', 'value'];
  const stepErr = (list) => list.some((k) => errs[k]);
  const ok1 = !stepErr(timingKeys), ok2 = !Object.keys(errs).some((k) => !timingKeys.includes(k));
  const reveal = (keys) => setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
  return (
    <>
      <EditorShell title={editing ? 'Edit Reminder' : 'Create Reminder'} sub="Email the assignee about a ticket’s due date." steps={STEPS} step={step}
        setStep={(n) => (n > step && step === 1 && !ok1 ? reveal(timingKeys) : setStep(n))} onClose={close}
        canNext={step === 1 ? ok1 : ok2} finalLabel={editing ? 'Save Reminder' : 'Create Reminder'} onFinish={save}>
        {step === 1 && (
          <SectionCard title="Timing" sub="Counted from each ticket’s due date.">
            <div className="stack">
              <div className={'field ' + (shown.name ? 'bad' : '')}><label>Reminder name</label>
                <input type="text" value={d.name} maxLength={80} placeholder="e.g. Due soon" onChange={(e) => set({ name: e.target.value }, ['name'])} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
                {shown.name && <div className="err">{shown.name}</div>}</div>
              <div className="field"><label>Send</label>
                <Seg options={[['before', 'Before due date'], ['on', 'On due date'], ['after', 'After due date']]} value={d.when} onChange={(when) => set({ when })} /></div>
              {d.when !== 'on' && (
                <div className={'field ' + (shown.value ? 'bad' : '')}><label>Hours {d.when} the due date</label>
                  <div className="dueRow">
                    <NumInput value={d.value} placeholder="e.g. 24" onChange={(value) => set({ value }, ['value'])} aria-label="Hours" />
                    <select value={d.dayType} onChange={(e) => set({ dayType: e.target.value })}>{DAY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
                  </div>
                  {shown.value && <div className="err">{shown.value}</div>}</div>)}
              <div className="enote">{note}</div>
            </div>
          </SectionCard>)}
        {step === 2 && (
          <SectionCard title="Email" sub="What the assignee receives." className="emailcard">
            <EmailFields d={d} set={set} errs={shown} vars={VARS_REMINDER}
              toText="The person the ticket is assigned to at the time of sending"
              toHint="Fixed. Only the ticket holder: the first assignee, or the new assignee after a reassignment. Never the people in Escalation. An unassigned ticket sends nothing." />
          </SectionCard>)}
        {step === 3 && <>
          <SummaryRows rows={[['Reminder', <b>{d.name.trim()}</b>], ['Goes out', <b>{reminderWhenText(d)}</b>], ['To', <b>The person the ticket is assigned to at the time of sending</b>]]} />
          <MailPreview d={d} toName="Anita Raman" />
        </>}
      </EditorShell>
      {askDiscard && <Popup title="Discard changes?" onCancel={() => setAskDiscard(false)} cancel="Keep editing" confirm="Discard" onConfirm={onClose}>The reminder has not been saved. If you leave now, your changes will be lost.</Popup>}
    </>
  );
}

export default function Reminders() {
  const { state: s, dispatch } = useStore();
  const [edit, setEdit] = useState(null);       // {} = new, or a reminder
  const [pausing, setPausing] = useState(null);
  const [del, setDel] = useState(null);
  const toggle = (r) => { dispatch({ type: 'TOGGLE_REMINDER', id: r.id }); dispatch({ type: 'TOAST', msg: `“${r.name}” ${r.active ? 'paused' : 'resumed'}` }); setPausing(null); };
  const remove = () => { dispatch({ type: 'DELETE_REMINDER', id: del.id }); dispatch({ type: 'TOAST', msg: `“${del.name}” deleted` }); setDel(null); };
  const can = s.demo.canManage;
  return (
    <div>
      <div className="page-h"><h1>Reminders</h1><span className="sp" />{can && <button className="btn primary" onClick={() => setEdit({})}>＋ Create Reminder</button>}</div>
      <div className="banner">ⓘ <span>Reminders email the assignee about a ticket’s due date. Every reminder you turn on runs for each open ticket that has a due date, and goes only to whoever holds the ticket at that moment (the first assignee, or the new one after a reassignment), never to the people in Escalation. Changes apply from the time you save; nothing is sent late for the past.</span></div>
      {s.reminders.length === 0 ? (
        <div className="empty"><h3 style={{ marginTop: 0 }}>No reminders yet</h3><p className="muted">Create a reminder to email assignees before, on or after a ticket’s due date.</p>{can && <button className="btn primary" onClick={() => setEdit({})}>＋ Create Reminder</button>}</div>
      ) : (
        <div className="tablewrap"><table className="t"><thead><tr><th>Reminder</th><th>When</th><th>Subject</th><th>Status</th><th /></tr></thead>
          <tbody>{s.reminders.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td>{reminderWhenText(r)}</td>
              <td style={{ maxWidth: 340 }} className="muted">{r.subject}</td>
              <td>{r.active ? <span className="tag green">Active</span> : <span className="tag amber">Paused</span>}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{can && <><a className="elink" onClick={() => setEdit(r)}>Edit</a>{' · '}<a className="elink" onClick={() => setPausing(r)}>{r.active ? 'Pause' : 'Resume'}</a>{' · '}<a className="elink danger-link" onClick={() => setDel(r)}>Delete</a></>}</td>
            </tr>))}</tbody></table></div>
      )}
      {edit && <Editor editing={edit.id ? edit : null} onClose={() => setEdit(null)} />}
      {pausing?.active && <Popup title="Pause Reminder" onCancel={() => setPausing(null)} confirm="Pause" onConfirm={() => toggle(pausing)}>“{pausing.name}” will stop going out while it is paused. Reminders that fall during the pause will not be sent after you resume.</Popup>}
      {pausing && !pausing.active && <Popup icon="ok" title="Resume Reminder" onCancel={() => setPausing(null)} confirm="Resume" onConfirm={() => toggle(pausing)}>“{pausing.name}” will go out again for reminders that fall from now on. Reminders that fell during the pause will not be sent.</Popup>}
      {del && <Popup title="Delete Reminder" danger onCancel={() => setDel(null)} confirm="Delete" onConfirm={remove}>“{del.name}” will be deleted and will no longer go out. Emails already sent are not affected. This cannot be undone.</Popup>}
    </div>
  );
}
