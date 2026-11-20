import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const RING_RADIUS = 98;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const formatRestTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const RestTimer = ({ startedAt, onClose }) => {
  const [seconds, setSeconds] = useState(0);
  const closeRef = useRef(null);
  const minuteProgress = seconds % 60;

  useEffect(() => {
    closeRef.current?.focus();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rest timer"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden bg-[#0c0a1a] text-white p-6"
      style={{ backgroundImage: "radial-gradient(circle at 50% 43%, rgb(var(--accent-500) / 0.18), transparent 55%)" }}
    >
      <div className="absolute top-8 left-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
        Rest & Recover
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close rest timer"
      >
        <X size={20} />
      </button>
      <div className="relative w-full max-w-sm text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-300 mb-8">
          Set complete
        </p>
        <div className="relative w-full max-w-[340px] aspect-square mx-auto">
          <svg viewBox="0 0 240 240" className="w-full h-full -rotate-90" aria-hidden="true">
            <defs>
              <linearGradient id="rest-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(var(--accent-from))" />
                <stop offset="55%" stopColor="rgb(var(--accent-via))" />
                <stop offset="100%" stopColor="rgb(var(--accent-to))" />
              </linearGradient>
            </defs>
            <circle cx="120" cy="120" r={RING_RADIUS} fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="10" />
            <circle
              key={Math.floor(seconds / 60)}
              cx="120"
              cy="120"
              r={RING_RADIUS}
              fill="none"
              stroke="url(#rest-ring-gradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - minuteProgress / 60)}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40 mb-3">
              Rest time
            </p>
            <p
              className="text-[clamp(3.5rem,17vw,5rem)] leading-none font-mono font-bold tabular-nums tracking-tight"
              role="timer"
              aria-label={`Rest time ${formatRestTime(seconds)}`}
            >
              {formatRestTime(seconds)}
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Progress through current rest minute"
          aria-valuemin={0}
          aria-valuemax={60}
          aria-valuenow={minuteProgress}
          className="sr-only"
        />
        <p className="text-xs text-white/40 mt-6">
          The ring fills once every minute.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-12 px-10 py-4 rounded-full bg-white/10 border border-white/10 text-white text-sm font-bold hover:bg-white/20 active:scale-95 transition-all"
        >
          End rest
        </button>
      </div>
    </div>
  );
};

export default RestTimer;
