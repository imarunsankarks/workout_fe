import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Play,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Dumbbell,
  Timer,
  Flame,
  Move,
  Pause,
  AlertTriangle,
  Trophy,
  History,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  Calendar,
  Clock as ClockIcon,
  ChevronRight,
  Loader2,
  GripVertical,
  PartyPopper,
  RefreshCw,
  Settings,
  Activity,
  Filter,
  } from "lucide-react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

// --- NEW DND IMPORTS ---
import {
  DndContext,
  DragOverlay,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { subscribeWorkoutTimer } from "../utils/workoutTimer";
import ConfirmModal from "../components/ConfirmModal";
import ExerciseHistorySheet from "../components/ExerciseHistorySheet";
import BottomSheet from "../components/BottomSheet";
import EditExerciseModal from "../components/EditExerciseModal";
import ExerciseLibrarySheet from "../components/ExerciseLibrarySheet";
import LoadingScreen from "../components/LoadingScreen";
import confetti from "canvas-confetti";
import { buildLibraryMap, getDisplayName } from "../utils/exerciseLookup";

// --- TIMER UTIL ---
const formatTime = (s) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// --- ISOLATED TIMER COMPONENT ---
// Subscribes to the shared workoutTimer so we only run a single global
// interval. Only this memoized component re-renders each tick; the parent
// ActiveWorkout (with the exercise list / drag-and-drop) is not affected.
const SessionTimer = React.memo(({ isActive, onToggle, onTick }) => {
  const [seconds, setSeconds] = useState(() => {
    const saved = localStorage.getItem("active_session_seconds");
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    const unsubscribe = subscribeWorkoutTimer((state) => {
      if (!state) return;
      setSeconds(state.seconds);
      onTick?.(state.seconds);
    });
    return unsubscribe;
  }, [onTick]);

  useEffect(() => {
    localStorage.setItem("active_session_seconds", seconds.toString());
  }, [seconds]);

  return (
    <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-3xl p-6 shadow-sm mb-6 flex justify-between items-center border border-white/40 dark:border-white/10">
      <div className="flex items-center gap-4">
        <div className="bg-accent-50 dark:bg-accent-900/30 p-3 rounded-2xl text-accent-600 dark:text-accent-400">
          <Timer size={24} />
        </div>
        <div>
          <h1 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
            Session Duration
          </h1>
          <p className="text-3xl font-mono font-bold text-slate-800 dark:text-slate-100 leading-none">
            {formatTime(seconds)}
          </p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`p-4 rounded-2xl transition-all ${isActive ? "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400" : "bg-accent-gradient text-white shadow-lg dark:shadow-md"}`}
      >
        {isActive ? <Pause size={20} /> : <Play size={20} />}
      </button>
    </div>
  );
});

