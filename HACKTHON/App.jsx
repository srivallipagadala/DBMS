import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Buses from './components/Buses';
import RoutesStops from './components/RoutesStops';
import Schedules from './components/Schedules';
import Drivers from './components/Drivers';
import StudentPortal from './components/StudentPortal';
import Students from './components/Students';
import DriverPortal from './components/DriverPortal';
import BusReports from './components/BusReports';
import { apiRequest } from './api';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(sessionStorage.getItem('smartbus_token')));

  useEffect(() => {
    // Older builds stored one token for every tab; discard it to prevent role crossover.
    localStorage.removeItem('smartbus_token');
    localStorage.removeItem('smartbus_user');
    const token = sessionStorage.getItem('smartbus_token');
    if (!token) return;

    let active = true;
    apiRequest('/api/auth/me')
      .then(data => {
        if (active) {
          setCurrentUser(data.user);
          setActiveTab(data.user.role === 'student' ? 'student' : data.user.role === 'driver' ? 'driver' : 'dashboard');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('smartbus_token');
        sessionStorage.removeItem('smartbus_user');
      })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  const handleLoginSuccess = (user, token) => {
    sessionStorage.setItem('smartbus_token', token);
    sessionStorage.setItem('smartbus_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveTab(user.role === 'student' ? 'student' : user.role === 'driver' ? 'driver' : 'dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Could not invalidate the server session during logout:', error);
    } finally {
      sessionStorage.removeItem('smartbus_token');
      sessionStorage.removeItem('smartbus_user');
      setCurrentUser(null);
      setActiveTab('dashboard');
    }
  };

  if (authLoading) {
    return <main className="auth-page"><p className="auth-subtitle">Checking your SmartBus session…</p></main>;
  }

  if (!currentUser) return <Auth onLoginSuccess={handleLoginSuccess} />;

  const isAdmin = currentUser.role === 'admin';
  const isDriver = currentUser.role === 'driver';

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout} />
      
      {activeTab === 'dashboard' && !isDriver && <Dashboard />}
      {activeTab === 'buses' && isAdmin && <Buses />}
      {activeTab === 'routes' && isAdmin && <RoutesStops />}
      {activeTab === 'schedules' && <Schedules isAdmin={isAdmin} />}
      {activeTab === 'drivers' && isAdmin && <Drivers />}
      {activeTab === 'students' && isAdmin && <Students />}
      {activeTab === 'bus-reports' && isAdmin && <BusReports />}
      {activeTab === 'student' && currentUser.role === 'student' && <StudentPortal />}
      {activeTab === 'driver' && isDriver && <DriverPortal />}
      <footer className="footer">Smart College Bus Management System · Campus transit and student seat booking</footer>
    </div>
  );
}