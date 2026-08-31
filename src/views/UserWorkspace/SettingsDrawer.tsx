import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Lock, X, Check, Upload, Bell, Volume2, 
  Type, ShieldCheck, CheckCircle, AlertTriangle, Palette, 
  Laptop, Monitor, Trash2, Camera, Mic, Image as ImageIcon, 
  Sparkles, Globe, Clock, Shield, Zap, Play, LogOut, Info, ChevronRight, Activity
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

import { useResponsive } from '../../hooks/useResponsive';
import { useBuildVersion } from '../../hooks/useBuildVersion';
import logoSvg from '../../assets/logo.svg?raw';
import { getSessionId } from '../../utils/auth';
import { computeClientHash } from '../../services/encryptionService';
import { streamFileDirectToCloudStorage, captureAndCompressPhoto } from '../../utils/mediaPipeline';
import { submitDiagnosticLogs, collectClientDiagnosticsPayload } from '../../utils/diagnostics';
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
  const { isMobile } = useResponsive();
  const buildVersion = useBuildVersion();
  const { language, setLanguage, t, supportedLanguages } = useLanguage();

  const [activeView, setActiveView] = useState<SettingCategory | 'menu'>('menu');

  // Account settings states
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
  const [avatarColor, setAvatarColor] = useState('emerald');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerColor, setBannerColor] = useState('charcoal');
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | Blob | null>(null);
  const [bannerUrl, setBannerUrl] = useState('');
  
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
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
    if (isOpen) {
      setAccountMsg(null);
      setAccountError(null);
      setProfileMsg(null);
      setProfileError(null);
      setAppearanceMsg(null);
      setNotificationsMsg(null);
      setMediaMsg(null);
      setMediaError(null);

      getLocalMedia(`avatar_${currentUserId}`).then((cachedBlob) => {
        if (cachedBlob) {
          const localUrl = URL.createObjectURL(cachedBlob);
          setAvatarPreview(localUrl);
          setAvatarColor('custom');
        }
      }).catch(() => {});

      getLocalMedia(`banner_${currentUserId}`).then((cachedBlob) => {
        if (cachedBlob) {
          const localUrl = URL.createObjectURL(cachedBlob);
          setBannerPreview(localUrl);
          setBannerColor('custom');
        }
      }).catch(() => {});

      const sId = getSessionId();
      const requestHeaders = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };

      fetch(`/v2/user/${currentUserId}/profile`, { headers: requestHeaders })
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.bio) setBio(data.bio);
            setDisplayName(stripAt(data.displayName || currentUsername || ''));
            if (data.avatar !== undefined) {
              const avatarVal = data.avatar || '';
              if (avatarVal.startsWith('http') || avatarVal.startsWith('data:') || avatarVal.startsWith('/')) {
                setAvatarUrl(avatarVal);
                setAvatarColor('custom');
              } else {
                setAvatarUrl('');
                setAvatarColor(avatarVal || 'charcoal');
              }
            }
            if (data.email) setEmail(data.email);
            if (data.phone) setPhone(data.phone);
            if (data.bannerColor) {
              const bannerVal = data.bannerColor || '';
              if (bannerVal.startsWith('http') || bannerVal.startsWith('data:') || bannerVal.startsWith('/')) {
                setBannerUrl(bannerVal);
                setBannerColor('custom');
              } else {
                setBannerUrl('');
                setBannerColor(bannerVal || 'charcoal');
              }
            }

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
          }
        })
        .catch(() => {});

      // Fetch user lounges count
      fetch('/v2/lounges', { headers: requestHeaders })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.lounges || []);
          setLoungesCount(list.length);
        })
        .catch(() => {});

      // Fetch user connections/friends count
      fetch('/v2/friends/relationships', { headers: requestHeaders })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          const rels = Array.isArray(data) ? data : (data?.relationships || []);
          const activeFriends = rels.filter((r: any) => r.status === 'accepted');
          setConnectionsCount(activeFriends.length);
        })
        .catch(() => {});
    }
  }, [isOpen, currentUserId]);

  const handleUpdateAccountDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    setAccountError(null);

    const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;

    try {
      const res = await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${stripAt(displayName)}`,
          displayName: stripAt(displayName),
          bio,
          avatar: chosenAvatar,
          location: '',
          email: email.trim(),
          phone: phone.trim(),
          bannerColor,
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
        setAccountMsg('Account details saved.');
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        storage.setItem('velum-username', data.user.username);
      } else {
        setAccountError(data.error || 'Failed to update account details.');
      }
    } catch {
      setAccountError('Server connection error.');
    }
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
    type: 'avatar' | 'banner';
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

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setCroppingConfig({ src: reader.result as string, fileName: file.name, type: 'banner' });
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

  const handleRemoveBanner = () => {
    setBannerPreview(null);
    setBannerFile(null);
    setBannerUrl('');
    setBannerColor('slate');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setIsUploading(true);

    let finalAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
    let finalBanner = bannerColor === 'custom' ? bannerUrl : bannerColor;

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
        await saveLocalMedia(`avatar_${currentUserId}`, avatarFile);
      } else if (avatarColor === 'charcoal' && !avatarPreview && !avatarUrl) {
        finalAvatar = '';
        await deleteLocalMedia(`avatar_${currentUserId}`);
      }

      if (bannerFile && bannerPreview) {
        const uploadedUrl = await streamFileDirectToCloudStorage(bannerFile, 'avatars', bannerFile.type.split('/')[1] || 'webp');
        finalBanner = uploadedUrl;
        setBannerUrl(uploadedUrl);
        await saveLocalMedia(`banner_${currentUserId}`, bannerFile);
      } else if (bannerColor === 'slate' && !bannerPreview && !bannerUrl) {
        finalBanner = '';
        await deleteLocalMedia(`banner_${currentUserId}`);
      }

      const res = await fetch('/v2/user/profile', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          userId: currentUserId,
          displayName: stripAt(displayName),
          bio: bio.trim(),
          avatar: finalAvatar,
          email: email.trim(),
          phone: phone.trim(),
          bannerColor: finalBanner,
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
        setProfileMsg('Profile updated.');
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        window.dispatchEvent(new CustomEvent('velum-profile-updated'));
        
        if (data.user?.avatar) {
          setAvatarUrl(data.user.avatar);
          setAvatarPreview(data.user.avatar);
        }
        if (data.user?.bannerColor) {
          setBannerUrl(data.user.bannerColor);
          setBannerPreview(data.user.bannerColor);
        }
        setAvatarFile(null);
        setBannerFile(null);
        setTimeout(() => setProfileMsg(null), 3500);
      } else {
        setProfileError(data.error || 'Failed to update profile.');
        setTimeout(() => setProfileError(null), 3500);
      }
    } catch (err) {
      console.error('Profile save error:', err);
      setProfileError('Failed to establish server connection.');
      setTimeout(() => setProfileError(null), 3500);
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
      const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${stripAt(displayName)}`,
          displayName: stripAt(displayName),
          bio,
          avatar: chosenAvatar,
          email,
          phone,
          bannerColor,
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
      const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${stripAt(displayName)}`,
          displayName: stripAt(displayName),
          bio,
          avatar: chosenAvatar,
          email,
          phone,
          bannerColor,
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
      const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
      await fetch('/v2/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${stripAt(displayName)}`,
          displayName: stripAt(displayName),
          bio,
          avatar: chosenAvatar,
          email,
          phone,
          bannerColor,
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
        window.alert("Account deleted successfully.");
        storage.clear();
        window.location.reload();
      } else {
        const data = await res.json();
        window.alert(data.error || "Failed to delete account.");
      }
    } catch {
      window.alert("Connection failed.");
    }
  };

  if (!isOpen) return null;

  const getBannerClass = (color: string) => {
    const classes: Record<string, string> = {
      charcoal: 'bg-velum-800',
      emerald: 'bg-theme-emerald-banner',
      bronze: 'bg-theme-bronze-banner',
      violet: 'bg-theme-violet-banner',
      indigo: 'bg-theme-indigo-banner',
      crimson: 'bg-theme-crimson-banner'
    };
    return classes[color] || classes.charcoal;
  };

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
      <div className="w-full max-w-md ml-auto h-full bg-velum-900 border-l border-white-10 flex flex-col relative overflow-hidden z-10 shadow-2xl animate-in slide-in-from-right duration-200">
        
        <div className="p-4 md:p-4 border-b border-white-10 flex items-center justify-between flex-shrink-0 bg-velum-900">
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

        <div className="flex-1 flex flex-col overflow-hidden">
          
          {activeView === 'menu' ? (
            <div className="flex-shrink-0 w-full bg-velum-850 overflow-y-auto">
              <div className="flex flex-col p-4 gap-6">
                
                <div className="space-y-1">
                  <div className="px-4 py-2 text-[10px] uppercase font-bold text-text-secondary font-mono tracking-widest">{t('settings.account', 'Account')}</div>
                  {[
                    { id: 'account', label: t('settings.account', 'Account'), icon: User },
                    { id: 'privacy', label: t('settings.privacy', 'Privacy & Safety'), icon: Lock },
                    { id: 'notifications', label: t('settings.notifications', 'Notifications'), icon: Bell }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const active = activeView === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id as SettingCategory)}
                        className={`w-full px-4 py-3 text-left rounded-xl text-sm font-medium flex items-center justify-between transition select-none cursor-pointer ${
                          active 
                            ? 'bg-accent/10 text-accent' 
                            : 'text-text-secondary hover:bg-white-5 hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{cat.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-disabled" />
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <div className="px-4 py-2 text-[10px] uppercase font-bold text-text-secondary font-mono tracking-widest">App</div>
                  {[
                    { id: 'appearance', label: t('settings.appearance', 'Appearance'), icon: Palette },
                    { id: 'media', label: t('settings.media', 'Media & Storage'), icon: Mic },
                    { id: 'language', label: t('settings.language', 'Language'), icon: Globe }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const active = activeView === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id as SettingCategory)}
                        className={`w-full px-4 py-3 text-left rounded-xl text-sm font-medium flex items-center justify-between transition select-none cursor-pointer ${
                          active 
                            ? 'bg-accent/10 text-accent' 
                            : 'text-text-secondary hover:bg-white-5 hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{cat.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-disabled" />
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <div className="px-4 py-2 text-[10px] uppercase font-bold text-text-secondary font-mono tracking-widest">More</div>
                  {[
                    { id: 'diagnostics', label: t('settings.diagnostics', 'Diagnostics'), icon: Activity },
                    { id: 'about', label: t('settings.about', 'About Velum'), icon: Info }
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const active = activeView === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveView(cat.id as SettingCategory)}
                        className={`w-full px-4 py-3 text-left rounded-xl text-sm font-medium flex items-center justify-between transition select-none cursor-pointer ${
                          active 
                            ? 'bg-accent/10 text-accent' 
                            : 'text-text-secondary hover:bg-white-5 hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
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
            <div className="flex-1 bg-velum-900 p-4 overflow-y-auto">
              <div className="mb-4 flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-[10px] uppercase font-bold font-mono tracking-widest">Back</span>
                </button>
              </div>

              {activeView === 'account' && (
                <SettingsAccountTab
                  profileMsg={profileMsg}
                  profileError={profileError}
                  handleSaveProfile={handleSaveProfile}
                  avatarPreview={avatarPreview}
                  avatarUrl={avatarUrl}
                  avatarColor={avatarColor}
                  getAvatarClass={getAvatarClass}
                  displayName={displayName}
                  bio={bio}
                  loungesCount={loungesCount}
                  connectionsCount={connectionsCount}
                  currentUsername={currentUsername}
                  currentUserRole={currentUserRole}
              	  setDisplayName={setDisplayName}
                  setBio={setBio}
                  handleFileChange={handleFileChange}
                  handleDeleteAvatar={handleRemovePhoto}
                  handleDeleteBanner={handleRemoveBanner}
                  bannerPreview={bannerPreview}
                  bannerUrl={bannerUrl}
                  bannerColor={bannerColor}
                  getBannerClass={getBannerClass}
                  handleBannerFileChange={handleBannerFileChange}
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
            } else {
              setBannerFile(croppedFile);
              setBannerPreview(croppedDataUrl);
              setBannerColor('custom');
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
