export interface LoungeWorkspaceProps {
  loungeId: string;
  loungeName: string;
  currentUserId: number;
  currentUsername: string;
  currentUserRole: string;
  activeRoomId: string;
  onRoomSelect: (roomId: string) => void;
  onLoungeSelect: (loungeId: string, loungeName: string) => void;
  onBackToDirectory: () => void;
  isDark: boolean;
  messages: any[];
  wsConnected: boolean;
  lastMessages?: Record<string, any>;
  unreadCounts?: Record<string, number>;
  onSendMessage?: (text: string, burnSeconds: number | null, isEncrypted: boolean, targetRoomId?: string, replyTo?: string | number) => void;
  onSendTyping?: (isTyping: boolean) => void;
  onRoomKick?: (userId: number) => void;
  onRoomMute?: (userId: number, mute: boolean) => void;
  onSendReaction?: (messageId: string, roomId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, roomId: string, content: string) => void;
  onDeleteMessage?: (messageId: string, roomId: string) => void;
  onPinMessage?: (messageId: string, roomId: string, pin: boolean) => void;
  onMarkAsRead?: (messageId: string, roomId: string) => void;
  onMarkAllAsRead?: (roomId: string) => void;
  onToggleSidebar?: () => void;
}

export interface LoungeRoom {
  id?: string;
  room_id?: string;
  name: string;
  is_private?: boolean;
  topic?: string;
  category?: string;
}

export interface LoungeMember {
  user_id?: number;
  userId?: number;
  username: string;
  displayName?: string;
  role?: string;
  status?: string;
  pfpUrl?: string;
  pfp_url?: string;
  custom_status?: string;
  customStatus?: string;
  roleName?: string;
}

export interface LoungeDetails {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  invite_code?: string;
  role?: string;
  owner_id?: number;
}
