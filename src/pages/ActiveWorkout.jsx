import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Plus, Trash2, X, Search, 
  CheckCircle2, Dumbbell, Timer, 
  Flame, Move, Pause, AlertTriangle, Edit3,
} from 'lucide-react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const ActiveWorkout = () => {
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);

  // --- 1. PERSISTENCE INITIALIZATION ---
  const [exercises, setExercises] = useState(() => {
    const saved = localStorage.getItem('active_session_exercises');
    return saved ? JSON.parse(saved) : [];
  });

  const [seconds, setSeconds] = useState(() => {
    const saved = localStorage.getItem('active_session_seconds');
    return saved ? parseInt(saved) : 0;
  });

  const [isActive, setIsActive] = useState(() => {
    const saved = localStorage.getItem('active_session_is_active');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [lastUnpausedAt, setLastUnpausedAt] = useState(() => {
    const saved = localStorage.getItem('active_session_last_unpaused');
    return saved ? parseInt(saved) : (isActive ? Date.now() : null);
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [library, setLibrary] = useState([]);

  // --- NEW STATES FOR EDIT/DELETE ---
  const [editingExercise, setEditingExercise] = useState(null); 
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // --- 2. STORAGE SYNC ---
  useEffect(() => {
    localStorage.setItem('active_session_exercises', JSON.stringify(exercises));
    localStorage.setItem('active_session_seconds', seconds.toString());
    localStorage.setItem('active_session_is_active', JSON.stringify(isActive));
    if (lastUnpausedAt) {
        localStorage.setItem('active_session_last_unpaused', lastUnpausedAt.toString());
    } else {
        localStorage.removeItem('active_session_last_unpaused');
    }
  }, [exercises, seconds, isActive, lastUnpausedAt]);

  const fetchLibrary = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/exercises/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLibrary(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (user?.id) fetchLibrary();
  }, [user.id]);

  // --- 3. BULLETPROOF TIMER LOGIC ---
  useEffect(() => {
    let interval = null;
    if (isActive && lastUnpausedAt) {
      interval = setInterval(() => {
        const now = Date.now();
        const timePassedSinceUnpause = Math.floor((now - lastUnpausedAt) / 1000);
        const baseSeconds = parseInt(localStorage.getItem('active_session_base_seconds') || '0');
        const total = baseSeconds + timePassedSinceUnpause;
        setSeconds(total);

        setExercises(prev => {
          if (!prev.some(ex => ex.isRunning)) return prev;
          return prev.map(ex => {
            if (ex.isRunning && (ex.type === 'Warmup' || ex.type === 'Stretching')) {
              const newSets = [...ex.sets];
              const idx = ex.activeSetIdx ?? 0;
              newSets[idx] = { ...newSets[idx], time: (newSets[idx].time || 0) + 1 };
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
      localStorage.setItem('active_session_base_seconds', seconds.toString());
    } else {
      setLastUnpausedAt(null);
    }
    setIsActive(!isActive);
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addExercise = (template) => {
    const newEx = {
      ...template,
      instanceId: Date.now(),
      isRunning: false,
      activeSetIdx: 0,
      sets: template.type === 'Strength' ? [{ weight: '', reps: '' }] : [{ time: 0 }]
    };
    setExercises([...exercises, newEx]);
    setIsModalOpen(false);
    setSearchTerm('');
  };

  const handleDiscard = () => {
    localStorage.removeItem('active_session_exercises'); 
    localStorage.removeItem('active_session_seconds'); 
    localStorage.removeItem('active_session_is_active');
    localStorage.removeItem('active_session_last_unpaused');
    localStorage.removeItem('active_session_base_seconds');
    navigate('/');
  };

  const saveWorkout = async () => {
    const finalName = workoutName.trim() || "Daily Session";
    const workoutData = {
      userId: user.id,
      name: finalName,
      duration: Math.floor(seconds / 60),
      muscles: [...new Set(exercises.map(ex => ex.muscle))],
      details: exercises.map(ex => ({
        name: ex.name,
        type: ex.type,
        muscle: ex.muscle,
        sets: ex.sets
      }))
    };
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/workouts`, workoutData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleDiscard(); 
      navigate('/'); 
    } catch (err) {
      console.error(err);
      alert("Could not save to database.");
    }
  };

  const deleteLibraryItem = async (id) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/exercises/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLibrary();
      setShowDeleteConfirm(null);
    } catch (err) { console.error(err); }
  };

  const updateLibraryItem = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/exercises/${editingExercise._id}`, editingExercise, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLibrary();
      setEditingExercise(null);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-40">
      {/* Timer Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-6 flex justify-between items-center border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><Timer size={24} /></div>
          <div>
            <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session Duration</h1>
            <p className="text-3xl font-mono font-black text-slate-800 leading-none">{formatTime(seconds)}</p>
          </div>
        </div>
        <button onClick={toggleGlobalTimer} className={`p-4 rounded-2xl transition-all ${isActive ? 'bg-red-50 text-red-500' : 'bg-emerald-600 text-white shadow-lg'}`}>
          {isActive ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Active Exercise List */}
      <div className="space-y-4">
        {exercises.map((ex) => (
          <div key={ex.instanceId} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${ex.type === 'Warmup' ? 'text-amber-500 bg-amber-50' : ex.type === 'Stretching' ? 'text-blue-500 bg-blue-50' : 'text-emerald-500 bg-emerald-50'}`}>
                  {ex.type === 'Warmup' ? <Flame size={18}/> : ex.type === 'Stretching' ? <Move size={18}/> : <Dumbbell size={18}/>}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg leading-tight">{ex.name}</h3>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{ex.muscle}</p>
                </div>
              </div>
              <button onClick={() => setExercises(exercises.filter(e => e.instanceId !== ex.instanceId))} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
            </div>

            {ex.type === 'Strength' ? (
              <div className="space-y-2">
                {ex.sets.map((set, sIdx) => (
                  <div key={sIdx} className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl py-3 text-center text-xs font-black text-slate-300 uppercase">{sIdx + 1}</div>
                    <input type="number" placeholder="kg" value={set.weight} onChange={(e) => {
                      const newExs = [...exercises];
                      newExs.find(i => i.instanceId === ex.instanceId).sets[sIdx].weight = e.target.value;
                      setExercises(newExs);
                    }} className="bg-white border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500" />
                    <input type="number" placeholder="reps" value={set.reps} onChange={(e) => {
                      const newExs = [...exercises];
                      newExs.find(i => i.instanceId === ex.instanceId).sets[sIdx].reps = e.target.value;
                      setExercises(newExs);
                    }} className="bg-white border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {ex.sets.map((set, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-3 bg-slate-50 p-2 px-4 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-300 uppercase">Set {sIdx+1}</span>
                    <span className="font-mono font-bold text-slate-700">{formatTime(set.time || 0)}</span>
                    <button 
                      disabled={!isActive}
                      onClick={() => {
                        const newExs = [...exercises];
                        const target = newExs.find(i => i.instanceId === ex.instanceId);
                        target.isRunning = !target.isRunning;
                        target.activeSetIdx = sIdx;
                        setExercises(newExs);
                      }} 
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!isActive ? 'opacity-30' : ''} ${ex.isRunning && ex.activeSetIdx === sIdx ? 'bg-red-500 text-white' : 'bg-white border text-slate-600 shadow-sm'}`}
                    >
                      {ex.isRunning && ex.activeSetIdx === sIdx ? 'Stop' : 'Start'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => {
              const newExs = [...exercises];
              newExs.find(i => i.instanceId === ex.instanceId).sets.push(ex.type === 'Strength' ? {weight:'', reps:''} : {time:0});
              setExercises(newExs);
            }} className="w-full mt-4 py-2 text-[10px] font-black text-slate-300 border-2 border-dashed border-slate-100 rounded-xl hover:bg-slate-50 transition-all">+ ADD SET</button>
          </div>
        ))}

        <button onClick={() => setIsModalOpen(true)} className="w-full py-8 bg-white border-2 border-dashed border-slate-200 rounded-[40px] text-slate-400 font-bold flex flex-col items-center gap-2 active:bg-slate-50 transition-all shadow-sm">
          <Plus size={24} /> <span className="text-sm">Add Exercise / Stretch</span>
        </button>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-24 left-6 right-6 z-40 flex gap-3">
        <button onClick={() => setShowDiscardPrompt(true)} className="bg-white text-red-400 p-5 rounded-2xl border border-red-50 shadow-xl active:scale-90 transition-all">
          <Trash2 size={24}/>
        </button>
        <button onClick={() => exercises.length > 0 && setShowFinishPrompt(true)} className={`flex-1 font-black py-5 rounded-2xl shadow-2xl transition-all active:scale-95 ${exercises.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
          <CheckCircle2 size={20} className="inline mr-2"/> FINISH WORKOUT
        </button>
      </div>

      {/* DISCARD PROMPT */}
      {showDiscardPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Discard Session?</h2>
            <div className="flex flex-col gap-2">
              <button onClick={handleDiscard} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">Yes, Discard it</button>
              <button onClick={() => setShowDiscardPrompt(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors">No, Keep going</button>
            </div>
          </div>
        </div>
      )}

      {/* FINISH PROMPT */}
      {showFinishPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
            <h2 className="text-2xl font-black text-slate-800 mb-6">Great Session!</h2>
            <input autoFocus type="text" placeholder="Workout Name" className="w-full p-5 bg-slate-50 rounded-2xl font-bold mb-6 outline-none focus:ring-2 focus:ring-emerald-500" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowFinishPrompt(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
              <button onClick={saveWorkout} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-end">
          <div className="bg-white w-full rounded-t-[44px] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Library</h2>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400"><X size={20}/></button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text" 
                placeholder="Search exercise or muscle..." 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
              {['All', 'Warmup', 'Strength', 'Stretching'].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{cat}</button>
              ))}
            </div>

            <div className="space-y-3">
              {library
                .filter(ex => (activeCategory === 'All' || ex.type === activeCategory))
                .filter(ex => 
                   ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   ex.muscle.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(ex => (
                <div key={ex._id} className="w-full flex gap-2 items-center animate-in fade-in duration-300">
                  <button onClick={() => addExercise(ex)} className="flex-1 flex justify-between items-center p-5 bg-slate-50 rounded-2xl active:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <div className={`p-2 rounded-xl ${ex.type === 'Warmup' ? 'text-amber-500 bg-amber-50' : ex.type === 'Stretching' ? 'text-blue-500 bg-blue-50' : 'text-emerald-500 bg-emerald-50'}`}>
                        {ex.type === 'Warmup' ? <Flame size={18}/> : ex.type === 'Stretching' ? <Move size={18}/> : <Dumbbell size={18}/>}
                      </div>
                      <div><p className="font-bold text-slate-700 text-sm">{ex.name}</p><p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{ex.muscle}</p></div>
                    </div>
                    <Plus size={18} className="text-slate-300" />
                  </button>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setEditingExercise(ex)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-500 transition-colors"><Edit3 size={16}/></button>
                    <button onClick={() => setShowDeleteConfirm(ex._id)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EDIT LIBRARY ITEM MODAL */}
      {/* EDIT LIBRARY ITEM MODAL */}
      {editingExercise && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-6">Edit Exercise</h2>
            <div className="space-y-6">
              
              {/* Exercise Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Exercise Name</label>
                <input 
                  type="text" 
                  value={editingExercise.name} 
                  onChange={(e) => setEditingExercise({...editingExercise, name: e.target.value})} 
                  className="w-full p-4 bg-slate-50 rounded-xl font-bold border-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              
              {/* TARGET MUSCLE PICKER */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Target Muscle</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                  {['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body'].map((muscle) => (
                    <button
                      key={muscle}
                      onClick={() => setEditingExercise({...editingExercise, muscle})}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all duration-200 ${
                        editingExercise.muscle === muscle 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>

              {/* WORKOUT TYPE PICKER */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Workout Type</label>
                <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                  {[
                    { id: 'Strength', icon: <Dumbbell size={14}/> },
                    { id: 'Warmup', icon: <Flame size={14}/> },
                    { id: 'Stretching', icon: <Move size={14}/> }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setEditingExercise({...editingExercise, type: type.id})}
                      className={`flex-1 py-3 px-1 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${
                        editingExercise.type === type.id 
                          ? 'bg-slate-900 text-white shadow-lg' 
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {type.icon}
                      <span className="text-[9px] font-black uppercase tracking-wider">{type.id}</span>
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
                className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
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
            <h2 className="text-xl font-black text-slate-800 mb-2">Delete Exercise?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">This will remove it from your library forever. <br/>Existing sessions won't be affected.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
              <button onClick={() => deleteLibraryItem(showDeleteConfirm)} className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;