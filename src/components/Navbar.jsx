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
    <nav
      className={`fixed bottom-0 left-0 right-0 transition-all duration-300 ease-in-out z-[100] ${
        isMenuOpen
          ? "h-screen bg-white/40 backdrop-blur-md"
          : "h-20 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]"
      }`}
    >
      <div
        className={`flex justify-around items-center h-20 w-full absolute bottom-0 left-0 transition-opacity duration-300 ${
          isMenuOpen ? "opacity-100" : "opacity-100"
        }`}
      >
        <Link
          to="/"
          onClick={() => setIsMenuOpen(false)}
          className={`flex flex-col items-center flex-1 transition-all duration-300 ${
            isMenuOpen ? "opacity-20 pointer-events-none" : "opacity-100"
          } ${isActive("/") ? activeClass : inactiveClass}`}
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

        {/* Floating Center Button */}
        <div className="relative flex-1 flex justify-center -top-6">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="group relative focus:outline-none z-[120]"
          >
            {!isMenuOpen && (
              <div className="absolute inset-0 bg-emerald-400 rounded-full blur-lg opacity-20 group-active:opacity-40 transition-opacity"></div>
            )}

            <div
              className={`relative p-4 rounded-[22px] text-white shadow-xl border-[6px] border-slate-50 transition-all duration-400 ease-in-out flex items-center justify-center ${
                isMenuOpen
                  ? "bg-slate-800 rotate-[135deg] scale-90"
                  : "bg-emerald-600 shadow-emerald-200 active:scale-90"
              }`}
            >
              {isMenuOpen ? (
                <X size={24} strokeWidth={2} />
              ) : (
                <Dumbbell size={24} strokeWidth={2} />
              )}
            </div>

            <span
              className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest transition-all duration-400 ${
                isMenuOpen
                  ? "text-slate-800 opacity-100"
                  : "text-emerald-600 opacity-100"
              }`}
            >
              {isMenuOpen ? "Close" : "Action"}
            </span>
          </button>
        </div>

        {/* Stats Link */}
        <Link
          to="/reports"
          onClick={() => setIsMenuOpen(false)}
          className={`flex flex-col items-center flex-1 transition-all duration-300 ${
            isMenuOpen ? "opacity-20 pointer-events-none" : "opacity-100"
          } ${isActive("/reports") ? activeClass : inactiveClass}`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              isActive("/reports") ? "bg-emerald-50" : "bg-transparent"
            }`}
          >
            <User size={22} strokeWidth={isActive("/reports") ? 2.5 : 2} />
          </div>
          <span className="text-[9px] mt-1 font-black uppercase tracking-tighter">
            {user?.name?.split(" ")[0] || "Profile"}
          </span>
        </Link>
      </div>

      {isMenuOpen && (
        <div
          className="h-full w-full flex flex-col justify-end items-center py-10 px-6 animate-in fade-in zoom-in-95 duration-300"
          onClick={() => setIsMenuOpen(false)} 
        >
          <div
            className="w-full max-w-[300px] space-y-4 mb-20"
            onClick={(e) => e.stopPropagation()} 
          >
            <Link
              to="/add-exercise"
              onClick={() => setIsMenuOpen(false)}
              className="bg-white p-6 rounded-[32px] shadow-2xl shadow-slate-200/50 flex items-center gap-5 active:scale-95 transition-all border border-slate-50 w-full"
            >
              <div className="bg-emerald-500 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <Plus size={24} strokeWidth={3} />
              </div>
              <div className="text-left">
                <p className="font-black text-slate-800 text-base leading-tight">
                  Add Exercise
                </p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Create custom lift
                </p>
              </div>
            </Link>

            <Link
              to="/library"
              onClick={() => setIsMenuOpen(false)}
              className="bg-white p-6 rounded-[32px] shadow-2xl shadow-slate-200/50 flex items-center gap-5 active:scale-95 transition-all border border-slate-50 w-full"
            >
              <div className="bg-blue-500 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <Dumbbell size={24} />
              </div>
              <div className="text-left">
                <p className="font-black text-slate-800 text-base leading-tight">
                  My Library
                </p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Manage all items
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
