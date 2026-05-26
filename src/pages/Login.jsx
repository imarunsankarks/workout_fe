import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import axios from "axios";
import {
  Mail,
  Lock,
  User,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Activity,
  AlertCircle,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const Login = () => {
  const { login } = useContext(AuthContext);
  const [step, setStep] = useState(1); // 1: Email Check, 2: Password
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  // Step 1: Check if email exists in MongoDB
  const handleCheckEmail = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/check-email`,
        { email },
      );
      const exists = res.data.exists;

      if (!exists) {
        setIsNewUser(true);
        setError("New account registration is currently closed.");
        setLoading(false);
        return; // Prevent moving to step 2 for new users
      }

      setIsNewUser(false);
      setStep(2);
    } catch (err) {
      setError("Connection failed. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle Final Authentication
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/auth/authenticate`,
        {
          email,
          password,
          name,
          isSignup: false, // Forced to false as per requirements
        },
      );

      login(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center p-6">
      <div className="max-w-sm mx-auto w-full">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="bg-accent-gradient w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-4 shadow-xl dark:shadow-md shadow-accent-100">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            GainsTracker
          </h1>
          <p className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-[0.3em]">
            Track. Grow. Repeat.
          </p>
        </div>

        <div className="bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl rounded-[40px] p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-white/40 dark:border-white/10">
          {error && (
            <div
              className={`text-xs font-bold p-4 rounded-2xl mb-6 text-center flex items-center justify-center gap-2 ${isNewUser ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400"}`}
            >
              {isNewUser && <AlertCircle size={14} />}
              {error}
            </div>
          )}

          {step === 1 ? (
            <form
              onSubmit={handleCheckEmail}
              className="animate-in fade-in slide-in-from-right duration-500"
            >
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                Let's get started
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-sm mb-6 font-medium">
                Enter your email to sign in.
              </p>

              <div className="relative mb-6">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500"
                  size={20}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-4 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-accent-500 transition-all text-slate-800 dark:text-slate-200"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (isNewUser) setIsNewUser(false); // Reset state if user types again
                    if (error) setError("");
                  }}
                  required
                />
              </div>

              <button
                disabled={loading}
                className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-600 transition-all active:scale-95"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Continue <ChevronRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleAuth}
              className="animate-in fade-in slide-in-from-right duration-500"
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 mb-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                {/* {isNewUser ? "Create Account" : "Welcome Back"} */}
                Welcome Back
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-sm mb-6 font-medium">{email}</p>

              {/* SIGNUP FIELD COMMENTED OUT FOR FUTURE USE
              {isNewUser && (
                <div className="relative mb-4">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-accent-500 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )} 
              */}

              <div className="relative mb-6">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500"
                  size={20}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-4 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-accent-500 transition-all text-slate-800 dark:text-slate-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                disabled={loading}
                className="w-full py-4 bg-accent-gradient text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg dark:shadow-md shadow-accent-100 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Sign In"}
                {/* {loading ? <Loader2 className="animate-spin" /> : (isNewUser ? "Create Account" : "Sign In")} */}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
