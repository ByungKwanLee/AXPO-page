// =========================================================
// AXPO Project Page — interactions
// =========================================================
(function () {
  "use strict";

  // ---------- Theme toggle (with localStorage + system preference) ----------
  // Theme strategy:
  //   - Inline boot script in <head> sets the initial `data-theme` and
  //     meta `theme-color` BEFORE first paint (prevents FOUC on mobile).
  //   - This module keeps everything in sync from then on: user clicks
  //     persist to localStorage; OS theme changes flow through as long
  //     as the user hasn't explicitly overridden.
  const STORAGE_KEY = "axpo-theme";
  const root = document.documentElement;
  const toggleBtn = document.getElementById("theme-toggle");
  const metaTheme = document.getElementById("meta-theme-color");
  // Must mirror the values in `<meta name="theme-color">` / the inline
  // bootstrap in index.html and `--bg` in style.css for each theme.
  const THEME_COLORS = { light: "#ffffff", dark: "#0b0f0d" };

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (metaTheme) metaTheme.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.light);
    if (toggleBtn) {
      const isDark = theme === "dark";
      toggleBtn.setAttribute("aria-pressed", String(isDark));
      // Label describes the action the next tap will take, which is
      // how iOS / Android screen readers expect a toggle to read.
      toggleBtn.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
      );
    }
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    }
  }

  // Reconcile with the boot script's choice so aria/meta state lines up.
  const initialStored = readStored();
  const initialTheme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(initialTheme, false);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark", true);
    });
  }

  // Live OS-theme tracking — only kicks in if the user hasn't picked
  // a theme manually yet. The moment they click the toggle, the
  // stored value pins the choice and this listener becomes a no-op.
  if (window.matchMedia) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = (e) => {
      if (readStored()) return; // user override wins
      applyTheme(e.matches ? "dark" : "light", false);
    };
    if (mql.addEventListener) mql.addEventListener("change", onSystemChange);
    else if (mql.addListener) mql.addListener(onSystemChange); // legacy iOS
  }

  // Silence a single-use lint about unused var on the bootstrap snapshot.
  void initialStored;

  // ---------- Smooth scroll for in-page anchors ----------
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const navHeight = document.querySelector(".nav")?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 8;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // ---------- Section nav scrollspy ----------
  // The pill-style nav at the top has one chip per major section. As
  // the viewport scrolls we light up whichever chip's section is
  // currently "front-and-center" so the user always sees their place
  // in the page.
  const navAnchors = Array.from(
    document.querySelectorAll(".nav-links a[data-target]")
  );
  if (navAnchors.length) {
    const anchorByTarget = new Map();
    const sections = [];
    navAnchors.forEach((a) => {
      const sec = document.getElementById(a.dataset.target);
      if (sec) {
        anchorByTarget.set(a.dataset.target, a);
        sections.push(sec);
      }
    });

    const setActive = (id) => {
      navAnchors.forEach((a) =>
        a.classList.toggle("active", a.dataset.target === id)
      );
    };

    if (sections.length && "IntersectionObserver" in window) {
      // Track the visible ratio for every observed section and pick
      // the one closest to the top of the comfortable reading band.
      // The asymmetric rootMargin (~25% top, ~55% bottom) means a
      // section "wins" the chip when its heading enters the upper
      // third of the viewport, which matches how a reader scans.
      const ratios = new Map();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => ratios.set(e.target.id, e.intersectionRatio));
          let bestId = null;
          let bestRatio = 0;
          ratios.forEach((r, id) => {
            if (r > bestRatio) { bestRatio = r; bestId = id; }
          });
          if (bestId && bestRatio > 0) setActive(bestId);
        },
        {
          rootMargin: "-25% 0px -55% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );
      sections.forEach((s) => observer.observe(s));
    }

    // Clicking a chip optimistically marks it active so feedback is
    // instant even before the scroll-driven observer catches up.
    navAnchors.forEach((a) => {
      a.addEventListener("click", () => setActive(a.dataset.target));
    });
  }

  // ---------- Qualitative-examples keyboard carousel ----------
  const carousel = document.getElementById("qual-carousel");
  if (carousel) {
    const slides = Array.from(carousel.querySelectorAll(".qual-card"));
    const dots   = Array.from(carousel.querySelectorAll(".qual-dot"));
    const prev   = carousel.querySelector(".qual-prev");
    const next   = carousel.querySelector(".qual-next");
    let idx = Math.max(0, slides.findIndex((el) => el.classList.contains("active")));

    const show = (i, direction) => {
      const oldIdx = idx;
      idx = ((i % slides.length) + slides.length) % slides.length;
      if (oldIdx === idx) return;

      // Direction tells the CSS which side to slide in from. If the
      // caller didn't specify, derive it from the index delta (with
      // a wrap-around fix-up so jumping last→first still reads as
      // "going forward").
      if (!direction) {
        direction = idx > oldIdx ? "next" : "prev";
        if (oldIdx === 0 && idx === slides.length - 1) direction = "prev";
        if (oldIdx === slides.length - 1 && idx === 0) direction = "next";
      }

      slides.forEach((el, j) => {
        el.classList.remove("qual-enter-next", "qual-enter-prev");
        el.classList.toggle("active", j === idx);
      });
      slides[idx].classList.add(
        direction === "next" ? "qual-enter-next" : "qual-enter-prev"
      );

      dots.forEach((el, j) => {
        el.classList.toggle("active", j === idx);
        el.setAttribute("aria-selected", j === idx ? "true" : "false");
      });
    };

    prev?.addEventListener("click", () => show(idx - 1, "prev"));
    next?.addEventListener("click", () => show(idx + 1, "next"));
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const i = Number(dot.dataset.i);
        if (!Number.isNaN(i)) show(i);
      });
    });

    // Global arrow keys: only when the section is in view and the user
    // is not focused on a typing element.
    const isTypingTarget = (el) =>
      el && (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      );

    let inView = false;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { inView = e.isIntersecting; }),
        { threshold: 0.25 }
      );
      io.observe(carousel);
    } else {
      inView = true;
    }

    document.addEventListener("keydown", (e) => {
      if (!inView) return;
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft")  { show(idx - 1, "prev"); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(idx + 1, "next"); e.preventDefault(); }
    });

    // ---- Touch swipe (mobile) ------------------------------------------
    // Threshold: a horizontal swipe of >= 30px wins over a small jitter,
    // and we ignore swipes that look like a vertical scroll attempt. As
    // the finger moves we also nudge the active card horizontally so the
    // gesture feels live instead of "snapping" only at touchend.
    const SWIPE_MIN_X = 30;
    const SWIPE_MAX_OFF_AXIS_RATIO = 0.8; // |dy| / |dx| must be below this
    const DRAG_MAX_PX = 80;               // cap how far the card can drag
    const DRAG_DAMPING = 0.45;            // visual movement < real finger movement
    let touchStartX = 0;
    let touchStartY = 0;
    let touchActive = false;
    let touchIsHorizontal = null;        // tri-state: null=undecided, true/false

    const activeCard = () => slides[idx];

    const resetDrag = () => {
      const card = activeCard();
      if (!card) return;
      const wasDragging = card.classList.contains("qual-dragging");
      card.classList.remove("qual-dragging");
      card.style.transform = "";
      card.style.opacity = "";
      // Add a one-shot release class so the card springs back smoothly
      // instead of jumping when the drag didn't pass threshold.
      if (wasDragging) {
        card.classList.add("qual-releasing");
        setTimeout(() => card.classList.remove("qual-releasing"), 220);
      }
    };

    carousel.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) { touchActive = false; return; }
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchActive = true;
      touchIsHorizontal = null;
    }, { passive: true });

    carousel.addEventListener("touchmove", (e) => {
      if (!touchActive) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      // First few pixels of movement decide if this gesture belongs to
      // the carousel (horizontal) or to the page (vertical scroll).
      if (touchIsHorizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // still ambiguous
        touchIsHorizontal = Math.abs(dx) > Math.abs(dy);
        if (touchIsHorizontal) activeCard()?.classList.add("qual-dragging");
      }
      if (!touchIsHorizontal) return;

      const card = activeCard();
      if (!card) return;
      const drag = Math.max(-DRAG_MAX_PX, Math.min(DRAG_MAX_PX, dx * DRAG_DAMPING));
      card.style.transform = `translateX(${drag.toFixed(1)}px)`;
      card.style.opacity = String(1 - Math.min(0.25, Math.abs(drag) / 320));
    }, { passive: true });

    carousel.addEventListener("touchend", (e) => {
      if (!touchActive) return;
      touchActive = false;
      const t = e.changedTouches && e.changedTouches[0];
      resetDrag();
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) < SWIPE_MIN_X) return;
      if (Math.abs(dy) / Math.abs(dx) > SWIPE_MAX_OFF_AXIS_RATIO) return;
      if (dx < 0) show(idx + 1, "next"); // swipe left  → next
      else        show(idx - 1, "prev"); // swipe right → prev
    }, { passive: true });

    carousel.addEventListener("touchcancel", () => {
      touchActive = false;
      resetDrag();
    }, { passive: true });
  }

  // ---------- Interactive Main-Results table ----------
  // 9 per-benchmark Pass@4 numbers per (size × method); Avg. is derived
  // from whichever benchmarks the user currently has enabled so that
  // toggling categories live-updates the headline number.
  const RESULTS_DATA = {
    "2B": {
      Base: [32.6, 76.6, 28.9, 81.7, 15.1, 79.0, 77.0, 18.7, 46.3],
      GRPO: [55.9, 80.2, 58.0, 94.2, 60.4, 83.5, 85.5, 28.2, 55.7],
      AXPO: [61.2, 83.6, 60.0, 94.2, 60.4, 88.5, 88.0, 33.4, 57.3],
    },
    "4B": {
      Base: [64.8, 82.6, 65.1, 95.8, 44.3, 83.5, 81.0, 27.5, 55.7],
      GRPO: [69.7, 85.8, 71.9, 97.9, 57.5, 88.0, 84.5, 33.1, 57.0],
      AXPO: [74.3, 87.0, 72.1, 97.9, 65.1, 91.0, 90.0, 32.1, 57.0],
    },
    "8B": {
      Base: [63.5, 85.2, 68.3, 92.7, 55.7, 85.5, 82.5, 33.8, 59.0],
      GRPO: [75.0, 87.0, 74.3, 96.9, 63.2, 87.5, 84.5, 38.0, 59.3],
      AXPO: [75.7, 87.0, 74.1, 95.3, 67.9, 90.0, 89.0, 42.0, 61.0],
    },
    "32B": {
      Base: [73.0, 89.4, 73.9, 97.4, 64.2, 90.5, 90.0, 38.0, 59.3],
    },
  };
  const BENCH_NAMES = [
    "MathVision", "DynaMath", "Math-VR",
    "V*", "VisualProbe", "HRBen-4K", "HRBen-8K",
    "HR-MMSearch", "MMSearch",
  ];
  // start/end are half-open indices into the 9-element value arrays.
  const BENCH_GROUPS = [
    { name: "Reasoning",  cls: "reasoning",  start: 0, end: 3 },
    { name: "Perception", cls: "perception", start: 3, end: 7 },
    { name: "Search",     cls: "search",     start: 7, end: 9 },
  ];

  const fmt1     = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const fmtDelta = (v) => {
    const r = Math.round(v * 10) / 10;
    if (r >= 0) return "+" + r.toFixed(1);
    return "−" + Math.abs(r).toFixed(1); // U+2212 minus
  };

  function activeIndices(cats) {
    const out = [];
    for (const g of BENCH_GROUPS) {
      if (!cats.has(g.name)) continue;
      for (let i = g.start; i < g.end; i++) out.push(i);
    }
    return out;
  }
  function meanAt(values, indices) {
    if (indices.length === 0) return 0;
    let s = 0;
    for (const i of indices) s += values[i];
    return s / indices.length;
  }

  function buildRow(label, values, cats, opts = {}) {
    const rowCls  = opts.rowClass    ? ` class="${opts.rowClass}"` : "";
    const methCls = opts.methodClass || "method";

    let tds = "";
    for (const g of BENCH_GROUPS) {
      if (!cats.has(g.name)) continue;
      for (let i = g.start; i < g.end; i++) {
        const v = values[i];
        const txt = opts.isDelta ? fmtDelta(v) : fmt1(v);
        const cls = [`cat-${g.cls}`];
        if (i === g.start) cls.push("group-start");
        if (opts.isDelta)  cls.push(v < 0 ? "neg" : "pos");
        tds += `<td class="${cls.join(" ")}">${txt}</td>`;
      }
    }

    const avg = meanAt(values, activeIndices(cats));
    const avgTxt = opts.isDelta ? fmtDelta(avg) : fmt1(avg);
    const avgCls = ["avg-cell"];
    if (opts.isDelta) avgCls.push(avg < 0 ? "neg" : "pos");
    tds += `<td class="${avgCls.join(" ")}">${avgTxt}</td>`;

    return `<tr${rowCls}><td class="${methCls}">${label}</td>${tds}</tr>`;
  }

  function renderResults(state) {
    const out = document.getElementById("results-output");
    if (!out) return;

    const data         = RESULTS_DATA[state.size];
    const cats         = state.categories;
    const activeGroups = BENCH_GROUPS.filter((g) => cats.has(g.name));

    // ----- header -----
    let groupRow = '<th rowspan="2">Method</th>';
    activeGroups.forEach((g) => {
      const span = g.end - g.start;
      groupRow += `<th colspan="${span}" class="grp-${g.cls} group-start">${g.name}</th>`;
    });
    groupRow += '<th rowspan="2" class="avg-header" title="Average over selected benchmark categories">Avg.</th>';

    let subRow = "";
    activeGroups.forEach((g) => {
      for (let i = g.start; i < g.end; i++) {
        const cls = (i === g.start) ? `cat-${g.cls} group-start` : `cat-${g.cls}`;
        subRow += `<th class="${cls}">${BENCH_NAMES[i]}</th>`;
      }
    });

    // ----- body -----
    // The base row spells out the full model name (e.g. "Qwen3-VL-8B-Thinking
    // (Agent)") so it is self-describing and no separate scale-head row is
    // needed above it. GRPO, AXPO, and Δ are always shown — the user is here
    // to compare them, so we don't gate that behind a toggle.
    const baseLabel = `Qwen3-VL-${state.size}-Thinking (Agent)`;
    const delta     = data.AXPO.map((v, i) => v - data.GRPO[i]);

    let body = "";
    body += buildRow(baseLabel, data.Base, cats);
    body += buildRow("+ GRPO", data.GRPO, cats);
    body += buildRow("+ AXPO (Ours)", data.AXPO, cats, {
      rowClass: "axpo-row",
      methodClass: "method-axpo",
    });
    // Inline "(AXPO − GRPO)" hint right next to the Δ symbol so the
    // table is self-explanatory without a separate footnote paragraph.
    body += buildRow(
      'Δ <span class="delta-hint">(AXPO − GRPO)</span>',
      delta, cats, { rowClass: "delta-row", isDelta: true });

    // Always pin the 32B baseline at the bottom as a comparison target.
    // The dashed top border on .ref-row visually separates it from the
    // active model's rows, so no extra pill/tag is needed in the label.
    body += buildRow("Qwen3-VL-32B-Thinking (Agent)", RESULTS_DATA["32B"].Base, cats, { rowClass: "ref-row" });

    const html = `
      <table class="results-table-full">
        <thead>
          <tr class="group-header">${groupRow}</tr>
          <tr>${subRow}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;

    out.innerHTML = html;
    out.classList.remove("results-fade-in");
    // Force reflow so the animation restarts on each render
    void out.offsetWidth;
    out.classList.add("results-fade-in");
  }

  const controls = document.getElementById("results-controls");
  if (controls && document.getElementById("results-output")) {
    const state = {
      size: "8B",
      categories: new Set(["Reasoning", "Perception", "Search"]),
    };

    function syncControlsUI() {
      controls.querySelectorAll("[data-size]").forEach((chip) => {
        const isActive = chip.dataset.size === state.size;
        chip.classList.toggle("rc-chip-active", isActive);
        chip.setAttribute("aria-checked", isActive ? "true" : "false");
      });
      controls.querySelectorAll("[data-cat]").forEach((chip) => {
        const isActive = state.categories.has(chip.dataset.cat);
        chip.classList.toggle("rc-chip-active", isActive);
        chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    controls.querySelectorAll("[data-size]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (state.size === chip.dataset.size) return;
        state.size = chip.dataset.size;
        syncControlsUI();
        renderResults(state);
      });
    });

    controls.querySelectorAll("[data-cat]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const c = chip.dataset.cat;
        if (state.categories.has(c)) {
          // Refuse to remove the last category — Avg would be meaningless.
          if (state.categories.size === 1) return;
          state.categories.delete(c);
        } else {
          state.categories.add(c);
        }
        syncControlsUI();
        renderResults(state);
      });
    });

    syncControlsUI();
    renderResults(state);
  }

  // ---------- Offscreen pause for infinite CSS animations ----------
  // Several decorative pieces (the title's ambient blur pulse and the
  // TL;DR results figure with its bars + RL progress meter) run on
  // infinite CSS loops. Even paused-looking, those loops continue to
  // repaint while scrolled out of view — which on a mid-range phone
  // shows up as scroll jitter once the hero has been left behind.
  //
  // This observer adds `is-offscreen` whenever the element leaves the
  // viewport, and the CSS counterpart maps that class to
  // `animation-play-state: paused`. When the element scrolls back into
  // view we strip the class and the animation resumes from where it
  // left off (so the user never sees a "jump" mid-cycle).
  (function pauseInfiniteAnimsOffscreen() {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = document.querySelectorAll(
      ".title, .anim-bars-figure"
    );
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        e.target.classList.toggle("is-offscreen", !e.isIntersecting);
      }
    }, { rootMargin: "120px 0px 120px 0px" });

    targets.forEach((el) => io.observe(el));
  })();

  // ---------- AXPO mechanism animation: dynamic mobile scaling ----------
  // The animation stage has a natural width of ~575px (driven by the
  // AXPO branches row: question chip + frozen prefix + branch SVG +
  // 3 re-roll columns). On a 360-wide phone that's almost 2× too wide,
  // and the horizontal-scroll fallback ends up clipping labels like
  // "Tool Collapse" → "ol Collapse" and obscures the trajectory.
  //
  // Instead we measure the stage's intrinsic width and apply
  // `transform: scale(N)` so the entire mechanism fits the viewport at
  // once. Every animated descendant rides along with the parent
  // transform — no keyframe rewrites required. We collapse the wrapper
  // height to the scaled height so the figure-card itself stays the
  // right size, and re-measure on resize / orientation change so a
  // phone-to-tablet rotation re-fits correctly.
  (function initMechAnimScale() {
    const figure = document.querySelector(".concept-anim-figure");
    if (!figure) return;
    const scroll = figure.querySelector(".ca-scroll");
    const stage  = figure.querySelector(".ca-stage");
    if (!scroll || !stage) return;

    let pending = false;

    function measure() {
      pending = false;

      const isMobile = window.matchMedia &&
        window.matchMedia("(max-width: 640px)").matches;

      // Always reset before measuring — both so the desktop transition
      // wipes any mobile scale and so we measure the *natural* layout
      // rather than a previously-scaled one.
      stage.style.transform = "";
      scroll.style.height = "";
      figure.classList.remove("ca-scaled");

      if (!isMobile) return;

      // Force layout, then capture intrinsic dimensions of the stage
      // (which has `width: max-content` on mobile so this is the true
      // natural width). availableWidth is the wrapper's content box,
      // i.e. what we have room to fit into.
      const naturalWidth = stage.offsetWidth;
      const availableWidth = scroll.clientWidth;
      if (!naturalWidth || !availableWidth) return;

      // 1px tolerance — sub-pixel rounding shouldn't trigger a scale
      // of 0.998× that buys nothing and only blurs text.
      if (naturalWidth <= availableWidth + 1) return;

      const scale = availableWidth / naturalWidth;
      const naturalHeight = stage.offsetHeight;

      stage.style.transform = "scale(" + scale + ")";
      scroll.style.height = Math.ceil(naturalHeight * scale) + "px";
      figure.classList.add("ca-scaled");
    }

    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(measure);
    }

    // Initial measure as soon as the DOM is parsed. Re-runs cover:
    //   - `load`        : images/icons in the stage may shift width
    //   - `resize`      : viewport size / orientation change
    //   - fonts.ready   : web fonts shift chip text widths
    schedule();
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }
  })();

  // ---------- AXPO mechanism animation: play once, replay on demand ----------
  // The CSS keyframes loop infinitely on their own, but the user prefers
  // a "play once then stop" cadence: after one full cycle we freeze every
  // animated descendant at its hold-phase frame (96%) so the static end
  // state remains readable; a Replay button restarts it from 0% on click.
  //
  // Start gating: previously the timer fired at page load, which meant a
  // mobile user scrolling down slowly would arrive at the Method section
  // long after the 19s cycle had already paused — they'd see only the
  // static end state and never the actual animation. We now hold the
  // stage paused at 0% until it scrolls into view, then kick off the
  // one-shot cycle so the user catches it from the start regardless of
  // how long it took them to reach this section.
  (function initMechAnimReplay() {
    // Reduced-motion viewers see static end-state via the CSS fallback —
    // there's no looping to manage and no button to wire up.
    if (window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stage = document.querySelector(".concept-anim-figure .ca-stage");
    const btn   = document.getElementById("ca-retry-btn");
    if (!stage || !btn) return;

    // Mobile detection. On a phone the stage (~575px wide for the AXPO
    // branches row) overflows the viewport and lives inside a
    // horizontally-scrollable wrapper. A single 20s pass often expires
    // before the user has finished swiping right to see the re-rolls,
    // leaving them looking at the frozen end-state without ever having
    // watched the action. To compensate we (1) wait longer before
    // starting and (2) play through two cycles before freezing — giving
    // the swipe-around viewer a second window to catch what they missed.
    const isMobile = window.matchMedia &&
      window.matchMedia("(max-width: 640px)").matches;

    // One full loop is 20s in the CSS. The hold frame sits at 96% (~19.2s);
    // we pause exactly there so each chip lands on its settled state
    // instead of getting caught mid-fade-out at 100%. On mobile we run
    // two back-to-back cycles before pausing (see comment above).
    const CYCLE_MS = 20000;
    const CYCLES = isMobile ? 2 : 1;
    const PAUSE_AT_MS = Math.round(CYCLE_MS * (CYCLES - 1) + CYCLE_MS * 0.96);
    let pauseTimer = null;
    let hasStarted = false;

    function clearPauseTimer() {
      if (pauseTimer !== null) {
        clearTimeout(pauseTimer);
        pauseTimer = null;
      }
    }
    function pauseAtEnd() {
      stage.classList.add("ca-paused");
      btn.classList.add("is-visible");
    }
    function schedulePause() {
      clearPauseTimer();
      pauseTimer = setTimeout(pauseAtEnd, PAUSE_AT_MS);
    }
    function play() {
      hasStarted = true;
      // Two-step reset that ALSO works for the very first play (the
      // stage starts with .ca-paused so we need to clear that flag too):
      //   (1) clear the paused/hidden state,
      //   (2) wipe every descendant's animation via `animation: none`
      //       on a freeze class,
      //   (3) force a reflow so the browser commits that wipe,
      //   (4) remove the freeze class — the browser then re-evaluates
      //       the original CSS animations from 0%.
      btn.classList.remove("is-visible");
      stage.classList.remove("ca-paused");
      stage.classList.add("ca-freeze");
      // Reading offsetWidth forces synchronous layout, locking in the
      // animation: none state before we remove the class.
      void stage.offsetWidth;
      stage.classList.remove("ca-freeze");
      schedulePause();
    }

    btn.addEventListener("click", play);

    // Start paused at 0% so the stage sits in its empty initial state
    // until the user actually scrolls to it. Without this gate the
    // 19.2s pause timer would fire while the user is still up at the
    // hero on mobile, and by the time they reach Method the figure
    // would already show its frozen end state.
    stage.classList.add("ca-paused");

    function isInViewport() {
      const r = stage.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // Consider "in view" when any part of the stage intersects the
      // viewport with a small slack — accounts for the sticky nav.
      return r.bottom > 0 && r.top < vh;
    }

    // Fast path: if the Method section happens to be in the initial
    // viewport (large desktop, deep-linked anchor, etc.), don't bother
    // waiting for IntersectionObserver — start the cycle right away.
    // On mobile we skip this fast path so the IO threshold can require
    // the stage to be properly centered before kicking off — the
    // animation is too dense to start the moment the user's swipe is
    // still in motion at the very bottom of the viewport.
    if (!isMobile && isInViewport()) {
      play();
      return;
    }

    if ("IntersectionObserver" in window) {
      // Tighter trigger on mobile (threshold 0.35) so the user has
      // clearly arrived at the section and given it a moment to
      // settle before the 40s double-cycle starts; desktop keeps the
      // original generous threshold so deep-linked anchors still
      // start promptly. The negative bottom rootMargin on mobile
      // (-20%) also pushes the trigger further into the viewport,
      // away from the bottom edge.
      const ioOptions = isMobile
        ? { threshold: 0.35, rootMargin: "0px 0px -20% 0px" }
        : { threshold: 0,    rootMargin: "0px 0px -10% 0px" };
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !hasStarted) {
            play();
            io.disconnect();
            break;
          }
        }
      }, ioOptions);
      io.observe(stage);
    } else {
      // Old browsers: just play immediately, same as before.
      play();
    }
  })();
})();
