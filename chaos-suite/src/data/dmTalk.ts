const DM_OPENERS = [
  'Hey, glad we connected.',
  'Hi there, how is your day going?',
  'Hello. Nice to be in touch.',
  'Hey. Just saying hello.',
  'Hi. Hope you are doing well.',
  'Good to finally chat.',
] as const;

const DM_REPLIES = [
  'Doing alright, thanks.',
  'Same here. How about you?',
  'Pretty good on my end.',
  'All good. Catching up a bit.',
  'Yeah, hanging in there.',
  'Sounds good.',
] as const;

function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function dmLine(asReply = false): string {
  return asReply ? pick(DM_REPLIES) : pick(DM_OPENERS);
}
