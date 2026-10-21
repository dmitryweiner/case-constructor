// Fine-tuning +/− buttons next to the sliders, auto-repeating while held.
export function setupAdjustmentButtons(container: HTMLElement, repeatDelay = 150): void {
  let interval: ReturnType<typeof setInterval> | null = null;

  function adjust(btn: HTMLElement): void {
    const sliderId = btn.dataset.slider;
    const dir = Number(btn.dataset.dir);
    if (!sliderId) return;
    const slider = document.getElementById(sliderId);
    if (!(slider instanceof HTMLInputElement)) return;

    const step = Number(slider.step) || 1;
    const min = Number(slider.min);
    const max = Number(slider.max);
    let val = Number(slider.value) + dir * step;
    val = Math.max(min, Math.min(max, val));

    slider.value = String(val);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function stop(): void {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  container.addEventListener('pointerdown', (e) => {
    if (!(e.target instanceof Element)) return;
    const btn = e.target.closest('.adj-btn');
    if (!(btn instanceof HTMLElement)) return;
    e.preventDefault();
    stop();
    adjust(btn);
    interval = setInterval(() => adjust(btn), repeatDelay);
  });

  container.addEventListener('pointerup', stop);
  container.addEventListener('pointerleave', stop);
  container.addEventListener('pointercancel', stop);
  document.addEventListener('pointerup', stop);
}
