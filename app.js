(() => {
  document.body.classList.add('has-js');
  const total = 240;
  const frameUrl = (n) => `/public/frames/ezgif-frame-${String(n).padStart(3, '0')}.jpg`;
  const canvas = document.querySelector('#sequence');
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.querySelector('#loader');
  const progress = document.querySelector('#load-progress');
  const count = document.querySelector('#load-count');
  const indexLabel = document.querySelector('#frame-index');
  const frames = new Array(total);
  let loaded = 0, current = -1, ready = false, width = 0, height = 0, dpr = 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (current >= 0) draw(current, true);
  }
  function draw(index, force = false) {
    index = Math.max(0, Math.min(total - 1, index));
    if (index === current && !force) return;
    // During progressive loading or a failed request, draw the nearest decoded frame.
    let image = frames[index];
    for (let distance = 1; !image && distance < total; distance++) {
      image = frames[index - distance] || frames[index + distance];
    }
    current = index;
    if (!image) return;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    context.fillStyle = '#111'; context.fillRect(0, 0, width, height);
    context.drawImage(image, (width - w) * .5, (height - h) * .5, w, h);
    indexLabel.textContent = `${String(index + 1).padStart(3, '0')} / ${total}`;
  }
  function loadFrame(n) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = async () => {
        try { await image.decode(); } catch (_) { /* onload confirms a usable image */ }
        frames[n - 1] = image; loaded++;
        const percent = Math.round(loaded / total * 100);
        progress.style.width = `${percent}%`; count.textContent = `${percent}%`;
        if (n === 1) { draw(0, true); }
        else if (ready) draw(current, true);
        if (loaded >= Math.min(12, total) && !ready) startExperience();
        resolve(true);
      };
      image.onerror = () => { loaded++; const percent = Math.round(loaded / total * 100); progress.style.width = `${percent}%`; count.textContent = `${percent}%`; resolve(false); };
      image.src = frameUrl(n);
    });
  }
  function startExperience() {
    if (ready) return;
    ready = true; sizeCanvas(); draw(0, true);
    requestAnimationFrame(() => loader.classList.add('is-ready'));
    if (reduced) { document.body.classList.add('reduced'); draw(total - 1, true); return; }
    setupMotion();
  }
  function setupMotion() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (gsap && ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      if (window.Lenis) {
        const lenis = new window.Lenis({ lerp: .08, smoothWheel: true, syncTouch: false });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }
      ScrollTrigger.create({
        trigger: '.hero', start: 'top top', end: '+=550%', pin: true,
        scrub: .18, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => draw(Math.round(self.progress * (total - 1)))
      });
      gsap.utils.toArray('.reveal').forEach((el) => gsap.fromTo(el,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: .9, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } }
      ));
      ScrollTrigger.create({ start: 80, onUpdate: (self) => document.querySelector('.nav').classList.toggle('scrolled', self.scroll() > 80) });
      window.addEventListener('resize', () => { sizeCanvas(); ScrollTrigger.refresh(); }, { passive: true });
    } else {
      // CDN failure still leaves a usable, scroll-controlled experience.
      let ticking = false;
      const update = () => {
        const span = document.querySelector('.hero').offsetHeight * 5.5;
        const y = Math.max(0, window.scrollY - document.querySelector('.hero').offsetTop);
        draw(Math.round(Math.min(1, y / span) * (total - 1)));
        document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 80);
        ticking = false;
      };
      window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
      window.addEventListener('resize', sizeCanvas, { passive: true });
    }
  }

  const menuButton = document.querySelector('.menu-toggle');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.querySelector('.nav__links').classList.toggle('is-open', open);
  });
  document.querySelectorAll('.nav__links a').forEach((link) => link.addEventListener('click', () => {
    document.querySelector('.nav__links').classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false');
  }));

  // Load the opening beats first, then continue in small batches to limit network pressure.
  sizeCanvas();
  if (reduced) { loadFrame(1).then(() => { if (!ready) startExperience(); }); }
  else {
    const concurrency = 5;
    let next = 1;
    const worker = async () => { while (next <= total) { const n = next++; await loadFrame(n); } };
    Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
      if (!ready) startExperience();
      if (loaded !== total) return;
    });
  }
  window.addEventListener('resize', sizeCanvas, { passive: true });
})();
