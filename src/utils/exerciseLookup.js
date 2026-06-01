/**
 * Helpers for resolving an exercise's display data through the user's
 * library. Workouts store only `exerciseId`; everything user-visible
 * (name, etc.) is looked up live so renames propagate retroactively.
 *
 * Workout detail shape:
 *   { exerciseId: string, type?: string, muscle?: string, sets, ... }
 *
 * Library item shape:
 *   { _id: string, name: string, muscle: string, type: string, ... }
 */

/**
 * Build a quick lookup map from a library array. Returns an empty Map for
 * a missing/empty list so callers don't have to null-check.
 */
export const buildLibraryMap = (library) => {
  const map = new Map();
  if (!Array.isArray(library)) return map;
  for (const item of library) {
    if (item && item._id) map.set(String(item._id), item);
  }
  return map;
};

/**
 * Resolve the canonical library entry for a workout detail, if any.
 */
export const resolveExercise = (detail, libraryMap) => {
  if (!detail || !libraryMap) return null;
  const id = detail.exerciseId && String(detail.exerciseId);
  if (!id) return null;
  return libraryMap.get(id) || null;
};

/**
 * Display name for a workout detail, resolved through the library so
 * renames propagate retroactively. Returns "Unknown Exercise" if the
 * referenced library entry has been deleted (should not happen in
 * normal flows since the library uses soft-delete).
 */
export const getDisplayName = (detail, libraryMap) => {
  const lib = resolveExercise(detail, libraryMap);
  return (lib && lib.name) || "Unknown Exercise";
};

/**
 * Stable identity key for grouping / comparing details across workouts.
 */
export const getExerciseKey = (detail) => {
  if (!detail || !detail.exerciseId) return "";
  return String(detail.exerciseId);
};
