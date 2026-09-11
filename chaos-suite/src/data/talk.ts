import { rooms } from './lounges.js';
import { cueReplyFromLast } from './cues.js';

export type RoomSlug = (typeof rooms)[number];

const openers: Record<RoomSlug, readonly string[]> = {
  velum_general: [
    'Hey everyone, how is the day going?',
    'Just hopped in. Anything interesting today?',
    'Morning. Who is around?',
    'Glad this place is active.',
    'Quick hello from me.',
    'What is everyone working on?',
    'Hope you all are doing alright.',
    'Checking in for a bit.',
  ],
  velum_market: [
    'Anyone see good listings today?',
    'Browsing the board. Prices look mixed.',
    'Looking for fair deals on commons.',
    'Is the market busy right now?',
    'Saw a few new posts earlier.',
    'Curious what people are buying lately.',
    'Any trusted sellers you like?',
    'Market feels quieter than last week.',
  ],
  velum_escrow: [
    'How long do holds usually take for you?',
    'Last release went fine on my end.',
    'Any tips before opening a hold?',
    'Waiting on a release. Normal delay?',
    'Escrow steps still confuse me a bit.',
    'Do you double check terms before confirm?',
    'Had a smooth close yesterday.',
    'Is support fast if a hold stalls?',
  ],
  velum_offtopic: [
    'Random: coffee or tea today?',
    'Anyone watching something good?',
    'This weather is wild where I am.',
    'Share a small win from your day.',
    'Music recommendations welcome.',
    'I need a fun distraction for five minutes.',
    'What is your go to comfort food?',
    'Drop a harmless hot take.',
  ],
  velum_bugs: [
    'Seeing a small glitch on refresh. Anyone else?',
    'Messages flicker order for a second then settle.',
    'Can reproduce a minor UI flicker on mobile.',
    'Layout shifts when I open settings.',
    'Unread badge stuck until I reopen the room.',
    'Image preview failed once then worked.',
    'Typing indicator lagged for me.',
    'Not urgent, just logging what I saw.',
  ],
  velum_support: [
    'Need a hand with account settings.',
    'Where do I change my profile picture?',
    'Is anyone free for a login question?',
    'Stuck on a settings toggle.',
    'Password reset mail never arrived for a friend.',
    'How do I update display name cleanly?',
    'Can someone point me to the right help path?',
    'Session dropped once. Expected or bug?',
  ],
  velum_suggestions: [
    'Would love mute by keyword.',
    'Pinning key lounge posts would help.',
    'Search across rooms would be huge.',
    'Quieter notification presets please.',
    'A simple room mute schedule would be nice.',
    'Drafts that survive refresh would save me.',
    'Optional compact message density.',
    'Better unread grouping across rooms.',
  ],
  velum_events: [
    'Any events coming up this week?',
    'Is there a live chat schedule posted?',
    'Interested in the next community meetup.',
    'When is the next lounge event?',
    'Would join a short AMA if one lands.',
    'Do events get announced here first?',
    'Counting on a weekend hangout.',
    'Who usually hosts the live sessions?',
  ],
};

const replies: Record<RoomSlug, readonly string[]> = {
  velum_general: [
    'Same here.',
    'Makes sense.',
    'Yeah I noticed that too.',
    'Agreed.',
    'Thanks for saying that.',
    'I was thinking the same.',
    'Good point.',
    'That tracks.',
  ],
  velum_market: [
    'I saw something similar.',
    'Prices have been jumpy.',
    'Worth waiting a day maybe.',
    'Yeah, compare a few first.',
    'That listing style is common lately.',
    'True, volume dipped.',
    'I would check seller history.',
    'Fair take.',
  ],
  velum_escrow: [
    'Holds can take a bit.',
    'I wait before confirming too.',
    'Glad yours closed clean.',
    'Support helped me once on a stall.',
    'Double check always.',
    'Same timeline for me last time.',
    'That delay sounds normal.',
    'Good reminder.',
  ],
  velum_offtopic: [
    'Ha, same.',
    'I needed that.',
    'Coffee for me.',
    'Adding that to my list.',
    'True.',
    'Okay that made me smile.',
    'I am stealing that idea.',
    'Noted.',
  ],
  velum_bugs: [
    'I hit that once.',
    'Can confirm on my side.',
    'Thanks for reporting it.',
    'Mine cleared after relaunch.',
    'Still happens for me sometimes.',
    'Sounds like a race on load.',
    'I will watch for it.',
    'Good catch.',
  ],
  velum_support: [
    'Try settings under profile.',
    'I can walk through it if stuck.',
    'That path worked for me.',
    'Logout and back in helped once.',
    'Check spam for the reset mail.',
    'Display name is under profile edit.',
    'Happy to help.',
    'That should unblock you.',
  ],
  velum_suggestions: [
    'I would use that.',
    'Strong yes.',
    'That would cut noise a lot.',
    'I have wanted that too.',
    'Put me down as interested.',
    'Simple version first would be enough.',
    'This would help power users.',
    'Love that idea.',
  ],
  velum_events: [
    'I am in if timing works.',
    'Please post the time here.',
    'Count me interested.',
    'Weekend works better for me.',
    'I will watch this thread.',
    'Hope they announce soon.',
    'Same, I want details.',
    'Sounds good.',
  ],
};

function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function lineFor(room: string, lastOther?: string): string {
  const key = (rooms.includes(room as RoomSlug) ? room : 'velum_general') as RoomSlug;
  if (lastOther && lastOther.trim()) {
    // Prefer cue-driven reply when there is a peer line to answer
    if (Math.random() < 0.75) {
      return cueReplyFromLast(lastOther).text;
    }
    return pick(replies[key]);
  }
  return pick(openers[key]);
}

export function preferredRooms(persona: string): RoomSlug[] {
  switch (persona) {
    case 'social':
      return ['velum_general', 'velum_offtopic', 'velum_events'];
    case 'attention':
      return ['velum_general', 'velum_offtopic', 'velum_events', 'velum_suggestions'];
    case 'tech':
      return ['velum_bugs', 'velum_suggestions', 'velum_general'];
    case 'drama':
      return ['velum_offtopic', 'velum_general', 'velum_events'];
    case 'support':
      return ['velum_support', 'velum_bugs', 'velum_general'];
    case 'casual':
    default:
      return ['velum_general', 'velum_offtopic'];
  }
}