// --- SORTABLE EXERCISE WRAPPER ---
// Wraps each exercise card so it can be reordered via drag-and-drop.
// Renders children as a function with `dragHandleProps` to attach to a handle.
// Locks the wrapper's height + width while dragging so the card doesn't
// resize itself to match the slot it is hovering over.
const SortableExercise = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const nodeRef = useRef(null);
  const lockedSizeRef = useRef(null);

  const composedRef = useCallback(
    (node) => {
      setNodeRef(node);
      nodeRef.current = node;
    },
    [setNodeRef],
  );

  // Capture the rendered size on every render while NOT dragging, so that
  // when a drag starts we already have the latest natural dimensions.
  if (nodeRef.current && !isDragging) {
    lockedSizeRef.current = {
      width: nodeRef.current.offsetWidth,
      height: nodeRef.current.offsetHeight,
    };
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.7 : 1,
    ...(isDragging && lockedSizeRef.current
      ? {
          width: lockedSizeRef.current.width,
          height: lockedSizeRef.current.height,
          boxSizing: "border-box",
        }
      : {}),
  };

  return (
    <div ref={composedRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
};

const ActiveWorkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useContext(AuthContext);

  // --- ACCESS GUARD ---
  // Only allow entering /workout when navigated programmatically from Home
  // or Reports (which pass location.state.from). Direct URL entry, bookmarks,
  // or any other internal navigation without that marker get redirected home.
  const isAllowedEntry = ["home", "reports"].includes(location.state?.from);
  useEffect(() => {
    if (!isAllowedEntry) {
      navigate("/", { replace: true });
    }
  }, [isAllowedEntry, navigate]);

  const [exercises, setExercises] = useState(() => {
    const saved = localStorage.getItem("active_session_exercises");
    return saved ? JSON.parse(saved) : [];
  });

  const secondsRef = useRef(
    parseInt(localStorage.getItem("active_session_seconds") || "0"),
  );
  const handleTick = useCallback((s) => {
    secondsRef.current = s;
  }, []);

  // --- ONGOING WORKOUT NOTIFICATION HELPERS ---
  const postToSW = useCallback((msg) => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        const target = navigator.serviceWorker.controller || reg.active;
        if (target) target.postMessage(msg);
      })
      .catch(() => {});
  }, []);

  const ensureNotifPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window))
      return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }, []);

  const [isActive, setIsActive] = useState(() => {
    const saved = localStorage.getItem("active_session_is_active");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [lastUnpausedAt, setLastUnpausedAt] = useState(() => {
    const saved = localStorage.getItem("active_session_last_unpaused");
    return saved ? parseInt(saved) : isActive ? Date.now() : null;
  });

  // Which exercise category the library sheet should open with.
  //   null              → sheet closed
  //   "Warmup" |
  //   "Strength" |
  //   "Stretching"      → sheet open, list locked to that category
  const [libraryCategory, setLibraryCategory] = useState(null);
  // Filter tab for the active session's exercise list.
  //   "All" | "Warmup" | "Strength" | "Stretching"
  const [exerciseTypeTab, setExerciseTypeTab] = useState("All");
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [library, setLibrary] = useState([]);
  const [loadingSave, setLoadingSave] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [nullData, setNullData] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  // Server-side validation error (e.g. duplicate name on library edit).
  const [libraryEditError, setLibraryEditError] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [workoutNote, setWorkoutNote] = useState("");
  // selectedImage holds { url, publicId } after a successful Cloudinary upload
  const [selectedImage, setSelectedSetImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const presetNames = ["Arms", "Legs", "Push", "Pull", "Other"];

  // --- REPEAT WORKOUT STATES ---
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [workoutToRepeat, setWorkoutToRepeat] = useState(null);
  const [repeatFilterTab, setRepeatFilterTab] = useState("All");
  const [showRepeatFilter, setShowRepeatFilter] = useState(false);

  const [selectedExerciseActions, setSelectedExerciseActions] = useState(null);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [selectedPrHistory, setSelectedPrHistory] = useState(null);
  const [historyLimit, setHistoryLimit] = useState(5);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const [activeExId, setActiveExId] = useState(null);
  const activeDraggingExercise = exercises.find(
    (ex) => `ex-${ex.instanceId}` === activeExId,
  );

  const handleExerciseDragStart = (event) => {
    setActiveExId(event.active.id);
  };

  const handleExerciseDragEnd = (event) => {
    setActiveExId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setExercises((prev) => {
        const oldIndex = prev.findIndex(
          (ex) => `ex-${ex.instanceId}` === active.id,
        );
        const newIndex = prev.findIndex(
          (ex) => `ex-${ex.instanceId}` === over.id,
        );
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleExerciseDragCancel = () => setActiveExId(null);

  const handleDragEnd = (event, exerciseInstanceId) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setExercises((prev) => {
        const newExs = [...prev];
        let targetEx = newExs.find(
          (ex) => ex.instanceId === exerciseInstanceId,
        );
        const oldIndex = targetEx.sets.findIndex(
          (_, i) => `set-${exerciseInstanceId}-${i}` === active.id,
        );
        const newIndex = targetEx.sets.findIndex(
          (_, i) => `set-${exerciseInstanceId}-${i}` === over.id,
        );
        targetEx.sets = arrayMove(targetEx.sets, oldIndex, newIndex);
        return newExs;
      });
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so re-selecting the same file still fires onChange
    e.target.value = "";

    // Show instant local preview while we upload to Cloudinary
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    setIsPhotoUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET,
      );
      formData.append(
        "cloud_name",
        process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
      );

      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        formData,
      );

      setSelectedSetImage({
        url: uploadRes.data.secure_url,
        publicId: uploadRes.data.public_id,
      });
      setImagePreview(uploadRes.data.secure_url);
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("Photo upload failed. Try again.");
      setImagePreview(null);
      setSelectedSetImage(null);
    } finally {
      setIsPhotoUploading(false);
    }
  };
  useEffect(() => {
    localStorage.setItem("active_session_exercises", JSON.stringify(exercises));
    localStorage.setItem("active_session_is_active", JSON.stringify(isActive));
    if (lastUnpausedAt) {
      localStorage.setItem(
        "active_session_last_unpaused",
        lastUnpausedAt.toString(),
      );
    } else {
      localStorage.removeItem("active_session_last_unpaused");
    }
  }, [exercises, isActive, lastUnpausedAt]);

  // Eagerly request notification permission on entering the workout page so
  // the prompt fires while the user gesture is still fresh. The actual
  // notification driving is handled at App-level by useWorkoutNotification
  // so it keeps ticking even when this component unmounts (other routes).
  useEffect(() => {
    if (!isAllowedEntry) return;
    ensureNotifPermission();
  }, [isAllowedEntry, ensureNotifPermission]);

  const fetchLibrary = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/exercises/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setLibrary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setAllWorkouts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchLibrary();
      fetchHistory();
    }
  }, [user.id]);

  const hasRunningTimedSet = exercises.some(
    (ex) => ex.isRunning && (ex.type === "Warmup" || ex.type === "Stretching"),
  );
  // Warmup/Stretching timer is wall-clock based so it stays accurate even
  // when the user navigates away and the component unmounts. Each running
  // set carries a `startedAt` epoch anchor (persisted to localStorage via
  // the `exercises` effect). On every tick we fold the wall-clock delta
  // since the anchor into `set.time` and re-anchor — so accumulated time
  // is always the source of truth and brief off-screen drifts are recovered
  // on the next tick after remount.
  useEffect(() => {
    if (!isActive || !hasRunningTimedSet) return undefined;
    const tick = () => {
      setExercises((prev) => {
        if (!prev.some((ex) => ex.isRunning)) return prev;
        const now = Date.now();
        let changed = false;
        const next = prev.map((ex) => {
          if (
            !(ex.isRunning &&
              (ex.type === "Warmup" || ex.type === "Stretching"))
          ) {
            return ex;
          }
          const idx = ex.activeSetIdx ?? 0;
          const s = ex.sets[idx];
          if (!s) return ex;
          // No anchor yet (e.g. legacy persisted state) — stamp now and
          // start counting on the next tick.
          if (!s.startedAt) {
            changed = true;
            const newSets = [...ex.sets];
            newSets[idx] = { ...s, startedAt: now };
            return { ...ex, sets: newSets };
          }
          const elapsed = Math.max(0, Math.floor((now - s.startedAt) / 1000));
          if (elapsed <= 0) return ex;
          changed = true;
          const newSets = [...ex.sets];
          newSets[idx] = {
            ...s,
            time: (s.time || 0) + elapsed,
            startedAt: s.startedAt + elapsed * 1000,
          };
          return { ...ex, sets: newSets };
        });
        return changed ? next : prev;
      });
    };
    // Run once immediately to catch up any time that passed while the
    // component was unmounted (or the tab was backgrounded).
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, hasRunningTimedSet]);

  // When the global session timer is paused, freeze running warmup/stretch
  // timers by folding their elapsed wall-clock seconds into `set.time` and
  // dropping the anchor. On resume, the per-tick effect re-stamps the
  // anchor so counting continues from where it left off.
  useEffect(() => {
    if (isActive) return;
    setExercises((prev) => {
      let changed = false;
      const next = prev.map((ex) => {
        if (
          !(ex.isRunning &&
            (ex.type === "Warmup" || ex.type === "Stretching"))
        ) {
          return ex;
        }
        const idx = ex.activeSetIdx ?? 0;
        const s = ex.sets[idx];
        if (!s || !s.startedAt) return ex;
        changed = true;
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - s.startedAt) / 1000),
        );
        const newSets = [...ex.sets];
        newSets[idx] = {
          ...s,
          time: (s.time || 0) + elapsed,
          startedAt: null,
        };
        return { ...ex, sets: newSets };
      });
      return changed ? next : prev;
    });
  }, [isActive]);

  const toggleGlobalTimer = useCallback(() => {
    setIsActive((prevActive) => {
      if (!prevActive) {
        const now = Date.now();
        setLastUnpausedAt(now);
        localStorage.setItem(
          "active_session_base_seconds",
          secondsRef.current.toString(),
        );
      } else {
        setLastUnpausedAt(null);
      }
      return !prevActive;
    });
  }, []);

  // Listen for actions triggered from the notification (Pause/Resume button).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const handler = (event) => {
      if (event.data?.type === "WORKOUT_TOGGLE_TIMER") {
        toggleGlobalTimer();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [toggleGlobalTimer]);

  // Live lookup so display names always reflect the current library
  // (renames mid-session propagate immediately, and saved workouts —
  // which now only carry `exerciseId` — still render correctly).
  const libraryMap = useMemo(() => buildLibraryMap(library), [library]);

  const addExercise = (template) => {
    // Find the most recent prior performance of this same library
    // exercise (by canonical id) so we can prefill sets/resistance.
    const templateId = template._id && String(template._id);
    const lastEntry = templateId
      ? allWorkouts
          .filter((workout) =>
            workout.details?.some(
              (ex) => String(ex.exerciseId) === templateId,
            ),
          )
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((workout) =>
            workout.details.find(
              (ex) => String(ex.exerciseId) === templateId,
            ),
          )[0]
      : undefined;

    let prefilledSets;
    if (template.type === "Strength") {
      prefilledSets =
        lastEntry?.sets && lastEntry.sets.length > 0
          ? lastEntry.sets.map((s) => ({
              weight: s.weight ?? "",
              reps: s.reps ?? "",
            }))
          : [{ weight: "", reps: "" }];
    } else {
      // Warmup/Stretching: always start with a single fresh set, regardless
      // of how many sets the previous workout had.
      prefilledSets = [{ time: 0 }];
    }

    const newEx = {
      ...template,
      // Canonical link to the library entry. We carry this through so it
      // can be persisted on the workout and survive future renames.
      exerciseId: template._id,
      resistance:
        lastEntry?.resistance ?? template.resistance ?? 0,
      execution:
        lastEntry?.execution ?? template.execution ?? "Bilateral",
      instanceId: Date.now(),
      isCollapsed: false,
      isRunning: false,
      activeSetIdx: 0,
      sets: prefilledSets,
    };
    setExercises([...exercises, newEx]);
    setLibraryCategory(null);
  };

  const handleConfirmRepeat = () => {
    if (!workoutToRepeat) return;
    
    const prefilledExercises = workoutToRepeat.details.map((ex, idx) => ({
      ...ex,
      // Preserve the canonical id so re-saving the repeated workout keeps
      // the link intact. Legacy details that don't carry exerciseId yet
      // will simply roundtrip undefined and rely on the name fallback.
      exerciseId: ex.exerciseId,
      instanceId: Date.now() + idx,
      isCollapsed: true,
      isRunning: false,
      activeSetIdx: 0,
      sets:
        ex.type === "Strength"
          ? ex.sets.map((s) => ({
              weight: s.weight ?? "",
              reps: s.reps ?? "",
            }))
          : // Warmup may have been saved in reps mode (sets have `.reps`
            // instead of `.time`). Roundtrip the shape so the toggle UI
            // re-derives the right mode on render.
            ex.type === "Warmup" && (ex.sets?.[0]?.reps !== undefined)
            ? ex.sets.map((s) => ({ reps: "" }))
            : [{ time: 0 }],
    }));

    setExercises(prefilledExercises);
    setShowRepeatModal(false);
    setWorkoutToRepeat(null);
  };

  // Match by canonical id; the displayName argument is just used as the
  // history sheet header so we can render a label even though the
  // saved workout details no longer carry a `name` snapshot.
  // Fetch latest workout data for a specific exercise and update its sets
  const fetchLatestForExercise = (instanceId) => {
    const exercise = exercises.find((e) => e.instanceId === instanceId);
    if (!exercise || !exercise.exerciseId) return;

    const templateId = String(exercise.exerciseId);

    // Find the most recent workout containing this exercise
    const latestEntry = allWorkouts
      .filter((workout) =>
        workout.details?.some(
          (ex) => String(ex.exerciseId) === templateId,
        ),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((workout) =>
        workout.details.find(
          (ex) => String(ex.exerciseId) === templateId,
        ),
      )[0];

    if (!latestEntry) return;

    setExercises((prev) =>
      prev.map((e) => {
        if (e.instanceId !== instanceId) return e;

        // Build new sets based on latest entry
        let newSets;
        if (e.type === "Strength") {
          newSets =
            latestEntry.sets && latestEntry.sets.length > 0
              ? latestEntry.sets.map((s) => ({
                  weight: s.weight ?? "",
                  reps: s.reps ?? "",
                }))
              : [{ weight: "", reps: "" }];
        } else if (e.type === "Warmup" && e.sets?.[0]?.reps !== undefined) {
          // Warmup in reps mode - preserve mode but reset values
          newSets = latestEntry.sets?.[0]?.reps !== undefined
            ? latestEntry.sets.map((s) => ({ reps: s.reps ?? "" }))
            : [{ reps: "" }];
        } else {
          // Warmup/Stretching time mode - reset to fresh set
          newSets = [{ time: 0 }];
        }

        return {
          ...e,
          resistance: latestEntry.resistance ?? e.resistance ?? 0,
          execution: latestEntry.execution ?? e.execution ?? "Bilateral",
          sets: newSets,
          isRunning: false,
          activeSetIdx: 0,
        };
      }),
    );
  };

  const handlePrClick = (exerciseId, displayName) => {
    if (!exerciseId) return;
    setHistoryLimit(5);
    const idStr = String(exerciseId);
    const exerciseHistory = allWorkouts
      .filter((workout) =>
        workout.details?.some((ex) => String(ex.exerciseId) === idStr),
      )
      .map((workout) => {
        const detail = workout.details.find(
          (ex) => String(ex.exerciseId) === idStr,
        );
        return {
          workoutName: workout.name,
          date: workout.date,
          sets: detail.sets,
          type: detail.type,
          resistance: detail.resistance,
          execution: detail.execution,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    setSelectedPrHistory({ name: displayName, history: exerciseHistory });
  };

  const clearWorkoutNotification = useCallback(() => {
    postToSW({ type: "WORKOUT_NOTIFICATION_CLEAR" });
  }, [postToSW]);

  const handleDiscard = () => {
    localStorage.removeItem("active_session_exercises");
    localStorage.removeItem("active_session_seconds");
    localStorage.removeItem("active_session_is_active");
    localStorage.removeItem("active_session_last_unpaused");
    localStorage.removeItem("active_session_base_seconds");
    clearWorkoutNotification();
    navigate("/");
  };

  const saveWorkout = async () => {
      const finalName = workoutName.trim() || "Daily Session";

      // 1. Filter valid sets. Before validating, fold any in-flight
      // wall-clock elapsed for running warmup/stretch timers into
      // `set.time` so the saved value reflects the live UI.
      const nowMs = Date.now();
      const formattedDetails = exercises
        .map((ex) => {
          const flushedSets = ex.sets.map((s) => {
            if (
              s &&
              s.startedAt &&
              (ex.type === "Warmup" || ex.type === "Stretching")
            ) {
              const elapsed = Math.max(
                0,
                Math.floor((nowMs - s.startedAt) / 1000),
              );
              const { startedAt: _drop, ...rest } = s;
              return { ...rest, time: (s.time || 0) + elapsed };
            }
            // Always strip the client-only anchor before persisting.
            if (s && s.startedAt !== undefined) {
              const { startedAt: _drop, ...rest } = s;
              return rest;
            }
            return s;
          });
          const validSets = flushedSets.filter((set) => {
            if (ex.type === "Strength") {
              return set.weight !== "" && set.reps !== "" && Number(set.reps) > 0;
            }
            // Warmup in reps mode is identified by a `.reps` field on its
            // sets (instead of `.time`). Validated like Strength but
            // without requiring a weight.
            if (ex.type === "Warmup" && set.reps !== undefined) {
              return set.reps !== "" && Number(set.reps) > 0;
            }
            return set.time && Number(set.time) > 0;
          });

          return {
            // The canonical (and only) link to the library entry. Display
            // names are always resolved through the library on the read side.
            exerciseId: ex.exerciseId,
            type: ex.type,
            muscle: ex.muscle,
            sets: validSets,
            execution: ex.execution || "Bilateral",
            resistance: ex.resistance || 0,
          };
        })
        .filter((ex) => ex.sets.length > 0);

      if (formattedDetails.length === 0) {
        setNullData(true);
        return;
      }

      setLoadingSave(true);
      setShowFinishPrompt(false);

      try {
        // Image (if any) was already uploaded to Cloudinary at file-pick time.
        const workoutData = {
          userId: user.id,
          name: finalName,
          duration: Math.floor(secondsRef.current / 60),
          muscles: [...new Set(formattedDetails.map((ex) => ex.muscle))],
          details: formattedDetails,
          notes: workoutNote,
          imageUrl: selectedImage?.url || null,
          imagePublicId: selectedImage?.publicId || null,
        };

        // 4. Send to your Node.js backend
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/workouts`,
          workoutData,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        // 5. Capture summary, clean local state, then celebrate.
        const summary = {
          name: finalName,
          durationMin: Math.floor(secondsRef.current / 60),
          exerciseCount: formattedDetails.length,
          totalSets: formattedDetails.reduce(
            (s, ex) => s + ex.sets.length,
            0,
          ),
        };
        // Clear local session state WITHOUT navigating away — the celebration
        // overlay needs this page to stay mounted. We navigate manually below.
        localStorage.removeItem("active_session_exercises");
        localStorage.removeItem("active_session_seconds");
        localStorage.removeItem("active_session_is_active");
        localStorage.removeItem("active_session_last_unpaused");
        localStorage.removeItem("active_session_base_seconds");
        clearWorkoutNotification();

        // Keep "Finalizing Gains" visible briefly so it doesn't flash past
        // when the API responds fast, then swap to the celebration.
        setTimeout(() => {
          setLoadingSave(false);
          setFinishedSummary(summary);
          setTimeout(() => navigate("/"), 2500);
        }, 1500);
      } catch (err) {
        console.error("Save Error:", err);
        const serverMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unknown error";
        setSaveError(serverMsg);
        setLoadingSave(false);
      }
    };

  const deleteLibraryItem = async (id) => {
    try {
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/exercises/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      fetchLibrary();
      setShowDeleteConfirm(null);
    } catch (err) {
      const serverMsg = err?.response?.data?.message;
      setShowDeleteConfirm(null);
      setLibraryEditError(
        serverMsg || 'Could not delete the exercise. Please try again.',
      );
      console.error(err);
    }
  };

  const updateLibraryItem = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/exercises/${editingExercise._id}`,
        editingExercise,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      fetchLibrary();
      setEditingExercise(null);
    } catch (err) {
      const serverMsg = err?.response?.data?.message;
      // Keep the edit modal open so the user can correct the name.
      setLibraryEditError(
        serverMsg || 'Could not update the exercise. Please try again.',
      );
      console.error(err);
    }
  };

  // Fireworks-style confetti bursts from center when workout finishes.
  useEffect(() => {
    if (!finishedSummary) return undefined;

    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ["#6366f1", "#d946ef", "#f59e0b", "#ffffff"];

    const tick = () => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) return;

      // Random fireworks burst from center area
      confetti({
        particleCount: Math.random() * 50 + 50,
        spread: Math.random() * 100 + 50,
        origin: {
          x: Math.random() * 0.4 + 0.3, // 0.3 to 0.7 (center area)
          y: Math.random() * 0.3 + 0.3, // 0.3 to 0.6 (upper-middle)
        },
        colors,
        startVelocity: Math.random() * 30 + 30,
        decay: 0.9,
        ticks: 300,
        zIndex: 600,
      });

      setTimeout(tick, Math.random() * 400 + 200); // Random interval between bursts
    };

    tick();
  }, [finishedSummary]);

  // Guard render: bail out (useEffect above will navigate away)
  if (!isAllowedEntry) return null;

  return (
    <div className="relative min-h-screen p-4 pb-40">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Active Workout</h1>
      </div>
      {/* Timer Card */}
      <SessionTimer
        isActive={isActive}
        onToggle={toggleGlobalTimer}
        onTick={handleTick}
      />
      {/* REPEAT WORKOUT BUTTON */}
      <button 
        onClick={() => setShowRepeatModal(true)}
        className="w-full mb-6 bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 p-4 rounded-3xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 dark:bg-amber-900/30 p-2 rounded-xl text-amber-500 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <RotateCcw size={18} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Session shortcut</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">Repeat Previous Workout</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
      </button>

      {/* Type filter tabs and add button in one row */}
      <div className="flex items-center gap-2 mb-4">
        {/* Scrollable tabs container */}
         {/* Add button at end of scrollable tabs */}
          <button
            onClick={() => setLibraryCategory(exerciseTypeTab)}
            className="flex-shrink-0 flex items-center gap-2 bg-accent-gradient text-white px-4 py-2 rounded-full shadow-md shadow-accent-500/20 active:scale-[0.98] transition-all"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{exerciseTypeTab === "All" ? "Exercise" : exerciseTypeTab}</span>
          </button>
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {[
          { key: "All", icon: Activity },
          { key: "Warmup", icon: Flame, color: "amber" },
          { key: "Strength", icon: Dumbbell, color: "accent" },
          { key: "Stretching", icon: Move, color: "fuchsia" },
        ].map(({ key, icon: Icon, color }) => {
          const active = exerciseTypeTab === key;
          const count =
            key === "All"
              ? exercises.length
              : exercises.filter((ex) => ex.type === key).length;

          const inactiveStyle = "bg-white/40 dark:bg-gray-300/5 text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10";

          const activeStyles = {
            All: "bg-slate-900 dark:bg-slate-700 text-white shadow-md",
            Warmup: "bg-amber-500 text-white shadow-md shadow-amber-500/30",
            Strength: "bg-accent-500 text-white shadow-md shadow-accent-500/30",
            Stretching: "bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/30",
          };

          return (
            <button
              key={key}
              onClick={() => setExerciseTypeTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold transition-all ${
                active ? activeStyles[key] : inactiveStyle
              }`}
            >
              <Icon size={14} />
              <span className={`px-1.5 rounded-full text-[10px] ${active ? "bg-white/20" : "bg-white/50 dark:bg-white/10"}`}>
                {count}
              </span>
            </button>
          );
        })}

         
        </div>
      </div>

      {/* Active Exercise List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleExerciseDragStart}
        onDragEnd={handleExerciseDragEnd}
        onDragCancel={handleExerciseDragCancel}
      >
        <SortableContext
          items={(exerciseTypeTab === "All"
            ? exercises
            : exercises.filter((e) => e.type === exerciseTypeTab)
          ).map((e) => `ex-${e.instanceId}`)}
          strategy={verticalListSortingStrategy}
        >
      <div className="space-y-4">
        {(() => {
          const filteredExercises = exerciseTypeTab === "All"
            ? exercises
            : exercises.filter((ex) => ex.type === exerciseTypeTab);

          if (filteredExercises.length === 0) {
            const emptyMessages = {
              All: "No exercises added",
              Warmup: "No warmups added",
              Strength: "No strength exercises added",
              Stretching: "No stretches added",
            };
            return (
              <div className="text-center py-12">
                <p className="text-slate-400 dark:text-slate-500 text-md capitalize">
                  {emptyMessages[exerciseTypeTab] || emptyMessages.All}
                </p>
              </div>
            );
          }

          return filteredExercises.map((ex) => (
          <SortableExercise key={ex.instanceId} id={`ex-${ex.instanceId}`}>
            {({ dragHandleProps }) => (
          <div
            className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-[32px] px-5 py-6 shadow-sm border border-white/40 dark:border-white/10"
          >
            {/* HEADER SECTION */}
            <div className="flex justify-between items-start">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1"
                onClick={() => {
                  setExercises(
                    exercises.map((e) =>
                      e.instanceId === ex.instanceId
                        ? { ...e, isCollapsed: !e.isCollapsed }
                        : e,
                    ),
                  );
                }}
              >
                <div
                  className={`p-2 rounded-xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" : ex.type === "Stretching" ? "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:text-fuchsia-400" : "text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400"}`}
                >
                  {ex.type === "Warmup" ? (
                    <Flame size={18} />
                  ) : ex.type === "Stretching" ? (
                    <Move size={18} />
                  ) : (
                    <Dumbbell size={18} />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-md leading-tight flex items-center gap-2 capitalize">
                    {getDisplayName(ex, libraryMap)}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">
                      {ex.muscle}
                    </p>
                    <div className="p-0.5 rounded-lg bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500">
                      {ex.isCollapsed ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronUp size={12} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* INFO BUTTON */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExerciseActions(ex);
                  }}
                  className="p-2 text-slate-300 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
                >
                  <Settings size={18} />
                </button>
                {/* DRAG HANDLE - reorder exercises */}
                <button
                  {...dragHandleProps}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to reorder exercise"
                  className="p-2 text-slate-300 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 cursor-grab active:cursor-grabbing touch-none transition-colors"
                >
                  <GripVertical size={18} />
                </button>
              </div>
            </div>


            {!ex.isCollapsed && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-4" />
                {/* For Warmup exercises, expose a Time/Reps mode toggle.
                    The toggle locks itself as soon as any data is entered
                    (either timed progress or a rep value) — switching modes
                    after that would silently destroy logged work. */}
                {ex.type === "Warmup" && (() => {
                  const isRepsMode = ex.sets?.[0]?.reps !== undefined;
                  const hasData = isRepsMode
                    ? ex.sets.some(
                        (s) => s.reps !== "" && s.reps !== undefined && Number(s.reps) > 0,
                      )
                    : ex.sets.some((s) => (s.time || 0) > 0);
                  const switchMode = (next) => {
                    if (hasData) return;
                    const newExs = [...exercises];
                    const t = newExs.find((i) => i.instanceId === ex.instanceId);
                    t.sets = next === "reps" ? [{ reps: "" }] : [{ time: 0 }];
                    t.isRunning = false;
                    t.activeSetIdx = 0;
                    setExercises(newExs);
                  };
                  return (
                    <div className="flex gap-1 mb-3 p-1 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10">
                      {[
                        { key: "time", label: "Time" },
                        { key: "reps", label: "Reps" },
                      ].map(({ key, label }) => {
                        const active = (isRepsMode ? "reps" : "time") === key;
                        return (
                          <button
                            key={key}
                            disabled={hasData && !active}
                            onClick={() => switchMode(key)}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                              active
                                ? "bg-amber-500 text-white shadow-sm"
                                : "text-slate-400 dark:text-slate-500"
                            } ${hasData && !active ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {ex.type === "Strength" ||
                (ex.type === "Warmup" && ex.sets?.[0]?.reps !== undefined) ? (
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => {
                      const isReps =
                        ex.type === "Warmup" && set.reps !== undefined;
                      if (isReps) {
                        return (
                          <div
                            key={sIdx}
                            className="grid grid-cols-[50px_1fr_25px] gap-3 items-center"
                          >
                            <div className="bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-xl py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-300 uppercase">
                              {sIdx + 1}
                            </div>
                            <input
                              type="number"
                              placeholder="reps"
                              value={set.reps}
                              onChange={(e) => {
                                const newExs = [...exercises];
                                newExs.find(
                                  (i) => i.instanceId === ex.instanceId,
                                ).sets[sIdx].reps = e.target.value;
                                setExercises(newExs);
                              }}
                              className="w-full bg-white/50 dark:bg-gray-300/5 backdrop-blur-md border border-white/50 dark:border-white/10 py-3 rounded-xl text-center font-bold outline-none focus:border-amber-500 text-slate-800 dark:text-slate-200"
                            />
                            <button
                              onClick={() => {
                                const newExs = [...exercises];
                                newExs
                                  .find((i) => i.instanceId === ex.instanceId)
                                  .sets.splice(sIdx, 1);
                                setExercises(newExs);
                              }}
                              className="text-slate-200 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400 transition-colors flex justify-center items-center"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      }
                      return (
                      <div
                        key={sIdx}
                        className="grid grid-cols-[50px_1fr_1fr_25px] gap-3 items-center"
                      >
                        <div className="bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-xl py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-300 uppercase">
                          {sIdx + 1}
                        </div>
                        <input
                          type="number"
                          placeholder="kg"
                          value={set.weight}
                          onChange={(e) => {
                            const newExs = [...exercises];
                            newExs.find(
                              (i) => i.instanceId === ex.instanceId,
                            ).sets[sIdx].weight = e.target.value;
                            setExercises(newExs);
                          }}
                          className="w-full bg-white/50 dark:bg-gray-300/5 backdrop-blur-md border border-white/50 dark:border-white/10 py-3 rounded-xl text-center font-bold outline-none focus:border-accent-500 text-slate-800 dark:text-slate-200"
                        />
                        <input
                          type="number"
                          placeholder="reps"
                          value={set.reps}
                          onChange={(e) => {
                            const newExs = [...exercises];
                            newExs.find(
                              (i) => i.instanceId === ex.instanceId,
                            ).sets[sIdx].reps = e.target.value;
                            setExercises(newExs);
                          }}
                          className="w-full bg-white/50 dark:bg-gray-300/5 backdrop-blur-md border border-white/50 dark:border-white/10 py-3 rounded-xl text-center font-bold outline-none focus:border-accent-500 text-slate-800 dark:text-slate-200"
                        />
                        <button
                          onClick={() => {
                            const newExs = [...exercises];
                            newExs
                              .find((i) => i.instanceId === ex.instanceId)
                              .sets.splice(sIdx, 1);
                            setExercises(newExs);
                          }}
                          className="text-slate-200 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400 transition-colors flex justify-center items-center"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => {
                      const isThisRunning =
                        ex.isRunning && ex.activeSetIdx === sIdx;
                      const hasProgress = (set.time || 0) > 0;
                      return (
                        <div
                          key={sIdx}
                          className="flex items-center gap-2 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md p-2 pl-4 rounded-2xl"
                        >
                          <span className="text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase min-w-[40px]">
                            Set {sIdx + 1}
                          </span>
                          <span className="flex-1 font-mono font-bold text-slate-700 dark:text-slate-200 text-center">
                            {formatTime(set.time || 0)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {/* PAUSE / RESUME / START */}
                            <button
                              disabled={!isActive}
                              onClick={() => {
                                const willRun = !isThisRunning;
                                const now = Date.now();
                                // Helper: fold any in-flight wall-clock
                                // elapsed into `set.time` and drop the
                                // anchor. Used both when pausing the
                                // current exercise and when auto-pausing
                                // a different running timer.
                                const flushRunning = (item) => {
                                  if (
                                    !(item.isRunning &&
                                      (item.type === "Warmup" ||
                                        item.type === "Stretching"))
                                  ) {
                                    return item;
                                  }
                                  const idx = item.activeSetIdx ?? 0;
                                  const s = item.sets[idx];
                                  if (!s) {
                                    return { ...item, isRunning: false };
                                  }
                                  const elapsed = s.startedAt
                                    ? Math.max(
                                        0,
                                        Math.floor(
                                          (now - s.startedAt) / 1000,
                                        ),
                                      )
                                    : 0;
                                  const newSets = [...item.sets];
                                  newSets[idx] = {
                                    ...s,
                                    time: (s.time || 0) + elapsed,
                                    startedAt: null,
                                  };
                                  return {
                                    ...item,
                                    isRunning: false,
                                    sets: newSets,
                                  };
                                };
                                const newExs = exercises.map((i) => {
                                  if (i.instanceId === ex.instanceId) {
                                    if (!willRun) return flushRunning(i);
                                    // Starting: stamp a wall-clock anchor
                                    // on the target set so off-screen time
                                    // can be recovered on the next tick.
                                    const newSets = [...i.sets];
                                    const cur = newSets[sIdx] || {};
                                    newSets[sIdx] = {
                                      ...cur,
                                      startedAt: now,
                                    };
                                    return {
                                      ...i,
                                      isRunning: true,
                                      activeSetIdx: sIdx,
                                      sets: newSets,
                                    };
                                  }
                                  // Only one warmup/stretch timer may run at
                                  // a time — pause every other timed
                                  // exercise when starting this one.
                                  if (willRun) return flushRunning(i);
                                  return i;
                                });
                                setExercises(newExs);
                              }}
                              aria-label={
                                isThisRunning
                                  ? "Pause"
                                  : hasProgress
                                    ? "Resume"
                                    : "Start"
                              }
                              className={`p-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                isThisRunning
                                  ? "bg-red-500 text-white shadow-sm"
                                  : "bg-accent-500 text-white shadow-sm"
                              }`}
                            >
                              {isThisRunning ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                            </button>
                            {/* RESET */}
                            <button
                              disabled={!hasProgress}
                              onClick={() => {
                                const newExs = [...exercises];
                                const target = newExs.find(
                                  (i) => i.instanceId === ex.instanceId,
                                );
                                target.sets[sIdx].time = 0;
                                target.sets[sIdx].startedAt = null;
                                if (isThisRunning) target.isRunning = false;
                                setExercises(newExs);
                              }}
                              aria-label="Reset"
                              className="p-2 rounded-xl bg-white/50 dark:bg-gray-300/5 backdrop-blur-md border border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-200 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(ex.type === "Strength" ||
                  (ex.type === "Warmup" && ex.sets?.[0]?.reps !== undefined)) &&
                  (() => {
                    const isWarmupReps = ex.type === "Warmup";
                    // Disable while any existing set is incomplete so users
                    // can't pile up empty rows. Warmup-reps only checks reps;
                    // Strength checks both weight and reps.
                    const incomplete =
                      ex.sets.length > 0 &&
                      (isWarmupReps
                        ? ex.sets.some(
                            (s) => !s.reps || Number(s.reps) === 0,
                          )
                        : ex.sets.some((s) => !s.weight) ||
                          ex.sets.some(
                            (s) => !s.reps || Number(s.reps) === 0,
                          ));
                    return (
                      <button
                        onClick={() => {
                          const newExs = [...exercises];
                          newExs
                            .find((i) => i.instanceId === ex.instanceId)
                            .sets.push(
                              isWarmupReps
                                ? { reps: "" }
                                : { weight: "", reps: "" },
                            );
                          setExercises(newExs);
                        }}
                        disabled={incomplete}
                        className={`w-full mt-4 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-dashed rounded-xl transition-all ${
                          incomplete
                            ? "border-slate-50 dark:border-slate-700 text-slate-200 dark:text-slate-600 cursor-not-allowed opacity-50"
                            : "border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-accent-500 dark:hover:text-accent-400 hover:border-accent-100 dark:hover:border-accent-700"
                        }`}
                      >
                        + ADD SET
                      </button>
                    );
                  })()}
              </div>
            )}
          </div>
            )}
          </SortableExercise>
        ))})()}
      </div>
        </SortableContext>

        {/* DRAG OVERLAY - renders the dragged exercise card as a fixed-size
            floating clone so the original list-item never resizes to fit
            slots of different heights. */}
        <DragOverlay zIndex={9999} dropAnimation={null}>
          {activeDraggingExercise ? (
            <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[32px] px-5 py-6 shadow-2xl border border-accent-300 dark:border-accent-700 ring-2 ring-accent-400/40 ring-inset cursor-grabbing">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    activeDraggingExercise.type === "Warmup"
                      ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400"
                      : activeDraggingExercise.type === "Stretching"
                        ? "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:text-fuchsia-400"
                        : "text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400"
                  }`}
                >
                  {activeDraggingExercise.type === "Warmup" ? (
                    <Flame size={18} />
                  ) : activeDraggingExercise.type === "Stretching" ? (
                    <Move size={18} />
                  ) : (
                    <Dumbbell size={18} />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-md leading-tight capitalize">
                    {getDisplayName(activeDraggingExercise, libraryMap)}
                  </h4>
                  <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest mt-1">
                    {activeDraggingExercise.muscle}
                  </p>
                </div>
                <GripVertical
                  size={18}
                  className="text-accent-500 dark:text-accent-400"
                />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer Actions */}
      <div className="fixed bottom-24 left-6 right-6 z-40 flex gap-3">
        <button
          onClick={() => setShowDiscardPrompt(true)}
          className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl text-red-400 dark:text-red-400 p-5 rounded-2xl border border-red-50 dark:border-red-900/30 shadow-xl dark:shadow-md active:scale-90 transition-all"
        >
          <Trash2 size={24} />
        </button>
        <button
          onClick={() => exercises.length > 0 && setShowFinishPrompt(true)}
          className={`flex-1 font-bold py-5 rounded-2xl shadow-2xl transition-all active:scale-95 ${exercises.length > 0 ? "bg-accent-gradient text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"}`}
        >
          <CheckCircle2 size={20} className="inline mr-2" /> FINISH WORKOUT
        </button>
      </div>

      {/* REPEAT PREVIOUS WORKOUT MODAL */}
      {showRepeatModal && (
        <BottomSheet
          open
          onClose={() => setShowRepeatModal(false)}
          zIndex="z-[500]"
          maxHeight="85vh"
        >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRepeatFilter((v) => !v)}
                  className={`p-2 rounded-lg transition-all ${
                    showRepeatFilter
                      ? "bg-accent-500 text-white shadow-md shadow-accent-500/30"
                      : "bg-white/40 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"
                  }`}
                >
                  <Filter size={18} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Recent Sessions</h2>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Select a workout to repeat</p>
                </div>
              </div>
              <button onClick={() => setShowRepeatModal(false)} className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors">
                <X size={20} />
              </button>
            </div>

            {(() => {
              // Group by name (case-insensitive) and keep last 4 of each
              const nameOrder = [];
              const buckets = {};
              allWorkouts.forEach((w) => {
                const key = (w.name || "").toLowerCase().trim();
                if (!buckets[key]) {
                  buckets[key] = { displayName: w.name, items: [] };
                  nameOrder.push(key);
                }
                if (buckets[key].items.length < 4) buckets[key].items.push(w);
              });

              const availableTabs = nameOrder.map((k) => ({
                key: k,
                displayName: buckets[k].displayName,
                count: buckets[k].items.length,
              }));

              const displayWorkouts =
                repeatFilterTab === "All"
                  ? nameOrder.flatMap((k) => buckets[k].items)
                  : buckets[repeatFilterTab]?.items || [];

              return (
                <>
                  {showRepeatFilter && availableTabs.length > 0 && (
                    <div
                      className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar scroll-smooth"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <button
                        onClick={() => setRepeatFilterTab("All")}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                          repeatFilterTab === "All"
                            ? "bg-slate-900 dark:bg-slate-700 text-white shadow-md"
                            : "bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"
                        }`}
                      >
                        <span>All</span>
                        <span className={`px-1.5 rounded-full text-[9px] ${
                          repeatFilterTab === "All"
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                        }`}>
                          {allWorkouts.length}
                        </span>
                      </button>
                      {availableTabs.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setRepeatFilterTab(t.key)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                            repeatFilterTab === t.key
                              ? "bg-accent-500 text-white shadow-md shadow-accent-500/30"
                              : "bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"
                          }`}
                        >
                          <span>{t.displayName}</span>
                          <span className={`px-1.5 rounded-full text-[9px] ${
                            repeatFilterTab === t.key
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                          }`}>
                            {t.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    {displayWorkouts.map((w) => (
                <button
                  key={w._id}
                  onClick={() => setWorkoutToRepeat(w)}
                  className="w-full bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border border-white/40 dark:border-white/10 p-5 rounded-[28px] flex items-center justify-between hover:bg-white/60 dark:hover:bg-white/10 hover:border-accent-200 dark:hover:border-accent-700 transition-all active:scale-[0.98]"
                >
                  <div className="text-left">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 capitalize mb-1">{w.name}</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        <Calendar size={12} className="text-accent-500" />
                        {new Date(w.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        <ClockIcon size={12} className="text-accent-500" />
                        {w.duration} mins
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
                </button>
                    ))}
                    {displayWorkouts.length === 0 && (
                      <div className="py-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                        {allWorkouts.length === 0
                          ? "No workout history found yet."
                          : `No sessions found for "${buckets[repeatFilterTab]?.displayName || repeatFilterTab}".`}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
        </BottomSheet>
      )}

      {/* REPEAT CONFIRMATION MODAL */}
      <ConfirmModal
        open={!!workoutToRepeat}
        onClose={() => setWorkoutToRepeat(null)}
        onConfirm={handleConfirmRepeat}
        title="Repeat Workout?"
        message={workoutToRepeat ? (
          <>
            Would you like to perform the same{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">"{workoutToRepeat.name}"</span>{' '}
            workout done on{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(workoutToRepeat.date).toLocaleDateString()}</span>{' '}
            today?
          </>
        ) : ''}
        confirmLabel="Yes, Prefill Workout"
        icon={RotateCcw}
        tone="warning"
      />

      {saveError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[800] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Could not save workout
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed break-words">
              {saveError}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setSaveError(null);
                  setShowFinishPrompt(true);
                }}
                className="w-full py-4 bg-accent-gradient text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => setSaveError(null)}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showDiscardPrompt}
        onClose={() => setShowDiscardPrompt(false)}
        onConfirm={handleDiscard}
        title="Discard Session?"
        message="All sets you've logged in this session will be lost."
        confirmLabel="Yes, Discard it"
        cancelLabel="No, Keep going"
        icon={AlertTriangle}
      />

      {/* FINISH PROMPT */}
      {showFinishPrompt && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xl z-[200] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-black/10 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-accent-500" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Great Session!</h2>
            
            {/* Preset Name Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {presetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setActiveTab(name);
                    if (name !== "Other") setWorkoutName(name);
                    else setWorkoutName("");
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeTab === name ? "bg-slate-900 dark:bg-slate-700 text-white shadow-lg dark:shadow-md" : "bg-white/40 dark:bg-gray-300/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Custom Name Input */}
            {activeTab === "Other" && (
              <div className="animate-in slide-in-from-top-2 duration-300 mb-4">
                <input
                  autoFocus
                  type="text"
                  placeholder="Custom Name (e.g. Chest & Back)"
                  className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md rounded-2xl font-bold outline-none border-2 border-accent-500/20 focus:border-accent-500 transition-all text-sm text-slate-800 dark:text-slate-200"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                />
              </div>
            )}

            {/* --- NEW: NOTES SECTION --- */}
            <div className="mb-4">
              <textarea
                placeholder="How did it feel? (Optional note)"
                className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md rounded-2xl font-medium outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 transition-all text-sm min-h-[80px] resize-none text-slate-800 dark:text-slate-200"
                value={workoutNote}
                onChange={(e) => setWorkoutNote(e.target.value)}
              />
            </div>

            {/* --- NEW: IMAGE UPLOAD SECTION --- */}
            <div className="mb-6">
              {imagePreview ? (
                <div className="relative group inline-block w-full">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full aspect-video object-cover rounded-2xl border-2 border-accent-500/20 shadow-md"
                  />
                  {/* Uploading overlay while Cloudinary upload is in-flight */}
                  {isPhotoUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
                      <div className="p-3 bg-white/10 rounded-2xl text-white mb-2 border border-white/20">
                        <Loader2 size={22} strokeWidth={3} className="animate-spin" />
                      </div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">
                        Uploading...
                      </p>
                      <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-400 rounded-full animate-progress-loading" />
                      </div>
                    </div>
                  )}
                  {!isPhotoUploading && (
                    <button
                      onClick={() => { setSelectedSetImage(null); setImagePreview(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg dark:shadow-md"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <label
                  className={`relative overflow-hidden flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-[24px] transition-colors group ${
                    isPhotoUploading
                      ? "border-accent-300 bg-accent-50/40 cursor-wait pointer-events-none"
                      : "border-slate-200 cursor-pointer hover:bg-slate-50"
                  }`}
                >
                  {isPhotoUploading ? (
                    <div className="flex flex-col items-center justify-center w-full px-8 animate-in fade-in duration-200">
                      <div className="p-3 bg-accent-50 rounded-2xl text-accent-500 mb-2">
                        <Loader2 size={22} strokeWidth={3} className="animate-spin" />
                      </div>
                      <p className="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-2">
                        Uploading...
                      </p>
                      <div className="w-32 h-1 bg-accent-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-500 rounded-full animate-progress-loading" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Plus className="text-slate-300 group-hover:text-accent-500 transition-colors mb-2" size={24} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add Progress Photo</p>
                    </div>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isPhotoUploading}
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>

            {nullData && (
              <p className="text-red-500 dark:text-red-400 text-sm mb-4 font-bold italic">
                Please complete at least one set!
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFinishPrompt(false);
                  setActiveTab("");
                  setNullData(false);
                  setImagePreview(null); // Clear image on cancel
                }}
                className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveWorkout}
                disabled={!workoutName || isPhotoUploading}
                className={`flex-1 py-4 font-bold rounded-2xl shadow-lg dark:shadow-md transition-all ${
                  !workoutName || isPhotoUploading ? "bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed" : "bg-accent-gradient text-white active:scale-95"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingSave && (
        <LoadingScreen
          variant="overlay"
          icon={Trophy}
          title="Finalizing Gains"
          caption="Saving your workout..."
        />
      )}

      {finishedSummary && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xl z-[500] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping duration-[2000ms]"></div>
            <div className="relative bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-8 rounded-full shadow-xl dark:shadow-md border border-white/40 dark:border-white/10">
              <PartyPopper size={48} className="text-accent-500 animate-bounce" />
            </div>
          </div>
          <div className="w-full max-w-[280px] text-center">
            <p className="text-accent-500 dark:text-accent-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-2">
              Workout Complete
            </p>
            <h2 className="text-slate-800 dark:text-slate-100 font-bold text-xl tracking-tight mb-5 capitalize truncate">
              {finishedSummary.name}
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl py-3">
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg leading-none">
                  {finishedSummary.durationMin}
                </p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Min
                </p>
              </div>
              <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl py-3">
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg leading-none">
                  {finishedSummary.exerciseCount}
                </p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Moves
                </p>
              </div>
              <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl py-3">
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg leading-none">
                  {finishedSummary.totalSets}
                </p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  Sets
                </p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-accent-500 rounded-full animate-progress-loading"></div>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-4 animate-bounce">
              Heading home...
            </p>
          </div>
        </div>
      )}

      {/* LIBRARY MODAL — opens with the category locked to whichever
          quick-add tab the user tapped. Title reflects the chosen tab. */}
      <ExerciseLibrarySheet
        open={!!libraryCategory}
        library={library}
        onClose={() => setLibraryCategory(null)}
        onPick={addExercise}
        onEdit={setEditingExercise}
        onDelete={setShowDeleteConfirm}
        showAddNew
        lockedCategory={libraryCategory === "All" ? null : libraryCategory}
        disabledIds={exercises
          .map((e) => e.exerciseId)
          .filter(Boolean)
          .map(String)}
        title={
          libraryCategory === "Stretching"
            ? "Stretch Library"
            : libraryCategory === "Warmup"
            ? "Warmup Library"
            : libraryCategory === "Strength"
            ? "Strength Library"
            : "Library"
        }
      />

      {/* EDIT LIBRARY ITEM MODAL */}
      <EditExerciseModal
        exercise={editingExercise}
        onChange={setEditingExercise}
        onClose={() => setEditingExercise(null)}
        onSave={updateLibraryItem}
        saveLabel="Save Changes"
      />

      {/* LIBRARY EDIT VALIDATION ERROR (e.g. duplicate name) */}
      <ConfirmModal
        open={!!libraryEditError}
        onClose={() => setLibraryEditError(null)}
        onConfirm={() => setLibraryEditError(null)}
        title="Action not allowed"
        message={libraryEditError || ''}
        confirmLabel="OK"
        icon={AlertTriangle}
        tone="warning"
        singleAction
      />

      {/* DELETE LIBRARY ITEM CONFIRM */}
      <ConfirmModal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => deleteLibraryItem(showDeleteConfirm)}
        title="Delete Exercise?"
        message={<>This will remove it from your library forever.<br />Existing sessions won't be affected.</>}
        icon={AlertTriangle}
      />

      {/* PR HISTORY BOTTOM SHEET */}
      <ExerciseHistorySheet
        data={selectedPrHistory}
        zIndex="z-[600]"
        onClose={() => {
          setSelectedPrHistory(null);
          // Reopen exercise actions if we came from there
          if (selectedExerciseActions && !exerciseToDelete) {
            const exercise = exercises.find(e => e.instanceId === selectedExerciseActions.instanceId);
            if (exercise) {
              setSelectedExerciseActions(exercise);
            }
          }
        }}
        historyLimit={historyLimit}
        onLoadMore={() => setHistoryLimit((prev) => prev + 5)}
      />

      {/* EXERCISE DELETE PROMPT */}
      <ConfirmModal
        open={!!exerciseToDelete}
        onClose={() => setExerciseToDelete(null)}
        onConfirm={() => {
          setExercises(
            exercises.filter((e) => e.instanceId !== exerciseToDelete),
          );
          setExerciseToDelete(null);
          setSelectedExerciseActions(null);
        }}
        title="Remove Exercise?"
        message="Are you sure you want to remove this exercise from your active session?"
        confirmLabel="Yes, Remove it"
        icon={AlertTriangle}
      />

      {/* EXERCISE ACTIONS BOTTOM SHEET */}
      {selectedExerciseActions && (
        <BottomSheet
          open
          onClose={() => setSelectedExerciseActions(null)}
          zIndex="z-[500]"
          maxHeight="60vh"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight capitalize">
                {getDisplayName(selectedExerciseActions, libraryMap)}
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                {selectedExerciseActions.type} • {selectedExerciseActions.muscle}
              </p>
            </div>
            <button 
              onClick={() => setSelectedExerciseActions(null)} 
              className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Settings Section */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Settings</p>
            <div className="bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl p-4 space-y-4">
              {/* Resistance */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resistance</span>
                <div className="flex items-center gap-1 px-3 py-2 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-white/40 dark:border-white/10">
                  <input 
                    type="number"
                    className="w-12 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none bg-transparent text-right"
                    value={selectedExerciseActions.resistance || 0}
                    onChange={(e) => {
                      setExercises(exercises.map(item => 
                        item.instanceId === selectedExerciseActions.instanceId 
                          ? { ...item, resistance: e.target.value } 
                          : item
                      ));
                      setSelectedExerciseActions({
                        ...selectedExerciseActions,
                        resistance: e.target.value
                      });
                    }}
                  />
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">kg</span>
                </div>
              </div>

              {/* Execution */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Execution</span>
                <button 
                  onClick={() => {
                    const newExecution = selectedExerciseActions.execution === "Unilateral" ? "Bilateral" : "Unilateral";
                    setExercises(exercises.map(item => 
                      item.instanceId === selectedExerciseActions.instanceId 
                        ? { ...item, execution: newExecution } 
                        : item
                    ));
                    setSelectedExerciseActions({
                      ...selectedExerciseActions,
                      execution: newExecution
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-white/40 dark:border-white/10 active:scale-95 transition-all"
                >
                  <div className={`w-2 h-2 rounded-full ${selectedExerciseActions.execution === "Unilateral" ? "bg-fuchsia-500" : "bg-accent-500"}`}></div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {selectedExerciseActions.execution === "Unilateral" ? "Unilateral" : "Bilateral"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Actions</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  fetchLatestForExercise(selectedExerciseActions.instanceId);
                  setSelectedExerciseActions(null);
                }}
                className="w-full bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border border-white/40 dark:border-white/10 p-4 rounded-2xl flex items-center gap-3 hover:bg-white/60 dark:hover:bg-white/10 hover:border-accent-200 dark:hover:border-accent-700 transition-all active:scale-[0.98]"
              >
                <div className="bg-accent-50 dark:bg-accent-900/30 p-2 rounded-xl text-accent-500 dark:text-accent-400">
                  <RefreshCw size={18} strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Fetch Latest Data</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Update with your most recent performance</p>
                </div>
                <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
              </button>

              <button
                onClick={() => {
                  handlePrClick(selectedExerciseActions.exerciseId, getDisplayName(selectedExerciseActions, libraryMap));
                }}
                className="w-full bg-white/40 dark:bg-gray-300/5 backdrop-blur-md border border-white/40 dark:border-white/10 p-4 rounded-2xl flex items-center gap-3 hover:bg-white/60 dark:hover:bg-white/10 hover:border-amber-200 dark:hover:border-amber-700 transition-all active:scale-[0.98]"
              >
                <div className="bg-amber-50 dark:bg-amber-900/30 p-2 rounded-xl text-amber-500 dark:text-amber-400">
                  <History size={18} strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">View History</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">See all past performances</p>
                </div>
                <ChevronRight size={18} className="text-slate-300 dark:text-slate-600" />
              </button>
            </div>
          </div>

          {/* Remove Section */}
          <button
            onClick={() => {
              setExerciseToDelete(selectedExerciseActions.instanceId);
            }}
            className="w-full bg-red-50/50 dark:bg-red-900/20 backdrop-blur-md border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all active:scale-[0.98]"
          >
            <Trash2 size={18} className="text-red-500 dark:text-red-400" />
            <span className="font-semibold text-red-500 dark:text-red-400 text-sm">Remove Exercise</span>
          </button>
        </BottomSheet>
      )}
    </div>
  );
};

export default ActiveWorkout;
