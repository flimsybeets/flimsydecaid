// One "Saved / Couldn't save" status per Settings pane, and the debounced
// patch queues that write Decaid settings (see patchQueue in lib/decaidSettings).
import { patchQueue } from '../../lib/decaidSettings';

export class Saver {
  status = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  message = $state('');
  private queues: { flush: () => Promise<void> }[] = [];

  queue<T extends object>(send: (patch: Partial<T>) => Promise<unknown>) {
    const q = patchQueue<T>(
      async (p) => { this.status = 'saving'; await send(p); },
      (e) => {
        if (e) { this.status = 'error'; this.message = e instanceof Error ? e.message : String(e); }
        else this.status = 'saved';
      },
    );
    this.queues.push(q);
    return q;
  }

  /** For one-off actions (add/delete a schedule, reset). */
  async run(action: () => Promise<unknown>): Promise<boolean> {
    this.status = 'saving';
    try { await action(); this.status = 'saved'; return true; }
    catch (e) { this.status = 'error'; this.message = e instanceof Error ? e.message : String(e); return false; }
  }

  /** Send anything still waiting (the pane is closing). */
  flushAll() { for (const q of this.queues) void q.flush(); }
}
