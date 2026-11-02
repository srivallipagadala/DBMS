import { useEffect, useState } from 'react';
import { Shield, Bus, MapPin, Calendar, Users, UserCheck, LogOut, GraduationCap, ClipboardList, Menu, X } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const tabs = currentUser?.role === 'admin'
    ? [
      { id: 'dashboard', label: 'Dashboard', icon: Shield },
      { id: 'buses', label: 'Buses', icon: Bus },
      { id: 'routes', label: 'Routes', icon: MapPin },
      { id: 'schedules', label: 'Schedules', icon: Calendar },
      { id: 'drivers', label: 'Drivers', icon: Users },
      { id: 'students', label: 'Students', icon: GraduationCap },
      { id: 'bus-reports', label: 'Bus reports', icon: ClipboardList },
    ]
    : currentUser?.role === 'driver'
      ? [{ id: 'driver', label: 'Driver Portal', icon: Bus }]
      : [
      { id: 'dashboard', label: 'Dashboard', icon: Shield },
      { id: 'schedules', label: 'Schedules', icon: Calendar },
      { id: 'student', label: 'Student Portal', icon: UserCheck },
    ];

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <header className="navbar">
        <button
          type="button"
          className="nav-menu-toggle"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          aria-controls="app-navigation"
          onClick={() => setIsOpen(open => !open)}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      <div className="nav-brand">
        <Bus size={24} />
        <span>SmartBus <small style={{ display: 'block', color: '#a5b4fc', fontSize: 10, fontWeight: 600, letterSpacing: '.04em' }}>COLLEGE TRANSIT SYSTEM</small></span>
      </div>
      </header>
      {isOpen && <button className="nav-backdrop" aria-label="Close navigation menu" onClick={() => setIsOpen(false)} />}
      <nav id="app-navigation" className={`nav-sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="nav-sidebar-heading">
          <strong>Navigation</strong>
          <button type="button" className="nav-close" aria-label="Close navigation menu" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="nav-links">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-btn ${activeTab === id ? 'active' : ''}`} onClick={() => { setActiveTab(id); setIsOpen(false); }}>
            <Icon size={18} /> {label}
          </button>
        ))}
        
        {currentUser && onLogout && (
          <div className="nav-account">
            <span>Hi, <strong>{currentUser.full_name}</strong></span>
            <button onClick={() => { setIsOpen(false); onLogout(); }} className="nav-btn"><LogOut size={16} /> Logout</button>
          </div>
        )}
      </div>
      </nav>
    </>
  );
}