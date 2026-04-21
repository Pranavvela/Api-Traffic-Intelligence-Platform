import React from 'react';
import PropTypes from 'prop-types';

export default function DashboardCard({ title, value, meta, children }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-glow">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-sky-500/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="text-xs uppercase tracking-widest text-slate-400">{title}</div>
        <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        {meta && <div className="mt-1 text-xs text-slate-400">{meta}</div>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

DashboardCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  meta: PropTypes.string,
  children: PropTypes.node,
};
