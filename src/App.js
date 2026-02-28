import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { useContext } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import ActiveWorkout from './pages/ActiveWorkout';
import WorkoutReports from './pages/Reports';
import CreateExercise from './pages/CreateExercise';
import Navbar from './components/Navbar';
import InstallPrompt from './components/InstallPrompt';

const RootApp = () => {
  const { user } = useContext(AuthContext);

  return (
    <BrowserRouter>
      <div className="pb-20"> 
        <InstallPrompt />
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
          <Route path="/workout" element={user ? <ActiveWorkout /> : <Navigate to="/login" />} />
          <Route path="/reports" element={user ? <WorkoutReports /> : <Navigate to="/login" />} />
          <Route path="/add-exercise" element={user ? <CreateExercise /> : <Navigate to="/login" />} />
        </Routes>
        {user && <Navbar />}
      </div>
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