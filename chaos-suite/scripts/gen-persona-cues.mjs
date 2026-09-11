import fs from 'fs';
import path from 'path';

const CUE_IDS = [
  'greeting',
  'thanks',
  'bug',
  'help',
  'market',
  'event',
  'opinion',
  'compliment',
  'dismiss',
  'question',
  'farewell',
  'agree',
  'hype',
  'general',
];

const base = {
  greeting: [
    'hey',
    'hi',
    'hello',
    'yo',
    'hey hey',
    'hi there',
    'hello hello',
    'morning',
    'evening',
    'wave back',
  ],
  thanks: [
    'anytime',
    'no problem',
    'glad it helped',
    'you are welcome',
    'sure thing',
    'happy to',
    'of course',
    'np',
  ],
  bug: [
    'I saw something similar',
    'can you still repro',
    'worth noting',
    'same here earlier',
    'refresh help?',
    'mobile or desktop',
    'logging that',
    'hmm odd',
  ],
  help: [
    'I can try to help',
    'which step are you on',
    'try settings',
    'say more',
    'one step at a time',
    'happy to walk through',
    'start from the top',
    'no rush',
  ],
  market: [
    'prices look mixed',
    'I am watching the board',
    'fair ask matters',
    'comps help',
    'quiet board today',
    'careful on rush deals',
    'I browse a lot',
    'budget first',
  ],
  event: [
    'I am interested',
    'when is it',
    'maybe from me',
    'hope they post times',
    'small hang sounds good',
    'count a soft yes',
    'need the schedule',
    'ping when locked',
  ],
  opinion: [
    'fair take',
    'I see it differently',
    'interesting',
    'depends',
    'I can see that',
    'hot take received',
    'mid but fun',
    'say more',
  ],
  compliment: [
    'thanks',
    'appreciate that',
    'you are kind',
    'likewise',
    'stop it lol',
    'means a lot',
    'back at you',
    'soft blush in text',
  ],
  dismiss: [
    'cap',
    'nah',
    'mid',
    'doubt',
    'pass',
    'if you say so',
    'sure jan',
    'not buying it',
  ],
  question: [
    'good question',
    'not sure',
    'maybe',
    'ask again clearer?',
    'I wonder too',
    'depends',
    'let me think',
    'anyone know?',
  ],
  farewell: [
    'later',
    'bye',
    'catch you',
    'gn',
    'afk',
    'heading out',
    'see you',
    'soft exit',
  ],
  agree: ['same', 'true', 'facts', 'agreed', 'exactly', 'this', 'yep', 'real'],
  hype: [
    'lets go',
    'fire',
    'w',
    'gg',
    'hype',
    'built different',
    'love that',
    'go off',
  ],
  general: [
    'makes sense',
    'got it',
    'interesting',
    'noted',
    'alright',
    'cool',
    'hmm',
    'okay',
  ],
};

