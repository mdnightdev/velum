import { describe, it, expect } from 'vitest';
import { getAlbumCellClass, getAlbumGridClass } from '../../src/components/Chat/albumLayout';

describe('album bubble layout helpers', () => {
  it('uses 2-up equal portrait cells for two items', () => {
    expect(getAlbumGridClass(2)).toBe('grid-cols-2');
    expect(getAlbumCellClass(2, 0)).toContain('aspect-[3/4]');
    expect(getAlbumCellClass(2, 1)).toContain('aspect-[3/4]');
  });

  it('makes the first of three span full width', () => {
    expect(getAlbumGridClass(3)).toBe('grid-cols-2');
    expect(getAlbumCellClass(3, 0)).toContain('col-span-2');
    expect(getAlbumCellClass(3, 1)).toContain('aspect-square');
  });

  it('uses a 2x2 grid for four items', () => {
    expect(getAlbumGridClass(4)).toBe('grid-cols-2');
    expect(getAlbumCellClass(4, 3)).toContain('aspect-square');
  });
});
