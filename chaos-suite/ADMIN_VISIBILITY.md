# 👁️ Admin Visibility Control for Chaos Suite

## Overview

The chaos engineering suite now provides comprehensive control over how visible test users are to system administrators. This allows you to choose between making test users clearly identifiable (for development/testing) or having them appear as regular users (for realistic production testing).

## Two Modes

### 🔍 Visible Mode (Default)
Test users are clearly identifiable to system administrators:

**What Admins See:**
- **Usernames**: `[CHAOS] alex_smith_socialbutterfly_1`
- **Profile Bio**: `[CHAOS TEST USER - SOCIAL_BUTTERFLY] This is an automated test account for chaos engineering testing.`
- **System Tags**: `chaos-test`, `automated`, `testing`, `load-test`
- **Database Flags**: Users marked as test users in the database
- **Session Metadata**: Sessions flagged as test sessions
- **Special Log Prefixes**: `[CHAOS]` prefix in activity logs

**Benefits:**
- Easy to identify and filter test users
- Clear separation between test and real users
- Prevents accidental admin actions on test accounts
- Useful for development and staging environments

### 🕵️ Stealth Mode
Test users appear as regular users to admins:

**What Admins See:**
- **Usernames**: `alex_smith_socialbutterfly_1` (no prefix)
- **Profile Bio**: Normal user bio or empty
- **System Tags**: None
- **Database Flags**: Not marked as test users
- **Session Metadata**: No special flags
- **Logs**: Standard log format without special prefixes

**Benefits:**
- Completely realistic user simulation
- Tests admin tools with real-world data
- No bias in admin decision-making
- Useful for production-like testing

## Configuration

### Visible Mode Config (`chaos.config.json`)
```json
{
  "adminVisibility": {
    "markAsTestUser": true,
    "useObviousUsernames": true,
    "addPrefixToUsernames": true,
    "usernamePrefix": "[CHAOS]",
    "addTestProfile": true,
    "setTestAvatar": false,
    "addSystemTags": true,
    "markTestSessions": true,
    "addSessionMetadata": true,
    "logTestActivity": true,
    "separateTestLogs": true,
    "showInAdminPanel": true,
    "enableTestMetrics": true,
    "allowAdminControl": false
  }
}
```

### Stealth Mode Config (`chaos.stealth.config.json`)
```json
{
  "adminVisibility": {
    "markAsTestUser": false,
    "useObviousUsernames": false,
    "addPrefixToUsernames": false,
    "usernamePrefix": "",
    "addTestProfile": false,
    "setTestAvatar": false,
    "addSystemTags": false,
    "markTestSessions": false,
    "addSessionMetadata": false,
    "logTestActivity": false,
    "separateTestLogs": false,
    "showInAdminPanel": false,
    "enableTestMetrics": false,
    "allowAdminControl": false
  }
}
```

## Usage

### Command Line
```bash
# Visible mode (default)
npm start

# Stealth mode
npm start --stealth

# Custom config
npm start --config custom-config.json
```

### Configuration Options Explained

| Option | Type | Description |
|--------|------|-------------|
| `markAsTestUser` | boolean | Flag users as test users in database |
| `useObviousUsernames` | boolean | Use clearly identifiable usernames |
| `addPrefixToUsernames` | boolean | Add prefix to usernames |
| `usernamePrefix` | string | Custom prefix (e.g., "[CHAOS]", "[TEST]") |
| `addTestProfile` | boolean | Add test metadata to user profiles |
| `setTestAvatar` | boolean | Use specific avatar for test users |
| `addSystemTags` | boolean | Add system tags for identification |
| `markTestSessions` | boolean | Flag sessions as test sessions |
| `addSessionMetadata` | boolean | Add metadata to session tokens |
| `logTestActivity` | boolean | Add special log prefix for test actions |
| `separateTestLogs` | boolean | Use separate log files for test activity |
| `showInAdminPanel` | boolean | Display test users in special admin section |
| `enableTestMetrics` | boolean | Show chaos test metrics in admin dashboard |
| `allowAdminControl` | boolean | Allow admins to pause/resume chaos tests |

## Advanced Usage

### Custom Visibility Profile
Create a custom configuration file with specific visibility settings:

```json
{
  "adminVisibility": {
    "markAsTestUser": true,
    "addPrefixToUsernames": true,
    "usernamePrefix": "[LOAD-TEST]",
    "addTestProfile": false,
    "addSystemTags": true,
    "markTestSessions": false
  }
}
```

Use it: `npm start --config custom-visibility.config.json`

