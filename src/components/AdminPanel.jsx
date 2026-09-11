import React, { useState } from 'react';
import { Play, Pause, FastForward, CheckCircle, XCircle, RotateCcw, ShieldCheck, Trash2, Edit3, Plus, Users, Zap, Layers } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function AdminPanel({ gameState, teams, adminPass, onLogoutAdmin, showToast }) {
  const [editingBudgetTeam, setEditingBudgetTeam] = useState(null);
  const [newBudgetVal, setNewBudgetVal] = useState('');

  const startAuctionMutation = useMutation(api.auction.startAuction);
  const pauseAuctionMutation = useMutation(api.auction.pauseAuction);
  const resumeAuctionMutation = useMutation(api.auction.resumeAuction);
  const sellComponentMutation = useMutation(api.auction.sellComponent);
  const markUnsoldMutation = useMutation(api.auction.markUnsold);
  const stopAuctionMutation = useMutation(api.auction.stopAuction);
  const resetAuctionMutation = useMutation(api.auction.resetAuction);
  const verifyTeamMutation = useMutation(api.auction.verifyTeam);
  const verifyAllTeamsMutation = useMutation(api.auction.verifyAllTeams);
  const updateTeamBudgetMutation = useMutation(api.auction.updateTeamBudget);
  const deleteTeamMutation = useMutation(api.auction.deleteTeam);

  const teamList = Object.values(teams || {});
  const phase = gameState?.phase || 'lobby';
  const currentComponent = gameState?.currentPlayer;

  const handleStart = async () => {
    try {
      await startAuctionMutation({ adminPass });
      showToast('🚀 Auction started with 53 components queue!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to start auction', 'error');
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (phase === 'auction') {
        await pauseAuctionMutation({ adminPass });
        showToast('⏸️ Auction paused', 'info');
      } else if (phase === 'paused') {
        await resumeAuctionMutation({ adminPass });
        showToast('▶️ Auction resumed', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Pause/Resume failed', 'error');
    }
  };

  const handleSell = async () => {
    try {
      const res = await sellComponentMutation({ adminPass });
      showToast(`🏆 Sold ${res?.soldItem?.name || 'component'}!`, 'success');
    } catch (err) {
      showToast(err.message || 'Sell failed', 'error');
    }
  };

  const handleUnsold = async () => {
    try {
      await markUnsoldMutation({ adminPass });
      showToast('❌ Component marked unsold and queued next', 'info');
    } catch (err) {
      showToast(err.message || 'Mark unsold failed', 'error');
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Are you sure you want to conclude the auction and view final leaderboard?')) return;
    try {
      await stopAuctionMutation({ adminPass });
      showToast('🏁 Auction concluded!', 'success');
    } catch (err) {
      showToast(err.message || 'Stop failed', 'error');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('WARNING: Reset full auction queue, bids, and return to lobby? (Teams remain saved)')) return;
    try {
      await resetAuctionMutation({ adminPass });
      showToast('🔄 Auction state reset to lobby', 'info');
    } catch (err) {
      showToast(err.message || 'Reset failed', 'error');
    }
  };

  const handleVerify = async (teamId, verified) => {
    try {
      await verifyTeamMutation({ teamId, verified, adminPass });
      showToast(verified ? '✅ Team approved to bid!' : '⚠️ Team approval revoked', 'info');
    } catch (err) {
      showToast(err.message || 'Verification update failed', 'error');
    }
  };

  const handleVerifyAll = async (verified) => {
    try {
      await verifyAllTeamsMutation({ verified, adminPass });
      showToast(verified ? '✅ Approved all registered teams!' : 'Revoked approval for all teams', 'info');
    } catch (err) {
      showToast(err.message || 'Bulk update failed', 'error');
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Delete team "${teamName}"?`)) return;
    try {
      await deleteTeamMutation({ teamId, adminPass });
      showToast(`Deleted team ${teamName}`, 'info');
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleSaveBudget = async () => {
    const budgetNum = parseInt(newBudgetVal, 10);
    if (isNaN(budgetNum) || budgetNum < 0) return;
    try {
      await updateTeamBudgetMutation({ teamId: editingBudgetTeam.id, budget: budgetNum, adminPass });
      showToast(`Updated budget for ${editingBudgetTeam.name} to ${budgetNum} pts`, 'success');
      setEditingBudgetTeam(null);
    } catch (err) {
      showToast(err.message || 'Budget update failed', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 p-6 shadow-2xl shadow-amber-500/10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono-code text-amber-300 mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Master Administrator Command Console</span>
          </div>
          <h1 className="font-bebas text-3xl sm:text-5xl tracking-wider text-slate-100">
            AUCTION & PARTICIPANT CONTROLS
          </h1>
          <p className="text-xs font-rajdhani text-slate-400">
            Current Phase: <strong className="uppercase text-amber-400 font-mono-code">{phase}</strong> • 
            Remaining in Queue: <strong className="text-cyan-400 font-mono-code">{gameState?.auctionQueue?.length ?? 53}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLogoutAdmin}
            className="rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 px-4 py-2 text-xs font-rajdhani font-bold text-slate-300 transition-colors"
          >
            Exit Admin
          </button>
        </div>
      </div>

      {/* Stage Action Controls */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-xl space-y-5">
        <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <span>LIVE STAGE ACTIONS</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <button
            onClick={handleStart}
            disabled={phase !== 'lobby' && phase !== 'finished'}
            className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 p-4 text-slate-950 font-rajdhani font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
          >
            <Play className="h-5 w-5 mb-1 text-slate-950" />
            <span>START AUCTION</span>
          </button>

          <button
            onClick={handleSell}
            disabled={phase !== 'auction' || !currentComponent}
            className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 p-4 text-slate-950 font-rajdhani font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-40"
          >
            <CheckCircle className="h-5 w-5 mb-1 text-slate-950" />
            <span>SELL COMPONENT</span>
          </button>

          <button
            onClick={handleUnsold}
            disabled={phase !== 'auction' || !currentComponent}
            className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 text-slate-200 font-rajdhani font-bold text-sm transition-all disabled:opacity-40"
          >
            <XCircle className="h-5 w-5 mb-1 text-rose-400" />
            <span>MARK UNSOLD</span>
          </button>

          <button
            onClick={handlePauseToggle}
            disabled={phase !== 'auction' && phase !== 'paused'}
            className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 text-slate-200 font-rajdhani font-bold text-sm transition-all disabled:opacity-40"
          >
            {phase === 'paused' ? <Play className="h-5 w-5 mb-1 text-emerald-400" /> : <Pause className="h-5 w-5 mb-1 text-amber-400" />}
            <span>{phase === 'paused' ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            onClick={handleStop}
            disabled={phase === 'lobby' || phase === 'finished'}
            className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 text-slate-200 font-rajdhani font-bold text-sm transition-all disabled:opacity-40"
          >
            <FastForward className="h-5 w-5 mb-1 text-purple-400" />
            <span>END AUCTION</span>
          </button>

          <button
            onClick={handleReset}
            className="flex flex-col items-center justify-center rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 p-4 text-rose-300 font-rajdhani font-bold text-sm transition-all"
          >
            <RotateCcw className="h-5 w-5 mb-1 text-rose-400" />
            <span>RESET STAGE</span>
          </button>
        </div>
      </div>

      {/* Team Approval & Management */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              <span>TEAM VERIFICATION & BUDGET MANAGER ({teamList.length})</span>
            </h2>
            <p className="text-xs font-rajdhani text-slate-400">
              Only verified teams are allowed to place bids during the live auction
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVerifyAll(true)}
              className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-rajdhani font-bold transition-colors"
            >
              ✓ Approve All Teams
            </button>
            <button
              onClick={() => handleVerifyAll(false)}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 text-xs font-rajdhani font-bold transition-colors"
            >
              Revoke All
            </button>
          </div>
        </div>

        {teamList.length === 0 ? (
          <p className="text-xs font-rajdhani text-slate-500 italic py-4 text-center">
            No teams registered yet. Teams can register from the participant lobby.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {teamList.map((team) => {
              const members = team.members || [team.leader || 'Leader'];
              const isApproved = Boolean(team.verified);

              return (
                <div key={team.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {team.logo ? (
                      <img src={team.logo} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-700" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-lg">
                        {team.icon || '⚡'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-rajdhani font-bold text-base text-slate-100">{team.name}</h3>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono-code text-cyan-300 border border-slate-700">
                          PIN: {team.password}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-rajdhani">
                        Members (Max 5): <strong className="text-slate-200">{members.join(', ')}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <div className="text-right">
                      <div className="text-xs font-mono-code text-emerald-400 font-bold">{team.budget} pts</div>
                      <div className="text-[10px] font-mono-code text-slate-400">{(team.players || []).length} items</div>
                    </div>

                    {isApproved ? (
                      <button
                        onClick={() => handleVerify(team.id, false)}
                        className="rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-rajdhani font-bold transition-colors"
                      >
                        Revoke Approval
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerify(team.id, true)}
                        className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 text-xs font-rajdhani shadow-md shadow-emerald-500/20 transition-all"
                      >
                        ✓ Approve Team
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingBudgetTeam(team);
                        setNewBudgetVal(team.budget);
                      }}
                      className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 text-xs border border-slate-700 transition-colors"
                      title="Edit Budget"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 p-2 text-xs border border-rose-500/30 transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Budget Modal */}
      {editingBudgetTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="font-bebas text-2xl text-cyan-400">
              EDIT BUDGET FOR {editingBudgetTeam.name}
            </h3>
            <div>
              <label className="block text-xs font-mono-code text-slate-400 mb-1">
                Points Balance
              </label>
              <input
                type="number"
                value={newBudgetVal}
                onChange={(e) => setNewBudgetVal(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3.5 py-2 text-sm font-mono-code focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingBudgetTeam(null)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-rajdhani font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBudget}
                className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-1.5 text-xs font-rajdhani"
              >
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
