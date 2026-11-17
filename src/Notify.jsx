// Pieces shared by Reminders and Escalation: email template fields, preview, activity log, prototype clock.
import React, { useRef, useState } from 'react';
import { useStore } from './store.jsx';
import { Modal } from './ui.jsx';
import { renderTemplate, varsFor, SAMPLE_TICKET } from './schedule.js';
import { fmtDT } from './engine.js';

export const dayName = (ms) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short' });
export const fmtWDT = (ms) => `${dayName(ms)} ${fmtDT(ms)}`;

export function SectionCard({ title, sub, children, className = '' }) {
  return (
    <section className={'ecard ' + className}>
      <div className="ecardh"><h3>{title}</h3>{sub && <div className="esub">{sub}</div>}</div>
      {children}
    </section>
  );
}

export function EditorHeader({ title, sub, onClose }) {
  return (
    <div className="mh ehead">
      <div style={{ flex: 1 }}><h2>{title}</h2>{sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}</div>
      <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
    </div>
  );
}

// Three-step editor shell used by Reminders and Escalation: Timing, Email, Preview
export function EditorShell({ title, sub, steps, step, setStep, onClose, canNext, finalLabel, onFinish, children }) {
  const last = step === steps.length;
  return (
    <Modal title={title} size="lg" onClose={onClose}
      header={<EditorHeader title={title} sub={sub} onClose={onClose} />}
      footer={<div className="mf"><button className="btn" onClick={onClose}>Cancel</button><span className="sp" />{step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}{last ? <button className="btn primary" onClick={onFinish}>{finalLabel}</button> : <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>}</div>}>
      <div className="stepper">{steps.map((l, i) => <React.Fragment key={l}>{i > 0 && <div className="bar" />}<div className={'st ' + (step === i + 1 ? 'on' : step > i + 1 ? 'done' : '')}><span className="n">{step > i + 1 ? '✓' : i + 1}</span>{l}</div></React.Fragment>)}</div>
      <div className="mb editor">{children}</div>
    </Modal>
  );
}

export function SummaryRows({ rows }) {
  return <div className="sumbox">{rows.map(([l, v]) => <div className="srow" key={l}><span className="sl">{l}</span><div className="sv">{v}</div></div>)}</div>;
}

export function EmailFields({ d, set, errs, vars, toText, toHint }) {
  const subj = useRef(null), body = useRef(null), last = useRef('body');
  const insert = (key) => {
    const field = last.current, el = (field === 'subject' ? subj : body).current;
    const token = `{{${key}}}`;
    const a = el.selectionStart ?? d[field].length, b = el.selectionEnd ?? a;
    set({ [field]: d[field].slice(0, a) + token + d[field].slice(b) }, [field]);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + token.length, a + token.length); });
  };
  const bad = (k) => (errs[k] ? 'bad' : '');
  return (
    <div className="emailbox">
      <div className="field"><label>To</label>
        <div className="locked"><span aria-hidden>🔒</span><span>{toText}</span></div>
        <div className="hint">{toHint}</div></div>
      <div className="row3">
        <div className={'field ' + bad('cc')}><label>CC <span className="opt">optional</span></label><input type="text" value={d.cc} onChange={(e) => set({ cc: e.target.value }, ['cc'])} placeholder="name@company.com" />{errs.cc && <div className="err">{errs.cc}</div>}</div>
        <div className={'field ' + bad('bcc')}><label>BCC <span className="opt">optional</span></label><input type="text" value={d.bcc} onChange={(e) => set({ bcc: e.target.value }, ['bcc'])} placeholder="name@company.com" />{errs.bcc && <div className="err">{errs.bcc}</div>}</div>
        <div className={'field ' + bad('replyTo')}><label>Reply to <span className="opt">optional</span></label><input type="text" value={d.replyTo} onChange={(e) => set({ replyTo: e.target.value }, ['replyTo'])} placeholder="support@company.com" />{errs.replyTo && <div className="err">{errs.replyTo}</div>}</div>
      </div>
      <div className={'field ' + bad('subject')}><label>Subject</label>
        <input type="text" ref={subj} value={d.subject} onFocus={() => (last.current = 'subject')} onChange={(e) => set({ subject: e.target.value }, ['subject'])} />
        {errs.subject && <div className="err">{errs.subject}</div>}</div>
      <div className="vbar"><span className="vlabel">Insert variable</span>
        <div className="vchips">{vars.map(([k, l]) => <button type="button" key={k} className="vchip" onClick={() => insert(k)} title={`{{${k}}}`}>{l}</button>)}</div></div>
      <div className={'field grow ' + bad('body')}><label>Body</label>
        <textarea ref={body} value={d.body} onFocus={() => (last.current = 'body')} onChange={(e) => set({ body: e.target.value }, ['body'])} />
        <div style={{ display: 'flex' }}>{errs.body ? <div className="err">{errs.body}</div> : <div className="hint">Variables are replaced for each ticket when the email is sent.</div>}<span style={{ flex: 1 }} /><span className="hint">{d.body.length}/2000</span></div></div>
    </div>
  );
}

