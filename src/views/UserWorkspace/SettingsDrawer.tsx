import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Lock, X, Check, Upload, Bell, Volume2, 
  Type, ShieldCheck, CheckCircle, AlertTriangle, Palette, 
  Laptop, Monitor, Trash2, Camera, Mic, Image as ImageIcon, 
  Sparkles, Globe, Clock, Shield, Zap, Play, LogOut, Info, Ticket, ChevronRight
} from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';
import { SettingsPrivacyTab } from './SettingsTabs/SettingsPrivacyTab';
import { SettingsAccountTab } from './SettingsTabs/SettingsAccountTab';

import TicketsMainDashboard from '../../components/SidebarTabs/TicketsMainDashboard';
import { useResponsive } from '../../hooks/useResponsive';
import logoSvg from '../../assets/logo.svg?raw';
import { computeClientHash } from '../../services/encryptionService';
import { compressImage } from '../../utils/imageCompressor';

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

type SettingCategory = 'account' | 'profile' | 'privacy' | 'appearance' | 'notifications' | 'media' | 'language' | 'tickets' | 'about';

export default function SettingsDrawer({
  isOpen,
  onClose,
  currentUserId,
  currentUsername,
  currentUserRole = 'USER',
  isDark,
  onToggleTheme,
  onProfileUpdate
}: SettingsDrawerProps) {
  const { isMobile } = useResponsive();

  const [activeView, setActiveView] = useState<SettingCategory | 'menu'>('menu');

  // Account settings states
  const [displayName, setDisplayName] = useState(currentUsername.replace('@', ''));
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
  
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [loungesCount, setLoungesCount] = useState(2);
  const [connectionsCount, setConnectionsCount] = useState(2);
  const [isUploading, setIsUploading] = useState(false);

  // Appearance states
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark');
  const [messageScaling, setMessageScaling] = useState<'cozy' | 'compact'>('cozy');
  const [fontAdjustment, setFontAdjustment] = useState<'small' | 'medium' | 'large'>('medium');
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

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';
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

      const sId = sessionStorage.getItem('velum-sessionId') || '';
      const requestHeaders = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };

      fetch(`/api/user/${currentUserId}/profile`, { headers: requestHeaders })
        .then(res => res.json())
        .then(data => {
          if (data) {
            if (data.bio) setBio(data.bio);
            if (data.displayName) {
              setDisplayName(data.displayName.replace('@', ''));
            } else {
              setDisplayName(currentUsername.replace('@', ''));
            }
            if (data.avatar) {
              if (data.avatar.startsWith('http') || data.avatar.startsWith('data:') || data.avatar.startsWith('/')) {
                setAvatarUrl(data.avatar);
                setAvatarColor('custom');
              } else {
                setAvatarColor(data.avatar);
              }
            }
            if (data.email) setEmail(data.email);
            if (data.phone) setPhone(data.phone);
            if (data.bannerColor) setBannerColor(data.bannerColor);

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
      fetch('/api/lounges/user', { headers: requestHeaders })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) setLoungesCount(data.length);
        })
        .catch(() => {});

      // Fetch user connections/friends count
      fetch('/api/friends/relationships', { headers: requestHeaders })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) {
            const activeFriends = data.filter(r => r.status === 'accepted');
            setConnectionsCount(activeFriends.length);
          }
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
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${displayName.trim().replace('@', '')}`,
          displayName: displayName.trim().replace('@', ''),
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
        sessionStorage.setItem('velum-username', data.user.username);
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
      const res = await fetch('/api/user/change-password', {
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
      const saltRes = await fetch(`/api/auth/user-salt?username=${encodeURIComponent(currentUsername.trim())}`);
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

      const res = await fetch('/api/auth/register-permanent-otp', {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
        setAvatarColor('custom');
      };
      reader.readAsDataURL(file);
    }
    setShowAvatarMenu(false);
  };

  const handleAvatarUploadTrigger = () => {
    setShowAvatarMenu(true);
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarUrl('');
    setAvatarColor('charcoal');
    setShowAvatarMenu(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);
    setIsUploading(true);

    let finalAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;

    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      const requestHeaders = {
        'Authorization': `Bearer ${sId}`,
        'Content-Type': 'application/json'
      };

      if (avatarFile && avatarPreview) {
        const blob = await compressImage(avatarPreview, 512, 0.85);
        const uploadRes = await fetch('/api/user/upload-avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sId}`,
            'Content-Type': 'image/jpeg'
          },
          body: blob
        });
        
        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          finalAvatar = uploadData.url;
          setAvatarUrl(uploadData.url);
        }
      } else if (avatarColor === 'charcoal' && !avatarPreview && !avatarUrl) {
        finalAvatar = '';
      }

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          userId: currentUserId,
          displayName: displayName.trim().replace('@', ''),
          bio: bio.trim(),
          avatar: finalAvatar,
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
        setProfileMsg('Account customizations updated.');
        if (onProfileUpdate) {
          onProfileUpdate(data.profile);
        }
        window.dispatchEvent(new CustomEvent('velum-profile-updated'));
        
        if (avatarFile) {
          setAvatarFile(null);
          setAvatarPreview(null);
        }
      } else {
        setProfileError(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      setProfileError('Failed to establish server connection.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAppearance = async (newTheme: 'dark' | 'light' | 'system', newScaling: 'cozy' | 'compact', newFont: 'small' | 'medium' | 'large') => {
    setAppearanceMsg(null);

    // If changing theme explicitly and we have the toggleTheme hook
    if (newTheme !== themeMode) {
      if (onToggleTheme) {
        // Toggle if switching modes
        if ((newTheme === 'dark' && !isDark) || (newTheme === 'light' && isDark)) {
          onToggleTheme();
        }
      }
    }

    try {
      const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
      await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${displayName.trim().replace('@', '')}`,
          displayName: displayName.trim().replace('@', ''),
          bio,
          avatar: chosenAvatar,
          email,
          phone,
          bannerColor,
          settings: {
            theme: newTheme,
            messageScaling: newScaling,
            fontAdjustment: newFont,
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
      setAppearanceMsg('Appearance profile updated.');
    } catch {
      setAppearanceMsg('Network exception saving settings.');
    }
  };

  const handleSaveNotifications = async (popups: boolean, sound: boolean, badges: boolean, push: boolean) => {
    setNotificationsMsg(null);
    try {
      const chosenAvatar = avatarColor === 'custom' ? avatarUrl : avatarColor;
      await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${displayName.trim().replace('@', '')}`,
          displayName: displayName.trim().replace('@', ''),
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
      await fetch('/api/user/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUserId,
          username: `@${displayName.trim().replace('@', '')}`,
          displayName: displayName.trim().replace('@', ''),
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
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers
      });
      if (res.ok) {
        window.alert("Account deleted successfully.");
        sessionStorage.clear();
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
      emerald: 'bg-emerald-900',
      bronze: 'bg-yellow-950',
      violet: 'bg-purple-950',
      indigo: 'bg-indigo-950',
      crimson: 'bg-rose-950'
    };
    return classes[color] || classes.charcoal;
  };

  const getAvatarClass = (color: string) => {
    const classes: Record<string, string> = {
      blue: 'bg-blue-950/40 text-blue-400 border-blue-900/40',
      emerald: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
      amber: 'bg-amber-950/40 text-amber-500 border-amber-900/40',
      purple: 'bg-purple-950/40 text-purple-400 border-purple-900/40'
    };
    return classes[color] || 'bg-velum-800 text-text-secondary border-velum-600';
  };

  return (
    <div className="fixed inset-0 z-[99999] flex overflow-hidden select-none font-sans">
      {/* Backdrop with a premium blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="glass-panel w-full h-full bg-velum-900 border-r border-accent/10 flex flex-col relative overflow-hidden z-10 border-y-0 rounded-none">
        
        <div className="absolute bottom-4 right-4 text-[9px] font-mono font-bold tracking-wider text-text-secondary/20 select-none">
          v2.1.5
        </div>

        <div className="p-4 md:p-4 border-b border-white-5 flex items-center justify-between flex-shrink-0 bg-velum-850">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent font-mono">Settings</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white-5 rounded-xl text-text-secondary hover:text-text-primary transition duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {(!isMobile || activeView === 'menu') && (
          <div className="flex-shrink-0 w-full md:w-72 bg-velum-850 border-b md:border-b-0 md:border-r border-white-5 overflow-y-auto">
            <div className="flex flex-col p-4 gap-6">
              
              <div className="space-y-1">
                <div className="px-4 py-2 text-[10px] uppercase font-bold text-text-secondary font-mono tracking-widest">Account</div>
                {[
                  { id: 'account', label: 'Account', icon: User },
                  { id: 'privacy', label: 'Privacy & Safety', icon: Lock },
                  { id: 'notifications', label: 'Notifications', icon: Bell }
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
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                  { id: 'media', label: 'Voice & Audio', icon: Volume2 },
                  { id: 'language', label: 'Language', icon: Globe }
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
                  { id: 'tickets', label: 'Tickets', icon: Ticket },
                  { id: 'about', label: 'About Velum', icon: Info }
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

              <div className="space-y-1 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.clear();
                    window.location.reload();
                  }}
                  className="w-full px-4 py-3 text-left rounded-xl text-sm font-medium flex items-center justify-between transition select-none cursor-pointer text-red-500 hover:bg-red-500/10"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Log Out</span>
                  </div>
                </button>
              </div>

            </div>
            </div>
          )}

          {(!isMobile || activeView !== 'menu') && (
          <div className="flex-1 bg-velum-900 p-4 md:p-4 overflow-y-auto">
            {isMobile && (
              <div className="mb-6 flex items-center">
                <button 
                  onClick={() => setActiveView('menu')}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  <span className="text-[10px] uppercase font-bold font-mono tracking-widest">Back</span>
                </button>
              </div>
            )}
            
            {(activeView === 'account' || (!isMobile && activeView === 'menu')) && (
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
                email={email}
                setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
                setDisplayName={setDisplayName}
                setBio={setBio}
                handleFileChange={handleFileChange}
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

            {activeView === 'appearance' && (
              <div className="w-full max-w-4xl space-y-8">
                
                {appearanceMsg && (
                  <div className="p-3.5 bg-velum-800 border border-white-5 text-accent rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{appearanceMsg}</span>
                  </div>
                )}

                <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Appearance</h3>

                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-mono font-bold text-text-secondary block">Theme</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'dark', label: 'Dark', icon: Monitor },
                      { id: 'light', label: 'Light', icon: Monitor },
                      { id: 'system', label: 'System', icon: Laptop }
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = themeMode === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSaveAppearance(t.id as any, messageScaling, fontAdjustment)}
                          className={`p-4 border rounded-xl flex flex-col items-center gap-2 font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-velum-750 border-accent text-accent' 
                              : 'bg-velum-850/40 border-white-5 text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-mono font-bold text-text-secondary block">Message Density</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'cozy', label: 'Cozy' },
                      { id: 'compact', label: 'Compact' }
                    ].map((s) => {
                      const active = messageScaling === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSaveAppearance(themeMode, s.id as any, fontAdjustment)}
                          className={`p-4 border rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-velum-750 border-accent text-accent' 
                              : 'bg-velum-850/40 border-white-5 text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] uppercase font-mono font-bold text-text-secondary block">Font Size</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'small', label: 'Small' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'large', label: 'Large' }
                    ].map((f) => {
                      const active = fontAdjustment === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSaveAppearance(themeMode, messageScaling, f.id as any)}
                          className={`p-4 border rounded-xl font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-velum-750 border-accent text-accent' 
                              : 'bg-velum-850/40 border-white-5 text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {activeView === 'notifications' && (
              <div className="w-full max-w-4xl space-y-8">
                
                {notificationsMsg && (
                  <div className="p-3.5 bg-velum-800 border border-white-5 text-accent rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{notificationsMsg}</span>
                  </div>
                )}

                <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Notifications</h3>

                <div className="space-y-3">
                  {[
                    { id: 'popups', label: 'Desktop notifications', val: desktopPopups, set: (v: boolean) => handleSaveNotifications(v, soundTriggers, unreadBadges, pushPreferences) },
                    { id: 'sounds', label: 'Sound alerts', val: soundTriggers, set: (v: boolean) => handleSaveNotifications(desktopPopups, v, unreadBadges, pushPreferences) },
                    { id: 'badges', label: 'Unread badges', val: unreadBadges, set: (v: boolean) => handleSaveNotifications(desktopPopups, soundTriggers, v, pushPreferences) },
                    { id: 'push', label: 'Background sync', val: pushPreferences, set: (v: boolean) => handleSaveNotifications(desktopPopups, soundTriggers, unreadBadges, v) }
                  ].map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => notif.set(!notif.val)}
                      className="w-full p-4 bg-velum-750/50 border border-white-5 hover:bg-velum-750 rounded-xl flex items-center justify-between text-left cursor-pointer transition select-none"
                    >
                      <span className="text-sm font-medium text-text-primary pr-4">{notif.label}</span>
                      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${notif.val ? 'bg-accent' : 'bg-velum-600'}`}>
                        <div className={`w-5 h-5 rounded-full bg-velum-900 transition-transform ${notif.val ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  ))}
                </div>

              </div>
            )}

            {activeView === 'media' && (
              <div className="w-full max-w-4xl space-y-8">
                
                {mediaMsg && (
                  <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{mediaMsg}</span>
                  </div>
                )}

                {mediaError && (
                  <div className="p-3.5 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{mediaError}</span>
                  </div>
                )}

                <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Media & Voice</h3>

                <div className="space-y-6">
                  <div className="p-5 rounded-xl border border-white-5 bg-white-2 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-white-5">
                      <Mic className="w-5 h-5 text-accent" />
                      <div>
                        <div className="text-sm font-semibold text-text-primary">Voice Messages</div>
                        <div className="text-[10px] text-text-secondary font-mono">Record and send voice notes in chats</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => handleSaveMedia(!voiceEnabled, autoPlayVoice)}
                        className="w-full p-4 bg-velum-750/50 border border-white-5 hover:bg-velum-750 rounded-xl flex items-center justify-between text-left cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <Volume2 className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm font-medium text-text-primary">Enable Voice Recording</span>
                        </div>
                        <div className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${voiceEnabled ? 'bg-accent' : 'bg-velum-600'}`}>
                          <div className={`w-5 h-5 rounded-full bg-velum-900 transition-transform ${voiceEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveMedia(voiceEnabled, !autoPlayVoice)}
                        className="w-full p-4 bg-velum-750/50 border border-white-5 hover:bg-velum-750 rounded-xl flex items-center justify-between text-left cursor-pointer transition select-none"
                      >
                        <div className="flex items-center gap-3">
                          <Play className="w-4 h-4 text-text-secondary" />
                          <span className="text-sm font-medium text-text-primary">Auto-play Voice Messages</span>
                        </div>
                        <div className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${autoPlayVoice ? 'bg-accent' : 'bg-velum-600'}`}>
                          <div className={`w-5 h-5 rounded-full bg-velum-900 transition-transform ${autoPlayVoice ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-white-5 bg-white-2 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-white-5">
                      <ImageIcon className="w-5 h-5 text-accent" />
                      <div>
                        <div className="text-sm font-semibold text-text-primary">Media Files</div>
                        <div className="text-[10px] text-text-secondary font-mono">Image and file attachments</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-white-5 bg-white-2">
                        <div className="text-[10px] text-text-secondary font-mono uppercase mb-1">Max Upload Size</div>
                        <div className="text-sm font-semibold text-text-primary">10MB</div>
                      </div>
                      <div className="p-3 rounded-lg border border-white-5 bg-white-2">
                        <div className="text-[10px] text-text-secondary font-mono uppercase mb-1">Supported Formats</div>
                        <div className="text-sm font-semibold text-text-primary">JPG, PNG, GIF</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-white-5 bg-white-2 space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-white-5">
                      <Shield className="w-5 h-5 text-accent" />
                      <div>
                        <div className="text-sm font-semibold text-text-primary">Privacy</div>
                        <div className="text-[10px] text-text-secondary font-mono">Media sharing settings</div>
                      </div>
                    </div>

                    <div className="text-[10px] text-text-secondary leading-relaxed">
                      Voice messages and media files are encrypted end-to-end. Media files are stored securely and automatically deleted after 30 days.
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeView === 'language' && (
              <div className="w-full max-w-4xl space-y-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">Language</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-velum-750/50 border border-accent/50 rounded-xl flex items-center justify-between transition">
                    <span className="text-sm font-medium text-text-primary">English (US)</span>
                    <CheckCircle className="w-4 h-4 text-accent" />
                  </div>
                  <div className="p-4 bg-velum-750/50 border border-white-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                    <span className="text-sm font-medium text-text-secondary">Spanish (Coming Soon)</span>
                  </div>
                  <div className="p-4 bg-velum-750/50 border border-white-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                    <span className="text-sm font-medium text-text-secondary">French (Coming Soon)</span>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'tickets' && (
              <div className="w-full max-w-4xl">
                <TicketsMainDashboard
                  currentUserId={currentUserId}
                  isDark={isDark}
                />
              </div>
            )}

            {activeView === 'about' && (
              <div className="w-full max-w-4xl space-y-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">About Velum</h3>
                <div className="p-8 rounded-xl border border-white-5 bg-velum-750/50 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-velum-800 border border-white/10 flex items-center justify-center">
                    <div className="w-9 h-9 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: logoSvg }} />
                  </div>
                  <div>
                    <div className="text-xl font-bold tracking-[0.2em] text-text-primary">VELUM</div>
                    <div className="text-[10px] text-text-secondary font-mono tracking-widest mt-1">Secure conversations, refined.</div>
                  </div>
                  <div className="pt-4 border-t border-white-5 w-full">
                    <div className="text-[10px] text-text-secondary font-mono">Version 2.1.5</div>
                    <div className="text-[10px] text-text-secondary font-mono mt-1"> 2026 Velum Network. All rights reserved.</div>
                  </div>
                </div>
              </div>
            )}

          </div>
          )}
        </div>

      </div>

      {/* Remaining split backdrop on right */}
      <div 
        className="flex-1 h-full bg-black-60 backdrop-blur-[2.5px] transition-opacity duration-300 cursor-pointer hidden md:block" 
        onClick={onClose} 
      />

      {/* Bottom-Sheet Overlay Menu for Avatar */}
      {showAvatarMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black-60 backdrop-blur-sm sm:items-center p-4">
          <div className="w-full max-w-sm bg-velum-800 border border-white-10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-8">
            <h3 className="text-text-primary text-sm font-bold mb-4 uppercase tracking-wider text-center">Avatar Photo</h3>
            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 text-center bg-white-5 hover:bg-white-10 text-text-primary font-medium rounded-xl transition cursor-pointer"
              >
                Upload Photo
              </button>
              <button
                onClick={handleRemovePhoto}
                className="w-full p-4 text-center bg-status-dnd/10 hover:bg-status-dnd/20 text-red-500 font-medium rounded-xl transition cursor-pointer"
              >
                Remove Photo
              </button>
              <button
                onClick={() => setShowAvatarMenu(false)}
                className="w-full p-4 text-center bg-transparent hover:bg-white-5 text-text-secondary font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
