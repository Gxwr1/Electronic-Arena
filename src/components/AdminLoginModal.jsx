import React, { useState } from 'react';
import { X, ShieldCheck, Lock } from 'lucide-react';

export function AdminLoginModal({ isOpen, onClose, onSuccess, showToast }) {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.trim() === 'aiml') {
      showToast('Admin access granted!', 'success');
      onSuccess();
      onClose();
    } else {
      showToast('Invalid admin credentials', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/30 bg-slate-900/95 p-6 shadow-2xl shadow-amber-500/10 text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-100 transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          <h2 className="font-bebas text-2xl tracking-wider text-amber-400">
            ADMIN COMMAND ACCESS
          </h2>
        </div>
        <p className="text-xs text-slate-400 font-rajdhani mb-5">
          Enter master control password to approve teams & manage auction stage
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-amber-300 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              autoFocus
              required
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none font-mono-code"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 py-2.5 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-amber-500/25 transition-all"
          >
            <Lock className="h-4 w-4" />
            <span>AUTHENTICATE AS ADMIN</span>
          </button>
        </form>
      </div>
    </div>
  );
}
