import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';

export function SettingsLanguageTab() {
  const { language, setLanguage, t, supportedLanguages } = useLanguage();

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
          {t('language.title', 'Language Preferences')}
        </h3>
      </div>

      <div className="space-y-3">
        {supportedLanguages.map((langOption) => {
          const isSelected = language === langOption.code;
          return (
            <button
              key={langOption.code}
              type="button"
              onClick={() => setLanguage(langOption.code)}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition text-left cursor-pointer select-none ${
                isSelected
                  ? 'bg-velum-750 border-accent/70 text-text-primary shadow-lg ring-1 ring-accent/30'
                  : 'bg-velum-750/50 border-white-5 hover:bg-velum-750 text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-sm font-semibold block">{langOption.name}</span>
                  <span className="text-xs text-text-disabled font-mono">{langOption.nativeName}</span>
                </div>
              </div>

              {isSelected && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                    {t('language.active', 'Active')}
                  </span>
                  <CheckCircle className="w-4 h-4 text-accent" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
