import React, { useState } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { stripAt } from '../../types';
import { resolveMediaUrl } from '../../utils/mediaPipeline';
import { resolveContactName } from '../../utils/contactName';

type FriendPeer = {
  userId: number;
  username: string;
  displayName?: string;
  nickname?: string;
  avatar?: string;
};

type ForwardSheetProps = {
  friends: FriendPeer[];
  loading: boolean;
  onClose: () => void;
  onForwardTo: (peer: FriendPeer) => void;
};

export default function ForwardSheet({
  friends,
  loading,
  onClose,
  onForwardTo,
}: ForwardSheetProps) {
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<number | null>(null);

  const term = query.trim().toLowerCase();
  const filtered = friends.filter((f) => {
    if (!term) return true;
    const name = resolveContactName({
      nickname: f.nickname,
      displayName: f.displayName,
      username: f.username,
    }).toLowerCase();
    return (
      name.includes(term) ||
      String(f.nickname || '').toLowerCase().includes(term) ||
      stripAt(f.username || '').toLowerCase().includes(term)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/75 animate-in fade-in duration-150"
      onClick={onClose}
      data-forward-sheet="true"
    >
      <div
        className="w-full max-w-md bg-velum-850 border-t border-velum-600 rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] space-y-3 shadow-2xl animate-in slide-in-from-bottom duration-200 text-text-primary max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-1" />

        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Forward to</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:bg-velum-750 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex items-center h-10 px-3.5 rounded-full border border-velum-600 bg-velum-750 focus-within:border-accent/40 shrink-0">
          <Search className="w-4 h-4 text-text-secondary shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
            className="w-full ml-2.5 bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-disabled"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[160px] space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-10 text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-text-secondary py-10">No contacts found</p>
          ) : (
            filtered.map((peer) => {
              const name = resolveContactName({
                nickname: peer.nickname,
                displayName: peer.displayName,
                username: peer.username,
                fallback: `User #${peer.userId}`,
              });
              const letter = name.charAt(0).toUpperCase();
              const busy = sendingId === peer.userId;
              return (
                <button
                  key={peer.userId}
                  type="button"
                  disabled={busy || sendingId !== null}
                  onClick={async () => {
                    setSendingId(peer.userId);
                    try {
                      await Promise.resolve(onForwardTo(peer));
                    } finally {
                      setSendingId(null);
                    }
                  }}
                  className="w-full px-2 py-2.5 flex items-center gap-3 rounded-xl hover:bg-velum-750 active:bg-velum-700 transition text-left cursor-pointer disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-velum-750 border border-velum-600 flex items-center justify-center text-sm font-semibold shrink-0">
                    {peer.avatar ? (
                      <img src={resolveMediaUrl(peer.avatar)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      letter
                    )}
                  </div>
                  <span className="text-sm font-semibold truncate flex-1">{name}</span>
                  {busy && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
