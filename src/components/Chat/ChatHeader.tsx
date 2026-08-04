import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Message } from '../../types';
import logoSvg from '../../assets/logo.svg?raw';

interface ChatHeaderProps {
  wsConnected: boolean;
  isMobile?: boolean;
  onBackToDeck?: () => void;
  activeChatPeer: any | null;
  chatTitle: string;
  peerPresence: string;
  conversationMessages: Message[];
}

import { formatLastSeen } from '../../utils/datetime';

export function ChatHeader({
  wsConnected,
  isMobile,
  onBackToDeck,
  activeChatPeer,
  chatTitle,
  peerPresence,
  conversationMessages
}: ChatHeaderProps) {
  const initials = (activeChatPeer?.displayName || activeChatPeer?.username || chatTitle || '?').slice(0, 2).toUpperCase();

  return (
    <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 bg-black/10 border-white-5">
      {!wsConnected && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent text-[9px] font-mono font-bold uppercase rounded-lg animate-pulse tracking-widest pointer-events-none z-50">
          reconnecting...
        </div>
      )}
      <div className="flex items-center gap-3">
        {isMobile && onBackToDeck && (
          <button
            onClick={onBackToDeck}
            className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-text-primary/5 cursor-pointer flex items-center justify-center transition-colors"
            title="Back to directory"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {activeChatPeer ? (
            <div 
              className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent overflow-hidden shrink-0"
            >
              {activeChatPeer.avatar ? (
                <img src={activeChatPeer.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent shrink-0">
              <span className="text-xs font-mono font-bold uppercase text-accent">{initials}</span>
            </div>
          )}
          
          {/* Title & Status */}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{chatTitle}</span>
            {activeChatPeer && activeChatPeer.userId !== 999 && (
              <span className="text-[11px] text-text-secondary">
                {formatLastSeen(peerPresence)}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Video and Phone call buttons removed - calling features not implemented */}
    </div>
  );
}
