import { ImprovedController, ChaosConfig } from './controller/ImprovedController.js';
import { PersonaType } from './config/agentConfig.js';
import fs from 'fs';
import path from 'path';

// Load configuration
function loadConfig(stealthMode: boolean = false): ChaosConfig {
  const configPath = stealthMode 
    ? path.join(process.cwd(), 'chaos.stealth.config.json')
    : path.join(process.cwd(), 'chaos.config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log(`📋 Loaded configuration from ${stealthMode ? 'chaos.stealth.config.json' : 'chaos.config.json'}`);
      return configData as ChaosConfig;
    }
  } catch (error) {
    console.warn('⚠️  Failed to load config file, using defaults:', error);
  }

  // Default configuration
  return {
    totalAgents: 15,
    personaDistribution: {
      SOCIAL_BUTTERFLY: 2,
      LURKER: 3,
      SPAMMER: 1,
      ADMIN_POWER: 1,
      SUPPORT_SEEKER: 2,
      DRAMA_QUEEN: 1,
      TECH_SAVVY: 2,
      CASUAL_USER: 2,
      NIGHT_OWL: 1,
      WEEKEND_WARRIOR: 0
    },
    duration: 60000, // 1 minute default
    enableMetricsReporting: true,
    metricsReportInterval: 15000
  };
}

// Parse command line arguments
function parseArgs(): { config?: string; duration?: number; agents?: number; stealth?: boolean; help: boolean } {
  const args = process.argv.slice(2);
  const result: { config?: string; duration?: number; agents?: number; stealth?: boolean; help: boolean } = { help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        result.config = args[++i];
        break;
      case '--duration':
      case '-d':
        result.duration = parseInt(args[++i], 10);
        break;
      case '--agents':
      case '-a':
        result.agents = parseInt(args[++i], 10);
        break;
      case '--stealth':
      case '-s':
        result.stealth = true;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
🎭 Improved Chaos Engineering Suite

Usage: npm start [options]

Options:
  -c, --config <path>     Path to configuration file (default: chaos.config.json)
  -d, --duration <ms>     Test duration in milliseconds (default: from config or 60000)
  -a, --agents <number>   Override number of agents (default: from config or 15)
  -s, --stealth           Run in stealth mode (hide test user visibility from admins)
  -h, --help              Show this help message

Examples:
  npm start                              # Run with default config (visible to admins)
  npm start --stealth                    # Run in stealth mode (hidden from admins)
  npm start --duration 120000            # Run for 2 minutes
  npm start --agents 30                  # Run with 30 agents
  npm start --config custom-config.json  # Use custom config file

Configuration:
  The suite uses chaos.config.json for configuration. If not found, defaults are used.
  Key configuration options:
  - totalAgents: Total number of agents to simulate
  - personaDistribution: How many agents of each persona type
  - duration: How long to run the test (milliseconds)
  - enableMetricsReporting: Enable periodic metrics output
  - metricsReportInterval: How often to report metrics (milliseconds)
  - adminVisibility: Control how visible test users are to admins

Admin Visibility Options:
  - markAsTestUser: Flag users as test users in database
  - addPrefixToUsernames: Add [CHAOS] prefix to usernames
  - addTestProfile: Add test metadata to user profiles
  - addSystemTags: Add system tags for identification
  - markTestSessions: Flag sessions as test sessions

Stealth Mode:
  When using --stealth, test users will:
  - Use normal usernames without prefixes
  - Not have test metadata in profiles
  - Appear as regular users to admins
  - Still be tracked in chaos-logs for your analysis

Personas:
  - SOCIAL_BUTTERFLY: Very active, creates lounges, messages everyone
  - LURKER: Mostly reads, rarely posts
  - SPAMMER: High volume, repetitive actions
  - ADMIN_POWER: Uses admin features, sanctions users
  - SUPPORT_SEEKER: Creates tickets, asks for help
  - DRAMA_QUEEN: Reports users, creates conflicts
  - TECH_SAVVY: Tests features, tries edge cases
  - CASUAL_USER: Normal usage patterns
  - NIGHT_OWL: Active at odd hours
  - WEEKEND_WARRIOR: Active mainly on weekends

Output:
  - Logs are saved to chaos-logs/ directory
  - Metrics are saved to chaos-logs/metrics-*.json
  - Summary reports are saved to chaos-logs/metrics-*-summary.txt
  - User credentials are persisted in chaos-data/ directory
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('🎭 Improved Chaos Engineering Suite');
  console.log('=====================================\n');

  // Load configuration
  let config = loadConfig(args.stealth || false);
  
  if (args.stealth) {
    console.log('🕵️  STEALTH MODE ENABLED - Test users will be hidden from admins');
  }

  // Override with command line arguments
  if (args.duration) {
    config.duration = args.duration;
    console.log(`⏱️  Duration override: ${args.duration}ms`);
  }

  if (args.agents) {
    config.totalAgents = args.agents;
    console.log(`👥 Agent count override: ${args.agents}`);
  }

  // Validate configuration
  if (config.totalAgents <= 0) {
    console.error('❌ Error: totalAgents must be greater than 0');
    process.exit(1);
  }

  const totalPersonaCount = Object.values(config.personaDistribution).reduce((sum, count) => sum + count, 0);
  if (totalPersonaCount > config.totalAgents) {
    console.warn(`⚠️  Warning: Persona distribution (${totalPersonaCount}) exceeds total agents (${config.totalAgents})`);
    console.warn('   Some personas will not be created');
  }

  // Create and start controller
  const controller = new ImprovedController(config);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    controller.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await controller.start();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    controller.stop();
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});