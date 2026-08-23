import React, { RefObject, useEffect, useState, useRef } from 'react';
import {
  Mic,
  Pause,
  Trash2,
  X,
  Reply
} from 'lucide-react';
import { Message, stripAt } from '../../types';
import { Attachment } from './hooks/useMessageInput';
import { getDraftAudioBlob } from '../../utils/mediaPipeline';

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
  fileErrorAlert?: string | null;
  setFileErrorAlert?: (val: string | null) => void;

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
  isSending?: boolean;
  onSend: (e: React.FormEvent) => void;
  onSendVoiceNote: (voiceContent: string) => void;
  onTriggerFileInput?: () => void;
  onTriggerPhotoInput?: () => void;
  onTriggerDocInput?: () => void;
  isPrivateSublounge?: boolean;
  isMember?: boolean;
  onJoinLounge?: () => void;
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
  fileErrorAlert,
  setFileErrorAlert,
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
  isSending = false,
  onSend,
  onSendVoiceNote,
  onTriggerFileInput,
  onTriggerPhotoInput,
  onTriggerDocInput,
  isPrivateSublounge,
  isMember,
  onJoinLounge,
}: ChatInputProps) {
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    }
    if (isAttachmentMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAttachmentMenuOpen]);
  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(160, Math.max(42, scrollHeight))}px`;
    }
  }, [inputText, textareaRef]);

  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isRecording) {
      if (previewAudioRef.current) {
        try { previewAudioRef.current.pause(); } catch (e) {}
        previewAudioRef.current = null;
      }
      setIsPreviewPlaying(false);
    }
  }, [isRecording]);

  const toggleDraftPreview = () => {
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }
    const blob = getDraftAudioBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.onended = () => {
      setIsPreviewPlaying(false);
      URL.revokeObjectURL(url);
    };
    audio.play().then(() => {
      setIsPreviewPlaying(true);
    }).catch(() => {});
  };

  return (
    <div className="px-3 pb-2 pt-1 flex-shrink-0 bg-transparent">
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

        {/* File Error Alert Banner */}
        {fileErrorAlert && (
          <div className="mb-3 p-3 rounded-xl bg-alert-error-bg flex items-start justify-between gap-4 font-mono text-[10px] text-alert-error">
            <span className="whitespace-normal break-words flex-1 leading-relaxed">{fileErrorAlert}</span>
            <button
              type="button"
              onClick={() => setFileErrorAlert && setFileErrorAlert(null)}
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
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none gap-1">
                  <svg className="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="4" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
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
          ) : selectedAttachment.type.startsWith('video/') ? (
            <div className="mb-4 relative inline-block group">
              <div className="w-44 h-28 rounded-2xl overflow-hidden border border-white-10 bg-black shadow-lg relative flex items-center justify-center">
                <video
                  src={selectedAttachment.data}
                  className="w-full h-full object-cover"
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center pointer-events-none gap-1">
                  <div className="w-8 h-8 rounded-full bg-accent/90 text-black flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest font-mono mt-1">
                    {selectedAttachment.size}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissAttachment}
                className="absolute -top-1.5 -right-1.5 p-1 bg-alert-error text-white rounded-full transition shadow-md cursor-pointer border border-velum-800 z-10 flex items-center justify-center"
                title="Remove video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-3 p-2.5 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-3 font-mono text-[10px]">
              <div className="flex items-center gap-2 truncate">
                <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
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

        {/* Slim Voice Recording Bar */}
        {isRecording ? (
          <div className="bg-velum-850 px-3.5 py-2 border border-white-5 text-text-primary flex items-center justify-between gap-3 rounded-2xl animate-fadeIn select-none">
            {/* Timer & Indicator */}
            <div className="flex items-center gap-2 font-mono text-xs shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-accent' : 'bg-alert-error animate-pulse'}`} />
              <span className="text-white font-semibold">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Middle: Dynamic visualizer dots or Listen button when paused */}
            {isPaused ? (
              <button
                type="button"
                onClick={toggleDraftPreview}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-mono font-bold transition active:scale-95 cursor-pointer"
              >
                {isPreviewPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden px-2 h-5">
                {audioLevels.slice(0, 16).map((level, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-accent transition-all duration-75 opacity-90"
                    style={{ height: `${Math.max(4, (level / 100) * 18)}px` }}
                  />
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Discard */}
              <button
                type="button"
                onClick={cancelRecording}
                className="w-9 h-9 rounded-full bg-status-dnd-bg hover:bg-status-dnd-bg/85 text-status-dnd flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="Discard"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Pause / Resume */}
              <button
                type="button"
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="w-9 h-9 rounded-full bg-accent/10 hover:bg-accent/20 text-accent flex items-center justify-center transition active:scale-95 cursor-pointer"
                title={isPaused ? "Resume recording" : "Pause recording"}
              >
                {isPaused ? <Mic className="w-4 h-4" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>

              {/* Send */}
              <button
                type="button"
                onClick={() => {
                  stopRecording(async (audioBase64, durationSeconds) => {
                    onSendVoiceNote(`[Voice Note  duration:${durationSeconds}s data:audio/webm;base64,${audioBase64}]`);
                  });
                }}
                className="w-9 h-9 rounded-full bg-accent hover:bg-accent-hover text-velum-950 flex items-center justify-center transition shadow-md active:scale-95 cursor-pointer"
                title="Send voice note"
              >
                <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
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
        ) : isMember === false ? (
          <div className="w-full bg-velum-850 border border-velum-600 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-text-secondary select-none">
            <span>You must be a member of this lounge to send messages.</span>
            {onJoinLounge && (
              <button
                type="button"
                onClick={onJoinLounge}
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-black rounded-lg text-xs font-semibold cursor-pointer shrink-0"
              >
                Join Lounge
              </button>
            )}
          </div>
        ) : (
          <>
            {editingMessageId && (
              <div className="w-full bg-velum-800 border border-white-5 rounded-xl px-4 py-2.5 mb-2.5 flex justify-between items-center text-[10px] text-text-secondary select-none font-mono tracking-wider">
                <div className="flex items-center gap-2">
  
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
                Admins Only
              </div>
            ) : (
              <form onSubmit={onSend} className="w-full flex items-end gap-2 min-w-0">
                {/* Paperclip Button */}
                <div className="relative shrink-0" ref={attachmentMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAttachmentMenuOpen((prev) => !prev)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition active:scale-95 ${
                      isAttachmentMenuOpen
                        ? 'text-accent bg-accent/15 rotate-45'
                        : 'text-text-secondary hover:text-white hover:bg-white-5'
                    }`}
                    title="Attach"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.97 8.8l-8.58 8.57a2 2 0 0 1-2.83-2.83l7.88-7.87" />
                    </svg>
                  </button>

                  {/* Native Mobile Bottom Sheet Drawer */}
                  {isAttachmentMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-fadeIn"
                        onClick={() => setIsAttachmentMenuOpen(false)}
                      />
                      {/* Bottom Sheet Drawer */}
                      <div className="fixed bottom-0 left-0 right-0 z-50 bg-velum-850 border-t border-white-10 rounded-t-3xl p-4 pb-6 shadow-2xl animate-slide-up select-none max-w-lg mx-auto">
                        {/* Grabber handle */}
                        <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mb-4" />

                        <div className="flex items-center justify-around gap-2 px-2">
                          {/* Photo / Image */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachmentMenuOpen(false);
                              if (onTriggerPhotoInput) onTriggerPhotoInput();
                              else if (onTriggerFileInput) onTriggerFileInput();
                            }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white-5 active:scale-95 transition-all cursor-pointer group"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7B2CBF] to-[#9D4EDD] text-white flex items-center justify-center shadow-md shadow-purple-950/40 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-medium text-text-primary group-hover:text-white font-sans">
                              Photo
                            </span>
                          </button>

                          {/* Video */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachmentMenuOpen(false);
                              if (onTriggerPhotoInput) onTriggerPhotoInput();
                              else if (onTriggerFileInput) onTriggerFileInput();
                            }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white-5 active:scale-95 transition-all cursor-pointer group"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E63946] to-[#F77F00] text-white flex items-center justify-center shadow-md shadow-red-950/40 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-medium text-text-primary group-hover:text-white font-sans">
                              Video
                            </span>
                          </button>

                          {/* Voice Note */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachmentMenuOpen(false);
                              onToggleRecording();
                            }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white-5 active:scale-95 transition-all cursor-pointer group"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#2A9D8F] to-[#48CAE4] text-white flex items-center justify-center shadow-md shadow-teal-950/40 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-medium text-text-primary group-hover:text-white font-sans">
                              Voice
                            </span>
                          </button>

                          {/* Document / File */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttachmentMenuOpen(false);
                              if (onTriggerDocInput) onTriggerDocInput();
                              else if (onTriggerFileInput) onTriggerFileInput();
                            }}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white-5 active:scale-95 transition-all cursor-pointer group"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0077B6] to-[#0096C7] text-white flex items-center justify-center shadow-md shadow-blue-950/40 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-medium text-text-primary group-hover:text-white font-sans">
                              File
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Unified Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isSending) onSend(e);
                    }
                  }}
                  className="flex-1 bg-velum-800 border border-white-5 focus:border-accent/40 rounded-2xl px-4 py-2 text-[13.5px] text-white outline-none resize-none max-h-32 min-h-[40px] leading-relaxed placeholder:text-text-disabled font-sans"
                />

                {/* Right Action Button */}
                {inputText.trim().length > 0 || selectedAttachment ? (
                  <button
                    type="submit"
                    disabled={isSending}
                    className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-velum-900 flex items-center justify-center shrink-0 shadow-md shadow-accent/25 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Send"
                  >
                    <svg className="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleRecording}
                    className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 text-text-secondary hover:text-accent hover:bg-white-5 flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer"
                    title="Voice message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
