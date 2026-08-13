import { useState, useRef, useEffect } from 'react';

export interface UseMessageScrollOptions {
  messagesLength: number;
  typingPeer: string | null;
  chatKey?: string;
}

export function useMessageScroll({ messagesLength, typingPeer, chatKey }: UseMessageScrollOptions) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const isInitialLoadRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const scrollToBottom = (force = false, smooth = true) => {
    if (force || !isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Reset initial load and snap scroll when switching active conversations
  useEffect(() => {
    isInitialLoadRef.current = true;
    prevMessagesLengthRef.current = 0;
    scrollToBottom(true, false);
  }, [chatKey]);
  useEffect(() => {
    const handleResize = () => {
      // Force scroll = true, smooth = false (so it snaps instantly)
      scrollToBottom(true, false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  useEffect(() => {
    if (isInitialLoadRef.current || Math.abs(messagesLength - prevMessagesLengthRef.current) > 3) {
      scrollToBottom(true, false);
      isInitialLoadRef.current = false;
    } else {
      scrollToBottom(false, true);
    }
    prevMessagesLengthRef.current = messagesLength;
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
