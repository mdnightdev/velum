import { SimpleChaosController } from './controller/SimpleChaosController.js';

async function main() {
  const runId = Date.now();
  const controller = new SimpleChaosController({
    agentCount: 5,
    duration: 300000, // 5 minutes (realistic human session duration)
    baseUrl: 'http://localhost:3000/v2',
    runId: runId
  });

  try {
    await controller.initialize();
    await controller.run();
    controller.generateAuditReport();
  } catch (error) {
    console.error('Chaos test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);