import React, { useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { Modal, Seg, Dropdown, Stars, Pills, prioTag } from './ui.jsx';
import { fmtDT } from './engine.js';
import { SOURCES, ATTRIBUTES } from './data.js';
import { statusTone } from './tickets.js';
import { DueField, AttachField, ReviewCard, validateDue, MAX_COMMENT } from './TicketBits.jsx';

export function CreateTicketModal({ review, onClose }) {
  const { state: s, dispatch } = useStore();
  const loc = s.locations.find((l) => l.id === review.locationId);
  const [f, setF] = useState({ assignee: '', priority: 'Medium', attributes: review.attributes || [], value: 24, unit: 'calendar', comment: '', files: [] });
  const [fileErr, setFileErr] = useState('');
  const [tried, setTried] = useState(false);
  const up = (p) => setF({ ...f, ...p });
  const people = useMemo(() => s.users.filter((u) => u.active && u.role !== 'Admin').map((u) => ({ u, covers: u.locs.includes(review.locationId) }))
    .sort((a, b) => b.covers - a.covers || a.u.name.localeCompare(b.u.name)), [s.users, review]);
  const errs = { assignee: f.assignee ? '' : 'Select who this ticket is assigned to.', due: validateDue(f.value, f.unit), comment: f.comment.length > MAX_COMMENT ? `Up to ${MAX_COMMENT} characters.` : '' };
  const bad = Object.values(errs).some(Boolean);
  const submit = () => {
    setTried(true); if (bad) return;
    dispatch({ type: 'CREATE_TICKET', reviewId: review.id, assignee: f.assignee, priority: f.priority, attributes: review.hasText ? f.attributes : [], due: { value: Number(f.value), unit: f.unit }, comment: f.comment, attachments: f.files });
    onClose();
  };
  return (
    <Modal title="Create ticket" size="md" onClose={onClose}
      footer={<div className="mf"><button className="btn" onClick={onClose}>Cancel</button><span className="sp" /><button className="btn primary" onClick={submit}>Create Ticket</button></div>}>
      <div className="mb">
        <ReviewCard r={review} location={loc ? `${loc.name}, ${loc.city}` : ''} />
        <div className={'field' + (tried && errs.assignee ? ' bad' : '')} style={{ marginTop: 22 }}>
          <label>Assign to <span className="req">*</span></label>
          <Dropdown searchable value={f.assignee} onChange={(assignee) => up({ assignee })} placeholder="Select a user"
            options={people.map(({ u, covers }) => ({ value: u.id, label: u.name, note: `${u.role}${covers ? ' · covers this location' : ''}` }))} />
          {tried && errs.assignee && <div className="err">{errs.assignee}</div>}
        </div>
        <div className="field"><label>Priority</label><Seg options={[['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']]} value={f.priority} onChange={(priority) => up({ priority })} /></div>
        {review.hasText && <div className="field"><label>Review attributes <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <Pills multi options={ATTRIBUTES} value={f.attributes} onChange={(attributes) => up({ attributes })} />
          <div className="hint">{f.attributes.length ? 'Pre-filled from the review. Add or remove attributes if needed.' : 'No attributes were detected for this review. Pick any that apply.'}</div></div>}
        <DueField value={f.value} unit={f.unit} onValue={(value) => up({ value })} onUnit={(unit) => up({ unit })} from={s.now} error={tried ? errs.due : ''} />
        <div className={'field' + (errs.comment ? ' bad' : '')}>
          <label>Comment <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea value={f.comment} onChange={(e) => up({ comment: e.target.value })} placeholder="Add context for the assignee" />
          <div className="hint" style={{ textAlign: 'right' }}>{f.comment.length}/{MAX_COMMENT}</div>
          {errs.comment && <div className="err">{errs.comment}</div>}
        </div>
        <div className="field" style={{ marginBottom: 4 }}><AttachField files={f.files} onChange={(files) => up({ files })} error={fileErr} setError={setFileErr} /></div>
      </div>
    </Modal>
  );
}

const PAGE = 12;
export default function Reviews() {
  const { state: s, dispatch } = useStore();
  const [q, setQ] = useState(''), [rating, setRating] = useState(''), [source, setSource] = useState(''), [tk, setTk] = useState(''), [page, setPage] = useState(1);
  const [creating, setCreating] = useState(null);
  const byReview = useMemo(() => Object.fromEntries(s.tickets.map((t) => [t.reviewId, t])), [s.tickets]);
  const list = useMemo(() => s.reviews.filter((r) =>
    (!q || (r.text + ' ' + r.author).toLowerCase().includes(q.toLowerCase())) && (!rating || r.rating === +rating) && (!source || r.source === source)
    && (!tk || (tk === 'has' ? !!byReview[r.id] : !byReview[r.id]))), [s.reviews, q, rating, source, tk, byReview]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE)), cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * PAGE, cur * PAGE);
  const loc = (id) => s.locations.find((l) => l.id === id);
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };
  return (
    <div>
      <div className="page-h"><h1>Reviews</h1><span className="muted">{list.length} review{list.length === 1 ? "" : "s"}</span></div>
      <div className="toolbar">
        <div className="search"><input placeholder="Search review text or reviewer" value={q} onChange={reset(setQ)} aria-label="Search reviews" /></div>
        <select className="sel" value={rating} onChange={reset(setRating)} aria-label="Rating"><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
        <select className="sel" value={source} onChange={reset(setSource)} aria-label="Source"><option value="">All sources</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="sel" value={tk} onChange={reset(setTk)} aria-label="Ticket"><option value="">All reviews</option><option value="has">With a ticket</option><option value="none">Without a ticket</option></select>
      </div>
      <div className="tablewrap"><table className="t"><thead><tr><th>Review</th><th>Location</th><th>Posted</th><th>Ticket</th></tr></thead>
        <tbody>
          {rows.map((r) => { const t = byReview[r.id]; return (
            <tr key={r.id}>
              <td style={{ maxWidth: 440 }}><Stars n={r.rating} /> <b>{r.author}</b> <span className="muted">· {r.source}</span><div>{r.text || <i className="muted">Rating only, no text</i>}</div>{(r.attributes || []).length > 0 && <div className="files" style={{ marginTop: 6 }}>{r.attributes.map((a) => <span key={a} className="tag gray">{a}</span>)}</div>}</td>
              <td>{loc(r.locationId)?.name}<div className="muted" style={{ fontSize: 12 }}>{loc(r.locationId)?.city}</div></td>
              <td>{fmtDT(r.postedAt)}</td>
              <td>{t ? <><a onClick={() => dispatch({ type: 'NAV', page: { name: 'tickets', open: t.id } })}><b>{t.id}</b></a> <span className={'tag ' + statusTone[t.status]}>{t.status}</span></>
                : <button className="btn sm" disabled={!s.demo.canManage} onClick={() => setCreating(r)}>Create ticket</button>}</td>
            </tr>); })}
          {!rows.length && <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: 30 }}>No reviews match these filters</td></tr>}
        </tbody></table></div>
      {pages > 1 && <div className="pager"><button className="btn sm" disabled={cur === 1} onClick={() => setPage(cur - 1)}>‹ Previous</button><span className="muted">Page {cur} of {pages}</span><button className="btn sm" disabled={cur === pages} onClick={() => setPage(cur + 1)}>Next ›</button></div>}
      {creating && <CreateTicketModal review={creating} onClose={() => setCreating(null)} />}
    </div>
  );
}