### Dynamic Mode Switching
You can switch between modes by editing the config file or using command-line flags:

```bash
# Start in visible mode
npm start

# Later, switch to stealth for different testing
npm start --stealth
```

## Backend Integration

To take full advantage of the admin visibility features, your Velum backend should:

1. **Handle Test User Flags**: Check `isTestUser` flag in user records
2. **Display Test Metadata**: Show test tags and profile metadata in admin panels
3. **Filter Test Users**: Allow admins to filter out test users from views
4. **Session Metadata**: Use session metadata for tracking test sessions
5. **Log Separation**: Separate test activity logs if `separateTestLogs` is enabled

### Example Backend Integration

```typescript
// Check if user is a test user
function isTestUser(user: User): boolean {
  return user.isTestUser || 
         (user.tags && user.tags.includes('chaos-test')) ||
         user.username.startsWith('[CHAOS]');
}

// Filter test users from admin views
function getRealUsers(users: User[]): User[] {
  return users.filter(user => !isTestUser(user));
}

// Display test user badge in admin panel
function renderUserBadge(user: User): string {
  if (isTestUser(user)) {
    return '<span class="badge-test-user">TEST USER</span>';
  }
  return '';
}
```

## Data Persistence

### Stored Credentials Structure
```typescript
{
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
  userId?: number;
  createdAt: string;
  lastLoginAt?: string;
  persona?: string;
  isActive: boolean;
  isTestUser?: boolean;        // NEW: Test user flag
  testTags?: string[];          // NEW: System tags
}
```

### Agent State Structure
```typescript
{
  agentId: string;
  username: string;
  persona: string;
  currentSessionToken?: string;
  lastActionTime?: string;
  isActive: boolean;
  deviceType?: string;
  ipAddress?: string;
  isTestUser?: boolean;        // NEW: Inherited from credentials
  testTags?: string[];          // NEW: Inherited from credentials
}
```

## Security Considerations

### Visible Mode
- **Pros**: Clear identification prevents accidental admin actions
- **Cons**: Test users are easily distinguishable from real users
- **Best For**: Development, staging, internal testing

### Stealth Mode
- **Pros**: Completely realistic testing environment
- **Cons**: Risk of accidental admin actions on test accounts
- **Best For**: Production-like testing, realistic simulations
- **Mitigation**: Use separate test environment or careful admin training

## Cleanup and Maintenance

### Remove Test Users
When using visible mode, you can easily identify and remove test users:

```sql
-- Remove all test users
DELETE FROM users WHERE username LIKE '[CHAOS]%' OR is_test_user = true;

-- Or using tags
DELETE FROM users WHERE tags @> '["chaos-test"]';
```

### When Using Stealth Mode
Since test users look like regular users, maintain a separate list:

```bash
# Chaos suite maintains chaos-data/credentials.json
# Use this to identify test users for cleanup
```

## Monitoring and Debugging

### Check Current Mode
```bash
# Look at the loaded config in startup logs
npm start

# Output will show which config file was loaded
📋 Loaded configuration from chaos.config.json
# or
📋 Loaded configuration from chaos.stealth.config.json
```

### Verify Test User Creation
Check the `chaos-data/credentials.json` file to see created users and their test flags:

```bash
cat chaos-data/credentials.json | jq '.[] | {username, isTestUser, testTags}'
```

## Best Practices

1. **Development**: Use visible mode for easy debugging
2. **Staging**: Use visible mode to separate test data
3. **Production Testing**: Use stealth mode for realistic simulation
4. **Cleanup**: Regularly clean up test users in visible mode
5. **Documentation**: Keep track of which mode is used in each environment
6. **Admin Training**: Train admins to recognize test user patterns
7. **Monitoring**: Set up alerts for unusual test user activity

## Troubleshooting

### Test Users Not Visible to Admins
- Check that `markAsTestUser` is set to `true`
- Verify backend is reading the `isTestUser` flag
- Ensure admin panels display test user badges

### Stealth Mode Users Still Identifiable
- Verify all visibility flags are set to `false`
- Check that username prefix is empty
- Ensure profile bio doesn't contain test metadata

### Configuration Not Loading
- Verify config file path is correct
- Check JSON syntax is valid
- Look for error messages in startup logs

## Future Enhancements

Potential future features for admin visibility:

- **Dynamic Mode Switching**: Change visibility without restart
- **Admin Dashboard Integration**: Built-in admin panel for chaos test control
- **Test User Quarantine**: Automatically isolate test users
- **Behavioral Analysis**: Detect test user patterns automatically
- **Graceful Degradation**: Fallback to stealth if backend doesn't support visibility