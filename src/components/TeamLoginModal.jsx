import React, { useState } from 'react';
import { X, KeyRound, ArrowRight } from 'lucide-react';

export function TeamLoginModal({ isOpen, onClose, teams, onSuccess, showToast }) {
  const [pin, setPin] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      showToast('Please enter your team PIN / passcode', 'error');
      return;
    }

    const teamList = Object.values(teams || {});
    const match = teamList.find((t) => t.password === cleanPin);

    if (match) {
      showToast(`Welcome back, ${match.name}!`, 'success');
      onSuccess(match);
      onClose();
    } else {
      showToast('Invalid team PIN / passcode. Please check and try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-500/10 text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-100 transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-5 w-5 text-cyan-400" />
          <h2 className="font-bebas text-2xl tracking-wider text-cyan-400">
            ENTER TEAM PASSCODE
          </h2>
        </div>
        <p className="text-xs text-slate-400 font-rajdhani mb-5">
          Enter your team's PIN to access your bidding seat & inventory
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300 mb-1">
              Team Passcode PIN
            </label>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. logic101"
              maxLength={25}
              autoFocus
              required
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono-code"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-2.5 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-cyan-500/25 transition-all"
          >
            <span>ACCESS AUCTION SEAT</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
