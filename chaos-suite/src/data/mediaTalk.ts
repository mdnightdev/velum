const CAPTIONS = [
  'Check this out.',
  'Sending a clip.',
  'Thought you might like this.',
  'Quick share.',
  'Here you go.',
  'From me.',
] as const;

export function mediaCaption(): string {
  return CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
}
