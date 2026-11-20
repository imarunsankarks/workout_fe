import { findActiveRest, toggleCompletedSet, finishRest } from "./restTracking";

const exercise = {
  instanceId: "exercise-1",
  type: "Strength",
  sets: [{ weight: "50", reps: "8" }, { weight: "60", reps: "6" }],
};

test("completed sets and running rest survive serialization and reload", () => {
  const marked = toggleCompletedSet([exercise], "exercise-1", 0, 100000);
  expect(marked.exercises[0].sets[0]).toMatchObject({
    completed: true,
    restStartedAt: 100000,
    restSeconds: 0,
  });
  expect(marked.exercises[0].sets[1].completed).toBeUndefined();

  const restored = JSON.parse(JSON.stringify(marked.exercises));
  const activeRest = findActiveRest(restored);
  expect(activeRest).toEqual({ exerciseId: "exercise-1", setIndex: 0, startedAt: 100000 });

  const finished = finishRest(restored, activeRest, 165000);
  expect(finished[0].sets[0]).toMatchObject({
    completed: true,
    restStartedAt: null,
    restSeconds: 65,
  });
  expect(findActiveRest(finished)).toBeNull();
  expect(toggleCompletedSet(finished, "exercise-1", 0, 170000).exercises[0].sets[0]).toMatchObject({
    completed: false,
    restSeconds: 0,
    restStartedAt: null,
  });
});

test("marking a timed set stops its clock while starting rest", () => {
  const timed = [{
    instanceId: "warmup-1",
    type: "Warmup",
    isRunning: true,
    activeSetIdx: 0,
    sets: [{ time: 10, startedAt: 100000 }],
  }];
  const { exercises, rest } = toggleCompletedSet(timed, "warmup-1", 0, 103700);
  expect(exercises[0].isRunning).toBe(false);
  expect(exercises[0].sets[0]).toMatchObject({ time: 13, startedAt: null, completed: true });
  expect(rest.startedAt).toBe(103700);
});
