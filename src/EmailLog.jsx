import React from 'react';
import { ActivityLog } from './Notify.jsx';
export default function EmailLog() {
  return (
    <div>
      <div className="page-h"><h1>Sent emails</h1></div>
      <div className="banner">ⓘ <span>Prototype tool, not part of the product. Every reminder and escalation email that goes out (or is skipped) appears here. Move the clock forward to see more.</span></div>
      <ActivityLog kind="all" />
    </div>
  );
}
