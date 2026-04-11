import React from 'react';
import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `sidebar-link${isActive ? ' active' : ''}`;

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">API Sentinel</div>
      <div className="sidebar-subtitle">Real-Time API Threat Detection</div>
      <nav className="sidebar-nav">
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
    </aside>
  );
}
