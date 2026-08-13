import React from 'react';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import PasswordInput from '../PasswordInput';

export type RecoveryViewMode = 'options' | 'reset' | 'redeem' | 'track';

interface AccountRecoveryProps {
  recoveryView: RecoveryViewMode;
  setRecoveryView: (view: RecoveryViewMode) => void;
  activeTicket: any;
  ticketReplyText: string;
  setTicketReplyText: (text: string) => void;
  recoveryUsername: string;
  setRecoveryUsername: (val: string) => void;
  recoverySafeWord: string;
  setRecoverySafeWord: (val: string) => void;
  recoveryCodeInput: string;
  setRecoveryCodeInput: (val: string) => void;
  recoveryNewPassword: string;
  setRecoveryNewPassword: (val: string) => void;
  redeemUsername: string;
  setRedeemUsername: (val: string) => void;
  redeemCode: string;
  setRedeemCode: (val: string) => void;
  redeemNewPassword: string;
  setRedeemNewPassword: (val: string) => void;
  ticketTrackingId: string;
  setTicketTrackingId: (val: string) => void;
  onBackToLogin: () => void;
  onRestoreAccountSubmit: (e: React.FormEvent) => void;
  onRedeemRestoreCodeSubmit: (e: React.FormEvent) => void;
  onQueryTicketSubmit: (e: React.FormEvent) => void;
  onTicketReplySubmit: (e: React.FormEvent) => void;
}

