type Bar = { node: HTMLElement; coordinate: number; major: boolean; mid: boolean; noise: number };
type Impulse = { origin: number; time: number };

// Give each fixed tick a stable texture rather than introducing random flicker.
function grain(coordinate: number): number {
  const seed = Math.sin(coordinate * 127.1 + 19.7) * 43758.5453;
  return seed - Math.floor(seed);
}

// Draw the approved compact waveform while the native reasoning controls own selection.
export function mountEffortWave(track: HTMLElement) {
  const document = track.ownerDocument;
  const view = document.defaultView!;
  const media = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const viewport = document.createElement("div");
  viewport.setAttribute("data-effort-viewport", "");
  viewport.setAttribute("aria-hidden", "true");
  viewport.innerHTML = '<div data-effort-scale></div><div data-effort-pin><span data-effort-head></span></div>';
  track.prepend(viewport);
  const scale = viewport.querySelector<HTMLElement>("[data-effort-scale]")!;
  const pin = viewport.querySelector<HTMLElement>("[data-effort-pin]")!;
  const head = pin.firstElementChild as HTMLElement;
  let bars: Bar[] = [], labels: HTMLElement[] = [], impulses: Impulse[] = [];
  let index = -1, last = 0, position = 0, velocity = 0, frame = 0, lastTime = 0, stopped = false;

  // Add a small damped length pulse that spreads from the newly selected option.
  function ripple(coordinate: number, now: number): number {
    let value = 0;
    for (const impulse of impulses) {
      const distance = Math.abs(coordinate - impulse.origin);
      const age = (now - impulse.time) / 1000 - distance / 7;
      if (age >= 0) value += 1.25 * Math.sin(age * 23) * Math.exp(-age * 12 - distance * .35);
    }
    return value;
  }

  // Move only the pin horizontally and vary the fixed bars around its current crest.
  function paint(now: number): void {
    const width = .6 + Math.min(.08, Math.abs(velocity) * .005);
    for (const bar of bars) {
      const distance = bar.coordinate / 24 - position;
      const focus = Math.exp(-distance * distance / (2 * width * width));
      const texture = .25 + .75 * bar.noise;
      const height = 3 + 12 * focus * (bar.major ? 1 : texture)
        + (bar.major ? 3 : bar.mid ? 1 : 0) + (bar.major ? 0 : bar.noise * 1.8);
      const pulse = media?.matches ? 0 : ripple(bar.coordinate / 24, now);
      bar.node.style.height = `${Math.max(3, height + pulse)}px`;
      bar.node.style.opacity = String(.15 + .5 * focus + (bar.major ? .15 : bar.noise * .07));
    }
    pin.style.transform = `translateX(${position / last * 100}%)`;
    head.style.transform = `translateY(${-ripple(position, now) / 2}px)`;
  }

  // Release active frames and waves without changing the provider's selected value.
  function cancel(): void {
    view.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    impulses = [];
  }

  // Integrate one shared spring so rapid retargeting preserves the pin and crest's momentum.
  function animate(now: number): void {
    if (stopped) return;
    const elapsed = lastTime ? Math.min(.04, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    const steps = Math.ceil(elapsed / .008), dt = elapsed / steps;
    for (let step = 0; step < steps; step++) {
      velocity += ((index - position) * 300 - velocity * 30) * dt;
      position += velocity * dt;
    }
    impulses = impulses.filter(impulse => now - impulse.time < 1000);
    const moving = Math.abs(index - position) > .0003 || Math.abs(velocity) > .003;
    if (!moving) { position = index; velocity = 0; }
    paint(now);
    if (moving || impulses.length) frame = view.requestAnimationFrame(animate);
    else { frame = 0; lastTime = 0; }
  }

  // Rebuild spaced ticks only when a provider changes its number of supported options.
  function rebuild(count: number): void {
    scale.replaceChildren();
    scale.style.setProperty("--bb-effort-intervals", String(last));
    bars = [];
    labels = [];
    for (let coordinate = -12; coordinate <= last * 24 + 12; coordinate += 2) {
      const node = document.createElement("i");
      node.setAttribute("data-effort-tick", "");
      const major = coordinate % 24 === 0, mid = !major && coordinate % 12 === 0;
      node.toggleAttribute("data-major", major);
      node.style.left = `${coordinate / (last * 24) * 100}%`;
      scale.append(node);
      const noise = grain(coordinate);
      bars.push({ node, coordinate, major, mid, noise });
    }
    for (let step = 0; step < count; step++) {
      const label = document.createElement("span");
      label.setAttribute("data-effort-label", "");
      label.style.left = `${step / last * 100}%`;
      scale.append(label);
      labels.push(label);
    }
  }

  // Reflect native labels immediately and animate only actual selection changes.
  function sync(names: string[], next: number): void {
    if (stopped) return;
    const replaced = last !== names.length - 1;
    if (replaced) {
      cancel();
      last = names.length - 1;
      position = next;
      velocity = 0;
      rebuild(names.length);
    }
    for (let step = 0; step < names.length; step++) {
      const label = labels[step];
      if (label.textContent !== names[step]) label.textContent = names[step];
      label.toggleAttribute("data-current", step === next);
    }
    if (next === index && !replaced) return;
    index = next;
    if (replaced || media?.matches) {
      cancel();
      position = index;
      velocity = 0;
      paint(view.performance.now());
      return;
    }
    impulses.push({ origin: index, time: view.performance.now() });
    impulses = impulses.slice(-4);
    if (!frame) frame = view.requestAnimationFrame(animate);
  }

  // Snap to the committed tick when the user enables reduced motion.
  function reduced(): void {
    if (!media?.matches) return;
    cancel();
    position = index;
    velocity = 0;
    paint(view.performance.now());
  }

  // Dispose the visual controller when its native provider group is removed.
  function stop(): void {
    stopped = true;
    cancel();
    media?.removeEventListener?.("change", reduced);
    viewport.remove();
  }

  media?.addEventListener?.("change", reduced);
  return { sync, stop };
}
