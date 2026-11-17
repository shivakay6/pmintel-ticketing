import React, { useEffect, useRef, useState } from 'react';

// Modal with focus trap, Esc handling and aria roles
export function Modal({ title, onClose, size = '', children, footer, header }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el.querySelectorAll('button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
    (focusables()[0] || el).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current && closeRef.current(); }
      if (e.key === 'Tab') {
        const f = [...focusables()]; if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', onKey);
    // Escape also works when focus has dropped to the page (for example after a button disappeared)
    const onDoc = (e) => { if (e.key !== 'Escape' || el.contains(document.activeElement)) return; const all = document.querySelectorAll('.modal'); if (all[all.length - 1] === el) closeRef.current && closeRef.current(); };
    document.addEventListener('keydown', onDoc);
    return () => { el.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onDoc); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="scrim">
      <div className={'modal ' + size} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        {header || (
          <div className="mh">
            <h2>{title}</h2>
            {onClose && <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>}
          </div>
        )}
        {children}
        {footer}
      </div>
    </div>
  );
}

// Small confirmation popup: title, message, Cancel on the left, primary on the right
export function Popup({ icon = 'warn', title, children, cancel = 'Cancel', onCancel, confirm, onConfirm, danger, extra }) {
  return (
    <Modal title={title} size="sm" onClose={onCancel} header={<div style={{ padding: '22px 24px 0' }}><div className={'pop-ico ' + icon}>{icon === 'ok' ? '✓' : icon === 'bad' ? '!' : '⚠'}</div><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2></div>}>
      <div className="mb" style={{ paddingTop: 10 }}>{children}</div>
      <div className="mf" style={{ borderTop: 0 }}>
        {extra}
        <span className="sp" />
        {cancel && <button className="btn" onClick={onCancel}>{cancel}</button>}
        {confirm && <button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onConfirm}>{confirm}</button>}
      </div>
    </Modal>
  );
}

export function Pills({ options, value, onChange, multi, disabled, render = (x) => x }) {
  const toggle = (o) => disabled ? null : (multi ? onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : onChange(o));
  return (
    <div className="pills">
      {options.map((o) => (
        <button type="button" key={o} disabled={disabled} className={'pill ' + ((multi ? value.includes(o) : value === o) ? 'on' : '')} onClick={() => toggle(o)} aria-pressed={multi ? value.includes(o) : value === o}>{render(o)}</button>
      ))}
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return <div className="seg">{options.map(([k, l]) => <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

// Searchable dropdown. options: [{value,label,disabled,note}]
export function Dropdown({ value, options, onChange, placeholder = 'Select', searchable, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = options.find((o) => o.value === value);
  const list = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="dd" ref={ref}>
      <button type="button" className="locbtn" disabled={disabled} onClick={() => !disabled && setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span style={{ color: cur ? 'inherit' : 'var(--muted)' }}>{cur ? cur.label : placeholder}</span><span className="sp" /><span>▾</span>
      </button>
      {open && (
        <div className="list" role="listbox">
          {searchable && <div style={{ padding: 8 }} onClick={(e) => e.stopPropagation()}><input autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid var(--line)', borderRadius: 6 }} /></div>}
          {list.map((o) => (
            <div key={o.value} className={o.disabled ? 'off' : ''} role="option" aria-selected={o.value === value} onClick={() => { if (o.disabled) return; onChange(o.value); setOpen(false); setQ(''); }}>
              {o.label} {o.note && <span className="muted" style={{ fontSize: 12 }}>{o.note}</span>}
            </div>
          ))}
          {!list.length && <div className="off">No matches</div>}
        </div>
      )}
    </div>
  );
}

export const Stars = ({ n }) => <span style={{ color: '#e8a317', letterSpacing: 1 }}>{'★'.repeat(n)}<span style={{ color: '#d5dbe0' }}>{'★'.repeat(5 - n)}</span></span>;
export const statusTag = (s) => <span className={'tag ' + (s === 'Active' ? 'green' : s === 'Paused' ? 'amber' : 'gray')}>{s}</span>;
export const prioTag = (p) => <span className={'tag ' + (p === 'High' ? 'red' : p === 'Medium' ? 'amber' : 'blue')}>{p}</span>;

// Digits only: anything else typed or pasted is dropped. Reports a number, or '' when empty.
export function NumInput({ value, onChange, className = 'dueNum', placeholder, max = 4, ...rest }) {
  return <input type="text" inputMode="numeric" autoComplete="off" className={className} placeholder={placeholder} value={value === '' || value == null ? '' : String(value)}
    onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, max); onChange(d === '' ? '' : Number(d)); }} {...rest} />;
}
