import React, { useState } from 'react';
import { useStore } from './store.jsx';
import { Modal, Seg, Dropdown, Pills, prioTag } from './ui.jsx';
import { ATTRIBUTES } from './data.js';
import { fmtDT, dueText } from './engine.js';
import { fmtWDT } from './Notify.jsx';
import { NEXT, needsComment, isReopen, isFinal, statusTone, slaOf, timeLeft, timelineOf, AUTO_CLOSE_HOURS } from './tickets.js';
import { DueField, AttachField, FileChips, ReviewCard, validateDue, MAX_COMMENT } from './TicketBits.jsx';

function Comment({ c, ticketId, mine, can }) {
  const { dispatch } = useStore();
  const [edit, setEdit] = useState(false), [txt, setTxt] = useState(c.text);
  return (
    <div className="cmt">
      <div className="cmthead"><b>{c.by}</b><span className="muted">{fmtDT(c.at)}{c.edited ? ' · edited' : ''}</span><span className="sp" />{mine && can && !edit && <a onClick={() => setEdit(true)}>Edit</a>}</div>
      {edit ? <>
        <textarea value={txt} maxLength={MAX_COMMENT} onChange={(e) => setTxt(e.target.value)} aria-label="Edit comment" />
        <div className="cmtactions"><button className="btn sm" onClick={() => { setEdit(false); setTxt(c.text); }}>Cancel</button><button className="btn sm primary" disabled={!txt.trim()} onClick={() => { dispatch({ type: 'EDIT_COMMENT', id: ticketId, commentId: c.id, text: txt }); setEdit(false); }}>Save</button></div>
      </> : <>{c.text && <div className="cmttext">{c.text}</div>}<FileChips files={c.attachments} /></>}
    </div>
  );
}

function TimelineItem({ e, users }) {
  const icon = { created: '＋', assign: '👤', status: '●', priority: '⚑', attributes: '🏷', due: '⏱', comment: '💬', auto: '⚙', email: '✉' }[e.type] || '•';
  let text;
  if (e.type === 'created') text = e.auto ? <>Ticket created by automation{e.ruleId ? ` (rule #${e.ruleId} V${e.version})` : ''}</> : <>Ticket created by <b>{e.by}</b></>;
  else if (e.type === 'assign') text = <>Assigned: {e.from} → <b>{e.to}</b></>;
  else if (e.type === 'status') text = <>{e.reopen ? 'Reopened. ' : ''}Status: {e.from} → <span className={'tag ' + statusTone[e.to]}>{e.to}</span></>;
  else if (e.type === 'priority') text = <>Priority: {e.from} → <b>{e.to}</b></>;
  else if (e.type === 'attributes') text = <>Review attributes: {e.from} → <b>{e.to}</b></>;
  else if (e.type === 'due') text = <>Due date set to <b>{fmtWDT(e.to)}</b> ({e.value} {e.unit} hours)</>;
  else if (e.type === 'comment') text = <>Comment added</>;
  else if (e.type === 'email') text = <>{{ assignment: 'Assignment email', reminder: 'Reminder', escalation: 'Escalation' }[e.mail.kind]} sent to <b>{e.mail.to.name}</b>{e.mail.kind === 'escalation' ? ` (Level ${e.mail.level})` : ''}</>;
  else text = e.text;
  return (
    <div className={'tk-ev ' + e.type}>
      <span className="tk-dot">{icon}</span>
      <div><div>{text}</div><div className="muted tk-meta">{e.by !== 'System' && e.type !== 'created' && e.type !== 'email' ? e.by + ' · ' : ''}{fmtDT(e.at)}</div></div>
    </div>
  );
}

