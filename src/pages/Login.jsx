import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Mail, Lock, User, ChevronRight, ArrowLeft, Loader2, Activity } from 'lucide-react';

const Login = () => {
  const { login } = useContext(AuthContext);
  const [step, setStep] = useState(1); // 1: Email Check, 2: Password/Signup
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Step 1: Check if email exists in MongoDB
  const handleCheckEmail = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/check-email', { email });
      setIsNewUser(!res.data.exists);
      setStep(2);
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle Final Authentication
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/authenticate', {
        email,
        password,
        name,
        isSignup: isNewUser
      });

      // Update global context with user and token
      login(res.data.user, res.data.token); 
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center p-6">
      <div className="max-w-sm mx-auto w-full">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="bg-emerald-600 w-16 h-16 rounded-[22px] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-100">
            <Activity size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">GainsTracker</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em]">Track. Grow. Repeat.</p>
        </div>

        <div className="bg-white rounded-[40px] p-8 shadow-2xl shadow-slate-200 border border-slate-100">
          {error && (
            <div className="bg-red-50 text-red-500 text-xs font-bold p-4 rounded-2xl mb-6 text-center">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleCheckEmail} className="animate-in fade-in slide-in-from-right duration-500">
              <h2 className="text-xl font-black text-slate-800 mb-2">Let's get started</h2>
              <p className="text-slate-400 text-sm mb-6 font-medium">Enter your email to join or sign in.</p>
              
              <div className="relative mb-6">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  type="email" 
                  placeholder="Email Address"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button 
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Continue <ChevronRight size={18}/></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="animate-in fade-in slide-in-from-right duration-500">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="text-slate-300 hover:text-slate-500 mb-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
              >
                <ArrowLeft size={14}/> Back
              </button>

              <h2 className="text-xl font-black text-slate-800 mb-1">
                {isNewUser ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-slate-400 text-sm mb-6 font-medium">
                {email}
              </p>

              {isNewUser && (
                <div className="relative mb-4">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="relative mb-6">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                  type="password" 
                  placeholder="Password"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : (isNewUser ? "Create Account" : "Sign In")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;