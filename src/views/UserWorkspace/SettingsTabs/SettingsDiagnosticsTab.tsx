import React, { useState } from 'react';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { FULL_BUILD_VERSION } from '../../../version';
import { submitDiagnosticLogs } from '../../../utils/diagnostics';

interface SettingsDiagnosticsTabProps {
  currentUserId: number;
}

export function SettingsDiagnosticsTab({ currentUserId }: SettingsDiagnosticsTabProps) {
  const { t } = useLanguage();
  const [diagNotes, setDiagNotes] = useState('');
  const [diagSubmitting, setDiagSubmitting] = useState(false);
  const [diagResult, setDiagResult] = useState<{ success: boolean; log_id?: string; error?: string } | null>(null);

  const handleTransmitDiagnostics = async () => {
    setDiagSubmitting(true);
    setDiagResult(null);
    try {
      const res = await submitDiagnosticLogs(diagNotes);
      setDiagResult(res);
      if (res.success) {
        setDiagNotes('');
      }
    } catch {
      setDiagResult({ success: false, error: 'Network failure dispatching payload' });
    } finally {
      setDiagSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {t('diagnostics', 'Diagnostics')}
        </h3>
        <span className="px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent font-mono text-[10px] font-bold">
          Build {FULL_BUILD_VERSION}
        </span>
      </div>

      <div className="p-6 rounded-xl border border-white-10 bg-velum-750/50 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold uppercase text-text-secondary block">
            {t('diagnostics.notes_label', 'Notes / Observations')}
          </label>
          <textarea
            value={diagNotes}
            onChange={(e) => setDiagNotes(e.target.value)}
            className="w-full bg-velum-850/80 border border-white-10 text-text-primary rounded-xl p-3 text-xs outline-none focus:border-accent/50 resize-none h-24 font-mono"
          />
        </div>

        {diagResult && (
          <div className={`p-3.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 ${
            diagResult.success 
              ? 'bg-alert-success-bg text-alert-success' 
              : 'bg-alert-error-bg text-alert-error'
          }`}>
            {diagResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>
              {diagResult.success 
                ? `${t('diagnostics.success', 'Diagnostic Report Logged')} (ID: ${diagResult.log_id})`
                : `${t('diagnostics.error', 'Diagnostic Dispatch Error')} (${diagResult.error})`}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleTransmitDiagnostics}
          disabled={diagSubmitting}
          className="w-full py-3 bg-accent hover:bg-accent-hover text-velum-950 font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {diagSubmitting ? (
            <span>{t('diagnostics.transmitting', 'Transmitting Diagnostics...')}</span>
          ) : (
            <span>{t('diagnostics.transmit_btn', 'Submit Diagnostics Log')}</span>
          )}
        </button>
      </div>
    </div>
  );
}
