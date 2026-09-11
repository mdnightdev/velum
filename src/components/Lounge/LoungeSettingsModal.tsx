import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import LoungeInfoPanel from './LoungeInfoPanel';
import LoungeMembersManagePanel from './LoungeMembersManagePanel';
import LoungeApplicationsInvitesPanel from './LoungeApplicationsInvitesPanel';
import LoungeDangerDeletePanel from './LoungeDangerDeletePanel';
import LoungePermissionsPanel from './LoungePermissionsPanel';
import LoungeModerationPanel from './LoungeModerationPanel';
import LoungeNotificationsPanel from './LoungeNotificationsPanel';
import LoungeTransferPanel from './LoungeTransferPanel';
import {
  LoungeSettingsPageId,
  resolveLoungeSettingsRole,
  visibleLoungeSettingsNav,
  canSeeLoungeSettingsPage,
  isVelumOfficialLounge,
  LoungeSettingsNavGroup,
  LOUNGE_SETTINGS_GROUP_ORDER,
} from './loungeSettingsRoles';

export interface LoungeSettingsModalProps {
  show: boolean;
  isDark: boolean;
  loungeName: string;
  loungeId: string;
  loungeDetails: any;
  members: any[];
  currentUserId: number;
  currentUserRole?: string;
  inviteCode?: string | null;
  activePage: LoungeSettingsPageId;
  setActivePage: (page: LoungeSettingsPageId) => void;
  onClose: () => void;
  editName: string;
  setEditName: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editIconUrl: string;
  setEditIconUrl: (v: string) => void;
  editIsPrivate: boolean;
  setEditIsPrivate: (v: boolean) => void;
  uploadError: string;
  setUploadError: (v: string) => void;
  isSavingSettings: boolean;
  onSaveLoungeInfo: (iconFile?: Blob | null) => Promise<void>;
  manageRequests: any[];
  manageInvites: any[];
  directAddUsername: string;
  setDirectAddUsername: (v: string) => void;
  directAddError: string;
  directAddSuccess: string;
  onUpdateRole: (targetUserId: number, newRole: string) => void;
  onSanctionClick: (userId: number, type: 'mute' | 'kick' | 'ban') => void;
  onSelectMember?: (member: any) => void;
  onReviewRequest: (requestId: string, approve: boolean) => void;
  onDirectAddMember: () => void;
  onCreateInviteCode: () => void;
  onRevokeInviteCode: (inviteId: string) => void;
  onDeleteLounge?: () => void;
  onTransferOwnership?: (newOwnerUserId: number) => Promise<boolean>;
}

const GROUP_LABEL: Record<LoungeSettingsNavGroup, string> = {
  overview: 'Overview',
  settings: 'Settings',
  danger: 'Danger zone',
};

const PAGE_LABEL: Record<LoungeSettingsPageId, string> = {
  members: 'Active Members',
  applications_invites: 'Applications & Invites',
  lounge_info: 'Lounge Info',
  permissions: 'Permissions',
  moderation: 'Moderation',
  notifications: 'Notifications',
  danger_transfer: 'Transfer ownership',
  danger_delete: 'Delete Lounge',
};

