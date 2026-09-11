/** Public lounge + sublounge name banks for chaos create gate. */

const LOUNGE_TITLES = [
  'Night Owl Den',
  'Harbor House',
  'Pixel Garden',
  'Quiet Corner',
  'Maple Collective',
  'Blue Hour Club',
  'Driftwood Lounge',
  'Copper Thread',
  'Soft Focus',
  'Northstar Hub',
  'Paper Crane',
  'Amber Room',
  'Cedar Circle',
  'Iron Lantern',
  'Glass Orchard',
  'Riverbench',
  'Moonlit Porch',
  'Atlas Attic',
  'Velvet Workshop',
  'Sunrise Table',
  'Foghorn Club',
  'Linen Loft',
  'Oak & Ember',
  'Signal Yard',
  'Coral Shelf',
] as const;

const LOUNGE_BLURBS = [
  'A public hangout for easy conversation.',
  'Open lounge for anyone who wants to drop in.',
  'Casual space for chats, tips, and downtime.',
  'Friendly public room with topic channels.',
  'Community lounge for mixed interests.',
] as const;

/** At least 10 distinct channel names per lounge. */
const SUBLOUNGE_NAMES = [
  'Lobby',
  'General',
  'Introductions',
  'Off Topic',
  'Media',
  'Music',
  'Games',
  'Help Desk',
  'Feedback',
  'Events',
  'Late Night',
  'Projects',
  'Reading',
  'Photos',
  'Tips',
  'Swaps',
  'Random',
  'Announcements',
  'Showcase',
  'Voice Notes',
] as const;

export const MIN_SUBLOUNGES = 10;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickLoungeTitle(used: Set<string>): string {
  const free = LOUNGE_TITLES.filter((t) => !used.has(t.toLowerCase()));
  const base = free.length ? pick(free) : pick(LOUNGE_TITLES);
  used.add(base.toLowerCase());
  return base;
}

export function pickLoungeBlurb(): string {
  return pick(LOUNGE_BLURBS);
}

/** Returns `count` unique sublounge names (count capped by bank size). */
export function pickSubloungeNames(count: number = MIN_SUBLOUNGES): string[] {
  const need = Math.max(MIN_SUBLOUNGES, count);
  const pool = shuffle(SUBLOUNGE_NAMES);
  if (pool.length >= need) return pool.slice(0, need);
  const out: string[] = [...pool];
  let n = 2;
  while (out.length < need) {
    out.push(`${pool[out.length % pool.length]} ${n}`);
    if (out.length % pool.length === 0) n++;
  }
  return out;
}
