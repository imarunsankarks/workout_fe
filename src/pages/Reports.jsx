import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { 
  Activity, ChevronLeft, ChevronRight, Clock, Trophy, 
  Target, TrendingUp, AlertTriangle, Trash2, Dumbbell, Calendar, ChevronDown, ChevronUp, Key, X, PauseCircle, Play, Image as ImageIcon, LogOut
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

const Reports = () => {
  const { user, token, logout } = useContext(AuthContext); 
  const navigate = useNavigate();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [clickedIntensity, setClickedIntensity] = useState(false);
  const [stats, setStats] = useState({ 
    totalWorkouts: 0, 
    totalMinutes: 0, 
    monthlyWorkouts: 0 
  });
  const [weeklyHistogram, setWeeklyHistogram] = useState([]);
  const [muscleDistribution, setMuscleDistribution] = useState([]);
  const [personalRecords, setPersonalRecords] = useState({});
  const [activePrTab, setActivePrTab] = useState('Legs');
  const [showAllPrs, setShowAllPrs] = useState(false); 
  const [loading, setLoading] = useState(true);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStep, setPasswordStep] = useState(1); 
  const [passwordError, setPasswordError] = useState("");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [selectedPrHistory, setSelectedPrHistory] = useState(null);
  const [allWorkouts, setAllWorkouts] = useState([]); 
  const [historyLimit, setHistoryLimit] = useState(5);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- NEW GALLERY STATES ---
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(!clickedIntensity ? true : false);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const history = res.data;
        setAllWorkouts(history); 
        // --- 1. OVERALL STATS & MONTHLY VOLUME ---
        const totalMins = history.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthlyWorkoutsCount = history.filter(w => new Date(w.date) >= thirtyDaysAgo).length;

        setStats({ 
          totalWorkouts: history.length, 
          totalMinutes: totalMins,
          monthlyWorkouts: monthlyWorkoutsCount
        });

        // --- 2. PERSONAL RECORDS (PR) CALCULATION ---
        const prMap = {};
        history.forEach(workout => {
          workout.details?.forEach(exercise => {
            if (exercise.type === 'Strength') {
              const muscleGroup = exercise.muscle || 'Other';
              const exerciseName = exercise.name;
              const baseResistance = Number(exercise.resistance) || 0;
              const maxSet = exercise.sets.reduce((prev, current) => {
                const prevTotal = (Number(prev.weight) || 0) + baseResistance;
                const currentTotal = (Number(current.weight) || 0) + baseResistance;
                return (prevTotal > currentTotal) ? prev : current;
              }, { weight: 0, reps: 0 });

              const currentSetTotal = (Number(maxSet.weight) || 0) + baseResistance;

              if (maxSet.weight >= 0) {
                if (!prMap[muscleGroup]) prMap[muscleGroup] = {};
                
                const existingRecord = prMap[muscleGroup][exerciseName];
                const existingTotal = existingRecord ? (existingRecord.weight + existingRecord.resistance) : -1;

                if (!existingRecord || currentSetTotal > existingTotal) {
                  prMap[muscleGroup][exerciseName] = {
                    weight: Number(maxSet.weight),
                    reps: maxSet.reps,
                    date: workout.date,
                    resistance: baseResistance,
                  };
                }
              }
            }
          });
        });
        setPersonalRecords(prMap);

        // --- 3. SUNDAY START WEEK LOGIC ---
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - dayOfWeek);
        startOfThisWeek.setHours(0, 0, 0, 0);
        
        const startOfViewWeek = new Date(startOfThisWeek);
        startOfViewWeek.setDate(startOfViewWeek.getDate() + (currentWeekOffset * 7));
        
        const endOfViewWeek = new Date(startOfViewWeek);
        endOfViewWeek.setDate(endOfViewWeek.getDate() + 6);
        endOfViewWeek.setHours(23, 59, 59, 999);

        const weekWorkouts = history.filter(w => {
          const wDate = new Date(w.date);
          return wDate >= startOfViewWeek && wDate <= endOfViewWeek;
        });

        // --- 4. WEEKLY HISTOGRAM ---
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const histogram = days.map((day, idx) => {
          const dayTotal = weekWorkouts
            .filter(w => new Date(w.date).getDay() === idx)
            .reduce((sum, w) => sum + (w.duration || 0), 0);
          return { day, minutes: dayTotal };
        });
        setWeeklyHistogram(histogram);

        // --- 5. MUSCLE DISTRIBUTION ---
        // Only count strength work; warmups & stretching shouldn't skew the
        // muscle-group volume breakdown.
        const muscleCounts = {};
        weekWorkouts.forEach(w => {
          w.details?.forEach(ex => {
            if (ex.type === 'Warmup' || ex.type === 'Stretching') return;
            const muscle = ex.muscle || 'Other';
            const setVol = ex.sets?.length || 0;
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + setVol;
          });
        });

        const totalSets = Object.values(muscleCounts).reduce((a, b) => a + b, 0);
        const distribution = Object.entries(muscleCounts)
          .map(([name, count], i) => ({
            name,
            percentage: totalSets > 0 ? Math.round((count / totalSets) * 100) : 0,
            // Brand gradient palette — mirrors --accent-from → --accent-via → --accent-to in index.css
            color: ['#cb2d9c', '#a855f7', '#6366f1', '#ec4899', '#f97316'][i % 5]
          }))
          .sort((a, b) => b.percentage - a.percentage);

        setMuscleDistribution(distribution);
      } catch (err) {
        console.error("Failed to fetch report data", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id && token) fetchData();
  }, [user?.id, token, currentWeekOffset]);

  useEffect(() => {
    setShowAllPrs(false);
  }, [activePrTab]);

  useEffect(() => {
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
  }, []);

  const getUserTier = () => {
    const count = stats.monthlyWorkouts;
    if (count < 5) return { label: 'Amateur', color: 'bg-slate-400', icon: <Activity size={14}/> };
    if (count < 12) return { label: 'Beginner', color: 'bg-fuchsia-700', icon: <Target size={14}/> };
    if (count <= 21) return { label: 'Advanced', color: 'bg-purple-600', icon: <TrendingUp size={14}/> };
    return { label: 'Pro Athlete', color: 'bg-accent-500', icon: <Trophy size={14}/> };
  };

  const tier = getUserTier();

  const handleDeleteProfile = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/auth/delete-profile/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      logout();
      navigate('/login');
    } catch (err) {
      alert("Error deleting profile. Please try again later.");
    }
  };

  const formatMins = (mins) => {
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const handleChangePassword = async () => {
    setPasswordError(""); 

    if (passwordStep === 1) {
      try {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/verify-credentials`, {
          email: passwordData.email,
          password: passwordData.currentPassword
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        setPasswordStep(2);
      } catch (err) {
        setPasswordError("Invalid email or current password.");
      }
    } else {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        return setPasswordError("New passwords do not match!");
      }
      if (passwordData.newPassword.length < 6) {
        return setPasswordError("Password must be at least 6 characters.");
      }

      try {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/auth/update-password`, {
          userId: user.id,
          newPassword: passwordData.newPassword
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        setShowPasswordModal(false);
        setShowSuccessOverlay(true);
        
        let timer = 3;
        const interval = setInterval(() => {
          timer -= 1;
          setCountdown(timer);
          if (timer === 0) {
            clearInterval(interval);
            logout();
          }
        }, 1000);

      } catch (err) {
        setPasswordError("Failed to update password. Try again.");
      }
    }
  };

  const handlePrClick = (exerciseName) => {
    setHistoryLimit(5);
    const exerciseHistory = allWorkouts 
      .filter(workout => 
        workout.details?.some(ex => ex.name.toLowerCase() === exerciseName.toLowerCase())
      )
      .map(workout => {
        const detail = workout.details.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
        return {
          workoutName: workout.name,
          date: workout.date,
          sets: detail.sets,
          type: detail.type,
          resistance: detail.resistance,
          execution: detail.execution
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    setSelectedPrHistory({ name: exerciseName, history: exerciseHistory });
  };

  // --- Keyboard navigation for fullscreen image carousel ---
  useEffect(() => {
    if (!fullscreenImage) return undefined;
    const imgs = allWorkouts.filter(w => w.imageUrl).map(w => w.imageUrl);
    const handleKey = (e) => {
      const idx = imgs.indexOf(fullscreenImage);
      if (e.key === "ArrowLeft" && idx > 0) {
        setFullscreenImage(imgs[idx - 1]);
      } else if (e.key === "ArrowRight" && idx >= 0 && idx < imgs.length - 1) {
        setFullscreenImage(imgs[idx + 1]);
      } else if (e.key === "Escape") {
        setFullscreenImage(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreenImage, allWorkouts]);

  if (loading) return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping duration-[2000ms]"></div>
        <div className="relative bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-8 rounded-full shadow-xl dark:shadow-md border border-white/40 dark:border-white/10">
          <Activity size={48} className="text-accent-500 animate-pulse" />
        </div>
      </div>
      <div className="w-full max-w-[200px] text-center">
        <h2 className="text-slate-800 dark:text-slate-100 font-bold text-sm uppercase tracking-[0.3em] mb-4">
          Analyzing Gains
        </h2>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-accent-500 rounded-full animate-progress-loading"></div>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-4 animate-bounce">
          Generating Report...
        </p>
      </div>
    </div>
  );

  const galleryImages = allWorkouts.filter(w => w.imageUrl).map(w => w.imageUrl);

  return (
    <div className="relative min-h-screen p-6 pb-40">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Analytics</h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Growth Tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className={`${tier.color} text-white px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg dark:shadow-md flex items-center gap-2 transition-all duration-500`}>
             {tier.icon} {tier.label}
          </div>
        </div>
      </div>

      {/* Body Metrics Nav */}
      <button
        onClick={() => navigate('/metrics')}
        className="w-full bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl border border-white/40 dark:border-white/10 text-slate-800 dark:text-slate-100 p-5 rounded-[32px] shadow-sm mb-6 flex items-center justify-between active:scale-[0.98] transition-all relative overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-800 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30">
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="font-bold text-base leading-tight">Body Metrics</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
              Weight, fat % &amp; muscle trends
            </p>
          </div>
        </div>
        <ChevronRight size={20} className="text-slate-400 dark:text-slate-500 relative z-10" />
        <Activity className="absolute -right-4 -bottom-4 w-24 h-24 text-orange-500/10 dark:text-orange-400/10 rotate-12" />
      </button>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10">
          <div className="bg-accent-100 dark:bg-accent-500/15 w-10 h-10 rounded-2xl flex items-center justify-center text-accent-600 dark:text-accent-400 mb-3">
            <Activity size={20} />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Total Sessions</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.totalWorkouts}</p>
        </div>
        <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10">
          <div className="bg-fuchsia-100 dark:bg-fuchsia-700/15 w-10 h-10 rounded-2xl flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 mb-3">
            <Clock size={20} />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Time Invested</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatMins(stats.totalMinutes)}</p>
        </div>
      </div>

      {hasActiveSession && (
        <div className="mb-8 animate-in slide-in-from-top duration-500">
          <div 
            onClick={() => navigate('/workout', { state: { from: 'reports' } })}
            className={`group relative overflow-hidden p-0.5 rounded-[26px] cursor-pointer transition-all duration-500 active:scale-[0.97] ${
              isPaused ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-gradient-x'
            }`}
          >
            <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-[24px] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {!isPaused && (
                    <div className="absolute inset-0 bg-amber-500/20 rounded-xl animate-ping"></div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    isPaused ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  }`}>
                    {isPaused ? <PauseCircle size={24} /> : <Activity size={24} className="animate-bounce" />}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isPaused ? 'text-slate-400 dark:text-slate-500' : 'text-orange-600 dark:text-orange-400'}`}>
                      {isPaused ? 'Paused' : 'Live Session'}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {isPaused ? 'Pick up where you left' : 'Crushing the workout'}
                  </h5>
                </div>
              </div>
              <div className={`p-2 rounded-full transition-all ${isPaused ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-amber-500 text-white shadow-lg dark:shadow-md shadow-amber-200'}`}>
                <ChevronRight size={20} strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONAL RECORDS (PR) SECTION */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Personal Records</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['Legs', 'Chest', 'Back', 'Biceps','Shoulders', 'Triceps', 'Abs', 'Full Body'].map((muscle) => (
            <button
              key={muscle}
              onClick={() => setActivePrTab(muscle)}
              className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                activePrTab === muscle ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md' : 'bg-white/40 dark:bg-slate-800/30 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10'
              }`}
            >
              {muscle}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {personalRecords[activePrTab] ? (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(personalRecords[activePrTab])
                .sort(([, a], [, b]) => b.weight - a.weight)
                .slice(0, showAllPrs ? undefined : 5)
                .map(([name, data]) => (
                <div key={name} onClick={() => handlePrClick(name)} className="group bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[28px] shadow-sm border border-white/40 dark:border-white/10 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 capitalize">{name}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter">
                        <Calendar size={10} /> {new Date(data.date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'})}
                      </p>
                      <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">{data.reps} Reps</p>
                      {data.resistance > 0 && (
                        <>
                          <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                          <p className="text-[9px] text-amber-500 dark:text-amber-400 font-bold uppercase tracking-tighter">{data.resistance} kg</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-accent-50 dark:bg-accent-500/10 px-4 py-2 rounded-2xl border border-accent-100 dark:border-accent-500/30 text-right">
                    <p className="text-xl font-bold text-accent-600 dark:text-accent-400 leading-none">{data.weight}<span className="text-[10px] ml-0.5">kg</span></p>
                  </div>
                </div>
              ))}
              {Object.keys(personalRecords[activePrTab]).length > 5 && (
                <button
                  onClick={() => setShowAllPrs(!showAllPrs)}
                  className="mt-2 py-3 w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 active:scale-95 transition-all shadow-sm"
                >
                  {showAllPrs ? <>{'Show Less'} <ChevronUp size={14}/></> : <>{'View All'} {Object.keys(personalRecords[activePrTab]).length} {activePrTab} {'PRs'} <ChevronDown size={14}/></>}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-10 rounded-[32px] text-center border-2 border-dashed border-white/40 dark:border-white/10 flex flex-col items-center">
                <Dumbbell size={24} className="text-slate-200 dark:text-slate-700 mb-3"/>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">No {activePrTab} PRs recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* --- NEW: PROGRESS GALLERY SECTION --- */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4 px-2">
          <ImageIcon size={18} className="text-fuchsia-500" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Progress Gallery</h3>
        </div>
        
        {galleryImages.length > 0 ? (
          <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-4 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10">
            <div className="grid grid-cols-4 gap-2">
              {galleryImages.slice(0, 8).map((img, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setFullscreenImage(img)}
                  className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 cursor-pointer active:scale-95 transition-transform"
                >
                  <img src={img} alt="progress" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {galleryImages.length > 0 && (
              <button 
                onClick={() => setShowFullGallery(true)}
                className="w-full mt-4 py-3 text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-500 uppercase tracking-widest bg-fuchsia-50/50 dark:bg-fuchsia-700/10 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-500/30 active:scale-95 transition-all"
              >
                View Full Gallery ({galleryImages.length})
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-10 rounded-[32px] text-center border-2 border-dashed border-white/40 dark:border-white/10 flex flex-col items-center">
            <ImageIcon size={24} className="text-slate-200 dark:text-slate-700 mb-3"/>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">No progress photos yet</p>
          </div>
        )}
      </div>

      {/* Intensity Trend */}
      <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-6 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-accent-500" />
            <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Intensity trend</h3>
          </div>
          <div className="flex items-center bg-white/30 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10 gap-1">
            <button onClick={() => {setCurrentWeekOffset(prev => prev - 1); setClickedIntensity(true)}} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400"><ChevronLeft size={16}/></button>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 uppercase">{currentWeekOffset === 0 ? "This Week" : currentWeekOffset === -1 ? "Last Week" : `${Math.abs(currentWeekOffset)}w ago`}</span>
            <button onClick={() => {setCurrentWeekOffset(prev => prev + 1); setClickedIntensity(true)}} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400"><ChevronRight size={16}/></button>
          </div>
        </div>
        <div className="h-44 w-full">
          {weeklyHistogram.some(d => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyHistogram}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#cbd5e1'}} />
                <Bar dataKey="minutes" radius={[6, 6, 6, 6]} barSize={22}>
                  {weeklyHistogram.map((entry, index) => (
                    <Cell key={index} fill={entry.minutes > 45 ? '#cb2d9c' : entry.minutes > 0 ? '#f9a8d4' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs italic">No activity recorded for this period</div>
          )}
        </div>
      </div>

      {/* Muscle Focus */}
      <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-6 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10 mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Target size={18} className="text-accent-500" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Muscle Volume (%)</h3>
        </div>
        <div className="space-y-5">
          {muscleDistribution.length > 0 ? muscleDistribution.map((muscle) => (
            <div key={muscle.name}>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{muscle.name}</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{muscle.percentage}%</span>
              </div>
              <div className="h-2 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-100 dark:border-slate-700">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${muscle.percentage}%`, backgroundColor: muscle.color }}
                ></div>
              </div>
            </div>
          )) : <div className="text-center text-slate-300 dark:text-slate-600 text-xs italic py-4">No data available</div>}
        </div>
      </div>

      {/* Efficiency Banner */}
      <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden mb-12">
        <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">Session Efficiency</h3>
            <p className="text-slate-400 text-xs mb-4">
              Averaging {stats.totalWorkouts > 0 ? Math.round(stats.totalMinutes / stats.totalWorkouts) : 0} mins per session. 
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-500/20 text-accent-400 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                <TrendingUp size={12}/> {stats.monthlyWorkouts} sessions (Last 30d)
            </div>
        </div>
        <Activity className="absolute -right-8 -bottom-8 w-32 h-32 text-accent-500/40 rotate-12" />
      </div>

      {/* Account Actions */}
      <div className="mt-8 flex flex-row gap-3 mb-4">
        <button
          onClick={() => setShowPasswordModal(true)}
          className="flex-1 py-4 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-300 font-bold text-[10px] uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 shadow-sm hover:bg-white/60 dark:hover:bg-slate-800/50 transition-all"
        >
          <Key size={16} className="text-accent-500" /> Change Password
        </button>
        <button
          onClick={() => setShowLogoutPrompt(true)}
          className="flex-1 py-4 flex items-center justify-center gap-2 text-red-500 dark:text-red-300 font-bold text-[10px] uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 shadow-sm hover:bg-white/60 dark:hover:bg-slate-800/50 transition-all"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
      <hr className="mb-3 border-slate-200 dark:border-slate-800" />

      {/* Delete Profile */}
      <button 
        onClick={() => setShowDeletePrompt(true)}
        className="w-full py-4 flex items-center justify-center gap-2 text-red-400 dark:text-red-300 font-bold text-[10px] uppercase tracking-[0.2em] bg-red-50/50 dark:bg-red-500/10 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/20 transition-all border border-red-100 dark:border-red-500/30"
      >
        <Trash2 size={16} /> Delete Account & Data
      </button>

      {/* Modals & Popups */}
      {showFullGallery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-end justify-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Full Gallery</h2>
                <p className="text-fuchsia-500 dark:text-fuchsia-400 font-bold text-[10px] uppercase tracking-[0.2em]">All Progress Photos</p>
              </div>
              <button onClick={() => setShowFullGallery(false)} className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500 hover:bg-white/70 dark:hover:bg-white/20 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-8">
              {galleryImages.map((img, idx) => (
                <div key={idx} onClick={() => setFullscreenImage(img)} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 cursor-pointer active:scale-95 transition-all">
                  <img src={img} alt="progress" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <button onClick={() => setShowFullGallery(false)} className="w-full bg-slate-900 dark:bg-slate-700 text-white font-bold py-4 rounded-2xl">CLOSE</button>
          </div>
        </div>
      )}

      {fullscreenImage && (() => {
        const currentIdx = galleryImages.indexOf(fullscreenImage);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx >= 0 && currentIdx < galleryImages.length - 1;
        const goPrev = (e) => {
          e.stopPropagation();
          if (hasPrev) setFullscreenImage(galleryImages[currentIdx - 1]);
        };
        const goNext = (e) => {
          e.stopPropagation();
          if (hasNext) setFullscreenImage(galleryImages[currentIdx + 1]);
        };
        return (
          <div
            className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setFullscreenImage(null)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
              className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors z-10"
            >
              <X size={24} />
            </button>

            {/* Prev */}
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-all z-10 ${
                hasPrev
                  ? "bg-black/10 hover:bg-black/20 active:scale-90"
                  : "bg-black/5 text-black/30 cursor-not-allowed"
              }`}
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Image */}
            <img
              key={fullscreenImage}
              src={fullscreenImage}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in duration-300"
              alt="Full Progress"
            />

            {/* Next */}
            <button
              onClick={goNext}
              disabled={!hasNext}
              className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-all z-10 ${
                hasNext
                  ? "bg-black/10 hover:bg-black/20 active:scale-90"
                  : "bg-black/5 text-black/30 cursor-not-allowed"
              }`}
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>

            {/* Counter */}
            {currentIdx >= 0 && galleryImages.length > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/10"
              >
                {currentIdx + 1} / {galleryImages.length}
              </div>
            )}
          </div>
        );
      })()}

      {showLogoutPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 dark:bg-red-500/15 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
              <LogOut size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Logging out?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              Are you sure you want to sign out? <br />
              Your active session (if any) will stay saved on this device.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={logout}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                Yes, Sign Out
              </button>
              <button
                onClick={() => setShowLogoutPrompt(false)}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 dark:bg-red-500/15 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Delete Profile?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              This will permanently delete your account and history. 
              <span className="font-bold text-red-400 dark:text-red-300 text-xs uppercase tracking-tighter block mt-1">This action is irreversible.</span>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDeleteProfile} className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl active:scale-95 transition-all">Yes, Delete Everything</button>
              <button onClick={() => setShowDeletePrompt(false)} className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-6">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {passwordStep === 1 ? 'Verify Identity' : 'Set New Password'}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6">
              {passwordStep === 1 ? 'Enter current credentials' : 'Enter your new strong password'}
            </p>

            <div className="space-y-4 mb-6 text-left">
              {passwordStep === 1 ? (
                <>
                  <input 
                    type="email" placeholder="Email Address"
                    className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                    value={passwordData.email}
                    onChange={(e) => setPasswordData({...passwordData, email: e.target.value})}
                  />
                  <input 
                    type="password" placeholder="Current Password"
                    className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  />
                </>
              ) : (
                <>
                  <input 
                    type="password" placeholder="New Password"
                    className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  />
                  <input 
                    type="password" placeholder="Repeat New Password"
                    className="w-full p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  />
                </>
              )}
            </div>

            {/* ERROR MESSAGE BLOCK */}
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/30 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-red-500 dark:text-red-300 text-[10px] font-bold uppercase tracking-tight flex items-center justify-center gap-2">
                  <AlertTriangle size={14} /> {passwordError}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleChangePassword}
                className="w-full py-4 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all"
              >
                {passwordStep === 1 ? 'Verify & Continue' : 'Update Password'}
              </button>
              <button 
                onClick={() => { 
                  setShowPasswordModal(false); 
                  setPasswordStep(1); 
                  setPasswordError(""); // Clear error on close
                }}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessOverlay && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[600] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
            
            {/* Circular Timer Animation */}
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * countdown) / 3}
                  className="text-accent-500 transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="absolute text-2xl font-bold text-slate-800 dark:text-slate-100">{countdown}</span>
            </div>

            <div className="bg-accent-100 dark:bg-accent-500/15 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-accent-600 dark:text-accent-400">
              <Activity size={32} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Security Updated</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Password changed successfully. <br/>
              For your safety, please log in again with your new credentials.
            </p>

            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-500 transition-all duration-1000 ease-linear" 
                style={{ width: `${(countdown / 3) * 100}%` }}
              ></div>
            </div>
            
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-4">
              Logging out...
            </p>
          </div>
        </div>
      )}

      {/* PR HISTORY BOTTOM SHEET */}
      {selectedPrHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-end justify-center">
          <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight capitalize">{selectedPrHistory.name}</h2>
                <p className="text-accent-500 dark:text-accent-400 font-bold text-[10px] uppercase tracking-[0.2em]">Full History</p>
              </div>
              <button onClick={() => setSelectedPrHistory(null)} className="bg-white/50 dark:bg-white/10 backdrop-blur-md p-2 rounded-full text-slate-400 dark:text-slate-500">
                <X size={20} />
              </button>
            </div>

            {/* History List */}
            <div className="space-y-6">
              {selectedPrHistory.history.slice(0, historyLimit).map((entry, idx) => (
                <div key={idx} className="relative pl-6 border-l-2 border-white/40 dark:border-white/10 pb-2">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-accent-500" />
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                        {new Date(entry.date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}
                      </p>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm capitalize">{entry.workoutName || 'Routine'}</h4>
                        {Number(entry.resistance) > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                            <div className="w-1 h-1 rounded-full bg-amber-400" />
                            +{entry.resistance}kg
                          </span>
                        )}

                        {entry.execution === 'Unilateral' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-fuchsia-50 dark:bg-fuchsia-700/10 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-100 dark:border-fuchsia-400/20 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                            <div className="w-1 h-1 rounded-full bg-fuchsia-400" />
                            Unilateral
                          </span>
                        )}
                          
                        {entry.execution === 'Bilateral' && (
                          <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                            Bilateral
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {entry.sets.map((set, sIdx) => (
                      <div key={sIdx} className="bg-white/40 dark:bg-white/5 backdrop-blur-md px-3 py-2 rounded-xl border border-white/40 dark:border-white/10 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">SET {sIdx + 1}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {entry.type === 'Strength' ? `${set.weight}kg x ${set.reps}` : `${set.time}s`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* LOAD MORE IN POPUP */}
              {historyLimit < selectedPrHistory.history.length && (
                <button
                  onClick={() => setHistoryLimit(prev => prev + 5)}
                  className="w-full py-4 mt-4 text-[10px] font-bold text-accent-600 dark:text-accent-400 uppercase tracking-[0.2em] bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-accent-100 dark:border-accent-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {/* <Activity size={14} /> */}
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
    </div>
  );
};

export default Reports;