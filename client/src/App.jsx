import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/TopNav';
import Dashboard from './pages/Dashboard';
import Overview from './pages/Overview';
import ApiManagement from './pages/ApiManagement';
import BlockedIps from './pages/BlockedIps';
import ThreatAnalysis from './pages/ThreatAnalysis';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-frame">
        <TopNav />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/api-management" element={<ApiManagement />} />
            <Route path="/blocked-ips" element={<BlockedIps />} />
            <Route path="/threat-analysis" element={<ThreatAnalysis />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
