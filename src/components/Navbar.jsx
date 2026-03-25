import { Home, User, Plus, Dumbbell, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useContext } from "react";
import { useState } from "react";

const Navbar = () => {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Logic to determine active states
  const isActive = (path) => pathname === path;
  const activeClass = "text-emerald-600";
  const inactiveClass = "text-slate-400";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center py-2 z-[100] h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {/* Home Link */}
      <Link
        to="/"
        className={`flex flex-col items-center flex-1 transition-all duration-300 ${
          isActive("/") ? activeClass : inactiveClass
        }`}
      >
        <div
          className={`p-1 rounded-xl transition-all ${
            isActive("/") ? "bg-emerald-50" : "bg-transparent"
          }`}
        >
          <Home size={22} strokeWidth={isActive("/") ? 2.5 : 2} />
        </div>
        <span className="text-[9px] mt-1 font-black uppercase tracking-tighter">
          Home
        </span>
      </Link>

      {/* Floating Center Button Wrapper */}
      <div className="relative flex-1 flex justify-center -top-6 z-[100]">
        <button
          onClick={() => setIsMenuOpen(val=>!val)}
          className="group relative focus:outline-none z-[120]"
        >
          {/* Inner Glow/Pulse Effect - Hidden when menu is open to keep it clean */}
          {!isMenuOpen && (
            <div className="absolute inset-0 bg-emerald-400 rounded-full blur-lg opacity-20 group-active:opacity-40 transition-opacity"></div>
          )}

          <div
            className={`relative p-4 rounded-[22px] text-white shadow-xl border-[6px] border-slate-50 transition-all duration-300 flex items-center justify-center ${
              isMenuOpen
                ? "bg-slate-800 rotate-45 scale-90"
                : "bg-emerald-600 shadow-emerald-200 active:scale-90"
            }`}
          >
            {/* Icon switches or rotates based on state */}
            {isMenuOpen ? (
              <X size={24} strokeWidth={2} />
            ) : (
              <Dumbbell size={24} strokeWidth={2} />
            )}
          </div>

          <span
            className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
              isMenuOpen ? "text-slate-800" : "text-emerald-600"
            }`}
          >
            {isMenuOpen ? "Close" : "Action"}
          </span>
        </button>

        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-white backdrop-blur-md z-[110] animate-in fade-in duration-300"
              onClick={() => setIsMenuOpen(false)}
            />

            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[280px] z-[130] flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-8 duration-300">
              <Link
                to="/add-exercise"
                onClick={() => setIsMenuOpen(false)}
                className="bg-white p-5 rounded-[32px] shadow-2xl flex items-center gap-4 active:scale-95 transition-all border border-slate-50"
              >
                <div className="bg-emerald-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                  <Plus size={24} strokeWidth={3} />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-800 text-sm leading-tight">
                    Add Exercise
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Create custom lift
                  </p>
                </div>
              </Link>

              <Link
                to="/library"
                onClick={() => setIsMenuOpen(false)}
                className="bg-white p-5 rounded-[32px] shadow-2xl flex items-center gap-4 active:scale-95 transition-all border border-slate-50"
              >
                <div className="bg-blue-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <Dumbbell size={22} />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-800 text-sm leading-tight">
                    My Library
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Manage all items
                  </p>
                </div>
              </Link>

             
            </div>
          </>
        )}
      </div>

      {/* Stats Link */}
      <Link
        to="/reports"
        className={`flex flex-col items-center flex-1 transition-all duration-300 ${
          isActive("/reports") ? activeClass : inactiveClass
        }`}
      >
        <div
          className={`p-1 rounded-xl transition-all ${
            isActive("/reports") ? "bg-emerald-50" : "bg-transparent"
          }`}
        >
          {/* Profile Icon replaces BarChart2 */}
          <User size={22} strokeWidth={isActive("/reports") ? 2.5 : 2} />
        </div>
        <span className="text-[9px] mt-1 font-black uppercase tracking-tighter">
          {user?.name?.split(" ")[0] || "Profile"}
        </span>
      </Link>
    </nav>
  );
};

export default Navbar;