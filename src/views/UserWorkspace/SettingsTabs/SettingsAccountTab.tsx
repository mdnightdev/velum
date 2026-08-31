import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import PasswordInput from '../../../components/PasswordInput';
import { resolveMediaUrl } from '../../../utils/mediaPipeline';

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
  handleDeleteBanner,
  bannerPreview,
  bannerUrl,
  bannerColor,
  getBannerClass,
  handleBannerFileChange
}: any) {
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [bannerLoadError, setBannerLoadError] = useState(false);

  const rawAvatarSrc = avatarPreview || avatarUrl || (avatarColor === 'custom' ? avatarUrl : null);
  const resolvedAvatarSrc = rawAvatarSrc ? resolveMediaUrl(rawAvatarSrc) : null;

  const rawBannerSrc = bannerPreview || bannerUrl || (bannerColor === 'custom' ? bannerUrl : null);
  const resolvedBannerSrc = rawBannerSrc ? resolveMediaUrl(rawBannerSrc) : null;

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
          className={`h-28 relative ${(!resolvedBannerSrc || bannerLoadError) ? 'bg-gradient-to-r from-accent/30 via-accent/10 to-transparent' : getBannerClass(bannerColor)}`}
          style={
            (resolvedBannerSrc && !bannerLoadError)
              ? { backgroundImage: `url(${resolvedBannerSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {}
          }
        >
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {resolvedBannerSrc && !bannerLoadError && (
              <button
                type="button"
                onClick={handleDeleteBanner || handleDeleteAvatar}
                className="w-8 h-8 rounded-lg bg-velum-900/70 hover:bg-velum-800 text-text-secondary hover:text-text-primary border border-velum-600/60 backdrop-blur-md flex items-center justify-center transition cursor-pointer"
                title="Remove Banner"
                aria-label="Remove Banner"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <label 
              className="w-8 h-8 rounded-lg bg-velum-900/70 hover:bg-velum-800 text-text-secondary hover:text-text-primary border border-velum-600/60 backdrop-blur-md flex items-center justify-center transition cursor-pointer"
              title="Change Banner"
              aria-label="Change Banner"
            >
              <Upload className="w-4 h-4" />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  setBannerLoadError(false);
                  handleBannerFileChange(e);
                }} 
              />
            </label>
          </div>
        </div>

        {/* Profile Details Bar */}
        <div className="px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
          <div className="flex items-end gap-4">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-velum-800 bg-velum-750 flex items-center justify-center font-bold text-2xl text-accent overflow-hidden shadow-2xl">
                {resolvedAvatarSrc && !avatarLoadError ? (
                  <img 
                    src={resolvedAvatarSrc} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  (displayName ? displayName.slice(0, 1).toUpperCase() : '') || (currentUsername ? currentUsername.slice(0, 1).toUpperCase() : 'U')
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    setAvatarLoadError(false);
                    handleFileChange(e);
                  }} 
                />
                <Upload className="w-5 h-5 text-text-primary" />
              </label>
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-text-primary leading-none">{displayName}</h4>
                {resolvedAvatarSrc && !avatarLoadError && (
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    className="w-7 h-7 rounded-lg bg-velum-750 hover:bg-velum-700 text-text-secondary hover:text-text-primary border border-velum-600/50 flex items-center justify-center transition cursor-pointer"
                    title="Remove Avatar"
                    aria-label="Remove Avatar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs font-mono text-text-secondary mt-1">{currentUsername ? `@${currentUsername}` : ''}</p>
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
            className="w-full glass-input resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent-hover text-velum-900 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
      >
        Save Profile
      </button>
    </form>
  );
}

