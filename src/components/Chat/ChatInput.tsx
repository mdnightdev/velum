import React, { RefObject, useEffect } from 'react';
import {
  Mic,
  Pause,
  Send,
  Trash2,
  X,
  Paperclip,
  Reply,
  Plus
} from 'lucide-react';
import { Message, stripAt } from '../../types';
import { Attachment } from './hooks/useMessageInput';

export interface ChatInputProps {
  // Input state
  inputText: string;
  setInputText: (val: string) => void;
  selectedAttachment: Attachment | null;
  onDismissAttachment: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;

  // Voice recording
  isRecording: boolean;
  recordingSeconds: number;
  isPaused: boolean;
  audioLevels: number[];
  cancelRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: (callback: (audioBase64: string, durationSeconds: number) => void) => void;
  onToggleRecording: () => void;
  micError: string | null;
  setMicError: (val: string | null) => void;

  // System broadcast / nomination
  roomId: string;
  currentUserId?: number;
  activeChatPeer?: { userId: number } | null;
  hasPendingNomination?: boolean;
  isSubmittingNominationAction?: boolean;
  onNominationAction?: (action: 'accept' | 'decline') => void;

  // Editing & replying
  editingMessageId: string | null;
  onCancelEdit: () => void;
  replyingToMessage: Message | null;
  onCancelReply: () => void;
  getDecryptedText: (msg: Message) => string;

  // Channel access & send
  roomAccessLevel?: string;
  currentUserRole?: string;
  chatTitle?: string;
  t: (key: string, fallback: string) => string;
  onSend: (e: React.FormEvent) => void;
  onSendVoiceNote: (voiceContent: string) => void;
  onTriggerFileInput: () => void;
  isPrivateSublounge?: boolean;
}

