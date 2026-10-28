// Press and hold: calls `onhold` after `ms` without the finger moving away,
// and swallows the tap that would otherwise follow when it lifts. While held,
// the element has the `holding` class so it can show it's about to act.

export function longpress(node: HTMLElement, opts: { onhold: () => void; ms?: number }) {
  let o = opts;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let x = 0, y = 0;
  let fired = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    node.classList.remove('holding');
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    fired = false;
    x = e.clientX; y = e.clientY;
    node.classList.add('holding');
    timer = setTimeout(() => {
      timer = undefined;
      fired = true;
      node.classList.remove('holding');
      navigator.vibrate?.(15);
      o.onhold();
    }, o.ms ?? 500);
  };
  const move = (e: PointerEvent) => { if (timer && Math.hypot(e.clientX - x, e.clientY - y) > 10) clear(); };
  // The lift after a hold is not a tap.
  const click = (e: MouseEvent) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } };
  const menu = (e: Event) => e.preventDefault();

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', clear);
  node.addEventListener('pointercancel', clear);
  node.addEventListener('pointerleave', clear);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', menu);
  return {
    update(next: typeof opts) { o = next; },
    destroy() {
      clear();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', clear);
      node.removeEventListener('pointercancel', clear);
      node.removeEventListener('pointerleave', clear);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', menu);
    },
  };
}
