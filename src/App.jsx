import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { ElectricBackground } from './components/ElectricBackground';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { PreviewRoom } from './components/PreviewRoom';
import { AuctionStage } from './components/AuctionStage';
import { AdminPanel } from './components/AdminPanel';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { SoldCelebrationModal } from './components/SoldCelebrationModal';
import { Toast } from './components/Toast';

function getTabFromUrl() {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes('admin') || hash.includes('admin')) return 'admin';
  if (path.includes('leaderboard') || path.includes('standing') || hash.includes('leaderboard')) return 'leaderboard';
  return 'landing';
}

export function App() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl());
  const [currentTeam, setCurrentTeam] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('aiml');

  // Modals
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
      const updated = teams[currentTeam.id];
      if (updated.verified && !currentTeam.verified) {
        showToast('🎉 Your team was APPROVED by the Host! Bidding is unlocked.', 'success');
      }
      setCurrentTeam(updated);
    }
  }, [teams]);

  // Load session from localStorage on mount & handle URL routing
  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('teamPin');
      if (savedPin && teams) {
        const match = Object.values(teams).find((t) => t.password === savedPin);
        if (match) {
          setCurrentTeam(match);
          if (activeTab === 'landing') {
            setActiveTab('preview');
          }
        }
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
      } else if (initialTab !== 'landing') {
        setActiveTab(initialTab);
      }
    } catch (e) {}
  }, [teams]);

  // Secret Admin Keybind (Ctrl + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isAdmin) {
          changeTab('admin');
        } else {
          setIsAdminLoginOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Auto-transition participants when Host changes auction phases
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;

    if (phase === 'auction') {
      if (activeTab === 'preview' || activeTab === 'landing') {
        showToast('⚡ The Live Auction has STARTED! Spotlight on stage.', 'info');
        changeTab('auction');
      }
    } else if (phase === 'paused') {
      // Pause keeps players on auction stage
      if (activeTab !== 'admin' && activeTab !== 'auction') {
        changeTab('auction');
      }
    } else if (phase === 'finished') {
      if (activeTab === 'auction' || activeTab === 'preview') {
        showToast('🏁 The Auction has concluded! Showing final evaluation results.', 'info');
        changeTab('leaderboard');
      }
    } else if (phase === 'lobby') {
      if (activeTab === 'auction' || activeTab === 'leaderboard') {
        showToast('🔄 Host reset stage to Lobby.', 'info');
        changeTab(currentTeam ? 'preview' : 'landing');
      }
    }
  }, [gameState?.phase]);

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
    const targetPath = tab === 'landing' || tab === 'preview' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const handleLoginSuccess = (team) => {
    setCurrentTeam(team);
    localStorage.setItem('teamPin', team.password);
    changeTab('preview');
  };

  const handleLogout = () => {
    setCurrentTeam(null);
    localStorage.removeItem('teamPin');
    showToast('Left team seat. Returned to landing.', 'info');
    changeTab('landing');
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
    showToast('Exited Admin Console', 'info');
    changeTab('landing');
  };

  return (
    <div className="relative h-screen w-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* 60fps Electric PCB Background Animation */}
      <ElectricBackground />

      {/* Real-time Global Sold Celebration Overlay (Shown for participants, suppressed in Admin console) */}
      {activeTab !== 'admin' && (
        <SoldCelebrationModal lastSoldEvent={gameState?.lastSoldEvent} currentTeam={currentTeam} />
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={changeTab}
        currentTeam={currentTeam}
        onLogout={handleLogout}
        isAdmin={isAdmin}
      />

      {/* Main App Screens Container (Fixed viewport height) */}
      <main className="flex-1 min-h-0 relative z-10 overflow-y-auto">
        {/* 1. Landing Screen (Code Entry & Register only, Clean & Electrifying) */}
        {activeTab === 'landing' && (
          <LandingView
            teams={teams}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
          />
        )}

        {/* 2. Fixed Preview & Waiting Room Screen */}
        {activeTab === 'preview' && currentTeam && (
          <PreviewRoom
            currentTeam={currentTeam}
            onLogout={handleLogout}
          />
        )}

        {/* 3. Live Auction Stage (Fixed Desktop Non-Scrollable Layout) */}
        {activeTab === 'auction' && (
          <AuctionStage
            gameState={gameState}
            teams={teams}
            currentTeam={currentTeam}
            showToast={showToast}
            onOpenLogin={() => changeTab('landing')}
          />
        )}

        {/* 4. Standings & Detailed Team Inventory Data Evaluation */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            teams={teams}
            soldHistory={gameState?.soldHistory || []}
            unsoldPlayers={gameState?.unsoldPlayers || []}
          />
        )}

        {/* 5. Admin Control Console (Accessible via /admin or Ctrl+Shift+A) */}
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

      {/* Hidden Master Admin Login Modal (Password: aiml) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => {
          setIsAdminLoginOpen(false);
          if (activeTab === 'admin' && !isAdmin) {
            changeTab('landing');
          }
        }}
        onSuccess={handleAdminSuccess}
        showToast={showToast}
      />

      {/* Floating Notifications */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
export default App;
