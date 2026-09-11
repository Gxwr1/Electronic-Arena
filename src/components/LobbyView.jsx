import React, { useState } from 'react';
import { Users, ShieldCheck, ShieldAlert, KeyRound, Sparkles, Search, Layers, Zap } from 'lucide-react';
import { COMPONENTS, CATEGORIES, CATEGORY_ICONS } from '../data/components';

export function LobbyView({ teams, currentTeam, onOpenRegister, onOpenLogin, onSelectTeam }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const teamList = Object.values(teams || {});

  const filteredComponents = COMPONENTS.filter((comp) => {
    const matchesCategory = selectedCategory === 'All' || comp.role === selectedCategory;
    const matchesSearch = comp.name.toLowerCase().includes(search.toLowerCase()) ||
                          comp.symbolName.toLowerCase().includes(search.toLowerCase()) ||
                          comp.symbol.toLowerCase().includes(search.toLowerCase()) ||
                          comp.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-6 sm:px-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/70 p-6 sm:p-10 shadow-2xl shadow-cyan-500/10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-mono-code text-cyan-300 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>53 High-Precision Digital Logic Components</span>
          </div>
          
          <h1 className="font-bebas text-4xl sm:text-6xl tracking-wider text-slate-100 leading-none mb-3">
            LOGIC CIRCUIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-300">AUCTION & SIMULATOR</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-rajdhani leading-relaxed mb-6">
            Compete with opposing teams to bid for critical logic gates, sequential elements, flip-flops, and decoders using your <strong>500 Points</strong> budget. Once acquired, wire your logic circuits in the live 60Hz Circuit Simulator!
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {!currentTeam && (
              <>
                <button
                  onClick={onOpenRegister}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-5 py-3 text-sm font-rajdhani font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  <Users className="h-4 w-4" />
                  <span>REGISTER NEW TEAM (500 PTS)</span>
                </button>
                <button
                  onClick={onOpenLogin}
                  className="flex items-center gap-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 px-5 py-3 text-sm font-rajdhani font-bold text-slate-200 border border-slate-700 transition-all"
                >
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  <span>ENTER TEAM PIN</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Registered Teams Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            <h2 className="font-bebas text-2xl tracking-wider text-slate-100">
              REGISTERED TEAMS IN LOBBY ({teamList.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-rajdhani">
            Starts with 0 default teams • Dynamic registration
          </span>
        </div>

        {teamList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm font-rajdhani text-slate-400">
              No teams registered yet. Be the first to register above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamList.map((team) => {
              const isMyTeam = currentTeam && currentTeam.id === team.id;
              const isApproved = Boolean(team.verified);
              const members = team.members || [team.leader || 'Leader'];

              return (
                <div
                  key={team.id}
                  className={`relative rounded-2xl border p-4 backdrop-blur-md transition-all ${
                    isMyTeam
                      ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-700" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-lg">
                          {team.icon || '⚡'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-rajdhani font-bold text-base text-slate-100">{team.name}</h3>
                          {isMyTeam && (
                            <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono-code font-bold text-cyan-300 border border-cyan-500/30">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-rajdhani">
                          Leader: <strong className="text-slate-200">{team.leader || members[0] || 'Leader'}</strong>
                        </p>
                      </div>
                    </div>

                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-mono-code text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Approved</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono-code text-amber-400">
                        <ShieldAlert className="h-3 w-3" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-rajdhani">
                    <div className="text-slate-400">
                      Budget: <strong className="text-emerald-400 font-mono-code">{team.budget} pts</strong>
                    </div>
                    <div className="text-slate-400">
                      Squad: <strong className="text-cyan-400 font-mono-code">{(team.players || []).length} items</strong>
                    </div>
                    <div className="text-slate-400">
                      Members: <strong className="text-slate-200">{members.length} / 5</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 53 Components Catalog */}
      <div className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-bebas text-3xl tracking-wider text-slate-100 flex items-center gap-2">
              <Layers className="h-6 w-6 text-cyan-400" />
              <span>LOGIC COMPONENT CATALOG ({filteredComponents.length} / 53)</span>
            </h2>
            <p className="text-xs font-rajdhani text-slate-400">
              Complete schematic specifications, symbols, and points base price
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search components or symbols..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4">
          {CATEGORIES.map((cat) => {
            const icon = CATEGORY_ICONS[cat] || '⚡';
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-rajdhani font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{cat !== 'All' ? icon : '⚡'}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Components Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {filteredComponents.map((comp) => (
            <div
              key={comp.id}
              className="group relative rounded-2xl border border-slate-800/90 bg-slate-900/70 p-3 flex flex-col justify-between hover:border-cyan-500/40 hover:bg-slate-900 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div>
                <div className="relative mb-2 flex items-center justify-center rounded-xl bg-slate-950/80 p-2 border border-slate-800/80 aspect-square group-hover:border-cyan-500/30 transition-colors">
                  <img
                    src={comp.image}
                    alt={comp.name}
                    loading="lazy"
                    className="h-full w-full object-contain filter group-hover:brightness-110 transition-all"
                  />
                  <span className="absolute top-1.5 left-1.5 rounded-md bg-slate-900/90 border border-slate-700 px-1.5 py-0.5 text-[9px] font-mono-code font-bold text-slate-300">
                    #{comp.id}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono-code text-cyan-400 truncate">
                    {comp.role}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono-code">
                    {comp.basePrice} pts
                  </span>
                </div>

                <h3 className="font-rajdhani font-bold text-sm text-slate-100 leading-tight truncate" title={comp.name}>
                  {comp.name}
                </h3>

                <p className="text-[11px] font-rajdhani text-slate-400 line-clamp-2 mt-1 leading-snug">
                  {comp.description}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono-code text-slate-400">
                <span className="truncate">Symbol: {comp.symbol}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
