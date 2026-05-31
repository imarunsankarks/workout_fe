import React from 'react';
import { Dumbbell, Flame, Move } from 'lucide-react';

/**
 * Shared "Edit Exercise" modal used by Library and ActiveWorkout pages.
 * Renders a centered glass modal with fields for name, category (type) and
 * target muscle. The parent owns the exercise object and supplies update +
 * save callbacks.
 *
 * Props:
 *  - exercise   : { name, type, muscle, ... } | null — visibility is driven
 *                 by truthiness.
 *  - onChange   : (nextExercise) => void — receives a new exercise object.
 *  - onClose    : () => void — Cancel / backdrop / Escape.
 *  - onSave     : () => void — primary action.
 *  - saving     : boolean — disables Save and shows pending label.
 *  - saveLabel  : string — primary button label. Default "Save".
 */
const TYPES = [
  { id: 'Strength', icon: <Dumbbell size={16} /> },
  { id: 'Warmup', icon: <Flame size={16} /> },
  { id: 'Stretching', icon: <Move size={16} /> },
];

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body'];

const EditExerciseModal = ({
  exercise,
  onChange,
  onClose,
  onSave,
  saving = false,
  saveLabel = 'Save',
}) => {
  React.useEffect(() => {
    if (!exercise) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [exercise, onClose]);

  if (!exercise) return null;

  const update = (patch) => onChange?.({ ...exercise, ...patch });

  return (
    <div
      className="fixed inset-0 bg-black/10 backdrop-blur-xl z-[300] flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white/70 dark:bg-black/10 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          Edit Exercise
        </h2>

        <div className="space-y-6 text-left">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              Exercise Name
            </label>
            <input
              type="text"
              value={exercise.name || ''}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-xl font-bold outline-none focus:ring-2 focus:ring-accent-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update({ type: t.id })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                    exercise.type === t.id
                      ? 'border-slate-900 dark:border-slate-600 bg-slate-900 dark:bg-slate-700 text-white shadow-md'
                      : 'border-white/40 dark:border-white/10 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {t.icon}
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{t.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Muscle */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              Target Muscle
            </label>
            <div
              className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
              style={{ scrollbarWidth: 'none' }}
            >
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ muscle: m })}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${
                    exercise.muscle === m
                      ? 'bg-accent-600 border-accent-600 text-white'
                      : 'bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border-white/40 dark:border-white/10 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-white/40 dark:hover:bg-white/5 rounded-2xl transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-4 bg-accent-gradient text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100"
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExerciseModal;
