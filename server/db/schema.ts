import { 
  User, Profile, Session, Device, IpAddress, 
  Message, UserBlock, UserMute, AdminSanction, Invite, Ticket, RecoveryEvent, 
  SuspiciousEvent, AuditLog, FriendRequest, PeerRelationship,
  Lounge, LoungeRoom, MarketListing, EscrowTransaction,
  MarketAssetMedia, MarketReview, MarketCoupon, MarketDiscussion, MarketSkuVariant, MarketSupportChat,
  LoungeMember, LoungeInvite, LoungeSanction, LoungeJoinRequest, LoungeOwnershipTransfer, AccountDeletionRequest, UserLoungePreference, LoungeAuditLog, SystemAuditLog,
  UserWallet, WalletLedgerEntry, RechargeRequest, WithdrawalRequest, KycVerification, PaymentMethod, ExternalFinancialAccount, ExternalProcessorEvent, WalletBalance, Currency, ExchangeRate, PlatformAdmin,
  Report
} from '../../src/types.js';

export interface DbSchema {
  users: User[];
  profiles: Profile[];
  purged_users?: User[];
  purged_profiles?: Profile[];
  sessions: Session[];
  devices: Device[];
  ip_addresses: IpAddress[];
  messages: Message[];
  user_blocks: UserBlock[];
  user_mutes: UserMute[];
  admin_sanctions: AdminSanction[];
  invites: Invite[];
  tickets: Ticket[];
  reports?: Report[];
  recovery_events: RecoveryEvent[];
  suspicious_events: SuspiciousEvent[];
  audit_logs: AuditLog[];
  friend_requests?: FriendRequest[];
  peer_relationships?: PeerRelationship[];
  join_requests?: any[];
  temp_admin_token?: string | null;
  lounges?: Lounge[];
  lounge_rooms?: LoungeRoom[];
  market_listings?: MarketListing[];
  market_assets?: MarketListing[];
  escrow_transactions?: EscrowTransaction[];
  market_asset_media?: MarketAssetMedia[];
  market_reviews?: MarketReview[];
  market_coupons?: MarketCoupon[];
  market_discussions?: MarketDiscussion[];
  market_sku_variants?: MarketSkuVariant[];
  market_support_chats?: MarketSupportChat[];
  node_overwrites?: any[];
  lounge_members?: LoungeMember[];
  lounge_invites?: LoungeInvite[];
  lounge_sanctions?: LoungeSanction[];
  lounge_join_requests?: LoungeJoinRequest[];
  lounge_ownership_transfers?: LoungeOwnershipTransfer[];
  account_deletion_requests?: AccountDeletionRequest[];
  user_lounge_preferences?: UserLoungePreference[];
  lounge_audit_logs?: LoungeAuditLog[];
  system_audit_logs?: SystemAuditLog[];
  user_wallets?: UserWallet[];
  wallet_ledger_entries?: WalletLedgerEntry[];
  recharge_requests?: RechargeRequest[];
  withdrawal_requests?: WithdrawalRequest[];
  kyc_verifications?: KycVerification[];
  payment_methods?: PaymentMethod[];
  external_financial_accounts?: ExternalFinancialAccount[];
  external_processor_events?: ExternalProcessorEvent[];
  wallet_balances?: WalletBalance[];
  currencies?: Currency[];
  exchange_rates?: ExchangeRate[];
  platform_admins?: PlatformAdmin[];
  platform_financial_audit_logs?: any[];
  automation_actions?: any[];
  refund_requests?: any[];
  listing_verification_checks?: any[];
  verified_sellers?: number[];
}
// Validate admin credentials configuration
export const adminUsers = (() => {
  const users: User[] = [];

  // CLI_ADMIN configuration
  if (process.env.CLI_ADMIN_USERNAME && process.env.CLI_ADMIN_PASSWORD_HASH) {
    if (!process.env.CLI_ADMIN_SAFE_WORD_HASH || !process.env.CLI_ADMIN_PANIC_PHRASE_HASH || !process.env.CLI_ADMIN_RECOVERY_KEY_HASH) {
      throw new Error('SECURITY ERROR: CLI_ADMIN configured but missing required hash fields (SAFE_WORD, PANIC_PHRASE, or RECOVERY_KEY)');
    }
    users.push({
      user_id: 1,
      username: process.env.CLI_ADMIN_USERNAME,
      password_hash: process.env.CLI_ADMIN_PASSWORD_HASH,
      safe_word_hash: process.env.CLI_ADMIN_SAFE_WORD_HASH,
      panic_phrase_hash: process.env.CLI_ADMIN_PANIC_PHRASE_HASH,
      recovery_key_hash: process.env.CLI_ADMIN_RECOVERY_KEY_HASH,
      role: 'CLI_ADMIN',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // LOGIN_ADMIN configuration
  if (process.env.LOGIN_ADMIN_USERNAME && process.env.LOGIN_ADMIN_PASSWORD_HASH) {
    if (!process.env.LOGIN_ADMIN_SAFE_WORD_HASH || !process.env.LOGIN_ADMIN_PANIC_PHRASE_HASH || !process.env.LOGIN_ADMIN_RECOVERY_KEY_HASH) {
      throw new Error('SECURITY ERROR: LOGIN_ADMIN configured but missing required hash fields (SAFE_WORD, PANIC_PHRASE, or RECOVERY_KEY)');
    }
    users.push({
      user_id: users.length > 0 ? 2 : 1,
      username: process.env.LOGIN_ADMIN_USERNAME,
      password_hash: process.env.LOGIN_ADMIN_PASSWORD_HASH,
      safe_word_hash: process.env.LOGIN_ADMIN_SAFE_WORD_HASH,
      panic_phrase_hash: process.env.LOGIN_ADMIN_PANIC_PHRASE_HASH,
      recovery_key_hash: process.env.LOGIN_ADMIN_RECOVERY_KEY_HASH,
      role: 'LOGIN_ADMIN',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  return users;
})();

export const defaultDb: DbSchema = {
  users: adminUsers,
  profiles: adminUsers.map(admin => ({
    profile_id: `p_${admin.user_id}`,
    user_id: admin.user_id,
    bio: admin.role === 'CLI_ADMIN' ? 'Verified CLI Security Administrator. Operational Systems Command.' : 'Verified Executive Director.',
    avatar: '',
    updated_at: new Date().toISOString(),
    settings: { theme: 'slate', notificationsEnabled: true, burnDefaultSeconds: 0 }
  })),
  sessions: [],
  devices: [],
  ip_addresses: [],
  messages: [],
  user_blocks: [],
  user_mutes: [],
  admin_sanctions: [],
  invites: [],
  tickets: [],
  reports: [],
  recovery_events: [],
  suspicious_events: [],
  audit_logs: [],
  peer_relationships: [],
  join_requests: [],
  lounges: [],
  lounge_rooms: [],
  lounge_members: [],
  lounge_invites: [],
  lounge_sanctions: [],
  lounge_join_requests: [],
  lounge_ownership_transfers: [],
  account_deletion_requests: [],
  user_lounge_preferences: [],
  lounge_audit_logs: [],
  system_audit_logs: [],
  user_wallets: [],
  wallet_ledger_entries: [],
  recharge_requests: [],
  withdrawal_requests: [],
  kyc_verifications: [],
  payment_methods: [],
  external_financial_accounts: [],
  external_processor_events: [],
  wallet_balances: [],
  currencies: [],
  exchange_rates: [],
  platform_admins: [],
  platform_financial_audit_logs: [],
  automation_actions: [],
  refund_requests: [],
  listing_verification_checks: [],
  verified_sellers: [],
  market_assets: []
};

export interface TableConfig {
  name: string;
  pkName: string;
  getPkValue: (row: any) => string | number;
  insertSql: string;
  getParams: (row: any, encryptedPayload: string) => any[];
}

export const TABLE_CONFIGS: Record<string, TableConfig> = {
  users: {
    name: 'users',
    pkName: 'user_id',
    getPkValue: (r) => r.user_id,
    insertSql: "",
    getParams: (r, enc) => []
  }
};
