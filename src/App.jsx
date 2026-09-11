import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { AuctionStage } from './components/AuctionStage';
import { AdminPanel } from './components/AdminPanel';
import { CircuitSimulator } from './components/CircuitSimulator';
import { LeaderboardView } from './components/LeaderboardView';
import { RegistrationModal } from './components/RegistrationModal';
import { TeamLoginModal } from './components/TeamLoginModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { Toast } from './components/Toast';

function getTabFromUrl() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes('admin') || hash.includes('admin')) return 'admin';
  if (path.includes('simulator') || hash.includes('simulator')) return 'simulator';
  if (path.includes('team') || path.includes('lobby') || hash.includes('team') || hash.includes('lobby')) return 'teams';
  if (path.includes('leaderboard') || path.includes('standing') || hash.includes('leaderboard')) return 'leaderboard';
  return 'auction';
}

export function App() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl());
  const [currentTeam, setCurrentTeam] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('aiml');

  // Modals
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isTeamLoginOpen, setIsTeamLoginOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Direct Reactive Convex Queries
  const gameState = useQuery(api.auction.getAuctionState, { key: 'current_game' });
  const teams = useQuery(api.auction.getTeams);

  // Auto-sync current logged in team with reactive teams state from Convex
  useEffect(() => {
    if (currentTeam && teams && teams[currentTeam.id]) {
      setCurrentTeam(teams[currentTeam.id]);
    }
  }, [teams]);

  // Load session from localStorage on mount and sync URL routing
  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('teamPin');
      if (savedPin && teams) {
        const match = Object.values(teams).find((t) => t.password === savedPin);
        if (match) setCurrentTeam(match);
      }
      const savedAdmin = localStorage.getItem('isAdminAuth');
      const isAdminSaved = savedAdmin === 'true';
      if (isAdminSaved) {
        setIsAdmin(true);
      }

      // Check initial URL
      const initialTab = getTabFromUrl();
      if (initialTab === 'admin') {
        if (!isAdminSaved) {
          setIsAdminLoginOpen(true);
        } else {
          setActiveTab('admin');
        }
      } else {
        setActiveTab(initialTab);
      }
    } catch (e) {}
  }, [teams]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const newTab = getTabFromUrl();
      if (newTab === 'admin' && !isAdmin && localStorage.getItem('isAdminAuth') !== 'true') {
        setIsAdminLoginOpen(true);
      } else {
        setActiveTab(newTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [isAdmin]);

  const changeTab = (tab) => {
    if (tab === 'admin' && !isAdmin) {
      setIsAdminLoginOpen(true);
      return;
    }

    setActiveTab(tab);
    const targetPath = tab === 'auction' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleLoginSuccess = (team) => {
    setCurrentTeam(team);
    localStorage.setItem('teamPin', team.password);
  };

  const handleLogout = () => {
    setCurrentTeam(null);
    localStorage.removeItem('teamPin');
    showToast('Logged out of team seat', 'info');
  };

  const handleAdminSuccess = () => {
    setIsAdmin(true);
    setAdminPass('aiml');
    localStorage.setItem('isAdminAuth', 'true');
    setActiveTab('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('isAdminAuth');
    showToast('Exited Admin Mode', 'info');
    changeTab('auction');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={changeTab}
        currentTeam={currentTeam}
        onLogout={handleLogout}
        onOpenLogin={() => setIsTeamLoginOpen(true)}
        onOpenRegister={() => setIsRegModalOpen(true)}
        isAdmin={isAdmin}
        onOpenAdminLogin={() => {
          if (isAdmin) {
            changeTab('admin');
          } else {
            setIsAdminLoginOpen(true);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'auction' && (
          <AuctionStage
            gameState={gameState}
            teams={teams}
            currentTeam={currentTeam}
            showToast={showToast}
            onOpenLogin={() => setIsTeamLoginOpen(true)}
            onOpenRegister={() => setIsRegModalOpen(true)}
          />
        )}

        {activeTab === 'teams' && (
          <LobbyView
            teams={teams}
            currentTeam={currentTeam}
            onOpenRegister={() => setIsRegModalOpen(true)}
            onOpenLogin={() => setIsTeamLoginOpen(true)}
            onSelectTeam={(team) => handleLoginSuccess(team)}
          />
        )}

        {activeTab === 'simulator' && (
          <CircuitSimulator
            currentTeam={currentTeam}
            showToast={showToast}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            teams={teams}
            soldHistory={gameState?.soldHistory || []}
            unsoldPlayers={gameState?.unsoldPlayers || []}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            gameState={gameState}
            teams={teams}
            adminPass={adminPass}
            onLogoutAdmin={handleAdminLogout}
            showToast={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <RegistrationModal
        isOpen={isRegModalOpen}
        onClose={() => setIsRegModalOpen(false)}
        onSuccess={handleLoginSuccess}
        showToast={showToast}
      />

      <TeamLoginModal
        isOpen={isTeamLoginOpen}
        onClose={() => setIsTeamLoginOpen(false)}
        teams={teams}
        onSuccess={handleLoginSuccess}
        showToast={showToast}
      />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => {
          setIsAdminLoginOpen(false);
          if (activeTab === 'admin' && !isAdmin) {
            changeTab('auction');
          }
        }}
        onSuccess={handleAdminSuccess}
        showToast={showToast}
      />

      {/* Global Toast System */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
export default App;
