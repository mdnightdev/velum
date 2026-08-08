import React, { useState } from 'react';

interface PrivateSubloungeBannerProps {
  activeRoom: any;
  isPrivateSublounge: boolean;
  isSubloungeCreator: boolean;
  isLoungeOwnerNotCreator?: boolean;
  isMobile?: boolean;
}

export default function PrivateSubloungeBanner({
  activeRoom,
  isPrivateSublounge,
  isSubloungeCreator,
  isLoungeOwnerNotCreator,
  isMobile = false,
}: PrivateSubloungeBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!activeRoom || !isPrivateSublounge) return null;

  const handleCopyCode = () => {
    if (!activeRoom.invite_code) return;
    navigator.clipboard.writeText(activeRoom.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestDeletion = () => {
    alert(`System Admin Request Submitted: A request to delete private sublounge "${activeRoom.name}" has been logged for system administrator review.`);
  };

  // Only show invite code banner to the sublounge creator/owner or system admins
  if (isSubloungeCreator && activeRoom.invite_code) {
    return (
      <div className="bg-accent-10 border-b border-white-5 px-4 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-bold text-accent uppercase tracking-wider text-[10px] shrink-0">
            {isMobile ? 'Sublounge Invite:' : 'Private Sublounge Invite:'}
          </span>
          <span className="font-mono font-bold text-white tracking-widest bg-black/40 px-2.5 py-0.5 rounded-md border border-accent-20 select-all truncate text-[11px]">
            {activeRoom.invite_code}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCode}
            className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-accent-10 hover:bg-accent-20 text-accent rounded-lg transition active:scale-95 cursor-pointer"
          >
            {copied ? 'Copied' : isMobile ? 'Copy' : 'Copy Code'}
          </button>
        </div>
      </div>
    );
  }

  // Notice for Lounge Owners if they enter a user-created private sublounge that they do not own
  if (isLoungeOwnerNotCreator) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between gap-2 shrink-0 select-none text-amber-200 text-[10px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-bold uppercase tracking-wider">User-Created Private Sublounge</span>
          <span className="text-amber-200/60">— Managed independently by room creator</span>
        </div>
        <button
          onClick={handleRequestDeletion}
          className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded transition cursor-pointer shrink-0"
          title="Request System Admin to delete this sublounge"
        >
          Request Deletion
        </button>
      </div>
    );
  }

  return null;
}
