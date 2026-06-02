import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  X,
  Search,
  Dumbbell,
  Flame,
  Move,
  Edit3,
  Trash2,
} from 'lucide-react';
import BottomSheet from './BottomSheet';

/**
 * Shared exercise-library picker used by ActiveWorkout (add to session)
 * and Home (add missed exercise in the edit-workout flow). Renders inside
 * a BottomSheet and provides search + category + muscle filtering on top
 * of a list of library exercises.
 *
 * Props:
 *  - open         : boolean — controls visibility (the sheet self-renders
 *                   nothing when false).
 *  - library      : Array<{ _id, name, muscle, type }> — the user's library.
 *  - onClose      : () => void — called by the close button / backdrop.
 *  - onPick       : (exercise) => void — primary action when a card is tapped.
 *                   The parent decides whether to close the sheet afterwards.
 *  - onEdit       : (exercise) => void — optional. When provided, an Edit
 *                   button is rendered on each card.
 *  - onDelete     : (exerciseId) => void — optional. When provided, a Delete
 *                   button is rendered on each card.
 *  - showAddNew   : boolean — when true, render a "+ Add New" link to
 *                   `/add-exercise` in the header. Default false.
 *  - title        : string — header title. Default "Library".
 *  - zIndex       : string — Tailwind z-class for the underlying BottomSheet.
 *                   Default "z-[110]"; pass a higher value when nesting
 *                   inside another modal (e.g. Home's edit-workout sheet).
 *  - maxHeight    : string — passed through to BottomSheet. Default "85vh".
 *  - initialMuscle: string — initial selected muscle filter. Default "Legs".
 *  - lockedCategory: string — when provided (e.g. "Warmup" | "Strength" |
 *                   "Stretching"), the category chip row is hidden and the
 *                   list is forced to that single category. Useful when a
 *                   parent screen has its own category tabs.
 *  - disabledIds  : Set<string> | string[] — exercise ids that are already
 *                   in use (e.g. already added to the active session). Their
 *                   cards remain visible but the pick button is disabled and
 *                   an "Added" badge is shown.
 */
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body'];
const CATEGORIES = ['All', 'Warmup', 'Strength', 'Stretching'];

const ExerciseLibrarySheet = ({
  open,
  library = [],
  onClose,
  onPick,
  onEdit,
  onDelete,
  showAddNew = false,
  title = 'Library',
  zIndex = 'z-[110]',
  maxHeight = '85vh',
  initialMuscle = 'Legs',
  lockedCategory = null,
  disabledIds = null,
}) => {
  // Normalize disabledIds (accept Set, array, or null) into a Set of strings
  // for cheap O(1) lookups inside the render loop.
  const disabledSet = useMemo(() => {
    if (!disabledIds) return null;
    if (disabledIds instanceof Set) {
      return new Set(Array.from(disabledIds, (v) => String(v)));
    }
    return new Set(disabledIds.map((v) => String(v)));
  }, [disabledIds]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeMuscle, setActiveMuscle] = useState(initialMuscle);

  if (!open) return null;

  // When the parent has its own category tabs, force-filter to that one
  // and skip rendering the in-sheet chip row entirely.
  const effectiveCategory = lockedCategory || activeCategory;

  const filtered = library
    .filter((ex) =>
      effectiveCategory === 'All' ? true : ex.type === effectiveCategory,
    )
    .filter(
      (ex) => (ex.muscle || '').toLowerCase() === activeMuscle.toLowerCase(),
    )
    .filter((ex) =>
      (ex.name || '').toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <BottomSheet open onClose={onClose} zIndex={zIndex} maxHeight={maxHeight}>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {showAddNew && (
            <Link
              to="/add-exercise"
              className="flex items-center gap-2 bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 px-4 py-2 rounded-2xl hover:bg-accent-100 dark:hover:bg-accent-900/50 border border-accent-100/50 dark:border-accent-700/50"
            >
              <Plus size={16} strokeWidth={3} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Add New
              </span>
            </Link>
          )}
          <button
            onClick={onClose}
            className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2.5 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-all border border-white/40 dark:border-white/10"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500"
          size={18}
        />
        <input
          type="text"
          placeholder="Search exercise..."
          className="w-full pl-12 pr-4 py-4 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-accent-500 transition-all text-sm text-slate-800 dark:text-slate-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Category filter — hidden when the parent locks the category */}
      {!lockedCategory && (
        <div
          className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Muscle filter */}
      <div
        className="flex gap-2 overflow-x-auto py-4 mb-4 no-scrollbar scroll-smooth border-b border-white/40 dark:border-white/10"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {MUSCLES.map((muscle) => (
          <button
            key={muscle}
            onClick={() => setActiveMuscle(muscle)}
            className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeMuscle === muscle
                ? 'bg-accent-500 text-white shadow-md'
                : 'bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10'
            }`}
          >
            {muscle}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Dumbbell
              size={32}
              className="mx-auto text-slate-200 dark:text-slate-600 mb-2"
            />
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
              No {activeMuscle} exercises found
            </p>
          </div>
        ) : (
          filtered.map((ex) => {
            const isDisabled = !!disabledSet && disabledSet.has(String(ex._id));
            return (
            <div
              key={ex._id}
              className={`w-full flex gap-2 items-center animate-in fade-in duration-300 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-2xl border transition-colors ${
                isDisabled
                  ? 'border-white/20 dark:border-white/5 opacity-60'
                  : 'border-white/40 dark:border-white/10'
              }`}
            >
              <button
                onClick={() => !isDisabled && onPick?.(ex)}
                disabled={isDisabled}
                className={`flex-1 flex justify-between items-center p-4 rounded-2xl transition-colors ${
                  isDisabled
                    ? 'cursor-not-allowed'
                    : 'active:bg-accent-50 dark:active:bg-accent-900/30'
                }`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div
                    className={`p-2 rounded-xl ${
                      ex.type === 'Warmup'
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400'
                        : ex.type === 'Stretching'
                        ? 'text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
                        : 'text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400'
                    }`}
                  >
                    {ex.type === 'Warmup' ? (
                      <Flame size={18} />
                    ) : ex.type === 'Stretching' ? (
                      <Move size={18} />
                    ) : (
                      <Dumbbell size={18} />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm capitalize">
                      {ex.name}
                    </p>
                    <div className='flex gap-2'>
                      <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">
                        {ex.muscle}
                      </p>
                      {isDisabled && (
                        <span className="shrink-0 px-1.5 py-[.5px] rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-widest">
                          Added
                        </span>
                      )}

                    </div>
                  </div>
                </div>
              </button>

              {(onEdit || onDelete) && (
                <div className="flex gap-2 p-4">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(ex)}
                      className="p-2 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(ex._id)}
                      className="p-2 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
};

export default ExerciseLibrarySheet;
