import React from 'react';
import { Hash, Lock } from 'lucide-react';
import { OutlinedSeal, FilledSeal, LockedSeal, cleanRoomName } from './SealIcons';
import { decryptMessageSync } from '../../services/encryptionService';

interface RoomsListProps {
  publicRooms: any[];
  privateRooms: any[];
  activeRoomId: string;
  isDark: boolean;
  isMasterLounge: boolean;
  currentUserId: number;
  unreadCounts?: Record<string, number>;
  lastMessages?: Record<string, any>;
  typingRooms: Record<string, Set<string>>;
  onRoomSelect: (roomId: string) => void;
}

export default function RoomsList({
  publicRooms,
  privateRooms,
  activeRoomId,
  isDark,
  isMasterLounge,
  currentUserId,
  unreadCounts,
  lastMessages,
  typingRooms,
  onRoomSelect,
}: RoomsListProps) {
  const getRoomId = (room: any): string | null => {
    if (!room) return null;
    return room.id || room.room_id || null;
  };

  const renderRoomRow = (room: any, type: 'public' | 'private_owned' | 'private_locked' | 'exec') => {
    const roomId = getRoomId(room);
    if (!roomId) return null;
    const isActive = activeRoomId === roomId;
    const isLockedCard = type === 'private_locked';
    const cleanName = cleanRoomName(room.name);
    const lm = lastMessages?.[roomId];

    return (
      <div
        key={roomId}
        onClick={isLockedCard ? undefined : () => onRoomSelect(roomId)}
        className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-150 ${
          isLockedCard
            ? 'opacity-50 cursor-not-allowed border border-white-5 bg-velum-800'
            : isActive
              ? (isDark ? 'bg-white-10 text-white shadow-inner scale-[0.99]' : 'bg-gray-200 text-gray-900 shadow-inner scale-[0.99]')
              : (isDark ? 'hover:bg-white-5 text-text-secondary hover:text-text-primary hover:scale-[1.01]' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:scale-[1.01]')
        }`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-velum-900 border border-white-5 overflow-hidden shrink-0 text-text-secondary relative">
          {isMasterLounge ? (
            room.accessLevel === 'ANNOUNCE' ? <div className="text-[14px]">📢</div> : 
            room.accessLevel === 'EXEC_ONLY' ? <div className="text-[14px]">🤫</div> : 
            <Hash className="w-4 h-4 opacity-70" />
          ) : (
            <>
              {type === 'public' && <OutlinedSeal />}
              {type === 'private_owned' && <FilledSeal />}
              {type === 'private_locked' && <LockedSeal />}
              {type === 'exec' && <Lock className="w-4 h-4" />}
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <div className="text-xs font-bold truncate uppercase tracking-wider">{cleanName}</div>
          </div>
          {typingRooms[roomId] && typingRooms[roomId].size > 0 ? (
            <div className="text-[9px] text-accent font-semibold flex items-center gap-1 animate-pulse truncate uppercase tracking-wider mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> 
              {Array.from(typingRooms[roomId]).join(', ')} typing...
            </div>
          ) : isLockedCard ? (
            <div className="text-[9px] text-text-disabled truncate uppercase tracking-wider mt-0.5">Locked Sublounge</div>
          ) : (
            room.description && <div className="text-[9px] opacity-60 truncate mt-0.5">{room.description}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4 font-sans">
      {publicRooms.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary px-3 mb-2">Rooms</div>
          {publicRooms.map((room, index) => {
            const rId = getRoomId(room) || `pub-room-${index}`;
            return (
              <React.Fragment key={rId}>
                {renderRoomRow(room, 'public')}
              </React.Fragment>
            );
          })}
        </div>
      )}
      {privateRooms.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white-5">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary px-3 mb-2">Private</div>
          {privateRooms.map((room, index) => {
            const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(currentUserId);
            const rId = getRoomId(room) || `priv-room-${index}`;
            const roomType = isMasterLounge 
              ? 'exec' 
              : (isCreator ? 'private_owned' : 'private_locked');
            return (
              <React.Fragment key={rId}>
                {renderRoomRow(room, roomType)}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
