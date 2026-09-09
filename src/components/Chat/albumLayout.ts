/** WA-style album cell spans for 2–5 items. */
export function getAlbumCellClass(count: number, index: number): string {
  if (count === 2) return 'col-span-1 aspect-[3/4]';
  if (count === 3) return index === 0 ? 'col-span-2 aspect-[16/10]' : 'col-span-1 aspect-square';
  if (count === 4) return 'col-span-1 aspect-square';
  if (count === 5) return index < 2 ? 'col-span-3 aspect-square' : 'col-span-2 aspect-square';
  return 'col-span-1 aspect-square';
}

export function getAlbumGridClass(count: number): string {
  if (count === 2) return 'grid-cols-2';
  if (count === 3 || count === 4) return 'grid-cols-2';
  return 'grid-cols-6';
}
