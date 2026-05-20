import { useEffect, useRef } from "react";
import { subscribeWorkoutTimer } from "../utils/workoutTimer";

// --- ONGOING WORKOUT NOTIFICATION (APP-LEVEL) ---
// Drives a sticky notification that shows a live session timer regardless of
// which page the user is on. Subscribes to the shared workoutTimer source
// so we don't run a second interval and so the time stays in lockstep with
// the in-app SessionTimer display.

const formatTime = (s) => {
    const total = Math.max(0, Math.floor(s));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const postToSW = (msg) => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) => {
            const target = navigator.serviceWorker.controller || reg.active;
            if (target) target.postMessage(msg);
        })
        .catch(() => { });
};

const ensurePermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
        const r = await Notification.requestPermission();
        return r === "granted";
    } catch {
        return false;
    }
};

const useWorkoutNotification = () => {
    const lastSentRef = useRef(null);
    const hadSessionRef = useRef(false);
    const permissionResolvedRef = useRef(null);

    useEffect(() => {
        let stopped = false;

        const handle = (state) => {
            if (stopped) return;

            if (!state) {
                if (hadSessionRef.current) {
                    postToSW({ type: "WORKOUT_NOTIFICATION_CLEAR" });
                    hadSessionRef.current = false;
                    lastSentRef.current = null;
                }
                return;
            }

            // Resolve permission lazily, once per app lifetime.
            if (permissionResolvedRef.current === null) {
                permissionResolvedRef.current = ensurePermission();
            }

            permissionResolvedRef.current.then((ok) => {
                if (!ok || stopped) return;

                hadSessionRef.current = true;
                const status = state.isActive ? "In progress" : "Paused";
                const body = `Session time · ${formatTime(state.seconds)}`;
                const key = `${status}|${body}`;
                if (key === lastSentRef.current) return;
                lastSentRef.current = key;

                postToSW({
                    type: "WORKOUT_NOTIFICATION_UPDATE",
                    payload: {
                        title: `Workout · ${status}`,
                        body,
                        isActive: state.isActive,
                    },
                });
            });
        };

        const unsubscribe = subscribeWorkoutTimer(handle);
        return () => {
            stopped = true;
            unsubscribe();
        };
    }, []);
};

export default useWorkoutNotification;
