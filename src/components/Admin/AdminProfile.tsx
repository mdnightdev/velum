import React, { useState } from 'react';
import { User, Plus, RefreshCw } from 'lucide-react';
import PasswordInput from '../PasswordInput';
import { streamFileDirectToCloudStorage } from '../../utils/mediaPipeline';
import { saveLocalMedia } from '../../utils/indexedDb';
import { ImageCropperModal } from '../ImageCropperModal';

interface AdminProfileProps {
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  user?: any;
  adminProfile: any;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
}

export default function AdminProfile({
  adminId,
  adminRole,
  user,
  adminProfile,
  adminFetch,
  fetchData,
}: AdminProfileProps) {
  const [avatarFile, setAvatarFile] = useState<File | Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [safeWord, setSafeWord] = useState('');
  const [panicPhrase, setPanicPhrase] = useState('');

  const [rotatedUsername, setRotatedUsername] = useState('');
  const [rotatedPassword, setRotatedPassword] = useState('');
  const [rotationResult, setRotationResult] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [croppingAvatar, setCroppingAvatar] = useState<{ src: string; fileName: string } | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCroppingAvatar({ src: reader.result as string, fileName: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setSettingsStatus(null);

    try {
      let finalAvatarUrl = adminProfile?.avatar || '';

      if (avatarFile) {
        const fileExt = avatarFile.type.split('/')[1] || 'jpg';
        const fileName = `admin_${adminId}_${Date.now()}.${fileExt}`;
        const uploadedUrl = await streamFileDirectToCloudStorage(avatarFile, 'avatars', fileExt);
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
          await saveLocalMedia(`avatar_${adminId}`, avatarFile);
        }
      }

      const res = await adminFetch('/v2/admin/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar: finalAvatarUrl,
          safeWord: safeWord.trim() || undefined,
          panicPhrase: panicPhrase.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSettingsStatus('Profile saved successfully.');
        fetchData();
      } else {
        const err = await res.json();
        setSettingsStatus(err.error || 'Failed to save profile.');
      }
    } catch {
      setSettingsStatus('Connection error.');
    } finally {
      setIsUploading(false);
    }
  };

  const rotateExecutiveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setRotationResult(null);
    setRotationError(null);

    if (!rotatedUsername.trim() || !rotatedPassword.trim()) {
      setRotationError('Username and password cannot be empty.');
      return;
    }

    try {
      const res = await adminFetch('/v2/admin/credentials/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername: rotatedUsername,
          newPassword: rotatedPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRotationResult('Credentials updated successfully.');
        setRotatedUsername('');
        setRotatedPassword('');
      } else {
        setRotationError(data.error || 'Failed to update credentials.');
      }
    } catch {
      setRotationError('Connection error.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-4">
              <User className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-xs text-text-primary">
                Admin Profile
              </h4>
            </div>

            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="relative group cursor-pointer">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent/40 bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : adminProfile?.avatar ? (
                    <img src={adminProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.username || 'AD').substring(0, 2).toUpperCase()
                  )}
                </div>
                <label
                  htmlFor="admin-avatar-input"
                  className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-medium text-text-primary"
                >
                  <Plus className="w-4 h-4 mb-0.5 text-accent" />
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

              {croppingAvatar && (
                <ImageCropperModal
                  imageSrc={croppingAvatar.src}
                  fileName={croppingAvatar.fileName}
                  aspectRatio="1:1"
                  onCancel={() => setCroppingAvatar(null)}
                  onCropComplete={(croppedDataUrl, croppedFile) => {
                    setAvatarFile(croppedFile);
                    setAvatarPreview(croppedDataUrl);
                    setCroppingAvatar(null);
                  }}
                />
              )}

              <div className="text-center">
                <span className="text-sm font-semibold text-text-primary block">
                  @{user?.username || 'Admin'}
                </span>
                <span className="text-xs text-text-secondary">
                  Role: {adminRole}
                </span>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`ID: ${adminId}`}
                    className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-secondary cursor-not-allowed text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    disabled
                    value={adminRole === 'SUPPORT_ADMIN' ? 'Support Admin' : 'Admin'}
                    className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-secondary cursor-not-allowed text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Safe Word
                  </label>
                  <input
                    type="text"
                    value={safeWord}
                    onChange={(e) => setSafeWord(e.target.value)}
                    
                    className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Panic Phrase
                  </label>
                  <input
                    type="text"
                    value={panicPhrase}
                    onChange={(e) => setPanicPhrase(e.target.value)}
                   
                    className="w-full p-2 rounded-lg bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleProfileSubmit}
              disabled={isUploading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
            >
              {isUploading ? 'Saving...' : 'Save Profile'}
            </button>
            {settingsStatus && (
              <div className="mt-2 p-2 bg-status-online/10 text-status-online text-xs rounded text-center">
                {settingsStatus}
              </div>
            )}
          </div>
        </div>

        <div className="bg-velum-800 border border-velum-600 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-velum-600 pb-2.5 mb-4">
              <RefreshCw className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-xs text-text-primary">
                Change Credentials
              </h4>
            </div>

            <form onSubmit={rotateExecutiveCredentials} className="space-y-3 text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    New Username
                  </label>
                  <input
                    type="text"
                    value={rotatedUsername}
                    onChange={(e) => setRotatedUsername(e.target.value)}
                    
                    className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    New Password
                  </label>
                  <PasswordInput
                    value={rotatedPassword}
                    onChange={(e) => setRotatedPassword(e.target.value)}
                   
                    className="w-full p-2 rounded-lg outline-none bg-velum-750 border border-velum-600 text-text-primary text-xs"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="mt-4 space-y-2">
            {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
              <div className="bg-status-away/10 text-status-away p-2.5 rounded-lg text-xs text-center font-medium">
                Admin permissions required.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={rotateExecutiveCredentials}
                  className="w-full bg-accent hover:bg-accent-hover text-black font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
                >
                  Update Credentials
                </button>
                {rotationResult && (
                  <div className="p-2 bg-status-online/10 text-status-online rounded-lg text-xs text-center">
                    {rotationResult}
                  </div>
                )}
                {rotationError && (
                  <div className="p-2 bg-status-dnd/10 text-status-dnd rounded-lg text-xs text-center">
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
