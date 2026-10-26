import { describe, expect, it } from 'vitest';
import { credentialsPatch, parseSettings, pluginState, visualizerIdOf } from '../src/lib/visualizer';

describe('visualizer plugin state', () => {
  it('tells missing, off and on apart', () => {
    expect(pluginState([])).toBe('missing');
    expect(pluginState([{ id: 'visualizer.reaplugin', loaded: false }])).toBe('off');
    expect(pluginState([{ id: 'visualizer.reaplugin', loaded: true }])).toBe('on');
    expect(pluginState([{ id: 'other', loaded: true }])).toBe('missing');
  });
});

describe('visualizer settings', () => {
  it('reads the username, redacted password and the default-on auto upload', () => {
    expect(parseSettings({ Username: 'me', Password: { isSet: true } })).toEqual({ username: 'me', passwordSet: true, autoUpload: true });
    expect(parseSettings({ AutoUpload: false })).toEqual({ username: '', passwordSet: false, autoUpload: false });
    expect(parseSettings(null).autoUpload).toBe(true);
  });
  it('omits a blank password so the stored one is kept', () => {
    expect(credentialsPatch(' me ', '')).toEqual({ Username: 'me' });
    expect(credentialsPatch('me', 'pw')).toEqual({ Username: 'me', Password: 'pw' });
  });
});

describe('visualizer id on a shot', () => {
  it('reads the id the plugin stamps, or the nested form', () => {
    expect(visualizerIdOf({ annotations: { extras: { visualizerId: 'abc' } } })).toBe('abc');
    expect(visualizerIdOf({ annotations: { extras: { visualizer: { shot_id: 7 } } } })).toBe('7');
  });
  it('is null when not uploaded', () => {
    expect(visualizerIdOf({ annotations: null })).toBeNull();
    expect(visualizerIdOf({ annotations: { extras: {} } })).toBeNull();
    expect(visualizerIdOf(undefined)).toBeNull();
  });
});
