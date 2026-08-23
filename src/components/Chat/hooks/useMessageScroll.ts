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
  const prevMessagesLengthRef = useRef(0);
  // Opening a chat populates `messages` from up to three separate sources in
  // quick succession (local cache, a REST delta fetch, then the WebSocket
  // history response). Each one changes messagesLength and would otherwise
  // trigger its own scroll - the first an instant snap, later ones smooth-
  // animated, which layers into visible "rapid" scrolling. Instead, treat
  // any length change within this window after opening a chat as part of
  // the same initial load and always snap instantly.
  const settleUntilRef = useRef(0);
  const SETTLE_WINDOW_MS = 900;
  // During the settle window, messagesLength can change several times in a
  // few dozen milliseconds (cache load, then delta fetch, then WS history
  // replace). Snapping instantly on each individual change still produces
  // visible flicker - it's just un-animated jumps instead of animated ones.
  // Debounce so the whole burst collapses into a single scroll once things
  // go quiet.
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SCROLL_DEBOUNCE_MS = 120;

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
    settleUntilRef.current = Date.now() + SETTLE_WINDOW_MS;
    prevMessagesLengthRef.current = 0;
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = null;
    }
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
    const stillSettling = Date.now() < settleUntilRef.current;
    const bigJump = Math.abs(messagesLength - prevMessagesLengthRef.current) > 3;
    prevMessagesLengthRef.current = messagesLength;

    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = null;
    }

    if (stillSettling || bigJump) {
      // Wait for the burst of loading updates to quiet down, then snap once.
      scrollDebounceRef.current = setTimeout(() => {
        scrollToBottom(true, false);
        scrollDebounceRef.current = null;
      }, SCROLL_DEBOUNCE_MS);
    } else {
      scrollToBottom(false, true);
    }
  }, [messagesLength, typingPeer]);

  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

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
