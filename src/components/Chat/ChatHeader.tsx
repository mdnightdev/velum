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

export function formatLastSeen(lastSeenVal: string | null): string {
  if (!lastSeenVal || lastSeenVal === 'offline') return 'Offline';
  if (lastSeenVal === 'online') return 'Online';
  
  const date = new Date(lastSeenVal);
  if (isNaN(date.getTime())) return 'Offline';
  
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seenDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayDate.getTime() - seenDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  
  if (diffDays === 0) {
    return `Last seen at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Last seen yesterday, ${timeStr}`;
  } else if (diffDays < 7 && diffDays > 0) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Last seen ${days[date.getDay()]}, ${timeStr}`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Last seen ${pad(date.getDate())} ${months[date.getMonth()]}`;
  }
}

export function ChatHeader({
  wsConnected,
  isMobile,
  onBackToDeck,
  activeChatPeer,
  chatTitle,
  peerPresence,
  conversationMessages
}: ChatHeaderProps) {
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
              {activeChatPeer.avatar && (activeChatPeer.avatar.startsWith('data:image/') || activeChatPeer.avatar.startsWith('http')) ? (
                <img src={activeChatPeer.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-velum-800 border border-white-5 flex items-center justify-center font-bold text-accent shrink-0">
              <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full text-accent" dangerouslySetInnerHTML={{ __html: logoSvg }} />
            </div>
          )}
          
          {/* Title & Status */}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{chatTitle}</span>
            {activeChatPeer && (
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
