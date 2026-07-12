import React, { useState } from 'react';
import { User, Plus, RefreshCw } from 'lucide-react';
import PasswordInput from '../PasswordInput';
import { compressImage } from '../../utils/imageCompressor';

interface AdminProfileProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminProfile: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
  c: any;
}

export default function AdminProfile({
  adminId,
  adminRole,
  user,
  adminProfile,
  adminFetch,
  fetchData,
  c,
}: AdminProfileProps) {
  // Local profile/settings states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');

  // Local rotation states
  const [rotatedUsername, setRotatedUsername] = useState('');
  const [rotatedPassword, setRotatedPassword] = useState('');
  const [rotationResult, setRotationResult] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds the 5MB security threshold.');
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file format. Only JPEG, PNG, and WebP images are permitted.');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAdminAvatar = async () => {
    if (!avatarFile || !avatarPreview) return null;
    setIsUploading(true);
    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      const blob = await compressImage(avatarPreview, 512, 0.85);
      const uploadRes = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sId}`,
          'Content-Type': 'image/jpeg',
        },
        body: blob,
      });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        return data.url;
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setIsUploading(false);
    }
    return null;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus(null);
    setIsUploading(true);

    try {
      let finalAvatar = adminProfile?.avatar || '';
      if (avatarFile && avatarPreview) {
        const uploadedUrl = await uploadAdminAvatar();
        if (uploadedUrl) {
          finalAvatar = uploadedUrl;
        }
      }

      const profileRes = await adminFetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adminId,
          avatar: finalAvatar,
          displayName: user?.username || 'Executive',
          bio: adminProfile?.bio || 'Verified Executive Administrator.',
        }),
      });

      let settingsOk = true;
      if (safeWord.trim() || panicPhrase.trim()) {
        const settingsRes = await adminFetch('/api/admin/update-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            safeWord: safeWord.trim() || undefined,
            panicPhrase: panicPhrase.trim() || undefined,
          }),
        });
        settingsOk = settingsRes.ok;
      }

      if (profileRes.ok && settingsOk) {
        setSettingsStatus(
          'PROFILE SECURED: Identity avatar and security phrase credentials updated successfully.'
        );
        setAvatarFile(null);
        setAvatarPreview(null);
        fetchData();
        setTimeout(() => setSettingsStatus(null), 4000);
      } else {
        alert('Failed to update settings database.');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      alert('Network error while saving profile.');
    } finally {
      setIsUploading(false);
    }
  };

  const rotateExecutiveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setRotationResult(null);
    setRotationError(null);

    if (!rotatedUsername.trim() || !rotatedPassword.trim()) {
      setRotationError('Both username and secret key values are required.');
      return;
    }

    try {
      const res = await adminFetch(`/api/admin/rename-executive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername: rotatedUsername,
          newPassword: rotatedPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRotationResult(
          'CREDENTIAL ROTATION SECURED: Administrative identity modified successfully.'
        );
        setRotatedUsername('');
        setRotatedPassword('');
      } else {
        setRotationError(data.error || 'Identity credentials rotation rejected.');
      }
    } catch (safeErr) {
      setRotationError('Connection lost with credentials daemon.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Admin Identity & Custom Avatar */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-5">
              <User className="w-4.5 h-4.5 text-accent-hover" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Executive Identity
              </h4>
            </div>

            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              {/* Circular Avatar Frame */}
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/40 bg-accent-10 flex items-center justify-center text-accent text-3xl font-black font-mono shadow-lg shadow-accent/10 group-hover:border-accent transition-colors">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : adminProfile?.avatar ? (
                    <img src={adminProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.username || 'AD').substring(0, 2).toUpperCase()
                  )}
                </div>
                {/* Hover upload overlay */}
                <label
                  htmlFor="admin-avatar-input"
                  className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] font-bold text-text-primary uppercase tracking-widest font-mono"
                >
                  <Plus className="w-4 h-4 mb-1 text-accent" />
                  Upload
                </label>
                <input
                  type="file"
                  id="admin-avatar-input"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="text-center space-y-1">
                <span className="text-sm font-extrabold text-text-primary">
                  @{user?.username || 'Executive'}
                </span>
                <span className="text-[10px] text-text-secondary font-mono block">
                  Clearance: {adminRole}
                </span>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    Assigned Identifier
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`ID: ${adminId}`}
                    className={`w-full p-3 rounded-xl font-mono text-text-secondary cursor-not-allowed ${c.bgInput}`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    Clearance Status
                  </label>
                  <input
                    type="text"
                    disabled
                    value={adminRole === 'SUPPORT_ADMIN' ? 'SUPPORT OPERATIONS' : 'EXECUTIVE CONTROLS'}
                    className={`w-full p-3 rounded-xl font-mono text-text-secondary cursor-not-allowed ${c.bgInput}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    Personal Safe Word Key
                  </label>
                  <input
                    type="text"
                    value={safeWord}
                    onChange={(e) => setSafeWord(e.target.value)}
                    placeholder=""
                    className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    Secure Panic Phrase Trigger
                  </label>
                  <input
                    type="text"
                    value={panicPhrase}
                    onChange={(e) => setPanicPhrase(e.target.value)}
                    placeholder=""
                    className={`w-full p-3 rounded-xl font-mono ${c.bgInput}`}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleProfileSubmit}
              disabled={isUploading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider transition border-0 cursor-pointer shadow-md font-mono"
            >
              {isUploading ? 'Securing Profile...' : 'Save Profile Settings'}
            </button>
            {settingsStatus && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/15 text-status-online text-xs rounded font-mono font-bold text-center">
                {settingsStatus}
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Credential Rotation */}
        <div className="glass-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-white-5 pb-3 mb-5">
              <RefreshCw className="w-4.5 h-4.5 text-purple-400" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Rotate Credentials
              </h4>
            </div>

            <form onSubmit={rotateExecutiveCredentials} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    New Handle
                  </label>
                  <input
                    type="text"
                    value={rotatedUsername}
                    onChange={(e) => setRotatedUsername(e.target.value)}
                    placeholder=""
                    className={`w-full p-3 rounded-xl outline-none ${c.bgInput}`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-secondary font-black uppercase mb-1.5 tracking-widest font-mono">
                    New Secret Key
                  </label>
                  <PasswordInput
                    value={rotatedPassword}
                    onChange={(e) => setRotatedPassword(e.target.value)}
                    placeholder=""
                    className={`w-full p-3 rounded-xl outline-none ${c.bgInput}`}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="mt-6 space-y-3">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-orange-500/10 text-orange-400 p-3.5 rounded-xl text-[9px] font-mono text-center font-bold tracking-wide uppercase leading-normal border border-orange-500/20">
                ACCESS LOCKED: CREDENTIAL ROTATIONS FOR EXECUTIVE TERMINALS FORBIDDEN FOR STANDARD OPERATIONS DEPUTY.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={rotateExecutiveCredentials}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-text-primary font-extrabold py-3 rounded-xl text-[10px] uppercase tracking-wider transition border-0 cursor-pointer shadow-md font-mono"
                >
                  Commit System Rotate
                </button>
                {rotationResult && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/15 text-purple-400 rounded-xl text-xs font-mono font-bold leading-normal text-center">
                    {rotationResult}
                  </div>
                )}
                {rotationError && (
                  <div className="p-3 bg-status-dnd/10 border border-rose-500/15 text-status-dnd rounded-xl text-xs font-mono font-bold leading-normal text-center">
                    {rotationError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
