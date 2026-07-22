// VELUM CORE TS TYPES DECLARATION FILE

export interface User {
  user_id: number;
  username: string;
  password_hash: string;
  safe_word_hash: string;
  panic_phrase_hash: string;
  recovery_key_hash: string;
  role: 'CLI_ADMIN' | 'LOGIN_ADMIN' | 'SUPPORT_ADMIN' | 'USER' | 'SYSTEM' | string;
  status: 'active' | 'suspended' | string;
  created_at: string;
  updated_at: string;
  last_seen_at?: string;
  avatar?: string;
  salt?: string;
  promotion_status?: string;
  needs_reset?: boolean | number;
  activation_status?: string;
  permanent_otp?: string | null;
  support_nomination?: string | null;
  uid?: number | string;
  preferred_currency?: string;
}

export interface Profile {
  profile_id: string;
  user_id: number;
  displayName?: string;
  bio?: string;
  avatar?: string;
  updated_at: string;
  settings?: {
    theme?: string;
    notificationsEnabled?: boolean;
    burnDefaultSeconds?: number;
  };
  location?: string;
  joined_lounge_rooms?: string[];
  joined_lounges?: string[];
}

export interface Session {
  session_id: string;
  user_id: number;
  token?: string;
  ip_address?: string;
  device_id: string;
  created_at?: string;
  expires_at?: string;
  ip_id?: string;
  status?: string;
  start_time?: string | number;
  end_time?: string | number | null;
  activity_metrics?: any;
}

export interface Device {
  device_id: string;
  user_id: number;
  user_agent?: string;
  fingerprint?: string;
  status: 'trusted' | 'untrusted' | string;
  created_at?: string;
  risk_score?: number;
  accounts_linked?: number;
  first_seen?: string;
  last_seen?: string;
}

export interface IpAddress {
  ip_id: string;
  user_id: number;
  ip_address: string;
  geo_location?: string;
  status?: 'allowed' | 'blacklisted' | string;
  created_at?: string;
  risk_score?: number;
  accounts_linked?: number;
  first_seen?: string;
  last_seen?: string;
}

export interface Message {
  id?: string;
  message_id: string;
  room_id: string;
  user_id: number;
  username?: string;
  content: string;
  timestamp: string | number;
  status?: 'sent' | 'delivered' | 'read' | string;
  deleted?: boolean;
  reactions?: Record<string, string[]>;
  burn_seconds?: number | null;
  is_encrypted?: boolean;
  isEncrypted?: boolean;
  encrypted_content?: string;
  lounge_id?: string;
  reply_to?: string | null;
  expires_in?: string | number | null;
  edited_at?: string;
}

export interface UserBlock {
  block_id: string;
  blocker_id: number;
  blocked_id: number;
  created_at: string | number;
}

export interface UserMute {
  mute_id: string;
  muter_id: number;
  muted_id: number;
  created_at: string | number;
}

export interface AdminSanction {
  sanction_id: string;
  admin_id: number;
  target_id?: number;
  type: 'kick' | 'ban' | 'mute' | string;
  reason?: string;
  created_at?: string | number;
  expires_at?: string | number | null;
  user_id?: number;
  room_id?: string | null;
}

export interface Invite {
  invite_id: string;
  code: string;
  creator_id: number;
  used_by_id?: number | null;
  status: 'active' | 'used' | string;
  created_at: string | number;
  used_at?: string | number | null;
  created_by?: number;
  used_by?: string | null;
  expires_at?: string | number | null;
  approved_by?: number;
}

export interface Ticket {
  ticket_id: string;
  user_id: number;
  reason?: string;
  credentials_forwarded?: string;
  status: 'pending' | 'resolved' | 'denied' | string;
  reviewer_id?: number | null;
  created_at: string | number;
  updated_at?: string | number;
  credibility_score?: number;
  messages?: any[];
  issue_type?: string;
  username?: string;
  assigned_admin?: number | null;
  tracking_id?: string;
  resolved_at?: string | number | null;
  provided_recovery_key?: string | null;
}

export interface RecoveryEvent {
  event_id: string;
  user_id: number;
  type?: string;
  timestamp: string | number;
  method?: string;
  approved_by?: number | null;
  notes?: string;
}

