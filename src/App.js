import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
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

import useKeepAlive from './hooks/KeepAlive';
import useControlledBack from './hooks/useControlledBack';

const AppContent = () => {
  const { user } = useContext(AuthContext);
  useControlledBack();
  useKeepAlive();

  return (
    <div className="pb-20 select-none">
      <InstallPrompt />
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
        <Route path="/workout" element={user ? <ActiveWorkout /> : <Navigate to="/login" replace />} />
        <Route path="/reports" element={user ? <WorkoutReports /> : <Navigate to="/login" replace />} />
        <Route path="/add-exercise" element={user ? <CreateExercise /> : <Navigate to="/login" replace />} />
        <Route path="/library" element={user ? <Library /> : <Navigate to="/login" replace />} />
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
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}