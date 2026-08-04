import React from 'react';

interface MessageStatusTicksProps {
  status?: 'sent' | 'delivered' | 'read' | string;
  isMe?: boolean;
}

export const MessageStatusTicks: React.FC<MessageStatusTicksProps> = ({ status = 'sent', isMe = true }) => {
  if (!isMe) return null;

  if (status === 'read') {
    return (
      <span className="text-accent text-xs ml-1" title="Read">
        Read
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className="text-text-secondary/80 text-xs ml-1" title="Delivered">
        Delivered
      </span>
    );
  }

  return null;
};
