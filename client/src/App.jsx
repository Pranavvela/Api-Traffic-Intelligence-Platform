import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// 🔥 Force explicit imports (prevents resolution bugs)
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import AnimatedBackground from './components/AnimatedBackground';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Overview from './pages/Overview.jsx';
import ApiManagement from './pages/ApiManagement.jsx';
import BlockedIps from './pages/BlockedIps.jsx';
import ThreatAnalysis from './pages/ThreatAnalysis.jsx';
import Settings from './pages/Settings.jsx';

import { clearToken, isAuthenticated } from './services/auth';

// 🔥 Safety wrapper (prevents crash if component is wrong)
function SafeRender(Component, name) {
  if (!Component || typeof Component !== 'function') {
    console.error(`${name} is not a valid React component`, Component);
    return () => <div style={{ color: 'red' }}>Error loading {name}</div>;
  }
  return Component;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [authed, setAuthed] = React.useState(isAuthenticated());

  function handleOpenSidebar() {
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
  }

  function handleToggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  function handleLogin() {
    setAuthed(true);
  }

  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  // 🔥 Wrap all components safely
  const SafeOverview = SafeRender(Overview, 'Overview');
  const SafeDashboard = SafeRender(Dashboard, 'Dashboard');
  const SafeApiManagement = SafeRender(ApiManagement, 'ApiManagement');
  const SafeBlockedIps = SafeRender(BlockedIps, 'BlockedIps');
  const SafeThreatAnalysis = SafeRender(ThreatAnalysis, 'ThreatAnalysis');
  const SafeSettings = SafeRender(Settings, 'Settings');

  return (
    <BrowserRouter>
      {authed ? (
        <div className="relative min-h-screen bg-slate-950 text-slate-100">
          <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.85),rgba(2,6,23,0.98))]" />
          <AnimatedBackground />

          <div className="relative z-10 flex min-h-screen">
            <Sidebar
              isOpen={sidebarOpen}
              isCollapsed={sidebarCollapsed}
              onClose={handleCloseSidebar}
              onToggleCollapse={handleToggleSidebar}
            />

            <div className="flex min-h-screen flex-1 flex-col">
              <TopBar
                onOpenSidebar={handleOpenSidebar}
                onLogout={handleLogout}
                showLogout
              />

              <div className="flex-1 px-6 py-6">
                <div className="page-fade mx-auto w-full max-w-[1400px]">

                  <Routes>
                    <Route path="/" element={<SafeOverview />} />
                    <Route path="/dashboard" element={<SafeDashboard />} />
                    <Route path="/api-management" element={<SafeApiManagement />} />
                    <Route path="/blocked-ips" element={<SafeBlockedIps />} />
                    <Route path="/threat-analysis" element={<SafeThreatAnalysis />} />
                    <Route path="/settings" element={<SafeSettings />} />

                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>

                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}