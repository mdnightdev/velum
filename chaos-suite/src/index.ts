import { Controller } from './controller/Controller.js';

const AGENT_COUNT = 35;
const controller = new Controller(AGENT_COUNT);

console.log('--- Chaos Engineering Suite Starting ---');
controller.start().catch(err => console.error('Fatal error:', err));
