import React, { useState, useEffect } from 'react';
import {Lock, Globe, Plus, X, Link, Menu } from 'lucide-react';
import ProfileCard from '../ProfileCard';
import { useLanguage } from '../../i18n/LanguageContext';
import logoSvg from '../../assets/logo.svg?raw';
import { formatMessageTimestamp } from '../../utils/time';
import { parseAttachment, formatVoiceNotePreview } from '../../utils/messageParser';
import { getSessionId } from '../../utils/auth';
import { storage } from '../../services/storageService';

interface LoungeMainDashboardProps {
  currentUserId: number;
  isDark: boolean;
  onLoungeSelect: (loungeId: string, loungeName: string) => void;
  onSectionView?: (view: any) => void;
  unreadCounts?: Record<string, number>;
  lastMessages?: Record<string, any>;
  onToggleSidebar?: () => void;
}



export default function LoungeMainDashboard({
  currentUserId,
  isDark,
  onLoungeSelect,
  onSectionView,
  unreadCounts,
  lastMessages = {},
  onToggleSidebar
}: LoungeMainDashboardProps) {
  const { t } = useLanguage();
  const [lounges, setLounges] = useState<any[]>(() => {
    try {
      const cached = storage.getItem<any>('velum_cached_lounges');
      if (cached) {
        return Array.isArray(cached) ? cached : (cached?.lounges || []);
      }
    } catch {}
    return [];
  });
  const [roomsMap, setRoomsMap] = useState<Record<string, any[]>>({});
  const [selectedLounge, setSelectedLounge] = useState<any>(null);
  
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
  const [isApplying, setIsApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');

  const handleApplyToJoin = async (targetId?: string) => {
    if (!targetId || isApplying) return;
    setIsApplying(true);
    setApplyMessage('');
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${targetId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        setApplyMessage(data.message || 'Application submitted successfully.');
      } else {
        setApplyMessage(data.error || 'Failed to submit application.');
      }
    } catch (err) {
      setApplyMessage('Error submitting join application.');
    } finally {
      setIsApplying(false);
    }
  };
  // Create Lounge State
  const [showCreateLoungeModal, setShowCreateLoungeModal] = useState(false);
  const [newLoungeName, setNewLoungeName] = useState('');
  const [newLoungeDescription, setNewLoungeDescription] = useState('');
  const [newLoungeInviteCode, setNewLoungeInviteCode] = useState('');
  const [newLoungeIsPrivate, setNewLoungeIsPrivate] = useState(false);
  const [isSubmittingLounge, setIsSubmittingLounge] = useState(false);
  const [loungeError, setLoungeError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateLounge = async () => {
    if (!newLoungeName.trim()) {
      setLoungeError('Lounge name is required.');
      return;
    }
    if (isSubmittingLounge) return;
    setIsSubmittingLounge(true);
    setLoungeError('');
    try {
      const sid = getSessionId();
      const res = await fetch('/v2/lounges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sid}`
        },
        body: JSON.stringify({
          name: newLoungeName,
          description: newLoungeDescription,
          invite_code: newLoungeInviteCode,
          is_private: newLoungeIsPrivate
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create lounge.');
      }

      setNewLoungeName('');
      setNewLoungeDescription('');
      setNewLoungeInviteCode('');
      setNewLoungeIsPrivate(false);
      setLoungeError('');
      setShowCreateLoungeModal(false);
      await loadLounges();
    } catch (err: any) {
      setLoungeError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmittingLounge(false);
    }
  };


  const loadLounges = async () => {
    try {
      const sid = getSessionId();
      const headers = { 'Authorization': `Bearer ${sid}` };
      const res = await fetch('/v2/lounges', { headers });
      if (res.ok) {
        const data = await res.json();
        const rawLounges = Array.isArray(data) ? data : (data?.lounges || []);
        setLounges(rawLounges);
        try {
          storage.setItem('velum_cached_lounges', rawLounges);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load lounges', err);
    }
  };

  useEffect(() => {
    loadLounges();
  }, []);

  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setStatusMessage('Room name is required.');
      return;
    }
    if (isSubmittingRoom) return;
    setIsSubmittingRoom(true);
    setStatusMessage('');
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${targetLoungeId}/sublounges`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sid}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          is_private: newRoomLocked
        })
      });
      if (res.ok) {
        setNewRoomName('');
        setNewRoomLocked(false);
        setShowCreateModal(false);
        setStatusMessage('');
        loadLounges();
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await res.json();
          setStatusMessage(err.error || 'Failed to create room.');
        } else {
          setStatusMessage(`Server error: ${res.status}. Action may have been blocked.`);
        }
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setStatusMessage('Error creating room.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleJoinRoom = async (loungeId: string, roomId: string, code?: string) => {
    try {
      const sid = getSessionId();
      const res = await fetch(`/v2/lounges/${loungeId}/rooms/${roomId}/join`, {
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
      const sId = getSessionId();
      const res = await fetch(`/v2/lounges/join`, {
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
      <div className="p-2.5 border-b border-velum-600 bg-velum-850 flex-shrink-0 flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer shrink-0"
            aria-label="Open sidebar menu"
            title="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            placeholder={t('lounge.search', 'Search lounges...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-velum-600 bg-velum-750 text-text-primary placeholder:text-text-disabled outline-none focus:border-accent/40 transition-all"
          />
          <span className="absolute left-2.5 text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.603Z" /></svg>
          </span>
        </div>
      </div>

      {/* Main Flat List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {(() => {
          const loungesList = Array.isArray(lounges) ? lounges : [];
          const q = searchQuery.trim().toLowerCase();
          const filtered = loungesList
            .filter((lounge) => {
              if (!q) return true;
              const nameMatch = (lounge.name || '').toLowerCase().includes(q);
              const descMatch = (lounge.description || '').toLowerCase().includes(q);
              const slugMatch = (lounge.slug || '').toLowerCase().includes(q);
              const codeMatch = (lounge.invite_code || '').toLowerCase().includes(q);
              return nameMatch || descMatch || slugMatch || codeMatch;
            })
.sort((a, b) => {
              const lm = lastMessages || {};
              const keyA = a.slug || a.lounge_id;
              const keyB = b.slug || b.lounge_id;
              const lastA = lm[keyA] || lm[a.lounge_id];
              const lastB = lm[keyB] || lm[b.lounge_id];
              const timeA = lastA ? new Date(lastA.created_at || lastA.timestamp || lastA.createdAt).getTime() : 0;
              const timeB = lastB ? new Date(lastB.created_at || lastB.timestamp || lastB.createdAt).getTime() : 0;
              return timeB - timeA;
            });
          if (filtered.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-text-secondary">
                {t('lounge.no_lounges', 'No lounges found')}
              </div>
            );
          }
          return filtered.map((lounge) => {
            const loungeKey = lounge.slug || lounge.lounge_id;
            const loungeLast = lastMessages ? (lastMessages[loungeKey] || lastMessages[lounge.lounge_id]) : null;
            let lastPreviewNode: React.ReactNode = null;
            let lastTimeStr = '';
            if (loungeLast) {
              const raw = loungeLast.content || loungeLast.message || loungeLast.text || '';
              if (raw.startsWith('[Voice Note')) {
                lastPreviewNode = (
                  <span className="flex items-center gap-1 text-xs text-text-secondary truncate">
                    <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    <span>{formatVoiceNotePreview(raw)}</span>
                  </span>
                );
              } else if (raw.includes('[Attachment:')) {
                const attachments = parseAttachment(raw);
                const att = attachments[0];
                const isVid = att && (att.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.name) || /\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(att.data));
                const isImg = att && att.type.startsWith('image/');

                if (isVid) {
                  lastPreviewNode = (
                    <span className="flex items-center gap-1 text-xs text-text-secondary truncate">
                      <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      <span>{att ? (att.caption ? `Video ${att.caption}` : 'Video') : 'Video'}</span>
                    </span>
                  );
                } else if (isImg) {
                  lastPreviewNode = (
                    <span className="flex items-center gap-1 text-xs text-text-secondary truncate">
                      <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
                        <circle cx="8.5" cy="8.5" r="2" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>{att ? (att.caption ? `Photo ${att.caption}` : 'Photo') : 'Photo'}</span>
                    </span>
                  );
                } else {
                  lastPreviewNode = (
                    <span className="flex items-center gap-1 text-xs text-text-secondary truncate">
                      <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{att ? (att.caption ? `${att.name} ${att.caption}` : att.name) : 'Attachment'}</span>
                    </span>
                  );
                }
              } else if (raw.startsWith('ratchet:v2:') || raw.startsWith('VEL_E2EE[')) {
                lastPreviewNode = <span className="text-xs text-text-secondary truncate">Encrypted message</span>;
              } else {
                lastPreviewNode = <span className="text-xs text-text-secondary truncate">{raw}</span>;
              }
              const ts = loungeLast.created_at || loungeLast.timestamp || loungeLast.createdAt;
              if (ts) lastTimeStr = formatMessageTimestamp(ts);
            }
            const unread = unreadCounts ? (unreadCounts[loungeKey] || unreadCounts[lounge.lounge_id] || 0) : 0;
            const loungeAvatar = lounge.avatar_url || lounge.avatarUrl || lounge.icon_url || lounge.iconUrl;

            return (
              <div
                key={lounge.lounge_id}
                onClick={() => onLoungeSelect(lounge.lounge_id, lounge.name)}
                className="p-3 rounded-xl border border-velum-600 bg-velum-800 hover:border-accent/40 cursor-pointer transition-colors flex items-center gap-3 group"
              >
                {loungeAvatar ? (
                  <img src={loungeAvatar} alt={lounge.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-velum-600" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-velum-750 border border-velum-600 text-accent flex items-center justify-center shrink-0 font-semibold text-xs">
                    {lounge.name ? lounge.name.slice(0, 2).toUpperCase() : 'L'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-xs text-text-primary group-hover:text-accent truncate transition-colors">{lounge.name}</div>
                    {lastTimeStr && <div className="text-xs text-text-secondary shrink-0">{lastTimeStr}</div>}
                  </div>
                  {lastPreviewNode && (
                    <div className="mt-0.5 min-w-0">
                      {lastPreviewNode}
                    </div>
                  )}
                </div>
                {unread > 0 && (
                  <span className="px-1.5 py-0.2 min-w-[18px] text-xs font-bold rounded-full bg-accent text-black flex items-center justify-center shrink-0">
                    {unread}
                  </span>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-20 right-4 z-50 flex flex-col-reverse gap-3">
        {/* Create Lounge Button */}
        <button
          onClick={() => setShowCreateLoungeModal(true)}
          className={`p-3.5 rounded-full border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-[var(--blur-backdrop-md)] ${
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
          className={`p-3.5 rounded-full border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-[var(--blur-backdrop-md)] ${
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
      {selectedLounge && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 modal-backdrop" onClick={() => setSelectedLounge(null)}>
            <div onClick={e => e.stopPropagation()}>
                <ProfileCard 
                    type="lounge"
                    lounge={{
                        loungeId: selectedLounge.lounge_id,
                        name: selectedLounge.name,
                        description: selectedLounge.description,
                        ownerId: Number(selectedLounge.owner_id),
                        ownerUsername: 'Lounge Owner',
                        memberCount: 0,
                        avatarUrl: selectedLounge.avatar_url,
                        createdAt: new Date(selectedLounge.created_at).toLocaleDateString(),
                        isPrivate: selectedLounge.is_private === 1,
                        visibility: selectedLounge.is_private === 1 ? 'private' : 'public',
                        status: selectedLounge.status
                    }}
                    variant="popover"
                    onClose={() => setSelectedLounge(null)}
                />
            </div>
        </div>
      )}
      
      {/* Create Lounge Right-Anchored Drawer */}
      {showCreateLoungeModal && (
        <div className="fixed inset-0 z-50 flex justify-end modal-backdrop animate-fade-in" onClick={() => { setShowCreateLoungeModal(false); setLoungeError(''); }}>
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-velum-600">
                <h3 className="text-sm font-semibold text-text-primary">Create Lounge</h3>
                <button 
                  onClick={() => {
                    setShowCreateLoungeModal(false);
                    setLoungeError('');
                  }} 
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loungeError && (
                <p className="text-status-dnd text-xs bg-status-dnd/10 border border-status-dnd/20 p-2.5 rounded-lg">
                  {loungeError}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Lounge Name</label>
                  <input
                    type="text"
                    value={newLoungeName}
                    onChange={(e) => setNewLoungeName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-velum-600 bg-velum-750 text-xs text-text-primary outline-none focus:border-accent/40 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Topic</label>
                  <textarea
                    value={newLoungeDescription}
                    onChange={(e) => setNewLoungeDescription(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 rounded-lg border border-velum-600 bg-velum-750 text-xs text-text-primary outline-none resize-none focus:border-accent/40 transition"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-velum-600 bg-velum-750">
                  <span className="text-xs font-medium text-text-primary">Private Lounge</span>
                  <input
                    type="checkbox"
                    id="lounge-private-toggle"
                    checked={newLoungeIsPrivate}
                    onChange={(e) => setNewLoungeIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-velum-600 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLoungeModal(false);
                  setLoungeError('');
                }}
                className="flex-1 py-2 rounded-lg border border-velum-600 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLounge}
                disabled={isSubmittingLounge || !newLoungeName.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isSubmittingLounge ? 'Creating...' : 'Create Lounge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Room / Sublounge Right-Anchored Drawer */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex justify-end modal-backdrop animate-fade-in" onClick={() => setShowCreateModal(false)}>
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-velum-600">
                <h3 className="text-sm font-semibold text-text-primary">Create Room</h3>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  disabled={isSubmittingRoom}
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
                    disabled={isSubmittingRoom}
                    onChange={e => setNewRoomName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !isSubmittingRoom && newRoomName.trim()) {
                        handleCreateRoom();
                      }
                    }}
                    className="w-full bg-velum-750 border border-velum-600 rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent/40 transition disabled:opacity-50"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border border-velum-600 bg-velum-750">
                  <span className="text-xs font-medium text-text-primary">VIP Room</span>
                  <input 
                    type="checkbox" 
                    id="isLocked"
                    checked={newRoomLocked}
                    disabled={isSubmittingRoom}
                    onChange={e => setNewRoomLocked(e.target.checked)}
                    className="w-4 h-4 rounded border-velum-600 bg-velum-800 text-accent focus:ring-0 cursor-pointer disabled:opacity-50"
                  />
                </div>

                {statusMessage && <div className="text-accent text-xs bg-accent/10 border border-accent/20 p-2.5 rounded-lg">{statusMessage}</div>}
              </div>
            </div>

            <div className="pt-4 border-t border-velum-600 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmittingRoom}
                className="flex-1 py-2 rounded-lg border border-velum-600 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateRoom}
                disabled={isSubmittingRoom || !newRoomName.trim()}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {isSubmittingRoom ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Right-Anchored Drawer */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex justify-end modal-backdrop animate-fade-in" onClick={() => { setShowJoinModal(false); setApplyMessage(''); }}>
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-velum-600">
                <h3 className="text-sm font-semibold text-text-primary">Join Room</h3>
                <button 
                  onClick={() => { setShowJoinModal(false); setApplyMessage(''); }} 
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-medium text-text-secondary mb-1">Invite Code</label>
                <input 
                  type="text" 
                  value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-velum-750 border border-velum-600 rounded-lg p-2.5 text-xs text-text-primary uppercase outline-none focus:border-accent/40 font-mono tracking-widest text-center"
                />
                
                {statusMessage && <div className="text-accent text-xs text-center">{statusMessage}</div>}
                {applyMessage && <div className="text-accent text-xs text-center bg-accent/10 p-2.5 rounded-lg border border-accent/20">{applyMessage}</div>}
              </div>
            </div>

            <div className="pt-4 border-t border-velum-600 space-y-2">
              <button 
                onClick={() => handleJoinRoom(targetLoungeId, joinRoomId, inviteCodeInput)}
                disabled={!inviteCodeInput.trim()}
                className="w-full py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Join Room
              </button>

              <button
                onClick={() => handleApplyToJoin(joinRoomId || targetLoungeId)}
                disabled={isApplying}
                className="w-full py-2 bg-velum-750 hover:bg-velum-700 text-text-primary rounded-lg text-xs font-medium transition cursor-pointer border border-velum-600 disabled:opacity-50"
              >
                {isApplying ? 'Submitting...' : 'Request Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Lounge Right-Anchored Drawer */}
      {showJoinLoungeMobileModal && (
        <div className="fixed inset-0 z-50 flex justify-end modal-backdrop animate-fade-in" onClick={() => { setShowJoinLoungeMobileModal(false); setApplyMessage(''); }}>
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full bg-velum-850 border-l border-velum-600 p-5 flex flex-col justify-between shadow-2xl text-text-primary select-none animate-slide-left"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-velum-600">
                <h3 className="text-sm font-semibold text-text-primary">Join Lounge</h3>
                <button 
                  onClick={() => { setShowJoinLoungeMobileModal(false); setApplyMessage(''); }} 
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-velum-750 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-medium text-text-secondary mb-1">Invite Code</label>
                <input 
                  type="text" 
                  value={loungeInviteCodeInput}
                  onChange={e => setLoungeInviteCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-velum-750 border border-velum-600 rounded-lg p-2.5 text-xs text-text-primary uppercase outline-none focus:border-accent/40 font-mono tracking-widest text-center"
                />
                
                {loungeStatusMessage && <div className="text-accent text-xs text-center">{loungeStatusMessage}</div>}
                {applyMessage && <div className="text-accent text-xs text-center bg-accent/10 p-2.5 rounded-lg border border-accent/20">{applyMessage}</div>}
              </div>
            </div>

            <div className="pt-4 border-t border-velum-600 space-y-2">
              <button 
                onClick={handleJoinLoungeMobile}
                disabled={!loungeInviteCodeInput.trim()}
                className="w-full py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Join Lounge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
