import React from 'react';
import { Check, CheckCheck } from 'lucide-react';

interface MessageStatusTicksProps {
  status?: 'sent' | 'delivered' | 'read' | string;
  isMe?: boolean;
}

export const MessageStatusTicks: React.FC<MessageStatusTicksProps> = ({ status = 'sent', isMe = true }) => {
  if (!isMe) return null;

  if (status === 'read') {
    return (
      <span className="inline-flex items-center text-accent ml-1" title="Read">
        <CheckCheck className="w-3.5 h-3.5 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center text-text-secondary/80 ml-1" title="Delivered">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }

  // Sent (single tick)
  return (
    <span className="inline-flex items-center text-text-secondary/70 ml-1" title="Sent">
      <Check className="w-3.5 h-3.5" />
    </span>
  );
};
