import React from 'react';
import { X } from 'lucide-react';
import BottomSheet from './BottomSheet';

/**
 * Shared "Exercise History" bottom sheet used by Reports and ActiveWorkout.
 * Renders a timeline of past sessions for a single exercise (PR history).
 *
 * Props:
 *  - data         : { name: string, history: Array } | null. Sheet visibility
 *                   is driven by `data` truthiness.
 *  - onClose      : () => void.
 *  - historyLimit : number — how many sessions to display.
 *  - onLoadMore   : () => void — invoked when "Show 5 More Sessions" is tapped.
 */
const ExerciseHistorySheet = ({ data, onClose, historyLimit, onLoadMore }) => {
  if (!data) return null;

  const { name, history } = data;
  const visible = history.slice(0, historyLimit);
  const hasMore = historyLimit < history.length;

  return (
    <BottomSheet
      open
      onClose={onClose}
      zIndex="z-[500]"
      maxHeight="85vh"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight capitalize">
            {name}
          </h2>
          <p className="text-accent-500 dark:text-accent-400 font-bold text-[10px] uppercase tracking-[0.2em]">
            Full History
          </p>
        </div>
        <button
          onClick={onClose}
          className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {visible.length > 0 ? (
          visible.map((entry, idx) => (
            <div
              key={idx}
              className="relative pl-6 border-l-2 border-white/40 dark:border-white/10 pb-2"
            >
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-accent-500" />

              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                    {new Date(entry.date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm capitalize">
                      {entry.workoutName || 'Routine'}
                    </h4>
                    {Number(entry.resistance) > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                        <div className="w-1 h-1 rounded-full bg-amber-400" />
                        +{entry.resistance}kg
                      </span>
                    )}
                    {entry.execution === 'Unilateral' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 dark:bg-fuchsia-700/10 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-100 dark:border-fuchsia-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                        <div className="w-1 h-1 rounded-full bg-fuchsia-400" />
                        Unilateral
                      </span>
                    )}
                    {entry.execution === 'Bilateral' && (
                      <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                        Bilateral
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {entry.sets.map((set, sIdx) => (
                  <div
                    key={sIdx}
                    className="bg-white/40 dark:bg-black/15 backdrop-blur-md px-3 py-2 rounded-xl border border-white/40 dark:border-white/10 flex justify-between items-center"
                  >
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                      SET {sIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {entry.type === 'Strength'
                        ? `${set.weight}kg x ${set.reps}`
                        : `${set.time}s`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-slate-400 dark:text-slate-500 text-xs italic">
            No history found for this exercise.
          </p>
        )}

        {hasMore && (
          <button
            onClick={onLoadMore}
            className="w-full py-4 mt-4 text-[10px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-accent-100 dark:border-accent-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Show 5 More Sessions
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full mt-8 bg-slate-900 dark:bg-slate-700 text-white font-bold py-4 rounded-2xl"
      >
        CLOSE
      </button>
    </BottomSheet>
  );
};

export default ExerciseHistorySheet;
