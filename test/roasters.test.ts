import { describe, expect, it } from 'vitest';
import { roasterSuggestions } from '../src/lib/roasters';

const beans = [
  { roaster: 'Proud Mary', createdAt: '2026-01-01' },
  { roaster: 'proud  mary ', createdAt: '2026-03-01' },
  { roaster: 'Market Lane', createdAt: '2026-02-01' },
  { roaster: 'Ona', createdAt: '2026-04-01' },
  { roaster: 'Market Lane', createdAt: '2026-01-15' },
  { roaster: 'Market Lane', createdAt: '2026-01-10' },
  { roaster: '', createdAt: '2026-05-01' },
];

describe('roasterSuggestions', () => {
  it('lists every roaster once, most coffees first, with nothing typed', () => {
    expect(roasterSuggestions(beans, '')).toEqual(['Market Lane', 'proud mary', 'Ona']);
  });
  it('matches the start of any word, then anywhere', () => {
    expect(roasterSuggestions(beans, 'ma')).toEqual(['Market Lane', 'proud mary']);
    expect(roasterSuggestions(beans, 'ry')).toEqual(['proud mary']);
  });
  it('leaves out an exact match and caps the list', () => {
    expect(roasterSuggestions(beans, 'Ona ')).toEqual([]);
    expect(roasterSuggestions(beans, '', 2)).toHaveLength(2);
  });
});
