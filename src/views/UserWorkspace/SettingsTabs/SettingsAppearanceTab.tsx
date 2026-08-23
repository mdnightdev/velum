import React, { useState, useEffect } from 'react';
import { CheckCircle, Sun, Moon, Monitor } from 'lucide-react';
import { getStoredAppearanceSettings, applyAppearanceSettings } from '../../../utils/appearance';

interface SettingsAppearanceTabProps {
  themeMode: 'dark' | 'light' | 'system';
  messageScaling: 'cozy' | 'compact';
  fontAdjustment: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  appearanceMsg: string | null;
  handleSaveAppearance: (
    newTheme: 'dark' | 'light' | 'system',
    newScaling: 'cozy' | 'compact',
    newFont: 'small' | 'medium' | 'large',
    newReducedMotion?: boolean
  ) => void;
  onToggleTheme?: () => void;
}

export function SettingsAppearanceTab({
  themeMode: propTheme,
  messageScaling: propScaling,
  fontAdjustment: propFont,
  reducedMotion: propMotion,
  appearanceMsg: parentMsg,
  handleSaveAppearance,
  onToggleTheme
}: SettingsAppearanceTabProps) {
  const initial = getStoredAppearanceSettings();
  const [activeTheme, setActiveTheme] = useState<'dark' | 'light' | 'system'>(initial.theme || propTheme || 'dark');
  const [activeScaling, setActiveScaling] = useState<'cozy' | 'compact'>(initial.messageScaling || propScaling || 'cozy');
  const [activeFont, setActiveFont] = useState<'small' | 'medium' | 'large'>(initial.fontAdjustment || propFont || 'medium');
  const [activeMotion, setActiveMotion] = useState<boolean>(initial.reducedMotion ?? propMotion ?? false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const current = getStoredAppearanceSettings();
    setActiveTheme(current.theme);
    setActiveScaling(current.messageScaling);
    setActiveFont(current.fontAdjustment);
    setActiveMotion(current.reducedMotion);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
    setActiveTheme(newTheme);
    applyAppearanceSettings({ theme: newTheme });
    handleSaveAppearance(newTheme, activeScaling, activeFont, activeMotion);
    triggerToast(`Theme set to ${newTheme}`);
    if (onToggleTheme && ((newTheme === 'light' && activeTheme !== 'light') || (newTheme === 'dark' && activeTheme !== 'dark'))) {
      onToggleTheme();
    }
  };

  const handleScalingChange = (newScaling: 'cozy' | 'compact') => {
    setActiveScaling(newScaling);
    applyAppearanceSettings({ messageScaling: newScaling });
    handleSaveAppearance(activeTheme, newScaling, activeFont, activeMotion);
    triggerToast(`Message density set to ${newScaling}`);
  };

  const handleFontChange = (newFont: 'small' | 'medium' | 'large') => {
    setActiveFont(newFont);
    applyAppearanceSettings({ fontAdjustment: newFont });
    handleSaveAppearance(activeTheme, activeScaling, newFont, activeMotion);
    triggerToast(`Font size set to ${newFont}`);
  };

  const handleMotionChange = () => {
    const nextMotion = !activeMotion;
    setActiveMotion(nextMotion);
    applyAppearanceSettings({ reducedMotion: nextMotion });
    handleSaveAppearance(activeTheme, activeScaling, activeFont, nextMotion);
    triggerToast(`Reduced motion ${nextMotion ? 'enabled' : 'disabled'}`);
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
          Appearance
        </h3>
      </div>

      {/* Theme Selection */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        <label className="block text-[11px] font-mono text-text-secondary uppercase tracking-wider">
          Theme Mode
        </label>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition cursor-pointer select-none ${
              activeTheme === 'dark'
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs font-semibold">Dark</span>
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition cursor-pointer select-none ${
              activeTheme === 'light'
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span className="text-xs font-semibold">Light</span>
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition cursor-pointer select-none ${
              activeTheme === 'system'
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs font-semibold">System</span>
          </button>
        </div>
      </div>

      {/* Message Scaling */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        <label className="block text-[11px] font-mono text-text-secondary uppercase tracking-wider">
          Message Density
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleScalingChange('cozy')}
            className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer select-none ${
              activeScaling === 'cozy'
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="text-xs font-semibold">Cozy</span>
          </button>
          <button
            type="button"
            onClick={() => handleScalingChange('compact')}
            className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer select-none ${
              activeScaling === 'compact'
                ? 'bg-accent/15 border-accent text-accent shadow-sm'
                : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="text-xs font-semibold">Compact</span>
          </button>
        </div>
      </div>

      {/* Font Size Adjustment */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        <label className="block text-[11px] font-mono text-text-secondary uppercase tracking-wider">
          Font Size
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handleFontChange(size)}
              className={`p-3 rounded-xl border flex items-center justify-center capitalize transition cursor-pointer select-none ${
                activeFont === size
                  ? 'bg-accent/15 border-accent text-accent shadow-sm'
                  : 'bg-velum-850/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="text-xs font-semibold">{size}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reduced Motion Toggle */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-text-primary block">Reduce Motion</span>
          <span className="text-[10px] text-text-secondary font-mono">Minimize animations across the workspace</span>
        </div>
        <button
          type="button"
          onClick={handleMotionChange}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
            activeMotion ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
        </button>
      </div>
    </div>
  );
}
