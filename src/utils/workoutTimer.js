// Single source of truth for the active workout timer.
// One interval, multiple subscribers — components/hooks subscribe to receive
// the live elapsed seconds without forcing the ActiveWorkout parent to
// re-render every second.

const listeners = new Set();
let interval = null;
let lastEmitted = null; // { isActive, seconds } | null

const readSessionState = () => {
    if (typeof window === "undefined") return null;
    const exercisesRaw = localStorage.getItem("active_session_exercises");
    if (!exercisesRaw) return null;
    try {
        const arr = JSON.parse(exercisesRaw);
        if (!Array.isArray(arr)) return null;
    } catch {
        return null;
    }

    const isActive = JSON.parse(
        localStorage.getItem("active_session_is_active") || "false",
    );
    const base = parseInt(
        localStorage.getItem("active_session_base_seconds") || "0",
        10,
    );
    const lastUnpaused = parseInt(
        localStorage.getItem("active_session_last_unpaused") || "0",
        10,
    );
    const stored = parseInt(
        localStorage.getItem("active_session_seconds") || "0",
        10,
    );

    if (isActive && lastUnpaused) {
        const passed = Math.floor((Date.now() - lastUnpaused) / 1000);
        return { isActive: true, seconds: base + passed };
    }
    return { isActive: false, seconds: stored };
};

const emit = () => {
    const state = readSessionState();
    lastEmitted = state;
    listeners.forEach((cb) => {
        try {
            cb(state);
        } catch (e) {
            console.error("workoutTimer listener error", e);
        }
    });
};

const start = () => {
    if (interval) return;
    emit(); // immediate tick
    interval = setInterval(emit, 1000);
};

const stop = () => {
    if (!interval) return;
    clearInterval(interval);
    interval = null;
};

export const subscribeWorkoutTimer = (cb) => {
    listeners.add(cb);
    if (lastEmitted !== null) cb(lastEmitted);
    if (listeners.size === 1) start();
    else emit(); // ensure new subscriber gets fresh state
    return () => {
        listeners.delete(cb);
        if (listeners.size === 0) stop();
    };
};

// Optional helper for code paths that need a one-off read.
export const readWorkoutTimer = readSessionState;
