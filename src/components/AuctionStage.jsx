import React, { useState, useEffect, useRef } from 'react';
import { Zap, Clock, ShieldCheck, ShieldAlert, Award, Flame, Layers } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SoldCelebrationModal } from './SoldCelebrationModal';

export function AuctionStage({ gameState, teams, currentTeam, showToast, onOpenLogin }) {
  const [customBid, setCustomBid] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [timer, setTimer] = useState(15);
  const resolvingRef = useRef(false);

  const placeBidMutation = useMutation(api.auction.placeBid);
  const autoResolveMutation = useMutation(api.auction.autoResolveTimer);

  const currentComponent = gameState?.currentPlayer;
  const currentBid = gameState?.currentBid || (currentComponent ? currentComponent.basePrice : 0);
  const currentBidderId = gameState?.currentBidder;
  const currentBidderTeam = currentBidderId && teams ? teams[currentBidderId] : null;
  const isMyTeamLeading = currentTeam && currentBidderId === currentTeam.id;

  const isApproved = Boolean(currentTeam && currentTeam.verified);
  const isAuctionPhase = gameState?.phase === 'auction';
  const isPausedPhase = gameState?.phase === 'paused';

  // Sync timer with gameState
  useEffect(() => {
    setTimer(gameState?.timerSeconds ?? 15);
    resolvingRef.current = false;
  }, [gameState?.timerSeconds, gameState?.currentBid, currentComponent?.id]);

  // 15s Countdown and Automatic Sold/Unsold trigger on 0s
  useEffect(() => {
    if (!isAuctionPhase || !currentComponent) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Timer reached 0: Automatically sell or mark unsold
          if (!resolvingRef.current) {
            resolvingRef.current = true;
            autoResolveMutation().catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuctionPhase, currentComponent?.id, gameState?.currentBid]);

  const handleQuickBid = async (increment) => {
    if (!currentTeam) {
      showToast('Please login to your team seat first', 'error');
      onOpenLogin();
      return;
    }
    if (!isApproved) {
      showToast('⏳ Your team is awaiting Host Approval before bidding.', 'error');
      return;
    }
    if (!isAuctionPhase || !currentComponent) {
      showToast('No component is currently up for bidding', 'error');
      return;
    }

    const nextBid = currentBid + increment;
    if (nextBid > currentTeam.budget) {
      showToast(`Insufficient budget! Available: ${currentTeam.budget} pts`, 'error');
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
      showToast('Please login to your team seat first', 'error');
      onOpenLogin();
      return;
    }
    if (!isApproved) {
      showToast('⏳ Your team is awaiting Host Approval before bidding.', 'error');
      return;
    }
    if (amount <= currentBid) {
      showToast(`Bid must be strictly higher than ${currentBid} pts`, 'error');
      return;
    }
    if (amount > currentTeam.budget) {
      showToast(`Insufficient budget! Available: ${currentTeam.budget} pts`, 'error');
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

  const timerRadius = 40;
  const circumference = 2 * Math.PI * timerRadius;
  const strokeDashoffset = circumference - (Math.max(0, timer) / 15) * circumference;
  const isUrgentTimer = timer <= 4;
  const isWarningTimer = timer <= 8 && timer > 4;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {/* Celebration Popup (Green for Winner, Red for Loser) */}
      <SoldCelebrationModal lastSoldEvent={gameState?.lastSoldEvent} currentTeam={currentTeam} />

      {/* Paused Banner */}
      {isPausedPhase && (
        <div className="rounded-2xl bg-amber-950/50 border border-amber-500/50 p-3 text-center text-amber-300 font-rajdhani font-bold flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin" />
          <span>⏸️ AUCTION IS TEMPORARILY PAUSED BY HOST</span>
        </div>
      )}

      {/* Main Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Spotlight Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative rounded-3xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {currentComponent ? (
              <div className="space-y-6">
                {/* Header Meta */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-mono-code text-cyan-300 mb-2">
                      <span>#{currentComponent.id}</span>
                      <span>•</span>
                      <span>{currentComponent.role}</span>
                    </div>
                    <h1 className="font-bebas text-4xl sm:text-6xl text-slate-100 tracking-wider glow-text-cyan leading-none">
                      {currentComponent.name}
                    </h1>
                  </div>

                  {/* 15s Circular Animated Timer */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg width="96" height="96" className="timer-circle-svg">
                      <circle
                        cx="48"
                        cy="48"
                        r={timerRadius}
                        stroke="#1e293b"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={timerRadius}
                        stroke={isUrgentTimer ? '#ff0055' : isWarningTimer ? '#f59e0b' : '#00e5ff'}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className={`font-mono-code font-bold text-2xl leading-none ${
                        isUrgentTimer ? 'text-rose-500 animate-ping' : isWarningTimer ? 'text-amber-400' : 'text-cyan-400'
                      }`}>
                        {timer}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* SVG Schematic Spotlight */}
                <div className="relative flex items-center justify-center rounded-2xl bg-slate-950 border border-cyan-500/25 p-6 min-h-[240px] shadow-inner">
                  <img
                    src={currentComponent.image}
                    alt={currentComponent.name}
                    className="max-h-60 max-w-full object-contain filter drop-shadow-[0_0_25px_rgba(0,229,255,0.25)]"
                  />
                  <div className="absolute bottom-3 right-3 rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-xs font-mono-code text-cyan-300">
                    Symbol: <strong>{currentComponent.symbol}</strong>
                  </div>
                </div>

                {/* Spec Description */}
                <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono-code text-slate-400">
                    <span>Classification: <strong className="text-slate-200">{currentComponent.country}</strong></span>
                    <span>Symbol Name: <strong className="text-cyan-400">{currentComponent.symbolName}</strong></span>
                  </div>
                  <p className="text-sm font-rajdhani text-slate-300 leading-relaxed">
                    {currentComponent.description}
                  </p>
                </div>

                {/* Leading Bid Status */}
                <div className={`rounded-2xl border p-4 transition-all ${
                  isMyTeamLeading
                    ? 'bg-emerald-950/50 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : currentBidderTeam
                    ? 'bg-slate-950/90 border-cyan-500/40'
                    : 'bg-slate-950/60 border-slate-800'
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
                        <div className="flex items-center gap-2 justify-end mt-1">
                          {currentBidderTeam.logo && (
                            <img src={currentBidderTeam.logo} alt="" className="h-6 w-6 rounded-full object-cover" />
                          )}
                          <span className={`font-rajdhani font-bold text-xl ${
                            isMyTeamLeading ? 'text-emerald-300' : 'text-cyan-300'
                          }`}>
                            {isMyTeamLeading ? '🏆 YOUR TEAM LEADS!' : currentBidderTeam.name}
                          </span>
                        </div>
                      ) : (
                        <div className="font-rajdhani text-sm text-slate-500 italic mt-1">
                          Base price: {currentComponent.basePrice} pts
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center space-y-3">
                <Zap className="mx-auto h-12 w-12 text-slate-600 animate-pulse" />
                <h3 className="font-bebas text-3xl text-slate-400 tracking-wider">
                  AUCTION STAGE STANDBY
                </h3>
                <p className="text-sm font-rajdhani text-slate-500 max-w-md mx-auto">
                  Waiting for Host to start the live queue...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Bids & Activity (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick 3 Bid Buttons Panel */}
          <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-2xl p-6 shadow-2xl shadow-cyan-500/10 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-cyan-400 flex items-center gap-2">
                <Flame className="h-5 w-5 text-cyan-400" />
                <span>QUICK BID CONTROLS</span>
              </h2>
              {currentTeam && (
                <div className="text-xs font-mono-code text-slate-300">
                  Budget: <strong className="text-emerald-400">{currentTeam.budget} pts</strong>
                </div>
              )}
            </div>

            {/* Exactly 3 Quick Bid Buttons: +1 pt, +2 pts, +5 pts */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleQuickBid(1)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 1 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-4 hover:border-cyan-400 hover:from-cyan-950/50 hover:to-slate-900 transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-400 mb-0.5">+1 Increment</span>
                <span className="font-bebas text-3xl sm:text-4xl text-slate-100 group-hover:text-cyan-200">+1 pt</span>
                <span className="text-[10px] font-mono-code text-slate-400 mt-1">{currentBid + 1} pts</span>
              </button>

              <button
                onClick={() => handleQuickBid(2)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 2 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-4 hover:border-cyan-400 hover:from-cyan-950/50 hover:to-slate-900 transition-all shadow-lg hover:shadow-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-400 mb-0.5">+2 Increment</span>
                <span className="font-bebas text-3xl sm:text-4xl text-slate-100 group-hover:text-cyan-200">+2 pts</span>
                <span className="text-[10px] font-mono-code text-slate-400 mt-1">{currentBid + 2} pts</span>
              </button>

              <button
                onClick={() => handleQuickBid(5)}
                disabled={!isAuctionPhase || !currentComponent || !isApproved || isBidding || (currentBid + 5 > (currentTeam?.budget || 0))}
                className="group relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-950/60 to-slate-900 border border-cyan-400 p-4 hover:border-cyan-300 hover:from-cyan-900/60 hover:to-slate-900 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="font-mono-code text-xs text-cyan-300 mb-0.5">Power Bid</span>
                <span className="font-bebas text-3xl sm:text-4xl text-cyan-300">+5 pts</span>
                <span className="text-[10px] font-mono-code text-cyan-400 mt-1">{currentBid + 5} pts</span>
              </button>
            </div>

            {/* Custom Bid */}
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
              <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 text-center">
                <p className="text-xs font-rajdhani text-slate-400 mb-2">
                  You are observing as guest. Enter your team code to place bids.
                </p>
                <button
                  onClick={onOpenLogin}
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-1.5 text-xs font-rajdhani"
                >
                  Enter Team Code
                </button>
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-2xl p-5 shadow-xl space-y-3">
            <h3 className="font-bebas text-xl text-slate-200 tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>LIVE AUCTION ACTIVITY</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(gameState?.feed || []).slice(0, 15).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 text-xs font-rajdhani text-slate-300 flex items-start gap-2"
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
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bebas text-xl text-slate-200 tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <span>MY ACQUIRED COMPONENTS ({(currentTeam.players || []).length})</span>
                </h3>
                <span className="text-xs font-mono-code text-emerald-400">{currentTeam.budget} pts left</span>
              </div>

              {(currentTeam.players || []).length === 0 ? (
                <p className="text-xs font-rajdhani text-slate-500 italic py-2">
                  No components won yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {currentTeam.players.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 p-2 text-xs font-rajdhani"
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
