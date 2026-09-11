import React, { useState } from 'react';
import { CheckCircle2, Clock, Layers, LogOut, Sparkles, FileDown } from 'lucide-react';
import { COMPONENTS, CATEGORIES } from '../data/components';
import { downloadTeamReportPDF } from '../utils/pdfGenerator';

export function PreviewRoom({ currentTeam, onLogout }) {
  const [selectedCat, setSelectedCat] = useState('All');
  const isApproved = Boolean(currentTeam && currentTeam.verified);
  const members = currentTeam?.members || [currentTeam?.leader || 'Leader'];

  const filtered = COMPONENTS.filter((c) => selectedCat === 'All' || c.role === selectedCat);

  return (
    <div className="relative z-10 h-[calc(100vh-4.25rem)] flex flex-col overflow-hidden max-w-7xl mx-auto px-4 py-4 sm:px-6">
      {/* 1. Fixed Header: Team Profile Name, Logo & Status */}
      <div className="shrink-0 rounded-2xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl p-4 shadow-xl mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Team Profile & Logo */}
          <div className="flex items-center gap-3">
            {currentTeam.logo ? (
              <img
                src={currentTeam.logo}
                alt=""
                className="h-12 w-12 rounded-xl object-cover border-2 border-cyan-400 shadow-md shadow-cyan-500/20"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 border-2 border-cyan-400 text-2xl shadow-md shadow-cyan-500/20">
                {currentTeam.icon || '⚡'}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bebas text-2xl sm:text-3xl text-slate-100 tracking-wider leading-tight">
                  {currentTeam.name}
                </h1>
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-rajdhani font-bold text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approved by Host</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-rajdhani font-bold text-amber-400 border border-amber-500/40 animate-pulse">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Awaiting Host Approval</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-rajdhani text-slate-400">
                Leader: <strong className="text-slate-200">{currentTeam.leader || members[0]}</strong> • Roster: <span className="text-slate-300">{members.join(', ')}</span>
              </p>
            </div>
          </div>

          {/* Status, Budget & Leave */}
          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-1.5 text-right">
              <span className="text-[10px] font-mono-code uppercase text-slate-400">Team Budget</span>
              <div className="font-mono-code font-bold text-lg text-emerald-400">{currentTeam.budget} pts</div>
            </div>

            <div className="hidden lg:flex items-center gap-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 text-xs font-rajdhani text-cyan-300">
              <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" />
              <span>⏳ Waiting for Host to start the Live Auction...</span>
            </div>

            {/* Download Team PDF */}
            <button
              onClick={() => downloadTeamReportPDF(currentTeam)}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-3 py-2 text-xs font-rajdhani font-bold transition-all"
              title="Download 1-Page PDF Summary"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Team PDF</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300 px-3 py-2 text-xs font-rajdhani font-bold text-slate-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Seat</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Gallery Sub-header & Category Filter Pills */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <h2 className="font-bebas text-xl tracking-wider text-slate-200">
            ALL COMPONENTS CATALOG ({filtered.length} of 53)
          </h2>
          <span className="text-xs font-rajdhani text-slate-400 italic hidden sm:inline">
            — Browse available components before live bidding begins
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-rajdhani font-bold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Component Gallery Grid with Component Name ALONE (NO Base Price Shown) */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 pr-2 backdrop-blur-md">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-3 flex flex-col justify-between hover:border-cyan-500/40 hover:bg-slate-900/90 transition-all shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-center rounded-xl bg-slate-900/90 p-2.5 aspect-square border border-slate-800/80 group-hover:border-cyan-500/30 transition-colors">
                  <img
                    src={comp.image}
                    alt={comp.name}
                    className="h-full w-full object-contain filter group-hover:drop-shadow-[0_0_12px_rgba(0,229,255,0.3)] transition-all"
                  />
                </div>
                <div className="text-[10px] font-mono-code text-cyan-400">
                  #{comp.id} • {comp.role}
                </div>
                {/* NAME ALONE without Price */}
                <h4 className="font-rajdhani font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors leading-tight">
                  {comp.name}
                </h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
