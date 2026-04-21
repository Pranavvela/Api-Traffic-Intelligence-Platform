import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';

// eslint-disable-next-line react/prop-types

export default function TopBar({ onOpenSidebar = () => {}, onLogout = () => {}, showLogout = false }) {
  return (
    <header className="glass-panel sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-[1px] lg:hidden"
          type="button"
          onClick={onOpenSidebar}
        >
          MENU
        </button>
        <NavLink to="/" className="flex items-center gap-3 transition-all duration-200 hover:-translate-y-[1px]" title="Go to Overview">
          <span className="flex h-9 w-9 shrink-0 aspect-square items-center justify-center rounded-full border border-sky-400/25 bg-sky-500/10 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.12)]">
            <span className="text-[11px] font-semibold tracking-[0.1em]">AS</span>
          </span>
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-sky-300/80">API Sentinel</div>
            <div className="text-xl font-semibold text-white">Threat Detection Console</div>
          </div>
        </NavLink>
      </div>
      <div className="flex items-center gap-3">
        <div className="group relative inline-flex items-center gap-3 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400/35 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          </span>
          <span className="leading-tight">
            <span className="block font-semibold tracking-[0.08em] text-emerald-100">LIVE</span>
            <span className="block text-[10px] text-emerald-200/80">Monitoring active</span>
          </span>
        </div>
        {showLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-[1px]"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

TopBar.propTypes = {
  onOpenSidebar: PropTypes.func,
  onLogout: PropTypes.func,
  showLogout: PropTypes.bool,
};

