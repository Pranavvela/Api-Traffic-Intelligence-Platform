import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * InfoTooltip - Displays an info icon with a tooltip on hover
 * Shows definition/explanation of table columns and metrics
 */
export default function InfoTooltip({ title, description, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-slate-400 rounded-full border border-slate-500 hover:border-sky-400 hover:text-sky-300 transition-colors ml-1"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label={`Info: ${title}`}
      >
        <span className="text-xs font-bold">i</span>
      </button>

      {isVisible && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-56 pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3">
            <div className="text-xs font-semibold text-sky-300 mb-1">{title}</div>
            <div className="text-xs text-slate-300 leading-relaxed">{description}</div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}

InfoTooltip.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  className: PropTypes.string,
};
