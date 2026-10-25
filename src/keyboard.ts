// On-screen keyboard handling for forms on the tablet.
//
// Android WebViews either shrink the page when the keyboard opens or lay
// the keyboard over it; we handle both. While a text field has focus and the
// visible area is clearly shorter than the full screen, <html> gets
// `kb-open` (the bottom bar steps aside, modals sit above the keyboard) and
// `--kb` is set to how much of the page the keyboard actually covers (0 when
// the WebView already shrank the page). The focused field is then scrolled
// into the middle of whatever scrolls around it.

const TEXT_INPUT = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=button]), textarea, select, [contenteditable="true"]';
/** A drop smaller than this is browser chrome, not a keyboard. */
const MIN_KEYBOARD_PX = 120;

export function watchKeyboard(): () => void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  let fullHeight = window.innerHeight;
  let frame = 0;

  const editing = () => document.activeElement instanceof Element && document.activeElement.matches(TEXT_INPUT);

  function update() {
    frame = 0;
    const visible = vv ? vv.height : window.innerHeight;
    if (!editing()) fullHeight = Math.max(window.innerHeight, visible);
    const open = editing() && fullHeight - visible > MIN_KEYBOARD_PX;
    const covered = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    root.classList.toggle('kb-open', open);
    root.style.setProperty('--kb', `${open ? Math.round(covered) : 0}px`);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

  function onFocusIn(e: FocusEvent) {
    schedule();
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(TEXT_INPUT)) return;
    // Wait for the keyboard to finish opening, then bring the field into view.
    setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
  }
  // Focus moving between fields fires focusout then focusin; don't flicker.
  const onFocusOut = () => setTimeout(schedule, 60);

  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  update();

  return () => {
    vv?.removeEventListener('resize', schedule);
    vv?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    if (frame) cancelAnimationFrame(frame);
  };
}
