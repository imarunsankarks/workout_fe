import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
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
} from "lucide-react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

// --- NEW DND IMPORTS ---
import {
  DndContext,
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

// --- SORTABLE ROW SUB-COMPONENT ---
const SortableSetRow = ({ id, sIdx, set, ex, onUpdate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[50px_1fr_1fr_25px] gap-3 items-center ${isDragging ? "shadow-2xl rounded-2xl bg-white" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="bg-slate-50 rounded-xl py-3 text-center text-xs font-black text-slate-400 uppercase cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors"
      >
        {sIdx + 1}
      </div>

      <input
        type="number"
        placeholder="kg"
        value={set.weight}
        onChange={(e) => onUpdate(sIdx, "weight", e.target.value)}
        className="w-full bg-white border border-slate-200 py-3 rounded-xl text-center font-bold outline-none focus:border-emerald-500"
      />

      <input
        type="number"
        placeholder="reps"
        value={set.reps}
        onChange={(e) => onUpdate(sIdx, "reps", e.target.value)}
        className="w-full bg-white border border-slate-200 py-3 rounded-xl text-center font-bold outline-none focus:border-emerald-500"
      />

      <button
        onClick={() => onDelete(sIdx)}
        className="text-slate-200 hover:text-red-400 transition-colors flex justify-center items-center"
      >
        <X size={16} />
      </button>
    </div>
  );
};

const ActiveWorkout = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  const [exercises, setExercises] = useState(() => {
    const saved = localStorage.getItem("active_session_exercises");
    return saved ? JSON.parse(saved) : [];
  });

  const [seconds, setSeconds] = useState(() => {
    const saved = localStorage.getItem("active_session_seconds");
    return saved ? parseInt(saved) : 0;
  });

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
  const presetNames = ["Arms", "Legs", "Push", "Pull", "Other"];

  // --- NEW STATE FOR INFO TOGGLE ---
  const [showInfo, setShowInfo] = useState({});

  // --- HISTORY STATES ---
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [selectedPrHistory, setSelectedPrHistory] = useState(null);
  const [historyLimit, setHistoryLimit] = useState(5);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event, exerciseInstanceId) => {
    const { active, over } = event;
    if (active.id !== over.id) {
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

  useEffect(() => {
    localStorage.setItem("active_session_exercises", JSON.stringify(exercises));
    localStorage.setItem("active_session_seconds", seconds.toString());
    localStorage.setItem("active_session_is_active", JSON.stringify(isActive));
    if (lastUnpausedAt) {
      localStorage.setItem(
        "active_session_last_unpaused",
        lastUnpausedAt.toString(),
      );
    } else {
      localStorage.removeItem("active_session_last_unpaused");
    }
  }, [exercises, seconds, isActive, lastUnpausedAt]);

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

  // --- FETCH HISTORY ---
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

  useEffect(() => {
    let interval = null;
    if (isActive && lastUnpausedAt) {
      interval = setInterval(() => {
        const now = Date.now();
        const timePassedSinceUnpause = Math.floor(
          (now - lastUnpausedAt) / 1000,
        );
        const baseSeconds = parseInt(
          localStorage.getItem("active_session_base_seconds") || "0",
        );
        const total = baseSeconds + timePassedSinceUnpause;
        setSeconds(total);

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
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, lastUnpausedAt]);

  const toggleGlobalTimer = () => {
    if (!isActive) {
      const now = Date.now();
      setLastUnpausedAt(now);
      localStorage.setItem("active_session_base_seconds", seconds.toString());
    } else {
      setLastUnpausedAt(null);
    }
    setIsActive(!isActive);
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const addExercise = (template) => {
    const newEx = {
      ...template,
      instanceId: Date.now(),
      isCollapsed: false,
      isRunning: false,
      activeSetIdx: 0,
      sets:
        template.type === "Strength"
          ? [{ weight: "", reps: "" }]
          : [{ time: 0 }],
    };
    setExercises([...exercises, newEx]);
    setIsModalOpen(false);
    setSearchTerm("");
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
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    setSelectedPrHistory({ name: exerciseName, history: exerciseHistory });
  };

  const handleDiscard = () => {
    localStorage.removeItem("active_session_exercises");
    localStorage.removeItem("active_session_seconds");
    localStorage.removeItem("active_session_is_active");
    localStorage.removeItem("active_session_last_unpaused");
    localStorage.removeItem("active_session_base_seconds");
    navigate("/");
  };

  const saveWorkout = async () => {
    const finalName = workoutName.trim() || "Daily Session";

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
        };
      })
      .filter((ex) => ex.sets.length > 0);

    if (formattedDetails.length === 0) {
      setNullData(true);
      return;
    }

    const workoutData = {
      userId: user.id,
      name: finalName,
      duration: Math.floor(seconds / 60),
      muscles: [...new Set(formattedDetails.map((ex) => ex.muscle))],
      details: formattedDetails,
    };

    try {
      setLoadingSave(true);
      setShowFinishPrompt(false);
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/workouts`,
        workoutData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      handleDiscard();
      navigate("/");
    } catch (err) {
      console.error("Save Error:", err);
      alert("Could not save to database.");
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-40">
      {/* Timer Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-6 flex justify-between items-center border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <Timer size={24} />
          </div>
          <div>
            <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              Session Duration
            </h1>
            <p className="text-3xl font-mono font-black text-slate-800 leading-none">
              {formatTime(seconds)}
            </p>
          </div>
        </div>
        <button
          onClick={toggleGlobalTimer}
          className={`p-4 rounded-2xl transition-all ${isActive ? "bg-red-50 text-red-500" : "bg-emerald-600 text-white shadow-lg"}`}
        >
          {isActive ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Active Exercise List */}
      <div className="space-y-4">
        {exercises.map((ex) => (
          <div
            key={ex.instanceId}
            className="bg-white rounded-[32px] px-5 py-6 shadow-sm border border-slate-100 transition-all duration-300"
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
                  className={`p-2 rounded-xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50" : ex.type === "Stretching" ? "text-blue-500 bg-blue-50" : "text-emerald-500 bg-emerald-50"}`}
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
                  <h4 className="font-bold text-slate-800 text-md leading-tight flex items-center gap-2 capitalize truncate max-w-[15ch]">
                    {ex.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                      {ex.muscle}
                    </p>
                    <div className="p-0.5 rounded-lg bg-slate-50 text-slate-400">
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
                  className={`p-2 transition-colors ${showInfo[ex.instanceId] ? "text-emerald-500" : "text-slate-300 hover:text-slate-500"}`}
                >
                  <Info size={18} />
                </button>
                <button
                  onClick={() => handlePrClick(ex.name)}
                  className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                >
                  <History size={18} />
                </button>
                <button
                  onClick={() => setExerciseToDelete(ex.instanceId)}
                  className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* INFO PANEL (RESISTANCE & EXECUTION) */}
            {showInfo[ex.instanceId] && (
              <div className="mt-3 p-3 bg-slate-50 rounded-2xl flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1 bg-white rounded-lg border border-slate-100 flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    Resistance
                  </span>
                  <span className="text-[10px] font-bold text-slate-700">
                    +{ex.resistance || 0}kg
                  </span>
                </div>
                <div className="px-3 py-1 bg-white rounded-lg border border-slate-100 flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    Execution
                  </span>
                  <span className="text-[10px] font-bold text-slate-700">
                    {ex.execution === "Single" ? "Unilateral" : "Bilateral"}
                  </span>
                </div>
              </div>
            )}

            {!ex.isCollapsed && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-4" />
                {ex.type === "Strength" ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, ex.instanceId)}
                  >
                    <div className="space-y-2">
                      <SortableContext
                        items={ex.sets.map(
                          (_, i) => `set-${ex.instanceId}-${i}`,
                        )}
                        strategy={verticalListSortingStrategy}
                      >
                        {ex.sets.map((set, sIdx) => (
                          <SortableSetRow
                            key={`set-${ex.instanceId}-${sIdx}`}
                            id={`set-${ex.instanceId}-${sIdx}`}
                            sIdx={sIdx}
                            set={set}
                            ex={ex}
                            onUpdate={(idx, field, val) => {
                              const newExs = [...exercises];
                              newExs.find(
                                (i) => i.instanceId === ex.instanceId,
                              ).sets[idx][field] = val;
                              setExercises(newExs);
                            }}
                            onDelete={(idx) => {
                              const newExs = [...exercises];
                              newExs
                                .find((i) => i.instanceId === ex.instanceId)
                                .sets.splice(idx, 1);
                              setExercises(newExs);
                            }}
                          />
                        ))}
                      </SortableContext>
                    </div>
                  </DndContext>
                ) : (
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-3 bg-slate-50 p-2 pl-4 rounded-2xl"
                      >
                        <span className="text-[10px] font-black text-slate-300 uppercase min-w-[40px]">
                          Set {sIdx + 1}
                        </span>
                        <span className="flex-1 font-mono font-bold text-slate-700 text-center">
                          {formatTime(set.time || 0)}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={!isActive}
                            onClick={() => {
                              const newExs = [...exercises];
                              const target = newExs.find(
                                (i) => i.instanceId === ex.instanceId,
                              );
                              target.isRunning = !target.isRunning;
                              target.activeSetIdx = sIdx;
                              setExercises(newExs);
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${ex.isRunning && ex.activeSetIdx === sIdx ? "bg-red-500 text-white" : "bg-white border text-slate-600 shadow-sm"}`}
                          >
                            {ex.isRunning && ex.activeSetIdx === sIdx
                              ? "Stop"
                              : "Start"}
                          </button>
                          <button
                            onClick={() => {
                              const newExs = [...exercises];
                              const target = newExs.find(
                                (i) => i.instanceId === ex.instanceId,
                              );
                              target.sets.splice(sIdx, 1);
                              setExercises(newExs);
                            }}
                            className="p-2 text-slate-200 hover:text-red-400"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    const newExs = [...exercises];
                    newExs
                      .find((i) => i.instanceId === ex.instanceId)
                      .sets.push(
                        ex.type === "Strength"
                          ? { weight: "", reps: "" }
                          : { time: 0 },
                      );
                    setExercises(newExs);
                  }}
                  disabled={
                    ex.sets.length > 0 &&
                    (ex.type === "Strength"
                      ? ex.sets?.find((s) => !s.weight) ||
                        ex.sets?.find((s) => !s.reps || Number(s.reps) === 0)
                      : ex.sets[ex.sets.length - 1].time === 0)
                  }
                  className={`w-full mt-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-dashed rounded-xl transition-all ${
                    ex.sets.length > 0 &&
                    (ex.type === "Strength"
                      ? ex.sets?.find((s) => !s.weight) ||
                        ex.sets?.find((s) => !s.reps || Number(s.reps) === 0)
                      : ex.sets[ex.sets.length - 1].time === 0)
                      ? "border-slate-50 text-slate-200 cursor-not-allowed opacity-50"
                      : "border-slate-100 text-slate-300 hover:bg-slate-50 hover:text-emerald-500 hover:border-emerald-100"
                  }`}
                >
                  + ADD SET
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-8 bg-white border-2 border-dashed border-slate-200 rounded-[40px] text-slate-400 font-bold flex flex-col items-center gap-2 active:bg-slate-50 transition-all shadow-sm"
        >
          <Plus size={24} />{" "}
          <span className="text-sm">Add Exercise / Stretch</span>
        </button>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-24 left-6 right-6 z-40 flex gap-3">
        <button
          onClick={() => setShowDiscardPrompt(true)}
          className="bg-white text-red-400 p-5 rounded-2xl border border-red-50 shadow-xl active:scale-90 transition-all"
        >
          <Trash2 size={24} />
        </button>
        <button
          onClick={() => exercises.length > 0 && setShowFinishPrompt(true)}
          className={`flex-1 font-black py-5 rounded-2xl shadow-2xl transition-all active:scale-95 ${exercises.length > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"}`}
        >
          <CheckCircle2 size={20} className="inline mr-2" /> FINISH WORKOUT
        </button>
      </div>

      {/* DISCARD PROMPT */}
      {showDiscardPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              Discard Session?
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDiscard}
                className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Yes, Discard it
              </button>
              <button
                onClick={() => setShowDiscardPrompt(false)}
                className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
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
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
            <h2 className="text-2xl font-black text-slate-800 mb-6">
              Great Session!
            </h2>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {presetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setActiveTab(name);
                    if (name !== "Other") setWorkoutName(name);
                    else setWorkoutName("");
                  }}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === name
                      ? "bg-slate-900 text-white shadow-lg"
                      : "bg-slate-50 text-slate-400 border border-slate-100"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            {activeTab === "Other" && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <input
                  autoFocus
                  type="text"
                  placeholder="Custom Name (e.g. Chest & Back)"
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold mb-6 outline-none border-2 border-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                />
              </div>
            )}
            {nullData && (
              <p className="text-red-500 text-sm mb-4">
                Please complete at least one set!
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  setShowFinishPrompt(false);
                  setActiveTab("");
                  setNullData(false);
                }}
                className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveWorkout}
                disabled={!workoutName}
                className={`flex-1 py-4 font-black rounded-2xl shadow-lg transition-all ${
                  !workoutName
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 text-white active:scale-95"
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
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping duration-1000"></div>
            <div className="relative bg-emerald-500 p-8 rounded-full shadow-2xl shadow-emerald-500/50">
              <Trophy size={48} className="text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-white text-2xl font-black uppercase tracking-tight">
              Finalizing Gains
            </h2>
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-end">
          <div className="bg-white w-full rounded-t-[44px] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                Library
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  to="/add-exercise"
                  className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl hover:bg-emerald-100 border border-emerald-100/50"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Add New
                  </span>
                </Link>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-50 p-2.5 rounded-full text-slate-400 hover:bg-slate-100 transition-all border border-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative mb-6">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                size={18}
              />
              <input
                type="text"
                placeholder="Search exercise..."
                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
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
                  className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div
              className="flex gap-2 overflow-x-auto py-4 mb-4 no-scrollbar scroll-smooth border-b border-slate-50"
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
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeMuscle === muscle ? "bg-emerald-500 text-white shadow-md" : "bg-slate-50 text-slate-400 border border-slate-100"}`}
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
                  <Dumbbell size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
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
                      className="w-full flex gap-2 items-center animate-in fade-in duration-300"
                    >
                      <button
                        onClick={() => addExercise(ex)}
                        className="flex-1 flex justify-between items-center p-5 bg-slate-50 rounded-2xl active:bg-emerald-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div
                            className={`p-2 rounded-xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50" : ex.type === "Stretching" ? "text-blue-500 bg-blue-50" : "text-emerald-500 bg-emerald-50"}`}
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
                            <p className="font-bold text-slate-700 text-sm">
                              {ex.name}
                            </p>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                              {ex.muscle}
                            </p>
                          </div>
                        </div>
                        <Plus size={18} className="text-slate-300" />
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingExercise(ex)}
                          className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-500 transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(ex._id)}
                          className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
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
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6">
              Edit Exercise
            </h2>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
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
                  className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* EDIT EXECUTION & RESISTANCE */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Style
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingExercise({
                        ...editingExercise,
                        execution:
                          editingExercise.execution === "Single"
                            ? "Both"
                            : "Single",
                      })
                    }
                    className="w-full py-3 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-600 border border-slate-100"
                  >
                    {editingExercise.execution === "Single"
                      ? "Unilateral"
                      : "Bilateral"}
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Base (kg)
                  </label>
                  <input
                    type="number"
                    value={editingExercise.resistance}
                    onChange={(e) =>
                      setEditingExercise({
                        ...editingExercise,
                        resistance: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-slate-50 rounded-xl font-bold text-center border border-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
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
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${editingExercise.muscle === muscle ? "bg-emerald-600 border-emerald-600 text-white shadow-md" : "bg-white border-slate-100 text-slate-400"}`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Workout Type
                </label>
                <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
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
                      className={`flex-1 py-3 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${editingExercise.type === type.id ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100"}`}
                    >
                      {type.icon}
                      <span className="text-[9px] font-black uppercase tracking-wider">
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
                className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateLibraryItem}
                className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
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
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">
              Delete Exercise?
            </h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This will remove it from your library forever. <br />
              Existing sessions won't be affected.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 text-slate-400 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteLibraryItem(showDeleteConfirm)}
                className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl"
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
          <div className="bg-white w-full max-w-lg rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">
                  {selectedPrHistory.name}
                </h2>
                <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                  Full History
                </p>
              </div>
              <button
                onClick={() => setSelectedPrHistory(null)}
                className="bg-slate-100 p-2 rounded-full text-slate-400"
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
                      className="relative pl-6 border-l-2 border-slate-100 pb-2"
                    >
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-emerald-500" />
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {new Date(entry.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <h4 className="font-bold text-slate-800 text-sm capitalize">
                            {entry.workoutName || "Routine"}
                          </h4>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {entry.sets.map((set, sIdx) => (
                          <div
                            key={sIdx}
                            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex justify-between items-center"
                          >
                            <span className="text-[9px] font-black text-slate-400">
                              SET {sIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
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
                <p className="text-center text-slate-400 text-xs italic">
                  No history found for this exercise.
                </p>
              )}

              {historyLimit < selectedPrHistory.history.length && (
                <button
                  onClick={() => setHistoryLimit((prev) => prev + 5)}
                  className="w-full py-4 mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] bg-white rounded-2xl border border-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  Show 5 More Sessions
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedPrHistory(null)}
              className="w-full mt-8 bg-slate-900 text-white font-black py-4 rounded-2xl"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE DELETE PROMPT */}
      {exerciseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              Remove Exercise?
            </h2>
            <p className="text-slate-500 text-sm mb-6">
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
                className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Yes, Remove it
              </button>
              <button
                onClick={() => setExerciseToDelete(null)}
                className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
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