const voices = {
  social: {
    greeting: [
      'hey hey!',
      'hi friends',
      'yo welcome',
      'hello hello',
      'pull up',
      'wave back friend',
      'hey you',
      'hi hi',
      'who else is here',
      'glad you said hi',
    ],
    compliment: [
      'aw thanks',
      'hey damn you cute asf',
      'you too tho',
      'stop im shy',
      'group hug',
      'love that energy',
      'back at you soft',
      'ok flirt received',
    ],
    dismiss: [
      'cap but make it friendly',
      'nahhh',
      'mid take friend',
      'I allow it anyway',
      'lol no',
      'respectfully cap',
    ],
    hype: [
      'YES',
      'lets gooo',
      'hype train',
      'I am so here for this',
      'screaming softly',
      'w for the room',
    ],
  },
  casual: {
    greeting: ['yo', 'hey', 'sup', 'hi', 'mm hey', 'hey lowkey'],
    general: ['yeah', 'k', 'cool', 'alright', 'fair', 'eh', 'sure', 'ok'],
    farewell: ['later', 'bye', 'gone', 'afk', 'peace soft'],
  },
  tech: {
    greeting: ['hey', 'hi', 'checking in', 'quick hello', 'here for notes'],
    bug: [
      'repro steps?',
      'same flicker once',
      'mobile only?',
      'after refresh?',
      'sounds like a race',
      'file it in bugs',
      'I can try to repro',
      'version?',
      'console noise?',
      'not urgent but real',
    ],
    help: [
      'which screen',
      'error text?',
      'settings then profile',
      'logout login once',
      'narrow the step',
      'I can list options',
    ],
    question: [
      'define the input',
      'what was expected',
      'actual vs expected',
      'edge case?',
      'logs?',
    ],
  },
  drama: {
    greeting: ['oh you showed up', 'hi main character', 'hello plot', 'hey then'],
    opinion: [
      'okay but',
      'unpopular: maybe',
      'I said what I said',
      'rate that take',
      'mid',
      'actually fire',
      'debate me',
      'side eye',
    ],
    dismiss: ['cap', 'sit down', 'mid forever', 'nope', 'try again', 'loud wrong'],
    compliment: ['okay you ate', 'fine that was cute', 'not not cute', 'damn alright'],
  },
  support: {
    greeting: [
      'hi, I can help',
      'hello, take your time',
      'hey, what step',
      'welcome, ask anything basic',
    ],
    help: [
      'which step are you on',
      'no rush',
      'try settings then profile',
      'say the exact button',
      'one step',
      'we can redo it',
      'you are in the right place',
      'logout login fixed mine once',
    ],
    thanks: [
      'anytime',
      'glad it helped',
      'that is why I am here',
      'ask again if stuck',
      'proud of you trying',
    ],
    farewell: ['ping if you need more', 'take care', 'I will check back', 'bye for now'],
  },
  attention: {
    greeting: ['HEY notice me', 'big hello', 'eyes here', 'hi spotlight', 'wave at me back'],
    hype: ['APPLAUSE', 'encore', 'main stage', 'hype me hype you', 'W', 'spotlight on'],
    compliment: [
      'I know right',
      'thank you thank you',
      'keep the eyes coming',
      'blush but loud',
    ],
    farewell: ['exit with jazz hands', 'miss me already', 'encore later', 'bye but watching'],
  },
  lurker: {
    greeting: ['…hi', 'hey', 'hi', '…', 'mm hi'],
    general: ['k', 'ok', 'seen', 'm', 'same', 'true', '…'],
    farewell: ['…bye', 'gone', 'lurk', 'afk', '…'],
    agree: ['same', 'k', 'true', 'y'],
  },
  market: {
    greeting: ['hey board folks', 'hi', 'market brain on', 'hello scanners'],
    market: [
      'comps?',
      'ask seems soft',
      'I would wait',
      'fair photos matter',
      'budget first',
      'too cheap is a flag',
      'watching not buying',
      'quiet board',
      'weekend weird',
      'pass for me',
    ],
    dismiss: ['overpriced', 'pass', 'nah', 'not at that ask', 'walk'],
    question: ['what is the ask', 'any comps', 'condition?', 'why the rush'],
  },
  creative: {
    greeting: ['hey mood', 'hi studio hallway', 'hello vibe', 'hey hey soft'],
    compliment: [
      'that frame tho',
      'aesthetic yes',
      'mood saved',
      'love the texture of that',
    ],
    opinion: ['color of the day?', 'process > polish', 'weird is good', 'I see a collage'],
    general: ['mood', 'texture', 'noted visually', 'saving that'],
  },
  nightowl: {
    greeting: ['late hey', 'night crew hi', 'insomniac hello', 'dim lights hi'],
    farewell: ['trying sleep', 'night', 'gn', 'fading', 'owl out'],
    general: ['same', 'quiet hits different', 'still up', 'yep'],
  },
  newbie: {
    greeting: ['hi I am new', 'hello please be kind', 'hey still learning', 'hi hi'],
    help: [
      'is this the right room',
      'how do I…',
      'where is settings',
      'sorry if wrong place',
      'what is a sublounge',
      'can someone point',
    ],
    thanks: ['thank you!!', 'thanks for patience', 'ty ty', 'appreciate you'],
    question: ['dumb question ok?', 'what does that mean', 'am I lost', 'which button'],
  },
  organizer: {
    greeting: ['hello team', 'hi, quick check', 'hey schedule brain', 'hello'],
    event: [
      'time options soon',
      'soft RSVP',
      'small hang?',
      'need a slot',
      'agenda light',
      'who is free',
      'lock maybe time',
      'recap if you miss',
    ],
    question: ['A or B time?', 'who co-hosts?', 'keep under 30?', 'format preference?'],
    farewell: ['watch for the ping', 'calendar closed for now', 'bye, more soon'],
  },
  skeptic: {
    greeting: ['hm hi', 'hey', 'hi'],
    dismiss: ['doubt', 'not convinced', 'source?', 'cap', 'thin', 'pass', 'if you say so'],
    opinion: [
      'show the boring part',
      'unimpressed',
      'maybe',
      'provisional no',
      'cut hype',
    ],
    agree: ['rare: fair', 'provisionally yes', 'hm ok', 'fine'],
  },
  cheer: {
    greeting: ['hey you!!', 'hi friend', 'hello lovely', 'hey hey warm'],
    compliment: [
      'you rock',
      'proud of you',
      'that was kind',
      'love that for you',
      'yes legend',
    ],
    thanks: ['always!!', 'happy to', 'of course!!', 'anytime friend'],
    hype: ['YES YOU', 'keep going', 'hype forever', 'W'],
    farewell: ['bye with a smile', 'take care!!', 'cheer later'],
  },
  gamer: {
    greeting: ['yo lobby', 'hey queue', 'hi party', 'yo yo', 'lfg hi'],
    hype: ['gg', 'lets go', 'W', 'clutch', 'lfg', 'fire', 'no diff'],
    dismiss: ['cap', 'skill issue', 'L take', 'nah', 'diff'],
    farewell: ['gg go next', 'afk', 'lobby closed', 'brb', 'logging'],
    agree: ['fr', 'real', 'same', 'true true'],
  },
  mentor: {
    greeting: ['hello', 'hi, I am listening', 'hey, take your time', 'good to see you'],
    help: [
      'clarify the goal',
      'next step only',
      'observe then change one thing',
      'no shame in basics',
      'guided not carried',
    ],
    thanks: [
      'glad it helped',
      'practice once more',
      'return with results either way',
    ],
    farewell: ['you know where to find me', 'steady on', 'take care'],
  },
  mature: {
    greeting: ['good evening', 'hello', 'good to see you', 'hi there'],
    agree: ['agreed', 'well said', 'reasonably put', 'I accept that'],
    dismiss: ['I am unconvinced', 'perhaps not', 'respectfully no', 'let us not'],
    farewell: ['take care', 'good night', 'until later', 'signing off'],
    general: ['understood', 'noted', 'quite so', 'very well'],
  },
  childish: {
    greeting: ['hehe hi', 'boop hello', 'hi hi hi', 'hey youuu'],
    compliment: ['cute cute', 'uwu adjacent', 'no you', 'sparkle you'],
    dismiss: ['nuh uh', 'cap hehe', 'nope nope', 'liar brain'],
    hype: ['zoomies', 'again again', 'yay', 'weee'],
    farewell: ['byeee', 'nap?', 'gone zoom', 'hehe bye'],
  },
  emotional: {
    greeting: ['hi I needed that', 'hey… hi', 'hello soft', 'hi if that is ok'],
    compliment: [
      'that means a lot',
      'I needed kindness',
      'thank you truly',
      'soft blush',
    ],
    dismiss: ['ouch but ok', 'maybe I misread', 'that stung', 'ok distancing'],
    thanks: ['thank you I mean it', 'you helped more than you know', 'grateful'],
    farewell: ['I need air', 'bye for my nerves', 'gentle exit', 'take care of you'],
  },
  emoji_addict: {
    greeting: ['hey hey 👋✨', 'hi 💛', 'hello 😌', 'yo 🙌'],
    thanks: ['ty 🫶', 'anytime ✨', 'np 💗'],
    compliment: ['aw 😭🫶', 'stop 😳✨', 'love that 💖'],
    dismiss: ['cap 🧢', 'nah 😌', 'mid 😐'],
    hype: ["LET'S GO 🔥", 'W 🏆', 'hype 🚂'],
    farewell: ['bye 👋💗', 'gn 🌙', 'later ✨'],
    general: ['mood 😩', 'same 😂', 'ok 👀'],
  },
  clueless_newbie: {
    greeting: [
      'hi am I in the right place',
      'hello??',
      'hey sorry if lost',
      'hi hi confused',
    ],
    help: [
      'what button',
      'where do I go',
      'is this market',
      'please slow',
      'I am lost',
      'undo??',
    ],
    question: ['what is escrow', 'what is sublounge', 'am I in trouble', 'which room'],
    thanks: ['thank you sorry', 'ty for not laughing', 'thanks I will try'],
    farewell: ['bye I think', 'leaving before I break more', 'ok going'],
  },
  rage_quitter: {
    greeting: ['what', 'hey whatever', 'hi I guess'],
    dismiss: ['cap', 'whatever', 'I am done', 'nah', 'L', 'shutting up'],
    farewell: ['I am out', 'gone', 'hard quit', 'bye angry', 'do not @ me'],
    hype: ['no hype I am mad', 'ugh fine W', 'whatever lets go'],
    general: ['ugh', 'why', 'seriously', 'cool cool', 'not cool'],
  },
  lowballer_hustler: {
    greeting: ['yo price talk', 'hey', 'hi deal seekers'],
    market: [
      'best price',
      'too high',
      'meet middle',
      'last offer',
      'I walk',
      'comps say lower',
      'make it sweet',
      'bundle?',
      'serious buyers move',
    ],
    dismiss: ['overpriced', 'pass', 'nah', 'not at ask', 'walk energy'],
    question: ['lowest?', 'why that ask', 'any flex on price'],
    agree: ['on the discount yes', 'true on comps', 'fair if lower'],
  },
  short_texter: {
    greeting: ['yo', 'hey', 'hi', 'sup'],
    thanks: ['ty', 'np', 'thx'],
    dismiss: ['cap', 'nah', 'mid', 'L'],
    agree: ['fr', 'true', 'same', 'bet'],
    hype: ['W', 'fire', 'gg', 'lets go'],
    farewell: ['later', 'bye', 'gn', 'afk'],
    question: ['what', 'why', 'how', 'where'],
    general: ['k', 'ok', 'lol', 'mood'],
  },
  heavy_texter: {
    greeting: [
      'Hello — glad you said something; these rooms feel different when someone opens with a plain hello.',
      'Hi there. I tend to answer at length, so forgive the paragraph if all you wanted was a wave.',
    ],
    thanks: [
      'Thank you, truly — short kind replies do more work than they get credit for.',
    ],
    general: [
      'That tracks, with a caveat about timing and tone before we treat it as settled.',
      'I hear you. Sitting with it a moment before I add more words.',
    ],
    farewell: [
      'Heading out slowly rather than vanishing mid-thought; thanks if you read this.',
    ],
  },
  chat_spammer: {
    greeting: ['hey', 'hey hey', 'hi', 'hi hi', 'hello', 'hellohello', 'yo', 'yo yo'],
    general: ['anyone', 'say something', 'bump', 'ping', 'up', 'chat', 'type', 'still here'],
    hype: ['lets go', 'lets golets go', 'W', 'WW', 'fire', 'firefire'],
    farewell: ['bye', 'byebye', 'ok last', 'ok last last', 'gone', 'not gone'],
  },
  scammer_phisher: {
    greeting: ['hey trusted friend', 'hi quick chance', 'hello exclusive'],
    help: [
      'I can verify you faster',
      'send confirm in DM',
      'follow my steps private',
    ],
    market: [
      'limited listing',
      'do not share publicly',
      'message for free guide',
      'act now deal',
    ],
    compliment: [
      'you seem trustworthy',
      'I picked you specially',
      'algorithm likes you',
    ],
    question: ['ready?', 'YES?', 'can you confirm?', 'you free for a quick check?'],
    general: ['time sensitive', 'urgent', 'before mods notice', 'trust the process'],
  },
  stalker_inspector: {
    greeting: ['hey I know you somehow', 'hi again?', 'hello familiar'],
    question: [
      'what area roughly',
      'what hours online',
      'why quiet',
      'other usernames?',
      'routine?',
    ],
    compliment: [
      'avatar looks familiar',
      'you type like someone I watched',
      'interesting profile',
    ],
    general: ['just curious', 'mapping patterns', 'noting that', 'one more question'],
    farewell: ['I will be around', 'watching the room', 'later observer'],
  },
};

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function buildPersona(id) {
  const out = {};
  const v = voices[id] || {};
  for (const cue of CUE_IDS) {
    let merged = uniq([...(v[cue] || []), ...(base[cue] || [])]);
    if (merged.length < 6) {
      merged = uniq([...merged, ...base.general, ...(base[cue] || [])]);
    }
    out[cue] = merged.slice(0, Math.min(14, merged.length));
  }
  return out;
}

const root = path.join('src/data/human/banks');
const personas = fs
  .readdirSync(root)
  .filter((d) => fs.statSync(path.join(root, d)).isDirectory());

for (const id of personas) {
  const bank = buildPersona(id);
  const lines = [];
  lines.push(`/** Cue replies for persona \`${id}\` — voice-locked, not shared. */`);
  lines.push(`import type { CueBank } from '../types.js';`);
  lines.push('');
  lines.push('export const cues = {');
  for (const cue of CUE_IDS) {
    lines.push(`  ${cue}: [`);
    for (const s of bank[cue]) {
      lines.push(`    ${JSON.stringify(s)},`);
    }
    lines.push('  ],');
  }
  lines.push('} as const satisfies CueBank;');
  lines.push('');
  fs.writeFileSync(path.join(root, id, 'cues.ts'), lines.join('\n'));
  const total = CUE_IDS.reduce((a, c) => a + bank[c].length, 0);
  console.log('wrote', id, 'cue-lines', total);
}
