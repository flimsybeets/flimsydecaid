import { describe, expect, it } from 'vitest';
import { importErrorText, profileFromFile, shareCode } from '../src/lib/profileImport';

describe('shareCode', () => {
  it('cleans what was typed or pasted', () => {
    expect(shareCode(' ab1x ')).toBe('AB1X');
    expect(shareCode('a-b 1x')).toBe('AB1X');
  });
  it('needs exactly four letters or digits', () => {
    expect(shareCode('abc')).toBeNull();
    expect(shareCode('abcde')).toBeNull();
    expect(shareCode('')).toBeNull();
  });
});

describe('importErrorText', () => {
  it('names the fix', () => {
    expect(importErrorText(new Error('401 {"error":"Username or password not configured"}'))).toMatch(/Sign in/);
    expect(importErrorText(new Error('404 Plugin not loaded'))).toMatch(/Turn on/);
    expect(importErrorText(new Error('400 {"error":"No shared shots found for this code"}'))).toMatch(/expire/);
    expect(importErrorText(new Error('weird'))).toMatch(/didn’t work/);
  });
});

const v2 = {
  version: '2', title: 'Blooming', author: 'Someone', notes: 'hi', beverage_type: 'espresso',
  target_weight: '36', target_volume: '0', tank_temperature: '0', target_volume_count_start: '2',
  legacy_profile_type: 'settings_2c',
  steps: [
    { name: 'fill', pump: 'flow', flow: '6.0', seconds: '25', temperature: '92.0', sensor: 'coffee', transition: 'fast', volume: '100',
      exit: { type: 'pressure', condition: 'over', value: '3.0' }, limiter: { value: '0', range: '0.6' } },
    { name: 'pour', pump: 'pressure', pressure: '9', seconds: '60', temperature: '92', sensor: 'water', transition: 'smooth', volume: '0' },
  ],
};

describe('profileFromFile', () => {
  it('reads a v2 JSON profile and turns string numbers into numbers', () => {
    const r = profileFromFile(JSON.stringify(v2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.title).toBe('Blooming');
    expect(r.profile.target_weight).toBe(36);
    expect(r.profile.target_volume_count_start).toBe(2);
    expect(r.profile.steps[0]!.flow).toBe(6);
    expect(r.profile.steps[0]!.exit).toEqual({ type: 'pressure', condition: 'over', value: 3 });
    expect(r.profile.steps[0]!.limiter).toEqual({ value: 0, range: 0.6 });
    expect(r.profile.steps[1]!.transition).toBe('smooth');
    expect(r.profile.steps[1]!.sensor).toBe('water');
    expect(r.profile.legacy_profile_type).toBe('settings_2c');
    expect(r.others).toBe(0);
  });
  it('unwraps a Decaid export record or array', () => {
    const r = profileFromFile(JSON.stringify([{ id: 'x', profile: v2 }, { id: 'y', profile: v2 }]));
    expect(r.ok && r.profile.title).toBe('Blooming');
    expect(r.ok && r.others).toBe(1);
  });
  it('explains .tcl, junk and empty files', () => {
    const tcl = profileFromFile('advanced_shot {{exit_if 1 ...}}\nprofile_title {Blooming}');
    expect(!tcl.ok && tcl.error).toMatch(/tcl/);
    expect(profileFromFile('hello').ok).toBe(false);
    expect(profileFromFile('{').ok).toBe(false);
    expect(profileFromFile('').ok).toBe(false);
    expect(profileFromFile('{"title":"x","steps":[]}').ok).toBe(false);
    expect(profileFromFile('{"title":"x","steps":[{"pump":"nope"}]}').ok).toBe(false);
  });
  it('fills a missing title and step names', () => {
    const r = profileFromFile('{"steps":[{"pump":"pressure","pressure":9}]}');
    expect(r.ok && r.profile.title).toBe('Imported profile');
    expect(r.ok && r.profile.steps[0]!.name).toBe('step 1');
  });
});