// Live preview of the email with a sample ticket
export function MailPreview({ d, toName = 'Anita Raman', extra, title = 'Email preview', sub = 'How the email will look.' }) {
  const { state: s } = useStore();
  const v = varsFor(SAMPLE_TICKET, { name: toName }, { name: 'Anita Raman' }, s.locations, extra || {});
  return (
    <section className="ecard" aria-label="Email preview">
      <div className="ecardh"><h3>{title}</h3><div className="esub">{sub}</div></div>
      <div className="mail">
        <div className="mailmeta">
          <div><b>To</b><span>{toName}</span></div>
          {d.cc.trim() && <div><b>CC</b><span>{d.cc}</span></div>}
          {d.bcc.trim() && <div><b>BCC</b><span>{d.bcc}</span></div>}
          {d.replyTo.trim() && <div><b>Reply to</b><span>{d.replyTo}</span></div>}
        </div>
        <div className="mailsub">{renderTemplate(d.subject, v) || <span className="muted">No subject</span>}</div>
        <pre className="mailbody">{renderTemplate(d.body, v)}</pre>
      </div>
    </section>
  );
}

const KIND_TITLE = { reminder: 'Reminder email', escalation: 'Escalation email', assignment: 'Assignment email' };
export const KIND_LABEL = { reminder: 'Reminder', escalation: 'Escalation', assignment: 'Assignment' };
export function EmailModal({ entry, onClose }) {
  return (
    <Modal title={KIND_TITLE[entry.kind]} onClose={onClose} footer={<div className="mf"><span className="sp" /><button className="btn" onClick={onClose}>Close</button></div>}>
      <div className="mb">
        <div className="mailprev" style={{ marginTop: 0 }}>
          <div className="mrow"><b>Sent</b> {fmtWDT(entry.at)}</div>
          <div className="mrow"><b>To</b> {entry.to.name} &lt;{entry.to.email}&gt;</div>
          {entry.cc && <div className="mrow"><b>CC</b> {entry.cc}</div>}
          {entry.replyTo && <div className="mrow"><b>Reply to</b> {entry.replyTo}</div>}
          {entry.bcc && <div className="mrow"><b>BCC</b> {entry.bcc}</div>}
          <div className="mrow"><b>Subject</b> {entry.subject}</div>
          <pre>{entry.body}</pre>
        </div>
      </div>
    </Modal>
  );
}

export function ClockBar() {
  const { state: s, dispatch } = useStore();
  const go = (ms) => dispatch({ type: 'ADVANCE', ms });
  return (
    <div className="clockbar">
      <div><b>Prototype time:</b> {fmtWDT(s.now)}<div className="muted" style={{ fontSize: 12.5 }}>Move time forward to see due reminders and escalations go out. Not part of the product.</div></div>
      <span className="sp" />
      {[['+1 hour', 3600000], ['+4 hours', 4 * 3600000], ['+1 day', 86400000], ['+3 days', 3 * 86400000], ['+7 days', 7 * 86400000]].map(([l, ms]) => <button key={l} className="btn sm" onClick={() => go(ms)}>{l}</button>)}
    </div>
  );
}

export function ActivityLog({ kind }) {
  const { state: s } = useStore();
  const [view, setView] = useState(null);
  const [limit, setLimit] = useState(30);
  const rows = s.sent.filter((e) => kind === 'all' || e.kind === kind).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
  return (
    <div>
      <ClockBar />
      <div className="tablewrap"><table className="t"><thead><tr><th>Time</th><th>Ticket</th><th>{kind === 'all' ? 'Email' : kind === 'reminder' ? 'Reminder' : 'Level'}</th><th>To</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.slice(0, limit).map((e) => (
            <tr key={e.id}>
              <td>{fmtWDT(e.at)}</td>
              <td><b>{e.ticketId}</b></td>
              <td>{kind === 'all' ? KIND_LABEL[e.kind] + ' · ' : ''}{e.refName}</td>
              <td>{e.to ? <>{e.to.name}<div className="muted" style={{ fontSize: 12 }}>{e.to.email}</div></> : <span className="muted">—</span>}</td>
              <td>{e.status === 'Sent' ? <span className="tag green">Sent</span> : <><span className="tag red">Skipped</span><div className="muted" style={{ fontSize: 12 }}>{e.reason}</div></>}</td>
              <td>{e.status === 'Sent' && <a className="elink" onClick={() => setView(e)}>View email</a>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: 30 }}>Nothing sent yet. Move the prototype clock forward to see emails go out.</td></tr>}
        </tbody></table></div>
      {rows.length > limit && <button className="btn" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 30)}>Show more ({rows.length - limit})</button>}
      {view && <EmailModal entry={view} onClose={() => setView(null)} />}
    </div>
  );
}
