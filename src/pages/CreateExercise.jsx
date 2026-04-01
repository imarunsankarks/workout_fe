import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Dumbbell, Flame, Move, CheckCircle2, Info } from 'lucide-react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const CreateExercise = () => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    muscle: 'Full Body',
    type: 'Strength',
    resistance: 0,
    execution: 'Both' // 'Both' for Bilateral, 'Single' for Unilateral
  });

  const muscleGroups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body'];
  const types = [
    { id: 'Strength', icon: <Dumbbell size={18}/>, color: 'emerald' },
    { id: 'Warmup', icon: <Flame size={18}/>, color: 'amber' },
    { id: 'Stretching', icon: <Move size={18}/>, color: 'blue' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !user) return;

    setLoading(true);
    try {
      const newMovement = {
        userId: user.id,
        name: formData.name,
        muscle: formData.muscle,
        type: formData.type,
        resistance: Number(formData.resistance),
        execution: formData.execution
      };

      await axios.post(`${process.env.REACT_APP_API_URL}/api/exercises`, newMovement, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          name: '',
          muscle: 'Full Body',
          type: 'Strength',
          resistance: 0,
          execution: 'Both'
        });
      }, 1500);
    } catch (err) {
      setLoading(false);
      console.error("Save failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Add Movement</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Exercise Name */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Movement Name</label>
          <input 
            autoFocus
            type="text" 
            placeholder="e.g. Diamond Pushups"
            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        {/* Type Selection */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block px-1">Category</label>
          <div className="grid grid-cols-3 gap-3">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFormData({...formData, type: t.id})}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  formData.type === t.id 
                  ? `border-slate-900 bg-slate-900 text-white shadow-lg` 
                  : 'border-slate-50 bg-slate-50 text-slate-400'
                }`}
              >
                {t.icon}
                <span className="text-[10px] font-black uppercase tracking-tighter">{t.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Muscle Group */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block px-1">Target Muscle</label>
          <div className="flex flex-wrap gap-2">
            {muscleGroups.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFormData({...formData, muscle: m})}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  formData.muscle === m 
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block px-1">Execution Style</label>
            <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl">
              {['Both', 'Single'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFormData({ ...formData, execution: opt })}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.execution === opt 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {opt === 'Both' ? 'Bilateral' : 'Unilateral'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Base Resistance (kg)</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">+</div>
              <input 
                type="number" 
                placeholder="0"
                className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={formData.resistance}
                onChange={(e) => setFormData({...formData, resistance: e.target.value})}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-medium flex items-center gap-1 italic">
               <Info size={10}/> Added weight from machine/bar
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          disabled={loading || !formData.name}
          className={`w-full py-5 rounded-[24px] font-black text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
            !formData.name ? 'bg-slate-200 cursor-not-allowed' : 'bg-emerald-600 shadow-emerald-100'
          }`}
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <><Save size={20}/> SAVE TO LIBRARY</>
          )}
        </button>
      </form>

      {/* Success Feedback Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-emerald-600/95 backdrop-blur-sm z-[300] flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
          <CheckCircle2 size={80} className="mb-4 animate-bounce" />
          <h2 className="text-3xl font-black italic">EXERCISE ADDED!</h2>
          <p className="font-medium opacity-80">Updating your library...</p>
        </div>
      )}
    </div>
  );
};

export default CreateExercise;