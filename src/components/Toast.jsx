import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function Toast({ toasts, onDismiss }) {
  if (!toasts || !toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bg = 'bg-slate-900/95 border-cyan-500/40 text-cyan-200';
        let icon = <Info className="h-4 w-4 text-cyan-400 shrink-0" />;

        if (toast.type === 'success' || toast.type === 'win' || toast.type === 'sold') {
          bg = 'bg-slate-900/95 border-emerald-500/40 text-emerald-200';
          icon = <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
        } else if (toast.type === 'error' || toast.type === 'lost') {
          bg = 'bg-slate-900/95 border-rose-500/40 text-rose-200';
          icon = <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200 ${bg}`}
          >
            <div className="flex items-center gap-2.5">
              {icon}
              <p className="text-xs sm:text-sm font-rajdhani font-medium leading-tight">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-100 p-0.5 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
