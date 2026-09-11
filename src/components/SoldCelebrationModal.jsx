import React, { useEffect, useState } from 'react';
import { Trophy, Award, XCircle, Sparkles, CheckCircle2, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

export function SoldCelebrationModal({ lastSoldEvent, currentTeam }) {
  const [visible, setVisible] = useState(false);
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    if (!lastSoldEvent || !lastSoldEvent.timestamp) return;

    // Check if event is recent (within 5 seconds)
    const isRecent = Date.now() - lastSoldEvent.timestamp < 5000;
    if (isRecent) {
      setEventData(lastSoldEvent);
      setVisible(true);

      const isWinner = Boolean(currentTeam && lastSoldEvent.winnerId === currentTeam.id);
      if (isWinner && !lastSoldEvent.isUnsold) {
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#00ff88', '#00e5ff', '#ffd700', '#ffffff'],
          });
        } catch (e) {}
      }

      const timer = setTimeout(() => {
        setVisible(false);
      }, 3800);

      return () => clearTimeout(timer);
    }
  }, [lastSoldEvent?.timestamp, lastSoldEvent?.id]);

  if (!visible || !eventData) return null;

  const isWinner = Boolean(currentTeam && eventData.winnerId === currentTeam.id);
  const isUnsold = Boolean(eventData.isUnsold);
  const winnerLogo = eventData.winnerLogo || (isWinner ? currentTeam?.logo : null);
  const winnerName = eventData.winnerName || (isWinner ? currentTeam?.name : 'Winning Team');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 pointer-events-none">
      <div
        className={`pointer-events-auto relative w-full max-w-md rounded-3xl p-6 sm:p-8 text-center shadow-2xl border-2 transition-all transform animate-in zoom-in-95 duration-300 ${
          isWinner && !isUnsold
            ? 'bg-slate-950 border-emerald-400 shadow-[0_0_80px_rgba(0,255,136,0.45)]'
            : !isUnsold
            ? 'bg-slate-950 border-rose-500 shadow-[0_0_80px_rgba(255,0,85,0.45)]'
            : 'bg-slate-950 border-slate-700 shadow-2xl'
        }`}
      >
        {/* Glow Header Profile Image / Avatar Frame */}
        <div className="mx-auto mb-4 relative flex items-center justify-center">
          {!isUnsold ? (
            <div className="relative group">
              {/* Outer Pulsing Glow */}
              <div
                className={`absolute -inset-2 rounded-full blur-lg opacity-75 animate-pulse ${
                  isWinner ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />

              {/* Profile Image / Avatar Container */}
              <div
                className={`relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full overflow-hidden border-4 shadow-2xl bg-slate-900 ${
                  isWinner ? 'border-emerald-400' : 'border-rose-500'
                }`}
              >
                {winnerLogo ? (
                  <img
                    src={winnerLogo}
                    alt={winnerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-4xl">
                    {isWinner ? (currentTeam?.icon || '⚡') : '👑'}
                  </div>
                )}
              </div>

              {/* Badge Overlay */}
              <div
                className={`absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-950 shadow-md ${
                  isWinner ? 'bg-emerald-400 text-slate-950' : 'bg-rose-500 text-slate-100'
                }`}
              >
                {isWinner ? <Trophy className="h-5 w-5 animate-bounce" /> : <Zap className="h-5 w-5" />}
              </div>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-slate-400 shadow-xl">
              <XCircle className="h-10 w-10 text-rose-500" />
            </div>
          )}
        </div>

        {/* Title & Announcement */}
        {isWinner && !isUnsold ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs font-mono-code text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
              <span>COMPONENT ACQUIRED!</span>
            </div>
            <h2 className="font-bebas text-3xl sm:text-5xl tracking-wider text-emerald-400 glow-text-green leading-none pt-1">
              YOU WON THIS BID!
            </h2>
            <p className="text-xs font-rajdhani font-bold text-slate-300">
              Team: <strong className="text-emerald-300">{winnerName}</strong>
            </p>
          </div>
        ) : !isUnsold ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-400/50 px-3 py-1 text-xs font-mono-code text-rose-300">
              <span>⚡ SOLD TO OPPONENT</span>
            </div>
            <h2 className="font-bebas text-2xl sm:text-4xl tracking-wider text-rose-400 leading-none pt-1">
              SOLD TO: {winnerName}
            </h2>
          </div>
        ) : (
          <div className="space-y-1">
            <h2 className="font-bebas text-3xl sm:text-4xl tracking-wider text-slate-300">
              COMPONENT UNSOLD
            </h2>
            <p className="text-xs font-rajdhani text-slate-500">Passed with 0 bids</p>
          </div>
        )}

        {/* Component Card Summary */}
        <div className="my-5 rounded-2xl bg-slate-900/95 border border-slate-800 p-3.5 flex items-center gap-3.5 text-left shadow-inner">
          {eventData.componentImage && (
            <div className="h-14 w-14 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shrink-0">
              <img
                src={eventData.componentImage}
                alt={eventData.componentName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bebas text-xl sm:text-2xl text-slate-100 tracking-wider truncate">
              {eventData.componentName}
            </h3>
            <div className="font-mono-code text-xs font-bold text-slate-400">
              Sold Price:{' '}
              <strong className={`text-base font-bold ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
                {eventData.soldPrice} pts
              </strong>
            </div>
          </div>
        </div>

        {/* Footer Dismiss Note */}
        <div className="text-[10px] font-mono-code text-slate-500">
          Auto-advancing to next component...
        </div>
      </div>
    </div>
  );
}
