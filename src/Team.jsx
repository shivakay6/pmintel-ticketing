import React from 'react';
import { useStore } from './store.jsx';
import { workload, fmtDT } from './engine.js';

export default function Team() {
  const { state: s, dispatch } = useStore();
  return (
    <div>
      <div className="page-h"><h1>Team and workload</h1></div>
      <div className="banner">ⓘ <span>Prototype helper. Deactivate a user to see health flags and unassigned tickets, or to trigger “Assignee unavailable” in the rule builder. The columns below are exactly what the assignment logic ranks on.</span></div>
      <div className="tablewrap"><table className="t"><thead><tr><th>User</th><th>Role</th><th>Locations covered</th><th>Open</th><th>High</th><th>Medium</th><th>Last auto-assigned</th><th>Active</th></tr></thead>
        <tbody>{s.users.filter((u) => u.role !== 'Admin').map((u) => { const w = workload(u.id, s.tickets); return (
          <tr key={u.id} style={{ opacity: u.active ? 1 : .55 }}><td><b>{u.name}</b></td><td>{u.role}</td><td>{u.locs.length === 16 ? 'All' : u.locs.map((l) => s.locations.find((x) => x.id === l).name).slice(0, 3).join(', ') + (u.locs.length > 3 ? ` +${u.locs.length - 3}` : '')}</td><td>{w.open}</td><td>{w.high}</td><td>{w.medium}</td><td>{w.lastAuto ? fmtDT(w.lastAuto) : '—'}</td>
            <td><label className="check"><input type="checkbox" checked={u.active} onChange={() => dispatch({ type: 'TOGGLE_USER', id: u.id })} /> {u.active ? 'Active' : 'Inactive'}</label></td></tr>); })}</tbody></table></div>
    </div>
  );
}
