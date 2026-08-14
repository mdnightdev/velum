import React from 'react';

interface LoungeOverviewProps {
  loungeName: string;
  loungeDetails: any;
  memberCount: number;
  isDark: boolean;
  isLoungeCreator: boolean;
  handleCopyInvite: () => void;
  copiedInvite: boolean;
}

export default function LoungeOverview({
  loungeName,
  loungeDetails,
  memberCount,
  isDark,
  isLoungeCreator,
  handleCopyInvite,
  copiedInvite
}: LoungeOverviewProps) {
  const displayLoungeName = loungeDetails?.name || loungeName;
  const description = loungeDetails?.description || 'No topic overview provided for this lounge.';
  const ownerLabel = loungeDetails?.is_official || loungeDetails?.is_system ? 'Managed by Velum Staff' : 'Lounge Host';
  const createdAt = loungeDetails?.created_at ? new Date(loungeDetails.created_at).toLocaleDateString() : 'Unknown';

  return (
    <div className="flex-1 overflow-y-auto w-full h-full p-4 sm:p-8 animate-fade-in flex items-center justify-center bg-black/20">
      <div className={`w-full max-w-2xl mx-auto rounded-3xl overflow-hidden border shadow-2xl ${isDark ? 'bg-velum-850/80 border-white-10 shadow-black-60' : 'bg-white border-velum-600 shadow-velum-600/20'}`}>
        {/* Banner */}
        <div className="h-32 sm:h-48 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent relative flex items-end p-6 border-b border-white-5">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          
          <div className="flex items-center gap-4 sm:gap-6 relative z-10 translate-y-10 sm:translate-y-12">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-velum-800 border-4 border-velum-850 flex items-center justify-center overflow-hidden shadow-xl shrink-0">
              {loungeDetails?.avatar_url ? (
                <img src={loungeDetails.avatar_url} alt="Lounge Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-accent/10 flex items-center justify-center text-3xl sm:text-4xl font-black text-accent">
                  {(displayLoungeName || 'L').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="pb-2">
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                {displayLoungeName}
              </h1>
              <div className="text-xs font-mono text-accent uppercase tracking-wider mt-1 drop-shadow-md">
                {ownerLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-16 sm:pt-20 space-y-8">
          <div className="text-sm text-text-primary leading-relaxed italic bg-black/10 p-5 rounded-2xl border border-white-5">
            &quot;{description}&quot;
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${isDark ? 'bg-velum-800/50 border-white-5' : 'bg-velum-100 border-velum-600'}`}>
              <span className="text-2xl font-black text-accent">{memberCount}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mt-1">Members</span>
            </div>
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${isDark ? 'bg-velum-800/50 border-white-5' : 'bg-velum-100 border-velum-600'}`}>
              <span className="text-sm font-bold text-white uppercase tracking-widest">{loungeDetails?.is_private ? 'Private' : 'Public'}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mt-1">Access</span>
            </div>
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${isDark ? 'bg-velum-800/50 border-white-5' : 'bg-velum-100 border-velum-600'}`}>
              <span className="text-sm font-bold text-white uppercase tracking-widest">{createdAt}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mt-1">Established</span>
            </div>
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${isDark ? 'bg-velum-800/50 border-white-5' : 'bg-velum-100 border-velum-600'}`}>
              <span className="text-sm font-bold text-status-online uppercase tracking-widest">Active</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-secondary mt-1">Status</span>
            </div>
          </div>

          {isLoungeCreator && loungeDetails?.invite_code && (
            <div className="p-5 bg-velum-800/80 border border-white-10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary select-none">Access / Invite Code</div>
                <div className="font-mono text-lg font-bold text-accent tracking-widest select-all mt-1">{loungeDetails.invite_code}</div>
              </div>
              <button
                onClick={handleCopyInvite}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest bg-accent hover:bg-accent-hover text-velum-900 rounded-xl transition active:scale-95 cursor-pointer shrink-0 w-full sm:w-auto"
              >
                {copiedInvite ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
