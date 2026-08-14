import { ChaosController } from './controller/ChaosController.js';
import fs from 'fs';
import path from 'path';

// Load configuration
const configPath = path.join(process.cwd(), 'chaos.config.json');
let config: any = {};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error('Failed to load chaos.config.json, using defaults');
  }
}

async function main() {
  const controller = new ChaosController({
    agentCount: config.agentCount || 10,
    duration: config.duration || 60000,
    baseUrl: config.baseUrl || 'http://localhost:3000/v2',
    personaDistribution: config.personaDistribution || {
      SOCIAL_BUTTERFLY: 3,
      CASUAL_USER: 3,
      TECH_SAVVY: 2,
      SUPPORT_SEEKER: 1,
      DRAMA_QUEEN: 1
    }
  });

  try {
    await controller.initialize();
    await controller.start();
    controller.generateReports();
  } catch (error) {
    console.error('Chaos suite failed:', error);
    await controller.stop();
    process.exit(1);
  }
}

main().catch(console.error);