export default function TicketModal({ id, onClose }) {
  const { state: s, dispatch } = useStore();
  const t = s.tickets.find((x) => x.id === id);
  const [f, setF] = useState({ assignee: t.assignee || '', status: t.status, priority: t.priority, attributes: t.attributes || [], changeDue: false, value: 24, unit: 'calendar', comment: '', files: [] });
  const [tried, setTried] = useState(false), [fileErr, setFileErr] = useState('');
  const up = (p) => setF({ ...f, ...p });
  const can = s.demo.canManage;
  const loc = s.locations.find((l) => l.id === t.locationId);
  const sla = slaOf(t, s.now);
  const final = isFinal(t.status);
  const reopen = isReopen(t.status, f.status);
  const dueGone = reopen && t.dueAt <= s.now;              // a reopened ticket that is already past due needs a new due date
  const dueNeeded = f.changeDue || dueGone;
  const mustComment = needsComment(t.status, f.status) && f.status !== t.status;
  const errs = {
    comment: mustComment && !f.comment.trim() ? (reopen ? 'A comment is required to reopen a ticket.' : `A comment is required to mark a ticket ${f.status === 'On Hold' ? 'On Hold' : f.status}.`) : f.comment.length > MAX_COMMENT ? `Up to ${MAX_COMMENT} characters.` : '',
    due: dueNeeded ? validateDue(f.value, f.unit) : '',
  };
  const bad = Object.values(errs).some(Boolean);
  const users = s.users.filter((u) => (u.active && u.role !== 'Admin') || u.id === t.assignee);
  const statusOptions = [t.status, ...NEXT[t.status]].map((x) => ({ value: x, label: x === 'In Progress' && final ? 'Reopen (In Progress)' : x }));
  const save = () => {
    setTried(true); if (bad) return;
    dispatch({ type: 'UPDATE_TICKET', id: t.id, patch: { assignee: f.assignee, status: f.status, priority: f.priority, attributes: t.hasText === false || !t.text ? undefined : f.attributes, due: dueNeeded ? { value: Number(f.value), unit: f.unit } : undefined, comment: f.comment, attachments: f.files } });
    setF({ ...f, changeDue: false, comment: '', files: [], status: f.status === 'Closed' ? 'Closed' : f.status });
    setTried(false);
  };
  const dirty = (f.assignee || null) !== (t.assignee || null) || f.status !== t.status || f.priority !== t.priority || JSON.stringify([...f.attributes].sort()) !== JSON.stringify([...(t.attributes || [])].sort()) || dueNeeded || f.comment.trim() || f.files.length;
  const timeline = timelineOf(t, s.sent);
  const origin = t.auto ? <a onClick={() => dispatch({ type: 'NAV', page: { name: 'history', ruleId: t.ruleId } })}>Automation · rule #{t.ruleId} V{t.version}</a> : <span>Manual · {t.createdBy}</span>;

  return (
    <Modal size="xl" onClose={onClose} header={
      <div className="mh">
        <h2>{t.id}</h2><span className={'tag ' + statusTone[t.status]}>{t.status}</span>{prioTag(t.priority)}<span className={'tag ' + sla.tone}>SLA: {sla.label}</span>
        <span className="sp" /><button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>}>
      <div className="mb tkbody">
        <div className="tkmain">
          <ReviewCard r={t} location={loc ? `${loc.name}, ${loc.city}` : ''} />
          <div className="tkmeta">
            <div><span className="muted">Origin</span><div>{origin}</div></div>
            <div><span className="muted">Created</span><div>{fmtDT(t.createdAt)}</div></div>
            <div><span className="muted">Due</span><div>{t.dueAt ? fmtDT(t.dueAt) : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{[t.dueSpec ? dueText(t.dueSpec) : '', timeLeft(t, s.now)].filter(Boolean).join(' · ')}</div></div>
            {t.reopenCount > 0 && <div><span className="muted">Reopened</span><div>{t.reopenCount} time{t.reopenCount === 1 ? '' : 's'}</div></div>}
          </div>
          {t.status === 'Resolved' && <div className="banner green" style={{ margin: '0 0 18px', padding: '10px 14px' }}>ⓘ <span>Closes automatically on {fmtDT(t.closedAt + AUTO_CLOSE_HOURS * 3600000)} ({AUTO_CLOSE_HOURS} hours after it was resolved). Reopen it before then if the issue is not fixed.</span></div>}

          <div className="upd">
            <h3>Update ticket</h3>
            <div className="row2">
              <div className="field"><label>Assigned to</label><Dropdown searchable disabled={!can || t.status === 'Closed'} value={f.assignee} onChange={(assignee) => up({ assignee })} placeholder="Unassigned" options={[{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name, note: u.role + (u.active ? '' : ' · inactive') }))]} />
                {!t.assignee && t.unassignedReason && <div className="hint">{t.unassignedReason}</div>}</div>
              <div className="field"><label>Status</label><Dropdown disabled={!can} value={f.status} onChange={(status) => up({ status })} options={statusOptions} /></div>
            </div>
            <div className="field"><label>Priority</label><Seg options={[['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']]} value={f.priority} onChange={(priority) => can && !final && up({ priority })} /></div>
            {!!t.text && <div className="field"><label>Review attributes <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <Pills multi disabled={!can || final} options={ATTRIBUTES} value={f.attributes} onChange={(attributes) => up({ attributes })} /></div>}
            {!final && <label className="check" style={{ marginBottom: 14 }}><input type="checkbox" disabled={!can} checked={f.changeDue} onChange={(e) => up({ changeDue: e.target.checked })} /> Change the due date (counted from now)</label>}
            {dueNeeded && <>{dueGone && <div className="hint" style={{ marginBottom: 8 }}>The old due date has passed. Set a new one to reopen this ticket.</div>}
              <DueField label="New due in (hours)" value={f.value} unit={f.unit} onValue={(value) => up({ value })} onUnit={(unit) => up({ unit })} from={s.now} error={tried ? errs.due : ''} /></>}
            <div className={'field' + (tried && errs.comment ? ' bad' : '')}>
              <label>Comment {mustComment ? <span className="req">*</span> : <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>}</label>
              <textarea disabled={!can} value={f.comment} onChange={(e) => up({ comment: e.target.value })} placeholder={mustComment ? 'Say why you are making this change' : 'Add an update'} />
              <div className="hint" style={{ textAlign: 'right' }}>{f.comment.length}/{MAX_COMMENT}</div>
              {tried && errs.comment && <div className="err">{errs.comment}</div>}
              {!tried && !mustComment && t.status === 'New' && <div className="hint">Adding the first comment moves this ticket to In Progress.</div>}
            </div>
            {can && <div className="field"><AttachField files={f.files} onChange={(files) => up({ files })} error={fileErr} setError={setFileErr} /></div>}
            {can ? <div className="cmtactions"><button className="btn primary" disabled={!dirty} onClick={save}>Save changes</button></div> : <div className="muted">View only. You cannot change tickets.</div>}
          </div>

          <h3 style={{ margin: '26px 0 12px' }}>Comments <span className="muted" style={{ fontWeight: 400 }}>({t.comments.length})</span></h3>
          {[...t.comments].reverse().map((c) => <Comment key={c.id} c={c} ticketId={t.id} mine={c.by === 'Shiva Karthikeyan'} can={can} />)}
          {!t.comments.length && <div className="muted">No comments yet.</div>}
        </div>
        <aside className="tkhist">
          <h3>History</h3>
          <div className="tlist">{timeline.map((e) => <TimelineItem key={e.id} e={e} users={s.users} />)}</div>
        </aside>
      </div>
    </Modal>
  );
}
