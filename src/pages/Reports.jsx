import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { 
  Activity, ChevronLeft, ChevronRight, Clock, Trophy, 
  Target, TrendingUp, AlertTriangle, Trash2, Dumbbell, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';

const Reports = () => {
  const { user, token, logout } = useContext(AuthContext); 
  const navigate = useNavigate();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [stats, setStats] = useState({ 
    totalWorkouts: 0, 
    totalMinutes: 0, 
    monthlyWorkouts: 0 
  });
  const [weeklyHistogram, setWeeklyHistogram] = useState([]);
  const [muscleDistribution, setMuscleDistribution] = useState([]);
  const [personalRecords, setPersonalRecords] = useState({});
  const [activePrTab, setActivePrTab] = useState('Legs');
  const [showAllPrs, setShowAllPrs] = useState(false); // New state for "Show More"
  const [loading, setLoading] = useState(true);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/workouts/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const history = res.data;

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
              
              const maxSet = exercise.sets.reduce((prev, current) => 
                (prev.weight > current.weight) ? prev : current
              , { weight: 0, reps: 0 });

              if (maxSet.weight > 0) {
                if (!prMap[muscleGroup]) prMap[muscleGroup] = {};
                if (!prMap[muscleGroup][exerciseName] || maxSet.weight > prMap[muscleGroup][exerciseName].weight) {
                  prMap[muscleGroup][exerciseName] = {
                    weight: maxSet.weight,
                    reps: maxSet.reps,
                    date: workout.date
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
        const muscleCounts = {};
        weekWorkouts.forEach(w => {
          w.details?.forEach(ex => {
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
            color: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ecfdf5'][i % 5]
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

  // Reset "Show More" when switching tabs
  useEffect(() => {
    setShowAllPrs(false);
  }, [activePrTab]);

  const getUserTier = () => {
    const count = stats.monthlyWorkouts;
    if (count < 5) return { label: 'Amateur', color: 'bg-slate-400', icon: <Activity size={14}/> };
    if (count < 12) return { label: 'Beginner', color: 'bg-blue-500', icon: <Target size={14}/> };
    if (count <= 21) return { label: 'Advanced', color: 'bg-purple-600', icon: <TrendingUp size={14}/> };
    return { label: 'Pro Athlete', color: 'bg-emerald-500', icon: <Trophy size={14}/> };
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

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading Analytics...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-40">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Analytics</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Growth Tracking</p>
        </div>
        <div className={`${tier.color} text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all duration-500`}>
           {tier.icon} {tier.label}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
          <div className="bg-emerald-100 w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-600 mb-3">
            <Activity size={20} />
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Sessions</p>
          <p className="text-xl font-black text-slate-800">{stats.totalWorkouts}</p>
        </div>
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
          <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 mb-3">
            <Clock size={20} />
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Time Invested</p>
          <p className="text-xl font-black text-slate-800">{formatMins(stats.totalMinutes)}</p>
        </div>
      </div>

      {/* PERSONAL RECORDS (PR) SECTION WITH TABS AND SHOW MORE */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Personal Records</h3>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['Legs', 'Chest', 'Back', 'Biceps','Shoulders', 'Triceps', 'Abs', 'Other'].map((muscle) => (
            <button
              key={muscle}
              onClick={() => setActivePrTab(muscle)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activePrTab === muscle 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              {muscle}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-2">
          {personalRecords[activePrTab] ? (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(personalRecords[activePrTab])
                .sort(([, a], [, b]) => b.weight - a.weight) // Sort by heaviest first
                .slice(0, showAllPrs ? undefined : 5) // Show only 5 unless showAllPrs is true
                .map(([name, data]) => (
                <div key={name} className="bg-white p-5 rounded-[28px] shadow-sm border border-slate-100 flex justify-between items-center animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm mb-1">{name}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-tighter">
                        <Calendar size={10} /> {new Date(data.date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'})}
                      </p>
                      <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{data.reps} Reps</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 text-right">
                    <p className="text-xl font-black text-emerald-600 leading-none">{data.weight}<span className="text-[10px] ml-0.5">kg</span></p>
                  </div>
                </div>
              ))}
              
              {/* Show More / Show Less Button */}
              {Object.keys(personalRecords[activePrTab]).length > 5 && (
                <button
                  onClick={() => setShowAllPrs(!showAllPrs)}
                  className="mt-2 py-3 w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white rounded-2xl border border-slate-100 active:scale-95 transition-all shadow-sm"
                >
                  {showAllPrs ? (
                    <>Show Less <ChevronUp size={14}/></>
                  ) : (
                    <>View All {Object.keys(personalRecords[activePrTab]).length} {activePrTab} PRs <ChevronDown size={14}/></>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white p-10 rounded-[32px] text-center border-2 border-dashed border-slate-200 flex flex-col items-center">
               <Dumbbell size={24} className="text-slate-200 mb-3"/>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">No {activePrTab} PRs recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Intensity Trend */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" />
            <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Intensity trend</h3>
          </div>
          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1">
            <button onClick={() => setCurrentWeekOffset(prev => prev - 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-emerald-600"><ChevronLeft size={16}/></button>
            <span className="text-[9px] font-black text-slate-400 px-2 uppercase">{currentWeekOffset === 0 ? "This Week" : currentWeekOffset === -1 ? "Last Week" : `${Math.abs(currentWeekOffset)}w ago`}</span>
            <button onClick={() => setCurrentWeekOffset(prev => prev + 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-emerald-600"><ChevronRight size={16}/></button>
          </div>
        </div>
        <div className="h-44 w-full">
          {weeklyHistogram.some(d => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyHistogram}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#cbd5e1'}} />
                <Bar dataKey="minutes" radius={[6, 6, 6, 6]} barSize={22}>
                  {weeklyHistogram.map((entry, index) => (
                    <Cell key={index} fill={entry.minutes > 45 ? '#10b981' : entry.minutes > 0 ? '#6ee7b7' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">No activity recorded for this period</div>
          )}
        </div>
      </div>

      {/* Muscle Focus */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-10">
        <div className="flex items-center gap-2 mb-6">
          <Target size={18} className="text-emerald-500" />
          <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Muscle Volume (%)</h3>
        </div>
        <div className="space-y-5">
          {muscleDistribution.length > 0 ? muscleDistribution.map((muscle) => (
            <div key={muscle.name}>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-700">{muscle.name}</span>
                <span className="text-[10px] font-black text-slate-400">{muscle.percentage}%</span>
              </div>
              <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${muscle.percentage}%`, backgroundColor: muscle.color }}
                ></div>
              </div>
            </div>
          )) : <div className="text-center text-slate-300 text-xs italic py-4">No data available</div>}
        </div>
      </div>

      {/* Efficiency Banner */}
      <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden mb-12">
        <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">Session Efficiency</h3>
            <p className="text-slate-400 text-xs mb-4">
              Averaging {stats.totalWorkouts > 0 ? Math.round(stats.totalMinutes / stats.totalWorkouts) : 0} mins per session. 
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                <TrendingUp size={12}/> {stats.monthlyWorkouts} sessions (Last 30d)
            </div>
        </div>
        <Activity className="absolute -right-8 -bottom-8 w-32 h-32 text-white/5 rotate-12" />
      </div>

      {/* Delete Profile */}
      <button 
        onClick={() => setShowDeletePrompt(true)}
        className="w-full py-4 flex items-center justify-center gap-2 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] bg-red-50/50 rounded-2xl hover:bg-red-50 transition-all border border-red-100"
      >
        <Trash2 size={16} /> Delete Account & Data
      </button>

      {/* Delete Modal */}
      {showDeletePrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Delete Profile?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This will permanently delete your account and history. 
              <span className="font-bold text-red-400 text-xs uppercase tracking-tighter block mt-1">This action is irreversible.</span>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDeleteProfile} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl active:scale-95 transition-all">Yes, Delete Everything</button>
              <button onClick={() => setShowDeletePrompt(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;