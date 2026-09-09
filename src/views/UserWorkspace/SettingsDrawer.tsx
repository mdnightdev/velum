import React, { useState, useEffect, useRef } from 'react';
import {
  User, Lock, X, Check, Upload, Bell, Volume2,
  Type, ShieldCheck, CheckCircle, AlertTriangle, Palette,
  Laptop, Monitor, Trash2, Camera, Mic, Image as ImageIcon,
  Sparkles, Globe, Clock, Shield, Zap, Play, Info, ChevronRight, Activity
} from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';
import { SettingsPrivacyTab } from './SettingsTabs/SettingsPrivacyTab';
import { SettingsAccountTab } from './SettingsTabs/SettingsAccountTab';
import { SettingsAppearanceTab } from './SettingsTabs/SettingsAppearanceTab';
import { SettingsNotificationsTab } from './SettingsTabs/SettingsNotificationsTab';
import { SettingsMediaTab } from './SettingsTabs/SettingsMediaTab';
import { SettingsLanguageTab } from './SettingsTabs/SettingsLanguageTab';
import { SettingsDiagnosticsTab } from './SettingsTabs/SettingsDiagnosticsTab';
import { SettingsAboutTab } from './SettingsTabs/SettingsAboutTab';

import { useBuildVersion } from '../../hooks/useBuildVersion';
import logoSvg from '../../assets/logo.svg?raw';
import { getSessionId } from '../../utils/auth';
import { velumToast } from '../../utils/toast';
import { computeClientHash } from '../../services/encryptionService';
import { streamFileDirectToCloudStorage, captureAndCompressPhoto } from '../../utils/mediaPipeline';
import { submitDiagnosticLogs } from '../../utils/diagnostics';
import { getLocalMedia, saveLocalMedia, deleteLocalMedia } from '../../utils/indexedDb';
import { FULL_BUILD_VERSION } from '../../version';
import { useLanguage } from '../../i18n/LanguageContext';
import { ImageCropperModal } from '../../components/ImageCropperModal';
import { storage } from '../../services/storageService';
import { getStoredAppearanceSettings, applyAppearanceSettings } from '../../utils/appearance';
import { stripAt } from '../../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  currentUsername: string;
  currentUserRole?: string;
  isDark: boolean;
  onToggleTheme?: () => void;
  onProfileUpdate?: (updatedUser: any) => void;
}

type SettingCategory = 'account' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'media' | 'language' | 'tickets' | 'diagnostics' | 'about';

