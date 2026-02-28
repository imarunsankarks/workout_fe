import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ChevronLeft, ChevronRight, Clock, Trophy, Target, TrendingUp, AlertTriangle, Trash2 } from 'lucide-react';

const Reports = () => {
  const { user, token, logout } = useContext(AuthContext); 
  const navigate = useNavigate();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [stats, setStats] = useState({ totalWorkouts: 0, totalMinutes: 0 });
  const [weeklyHistogram, setWeeklyHistogram] = useState([]);
  const [muscleDistribution, setMuscleDistribution] = useState([]);
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

        const totalMins = history.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        setStats({ totalWorkouts: history.length, totalMinutes: totalMins });

        const now = new Date();
        const startOfThisWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
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

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const histogram = days.map((day, idx) => {
          const dayTotal = weekWorkouts
            .filter(w => {
              const d = new Date(w.date).getDay();
              const dayIdx = d === 0 ? 6 : d - 1;
              return dayIdx === idx;
            })
            .reduce((sum, w) => sum + (w.duration || 0), 0);
          return { day, minutes: dayTotal };
        });
        setWeeklyHistogram(histogram);

        const muscleCounts = {};
        weekWorkouts.forEach(w => {
          w.details?.forEach(ex => {
            const muscle = ex.muscle || 'Other';
            const setVol = ex.sets?.length || 0;
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + setVol;
          });
        });

        const totalSets = Object.values(muscleCounts).reduce((a, b) => a + b, 0);
        const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ecfdf5'];
        
        const distribution = Object.entries(muscleCounts)
          .map(([name, count], i) => ({
            name,
            percentage: totalSets > 0 ? Math.round((count / totalSets) * 100) : 0,
            color: colors[i % colors.length]
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

  const handleDeleteProfile = async () => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/auth/delete-profile/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      logout(); // Clear context and redirect to login
      navigate('/login');
    } catch (err) {
      alert("Error deleting profile. Please try again later.");
    }
  };

  const getWeekRangeLabel = () => {
    if (currentWeekOffset === 0) return "This Week";
    if (currentWeekOffset === -1) return "Last Week";
    return `${Math.abs(currentWeekOffset)} Weeks Ago`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading Analytics...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-40">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Analytics</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Growth Tracking</p>
        </div>
        <div className="bg-emerald-500 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center gap-2">
           <Trophy size={14}/> Pro Athlete
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
          <div className="bg-emerald-100 w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-600 mb-3">
            <Activity size={20} />
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Workouts</p>
          <p className="text-3xl font-black text-slate-800">{stats.totalWorkouts}</p>
        </div>
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-100">
          <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 mb-3">
            <Clock size={20} />
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Minutes</p>
          <p className="text-3xl font-black text-slate-800">{stats.totalMinutes}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" />
            <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Intensity trend</h3>
          </div>
          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1">
            <button onClick={() => setCurrentWeekOffset(prev => prev - 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-emerald-600"><ChevronLeft size={16}/></button>
            <span className="text-[9px] font-black text-slate-400 px-2 uppercase">{getWeekRangeLabel()}</span>
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
                    <Cell key={index} fill={entry.minutes > 25 ? '#10b981' : entry.minutes > 0 ? '#6ee7b7' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">No activity this week</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Target size={18} className="text-emerald-500" />
          <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Muscle Focus ({getWeekRangeLabel()})</h3>
        </div>
        <div className="space-y-5">
          {muscleDistribution.length > 0 ? muscleDistribution.map((muscle) => (
            <div key={muscle.name}>
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-slate-700">{muscle.name}</span>
                <span className="text-[10px] font-black text-slate-400">{muscle.percentage}% Volume</span>
              </div>
              <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out" 
                  style={{ 
                    width: `${muscle.percentage}%`, 
                    backgroundColor: muscle.color,
                    boxShadow: `0 0 12px ${muscle.color}44` 
                  }}
                ></div>
              </div>
            </div>
          )) : <div className="text-center text-slate-300 text-xs italic py-4">No specific focus recorded this week</div>}
        </div>
      </div>

      <div className="bg-slate-900 rounded-[32px] p-6 text-white relative overflow-hidden mb-12">
        <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">Session Efficiency</h3>
            <p className="text-slate-400 text-xs mb-4">You are training {stats.totalWorkouts > 0 ? Math.round(stats.totalMinutes / stats.totalWorkouts) : 0} minutes per session on average.</p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                <TrendingUp size={12}/> Activity analyzed from DB
            </div>
        </div>
        <Activity className="absolute -right-8 -bottom-8 w-32 h-32 text-white/5 rotate-12" />
      </div>

      {/* DELETE PROFILE OPTION */}
      <div className="border-t border-slate-200 pt-8 mt-4">
        <button 
          onClick={() => setShowDeletePrompt(true)}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-400 font-black text-[10px] uppercase tracking-[0.2em] bg-red-50/50 rounded-2xl hover:bg-red-50 transition-all border border-red-100"
        >
          <Trash2 size={16} /> Delete Account & Data
        </button>
      </div>

      {/* DELETE PROFILE CONFIRMATION MODAL */}
      {showDeletePrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Delete Profile?</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              This will permanently delete your account, your workout history, and your custom library. <br/> 
              <span className="font-bold text-red-400 text-xs uppercase tracking-tighter">This action cannot be undone.</span>
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleDeleteProfile} 
                className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Yes, Delete Everything
              </button>
              <button 
                onClick={() => setShowDeletePrompt(false)} 
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

export default Reports;