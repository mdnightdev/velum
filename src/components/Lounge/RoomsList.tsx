import React from 'react';
import { Trash2 } from 'lucide-react';
import { cleanRoomName } from './SealIcons';

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
  isParentAdmin?: boolean;
  onRoomSelect: (roomId: string) => void;
  onDeleteRoom?: (roomId: string) => void;
}

export default function RoomsList({
  publicRooms,
  privateRooms,
  activeRoomId,
  isDark,
  isMasterLounge,
  currentUserId,
  typingRooms,
  isParentAdmin,
  onRoomSelect,
  onDeleteRoom,
}: RoomsListProps) {
  const getRoomId = (room: any): string | null => {
    if (!room) return null;
    return room.id || room.room_id || null;
  };

  const renderRoomRow = (room: any, locked: boolean) => {
    const roomId = getRoomId(room);
    if (!roomId) return null;
    const isActive = activeRoomId === roomId;
    const cleanName = cleanRoomName(room.name || '');
    const isRoomOwner = String(room.owner_id || room.ownerId || room.created_by) === String(currentUserId);
    const canDeleteThisRoom = !isMasterLounge && onDeleteRoom && (isRoomOwner || isParentAdmin);

    return (
      <div
        key={roomId}
        onClick={locked ? undefined : () => onRoomSelect(roomId)}
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors duration-150 ${
          locked
            ? 'opacity-50 cursor-not-allowed'
            : isActive
              ? (isDark ? 'bg-white-10 text-white' : 'bg-gray-200 text-gray-900')
              : (isDark ? 'hover:bg-white-5 text-text-secondary hover:text-text-primary' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900')
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate leading-snug">{cleanName}</div>
          {typingRooms[roomId] && typingRooms[roomId].size > 0 && (
            <div className="text-[10px] text-accent truncate mt-0.5">typing…</div>
          )}
        </div>

        {canDeleteThisRoom && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete room "${cleanName}"?`)) {
                onDeleteRoom(roomId);
              }
            }}
            title="Delete Room"
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-alert-error/20 text-alert-error rounded-lg transition-opacity cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  const allRooms = [...publicRooms, ...privateRooms];

  return (
    <div className="flex flex-col gap-1 p-2.5 font-sans">
      {allRooms.map((room, index) => {
        const isPrivate = !!(room.is_locked || room.visibility === 'private' || room.is_private === 1);
        const isCreator = String(room.created_by || room.owner_id || room.owner_user_id) === String(currentUserId);
        const locked = isPrivate && !isMasterLounge && !isCreator && !isParentAdmin;
        const rId = getRoomId(room) || `room-${index}`;
        return <React.Fragment key={rId}>{renderRoomRow(room, locked)}</React.Fragment>;
      })}
    </div>
  );
}