export interface SuspiciousEvent {
  event_id: string;
  user_id?: number | null;
  type?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  description: string;
  ip_address?: string;
  timestamp?: string | number;
  risk_level?: string;
  created_at?: string | number;
  entity_type?: string;
  entity_id?: string | number;
}

export interface AuditLog {
  log_id: string;
  user_id?: number;
  action: string;
  details?: string;
  ip_address?: string;
  timestamp: string | number;
  admin_name?: string;
  target_id?: string | number;
  reason?: string;
  admin_id?: number;
  target_type?: string;
}

export interface WsPayload {
  type: string;
  [key: string]: any;
}

export interface FriendRequest {
  request_id: string;
  sender_id: number;
  receiver_id: number;
  status: 'pending' | 'accepted' | 'declined' | string;
  created_at: string | number;
  sender_name?: string;
  sender_avatar?: string;
}

export interface PeerRelationship {
  relationship_id?: string;
  user_id_1?: number;
  user_id_2?: number;
  status: 'friends' | 'blocked' | string;
  created_at: string | number;
  id?: string | number;
  userId?: number;
  friendId?: number;
  sender_uid?: number | string;
  receiver_uid?: number | string;
}

export interface Lounge {
  lounge_id: string;
  name: string;
  description?: string;
  owner_id: number | string;
  created_at: string | number;
  is_private?: any;
  is_official?: boolean | number;
  invite_code?: string | null;
  accessLevel?: 'ALL' | 'ANNOUNCE' | 'EXEC_ONLY';
  last_message_at?: string | number | null;
  icon_url?: string;
  
  // New architecture fields
  id?: string;
  slug?: string;
  creator_id?: string;
  parent_lounge_id?: string | null;
  updated_at?: number;
  is_system?: number | boolean;
  type?: 'official' | 'user_created' | 'private_sublounge';
  owner_user_id?: number | null;
  visibility?: 'public' | 'private' | 'invite_only';
  hide_member_list?: boolean | number;
  is_locked?: boolean | number;
  status?: 'active' | 'muted' | 'archived' | 'deleted' | 'suspended';
  last_active_at?: number;
  access_level?: 'ALL' | 'ANNOUNCE' | 'EXEC_ONLY';
}

export interface LoungeRoom {
  id: string;
  lounge_id: string;
  name: string;
  topic?: string;
  created_at: string | number;
  is_locked?: boolean;
  created_by?: number;
  invite_code?: string | null;
  accessLevel?: 'ALL' | 'ANNOUNCE' | 'EXEC_ONLY';
}

export interface LoungeMember {
  lounge_id: string;
  user_id: number;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'banned' | 'kicked';
  joined_via: 'invite_code' | 'added_by_admin' | 'application' | 'default';
  joined_at: number;
}

export interface LoungeInvite {
  id: string;
  lounge_id: string;
  code: string;
  created_by: number;
  max_uses: number;
  uses_count: number;
  expires_at: number | null;
  revoked_at: number | null;
}

export interface LoungeSanction {
  id: string;
  lounge_id: string;
  user_id: number;
  type: 'mute' | 'ban' | 'kick' | 'delete_lounge';
  applied_by: number;
  applied_by_type: 'lounge_admin' | 'login_admin' | 'cli_admin';
  applied_at: number;
  lifted_at: number | null;
  reason: string;
}

export interface LoungeJoinRequest {
  id: string;
  lounge_id: string;
  user_id: number;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: number | null;
}

export interface LoungeOwnershipTransfer {
  id: string;
  lounge_id: string;
  from_user_id: number;
  to_user_id: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  initiated_at: number;
  resolved_at: number | null;
}

export interface AccountDeletionRequest {
  id: string;
  user_id: number;
  requested_at: number;
  scheduled_purge_at: number;
  status: 'pending' | 'cancelled' | 'purged';
}

export interface UserLoungePreference {
  user_id: number;
  lounge_id: string;
  notifications_muted: boolean | number;
  pinned: boolean | number;
  pin_order: number | null;
}

