import React from 'react';

interface LoungeOverviewProps {
  loungeId?: string;
  loungeName: string;
  loungeDetails: any;
  memberCount: number;
  isDark: boolean;
  isMember?: boolean;
  isLoungeCreator: boolean;
  handleCopyInvite?: () => void;
  copiedInvite?: boolean;
  handleCopyInviteLink?: () => void;
  copiedInviteLink?: boolean;
  onJoinLounge?: () => void;
  onApplyLounge?: () => void;
  isJoining?: boolean;
  isApplying?: boolean;
  appliedSuccess?: boolean;
}

export default function LoungeOverview({
  loungeId,
  loungeName,
  loungeDetails,
  memberCount,
  isDark,
  isMember = false,
  isLoungeCreator,
  handleCopyInvite,
  copiedInvite,
  handleCopyInviteLink,
  copiedInviteLink,
  onJoinLounge,
  onApplyLounge,
  isJoining = false,
  isApplying = false,
  appliedSuccess = false,
}: LoungeOverviewProps) {
  const displayLoungeName = loungeDetails?.name || loungeName;
  const description = loungeDetails?.description || 'No topic overview provided for this lounge.';
  const ownerLabel = loungeDetails?.is_official || loungeDetails?.is_system ? 'Official' : 'Community';
  const createdAt = loungeDetails?.created_at ? new Date(loungeDetails.created_at).toLocaleDateString() : '—';
  const isPrivate = !!loungeDetails?.is_private;
  const avatar = loungeDetails?.avatar_url || loungeDetails?.avatarUrl || loungeDetails?.icon_url || loungeDetails?.iconUrl;

  return (
    <div className="flex-1 overflow-y-auto w-full h-full bg-velum-800 text-text-primary select-none flex flex-col">
      {/* Top Lounge Identity Bar */}
      <div className="w-full p-4 sm:p-5 border-b border-velum-600 bg-velum-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-velum-750 border border-velum-600 flex items-center justify-center overflow-hidden shrink-0">
            {avatar ? (
              <img src={avatar} alt={displayLoungeName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold text-accent font-mono">
                {(displayLoungeName || 'L').slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary truncate">
                {displayLoungeName}
              </h2>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                isPrivate ? 'bg-status-away/15 text-status-away' : 'bg-accent/15 text-accent'
              }`}>
                {isPrivate ? 'Private' : 'Public'}
              </span>
              {isMember && (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-status-online/15 text-status-online">
                  Member
                </span>
              )}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              {ownerLabel} Lounge
            </div>
          </div>
        </div>

        {/* Action Buttons: Join, Apply, or Copy Invites */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isMember ? (
            isPrivate ? (
              <button
                onClick={onApplyLounge}
                disabled={isApplying || appliedSuccess}
                className="px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover disabled:opacity-50 text-black rounded-lg transition cursor-pointer"
              >
                {appliedSuccess ? 'Application Sent' : isApplying ? 'Applying...' : 'Apply to Join'}
              </button>
            ) : (
              <button
                onClick={onJoinLounge}
                disabled={isJoining}
                className="px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover disabled:opacity-50 text-black rounded-lg transition cursor-pointer"
              >
                {isJoining ? 'Joining...' : 'Join Lounge'}
              </button>
            )
                    ) : null}

          
        </div>
      </div>

      {/* Unified 4 Metrics Strip */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 border-b border-velum-600 bg-velum-800 divide-x divide-y sm:divide-y-0 divide-velum-600 shrink-0">
        <div className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-base font-bold text-accent">{memberCount}</span>
          <span className="text-[11px] text-text-secondary mt-0.5">Members</span>
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-text-primary">{isPrivate ? 'Private' : 'Public'}</span>
          <span className="text-[11px] text-text-secondary mt-0.5">Access</span>
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-text-primary">{createdAt}</span>
          <span className="text-[11px] text-text-secondary mt-0.5">Established</span>
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-status-online">Active</span>
          <span className="text-[11px] text-text-secondary mt-0.5">Status</span>
        </div>
      </div>

      {/* Topic & Description Body */}
      <div className="w-full p-4 sm:p-5 space-y-2 flex-1">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Topic</span>
        <div className="p-4 rounded-xl border border-velum-600 bg-velum-850 text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
          {description}
        </div>
      </div>
    </div>
  );
}
