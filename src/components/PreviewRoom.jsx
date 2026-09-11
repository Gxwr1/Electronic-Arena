import React, { useState } from 'react';
import { CheckCircle2, Clock, Layers, LogOut } from 'lucide-react';
import { COMPONENTS, CATEGORIES } from '../data/components';

export function PreviewRoom({ currentTeam, onLogout }) {
  const [selectedCat, setSelectedCat] = useState('All');
  const isApproved = Boolean(currentTeam && currentTeam.verified);
  const members = currentTeam?.members || [currentTeam?.leader || 'Leader'];

  const filtered = COMPONENTS.filter((c) => selectedCat === 'All' || c.role === selectedCat);

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 sm:px-6 space-y-8">
      {/* Team Ready Header Banner */}
      <div className="relative rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/70 p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {currentTeam.logo ? (
              <img src={currentTeam.logo} alt="" className="h-16 w-16 rounded-2xl object-cover border-2 border-cyan-400 shadow-lg shadow-cyan-500/20" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 border-2 border-cyan-400 text-3xl shadow-lg shadow-cyan-500/20">
                {currentTeam.icon || '⚡'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono-code text-xs uppercase tracking-wider text-cyan-400">Assigned Team Seat</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono-code text-xs text-slate-400">PIN: {currentTeam.password}</span>
              </div>
              <h1 className="font-bebas text-3xl sm:text-5xl text-slate-100 tracking-wider leading-none">
                {currentTeam.name}
              </h1>
              <p className="text-xs font-rajdhani text-slate-400 mt-1">
                Leader: <strong className="text-slate-200">{currentTeam.leader || members[0]}</strong> • 
                Roster: <span className="text-slate-300">{members.join(', ')}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 self-start md:self-center">
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-2.5 text-right">
              <span className="text-[10px] font-mono-code uppercase text-slate-400">Starting Budget</span>
              <div className="font-mono-code font-bold text-2xl text-emerald-400">{currentTeam.budget} pts</div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300 px-3.5 py-2.5 text-xs font-rajdhani font-bold text-slate-400 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Leave Team</span>
            </button>
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          {isApproved ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-4 text-emerald-300">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="font-rajdhani font-bold text-sm text-emerald-200">
                  🎉 YOUR TEAM IS APPROVED FOR BIDDING!
                </h4>
                <p className="text-xs font-rajdhani text-emerald-400/90 mt-0.5">
                  The Host has approved your team seat. Waiting for the Host to start the live component queue.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 p-4 text-amber-300 animate-pulse">
              <Clock className="h-6 w-6 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-rajdhani font-bold text-sm text-amber-200">
                  ⏳ AWAITING HOST APPROVAL
                </h4>
                <p className="text-xs font-rajdhani text-amber-400/90 mt-0.5">
                  Your team is currently pending approval by the Host in the Admin Dashboard. Bidding controls will automatically unlock once verified!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 53 Component Preview Showcase */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <span>COMPONENT PREVIEW GALLERY ({filtered.length} / 53)</span>
          </h2>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-rajdhani font-bold whitespace-nowrap transition-all ${
                  selectedCat === cat
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col justify-between hover:border-cyan-500/30 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-center rounded-xl bg-slate-950 p-2 aspect-square border border-slate-800">
                  <img src={comp.image} alt={comp.name} className="h-full w-full object-contain" />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-code">
                  <span className="text-slate-400">#{comp.id}</span>
                  <span className="text-emerald-400 font-bold">{comp.basePrice} pts</span>
                </div>
                <h4 className="font-rajdhani font-bold text-xs text-slate-200 truncate">{comp.name}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
