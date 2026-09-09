import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Message } from '../types';
import { isTabSessionScope } from '../services/storageService';
import { isUsablePlaintext, mergeMessagePlaintext } from '../utils/messagePlaintext';
import {
  collectRoomKeysForMessage,
  decrementUnreadForAliases,
  isUnreadIncoming,
  messageIdentityKeys,
  messageRefEquals,
  purgeExpiredChatState,
  recomputeLastMessagesAfterRemoval,
} from '../utils/roomPreview';

/** Tab-scoped chat persist so multi-account tabs do not share lastMessages/unreads. */
const tabAwareChatStorage: StateStorage = {
  getItem: (name) => {
    const key = isTabSessionScope() ? `${name}__tab` : name;
    const backend = isTabSessionScope() ? sessionStorage : localStorage;
    return backend.getItem(key);
  },
  setItem: (name, value) => {
    const key = isTabSessionScope() ? `${name}__tab` : name;
    const backend = isTabSessionScope() ? sessionStorage : localStorage;
    backend.setItem(key, value);
  },
  removeItem: (name) => {
    const key = isTabSessionScope() ? `${name}__tab` : name;
    const backend = isTabSessionScope() ? sessionStorage : localStorage;
    backend.removeItem(key);
  }
};

export interface ChatStoreState {
  activeRoomId: string;
  activeChatPeer: { userId: number; username: string; avatar?: string } | null;
  activeCategory: 'direct' | 'rooms' | 'people' | 'notifications' | 'settings';
  wsConnected: boolean;
  messages: Message[];
  lastMessages: Record<string, Message>;
  unreadCounts: Record<string, number>;
  roomMaxSeq: Record<string, number>;
  /** Session-only: purged/deleted ids so relationships last_message cannot resurrect them. */
  forgottenPreviewIds: Record<string, true>;

