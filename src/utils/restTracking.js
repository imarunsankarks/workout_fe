export const findActiveRest = (exercises) => {
  for (const exercise of exercises) {
    const setIndex = exercise.sets.findIndex(
      (set) => set.completed && Number.isFinite(set.restStartedAt) && set.restStartedAt > 0,
    );
    if (setIndex !== -1) {
      return {
        exerciseId: exercise.instanceId,
        setIndex,
        startedAt: exercise.sets[setIndex].restStartedAt,
      };
    }
  }
  return null;
};

export const toggleCompletedSet = (exercises, exerciseId, setIndex, now) => {
  let rest = null;
  const updated = exercises.map((exercise) => {
    if (exercise.instanceId !== exerciseId || !exercise.sets[setIndex]) return exercise;
    const sets = [...exercise.sets];
    const set = sets[setIndex];
    const completed = !set.completed;
    sets[setIndex] = {
      ...set,
      completed,
      restSeconds: 0,
      restStartedAt: completed ? now : null,
      ...(completed && exercise.isRunning && exercise.activeSetIdx === setIndex
        ? {
            time: (set.time || 0) +
              (set.startedAt ? Math.max(0, Math.floor((now - set.startedAt) / 1000)) : 0),
            startedAt: null,
          }
        : {}),
    };
    if (completed) rest = { exerciseId, setIndex, startedAt: now };
    return {
      ...exercise,
      sets,
      isRunning: completed && exercise.activeSetIdx === setIndex ? false : exercise.isRunning,
    };
  });
  return { exercises: updated, rest };
};

export const finishRest = (exercises, rest, now) => exercises.map((exercise) => {
  if (exercise.instanceId !== rest.exerciseId) return exercise;
  const set = exercise.sets[rest.setIndex];
  if (!set || set.restStartedAt !== rest.startedAt) return exercise;
  const sets = [...exercise.sets];
  sets[rest.setIndex] = {
    ...set,
    restSeconds: Math.max(0, Math.floor((now - rest.startedAt) / 1000)),
    restStartedAt: null,
  };
  return { ...exercise, sets };
});
