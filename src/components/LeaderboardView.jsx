import React from 'react';
import { Trophy, Award, Download, Layers, Users, FileDown } from 'lucide-react';
import { downloadTeamReportPDF, downloadAllTeamsPDF } from '../utils/pdfGenerator';

export function LeaderboardView({ teams, soldHistory, unsoldPlayers }) {
  const teamList = Object.values(teams || {}).sort((a, b) => {
    // Sort by components won first, then remaining budget
    const countA = (a.players || []).length;
    const countB = (b.players || []).length;
    if (countB !== countA) return countB - countA;
    return b.budget - a.budget;
  });

  const exportJSON = () => {
    const data = {
      timestamp: new Date().toISOString(),
      standings: teamList,
      soldHistory: soldHistory || [],
      unsoldPlayers: unsoldPlayers || [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono-code text-amber-300 mb-2">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span>Official Auction Standings & Evaluation</span>
          </div>
          <h1 className="font-bebas text-3xl sm:text-5xl tracking-wider text-slate-100">
            TEAM SQUAD STANDINGS & INVENTORY
          </h1>
          <p className="text-xs font-rajdhani text-slate-400">
            Completed Sales: <strong className="text-emerald-400 font-mono-code">{(soldHistory || []).length}</strong> • 
            Unsold: <strong className="text-rose-400 font-mono-code">{(unsoldPlayers || []).length}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {/* Master Overall PDF Download */}
          <button
            onClick={() => downloadAllTeamsPDF(teamList, soldHistory, unsoldPlayers)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-2.5 text-xs font-rajdhani font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <FileDown className="h-4 w-4" />
            <span>Download Master PDF Report</span>
          </button>

          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2.5 text-xs font-rajdhani font-bold text-slate-300 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Standings Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-xl space-y-6">
        <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          <span>TEAM LEADERBOARD & INDIVIDUAL REPORTS</span>
        </h2>

        {teamList.length === 0 ? (
          <p className="text-xs font-rajdhani text-slate-500 italic py-4 text-center">
            No teams registered yet.
          </p>
        ) : (
          <div className="space-y-4">
            {teamList.map((team, idx) => {
              const won = team.players || [];
              const spent = 500 - team.budget;
              const isTop = idx === 0 && won.length > 0;

              return (
                <div
                  key={team.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    isTop
                      ? 'border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono-code font-bold text-base ${
                        idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-slate-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        #{idx + 1}
                      </div>

                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-700" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-lg">
                          {team.icon || '⚡'}
                        </div>
                      )}

                      <div>
                        <h3 className="font-rajdhani font-bold text-lg text-slate-100">{team.name}</h3>
                        <p className="text-xs text-slate-400 font-rajdhani">
                          Leader: <strong className="text-slate-200">{team.leader || 'Leader'}</strong> • 
                          Members: {(team.members || []).join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-[10px] font-mono-code uppercase text-slate-400">Components Won</span>
                        <div className="font-mono-code font-bold text-lg text-cyan-400">{won.length} items</div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-mono-code uppercase text-slate-400">Points Spent</span>
                        <div className="font-mono-code font-bold text-lg text-rose-400">{spent} pts</div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-mono-code uppercase text-slate-400">Remaining Budget</span>
                        <div className="font-mono-code font-bold text-lg text-emerald-400">{team.budget} pts</div>
                      </div>

                      {/* Download Individual 1-Page PDF */}
                      <button
                        onClick={() => downloadTeamReportPDF(team)}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-3 py-2 text-xs font-rajdhani font-bold transition-all ml-2"
                        title={`Download 1-page PDF for ${team.name}`}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span>1-Page PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Components Acquired Gallery */}
                  {won.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400 mb-2 block">
                        Acquired Component Inventory:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {won.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs font-rajdhani"
                          >
                            <img src={item.image} alt="" className="h-4 w-4 object-contain" />
                            <span className="font-bold text-slate-200">{item.name}</span>
                            <span className="text-[10px] font-mono-code text-emerald-400">({item.soldPrice || item.basePrice} pts)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
