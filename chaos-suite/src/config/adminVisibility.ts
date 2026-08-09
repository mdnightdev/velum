// Admin visibility configuration for chaos test users
export interface AdminVisibilityConfig {
  // User identification
  markAsTestUser: boolean;           // Add special flag to user profile
  useObviousUsernames: boolean;      // Use clearly identifiable usernames
  addPrefixToUsernames: boolean;     // Add prefix like [CHAOS] to usernames
  usernamePrefix: string;            // Custom prefix (e.g., "[TEST]", "[CHAOS]")
  
  // Profile metadata
  addTestProfile: boolean;           // Add "Chaos Test User" to bio
  setTestAvatar: boolean;            // Use specific avatar for test users
  addSystemTags: boolean;            // Add tags like "chaos-test", "automated"
  
  // Session identification
  markTestSessions: boolean;         // Flag sessions as test sessions
  addSessionMetadata: boolean;       // Add metadata to session tokens
  
  // Activity identification
  logTestActivity: boolean;          // Add special log prefix for test actions
  separateTestLogs: boolean;         // Use separate log files for test activity
  
  // Admin dashboard integration
  showInAdminPanel: boolean;         // Display test users in special admin section
  enableTestMetrics: boolean;        // Show chaos test metrics in admin dashboard
  allowAdminControl: boolean;        // Allow admins to pause/resume chaos tests
}

export const DEFAULT_VISIBILITY_CONFIG: AdminVisibilityConfig = {
  markAsTestUser: true,
  useObviousUsernames: true,
  addPrefixToUsernames: false,
  usernamePrefix: '[CHAOS]',
  addTestProfile: true,
  setTestAvatar: false,
  addSystemTags: true,
  markTestSessions: true,
  addSessionMetadata: true,
  logTestActivity: true,
  separateTestLogs: true,
  showInAdminPanel: true,
  enableTestMetrics: true,
  allowAdminControl: false
};

export const STEALTH_MODE_CONFIG: AdminVisibilityConfig = {
  markAsTestUser: false,
  useObviousUsernames: false,
  addPrefixToUsernames: false,
  usernamePrefix: '',
  addTestProfile: false,
  setTestAvatar: false,
  addSystemTags: false,
  markTestSessions: false,
  addSessionMetadata: false,
  logTestActivity: false,
  separateTestLogs: false,
  showInAdminPanel: false,
  enableTestMetrics: false,
  allowAdminControl: false
};

export function generateVisibleUsername(originalUsername: string): string {
  return originalUsername;
}

export function generateTestProfileBio(persona: string): string {
  return `[CHAOS TEST USER - ${persona}] This is an automated test account for chaos engineering testing.`;
}

export function getTestUserTags(): string[] {
  return ['chaos-test', 'automated', 'testing', 'load-test'];
}