import React, { useEffect, useState } from 'react';
import { Trophy, Award, XCircle, Sparkles, CheckCircle2 } from 'lucide-react';
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

      const isWinner = currentTeam && lastSoldEvent.winnerId === currentTeam.id;
      if (isWinner && !lastSoldEvent.isUnsold) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#00ff88', '#00e5ff', '#ffd700'],
        });
      }

      const timer = setTimeout(() => {
        setVisible(false);
      }, 3600);

      return () => clearTimeout(timer);
    }
  }, [lastSoldEvent?.timestamp, lastSoldEvent?.id]);

  if (!visible || !eventData) return null;

  const isWinner = currentTeam && eventData.winnerId === currentTeam.id;
  const isUnsold = Boolean(eventData.isUnsold);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-lg p-4 animate-in fade-in duration-200 pointer-events-none">
      <div
        className={`pointer-events-auto relative w-full max-w-lg rounded-3xl p-8 text-center shadow-2xl border-2 transition-all transform animate-in zoom-in-95 duration-300 ${
          isWinner && !isUnsold
            ? 'bg-slate-950 border-emerald-400 shadow-[0_0_60px_rgba(0,255,136,0.35)]'
            : !isUnsold
            ? 'bg-slate-950 border-rose-500 shadow-[0_0_60px_rgba(255,0,85,0.35)]'
            : 'bg-slate-950 border-slate-700 shadow-2xl'
        }`}
      >
        {/* Glow Header Icon */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl p-0.5">
          {isWinner && !isUnsold ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 shadow-lg shadow-emerald-500/30">
              <Trophy className="h-10 w-10 animate-bounce" />
            </div>
          ) : !isUnsold ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/30">
              {eventData.winnerLogo ? (
                <img src={eventData.winnerLogo} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <Award className="h-10 w-10" />
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-800 border-2 border-slate-600 text-slate-400">
              <XCircle className="h-10 w-10" />
            </div>
          )}
        </div>

        {/* Title */}
        {isWinner && !isUnsold ? (
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs font-mono-code text-emerald-300 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>BID WON! ADDED TO INVENTORY</span>
            </div>
            <h2 className="font-bebas text-4xl sm:text-5xl tracking-wider text-emerald-400 glow-text-green">
              YOU WON THIS COMPONENT!
            </h2>
          </div>
        ) : !isUnsold ? (
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-400/50 px-3 py-1 text-xs font-mono-code text-rose-300 mb-2">
              <span>⚡ SOLD TO OPPONENT</span>
            </div>
            <h2 className="font-bebas text-3xl sm:text-5xl tracking-wider text-rose-400">
              SOLD TO: {eventData.winnerName}
            </h2>
          </div>
        ) : (
          <div>
            <h2 className="font-bebas text-3xl sm:text-4xl tracking-wider text-slate-400">
              COMPONENT UNSOLD
            </h2>
            <p className="text-xs font-rajdhani text-slate-500">Passed with 0 bids placed</p>
          </div>
        )}

        {/* Component Showcase inside Modal */}
        <div className="my-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-4 text-left">
          {eventData.componentImage && (
            <img
              src={eventData.componentImage}
              alt=""
              className="h-16 w-16 object-contain bg-slate-950 rounded-xl p-1.5 border border-slate-800 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bebas text-2xl text-slate-100 tracking-wider truncate">
              {eventData.componentName}
            </h3>
            <div className="font-mono-code text-sm font-bold text-slate-300">
              Final Price:{' '}
              <strong className={isWinner ? 'text-emerald-400 text-lg' : 'text-rose-400 text-lg'}>
                {eventData.soldPrice} pts
              </strong>
            </div>
          </div>
        </div>

        {/* Winner Profile Badge */}
        {!isUnsold && (
          <div className="flex items-center justify-center gap-2 text-xs font-rajdhani text-slate-400">
            {eventData.winnerLogo && (
              <img src={eventData.winnerLogo} alt="" className="h-5 w-5 rounded-full object-cover" />
            )}
            <span>Acquired by: <strong className="text-slate-200">{eventData.winnerName}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