  // Actions
  setActiveRoomId: (roomId: string) => void;
  setActiveChatPeer: (peer: { userId: number; username: string; avatar?: string } | null) => void;
  setActiveCategory: (category: 'direct' | 'rooms' | 'people' | 'notifications' | 'settings') => void;
  setWsConnected: (connected: boolean) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  appendMessage: (message: Message) => void;
  mergeMessages: (messages: Message[]) => void;
  updateMessage: (matcher: (m: Message) => boolean, updater: (m: Message) => Message) => void;
  updatePlaintexts: (keyToPlaintext: Record<string, string>) => void;
  removeMessage: (idOrClientMsgId: string | number) => void;
  /** Remove message and recompute lastMessages (+ optional unread) for its room. */
  removeMessageRecompute: (
    idOrClientMsgId: string | number,
    opts?: { currentUserId?: number | null; roomId?: string | null; adjustUnread?: boolean }
  ) => Message | null;
  /** Purge expired disappearing messages from list + lastMessages; fix unread. */
  purgeExpired: (nowMs?: number, currentUserId?: number | null) => Message[];
  forgetPreviewIds: (ids: Array<string | number | null | undefined>) => void;
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
      forgottenPreviewIds: {},

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
            const existingServerId = existing.db_message_id ?? existing.id ?? existing.message_id;
            const incomingServerId = message.db_message_id ?? message.id ?? message.message_id;
            // True duplicate delivery (not optimistic→ack merge)
            if (
              existingServerId != null &&
              incomingServerId != null &&
              String(existingServerId) === String(incomingServerId) &&
              existing.status &&
              existing.status !== 'sending' &&
              existing.status !== 'pending'
            ) {
              void import('../utils/diagnostics').then(({ reportClientOpsEvent }) => {
                reportClientOpsEvent({
                  severity: 'amber',
                  code: 'CHAT_DUP_APPEND_DROPPED',
                  message: 'Duplicate server message append recovered',
                  component: 'chatStore',
                });
              });
            }
            next[existsIdx] = {
              ...message,
              plaintext: mergeMessagePlaintext(existing.plaintext, message.plaintext)
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
                plaintext: mergeMessagePlaintext(existing.plaintext, incoming.plaintext),
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

      updatePlaintexts: (keyToPlaintext) => {
        set((state) => {
          let hasChange = false;
          const nextList = state.messages.map((m) => {
            const keys = [m.message_id, m.id, m.client_msg_id, m.nonce, (m as any).db_message_id]
              .filter(Boolean)
              .map(String);
            for (const k of keys) {
              const pt = keyToPlaintext[k];
              if (!pt || pt === m.plaintext) continue;
              if (!isUsablePlaintext(pt)) continue;
              if (isUsablePlaintext(m.plaintext)) continue;
              hasChange = true;
              return { ...m, plaintext: pt };
            }
            if (m.content && keyToPlaintext[m.content] && !isUsablePlaintext(m.plaintext)) {
              const pt = keyToPlaintext[m.content];
              if (isUsablePlaintext(pt)) {
                hasChange = true;
                return { ...m, plaintext: pt };
              }
            }
            return m;
          });

          const nextLast = { ...state.lastMessages };
          const stampedByContent = new Map<string, string>();
          for (const [roomId, m] of Object.entries(state.lastMessages)) {
            if (!m) continue;
            const keys = [m.message_id, m.id, m.client_msg_id, m.nonce, (m as any).db_message_id]
              .filter(Boolean)
              .map(String);
            let stamped: string | undefined;
            for (const k of keys) {
              const pt = keyToPlaintext[k];
              if (!pt || !isUsablePlaintext(pt)) continue;
              if (isUsablePlaintext(m.plaintext) && m.plaintext === pt) continue;
              if (isUsablePlaintext(m.plaintext)) break;
              stamped = pt;
              break;
            }
            if (!stamped && m.content && keyToPlaintext[m.content] && !isUsablePlaintext(m.plaintext)) {
              const pt = keyToPlaintext[m.content];
              if (isUsablePlaintext(pt)) stamped = pt;
            }
            if (!stamped) continue;
            nextLast[roomId] = { ...m, plaintext: stamped };
            if (m.content) stampedByContent.set(m.content, stamped);
            hasChange = true;
          }

          // Propagate the same plaintext onto every alias that still holds the same ciphertext.
          if (stampedByContent.size > 0) {
            for (const [roomId, m] of Object.entries(nextLast)) {
              if (!m?.content) continue;
              const pt = stampedByContent.get(m.content);
              if (!pt || isUsablePlaintext(m.plaintext)) continue;
              nextLast[roomId] = { ...m, plaintext: pt };
              hasChange = true;
            }
          }

          if (!hasChange) return state;
          return {
            messages: nextList,
            lastMessages: nextLast,
          };
        });
      },

      removeMessage: (idOrClientMsgId) => {
        const targetStr = String(idOrClientMsgId);
        set((state) => ({
          messages: state.messages.filter((m) => !messageRefEquals(m, targetStr))
        }));
      },

      removeMessageRecompute: (idOrClientMsgId, opts) => {
        const targetStr = String(idOrClientMsgId);
        const currentUserId = opts?.currentUserId;
        let removed: Message | null = null;

        set((state) => {
          removed =
            state.messages.find((m) => messageRefEquals(m, targetStr)) ||
            Object.values(state.lastMessages).find((m) => messageRefEquals(m, targetStr)) ||
            null;

          if (!removed && opts?.roomId) {
            removed = {
              id: targetStr,
              message_id: targetStr,
              room_id: opts.roomId,
            } as Message;
          }
          if (!removed) {
            return {
              messages: state.messages.filter((m) => !messageRefEquals(m, targetStr)),
            };
          }

          const messages = state.messages.filter((m) => !messageRefEquals(m, targetStr));
          const lastMessages = recomputeLastMessagesAfterRemoval(
            state.lastMessages,
            messages,
            removed,
            currentUserId,
            opts?.roomId
          );

          let unreadCounts = state.unreadCounts;
          if (opts?.adjustUnread && isUnreadIncoming(removed, currentUserId)) {
            unreadCounts = decrementUnreadForAliases(
              unreadCounts,
              collectRoomKeysForMessage(removed, currentUserId, opts?.roomId),
              1
            );
          }

          const forgottenPreviewIds = { ...state.forgottenPreviewIds };
          for (const id of messageIdentityKeys(removed)) {
            forgottenPreviewIds[id] = true;
          }
          forgottenPreviewIds[targetStr] = true;

          return { messages, lastMessages, unreadCounts, forgottenPreviewIds };
        });

        return removed;
      },

      purgeExpired: (nowMs = Date.now(), currentUserId) => {
        let purged: Message[] = [];
        set((state) => {
          const result = purgeExpiredChatState(
            {
              messages: state.messages,
              lastMessages: state.lastMessages,
              unreadCounts: state.unreadCounts,
            },
            nowMs,
            currentUserId
          );
          purged = result.purged as Message[];
          if (purged.length === 0) return state;
          const forgottenPreviewIds = { ...state.forgottenPreviewIds };
          for (const msg of purged) {
            for (const id of messageIdentityKeys(msg)) {
              forgottenPreviewIds[id] = true;
            }
          }
          return {
            messages: result.messages as Message[],
            lastMessages: result.lastMessages as Record<string, Message>,
            unreadCounts: result.unreadCounts,
            forgottenPreviewIds,
          };
        });
        return purged;
      },

      forgetPreviewIds: (ids) => {
        set((state) => {
          const forgottenPreviewIds = { ...state.forgottenPreviewIds };
          let changed = false;
          for (const raw of ids) {
            if (raw == null || raw === '') continue;
            const id = String(raw);
            if (!forgottenPreviewIds[id]) {
              forgottenPreviewIds[id] = true;
              changed = true;
            }
          }
          return changed ? { forgottenPreviewIds } : state;
        });
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
        set((state) => {
          const forgottenPreviewIds = { ...state.forgottenPreviewIds };
          for (const id of messageIdentityKeys(message)) {
            delete forgottenPreviewIds[id];
          }
          const prev = state.lastMessages[roomId];
          const sameAsPrev =
            !!prev &&
            (messageIdentityKeys(message).some((id) => messageRefEquals(prev, id)) ||
              (!!prev.content && !!message.content && prev.content === message.content));
          const nextMessage = { ...message };
          if (sameAsPrev) {
            const merged = mergeMessagePlaintext(prev.plaintext, message.plaintext);
            if (merged !== undefined) nextMessage.plaintext = merged;
            else if (isUsablePlaintext(prev.plaintext) && !isUsablePlaintext(message.plaintext)) {
              nextMessage.plaintext = prev.plaintext;
            }
          }
          return {
            lastMessages: {
              ...state.lastMessages,
              [roomId]: nextMessage,
            },
            forgottenPreviewIds,
          };
        });
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
      storage: createJSONStorage(() => tabAwareChatStorage),
      partialize: (state) => ({
        activeCategory: state.activeCategory,
        lastMessages: state.lastMessages,
        unreadCounts: state.unreadCounts,
        roomMaxSeq: state.roomMaxSeq
      })
    }
  )
);
