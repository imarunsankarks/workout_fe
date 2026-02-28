import { Home, User, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const Navbar = () => {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);
  
  // Logic to determine active states
  const isActive = (path) => pathname === path;
  const activeClass = "text-emerald-600";
  const inactiveClass = "text-slate-400";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center py-2 z-[100] h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      
      {/* Home Link */}
      <Link to="/" className={`flex flex-col items-center flex-1 transition-all duration-300 ${isActive('/') ? activeClass : inactiveClass}`}>
        <div className={`p-1 rounded-xl transition-all ${isActive('/') ? 'bg-emerald-50' : 'bg-transparent'}`}>
          <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
        </div>
        <span className="text-[9px] mt-1 font-black uppercase tracking-tighter">Home</span>
      </Link>

      {/* Elevated "Create" Action Button */}
      <div className="relative flex-1 flex justify-center -top-6">
        <Link 
          to="/add-exercise" 
          className="group relative"
        >
          {/* Inner Glow/Pulse Effect */}
          <div className="absolute inset-0 bg-emerald-400 rounded-full blur-lg opacity-20 group-active:opacity-40 transition-opacity"></div>
          
          <div className="relative bg-emerald-600 p-4 rounded-[22px] text-white shadow-xl shadow-emerald-200 border-[6px] border-slate-50 active:scale-90 active:rotate-90 transition-all duration-300 flex items-center justify-center">
            <Plus size={28} strokeWidth={3} />
          </div>
          
          {/* Label under the floating button */}
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
            Add New
          </span>
        </Link>
      </div>

      {/* Stats Link */}
      <Link to="/reports" className={`flex flex-col items-center flex-1 transition-all duration-300 ${isActive('/reports') ? activeClass : inactiveClass}`}>
        <div className={`p-1 rounded-xl transition-all ${isActive('/reports') ? 'bg-emerald-50' : 'bg-transparent'}`}>
          {/* Profile Icon replaces BarChart2 */}
          <User size={22} strokeWidth={isActive('/reports') ? 2.5 : 2} />
        </div>
        <span className="text-[9px] mt-1 font-black uppercase tracking-tighter">
          {user?.name?.split(' ')[0] || 'Profile'} 
        </span>
      </Link>

    </nav>
  );
};

export default Navbar;