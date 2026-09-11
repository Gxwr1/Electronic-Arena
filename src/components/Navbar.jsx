import React from 'react';
import { Zap, Trophy, LogOut, ShieldCheck } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, currentTeam, onLogout, isAdmin }) {
  return (
    <header className="sticky top-0 z-50 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-xl px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Brand */}
        <div 
          onClick={() => setActiveTab(currentTeam ? 'preview' : 'landing')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-400/40 transition-all">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Zap className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bebas text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
                ELECTRONIC ARENA
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Only when in Auction or Leaderboard) */}
        {(currentTeam || isAdmin || activeTab === 'leaderboard') && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab(currentTeam ? 'preview' : 'landing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-rajdhani font-bold transition-all ${
                activeTab === 'landing' || activeTab === 'preview'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>{currentTeam ? 'My Team Seat' : 'Lobby'}</span>
            </button>

            <button
              onClick={() => setActiveTab('auction')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-rajdhani font-bold transition-all ${
                activeTab === 'auction'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>Auction Stage</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-rajdhani font-bold transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Standings</span>
            </button>
          </nav>
        )}

        {/* User / Team Actions & Admin */}
        <div className="flex items-center gap-2">
          {currentTeam && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 border border-cyan-500/30 p-1.5 sm:px-3">
              {currentTeam.logo ? (
                <img src={currentTeam.logo} alt="" className="h-6 w-6 rounded-full object-cover border border-cyan-400/50" />
              ) : (
                <span className="text-base">{currentTeam.icon || '⚡'}</span>
              )}
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-100">{currentTeam.name}</span>
                  {currentTeam.verified ? (
                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                      ✓ Approved
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[10px] text-amber-400 font-bold border border-amber-500/30">
                      ⏳ Pending
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono-code text-emerald-400 font-semibold">
                  {currentTeam.budget} pts • {(currentTeam.players || []).length} items
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Leave Team Seat"
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Admin badge ONLY shown if already authenticated as Admin */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-900 text-amber-400 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Console</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
