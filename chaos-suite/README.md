# 🎭 Velum Chaos Engineering Suite v2.0

An advanced chaos engineering suite that simulates realistic user behavior patterns for comprehensive testing of the Velum platform.

## 🚀 Features

### Realistic User Simulation
- **10 User Personas**: Different behavioral patterns from social butterflies to lurkers
- **Weighted Action Selection**: Agents choose actions based on their persona characteristics
- **Timing Patterns**: Simulated active hours, inactivity periods, and weekend-only behavior
- **Device & IP Simulation**: Multiple device types and random IP addresses for realistic traffic

### Intelligent Persistence
- **User Reuse**: Existing users login on script rerun instead of creating duplicates
- **Credential Storage**: Secure storage of user credentials in `chaos-data/`
- **State Management**: Track agent states and session tokens across runs
- **Easy Tracking**: Realistic usernames for easy identification in logs

### Comprehensive Logging
- **Detailed Metrics**: Track success rates, action types, error patterns
- **Live Reporting**: Real-time metrics output during test execution
- **Error Analysis**: Categorized error tracking with endpoint and status code
- **Summary Reports**: Automated generation of test summary reports

### Advanced Testing Capabilities
- **Message Testing**: Send messages, create lounges, join/leave lounges
- **User Interactions**: Block, mute, report, delete chat
- **Account Management**: Login, logout, compromise scenarios, deletion requests
- **Support Features**: Create tickets, test support workflows
- **Edge Cases**: Rate limiting, malformed data, invalid endpoints

## 📋 Installation

```bash
cd chaos-suite
npm install
```

## 🎯 Usage

### Basic Usage
```bash
# Run with default configuration (visible to admins)
npm start

# Run in stealth mode (hidden from admins)
npm start --stealth

# Run for specific duration (2 minutes)
npm start --duration 120000

# Run with specific number of agents
npm start --agents 30

# Use custom configuration file
npm start --config custom-config.json

# Show help
npm start --help
```

### Development Mode
```bash
# Run directly with TypeScript (no build required)
npm run dev
```

### Build
```bash
# Build TypeScript to JavaScript
npm run build
```

### Cleanup
```bash
# Remove all generated files and logs
npm run clean
```

## ⚙️ Configuration

The suite uses `chaos.config.json` for configuration. Create this file in the chaos-suite directory:

```json
{
  "totalAgents": 20,
  "personaDistribution": {
    "SOCIAL_BUTTERFLY": 3,
    "LURKER": 4,
    "SPAMMER": 1,
    "ADMIN_POWER": 2,
    "SUPPORT_SEEKER": 2,
    "DRAMA_QUEEN": 2,
    "TECH_SAVVY": 2,
    "CASUAL_USER": 3,
    "NIGHT_OWL": 1,
    "WEEKEND_WARRIOR": 0
  },
  "duration": 300000,
  "maxConcurrentActions": 50,
  "enableMetricsReporting": true,
  "metricsReportInterval": 30000
}
```

### Configuration Options

- **totalAgents**: Total number of agents to simulate
- **personaDistribution**: Number of agents for each persona type
- **duration**: Test duration in milliseconds (undefined = indefinite)
- **maxConcurrentActions**: Maximum concurrent API actions
- **enableMetricsReporting**: Enable periodic metrics output
- **metricsReportInterval**: How often to report metrics (milliseconds)
- **adminVisibility**: Control how visible test users are to system admins

## 👁️ Admin Visibility Control

The chaos suite provides two modes for admin visibility:

### Visible Mode (Default)
Test users are clearly identifiable to system administrators:
- **Usernames**: `[CHAOS] alex_smith_socialbutterfly_1`
- **Profile Bio**: `[CHAOS TEST USER - SOCIAL_BUTTERFLY] This is an automated test account...`
- **System Tags**: `chaos-test`, `automated`, `testing`, `load-test`
- **Database Flags**: Marked as test users in the database
- **Session Metadata**: Sessions flagged as test sessions

### Stealth Mode
Test users appear as regular users to admins:
- **Usernames**: `alex_smith_socialbutterfly_1` (no prefix)
- **Profile Bio**: No test metadata
- **System Tags**: None
- **Database Flags**: Not marked as test users
- **Session Metadata**: No special flags

### Configuration Options
```json
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
```

### Usage
```bash
# Visible mode (default)
npm start

# Stealth mode
npm start --stealth

# Custom stealth config
npm start --config chaos.stealth.config.json
```

## 👥 User Personas

### SOCIAL_BUTTERFLY
- Very active user who loves to create lounges and message everyone
- High message and lounge creation activity
- Active during normal business hours

### LURKER
- Mostly reads content, rarely posts or interacts
- High profile viewing, low message sending
- Longer intervals between actions

