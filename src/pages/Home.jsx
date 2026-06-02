import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { buildLibraryMap, getDisplayName } from "../utils/exerciseLookup";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Play,
  ChevronRight,
  X,
  Trash2,
  Clock,
  Dumbbell,
  Flame,
  Move,
  Activity,
  PauseCircle,
  TrendingUp,
  TrendingDown,
  MoveHorizontal,
  Zap,
  CheckCircle2,
  Loader2,
  Edit3,
  AlertTriangle,
  Plus,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
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
import BottomSheet from "../components/BottomSheet";
import ExerciseLibrarySheet from "../components/ExerciseLibrarySheet";

// Wraps an exercise card inside the edit-workout modal so it can be
// reordered by drag-and-drop. Children receive `dragHandleProps` to spread
// onto the grip element. Mirrors the SortableExercise pattern used on the
// ActiveWorkout page, including size-locking so the dragged card keeps
// its natural dimensions over slots of varying height.
const SortableEditExercise = ({ id, children }) => {
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
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
};

// Returns "Today", "Yesterday", or "DD Mon" depending on how far back `date` is.
const formatLastSessionLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const formatSessionTime = (s) => {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

// Isolated subscriber so the parent Home does NOT re-render every second.
const SessionLiveTime = React.memo(({ className }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const unsub = subscribeWorkoutTimer((state) => {
      if (state) setSeconds(state.seconds);
    });
    return unsub;
  }, []);
  return <span className={className}>{formatSessionTime(seconds)}</span>;
});

