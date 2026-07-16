import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import useEmblaCarousel from 'embla-carousel-react';
import {
  Activity, ChevronLeft, ChevronRight, Clock, Trophy, Flame,
  Target, TrendingUp, AlertTriangle, Trash2, Dumbbell, Calendar, ChevronDown, ChevronUp, Key, X, PauseCircle, Image as ImageIcon, LogOut
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import BottomSheet from '../components/BottomSheet';
import ExerciseHistorySheet from '../components/ExerciseHistorySheet';
import LoadingScreen from '../components/LoadingScreen';
import { buildLibraryMap, getDisplayName } from '../utils/exerciseLookup';
import Model from 'react-body-highlighter';

// Mount-only-when-open fullscreen image carousel. Mounting fresh on every
// open means useEmblaCarousel initializes once with the correct startIndex,
// so the first paint is already on the tapped image (no flash of slide 0).
const FullscreenCarousel = ({ images, startIdx, onClose }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'center',
    startIndex: startIdx,
  });
  const [selected, setSelected] = useState(startIdx);

  useEffect(() => {
    if (!emblaApi) return undefined;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') emblaApi?.scrollPrev();
      else if (e.key === 'ArrowRight') emblaApi?.scrollNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [emblaApi, onClose]);

  const hasPrev = selected > 0;
  const hasNext = selected < images.length - 1;

  return (
    <div
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[600] flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors z-10"
        aria-label="Close"
      >
        <X size={24} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
        disabled={!hasPrev}
        className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-all z-10 ${
          hasPrev ? 'bg-white/10 hover:bg-white/20 active:scale-90' : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
        aria-label="Previous image"
      >
        <ChevronLeft size={24} />
      </button>

      <div
        className="overflow-hidden w-full h-full flex items-center"
        ref={emblaRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full h-full">
          {images.map((img, idx) => (
            <div key={idx} className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center px-4">
              <img
                src={img}
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain select-none pointer-events-none"
                alt={`Progress ${idx + 1}`}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
        disabled={!hasNext}
        className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-all z-10 ${
          hasNext ? 'bg-white/10 hover:bg-white/20 active:scale-90' : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
        aria-label="Next image"
      >
        <ChevronRight size={24} />
      </button>

      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/10"
        >
          {selected + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

// Maps app muscle-group names to react-body-highlighter muscle ids.
const MUSCLE_MAP = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['front-deltoids', 'back-deltoids'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Legs: ['quadriceps', 'hamstring', 'calves', 'gluteal', 'adductor', 'abductors'],
  Abs: ['abs', 'obliques'],
  'Full Body': [
    'chest', 'upper-back', 'lower-back', 'trapezius', 'front-deltoids',
    'back-deltoids', 'biceps', 'triceps', 'forearm', 'quadriceps', 'hamstring',
    'calves', 'gluteal', 'abs', 'obliques', 'adductor', 'abductors',
  ],
};

// Anatomical muscle heatmap for the week. Uses react-body-highlighter to
// render proper front/back views; intensity is a hit-count derived from
// each group's percentage relative to the most-worked group.
const MuscleBodyMap = ({ distribution }) => {
  const maxPct = Math.max(1, ...distribution.map((d) => d.percentage));

  // Convert distribution -> per-exercise data. Each group emits N entries
  // (N ∝ its share) so the library naturally shades higher-frequency
  // muscles darker via `highlightedColors`.
  const data = distribution.flatMap((d) => {
    const muscles = MUSCLE_MAP[d.name];
    if (!muscles || muscles.length === 0 || d.percentage === 0) return [];
    const hits = Math.max(1, Math.round((d.percentage / maxPct) * 5));
    return Array.from({ length: hits }, (_, i) => ({
      name: `${d.name}-${i}`,
      muscles,
    }));
  });

  // Brand palette: indigo -> fuchsia -> orange (matches --accent-gradient).
  const highlightedColors = ['#c7d2fe', '#818cf8', '#6366f1', '#cb2d9c', '#f97316'];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <Model
            data={data}
            type="anterior"
            style={{ width: '100%', maxWidth: '180px' }}
            bodyColor="#e2e8f0"
            highlightedColors={highlightedColors}
          />
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">Front</p>
        </div>
        <div className="flex flex-col items-center">
          <Model
            data={data}
            type="posterior"
            style={{ width: '100%', maxWidth: '180px' }}
            bodyColor="#e2e8f0"
            highlightedColors={highlightedColors}
          />
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">Back</p>
        </div>
      </div>

      {/* Intensity legend */}
      <div className="mt-5 flex items-center gap-2">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Low</span>
        <div
          className="flex-1 h-2 rounded-full"
          style={{ background: 'linear-gradient(to right, #c7d2fe, #818cf8, #6366f1, #cb2d9c, #f97316)' }}
        />
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">High</span>
      </div>

      {/* Muscle chips */}
      {distribution.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {distribution.map((m) => {
            const level = Math.max(0, Math.min(4, Math.round((m.percentage / maxPct) * 4)));
            return (
              <div
                key={m.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/40 dark:border-white/10 bg-white/30 dark:bg-slate-800/40 backdrop-blur-md"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: highlightedColors[level] }}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{m.name}</span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{m.percentage}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  const [activeDayIdx, setActiveDayIdx] = useState(null);

  // --- NEW GALLERY STATES ---
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(!clickedIntensity ? true : false);
        // Fetch workouts and the user's exercise library in parallel. The
        // library powers live name resolution — workouts only carry
        // `exerciseId`, so every display name is looked up through this map.
        const [workoutsRes, libraryRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${process.env.REACT_APP_API_URL}/api/exercises/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const history = workoutsRes.data;
        const libraryMap = buildLibraryMap(libraryRes.data || []);
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
        // Keyed by exerciseId so renames don't split a single exercise into
        // multiple PR cards. The display name is resolved from the library
        // and stored on the record at aggregation time.
        const prMap = {};
        history.forEach(workout => {
          workout.details?.forEach(exercise => {
            if (exercise.type !== 'Strength') return;
            if (!exercise.exerciseId) return; // strict id-only model

            const muscleGroup = exercise.muscle || 'Other';
            const exerciseId = String(exercise.exerciseId);
            const baseResistance = Number(exercise.resistance) || 0;
            
            // Unilateral (Single) lifts count double per side.
            const executionMultiplier = exercise.execution === 'Unilateral' ? 2 : 1;
            const maxSet = exercise.sets.reduce((prev, current) => {
              const prevTotal = ((Number(prev.weight) || 0) + baseResistance) * executionMultiplier;
              const currentTotal = ((Number(current.weight) || 0) + baseResistance) * executionMultiplier;
              return (prevTotal > currentTotal) ? prev : current;
            }, { weight: 0, reps: 0 });

            const currentSetTotal = ((Number(maxSet.weight) || 0) + baseResistance) * executionMultiplier;

            if (maxSet.weight >= 0) {
              if (!prMap[muscleGroup]) prMap[muscleGroup] = {};

              const existingRecord = prMap[muscleGroup][exerciseId];
              const existingMultiplier = existingRecord?.execution === 'Unilateral' ? 2 : 1;
              const existingTotal = existingRecord
                ? (existingRecord.weight + existingRecord.resistance) * existingMultiplier
                : -1;

              if (!existingRecord || currentSetTotal > existingTotal) {
                prMap[muscleGroup][exerciseId] = {
                  exerciseId,
                  name: getDisplayName(exercise, libraryMap),
                  weight: Number(maxSet.weight),
                  reps: maxSet.reps,
                  date: workout.date,
                  resistance: baseResistance,
                  execution: exercise.execution || 'Bilateral',
                };
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
          const dayWorkouts = weekWorkouts
            .filter(w => new Date(w.date).getDay() === idx)
            .map(w => ({ name: w.name || 'Workout', duration: w.duration || 0 }));
          const dayTotal = dayWorkouts.reduce((sum, w) => sum + w.duration, 0);
          return { day, minutes: dayTotal, sessions: dayWorkouts };
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
            // Violet-led palette walking from violet → indigo → orange
            color: ['#7c3aed', '#8b5cf6', '#6366f1', '#a78bfa', '#f97316'][i % 5]
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
    setActiveDayIdx(null);
  }, [currentWeekOffset]);

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
    if (count < 5) return { label: 'Amateur', color: 'bg-gradient-to-br from-[#4c1d95] via-[#a78bfa] to-[#2e1065]', Icon: Activity };
    if (count < 12) return { label: 'Beginner', color: 'bg-gradient-to-br from-[#7a3f1d] via-[#e89a4d] to-[#5e2f15]', Icon: Target };
    if (count <= 19) return { label: 'Advanced', color: 'bg-gradient-to-br from-[#6b6d70] via-[#e5e7eb] to-[#4b4d50]', Icon: Flame };
    return { label: 'Pro Athlete', color: 'bg-gradient-to-br from-[#8b6914] via-[#fde17a] to-[#7a5e0f]', Icon: Trophy };
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

  // Match by canonical id; the display name passed in is just for the
  // history sheet header.
  const handlePrClick = (exerciseId, displayName) => {
    if (!exerciseId) return;
    setHistoryLimit(5);
    const idStr = String(exerciseId);
    const exerciseHistory = allWorkouts
      .filter(workout =>
        workout.details?.some(ex => String(ex.exerciseId) === idStr)
      )
      .map(workout => {
        const detail = workout.details.find(ex => String(ex.exerciseId) === idStr);
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

    setSelectedPrHistory({ name: displayName, history: exerciseHistory });
  };

  const galleryImages = allWorkouts.filter(w => w.imageUrl).map(w => w.imageUrl);

  // Back-button behavior: when an overlay is open, pressing the system back
  // button should close the overlay instead of leaving the page. We push a
  // sentinel history entry on open and set window.__overlayOpen so the global
  // `useControlledBack` hook skips its "back -> home" redirect. Our local
  // popstate listener then closes the overlay.
  useEffect(() => {
    const overlayOpen = fullscreenIdx !== null || showFullGallery;
    if (!overlayOpen) return undefined;

    window.__overlayOpen = true;
    window.history.pushState({ reportsOverlay: true }, '');
    const handlePop = () => {
      if (fullscreenIdx !== null) setFullscreenIdx(null);
      else if (showFullGallery) setShowFullGallery(false);
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.__overlayOpen = false;
    };
  }, [fullscreenIdx, showFullGallery]);

  if (loading) return (
    <LoadingScreen
      icon={Activity}
      title="Analyzing Gains"
      caption="Generating Report..."
    />
  );

  return (
    <div className="relative min-h-screen p-6 pb-40">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Analytics</h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Growth Tracking</p>
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
      <div className="grid grid-cols-2 gap-4 mb-6">
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
        <div className="mb-6 animate-in slide-in-from-top duration-500">
          <div
            onClick={() => navigate('/workout', { state: { from: 'reports' } })}
            className={`group relative overflow-hidden p-0.5 rounded-[26px] cursor-pointer transition-all duration-500 active:scale-[0.97] ${isPaused ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-gradient-x'
              }`}
          >
            <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-[24px] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {!isPaused && (
                    <div className="absolute inset-0 bg-amber-500/20 rounded-xl animate-ping"></div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isPaused ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300'
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
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Personal Records</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['Legs', 'Chest', 'Back', 'Biceps', 'Shoulders', 'Triceps', 'Abs', 'Full Body'].map((muscle) => (
            <button
              key={muscle}
              onClick={() => setActivePrTab(muscle)}
              className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activePrTab === muscle ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md' : 'bg-white/40 dark:bg-slate-800/30 backdrop-blur-md text-slate-400 dark:text-slate-500 border border-white/40 dark:border-white/10'
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
                .map(([exerciseId, data]) => (
                  <div key={exerciseId} onClick={() => handlePrClick(exerciseId, data.name)} className="group bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[28px] shadow-sm border border-white/40 dark:border-white/10 flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 capitalize">{data.name}</h4>
                      <div className="flex items-center gap-3">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter">
                          <Calendar size={10} /> {new Date(data.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
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
                    <div className={`px-4 py-2 rounded-2xl border text-right ${
                      data?.execution === 'Unilateral'
                        ? 'bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-100 dark:border-fuchsia-500/30'
                        : 'bg-accent-50 dark:bg-accent-500/10 border-accent-100 dark:border-accent-500/30'
                    }`}>
                      <p className={`text-xl font-bold leading-none ${
                        data?.execution === 'Unilateral'
                          ? 'text-fuchsia-600 dark:text-fuchsia-400'
                          : 'text-accent-600 dark:text-accent-400'
                      }`}>{(data.weight + data.resistance)}<span className="text-[10px] ml-0.5">kg</span></p>
                    </div>
                  </div>
                ))}
              {Object.keys(personalRecords[activePrTab]).length > 5 && (
                <button
                  onClick={() => setShowAllPrs(!showAllPrs)}
                  className="mt-2 py-3 w-full flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 active:scale-95 transition-all shadow-sm"
                >
                  {showAllPrs ? <>{'Show Less'} <ChevronUp size={14} /></> : <>{'View All'} {Object.keys(personalRecords[activePrTab]).length} {activePrTab} {'PRs'} <ChevronDown size={14} /></>}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-10 rounded-[32px] text-center border-2 border-dashed border-white/40 dark:border-white/10 flex flex-col items-center">
              <Dumbbell size={24} className="text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">No {activePrTab} PRs recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* --- NEW: PROGRESS GALLERY SECTION --- */}
      <div className="mb-6">
        {galleryImages.length > 0 ? (
          <button
            onClick={() => setShowFullGallery(true)}
            className="w-full bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-5 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/50 active:scale-[0.98] transition-all flex items-center gap-4 text-left relative overflow-hidden"
          >
            <div className="bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 dark:from-fuchsia-600 dark:to-fuchsia-800 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shadow-fuchsia-200 dark:shadow-fuchsia-900/30 shrink-0 relative z-10">
              <ImageIcon size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                View Progress Gallery
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>
            <ChevronRight size={20} className="text-slate-400 dark:text-slate-500 shrink-0 relative z-10" />
            <ImageIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-fuchsia-500/10 dark:text-fuchsia-400/10 rotate-12" />
          </button>
        ) : (
          <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-10 rounded-[32px] text-center border-2 border-dashed border-white/40 dark:border-white/10 flex flex-col items-center">
            <ImageIcon size={24} className="text-slate-200 dark:text-slate-700 mb-3" />
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
          <div className="flex items-center bg-white/30 dark:bg-gray-300/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10 gap-1">
            <button onClick={() => { setCurrentWeekOffset(prev => prev - 1); setClickedIntensity(true) }} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400"><ChevronLeft size={16} /></button>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 uppercase">{currentWeekOffset === 0 ? "This Week" : currentWeekOffset === -1 ? "Last Week" : `${Math.abs(currentWeekOffset)}w ago`}</span>
            <button
              onClick={() => { setCurrentWeekOffset(prev => prev + 1); setClickedIntensity(true) }}
              disabled={currentWeekOffset >= 0}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg transition-all text-slate-400 dark:text-slate-500 hover:text-accent-600 dark:hover:text-accent-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none disabled:hover:text-slate-400 dark:disabled:hover:text-slate-500"
            ><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="h-44 w-full [&_*:focus]:outline-none [&_*]:outline-none">
          {weeklyHistogram.some(d => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyHistogram} style={{ outline: 'none' }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#cbd5e1' }} />
                <Bar
                  dataKey="minutes"
                  radius={[6, 6, 6, 6]}
                  barSize={22}
                  style={{ outline: 'none', cursor: 'pointer' }}
                  onClick={(_, index) => {
                    const entry = weeklyHistogram[index];
                    if (!entry || !entry.sessions?.length) return;
                    setActiveDayIdx((prev) => (prev === index ? null : index));
                  }}
                >
                  {weeklyHistogram.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.minutes > 45 ? '#7c3aed' : entry.minutes > 0 ? '#c4b5fd' : '#f1f5f9'}
                      opacity={activeDayIdx === null || activeDayIdx === index ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs italic">No activity recorded for this period</div>
          )}
        </div>
        {activeDayIdx !== null && weeklyHistogram[activeDayIdx]?.sessions?.length > 0 && (
          <div className="relative mt-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {weeklyHistogram[activeDayIdx].day}
              </span>
              <span className="text-[10px] font-bold text-accent-400 uppercase tracking-widest">
                {formatMins(weeklyHistogram[activeDayIdx].minutes)}
              </span>
            </div>
            <div className="space-y-1.5">
              {weeklyHistogram[activeDayIdx].sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-200 font-bold capitalize truncate">{s.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{formatMins(s.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body Heatmap */}
      <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-6 rounded-[32px] shadow-sm border border-white/40 dark:border-white/10 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity size={18} className="text-accent-500" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-widest">Body Heatmap</h3>
        </div>
        {muscleDistribution.length > 0 ? (
          <MuscleBodyMap distribution={muscleDistribution} />
        ) : (
          <div className="text-center text-slate-300 dark:text-slate-600 text-xs italic py-4">No data available</div>
        )}
      </div>

      {/* Efficiency Banner */}
      <div className="bg-black/50 rounded-[32px] p-6 text-white relative overflow-hidden mb-12 backdrop-blur-xl">
        <div className="relative z-10">
          <span className={`px-2.5 py-1 rounded-full border border-white/15 text-[8px] font-medium uppercase tracking-widest`}>
            {tier.label}
          </span>
          <h3 className="font-bold text-lg mt-2">Session Efficiency</h3>
          <p className="text-slate-400 text-xs mb-4">
            Averaging {stats.totalWorkouts > 0 ? Math.round(stats.totalMinutes / stats.totalWorkouts) : 0} mins per session.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-500/20 text-accent-400 rounded-lg text-[10px] font-bold uppercase tracking-widest">
            <TrendingUp size={12} /> {stats.monthlyWorkouts} sessions (Last 30d)
          </div>
        </div>
        <tier.Icon className={`absolute -right-7 -bottom-5 w-32 h-32 rotate-12 text-[#4b3d3d]`} strokeWidth={2} />
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
      <BottomSheet
        open={showFullGallery}
        onClose={() => setShowFullGallery(false)}
        zIndex="z-[500]"
        maxHeight="85vh"
      >
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
            <div key={idx} onClick={() => setFullscreenIdx(idx)} className="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 cursor-pointer active:scale-95 transition-all">
              <img src={img} alt="progress" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <button onClick={() => setShowFullGallery(false)} className="w-full bg-slate-900 dark:bg-slate-700 text-white font-bold py-4 rounded-2xl">CLOSE</button>
      </BottomSheet>

      {fullscreenIdx !== null && (
        <FullscreenCarousel
          images={galleryImages}
          startIdx={fullscreenIdx}
          onClose={() => setFullscreenIdx(null)}
        />
      )}

      <ConfirmModal
        open={showLogoutPrompt}
        onClose={() => setShowLogoutPrompt(false)}
        onConfirm={logout}
        title="Logging out?"
        message={<>Are you sure you want to sign out?<br />Your active session (if any) will stay saved on this device.</>}
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay Logged In"
        icon={LogOut}
      />

      <ConfirmModal
        open={showDeletePrompt}
        onClose={() => setShowDeletePrompt(false)}
        onConfirm={handleDeleteProfile}
        title="Delete Profile?"
        message="This will permanently delete your account and history."
        extraNote="This action is irreversible."
        confirmLabel="Yes, Delete Everything"
        icon={AlertTriangle}
      />

      <ConfirmModal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordStep(1);
          setPasswordError("");
        }}
        onConfirm={handleChangePassword}
        title={passwordStep === 1 ? 'Verify Identity' : 'Set New Password'}
        subtitle={passwordStep === 1 ? 'Enter current credentials' : 'Enter your new strong password'}
        confirmLabel={passwordStep === 1 ? 'Verify & Continue' : 'Update Password'}
        cancelLabel="Cancel"
        icon={Key}
        tone="neutral"
        error={passwordError}
      >
        <div className="space-y-4">
          {passwordStep === 1 ? (
            <>
              <input
                type="email" placeholder="Email Address"
                className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                value={passwordData.email}
                onChange={(e) => setPasswordData({ ...passwordData, email: e.target.value })}
              />
              <input
                type="password" placeholder="Current Password"
                className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </>
          ) : (
            <>
              <input
                type="password" placeholder="New Password"
                className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
              <input
                type="password" placeholder="Repeat New Password"
                className="w-full p-4 bg-white/50 dark:bg-gray-300/5 backdrop-blur-md text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-2xl font-bold outline-none border border-white/50 dark:border-white/10 focus:border-accent-500 dark:focus:border-accent-400"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </>
          )}
        </div>
      </ConfirmModal>

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
              Password changed successfully. <br />
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
      <ExerciseHistorySheet
        data={selectedPrHistory}
        onClose={() => setSelectedPrHistory(null)}
        historyLimit={historyLimit}
        onLoadMore={() => setHistoryLimit(prev => prev + 5)}
      />
    </div>
  );
};

export default Reports;