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

export function App() {
  const [activeTab, setActiveTab] = useState('auction');
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

  // Direct Reactive Convex Queries (Zero Polling, Zero Websocket Handshake 404s!)
  const gameState = useQuery(api.auction.getAuctionState, { key: 'current_game' });
  const teams = useQuery(api.auction.getTeams);

  // Auto-sync current logged in team with reactive teams state from Convex
  useEffect(() => {
    if (currentTeam && teams && teams[currentTeam.id]) {
      setCurrentTeam(teams[currentTeam.id]);
    }
  }, [teams]);

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('teamPin');
      if (savedPin && teams) {
        const match = Object.values(teams).find((t) => t.password === savedPin);
        if (match) setCurrentTeam(match);
      }
      const savedAdmin = localStorage.getItem('isAdminAuth');
      if (savedAdmin === 'true') {
        setIsAdmin(true);
      }
    } catch (e) {}
  }, [teams]);

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
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('isAdminAuth');
    showToast('Exited Admin Mode', 'info');
    setActiveTab('auction');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTeam={currentTeam}
        onLogout={handleLogout}
        onOpenLogin={() => setIsTeamLoginOpen(true)}
        onOpenRegister={() => setIsRegModalOpen(true)}
        isAdmin={isAdmin}
        onOpenAdminLogin={() => {
          if (isAdmin) {
            setActiveTab('admin');
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
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminSuccess}
        showToast={showToast}
      />

      {/* Global Toast System */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
export default App;
