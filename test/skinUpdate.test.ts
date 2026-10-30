import { describe, expect, it } from 'vitest';
import { compareVersions, skinUpdateResult, updateErrorText } from '../src/lib/skinUpdate';

describe('skin update check', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('0.2.10', '0.2.9')).toBe(1);
    expect(compareVersions('v0.2.19', '0.2.19')).toBe(0);
    expect(compareVersions('0.2', '0.2.1')).toBe(-1);
  });
  it('says whether a newer version was installed', () => {
    expect(skinUpdateResult('0.2.19', '0.2.20')).toEqual({ kind: 'updated', installed: '0.2.20' });
    expect(skinUpdateResult('0.2.19', '0.2.19').kind).toBe('current');
    expect(skinUpdateResult('0.2.19', null).kind).toBe('current');
  });
  it('reads Decaid error bodies', () => {
    expect(updateErrorText('{"error":"No network"}')).toBe('No network');
    expect(updateErrorText('Plain text')).toBe('Plain text');
    expect(updateErrorText('')).toBe("Couldn't check for updates.");
  });
});
