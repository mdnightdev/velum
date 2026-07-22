import React from 'react';
import { Users, Search, UserCheck } from 'lucide-react';

interface AdminUsersProps {
  userSearch: string;
  setUserSearch: (val: string) => void;
  userRoleFilter: 'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'member';
  setUserRoleFilter: (val: 'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'member') => void;
  users: any[];
  sessions: any[];
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
  c: any;
  isLoading?: boolean;
}

export default function AdminUsers({
  userSearch,
  setUserSearch,
  userRoleFilter,
  setUserRoleFilter,
  users,
  sessions,
  adminRole,
  adminFetch,
  fetchData,
  c,
  isLoading = false,
}: AdminUsersProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary font-mono text-xs animate-pulse">
        Loading directory...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white-5 pb-5 mb-6">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-accent" />
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              Registered Entity Directory
            </h3>
          </div>
        </div>

        {/* Directory Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search className="w-4 h-4 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder=""
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className={`pl-9 pr-4 py-2 text-xs rounded-xl w-full md:w-56 outline-none font-mono ${c.bgInput}`}
            />
          </div>

          {/* Custom Role Filters Button Group */}
          <div className="flex items-center gap-1 bg-white/[0.02] border border-white-5 p-1 rounded-xl">
            {[
              { value: 'all', label: 'ALL' },
              { value: 'CLI_ADMIN', label: 'CLI' },
              { value: 'LOGIN_ADMIN', label: 'LOGIN' },
              { value: 'SUPPORT_ADMIN', label: 'SUPPORT' },
              { value: 'USER', label: 'MEMBERS' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUserRoleFilter(opt.value as any)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer font-sans ${
                  userRoleFilter === opt.value
                    ? 'bg-accent/15 border border-accent/20 text-accent font-black shadow-inner'
                    : 'bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-white-5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead>
            <tr className="text-text-secondary text-[9px] font-black uppercase tracking-widest border-b border-white-5 text-left">
              <th className="pb-4 pl-2">USERNAME</th>
              <th className="pb-4">PRIVILEGE ROLE</th>
              <th className="pb-4">JOIN DATE</th>
              <th className="pb-4 text-right pr-2">OPERATIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {[...users]
              .sort((a, b) => {
                const roleOrder: Record<string, number> = {
                  CLI_ADMIN: 1,
                  LOGIN_ADMIN: 2,
                  SUPPORT_ADMIN: 3,
                  SYSTEM: 4,
                  USER: 5,
                  MEMBER: 5,
                };
                const orderA = roleOrder[a.role] || 99;
                const orderB = roleOrder[b.role] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return a.user_id - b.user_id;
              })
              .filter((u) => {
                if (!u) return false;
                // Hide soft-purged users from non-CLI_ADMIN admins
                if (u.status === 'purged' && adminRole !== 'CLI_ADMIN') return false;

                if (userRoleFilter !== 'all') {
                  const filterUpper = userRoleFilter.toUpperCase();
                  const roleUpper = (u.role || '').toUpperCase();
                  if (filterUpper === 'MEMBER' || filterUpper === 'USER') {
                    if (roleUpper !== 'USER' && roleUpper !== 'MEMBER') return false;
                  } else {
                    if (roleUpper !== filterUpper) return false;
                  }
                }
                if (userSearch.trim() !== '') {
                  return u.username.toLowerCase().includes(userSearch.toLowerCase());
                }
                return true;
              })
              .map((u) => {
                const isSystemProtected =
                  u.role === 'CLI_ADMIN' ||
                  u.role === 'LOGIN_ADMIN' ||
                  u.role?.toUpperCase() === 'SYSTEM' ||
                  u.username.toLowerCase() === 'cli_admin' ||
                  u.username.toLowerCase() === 'admin' ||
                  u.username === 'Velum' ||
                  u.username === '@Velum' ||
                  u.username === '@@Velum';

                const isOnline = sessions.some(
                  (s) =>
                    s.user_id === u.user_id &&
                    (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())
                );
                const isExecutive =
                  u.role === 'CLI_ADMIN' ||
                  u.role === 'LOGIN_ADMIN' ||
                  u.role === 'SYSTEM' ||
                  u.role?.toUpperCase() === 'SYSTEM';
                const formattedJoinDate = isExecutive
                  ? '—'
                  : u.created_at
                  ? u.created_at.split('T')[0]
                  : '—';

                const roleColors: Record<
                  string,
                  { bg: string; border: string; text: string; name: string }
                > = {
                  CLI_ADMIN: {
                    bg: 'bg-orange-500/10',
                    border: 'border-orange-500/20',
                    text: 'bg-orange-400',
                    name: 'CLI Executive Admin',
                  },
                  LOGIN_ADMIN: {
                    bg: 'bg-purple-500/10',
                    border: 'border-purple-500/20',
                    text: 'bg-purple-400',
                    name: 'Executive Login Admin',
                  },
                  SUPPORT_ADMIN: {
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/20',
                    text: 'bg-blue-400',
                    name: 'Support Operator Admin',
                  },
                  USER: {
                    bg: 'bg-white/[0.04]',
                    border: 'border-white-5',
                    text: 'bg-text-secondary',
                    name: 'Standard Member',
                  },
                  MEMBER: {
                    bg: 'bg-white/[0.04]',
                    border: 'border-white-5',
                    text: 'bg-text-secondary',
                    name: 'Standard Member',
                  },
                  SYSTEM: {
                    bg: 'bg-emerald-500/10',
                    border: 'border-emerald-500/20',
                    text: 'bg-emerald-400',
                    name: 'System Service',
                  },
                };
                const rConf = roleColors[u.role] || roleColors['USER'];

                return (
                  <tr
                    key={u.user_id}
                    className="hover:bg-text-primary-2 transition duration-150"
                  >
                    {/* USERNAME & Presence */}
                    <td className="py-4 pl-2 font-bold text-text-primary">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-6 h-6 rounded-lg overflow-hidden border border-white-10 flex items-center justify-center font-black text-[10px] text-accent shrink-0 bg-accent-10">
                            {u.avatar ? (
                              <img
                                src={u.avatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              u.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-velum-900 ${
                              isOnline
                                ? 'bg-status-online animate-pulse'
                                : 'bg-white/30 border border-white-10'
                            }`}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold">{u.username}</span>
                          <span className="text-[9px] font-mono text-text-secondary/50">
                            ID: #{u.user_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ROLE Indicator */}
                    <td className="py-4 font-mono">
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${rConf.bg} border ${rConf.border} flex items-center justify-center`}
                        title={rConf.name}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${rConf.text}`} />
                      </span>
                    </td>

                    {/* JOIN DATE */}
                    <td className="py-4 font-mono text-text-secondary text-[10px]">
                      {formattedJoinDate}
                    </td>

                    {/* OPERATIONS */}
                    <td className="py-4 text-right pr-2">
                      {isSystemProtected ? null : (
                        <div className="flex items-center justify-end gap-4">
                          {/* Promote (only for standard members) */}
                          {(u.role === 'member' ||
                            u.role === 'USER' ||
                            u.role === 'user') &&
                            u.status === 'active' &&
                            adminRole !== 'SUPPORT_ADMIN' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await adminFetch(`/api/admin/nominate`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        username: u.username,
                                        targetUsername: u.username,
                                      }),
                                    });
                                    if (res.ok) {
                                      alert(`Nominated @${u.username} to Operator!`);
                                      fetchData();
                                    } else {
                                      const errData = await res.json();
                                      alert(errData.error || 'Nomination rejected.');
                                    }
                                  } catch {
                                    alert('Server unreachable.');
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-accent-20 bg-accent-10 hover:bg-accent text-accent hover:text-text-primary transition cursor-pointer"
                                title="Promote User"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-text-secondary font-mono text-xs uppercase"
                >
                  // Directory catalog empty //
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
