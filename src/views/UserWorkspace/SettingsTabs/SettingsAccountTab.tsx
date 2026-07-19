import React from 'react';
import { CheckCircle, AlertTriangle, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import PasswordInput from '../../../components/PasswordInput';

export function SettingsAccountTab({
  profileMsg,
  profileError,
  handleSaveProfile,
  avatarPreview,
  avatarUrl,
  avatarColor,
  getAvatarClass,
  displayName,
  bio,
  loungesCount,
  connectionsCount,
  currentUsername,
  currentUserRole,
  email,
  setEmail,
  phone,
  setPhone,
  setDisplayName,
  setBio,
  handleFileChange,
  handleDeleteAvatar
}: any) {
  // We'll just return the form contents here
  return (
    <form onSubmit={handleSaveProfile} className="w-full max-w-4xl space-y-8">
      {profileMsg && (
        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{profileMsg}</span>
        </div>
      )}
      {profileError && (
        <div className="p-3.5 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{profileError}</span>
        </div>
      )}
      
      <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Account</h3>
      
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Side: Live Glassmorphic Profile Preview Card */}
        <div className="w-full lg:w-72 shrink-0 bg-velum-800/80 backdrop-blur-md border border-white-10 rounded-2xl overflow-hidden shadow-2xl p-5 relative font-sans text-white">
          <div className="absolute top-3 right-3 flex gap-1">
            <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[8px] font-mono font-bold uppercase rounded-md">Live Preview</span>
          </div>
          
          <div className="flex flex-col items-center text-center mt-3">
            <div className="relative group mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent/40 bg-white-5 flex items-center justify-center font-bold text-white text-lg">
                {avatarPreview || (avatarColor === 'custom' && avatarUrl) ? (
                  <img 
                    src={avatarPreview || avatarUrl} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-xl font-mono font-bold uppercase ${getAvatarClass(avatarColor)}`}>
                    {displayName.slice(0, 1) || 'P'}
                  </div>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                <Upload className="w-6 h-6 text-white" />
              </label>
              {(avatarPreview || (avatarColor === 'custom' && avatarUrl)) && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition border border-velum-800 shadow-md cursor-pointer z-10 flex items-center justify-center"
                  title="Delete avatar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <h4 className="text-lg font-bold leading-tight flex items-center gap-1">
              {displayName}
            </h4>
            <span className="text-xs text-text-secondary font-mono mt-0.5">
              {currentUsername}
            </span>
            {currentUserRole && (
              <div className="mt-2.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-accent/20 text-accent bg-accent/5 inline-block">
                {currentUserRole.replace('_', ' ')}
              </div>
            )}
          </div>
          
          <div className="mt-5 space-y-3">
            <div>
              <div className="text-[10px] font-bold text-text-disabled uppercase font-mono mb-1">Status / Bio</div>
              <p className="text-xs leading-relaxed text-text-secondary italic">
                {bio || "No status set."}
              </p>
            </div>
          </div>
          
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white-10 pt-4">
            <div className="text-center p-2 rounded-xl bg-white-5">
              <div className="text-lg font-black text-white">{loungesCount}</div>
              <div className="text-[9px] font-mono uppercase text-text-disabled mt-0.5">Lounges</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-white-5">
              <div className="text-lg font-black text-white">{connectionsCount}</div>
              <div className="text-[9px] font-mono uppercase text-text-disabled mt-0.5">Connects</div>
            </div>
          </div>
        </div>

        {/* Right Side: Form Inputs */}
        <div className="flex-1 w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-disabled font-mono">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 outline-none transition"
                placeholder="How others see you"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-disabled font-mono">Status Bio</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 outline-none transition"
                placeholder="A short intro..."
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-disabled font-mono">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 outline-none transition"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-disabled font-mono">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 outline-none transition"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-black px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center justify-center shadow-lg"
            >
              Save Profile Profile
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
