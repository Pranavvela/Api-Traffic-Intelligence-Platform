import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';

const linkBase =
  'group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ' +
  'text-slate-300 transition-all duration-200 ease-out';

const linkInactive =
  'hover:text-white hover:-translate-y-[1px] hover:bg-white/5';

const linkActive =
  'text-white bg-white/10 ring-1 ring-white/10 shadow-[0_0_24px_rgba(56,189,248,0.25)]';

const navItems = [
  { to: '/', label: 'Overview', icon: OverviewIcon },
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/api-management', label: 'API Management', icon: ApiIcon },
  { to: '/blocked-ips', label: 'Blocked IPs', icon: BlockIcon },
  { to: '/threat-analysis', label: 'Threat Analysis', icon: ThreatIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({
  isOpen = false,
  isCollapsed = false,
  onClose = () => {},
  onToggleCollapse = () => {},
}) {
  const panelClasses = isOpen
    ? 'translate-x-0 opacity-100'
    : '-translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100';

  const widthClass = isCollapsed ? 'lg:w-[90px]' : 'lg:w-[260px]';

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-label="Close sidebar"
      />
      <aside
        className={`fixed z-40 h-full w-[260px] overflow-hidden border-r border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-200 lg:static lg:h-auto lg:translate-x-0 lg:opacity-100 ${panelClasses} ${widthClass}`}
      >
        <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4 lg:pb-6">
          <NavLink
            to="/"
            end
            className={`group flex items-center gap-3 transition-all duration-200 hover:-translate-y-[1px] ${
              isCollapsed ? 'lg:mx-auto lg:gap-0' : ''
            }`}
            title="Go to Overview"
          >
            <span className="flex h-11 w-11 shrink-0 aspect-square items-center justify-center rounded-full border border-sky-400/25 bg-sky-500/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.14)] transition-all duration-200 group-hover:bg-sky-500/15 group-hover:text-sky-100">
              <span className="text-xs font-semibold tracking-[0.1em]">AS</span>
            </span>
            <div className={`${isCollapsed ? 'lg:hidden' : ''}`}>
              <div className="text-xs uppercase tracking-[0.24em] text-sky-300/80">API Sentinel</div>
              <div className="mt-1 text-lg font-semibold text-white">Threat Detection Console</div>
              <div className="mt-1 text-xs text-slate-400">Real-time API Monitoring</div>
            </div>
          </NavLink>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs text-white lg:hidden"
              onClick={onClose}
              type="button"
            >
              CLOSE
            </button>
            <button
              className="hidden rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs text-white transition-all hover:-translate-y-[1px] lg:inline-flex"
              onClick={onToggleCollapse}
              type="button"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? '>' : '<'}
            </button>
          </div>
        </div>

        <nav className="relative z-10 flex flex-col gap-2 px-4 pb-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive} ${
                    isCollapsed ? 'lg:justify-center lg:px-3' : ''
                  }`
                }
              >
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sky-400 opacity-0 transition-all duration-200 group-[.active]:opacity-100 group-[.active]:shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                <Icon className="h-4 w-4 text-sky-300/90 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all duration-200 group-hover:text-sky-100" />
                <span className={`${isCollapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

       
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool,
  isCollapsed: PropTypes.bool,
  onClose: PropTypes.func,
  onToggleCollapse: PropTypes.func,
};

function OverviewIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M3 12h7V3H3v9Zm11 9h7v-7h-7v7ZM14 3v7h7V3h-7ZM3 14h7v7H3v-7Z" />
    </svg>
  );
}

function DashboardIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M4 20V8m6 12V4m6 16v-6m4 6V10" />
    </svg>
  );
}

function ApiIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M4 7h16M4 12h10M4 17h7" />
      <circle cx="18" cy="12" r="3" />
    </svg>
  );
}

function BlockIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  );
}

function ThreatIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M12 3l7 4v5c0 4.2-3 7.5-7 9-4-1.5-7-4.8-7-9V7l7-4Z" />
      <path d="M9.5 12.5 11 14l3.5-4" />
    </svg>
  );
}

function SettingsIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path d="M19.4 15a7.7 7.7 0 0 0 .1-2l2-1.1-2-3.4-2.2.7a7.8 7.8 0 0 0-1.7-1l-.3-2.3h-4l-.3 2.3a7.8 7.8 0 0 0-1.7 1l-2.2-.7-2 3.4 2 1.1a7.7 7.7 0 0 0 .1 2l-2 1.1 2 3.4 2.2-.7c.5.4 1.1.7 1.7 1l.3 2.3h4l.3-2.3c.6-.3 1.2-.6 1.7-1l2.2.7 2-3.4-2-1.1Z" />
    </svg>
  );
}

OverviewIcon.propTypes = { className: PropTypes.string };
DashboardIcon.propTypes = { className: PropTypes.string };
ApiIcon.propTypes = { className: PropTypes.string };
BlockIcon.propTypes = { className: PropTypes.string };
ThreatIcon.propTypes = { className: PropTypes.string };
SettingsIcon.propTypes = { className: PropTypes.string };

