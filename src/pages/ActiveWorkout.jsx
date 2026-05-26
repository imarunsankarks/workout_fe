import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Play,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle2,
  Dumbbell,
  Timer,
  Flame,
  Move,
  Pause,
  AlertTriangle,
  Edit3,
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
} from "lucide-react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [library, setLibrary] = useState([]);
  const [loadingSave, setLoadingSave] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState("Legs");
  const [nullData, setNullData] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
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

  const [showInfo, setShowInfo] = useState({});
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
  useEffect(() => {
    if (!isActive || !hasRunningTimedSet) return undefined;
    const interval = setInterval(() => {
      setExercises((prev) => {
        if (!prev.some((ex) => ex.isRunning)) return prev;
        return prev.map((ex) => {
          if (
            ex.isRunning &&
            (ex.type === "Warmup" || ex.type === "Stretching")
          ) {
            const newSets = [...ex.sets];
            const idx = ex.activeSetIdx ?? 0;
            newSets[idx] = {
              ...newSets[idx],
              time: (newSets[idx].time || 0) + 1,
            };
            return { ...ex, sets: newSets };
          }
          return ex;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, hasRunningTimedSet]);

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

  const addExercise = (template) => {
    const lastEntry = allWorkouts
      .filter((workout) =>
        workout.details?.some(
          (ex) => ex.name.toLowerCase() === template.name.toLowerCase(),
        ),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((workout) =>
        workout.details.find(
          (ex) => ex.name.toLowerCase() === template.name.toLowerCase(),
        ),
      )[0];

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
    setIsModalOpen(false);
    setSearchTerm("");
  };

  const handleConfirmRepeat = () => {
    if (!workoutToRepeat) return;
    
    const prefilledExercises = workoutToRepeat.details.map((ex, idx) => ({
      ...ex,
      instanceId: Date.now() + idx,
      isCollapsed: false,
      isRunning: false,
      activeSetIdx: 0,
      sets:
        ex.type === "Strength"
          ? ex.sets.map((s) => ({
              weight: s.weight ?? "",
              reps: s.reps ?? "",
            }))
          : [{ time: 0 }],
    }));

    setExercises(prefilledExercises);
    setShowRepeatModal(false);
    setWorkoutToRepeat(null);
  };

  const handlePrClick = (exerciseName) => {
    setHistoryLimit(5);
    const exerciseHistory = allWorkouts
      .filter((workout) =>
        workout.details?.some(
          (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase(),
        ),
      )
      .map((workout) => {
        const detail = workout.details.find(
          (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase(),
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

    setSelectedPrHistory({ name: exerciseName, history: exerciseHistory });
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

      // 1. Filter valid sets
      const formattedDetails = exercises
        .map((ex) => {
          const validSets = ex.sets.filter((set) => {
            if (ex.type === "Strength") {
              return set.weight !== "" && set.reps !== "" && Number(set.reps) > 0;
            } else {
              return set.time && Number(set.time) > 0;
            }
          });

          return {
            name: ex.name,
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

        // 5. Cleanup
        handleDiscard();
        navigate("/");
      } catch (err) {
        console.error("Save Error:", err);
        alert("Could not save to database. Image upload or network error.");
        setLoadingSave(false);
        setShowFinishPrompt(true);
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
      console.error(err);
    }
  };

  // Guard render: bail out (useEffect above will navigate away)
  if (!isAllowedEntry) return null;

  return (
    <div className="relative min-h-screen p-4 pb-40">
      {/* Header with Theme Toggle */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Active Workout</h1>
        <ThemeToggle />
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

      {/* Active Exercise List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleExerciseDragStart}
        onDragEnd={handleExerciseDragEnd}
        onDragCancel={handleExerciseDragCancel}
      >
        <SortableContext
          items={exercises.map((e) => `ex-${e.instanceId}`)}
          strategy={verticalListSortingStrategy}
        >
      <div className="space-y-4">
        {exercises.map((ex) => (
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
                  className={`p-2 rounded-xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" : ex.type === "Stretching" ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" : "text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400"}`}
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
                    {ex.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">
                      {ex.muscle}
                    </p>
                    <div className="p-0.5 rounded-lg bg-white/40 dark:bg-white/5 backdrop-blur-md text-slate-400 dark:text-slate-500">
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
                    setShowInfo((prev) => ({
                      ...prev,
                      [ex.instanceId]: !prev[ex.instanceId],
                    }));
                  }}
                  className={`p-2 transition-colors ${showInfo[ex.instanceId] ? "text-accent-500 dark:text-accent-400" : "text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400"}`}
                >
                  <Info size={18} />
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

            {showInfo[ex.instanceId] && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center bg-white/30 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl p-1.5 justify-between gap-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-white/40 dark:border-white/10">
                      <div className="w-1 h-1 rounded-full bg-accent-500"></div>
                      <input 
                        type="number"
                        className="w-10 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                        value={ex.resistance || 0}
                        onChange={(e) => setExercises(exercises.map(item => item.instanceId === ex.instanceId ? { ...item, resistance: e.target.value } : item))}
                      />
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">kg</span>
                    </div>

                    <button 
                      onClick={() => setExercises(exercises.map(item => item.instanceId === ex.instanceId ? { ...item, execution: ex.execution === "Unilateral" ? "Bilateral" : "Unilateral" } : item))}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-white/40 dark:border-white/10 active:scale-95 transition-all"
                    >
                      <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                        {ex.execution === "Unilateral" ? "Unilateral" : "Bilateral"}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePrClick(ex.name)}
                      className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-xl active:scale-90 transition-all"
                    >
                      <History size={16} strokeWidth={1.5} />
                    </button>

                    <button
                      onClick={() => setExerciseToDelete(ex.instanceId)}
                      className="p-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl active:scale-90 transition-all"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!ex.isCollapsed && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-4" />
                {ex.type === "Strength" ? (
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => (
                      <div
                        key={sIdx}
                        className="grid grid-cols-[50px_1fr_1fr_25px] gap-3 items-center"
                      >
                        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-xl py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-300 uppercase">
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
                          className="w-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 py-3 rounded-xl text-center font-bold outline-none focus:border-accent-500 text-slate-800 dark:text-slate-200"
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
                          className="w-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 py-3 rounded-xl text-center font-bold outline-none focus:border-accent-500 text-slate-800 dark:text-slate-200"
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
                    ))}
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
                          className="flex items-center gap-2 bg-white/40 dark:bg-white/5 backdrop-blur-md p-2 pl-4 rounded-2xl"
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
                                const newExs = [...exercises];
                                const target = newExs.find(
                                  (i) => i.instanceId === ex.instanceId,
                                );
                                target.isRunning = !isThisRunning;
                                target.activeSetIdx = sIdx;
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
                                if (isThisRunning) target.isRunning = false;
                                setExercises(newExs);
                              }}
                              aria-label="Reset"
                              className="p-2 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-200 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {ex.type === "Strength" && (
                  <button
                    onClick={() => {
                      const newExs = [...exercises];
                      newExs
                        .find((i) => i.instanceId === ex.instanceId)
                        .sets.push({ weight: "", reps: "" });
                      setExercises(newExs);
                    }}
                    disabled={
                      ex.sets.length > 0 &&
                      (ex.sets?.find((s) => !s.weight) ||
                        ex.sets?.find((s) => !s.reps || Number(s.reps) === 0))
                    }
                    className={`w-full mt-4 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-dashed rounded-xl transition-all ${
                      ex.sets.length > 0 &&
                      (ex.sets?.find((s) => !s.weight) ||
                        ex.sets?.find((s) => !s.reps || Number(s.reps) === 0))
                        ? "border-slate-50 dark:border-slate-700 text-slate-200 dark:text-slate-600 cursor-not-allowed opacity-50"
                        : "border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-accent-500 dark:hover:text-accent-400 hover:border-accent-100 dark:hover:border-accent-700"
                    }`}
                  >
                    + ADD SET
                  </button>
                )}
              </div>
            )}
          </div>
            )}
          </SortableExercise>
        ))}

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-8 bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl border-2 border-dashed border-white/40 dark:border-white/10 rounded-[40px] text-slate-400 dark:text-slate-500 font-bold flex flex-col items-center gap-2 active:bg-white/50 dark:active:bg-slate-800/50 transition-all shadow-sm"
        >
          <Plus size={24} />{" "}
          <span className="text-sm">Add Exercise / Stretch</span>
        </button>
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
                        ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400"
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
                    {activeDraggingExercise.name}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-end justify-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Recent Sessions</h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Select a workout to repeat</p>
              </div>
              <button onClick={() => setShowRepeatModal(false)} className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {allWorkouts.slice(0, 8).map((w) => (
                <button
                  key={w._id}
                  onClick={() => setWorkoutToRepeat(w)}
                  className="w-full bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 p-5 rounded-[28px] flex items-center justify-between hover:bg-white/60 dark:hover:bg-white/10 hover:border-accent-200 dark:hover:border-accent-700 transition-all active:scale-[0.98]"
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
              {allWorkouts.length === 0 && (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">No workout history found yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REPEAT CONFIRMATION MODAL */}
      {workoutToRepeat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[600] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
              <RotateCcw size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Repeat Workout?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              Would you like to perform the same <span className="font-bold text-slate-800 dark:text-slate-200">"{workoutToRepeat.name}"</span> workout done on <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(workoutToRepeat.date).toLocaleDateString()}</span> today?
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleConfirmRepeat} 
                className="w-full py-4 bg-accent-gradient text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Yes, Prefill Workout
              </button>
              <button 
                onClick={() => setWorkoutToRepeat(null)} 
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscardPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Discard Session?
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDiscard}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Yes, Discard it
              </button>
              <button
                onClick={() => setShowDiscardPrompt(false)}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                No, Keep going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINISH PROMPT */}
      {showFinishPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
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
                    activeTab === name ? "bg-slate-900 dark:bg-slate-700 text-white shadow-lg dark:shadow-md" : "bg-white/40 dark:bg-white/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"
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
                  className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-2xl font-bold outline-none border-2 border-accent-500/20 focus:border-accent-500 transition-all text-sm text-slate-800 dark:text-slate-200"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                />
              </div>
            )}

            {/* --- NEW: NOTES SECTION --- */}
            <div className="mb-4">
              <textarea
                placeholder="How did it feel? (Optional note)"
                className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-2xl font-medium outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 transition-all text-sm min-h-[80px] resize-none text-slate-800 dark:text-slate-200"
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[500] flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-accent-500/30 animate-ping duration-1000"></div>
            <div className="relative bg-accent-gradient p-8 rounded-full shadow-2xl shadow-accent-500/50">
              <Trophy size={48} className="text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-white text-2xl font-bold uppercase tracking-tight">
              Finalizing Gains
            </h2>
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-end">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full rounded-t-[44px] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                Library
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  to="/add-exercise"
                  className="flex items-center gap-2 bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 px-4 py-2 rounded-2xl hover:bg-accent-100 dark:hover:bg-accent-900/50 border border-accent-100/50 dark:border-accent-700/50"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Add New
                  </span>
                </Link>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2.5 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-all border border-white/40 dark:border-white/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative mb-6">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Search exercise..."
                className="w-full pl-12 pr-4 py-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-accent-500 transition-all text-sm text-slate-800 dark:text-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {["All", "Warmup", "Strength", "Stretching"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? "bg-slate-900 dark:bg-slate-700 text-white" : "bg-white/40 dark:bg-white/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div
              className="flex gap-2 overflow-x-auto py-4 mb-4 no-scrollbar scroll-smooth border-b border-white/40 dark:border-white/10"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {[
                "Chest",
                "Back",
                "Shoulders",
                "Biceps",
                "Triceps",
                "Legs",
                "Abs",
                "Full Body",
              ].map((muscle) => (
                <button
                  key={muscle}
                  onClick={() => setActiveMuscle(muscle)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeMuscle === muscle ? "bg-accent-500 text-white shadow-md" : "bg-white/40 dark:bg-white/5 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"}`}
                >
                  {muscle}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {library.filter(
                (ex) =>
                  ex.muscle.toLowerCase() === activeMuscle.toLowerCase() &&
                  (activeCategory.toLowerCase() !== "all"
                    ? ex.type.toLowerCase() === activeCategory.toLowerCase()
                    : true),
              ).length === 0 ? (
                <div className="py-12 text-center">
                  <Dumbbell size={32} className="mx-auto text-slate-200 dark:text-slate-600 mb-2" />
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
                    No {activeMuscle} exercises found
                  </p>
                </div>
              ) : (
                library
                  .filter(
                    (ex) =>
                      activeCategory === "All" || ex.type === activeCategory,
                  )
                  .filter(
                    (ex) =>
                      ex.muscle.toLowerCase() === activeMuscle.toLowerCase(),
                  )
                  .filter((ex) =>
                    ex.name.toLowerCase().includes(searchTerm.toLowerCase()),
                  )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((ex) => (
                    <div
                      key={ex._id}
                      className="w-full flex gap-2 items-center animate-in fade-in duration-300 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10 transition-colors"
                    >
                      <button
                        onClick={() => addExercise(ex)}
                        className="flex-1 flex justify-between items-center p-4 rounded-2xl active:bg-accent-50 dark:active:bg-accent-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div
                            className={`p-2 rounded-xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" : ex.type === "Stretching" ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" : "text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400"}`}
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
                            <p className="font-bold text-slate-700 dark:text-slate-200 text-sm capitalize">
                              {ex.name}
                            </p>
                            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">
                              {ex.muscle}
                            </p>
                          </div>
                        </div>
                        {/* <Plus size={18} className="text-slate-300" /> */}
                      </button>
                      <div className="flex gap-2 p-4">
                        <button
                          onClick={() => setEditingExercise(ex)}
                          className="p-2 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(ex._id)}
                          className="p-2 bg-white/50 dark:bg-white/10 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT LIBRARY ITEM MODAL */}
      {editingExercise && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
              Edit Exercise
            </h2>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                  Exercise Name
                </label>
                <input
                  type="text"
                  value={editingExercise.name}
                  onChange={(e) =>
                    setEditingExercise({
                      ...editingExercise,
                      name: e.target.value,
                    })
                  }
                  className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-xl font-bold outline-none focus:ring-2 focus:ring-accent-500 text-slate-800 dark:text-slate-200"
                />
              </div>

           

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                  Target Muscle
                </label>
                <div
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {[
                    "Chest",
                    "Back",
                    "Shoulders",
                    "Biceps",
                    "Triceps",
                    "Legs",
                    "Abs",
                    "Full Body",
                  ].map((muscle) => (
                    <button
                      key={muscle}
                      onClick={() =>
                        setEditingExercise({ ...editingExercise, muscle })
                      }
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${editingExercise.muscle === muscle ? "bg-accent-600 border-accent-600 text-white shadow-md" : "bg-white/40 dark:bg-white/5 backdrop-blur-md border-white/40 dark:border-white/10 text-slate-400 dark:text-slate-500"}`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
                  Workout Type
                </label>
                <div className="flex gap-2 p-1.5 bg-white/30 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10">
                  {[
                    { id: "Strength", icon: <Dumbbell size={14} /> },
                    { id: "Warmup", icon: <Flame size={14} /> },
                    { id: "Stretching", icon: <Move size={14} /> },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() =>
                        setEditingExercise({
                          ...editingExercise,
                          type: type.id,
                        })
                      }
                      className={`flex-1 py-3 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${editingExercise.type === type.id ? "bg-slate-900 dark:bg-slate-700 text-white shadow-lg dark:shadow-md" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600"}`}
                    >
                      {type.icon}
                      <span className="text-[9px] font-bold uppercase tracking-wider">
                        {type.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-8">
              <button
                onClick={() => setEditingExercise(null)}
                className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateLibraryItem}
                className="flex-1 py-4 bg-accent-gradient text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE LIBRARY ITEM CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <div className="bg-red-50 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 dark:text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Delete Exercise?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              This will remove it from your library forever. <br />
              Existing sessions won't be affected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 text-slate-400 dark:text-slate-500 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteLibraryItem(showDeleteConfirm)}
                className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PR HISTORY BOTTOM SHEET */}
      {selectedPrHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-end justify-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight capitalize">
                  {selectedPrHistory.name}
                </h2>
                <p className="text-accent-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                  Full History
                </p>
              </div>
              <button
                onClick={() => setSelectedPrHistory(null)}
                className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {selectedPrHistory.history.length > 0 ? (
                selectedPrHistory.history
                  .slice(0, historyLimit)
                  .map((entry, idx) => (
                    <div
                    key={idx}
                    className="relative pl-6 border-l-2 border-white/40 dark:border-white/10 pb-2"
                    >
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-4 border-accent-500" />
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                            {new Date(entry.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm capitalize">
                              {entry.workoutName || "Routine"}
                            </h4>
                            {Number(entry.resistance) > 0 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-700/50 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                                <div className="w-1 h-1 rounded-full bg-amber-400" />
                                +{entry.resistance}kg
                              </span>
                            )}

                            {entry.execution === 'Unilateral' && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-700/50 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                                <div className="w-1 h-1 rounded-full bg-blue-400" />
                                Unilateral
                              </span>
                            )}
                              
                            {entry.execution === 'Bilateral' && (
                              <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-600 rounded-lg text-[9px] font-bold uppercase tracking-wider">
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
                            className="bg-white/40 dark:bg-white/5 backdrop-blur-md px-3 py-2 rounded-xl border border-white/40 dark:border-white/10 flex justify-between items-center"
                          >
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                              SET {sIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {entry.type === "Strength"
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

              {historyLimit < selectedPrHistory.history.length && (
                <button
                  onClick={() => setHistoryLimit((prev) => prev + 5)}
                  className="w-full py-4 mt-4 text-[10px] font-bold text-accent-600 uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-accent-100 dark:border-accent-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Show 5 More Sessions
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedPrHistory(null)}
              className="w-full mt-8 bg-slate-900 dark:bg-slate-700 text-white font-bold py-4 rounded-2xl"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE DELETE PROMPT */}
      {exerciseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-red-50 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 dark:text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Remove Exercise?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Are you sure you want to remove this exercise from your active
              session?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setExercises(
                    exercises.filter((e) => e.instanceId !== exerciseToDelete),
                  );
                  setExerciseToDelete(null);
                }}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Yes, Remove it
              </button>
              <button
                onClick={() => setExerciseToDelete(null)}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;
