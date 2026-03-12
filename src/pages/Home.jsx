import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  LogOut, Play, ChevronRight, X, Trash2,
  Clock, Dumbbell, Flame, Move, Activity, PauseCircle,TrendingUp, TrendingDown, MoveHorizontal,
} from 'lucide-react';

const Home = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStartPrompt, setShowStartPrompt] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState(null);
  const [visibleLimit, setVisibleLimit] = useState(8);

  const calculateIntensity = (workout) => {
    if (!workout.duration || workout.duration === 0) return 0;
    let totalVolume = 0;
    workout.details?.forEach(ex => {
      if (ex.type === 'Strength') {
        ex.sets.forEach(set => {
          totalVolume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
        });
      }
    });
    return (totalVolume / workout.duration).toFixed(1);
  };

  // --- PROGRESS CALCULATION ---
  const getProgress = (currentWorkout, index) => {
    const currentName = currentWorkout.name.toLowerCase().trim();
    const currentScore = parseFloat(calculateIntensity(currentWorkout));

    // Look at workouts older than the current one in the list
    const previousSameWorkout = history.slice(index + 1).find(
      w => w.name.toLowerCase().trim() === currentName
    );

    if (!previousSameWorkout) return { type: 'up', value: 100 };

    const previousScore = parseFloat(calculateIntensity(previousSameWorkout));
    if (previousScore === 0) return { type: 'neutral', value: 0 };

    const percentChange = ((currentScore - previousScore) / previousScore) * 100;
    
    if (percentChange > 0.5) return { type: 'up', value: Math.round(percentChange) };
    if (percentChange < -0.5) return { type: 'down', value: Math.abs(Math.round(percentChange)) };
    return { type: 'neutral', value: 0 };
  };

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching workouts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchWorkouts();
    }

    const activeData = localStorage.getItem('active_session_exercises');
    const activeSeconds = localStorage.getItem('active_session_seconds');
    const pausedStatus = localStorage.getItem('active_session_is_active');
    
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
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/workouts/${workoutToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkoutToDelete(null);
      fetchWorkouts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleMainButtonClick = () => {
    if (hasActiveSession) {
      navigate('/workout');
    } else {
      setShowStartPrompt(true);
    }
  };

  const confirmStartWorkout = () => {
    setShowStartPrompt(false);
    navigate('/workout');
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GainsTracker</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Welcome, {user?.name || 'Champ'}</p>
        </div>
        <button onClick={() => setShowLogoutPrompt(true)} className="text-red-500 hover:text-red-700 transition-colors p-2">
          <LogOut size={22}/>
        </button>
      </div>

      {/* Start / Resume Workout Card */}
      <div className={`p-6 rounded-[32px] text-white shadow-xl mb-10 relative overflow-hidden transition-all duration-300 ${
        hasActiveSession 
          ? (isPaused ? 'bg-slate-700 shadow-slate-200' : 'bg-amber-500 shadow-amber-200') 
          : 'bg-emerald-600 shadow-emerald-200'
      }`}>
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">
            {hasActiveSession 
              ? (isPaused ? 'Workout Paused' : 'Workout in Progress') 
              : 'Ready to crush it?'}
          </h2>
          <p className="opacity-80 text-sm mb-6">
            {hasActiveSession 
              ? `Session is currently ${isPaused ? 'on hold' : 'active'}.` 
              : (history[0] ? `Last session: ${new Date(history[0].date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}` : 'You are yet to start your first workout!')}
          </p>
          <button 
            onClick={handleMainButtonClick} 
            className="bg-white text-slate-900 font-black px-8 py-3 rounded-2xl flex items-center gap-2 active:scale-95 transition-all shadow-md"
          >
            {hasActiveSession 
              ? (isPaused ? <PauseCircle size={18} className="text-slate-500" /> : <Clock size={18} className="animate-pulse text-amber-600" />) 
              : <Play size={18} fill="currentColor" className="text-emerald-600" />}
            {hasActiveSession ? 'CONTINUE WORKOUT' : 'START WORKOUT'}
          </button>
        </div>
        <Dumbbell className={`absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12 ${!isPaused && hasActiveSession ? 'animate-spin-slow' : ''}`} />
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <LogOut size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Logging out?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Are you sure you want to sign out? <br/>
              Your active session (if any) will stay saved on this device.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={logout} 
                className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Yes, Sign Out
              </button>
              <button 
                onClick={() => setShowLogoutPrompt(false)} 
                className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {workoutToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Delete Workout?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This action cannot be undone. This workout will be permanently removed from your history.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmDelete} 
                className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Delete Permanently
              </button>
              <button 
                onClick={() => setWorkoutToDelete(null)} 
                className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Keep Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Start Prompt Modal */}
      {showStartPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
              <Play size={32} fill="currentColor" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Ready to Start?</h2>
            <p className="text-slate-500 text-sm mb-8">
              This will begin a new session and start the timer. Are you ready to crush your goals?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowStartPrompt(false)} 
                className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
              >
                Not yet
              </button>
              <button 
                onClick={confirmStartWorkout} 
                className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all"
              >
                Let's Go!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
          <Activity size={20} className="text-emerald-500" /> Recent Workouts
        </h3>
        {history.length > 0 && <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-1 rounded-md uppercase">Last {Math.min(history.length, visibleLimit)} Workouts</span>}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div 
              key={item} 
              className="bg-white p-5 rounded-[24px] flex justify-between items-center border border-slate-100 shadow-sm relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-50/60 to-transparent -translate-x-full animate-shimmer"></div>
              <div className="flex items-center gap-4 w-full">
                <div className="bg-slate-100 p-3 rounded-2xl w-11 h-11 animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded-md w-1/2 animate-pulse"></div>
                  <div className="h-2 bg-slate-100 rounded-md w-1/4 animate-pulse"></div>
                </div>
              </div>
              <div className="bg-slate-50 w-6 h-6 rounded-full animate-pulse"></div>
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
                    className="group bg-white p-5 rounded-[24px] flex justify-between items-center border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer relative"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl flex flex-col items-center justify-center min-w-[52px] ${
                        progress.type === 'up' ? 'bg-emerald-50 text-emerald-600' : 
                        progress.type === 'down' ? 'bg-red-50 text-red-600' :
                        progress.type === 'neutral' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {progress.type === 'up' && <TrendingUp size={20} />}
                        {progress.type === 'down' && <TrendingDown size={20} />}
                        {progress.type === 'neutral' && <MoveHorizontal size={20} />}
                        {progress.value !== null && (
                          <span className="text-[8px] font-black mt-1">{progress.value}%</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 leading-tight capitalize">{workout.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                            Score: {intensity}
                          </span>
                          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
                            {workout.duration ? `${workout.duration} MINS` : ''}
                          </span>
                          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
                            {new Date(workout.date).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}
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
                        className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={18} className="text-slate-200" />
                    </div>
                  </div>
                );
              })}

              {visibleLimit < history.length && (
                <button
                  onClick={() => setVisibleLimit(prev => prev + 8)}
                  className="w-full py-4 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Activity size={14} className="text-emerald-500" />
                  Load Older Workouts
                </button>
              )}
            </>
          ) : (
            <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-slate-200 text-center">
              <Dumbbell size={24} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400 text-sm italic">No workouts recorded yet.</p>
            </div>
          )}
      </div>)}

      {/* Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
             <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 capitalize">{selectedWorkout.name}</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                   {new Date(selectedWorkout.date).toLocaleDateString('en-GB', {day:'2-digit', month:'long'})}
                </p>
              </div>
              <button onClick={() => setSelectedWorkout(null)} className="bg-slate-100 p-2 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              {selectedWorkout.details?.map((ex, idx) => (
                <div key={idx} className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    {ex.type === 'Warmup' ? <Flame className="text-amber-500" size={18}/> : ex.type === 'Stretching' ? <Move className="text-blue-500" size={18}/> : <Dumbbell className="text-emerald-500" size={18}/>}
                    <h5 className="font-bold text-slate-700">{ex.name}</h5>
                  </div>
                  <div className="space-y-2">
                    {ex.sets.map((set, sIdx) => (
                      <div key={sIdx} className="flex justify-between text-sm bg-white px-4 py-2 rounded-xl border border-slate-50">
                        <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Set {sIdx+1}</span>
                        <span className="font-bold text-slate-600">{ex.type === 'Strength' ? `${set.weight}kg x ${set.reps}` : formatTime(set.time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedWorkout(null)} className="w-full mt-8 bg-slate-900 text-white font-black py-4 rounded-2xl">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;