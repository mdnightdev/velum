import React, { useState, useEffect } from 'react';
import { CheckCircle, Bell, Volume2, MessageSquare, Radio } from 'lucide-react';
import { 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  playNotificationSound, 
  requestNotificationPermission,
  updateAppBadge
} from '../../../utils/notifications';
import { registerPushNotifications } from '../../../utils/pushNotifications';

interface SettingsNotificationsTabProps {
  desktopPopups: boolean;
  soundTriggers: boolean;
  unreadBadges: boolean;
  pushPreferences: boolean;
  notificationsMsg: string | null;
  handleSaveNotifications: (
    popups: boolean,
    sound: boolean,
    badges: boolean,
    push: boolean
  ) => void;
}

export function SettingsNotificationsTab({
  desktopPopups: propPopups,
  soundTriggers: propSound,
  unreadBadges: propBadges,
  pushPreferences: propPush,
  notificationsMsg: parentMsg,
  handleSaveNotifications
}: SettingsNotificationsTabProps) {
  const initial = getNotificationPreferences();
  const [popups, setPopups] = useState<boolean>(initial.desktopPopups ?? propPopups ?? true);
  const [sound, setSound] = useState<boolean>(initial.soundTriggers ?? propSound ?? true);
  const [badges, setBadges] = useState<boolean>(initial.unreadBadges ?? propBadges ?? true);
  const [push, setPush] = useState<boolean>(initial.pushPreferences ?? propPush ?? false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const current = getNotificationPreferences();
    setPopups(current.desktopPopups);
    setSound(current.soundTriggers);
    setBadges(current.unreadBadges);
    setPush(current.pushPreferences);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  const handleTogglePopups = async () => {
    const next = !popups;
    setPopups(next);
    saveNotificationPreferences({ desktopPopups: next });
    handleSaveNotifications(next, sound, badges, push);
    if (next) {
      const granted = await requestNotificationPermission();
      triggerToast(granted ? 'In-app & desktop alerts enabled' : 'Alerts enabled (Browser permission required)');
    } else {
      triggerToast('In-app alerts disabled');
    }
  };

  const handleToggleSound = () => {
    const next = !sound;
    setSound(next);
    saveNotificationPreferences({ soundTriggers: next });
    handleSaveNotifications(popups, next, badges, push);
    if (next) {
      playNotificationSound(); // Play test sample chime
      triggerToast('Audio chime alert enabled');
    } else {
      triggerToast('Audio alerts muted');
    }
  };

  const handleToggleBadges = () => {
    const next = !badges;
    setBadges(next);
    saveNotificationPreferences({ unreadBadges: next });
    handleSaveNotifications(popups, sound, next, push);
    updateAppBadge(next ? 1 : 0);
    triggerToast(`Unread badges ${next ? 'enabled' : 'disabled'}`);
  };

  const handleTogglePush = async () => {
    const next = !push;
    setPush(next);
    saveNotificationPreferences({ pushPreferences: next });
    handleSaveNotifications(popups, sound, badges, next);
    if (next) {
      const success = await registerPushNotifications();
      triggerToast(success ? 'Push notifications active' : 'Push notifications configured');
    } else {
      triggerToast('Push notifications disabled');
    }
  };

  const displayMsg = toastMsg || parentMsg;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {displayMsg && (
        <div className="p-3.5 bg-status-online-bg text-status-online rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2 transition-all">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{displayMsg}</span>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
          Notifications
        </h3>
      </div>

      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        {/* Desktop / In-App Popups */}
        <div className="flex items-center justify-between py-2 border-b border-white-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">In-App Notifications</span>
              <span className="text-[10px] text-text-secondary font-mono">Show notification banners for incoming messages</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTogglePopups}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              popups ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>

        {/* Audio Alerts */}
        <div className="flex items-center justify-between py-2 border-b border-white-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Sound Effects</span>
              <span className="text-[10px] text-text-secondary font-mono">Play audio chime when messages arrive</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              sound ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>

        {/* Unread Count Badges */}
        <div className="flex items-center justify-between py-2 border-b border-white-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Unread Badges</span>
              <span className="text-[10px] text-text-secondary font-mono">Show unread count indicator on conversations and browser tab</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleBadges}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              badges ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>

        {/* Push Notification Integration */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Background Push</span>
              <span className="text-[10px] text-text-secondary font-mono">Receive native device alerts when the app is in the background</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTogglePush}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              push ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>
      </div>
    </div>
  );
}
