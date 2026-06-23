/* ═══════════════════════════════════════════════════════════
   Mario Mini-Game  –  runs inside .client-inner
   Sprite sheet : assets/mario/sprite-sheet.webp  (928 × 272)
   Pipe asset   : assets/mario/pipe.png           (512 × 512)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ──────── constants ──────── */
  const MARIO_W  = 32;
  const MARIO_H  = 32;
  const PIPE_W   = 72;
  const PIPE_H   = 96;
  const GRAVITY  = 0.55;
  const JUMP_VEL = -14.5;
  const MOVE_ACC = 0.55;
  const MAX_VX   = 4;
  const FRICTION = 0.80;
  const PAGES    = ['home', 'projects', 'extras', 'contact'];

  /* sprite regions inside the 928×272 sheet */
  const FRAME = {
    idle : { x: 0,   y: 48, w: 240, h: 224 },
    run  : { x: 272, y: 0,  w: 240, h: 256 },
    jump : { x: 640, y: 32, w: 256, h: 240 },
  };

  /* selectors treated as one-way platforms (can land on top, drop through) */
  const PLAT_SEL =
    '.panel, .project-item, .intro';

  /* On contact page: land on bottom edge of inputs (not top) */
  const PLAT_BOTTOM_SEL = '.contact-form input, .contact-form textarea';

  /* selectors treated as solid barriers (block from all sides) */
  const BARRIER_SEL = '.carousel-dots, .form-actions';

  /* Pipe image measurements for VERTICAL pipes (original orientation, opening at top) */
  const PIPE_CONTENT_TOP     = 25;
  const PIPE_CONTENT_BOTTOM  = 71;
  const PIPE_CONTENT_H       = 46;
  const PIPE_LIP_LEFT        = 13;
  const PIPE_LIP_RIGHT       = 59;
  const PIPE_BODY_LEFT       = 16;
  const PIPE_BODY_RIGHT      = 56;
  const PIPE_LIP_H_FRACTION  = 0.48;

  /*
   * Per-page pipe config.
   * orient: 'horizontal' (sideways, opening faces inward) | 'vertical' (default, opening at top)
   * anchor: CSS selector — pipe is vertically centered on this element (null = bottom of page)
   * side: 'left' | 'right' — which edge of the window the pipe sits on.
   *
   * Horizontal pipes: come out from the side wall. Left pipe opening faces right, right pipe faces left.
   * Vertical pipes: sit at ground level, opening faces up.
   */
  const PIPE_CONFIG = {
    home: [
      { side: 'right', anchor: '#home .project-item:nth-child(2)', orient: 'horizontal' },
    ],
    projects: [
      { side: 'left',  anchor: '#projects .project-item:last-child',  orient: 'horizontal' },
      { side: 'right', anchor: '#projects .project-item:nth-child(2)', orient: 'horizontal' },
    ],
    extras: [
      { side: 'left',  anchor: null, orient: 'vertical' },
      { side: 'right', anchor: null, orient: 'vertical' },
    ],
    contact: [
      { side: 'left',  anchor: null, orient: 'vertical' },
    ],
  };

  /* ──────── Goombas ──────── */
  const GOOMBA_W      = 32;
  const GOOMBA_H      = 32;
  const GOOMBA_DEAD_H = 14;
  const GOOMBA_SPEED  = 0.55;

  /* Goomba sprite frames (image is 581×161, three frames) */
  const GOOMBA_FRAME = {
    walk1: { x: 1,   y: 1,  w: 160, h: 160 },
    walk2: { x: 211, y: 1,  w: 160, h: 160 },
    dead:  { x: 421, y: 61, w: 160, h: 80  },
  };

  /* Per-page goomba spawns.
   * Each entry can be:
   *   { sel: selector, count?: N, all?: bool, bottom?: bool }
   *   { groundLevel: true, count: N }   — free-roam on the page floor
   *
   * Goombas spawn at random x within their platform and choose a
   * random initial direction. Multiple goombas on the same anchor
   * are supported via `count`. They reverse on collision with each
   * other and on barriers.
   */
  const GOOMBA_CONFIG = {
    home: [
      { sel: '#home #experience .project-item:nth-child(1)' },
      { sel: '#home #experience .project-item:nth-child(2)', count: 2 }, // double up
      { sel: '#home #experience .project-item:nth-child(4)' },
      // skip experience items 3 and 5
    ],
    projects: [
      { sel: '#projects .project-item:nth-child(1)' },
      { sel: '#projects .project-item:nth-child(2)',  count: 2 }, // double up
      { sel: '#projects .project-item:nth-child(4)' },
      { sel: '#projects .project-item:nth-child(6)' },
      { sel: '#projects .project-item:nth-child(8)',  count: 2 }, // double up
      { sel: '#projects .project-item:nth-child(10)' },
      { sel: '#projects .project-item:nth-child(11)' },
      // skip 3, 5, 7, 9
    ],
    extras: [
      { groundLevel: true, count: 3 },
    ],
    contact: [
      { sel: '#contact .panel' },                    // on contact links box
      { sel: '#contact .contact-form', count: 2 },   // 2 on top of gray form
      { sel: '#contact #email',   bottom: true },    // below email
      { sel: '#contact #message', bottom: true },    // below message
      // skip the name field
    ],
  };

  /* ──────── state ──────── */
  let on              = false;
  let victory         = false;
  let tick            = 0;
  let raf             = null;
  let keys            = {};
  let m               = {};       // mario: x,y in WORLD coords (scroll space)
  let transitioning   = false;
  let transTimer      = 0;
  let transTarget     = null;
  let transSide       = null;
  let pipeCooldown    = 0;
  let victoryCooldown = 0;
  let dropThrough     = 0;
  let emerging        = false;
  let emergeTimer     = 0;
  let emergeSide      = null;  // 'horiz-left', 'horiz-right', 'vert'
  let marioPage       = null;  // which page Mario is currently on
  let goombas         = [];
  let dying           = false;
  let dyingTimer      = 0;

  /* ──────── DOM refs ──────── */
  let ci, cl;                     // .client-inner  .client
  let canvas, ctx;
  let pipeEls = [];               // { el, side, anchor, orient }
  let flagEl, victoryOverlay;

  /* ──────── assets (preload) ──────── */
  const spriteImg = new Image();
  spriteImg.src   = 'assets/mario/sprite-sheet.webp';
  const pipeImg   = new Image();
  pipeImg.src     = 'assets/mario/pipe.png';
  const goombaImg = new Image();
  goombaImg.src   = 'assets/mario/goomba.png';

  /* ══════════════════════════════════
     PUBLIC  toggle / start / stop
     ══════════════════════════════════ */

  function toggle() { on ? stop() : start(); }

  function start() {
    on = true; victory = false; tick = 0; keys = {};
    transitioning = false; pipeCooldown = 0; victoryCooldown = 90;
    dropThrough = 0;
    ci = document.querySelector('.client-inner');
    cl = document.querySelector('.client');
    if (!ci || !cl) return;

    /* spawn Mario at the bottom of the page content */
    const groundY = getGroundY();
    m = {
      x: ci.clientWidth / 2 - MARIO_W / 2,
      y: groundY,
      vx: 0, vy: 0,
      facing: 'right',
      grounded: true,
    };

    buildDOM();
    attachKeys();
    document.body.classList.add('mario-active');
    document.querySelector('.ctrl.mario-btn')?.classList.add('is-active');
    marioPage = getPage();

    /* Intro toast — shown every time Mario starts */
    showToast('Find the Mystery Box!', 4000);

    /* scroll to Mario (bottom of page) */
    ci.scrollTop = ci.scrollHeight - ci.clientHeight;

    raf = requestAnimationFrame(loop);
  }

  function stop() {
    on = false;
    cancelAnimationFrame(raf);
    detachKeys();
    tearDOM();
    document.body.classList.remove('mario-active');
    document.querySelector('.ctrl.mario-btn')?.classList.remove('is-active');
  }

  /** Called from app.js when the user clicks a tab manually.
   *  Mario stays on his page — only visible when on his page. */
  function onPageSwitch() {
    if (!on) return;
    rebuildPipes();
    rebuildFlag();
    rebuildGoombas();
    /* Show/hide Mario based on whether he’s on this page */
    updateMarioVisibility();
    pipeCooldown = 30;
    victoryCooldown = 60;
  }

  function updateMarioVisibility() {
    if (!canvas) return;
    if (getPage() === marioPage) {
      canvas.style.display = '';
    } else {
      canvas.style.display = 'none';
    }
  }

  /* ══════════════════════════════════
     DOM  create / destroy
     ══════════════════════════════════ */

  function buildDOM() {
    canvas        = document.createElement('canvas');
    canvas.id     = 'mario-canvas';
    canvas.width  = MARIO_W;
    canvas.height = MARIO_H;
    ci.appendChild(canvas);
    ctx = canvas.getContext('2d');
    rebuildPipes();
    rebuildFlag();
    rebuildGoombas();
  }

  function rebuildPipes() {
    pipeEls.forEach(p => p.el.remove());
    pipeEls = [];
    const page   = getPage();
    const config = PIPE_CONFIG[page] || [];

    for (const cfg of config) {
      const el = document.createElement('div');
      el.className = 'mario-pipe mario-pipe-' + cfg.side;
      if (cfg.orient === 'horizontal') el.classList.add('mario-pipe-horiz');
      const img = document.createElement('img');
      img.src = 'assets/mario/pipe.png';
      img.alt = 'Warp pipe';
      el.appendChild(img);
      ci.appendChild(el);
      pipeEls.push({ el, side: cfg.side, anchor: cfg.anchor, orient: cfg.orient || 'vertical' });
    }
    positionPipes();
  }

  function rebuildFlag() {
    flagEl?.remove(); flagEl = null;
    if (getPage() === 'contact') {
      /* Place mystery box right below the contact-links panel */
      const target = document.querySelector('#contact .panel');
      if (target) {
        flagEl = document.createElement('div');
        flagEl.className = 'mario-mystery-box';
        const img = document.createElement('img');
        img.src = 'assets/mario/mystery-box.png';
        img.alt = 'Mystery Box';
        flagEl.appendChild(img);
        ci.appendChild(flagEl);
        const ciRect = ci.getBoundingClientRect();
        const tRect  = target.getBoundingClientRect();
        flagEl.style.top  = (tRect.bottom - ciRect.top + ci.scrollTop) + 'px';
        flagEl.style.left = (tRect.right  - ciRect.left + ci.scrollLeft - 48 - 8) + 'px';
      }
    }
  }

  /** Position pipes in scroll-world coordinates */
  function positionPipes() {
    const ciRect = ci.getBoundingClientRect();

    for (const p of pipeEls) {
      if (p.anchor) {
        const anchorEl = document.querySelector(p.anchor);
        if (anchorEl) {
          const aRect = anchorEl.getBoundingClientRect();
          const anchorTopInScroll = aRect.top - ciRect.top + ci.scrollTop;

          if (p.orient === 'horizontal') {
            /* Horizontal pipe: bottom sits on top of the anchor platform */
            const elH = PIPE_W;  // rotated: element height = PIPE_W(72)
            const pipeTopY = anchorTopInScroll - elH + 10;
            p.el.style.top = pipeTopY + 'px';
          } else {
            /* Vertical pipe: centered on anchor */
            const pipeTopY = anchorTopInScroll + (aRect.height - PIPE_H) / 2;
            p.el.style.top = pipeTopY + 'px';
          }
        }
      } else {
        /* Default: place at bottom of page content */
        const page = document.querySelector('.page.is-active');
        const pageBottom = page ? page.offsetTop + page.offsetHeight : ci.scrollHeight;
        const pipeTopY = pageBottom - PIPE_CONTENT_BOTTOM;
        p.el.style.top = pipeTopY + 'px';
      }

      if (p.side === 'right') {
        p.el.style.right = p.orient === 'horizontal' ? '-24px' : '30px';
        p.el.style.left  = 'auto';
      } else {
        p.el.style.left  = p.orient === 'horizontal' ? '-24px' : '30px';
        p.el.style.right = 'auto';
      }
    }
  }

  function tearDOM() {
    canvas?.remove();          canvas = null; ctx = null;
    pipeEls.forEach(p => p.el.remove()); pipeEls = [];
    flagEl?.remove();          flagEl = null;
    victoryOverlay?.remove();  victoryOverlay = null;
    goombas.forEach(g => g.canvas?.remove()); goombas = [];
  }

  /* ══════════════════════════════════
     INPUT
     ══════════════════════════════════ */

  function kd(e) {
    if (!on) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
      e.preventDefault();
      keys[e.key] = true;
    }
  }
  function ku(e) { keys[e.key] = false; }
  function attachKeys() { document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); }
  function detachKeys()  { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); }

  /* ══════════════════════════════════
     GAME LOOP
     ══════════════════════════════════ */

  function loop() {
    if (!on) return;
    update();
    render();
    tick++;
    raf = requestAnimationFrame(loop);
  }

  /* ────── update ────── */

  function update() {
    /* Emerging from pipe animation */
    if (emerging) {
      emergeTimer++;
      if (emergeSide === 'horiz-left')       m.x += 2;
      else if (emergeSide === 'horiz-right') m.x -= 2;
      else                                   m.y -= 2;
      if (emergeTimer >= 20) { emerging = false; }
      return;
    }
    if (transitioning) {
      transTimer++;
      /* sink direction depends on pipe orientation */
      if (transSide === 'horiz-right')      m.x += 2;
      else if (transSide === 'horiz-left')  m.x -= 2;
      else                                   m.y += 2;  // vert-left or vert-right
      if (transTimer >= 20) { transitioning = false; doPageSwitch(); }
      return;
    }
    if (dying) {
      dyingTimer++;
      if (dyingTimer >= 36) {
        dying = false;
        respawnMario();
      }
      return;
    }
    if (victory) return;
    if (pipeCooldown > 0)    pipeCooldown--;
    if (victoryCooldown > 0) victoryCooldown--;

    /* If Mario isn't on the active page, freeze him */
    if (getPage() !== marioPage) return;

    /* ── input ── */
    if (keys['ArrowLeft'])  { m.vx -= MOVE_ACC; m.facing = 'left';  }
    if (keys['ArrowRight']) { m.vx += MOVE_ACC; m.facing = 'right'; }
    if ((keys['ArrowUp'] || keys[' ']) && m.grounded) {
      m.vy       = JUMP_VEL;
      m.grounded = false;
      playSound('jump');
    }
    if (keys['ArrowDown'] && m.grounded && dropThrough === 0) {
      if (!isOnVerticalPipe()) {
        dropThrough = 10;
        m.grounded  = false;
        m.y        += 4;
        keys['ArrowDown'] = false;
      }
    }
    if (dropThrough > 0) dropThrough--;

    /* ── friction ── */
    if (!keys['ArrowLeft'] && !keys['ArrowRight']) m.vx *= FRICTION;
    m.vx = clamp(m.vx, -MAX_VX, MAX_VX);
    if (Math.abs(m.vx) < 0.15) m.vx = 0;

    /* ── gravity ── */
    m.vy += GRAVITY;

    const prevX = m.x;
    const prevY = m.y;

    /* ── move ── */
    m.x += m.vx;
    m.y += m.vy;

    /* ── horizontal bounds ── */
    m.x = clamp(m.x, 0, ci.scrollWidth - MARIO_W);

    /* ── pipe solid collision ── */
    collidePipes(prevX, prevY);

    /* ── platform collision ── */
    m.grounded = false;

    /* barrier collision (solid from all sides) */
    collideBarriers(prevX, prevY);

    /* pipe tops (vertical pipes only) */
    collidePipeTops(prevY);

    /* horizontal pipe tops (can stand on them) */
    collideHorizPipeTops(prevY);

    /* page element platforms */
    const plats = getPlatforms();
    if (dropThrough > 0) { /* skip */ }
    else for (const p of plats) {
      if (
        m.vy >= 0 &&
        prevY + MARIO_H <= p.y + 6 &&
        m.y   + MARIO_H >= p.y &&
        m.x   + MARIO_W >  p.x + 4 &&
        m.x              <  p.x + p.w - 4
      ) {
        m.y        = p.y - MARIO_H;
        m.vy       = 0;
        m.grounded = true;
        break;
      }
    }

    /* ── ground ── */
    const groundY = getGroundY();
    if (m.y >= groundY) {
      m.y        = groundY;
      m.vy       = 0;
      m.grounded = true;
    }

    /* ── ceiling ── */
    if (m.y < 0) { m.y = 0; m.vy = Math.max(0, m.vy); }

    /* ── pipe warp check ── */
    checkPipes();

    /* ── victory ── */
    checkVictory();

    /* ── goombas ── */
    updateGoombas();
  }

  /* ────── platforms (world coords) ────── */

  function getPlatforms() {
    const page = document.querySelector('.page.is-active');
    if (!page) return [];
    const ciRect = ci.getBoundingClientRect();
    const pageId = page.id;

    /* Standard platforms (land on top edge) — skip .panel on extras,
       add .contact-form (gray form box) on contact */
    let sel;
    if (pageId === 'extras')        sel = '.project-item, .intro';
    else if (pageId === 'contact')  sel = '.panel, .project-item, .intro, .contact-form';
    else                            sel = PLAT_SEL;

    const plats = Array.from(page.querySelectorAll(sel)).map(el => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - ciRect.left + ci.scrollLeft,
        y: r.top  - ciRect.top  + ci.scrollTop,
        w: r.width,
        h: r.height,
      };
    });

    /* Bottom-edge platforms (land on bottom edge of inputs/textareas) */
    Array.from(page.querySelectorAll(PLAT_BOTTOM_SEL)).forEach(el => {
      const r = el.getBoundingClientRect();
      plats.push({
        x: r.left - ciRect.left + ci.scrollLeft,
        y: r.top  - ciRect.top  + ci.scrollTop + r.height,
        w: r.width,
        h: 0,
      });
    });

    return plats;
  }

  function getBarriers() {
    const page = document.querySelector('.page.is-active');
    if (!page) return [];
    const ciRect = ci.getBoundingClientRect();
    return Array.from(page.querySelectorAll(BARRIER_SEL)).map(el => {
      /* Compute tight bounds from visible children so flex containers
         like .carousel-dots and .form-actions don't extend across the
         whole page width. Falls back to the element itself if it has
         no children. */
      const kids = el.children;
      let r;
      if (kids.length > 0) {
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const k of kids) {
          const kr = k.getBoundingClientRect();
          if (kr.width === 0 || kr.height === 0) continue;
          if (kr.left   < left)   left   = kr.left;
          if (kr.top    < top)    top    = kr.top;
          if (kr.right  > right)  right  = kr.right;
          if (kr.bottom > bottom) bottom = kr.bottom;
        }
        if (left === Infinity) r = el.getBoundingClientRect();
        else r = { left, top, width: right - left, height: bottom - top };
      } else {
        r = el.getBoundingClientRect();
      }
      return {
        x: r.left - ciRect.left + ci.scrollLeft,
        y: r.top  - ciRect.top  + ci.scrollTop,
        w: r.width,
        h: r.height,
      };
    });
  }

  /** Solid barrier collision – blocks Mario from all sides */
  function collideBarriers(prevX, prevY) {
    const barriers = getBarriers();
    for (const b of barriers) {
      /* Check overlap */
      if (
        m.x + MARIO_W > b.x &&
        m.x < b.x + b.w &&
        m.y + MARIO_H > b.y &&
        m.y < b.y + b.h
      ) {
        /* Resolve: find smallest penetration axis */
        const overlapLeft   = (m.x + MARIO_W) - b.x;
        const overlapRight  = (b.x + b.w) - m.x;
        const overlapTop    = (m.y + MARIO_H) - b.y;
        const overlapBottom = (b.y + b.h) - m.y;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && prevY + MARIO_H <= b.y + 6) {
          /* Landing on top */
          m.y = b.y - MARIO_H;
          m.vy = 0;
          m.grounded = true;
        } else if (minOverlap === overlapBottom && prevY >= b.y + b.h - 6) {
          /* Hitting from below */
          m.y = b.y + b.h;
          m.vy = Math.max(0, m.vy);
        } else if (minOverlap === overlapLeft && prevX + MARIO_W <= b.x + 4) {
          /* Hitting from left side */
          m.x = b.x - MARIO_W;
          m.vx = 0;
        } else if (minOverlap === overlapRight && prevX >= b.x + b.w - 4) {
          /* Hitting from right side */
          m.x = b.x + b.w;
          m.vx = 0;
        } else {
          /* Fallback: push out of nearest edge */
          if (minOverlap === overlapTop)    { m.y = b.y - MARIO_H; m.vy = 0; m.grounded = true; }
          else if (minOverlap === overlapBottom) { m.y = b.y + b.h; m.vy = Math.max(0, m.vy); }
          else if (minOverlap === overlapLeft)   { m.x = b.x - MARIO_W; m.vx = 0; }
          else                                    { m.x = b.x + b.w; m.vx = 0; }
        }
      }
    }
  }

  function getGroundY() {
    const page = document.querySelector('.page.is-active');
    if (!page) return ci.clientHeight - MARIO_H;
    const bot = page.offsetTop + page.offsetHeight;
    return Math.max(bot, ci.clientHeight) - MARIO_H;
  }

  /* ────── pipes ────── */

  /**
   * Get collision info for each pipe in WORLD (scroll) coords.
   * Handles both vertical and horizontal orientations.
   */
  function getPipeWorldRects() {
    const rects = [];
    const ciRect = ci.getBoundingClientRect();

    for (const p of pipeEls) {
      const r = p.el.getBoundingClientRect();
      const ex = r.left - ciRect.left + ci.scrollLeft;
      const ey = r.top  - ciRect.top  + ci.scrollTop;

      if (p.orient === 'horizontal') {
        /*
         * Horizontal pipe: element is PIPE_H wide × PIPE_W tall (CSS swaps via class).
         * Left pipe: opening faces right. Right pipe: opening faces left.
         * The pipe image is rotated in CSS.
         * Content area (from analysis): the pipe visual fills ~62% of the image.
         * For the rotated version, swap x↔y measurements.
         *
         * Element dimensions: width=PIPE_H(96), height=PIPE_W(72)
         * Content within (rotated mapping):
         *   topY:    ey + PIPE_LIP_LEFT   (13px from top)
         *   bottomY: ey + PIPE_LIP_RIGHT  (59px from top)
         *   For left pipe (opening right):
         *     openingX: ex + PIPE_CONTENT_BOTTOM → right edge of pipe body
         *     bodyStartX: ex + PIPE_CONTENT_TOP
         *   For right pipe (opening left):
         *     openingX: ex + (PIPE_H - PIPE_CONTENT_BOTTOM) → left edge
         *     bodyEndX:   ex + (PIPE_H - PIPE_CONTENT_TOP)
         */
        const bodyTopY = ey + PIPE_LIP_LEFT;
        const bodyBotY = ey + PIPE_LIP_RIGHT;
        const bodyH    = bodyBotY - bodyTopY;

        if (p.side === 'left') {
          // Opening faces RIGHT
          const bodyLeftX   = ex + PIPE_CONTENT_TOP;
          const bodyRightX  = ex + PIPE_CONTENT_BOTTOM;
          const openX       = bodyRightX;
          rects.push({
            orient: 'horizontal', side: 'left',
            bodyX: bodyLeftX, bodyY: bodyTopY,
            bodyW: bodyRightX - bodyLeftX, bodyH: bodyH,
            openX: openX, openY: bodyTopY, openW: 16, openH: bodyH,
            topY: bodyTopY,  // for standing on
            topX: bodyLeftX, topW: bodyRightX - bodyLeftX,
          });
        } else {
          // Opening faces LEFT
          const bodyLeftX  = ex + (PIPE_H - PIPE_CONTENT_BOTTOM);
          const bodyRightX = ex + (PIPE_H - PIPE_CONTENT_TOP);
          const openX      = bodyLeftX - 16;
          rects.push({
            orient: 'horizontal', side: 'right',
            bodyX: bodyLeftX, bodyY: bodyTopY,
            bodyW: bodyRightX - bodyLeftX, bodyH: bodyH,
            openX: openX, openY: bodyTopY, openW: 16, openH: bodyH,
            topY: bodyTopY,
            topX: bodyLeftX, topW: bodyRightX - bodyLeftX,
          });
        }
      } else {
        /* Vertical pipe (opening at top) — same as before */
        rects.push({
          orient: 'vertical', side: p.side,
          rimY:  ey + PIPE_CONTENT_TOP,
          lipX:  ex + PIPE_LIP_LEFT,
          lipW:  PIPE_LIP_RIGHT - PIPE_LIP_LEFT,
          lipH:  PIPE_CONTENT_H * PIPE_LIP_H_FRACTION,
          bodyX: ex + PIPE_BODY_LEFT,
          bodyW: PIPE_BODY_RIGHT - PIPE_BODY_LEFT,
          h:     PIPE_CONTENT_H,
        });
      }
    }
    return rects;
  }

  /** Is Mario standing on a vertical pipe? (for drop-through check) */
  function isOnVerticalPipe() {
    if (!ci) return false;
    const pipes = getPipeWorldRects();
    for (const p of pipes) {
      if (p.orient !== 'vertical') continue;
      if (
        m.grounded &&
        m.y + MARIO_H >= p.rimY - 4 &&
        m.y + MARIO_H <= p.rimY + 8 &&
        m.x + MARIO_W > p.lipX &&
        m.x < p.lipX + p.lipW
      ) return true;
    }
    return false;
  }

  /** Vertical pipe: stand on rim */
  function collidePipeTops(prevY) {
    const pipes = getPipeWorldRects();
    for (const p of pipes) {
      if (p.orient !== 'vertical') continue;
      if (
        m.vy >= 0 &&
        prevY + MARIO_H <= p.rimY + 4 &&
        m.y  + MARIO_H >= p.rimY &&
        m.x  + MARIO_W > p.lipX &&
        m.x            < p.lipX + p.lipW
      ) {
        m.y        = p.rimY - MARIO_H;
        m.vy       = 0;
        m.grounded = true;
      }
    }
  }

  /** Horizontal pipe: stand on top */
  function collideHorizPipeTops(prevY) {
    const pipes = getPipeWorldRects();
    for (const p of pipes) {
      if (p.orient !== 'horizontal') continue;
      if (
        m.vy >= 0 &&
        prevY + MARIO_H <= p.topY + 4 &&
        m.y  + MARIO_H >= p.topY &&
        m.x  + MARIO_W > p.topX &&
        m.x            < p.topX + p.topW
      ) {
        m.y        = p.topY - MARIO_H;
        m.vy       = 0;
        m.grounded = true;
      }
    }
  }

  /** Solid side collision for all pipes */
  function collidePipes(prevX, prevY) {
    const pipes = getPipeWorldRects();
    for (const p of pipes) {
      if (p.orient === 'vertical') {
        /* Skip if Mario was above (landing) */
        if (prevY + MARIO_H <= p.rimY + 4) continue;

        const lipTop  = p.rimY;
        const lipBot  = p.rimY + p.lipH;
        const bodyTop = lipBot;
        const bodyBot = p.rimY + p.h;

        const inLip =
          m.x + MARIO_W > p.lipX && m.x < p.lipX + p.lipW &&
          m.y + MARIO_H > lipTop + 4 && m.y < lipBot;
        const inBody =
          m.x + MARIO_W > p.bodyX && m.x < p.bodyX + p.bodyW &&
          m.y + MARIO_H > bodyTop && m.y < bodyBot;

        if (!inLip && !inBody) continue;
        const bx = inLip ? p.lipX : p.bodyX;
        const bw = inLip ? p.lipW : p.bodyW;

        if (prevX + MARIO_W <= bx)      m.x = bx - MARIO_W;
        else if (prevX >= bx + bw)      m.x = bx + bw;
        else {
          if (m.x + MARIO_W/2 < bx + bw/2) m.x = bx - MARIO_W;
          else                               m.x = bx + bw;
        }
        m.vx = 0;

      } else {
        /* Horizontal pipe body collision */
        if (prevY + MARIO_H <= p.topY + 4) continue; // landing from above

        const inBody =
          m.x + MARIO_W > p.bodyX && m.x < p.bodyX + p.bodyW &&
          m.y + MARIO_H > p.bodyY + 4 && m.y < p.bodyY + p.bodyH;

        if (!inBody) continue;

        /* Push out — horizontally toward pipe opening side */
        if (p.side === 'left') {
          // pipe on left, opening right → push Mario to the right
          m.x = p.bodyX + p.bodyW;
        } else {
          // pipe on right, opening left → push Mario to the left
          m.x = p.bodyX - MARIO_W;
        }
        m.vx = 0;
      }
    }
  }

  /** Warp check */
  function checkPipes() {
    if (!canvas || pipeCooldown > 0) return;
    const page = getPage();
    const idx  = PAGES.indexOf(page);
    const pipes = getPipeWorldRects();

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];

      if (p.orient === 'vertical') {
        /* Vertical: stand on top + ArrowDown */
        if (!keys['ArrowDown']) continue;
        const onPipe =
          m.grounded &&
          m.y + MARIO_H >= p.rimY - 4 &&
          m.y + MARIO_H <= p.rimY + 8 &&
          m.x + MARIO_W > p.lipX &&
          m.x < p.lipX + p.lipW;
        if (!onPipe) continue;

        let target = null;
        if (p.side === 'left'  && idx > 0)                target = PAGES[idx - 1];
        if (p.side === 'right' && idx < PAGES.length - 1) target = PAGES[idx + 1];
        if (!target) continue;

        m.x = p.lipX + (p.lipW - MARIO_W) / 2;
        m.y = p.rimY - MARIO_H + 2;
        m.vx = 0; m.vy = 0;
        startTransition(target, 'vert-' + p.side);
        return;

      } else {
        /* Horizontal: walk into the pipe (press toward the wall it comes from).
         * Left pipe comes from left wall: press ArrowLeft to enter
         * Right pipe comes from right wall: press ArrowRight to enter
         */
        const pressingIn =
          (p.side === 'left'  && keys['ArrowLeft']) ||
          (p.side === 'right' && keys['ArrowRight']);
        if (!pressingIn) continue;

        /* Check if Mario overlaps the opening zone */
        const inOpening =
          m.x + MARIO_W > p.openX &&
          m.x < p.openX + p.openW &&
          m.y + MARIO_H > p.openY &&
          m.y < p.openY + p.openH;
        if (!inOpening) continue;

        let target = null;
        if (p.side === 'left'  && idx > 0)                target = PAGES[idx - 1];
        if (p.side === 'right' && idx < PAGES.length - 1) target = PAGES[idx + 1];
        if (!target) continue;

        /* Center Mario on opening and slide into pipe */
        m.y  = p.openY + (p.openH - MARIO_H) / 2;
        m.vx = 0; m.vy = 0;
        startTransition(target, p.side === 'left' ? 'horiz-left' : 'horiz-right');
        return;
      }
    }
  }

  function startTransition(page, dir) {
    transitioning = true;
    transTimer    = 0;
    transTarget   = page;
    transSide     = dir;
    playSound('pipe');
  }

  function doPageSwitch() {
    if (window.navigateTo) window.navigateTo(transTarget);
    rebuildPipes();
    rebuildFlag();
    rebuildGoombas();

    /* Exit from the opposite side pipe.
     * Entered left pipe → exit right pipe. Entered right pipe → exit left pipe.
     */
    const enteredSide = transSide.includes('left') ? 'left' : 'right';
    const exitSide = enteredSide === 'left' ? 'right' : 'left';

    /* Find the exit pipe */
    const exitPipes = getPipeWorldRects().filter(p => p.side === exitSide);
    const exitPipe = exitPipes[0];

    if (exitPipe && exitPipe.orient === 'horizontal') {
      /* Start inside the pipe, emerge outward */
      m.y = exitPipe.openY + (exitPipe.openH - MARIO_H) / 2;
      if (exitPipe.side === 'left') {
        m.x = exitPipe.bodyX;  // start inside the pipe body
        emergeSide = 'horiz-left';  // will slide rightward out
        m.facing = 'right';
      } else {
        m.x = exitPipe.bodyX + exitPipe.bodyW - MARIO_W;
        emergeSide = 'horiz-right';  // will slide leftward out
        m.facing = 'left';
      }
    } else if (exitPipe && exitPipe.orient === 'vertical') {
      /* Start inside vertical pipe, emerge upward */
      m.x = exitPipe.lipX + (exitPipe.lipW - MARIO_W) / 2;
      m.y = exitPipe.rimY + 20;
      emergeSide = 'vert';
      m.facing = 'right';
    } else {
      /* No matching exit pipe — just spawn at bottom */
      const groundY = getGroundY();
      m.y = groundY;
      if (exitSide === 'left') {
        m.x = MARIO_W + 20;
        m.facing = 'right';
      } else {
        m.x = ci.clientWidth - MARIO_W - 20;
        m.facing = 'left';
      }
      emergeSide = null;
    }

    m.vx = 0; m.vy = 0; m.grounded = true;

    /* Start emerge animation if there's an exit pipe */
    if (emergeSide) {
      emerging = true;
      emergeTimer = 0;
    }

    /* Track which page Mario is on */
    marioPage = getPage();
    updateMarioVisibility();

    /* Scroll so Mario’s exit pipe is visible */
    ci.scrollTop = clamp(m.y - ci.clientHeight / 2, 0, ci.scrollHeight - ci.clientHeight);
    pipeCooldown    = 60;
    victoryCooldown = 60;
  }

  /* ────── victory ────── */

  function checkVictory() {
    if (getPage() !== 'contact' || victory || !flagEl || !canvas) return;
    if (victoryCooldown > 0) return;

    /* Mystery box: Mario must hit it from BELOW (head bonk) */
    const ciRect = ci.getBoundingClientRect();
    const fRect  = flagEl.getBoundingClientRect();
    const boxX   = fRect.left - ciRect.left + ci.scrollLeft;
    const boxY   = fRect.top  - ciRect.top  + ci.scrollTop;
    const boxW   = fRect.width;
    const boxH   = fRect.height;

    /* Mario's head must be rising and hit the bottom of the box */
    if (
      m.vy < 0 &&
      m.y <= boxY + boxH &&
      m.y >= boxY &&
      m.x + MARIO_W > boxX + 4 &&
      m.x < boxX + boxW - 4
    ) {
      victory = true;
      flagEl.classList.add('is-hit');
      m.vy = 2; // bounce Mario down
      showVictory();
    }
  }

  function showVictory() {
    victoryOverlay = document.createElement('div');
    victoryOverlay.className = 'mario-victory-overlay';
    victoryOverlay.innerHTML =
      '<div class="mario-victory-text">Yahoo you found it!<br><small>Opening Resume…</small></div>';
    cl.appendChild(victoryOverlay);
    playSound('victory');
    setTimeout(() => {
      victory = false;
      victoryOverlay?.remove();
      victoryOverlay = null;
      window.open('resume/resume.pdf', '_blank');
    }, 3000);
  }

  /* Lightweight top-of-screen toast (used for intro hint) */
  function showToast(text, duration) {
    const toast = document.createElement('div');
    toast.className = 'mario-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 400);
    }, duration || 3000);
  }

  /* ══════════════════════════════════
     RENDER
     ══════════════════════════════════ */

  function render() {
    if (!canvas || !ctx) return;

    /* reposition pipes */
    positionPipes();

    /* position Mario canvas in world (scroll) space */
    canvas.style.left = m.x + 'px';
    canvas.style.top  = m.y + 'px';

    /* pick frame */
    let frame;
    if (victory)            frame = FRAME.jump;
    else if (!m.grounded)   frame = FRAME.jump;
    else if (Math.abs(m.vx) > 0.3) {
      frame = (Math.floor(tick / 8) % 2 === 0) ? FRAME.idle : FRAME.run;
    } else {
      frame = FRAME.idle;
    }

    /* draw sprite */
    ctx.clearRect(0, 0, MARIO_W, MARIO_H);
    if (!spriteImg.complete) return;

    ctx.imageSmoothingEnabled = true;
    ctx.save();
    if (m.facing === 'left') {
      ctx.scale(-1, 1);
      ctx.drawImage(spriteImg,
        frame.x, frame.y, frame.w, frame.h,
        -MARIO_W, 0, MARIO_W, MARIO_H);
    } else {
      ctx.drawImage(spriteImg,
        frame.x, frame.y, frame.w, frame.h,
        0, 0, MARIO_W, MARIO_H);
    }
    ctx.restore();

    renderGoombas();
  }

  /* ══════════════════════════════════
     GOOMBAS
     ═════════════════════════════════ */

  function rebuildGoombas() {
    goombas.forEach(g => g.canvas?.remove());
    goombas = [];
    if (!ci) return;
    const list = GOOMBA_CONFIG[getPage()] || [];
    const ciRect = ci.getBoundingClientRect();
    for (const cfg of list) {
      const count = cfg.count || 1;
      let anchors;
      if (cfg.groundLevel) {
        anchors = Array(count).fill(null);
      } else if (cfg.all) {
        anchors = Array.from(document.querySelectorAll(cfg.sel));
      } else {
        const one = document.querySelector(cfg.sel);
        if (!one) continue;
        anchors = Array(count).fill(one);
      }

      /* For multi-goomba spawns on the same anchor:
       *   - 50/50 flip decides which one starts going left vs right
       *   - they always go opposite directions (alternate)
       * For single-goomba spawns: independent random direction. */
      const sharedAnchor = anchors.length > 1 && anchors.every(a => a === anchors[0]);
      const flip = Math.random() < 0.5 ? -1 : 1;

      let i = 0;
      for (const el of anchors) {
        const c = document.createElement('canvas');
        c.className = 'mario-goomba';
        c.width  = GOOMBA_W;
        c.height = GOOMBA_H;
        ci.appendChild(c);
        const ctxG = c.getContext('2d');

        let x, y;
        if (el) {
          const aRect = el.getBoundingClientRect();
          const platY = aRect.top  - ciRect.top  + ci.scrollTop;
          const platX = aRect.left - ciRect.left + ci.scrollLeft;
          const platW = Math.max(GOOMBA_W, aRect.width);
          x = platX + Math.random() * (platW - GOOMBA_W);
          y = cfg.bottom
            ? platY + aRect.height - GOOMBA_H
            : platY - GOOMBA_H;
        } else {
          /* ground-level free roam */
          y = getGroundY();
          x = Math.random() * (ci.clientWidth - GOOMBA_W);
        }

        const dir = sharedAnchor
          ? (i % 2 === 0 ? flip : -flip)
          : (Math.random() < 0.5 ? -1 : 1);
        goombas.push({
          canvas: c, ctx: ctxG,
          anchor: el,
          bottom: !!cfg.bottom,
          groundLevel: !!cfg.groundLevel,
          x, y,
          vx: dir * GOOMBA_SPEED,
          dead: false, deadTimer: 0, alive: true,
        });
        i++;
      }
    }
  }

  function updateGoombas() {
    if (getPage() !== marioPage) return;
    const ciRect = ci.getBoundingClientRect();
    const barriers = getBarriers();
    const pipeRects = getPipeWorldRects();

    /* Build solid bounds list for goomba reversal:
     * barriers + pipe bodies (horizontal: bodyX/Y/W/H, vertical: bodyX/W full height) */
    const solids = barriers.slice();
    for (const p of pipeRects) {
      if (p.orient === 'horizontal') {
        solids.push({ x: p.bodyX, y: p.bodyY, w: p.bodyW, h: p.bodyH });
      } else {
        solids.push({ x: p.bodyX, y: p.rimY, w: p.bodyW, h: p.h });
      }
    }

    /* 1) Move each goomba & resolve platform/barrier edges */
    for (const g of goombas) {
      if (!g.alive) continue;
      if (g.dead) {
        g.deadTimer++;
        if (g.deadTimer > 30) {
          g.alive = false;
          if (g.canvas) g.canvas.style.display = 'none';
        }
        continue;
      }

      let platX, platW;
      if (g.anchor) {
        const aRect = g.anchor.getBoundingClientRect();
        const platY = aRect.top  - ciRect.top  + ci.scrollTop;
        platX = aRect.left - ciRect.left + ci.scrollLeft;
        platW = aRect.width;
        g.y = g.bottom
          ? platY + aRect.height - GOOMBA_H
          : platY - GOOMBA_H;
      } else {
        /* groundLevel: patrol the full page floor */
        platX = 0;
        platW = ci.clientWidth;
        g.y = getGroundY();
      }

      g.x += g.vx;
      if (g.x < platX) { g.x = platX; g.vx = Math.abs(g.vx); }
      if (g.x + GOOMBA_W > platX + platW) {
        g.x = platX + platW - GOOMBA_W;
        g.vx = -Math.abs(g.vx);
      }

      /* Reverse on barriers and pipes */
      for (const b of solids) {
        if (g.y + GOOMBA_H <= b.y || g.y >= b.y + b.h) continue;
        if (g.x + GOOMBA_W > b.x && g.x < b.x + b.w) {
          if (g.vx > 0) { g.x = b.x - GOOMBA_W; g.vx = -Math.abs(g.vx); }
          else          { g.x = b.x + b.w;     g.vx =  Math.abs(g.vx); }
        }
      }
    }

    /* 2) Goomba↔goomba collision — both reverse */
    for (let i = 0; i < goombas.length; i++) {
      const a = goombas[i];
      if (!a.alive || a.dead) continue;
      for (let j = i + 1; j < goombas.length; j++) {
        const b = goombas[j];
        if (!b.alive || b.dead) continue;
        if (a.x + GOOMBA_W > b.x && a.x < b.x + GOOMBA_W &&
            a.y + GOOMBA_H > b.y && a.y < b.y + GOOMBA_H) {
          if (a.x < b.x) {
            a.x  = b.x - GOOMBA_W;
            a.vx = -Math.abs(a.vx);
            b.vx =  Math.abs(b.vx);
          } else {
            b.x  = a.x - GOOMBA_W;
            b.vx = -Math.abs(b.vx);
            a.vx =  Math.abs(a.vx);
          }
        }
      }
    }

    /* 3) Mario collisions */
    if (dying) return;
    for (const g of goombas) {
      if (!g.alive || g.dead) continue;
      const overlap =
        m.x + MARIO_W > g.x + 4 &&
        m.x < g.x + GOOMBA_W - 4 &&
        m.y + MARIO_H > g.y + 4 &&
        m.y < g.y + GOOMBA_H - 4;
      if (!overlap) continue;

      /* Stomp: Mario falling AND his feet were above goomba last frame */
      if (m.vy > 0 && m.y + MARIO_H - m.vy <= g.y + 10) {
        g.dead = true;
        g.deadTimer = 0;
        m.vy = JUMP_VEL * 0.55;  // small bounce
        playSound('stomp');
      } else {
        triggerDeath();
        return;
      }
    }
  }

  function renderGoombas() {
    if (getPage() !== marioPage) {
      for (const g of goombas) if (g.canvas) g.canvas.style.display = 'none';
      return;
    }
    for (const g of goombas) {
      if (!g.alive || !g.canvas) continue;
      g.canvas.style.display = '';
      g.canvas.style.left = g.x + 'px';
      g.canvas.style.top  = g.y + 'px';

      if (!goombaImg.complete) continue;
      g.ctx.clearRect(0, 0, GOOMBA_W, GOOMBA_H);

      if (g.dead) {
        const f = GOOMBA_FRAME.dead;
        g.ctx.drawImage(goombaImg, f.x, f.y, f.w, f.h,
          0, GOOMBA_H - GOOMBA_DEAD_H, GOOMBA_W, GOOMBA_DEAD_H);
      } else {
        const f = (Math.floor(tick / 12) % 2 === 0) ? GOOMBA_FRAME.walk1 : GOOMBA_FRAME.walk2;
        const flip = g.vx > 0;
        g.ctx.save();
        if (flip) {
          g.ctx.scale(-1, 1);
          g.ctx.drawImage(goombaImg, f.x, f.y, f.w, f.h, -GOOMBA_W, 0, GOOMBA_W, GOOMBA_H);
        } else {
          g.ctx.drawImage(goombaImg, f.x, f.y, f.w, f.h, 0, 0, GOOMBA_W, GOOMBA_H);
        }
        g.ctx.restore();
      }
    }
  }

  function triggerDeath() {
    if (dying) return;
    dying = true;
    dyingTimer = 0;
    canvas?.classList.add('mario-dying');
    playSound('death');
  }

  function respawnMario() {
    canvas?.classList.remove('mario-dying');
    /* Switch to home page if not there */
    if (getPage() !== 'home' && window.navigateTo) window.navigateTo('home');
    marioPage = 'home';
    rebuildPipes();
    rebuildFlag();
    rebuildGoombas();
    const groundY = getGroundY();
    m.x = ci.clientWidth / 2 - MARIO_W / 2;
    m.y = groundY;
    m.vx = 0; m.vy = 0;
    m.facing = 'right';
    m.grounded = true;
    ci.scrollTop = ci.scrollHeight - ci.clientHeight;
    updateMarioVisibility();
    pipeCooldown    = 30;
    victoryCooldown = 90;
  }

  /* ══════════════════════════════════
     HELPERS
     ═════════════════════════════════ */

  function getPage() {
    return document.querySelector('.page.is-active')?.dataset.page || 'home';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left &&
           a.top  < b.bottom && a.bottom > b.top;
  }

  /* Cached audio pool — drop mp3/wav/ogg files in assets/mario/sounds/ */
  const SOUND_PATH = 'assets/mario/sounds/';
  const SOUND_VOL  = { jump: 0.25, pipe: 0.30, victory: 0.40, stomp: 0.30, death: 0.35 };
  const soundCache = {};
  function playSound(name) {
    try {
      if (!soundCache[name]) {
        const a = new Audio(SOUND_PATH + name + '.mp3');
        a.volume = SOUND_VOL[name] ?? 0.3;
        soundCache[name] = a;
      }
      const s = soundCache[name];
      s.currentTime = 0;
      s.play().catch(() => {});
    } catch (e) {}
  }

  /* ══════════════════════════════════
     BOOT
     ══════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.ctrl.mario-btn')
      ?.addEventListener('click', toggle);
  });

  window.marioGame = { toggle, isActive: () => on, onPageSwitch };
})();
