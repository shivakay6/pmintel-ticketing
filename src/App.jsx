import React from 'react';
import { useStore } from './store.jsx';
import { Sidebar, TopBar, Toast, DemoPanel } from './Shell.jsx';
import Dashboard from './Dashboard.jsx';
import History from './History.jsx';
import Tickets from './Tickets.jsx';
import Reviews from './Reviews.jsx';
import Simulator from './Simulator.jsx';
import Team from './Team.jsx';
import Escalation from './Escalation.jsx';
import Reminders from './Reminders.jsx';
import EmailLog from './EmailLog.jsx';

export default function App() {
  const { state: s } = useStore();
  const P = { rules: Dashboard, history: History, tickets: Tickets, reviews: Reviews, simulator: Simulator, team: Team, escalation: Escalation, reminders: Reminders, emaillog: EmailLog }[s.page.name];
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <div className="content"><P /></div>
      </div>
      <Toast />
      <DemoPanel />
    </div>
  );
}
