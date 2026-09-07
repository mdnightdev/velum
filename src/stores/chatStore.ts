import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Message } from '../types';

export interface ChatStoreState {
  activeRoomId: string;
  activeChatPeer: { userId: number; username: string; avatar?: string } | null;
  activeCategory: 'direct' | 'rooms' | 'people' | 'notifications' | 'settings';
  wsConnected: boolean;
  messages: Message[];
  lastMessages: Record<string, Message>;
  unreadCounts: Record<string, number>;
  roomMaxSeq: Record<string, number>;

  // Actions
  setActiveRoomId: (roomId: string) => void;
  setActiveChatPeer: (peer: { userId: number; username: string; avatar?: string } | null) => void;
  setActiveCategory: (category: 'direct' | 'rooms' | 'people' | 'notifications' | 'settings') => void;
  setWsConnected: (connected: boolean) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  appendMessage: (message: Message) => void;
  mergeMessages: (messages: Message[]) => void;
  updateMessage: (matcher: (m: Message) => boolean, updater: (m: Message) => Message) => void;
  removeMessage: (idOrClientMsgId: string | number) => void;
  clearRoomMessages: (roomId: string) => void;
  setLastMessage: (roomId: string, message: Message) => void;
  setLastMessages: (messages: Record<string, Message> | ((prev: Record<string, Message>) => Record<string, Message>)) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  setUnreadCounts: (counts: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  resetUnreadCount: (roomId: string) => void;
  clearRoomUnread: (roomId: string) => void;
  setRoomMaxSeq: (roomId: string, seq: number) => void;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      activeRoomId: '',
      activeChatPeer: null,
      activeCategory: 'direct',
      wsConnected: false,
      messages: [],
      lastMessages: {},
      unreadCounts: {},
      roomMaxSeq: {},

      setActiveRoomId: (roomId) => set({ activeRoomId: roomId }),
      setActiveChatPeer: (peer) => set({ activeChatPeer: peer }),
      setActiveCategory: (category) => set({ activeCategory: category }),
      setWsConnected: (connected) => set({ wsConnected: connected }),

      setMessages: (updater) => {
        set((state) => ({
          messages: typeof updater === 'function' ? updater(state.messages) : updater
        }));
      },

      appendMessage: (message) => {
        set((state) => {
          const incomingKey = String(message.id ?? message.client_msg_id ?? message.message_id ?? '');
          const clientKey = message.client_msg_id ? String(message.client_msg_id) : null;

          const existsIdx = state.messages.findIndex((m) => {
            const currentKey = String(m.id ?? m.client_msg_id ?? m.message_id ?? '');
            if (incomingKey && currentKey === incomingKey) return true;
            if (clientKey && (m.client_msg_id === clientKey || String(m.id) === clientKey)) return true;
            return false;
          });

          if (existsIdx !== -1) {
            const next = [...state.messages];
            const existing = next[existsIdx];
            next[existsIdx] = {
              ...message,
              plaintext: message.plaintext || existing.plaintext
            };
            return { messages: next };
          }

          return { messages: [...state.messages, message] };
        });
      },

      mergeMessages: (incomingList) => {
        if (!incomingList || incomingList.length === 0) return;
        set((state) => {
          const nextList = [...state.messages];
          incomingList.forEach((incoming) => {
            const incomingKey = String(incoming.id ?? incoming.client_msg_id ?? incoming.message_id ?? '');
            const clientKey = incoming.client_msg_id ? String(incoming.client_msg_id) : null;

            let existingIdx = -1;
            for (let i = 0; i < nextList.length; i++) {
              const m = nextList[i];
              const curKey = String(m.id ?? m.client_msg_id ?? m.message_id ?? '');
              if (incomingKey && curKey === incomingKey) {
                existingIdx = i;
                break;
              }
              if (clientKey && (m.client_msg_id === clientKey || String(m.id) === clientKey)) {
                existingIdx = i;
                break;
              }
            }

            if (existingIdx !== -1) {
              const existing = nextList[existingIdx];
              nextList[existingIdx] = {
                ...existing,
                ...incoming,
                plaintext: incoming.plaintext || existing.plaintext,
                status: incoming.status || existing.status
              };
            } else {
              nextList.push(incoming);
            }
          });

          nextList.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
          return { messages: nextList };
        });
      },

      updateMessage: (matcher, updater) => {
        set((state) => ({
          messages: state.messages.map((m) => (matcher(m) ? updater(m) : m))
        }));
      },

      removeMessage: (idOrClientMsgId) => {
        const targetStr = String(idOrClientMsgId);
        set((state) => ({
          messages: state.messages.filter(
            (m) =>
              String(m.id) !== targetStr &&
              String(m.client_msg_id) !== targetStr &&
              String(m.message_id) !== targetStr
          )
        }));
      },

      clearRoomMessages: (roomId) => {
        set((state) => {
          const nextLast = { ...state.lastMessages };
          delete nextLast[roomId];
          const cleanTarget = roomId.replace(/^#\s*/, '');
          const filtered = state.messages.filter((m) => {
            const mRoom = String(m.room_id || m.lounge_id || '').replace(/^#\s*/, '');
            return mRoom !== cleanTarget;
          });
          return {
            messages: filtered,
            lastMessages: nextLast
          };
        });
      },

      setLastMessage: (roomId, message) => {
        set((state) => ({
          lastMessages: {
            ...state.lastMessages,
            [roomId]: message
          }
        }));
      },

      setLastMessages: (updater) => {
        set((state) => ({
          lastMessages: typeof updater === 'function' ? updater(state.lastMessages) : { ...state.lastMessages, ...updater }
        }));
      },

      setUnreadCount: (roomId, count) => {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [roomId]: Math.max(0, count)
          }
        }));
      },

      setUnreadCounts: (updater) => {
        set((state) => ({
          unreadCounts: typeof updater === 'function' ? updater(state.unreadCounts) : { ...state.unreadCounts, ...updater }
        }));
      },

      resetUnreadCount: (roomId) => {
        set((state) => {
          if (!state.unreadCounts[roomId]) return state;
          const next = { ...state.unreadCounts };
          delete next[roomId];
          return { unreadCounts: next };
        });
      },

      clearRoomUnread: (roomId) => {
        set((state) => {
          if (!state.unreadCounts[roomId]) return state;
          const next = { ...state.unreadCounts };
          delete next[roomId];
          return { unreadCounts: next };
        });
      },

      setRoomMaxSeq: (roomId, seq) => {
        set((state) => {
          const current = state.roomMaxSeq[roomId] || 0;
          if (seq > current) {
            return {
              roomMaxSeq: {
                ...state.roomMaxSeq,
                [roomId]: seq
              }
            };
          }
          return state;
        });
      }
    }),
    {
      name: 'velum_chat_state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeCategory: state.activeCategory,
        lastMessages: state.lastMessages,
        unreadCounts: state.unreadCounts,
        roomMaxSeq: state.roomMaxSeq
      })
    }
  )
);