export default function AccountRecovery({
  recoveryView,
  setRecoveryView,
  activeTicket,
  ticketReplyText,
  setTicketReplyText,
  recoveryUsername,
  setRecoveryUsername,
  recoverySafeWord,
  setRecoverySafeWord,
  recoveryCodeInput,
  setRecoveryCodeInput,
  recoveryNewPassword,
  setRecoveryNewPassword,
  redeemUsername,
  setRedeemUsername,
  redeemCode,
  setRedeemCode,
  redeemNewPassword,
  setRedeemNewPassword,
  ticketTrackingId,
  setTicketTrackingId,
  onBackToLogin,
  onRestoreAccountSubmit,
  onRedeemRestoreCodeSubmit,
  onQueryTicketSubmit,
  onTicketReplySubmit,
}: AccountRecoveryProps) {
  const handleBack = () => {
    if (recoveryView !== 'options') {
      setRecoveryView('options');
    } else {
      onBackToLogin();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans text-xs">
      <div className="flex items-center gap-2 mb-4 font-mono">
        <button
          onClick={handleBack}
          className="text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
          {recoveryView === 'options' 
            ? 'Account Recovery' 
            : (recoveryView === 'reset' 
                ? 'Reset Password' 
                : (recoveryView === 'redeem' ? 'Redeem Restoration Code' : 'Track Support Ticket'))}
        </h2>
      </div>

      {activeTicket ? (
        <div className="space-y-4">
          <div className="bg-velum-850 border border-white-5 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white-5">
              <div>
                <p className="text-[9px] uppercase text-text-secondary font-mono">Ticket ID</p>
                <p className="font-bold text-white text-xs font-mono">
                  {String(activeTicket.ticket_id || activeTicket.tracking_id || activeTicket.trackingId || activeTicket.id || 'TICKET').slice(0, 18)}
                </p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <p className="text-[9px] uppercase text-text-secondary font-mono">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${activeTicket.status === 'open' ? 'bg-status-away-bg text-status-away' : 'bg-status-online-bg text-status-online'}`}>
                    {activeTicket.status}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] uppercase text-text-secondary font-bold font-mono">Ticket Messages</p>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {activeTicket.messages?.map((msg: any, idx: number) => {
                const isOp = msg.sender_name === 'Support operator';
                const isSys = msg.sender_name === 'System' || msg.sender_name === 'SYSTEM';

                if (isSys) {
                  return (
                    <div key={idx} className="text-center py-1">
                      <span className="text-[8px] font-mono text-text-secondary bg-velum-900 px-2 py-0.5 rounded">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-[10px] space-y-1 ${
                      isOp 
                        ? 'bg-accent/5 border-l-2 border-l-accent mr-auto' 
                        : 'bg-white-5 ml-auto border-r-2 border-r-text-secondary/50'
                    }`}
                  >
                    <div className="flex justify-between gap-4 text-[8px] text-text-secondary font-mono">
                      <span className="font-bold uppercase">{msg.sender_name}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-text-primary font-sans break-words">{msg.content}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={onTicketReplySubmit} className="flex gap-2">
            <input
              type="text"
              value={ticketReplyText}
              onChange={(e) => setTicketReplyText(e.target.value)}
              placeholder="Type your reply here..."
              className="flex-grow bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-accent"
              required
            />
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase px-4 rounded-xl text-xs tracking-wider transition cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {recoveryView === 'options' && (
            <div className="border border-white-5 rounded-xl p-4 bg-text-primary/[0.01] space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-accent" />
                <span>Choose a recovery option</span>
              </h3>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => setRecoveryView('reset')}
                  className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                >
                  <p className="text-sm font-semibold text-white">Option A: Reset Password</p>
                  <p className="text-[12px] text-text-secondary mt-1">Use your recovery key (VEL-REC-XXXX) and secret word to set a new password.</p>
                </button>

                <button
                  onClick={() => setRecoveryView('redeem')}
                  className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                >
                  <p className="text-sm font-semibold text-white">Option B: Redeem Restoration Code</p>
                  <p className="text-[12px] text-text-secondary mt-1">If support administrators approved your request and issued a restoration code (LGN-REC-XXXX), redeem it here.</p>
                </button>

                <button
                  onClick={() => setRecoveryView('track')}
                  className="w-full text-left p-3.5 bg-text-primary/[0.02] hover:bg-text-primary/[0.04] rounded-xl border border-white-5 hover:border-accent/50 transition text-text-primary cursor-pointer"
                >
                  <p className="text-sm font-semibold text-white">Option C: Track Support Ticket</p>
                  <p className="text-[12px] text-text-secondary mt-1">Enter your ticket ID to view status and chat with support operators.</p>
                </button>
              </div>
            </div>
          )}

          {recoveryView === 'reset' && (
            <form onSubmit={onRestoreAccountSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Username</label>
                <input
                  type="text"
                  value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Secret Word</label>
                <input
                  type="text"
                  value={recoverySafeWord}
                  onChange={(e) => setRecoverySafeWord(e.target.value)}
                  placeholder="Enter your secret word"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Recovery Key</label>
                <input
                  type="text"
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value)}
                  placeholder="VEL-REC-XXXX"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">New Password</label>
                <PasswordInput
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="Choose a strong new password"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRecoveryView('options')}
                  className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            </form>
          )}

          {recoveryView === 'redeem' && (
            <form onSubmit={onRedeemRestoreCodeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Username</label>
                <input
                  type="text"
                  value={redeemUsername}
                  onChange={(e) => setRedeemUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Restoration Code</label>
                <input
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="LGN-REC-XXXX"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">New Password</label>
                <PasswordInput
                  value={redeemNewPassword}
                  onChange={(e) => setRedeemNewPassword(e.target.value)}
                  placeholder="Choose a strong new password"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRecoveryView('options')}
                  className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Redeem Code
                </button>
              </div>
            </form>
          )}

          {recoveryView === 'track' && (
            <form onSubmit={onQueryTicketSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-text-secondary font-medium block">Ticket ID / Tracking ID</label>
                <input
                  type="text"
                  value={ticketTrackingId}
                  onChange={(e) => setTicketTrackingId(e.target.value)}
                  placeholder="Enter ticket ID"
                  className="w-full bg-velum-850 border border-white-5 rounded-xl px-4 py-3 text-xs text-white align-middle focus:border-accent focus:outline-none"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRecoveryView('options')}
                  className="flex-1 border border-white-5 hover:bg-white-5 text-white font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent-hover text-zinc-950 font-bold uppercase p-3 rounded-xl transition duration-150 text-xs tracking-wider cursor-pointer"
                >
                  Track Ticket
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
