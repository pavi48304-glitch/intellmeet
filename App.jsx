import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { MeetingProvider, useMeeting } from './context/MeetingContext';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { Dashboard } from './components/Dashboard/Dashboard';
import { MeetingRoom } from './components/Meeting/MeetingRoom';
import './App.css';

function AppContent() {
  const { user, loading } = useAuth();
  const { activeMeeting } = useMeeting();
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900/60 flex flex-col items-center justify-center text-gray-400 backdrop-blur-sm">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400/80">Initializing Workspace...</p>
      </div>
    );
  }

  if (!user) {
    if (authView === 'login') {
      return <Login onNavigate={setAuthView} />;
    } else {
      return <Register onNavigate={setAuthView} />;
    }
  }

  if (activeMeeting) {
    return <MeetingRoom />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MeetingProvider>
          <AppContent />
        </MeetingProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