export interface LoungeAuditLog {
  id: string;
  lounge_id: string;
  actor_id: number;
  actor_type: 'lounge_admin' | 'login_admin' | 'cli_admin';
  action: 'mute' | 'ban' | 'kick' | 'delete_message' | 'delete_lounge' | 'transfer_ownership' | 'settings_change';
  target_type: string;
  target_id: string;
  metadata: string;
  created_at: number;
}

export interface SystemAuditLog {
  id: string;
  actor_id: number;
  actor_type: 'login_admin' | 'cli_admin';
  action: 'account_purge' | 'ticket_resolved' | 'lounge_force_deleted' | 'global_ban' | 'policy_override';
  target_type: string;
  target_id: string;
  metadata: string;
  created_at: number;
}

export interface MarketListing {
  listing_id: string;
  seller_id: number;
  seller_username?: string;
  title: string;
  description?: string;
  price: number;
  discount_price?: number | null;
  status: string;
  verification_status?: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | string;
  inventory_count?: number;
  created_at: string | number;
  average_rating?: number;
  review_count?: number;
  sku_variants?: MarketSkuVariant[];
  media_list?: MarketAssetMedia[];
}

export interface EscrowTransaction {
  transaction_id: string;
  listing_id: string;
  buyer_id: number;
  buyer_username?: string;
  seller_id: number;
  seller_username?: string;
  amount: number;
  status: string;
  coupon_applied?: string | null;
  sku_variant_id?: string | null;
  platform_fee?: number;
  payout_amount?: number;
  sandbox_logs?: string[];
  sandbox_state?: string;
  created_at: string | number;
  updated_at?: string | number;
}

export interface MarketAssetMedia {
  media_id: string;
  listing_id: string;
  url: string;
  type?: 'image' | 'video' | string;
  created_at?: string | number;
  aspect_ratio?: string;
  file_size?: number;
  is_banner?: boolean;
  display_order?: number;
}

export interface MarketSkuVariant {
  sku_id: string;
  variant_id?: string;
  listing_id: string;
  attribute_name: string;   // e.g. 'license_tier'
  attribute_value: string;  // e.g. 'enterprise_unlimited'
  additional_cost_cents: number;
  inventory_count: number;
  file_payload_path?: string;
}

