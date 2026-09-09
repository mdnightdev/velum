import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Upload, Trash2, MapPin, ChevronDown } from 'lucide-react';
import { resolveMediaUrl } from '../../../utils/mediaPipeline';
import { isAvatarImageSrc } from '../../../components/ContactAvatar';
import { PROFILE_BIOS } from '../../../constants/profileBios';
import { velumToast } from '../../../utils/toast';

export function SettingsAccountTab({
  profileError,
  handleSaveProfile,
  avatarPreview,
  avatarUrl,
  avatarColor,
  getAvatarClass,
  displayName,
  username,
  setUsername,
  bio,
  location,
  setLocation,
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
  isUploading,
}: any) {
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [bioMenuOpen, setBioMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const autoDetectedRef = useRef(false);
  const bioMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bioMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bioMenuRef.current && !bioMenuRef.current.contains(e.target as Node)) {
        setBioMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bioMenuOpen]);

  const candidateAvatar = avatarPreview || avatarUrl || null;
  const rawAvatarSrc = isAvatarImageSrc(candidateAvatar) ? candidateAvatar : null;
  const resolvedAvatarSrc = rawAvatarSrc ? resolveMediaUrl(rawAvatarSrc) : null;
  const showAvatarImage = Boolean(resolvedAvatarSrc) && !avatarLoadError;
  const effectiveUsername = username !== undefined ? username : (currentUsername || '');
  const avatarInitial =
    (displayName ? displayName.slice(0, 1).toUpperCase() : '') ||
    (effectiveUsername ? effectiveUsername.slice(0, 1).toUpperCase() : 'U');

  useEffect(() => {
    setAvatarLoadError(false);
  }, [candidateAvatar]);

  const resolveLocation = async (latitude?: number, longitude?: number) => {
    let country = '';
    let city = '';
    const query =
      typeof latitude === 'number' && typeof longitude === 'number'
        ? `?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        : '';
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client${query}`);
      if (res.ok) {
        const data = await res.json();
        country = data.countryName || '';
        city = data.city || data.locality || '';
      }
    } catch {
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          if (res.ok) {
            const data = await res.json();
            country = data.address?.country || '';
            city = data.address?.city || data.address?.town || data.address?.village || '';
          }
        } catch {}
      }
    }
    return [city, country].filter(Boolean).join(', ') || country;
  };

  const detectLocation = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setDetectingLocation(true);

    try {
      const quick = await resolveLocation();
      if (quick) {
        setLocation((current: string) => current || quick);
      }
    } catch {}

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const precise = await resolveLocation(latitude, longitude);
            if (precise) {
              setLocation(precise);
              if (!silent) {
                velumToast.info(`Location detected: ${precise}`);
              }
            } else if (!silent) {
              velumToast.error('Could not resolve country from GPS.');
            }
          } catch {
            if (!silent) velumToast.error('Failed to reverse geocode location.');
          } finally {
            if (!silent) setDetectingLocation(false);
          }
        },
        (err) => {
          if (!silent) {
            setDetectingLocation(false);
            velumToast.error(err.message || 'GPS location permission denied.');
          }
        },
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    } else if (!silent) {
      setDetectingLocation(false);
      velumToast.error('Geolocation is not supported by your browser.');
    }
  };

  useEffect(() => {
    if (!location && !autoDetectedRef.current) {
      autoDetectedRef.current = true;
      void detectLocation({ silent: true });
    }
  }, [location]);

  const onSave = async () => {
    if (isSaving || isUploading) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const ok = await handleSaveProfile();
      if (ok !== false) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const submitProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave();
  };

  return (
    <form onSubmit={submitProfile} className="w-full max-w-md mx-auto space-y-6">
      {profileError && (
        <div className="text-xs text-status-dnd flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{profileError}</span>
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="relative group">
          <div
            className={`w-24 h-24 rounded-full relative flex items-center justify-center font-bold text-3xl text-accent overflow-hidden shadow-xl ${
              showAvatarImage ? 'bg-velum-750' : getAvatarClass?.(avatarColor) || 'bg-velum-750'
            }`}
          >
            {showAvatarImage ? (
              <img
                src={resolvedAvatarSrc!}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <span className="leading-none select-none" aria-hidden="true">{avatarInitial}</span>
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
          {showAvatarImage && (
            <button
              type="button"
              onClick={handleDeleteAvatar}
              className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 text-text-secondary hover:text-text-primary cursor-pointer"
              title="Remove photo"
              aria-label="Remove photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="mt-3 text-sm font-medium text-text-primary">{displayName || effectiveUsername}</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-text-secondary">{bio || PROFILE_BIOS[0]}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Username
          </label>
          <input
            type="text"
            value={effectiveUsername}
            onChange={(e) => {
              const val = e.target.value.replace(/^@+/, '').trimStart();
              if (setUsername) setUsername(val.slice(0, 32));
              if (setDisplayName) setDisplayName(val.slice(0, 32));
            }}
            placeholder="Username"
            maxLength={32}
            className="w-full bg-transparent border-0 border-b border-velum-600/70 rounded-none px-0 py-2 text-xs text-text-primary outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Bio
          </label>
          <div ref={bioMenuRef} className="relative flex items-start">
            <button
              type="button"
              onClick={() => setBioMenuOpen((open) => !open)}
              title="Preset bios"
              aria-label="Preset bios"
              aria-expanded={bioMenuOpen}
              className="absolute left-0 top-2 text-text-secondary hover:text-accent transition cursor-pointer p-0.5"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${bioMenuOpen ? 'rotate-180 text-accent' : ''}`} />
            </button>
            {bioMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-velum-600 bg-velum-850 shadow-xl divide-y divide-velum-700/50">
                {PROFILE_BIOS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setBio(preset);
                      setBioMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-velum-800 hover:text-text-primary cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 150))}
              maxLength={150}
              className="w-full bg-transparent border-0 border-b border-velum-600/70 rounded-none pl-7 pr-0 py-2 text-xs text-text-primary outline-none resize-none focus:border-accent transition-colors"
              placeholder="Write your bio"
            />
          </div>
          <div className="mt-1 text-right text-[10px] text-text-secondary">{bio.length}/150</div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Home
          </label>
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => void detectLocation({ silent: false })}
              disabled={detectingLocation}
              title="Detect location from GPS"
              aria-label="Detect location from GPS"
              className="absolute left-0 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent transition cursor-pointer p-0.5"
            >
              <MapPin className={`w-4 h-4 ${detectingLocation ? 'animate-pulse text-accent' : ''}`} />
            </button>
            <input
              type="text"
              value={location || ''}
              onChange={(e) => setLocation(e.target.value.slice(0, 128))}
              placeholder="Where you call home"
              className="w-full bg-transparent border-0 border-b border-velum-600/70 rounded-none pl-7 pr-0 py-2 text-xs text-text-primary outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isSaving || isUploading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onSave();
        }}
        className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent-hover active:scale-95 text-velum-900 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50"
      >
        {isSaving || isUploading ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Profile'}
      </button>
    </form>
  );
}
