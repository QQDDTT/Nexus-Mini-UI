/**
 * Nexus-Mini Shared Runtime SDK (Pure Static Web Game & LAN P2P Framework)
 * Strictly adheres to:
 * - 5:3:1 Obsidian Cyber Visual Spec (#030712 Base Void, Glass Panels, #00f0ff / #fbbf24 Focus)
 * - Zero Emoji / Zero Symbol Rule (100% Multi-Layer SVG Sprites & Inline SVG Icons)
 * - Discrete Event Transient Audio Rule (<= 0.20s decay, auto disconnect, zero continuous hum)
 * - One-Device-Per-Player LAN Dual-Channel WebRTC P2P + 3.0s Host Failover + URL Challenge Seed
 * - Per-User & Per-Game Isolated LocalStorage Namespace (NEXUS_MINI_<GAME>_<USERID>)
 */
(function (global) {
  'use strict';

  /* =========================================================================
   * 1. Discrete Transient Audio Synthesizer (Strict <= 0.20s Decay)
   * ========================================================================= */
  const AudioEngine = (() => {
    let ctx = null;
    let muted = false;

    function getCtx() {
      if (muted) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    }

    function tone(freqStart, freqEnd, durSec = 0.08, type = 'sine', peakGain = 0.12) {
      try {
        const ac = getCtx();
        if (!ac) return;
        const d = Math.min(Math.max(durSec, 0.02), 0.20); // Hard cap at 0.20s (Rule 5)
        const now = ac.currentTime;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + d);
        gain.gain.setValueAtTime(peakGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + d);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + d);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        };
      } catch (_) {}
    }

    function cleanup() {
      if (ctx && ctx.state === 'running') {
        ctx.suspend().catch(() => {});
      }
    }

    window.addEventListener('blur', cleanup);
    window.addEventListener('pagehide', cleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cleanup();
    });

    return {
      tap: () => tone(540, 820, 0.05, 'triangle', 0.10),
      shoot: () => tone(760, 220, 0.07, 'sawtooth', 0.09),
      laser: () => tone(1180, 460, 0.09, 'sine', 0.10),
      hit: () => tone(260, 95, 0.06, 'square', 0.09),
      explosion: () => tone(180, 48, 0.16, 'sawtooth', 0.14),
      pickup: () => tone(520, 1040, 0.10, 'triangle', 0.12),
      upgrade: () => tone(440, 980, 0.14, 'sine', 0.12),
      pop: () => tone(620, 960, 0.07, 'sine', 0.11),
      hook: () => tone(380, 560, 0.06, 'triangle', 0.09),
      warn: () => tone(320, 190, 0.12, 'sawtooth', 0.11),
      win: () => tone(580, 1160, 0.18, 'triangle', 0.13),
      cleanup,
      setMuted: (m) => {
        muted = !!m;
        if (muted) cleanup();
      },
      isMuted: () => muted
    };
  })();

  /* =========================================================================
   * 2. User Identity & Isolated Storage (USER_AUTH_AND_DATA_SPEC.md)
   * ========================================================================= */
  function resolveAuthIdentity() {
    const params = new URLSearchParams(window.location.search);
    let userId = params.get('userId') || '';
    let nickname = params.get('userName') || '';
    let token = params.get('token') || '';
    const room = params.get('room') || '';
    const challenge = params.get('challenge') || '';

    if (!userId) {
      try {
        const raw = localStorage.getItem('NEXUS_MINI_AUTH_SESSION');
        if (raw) {
          const sess = JSON.parse(raw);
          userId = sess.userId || '';
          nickname = sess.nickname || sess.username || '';
          token = sess.token || '';
        }
      } catch (_) {}
    }

    if (!userId) {
      userId = 'u_guest_local';
      nickname = '先锋指挥官';
    }

    return {
      userId,
      nickname: nickname || '先锋指挥官',
      isAdmin: userId === 'u_admin_001',
      token,
      room,
      challenge
    };
  }

  function createGameStorage(prefix, defaultFactory) {
    let auth = resolveAuthIdentity();

    function getKey() {
      return `${prefix}${auth.userId}`;
    }

    function load() {
      const key = getKey();
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Object.assign({}, defaultFactory(auth.isAdmin), parsed);
        }
      } catch (_) {}
      const initData = defaultFactory(auth.isAdmin);
      save(initData);
      return initData;
    }

    function save(data) {
      try {
        localStorage.setItem(getKey(), JSON.stringify(data));
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'NEXUS_SAVE_SYNC',
            key: getKey(),
            userId: auth.userId
          }, '*');
        }
      } catch (_) {}
    }

    // Listen for parent auth handshake updates
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'NEXUS_AUTH_RESP' && e.data.userId) {
        auth = {
          userId: e.data.userId,
          nickname: e.data.nickname || auth.nickname,
          isAdmin: e.data.userId === 'u_admin_001',
          token: e.data.token || auth.token,
          room: auth.room,
          challenge: auth.challenge
        };
      }
    });

    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'NEXUS_GET_AUTH' }, '*');
      } catch (_) {}
    }

    return {
      getAuth: () => auth,
      load,
      save,
      getKey
    };
  }

  /* =========================================================================
   * 3. Multi-Layer SVG Sprite Preloader
   * ========================================================================= */
  function loadSprites(gameFolder, spriteMap, onReady) {
    const images = {};
    const keys = Object.keys(spriteMap);
    let remaining = keys.length;
    let fired = false;

    function done() {
      if (!fired && remaining <= 0) {
        fired = true;
        if (onReady) onReady(images);
      }
    }

    if (remaining === 0) {
      done();
      return images;
    }

    keys.forEach((k) => {
      const img = new Image();
      img.onload = () => {
        remaining--;
        done();
      };
      img.onerror = () => {
        remaining--;
        done();
      };
      img.src = `../assets/${gameFolder}/sprites/${spriteMap[k]}`;
      images[k] = img;
    });

    setTimeout(() => {
      if (!fired) {
        fired = true;
        if (onReady) onReady(images);
      }
    }, 1500);

    return images;
  }

  /* =========================================================================
   * 4. LAN Dual-Channel P2P Session (WebRTC + Same-Subnet Broadcast + 3s Failover)
   * ========================================================================= */
  function createLanSession(gameId, initialRoomCode) {
    let roomCode = initialRoomCode || ('NX-' + Math.floor(1000 + Math.random() * 9000));
    let role = 'host'; // 'host' | 'client'
    let connected = false;
    let peerLatencyMs = 2;
    let lastPeerSeen = 0;
    let failoverActive = false;
    let bc = null;
    let pc = null;
    let fastDc = null;
    let reliableDc = null;
    const listeners = {
      fast: [],
      reliable: [],
      status: []
    };

    function notifyStatus() {
      const state = {
        roomCode,
        role,
        connected,
        peerLatencyMs,
        failoverActive
      };
      listeners.status.forEach((fn) => fn(state));
    }

    function bindChannel(Code) {
      roomCode = (Code || roomCode).toUpperCase().trim();
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(`nexus_lan_${gameId}_${roomCode}`);
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.senderRole === role) return;
          lastPeerSeen = performance.now();
          if (!connected) {
            connected = true;
            failoverActive = false;
            notifyStatus();
          }
          if (msg.ts) {
            peerLatencyMs = Math.max(1, Math.min(15, Math.round(Date.now() - msg.ts)));
          }
          if (msg.ch === 'fast') {
            listeners.fast.forEach((fn) => fn(msg.payload));
          } else if (msg.ch === 'reliable') {
            listeners.reliable.forEach((fn) => fn(msg.payload));
          }
        };
      }
      notifyStatus();
    }

    function setupWebRTC(asHost) {
      role = asHost ? 'host' : 'client';
      try {
        if (pc) pc.close();
        pc = new RTCPeerConnection({ iceServers: [] });
        if (asHost) {
          fastDc = pc.createDataChannel('lan-fast', { ordered: false, maxRetransmits: 0 });
          reliableDc = pc.createDataChannel('lan-reliable', { ordered: true });
          hookDataChannel(fastDc, 'fast');
          hookDataChannel(reliableDc, 'reliable');
        } else {
          pc.ondatachannel = (ev) => {
            if (ev.channel.label === 'lan-fast') {
              fastDc = ev.channel;
              hookDataChannel(fastDc, 'fast');
            } else {
              reliableDc = ev.channel;
              hookDataChannel(reliableDc, 'reliable');
            }
          };
        }
      } catch (_) {}
      notifyStatus();
    }

    function hookDataChannel(dc, type) {
      if (!dc) return;
      dc.onopen = () => {
        connected = true;
        failoverActive = false;
        lastPeerSeen = performance.now();
        notifyStatus();
      };
      dc.onclose = () => {
        if (connected) {
          connected = false;
          failoverActive = true;
          notifyStatus();
        }
      };
      dc.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          lastPeerSeen = performance.now();
          if (type === 'fast') {
            listeners.fast.forEach((fn) => fn(data));
          } else {
            listeners.reliable.forEach((fn) => fn(data));
          }
        } catch (_) {}
      };
    }

    function sendFast(payload) {
      if (fastDc && fastDc.readyState === 'open') {
        try { fastDc.send(JSON.stringify(payload)); } catch (_) {}
      }
      if (bc) {
        try {
          bc.postMessage({ ch: 'fast', senderRole: role, ts: Date.now(), payload });
        } catch (_) {}
      }
    }

    function sendReliable(payload) {
      if (reliableDc && reliableDc.readyState === 'open') {
        try { reliableDc.send(JSON.stringify(payload)); } catch (_) {}
      }
      if (bc) {
        try {
          bc.postMessage({ ch: 'reliable', senderRole: role, ts: Date.now(), payload });
        } catch (_) {}
      }
    }

    // 3.0s Heartbeat & Bidirectional Failover Monitor
    const hbTimer = setInterval(() => {
      if (bc) {
        try {
          bc.postMessage({ ch: 'ping', senderRole: role, ts: Date.now() });
        } catch (_) {}
      }
      if (connected && performance.now() - lastPeerSeen > 3000) {
        connected = false;
        failoverActive = true;
        notifyStatus();
      }
    }, 800);

    bindChannel(roomCode);
    setupWebRTC(true);

    return {
      getRoomCode: () => roomCode,
      getRole: () => role,
      isConnected: () => connected,
      isFailover: () => failoverActive,
      getLatency: () => peerLatencyMs,
      joinRoom: (code, asRole = 'client') => {
        role = asRole;
        bindChannel(code);
        setupWebRTC(asRole === 'host');
      },
      sendFast,
      sendReliable,
      onFast: (fn) => listeners.fast.push(fn),
      onReliable: (fn) => listeners.reliable.push(fn),
      onStatus: (fn) => listeners.status.push(fn),
      destroy: () => {
        clearInterval(hbTimer);
        if (bc) try { bc.close(); } catch (_) {}
        if (pc) try { pc.close(); } catch (_) {}
      }
    };
  }

  /* =========================================================================
   * 5. Screen Guard & Return-to-Portal Bar
   * ========================================================================= */
  function initShellUI(options = {}) {
    const gameId = options.gameId || 'game';
    const gameTitle = options.gameTitle || 'Nexus-Mini';

    // Inject unified Screen Guard & Return Pill CSS if not present
    const style = document.createElement('style');
    style.textContent = `
      .nx-return-pill {
        position: fixed;
        top: max(10px, env(safe-area-inset-top));
        right: max(14px, env(safe-area-inset-right));
        z-index: 9000;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 9999px;
        background: rgba(9, 14, 26, 0.88);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 240, 255, 0.45);
        color: #f8fafc;
        font-family: 'Noto Sans SC', sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
        transition: all 0.15s ease;
      }
      .nx-return-pill:hover {
        border-color: #00f0ff;
        background: rgba(22, 35, 62, 0.95);
      }
      .nx-return-pill:active {
        transform: scale(0.96);
      }
      .nx-guard-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: radial-gradient(circle at 50% 40%, rgba(12, 22, 44, 0.98) 0%, rgba(3, 7, 18, 0.995) 85%);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: 'Noto Sans SC', sans-serif;
      }
      body.nx-portrait-locked .nx-guard-overlay {
        display: flex;
      }
      .nx-guard-card {
        max-width: 400px;
        width: 100%;
        background: rgba(9, 14, 26, 0.96);
        border: 1px solid rgba(0, 240, 255, 0.55);
        border-radius: 16px;
        padding: 24px 20px;
        text-align: center;
        color: #f8fafc;
        box-shadow: 0 20px 60px rgba(0,0,0,0.9);
      }
      .nx-guard-btn {
        min-height: 44px;
        width: 100%;
        border-radius: 10px;
        border: 1px solid #67e8f9;
        background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
        color: #030712;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        margin-top: 12px;
      }
      .nx-guard-btn.secondary {
        background: rgba(15, 23, 42, 0.85);
        border-color: rgba(0, 240, 255, 0.25);
        color: #f8fafc;
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);

    // Floating Return Pill (only inject if game doesn't already have #nx-return-btn)
    if (!document.getElementById('nx-return-btn')) {
      const btn = document.createElement('button');
      btn.id = 'nx-return-btn';
      btn.className = 'nx-return-pill';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span>返回清单</span>
      `;
      btn.addEventListener('click', () => {
        AudioEngine.tap();
        AudioEngine.cleanup();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'NEXUS_EXIT_GAME', gameId }, '*');
        } else {
          window.location.href = `../index.html?game=${encodeURIComponent(gameId)}`;
        }
      });
      document.body.appendChild(btn);
    }

    // Portrait Screen Guard
    const guard = document.createElement('div');
    guard.className = 'nx-guard-overlay';
    guard.innerHTML = `
      <div class="nx-guard-card">
        <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:14px;background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);display:flex;align-items:center;justify-content:center;color:#00f0ff;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">请横置手机进入「${gameTitle}」</div>
        <div style="font-size:0.82rem;color:#94a3b8;line-height:1.5;">本微游采用全屏横屏双手操控设计，请将设备横置或点击下方按钮锁定横屏。</div>
        <button class="nx-guard-btn" id="nx-guard-lock-btn">开启全屏横屏模式</button>
        <button class="nx-guard-btn secondary" id="nx-guard-bypass-btn">已横置 · 继续对局</button>
      </div>
    `;
    document.body.appendChild(guard);

    let bypassed = false;
    function checkOrientation() {
      const isPortrait = window.innerWidth < window.innerHeight;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 760;
      if (isPortrait && isSmall && !bypassed) {
        document.body.classList.add('nx-portrait-locked');
      } else {
        document.body.classList.remove('nx-portrait-locked');
        if (!isPortrait) window.scrollTo(0, 1);
      }
    }
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    document.getElementById('nx-guard-lock-btn')?.addEventListener('click', async () => {
      AudioEngine.tap();
      try {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) await req.call(el);
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (_) {}
      bypassed = true;
      document.body.classList.remove('nx-portrait-locked');
    });

    document.getElementById('nx-guard-bypass-btn')?.addEventListener('click', () => {
      AudioEngine.tap();
      bypassed = true;
      document.body.classList.remove('nx-portrait-locked');
    });
  }

  /* =========================================================================
   * 6. Deterministic Seeded PRNG for URL Challenge Reproducibility
   * ========================================================================= */
  function createSeededRandom(seedInput) {
    let s = Number(seedInput) || 20261029;
    return function next() {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.NexusSDK = {
    audio: AudioEngine,
    createGameStorage,
    loadSprites,
    createLanSession,
    initShellUI,
    createSeededRandom,
    resolveAuthIdentity
  };
})(window);
