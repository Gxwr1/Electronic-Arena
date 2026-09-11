import React, { useState } from 'react';
import { Play, Pause, FastForward, CheckCircle, XCircle, RotateCcw, ShieldCheck, Trash2, Edit3, Plus, Users, Zap, Layers, Eye, Download, FileText, ArrowRight, SkipForward, FileDown, Coins } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { downloadTeamReportPDF, downloadAllTeamsPDF } from '../utils/pdfGenerator';

export function AdminPanel({ gameState, teams, adminPass, onLogoutAdmin, showToast }) {
  const [activeTab, setActiveTab] = useState('controls'); // 'controls' | 'preview' | 'data'
  const [editingBudgetTeam, setEditingBudgetTeam] = useState(null);
  const [newBudgetVal, setNewBudgetVal] = useState('');
  const [bulkPointsVal, setBulkPointsVal] = useState('250');

  const startAuctionMutation = useMutation(api.auction.startAuction);
  const pauseAuctionMutation = useMutation(api.auction.pauseAuction);
  const resumeAuctionMutation = useMutation(api.auction.resumeAuction);
  const sellComponentMutation = useMutation(api.auction.sellComponent);
  const markUnsoldMutation = useMutation(api.auction.markUnsold);
  const nextComponentMutation = useMutation(api.auction.nextComponent);
  const stopAuctionMutation = useMutation(api.auction.stopAuction);
  const resetAuctionMutation = useMutation(api.auction.resetAuction);
  const verifyTeamMutation = useMutation(api.auction.verifyTeam);
  const verifyAllTeamsMutation = useMutation(api.auction.verifyAllTeams);
  const updateTeamBudgetMutation = useMutation(api.auction.updateTeamBudget);
  const updateAllTeamsBudgetMutation = useMutation(api.auction.updateAllTeamsBudget);
  const deleteTeamMutation = useMutation(api.auction.deleteTeam);

  const teamList = Object.values(teams || {});
  const phase = gameState?.phase || 'lobby';
  const currentComponent = gameState?.currentPlayer;
  const currentBid = gameState?.currentBid || (currentComponent ? currentComponent.basePrice : 0);
  const currentBidderId = gameState?.currentBidder;
  const currentBidderTeam = currentBidderId && teams ? teams[currentBidderId] : null;

  const handleStart = async () => {
    try {
      await startAuctionMutation({ adminPass });
      showToast('🚀 Auction started! All participants redirected to Live Stage.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to start auction', 'error');
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (phase === 'auction') {
        await pauseAuctionMutation({ adminPass });
        showToast('⏸️ Auction paused. Players will see paused banner.', 'info');
      } else if (phase === 'paused') {
        await resumeAuctionMutation({ adminPass });
        showToast('▶️ Auction resumed!', 'success');
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

  const handleNext = async () => {
    try {
      await nextComponentMutation({ adminPass });
      showToast('⏭️ Skipped current component to end of queue', 'info');
    } catch (err) {
      showToast(err.message || 'Next failed', 'error');
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
    if (!window.confirm('Are you sure you want to conclude the auction and view final evaluation results?')) return;
    try {
      await stopAuctionMutation({ adminPass });
      showToast('🏁 Auction concluded! Redirected to results.', 'success');
    } catch (err) {
      showToast(err.message || 'Stop failed', 'error');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('WARNING: Reset full auction queue, clear bids, restore starting budgets, and return to lobby?')) return;
    try {
      await resetAuctionMutation({ adminPass });
      showToast('🔄 Auction state reset to lobby.', 'info');
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

  const handleBulkSetPoints = async (amount) => {
    const pts = parseInt(amount, 10);
    if (isNaN(pts) || pts < 0) {
      showToast('Please enter a valid points amount', 'error');
      return;
    }
    try {
      await updateAllTeamsBudgetMutation({ budget: pts, adminPass });
      showToast(`⚡ Set all ${teamList.length} teams to ${pts} Points!`, 'success');
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

  const handleDownloadTeamPDF = (team) => {
    try {
      downloadTeamReportPDF(team);
      showToast(`📄 Downloaded PDF report for ${team.name}`, 'success');
    } catch (e) {
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleDownloadOverallPDF = () => {
    try {
      downloadAllTeamsPDF(teamList, gameState?.soldHistory, gameState?.unsoldPlayers);
      showToast('📥 Downloaded Overall Master Tournament PDF', 'success');
    } catch (e) {
      showToast('Failed to generate overall PDF', 'error');
    }
  };

  const exportJSON = () => {
    const data = {
      timestamp: new Date().toISOString(),
      gameState,
      teams: teamList,
      soldHistory: gameState?.soldHistory || [],
      unsoldPlayers: gameState?.unsoldPlayers || [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electronic-auction-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 p-5 sm:p-6 shadow-2xl shadow-amber-500/10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-mono-code text-amber-300 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            <span>Master Administrator Command Console</span>
          </div>
          <h1 className="font-bebas text-3xl sm:text-5xl tracking-wider text-slate-100">
            AUCTION & PARTICIPANT CONTROLS
          </h1>
          <p className="text-xs font-rajdhani text-slate-400">
            Phase: <strong className="uppercase text-amber-400 font-mono-code">{phase}</strong> • 
            Remaining in Queue: <strong className="text-cyan-400 font-mono-code">{gameState?.auctionQueue?.length ?? 53}</strong> •
            Registered Teams: <strong className="text-emerald-400 font-mono-code">{teamList.length}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Navigation */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('controls')}
              className={`px-3 py-1.5 rounded-lg text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'controls' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Controls & Points
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'preview' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              👁️ Player Preview
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1.5 rounded-lg text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'data' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Data Evaluate (PDF)
            </button>
          </div>

          <button
            onClick={onLogoutAdmin}
            className="rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 px-3.5 py-2 text-xs font-rajdhani font-bold text-slate-300 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* TAB 1: MASTER CONTROLS & POINTS MANAGER */}
      {activeTab === 'controls' && (
        <div className="space-y-6">
          {/* 1. POINTS / BUDGET MANAGER */}
          <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-slate-950 via-emerald-950/20 to-slate-950 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bebas text-2xl tracking-wider text-emerald-400 leading-tight">
                    POINTS (PTS) & BUDGET MANAGER
                  </h2>
                  <p className="text-xs font-rajdhani text-slate-400">
                    Change starting points in bulk for all registered teams instantly
                  </p>
                </div>
              </div>

              {/* Points Quick Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBulkSetPoints(250)}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 text-xs font-rajdhani font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  ⚡ Set All to 250 Pts
                </button>
                <button
                  onClick={() => handleBulkSetPoints(500)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 text-xs font-rajdhani font-bold transition-colors"
                >
                  Set All to 500 Pts
                </button>
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1">
                  <input
                    type="number"
                    value={bulkPointsVal}
                    onChange={(e) => setBulkPointsVal(e.target.value)}
                    placeholder="pts"
                    className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono-code text-center text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={() => handleBulkSetPoints(bulkPointsVal)}
                    className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 text-xs font-rajdhani font-bold transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Stage Action Controls Grid */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <span>AUCTION STAGE COMMANDS</span>
              </h2>
              <span className="text-xs font-mono-code text-slate-400">
                Phase: <strong className="text-cyan-400 uppercase">{phase}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* 1. START */}
              <button
                onClick={handleStart}
                disabled={phase !== 'lobby' && phase !== 'finished'}
                className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 p-3.5 text-slate-950 font-rajdhani font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-35"
              >
                <Play className="h-5 w-5 mb-1 text-slate-950" />
                <span>START AUCTION</span>
              </button>

              {/* 2. PAUSE / RESUME */}
              <button
                onClick={handlePauseToggle}
                disabled={phase !== 'auction' && phase !== 'paused'}
                className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3.5 text-slate-200 font-rajdhani font-bold text-xs transition-all disabled:opacity-35"
              >
                {phase === 'paused' ? <Play className="h-5 w-5 mb-1 text-emerald-400" /> : <Pause className="h-5 w-5 mb-1 text-amber-400" />}
                <span>{phase === 'paused' ? 'RESUME' : 'PAUSE'}</span>
              </button>

              {/* 3. SOLD CURRENT */}
              <button
                onClick={handleSell}
                disabled={phase !== 'auction' || !currentComponent}
                className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 p-3.5 text-slate-950 font-rajdhani font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-35"
              >
                <CheckCircle className="h-5 w-5 mb-1 text-slate-950" />
                <span>SOLD CURRENT</span>
              </button>

              {/* 4. NEXT (MOVE TO BACK) */}
              <button
                onClick={handleNext}
                disabled={phase !== 'auction' || !currentComponent}
                className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3.5 text-slate-200 font-rajdhani font-bold text-xs transition-all disabled:opacity-35"
              >
                <SkipForward className="h-5 w-5 mb-1 text-sky-400" />
                <span>NEXT (BACK)</span>
              </button>

              {/* 5. SKIP / MARK UNSOLD */}
              <button
                onClick={handleUnsold}
                disabled={phase !== 'auction' || !currentComponent}
                className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3.5 text-slate-200 font-rajdhani font-bold text-xs transition-all disabled:opacity-35"
              >
                <XCircle className="h-5 w-5 mb-1 text-rose-400" />
                <span>SKIP (UNSOLD)</span>
              </button>

              {/* 6. STOP AUCTION */}
              <button
                onClick={handleStop}
                disabled={phase === 'lobby' || phase === 'finished'}
                className="flex flex-col items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3.5 text-slate-200 font-rajdhani font-bold text-xs transition-all disabled:opacity-35"
              >
                <FastForward className="h-5 w-5 mb-1 text-purple-400" />
                <span>STOP AUCTION</span>
              </button>

              {/* 7. RESET AUCTION */}
              <button
                onClick={handleReset}
                className="flex flex-col items-center justify-center rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 p-3.5 text-rose-300 font-rajdhani font-bold text-xs transition-all"
              >
                <RotateCcw className="h-5 w-5 mb-1 text-rose-400" />
                <span>RESET STAGE</span>
              </button>
            </div>
          </div>

          {/* 3. Team Approval & Management */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-400" />
                  <span>REGISTERED TEAMS & APPROVAL MANAGER ({teamList.length})</span>
                </h2>
                <p className="text-xs font-rajdhani text-slate-400">
                  Approved teams can place bids. Unapproved teams can only observe.
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
                No teams registered yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-800">
                {teamList.map((team) => {
                  const members = team.members || [team.leader || 'Leader'];
                  const isApproved = Boolean(team.verified);

                  return (
                    <div key={team.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                            Leader: <strong className="text-slate-200">{team.leader || members[0]}</strong> • Members: <strong className="text-slate-300">{members.join(', ')}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end md:self-center">
                        <div className="text-right mr-2">
                          <div className="text-xs font-mono-code text-emerald-400 font-bold">{team.budget} pts</div>
                          <div className="text-[10px] font-mono-code text-slate-400">{(team.players || []).length} items</div>
                        </div>

                        {/* Individual PDF Download */}
                        <button
                          onClick={() => handleDownloadTeamPDF(team)}
                          className="flex items-center gap-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-2.5 py-1.5 text-xs font-rajdhani font-bold transition-colors"
                          title="Download Team 1-Page PDF"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>

                        {isApproved ? (
                          <button
                            onClick={() => handleVerify(team.id, false)}
                            className="rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-1.5 text-xs font-rajdhani font-bold transition-colors"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerify(team.id, true)}
                            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 text-xs font-rajdhani shadow-md transition-all"
                          >
                            ✓ Approve
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
        </div>
      )}

      {/* TAB 2: LIVE PLAYER PREVIEW */}
      {activeTab === 'preview' && (
        <div className="rounded-3xl border border-cyan-500/40 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
                <Eye className="h-5 w-5 text-cyan-400" />
                <span>LIVE PLAYER VIEW PREVIEW</span>
              </h2>
              <p className="text-xs font-rajdhani text-slate-400">
                Exact mirror of how participants see the auction stage on their desktops
              </p>
            </div>
            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-mono-code text-cyan-300 border border-cyan-500/40">
              ● SYNCED LIVE
            </span>
          </div>

          {currentComponent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center rounded-2xl bg-slate-950 p-6 border border-cyan-500/30">
              <div className="flex items-center justify-center p-4 bg-slate-900/80 rounded-xl border border-slate-800 aspect-video">
                <img
                  src={currentComponent.image}
                  alt={currentComponent.name}
                  className="max-h-48 max-w-full object-contain filter drop-shadow-[0_0_20px_rgba(0,229,255,0.25)]"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-mono-code text-cyan-400">#{currentComponent.id} • {currentComponent.role}</span>
                  <h3 className="font-bebas text-4xl text-slate-100 tracking-wider glow-text-cyan">{currentComponent.name}</h3>
                  <p className="text-xs font-rajdhani text-slate-300 mt-1">{currentComponent.description}</p>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-mono-code text-slate-400 uppercase">Top Bid</span>
                    <div className="font-mono-code font-bold text-2xl text-emerald-400">{currentBid} pts</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono-code text-slate-400 uppercase">Leader</span>
                    <div className="font-rajdhani font-bold text-base text-cyan-300">
                      {currentBidderTeam ? currentBidderTeam.name : 'No bids yet'}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono-code text-slate-400">
                  Timer: <strong className="text-cyan-400">{gameState?.timerSeconds ?? 15}s remaining</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500">
              <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-rajdhani text-sm">No component active on stage.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DATA EVALUATE */}
      {activeTab === 'data' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="font-bebas text-2xl tracking-wider text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" />
                <span>AUCTION DATA EVALUATION MATRIX</span>
              </h2>
              <p className="text-xs font-rajdhani text-slate-400">
                Download 1-page reports per team or the complete tournament master PDF
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Master PDF Download Button */}
              <button
                onClick={handleDownloadOverallPDF}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-2 text-xs font-rajdhani font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <FileDown className="h-4 w-4" />
                <span>Download Overall Master PDF</span>
              </button>

              <button
                onClick={exportJSON}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-rajdhani font-bold text-slate-300 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {teamList.map((team) => {
              const won = team.players || [];
              const spent = Math.max(0, (team.initialBudget || 250) - team.budget);

              return (
                <div
                  key={team.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-800 text-sm">
                          {team.icon || '⚡'}
                        </div>
                      )}
                      <div>
                        <h4 className="font-rajdhani font-bold text-base text-slate-100">{team.name}</h4>
                        <p className="text-[11px] font-rajdhani text-slate-400">
                          Leader: <strong className="text-slate-200">{team.leader || 'Leader'}</strong> • Roster: {(team.members || []).join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono-code">
                      <div>
                        <span className="text-slate-400">Components: </span>
                        <strong className="text-cyan-400">{won.length}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Points Spent: </span>
                        <strong className="text-rose-400">{spent} pts</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Remaining Budget: </span>
                        <strong className="text-emerald-400">{team.budget} pts</strong>
                      </div>

                      {/* Individual Team PDF Button */}
                      <button
                        onClick={() => handleDownloadTeamPDF(team)}
                        className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 px-3 py-1.5 text-xs font-rajdhani font-bold transition-all ml-2"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Download 1-Page PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Components breakdown */}
                  {won.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {won.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 p-2 text-xs font-rajdhani"
                        >
                          <img src={item.image} alt="" className="h-5 w-5 object-contain shrink-0" />
                          <div className="truncate">
                            <div className="font-bold text-slate-200 truncate">{item.name}</div>
                            <div className="text-[10px] font-mono-code text-emerald-400">{item.soldPrice || item.basePrice} pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-rajdhani text-slate-500 italic">No components acquired by this team.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
