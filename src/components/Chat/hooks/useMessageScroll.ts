import { useState, useRef, useEffect } from 'react';

export interface UseMessageScrollOptions {
  messagesLength: number;
  typingPeer: string | null;
}

export function useMessageScroll({ messagesLength, typingPeer }: UseMessageScrollOptions) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const scrollToBottom = (force = false) => {
    if (force || !isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesLength, typingPeer]);

  const handleScrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('animate-pulse', 'bg-accent/10');
      setTimeout(() => {
        element.classList.remove('animate-pulse', 'bg-accent/10');
      }, 1500);
    }
  };

  return {
    messagesEndRef,
    scrollContainerRef,
    isScrolledUp,
    handleScroll,
    scrollToBottom,
    handleScrollToMessage,
  };
}
