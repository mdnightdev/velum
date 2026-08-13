import { useState } from 'react';
import { getSessionId } from '../../../utils/auth';
import type { Message } from '../../../types';

interface UseMessageSearchProps {
  roomId: string;
  conversationMessages: Message[];
  decryptedMap: Record<string, string>;
  handleScrollToMessage: (messageId: string) => void;
}

export function useMessageSearch({
  roomId,
  conversationMessages,
  decryptedMap,
  handleScrollToMessage
}: UseMessageSearchProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIndex, setSearchIndex] = useState(-1);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(-1);
      return;
    }
    setIsSearching(true);
    try {
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/${roomId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      const data = await res.json();
      const dbMatches = data.messages || [];

      const queryLower = searchQuery.toLowerCase();
      const localMatches = conversationMessages.filter(m => {
        if (m.deleted) return false;
        const plainText = decryptedMap[m.message_id] || m.content || '';
        return plainText.toLowerCase().includes(queryLower);
      });

      const seenKeys = new Set<string>();
      const merged: any[] = [];

      for (const m of localMatches) {
        const key = String(m.db_message_id || m.message_id);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          merged.push({
            id: m.db_message_id || m.message_id,
            message_id: m.message_id,
            db_message_id: m.db_message_id,
            senderName: m.username,
            content: decryptedMap[m.message_id] || m.content,
            createdAt: m.timestamp
          });
        }
      }

      for (const m of dbMatches) {
        const key = String(m.id || m.message_id);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          merged.push({
            id: m.id,
            message_id: String(m.id),
            db_message_id: m.id,
            senderName: m.senderName || m.username,
            content: m.content,
            createdAt: m.createdAt
          });
        }
      }

      setSearchResults(merged);
      setSearchIndex(merged.length > 0 ? 0 : -1);
      if (merged.length > 0) {
        const firstMatch = merged[0];
        handleScrollToMessage(String(firstMatch.db_message_id || firstMatch.message_id));
      }
    } catch (err) {
      console.error('[Search] Failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    let nextIdx = searchIndex;
    if (direction === 'next') {
      nextIdx = (searchIndex + 1) % searchResults.length;
    } else {
      nextIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
    }
    setSearchIndex(nextIdx);
    const target = searchResults[nextIdx];
    handleScrollToMessage(String(target.db_message_id || target.message_id));
  };

  return {
    showSearch,
    setShowSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    searchIndex,
    setSearchIndex,
    handleSearch,
    handleNavigateSearch
  };
}
