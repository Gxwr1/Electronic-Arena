import React, { useState } from 'react';
import { KeyRound, UserPlus, Upload, Sparkles, ShieldAlert, ArrowRight, Users, CheckCircle2, Clock } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { processImageUpload } from '../utils/imageHelper';

export function LandingView({ teams, onLoginSuccess, showToast }) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'register'
  const [showTeamsModal, setShowTeamsModal] = useState(false);

  // Code entry state
  const [pin, setPin] = useState('');

  // Register form state
  const [name, setName] = useState('');
  const [leader, setLeader] = useState('');
  const [member2, setMember2] = useState('');
  const [member3, setMember3] = useState('');
  const [member4, setMember4] = useState('');
  const [member5, setMember5] = useState('');
  const [logo, setLogo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const registerTeamMutation = useMutation(api.auction.registerTeam);
  const teamList = Object.values(teams || {});

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      showToast('Please enter your team passcode PIN', 'error');
      return;
    }

    const match = teamList.find((t) => t.password === cleanPin);

    if (match) {
      showToast(`⚡ Welcome, ${match.name}! Entering Waiting Room...`, 'success');
      onLoginSuccess(match);
    } else {
      showToast('Invalid passcode PIN. If you haven\'t registered yet, click "Register New Team" below.', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Processing logo image...', 'info');
      const dataUrl = await processImageUpload(file, 25);
      setLogo(dataUrl);
      showToast('Logo image loaded successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Image processing failed', 'error');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPass = password.trim();
    const cleanLeader = leader.trim() || cleanName;

    if (!cleanName) {
      showToast('Please enter a team name', 'error');
      return;
    }
    if (!cleanPass) {
      showToast('Please create a passcode / PIN', 'error');
      return;
    }

    const members = [cleanLeader];
    if (member2.trim()) members.push(member2.trim());
    if (member3.trim()) members.push(member3.trim());
    if (member4.trim()) members.push(member4.trim());
    if (member5.trim()) members.push(member5.trim());

    setLoading(true);
    try {
      const res = await registerTeamMutation({
        name: cleanName,
        leader: cleanLeader,
        members,
        logo,
        password: cleanPass,
      });

      if (res && res.success) {
        showToast(`🎉 Team ${cleanName} registered! Entering Waiting Room...`, 'success');
        onLoginSuccess(res.team);
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-[calc(100vh-4.5rem)] flex-col items-center justify-center px-4 py-8 sm:px-6">
      {/* Electrifying Glow Backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl text-center space-y-6">
        {/* Title & Brand */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-1 text-xs font-mono-code text-cyan-300 shadow-sm shadow-cyan-500/20">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>53 Logic Components • 250 Pts Starting Budget</span>
          </div>

          <h1 className="font-bebas text-5xl sm:text-7xl tracking-wider text-slate-100 leading-none glow-text-cyan">
            LOGIC CIRCUIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-300">AUCTION</span>
          </h1>

          <p className="text-sm font-rajdhani text-slate-300 max-w-md mx-auto">
            Real-Time Hardware Bidding Arena
          </p>
        </div>

        {/* Registered Teams Ticker / Button */}
        {teamList.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setShowTeamsModal(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-cyan-500/40 px-4 py-2 text-xs font-rajdhani font-bold text-cyan-300 shadow-lg shadow-cyan-500/10 transition-all group"
            >
              <Users className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Registered Teams ({teamList.length}) — View Roster & Logos</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>
          </div>
        )}

        {/* Action Card: Code Entry or Registration */}
        <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 text-left">
          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'code'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>ENTER TEAM CODE</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-rajdhani font-bold transition-all ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>REGISTER NEW TEAM</span>
            </button>
          </div>

          {/* TAB 1: ENTER CODE */}
          {activeTab === 'code' && (
            <form onSubmit={handleCodeSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300 mb-2">
                  Team Passcode PIN
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter your passcode PIN (e.g. logic101)"
                    maxLength={25}
                    autoFocus
                    required
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3.5 text-base text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono-code shadow-inner"
                  />
                  <KeyRound className="absolute right-4 top-3.5 h-5 w-5 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-3.5 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-cyan-500/25 transition-all"
              >
                <span>ENTER PREVIEW & WAITING ROOM</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER NEW TEAM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-emerald-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Quantum Gates"
                  maxLength={30}
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                />
              </div>

              {/* Logo */}
              <div>
                <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-emerald-300 mb-1">
                  Team Logo / Avatar (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-rajdhani font-bold text-slate-200 border border-slate-700 transition-colors shrink-0">
                    <Upload className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Upload Logo</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <input
                    type="text"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="or paste image URL"
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                  />
                  {logo && (
                    <img src={logo} alt="Preview" className="h-8 w-8 rounded-full object-cover border border-emerald-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-emerald-300">
                    Team Members (Max 5 total)
                  </label>
                  <span className="text-[10px] text-slate-400 font-rajdhani">1 Leader + up to 4 members</span>
                </div>
                <input
                  type="text"
                  value={leader}
                  onChange={(e) => setLeader(e.target.value)}
                  placeholder="Member 1 (Leader Name) *"
                  maxLength={30}
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 mb-2 focus:border-emerald-400 focus:outline-none font-rajdhani"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={member2}
                    onChange={(e) => setMember2(e.target.value)}
                    placeholder="Member 2 (Optional)"
                    maxLength={30}
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                  />
                  <input
                    type="text"
                    value={member3}
                    onChange={(e) => setMember3(e.target.value)}
                    placeholder="Member 3 (Optional)"
                    maxLength={30}
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                  />
                  <input
                    type="text"
                    value={member4}
                    onChange={(e) => setMember4(e.target.value)}
                    placeholder="Member 4 (Optional)"
                    maxLength={30}
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                  />
                  <input
                    type="text"
                    value={member5}
                    onChange={(e) => setMember5(e.target.value)}
                    placeholder="Member 5 (Optional)"
                    maxLength={30}
                    className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-rajdhani"
                  />
                </div>
              </div>

              {/* Passcode */}
              <div>
                <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-emerald-300 mb-1">
                  Create Passcode PIN *
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. logic101"
                  maxLength={20}
                  required
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none font-mono-code"
                />
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2 rounded-xl bg-amber-950/30 border border-amber-500/30 p-2.5 text-amber-300 text-xs font-rajdhani leading-snug">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Starts with <strong>250 Points</strong>. Bidding unlocks once verified by Host.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 py-3 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'REGISTERING TEAM...' : 'CONFIRM REGISTRATION (250 PTS)'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Pop-up Modal for Registered Teams */}
      {showTeamsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl text-slate-100 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bebas text-2xl text-slate-100 tracking-wider">REGISTERED TEAMS ARENA</h3>
                  <p className="text-xs font-rajdhani text-slate-400">
                    {teamList.length} Teams Ready • 500 Starting Points Budget
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTeamsModal(false)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-rajdhani font-bold text-slate-300 transition-colors"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {teamList.map((team, idx) => {
                const members = team.members || [team.leader || 'Leader'];
                const isApproved = Boolean(team.verified);

                return (
                  <div
                    key={team.id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-10 w-10 rounded-full object-cover border border-cyan-500/40" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-lg">
                          {team.icon || '⚡'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-rajdhani font-bold text-base text-slate-100">{team.name}</h4>
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-rajdhani font-bold text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Approved</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-rajdhani font-bold text-amber-400 border border-amber-500/30">
                              <Clock className="h-3 w-3" />
                              <span>Awaiting Approval</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-rajdhani">
                          Leader: <strong className="text-slate-200">{team.leader || members[0]}</strong> • 
                          Roster: <span className="text-slate-300">{members.join(', ')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono-code font-bold text-sm text-emerald-400">{team.budget} pts</div>
                      <div className="text-[10px] font-mono-code text-slate-400">PIN Registered</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