export function ChatInput({
  inputText,
  setInputText,
  selectedAttachment,
  onDismissAttachment,
  textareaRef,
  isRecording,
  recordingSeconds,
  isPaused,
  audioLevels,
  cancelRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  onToggleRecording,
  micError,
  setMicError,
  roomId,
  currentUserId,
  activeChatPeer,
  hasPendingNomination,
  isSubmittingNominationAction,
  onNominationAction,
  editingMessageId,
  onCancelEdit,
  replyingToMessage,
  onCancelReply,
  getDecryptedText,
  roomAccessLevel,
  currentUserRole = 'USER',
  chatTitle,
  t,
  onSend,
  onSendVoiceNote,
  onTriggerFileInput,
  isPrivateSublounge
}: ChatInputProps) {
  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(160, Math.max(42, scrollHeight))}px`;
    }
  }, [inputText, textareaRef]);

  return (
    <div className="p-4 border-t flex-shrink-0 bg-black/10 border-white-5">
      <div className="max-w-5xl mx-auto">
        {/* Mic Error Banner */}
        {micError && (
          <div className="mb-3 p-3 rounded-xl bg-alert-error-bg flex items-start justify-between gap-4 font-mono text-[10px] text-alert-error">
            <span className="whitespace-normal break-words flex-1 leading-relaxed">{micError}</span>
            <button
              type="button"
              onClick={() => setMicError(null)}
              className="text-text-secondary hover:text-white font-mono font-bold cursor-pointer transition uppercase mt-0.5 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Attachment slots list preview bar if selected */}
        {selectedAttachment && (
          selectedAttachment.type.startsWith('image/') ? (
            <div className="mb-4 relative inline-block group">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white-10 bg-velum-800 shadow-lg relative">
                <img
                  src={selectedAttachment.data}
                  alt="Draft upload"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest font-mono">
                    {selectedAttachment.size}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissAttachment}
                className="absolute -top-1.5 -right-1.5 p-1 bg-alert-error text-white rounded-full transition shadow-md cursor-pointer border border-velum-800 z-10 flex items-center justify-center"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-3 p-2.5 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-3 font-mono text-[10px]">
              <div className="flex items-center gap-2 truncate">
                <Paperclip className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-white font-bold truncate">{selectedAttachment.name}</span>
                <span className="text-text-secondary uppercase font-mono">({selectedAttachment.size})</span>
              </div>
              <button
                type="button"
                onClick={onDismissAttachment}
                className="text-text-secondary hover:text-alert-error transition p-1 cursor-pointer"
                title="Remove Attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}

        {isPrivateSublounge && (
          <div className="mb-2 px-2 text-[10px] font-mono text-text-disabled uppercase tracking-wider select-none">
            Sanctions in the parent lounge apply here automatically
          </div>
        )}

        {/* Voice Recording Overlay Bar */}
        {isRecording ? (
          <div className="bg-velum-850 p-4 border-t border-white-5 text-text-primary flex flex-col gap-3 rounded-2xl">
            {/* Live Audio Track / Waveform preview */}
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-alert-error animate-pulse" />
                <span className="text-white font-semibold">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* Dynamic Dots Visualizer */}
              <div className="flex flex-1 items-center justify-between gap-[3px] overflow-hidden px-3 h-6">
                {audioLevels.map((level, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-accent transition-all duration-75 opacity-90"
                    style={{ height: `${Math.max(4, (level / 100) * 24)}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={cancelRecording}
                className="w-11 h-11 rounded-full bg-status-dnd-bg hover:bg-status-dnd-bg/85 text-status-dnd flex items-center justify-center transition cursor-pointer"
                title="Discard recording"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="flex-1 h-11 rounded-full bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 font-mono text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isPaused ? (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>RESUME</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>PAUSE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopRecording(async (audioBase64, durationSeconds) => {
                    onSendVoiceNote(`[Voice Note  duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`);
                  });
                }}
                className="w-11 h-11 rounded-full bg-accent text-velum-950 hover:bg-accent-light flex items-center justify-center transition shadow-md cursor-pointer"
                title="Send voice note"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        ) : roomId === `dm_velum_${currentUserId}` || activeChatPeer?.userId === 999 ? (
          <div className="w-full flex flex-col gap-3">
            <div className="w-full bg-white-5 border border-white-10 rounded-xl p-3.5 text-center text-xs font-sans text-text-secondary select-none">
              This is a one-way system broadcast channel.
            </div>
            {hasPendingNomination && onNominationAction && (
              <div className="flex gap-3 justify-center items-center p-3 bg-velum-850 border border-white-5 rounded-xl">
                <span className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">Nomination pending:</span>
                <button
                  type="button"
                  onClick={() => onNominationAction('accept')}
                  disabled={isSubmittingNominationAction}
                  className="px-3.5 py-1.5 bg-bank-accent text-white hover:bg-bank-accent/80 font-bold rounded-lg uppercase text-[9px] cursor-pointer transition disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onNominationAction('decline')}
                  disabled={isSubmittingNominationAction}
                  className="px-3.5 py-1.5 bg-status-dnd-bg text-status-dnd hover:bg-status-dnd-bg/80 font-bold rounded-lg uppercase text-[9px] cursor-pointer transition disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {editingMessageId && (
              <div className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 mb-2.5 flex justify-between items-center text-[10px] text-text-secondary select-none font-mono tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  <span>EDITING MESSAGE</span>
                </div>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="text-status-dnd hover:text-status-dnd/80 font-bold uppercase text-[9px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            {replyingToMessage && (
              <div className="flex items-center justify-between py-2 px-4 bg-accent/10 border-b border-accent/20 text-[10px] font-mono font-bold text-accent tracking-wider uppercase">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Reply className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-[9px] text-text-secondary uppercase">Replying to {stripAt(replyingToMessage.username || 'User')}:</span>
                  <span className="text-white normal-case truncate max-w-xs font-medium font-sans">
                    {getDecryptedText(replyingToMessage)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="text-status-dnd hover:text-status-dnd/80 font-bold uppercase text-[9px] cursor-pointer shrink-0 ml-2"
                >
                  Cancel
                </button>
              </div>
            )}
            {roomAccessLevel === 'ANNOUNCE' && !['SUPPORT_ADMIN', 'LOGIN_ADMIN', 'CLI_ADMIN'].includes(currentUserRole) ? (
              <div className="w-full bg-velum-800 border border-white-5 rounded-xl p-3 text-center text-[11px] text-text-secondary font-mono tracking-widest uppercase">
                🔒 Admins Only
              </div>
            ) : (
              <form onSubmit={onSend} className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={onTriggerFileInput}
                  className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 text-text-secondary hover:text-white hover:bg-velum-800 transition flex items-center justify-center shrink-0 cursor-pointer"
                  title="Attach File"
                >
                  <Plus className="w-5 h-5" />
                </button>

                <div className="flex-1 relative flex items-end">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSend(e);
                      }
                    }}
                    placeholder={chatTitle ? t('chat.message_peer', 'Message {name}').replace('{name}', chatTitle) : t('chat.message_placeholder', 'Message...')}
                    className="w-full bg-velum-800 border border-white-5 rounded-2xl pl-5 pr-24 py-[11px] text-[13px] text-white outline-none focus:border-accent/50 font-sans resize-none max-h-32 overflow-y-auto leading-relaxed"
                    style={{ height: 'auto', minHeight: '42px' }}
                  />
                  <div className="absolute right-2 bottom-[3px] flex items-center gap-1">
                    <div className="relative w-9 h-9 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={onToggleRecording}
                        className={`absolute inset-0 flex items-center justify-center text-text-secondary hover:text-accent transition-all duration-200 cursor-pointer ${inputText.length > 0 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <button
                        type="submit"
                        className={`absolute inset-0 flex items-center justify-center bg-accent text-black rounded-full transition-all duration-200 shadow-md cursor-pointer ${inputText.length > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
