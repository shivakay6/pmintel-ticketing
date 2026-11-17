import React, { useRef } from 'react';
import { NumInput, Seg, Stars } from './ui.jsx';
import { computeDueAt } from './time.js';
import { fmtWDT } from './Notify.jsx';
import { fmtDT } from './engine.js';

export const MAX_COMMENT = 300, MAX_FILES = 3, MAX_FILE_MB = 5;

// Due date in hours only, counted on calendar or business hours. Shows the resulting date.
export function DueField({ value, unit, onValue, onUnit, from, error, label = 'Due in (hours)' }) {
  const n = Number(value);
  const at = n >= 1 && n <= 720 ? computeDueAt(from, { value: n, unit }) : null;
  return (
    <div className={'field' + (error ? ' bad' : '')}>
      <label>{label} <span className="req">*</span></label>
      <div className="dueRow">
        <NumInput value={value} onChange={onValue} max={3} placeholder="24" aria-label="Due in hours" />
        <Seg options={[['calendar', 'Calendar hours'], ['business', 'Business hours']]} value={unit} onChange={onUnit} />
      </div>
      {error ? <div className="err">{error}</div> : <div className="hint">{at ? <>Due on <b>{fmtWDT(at)}</b>. {unit === 'business' ? 'Business hours skip Saturday and Sunday.' : 'Calendar hours count every hour.'}</> : 'Between 1 and 720 hours.'}</div>}
    </div>
  );
}
export const validateDue = (value, unit) => { const n = Number(value); if (!value && value !== 0) return 'Enter the due time in hours.'; if (!Number.isInteger(n) || n < 1) return 'Enter at least 1 hour.'; if (n > 720) return 'Up to 720 hours (30 days).'; return ''; };

export function AttachField({ files, onChange, error, setError }) {
  const ref = useRef(null);
  const pick = (e) => {
    const list = [...e.target.files]; e.target.value = '';
    const out = [...files];
    for (const f of list) {
      if (out.length >= MAX_FILES) { setError(`Up to ${MAX_FILES} files.`); break; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`${f.name} is larger than ${MAX_FILE_MB} MB.`); continue; }
      setError(''); out.push({ name: f.name, size: f.size });
    }
    onChange(out);
  };
  return (
    <div className="attach">
      <input ref={ref} type="file" multiple hidden onChange={pick} aria-label="Attach file" />
      <button type="button" className="btn sm" onClick={() => ref.current.click()} disabled={files.length >= MAX_FILES}>📎 Attach file</button>
      <span className="muted" style={{ fontSize: 12.5 }}>Up to {MAX_FILES} files, {MAX_FILE_MB} MB each</span>
      {files.length > 0 && <div className="files">{files.map((f, i) => <span key={i} className="file">📄 {f.name}<button type="button" aria-label={'Remove ' + f.name} onClick={() => onChange(files.filter((_, j) => j !== i))}>✕</button></span>)}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
export const FileChips = ({ files }) => files && files.length ? <div className="files">{files.map((f, i) => <span key={i} className="file">📄 {f.name}</span>)}</div> : null;

export function ReviewCard({ r, location }) {
  return (
    <div className="rvcard">
      <div className="rvtop"><Stars n={r.rating || 0} /> <b>{r.reviewer || r.author}</b> <span className="muted">· {r.source}</span><span className="sp" /><span className="muted">{fmtDT(r.reviewPostedAt ?? r.postedAt)}</span></div>
      <div className="rvtext">{r.text ? r.text : <i className="muted">Rating only, no review text</i>}</div>
      <div className="muted" style={{ fontSize: 12.5 }}>📍 {location}</div>
    </div>
  );
}
