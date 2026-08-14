import React from 'react';
import { X } from 'lucide-react';

interface CreateRoomModalProps {
  show: boolean;
  isDark: boolean;
  newRoomName: string;
  setNewRoomName: (val: string) => void;
  newRoomLocked: boolean;
  setNewRoomLocked: (val: boolean) => void;
  statusMessage: string;
  isCreatingRoom?: boolean;
  onClose: () => void;
  onCreateRoom: () => void;
}

export default function CreateRoomModal({
  show,
  isDark,
  newRoomName,
  setNewRoomName,
  newRoomLocked,
  setNewRoomLocked,
  statusMessage,
  isCreatingRoom = false,
  onClose,
  onCreateRoom,
}: CreateRoomModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center modal-backdrop pt-20 px-4 animate-fade-in">
      <div className={`w-full max-w-xs rounded-xl p-5 border shadow-2xl ${isDark ? 'bg-velum-850 border-white-10 text-white' : 'bg-text-primary border-velum-600 text-velum-900'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider">Create Lounge Room</h3>
          <button 
            onClick={onClose} 
            disabled={isCreatingRoom}
            className="text-text-secondary hover:text-white cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Room Name</label>
            <input
              type="text"
              placeholder="e.g. general-chat"
              value={newRoomName}
              disabled={isCreatingRoom}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isCreatingRoom) {
                  onCreateRoom();
                }
              }}
              className={`w-full p-2.5 rounded-lg border text-xs outline-none transition disabled:opacity-50 ${
                isDark
                  ? 'bg-velum-900 border-white-5 text-white focus:border-accent/50'
                  : 'bg-text-primary border-velum-600 text-velum-900 focus:border-accent'
              }`}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="isLocked"
              checked={newRoomLocked}
              disabled={isCreatingRoom}
              onChange={e => setNewRoomLocked(e.target.checked)}
              className="w-4 h-4 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0 cursor-pointer disabled:opacity-50"
            />
            <label htmlFor="isLocked" className="text-[10px] font-bold uppercase tracking-wider text-text-secondary cursor-pointer select-none">Locked VIP Room</label>
          </div>

          {statusMessage && (
            <div className="text-accent text-[9.5px] font-mono uppercase bg-accent/5 border border-accent/10 p-2.5 rounded-xl">
              {statusMessage}
            </div>
          )}

          <button 
            onClick={onCreateRoom}
            disabled={isCreatingRoom}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isCreatingRoom ? 'Creating Room...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
