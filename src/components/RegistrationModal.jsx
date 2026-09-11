import React, { useState } from 'react';
import { X, Upload, Users, ShieldAlert, Sparkles } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function RegistrationModal({ isOpen, onClose, onSuccess, showToast }) {
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

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size should be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogo(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
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
        showToast(`🎉 Team ${cleanName} registered! Awaiting Admin approval.`, 'success');
        onSuccess(res.team);
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-500/10 text-slate-100 my-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-100 transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <h2 className="font-bebas text-2xl tracking-wider text-emerald-400">
            REGISTER NEW PARTICIPANT TEAM
          </h2>
        </div>
        <p className="text-xs text-slate-400 font-rajdhani mb-5">
          Join the Logic Circuit Auction • Starting budget: <strong>500 Points</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300 mb-1">
              Team Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quantum Gates"
              maxLength={30}
              required
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-rajdhani"
            />
          </div>

          {/* Logo Upload / URL */}
          <div>
            <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300 mb-1">
              Team Logo / Avatar (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-rajdhani font-bold text-slate-200 border border-slate-700 transition-colors shrink-0">
                <Upload className="h-3.5 w-3.5 text-cyan-400" />
                <span>Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="or paste image URL"
                className="flex-1 rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
              {logo && (
                <img
                  src={logo}
                  alt="Preview"
                  className="h-8 w-8 rounded-full object-cover border border-cyan-400 shrink-0"
                />
              )}
            </div>
          </div>

          {/* Members (Max 5) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300">
                Team Members (Leader + Up to 4 Members)
              </label>
              <span className="text-[10px] text-slate-400 font-rajdhani">Max 5 total</span>
            </div>
            
            <input
              type="text"
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
              placeholder="Member 1 (Leader Name) *"
              maxLength={30}
              required
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 mb-2 focus:border-cyan-400 focus:outline-none font-rajdhani"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={member2}
                onChange={(e) => setMember2(e.target.value)}
                placeholder="Member 2 (Optional)"
                maxLength={30}
                className="rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
              <input
                type="text"
                value={member3}
                onChange={(e) => setMember3(e.target.value)}
                placeholder="Member 3 (Optional)"
                maxLength={30}
                className="rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
              <input
                type="text"
                value={member4}
                onChange={(e) => setMember4(e.target.value)}
                placeholder="Member 4 (Optional)"
                maxLength={30}
                className="rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
              <input
                type="text"
                value={member5}
                onChange={(e) => setMember5(e.target.value)}
                placeholder="Member 5 (Optional)"
                maxLength={30}
                className="rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-rajdhani"
              />
            </div>
          </div>

          {/* Passcode PIN */}
          <div>
            <label className="block text-xs font-mono-code font-bold uppercase tracking-wider text-cyan-300 mb-1">
              Create Team Login PIN / Passcode *
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. gate2026"
              maxLength={20}
              required
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono-code"
            />
          </div>

          {/* Verification Notice */}
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 p-3 text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs font-rajdhani leading-relaxed">
              <strong>Admin Approval Required:</strong> Your team will start with <strong>500 Points</strong>, but bidding will be unlocked once the Administrator verifies your team in the Admin Dashboard.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 py-3 text-sm font-rajdhani font-bold text-slate-950 tracking-wider shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
          >
            {loading ? 'REGISTERING TEAM...' : 'CONFIRM REGISTRATION (500 PTS)'}
          </button>
        </form>
      </div>
    </div>
  );
}
