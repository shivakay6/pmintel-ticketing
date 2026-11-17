import React, { useState } from 'react';
import { useStore } from './store.jsx';
import { latest, PRIORITY_RANK, fmtDT } from './engine.js';
import { SOURCES, ATTRIBUTES, deriveAttrs, NOW, DAY } from './data.js';
import { Stars, Pills } from './ui.jsx';

function NewReview({ onAdd }) {
  const { state: s } = useStore();
  const [f, setF] = useState({ loc: 'L2', rating: 1, hasText: true, text: 'Terrible experience. Waited 40 minutes and nobody apologised.', sentiment: 'Negative', attributes: ['Wait time', 'Staff behaviour'], source: 'Google', author: 'Test Reviewer' });
  const up = (p) => setF({ ...f, ...p });
  return (
    <div className="panel">
      <h3>Post a new review</h3>
      <div className="row2">
        <div className="field"><label>Location</label><select value={f.loc} onChange={(e) => up({ loc: e.target.value })}>{s.locations.map((l) => <option key={l.id} value={l.id}>{l.name}, {l.city}</option>)}</select></div>
        <div className="field"><label>Source</label><select value={f.source} onChange={(e) => up({ source: e.target.value })}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Rating</label><select value={f.rating} onChange={(e) => up({ rating: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></div>
      </div>
      <label className="check" style={{ marginBottom: 10 }}><input type="checkbox" checked={f.hasText} onChange={(e) => up({ hasText: e.target.checked })} /> Review has text</label>
      {f.hasText && <div className="row2"><div className="field"><label>Review text</label><input value={f.text} onChange={(e) => up({ text: e.target.value })} /></div><div className="field"><label>Sentiment (from Reputation Management)</label><select value={f.sentiment} onChange={(e) => up({ sentiment: e.target.value })}>{['Positive', 'Neutral', 'Negative'].map((x) => <option key={x}>{x}</option>)}</select></div></div>}
      {f.hasText && <div className="field"><label>Review attributes (from Reputation Management)</label><Pills multi options={ATTRIBUTES} value={f.attributes} onChange={(attributes) => up({ attributes })} /></div>}
      <button className="btn primary" onClick={() => onAdd({ id: 'R' + Math.floor(4000 + Math.random() * 5000), locationId: f.loc, rating: f.rating, hasText: f.hasText, text: f.hasText ? f.text : '', sentiment: f.hasText ? f.sentiment : null, attributes: f.hasText ? f.attributes : [], source: f.source, author: f.author, postedAt: Date.now() })}>Add to queue</button>
    </div>
  );
}

export default function Simulator() {
  const { state: s, dispatch } = useStore();
  const runs = Object.values(s.runs).reverse();
  const loc = (id) => s.locations.find((l) => l.id === id)?.name;
  const nm = (id) => s.users.find((u) => u.id === id)?.name;
  return (
    <div>
      <div className="page-h"><h1>Review simulator</h1><span className="sp" /><button className="btn primary" disabled={!s.incoming.length} onClick={() => [...s.incoming].reverse().forEach((r) => dispatch({ type: 'PROCESS_REVIEW', id: r.id }))}>Process all ({s.incoming.length})</button></div>
      <div className="banner">ⓘ <span>Prototype helper that stands in for Reputation Management. Processing a review means it arrives now. It runs through the real engine: active rules only, location scope, conditions, one-ticket precedence and load-balanced assignment. Pause a rule or edit it on the dashboard, then process a review to see the effect.</span></div>
      <div className="split">
        <div>
          <div className="panel" style={{ marginBottom: 16 }}><h3>Incoming reviews ({s.incoming.length})</h3>
            {s.incoming.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f3f5', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}><Stars n={r.rating} /> <b>{loc(r.locationId)}</b> <span className="muted">· {r.source} · {r.author}</span><div>{r.text || <i className="muted">Rating only, no text</i>} {r.sentiment && <span className="tag gray">{r.sentiment}</span>}</div></div>
                <button className="btn sm primary" onClick={() => dispatch({ type: 'PROCESS_REVIEW', id: r.id })}>Process</button>
              </div>))}
            {!s.incoming.length && <div className="muted">Queue is empty. Post a new review below.</div>}
          </div>
          <NewReview onAdd={(review) => dispatch({ type: 'ADD_REVIEW', review })} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 10px' }}>Engine results</h3>
          {!runs.length && <div className="empty">Process a review to see what the engine decides, and why.</div>}
          {runs.map((r) => (
            <div className="panel" key={r.review.id} style={{ marginBottom: 14 }}>
              <div><Stars n={r.review.rating} /> <b>{loc(r.review.locationId)}</b> <span className="muted">· {r.review.source}</span></div>
              {r.outcome === 'ticket' && <>
                <div className="banner green" style={{ margin: '10px 0' }}><span>✓ Ticket <b>{r.ticketId}</b> created by rule <b>#{r.rule.id} {latest(r.rule).name}</b> (V{r.version}), {latest(r.rule).priority} priority.</span></div>
                <div className="trace">
                  <div><b>Matched rules:</b> {r.matches.map((m) => `#${m.id} (${latest(m).priority})`).join(', ')}</div>
                  {r.matches.length > 1 && <div><b>One ticket per review:</b> highest priority wins, then older rule. Winner: #{r.rule.id}.</div>}
                  {r.assignment.userId && <div><b>Assigned to:</b> {nm(r.assignment.userId)}{r.assignment.ranking ? ' (least-loaded in the pool)' : ' (named user)'}</div>}
                  {!r.assignment.userId && <div><b>Unassigned:</b> {r.assignment.reason}</div>}
                </div>
                {r.assignment.ranking && <table className="t" style={{ marginTop: 10 }}><thead><tr><th>Pool, ranked</th><th>Open</th><th>High</th><th>Med</th></tr></thead><tbody>{r.assignment.ranking.map((x, i) => <tr key={x.user.id} style={i === 0 ? { background: 'var(--green-l)' } : null}><td>{i + 1}. {x.user.name}</td><td>{x.open}</td><td>{x.high}</td><td>{x.medium}</td></tr>)}</tbody></table>}
              </>}
              {r.outcome === 'nomatch' && <div className="banner" style={{ margin: '10px 0 0' }}>No active rule matched this review, so no ticket was created.</div>}
                          </div>))}
        </div>
      </div>
    </div>
  );
}
