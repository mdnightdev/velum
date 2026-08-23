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
    <div className="fixed inset-0 z-[9999] flex justify-end modal-backdrop animate-fade-in" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-velum-600">
            <h3 className="text-sm font-semibold text-text-primary">Create Room</h3>
            <button 
              onClick={onClose} 
              disabled={isCreatingRoom}
              className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Room Name</label>
              <input
                type="text"
                value={newRoomName}
                disabled={isCreatingRoom}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isCreatingRoom && newRoomName.trim()) {
                    onCreateRoom();
                  }
                }}
                className="w-full p-2.5 rounded-lg border border-velum-600 bg-velum-750 text-xs text-text-primary outline-none focus:border-accent/40 transition disabled:opacity-50"
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-velum-600 bg-velum-750">
              <span className="text-xs font-medium text-text-primary">Private Room</span>
              <input 
                type="checkbox" 
                id="isLocked"
                checked={newRoomLocked}
                disabled={isCreatingRoom}
                onChange={e => setNewRoomLocked(e.target.checked)}
                className="w-4 h-4 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0 cursor-pointer disabled:opacity-50"
              />
            </div>

            {statusMessage && (
              <div className="text-accent text-xs bg-accent/10 border border-accent/20 p-2.5 rounded-lg">
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-velum-600 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreatingRoom}
            className="flex-1 py-2 rounded-lg border border-velum-600 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={onCreateRoom}
            disabled={isCreatingRoom || !newRoomName.trim()}
            className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            {isCreatingRoom ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