const Home = () => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStartPrompt, setShowStartPrompt] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [isWarming, setIsWarming] = useState(false);
  const [warmupStatus, setWarmupStatus] = useState("idle");
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showImageDeleteConfirm, setShowImageDeleteConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // --- Edit completed workout state ---
  const [editingWorkout, setEditingWorkout] = useState(null);
  // The user's exercise library. Fetched on mount so we can resolve a
  // workout detail's display name through it (renames propagate retroactively).
  // Also reused by the in-Home edit-workout flow's exercise picker.
  const [library, setLibrary] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  // Set of `_dndId`s for exercise cards that are expanded in the edit
  // modal. Cards default to collapsed to keep the list scannable; the
  // user expands a card only when they actually need to edit its sets.
  const [expandedEditIds, setExpandedEditIds] = useState(() => new Set());

  const calculateIntensity = (workout) => {
    if (!workout.duration || workout.duration === 0) return 0;
    let totalVolume = 0;

    workout.details?.forEach((ex) => {
      if (ex.type === "Strength") {
        // Use values directly from the workout detail object
        const baseResistance = Number(ex.resistance) || 0;
        const multiplier = ex.execution === "Single" ? 2 : 1;

        ex.sets.forEach((set) => {
          const plateWeight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;
          // Formula: (Weight + Resistance) * Reps * Multiplier
          totalVolume += (plateWeight + baseResistance) * reps * multiplier;
        });
      }
    });
    return (totalVolume / workout.duration).toFixed(1);
  };

  // --- PROGRESS CALCULATION ---
  const getProgress = (currentWorkout, index) => {
    const currentName = currentWorkout.name.toLowerCase().trim();
    const currentScore = parseFloat(calculateIntensity(currentWorkout));

    const previousSameWorkout = history
      .slice(index + 1)
      .find((w) => w.name.toLowerCase().trim() === currentName);

    if (!previousSameWorkout) return { type: "up", value: 100 };

    const previousScore = parseFloat(calculateIntensity(previousSameWorkout));
    if (previousScore === 0) return { type: "neutral", value: 0 };

    const percentChange =
      ((currentScore - previousScore) / previousScore) * 100;

    if (percentChange > 0.5)
      return { type: "up", value: Math.round(percentChange) };
    if (percentChange < -0.5)
      return { type: "down", value: Math.abs(Math.round(percentChange)) };
    return { type: "neutral", value: 0 };
  };

  // Streak = number of consecutive "active" workout days where between any
  // two adjacent workout days the gap is at most 3 break days (i.e. a date
  // diff of ≤ 4 days). If the most recent workout itself is more than 4 days
  // in the past, the streak is considered broken (0).
  const streak = useMemo(() => {
    if (!history || history.length === 0) return 0;
    const MS_PER_DAY = 86400000;
    const MAX_GAP = 4; // up to 3 rest days between workouts

    const toLocalMidnight = (d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    };
    const diffDays = (a, b) => Math.round((a - b) / MS_PER_DAY);

    // Unique workout day timestamps (local midnight), sorted descending.
    const uniqueDays = [
      ...new Set(history.map((w) => toLocalMidnight(w.date))),
    ].sort((a, b) => b - a);

    const today = toLocalMidnight(new Date());
    if (diffDays(today, uniqueDays[0]) > MAX_GAP) return 0;

    let count = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (diffDays(uniqueDays[i - 1], uniqueDays[i]) <= MAX_GAP) count += 1;
      else break;
    }
    return count;
  }, [history]);

  const streakEmoji = useMemo(() => {
    if (streak === 0) return "\uD83D\uDCA4"; // 💤
    if (streak < 3) return "\u2728"; // ✨
    if (streak < 7) return "\uD83D\uDD25"; // 🔥
    if (streak < 14) return "\u26A1"; // ⚡
    if (streak < 30) return "\uD83D\uDCAA"; // 💪
    return "\uD83D\uDC51"; // 👑
  }, [streak]);

  // Build a quick lookup so any render path can resolve a detail's
  // canonical name without scanning the array.
  const libraryMap = useMemo(() => buildLibraryMap(library), [library]);

  const fetchLibrary = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/exercises/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setLibrary(res.data || []);
    } catch (err) {
      console.error("Failed to fetch exercise library:", err);
      setLibrary([]);
    }
  };

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchWorkouts();
      fetchLibrary();
    }

    const activeData = localStorage.getItem("active_session_exercises");
    const activeSeconds = localStorage.getItem("active_session_seconds");
    const pausedStatus = localStorage.getItem("active_session_is_active");

    const hasExercises = activeData && JSON.parse(activeData).length > 0;
    const hasTimeElapsed = activeSeconds && parseInt(activeSeconds) > 0;

    if (hasExercises || hasTimeElapsed) {
      setHasActiveSession(true);
      if (pausedStatus !== null && JSON.parse(pausedStatus) === false) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    }
  }, [user?.id]);

  const confirmDelete = async () => {
    if (!workoutToDelete) return;
    try {
      await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/workouts/${workoutToDelete}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setWorkoutToDelete(null);
      fetchWorkouts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleMainButtonClick = () => {
    if (hasActiveSession) {
      navigate("/workout", { state: { from: "home" } });
    } else {
      setShowStartPrompt(true);
    }
  };

  const confirmStartWorkout = () => {
    setShowStartPrompt(false);
    navigate("/workout", { state: { from: "home" } });
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleWarmup = async () => {
    setIsWarming(true);
    setWarmupStatus("loading");
    try {
      await axios.get(process.env.REACT_APP_API_URL);
      setWarmupStatus("success");
      setTimeout(() => {
        setIsWarming(false);
        setWarmupStatus("idle");
      }, 2000);
    } catch (err) {
      setWarmupStatus("success");
      setTimeout(() => {
        setIsWarming(false);
        setWarmupStatus("idle");
      }, 2000);
    }
  };

  // --- DRAG-AND-DROP (edit-workout exercise reorder) ---
  // Touch sensor uses a short delay so the BottomSheet still scrolls
  // normally; users must dwell on the grip handle to begin a drag.
  const editSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleEditDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateEditingDetails((draft) => {
      const oldIndex = draft.details.findIndex((d) => d._dndId === active.id);
      const newIndex = draft.details.findIndex((d) => d._dndId === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      draft.details = arrayMove(draft.details, oldIndex, newIndex);
    });
  };

  // --- EDIT WORKOUT HELPERS ---
  const openEditWorkout = async (workout) => {
    // Deep clone to avoid mutating the displayed workout while editing.
    // Each detail also gets a stable `_dndId` so the drag-and-drop list
    // has unique keys that survive reorders (positional index isn't
    // stable, and the same exercise may appear twice in a workout).
    const clone = JSON.parse(JSON.stringify(workout));
    const base = Date.now();
    clone.details = (clone.details || []).map((d, i) => ({
      ...d,
      _dndId: `edit-${base}-${i}`,
    }));
    setEditingWorkout(clone);
    // Start every card collapsed so the modal stays compact.
    setExpandedEditIds(new Set());
    // Refresh the library on edit-open so the picker reflects any
    // changes made on the Library page since the page mounted.
    fetchLibrary();
  };

  const toggleEditExpanded = (dndId) => {
    setExpandedEditIds((prev) => {
      const next = new Set(prev);
      if (next.has(dndId)) next.delete(dndId);
      else next.add(dndId);
      return next;
    });
  };

  const updateEditingDetails = (mutator) => {
    setEditingWorkout((prev) => {
      if (!prev) return prev;
      const next = { ...prev, details: prev.details.map((d) => ({ ...d, sets: d.sets.map((s) => ({ ...s })) })) };
      mutator(next);
      return next;
    });
  };

  const editUpdateSet = (exIdx, setIdx, field, value) => {
    updateEditingDetails((draft) => {
      draft.details[exIdx].sets[setIdx][field] = value;
    });
  };

  const editAddSet = (exIdx) => {
    updateEditingDetails((draft) => {
      const ex = draft.details[exIdx];
      ex.sets.push(ex.type === "Strength" ? { weight: "", reps: "" } : { time: 0 });
    });
  };

  const editRemoveSet = (exIdx, setIdx) => {
    updateEditingDetails((draft) => {
      draft.details[exIdx].sets.splice(setIdx, 1);
    });
  };

  const editRemoveExercise = (exIdx) => {
    updateEditingDetails((draft) => {
      draft.details.splice(exIdx, 1);
    });
  };

  const editToggleExecution = (exIdx) => {
    updateEditingDetails((draft) => {
      draft.details[exIdx].execution =
        draft.details[exIdx].execution === "Unilateral" ? "Bilateral" : "Unilateral";
    });
  };

  const editUpdateResistance = (exIdx, value) => {
    updateEditingDetails((draft) => {
      draft.details[exIdx].resistance = value;
    });
  };

  const editAddExerciseFromLibrary = (libEx) => {
    // Generate the id once so we can both attach it to the new detail and
    // pre-expand the card (a freshly added exercise is almost always one
    // the user wants to immediately edit).
    const newDndId = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    updateEditingDetails((draft) => {
      draft.details.push({
        // Canonical (and only) link. The display name is resolved live
        // through the library on every render.
        exerciseId: libEx._id,
        type: libEx.type,
        muscle: libEx.muscle,
        execution: "Bilateral",
        resistance: 0,
        sets: libEx.type === "Strength" ? [{ weight: "", reps: "" }] : [{ time: 0 }],
        _dndId: newDndId,
      });
    });
    setExpandedEditIds((prev) => {
      const next = new Set(prev);
      next.add(newDndId);
      return next;
    });
    setShowExercisePicker(false);
  };

  const saveEditedWorkout = async () => {
    if (!editingWorkout) return;
    setEditSaving(true);
    setEditError(null);
    try {
      // Drop empty sets so we don't persist garbage. Also strip the
      // client-only `_dndId` used for drag-and-drop keying so it doesn't
      // bleed into the persisted document.
      const cleanedDetails = editingWorkout.details
        .map(({ _dndId, ...ex }) => ({
          ...ex,
          sets: ex.sets.filter((s) =>
            ex.type === "Strength"
              ? s.weight !== "" && s.reps !== "" && Number(s.reps) > 0
              : s.time && Number(s.time) > 0,
          ),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (cleanedDetails.length === 0) {
        setEditError("At least one exercise with valid sets is required.");
        setEditSaving(false);
        return;
      }

      const payload = {
        name: (editingWorkout.name || "").trim() || "Daily Session",
        notes: editingWorkout.notes || "",
        duration: editingWorkout.duration,
        muscles: [...new Set(cleanedDetails.map((d) => d.muscle))],
        details: cleanedDetails,
      };

      const res = await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/workouts/${editingWorkout._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Sync local lists
      setHistory((prev) => prev.map((w) => (w._id === res.data._id ? res.data : w)));
      setSelectedWorkout(res.data);
      setEditingWorkout(null);
    } catch (err) {
      console.error("Edit save failed:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unknown error";
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleImageUpdate = async (workoutId, imageUrl, imagePublicId) => {
  try {
    const res = await axios.patch(`${process.env.REACT_APP_API_URL}/api/workouts/${workoutId}/update-image`, {
      imageUrl,
      imagePublicId
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Update local states to reflect changes immediately
    setSelectedWorkout(res.data);
    setHistory(prev => prev.map(w => w._id === workoutId ? res.data : w));
  } catch (err) {
    console.error("Error updating image:", err);
    alert("Failed to update image");
  }
};

const onFileChange = async (e, workoutId) => {
  const file = e.target.files[0];
  if (!file) return;
  // Reset input so picking the same file again still triggers onChange
  e.target.value = "";

  try {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name", process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);

    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    );

    await handleImageUpdate(workoutId, uploadRes.data.secure_url, uploadRes.data.public_id);
  } catch (err) {
    alert("Upload failed");
  } finally {
    setIsUploading(false);
  }
};

  return (
    <div className="relative p-6 min-h-screen pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl leading-none">{streakEmoji}</span>
            <span>
              {streak} <span className="text-slate-400 dark:text-slate-500 font-bold">Day{streak === 1 ? "" : "s"}</span>
            </span>
          </h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
            {streak > 0 ? "Streak active" : "No streak"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWarmup}
            className="p-2.5 bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 transition-all active:scale-90 shadow-sm border border-amber-100 dark:border-amber-400/20"
            title="Warmup Server"
          >
            <Zap size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Start / Resume Workout Card */}
      <div className="relative mb-8 rounded-[28px] overflow-hidden transition-all duration-500 shadow-sm bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10">
        {/* Decorative dumbbell silhouette */}
        <Dumbbell
          className={`absolute -right-6 -bottom-8 w-32 h-32 rotate-12 pointer-events-none ${
            hasActiveSession
              ? isPaused
                ? "text-slate-500/10 dark:text-[#222937]"
                : "text-orange-500/10 dark:text-[#222937]"
              : "text-accent-500/10 dark:text-[#222937]"
          } ${!isPaused && hasActiveSession ? "animate-spin-slow" : ""}`}
        />

        <div className="relative z-10 p-5">
          {/* Status pill */}
          <div className="flex items-center justify-between mb-3.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white shadow-sm ${
                hasActiveSession
                  ? isPaused
                    ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
                    : "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
                  : "bg-accent-gradient"
              }`}
            >
              <span
                className={`w-1 h-1 rounded-full ${
                  hasActiveSession && !isPaused
                    ? "bg-white animate-pulse"
                    : isPaused
                      ? "bg-slate-300"
                      : "bg-accent-200"
                }`}
              />
              <span className="text-[8px] font-bold uppercase tracking-[0.2em]">
                {hasActiveSession
                  ? isPaused
                    ? "Paused"
                    : "Live"
                  : "Ready"}
              </span>
            </div>

            <div className="bg-white/50 dark:bg-white/10 backdrop-blur-md w-7 h-7 rounded-full flex items-center justify-center border border-white/40 dark:border-white/10 text-slate-500 dark:text-slate-300">
              {hasActiveSession ? (
                isPaused ? (
                  <PauseCircle size={13} />
                ) : (
                  <Clock size={13} className="animate-pulse" />
                )
              ) : (
                <Dumbbell size={13} />
              )}
            </div>
          </div>

          {/* Heading + subtext */}
          <h2 className="text-xl font-black mb-1 tracking-tight leading-tight text-slate-800 dark:text-slate-100">
            {hasActiveSession
              ? isPaused
                ? "Workout Paused"
                : "In Progress"
              : "Let's get moving"}
          </h2>
          {hasActiveSession ? (
            <div className="flex items-baseline gap-2 mb-4">
              <SessionLiveTime className="text-md font-mono font-bold text-slate-700 dark:text-slate-200 leading-none tracking-tight" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {isPaused ? "On hold" : "Elapsed"}
              </span>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4 leading-snug">
              {history[0]
                ? <><span>Last session</span> <b>{formatLastSessionLabel(history[0].date)}</b></>
                : "Start your first workout!"}
            </p>
          )}

          {/* CTA Button */}
          <button
            onClick={handleMainButtonClick}
            className={`group w-auto py-3 px-4 rounded-[2rem] flex items-center justify-between active:scale-[0.98] transition-all text-white font-bold shadow-lg ${
              hasActiveSession
                ? isPaused
                  ? "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
                  : "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500"
                : "bg-accent-gradient"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-2xl bg-white/25 border border-white/30 flex items-center justify-center">
                {hasActiveSession ? (
                  isPaused ? (
                    <PauseCircle size={12} />
                  ) : (
                    <Clock size={12} className="animate-pulse" />
                  )
                ) : (
                  <Play size={11} fill="currentColor" />
                )}
              </span>
              <span className="text-[11px] tracking-[0.18em]">
                {hasActiveSession ? "CONTINUE WORKOUT" : "START WORKOUT"}
              </span>
            </span>
            <ChevronRight
              size={14}
              className="text-white/80 group-active:translate-x-1 transition-transform"
            />
          </button>
        </div>
      </div>


      {/* Delete Workout Confirmation */}
      <ConfirmModal
        open={!!workoutToDelete}
        onClose={() => setWorkoutToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Workout?"
        message="This action cannot be undone. This workout will be permanently removed from your history."
        confirmLabel="Delete Permanently"
        cancelLabel="Keep Workout"
      />

      {/* Confirmation Start Prompt Modal */}
      <ConfirmModal
        open={showStartPrompt}
        onClose={() => setShowStartPrompt(false)}
        onConfirm={confirmStartWorkout}
        title="Ready to Start?"
        message="This will begin a new session and start the timer. Are you ready to crush your goals?"
        confirmLabel="Let's Go!"
        cancelLabel="Not yet"
        icon={Play}
        tone="accent"
      />

      {/* History List */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
          <Activity size={20} className="text-accent-500" /> Recent Workouts
        </h3>
        {history.length > 0 && (
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-md uppercase">
            Last {Math.min(history.length, visibleLimit)} Workouts
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[24px] flex justify-between items-center border border-white/40 dark:border-white/10 shadow-sm relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-50/60 dark:via-slate-800/60 to-transparent -translate-x-full animate-shimmer"></div>
              <div className="flex items-center gap-4 w-full">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl w-11 h-11 animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-md w-1/2 animate-pulse"></div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-md w-1/4 animate-pulse"></div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 w-6 h-6 rounded-full animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {history.length > 0 ? (
            <>
              {history.slice(0, visibleLimit).map((workout, index) => {
                const progress = getProgress(workout, index);
                const intensity = calculateIntensity(workout);

                return (
                  <div
                    key={workout._id}
                    onClick={() => setSelectedWorkout(workout)}
                    className="group bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-3 rounded-[24px] flex justify-between items-center border border-white/40 dark:border-white/10 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center min-w-[52px] ${
                          progress.type === "up"
                            ? "bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400"
                            : progress.type === "down"
                              ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                              : progress.type === "neutral"
                                ? "bg-fuchsia-50 dark:bg-fuchsia-700/10 text-fuchsia-600 dark:text-fuchsia-400"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {progress.type === "up" && <TrendingUp size={20} />}
                        {progress.type === "down" && <TrendingDown size={20} />}
                        {progress.type === "neutral" && (
                          <MoveHorizontal size={20} />
                        )}
                        {progress.value !== null && (
                          <span className="text-[8px] font-bold mt-1">
                            {progress.value}%
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 leading-tight capitalize">
                          {workout.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                            Score: {intensity}
                          </span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-tighter">
                            {workout.duration ? `${workout.duration} MINS` : ""}
                          </span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-tighter">
                            {new Date(workout.date).toLocaleDateString(
                              "en-GB",
                              { day: "2-digit", month: "short" },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkoutToDelete(workout._id);
                        }}
                        className="p-2 text-slate-200 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={18} className="text-slate-200 dark:text-slate-700" />
                    </div>
                  </div>
                );
              })}

              {visibleLimit < history.length && (
                <button
                  onClick={() => setVisibleLimit((prev) => prev + 8)}
                  className="w-full py-4 mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Activity size={14} className="text-accent-500" />
                  Load Older Workouts
                </button>
              )}
            </>
          ) : (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-12 rounded-[32px] border-2 border-dashed border-white/40 dark:border-white/10 text-center">
              <Dumbbell size={24} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-400 dark:text-slate-500 text-sm italic">
                No workouts recorded yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedWorkout && (
        <BottomSheet
          open
          onClose={() => setSelectedWorkout(null)}
          zIndex="z-[200]"
          maxHeight="90vh"
        >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 capitalize">
                  {selectedWorkout.name}
                </h2>
                <p className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">
                  {new Date(selectedWorkout.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditWorkout(selectedWorkout)}
                  className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-500 dark:text-slate-300 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
                  title="Edit workout"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  onClick={() => setSelectedWorkout(null)}
                  className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* --- NEW: IMAGE & NOTE SECTION --- */}
            <div className="mb-6">
              {selectedWorkout.imageUrl ? (
                /* --- VIEW IMAGE STATE --- */
                <div 
                  style={{ height: '180px' }}
                  className="relative w-full aspect-square rounded-[32px] overflow-hidden shadow-md border border-slate-100 dark:border-slate-800 group"
                >
                  <img 
                    onClick={() => setFullscreenImage(selectedWorkout.imageUrl)}
                    src={selectedWorkout.imageUrl} 
                    alt="Workout Progress" 
                    className="w-full h-full object-cover cursor-zoom-in active:scale-[0.98] transition-transform"
                  />

                  {/* Action Buttons */}
                  <div className="absolute top-3 right-3 flex gap-2 z-10">
                    <label className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white hover:bg-white/40 transition-colors cursor-pointer shadow-lg dark:shadow-md border border-white/20">
                      <Edit3 size={16} />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => onFileChange(e, selectedWorkout._id)} 
                      />
                    </label>
                    
                    <button 
                      onClick={() => setShowImageDeleteConfirm(true)}
                      className="bg-red-500/80 backdrop-blur-md p-2 rounded-xl text-white hover:bg-red-600 transition-colors shadow-lg dark:shadow-md border border-white/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {selectedWorkout.notes && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
                      <span className="text-[8px] block font-black uppercase tracking-[0.2em] text-accent-400 mb-1">
                        Session Note
                      </span>
                      <p className="text-white text-sm font-medium leading-relaxed drop-shadow-md line-clamp-3">
                        {selectedWorkout.notes}
                      </p>
                    </div>
                  )}

                  {/* Uploading overlay (image replace flow) */}
                  {isUploading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
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
                </div>
              ) : (
                /* --- ADD IMAGE STATE (Empty State) --- */
                <label
                  className={`relative overflow-hidden flex flex-col items-center justify-center w-full h-[120px] border-2 border-dashed rounded-[32px] backdrop-blur-md transition-all group ${
                    isUploading
                      ? "border-accent-300 bg-accent-50/40 dark:bg-accent-500/10 cursor-wait pointer-events-none"
                      : "border-white/50 dark:border-white/10 bg-white/30 dark:bg-gray-300/5 cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 hover:border-accent-300"
                  }`}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center w-full px-8 animate-in fade-in duration-200">
                      <div className="p-3 bg-accent-50 rounded-2xl text-accent-500 mb-2">
                        <Loader2 size={20} strokeWidth={3} className="animate-spin" />
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
                      <div className="p-3 bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl text-slate-400 dark:text-slate-500 group-hover:bg-accent-50 dark:group-hover:bg-accent-500/10 group-hover:text-accent-500 transition-colors mb-2">
                        <Plus size={20} strokeWidth={3} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Add Session Photo</p>
                    </div>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => onFileChange(e, selectedWorkout._id)}
                  />
                </label>
              )}
            </div>

            <ConfirmModal
              open={showImageDeleteConfirm}
              onClose={() => setShowImageDeleteConfirm(false)}
              onConfirm={() => {
                handleImageUpdate(selectedWorkout._id, null, null);
                setShowImageDeleteConfirm(false);
              }}
              title="Delete Photo?"
              message="This will permanently remove the image from this workout record."
              confirmLabel="Yes, Delete Photo"
              icon={AlertTriangle}
            />
            <div className="space-y-6">
              {selectedWorkout.details?.map((ex, idx) => (
                <div
                  key={idx}
                  className="bg-white/30 dark:bg-gray-300/5 backdrop-blur-md p-4 rounded-3xl border border-white/40 dark:border-white/10"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {ex.type === "Warmup" ? (
                      <Flame className="text-amber-500" size={18} />
                    ) : ex.type === "Stretching" ? (
                      <Move className="text-fuchsia-500" size={18} />
                    ) : (
                      <Dumbbell className="text-accent-500" size={18} />
                    )}
                    <div className="flex flex-row gap-2 items-center">
                      <h5 className="font-bold text-slate-800 dark:text-slate-100 capitalize leading-tight">
                        {getDisplayName(ex, libraryMap)}
                      </h5>
                 
                      {Number(ex.resistance) > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                          <div className="w-1 h-1 rounded-full bg-amber-400" />
                          +{ex.resistance}kg
                        </span>
                      )}

                      {ex.execution === 'Unilateral' && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 dark:bg-fuchsia-700/10 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-100 dark:border-fuchsia-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                          <div className="w-1 h-1 rounded-full bg-fuchsia-400" />
                          Unilateral
                        </span>
                      )}
                        
                      {ex.execution === 'Bilateral' && (
                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                          Bilateral
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ex.sets.map((set, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex-1 basis-[calc(50%-0.25rem)] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/15"
                      >
                        <span className="flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 text-[9px] font-bold leading-none">
                          SET {sIdx + 1}
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                          {ex.type === "Strength"
                            ? `${set.weight} x ${set.reps}`
                            : formatTime(set.time)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedWorkout(null)}
              className="w-full mt-8 bg-white/50 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm text-slate-700 dark:text-slate-100 font-bold py-4 rounded-2xl hover:bg-white/70 dark:hover:bg-white/20 active:scale-[0.98] transition-all"
            >
              CLOSE
            </button>
        </BottomSheet>
      )}

      {/* === EDIT WORKOUT MODAL === */}
      {editingWorkout && (
        <BottomSheet
          open
          onClose={() => setEditingWorkout(null)}
          zIndex="z-[300]"
          maxHeight="92vh"
          padding="p-6"
        >
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-accent-500 dark:text-accent-400 uppercase tracking-[0.2em] mb-1">Edit Session</p>
                <input
                  type="text"
                  value={editingWorkout.name}
                  onChange={(e) => setEditingWorkout({ ...editingWorkout, name: e.target.value })}
                  placeholder="Workout name"
                  className="text-2xl font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-accent-500 focus:outline-none w-full pb-1"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-4">
                <button
                  onClick={saveEditedWorkout}
                  disabled={editSaving}
                  className="px-5 py-2.5 bg-accent-gradient text-white font-bold text-xs uppercase tracking-wider rounded-full shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {editSaving ? (<><Loader2 size={14} className="animate-spin" /> Saving</>) : ("Save")}
                </button>
                <button
                  onClick={() => { setEditingWorkout(null); setEditError(null); }}
                  className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Duration + Notes */}
            <div className="mb-5 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Duration</label>
                <div className="mt-1 flex items-center gap-2 bg-white/50 dark:bg-black/15 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-2xl px-4 py-3">
                  <Clock size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <input
                    type="number"
                    min="0"
                    value={editingWorkout.duration ?? 0}
                    onChange={(e) =>
                      setEditingWorkout({
                        ...editingWorkout,
                        duration: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                  />
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                    min
                    {editingWorkout.duration >= 60 && (
                      <span className="ml-1 normal-case tracking-normal text-slate-300 dark:text-slate-600">
                        ({Math.floor(editingWorkout.duration / 60)}h {editingWorkout.duration % 60}m)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Notes</label>
                <textarea
                  value={editingWorkout.notes || ""}
                  onChange={(e) => setEditingWorkout({ ...editingWorkout, notes: e.target.value })}
                  placeholder="How did it feel?"
                  rows={2}
                  className="w-full mt-1 bg-white/50 dark:bg-black/15 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-accent-400 resize-none"
                />
              </div>
            </div>

            {/* Exercises list (drag-and-drop reorderable) */}
            <DndContext
              sensors={editSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleEditDragEnd}
            >
              <SortableContext
                items={editingWorkout.details.map((d) => d._dndId)}
                strategy={verticalListSortingStrategy}
              >
            <div className="space-y-4 mb-4">
              {editingWorkout.details.map((ex, exIdx) => (
                <SortableEditExercise key={ex._dndId} id={ex._dndId}>
                  {({ dragHandleProps }) => {
                    const isExpanded = expandedEditIds.has(ex._dndId);
                    return (
                <div
                  className="bg-white/40 dark:bg-black/15 backdrop-blur-md p-4 rounded-3xl border border-white/60 dark:border-white/10"
                >
                  <div className={`flex items-center justify-between ${isExpanded ? "mb-3" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleEditExpanded(ex._dndId)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left -m-1 p-1 rounded-xl active:bg-white/30 dark:active:bg-white/5 transition-colors"
                      aria-expanded={isExpanded}
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <span
                        {...dragHandleProps}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 -ml-1 text-slate-300 dark:text-slate-600 hover:text-accent-500 dark:hover:text-accent-400 touch-none cursor-grab active:cursor-grabbing shrink-0"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </span>
                      <span className={`p-1.5 rounded-lg shrink-0 ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30" : ex.type === "Stretching" ? "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30" : "text-accent-500 bg-accent-50 dark:bg-accent-900/30"}`}>
                        {ex.type === "Warmup" ? <Flame size={14} /> : ex.type === "Stretching" ? <Move size={14} /> : <Dumbbell size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <h5 className="font-bold text-slate-800 dark:text-slate-100 capitalize text-sm truncate">{getDisplayName(ex, libraryMap)}</h5>
                        {!isExpanded && (
                          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                            {ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"}
                            {ex.type === "Strength" && Number(ex.resistance) > 0 && ` · ${ex.resistance} kg`}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    <button
                      onClick={() => editRemoveExercise(exIdx)}
                      className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg active:scale-90 transition-all shrink-0 ml-2"
                      title="Remove exercise"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Resistance + execution chips (Strength only) */}
                  {isExpanded && ex.type === "Strength" && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-white/60 dark:bg-black/15 rounded-xl border border-white/60 dark:border-white/10">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Band</span>
                        <input
                          type="number"
                          value={ex.resistance || 0}
                          onChange={(e) => editUpdateResistance(exIdx, e.target.value)}
                          className="w-10 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 text-center focus:outline-none"
                        />
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">kg</span>
                      </div>
                      <button
                        onClick={() => editToggleExecution(exIdx)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/60 dark:bg-black/15 rounded-xl border border-white/60 dark:border-white/10 active:scale-95 transition-all"
                      >
                        <div className="w-1 h-1 rounded-full bg-fuchsia-500" />
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                          {ex.execution === "Unilateral" ? "Unilateral" : "Bilateral"}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Sets — only when expanded */}
                  {isExpanded && (
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2 bg-white/60 dark:bg-black/15 rounded-xl border border-white/60 dark:border-white/10 px-3 py-2"
                      >
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold shrink-0">
                          {sIdx + 1}
                        </span>
                        {ex.type === "Strength" ? (
                          <>
                            <input
                              type="number"
                              placeholder="kg"
                              value={set.weight ?? ""}
                              onChange={(e) => editUpdateSet(exIdx, sIdx, "weight", e.target.value)}
                              className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 text-center focus:outline-none"
                            />
                            <span className="text-slate-300 dark:text-slate-600 text-xs">×</span>
                            <input
                              type="number"
                              placeholder="reps"
                              value={set.reps ?? ""}
                              onChange={(e) => editUpdateSet(exIdx, sIdx, "reps", e.target.value)}
                              className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 text-center focus:outline-none"
                            />
                          </>
                        ) : (
                          <input
                            type="number"
                            placeholder="seconds"
                            value={set.time ?? 0}
                            onChange={(e) => editUpdateSet(exIdx, sIdx, "time", Number(e.target.value))}
                            className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 text-center focus:outline-none"
                          />
                        )}
                        <button
                          onClick={() => editRemoveSet(exIdx, sIdx)}
                          className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors shrink-0"
                          title="Remove set"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => editAddSet(exIdx)}
                      className="w-full py-2 border border-dashed border-white/60 dark:border-white/15 rounded-xl text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-accent-500 hover:border-accent-300 uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} /> Add Set
                    </button>
                  </div>
                  )}
                </div>
                    );
                  }}
                </SortableEditExercise>
              ))}
            </div>
              </SortableContext>
            </DndContext>

            {/* Add exercise button */}
            <button
              onClick={() => setShowExercisePicker(true)}
              className="w-full py-3.5 border-2 border-dashed border-accent-300 dark:border-accent-700 rounded-2xl text-[11px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-widest hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <Plus size={16} /> Add Missed Exercise
            </button>

            {/* Error inline */}
            {editError && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-2xl mb-3">
                <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed break-words">{editError}</p>
              </div>
            )}

        </BottomSheet>
      )}

      {/* === EXERCISE PICKER (for edit modal) === */}
      {/* Nested above the edit-workout BottomSheet (z-[300]) so we need a
          higher z-index here. Edit/delete are intentionally not exposed
          from this entry point — manage the library on /library instead. */}
      <ExerciseLibrarySheet
        open={showExercisePicker}
        library={library}
        onClose={() => setShowExercisePicker(false)}
        onPick={editAddExerciseFromLibrary}
        title="Pick Exercise"
        zIndex="z-[400]"
        maxHeight="92vh"
      />

      <ConfirmModal
        open={isWarming}
        onClose={() => setIsWarming(false)}
        dismissible={false}
        hideActions
        title={warmupStatus === "loading" ? "Warming Up" : "Engine Ready"}
        message={
          warmupStatus === "loading"
            ? "Waking up the backend. Preparing your training environment..."
            : "Database connection established. Let's get these gains!"
        }
        icon={
          warmupStatus === "loading" ? (
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
              <div className="relative bg-amber-500 w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl dark:shadow-md shadow-amber-200">
                <Loader2 size={40} className="animate-spin" />
              </div>
            </div>
          ) : (
            <div className="relative bg-accent-gradient w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl dark:shadow-md shadow-accent-200 animate-in zoom-in">
              <CheckCircle2 size={48} />
            </div>
          )
        }
      >
        <div className="mt-6 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-[3000ms] ${warmupStatus === "loading" ? "w-full bg-amber-500" : "w-full bg-accent-500"}`}
          ></div>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-4 text-center">
          {warmupStatus === "loading" ? "System Syncing" : "Ready to Lift"}
        </p>
      </ConfirmModal>
      {/* FULLSCREEN IMAGE LIGHTBOX */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[600] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          {/* Close Button */}
          <button className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors">
            <X size={24} />
          </button>
          
          {/* Full Image */}
          <img 
            src={fullscreenImage} 
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in duration-300"
            alt="Full Progress"
          />
          
          {/* Note in Fullscreen */}
          {selectedWorkout.notes && (
            <div className="mt-6 max-w-md text-center">
              <p className="text-white/90 text-lg font-medium italic">"{selectedWorkout.notes}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;