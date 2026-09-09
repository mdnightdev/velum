import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, Loader2 } from 'lucide-react';

interface ScheduledDeletionModalProps {
  isOpen: boolean;
  username: string;
  scheduledDeletionAt: string;
  initialTimeRemainingMs: number;
  isCancelling: boolean;
  onCancelDeletion: () => void;
  onDismiss: () => void;
}

export default function ScheduledDeletionModal({
  isOpen,
  username,
  scheduledDeletionAt,
  initialTimeRemainingMs,
  isCancelling,
  onCancelDeletion,
  onDismiss
}: ScheduledDeletionModalProps) {
  const [msRemaining, setMsRemaining] = useState<number>(() => {
    const target = new Date(scheduledDeletionAt).getTime();
    if (!isNaN(target)) {
      return Math.max(0, target - Date.now());
    }
    return Math.max(0, initialTimeRemainingMs);
  });

  useEffect(() => {
    if (!isOpen) return;

    const targetTime = new Date(scheduledDeletionAt).getTime();
    const calculateRemaining = () => {
      if (!isNaN(targetTime)) {
        return Math.max(0, targetTime - Date.now());
      }
      return 0;
    };

    setMsRemaining(calculateRemaining());

    const timer = setInterval(() => {
      const diff = calculateRemaining();
      setMsRemaining(diff);
      if (diff <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, scheduledDeletionAt]);

  if (!isOpen) return null;

  const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  const isExpired = msRemaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-velum-900 border border-white-10 rounded-2xl p-6 shadow-2xl space-y-5 text-text-primary select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-status-dnd-bg flex items-center justify-center text-status-dnd flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Account Scheduled for Deletion
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              User: <span className="text-text-primary font-mono font-medium">@{username}</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-velum-800/80 border border-white-5 space-y-2 text-xs leading-relaxed text-text-secondary">
          <p>
            This account is currently scheduled for permanent deletion. Access is suspended while the deletion request is active.
          </p>
          <p>
            To restore your account and sign in immediately, you must cancel the deletion request. If you dismiss this prompt, the countdown will continue.
          </p>
        </div>

        {/* Live Countdown Display */}
        <div className="p-4 rounded-xl bg-velum-850 border border-white-10 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
            <Clock className="w-3.5 h-3.5 text-text-secondary" />
            <span className="uppercase tracking-wider font-semibold text-[11px]">Time Remaining</span>
          </div>

          {isExpired ? (
            <div className="text-status-dnd font-medium text-xs py-2">
              Deletion period has expired. Account cannot be restored.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 pt-1 font-mono">
              <div className="p-2 rounded-lg bg-velum-900 border border-white-5">
                <span className="block text-lg font-bold text-text-primary">{days}</span>
                <span className="block text-[10px] text-text-secondary uppercase">Days</span>
              </div>
              <div className="p-2 rounded-lg bg-velum-900 border border-white-5">
                <span className="block text-lg font-bold text-text-primary">{pad(hours)}</span>
                <span className="block text-[10px] text-text-secondary uppercase">Hours</span>
              </div>
              <div className="p-2 rounded-lg bg-velum-900 border border-white-5">
                <span className="block text-lg font-bold text-text-primary">{pad(minutes)}</span>
                <span className="block text-[10px] text-text-secondary uppercase">Mins</span>
              </div>
              <div className="p-2 rounded-lg bg-velum-900 border border-white-5">
                <span className="block text-lg font-bold text-text-primary">{pad(seconds)}</span>
                <span className="block text-[10px] text-text-secondary uppercase">Secs</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onCancelDeletion}
            disabled={isCancelling || isExpired}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cancelling Deletion...</span>
              </>
            ) : (
              <span>Cancel Deletion &amp; Sign In</span>
            )}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            disabled={isCancelling}
            className="w-full py-2.5 px-4 rounded-xl bg-transparent border border-white-10 text-text-secondary font-medium text-xs hover:text-text-primary hover:bg-white-5 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            Keep Scheduled &amp; Return
          </button>
        </div>
      </div>
    </div>
  );
}
