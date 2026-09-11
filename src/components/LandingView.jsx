import React, { useState } from 'react';
import { Zap, KeyRound, UserPlus, Upload, Sparkles, ShieldAlert, Cpu, ArrowRight, Lock } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function LandingView({ teams, onLoginSuccess, onOpenSimulator, onSecretAdminTrigger, showToast }) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'register'

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

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      showToast('Please enter your team passcode PIN', 'error');
      return;
    }

    const teamList = Object.values(teams || {});
    const match = teamList.find((t) => t.password === cleanPin);

    if (match) {
      showToast(`⚡ Welcome, ${match.name}! Entering Waiting Room...`, 'success');
      onLoginSuccess(match);
    } else {
      showToast('Invalid passcode PIN. If you haven\'t registered yet, click "Register New Team" below.', 'error');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogo(event.target?.result || '');
    };
    reader.readAsDataURL(file);
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
    <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-10 sm:px-6">
      {/* Electrifying Glow Backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl text-center space-y-6">
        {/* Title & Brand */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-1 text-xs font-mono-code text-cyan-300 shadow-sm shadow-cyan-500/20">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>53 Logic Components • 500 Pts Budget</span>
          </div>

          <h1 className="font-bebas text-5xl sm:text-7xl tracking-wider text-slate-100 leading-none glow-text-cyan">
            LOGIC CIRCUIT <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-300">AUCTION</span>
          </h1>

          <p className="text-sm font-rajdhani text-slate-300 max-w-md mx-auto">
            Real-Time Hardware Bidding & 60Hz Interactive Circuit Simulation Platform
          </p>
        </div>

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
                    placeholder="Enter your passcode PIN (e.g. gate101)"
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
                <span>ENTER AUCTION WAITING ROOM</span>
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
                <span>Starts with <strong>500 Points</strong>. Bidding unlocks once approved by Host.</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 py-3 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'REGISTERING TEAM...' : 'CONFIRM REGISTRATION (500 PTS)'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* Bottom Utility Links */}
        <div className="flex items-center justify-center gap-4 text-xs font-rajdhani text-slate-400">
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/40 px-3.5 py-1.5 text-purple-300 font-bold transition-all"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>🧪 Open Logic Circuit Simulator</span>
          </button>

          {/* Discrete subtle admin trigger */}
          <button
            onClick={onSecretAdminTrigger}
            className="opacity-20 hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-amber-400"
            title="Admin Console"
          >
            <Lock className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
