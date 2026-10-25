import { describe, expect, it } from 'vitest';
import { moveCategory, parseCategories, removeCategory, removeProfileEverywhere, updateCategory } from '../src/lib/categories';

const doc = parseCategories({ categories: [
  { id: 'a', name: 'A', colour: 1, icon: '☕', profiles: ['p1', 'p2'] },
  { id: 'b', name: 'B', colour: 2, profiles: ['p2'] },
  { id: 'c', name: 'C', colour: 3, profiles: [] },
] });

describe('category editing', () => {
  it('renames (trimmed) and recolours, leaving the rest alone', () => {
    const next = updateCategory(doc, 'a', { name: '  Morning ', colour: 5 });
    expect(next.categories[0]).toMatchObject({ id: 'a', name: 'Morning', colour: 5, icon: '☕', profiles: ['p1', 'p2'] });
    expect(next.categories[1]).toBe(doc.categories[1]);
  });

  it('refuses an empty name and clears an emptied icon', () => {
    expect(() => updateCategory(doc, 'a', { name: '   ' })).toThrow('needs a name');
    expect(updateCategory(doc, 'a', { icon: ' ' }).categories[0]!.icon).toBeUndefined();
  });

  it('removes a category without touching the others', () => {
    expect(removeCategory(doc, 'b').categories.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('moves categories, clamping out-of-range positions', () => {
    expect(moveCategory(doc, 'c', 0).categories.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(moveCategory(doc, 'a', 99).categories.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(moveCategory(doc, 'nope', 0)).toBe(doc);
  });

  it('drops a deleted profile from every category', () => {
    const next = removeProfileEverywhere(doc, 'p2');
    expect(next.categories.map((c) => c.profiles)).toEqual([['p1'], [], []]);
  });
});
