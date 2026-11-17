import React, { useState } from 'react';
import { useStore } from './store.jsx';
import { latest, diffVersions, scopeLabel, assigneeLabel, fmtDT, dueText } from './engine.js';
import { statusTag, prioTag, Pills } from './ui.jsx';
import { ConditionList, LocationsModal } from './Dashboard.jsx';

const EV = { created: ['Created', 'var(--green)'], edited: ['Edited', 'var(--blue)'], paused: ['Paused', 'var(--orange)'], resumed: ['Resumed', 'var(--green)'] };

export default function History() {
  const { state: s, dispatch } = useStore();
  const rule = s.rules.find((r) => r.id === s.page.ruleId);
  const [flt, setFlt] = useState([]);
  const [locs, setLocs] = useState(null);
  if (!rule) return null;
  const vs = [...rule.versions].reverse().filter((v) => !flt.length || flt.includes(v.status));
  const prev = (v) => rule.versions.find((x) => x.v === v.v - 1);
  const evs = [...rule.events].sort((a, b) => b.at - a.at);
  return (
    <div>
      <div className="page-h"><button className="back" aria-label="Back to dashboard" onClick={() => dispatch({ type: 'NAV', page: { name: 'rules' } })}>←</button><h1>Ticket Automation Details</h1><span className="tag blue">{rule.module}</span><span className="tag gray">#{rule.id}</span><span className="sp" /></div>
      <div className="toolbar"><b style={{ fontSize: 16 }}>{latest(rule).name}</b><span className="sp" style={{ flex: 1 }} /><span className="muted">Status</span><Pills multi options={['Active', 'Paused', 'Stopped']} value={flt} onChange={setFlt} /></div>
      <div className="hgrid">
        <div>
          {vs.length === 0 && <div className="empty">No versions with that status.</div>}
          {vs.map((v) => {
            const d = prev(v) ? diffVersions(prev(v), v, s.users, s.locations) : [];
            const n = s.tickets.filter((t) => t.ruleId === rule.id && t.version === v.v).length;
            return (
              <div className="card vcard" key={v.v}>
                <div className="head" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><h3 style={{ margin: 0 }}>{v.name}</h3><span className="tag navy">V{v.v}</span>{statusTag(v.status)}{prioTag(v.priority)}<span className="tag blue">{v.module}</span></div>
                <div className="rgrid g3">
                  <div className="kv"><label>Locations</label><div><a onClick={() => setLocs(v.scope)}>{scopeLabel(v.scope, s.locations)}</a></div></div>
                  <div className="kv"><label>Assigned to</label><div>{assigneeLabel(v.assignee, s.users)}</div></div>
                  <div className="kv"><label>Due date</label><div>Within {dueText(v.due)}</div></div>
                  <div className="kv" style={{ gridColumn: '1 / -1' }}><label>Conditions</label><ConditionList c={v.conditions} /></div>
                  <div className="kv"><label>Created on</label><div>{fmtDT(v.createdAt)}</div></div>
                  <div className="kv"><label>Created by</label><div>{v.createdBy}</div></div>
                  <div className="kv" />
                  <div className="kv" style={{ gridColumn: '1 / -1' }}><label>Comment included in the ticket</label><div style={{ background: '#f7fafb', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>{v.comment}</div></div>
                </div>
                {v.v > 1 && <div className="diff"><b>What changed from V{v.v - 1}</b>{d.length ? d.map(([k, a, b]) => <div key={k}><b style={{ color: 'inherit' }}>{k}:</b> {a} <span className="muted">changed to</span> {b}</div>) : <div className="muted">No field changes.</div>}</div>}
                <div className="rfoot"><div className="kv"><label>Tickets created (V{v.v})</label><div>{n > 0 ? <a onClick={() => dispatch({ type: 'NAV', page: { name: 'tickets', filter: { ruleId: rule.id, version: v.v } } })}>{n}</a> : '0'}</div></div></div>
              </div>
            );
          })}
        </div>
        <div className="card log"><h3 style={{ margin: '12px 0 4px' }}>Activity log</h3>
          {evs.map((e, i) => <div className="ev" key={i}><span className="dot" style={{ background: EV[e.type][1] }} /><div><b>{EV[e.type][0]}</b>{e.type === 'edited' || e.type === 'created' ? ` · V${e.version}` : ` · V${e.version}`}<div className="muted" style={{ fontSize: 12.5 }}>{e.user} · {fmtDT(e.at)}</div></div></div>)}
        </div>
      </div>
      {locs && <LocationsModal scope={locs} onClose={() => setLocs(null)} />}
    </div>
  );
}
