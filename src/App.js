import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useContext } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import ActiveWorkout from './pages/ActiveWorkout';
import WorkoutReports from './pages/Reports';
import CreateExercise from './pages/CreateExercise';
import Library from './pages/Library';
import Navbar from './components/Navbar';
import InstallPrompt from './components/InstallPrompt';
import ScrollToTop from './components/ScrollToTop';
import Metrics from './pages/Metrics';

import useKeepAlive from './hooks/KeepAlive';
import useControlledBack from './hooks/useControlledBack';
import useWorkoutNotification from './hooks/useWorkoutNotification';

const AppContent = () => {
  const { user } = useContext(AuthContext);
  useControlledBack();
  useKeepAlive();
  useWorkoutNotification();

  return (
    <div className="pb-20 select-none">
      {/* Animated gradient blobs — global background */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-slate-950 pointer-events-none">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-400/40 dark:bg-emerald-500/20 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-indigo-400/40 dark:bg-indigo-500/20 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-orange-400/30 dark:bg-orange-500/15 blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full bg-fuchsia-400/30 dark:bg-fuchsia-500/15 blur-3xl animate-blob animation-delay-6000" />
      </div>
      <InstallPrompt />
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
        <Route path="/workout" element={user ? <ActiveWorkout /> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={user ? <WorkoutReports /> : <Navigate to="/login" replace />} />
        <Route path="/add-exercise" element={user ? <CreateExercise /> : <Navigate to="/login" replace />} />
        <Route path="/library" element={user ? <Library /> : <Navigate to="/login" replace />} />
        <Route path="/metrics" element={user ? <Metrics /> : <Navigate to="/login" replace />} />
      </Routes>
      {user && <Navbar />}
    </div>
  );
};

const RootApp = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </ThemeProvider>
  );
}