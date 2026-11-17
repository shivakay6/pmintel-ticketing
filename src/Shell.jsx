import React, { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { ClockBar } from './Notify.jsx';

export function Sidebar() {
  const { state: s, dispatch } = useStore();
  const p = s.page.name;
  const go = (name) => dispatch({ type: 'NAV', page: { name } });
  const on = (...n) => (n.includes(p) ? 'on' : '');
  return (
    <aside className="side">
      <div className="brand"><div className="logo">◆</div>PMIntel</div>
      <div className="nav">
        <div className="grp">Reputation Management</div>
        <button className={'sub ' + on('reviews')} onClick={() => go('reviews')}>Reviews</button>
        <div className="grp">Automation</div>
        <button className={'sub ' + on('rules', 'history')} onClick={() => go('rules')}>Ticket Automation</button>
        <button className={'sub ' + on('reminders')} onClick={() => go('reminders')}>Reminders</button>
        <button className={'sub ' + on('escalation')} onClick={() => go('escalation')}>Escalation</button>
        <div className="grp">Ticket Management</div>
        <button className={'sub ' + on('tickets')} onClick={() => go('tickets')}>Review Tickets</button>
      </div>
      <div className="proto">Prototype build. Data lives in your browser tab only. Refresh to reset to the default state.</div>
    </aside>
  );
}

export function TopBar() {
  const { state: s } = useStore();
  const map = { rules: 'Ticket Automation', history: 'Ticket Automation', tickets: 'Review Tickets', reviews: 'Reviews', simulator: 'Review simulator', team: 'Team and workload', escalation: 'Escalation', reminders: 'Reminders', emaillog: 'Sent emails' };
  const parent = ['rules', 'history', 'escalation', 'reminders'].includes(s.page.name) ? 'Automation' : s.page.name === 'reviews' ? 'Reputation Management' : s.page.name === 'tickets' ? 'Ticket Management' : null;
  return (
    <div className="top">
      <div className="crumb">{parent ? <>{parent} › <b>{map[s.page.name]}</b></> : <b>{map[s.page.name]}</b>}</div>
      <span className="sp" />
      <span className="muted">{s.demo.canManage ? 'Admin' : 'View only'}</span>
      <div className="avatar">SK</div>
    </div>
  );
}

export function Toast() {
  const { state: s, dispatch } = useStore();
  useEffect(() => { if (!s.toast) return; const t = setTimeout(() => dispatch({ type: 'TOAST' }), 4200); return () => clearTimeout(t); }, [s.toast]);
  if (!s.toast) return null;
  return <div className="toast" role="status">{s.toast.msg}<button className="icon-btn" style={{ color: '#fff' }} onClick={() => dispatch({ type: 'TOAST' })}>✕</button></div>;
}

export function DemoPanel() {
  const { state: s, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const d = s.demo;
  const set = (patch) => dispatch({ type: 'DEMO', patch });
  return (
    <div className="demo-panel">
      {open && (
        <div className="demo-card">
          <h4>Demo controls</h4>
          <div className="muted" style={{ fontSize: 12.5 }}>Only for the prototype, not part of the product.</div>
          <label className="check"><input type="checkbox" checked={!d.canManage} onChange={(e) => set({ canManage: !e.target.checked })} /> View-only user (hides Create Rule)</label>
          <label className="check"><input type="checkbox" checked={d.emptyDashboard} onChange={(e) => set({ emptyDashboard: e.target.checked })} /> Show empty dashboard with templates</label>
          <label className="check"><input type="checkbox" checked={d.failNextSave} onChange={(e) => set({ failNextSave: e.target.checked })} /> Make the next save fail</label>
          <div style={{ marginTop: 10 }}><ClockBar /></div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Prototype tools</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {[['simulator', 'Review simulator'], ['team', 'Team and workload'], ['emaillog', 'Sent emails']].map(([n, l]) => <button key={n} className="btn sm" onClick={() => dispatch({ type: 'NAV', page: { name: n } })}>{l}</button>)}
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => location.reload()}>Reset to default state</button>
        </div>
      )}
      <button className="demo-btn" onClick={() => setOpen(!open)}>⚙ Demo controls</button>
    </div>
  );
}
