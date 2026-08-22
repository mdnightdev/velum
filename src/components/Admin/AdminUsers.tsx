import React from 'react';
import { Users, Search, UserCheck, Trash2, Lock, Unlock } from 'lucide-react';

interface AdminUsersProps {
  userSearch: string;
  setUserSearch: (val: string) => void;
  userRoleFilter: 'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'USER' | 'BLOCKED';
  setUserRoleFilter: (val: 'all' | 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'USER' | 'BLOCKED') => void;
  users: any[];
  sessions: any[];
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
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
  isLoading = false,
}: AdminUsersProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-xs animate-pulse">
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-velum-600 pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm text-text-primary">
            User Directory
          </h3>
        </div>

        {/* Directory Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl w-full md:w-52 outline-none bg-velum-750 border border-velum-600 text-text-primary placeholder:text-text-disabled focus:border-accent/40"
            />
          </div>

          {/* Custom Role Filters Button Group */}
          <div className="flex items-center gap-1 bg-velum-750 border border-velum-600 p-0.5 rounded-xl">
            {[
              { value: 'all', label: 'ALL' },
              { value: 'CLI_ADMIN', label: 'CLI' },
              { value: 'LOGIN_ADMIN', label: 'LOGIN' },
              { value: 'SUPPORT_ADMIN', label: 'SUPPORT' },
              { value: 'USER', label: 'MEMBERS' },
              { value: 'BLOCKED', label: 'BLOCKED' },
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
            {[...(Array.isArray(users) ? users : [])]
              .sort((a, b) => {
                if (a.id === 999) return -1;
                if (b.id === 999) return 1;
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
                return a.id - b.id;
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
                  u.id === 999 ||
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
                    s.userId === u.id &&
                    (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now())
                );
                const isExecutive =
                  u.id === 999 ||
                  u.role === 'CLI_ADMIN' ||
                  u.role === 'LOGIN_ADMIN' ||
                  u.role === 'SUPPORT_ADMIN' ||
                  u.role === 'SYSTEM';
                const formattedJoinDate = isExecutive
                  ? '—'
                  : u.createdAt
                  ? u.createdAt.split('T')[0]
                  : '—';

                const roleColors: Record<
                  string,
                  { bg: string; border: string; text: string; name: string }
                > = {
                  CLI_ADMIN: {
                    bg: 'bg-status-away-bg',
                    border: 'border-transparent',
                    text: 'bg-status-away',
                    name: 'CLI Executive Admin',
                  },
                  LOGIN_ADMIN: {
                    bg: 'bg-status-indigo-bg',
                    border: 'border-transparent',
                    text: 'bg-status-indigo',
                    name: 'Executive Login Admin',
                  },
                  SUPPORT_ADMIN: {
                    bg: 'bg-status-sky-bg',
                    border: 'border-transparent',
                    text: 'bg-status-sky',
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
                  BLOCKED: {
                    bg: 'bg-status-dnd-bg',
                    border: 'border-transparent',
                    text: 'bg-status-dnd',
                    name: 'Blocked User',
                  },
                  SYSTEM: {
                    bg: 'bg-status-online-bg',
                    border: 'border-transparent',
                    text: 'bg-status-online',
                    name: 'System Service',
                  },
                };
                const rConf = u.id === 999 ? {
                  bg: 'bg-status-online-bg',
                  border: 'border-transparent',
                  text: 'bg-status-online',
                  name: 'System Bot',
                } : (roleColors[u.role] || roleColors[u.role?.toUpperCase()] || roleColors['USER']);

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-text-primary-2 transition duration-150"
                  >
                    {/* USERNAME & Presence */}
                    <td className="py-4 pl-2 font-bold text-text-primary">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-6 h-6 rounded-lg overflow-hidden border border-white-10 flex items-center justify-center font-black text-[10px] text-accent shrink-0 bg-accent-10">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
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
                            ID: #{u.id}
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
                        <div className="flex items-center justify-end gap-2">
                          {/* Delete button */}
                          {adminRole === 'CLI_ADMIN' && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Are you sure you want to delete ${u.username}? This action cannot be undone.`)) return;
                                
                                try {
                                  const res = await adminFetch(`/v2/admin/users/${u.id}/delete`, {
                                    method: 'POST',
                                  });
                                  if (res.ok) {
                                    alert(`User ${u.username} deleted successfully.`);
                                    fetchData();
                                  } else {
                                    const errData = await res.json();
                                    alert(errData.error || 'Delete failed.');
                                  }
                                } catch {
                                  alert('Server unreachable.');
                                }
                              }}
                              className="p-1.5 rounded-lg bg-status-dnd/10 text-status-dnd hover:bg-status-dnd/20 transition cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Block/Unblock button */}
                          {(adminRole === 'CLI_ADMIN' || adminRole === 'LOGIN_ADMIN') && (
                            <button
                              onClick={async () => {
                                const isBlocked = u.role === 'BLOCKED';
                                const action = isBlocked ? 'unblock' : 'block';
                                
                                if (!confirm(`Are you sure you want to ${action} ${u.username}?`)) return;
                                
                                try {
                                  const res = await adminFetch(`/v2/user/admin/${u.id}/${isBlocked ? 'unblock' : 'block'}`, {
                                    method: 'PATCH',
                                  });
                                  if (res.ok) {
                                    alert(`User ${u.username} ${action}ed successfully.`);
                                    fetchData();
                                  } else {
                                    const errData = await res.json();
                                    alert(errData.error || `${action} failed.`);
                                  }
                                } catch {
                                  alert('Server unreachable.');
                                }
                              }}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                u.role === 'BLOCKED'
                                  ? 'bg-status-online/10 text-status-online hover:bg-status-online/20'
                                  : 'bg-status-away/10 text-status-away hover:bg-status-away/20'
                              }`}
                              title={u.role === 'BLOCKED' ? 'Unblock User' : 'Block User'}
                            >
                              {u.role === 'BLOCKED' ? (
                                <Unlock className="w-4 h-4" />
                              ) : (
                                <Lock className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Promote/Nominate for Support Admin (only for standard members and only visible to LOGIN_ADMIN) */}
                          {(u.role === 'member' ||
                            u.role === 'USER' ||
                            u.role === 'user') &&
                            adminRole === 'LOGIN_ADMIN' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await adminFetch(`/v2/admin/nominate-support`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        targetUserId: u.id
                                      }),
                                    });
                                    if (res.ok) {
                                      alert(`Nominated @${u.username} for Support Admin!`);
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
                                title="Nominate Support Admin"
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
                  No users found in directory
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
