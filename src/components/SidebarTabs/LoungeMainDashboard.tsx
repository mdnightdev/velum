import React, { useState, useEffect } from 'react';
import { Globe, Plus, X,Link } from 'lucide-react';

interface LoungeMainDashboardProps {
  currentUserId: number;
  isDark: boolean;
  onLoungeSelect: (loungeId: string, loungeName: string) => void;
  onSectionView?: (view: any) => void;
}

export default function LoungeMainDashboard({
  currentUserId,
  isDark,
  onLoungeSelect,
  onSectionView
}: LoungeMainDashboardProps) {
  const [lounges, setLounges] = useState<any[]>([]);
  const [roomsMap, setRoomsMap] = useState<Record<string, any[]>>({});
  
  // Create Room State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetLoungeId, setTargetLoungeId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLocked, setNewRoomLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [joinRoomId, setJoinRoomId] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const [showJoinLoungeMobileModal, setShowJoinLoungeMobileModal] = useState(false);
  const [loungeInviteCodeInput, setLoungeInviteCodeInput] = useState('');
  const [loungeStatusMessage, setLoungeStatusMessage] = useState('');
  // Create Lounge State
  const [showCreateLoungeModal, setShowCreateLoungeModal] = useState(false);
  const [newLoungeName, setNewLoungeName] = useState('');
  const [newLoungeDescription, setNewLoungeDescription] = useState('');
  const [newLoungeInviteCode, setNewLoungeInviteCode] = useState('');
  const [loungeError, setLoungeError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateLounge = async () => {
    if (!newLoungeName.trim()) {
      setLoungeError('Lounge name is required.');
      return;
    }
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch('/api/lounges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sid}`
        },
        body: JSON.stringify({
          name: newLoungeName,
          description: newLoungeDescription,
          invite_code: newLoungeInviteCode
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create lounge.');
      }

      setNewLoungeName('');
      setNewLoungeDescription('');
      setNewLoungeInviteCode('');
      setLoungeError('');
      setShowCreateLoungeModal(false);
      await loadLounges();
    } catch (err: any) {
      setLoungeError(err.message || 'Something went wrong.');
    }
  };


  const loadLounges = async () => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const headers = { 'Authorization': `Bearer ${sid}` };
      const res = await fetch('/api/lounges', { headers });
      if (res.ok) {
        const data = await res.json();
        setLounges(data);
        const map: Record<string, any[]> = {};
        await Promise.all(data.map(async (c: any) => {
          try {
            const roomRes = await fetch(`/api/lounges/${c.lounge_id}/rooms`, { headers });
            if (roomRes.ok) {
              const roomData = await roomRes.json();
              map[c.lounge_id] = roomData;
            }
          } catch (chanErr) {
            console.warn('Failed to fetch rooms', chanErr);
          }
        }));
        setRoomsMap(map);
      }
    } catch (err) {
      console.error('Failed to load lounges', err);
    }
  };

  useEffect(() => {
    loadLounges();
  }, []);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setStatusMessage('Room name is required.');
      return;
    }
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${targetLoungeId}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_locked: newRoomLocked
        })
      });
      if (res.ok) {
        setNewRoomName('');
        setNewRoomLocked(false);
        setShowCreateModal(false);
        setStatusMessage('');
        loadLounges();
      } else {
        const err = await res.json();
        setStatusMessage(err.error || 'Failed to create room.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setStatusMessage('Error creating room.');
    }
  };

  const handleJoinRoom = async (loungeId: string, roomId: string, code?: string) => {
    try {
      const sid = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/${loungeId}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_code: code })
      });
      
      if (res.ok) {
        setShowJoinModal(false);
        setInviteCodeInput('');
        setJoinRoomId('');
        setStatusMessage('');
        onLoungeSelect(loungeId, '');
        if (onSectionView) onSectionView('chat');
      } else if (res.status === 403) {
        setJoinRoomId(roomId);
        setTargetLoungeId(loungeId);
        setShowJoinModal(true);
        if (code) {
          setStatusMessage('Invalid invite code.');
        } else {
          setStatusMessage('');
        }
      } else {
        const err = await res.json();
        setStatusMessage(err.error || 'Failed to join room.');
        if (!code) {
          setJoinRoomId(roomId);
          setTargetLoungeId(loungeId);
          setShowJoinModal(true);
        }
      }
    } catch (err) {
      console.error('Error joining room:', err);
    }
  };

  const handleJoinLoungeMobile = async () => {
    if (!loungeInviteCodeInput.trim()) return;
    try {
      const sId = sessionStorage.getItem('velum-sessionId') || '';
      const res = await fetch(`/api/lounges/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_code: loungeInviteCodeInput })
      });
      if (res.ok) {
        setShowJoinLoungeMobileModal(false);
        setLoungeInviteCodeInput('');
        setLoungeStatusMessage('');
        loadLounges();
      } else {
        const err = await res.json();
        setLoungeStatusMessage(err.error || 'Failed to join lounge.');
      }
    } catch (err) {
      console.error('Error joining lounge:', err);
      setLoungeStatusMessage('Error joining lounge.');
    }
  };
  return (
    <div className={`flex-1 flex flex-col w-full h-full select-none font-sans relative ${isDark ? 'bg-transparent' : 'bg-transparent'}`}>
      
      {/* Search Header Bar */}
      <div className={`p-3 border-b flex-shrink-0 ${isDark ? 'border-white-5 bg-velum-850' : 'border-velum-600 bg-white-10'}`}>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search lounges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all ${
              isDark 
                ? 'bg-velum-800 border-white-10 text-white placeholder:text-text-disabled focus:border-white-10' 
                : 'bg-white-10 border-velum-600 text-velum-900 placeholder:text-text-disabled focus:border-accent'
            }`}
          />
          <span className="absolute left-2.5 text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.603Z" /></svg>
          </span>
        </div>
      </div>

      {/* Main Flat List Area */}
      <div className="flex-1 overflow-y-auto">
        {lounges.filter((lounge) => lounge.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
          <div className={`p-8 text-center font-mono text-[10px] uppercase tracking-widest ${isDark ? 'text-text-secondary/60' : 'text-text-disabled'}`}>
            // No communities found //
          </div>
        ) : (
          lounges
            .filter((lounge) => lounge.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((lounge) => (
              <div
                key={lounge.lounge_id}
                onClick={() => onLoungeSelect(lounge.lounge_id, lounge.name)}
                className={`px-4 py-3 border-b cursor-pointer transition-all duration-200 ${
                  isDark 
                    ? 'border-white-5 hover:bg-velum-700 text-white' 
                    : 'border-velum-600 hover:bg-white-5 text-velum-900'
                }`}
              >
                <div className="font-bold text-xs uppercase tracking-wider">{lounge.name}</div>
                {lounge.description && (
                  <div className={`text-[10px] mt-0.5 opacity-60 truncate ${isDark ? 'text-text-secondary' : 'text-text-secondary'}`}>
                    {lounge.description}
                  </div>
                )}
              </div>
            ))
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-20 right-4 z-50 flex flex-col-reverse gap-3">
        {/* Create Lounge Button */}
        <button
          onClick={() => setShowCreateLoungeModal(true)}
          className={`p-3.5 rounded-full border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md ${
            isDark 
              ? 'bg-accent-10 border-accent-20 text-accent hover:bg-accent-20 hover:border-accent-40 shadow-black-60' 
              : 'bg-white-10 border-velum-600 text-text-secondary hover:text-velum-900 shadow-lg'
          }`}
          title="Create a Lounge"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Join Lounge Button */}
        <button
          onClick={() => setShowJoinLoungeMobileModal(true)}
          className={`p-3.5 rounded-full border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md ${
            isDark 
              ? 'bg-white-2 border-white-10 text-text-secondary hover:text-white shadow-black-60' 
              : 'bg-white-10 border-velum-600 text-text-disabled hover:text-velum-900 shadow-lg'
          }`}
          title="Join a Lounge"
        >
          <Link className="w-5 h-5" />
        </button>
      </div>

      {/* Glassmorphic Modals */}
      {showCreateLoungeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-60 backdrop-blur-md p-4 animate-fade-in">
          <div 
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
              isDark 
                ? 'bg-velum-900 border-white-10 text-white shadow-black-60' 
                : 'bg-white-10 border-velum-600 text-velum-900 shadow-xl'
            }`}
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent">Initialize Community</h3>
                <span className="text-[10px] opacity-60 uppercase tracking-wider font-mono">Create Lounge Node</span>
              </div>
              <button 
                onClick={() => {
                  setShowCreateLoungeModal(false);
                  setLoungeError('');
                }} 
                className={`p-1 rounded-full hover:bg-white-10 transition cursor-pointer ${isDark ? 'text-text-secondary hover:text-white' : 'text-text-secondary hover:text-velum-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loungeError && (
              <p className="text-red-500 text-[10.5px] font-mono bg-red-500/10 p-2.5 rounded-xl mb-4 border border-red-500/20 uppercase tracking-wide">
                {loungeError}
              </p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Lounge Name *</label>
                <input
                  type="text"
                  value={newLoungeName}
                  onChange={(e) => setNewLoungeName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none transition uppercase font-mono ${
                    isDark 
                      ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                      : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                  }`}
                  placeholder="ENTER UNIQUE ALPHANUMERIC IDENTIFIER"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Overview / Topic</label>
                <textarea
                  value={newLoungeDescription}
                  onChange={(e) => setNewLoungeDescription(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none resize-none h-20 transition ${
                    isDark 
                      ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                      : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                  }`}
                  placeholder="Describe your community node parameters..."
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-widest mb-1.5 opacity-60">Join Access Key (Optional)</label>
                <input
                  type="text"
                  value={newLoungeInviteCode}
                  onChange={(e) => setNewLoungeInviteCode(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none transition uppercase font-mono ${
                    isDark 
                      ? 'bg-velum-900 border-white-10 text-white focus:border-accent-20' 
                      : 'bg-white-10 border-velum-600 text-velum-900 focus:border-accent'
                  }`}
                  placeholder="LEAVE EMPTY FOR PUBLIC ADMISSION"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => {
                  setShowCreateLoungeModal(false);
                  setLoungeError('');
                }}
                className={`px-4 py-2.5 rounded-xl cursor-pointer transition ${isDark ? 'hover:bg-white-5 text-text-secondary hover:text-white' : 'hover:bg-white-5 text-text-secondary'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLounge}
                className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-velum-900 rounded-xl cursor-pointer transition"
              >
                Initialize
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className="bg-velum-850 border border-white-10 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-sm font-bold uppercase tracking-wider">Create Lounge Room</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <input 
              type="text" 
              placeholder="ROOM NAME" 
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              className="w-full bg-velum-900 border border-white-10 rounded-lg p-3 text-xs text-white uppercase focus:border-accent focus:outline-none"
            />
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="isLocked"
                checked={newRoomLocked}
                onChange={e => setNewRoomLocked(e.target.checked)}
                className="w-4 h-4 bg-velum-900 border border-white-10 accent-accent"
              />
              <label htmlFor="isLocked" className="text-xs text-text-secondary uppercase tracking-wider">Locked VIP Room</label>
            </div>

            {statusMessage && <div className="text-accent text-[10px] font-mono">{statusMessage}</div>}

            <button 
              onClick={handleCreateRoom}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
            >
              Create Room
            </button>
          </div>
        </div>
      )}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className="bg-velum-850 border border-white-10 p-6 rounded-2xl w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-sm font-bold uppercase tracking-wider">Locked VIP Room</h3>
              <button onClick={() => setShowJoinModal(false)} className="text-text-secondary hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <p className="text-xs text-text-secondary font-mono">This room requires an invite code to join.</p>
            
            <input 
              type="text" 
              placeholder="INVITE CODE" 
              value={inviteCodeInput}
              onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
              className="w-full bg-velum-900 border border-white-10 rounded-lg p-3 text-xs text-white uppercase focus:border-accent focus:outline-none tracking-[0.2em] font-mono text-center"
            />
            
            {statusMessage && <div className="text-accent text-[10px] font-mono">{statusMessage}</div>}

            <button 
              onClick={() => handleJoinRoom(targetLoungeId, joinRoomId, inviteCodeInput)}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition"
            >
              Verify Code
            </button>
          </div>
        </div>
      )}

      {showJoinLoungeMobileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black-60 backdrop-blur-sm p-4">
          <div className="bg-velum-850 border border-white-10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-sm font-bold uppercase tracking-wider">Join a Lounge</h3>
              <button onClick={() => setShowJoinLoungeMobileModal(false)} className="text-text-secondary hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            
            <p className="text-xs text-text-secondary font-mono">Enter a valid lounge invite code.</p>
            
            <input 
              type="text" 
              placeholder="LOUNGE CODE" 
              value={loungeInviteCodeInput}
              onChange={e => setLoungeInviteCodeInput(e.target.value.toUpperCase())}
              className="w-full bg-velum-900 border border-white-10 rounded-lg p-3 text-xs text-white uppercase focus:border-accent focus:outline-none tracking-[0.2em] font-mono text-center"
            />
            
            {loungeStatusMessage && <div className="text-accent text-[10px] font-mono text-center">{loungeStatusMessage}</div>}
            
            <button 
              onClick={handleJoinLoungeMobile}
              className="w-full bg-accent hover:bg-accent-hover text-velum-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Verify Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