export default function SettingsDrawer({
  isOpen,
  onClose,
  currentUserId,
  currentUsername = 'Guest',
  currentUserRole = 'USER',
  isDark,
  onToggleTheme,
  onProfileUpdate
}: SettingsDrawerProps) {
  const buildVersion = useBuildVersion();
  const { language, setLanguage, t, supportedLanguages } = useLanguage();

  const [activeView, setActiveView] = useState<SettingCategory | 'menu'>('menu');

  // Account settings states
  const [username, setUsername] = useState(stripAt(currentUsername || ''));
  const [displayName, setDisplayName] = useState(stripAt(currentUsername || ''));
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [permanentOtp, setPermanentOtp] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Status messages states
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Profile personalization states
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarColor, setAvatarColor] = useState('emerald');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  const [profileError, setProfileError] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | Blob | null>(null);
  const [loungesCount, setLoungesCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Appearance states initialized from live stored settings
  const initialAppearance = getStoredAppearanceSettings();
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(initialAppearance.theme);
  const [messageScaling, setMessageScaling] = useState<'cozy' | 'compact'>(initialAppearance.messageScaling);
  const [fontAdjustment, setFontAdjustment] = useState<'small' | 'medium' | 'large'>(initialAppearance.fontAdjustment);
  const [reducedMotion, setReducedMotion] = useState<boolean>(initialAppearance.reducedMotion);
  const [appearanceMsg, setAppearanceMsg] = useState<string | null>(null);

  // Notifications states
  const [desktopPopups, setDesktopPopups] = useState(true);
  const [soundTriggers, setSoundTriggers] = useState(true);
  const [unreadBadges, setUnreadBadges] = useState(true);
  const [pushPreferences, setPushPreferences] = useState(false);
  const [notificationsMsg, setNotificationsMsg] = useState<string | null>(null);

  // Media states
  const [mediaMsg, setMediaMsg] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSessionId = () => getSessionId();
  const headers = {
    'Authorization': `Bearer ${fetchSessionId()}`,
    'Content-Type': 'application/json'
  };

  // Load profile details from real API endpoint on open
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    setAccountMsg(null);
    setAccountError(null);
    setProfileError(null);
    setAppearanceMsg(null);
    setNotificationsMsg(null);
    setMediaMsg(null);
    setMediaError(null);

    getLocalMedia(`avatar_${currentUserId}`, currentUserId).then((cachedBlob) => {
      if (cachedBlob) {
        const localUrl = URL.createObjectURL(cachedBlob);
        setAvatarPreview(localUrl);
        setAvatarColor('custom');
      }
    }).catch(() => {});

    const sId = getSessionId();
    const requestHeaders = {
      'Authorization': `Bearer ${sId}`,
      'Content-Type': 'application/json'
    };

    fetch('/v2/user/me/profile', { headers: requestHeaders })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data || data.error) return;
        if (data.bio !== undefined) setBio(data.bio || '');
        if (data.username) setUsername(stripAt(data.username));
        setDisplayName(stripAt(data.displayName || data.username || currentUsername || ''));
        if (data.location !== undefined) setLocation(data.location || '');
        const avatarVal = data.avatar || data.avatarUrl || '';
        if (avatarVal.startsWith('http') || avatarVal.startsWith('data:') || avatarVal.startsWith('/') || avatarVal.includes('/uploads/')) {
          setAvatarUrl(avatarVal);
          setAvatarPreview(avatarVal);
          setAvatarColor('custom');
        } else if (avatarVal) {
          setAvatarUrl('');
          setAvatarPreview(null);
          setAvatarColor(avatarVal);
        } else {
          setAvatarUrl('');
          setAvatarPreview(null);
          setAvatarColor('charcoal');
        }
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);

        if (data.settings) {
          const s = data.settings;
          if (s.theme) setThemeMode(s.theme);
          if (s.messageScaling) setMessageScaling(s.messageScaling);
          if (s.fontAdjustment) setFontAdjustment(s.fontAdjustment);
          if (s.desktopPopups !== undefined) setDesktopPopups(s.desktopPopups);
          if (s.soundTriggers !== undefined) setSoundTriggers(s.soundTriggers);
          if (s.unreadBadges !== undefined) setUnreadBadges(s.unreadBadges);
          if (s.pushPreferences !== undefined) setPushPreferences(s.pushPreferences);
          if (s.voiceEnabled !== undefined) setVoiceEnabled(s.voiceEnabled);
          if (s.autoPlayVoice !== undefined) setAutoPlayVoice(s.autoPlayVoice);
        }
      })
      .catch(() => {});

    fetch('/v2/lounges', { headers: requestHeaders })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.lounges || []);
        setLoungesCount(list.length);
      })
      .catch(() => {});

    fetch('/v2/friends/relationships', { headers: requestHeaders })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const rels = Array.isArray(data) ? data : (data?.relationships || []);
        const activeFriends = rels.filter((r: any) => r.status === 'accepted');
        setConnectionsCount(activeFriends.length);
      })
      .catch(() => {});
  }, [isOpen, currentUserId, currentUsername]);

  const buildProfileBody = (overrides: Record<string, unknown> = {}) => {
    const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
    return {
      userId: currentUserId,
      username: stripAt(username || displayName),
      displayName: stripAt(displayName || username),
      bio: bio.trim(),
      location: location.trim(),
      avatar: chosenAvatar,
      email: email.trim(),
      phone: phone.trim(),
      ...overrides,
    };
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    setAccountError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setAccountError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setAccountError('New password and password confirmation do not match.');
      return;
    }

    try {
      const res = await fetch('/v2/user/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAccountMsg('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setAccountError(data.error || 'Failed to change password.');
      }
    } catch {
      setAccountError('Connection failure.');
    }
  };

  const handleRegisterOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    setAccountError(null);

    const pass = window.prompt('Confirm password to configure secondary passcode:');
    if (!pass) return;

    try {
      const saltRes = await fetch(`/v2/auth/user-salt?username=${encodeURIComponent(currentUsername.trim())}`);
      if (!saltRes.ok) {
        setAccountError('Connection error resolving security salt.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAccountError('Cryptographic handshake failed.');
        return;
      }

      const hashedPassword = await computeClientHash(pass, salt);

      const res = await fetch('/v2/auth/register-permanent-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: currentUsername,
          password: hashedPassword,
          permanentOtp: permanentOtp.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAccountMsg('Passcode updated.');
        setPermanentOtp('');
      } else {
        setAccountError(data.error || 'Failed to register passcode.');
      }
    } catch {
      setAccountError('Request timeout.');
    }
  };

  const [croppingConfig, setCroppingConfig] = useState<{
    src: string;
    fileName: string;
    type: 'avatar';
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCroppingConfig({ src: reader.result as string, fileName: file.name, type: 'avatar' });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarUrl('');
    setAvatarColor('charcoal');
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setIsUploading(true);

    let finalAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
    try {
      const sId = getSessionId();
      const requestHeaders = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };

      if (avatarFile && avatarPreview) {
        const uploadedUrl = await streamFileDirectToCloudStorage(avatarFile, 'avatars', avatarFile.type.split('/')[1] || 'webp');
        finalAvatar = uploadedUrl;
        setAvatarUrl(uploadedUrl);
        setAvatarPreview(uploadedUrl);
        setAvatarColor('custom');
        await saveLocalMedia(
          `avatar_${currentUserId}`,
          avatarFile,
          avatarFile.type || 'image/webp',
          currentUserId
        );
      } else if (avatarColor === 'charcoal' && !avatarPreview && !avatarUrl) {
        finalAvatar = '';
        await deleteLocalMedia(`avatar_${currentUserId}`, currentUserId);
      }

      const res = await fetch('/v2/user/profile', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          ...buildProfileBody({ avatar: finalAvatar }),
          settings: {
            theme: themeMode,
            messageScaling,
            fontAdjustment,
            desktopPopups,
            soundTriggers,
            unreadBadges,
            pushPreferences,
            voiceEnabled,
            autoPlayVoice
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        velumToast.success('Profile updated.');
        const savedUser = data.user || {};
        const avatarVal = savedUser.avatar || savedUser.avatarUrl || finalAvatar || '';
        if (savedUser.username) {
          storage.setItem('velum-username', savedUser.username);
          setUsername(stripAt(savedUser.username));
        }
        if (avatarVal) {
          setAvatarUrl(avatarVal);
          setAvatarPreview(avatarVal);
          setAvatarColor('custom');
        } else if (!finalAvatar) {
          setAvatarUrl('');
          setAvatarPreview(null);
        }
        try {
          const cached = storage.getItem<any>('velum-user') || {};
          storage.setItem('velum-user', {
            ...cached,
            ...savedUser,
            userId: savedUser.userId || savedUser.id || currentUserId,
            username: savedUser.username || username,
            displayName: savedUser.displayName || displayName,
            avatar: avatarVal,
            avatarUrl: avatarVal,
            bio: savedUser.bio ?? bio,
            location: savedUser.location ?? location,
          });
        } catch (_) {}
        if (onProfileUpdate) {
          onProfileUpdate({
            ...savedUser,
            avatar: avatarVal,
            avatarUrl: avatarVal,
          });
        }
        window.dispatchEvent(new CustomEvent('velum-profile-updated'));
        setAvatarFile(null);
        return true;
      } else {
        const message = data.error || 'Failed to update profile.';
        velumToast.error(message);
        setProfileError(message);
        setTimeout(() => setProfileError(null), 3500);
        return false;
      }
    } catch (err) {
      console.error('Profile save error:', err);
      velumToast.error('Failed to establish server connection.');
      setProfileError('Failed to establish server connection.');
      setTimeout(() => setProfileError(null), 3500);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAppearance = async (
    newTheme: 'dark' | 'light' | 'system',
    newScaling: 'cozy' | 'compact', 
    newFont: 'small' | 'medium' | 'large',
    newReducedMotion?: boolean
  ) => {
    setAppearanceMsg(null);
    const motionVal = newReducedMotion !== undefined ? newReducedMotion : reducedMotion;
    applyAppearanceSettings({
      theme: newTheme,
      messageScaling: newScaling,
      fontAdjustment: newFont,
      reducedMotion: motionVal
    });

    try {
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...buildProfileBody(),
          settings: {
            theme: newTheme,
            messageScaling: newScaling,
            fontAdjustment: newFont,
            reducedMotion: motionVal,
            desktopPopups,
            soundTriggers,
            unreadBadges,
            pushPreferences,
            voiceEnabled,
            autoPlayVoice
          }
        })
      });
      setThemeMode(newTheme);
      setMessageScaling(newScaling);
      setFontAdjustment(newFont);
      setReducedMotion(motionVal);
      setAppearanceMsg('Appearance profile updated.');
      setTimeout(() => setAppearanceMsg(null), 2000);
    } catch {
      setAppearanceMsg('Network exception saving settings.');
      setTimeout(() => setAppearanceMsg(null), 2000);
    }
  };

  const handleSaveNotifications = async (popups: boolean, sound: boolean, badges: boolean, push: boolean) => {
    setNotificationsMsg(null);
    try {
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...buildProfileBody(),
          settings: {
            theme: themeMode,
            messageScaling,
            fontAdjustment,
            desktopPopups: popups,
            soundTriggers: sound,
            unreadBadges: badges,
            pushPreferences: push,
            voiceEnabled,
            autoPlayVoice
          }
        })
      });
      setDesktopPopups(popups);
      setSoundTriggers(sound);
      setUnreadBadges(badges);
      setPushPreferences(push);
      setNotificationsMsg('Notification preferences consolidated.');
    } catch {
      setNotificationsMsg('Network failure.');
    }
  };

  const handleSaveMedia = async (voice: boolean, autoPlay: boolean) => {
    setMediaMsg(null);
    setMediaError(null);
    try {
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...buildProfileBody(),
          settings: {
            theme: themeMode,
            messageScaling,
            fontAdjustment,
            desktopPopups,
            soundTriggers,
            unreadBadges,
            pushPreferences,
            voiceEnabled: voice,
            autoPlayVoice: autoPlay
          }
        })
      });
      setVoiceEnabled(voice);
      setAutoPlayVoice(autoPlay);
      setMediaMsg('Media preferences saved.');
    } catch {
      setMediaError('Network failure saving media settings.');
    }
  };

  const handleSelfDeleteAccount = async () => {
    const confirmation = window.confirm(
      "Permanently delete account? This cannot be undone."
    );
    if (!confirmation) return;

    try {
      const res = await fetch('/v2/user/delete', {
        method: 'POST',
        headers
      });
      if (res.ok) {
        velumToast.success("Account deleted successfully.");
        storage.clear();
        window.location.reload();
      } else {
        const data = await res.json();
        velumToast.error(data.error || "Failed to delete account.");
      }
    } catch {
      velumToast.error("Connection failed.");
    }
  };

  if (!isOpen) return null;

  const getAvatarClass = (color: string) => {
    const classes: Record<string, string> = {
      blue: 'bg-theme-blue-avatar-bg text-theme-blue-avatar border-theme-blue-avatar-border',
      emerald: 'bg-theme-emerald-avatar-bg text-theme-emerald-avatar border-theme-emerald-avatar-border',
      amber: 'bg-theme-amber-avatar-bg text-theme-amber-avatar border-theme-amber-avatar-border',
      purple: 'bg-theme-purple-avatar-bg text-theme-purple-avatar border-theme-purple-avatar-border'
    };
    return classes[color] || 'bg-velum-800 text-text-secondary border-velum-600';
  };

  return (
    <div className="fixed inset-0 z-[99999] flex overflow-hidden select-none font-sans">
      {/* Dark backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />
            <div className="w-full h-full bg-velum-850 flex flex-col relative overflow-hidden z-10 animate-in fade-in duration-150">
  
        <div className="p-4 md:p-4 border-b border-velum-600 flex items-center justify-between flex-shrink-0 bg-velum-850">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent font-mono">Settings</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center hover:bg-white-5 rounded-full text-text-secondary hover:text-text-primary transition duration-150 cursor-pointer"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto">
              {activeView === 'menu' ? (
                <div className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                  
                  {/* Account Section Card */}
                  <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
                      {t('settings.account', 'Account')}
                    </div>
                    <div className="bg-velum-800 border border-velum-600 rounded-2xl overflow-hidden divide-y divide-velum-600/50 shadow-sm">
                      {[
                        { id: 'account', label: t('settings.account', 'Account'), icon: User },
                        { id: 'privacy', label: t('settings.privacy', 'Privacy & Safety'), icon: Lock },
                        { id: 'notifications', label: t('settings.notifications', 'Notifications'), icon: Bell }
                      ].map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveView(cat.id as SettingCategory)}
                            className="w-full px-4 py-3.5 text-left text-sm font-medium flex items-center justify-between text-text-primary hover:bg-white-5 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-accent shrink-0" />
                              <span>{cat.label}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-disabled" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* App Section Card */}
                  <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
                      App
                    </div>
                    <div className="bg-velum-800 border border-velum-600 rounded-2xl overflow-hidden divide-y divide-velum-600/50 shadow-sm">
                      {[
                        { id: 'appearance', label: t('settings.appearance', 'Appearance'), icon: Palette },
                        { id: 'media', label: t('settings.media', 'Media & Storage'), icon: Mic },
                        { id: 'language', label: t('settings.language', 'Language'), icon: Globe }
                      ].map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveView(cat.id as SettingCategory)}
                            className="w-full px-4 py-3.5 text-left text-sm font-medium flex items-center justify-between text-text-primary hover:bg-white-5 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-accent shrink-0" />
                              <span>{cat.label}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-disabled" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* More Section Card */}
                  <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
                      More
                    </div>
                    <div className="bg-velum-800 border border-velum-600 rounded-2xl overflow-hidden divide-y divide-velum-600/50 shadow-sm">
                      {[
                        { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
                        { id: 'about', label: 'About Velum', icon: Info }
                      ].map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveView(cat.id as SettingCategory)}
                            className="w-full px-4 py-3.5 text-left text-sm font-medium flex items-center justify-between text-text-primary hover:bg-white-5 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-accent shrink-0" />
                              <span>{cat.label}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-text-disabled" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
              <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto p-4 md:p-6">
              <div className="mb-6 flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="inline-flex items-center p-1 text-text-secondary hover:text-text-primary transition cursor-pointer"
                  aria-label="Back"
                  title="Back"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              </div>

              {activeView === 'account' && (
                <SettingsAccountTab
                  profileError={profileError}
                  handleSaveProfile={handleSaveProfile}
                  avatarPreview={avatarPreview}
                  avatarUrl={avatarUrl}
                  avatarColor={avatarColor}
                  getAvatarClass={getAvatarClass}
                  displayName={displayName}
                  username={username}
                  setUsername={setUsername}
                  bio={bio}
                  location={location}
                  setLocation={setLocation}
                  loungesCount={loungesCount}
                  connectionsCount={connectionsCount}
                  currentUsername={currentUsername}
                  currentUserRole={currentUserRole}
              	  setDisplayName={setDisplayName}
                  setBio={setBio}
                  handleFileChange={handleFileChange}
                  handleDeleteAvatar={handleRemovePhoto}
                  isUploading={isUploading}
                />
              )}

            {activeView === 'privacy' && (
              <SettingsPrivacyTab
                accountMsg={accountMsg}
                accountError={accountError}
                handlePasswordReset={handlePasswordReset}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
              />
            )}

            {activeView === 'notifications' && (
              <SettingsNotificationsTab
                desktopPopups={desktopPopups}
                soundTriggers={soundTriggers}
                unreadBadges={unreadBadges}
                pushPreferences={pushPreferences}
                notificationsMsg={notificationsMsg}
                handleSaveNotifications={handleSaveNotifications}
              />
            )}

            {activeView === 'appearance' && (
              <SettingsAppearanceTab
                themeMode={themeMode}
                messageScaling={messageScaling}
                fontAdjustment={fontAdjustment}
                reducedMotion={reducedMotion}
                appearanceMsg={appearanceMsg}
                handleSaveAppearance={handleSaveAppearance}
                onToggleTheme={onToggleTheme}
              />
            )}

            {activeView === 'media' && (
              <SettingsMediaTab
                voiceEnabled={voiceEnabled}
                autoPlayVoice={autoPlayVoice}
                mediaMsg={mediaMsg}
                mediaError={mediaError}
                currentUserId={currentUserId}
                handleSaveMedia={handleSaveMedia}
              />
            )}

            {activeView === 'language' && <SettingsLanguageTab />}

            {activeView === 'diagnostics' && (
              <SettingsDiagnosticsTab currentUserId={currentUserId} />
            )}

            {activeView === 'about' && <SettingsAboutTab />}

            </div>
          </div>
          )}
        </div>

      </div>

      
      {croppingConfig && (
        <ImageCropperModal
          imageSrc={croppingConfig.src}
          fileName={croppingConfig.fileName}
          aspectRatio={croppingConfig.type === 'avatar' ? '1:1' : '16:9'}
          onCancel={() => setCroppingConfig(null)}
          onCropComplete={(croppedDataUrl, croppedFile) => {
            if (croppingConfig.type === 'avatar') {
              setAvatarFile(croppedFile);
              setAvatarPreview(croppedDataUrl);
              setAvatarColor('custom');
            }
            setCroppingConfig(null);
          }}
        />
      )}

      {/* Hidden File Input for local photo upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
