import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Trash2,
  X,
  Search,
  Dumbbell,
  Flame,
  Move,
  Edit3,
  AlertTriangle,
  ChevronLeft,
  Info,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const Library = () => {
  const { user, token } = useContext(AuthContext);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeMuscle, setActiveMuscle] = useState("Legs");

  // Edit/Delete States
  const [editingExercise, setEditingExercise] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchLibrary();
  }, [user.id]);

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

  const filteredLibrary = library
    .filter((ex) => activeCategory === "All" || ex.type === activeCategory)
    .filter((ex) => ex.muscle.toLowerCase() === activeMuscle.toLowerCase())
    .filter((ex) => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-40">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link
            to="/"
            className="text-slate-400 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest mb-1"
          >
            <ChevronLeft size={12} /> Back to Home
          </Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Exercise Library
          </h1>
        </div>
        <Link
          to="/add-exercise"
          className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200 active:scale-95 transition-all"
        >
          <Plus size={24} strokeWidth={3} />
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
          size={18}
        />
        <input
          type="text"
          placeholder="Search exercise..."
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl font-bold outline-none border border-slate-100 shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Type Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth mb-4"
        style={{ scrollbarWidth: "none" }}
      >
        {["All", "Warmup", "Strength", "Stretching"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 border border-slate-100"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Muscle Tabs */}
      <div
        className="flex gap-2 overflow-x-auto py-4 mb-6 no-scrollbar scroll-smooth border-b border-slate-200"
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
            onClick={() => setActiveMuscle(muscle)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeMuscle === muscle ? "bg-emerald-500 text-white shadow-md" : "bg-white text-slate-400 border border-slate-100"}`}
          >
            {muscle}
          </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-300 font-bold uppercase tracking-widest text-xs">
            Loading Library...
          </div>
        ) : filteredLibrary.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-100">
            <Dumbbell size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              No exercises found
            </p>
          </div>
        ) : (
          filteredLibrary.map((ex) => (
            <div
              key={ex._id}
              className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex justify-between items-center group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-2xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50" : ex.type === "Stretching" ? "text-blue-500 bg-blue-50" : "text-emerald-500 bg-emerald-50"}`}
                >
                  {ex.type === "Warmup" ? (
                    <Flame size={20} />
                  ) : ex.type === "Stretching" ? (
                    <Move size={20} />
                  ) : (
                    <Dumbbell size={20} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 text-base capitalize">
                      {ex.name}
                    </p>
                    {ex.resistance > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded-md border border-amber-100">
                        +{ex.resistance}kg
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                    {ex.muscle} •{" "}
                    {ex.execution === "Single" ? "Unilateral" : "Bilateral"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingExercise(ex)}
                  className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
                >
                  <Edit3 size={18} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(ex._id)}
                  className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingExercise && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-800 mb-6">
              Edit Exercise
            </h2>
            <div className="space-y-6 text-left">
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

              {/* NEW: Category (Type) Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Strength", icon: <Dumbbell size={16} /> },
                    { id: "Warmup", icon: <Flame size={16} /> },
                    { id: "Stretching", icon: <Move size={16} /> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setEditingExercise({ ...editingExercise, type: t.id })
                      }
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                        editingExercise.type === t.id
                          ? `border-slate-900 bg-slate-900 text-white shadow-md`
                          : "border-slate-50 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {t.icon}
                      <span className="text-[9px] font-black uppercase tracking-tighter">
                        {t.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Style */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Execution Style
                </label>
                <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl">
                  {["Both", "Single"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() =>
                        setEditingExercise({
                          ...editingExercise,
                          execution: opt,
                        })
                      }
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                        editingExercise.execution === opt
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-400"
                      }`}
                    >
                      {opt === "Both" ? "Bilateral" : "Unilateral"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base Resistance */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Base Resistance (kg)
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">
                    +
                  </div>
                  <input
                    type="number"
                    value={editingExercise.resistance}
                    onChange={(e) =>
                      setEditingExercise({
                        ...editingExercise,
                        resistance: e.target.value,
                      })
                    }
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Target Muscle */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Target Muscle
                </label>
                <div
                  className="flex gap-2 overflow-x-auto pb-2 no-scrollbar"
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
                  ].map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        setEditingExercise({ ...editingExercise, muscle: m })
                      }
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                        editingExercise.muscle === m
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white border-slate-100 text-slate-400"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">Delete?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This will remove it from your library forever.
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
    </div>
  );
};

export default Library;
