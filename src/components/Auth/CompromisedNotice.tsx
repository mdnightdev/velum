import React from 'react';
import { ChevronLeft, ShieldAlert } from 'lucide-react';

interface CompromisedNoticeProps {
  compromiseTicketId: string;
  onReturnToLogin: () => void;
}

export default function CompromisedNotice({
  compromiseTicketId,
  onReturnToLogin,
}: CompromisedNoticeProps) {
  return (
    <div className="space-y-6 animate-fadeIn font-sans text-xs">
      <div className="flex items-center gap-2 mb-4 font-mono">
        <button
          onClick={onReturnToLogin}
          className="text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest text-status-dnd">
          Account Compromised
        </h2>
      </div>

      <div className="bg-status-dnd-bg rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-status-dnd flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-status-dnd text-xs">Security Alert</p>
            <p className="text-text-secondary text-[10px] mt-1">
              Your account has been flagged as compromised due to a panic protocol activation. 
              Contact support with your ticket ID to restore access.
            </p>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-white-5">
          <p className="text-[9px] uppercase text-text-secondary font-mono mb-1">Your Ticket ID</p>
          <p className="font-mono text-white text-sm tracking-wider">{compromiseTicketId}</p>
        </div>
      </div>

      <div className="bg-velum-850 border border-white-5 rounded-xl p-4 space-y-3">
        <p className="text-text-secondary text-[10px]">
          1. Copy your ticket ID above
        </p>
        <p className="text-text-secondary text-[10px]">
          2. Contact Velum support with this ticket ID
        </p>
        <p className="text-text-secondary text-[10px]">
          3. Support will verify your identity and restore access
        </p>
        <p className="text-text-secondary text-[10px]">
          4. Once restored, you can set a new password
        </p>
      </div>

      <button
        onClick={onReturnToLogin}
        className="w-full bg-velum-800 hover:bg-velum-750 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-widest cursor-pointer border border-white-5"
      >
        Return to Login
      </button>
    </div>
  );
}
