import { ChaosController } from './controller/ChaosController.js';
import {
  DEFAULT_TALK_GAPS_MS,
  parseCli,
  printHelp,
  type ChaosTask,
} from './cli.js';
import { clampAgentCount } from './data/naming.js';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'chaos.config.json');
let fileConfig: Record<string, unknown> = {};

if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    console.error('Failed to load chaos.config.json, using defaults');
  }
}

function taskFlags(task: ChaosTask | undefined): Record<string, boolean> {
  const off = {
    authOnly: false,
    humanTalkOnly: false,
    cuesOnly: false,
    wsOnly: false,
    mediaOnly: false,
    marketOnly: false,
    avatarOnly: false,
    friendsOnly: false,
    loungeOnly: false,
    liveOnly: false,
  };
  if (!task || task === 'full') return off;
  switch (task) {
    case 'talk':
      return { ...off, humanTalkOnly: true };
    case 'auth':
      return { ...off, authOnly: true };
    case 'ws':
      return { ...off, wsOnly: true };
    case 'media':
      return { ...off, mediaOnly: true };
    case 'market':
      return { ...off, marketOnly: true };
    case 'avatar':
      return { ...off, avatarOnly: true };
    case 'friends':
      return { ...off, friendsOnly: true };
    case 'live':
      return { ...off, liveOnly: true };
    case 'cues':
      return { ...off, cuesOnly: true };
    case 'create':
      return { ...off, loungeOnly: true };
    default:
      return off;
  }
}

async function main() {
  let cli;
  try {
    cli = parseCli(process.argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    printHelp();
    process.exit(2);
  }

  if (cli.help) {
    printHelp();
    return;
  }

  const mode = cli.mode || (fileConfig.mode === 'prod' ? 'prod' : 'local');
  const maxUsers = mode === 'prod' ? 100 : 10;

  // Bare `npm start` → max agents + full. Any scoped run requires explicit -t.
  const usersRaw = cli.users ?? maxUsers;
  const agentCount = clampAgentCount(usersRaw, mode);

  const duration =
    cli.durationMs ??
    (typeof fileConfig.duration === 'number' ? fileConfig.duration : 120_000);

  if (!cli.task && (cli.users != null || cli.durationMs != null)) {
    console.error('missing -t / --task  (talk | avatar | auth | ws | media | market | friends | live | cues | create | full)');
    process.exit(2);
  }

  const task: ChaosTask = cli.task ?? 'full';
  const flags = taskFlags(task);

  const gapsMs = cli.gapsMs ?? [...DEFAULT_TALK_GAPS_MS];

  console.log(
    [
      `chaos-cli  task=${task}`,
      `users=${agentCount}${cli.users == null && task === 'full' ? ' (max)' : ''}`,
      `duration=${duration}ms`,
      task === 'talk' ? `gaps=${gapsMs.map((g) => (g === 0 ? 'instant' : `${g / 1000}s`)).join(',')}` : null,
    ]
      .filter(Boolean)
      .join('  ')
  );

  const controller = new ChaosController({
    agentCount,
    duration,
    baseUrl:
      cli.baseUrl ||
      (typeof fileConfig.baseUrl === 'string'
        ? fileConfig.baseUrl
        : 'http://localhost:3000/v2'),
    mode,
    ...flags,
    talkGapsMs: gapsMs,
    creatorCount: typeof fileConfig.creatorCount === 'number' ? fileConfig.creatorCount : 2,
    libraryRoot:
      typeof fileConfig.libraryRoot === 'string'
        ? fileConfig.libraryRoot
        : '/data/data/com.termux/files/home/storage/shared/chaos',
    verboseTerminal: !!fileConfig.verboseTerminal,
    personaDistribution: (fileConfig.personaDistribution as Record<string, number>) || {
      social: 2,
      casual: 2,
      tech: 1,
      drama: 1,
      support: 1,
      attention: 1,
    },
  });

  try {
    await controller.initialize();
    await controller.start();
    controller.generateReports();
  } catch (error) {
    console.error('failed:', error instanceof Error ? error.message : error);
    await controller.stop();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
