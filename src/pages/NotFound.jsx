import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home as HomeIcon, ArrowLeft } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const NotFound = () => {
  const { user } = useContext(AuthContext);
  const homePath = user ? '/' : '/login';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="w-full max-w-sm bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-[40px] shadow-sm border border-white/40 dark:border-white/10 p-10 text-center animate-in fade-in zoom-in duration-300">
        {/* Icon tile */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 rounded-[28px] bg-accent-gradient opacity-20 blur-2xl" />
          <div className="relative w-full h-full rounded-[28px] bg-accent-gradient flex items-center justify-center text-white shadow-lg">
            <Compass size={44} strokeWidth={1.75} />
          </div>
        </div>

        {/* 404 title */}
        <h1 className="text-7xl font-black tracking-tight bg-accent-gradient bg-clip-text text-transparent mb-2 leading-none">
          404
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-6">
          Lost in the gym
        </p>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved. Let's get
          you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            to={homePath}
            className="w-full py-4 bg-accent-gradient text-white font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <HomeIcon size={18} /> Take Me Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
