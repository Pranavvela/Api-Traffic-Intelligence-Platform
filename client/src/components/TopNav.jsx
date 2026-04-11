import React from 'react';
import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `topnav-link${isActive ? ' active' : ''}`;

export default function TopNav() {
  return (
    <header className="topnav">
      <div className="topnav-brand">
        <div className="topnav-title">API Sentinel</div>
        <div className="topnav-subtitle">Real-Time API Threat Detection</div>
      </div>
      <nav className="topnav-links">
        <NavLink to="/" className={linkClass} end>
          Overview
        </NavLink>
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/api-management" className={linkClass}>
          API Management
        </NavLink>
        <NavLink to="/blocked-ips" className={linkClass}>
          Blocked IPs
        </NavLink>
        <NavLink to="/threat-analysis" className={linkClass}>
          Threat Analysis
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          Settings
        </NavLink>
      </nav>
      <div className="topnav-status">
        <div className="live-badge">
          <div className="live-dot" />
          Live
        </div>
      </div>
    </header>
  );
}
