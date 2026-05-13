import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const ThemeToggle = ({ className = "", size = 18 }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className={`relative p-2.5 rounded-xl active:scale-90 transition-all shadow-sm border ${
        isDark
          ? "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700"
          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
      } ${className}`}
    >
      {isDark ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
};

export default ThemeToggle;
