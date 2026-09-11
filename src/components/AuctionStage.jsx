import React, { useState, useEffect, useRef } from 'react';
import { Zap, Clock, ShieldCheck, ShieldAlert, Award, Flame, Layers, Users, Sparkles, Pause, ArrowRight, FileDown } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { SoldCelebrationModal } from './SoldCelebrationModal';
import { downloadTeamReportPDF } from '../utils/pdfGenerator';

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
  const isMyTeamLeading = Boolean(currentTeam && currentBidderId === currentTeam.id);

  const isApproved = Boolean(currentTeam && currentTeam.verified);
  const isAuctionPhase = gameState?.phase === 'auction';
  const isPausedPhase = gameState?.phase === 'paused';

  const myWonItems = currentTeam?.players || [];
  const totalSpent = myWonItems.reduce((sum, item) => sum + (item.soldPrice || item.basePrice || 0), 0);

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
          // Timer reached 0: Automatically sell to highest bidder or mark unsold
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
      showToast('No component is currently active for bidding', 'error');
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

  const timerRadius = 36;
  const circumference = 2 * Math.PI * timerRadius;
  const strokeDashoffset = circumference - (Math.max(0, timer) / 15) * circumference;
  const isUrgentTimer = timer <= 4;
  const isWarningTimer = timer <= 8 && timer > 4;

  return (
    <div className="relative z-10 h-[calc(100vh-4.25rem)] flex flex-col overflow-hidden max-w-7xl mx-auto px-3 py-2 sm:px-4">
      {/* Real-time Global Sold Celebration Overlay (Green for Winner, Red for Losers) */}
      <SoldCelebrationModal lastSoldEvent={gameState?.lastSoldEvent} currentTeam={currentTeam} />

      {/* Paused Banner Overlay */}
      {isPausedPhase && (
        <div className="shrink-0 mb-2 rounded-xl bg-amber-950/80 border border-amber-500/60 p-2 text-center text-amber-300 font-rajdhani font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
          <Pause className="h-4 w-4 animate-pulse text-amber-400" />
          <span>⏸️ AUCTION IS PAUSED BY HOST — REMAIN ON STAGE, BIDDING RESUMES SHORTLY</span>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 rounded-2xl bg-slate-900/90 border border-slate-800 px-4 py-2 mb-2 shadow-md">
        <div className="flex items-center gap-3">
          {currentTeam ? (
            <div className="flex items-center gap-2">
              {currentTeam.logo ? (
                <img src={currentTeam.logo} alt="" className="h-7 w-7 rounded-lg object-cover border border-cyan-400" />
              ) : (
                <span className="text-lg">{currentTeam.icon || '⚡'}</span>
              )}
              <span className="font-rajdhani font-bold text-sm text-slate-100">{currentTeam.name}</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono-code text-emerald-400 font-bold border border-slate-700">
                {currentTeam.budget} pts remaining
              </span>
            </div>
          ) : (
            <div className="text-xs font-rajdhani text-slate-400">
              Spectator Mode • <button onClick={onOpenLogin} className="text-cyan-400 underline font-bold">Login to Bid</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAuctionPhase && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-mono-code text-rose-400 border border-rose-500/40">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>LIVE BIDDING</span>
            </span>
          )}
          <span className="text-xs font-mono-code text-slate-400">
            Queue Remaining: <strong className="text-cyan-400">{gameState?.auctionQueue?.length ?? 53}</strong>
          </span>
        </div>
      </div>

      {/* Main 3-Column Fixed Desktop Layout (Non-scrollable outer page) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* LEFT COLUMN: List of Components This Team Has Bought (3 cols) */}
        <div className="lg:col-span-3 flex flex-col min-h-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg backdrop-blur-md">
          <div className="shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-400" />
              <h3 className="font-bebas text-lg text-slate-100 tracking-wider">MY ACQUIRED ITEMS</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-code text-emerald-400 font-bold">
                {myWonItems.length} items
              </span>
              {currentTeam && (
                <button
                  onClick={() => downloadTeamReportPDF(currentTeam)}
                  className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 transition-colors"
                  title="Download Team 1-Page PDF Report"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {myWonItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 space-y-2">
                <Layers className="h-8 w-8 opacity-30" />
                <p className="text-xs font-rajdhani">
                  No components acquired yet.<br />Place bids on the center stage to win!
                </p>
              </div>
            ) : (
              myWonItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 rounded-xl bg-slate-950/80 border border-slate-800 p-2 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 p-1 border border-slate-800 shrink-0">
                    <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-rajdhani font-bold text-xs text-slate-200 truncate">{item.name}</div>
                    <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400">
                      <span>#{item.id}</span>
                      <span className="text-emerald-400 font-bold">{item.soldPrice || item.basePrice} pts</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {currentTeam && (
            <div className="shrink-0 pt-2 mt-2 border-t border-slate-800 text-[11px] font-mono-code text-slate-400 flex justify-between">
              <span>Total Spent: <strong className="text-rose-400">{totalSpent} pts</strong></span>
              <span>Remaining: <strong className="text-emerald-400">{currentTeam.budget} pts</strong></span>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Component Spotlight & Bidding Controls (6 cols) */}
        <div className="lg:col-span-6 flex flex-col min-h-0 rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl relative overflow-hidden justify-between">
          <div className="absolute top-0 right-0 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {currentComponent ? (
            <div className="flex flex-col flex-1 min-h-0 justify-between space-y-3">
              {/* Component Info Header & Circular Timer */}
              <div className="flex items-start justify-between gap-3 shrink-0">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-mono-code text-cyan-300 mb-1">
                    <span>#{currentComponent.id}</span>
                    <span>•</span>
                    <span>{currentComponent.role}</span>
                  </div>
                  <h1 className="font-bebas text-3xl sm:text-4xl text-slate-100 tracking-wider glow-text-cyan leading-none">
                    {currentComponent.name}
                  </h1>
                </div>

                {/* 15s Circular Animated Timer */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg width="78" height="78" className="timer-circle-svg">
                    <circle cx="39" cy="39" r={timerRadius} stroke="#1e293b" strokeWidth="6" fill="transparent" />
                    <circle
                      cx="39"
                      cy="39"
                      r={timerRadius}
                      stroke={isUrgentTimer ? '#ff0055' : isWarningTimer ? '#f59e0b' : '#00e5ff'}
                      strokeWidth="6"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className={`font-mono-code font-bold text-xl leading-none ${
                      isUrgentTimer ? 'text-rose-500 animate-ping' : isWarningTimer ? 'text-amber-400' : 'text-cyan-400'
                    }`}>
                      {timer}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Component SVG Schematic Spotlight */}
              <div className="relative flex-1 min-h-[140px] max-h-[220px] flex items-center justify-center rounded-xl bg-slate-950 border border-cyan-500/20 p-3 shadow-inner">
                <img
                  src={currentComponent.image}
                  alt={currentComponent.name}
                  className="max-h-full max-w-full object-contain filter drop-shadow-[0_0_20px_rgba(0,229,255,0.25)]"
                />
                <div className="absolute bottom-2 right-2 rounded-lg bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-mono-code text-cyan-300">
                  Symbol: <strong>{currentComponent.symbol}</strong>
                </div>
              </div>

              {/* Leading Bid Status Banner */}
              <div className={`shrink-0 rounded-xl border p-2.5 transition-all ${
                isMyTeamLeading
                  ? 'bg-emerald-950/60 border-emerald-400 shadow-md shadow-emerald-500/20'
                  : currentBidderTeam
                  ? 'bg-slate-950/90 border-cyan-500/40'
                  : 'bg-slate-950/70 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400 block">
                      Current Top Bid
                    </span>
                    <div className="font-mono-code font-bold text-2xl sm:text-3xl text-emerald-400 glow-text-green leading-none mt-0.5">
                      {currentBid} pts
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400 block">
                      Leading Bidder
                    </span>
                    {currentBidderTeam ? (
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {currentBidderTeam.logo && (
                          <img src={currentBidderTeam.logo} alt="" className="h-5 w-5 rounded-full object-cover" />
                        )}
                        <span className={`font-rajdhani font-bold text-base ${
                          isMyTeamLeading ? 'text-emerald-300 animate-pulse' : 'text-cyan-300'
                        }`}>
                          {isMyTeamLeading ? '👑 YOUR TEAM LEADS!' : currentBidderTeam.name}
                        </span>
                      </div>
                    ) : (
                      <span className="font-rajdhani text-xs text-slate-400 italic">
                        Base: {currentComponent.basePrice} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Bidding Controls: Quick 3 Bids (+1, +2, +5) & Custom Bid */}
              <div className="shrink-0 space-y-2 pt-1 border-t border-slate-800/80">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleQuickBid(1)}
                    disabled={!isAuctionPhase || !isApproved || isBidding || (currentBid + 1 > (currentTeam?.budget || 0))}
                    className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-2 hover:border-cyan-400 hover:from-cyan-950/50 hover:to-slate-900 transition-all shadow-md disabled:opacity-35 disabled:pointer-events-none"
                  >
                    <span className="font-bebas text-xl sm:text-2xl text-slate-100 group-hover:text-cyan-200 leading-none">+1 pt</span>
                    <span className="text-[10px] font-mono-code text-cyan-400 mt-0.5">{currentBid + 1} pts</span>
                  </button>

                  <button
                    onClick={() => handleQuickBid(2)}
                    disabled={!isAuctionPhase || !isApproved || isBidding || (currentBid + 2 > (currentTeam?.budget || 0))}
                    className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/40 p-2 hover:border-cyan-400 hover:from-cyan-950/50 hover:to-slate-900 transition-all shadow-md disabled:opacity-35 disabled:pointer-events-none"
                  >
                    <span className="font-bebas text-xl sm:text-2xl text-slate-100 group-hover:text-cyan-200 leading-none">+2 pts</span>
                    <span className="text-[10px] font-mono-code text-cyan-400 mt-0.5">{currentBid + 2} pts</span>
                  </button>

                  <button
                    onClick={() => handleQuickBid(5)}
                    disabled={!isAuctionPhase || !isApproved || isBidding || (currentBid + 5 > (currentTeam?.budget || 0))}
                    className="group flex flex-col items-center justify-center rounded-xl bg-gradient-to-b from-cyan-950/70 to-slate-900 border border-cyan-400 p-2 hover:border-cyan-300 hover:from-cyan-900/70 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-35 disabled:pointer-events-none"
                  >
                    <span className="font-bebas text-xl sm:text-2xl text-cyan-300 leading-none">+5 pts</span>
                    <span className="text-[10px] font-mono-code text-cyan-400 mt-0.5">{currentBid + 5} pts</span>
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
                    disabled={!isAuctionPhase || !isApproved || isBidding}
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono-code disabled:opacity-35"
                  />
                  <button
                    type="submit"
                    disabled={!isAuctionPhase || !isApproved || isBidding || !customBid}
                    className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-rajdhani font-bold px-4 py-1.5 text-xs shadow-md disabled:opacity-35"
                  >
                    BID
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Zap className="h-12 w-12 text-slate-600 animate-pulse" />
              <h3 className="font-bebas text-2xl text-slate-300 tracking-wider">AUCTION STAGE STANDBY</h3>
              <p className="text-xs font-rajdhani text-slate-500 max-w-xs">
                Waiting for Host to spotlight the next component...
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Updates in Mini Bar & Registered Teams (3 cols) */}
        <div className="lg:col-span-3 flex flex-col min-h-0 space-y-3">
          {/* Live Activity Feed */}
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg backdrop-blur-md">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h3 className="font-bebas text-lg text-slate-100 tracking-wider">LIVE UPDATES</h3>
              </div>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {(gameState?.feed || []).slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-2 font-rajdhani text-slate-300 flex items-start gap-1.5 leading-snug"
                >
                  <span className="font-mono-code text-[9px] text-slate-500 shrink-0 mt-0.5">
                    {new Date(item.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="flex-1">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Registered Teams Mini Bar */}
          <div className="h-44 shrink-0 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg backdrop-blur-md">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <h4 className="font-bebas text-base text-slate-200 tracking-wider">TEAMS ARENA ({teamList.length})</h4>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1">
              {teamList.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800/60 px-2 py-1 text-xs font-rajdhani"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {t.logo ? (
                      <img src={t.logo} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="text-[10px]">{t.icon || '⚡'}</span>
                    )}
                    <span className="font-bold text-slate-200 truncate">{t.name}</span>
                  </div>
                  <div className="text-right font-mono-code text-[11px] text-emerald-400 font-bold shrink-0 ml-2">
                    {t.budget} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
