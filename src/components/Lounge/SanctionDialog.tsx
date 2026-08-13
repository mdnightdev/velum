import React from 'react';

interface SanctionDialogProps {
  showSanctionDialog: 'mute' | 'kick' | 'ban' | null;
  activeSanctionUserId: number | null;
  isDark: boolean;
  sanctionReason: string;
  setSanctionReason: (val: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SanctionDialog({
  showSanctionDialog,
  activeSanctionUserId,
  isDark,
  sanctionReason,
  setSanctionReason,
  onCancel,
  onConfirm,
}: SanctionDialogProps) {
  if (!showSanctionDialog || !activeSanctionUserId) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop p-4">
      <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 animate-fade-in ${isDark ? 'bg-velum-850 border-white-10 text-white' : 'bg-text-primary border-velum-600 text-velum-900'}`}>
        <h4 className="text-xs font-black uppercase tracking-wider text-alert-error">
          Confirm {showSanctionDialog} Command
        </h4>
        
        <p className="text-xs opacity-80">
          Please declare the official log reason for this sanction. This action cannot be undone.
        </p>
        
        <textarea 
          placeholder="DECLARE REASON (e.g. Terms of conduct violation)"
          value={sanctionReason}
          onChange={(e) => setSanctionReason(e.target.value)}
          className={`w-full p-2.5 rounded-lg border text-xs outline-none h-20 resize-none font-mono transition uppercase ${
            isDark 
              ? 'bg-velum-900 border-white-10 text-white focus:border-alert-error/50' 
              : 'bg-white-10 border-velum-600 text-velum-900 focus:border-alert-error/50'
          }`}
        />
        
        <div className="flex justify-end gap-2 text-[10px] font-bold uppercase tracking-wider">
          <button 
            onClick={onCancel}
            className="px-3 py-2 rounded-lg hover:bg-white-5 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-alert-error hover:bg-alert-error/80 text-white rounded-lg cursor-pointer"
          >
            Confirm {showSanctionDialog}
          </button>
        </div>
      </div>
    </div>
  );
}
