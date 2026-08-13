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
  handleDeleteAvatar,
  bannerPreview,
  bannerUrl,
  bannerColor,
  getBannerClass,
  handleBannerFileChange
}: any) {
  // We'll just return the form contents here
   return (
    <form onSubmit={handleSaveProfile} className="w-full max-w-4xl space-y-6">
      {profileMsg && (
        <div className="p-3.5 bg-status-online-bg text-status-online rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{profileMsg}</span>
        </div>
      )}
      {profileError && (
        <div className="p-3.5 bg-status-dnd-bg text-status-dnd rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{profileError}</span>
        </div>
      )}

      <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
        Account Settings
      </h3>

           {/* Profile Header with Banner */}
      <div className="relative rounded-2xl bg-velum-800 border border-white/10 overflow-hidden shadow-xl mb-6">
             {/* Banner Area (Theme-derived gradient or custom image) */}
      <div 
        className={`h-24 relative ${(!bannerPreview && (!bannerColor || bannerColor === 'charcoal' || bannerColor === 'custom')) ? 'bg-gradient-to-r from-accent/30 via-accent/10 to-transparent' : getBannerClass(bannerColor)}`}
        style={
          (bannerPreview || (bannerColor === 'custom' && bannerUrl))
            ? { backgroundImage: `url(${bannerPreview || bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}
        }
      >
        <label className="absolute top-3 right-3 px-2.5 py-1 bg-velum-800/80 hover:bg-velum-750 text-[10px] font-mono text-text-primary rounded-md backdrop-blur-[var(--blur-backdrop-md)] border border-velum-700 cursor-pointer transition">
          Change Banner
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleBannerFileChange} 
          />
        </label>
      </div>

      

        {/* Profile Details Bar */}
        <div className="px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
          <div className="flex items-end gap-4">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-velum-800 bg-velum-750 flex items-center justify-center font-bold text-2xl text-accent overflow-hidden shadow-2xl">
                {avatarPreview || (avatarColor === 'custom' && avatarUrl) ? (
                  <img src={avatarPreview || avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName.slice(0, 1).toUpperCase() || 'U'
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Upload className="w-5 h-5 text-text-primary" />
              </label>
            </div>
            <div className="mb-1">
              <h4 className="text-lg font-bold text-text-primary leading-none">{displayName || 'User'}</h4>
              <p className="text-xs font-mono text-text-secondary mt-1">@{currentUsername || 'username'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Fields Stacked */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full glass-input"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-2">
            Status Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write a short bio..."
            className="w-full glass-input resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent-hover text-velum-900 font-bold text-xs uppercase tracking-wider rounded-xl transition"
      >
        Save Profile
      </button>
    </form>
  );
}
