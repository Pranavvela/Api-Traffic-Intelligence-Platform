import React from 'react';
import PropTypes from 'prop-types';

export default function TableSortDialog({
  open = false,
  title,
  fields,
  selectedFields,
  direction,
  onToggleField,
  onChangeDirection,
  onApply,
  onCancel,
}) {
  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 h-full w-full max-w-none border-0 bg-transparent p-0"
      aria-labelledby="table-sort-title"
    >
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0"
        onClick={onCancel}
        aria-label={`Close ${title} sort dialog`}
      />
      <div className="relative z-10 flex h-full items-start justify-end px-4 pt-24 sm:pt-28 lg:pr-10">
        <div className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-soft">
          <div className="border-b border-white/10 px-6 py-4">
            <div className="text-xs uppercase tracking-[0.24em] text-sky-300/80">Sort by</div>
            <div id="table-sort-title" className="mt-1 text-lg font-semibold text-white">
              {title}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Select one or more fields, then choose the sort order.
            </div>
          </div>

          <div className="p-6">
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {fields.map((field) => {
                const checked = selectedFields.includes(field.key);
                return (
                  <label
                    key={field.key}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                      checked
                        ? 'border-sky-400/40 bg-sky-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-sky-400 focus:ring-sky-400"
                      checked={checked}
                      onChange={() => onToggleField(field.key)}
                    />
                    <span className="flex-1">{field.label}</span>
                    {field.hint ? <span className="text-xs text-slate-400">{field.hint}</span> : null}
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeDirection('asc')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    direction === 'asc'
                      ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Ascending
                </button>
                <button
                  type="button"
                  onClick={() => onChangeDirection('desc')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    direction === 'desc'
                      ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Descending
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onApply}
                  disabled={selectedFields.length === 0}
                  className="rounded-xl bg-sky-500/90 px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

TableSortDialog.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      hint: PropTypes.string,
    })
  ).isRequired,
  selectedFields: PropTypes.arrayOf(PropTypes.string).isRequired,
  direction: PropTypes.oneOf(['asc', 'desc']).isRequired,
  onToggleField: PropTypes.func.isRequired,
  onChangeDirection: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

