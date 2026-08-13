import React from 'react';

interface MembersListProps {
  members: any[];
  isDark: boolean;
  onSelectMember: (member: any) => void;
}

export default function MembersList({ members, isDark, onSelectMember }: MembersListProps) {
  return (
    <div className="flex flex-col p-2 space-y-1">
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        Members — {members.length}
      </div>
      {members.map((member, index) => (
        <div 
          key={member.user_id || `member-${member.username || index}`}
          onClick={() => onSelectMember(member)}
          className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
            isDark ? 'hover:bg-white-5 text-text-secondary hover:text-text-primary' : 'hover:bg-white-5 text-text-secondary hover:text-velum-900'
          }`}
        >
          <div className="relative shrink-0">
            {member.avatar ? (
              <img src={member.avatar} alt={member.username} className="w-8 h-8 rounded-full object-cover border border-white-10" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono font-bold uppercase shrink-0 transition bg-velum-800 text-text-secondary border-velum-600">
                {member.username.replace('@', '').charAt(0) || 'U'}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isDark ? 'border-velum-600' : 'border-white'} ${member.status === 'online' ? 'bg-status-online' : 'bg-status-invisible'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-bold truncate ${isDark ? 'text-text-primary' : 'text-velum-900'}`}>
              {member.displayName || member.username.replace('@', '')}
            </div>
            <div className="text-[10px] opacity-60 truncate">
              {member.role || 'Member'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
