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
import EditExerciseModal from '../components/EditExerciseModal';
import ConfirmModal from "../components/ConfirmModal";
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
  // Server-side validation error (e.g. duplicate name on update).
  const [errorMessage, setErrorMessage] = useState(null);

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
      const serverMsg = err?.response?.data?.message;
      // Close the confirm prompt and surface the validation error on top.
      setShowDeleteConfirm(null);
      setErrorMessage(
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
      // Keep the edit modal open so the user can correct the name; just
      // surface the validation error on top.
      setErrorMessage(
        serverMsg || 'Could not update the exercise. Please try again.',
      );
      console.error(err);
    }
  };

  const filteredLibrary = library
    .filter((ex) => activeCategory === "All" || ex.type === activeCategory)
    .filter((ex) => ex.muscle.toLowerCase() === activeMuscle.toLowerCase())
    .filter((ex) => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative min-h-screen p-6 pb-40">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link
            to="/"
            className="text-slate-400 dark:text-slate-500 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1"
          >
            <ChevronLeft size={12} /> Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Exercise Library
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/add-exercise"
            className="bg-accent-gradient text-white p-3 rounded-2xl shadow-lg dark:shadow-md shadow-accent-200 active:scale-95 transition-all"
          >
            <Plus size={24} strokeWidth={3} />
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500"
          size={18}
        />
        <input
          type="text"
          placeholder="Search exercise..."
          className="w-full pl-4 pr-4 py-4 bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl font-bold outline-none border border-white/40 dark:border-white/10 shadow-sm focus:ring-2 focus:ring-accent-500 transition-all text-sm text-slate-800 dark:text-slate-200"
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
            className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? "bg-slate-900 dark:bg-slate-700 text-white shadow-lg dark:shadow-md" : "bg-white/40 dark:bg-slate-800/30 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Muscle Tabs */}
      <div
        className="flex gap-2 overflow-x-auto py-4 mb-6 no-scrollbar scroll-smooth border-b border-white/40 dark:border-white/10"
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
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeMuscle === muscle ? "bg-accent-500 text-white shadow-md" : "bg-white/40 dark:bg-slate-800/30 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10"}`}
          >
            {muscle}
          </button>
        ))}
      </div>

      {/* Exercise List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest text-xs">
            Loading Library...
          </div>
        ) : filteredLibrary.length === 0 ? (
          <div className="py-20 text-center bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl rounded-[32px] border-2 border-dashed border-white/40 dark:border-white/10">
            <Dumbbell size={40} className="mx-auto text-slate-200 dark:text-slate-600 mb-4" />
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">
              No exercises found
            </p>
          </div>
        ) : (
          filteredLibrary.map((ex) => (
            <div
              key={ex._id}
              className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-4 rounded-[28px] shadow-sm border border-white/40 dark:border-white/10 flex justify-between items-center group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-2xl ${ex.type === "Warmup" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400" : ex.type === "Stretching" ? "text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:text-fuchsia-400" : "text-accent-500 bg-accent-50 dark:bg-accent-900/30 dark:text-accent-400"}`}
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
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 text-base capitalize">
                      {ex.name}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-[0.2em]">
                    {ex.muscle}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingExercise(ex)}
                  className="p-2 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-accent-500 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 transition-all"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(ex._id)}
                  className="p-2 bg-white/40 dark:bg-gray-300/5 backdrop-blur-md rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <EditExerciseModal
        exercise={editingExercise}
        onChange={setEditingExercise}
        onClose={() => setEditingExercise(null)}
        onSave={updateLibraryItem}
      />

      {/* Server-side validation error (e.g. duplicate name) */}
      <ConfirmModal
        open={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        onConfirm={() => setErrorMessage(null)}
        title="Action not allowed"
        message={errorMessage || ''}
        confirmLabel="OK"
        icon={AlertTriangle}
        tone="warning"
        singleAction
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => deleteLibraryItem(showDeleteConfirm)}
        title="Delete Exercise?"
        message="This will remove it from your library forever."
        icon={AlertTriangle}
      />
    </div>
  );
};

export default Library;