### SPAMMER
- High volume repetitive actions, tries to bypass limits
- Very high message frequency
- Tests rate limiting and spam detection

### ADMIN_POWER
- Tests admin features, sanctions users, manages lounges
- Uses sanction, block, mute features frequently
- Tests administrative workflows

### SUPPORT_SEEKER
- Frequently creates tickets and asks for help
- High ticket creation activity
- Tests support workflows

### DRAMA_QUEEN
- Reports users, creates conflicts, high emotional actions
- High report and block activity
- Tests conflict resolution features

### TECH_SAVVY
- Tests features, tries edge cases, explores the system
- Balanced activity across all features
- Tests edge cases and unusual scenarios

### CASUAL_USER
- Normal usage patterns, moderate activity
- Balanced behavior across features
- Represents typical user behavior

### NIGHT_OWL
- Active mainly during late night hours
- Similar to casual user but with different timing
- Tests off-peak performance

### WEEKEND_WARRIOR
- Very active on weekends, inactive during weekdays
- High activity on Saturday/Sunday
- Tests weekend load patterns

## 📊 Output Files

### Logs Directory (`chaos-logs/`)
- **chaos-[timestamp].log**: Detailed activity logs
- **metrics-[timestamp].json**: Raw metrics data
- **metrics-[timestamp]-summary.txt**: Human-readable summary report
- **errors-[timestamp].log**: Error-specific logs

### Data Directory (`chaos-data/`)
- **credentials.json**: Stored user credentials
- **agent-states.json**: Agent state persistence

## 🔍 Monitoring

### Live Metrics
During execution, the suite displays live metrics every 30 seconds (configurable):
- Active agent count
- Total actions performed
- Success rate percentage
- Failed actions count
- Runtime duration

### Summary Report
At the end of each test run, a comprehensive summary report is generated:
- Overall statistics
- Agent-by-agent breakdown
- Error analysis
- Most common error types
- Performance metrics

## 🛠️ Advanced Features

### Device Switching
Agents randomly switch between device types to simulate multi-device usage:
- Desktop (Windows/Mac)
- Mobile (iPhone/Android)
- Tablet

### IP Spoofing
Each agent uses a random IP address to simulate different geographic locations.

### Account Persistence
User credentials are persisted between runs:
- First run: Creates new users
- Subsequent runs: Logs in existing users
- Realistic usernames for easy tracking

### Error Handling
- Configurable retry attempts with exponential backoff
- Option to ignore certain errors based on persona
- Detailed error logging with context

## 🧪 Testing Scenarios

### Load Testing
```bash
# High load with 50 agents for 5 minutes
npm start --agents 50 --duration 300000
```

### Stress Testing
```bash
# Stress test with spammers
# Configure chaos.config.json with high SPAMMER count
npm start
```

### Edge Case Testing
```bash
# Tech-savvy agents focus on edge cases
# Configure chaos.config.json with high TECH_SAVVY count
npm start
```

### Duration Testing
```bash
# Long-running stability test
npm start --duration 3600000  # 1 hour
```

## 🐛 Troubleshooting

### "Too many agents" error
Reduce the `totalAgents` in config or use command-line override.

### "Authentication failed" errors
Check that your Velum server is running and accessible at `http://localhost:3000/v2`.

### High failure rates
- Check server logs for backend issues
- Verify network connectivity
- Review error logs in `chaos-logs/errors-*.log`

### Cleanup needed
```bash
npm run clean
```
This removes all logs, metrics, and stored credentials.

## 📈 Performance Optimization

### Reduce Agent Count
Lower agent count for smoother initial testing:
```bash
npm start --agents 5
```

### Adjust Timing
Modify persona timing patterns in `src/config/agentConfig.ts` to reduce action frequency.

### Disable Metrics
Turn off metrics reporting for performance:
```json
{
  "enableMetricsReporting": false
}
```

## 🔒 Security Considerations

- Credentials are stored locally in `chaos-data/credentials.json`
- Use strong, unique passwords for test accounts
- Don't commit `chaos-data/` to version control
- Clean up test data after use: `npm run clean`

## 🤝 Contributing

When adding new features:
1. Update persona configurations in `src/config/agentConfig.ts`
2. Add API methods to `src/agents/ImprovedApiClient.ts`
3. Implement agent actions in `src/agents/ImprovedAgent.ts`
4. Update this README with new features

## 📝 License

MIT License - See LICENSE file for details

## 🎯 Goals

This chaos suite aims to:
- Simulate realistic user behavior patterns
- Test all major user interaction paths
- Identify performance bottlenecks
- Uncover edge cases and error conditions
- Provide comprehensive metrics for analysis
- Enable easy reproduction of test scenarios

## 🚦 Status

Version 2.0 - Complete rewrite with realistic user simulation, device/IP spoofing, comprehensive logging, and intelligent persistence.