export interface MarketReview {
  review_id: string;
  listing_id: string;
  buyer_id: number;
  buyer_username?: string;
  rating: number;
  comment?: string;
  created_at: string | number;
  is_reported?: boolean;
  helpful_votes?: number[];
  moderation_reason?: string;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'TIERED';

export interface TierRule {
  min_cents: number;
  deduction_cents: number;
}

export interface MarketCoupon {
  coupon_id: string;
  code: string;
  discount_type: DiscountType;
  value_cents_or_pct: number;
  tier_rules?: TierRule[];
  expiration_date: number;
  usage_limit: number;
  usage_count: number;
  minimum_order_value_cents: number;
  active: boolean;
  value?: number; // Legacy compatibility
}

export interface MarketDiscussion {
  discussion_id: string;
  listing_id: string;
  user_id: number;
  username: string;
  comment: string;
  created_at: string | number;
  parent_id?: string | null;
}

export interface MarketSupportChatMessage {
  message_id: string;
  sender_id: number;
  sender_username: string;
  content: string;
  created_at: number;
}

export interface MarketSupportChat {
  chat_id: string;
  order_id: string;
  is_disputed: boolean;
  disputed_by_user_id?: number;
  resolved_at?: number | null;
  created_at: number;
  messages: MarketSupportChatMessage[];
}

// CRYPTO & UTILITIES ENGINE (PILLAR E)
export interface UserWallet {
  user_id: number;
  balance_cents: number;
  updated_at: number | string;
}

export interface WalletLedgerEntry {
  entry_id: string;
  user_id: number;
  currency_code?: string;
  entry_type: 'RECHARGE' | 'WITHDRAWAL' | 'ESCROW_HOLD' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'PLATFORM_FEE' | 'AUTOMATED_ADJUSTMENT' | string;
  amount_cents: number;
  balance_after_cents: number;
  related_transaction_id?: string | null;
  actor_type: 'USER' | 'ADMIN' | 'SYSTEM_AUTOMATION' | string;
  actor_id?: string | number | null;
  is_simulated?: boolean | number;
  created_at: number | string;
}

export interface RechargeRequest {
  request_id: string;
  user_id: number;
  amount_cents: number;
  status: 'SIMULATED_COMPLETE' | 'PENDING' | 'FAILED' | string;
  simulated_method?: string;
  payment_method_id?: string;
  created_at: number | string;
}

export interface WithdrawalRequest {
  request_id: string;
  user_id: number;
  amount_cents: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | string;
  reviewed_by_admin_id?: string | null;
  payout_method_id?: string;
  kyc_verification_id?: string;
  reviewed_at?: number | string | null;
  created_at: number | string;
}

export interface KycVerification {
  kyc_id: string;
  user_id: number;
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  verification_level: 'NONE' | 'BASIC' | 'FULL';
  submitted_name?: string;
  submitted_document_type?: 'PASSPORT_SIM' | 'DRIVERS_LICENSE_SIM' | 'NATIONAL_ID_SIM' | string | null;
  simulated_document_ref?: string;
  reviewed_by_admin_id?: string | null;
  reviewed_at?: number | string | null;
  rejection_reason?: string;
  created_at: number | string;
  updated_at: number | string;
}

export interface PaymentMethod {
  payment_method_id: string;
  user_id: number;
  method_type: 'CARD' | 'BANK_ACCOUNT' | string;
  external_account_token: string;
  display_label: string;
  is_default: boolean | number;
  status: 'ACTIVE' | 'EXPIRED' | 'REMOVED' | string;
  added_at: number | string;
  removed_at?: number | string | null;
}

export interface ExternalFinancialAccount {
  account_token: string;
  user_id: number;
  account_kind: 'CARD' | 'BANK_ACCOUNT' | string;
  institution: string;
  masked_number: string;
  available_cents: number;
  expires_at_sim?: number | string | null;
  is_active: boolean | number;
  created_at: number | string;
}

export interface ExternalProcessorEvent {
  event_id: string;
  account_token: string;
  direction: 'CHARGE' | 'PAYOUT' | string;
  amount_cents: number;
  status?: 'APPROVED' | 'DECLINED_ACCOUNT_FROZEN' | 'DECLINED_EXPIRED' | 'DECLINED_INSUFFICIENT_FUNDS' | 'DECLINED_GENERIC' | string;
  result?: 'APPROVED' | 'DECLINED_ACCOUNT_FROZEN' | 'DECLINED_EXPIRED' | 'DECLINED_INSUFFICIENT_FUNDS' | 'DECLINED_GENERIC' | string;
  simulated_processor_ref?: string;
  latency_ms?: number;
  simulated_latency_ms?: number;
  related_request_id?: string;
  created_at: number | string;
}

export interface WalletBalance {
  user_id: number;
  currency_code: string;
  balance_cents: number;
  updated_at: number | string;
}

export interface Currency {
  currency_code: string;
  display_name: string;
  is_platform_native: boolean | number;
  redeemable_for_cash: boolean | number;
  decimal_places: number;
  active: boolean | number;
}

export interface ExchangeRate {
  rate_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  simulated_source?: string;
  effective_at: number | string;
}

export interface PlatformAdmin {
  admin_id: string;
  user_id: number;
  can_approve_withdrawals: boolean | number;
  can_resolve_disputes: boolean | number;
  can_override_escrow: boolean | number;
  granted_by_user_id: number;
  created_at: number | string;
}

export function stripAt(username: string): string {
  if (!username) return '';
  return username.startsWith('@') ? username.slice(1) : username;
}

export interface Report {
  report_id: string;
  reporter_id: number;
  reporter_name?: string;
  target_user_id?: number | null;
  target_username?: string | null;
  target_message_id?: string | null;
  type: 'user_misconduct' | 'bug_report' | 'suggestion';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  status: 'pending' | 'reviewed' | 'closed';
  created_at: string;
}

// Global window extensions for diagnostic state tracking (Pillar G)
declare global {
  interface Window {
    velumDebug?: {
      userId: number | null;
      username: string | null;
      buildVersion?: string;
      authState?: boolean;
      wsConnected?: boolean;
      lastMessageTimestamp?: string | null;
      averagePing?: number;
      reconnectCount?: number;
      activeSessionId?: string | null;
      lastServerEventTimestamp?: string | null;
      [key: string]: any;
    };
  }
}
