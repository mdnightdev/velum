import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface MessageStatusTicksProps {
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  isMe?: boolean;
  onRetry?: () => void;
}

export const MessageStatusTicks: React.FC<MessageStatusTicksProps> = ({ status = 'sent', isMe = true, onRetry }) => {
  if (!isMe) return null;

  if (status === 'sending') {
    return (
      <span title="Sending...">
        <Clock className="w-3 h-3 text-text-secondary/60 animate-pulse ml-1" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <button 
        onClick={onRetry}
        className="flex items-center gap-1 text-status-dnd hover:text-status-dnd/80 cursor-pointer text-[10px] ml-1 uppercase font-bold tracking-wider transition-colors" 
        title="Failed to send. Tap to retry."
      >
        <AlertCircle className="w-3 h-3" /> Failed
      </button>
    );
  }

  if (status === 'read') {
    return (
      <span className="text-accent text-[10px] font-mono ml-1 uppercase" title="Read">
        Read
      </span>
    );
  }
  
  if (status === 'delivered') {
    return (
      <span className="text-text-secondary/80 text-[10px] font-mono ml-1 uppercase" title="Delivered">
        Deliv
      </span>
    );
  }
  
  if (status === 'sent') {
    return (
      <span className="text-text-secondary/50 text-[10px] font-mono ml-1 uppercase" title="Sent">
        Sent
      </span>
    );
  }

  return null;
};
