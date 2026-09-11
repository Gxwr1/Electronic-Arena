import React, { useState, useEffect } from 'react';
import { Zap, Clock, ShieldCheck, ShieldAlert, Award, ArrowUpRight, Flame, Layers, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import confetti from 'canvas-confetti';

export function AuctionStage({ gameState, teams, currentTeam, showToast, onOpenLogin, onOpenRegister }) {
  const [customBid, setCustomBid] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [timer, setTimer] = useState(15);

  const placeBidMutation = useMutation(api.auction.placeBid);

  const currentComponent = gameState?.currentPlayer;
  const currentBid = gameState?.currentBid || (currentComponent ? currentComponent.basePrice : 0);
  const currentBidderId = gameState?.currentBidder;
  const currentBidderTeam = currentBidderId && teams ? teams[currentBidderId] : null;
  const isMyTeamLeading = currentTeam && currentBidderId === currentTeam.id;

  const isApproved = Boolean(currentTeam && currentTeam.verified);
  const isAuctionPhase = gameState?.phase === 'auction';
  const isPausedPhase = gameState?.phase === 'paused';

  // Confetti when won
  useEffect(() => {
    if (gameState?.lastAction === 'sold' && isMyTeamLeading) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5ff', '#00ff88', '#ffd700', '#ff007f'],
      });
    }
  }, [gameState?.soldHistory?.length]);

  // Local sync timer countdown
  useEffect(() => {
    setTimer(gameState?.timerSeconds ?? 15);
  }, [gameState?.timerSeconds, gameState?.currentBid, currentComponent?.id]);

  useEffect(() => {
    if (!isAuctionPhase || !currentComponent) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuctionPhase, currentComponent]);

  const handleQuickBid = async (increment) => {
    if (!currentTeam) {
      showToast('Please join or login as a team first', 'error');
      onOpenLogin();
      return;
    }
    if (!isApproved) {
      showToast('⏳ Your team is awaiting Admin Approval before bidding.', 'error');
      return;
    }
    if (!isAuctionPhase || !currentComponent) {
      showToast('No component is currently up for bidding', 'error');
      return;
    }

    const nextBid = currentBid + increment;
    if (nextBid > currentTeam.budget) {
      showToast(`Insufficient points! Available: ${currentTeam.budget} pts`, 'error');
      return;
    }

    setIsBidding(true);
    try {
      await placeBidMutation({
        teamId: currentTeam.id,
        password: currentTeam.password,
        increment,
      });
      showToast(`⚡ Bid placed: ${nextBid} pts!`, 'success');
    } catch (err) {
      showToast(err.message || 'Bid failed', 'error');
    } finally {
      setIsBidding(false);
    }
  };

  const handleCustomBid = async (e) => {
    e.preventDefault();
    const amount = parseInt(customBid, 10);
    if (!amount || isNaN(amount)) return;

    if (!currentTeam) {
      showToast('Please join or login as a team first', 'error');
      onOpenLogin();
      return;
    }
    if (!isApproved) {
      showToast('⏳ Your team is awaiting Admin Approval before bidding.', 'error');
      return;
    }
    if (amount <= currentBid) {
      showToast(`Bid must be strictly higher than ${currentBid} pts`, 'error');
      return;
    }
    if (amount > currentTeam.budget) {
      showToast(`Insufficient points! Available: ${currentTeam.budget} pts`, 'error');
      return;
    }

    setIsBidding(true);
    try {
      await placeBidMutation({
        teamId: currentTeam.id,
        password: currentTeam.password,
        amount,
      });
      showToast(`⚡ Custom bid placed: ${amount} pts!`, 'success');
      setCustomBid('');
    } catch (err) {
      showToast(err.message || 'Bid failed', 'error');
    } finally {
      setIsBidding(false);
    }
  };

  const timerRadius = 38;
  const circumference = 2 * Math.PI * timerRadius;
  const strokeDashoffset = circumference - (Math.max(0, timer) / 15) * circumference;
  const isUrgentTimer = timer <= 4;
  const isWarningTimer = timer <= 8 && timer > 4;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Top Banner Status */}
      {isPausedPhase && (
        <div className="rounded-2xl bg-amber-950/40 border border-amber-500/40 p-3 text-center text-amber-300 font-rajdhani font-bold flex items-center justify-center gap-2">
          <Clock className="h-4 w-4" />
          <span>⏸️ AUCTION CURRENTLY PAUSED BY ADMINISTRATOR</span>
        </div>
      )}

      {currentTeam && !isApproved && (
        <div className="rounded-2xl bg-amber-950/40 border border-amber-500/40 p-3.5 flex items-center justify-between gap-3 text-amber-300 font-rajdhani">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
            <span className="text-sm font-medium">
              Your team (<strong>{currentTeam.name}</strong>) is currently <strong>Pending Admin Approval</strong>. Bidding controls will unlock once verified by the Admin.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Spotlight & Bidding Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Spotlight Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative rounded-3xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            {currentComponent ? (
              <div className="space-y-6">
                {/* Header Meta */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-mono-code text-cyan-300 mb-2">
                      <span>#{currentComponent.id}</span>
                      <span>•</span>
                      <span>{currentComponent.role}</span>
                    </div>
                    <h1 className="font-bebas text-4xl sm:text-5xl text-slate-100 tracking-wider glow-text-cyan leading-none">
                      {currentComponent.name}
                    </h1>
                  </div>

                  {/* 15s Timer Ring */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg width="90" height="90" className="timer-circle-svg">
                      <circle
                        cx="45"
                        cy="45"
                        r={timerRadius}
                        stroke="#1e293b"
                        strokeWidth="7"
                        fill="transparent"
                      />
                      <circle
                        cx="45"
                        cy="45"
                        r={timerRadius}
                        stroke={isUrgentTimer ? '#ff0055' : isWarningTimer ? '#f59e0b' : '#00e5ff'}
                        strokeWidth="7"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className={`font-mono-code font-bold text-2xl leading-none ${
                        isUrgentTimer ? 'text-rose-500 animate-pulse' : isWarningTimer ? 'text-amber-400' : 'text-cyan-400'
                      }`}>
                        {timer}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* SVG Schematic Showcase */}
                <div className="relative flex items-center justify-center rounded-2xl bg-slate-950/90 border border-cyan-500/20 p-6 min-h-[220px]">
                  <img
                    src={currentComponent.image}
                    alt={currentComponent.name}
                    className="max-h-56 max-w-full object-contain filter drop-shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                  />
                  <div className="absolute bottom-3 right-3 rounded-lg bg-slate-900/90 border border-slate-700 px-2.5 py-1 text-xs font-mono-code text-cyan-300">
                    Symbol: <strong>{currentComponent.symbol}</strong>
                  </div>
                </div>

                {/* Spec & Description Box */}
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono-code text-slate-400">
                    <span>Classification: <strong className="text-slate-200">{currentComponent.country}</strong></span>
                    <span>Symbol Name: <strong className="text-cyan-400">{currentComponent.symbolName}</strong></span>
                  </div>
                  <p className="text-sm font-rajdhani text-slate-300 leading-relaxed">
                    {currentComponent.description}
                  </p>
                </div>

                {/* Leading Bid Status Banner */}
                <div className={`rounded-2xl border p-4 transition-all ${
                  isMyTeamLeading
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : currentBidderTeam
                    ? 'bg-slate-950/80 border-cyan-500/30'
                    : 'bg-slate-950/50 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono-code uppercase tracking-wider text-slate-400">
                        Current Top Bid
                      </span>
                      <div className="font-mono-code font-bold text-3xl sm:text-4xl text-emerald-400 glow-text-green">
                        {currentBid} pts
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono-code uppercase tracking-wider text-slate-400">
                        Leading Bidder
                      </span>
                      {currentBidderTeam ? (
                        <div className="flex items-center gap-2 justify-end mt-0.5">
                          {isMyTeamLeading && <Award className="h-5 w-5 text-emerald-400 animate-bounce" />}
                          <span className={`font-rajdhani font-bold text-xl ${
                            isMyTeamLeading ? 'text-emerald-300' : 'text-cyan-300'
                          }`}>
                            {isMyTeamLeading ? 'YOUR TEAM LEADS!' : currentBidderTeam.name}
                          </span>
                        </div>
                      ) : (
                        <div className="font-rajdhani text-sm text-slate-500 italic mt-1">
                          No bids placed yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-3">
                <Zap className="mx-auto h-12 w-12 text-slate-600 animate-pulse" />
                <h3 className="font-bebas text-3xl text-slate-400 tracking-wider">
                  AUCTION STAGE STANDBY
                </h3>
                <p className="text-sm font-rajdhani text-slate-500 max-w-md mx-auto">
                  Waiting for the Administrator to start the live component queue. Register your team in the lobby to participate!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Bidding Controls & Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Bid 3 Buttons Panel */}
          <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl shadow-cyan-500/10 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-cyan-400 flex items-center gap-2">
                <Flame className="h-5 w-5 text-cyan-400" />
                <span>QUICK BID CONTROLS</span>
              </h2>
              {currentTeam && (
                <div className="text-xs font-mono-code text-slate-300">
                  Balance: <strong className="text-emerald-400">{currentTeam.budget} pts</strong>
                </div>
              )}
            </div>

            {/* Exactly 3 Quick Bid Buttons: +1 pt, +2 pts, +5 pts */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleQuickBid(1)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 1 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-4 hover:border-cyan-400 hover:from-cyan-950/40 hover:to-slate-900 transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-400 group-hover:text-cyan-300 mb-0.5">Quick</span>
                <span className="font-bebas text-3xl sm:text-4xl text-slate-100 group-hover:text-cyan-200">+1 pt</span>
                <span className="text-[10px] font-mono-code text-slate-400 mt-1">{currentBid + 1} pts</span>
              </button>

              <button
                onClick={() => handleQuickBid(2)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 2 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-4 hover:border-cyan-400 hover:from-cyan-950/40 hover:to-slate-900 transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-400 group-hover:text-cyan-300 mb-0.5">Quick</span>
                <span className="font-bebas text-3xl sm:text-4xl text-slate-100 group-hover:text-cyan-200">+2 pts</span>
                <span className="text-[10px] font-mono-code text-slate-400 mt-1">{currentBid + 2} pts</span>
              </button>

              <button
                onClick={() => handleQuickBid(5)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 5 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-950/60 to-slate-900 border border-cyan-400 p-4 hover:border-cyan-300 hover:from-cyan-900/60 hover:to-slate-900 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-300 mb-0.5">Power</span>
                <span className="font-bebas text-3xl sm:text-4xl text-cyan-300">+5 pts</span>
                <span className="text-[10px] font-mono-code text-cyan-400 mt-1">{currentBid + 5} pts</span>
              </button>
            </div>

            {/* Custom Bid Input */}
            <form onSubmit={handleCustomBid} className="flex gap-2">
              <input
                type="number"
                value={customBid}
                onChange={(e) => setCustomBid(e.target.value)}
                placeholder={`Custom bid > ${currentBid}`}
                min={currentBid + 1}
                max={currentTeam?.budget || 500}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding}
                className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono-code disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || !customBid}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 text-xs font-rajdhani font-bold text-slate-200 transition-colors disabled:opacity-40"
              >
                BID
              </button>
            </form>

            {!currentTeam && (
              <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-center space-y-2">
                <p className="text-xs font-rajdhani text-slate-400">
                  You are observing as a guest. Join or register a team to place bids!
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={onOpenLogin}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-rajdhani font-bold text-slate-200 border border-slate-700 hover:bg-slate-700"
                  >
                    Enter PIN
                  </button>
                  <button
                    onClick={onOpenRegister}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-rajdhani font-bold text-slate-950 shadow-md shadow-emerald-500/20"
                  >
                    Register Team
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Activity & Bid Feed */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl space-y-3">
            <h3 className="font-bebas text-xl text-slate-200 tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>LIVE AUCTION ACTIVITY</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(gameState?.feed || []).slice(0, 15).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2.5 text-xs font-rajdhani text-slate-300 flex items-start gap-2"
                >
                  <span className="font-mono-code text-[10px] text-slate-500 shrink-0 mt-0.5">
                    {new Date(item.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="leading-snug flex-1">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* My Team Won Components Drawer */}
          {currentTeam && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bebas text-xl text-slate-200 tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <span>MY TEAM WON COMPONENTS ({(currentTeam.players || []).length})</span>
                </h3>
                <span className="text-xs font-mono-code text-emerald-400">{currentTeam.budget} pts left</span>
              </div>

              {(currentTeam.players || []).length === 0 ? (
                <p className="text-xs font-rajdhani text-slate-500 italic py-2">
                  No components won yet. Place bids during the auction to build your circuit inventory!
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {currentTeam.players.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl bg-slate-950/70 border border-slate-800 p-2 text-xs font-rajdhani"
                    >
                      <img src={item.image} alt="" className="h-6 w-6 object-contain shrink-0" />
                      <div className="truncate">
                        <div className="font-bold text-slate-200 truncate">{item.name}</div>
                        <div className="text-[10px] font-mono-code text-emerald-400">{item.soldPrice || item.basePrice} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