function formatCreatedAt(raw: unknown): string {
  if (!raw) return '—';
  try {
    return new Date(String(raw)).toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function LoungeSettingsModal({
  show,
  loungeName,
  loungeId,
  loungeDetails,
  members,
  currentUserId,
  currentUserRole,
  inviteCode,
  activePage,
  setActivePage,
  onClose,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editIconUrl,
  setEditIconUrl,
  editIsPrivate,
  setEditIsPrivate,
  uploadError,
  setUploadError,
  isSavingSettings,
  onSaveLoungeInfo,
  manageRequests,
  manageInvites,
  directAddUsername,
  setDirectAddUsername,
  directAddError,
  directAddSuccess,
  onUpdateRole,
  onSanctionClick,
  onSelectMember,
  onReviewRequest,
  onDirectAddMember,
  onCreateInviteCode,
  onRevokeInviteCode,
  onDeleteLounge,
  onTransferOwnership,
}: LoungeSettingsModalProps) {
  const [inDetail, setInDetail] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const membership = useMemo(
    () => (members || []).find((m) => String(m.user_id) === String(currentUserId)),
    [members, currentUserId]
  );

  const ownerId =
    loungeDetails?.ownerId ?? loungeDetails?.owner_id ?? loungeDetails?.owner_user_id ?? null;

  const velumLounge = isVelumOfficialLounge({
    loungeId,
    slug: loungeDetails?.slug,
    isOfficial: loungeDetails?.is_official ?? loungeDetails?.isOfficial,
    isSystem: loungeDetails?.is_system ?? loungeDetails?.isSystem,
  });

  const staffRole = useMemo(
    () =>
      resolveLoungeSettingsRole({
        currentUserId,
        ownerId,
        membershipRole: membership?.role,
        systemUserRole: currentUserRole,
        isVelumLounge: velumLounge,
      }),
    [currentUserId, ownerId, membership?.role, currentUserRole, velumLounge]
  );

  const navItems = useMemo(() => visibleLoungeSettingsNav(staffRole), [staffRole]);

  useEffect(() => {
    if (!show) {
      setInDetail(false);
      return;
    }
    if (staffRole === 'member') {
      setActivePage('members');
      setInDetail(true);
      return;
    }
    setInDetail(false);
    if (!canSeeLoungeSettingsPage(staffRole, activePage)) {
      setActivePage('lounge_info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, staffRole, setActivePage]);

  const displayName = loungeDetails?.name || loungeName || 'Lounge';
  const bio =
    loungeDetails?.description ||
    loungeDetails?.topic ||
    'No topic set for this lounge.';
  const avatar =
    loungeDetails?.avatar_url ||
    loungeDetails?.avatarUrl ||
    loungeDetails?.icon_url ||
    loungeDetails?.iconUrl ||
    null;
  const createdAt = formatCreatedAt(
    loungeDetails?.created_at || loungeDetails?.createdAt
  );
  const memberCount = (members || []).length;

  const primaryInviteCode =
    inviteCode || loungeDetails?.invite_code || loungeDetails?.inviteCode || null;

  const openPage = (pageId: LoungeSettingsPageId) => {
    setActivePage(pageId);
    setInDetail(true);
  };

  if (!show) return null;

  const showBack = inDetail && staffRole !== 'member';
  const showBanner = !inDetail || staffRole === 'member';
  const canEditAccess = staffRole === 'owner' || staffRole === 'admin';

  const renderDetail = () => {
    switch (activePage) {
      case 'lounge_info':
        return (
          <LoungeInfoPanel
            canEdit={canEditAccess}
            lockPrivacy={velumLounge}
            loungeName={loungeName}
            editName={editName}
            setEditName={setEditName}
            editDescription={editDescription}
            setEditDescription={setEditDescription}
            editIconUrl={editIconUrl}
            setEditIconUrl={setEditIconUrl}
            editIsPrivate={editIsPrivate}
            setEditIsPrivate={setEditIsPrivate}
            uploadError={uploadError}
            setUploadError={setUploadError}
            isSaving={isSavingSettings}
            onSave={onSaveLoungeInfo}
            canManageInvites={canEditAccess}
            inviteCode={primaryInviteCode}
            onCreateInviteCode={onCreateInviteCode}
          />
        );
      case 'members':
        return (
          <LoungeMembersManagePanel
            members={members}
            currentUserId={currentUserId}
            onSelectMember={(member) => onSelectMember?.(member)}
          />
        );
      case 'applications_invites':
        return (
          <LoungeApplicationsInvitesPanel
            staffRole={staffRole}
            manageRequests={manageRequests}
            manageInvites={manageInvites}
            directAddUsername={directAddUsername}
            setDirectAddUsername={setDirectAddUsername}
            directAddError={directAddError}
            directAddSuccess={directAddSuccess}
            onReviewRequest={onReviewRequest}
            onDirectAddMember={onDirectAddMember}
            onRevokeInviteCode={onRevokeInviteCode}
          />
        );
      case 'permissions':
        return (
          <LoungePermissionsPanel
            staffRole={staffRole}
            editIsPrivate={editIsPrivate}
            setEditIsPrivate={setEditIsPrivate}
            lockPrivacy={velumLounge}
            canEditAccess={canEditAccess}
            isSaving={isSavingSettings}
            onSaveAccess={async () => {
              await onSaveLoungeInfo(null);
            }}
          />
        );
      case 'moderation':
        return (
          <LoungeModerationPanel
            staffRole={staffRole}
            onOpenMembers={() => openPage('members')}
          />
        );
      case 'notifications':
        return <LoungeNotificationsPanel loungeId={loungeId} />;
      case 'danger_transfer':
        return onTransferOwnership ? (
          <LoungeTransferPanel
            members={members}
            currentUserId={currentUserId}
            isTransferring={isTransferring}
            onTransfer={async (newOwnerUserId) => {
              setIsTransferring(true);
              try {
                const ok = await onTransferOwnership(newOwnerUserId);
                if (ok) {
                  setInDetail(false);
                  onClose();
                }
              } finally {
                setIsTransferring(false);
              }
            }}
          />
        ) : (
          <EmptyPhase label={PAGE_LABEL[activePage]} />
        );
      case 'danger_delete':
        return onDeleteLounge ? (
          <LoungeDangerDeletePanel loungeName={displayName} onDeleteLounge={onDeleteLounge} />
        ) : (
          <EmptyPhase label={PAGE_LABEL[activePage]} />
        );
      default:
        return <EmptyPhase label={PAGE_LABEL[activePage]} />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] modal-backdrop animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-sm flex flex-col overflow-hidden bg-velum-900/95 text-text-primary font-sans"
      >
        <div className="px-4 py-3.5 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {showBack ? (
              <button
                type="button"
                onClick={() => setInDetail(false)}
                className="p-1.5 -ml-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-white-5 transition cursor-pointer shrink-0"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : null}
            <h3 className="text-[17px] font-semibold text-text-primary truncate">
              {inDetail && staffRole !== 'member' ? PAGE_LABEL[activePage] : 'Settings'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-white-5 transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {showBanner ? (
            <div className="px-4 pb-3">
              <div className="rounded-2xl bg-velum-850 border border-white-5 p-4 flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-velum-800 flex items-center justify-center shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-base font-bold text-accent font-mono">
                      {(displayName || 'L').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-text-primary truncate">{displayName}</h2>
                  <p className="text-xs text-text-secondary mt-1 leading-snug line-clamp-2">{bio}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-xs text-text-secondary">
                    <span>{memberCount} active members</span>
                    <span>Created {createdAt}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!inDetail ? (
            <nav className="px-4 pb-6 space-y-5">
              {LOUNGE_SETTINGS_GROUP_ORDER.map((group) => {
                const items = navItems.filter((i) => i.group === group);
                if (items.length === 0) return null;
                const isDanger = group === 'danger';
                return (
                  <section key={group}>
                    <div className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      {GROUP_LABEL[group]}
                    </div>
                    <div
                      className={`rounded-2xl border overflow-hidden ${
                        isDanger
                          ? 'bg-velum-850 border-alert-error/25'
                          : 'bg-velum-850 border-white-5'
                      }`}
                    >
                      {items.map((item, idx) => {
                        const dangerItem = item.id === 'danger_delete' || item.id === 'danger_transfer';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openPage(item.id)}
                            className={`w-full min-h-[3.5rem] px-3.5 py-3 flex items-center gap-3 text-left transition cursor-pointer hover:bg-white-5 ${
                              idx > 0 ? 'border-t border-white-5' : ''
                            }`}
                          >
                            <span
                              className={`flex-1 text-[15px] font-medium truncate ${
                                dangerItem ? 'text-alert-error' : 'text-text-primary'
                              }`}
                            >
                              {item.label}
                            </span>
                            <ChevronRight
                              className={`w-4 h-4 shrink-0 ${
                                dangerItem ? 'text-alert-error/70' : 'text-text-secondary'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </nav>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-0">
              {renderDetail()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPhase({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-12">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-xs text-text-secondary max-w-[14rem]">
        This screen is ready. Content wires in next.
      </p>
    </div>
  );
}
