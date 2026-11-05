/**
 * Nexus-Mini Shared Runtime SDK v4.0 (Three-Tier Architecture & Zero Remote Communication)
 * Strictly adheres to:
 * - Zero Runtime Remote Communication: Pure Client-Side Local Standalone + LAN P2P (1~5ms WebRTC Dual-Channel)
 * - Standardized Three-Tier Website Architecture:
 *     Tier 1: Portal Homepage (Game Roster, Rules Overview, Gameplay Screenshots)
 *     Tier 2: Game Menu Hub (6 Standardized Modules: ①游戏主页 ②游戏详情 ③游戏设置 ④游戏资材管理 ⑤游戏服务管理 ⑥局域网资源管理)
 *     Tier 3: Gameplay Scene (Pure Real-Time Combat Canvas + Minimal HUD + Touch Controls, Top-Right returns to Tier 2)
 * - 5:3:1 Chroma-Muse Multi-Genre Visual Spec & Zero Emoji / Zero Symbol Rule
 * - Discrete Event Transient Audio Rule (<= 0.20s decay, auto disconnect, zero continuous hum)
 */
(function (global) {
  'use strict';

  /* =========================================================================
   * 1. Discrete Transient Audio Synthesizer (Strict <= 0.20s Decay)
   * ========================================================================= */
  const AudioEngine = (() => {
    let ctx = null;
    let muted = false;
    let volumeScale = 1.0;

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
        gain.gain.setValueAtTime(Math.max(0.001, peakGain * volumeScale), now);
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

    function resetContext() {
      try {
        if (ctx) ctx.close().catch(() => {});
      } catch (_) {}
      ctx = null;
      getCtx();
      tone(580, 960, 0.08, 'triangle', 0.12);
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
      resetContext,
      setMuted: (m) => {
        muted = !!m;
        if (muted) cleanup();
      },
      isMuted: () => muted,
      setVolume: (v) => {
        volumeScale = Math.max(0.1, Math.min(1.5, Number(v) || 1.0));
      },
      getVolume: () => volumeScale,
      getState: () => (ctx ? ctx.state : 'uninitialized')
    };
  })();

  /* =========================================================================
   * 2. User Identity & Isolated Local Storage (USER_AUTH_AND_DATA_SPEC.md)
   * ========================================================================= */
  let activeStoreInstance = null;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeSafeId(str, maxLen = 32) {
    return String(str ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
  }

  function resolveAuthIdentity() {
    const params = new URLSearchParams(window.location.search);
    let userId = sanitizeSafeId(params.get('userId') || '', 32);
    let nickname = String(params.get('userName') || '').replace(/[<>'"&]/g, '').slice(0, 24);
    let token = sanitizeSafeId(params.get('token') || '', 64);
    const room = sanitizeSafeId(params.get('room') || '', 16);
    const challenge = sanitizeSafeId(params.get('challenge') || '', 32);

    try {
      const raw = localStorage.getItem('NEXUS_MINI_AUTH_SESSION');
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess && sess.userId) {
          userId = sanitizeSafeId(sess.userId, 32);
          nickname = String(sess.nickname || sess.username || nickname).replace(/[<>'"&]/g, '').slice(0, 24);
          token = sanitizeSafeId(sess.token || token, 64);
        }
      }
    } catch (_) {}

    if (!userId) {
      userId = 'u_commander_01'; // 与门户默认会话、资材管理「普通玩家档」保持同一身份
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

    function switchProfile(targetMode) {
      if (targetMode === 'admin') {
        auth = {
          userId: 'u_admin_001',
          nickname: '最高统帅 · 管理员',
          isAdmin: true,
          token: auth.token || 'adm_local',
          room: auth.room,
          challenge: auth.challenge
        };
      } else {
        auth = {
          userId: 'u_commander_01',
          nickname: '先锋指挥官',
          isAdmin: false,
          token: auth.token || 'cmd_local',
          room: auth.room,
          challenge: auth.challenge
        };
      }
      try {
        localStorage.setItem('NEXUS_MINI_AUTH_SESSION', JSON.stringify(auth));
      } catch (_) {}
      return load();
    }

    window.addEventListener('message', (e) => {
      if (e.origin && e.origin !== window.location.origin && e.origin !== 'null') return;
      if (e.data && e.data.type === 'NEXUS_AUTH_RESP' && typeof e.data.userId === 'string') {
        const cleanId = e.data.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'u_commander_01';
        auth = {
          userId: cleanId,
          nickname: String(e.data.nickname || auth.nickname).replace(/[<>'"&]/g, '').slice(0, 24),
          isAdmin: cleanId === 'u_admin_001',
          token: String(e.data.token || auth.token).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
          room: auth.room,
          challenge: auth.challenge
        };
      }
    });

    if (window.parent && window.parent !== window) {
      try {
        const targetOrigin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '*';
        window.parent.postMessage({ type: 'NEXUS_GET_AUTH' }, targetOrigin);
      } catch (_) {}
    }

    const inst = {
      getAuth: () => auth,
      load,
      save,
      getKey,
      switchProfile,
      resetDefault: () => {
        const fresh = defaultFactory(auth.isAdmin);
        save(fresh);
        return fresh;
      }
    };
    activeStoreInstance = inst;
    return inst;
  }

  /* =========================================================================
   * 3. Multi-Layer SVG Sprite Preloader (With Offscreen Bitmap Pre-Rasterization)
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
        try {
          const bmp = document.createElement('canvas');
          const w = Math.max(128, Math.min(256, img.naturalWidth || 128));
          const h = Math.max(128, Math.min(256, img.naturalHeight || 128));
          bmp.width = w;
          bmp.height = h;
          const bctx = bmp.getContext('2d');
          bctx.drawImage(img, 0, 0, w, h);
          bmp.complete = true;
          bmp.naturalWidth = w;
          bmp.naturalHeight = h;
          images[k] = bmp;
        } catch (_) {
          images[k] = img;
        }
        remaining--;
        done();
      };
      img.onerror = () => {
        remaining--;
        done();
      };
      img.src = `../assets/${gameFolder}/sprites/${spriteMap[k]}?v=20261031`;
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
   * 4. LAN Dual-Channel P2P Session & Room List Discovery
   *    —— 零假数据：房间列表仅来自真实房主信标；连接状态仅由真实握手确认；
   *       延迟仅来自真实 ping→pong 往返 RTT；WebRTC 走真实 SDP Offer/Answer。
   *    传输层：
   *      ① 同设备多标签页：BroadcastChannel 作为信令通道，自动交换 SDP 建立真实 RTCDataChannel；
   *      ② 跨设备（同 Wi-Fi / 手机热点）：离线 SDP 握手码（房主生成邀请码 → 客机生成应答码 → 房主粘贴应答码）。
   * ========================================================================= */
  let activeLanInstance = null;
  const LAN_BEACON_TTL_MS = 5000;     // 房主信标存活时长（信标每 1s 刷新一次）
  const LAN_JOIN_TIMEOUT_MS = 4000;   // 加入握手超时
  const LAN_PEER_TIMEOUT_MS = 3000;   // 对端心跳超时 → 断线（触发 AI 接管）
  const LAN_ICE_GATHER_MS = 2500;     // 离线握手码 ICE 收集上限

  function encodeLanCode(obj) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch (_) { return ''; }
  }
  function decodeLanCode(code) {
    try { return JSON.parse(decodeURIComponent(escape(atob(String(code || '').replace(/\s+/g, ''))))); } catch (_) { return null; }
  }
  function waitIceComplete(pc) {
    return new Promise((resolve) => {
      if (!pc || pc.iceGatheringState === 'complete') return resolve();
      const timer = setTimeout(resolve, LAN_ICE_GATHER_MS);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
      });
    });
  }

  function createLanSession(gameId, initialRoomCode) {
    const cleanGameId = gameId || 'star-defender';
    // 同一页面同一游戏仅保留一个会话单例（杜绝多套大厅各自广播不同房间号）
    if (activeLanInstance && !activeLanInstance.__destroyed && activeLanInstance.__gameId === cleanGameId) {
      return activeLanInstance;
    }
    const prefix = cleanGameId === 'tank-battle' ? 'TB-'
      : cleanGameId === 'star-defender' ? 'SD-'
      : cleanGameId === 'gold-miner' ? 'GM-'
      : cleanGameId === 'pudding-defense' ? 'PD-'
      : cleanGameId === 'micro-genesis' ? 'MG-' : 'NX-';
    const genCode = () => prefix + Math.floor(100 + Math.random() * 900);
    const selfId = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const registryKey = `NEXUS_LAN_ROOMS_${cleanGameId}`;

    let roomCode = sanitizeSafeId(String(initialRoomCode || '').toUpperCase().trim(), 16) || genCode();
    let role = 'host';              // 'host' | 'client'
    let connState = 'hosting';      // 'hosting' | 'connecting' | 'connected' | 'disconnected' | 'failed'
    let connected = false;
    let peerId = null;
    let peerName = '';
    let peerLatencyMs = null;       // 未实测时为 null（UI 显示 “-- ms”），严禁默认假值
    let lastPeerSeen = 0;
    let failoverActive = false;
    let autoAiTakeover = true;
    let lastError = '';
    let transport = 'none';         // 'none' | 'broadcast' | 'webrtc'
    let joinTimer = null;
    let destroyed = false;
    let bc = null;
    let lobbyBc = null;
    let pc = null;
    let fastDc = null;
    let reliableDc = null;
    let offlineMode = false;        // 当前 RTCPeerConnection 是否由离线握手码建立
    let pingSeq = 0;
    const discoveredPeerRooms = new Map();
    const listeners = { fast: [], reliable: [], status: [], rooms: [] };

    function getAuthSafe() {
      try {
        return activeStoreInstance ? activeStoreInstance.getAuth() : resolveAuthIdentity();
      } catch (_) {
        return { nickname: '本地指挥官', userId: 'local' };
      }
    }

    /* ---------- 房间注册表（localStorage）与大厅信标（BroadcastChannel） ---------- */
    function readRegistry() {
      try {
        const raw = localStorage.getItem(registryKey);
        return raw ? (JSON.parse(raw) || {}) : {};
      } catch (_) { return {}; }
    }
    function writeRegistry(mapObj) {
      try { localStorage.setItem(registryKey, JSON.stringify(mapObj)); } catch (_) {}
    }
    function unpublishHostRoom(code) {
      const target = code || roomCode;
      const mapObj = readRegistry();
      if (mapObj[target] && mapObj[target].hostId === selfId) {
        delete mapObj[target];
        writeRegistry(mapObj);
      }
      discoveredPeerRooms.delete(target);
      if (lobbyBc) {
        try { lobbyBc.postMessage({ type: 'ROOM_CLOSED', roomCode: target, hostId: selfId }); } catch (_) {}
      }
    }
    function publishHostRoomBeacon() {
      if (role !== 'host' || destroyed) return;
      const auth = getAuthSafe();
      const meta = GAME_META_DB[cleanGameId];
      const beacon = {
        roomCode,
        hostId: selfId,
        title: `${auth.nickname || '指挥官'} 的局域网房间`,
        hostName: auth.nickname || '房主指挥官',
        modeName: meta?.modes?.[1]?.name || '局域网协同联机',
        players: connected ? '2/2' : '1/2',
        updatedAt: Date.now()
      };
      const mapObj = readRegistry();
      const now = Date.now();
      Object.keys(mapObj).forEach((k) => {
        const r = mapObj[k];
        if (!r || now - (r.updatedAt || 0) > LAN_BEACON_TTL_MS || (r.hostId === selfId && k !== roomCode)) delete mapObj[k];
      });
      mapObj[roomCode] = beacon;
      writeRegistry(mapObj);
      if (lobbyBc) {
        try { lobbyBc.postMessage({ type: 'ROOM_BEACON', beacon }); } catch (_) {}
      }
    }

    function getAvailableRooms() {
      const now = Date.now();
      const mapObj = readRegistry();
      Object.values(mapObj).forEach((r) => {
        if (r && r.roomCode && r.hostId && now - (r.updatedAt || 0) <= LAN_BEACON_TTL_MS) {
          discoveredPeerRooms.set(r.roomCode, r);
        }
      });
      const list = [];
      discoveredPeerRooms.forEach((r, code) => {
        if (now - (r.updatedAt || 0) > LAN_BEACON_TTL_MS) {
          discoveredPeerRooms.delete(code);
          return;
        }
        const isSelfHost = r.hostId === selfId;
        if (isSelfHost && (role !== 'host' || code !== roomCode)) return; // 本机已离开的旧房绝不展示
        const isCurrentJoined = role === 'client' && connected && code === roomCode;
        list.push({
          roomCode: r.roomCode,
          title: r.title,
          hostName: r.hostName,
          modeName: r.modeName,
          players: isCurrentJoined ? '2/2' : (r.players || '1/2'),
          rttMs: (isCurrentJoined || (isSelfHost && connected)) ? peerLatencyMs : null,
          isSelfHost,
          isCurrentJoined,
          isConnecting: role === 'client' && connState === 'connecting' && code === roomCode
        });
      });
      // 本机房间置顶，其余按房间号排序
      list.sort((a, b) => (b.isSelfHost - a.isSelfHost) || String(a.roomCode).localeCompare(String(b.roomCode)));
      return list;
    }

    function notifyRooms() {
      const rooms = getAvailableRooms();
      listeners.rooms.forEach((fn) => { try { fn(rooms); } catch (_) {} });
    }

    function refreshRooms() {
      publishHostRoomBeacon();
      if (lobbyBc) {
        try { lobbyBc.postMessage({ type: 'DISCOVER_ROOMS', ts: Date.now() }); } catch (_) {}
      }
      notifyRooms();
      return getAvailableRooms();
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        lobbyBc = new BroadcastChannel(`nexus_lan_lobby_${cleanGameId}`);
        lobbyBc.onmessage = (ev) => {
          const data = ev.data;
          if (!data) return;
          if (data.type === 'ROOM_BEACON' && data.beacon?.roomCode && data.beacon.hostId) {
            discoveredPeerRooms.set(data.beacon.roomCode, { ...data.beacon, updatedAt: Date.now() });
            notifyRooms();
          } else if (data.type === 'ROOM_CLOSED' && data.roomCode) {
            const r = discoveredPeerRooms.get(data.roomCode);
            if (r && r.hostId === data.hostId) discoveredPeerRooms.delete(data.roomCode);
            notifyRooms();
          } else if (data.type === 'DISCOVER_ROOMS' && role === 'host') {
            publishHostRoomBeacon();
          }
        };
      } catch (_) {}
    }

    function getStatus() {
      return {
        roomCode, role, connState, connected, peerLatencyMs, failoverActive,
        autoAiTakeover, transport, lastError, peerName, offlineMode
      };
    }
    function notifyStatus() {
      const state = getStatus();
      listeners.status.forEach((fn) => { try { fn(state); } catch (_) {} });
      notifyRooms();
    }

    /* ---------- 房间信令通道（同设备 BroadcastChannel） ---------- */
    function postSignal(msg) {
      if (!bc) return;
      try { bc.postMessage({ ...msg, from: selfId, ts: msg.ts || Date.now() }); } catch (_) {}
    }

    function markPeerAlive() {
      lastPeerSeen = performance.now();
    }

    function setConnected(nextPeerId, viaTransport) {
      const wasConnected = connected;
      connected = true;
      connState = 'connected';
      failoverActive = false;
      lastError = '';
      if (nextPeerId) peerId = nextPeerId;
      if (viaTransport) transport = viaTransport;
      markPeerAlive();
      if (!wasConnected) {
        publishHostRoomBeacon();
        sendPing();
      }
      notifyStatus();
    }

    function handlePeerLost(reason) {
      if (!connected && connState !== 'connecting') return;
      connected = false;
      peerId = null;
      peerLatencyMs = null;
      transport = 'none';
      failoverActive = autoAiTakeover;
      lastError = reason || '对端心跳超时';
      closePeerConnection();
      if (role === 'client') {
        // 客机失去房主：退回本机房主身份，以新房间号继续广播
        role = 'host';
        connState = 'disconnected';
        bindChannel(genCode());
      } else {
        connState = 'disconnected';
        publishHostRoomBeacon();
      }
      notifyStatus();
    }

    function deliverPayload(ch, payload) {
      const arr = ch === 'fast' ? listeners.fast : listeners.reliable;
      arr.forEach((fn) => { try { fn(payload); } catch (_) {} });
    }

    function handleControl(msg, viaTransport) {
      if (!msg || typeof msg !== 'object') return;
      // 仅接受当前配对对端的消息（握手阶段例外）
      switch (msg.t) {
        case 'ping':
          if (connected && (!msg.from || msg.from === peerId || viaTransport === 'webrtc')) {
            markPeerAlive();
            sendControl({ t: 'pong', seq: msg.seq, echoTs: msg.sentAt });
          }
          return;
        case 'pong':
          if (connected && Number.isFinite(msg.echoTs)) {
            markPeerAlive();
            peerLatencyMs = Math.max(0, Math.round(Date.now() - msg.echoTs)); // 真实往返 RTT
            notifyStatus();
          }
          return;
        case 'data':
          if (connected) {
            markPeerAlive();
            deliverPayload(msg.ch, msg.payload);
          }
          return;
        case 'bye':
          if (connected && (!msg.from || msg.from === peerId || viaTransport === 'webrtc')) handlePeerLost('对端已离开房间');
          return;
        default:
      }
    }

    function sendControl(msg) {
      const packet = { ...msg, from: selfId, to: peerId };
      if (reliableDc && reliableDc.readyState === 'open') {
        try { reliableDc.send(JSON.stringify(packet)); return; } catch (_) {}
      }
      postSignal(packet);
    }

    function sendPing() {
      if (!connected) return;
      pingSeq += 1;
      sendControl({ t: 'ping', seq: pingSeq, sentAt: Date.now() });
    }

    function onRoomSignal(ev) {
      const msg = ev.data;
      if (!msg || msg.from === selfId) return;
      if (msg.to && msg.to !== selfId) return;

      if (msg.t === 'join_req' && role === 'host') {
        if (connected && peerId && peerId !== msg.from) {
          postSignal({ t: 'join_reject', to: msg.from, reason: '房间已满 (2/2)' });
          return;
        }
        peerName = String(msg.name || '客机').slice(0, 24);
        postSignal({ t: 'join_ack', to: msg.from, hostName: getAuthSafe().nickname || '房主' });
        peerId = msg.from;
        setConnected(msg.from, 'broadcast');
        startAutoWebRtcOffer();
        return;
      }
      if (msg.t === 'join_ack' && role === 'client' && connState === 'connecting') {
        clearTimeout(joinTimer);
        peerName = String(msg.hostName || '房主').slice(0, 24);
        setConnected(msg.from, 'broadcast');
        return;
      }
      if (msg.t === 'join_reject' && role === 'client' && connState === 'connecting') {
        clearTimeout(joinTimer);
        failJoin(msg.reason || '房主拒绝加入');
        return;
      }
      if (msg.t === 'sdp_offer' && role === 'client' && msg.from === peerId) {
        acceptAutoOffer(msg.sdp);
        return;
      }
      if (msg.t === 'sdp_answer' && role === 'host' && msg.from === peerId && pc && !offlineMode) {
        pc.setRemoteDescription(msg.sdp).catch(() => {});
        return;
      }
      if (msg.t === 'ice' && msg.from === peerId && pc && msg.candidate && !offlineMode) {
        pc.addIceCandidate(msg.candidate).catch(() => {});
        return;
      }
      if (peerId && msg.from !== peerId && msg.t !== 'ping') return;
      handleControl(msg, 'broadcast');
    }

    function bindChannel(code) {
      const cleanCode = sanitizeSafeId(String(code || roomCode).toUpperCase().trim(), 16) || genCode();
      if (role === 'host' && cleanCode !== roomCode) unpublishHostRoom(roomCode);
      roomCode = cleanCode;
      if (bc) {
        try { bc.close(); } catch (_) {}
        bc = null;
      }
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          bc = new BroadcastChannel(`nexus_lan_${cleanGameId}_${roomCode}`);
          bc.onmessage = onRoomSignal;
        } catch (_) { bc = null; }
      }
      publishHostRoomBeacon();
    }

    /* ---------- 真实 WebRTC：DataChannel 与 SDP ---------- */
    function closePeerConnection() {
      try { if (fastDc) fastDc.close(); } catch (_) {}
      try { if (reliableDc) reliableDc.close(); } catch (_) {}
      try { if (pc) pc.close(); } catch (_) {}
      pc = null; fastDc = null; reliableDc = null;
      offlineMode = false;
    }

    function hookDataChannel(dc, type) {
      if (!dc) return;
      dc.onopen = () => {
        if (type === 'reliable') setConnected(peerId || 'webrtc-peer', 'webrtc');
      };
      dc.onclose = () => {
        if (type === 'reliable' && connected && transport === 'webrtc') {
          if (offlineMode) handlePeerLost('WebRTC 通道已关闭');
          else { transport = 'broadcast'; notifyStatus(); }
        }
      };
      dc.onmessage = (ev) => {
        let data = null;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        markPeerAlive();
        if (data && data.t) handleControl(data, 'webrtc');
      };
    }

    function newPeerConnection(asHost) {
      closePeerConnection();
      if (typeof RTCPeerConnection === 'undefined') return null;
      // 零公网：不配置任何 STUN/TURN，仅使用局域网 host 候选
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
      pc.onconnectionstatechange = () => {
        if (pc && (pc.connectionState === 'failed') && offlineMode) {
          lastError = 'WebRTC 打洞失败（请确认两台设备处于同一 Wi-Fi / 热点）';
          notifyStatus();
        }
      };
      return pc;
    }

    // 同设备：房主经 BroadcastChannel 信令自动发起 SDP Offer
    async function startAutoWebRtcOffer() {
      try {
        const conn = newPeerConnection(true);
        if (!conn) return;
        conn.onicecandidate = (e) => { if (e.candidate) postSignal({ t: 'ice', to: peerId, candidate: e.candidate.toJSON() }); };
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        postSignal({ t: 'sdp_offer', to: peerId, sdp: { type: offer.type, sdp: offer.sdp } });
      } catch (_) {}
    }
    async function acceptAutoOffer(sdp) {
      try {
        const conn = newPeerConnection(false);
        if (!conn) return;
        conn.onicecandidate = (e) => { if (e.candidate) postSignal({ t: 'ice', to: peerId, candidate: e.candidate.toJSON() }); };
        await conn.setRemoteDescription(sdp);
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        postSignal({ t: 'sdp_answer', to: peerId, sdp: { type: answer.type, sdp: answer.sdp } });
      } catch (_) {}
    }

    // 跨设备离线握手码 ①：房主生成邀请码
    async function createOfflineOffer() {
      if (connected) throw new Error('当前已连接对端，请先断开');
      if (role !== 'host') { role = 'host'; bindChannel(genCode()); }
      const conn = newPeerConnection(true);
      if (!conn) throw new Error('当前浏览器不支持 WebRTC');
      offlineMode = true;
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await waitIceComplete(conn);
      connState = 'hosting';
      lastError = '';
      notifyStatus();
      return encodeLanCode({ v: 1, k: 'offer', g: cleanGameId, r: roomCode, n: getAuthSafe().nickname || '房主', sdp: conn.localDescription.sdp });
    }
    // 跨设备离线握手码 ②：客机粘贴邀请码 → 生成应答码
    async function acceptOfflineOffer(code) {
      const data = decodeLanCode(code);
      if (!data || data.k !== 'offer' || !data.sdp) throw new Error('邀请码格式无效');
      if (data.g !== cleanGameId) throw new Error('邀请码不属于本游戏');
      if (role === 'host') unpublishHostRoom(roomCode);
      role = 'client';
      roomCode = sanitizeSafeId(String(data.r || '').toUpperCase(), 16) || genCode();
      peerName = String(data.n || '房主').slice(0, 24);
      peerId = 'offline-host';
      const conn = newPeerConnection(false);
      if (!conn) throw new Error('当前浏览器不支持 WebRTC');
      offlineMode = true;
      await conn.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      await waitIceComplete(conn);
      connState = 'connecting';
      lastError = '';
      notifyStatus();
      return encodeLanCode({ v: 1, k: 'answer', g: cleanGameId, r: roomCode, n: getAuthSafe().nickname || '客机', sdp: conn.localDescription.sdp });
    }
    // 跨设备离线握手码 ③：房主粘贴应答码 → DataChannel 打开后才视为已连接
    async function acceptOfflineAnswer(code) {
      const data = decodeLanCode(code);
      if (!data || data.k !== 'answer' || !data.sdp) throw new Error('应答码格式无效');
      if (!pc || !offlineMode || role !== 'host') throw new Error('请先生成邀请码');
      peerName = String(data.n || '客机').slice(0, 24);
      peerId = 'offline-client';
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      connState = 'connecting';
      notifyStatus();
    }

    /* ---------- 加入 / 建房 ---------- */
    function failJoin(reason) {
      lastError = reason;
      connected = false;
      peerId = null;
      peerLatencyMs = null;
      transport = 'none';
      closePeerConnection();
      role = 'host';
      connState = 'failed';
      bindChannel(genCode());
      notifyStatus();
    }

    function leaveCurrent() {
      clearTimeout(joinTimer);
      if (connected) sendControl({ t: 'bye' });
      if (role === 'host') unpublishHostRoom(roomCode);
      connected = false;
      peerId = null;
      peerLatencyMs = null;
      transport = 'none';
      failoverActive = false;
      peerName = '';
      closePeerConnection();
    }

    function joinRoom(code, asRole = 'client') {
      const target = sanitizeSafeId(String(code || '').toUpperCase().trim(), 16);
      if (!target) return;
      leaveCurrent();
      lastError = '';
      if (asRole === 'host') {
        role = 'host';
        connState = 'hosting';
        bindChannel(target);
        notifyStatus();
        return;
      }
      role = 'client';
      connState = 'connecting';
      bindChannel(target);
      notifyStatus();
      // 真实握手：向房主发送加入请求，收到 join_ack 才判定连接成功
      postSignal({ t: 'join_req', name: getAuthSafe().nickname || '客机' });
      joinTimer = setTimeout(() => {
        if (connState === 'connecting' && role === 'client') failJoin(`房间 ${target} 无房主应答（${LAN_JOIN_TIMEOUT_MS / 1000}s 超时）`);
      }, LAN_JOIN_TIMEOUT_MS);
    }

    function sendFast(payload) {
      if (!connected) return;
      const packet = { t: 'data', ch: 'fast', payload, from: selfId, to: peerId };
      if (fastDc && fastDc.readyState === 'open') {
        try { fastDc.send(JSON.stringify(packet)); return; } catch (_) {}
      }
      postSignal(packet);
    }

    function sendReliable(payload) {
      if (!connected) return;
      const packet = { t: 'data', ch: 'reliable', payload, from: selfId, to: peerId };
      if (reliableDc && reliableDc.readyState === 'open') {
        try { reliableDc.send(JSON.stringify(packet)); return; } catch (_) {}
      }
      postSignal(packet);
    }

    const hbTimer = setInterval(() => {
      if (destroyed) return;
      if (role === 'host') publishHostRoomBeacon();
      if (connected) {
        sendPing();
        if (performance.now() - lastPeerSeen > LAN_PEER_TIMEOUT_MS) handlePeerLost('对端心跳超时 (3.0s)');
      }
    }, 1000);

    const onUnload = () => {
      try { if (connected) sendControl({ t: 'bye' }); } catch (_) {}
      unpublishHostRoom(roomCode);
    };
    window.addEventListener('pagehide', onUnload);

    bindChannel(roomCode);

    const session = {
      __gameId: cleanGameId,
      __destroyed: false,
      getRoomCode: () => roomCode,
      getRole: () => role,
      getConnState: () => connState,
      getStatus,
      isConnected: () => connected,
      isFailover: () => failoverActive,
      getLatency: () => peerLatencyMs,
      getLastError: () => lastError,
      setAutoAiTakeover: (v) => {
        autoAiTakeover = !!v;
        notifyStatus();
      },
      getAutoAiTakeover: () => autoAiTakeover,
      getAvailableRooms,
      refreshRooms,
      joinRoom,
      leave: () => { leaveCurrent(); role = 'host'; connState = 'hosting'; bindChannel(genCode()); notifyStatus(); },
      createOfflineOffer,
      acceptOfflineOffer,
      acceptOfflineAnswer,
      sendFast,
      sendReliable,
      onFast: (fn) => listeners.fast.push(fn),
      onReliable: (fn) => listeners.reliable.push(fn),
      onStatus: (fn) => listeners.status.push(fn),
      onRooms: (fn) => listeners.rooms.push(fn),
      destroy: () => {
        destroyed = true;
        session.__destroyed = true;
        clearInterval(hbTimer);
        clearTimeout(joinTimer);
        onUnload();
        window.removeEventListener('pagehide', onUnload);
        if (bc) try { bc.close(); } catch (_) {}
        if (lobbyBc) try { lobbyBc.close(); } catch (_) {}
        closePeerConnection();
        if (activeLanInstance === session) activeLanInstance = null;
      }
    };
    activeLanInstance = session;
    return session;
  }

  /* =========================================================================
   * 5. Game Metadata Registry for Tier 2 (6-Module Game Menu Hub)
   * ========================================================================= */
  const GAME_META_DB = {
    'star-defender': {
      id: 'star-defender',
      name: '星轨防线',
      en: 'STAR DEFENDER',
      styleCode: 'STYLE-61+154+73 · 大明火黑珐琅与铁陨石螺钿星盘',
      storagePrefix: 'NEXUS_MINI_SD_',
      icon: '../assets/star-defender/icon.svg',
      preview: '../assets/star-defender/preview.png',
      tagline: '360° 轨道拦截 · 赫利俄斯/格拉基斯双阵营 8 大主力星舰 · 12 模组与 6 大虚空虫群战役',
      modes: [
        { id: 'solo-campaign', name: '单机百波战役', desc: '本地 60Hz 确定性牛顿物理与正交火控解算，AI 护航僚机全程协同守卫星轨核心站' },
        { id: 'lan-coop', name: '局域网双舰护航', desc: '同 Wi-Fi / 手机热点 WebRTC 双通道直连，双机集火深渊虚空利维坦 Boss' }
      ],
      starRosterUnits: [
        { no: 'HL-01', cat: 'hull', faction: 'helios', hullKey: 'hullDelta', badge: '14格·120MW', file: 'hull-delta.svg', name: 'Delta 截击舰', weight: 'TWR 1.92·S', fullTitle: '赫利俄斯 Delta 级高速三角截击舰', subCode: 'NASA 白瓷热防护瓦 + 24K 聚酰亚胺金箔舱 + 双矢量尾喷', zoneSpec: 'W:2S+1M | B:2×1格 | P:2×S', armorVal: '420 HP', armorPct: 62, velVal: '540 m/s', velPct: 96, pwrVal: '120 MW', pwrPct: 75 },
        { no: 'HL-02', cat: 'hull', faction: 'helios', hullKey: 'hullWing', badge: '22格·185MW', file: 'hull-wing.svg', name: 'Wing 巡洋舰', weight: 'TWR 1.48·A', fullTitle: '赫利俄斯 Wing 级前掠翼多挂点战术巡洋舰', subCode: '重型钛合金前掠翼梁 + 四联导弹垂发井 + 双核反应堆', zoneSpec: 'W:2S+2M | B:3×1格 | P:2×M', armorVal: '680 HP', armorPct: 78, velVal: '430 m/s', velPct: 82, pwrVal: '185 MW', pwrPct: 84 },
        { no: 'HL-03', cat: 'hull', faction: 'helios', hullKey: 'hullRing', badge: '28格·260MW', file: 'hull-ring.svg', name: 'Ring 环轨舰', weight: 'TWR 1.22·B', fullTitle: '赫利俄斯 Ring 级磁约束环状护盾母舰', subCode: '360° 环形托卡马克聚变线圈 + 金箔辐射散热翼 + 无人机母舱', zoneSpec: 'W:2M+1L | B:4×1格 | P:2×M', armorVal: '920 HP', armorPct: 90, velVal: '360 m/s', velPct: 68, pwrVal: '260 MW', pwrPct: 94 },
        { no: 'HL-04', cat: 'hull', faction: 'helios', hullKey: 'hullCross', badge: '36格·340MW', file: 'hull-cross.svg', name: 'Cross 歼星舰', weight: 'TWR 1.08·B', fullTitle: '赫利俄斯 Cross 级重装十字无畏歼星旗舰', subCode: '四象限重型装甲翼 + 轴向磁轨主炮槽 + 四联霍尔等离子推进阵', zoneSpec: 'W:2M+2L | B:4×1格 | P:3×L', armorVal: '1350 HP', armorPct: 100, velVal: '310 m/s', velPct: 58, pwrVal: '340 MW', pwrPct: 100 },
        { no: 'GL-01', cat: 'hull', faction: 'glacies', hullKey: 'hullDelta', badge: '14格·135MW', file: 'hull-delta-glacies.svg', name: '霜刃 Delta 舰', weight: 'TWR 1.98·S', fullTitle: '格拉基斯 Delta 级深冷碳纤超导截击舰', subCode: '2x2 斜纹凝霜碳纤维 + 蓝宝石光学导流罩 + 切伦科夫冷离子推进', zoneSpec: 'W:2S+1M | B:2×1格 | P:2×S', armorVal: '390 HP', armorPct: 58, velVal: '565 m/s', velPct: 99, pwrVal: '135 MW', pwrPct: 80 },
        { no: 'GL-02', cat: 'hull', faction: 'glacies', hullKey: 'hullWing', badge: '22格·200MW', file: 'hull-wing-glacies.svg', name: '寒翼 Wing 舰', weight: 'TWR 1.54·A', fullTitle: '格拉基斯 Wing 级液氮超导前掠翼科研巡洋舰', subCode: '深海蓝宝石棱镜阵列 + 零电阻超导电容舱 + 极光矢量翼', zoneSpec: 'W:2S+2M | B:3×1格 | P:2×M', armorVal: '640 HP', armorPct: 74, velVal: '450 m/s', velPct: 86, pwrVal: '200 MW', pwrPct: 88 },
        { no: 'GL-03', cat: 'hull', faction: 'glacies', hullKey: 'hullRing', badge: '28格·285MW', file: 'hull-ring-glacies.svg', name: '极光 Ring 舰', weight: 'TWR 1.28·A', fullTitle: '格拉基斯 Ring 级量子纠缠环轨力场母舰', subCode: '超低温超导磁暴环 + 蓝宝石相控阵护盾发生器', zoneSpec: 'W:2M+1L | B:4×1格 | P:2×M', armorVal: '880 HP', armorPct: 86, velVal: '380 m/s', velPct: 72, pwrVal: '285 MW', pwrPct: 97 },
        { no: 'GL-04', cat: 'hull', faction: 'glacies', hullKey: 'hullCross', badge: '36格·360MW', file: 'hull-cross-glacies.svg', name: '凛冬 Cross 舰', weight: 'TWR 1.12·B', fullTitle: '格拉基斯 Cross 级深渊极寒重装歼星旗舰', subCode: '四翼深冷超导磁轨阵列 + 切伦科夫重核反应堆 + 绝对零度力场', zoneSpec: 'W:2M+2L | B:4×1格 | P:3×L', armorVal: '1280 HP', armorPct: 96, velVal: '325 m/s', velPct: 62, pwrVal: '360 MW', pwrPct: 100 },
        { no: 'FD-01', cat: 'hull', faction: 'all', hullKey: 'hullDelta', badge: 'FIGHTER·编队', file: 'unit-fighter-drone.svg', name: '苍鹰舰载战机', weight: 'TWR 2.45·S+', fullTitle: 'FD-01「苍鹰」前掠翼全自主舰载拦截战机', subCode: '24K金箔热脊 + 蓝宝石AI光电座舱 + 翼尖双联格斗弹 + 机首脉冲激光', zoneSpec: '4机编队自主掠袭狗斗 | 脉冲激光 + 穿甲曳光机炮', armorVal: '180 HP', armorPct: 48, velVal: '680 m/s', velPct: 100, pwrVal: '45 MW', pwrPct: 64 },
        { no: 'MD-01', cat: 'module', faction: 'all', modKey: 'railgun', badge: 'W:M·2格', file: 'module-railgun.svg', name: '电磁轨道炮', weight: '动能 K·28MW', fullTitle: 'Mk.IV 双导轨高初速洛伦兹电磁加速炮', subCode: '铜金加速线圈 + 钨芯穿甲弹丸 · 对重甲外壳 135% 贯通伤害', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 28MW', armorVal: '穿甲 135%', armorPct: 92, velVal: '1800 m/s', velPct: 98, pwrVal: '-28 MW', pwrPct: 65 },
        { no: 'MD-02', cat: 'module', faction: 'all', modKey: 'laser', badge: 'W:S·1格', file: 'module-laser.svg', name: '高能激光塔', weight: '热能 E·24MW', fullTitle: 'Helios-L9 蓝宝石棱镜相控阵脉冲激光炮', subCode: '零飞行延迟瞬时命中 + 高频离散脉冲灼烧小型飞蝗集群', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 24MW', armorVal: '精准 100%', armorPct: 100, velVal: '光速瞬达', velPct: 100, pwrVal: '-24 MW', pwrPct: 58 },
        { no: 'MD-03', cat: 'module', faction: 'all', modKey: 'plasma', badge: 'W:M·2格', file: 'module-plasma.svg', name: '电浆重炮', weight: '电浆 E·34MW', fullTitle: '托卡马克磁约束高温电浆球团发射器', subCode: '发射高能紫红电浆球团，命中后融解异虫甲壳并附加灼烧', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 34MW', armorVal: '融甲 140%', armorPct: 94, velVal: '920 m/s', velPct: 76, pwrVal: '-34 MW', pwrPct: 78 },
        { no: 'MD-04', cat: 'module', faction: 'all', modKey: 'missile', badge: 'W:M·2格', file: 'module-missile.svg', name: '制导导弹井', weight: '高爆 X·26MW', fullTitle: '四联装垂发红外/雷达双模追踪导弹发射井', subCode: '自动偏转追踪高机动潜行者与螳螂刺客，范围破片杀伤', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 26MW', armorVal: '爆破 125%', armorPct: 85, velVal: '780 m/s', velPct: 82, pwrVal: '-26 MW', pwrPct: 60 },
        { no: 'MD-05', cat: 'module', faction: 'all', modKey: 'swarmMissile', badge: 'W:M·2格', file: 'module-swarm-missile.svg', name: '蜂群微导舱', weight: '齐射 X·30MW', fullTitle: '16 联装蜂巢微型制导飞弹齐射舱', subCode: '单次齐射多枚微型追踪弹幕，专克异虫飞蝗与自爆孢子海', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 30MW', armorVal: '弹幕 16发', armorPct: 90, velVal: '840 m/s', velPct: 86, pwrVal: '-30 MW', pwrPct: 70 },
        { no: 'MD-06', cat: 'module', faction: 'all', modKey: 'cryoMissile', badge: 'W:M·2格', file: 'module-cryo-missile.svg', name: '深冷冰霜弹', weight: '深冷 C·28MW', fullTitle: '格拉基斯液氮超导凝霜导弹发射舱', subCode: '命中后释放深冷结晶雾，令目标移速降低 45% 并脆化甲壳', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 28MW', armorVal: '缓速 45%', armorPct: 88, velVal: '760 m/s', velPct: 78, pwrVal: '-28 MW', pwrPct: 64 },
        { no: 'MD-07', cat: 'module', zone: 'W', faction: 'all', modKey: 'empMissile', badge: 'W:M·2格', file: 'module-emp-missile.svg', name: '电磁脉冲弹', weight: '脉冲 I·30MW', fullTitle: '高功率宽频电磁脉冲瘫痪飞弹井', subCode: '震荡异虫生物神经节，打断利维坦与母巢舰蓄力并瘫痪 2.5s', zoneSpec: '挂载区: [红 W] 武器座 · 耗电 30MW', armorVal: '瘫痪 2.5s', armorPct: 92, velVal: '800 m/s', velPct: 80, pwrVal: '-30 MW', pwrPct: 68 },
        { no: 'MD-08', cat: 'module', zone: 'W', faction: 'all', modKey: 'hellfireMissile', badge: 'W:L·4格', file: 'module-hellfire-missile.svg', name: '地狱火重导', weight: '热核 X·42MW', fullTitle: '反物质超燃冲压重型巡航导弹吊舱', subCode: '超远距高敏巡航突防，触敌释放广域热核反物质聚爆冲击波', zoneSpec: '挂载区: [红 W] 战略座 · 耗电 42MW', armorVal: '聚爆 145%', armorPct: 96, velVal: '780 m/s', velPct: 84, pwrVal: '-42 MW', pwrPct: 88 },
        { no: 'MD-09', cat: 'module', zone: 'W', faction: 'all', modKey: 'torpedo', badge: 'W:L·4格', file: 'module-torpedo.svg', name: '重型聚变鱼雷', weight: '聚变 X·48MW', fullTitle: '反主力舰重型热核聚变光子鱼雷发射管', subCode: '专用于攻坚腐蚀蜂巢母舰与虚空利维坦首领，巨额球形冲击波', zoneSpec: '挂载区: [红 W] 重型槽 · 耗电 48MW', armorVal: '毁伤 480', armorPct: 100, velVal: '520 m/s', velPct: 62, pwrVal: '-48 MW', pwrPct: 95 },
        { no: 'MD-10', cat: 'module', zone: 'B', faction: 'all', modKey: 'hangar', badge: 'B:1格·内舱', file: 'module-hangar.svg', name: '无人机母舱', weight: '僚机 +4架', fullTitle: '全自动自主拦截无人机弹射与维护方舱', subCode: '标准 1×1 内部功能舱，自动释放苍鹰/猎隼/重锤无人机协同集火', zoneSpec: '挂载区: [绿 B] 内部1格舱 · 耗电 22MW', armorVal: '僚机 +4', armorPct: 88, velVal: '自主巡航', velPct: 90, pwrVal: '-22 MW', pwrPct: 52 },
        { no: 'MD-11', cat: 'module', zone: 'B', faction: 'all', modKey: 'shield', badge: 'B:1格·内舱', file: 'module-shield.svg', name: '偏导护盾舱', weight: '护盾 +350', fullTitle: '多频段相控阵能量偏导护盾发生器方舱', subCode: '标准 1×1 内部功能舱，大幅提升战舰护盾容量与脱战自愈速率', zoneSpec: '挂载区: [绿 B] 内部1格舱 · 耗电 25MW', armorVal: '护盾 +350', armorPct: 95, velVal: '自愈 +18/s', velPct: 85, pwrVal: '-25 MW', pwrPct: 58 },
        { no: 'MD-12', cat: 'module', zone: 'P', faction: 'all', modKey: 'thrusterCompound', badge: 'P:尾喷·2格', file: 'module-hall-thruster.svg', name: '霍尔复合引擎', weight: '双修 +18%', fullTitle: '大推力磁等离子霍尔复合推进器总成', subCode: '安装于舰艉 [紫 P] 推进槽，均衡提升巡航极速与转向角速度', zoneSpec: '挂载区: [紫 P] 舰艉推进槽 · 耗电 20MW', armorVal: '双修 +18%', armorPct: 90, velVal: 'TWR +0.25', velPct: 92, pwrVal: '-20 MW', pwrPct: 45 },
        { no: 'MD-13', cat: 'module', zone: 'P', faction: 'all', modKey: 'thrusterVector', badge: 'P:尾喷·1格', file: 'module-thruster.svg', name: '多维矢量引擎', weight: '转向 +30%', fullTitle: '双喷口偏转磁流体多维矢量转向引擎', subCode: '安装于舰艉 [紫 P] 推进槽，专精提升笨重星舰回转角速度与角加速度', zoneSpec: '挂载区: [紫 P] 舰艉推进槽 · 耗电 18MW', armorVal: '转向 +30%', armorPct: 88, velVal: '角力矩 MAX', velPct: 96, pwrVal: '-18 MW', pwrPct: 42 },
        { no: 'MD-14', cat: 'module', zone: 'CORE', faction: 'all', modKey: 'station', badge: 'CORE·卫戍', file: 'station-core.svg', name: '星轨核心空间站', weight: '炮塔 2~6座', fullTitle: '八边形金箔/超导星轨防卫核心枢纽与轨道炮塔群', subCode: '战区远端守护目标，支持战功扩建 2~6 座 360° 自动伺服卫戍炮塔', zoneSpec: '核心卫戍区 · 受击触发双色共振冲击波', armorVal: '1200 HP', armorPct: 100, velVal: '360° 卫戍', velPct: 88, pwrVal: '自持聚变', pwrPct: 100 },
        { no: 'ZG-01', cat: 'zerg', faction: 'zerg', badge: 'SWARM·轻甲', file: 'enemy-swarm.svg', name: '刀锋飞蝗', weight: '弱点:激光/蜂群', fullTitle: '虚空虫群 · 刀锋毒刺飞蝗 (Razor-Sting Hornet)', subCode: '黑曜石几丁质薄壳 + 四片半透明脉络膜翼 + 腹尾翠绿酸液毒针', zoneSpec: '高速集群突袭 · 热能(E)与爆破(X)易伤 130%', armorVal: '36 HP', armorPct: 28, velVal: '高速突袭', velPct: 94, pwrVal: '集群撕咬', pwrPct: 45 },
        { no: 'ZG-02', cat: 'zerg', faction: 'zerg', badge: 'BOMBER·自爆', file: 'enemy-bomber.svg', name: '自爆孢子虫', weight: '弱点:远程点杀', fullTitle: '虚空虫群 · 强酸易爆孢子囊虫 (Volatile Spore-Tick)', subCode: '半透明膨胀发光酸液巨囊 + 内部不稳定紫绿核脉冲 + 抱脸虫利爪', zoneSpec: '神风冲撞空间站自爆 · 需在安全距离外提前引爆', armorVal: '48 HP', armorPct: 36, velVal: '冲刺自爆', velPct: 86, pwrVal: '高危酸爆', pwrPct: 88 },
        { no: 'ZG-03', cat: 'zerg', faction: 'zerg', badge: 'LURKER·相位', file: 'enemy-lurker.svg', name: '触须潜行者', weight: '弱点:制导导弹', fullTitle: '虚空虫群 · 深渊乌贼触须潜行者 (Void Tentacle Lurker)', subCode: '流线型头足类暗紫骨甲 + 6 条发光吸盘长触须 + 紫色灵能复眼', zoneSpec: '中程周期性侧向相位闪现 · 制导导弹(X)与EMP(I)克制', armorVal: '85 HP', armorPct: 56, velVal: '相位折跃', velPct: 90, pwrVal: '灵能穿刺', pwrPct: 68 },
        { no: 'ZG-04', cat: 'zerg', faction: 'zerg', badge: 'STALKER·猎杀', file: 'enemy-stalker.svg', name: '镰刀螳螂', weight: '弱点:深冷减速', fullTitle: '虚空虫群 · 幽影双镰螳螂猎杀者 (Scythe-Mantis Stalker)', subCode: 'V型逆关节重装黑曜石胸甲 + 两柄锯齿翠绿等离子骨镰 + 6眼复眼簇', zoneSpec: '优先锁定玩家战舰高速斩击 · 深冷导弹(C)减速克制', armorVal: '120 HP', armorPct: 68, velVal: '极速猎杀', velPct: 92, pwrVal: '双镰撕裂', pwrPct: 82 },
        { no: 'ZG-05', cat: 'zerg', faction: 'zerg', badge: 'CARRIER·母巢', file: 'enemy-carrier.svg', name: '孵化母巢舰', weight: '弱点:磁轨/鱼雷', fullTitle: '虚空虫群 · 重甲生物航空母巢舰 (Brood-Hive Carrier)', subCode: '不对称巨型甲虫背甲 + 两侧 6 座发光翠绿孵化腔 + 尾部生物等离子囊', zoneSpec: '每隔数秒孵化刀锋飞蝗集群 · 动能磁轨炮(K)与重型鱼雷克制', armorVal: '280 HP', armorPct: 88, velVal: '重甲推进', velPct: 42, pwrVal: '持续孵虫', pwrPct: 90 },
        { no: 'ZG-06', cat: 'zerg', faction: 'zerg', badge: 'BOSS·利维坦', file: 'boss-leviathan.svg', name: '虚空利维坦', weight: '弱点:全舰集火', fullTitle: '十星域关底首领 · 克拉肯主宰利维坦 (Kraken Overmind Leviathan)', subCode: '多层黑曜石骨板王冠 + 暴露紫红主宰脑核 + 4 巨螯 + 8 生物激光触须', zoneSpec: '发射生物等离子束并召唤虫潮 · 击破脑核获海量战功', armorVal: '1200 HP', armorPct: 100, velVal: '主宰威压', velPct: 55, pwrVal: '毁灭光束', pwrPct: 100 }
      ],
      formulas: [
        { title: '牛顿推重比 (TWR) 与正交火控解算', desc: 'a = F_thrust / M_total，飞行姿态控制 (FCS) 与武器火控索敌 (WCS) 正交解耦，支持移动中 360° 独立锁定开火。' },
        { title: '红/绿/紫三色正交挂点与体积恒定铁律', desc: '[红 W] 武器挂点、[绿 B] 内部 1×1 方舱、[紫 P] 舰艉推进槽严格分区；T1→T5 晋升仅强化内部拓扑与发光，绝不膨胀体积。' },
        { title: '反应堆功率备份比 (Reactor Power Margin)', desc: 'Margin = (P_max - P_used) / P_max；维持高备份比可提升护盾充能与冷却效率，超载时自动切断低优先级非致命舱室。' },
        { title: '双阵营涂装与六大虚空虫群克制矩阵', desc: '支持赫利俄斯(金箔白瓷)与格拉基斯(深冷蓝宝石)实时切换；针对飞蝗/孢子/潜行者/螳螂/母巢/利维坦调配 K/E/X/C/I 武器。' }
      ],
      sprites: [
        { file: 'hull-delta.svg', name: 'Delta 截击舰 (Helios)', role: '赫利俄斯高速拦截舰' },
        { file: 'hull-wing.svg', name: 'Wing 巡洋舰 (Helios)', role: '赫利俄斯多挂点主力舰' },
        { file: 'hull-ring.svg', name: 'Ring 环轨舰 (Helios)', role: '赫利俄斯环状护盾母舰' },
        { file: 'hull-cross.svg', name: 'Cross 歼星舰 (Helios)', role: '赫利俄斯重装十字旗舰' },
        { file: 'hull-delta-glacies.svg', name: 'Delta 截击舰 (Glacies)', role: '格拉基斯深冷超导截击舰' },
        { file: 'hull-wing-glacies.svg', name: 'Wing 巡洋舰 (Glacies)', role: '格拉基斯蓝宝石巡洋舰' },
        { file: 'hull-ring-glacies.svg', name: 'Ring 环轨舰 (Glacies)', role: '格拉基斯量子力场母舰' },
        { file: 'hull-cross-glacies.svg', name: 'Cross 歼星舰 (Glacies)', role: '格拉基斯极寒无畏旗舰' },
        { file: 'station-core.svg', name: '星轨空间站 (Helios)', role: '赫利俄斯核心卫戍站' },
        { file: 'station-core-glacies.svg', name: '星轨空间站 (Glacies)', role: '格拉基斯深冷核心站' },
        { file: 'weapon-turret.svg', name: '轨道炮塔 (Helios)', role: '赫利俄斯自动防空塔' },
        { file: 'weapon-turret-glacies.svg', name: '轨道炮塔 (Glacies)', role: '格拉基斯超导防空塔' },
        { file: 'module-railgun.svg', name: '电磁轨道炮模块', role: '高初速动能穿甲主炮' },
        { file: 'module-laser.svg', name: '相控阵激光模块', role: '光速瞬时拦截激光' },
        { file: 'module-plasma.svg', name: '高温电浆炮模块', role: '重型磁约束电浆炮' },
        { file: 'module-missile.svg', name: '制导导弹井模块', role: '四联装追踪导弹舱' },
        { file: 'module-swarm-missile.svg', name: '蜂群微导舱模块', role: '16联装防空蜂群弹幕' },
        { file: 'module-cryo-missile.svg', name: '深冷冰霜弹模块', role: '液氮超导减速导弹' },
        { file: 'module-emp-missile.svg', name: '电磁脉冲弹模块', role: '神经瘫痪EMP导弹' },
        { file: 'module-hellfire-missile.svg', name: '地狱火重导模块', role: '高爆反装甲重型导弹' },
        { file: 'module-torpedo.svg', name: '重型聚变鱼雷管', role: '反首领热核光子鱼雷' },
        { file: 'module-hangar.svg', name: '无人机母舱模块', role: '内部1×1护航无人机舱' },
        { file: 'module-shield.svg', name: '偏导护盾舱模块', role: '内部1×1相控阵护盾舱' },
        { file: 'module-thruster.svg', name: '霍尔矢量推进器', role: '舰艉大推力离子引擎' },
        { file: 'enemy-swarm.svg', name: '刀锋毒刺飞蝗', role: '高速集群突袭异虫' },
        { file: 'enemy-bomber.svg', name: '强酸自爆孢子虫', role: '神风自爆高危异虫' },
        { file: 'enemy-lurker.svg', name: '深渊触须潜行者', role: '中程相位折跃异虫' },
        { file: 'enemy-stalker.svg', name: '幽影双镰螳螂', role: '高速近战斩击异虫' },
        { file: 'enemy-carrier.svg', name: '腐蚀孵化母巢舰', role: '重甲孵化母舰异虫' },
        { file: 'boss-leviathan.svg', name: '克拉肯虚空利维坦', role: '十星域关底主宰首领' },
        { file: 'asteroid-iron.svg', name: '富铁镍陨石天体', role: '可开采合金残骸矿石' },
        { file: 'asteroid-crystal.svg', name: '高能晶簇陨石', role: '高价值星轨能量晶矿' },
        { file: 'unit-fighter-drone.svg', name: '苍鹰舰载拦截战机', role: '4机编队高速狗斗战机' },
        { file: 'proj-tracer-kinetic.svg', name: '高初速穿甲曳光弹', role: '超音速流光激波曳光弹丸' },
        { file: 'proj-laser-beam.svg', name: '相控阵高能激光束', role: '螺旋波导高相干激光束' },
        { file: 'proj-missile-warhead.svg', name: '弹翼制导导弹弹体', role: '马赫环尾焰制导导弹/鱼雷' },
        { file: 'proj-plasma-bolt.svg', name: '磁约束高温电浆弹', role: '托卡马克紫红电浆球团' }
      ],
      getMetrics: (s) => [
        { label: '战功储备 (War Merits)', val: (s.currency?.warMerits ?? 1200).toLocaleString(), gold: true },
        { label: '合金残骸 (Scraps)', val: (s.currency?.scraps ?? 150).toLocaleString(), gold: true },
        { label: '当前阵营 / 火控与炮塔', val: `${(s.faction || 'helios') === 'glacies' ? '格拉基斯' : '赫利俄斯'} · Lv.${s.weaponLv ?? 1} / ${s.turretCount ?? 2}座` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { warMerits: 1200, scraps: 150 };
        s.currency.warMerits += 1500;
        s.currency.scraps += 400;
        s.weaponLv = Math.min(5, (s.weaponLv || 1) + 1);
      },
      studioBtnText: '打开星际船坞 3 栏改装面板',
      triggerStudio: () => document.getElementById('btn-open-dock')?.click()
    },
    'tank-battle': {
      id: 'tank-battle',
      name: '钢铁防线',
      en: 'TANK BATTLE',
      styleCode: 'STYLE-170 × STYLE-142 · 玄武岩熔岩金与锻造碳回火炮钢',
      storagePrefix: 'NEXUS_MINI_TANK_',
      icon: '../assets/tank-battle/icon.svg',
      preview: '../assets/tank-battle/preview.png',
      tagline: '360° 车炮解耦重装防线 · 车体参照系操控、混合异形工事与高初速穿甲弹道',
      modes: [
        { id: 'solo-defense', name: '单机防线战役', desc: '1P 玩家主控 360° 车炮解耦主战坦，2P 退火黄铜双管坦由本地陀螺火控 AI 协同护卫统帅地堡' },
        { id: 'lan-coop', name: '局域网双人协同', desc: '两名指挥官各自持握手机 1~5ms 直连，共享 V型防爆钢障加固与 360° 高初速穿甲弹道同步' }
      ],
      rosterUnits: [
        { no: 'NO.01', badge: '120MM RHA', file: 'player-tank-p1.svg', name: '1P 重型主战', weight: '48.5 TON', fullTitle: 'T-80U / M103 重型主战坦克', subCode: '车体参照系差速履带 + 陀螺仪火控稳定炮塔', ammo: 'APFSDS', armorVal: '220mm', armorPct: 88, velVal: '1380px/s', velPct: 92, pwrVal: '155°/s', pwrPct: 84 },
        { no: 'NO.02', badge: 'ERA 反应甲', file: 'player-tank-p2.svg', name: '2P 协同突击', weight: '46.0 TON', fullTitle: '2P 卫戌双联突击重坦', subCode: '冷拔拉丝钨钢车体 + 360° 独立旋转双联滑膛炮', ammo: 'APFSDS', armorVal: '205mm', armorPct: 82, velVal: '1200px/s', velPct: 86, pwrVal: '148°/s', pwrPct: 82 },
        { no: 'NO.03', badge: '双联 152MM', file: 'enemy-mammoth.svg', name: '猛犸重装敌坦', weight: '72.0 TON', fullTitle: '猛犸四履带超重型攻坚坦', subCode: '大倾角首上反应装甲 + 820px/s 重型攻城炮', ammo: 'HE-FRAG', armorVal: '260mm', armorPct: 96, velVal: '820px/s', velPct: 72, pwrVal: '85°/s', pwrPct: 54 },
        { no: 'NO.04', badge: '高速侦察', file: 'enemy-scout.svg', name: '轻型穿插敌坦', weight: '28.5 TON', fullTitle: '灰狼半履带高机动侦察坦', subCode: '360° 弧线切向绕障 + 650px/s 速射机炮', ammo: 'AP-I', armorVal: '95mm', armorPct: 45, velVal: '650px/s', velPct: 65, pwrVal: '140°/s', pwrPct: 92 },
        { no: 'NO.05', badge: '铸钢地堡', file: 'base-eagle.svg', name: '统帅核心雕像', weight: 'FORT-01', fullTitle: '八角防爆铸钢统帅鹰标地堡', subCode: '退火黄铜浮雕军徽 + 异形六角砖堡/V型钢翼拱卫', ammo: 'CORE', armorVal: '300mm', armorPct: 100, velVal: '0px/s', velPct: 15, pwrVal: 'FIXED', pwrPct: 100 },
        { no: 'NO.06', badge: 'V型跳弹钢墙', file: 'tile-steel.svg', name: 'V型折角钢障', weight: 'LV.3 穿甲', fullTitle: '克虏伯 V型折角防爆跳弹钢掩体', subCode: '120° 楔形斜面镜面跳弹 + 沉头六角螺栓', ammo: 'RICOCHET', armorVal: '280mm', armorPct: 95, velVal: '0px/s', velPct: 10, pwrVal: 'FIXED', pwrPct: 100 }
      ],
      formulas: [
        { title: '360° 车炮分离与陀螺稳定火控', desc: '左侧方向键以车体为参照控制车头前进/车尾倒车/左右差速转向；右侧开火键两侧独立控制炮塔左/右旋，车体转向时炮塔自动维持世界绝对指向。' },
        { title: '动态移动散布与定点精瞄奖励', desc: '坦克行进或转向时火控扇形急剧扩圈（最高 ±18.3°）；停车驻停后准星平滑缩圈，火控精度 ≥92% 时触发定点精瞄奖励（膛口初速 +12% 且 ±0.28° 激光级指哪打哪）。' },
        { title: '5 类非方块异形工事与切向滑移', desc: '战场采用正六边形蜂巢砖堡、V型折角防爆钢墙、圆形混凝土暗堡、正三角龙牙反坦克锥与不规则玄武岩，擦碰斜面自动切向顺滑导流。' },
        { title: '高初速穿甲跳弹与 AI 短停缩圈', desc: '760~1545 px/s 超高初速穿甲弹配合 CCD 射线防穿模与斜面跳弹；2P 僚机与敌坦 AI 均具备“机动推进 ➔ 短停缩圈精瞄 ➔ 射击”战术状态机。' }
      ],
      sprites: [
        { file: 'player-tank-p1.svg', name: '1P 重型主战', role: '360° 车炮解耦主力坦' },
        { file: 'player-tank-p2.svg', name: '2P 协同突击', role: '退火黄铜双管突击坦' },
        { file: 'enemy-scout.svg', name: '轻型穿插敌坦', role: '半履带弧线侦察车' },
        { file: 'enemy-raider.svg', name: '疾风突击敌坦', role: '高机动绕后突击坦' },
        { file: 'enemy-shooter.svg', name: '长身管歼击车', role: '1260px/s 极速磁轨炮' },
        { file: 'enemy-mammoth.svg', name: '猛犸重装敌坦', role: '首上跳弹四履带重坦' },
        { file: 'enemy-boss-train.svg', name: '铁幕攻城列车', role: '多炮塔独立索敌首领' },
        { file: 'base-eagle.svg', name: '统帅核心雕像', role: '八角铸钢鹰标地堡' },
        { file: 'tile-brick.svg', name: '六角蜂巢砖堡', role: '正六边形可破扇区工事' },
        { file: 'tile-steel.svg', name: 'V型折角钢障', role: '楔形斜面物理跳弹掩体' },
        { file: 'tile-bush.svg', name: '纳米伪装网林', role: '多边形树冠视觉隐蔽层' },
        { file: 'pickup-crate.svg', name: '八角军械补给', role: '高初速晋升/护盾空投箱' }
      ],
      getMetrics: (s) => [
        { label: '军械储备硬币 (Ordnance Coins)', val: (s.currency?.tankCoins ?? 500).toLocaleString(), gold: true },
        { label: '历史最高防线积分', val: (s.stats?.highScore ?? 0).toLocaleString(), gold: true },
        { label: '当前战车军衔 / 胜场', val: `Rank ${s.rank ?? 1} / ${s.stats?.wins ?? 0} 胜` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { tankCoins: 500 };
        s.currency.tankCoins += 500;
        s.rank = Math.min(4, (s.rank || 1) + 1);
      },
      studioBtnText: '立即触发地堡防弹钢加固',
      triggerStudio: () => document.getElementById('btn-fortify-base')?.click()
    },
    'gold-miner': {
      id: 'gold-miner',
      name: '掘金先锋',
      en: 'GOLD MINER VANGUARD',
      styleCode: 'STYLE-21 · 地底三段岩层与黄铜探照灯主题',
      storagePrefix: 'NEXUS_MINI_MINER_',
      icon: '../assets/gold-miner/icon.svg',
      preview: '../assets/gold-miner/preview.png',
      tagline: '60Hz 简谐角摆与动量回收物理 · 双钩 2.2 倍合力起吊 700kg 远古巨金',
      modes: [
        { id: 'solo-mine', name: '客户端单机 · 双机甲协同深井淘金', desc: '1P 主控掘金机甲配搭 2P 智能勘探机甲，自动协助合力起吊巨型金矿与极光钻石' },
        { id: 'lan-coop', name: '局域网 1~5ms · 双人双钩合力掘金', desc: '双机通过局域网实时同步出钩角度 θ，共同命中同一巨金触发 2.2 倍合力极速拉升' }
      ],
      formulas: [
        { title: '60Hz 简谐角摆方程', desc: 'θ(t) = θ_max · sin(ωt)，双层抗锯齿锻造钢缆随起吊张力实时切换棘轮脉冲音效节奏。' },
        { title: '质量-阻尼回收速度公式', desc: 'v_pull = v_0 · (m_0 · k_tonic · k_coop) / (m_0 + M_mineral)，双钩同抓巨金时 k_coop = 2.2。' },
        { title: 'TNT 连锁起爆与雷管救险', desc: '抓中笨重花岗岩时可投掷救险雷管瞬间炸毁；引爆地下 TNT 桶将清扫 115px 半径内矿石。' },
        { title: '局间杂货铺三件套增益', desc: '高能雷管、大力神液压剂 (+65% 起吊拉力) 与四叶草芯片 (钻石/盲盒 1.5x 溢价) 自由配置。' }
      ],
      sprites: [
        { file: 'miner-rig-p1.svg', name: '1P 掘金机甲', role: '主力重型卷扬机' },
        { file: 'miner-rig-p2.svg', name: '2P 勘探机甲', role: '协同合力卷扬机' },
        { file: 'claw-hook.svg', name: '三爪合金抓钩', role: '精密液压抓取爪' },
        { file: 'gold-nugget.svg', name: '标准高纯金矿', role: '中质量主力矿产' },
        { file: 'gold-giant.svg', name: '700kg 远古巨金', role: '高价值双钩目标' },
        { file: 'mineral-rock.svg', name: '深层花岗岩石', role: '高阻尼低值障碍' },
        { file: 'mineral-diamond.svg', name: '极光折射钻石', role: '轻质高值珍稀矿' },
        { file: 'mystery-bag.svg', name: '神秘物资盲盒', role: '随机金币或雷管' },
        { file: 'hazard-tnt.svg', name: 'TNT 高爆桶', role: '范围连锁起爆物' },
        { file: 'item-dynamite.svg', name: '救险高能雷管', role: '炸毁已抓笨重石块' },
        { file: 'item-tonic.svg', name: '大力神液压剂', role: '回收拉力提升 65%' },
        { file: 'item-clover.svg', name: '四叶草芯片', role: '钻石与盲盒溢价' }
      ],
      getMetrics: (s) => [
        { label: '储备金条 (Gold Bars)', val: (s.currency?.goldBars ?? 850).toLocaleString(), gold: true },
        { label: '救险雷管库存', val: `${s.dynamites ?? 3} 枚`, gold: true },
        { label: '最高突破矿层 / 最高纪录', val: `第 ${s.maxStage ?? 1} 层 / $${(s.bestCash ?? 0).toLocaleString()}` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { goldBars: 850 };
        s.currency.goldBars += 600;
        s.dynamites = (s.dynamites || 3) + 3;
        s.tonicBuff = true;
        s.cloverBuff = true;
      },
      studioBtnText: '打开局间矿工杂货铺整备',
      triggerStudio: () => document.getElementById('btn-open-shop')?.click() // miner/index.html 已提供真实杂货铺弹窗
    },
    'pudding-defense': {
      id: 'pudding-defense',
      name: '保卫布丁',
      en: 'PUDDING DEFENSE',
      styleCode: 'STYLE-11+08 · 可可烘焙台面与马卡龙果冻主题',
      storagePrefix: 'NEXUS_MINI_PUDDING_',
      icon: '../assets/pudding-defense/icon.svg',
      preview: '../assets/pudding-defense/preview.png',
      tagline: '16×9 威化饼干路径清障塔防 · 五大甜品卫士守护 10 HP 皇家焦糖布丁',
      modes: [
        { id: 'solo-td', name: '客户端单机 · 甜品工坊清障塔防战役', desc: '边清理方糖/奶油蛋糕路障腾出炮位，边部署五大甜品卫士拦截馋嘴怪兽军团' },
        { id: 'lan-coop', name: '局域网 1~5ms · 双厨师长协同布防', desc: '双机通过局域网实时同步建塔、升塔、集火标点与全屏暴风雪冰封合体大招' }
      ],
      formulas: [
        { title: '清障开荒与建塔双轨 ROI', desc: '击碎方糖与奶油蛋糕路障不仅释放黄金拐角炮位，更立即爆出高额糖果金币加速前中期发育。' },
        { title: '五大甜品卫士克制矩阵', desc: '波波连射塔(单体速射)、冰霜熊(减速控制)、太阳炮(环形AOE)、泡泡糖井(远程重炮)、彩虹棱镜(高穿)。' },
        { title: '点选锁定集火与威化流光导引', desc: '点击任意怪兽或路障即可挂载红色集火准星，威化饼干路径常驻焦糖流光箭头指示行进方向。' },
        { title: '无伤金布丁奖章评定', desc: '保持终点皇家焦糖布丁满 10 HP 无伤通关波次，即可斩获金布丁奖章与皇家糖晶奖励。' }
      ],
      sprites: [
        { file: 'pudding-core.svg', name: '皇家焦糖布丁', role: '10 HP 核心守护目标' },
        { file: 'tower-boba.svg', name: '波波连射塔', role: '高攻速单体甜品塔' },
        { file: 'tower-frost.svg', name: '冰霜北极熊塔', role: '寒气减速控制塔' },
        { file: 'tower-sun.svg', name: '太阳蛋黄炮', role: '环形范围灼烧塔' },
        { file: 'tower-missile.svg', name: '泡泡糖导弹井', role: '远距离重型爆破塔' },
        { file: 'tower-prism.svg', name: '彩虹棱镜塔', role: '高阶激光折射塔' },
        { file: 'obstacle-sugar.svg', name: '晶莹方糖路障', role: '轻型可清除糖块' },
        { file: 'obstacle-cake.svg', name: '奶油蛋糕路障', role: '高金币大型路障' },
        { file: 'monster-cookie.svg', name: '暴走曲奇怪', role: '高速先锋偷吃怪' },
        { file: 'monster-boar.svg', name: '发条铁皮野猪', role: '厚甲冲锋怪兽' },
        { file: 'monster-jelly.svg', name: '果冻分裂怪', role: '高弹性中坚怪兽' },
        { file: 'boss-glutton.svg', name: '贪吃大魔王', role: '巨型关底首领' }
      ],
      getMetrics: (s) => [
        { label: '皇家糖晶储备 (Sugar Crystals)', val: (s.currency?.sugarCrystals ?? 600).toLocaleString(), gold: true },
        { label: '无伤金布丁奖章', val: `${s.goldenPuddings ?? 0} 枚`, gold: true },
        { label: '已解锁章节进度', val: `第 ${s.clearedChapters ?? 1} 章` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { sugarCrystals: 600 };
        s.currency.sugarCrystals += 500;
        s.goldenPuddings = (s.goldenPuddings || 0) + 3;
      },
      studioBtnText: null,
      triggerStudio: null
    },
    'micro-genesis': {
      id: 'micro-genesis',
      name: '微界演化：基因沙盘',
      en: 'MICRO-GENESIS',
      styleCode: 'STYLE-23+133 · 深海培养皿与生物荧光青绿主题',
      storagePrefix: 'NEXUS_MINI_GENESIS_',
      icon: '../assets/micro-genesis/icon.svg',
      preview: '../assets/micro-genesis/preview.png',
      tagline: '4 阶躯干与五大器官插槽 · 视觉扇形/听觉声呐视界 · 昼夜动态能量平衡沙盘',
      modes: [
        { id: 'solo-sandbox', name: '客户端单机 · 五大生态圈演化战役', desc: '从浅海温床到深渊裂谷，单控始祖个体进食蓄能、分裂繁衍同族电脑 NPC 群落并击败 5 大远古首领' },
        { id: 'lan-pvp', name: '局域网 1~5ms · 1v1/2v2 移动端房主沙盘赛', desc: '2800×1800 沙盘直接运行于房主移动设备内存，支持 AOI 视野裁剪与跨物种生态位争夺' }
      ],
      formulas: [
        { title: '三维核心数据与体积代谢平衡', desc: '生命(HP)、能量(E)、基因(GP)闭环；T01~T04 体积越大插槽越多，但基础代谢 BMR 呈指数上升。' },
        { title: '感官驱动画面渲染管线', desc: '视觉器官渲染前向彩色扇形(受黑夜/墨囊影响)；听觉器官渲染 360° 声呐黑白轮廓脉冲定格。' },
        { title: '同躯干进化 vs 跨躯干新种群', desc: '局内加载基因库时：同躯干原位换装并保留存活同族 NPC；不同躯干则以唯一 1 只新始祖重新降生。' },
        { title: '局部食物刷新与承载力自平衡', desc: '环境定时局部注入微藻能量，全员持续代谢耗散，自然遏制无脑过量繁殖。' }
      ],
      sprites: [
        { file: 'torso-t1-micro.svg', name: '微型原核体 (T01)', role: '5 插槽高机动躯干' },
        { file: 'torso-t2-stream.svg', name: '流线真核体 (T02)', role: '7 插槽均衡躯干' },
        { file: 'torso-t3-predator.svg', name: '宽幅掠食体 (T03)', role: '9 插槽猎手躯干' },
        { file: 'torso-t4-titan.svg', name: '深渊泰坦 (T04)', role: '12 插槽巨型躯干' },
        { file: 'core-vacuole-lv3.svg', name: '多核代谢中枢', role: '核心插槽 Lv.3' },
        { file: 'sensory-eye-lv3.svg', name: '全光谱棱镜复眼', role: '视觉感官 Lv.3' },
        { file: 'sensory-ear-lv3.svg', name: '深渊高频回声耳', role: '听觉声呐 Lv.3' },
        { file: 'mouth-carn-lv3.svg', name: '深渊断骨利刃', role: '肉食口器 Lv.3' },
        { file: 'loco-jet-lv3.svg', name: '等离子推进器', role: '运动插槽 Lv.3' },
        { file: 'util-electric-lv3.svg', name: '雷暴电弧核心', role: '功能放电 Lv.3' },
        { file: 'env-algae.svg', name: '星芒微藻晶体', role: '植食基础能量源' },
        { file: 'env-meat.svg', name: '有机肉块晶簇', role: '肉食高能掉落物' }
      ],
      getMetrics: (s) => [
        { label: '基因值储备 (Gene Points)', val: ((s.currency?.genePoints ?? s.gpReserve) ?? 1500).toLocaleString(), gold: true },
        { label: '螺旋晶簇 (Helix Shards)', val: (s.currency?.helixShards ?? 80).toLocaleString(), gold: true },
        { label: '进化纪元段位', val: s.arenaTier || '未定级 (暂无对战记录)' }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { genePoints: 1500, helixShards: 80 };
        s.currency.genePoints = (s.currency.genePoints || 1500) + 1200;
        s.gpReserve = (s.gpReserve || 1200) + 1200;
      },
      studioBtnText: '进入五插槽物种编辑工坊 & 基因库',
      triggerStudio: () => {
        const edBtn = document.querySelector('[data-page="editor"]');
        if (edBtn) edBtn.click();
      }
    }
  };

  /* =========================================================================
   * 6. Standardized Tier 2 (6-Module Game Menu Hub) & Tier 3 Shell UI
   * ========================================================================= */
  let gameplayActive = false;
  let openTier2MenuFn = null;
  let enterTier3GameplayFn = null;
  let currentSettingsObj = {
    muted: false,
    volume: 1.0,
    haptics: true,
    touchLayout: 'standard',
    particleTier: 'high',
    guideLines: true
  };

  function initShellUI(options = {}) {
    const gameId = options.gameId || 'star-defender';
    const meta = GAME_META_DB[gameId] || GAME_META_DB['star-defender'];
    const gameTitle = options.gameTitle || meta.name;
    const settingsKey = `NEXUS_SETTINGS_${gameId}`;

    function loadSettings() {
      try {
        const raw = localStorage.getItem(settingsKey);
        if (raw) return Object.assign({}, currentSettingsObj, JSON.parse(raw));
      } catch (_) {}
      return {
        muted: false,
        volume: 1.0,
        haptics: true,
        touchLayout: 'standard',
        particleTier: 'high',
        guideLines: true
      };
    }

    function saveSettings(cfg) {
      currentSettingsObj = Object.assign({}, currentSettingsObj, cfg);
      try {
        localStorage.setItem(settingsKey, JSON.stringify(currentSettingsObj));
      } catch (_) {}
      AudioEngine.setMuted(currentSettingsObj.muted);
      AudioEngine.setVolume(currentSettingsObj.volume);
      document.body.classList.toggle('nx-touch-compact', currentSettingsObj.touchLayout === 'compact');
      document.body.classList.toggle('nx-particle-eco', currentSettingsObj.particleTier === 'eco');
      window.dispatchEvent(new CustomEvent('nexus:settings-changed', { detail: currentSettingsObj }));
    }

    let userSettings = loadSettings();
    saveSettings(userSettings);

    // Inject unified styles for Tier 2 6-Module Menu Hub, Tier 3 Return Pill & Portrait Guard
    const style = document.createElement('style');
    style.textContent = `
      .nx-return-pill {
        position: fixed;
        top: max(10px, env(safe-area-inset-top));
        right: max(14px, env(safe-area-inset-right));
        z-index: 8400;
        min-width: 68px;
        height: 44px;
        min-height: 44px;
        padding: 0 12px;
        border-radius: 9999px;
        background: var(--panel, var(--mg-glass-panel, rgba(9, 14, 26, 0.94)));
        border: 1.5px solid var(--cyan, var(--mg-accent-cyan, rgba(0, 240, 255, 0.55)));
        color: var(--text, var(--mg-text-primary, #f8fafc));
        font-size: 0.74rem;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
        transition: all 0.15s ease;
      }
      .nx-return-pill:hover {
        filter: brightness(1.12);
      }
      .nx-return-pill:active {
        transform: scale(0.96);
      }

      /* ===== 第 2 层 · 游戏菜单 (Tier 2: 6-Module Game Menu Hub) ===== */
      #nx-tier2-menu {
        position: fixed;
        inset: 0;
        z-index: 8800;
        background: var(--void, var(--mg-bg-void, #050914));
        background-image: radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.45) 85%);
        color: var(--text, var(--mg-text-primary, #f8fafc));
        font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
        display: none;
        flex-direction: column;
        padding:
          max(8px, env(safe-area-inset-top))
          max(12px, env(safe-area-inset-right))
          max(8px, env(safe-area-inset-bottom))
          max(12px, env(safe-area-inset-left));
        gap: 8px;
        overflow: hidden;
      }
      #nx-tier2-menu.active {
        display: flex;
      }
      .nx-t2-header {
        height: 48px;
        flex-shrink: 0;
        background: var(--panel, var(--mg-glass-panel, rgba(13, 20, 36, 0.90)));
        border: 1px solid var(--border, var(--mg-border-subtle, rgba(255, 255, 255, 0.22)));
        border-radius: 12px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .nx-t2-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-shrink: 0;
      }
      .nx-t2-brand img {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        object-fit: contain;
      }
      .nx-t2-title {
        font-size: 0.88rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .nx-t2-sub {
        font-size: 0.66rem;
        color: var(--cyan, var(--mg-accent-cyan, #2dd4bf));
        white-space: nowrap;
      }
      .nx-t2-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .nx-t2-tabs::-webkit-scrollbar { display: none; }
      .nx-t2-tab {
        min-height: 44px;
        min-width: 44px;
        padding: 0 10px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: var(--muted, var(--mg-text-secondary, #94a3b8));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.14s ease;
      }
      .nx-t2-tab svg {
        width: 18px;
        height: 18px;
        pointer-events: none;
      }
      .nx-t2-tab.active {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--cyan, var(--mg-accent-cyan, #2dd4bf));
        color: var(--text, var(--mg-text-primary, #f8fafc));
        box-shadow: inset 0 -2px 0 var(--cyan, var(--mg-accent-cyan, #2dd4bf));
      }
      .nx-t2-body {
        flex: 1;
        min-height: 0;
        background: var(--panel, var(--mg-glass-panel, rgba(13, 20, 36, 0.86)));
        border: 1px solid var(--border, var(--mg-border-subtle, rgba(255, 255, 255, 0.22)));
        border-radius: 12px;
        padding: 10px 12px;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .nx-t2-footer {
        height: 50px;
        flex-shrink: 0;
        background: var(--panel, var(--mg-glass-panel, rgba(13, 20, 36, 0.90)));
        border: 1px solid var(--border, var(--mg-border-subtle, rgba(255, 255, 255, 0.22)));
        border-radius: 12px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .nx-t2-btn {
        min-height: 44px;
        min-width: 44px;
        padding: 0 12px;
        border-radius: 9px;
        border: 1px solid var(--border, var(--mg-border-subtle, rgba(255, 255, 255, 0.28)));
        background: rgba(0, 0, 0, 0.42);
        color: var(--text, var(--mg-text-primary, #f8fafc));
        font-size: 0.75rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .nx-t2-btn.primary {
        padding: 0 20px;
        background: var(--cyan, var(--mg-accent-cyan, #2dd4bf));
        border-color: #ffffff;
        color: #030712;
        font-size: 0.86rem;
        font-weight: 900;
        box-shadow: 0 0 18px rgba(255, 255, 255, 0.25);
      }
      .nx-t2-grid3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .nx-t2-grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .nx-t2-card {
        background: rgba(0, 0, 0, 0.36);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 9px;
        padding: 8px 10px;
      }
      .nx-t2-card h4 {
        font-size: 0.78rem;
        color: var(--cyan, var(--mg-accent-cyan, #2dd4bf));
        margin-bottom: 3px;
      }
      .nx-t2-card p {
        font-size: 0.71rem;
        color: var(--muted, var(--mg-text-secondary, #cbd5e1));
        line-height: 1.45;
      }
      .nx-t2-sprites {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 6px;
      }
      .nx-t2-sp-item {
        background: rgba(0, 0, 0, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        text-align: center;
      }
      .nx-t2-sp-item img {
        width: 40px;
        height: 40px;
        object-fit: contain;
      }
      .nx-t2-input {
        height: 44px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid var(--border, var(--mg-border-subtle, rgba(255, 255, 255, 0.28)));
        border-radius: 8px;
        padding: 0 10px;
        color: var(--text, #f8fafc);
        font-size: 0.76rem;
        flex: 1;
        min-width: 0;
        user-select: text;
      }
      .nx-lan-room-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 6px;
      }
      .nx-lan-room-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 10px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.16);
        transition: border-color 0.14s ease, background 0.14s ease;
      }
      .nx-lan-room-row.joined {
        border-color: var(--cyan, var(--mg-accent-cyan, #2dd4bf));
        background: rgba(255, 255, 255, 0.08);
      }
      .nx-lan-room-info {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .nx-lan-room-title {
        font-size: 0.76rem;
        font-weight: 800;
        color: var(--text, #f8fafc);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nx-lan-room-meta {
        font-size: 0.64rem;
        color: var(--muted, #94a3b8);
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @media (max-height: 440px) {
        #nx-tier2-menu { padding: 5px 8px; gap: 5px; }
        .nx-t2-header { height: 44px; padding: 0 8px; }
        .nx-t2-brand img { width: 24px; height: 24px; }
        .nx-t2-title { font-size: 0.78rem; }
        .nx-t2-sub { display: none; }
        .nx-t2-tab { padding: 0 7px; font-size: 0.66rem; }
        .nx-t2-body { padding: 7px 10px; gap: 6px; }
        .nx-t2-footer { height: 46px; padding: 0 10px; }
      }
      @media (max-width: 720px) {
        .nx-t2-header { padding: 0 6px; gap: 4px; }
        .nx-t2-brand { gap: 5px; }
        .nx-t2-brand img { width: 22px; height: 22px; }
        .nx-t2-title { font-size: 0.72rem; }
        .nx-t2-sub { display: none; }
        .nx-t2-tabs { gap: 3px; }
        .nx-t2-tab { padding: 0 5px; font-size: 0.62rem; min-width: 44px; }
        .nx-t2-grid3 { grid-template-columns: 1fr 1fr; }
        .nx-t2-grid2 { grid-template-columns: 1fr; }
      }

      /* ===== 竖屏强守护弹窗 (继承流派 Design Tokens，严禁硬编码太空黑与赛博青) ===== */
      .nx-guard-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: radial-gradient(circle at 50% 40%, var(--panel, #292524) 0%, var(--void, #171513) 88%);
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
        background: var(--panel, #242a34);
        border: 2px solid var(--cyan, #c48f5a);
        border-radius: 8px;
        padding: 24px 20px;
        text-align: center;
        color: var(--text, #f4efe6);
        box-shadow: 0 20px 60px rgba(0,0,0,0.9);
      }
      .nx-guard-btn {
        min-height: 44px;
        width: 100%;
        border-radius: 6px;
        border: 1px solid var(--gold, #dfc08e);
        background: var(--cyan, #c48f5a);
        color: var(--void, #171513);
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        margin-top: 12px;
      }
      .nx-guard-btn.secondary {
        background: rgba(0, 0, 0, 0.38);
        border-color: var(--border, #4a5462);
        color: var(--text, #f4efe6);
        font-weight: 600;
      }
    `;
    document.head.appendChild(style);

    // Build Tier 2 6-Module Game Menu Hub DOM
    let currentMenuTab = 'home';
    let selectedModeId = meta.modes[0].id;
    let selectedUnitIdx = 0;
    let starCategory = 'all';
    // 帧率：未实测前为 null（显示“采样中”），进入菜单后自动采样真实 rAF 帧率，严禁硬编码 60
    let measuredFps = null;
    function sampleRealFps(durationMs, done) {
      let frames = 0;
      const t0 = performance.now();
      function tick() {
        frames++;
        const el = performance.now() - t0;
        if (el < durationMs) requestAnimationFrame(tick);
        else {
          measuredFps = Math.round((frames * 1000) / el);
          if (done) done();
        }
      }
      requestAnimationFrame(tick);
    }
    sampleRealFps(1000, () => { if (currentMenuTab === 'services') renderTier2Module(); });

    // 局域网模块：离线握手码输入/输出缓存 + 状态变化自动重绘（杜绝后台已断线而前台仍显示“已连接”）
    let lanOfflineOut = '';
    let lanOfflineIn = '';
    let lanOfflineMsg = '';
    let lanRerenderBoundTo = null;
    let lanRerenderPending = false;
    let lanLastSig = '';
    function bindLanAutoRerender() {
      if (!activeLanInstance || lanRerenderBoundTo === activeLanInstance) return;
      lanRerenderBoundTo = activeLanInstance;
      const schedule = () => {
        if (lanRerenderPending) return;
        lanRerenderPending = true;
        setTimeout(() => {
          lanRerenderPending = false;
          if (currentMenuTab !== 'lan' || !menuEl.classList.contains('active') || !activeLanInstance) return;
          const st = activeLanInstance.getStatus();
          const rooms = activeLanInstance.getAvailableRooms();
          const sig = JSON.stringify([st.roomCode, st.role, st.connState, st.connected, st.transport, st.lastError, st.failoverActive, st.autoAiTakeover,
            rooms.map((r) => [r.roomCode, r.players, r.isSelfHost, r.isCurrentJoined, r.isConnecting])]);
          if (sig === lanLastSig) {
            // 结构未变：仅原位刷新实测 RTT，避免整页重绘打断点击
            const rttEl = document.getElementById('nx-lan-rtt');
            if (rttEl) rttEl.textContent = (st.connected && Number.isFinite(st.peerLatencyMs)) ? `${st.peerLatencyMs}ms RTT` : '-- ms';
            if (Number.isFinite(st.peerLatencyMs)) document.querySelectorAll('.nx-lan-live-rtt').forEach((el) => { el.textContent = `${st.peerLatencyMs}ms`; });
            return;
          }
          const focused = document.activeElement;
          if (focused && focused.id === 'nx-lan-offline-in') return; // 输入中不打断
          renderTier2Module();
        }, 120);
      };
      activeLanInstance.onStatus(schedule);
      activeLanInstance.onRooms(schedule);
    }
    const isHttpEnv = window.location.protocol.startsWith('http');
    let swCacheStatus = isHttpEnv
      ? '正在检测 Service Worker 与 CacheStorage...'
      : '本地静态直读模式 (file:// 免缓存就绪 · 资产完整)';

    async function probeSwAndCacheStatus(forceUpdate = false) {
      if (!isHttpEnv) {
        swCacheStatus = '本地静态直读模式 (file:// 免缓存就绪 · 资产完整)';
        return swCacheStatus;
      }
      try {
        let regCount = 0;
        if ('serviceWorker' in navigator) {
          let regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length === 0) {
            try {
              const r = await navigator.serviceWorker.register('../sw.js');
              if (r) regs = [r];
            } catch (_) {}
          }
          regCount = regs.length;
          if (forceUpdate) {
            for (const r of regs) await r.update();
          }
        }
        let cachedEntryCount = 0;
        if ('caches' in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            const c = await caches.open(k);
            const reqs = await c.keys();
            cachedEntryCount += reqs.length;
          }
        }
        if (regCount > 0 && cachedEntryCount > 0) {
          swCacheStatus = `校验通过 · SW已激活 (${cachedEntryCount}项离线资产已缓存)`;
        } else if (cachedEntryCount > 0) {
          swCacheStatus = `CacheStorage 已缓存 ${cachedEntryCount} 项资产`;
        } else {
          swCacheStatus = 'HTTP 在线直连就绪 (SW 首次预热中)';
        }
      } catch (_) {
        swCacheStatus = '本地静态资材已就绪';
      }
      return swCacheStatus;
    }
    probeSwAndCacheStatus(false);

    const menuEl = document.createElement('div');
    menuEl.id = 'nx-tier2-menu';
    // Check URL param: start in Tier 2 Menu by default unless ?tier=3 is explicitly passed
    const urlParams = new URLSearchParams(window.location.search);
    const startInTier3 = urlParams.get('tier') === '3';
    gameplayActive = startInTier3;
    if (!startInTier3) {
      menuEl.classList.add('active');
    } else {
      document.body.classList.add('nx-in-tier3');
    }

    const isHeavyArmory = Array.isArray(meta.rosterUnits) && meta.rosterUnits.length > 0;
    const isStarRoster = Array.isArray(meta.starRosterUnits) && meta.starRosterUnits.length > 0;

    menuEl.innerHTML = `
      <header class="nx-t2-header">
        <div class="nx-t2-brand">
          <button class="nx-t2-btn" id="nx-btn-back-tier1" title="返回第 1 层平台主页">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>
            <span>${(isHeavyArmory || isStarRoster) ? '返回大厅' : '返回主页'}</span>
          </button>
          ${isStarRoster ? `
            <span class="sd-crest-status-led"><span class="dot"></span>Fleet Status</span>
          ` : `
            <img src="${meta.icon}" alt="${meta.name}" />
            <div>
              <div class="nx-t2-title">${isHeavyArmory ? `${meta.name} · 重装军械库` : `${meta.name} · 游戏菜单`}</div>
              <div class="nx-t2-sub">${meta.styleCode}</div>
            </div>
          `}
        </div>
        ${isStarRoster ? `
          <div class="sd-crest-medallion-bar" id="sd-crest-medallion-toggle" title="点击中央双阵营徽章切换：赫利俄斯(金箔) / 格拉基斯(深冷)">
            <span class="sd-crest-side-txt">Star Defender</span>
            <span class="sd-crest-side-txt">(星轨防线)</span>
          </div>
        ` : ''}
        <nav class="nx-t2-tabs" id="nx-t2-tabs">
          ${isStarRoster ? `<span class="sd-crest-status-led arm" style="margin-right:4px;"><span class="dot"></span>Armament Ready</span>` : ''}
          <button class="nx-t2-tab active" data-menu-tab="home" title="${isStarRoster ? '① 舰艇清单' : (isHeavyArmory ? '① 装甲清单' : '① 游戏主页')}" aria-label="${isStarRoster ? '舰艇清单' : (isHeavyArmory ? '装甲清单' : '游戏主页')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button class="nx-t2-tab" data-menu-tab="details" title="${isStarRoster ? '② 舰体百科' : (isHeavyArmory ? '② 战车百科' : '② 游戏详情')}" aria-label="${isStarRoster ? '舰体百科' : (isHeavyArmory ? '战车百科' : '游戏详情')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </button>
          <button class="nx-t2-tab" data-menu-tab="settings" title="${isStarRoster ? '③ 战备设置' : (isHeavyArmory ? '③ 战车设置' : '③ 游戏设置')}" aria-label="${isStarRoster ? '战备设置' : (isHeavyArmory ? '战车设置' : '游戏设置')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button class="nx-t2-tab" data-menu-tab="assets" title="${isStarRoster ? '④ 战备整备' : (isHeavyArmory ? '④ 军械配装' : '④ 资材管理')}" aria-label="${isStarRoster ? '战备整备' : (isHeavyArmory ? '军械配装' : '资材管理')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </button>
          <button class="nx-t2-tab" data-menu-tab="services" title="${isStarRoster ? '⑤ 系统自检' : (isHeavyArmory ? '⑤ 战车维保' : '⑤ 服务管理')}" aria-label="${isStarRoster ? '系统自检' : (isHeavyArmory ? '战车维保' : '服务管理')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </button>
          <button class="nx-t2-tab" data-menu-tab="lan" title="${isStarRoster ? '⑥ 局域舰队' : (isHeavyArmory ? '⑥ 局域车组' : '⑥ 局域网联机')}" aria-label="${isStarRoster ? '局域舰队' : (isHeavyArmory ? '局域车组' : '局域网联机')}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          </button>
        </nav>
      </header>
      <main class="nx-t2-body" id="nx-t2-body"></main>
      <footer class="nx-t2-footer">
        <div style="font-size:0.72rem;color:var(--muted, #94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="nx-t2-status-line">
          运行环境：客户端本地单机 &amp; 局域网 1~5ms 双环境 (零远端通信)
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          ${meta.studioBtnText ? `<button class="nx-t2-btn" id="nx-btn-open-studio">${meta.studioBtnText}</button>` : ''}
          <button class="nx-t2-btn primary" id="nx-btn-enter-tier3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>${isStarRoster ? '点火出击 · 进入轨道防线' : (isHeavyArmory ? '解锁炮塔闭锁 · 投入防线' : '开始游戏 · 进入游玩界面')}</span>
          </button>
        </div>
      </footer>
    `;
    document.body.appendChild(menuEl);

    document.getElementById('sd-crest-medallion-toggle')?.addEventListener('click', () => {
      AudioEngine.upgrade();
      const auth = activeStoreInstance ? activeStoreInstance.getAuth() : resolveAuthIdentity();
      const cur = getSaveDataSafe();
      cur.faction = (cur.faction || 'helios') === 'helios' ? 'glacies' : 'helios';
      document.documentElement.setAttribute('data-faction', cur.faction);
      if (activeStoreInstance) activeStoreInstance.save(cur);
      else localStorage.setItem(`${meta.storagePrefix}${auth.userId}`, JSON.stringify(cur));
      window.dispatchEvent(new CustomEvent('nexus:star-config-changed', { detail: cur }));
      renderTier2Module();
    });

    function getSaveDataSafe() {
      if (activeStoreInstance) {
        return activeStoreInstance.load();
      }
      const auth = resolveAuthIdentity();
      try {
        const raw = localStorage.getItem(`${meta.storagePrefix}${auth.userId}`);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return {};
    }

    function renderTier2Module() {
      const body = document.getElementById('nx-t2-body');
      if (!body) return;
      menuEl.setAttribute('data-active-tab', currentMenuTab);
      const auth = activeStoreInstance ? activeStoreInstance.getAuth() : resolveAuthIdentity();
      const saveData = getSaveDataSafe();
      const lanCode = activeLanInstance ? activeLanInstance.getRoomCode() : (auth.room || 'NX-8820');
      const lanConn = activeLanInstance ? activeLanInstance.isConnected() : false;
      const lanRttRaw = activeLanInstance ? activeLanInstance.getLatency() : null;
      const lanRtt = Number.isFinite(lanRttRaw) ? lanRttRaw : '--';

      const statusLine = document.getElementById('nx-t2-status-line');
      if (statusLine) {
        statusLine.textContent = `统帅: ${auth.nickname} (${auth.userId}) · 房间: ${lanCode} (${lanConn ? 'LAN已连 ' + lanRtt + 'ms' : '本地单机 + AI僚机'}) · 零远端通信`;
      }

      document.querySelectorAll('#nx-t2-tabs .nx-t2-tab').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-menu-tab') === currentMenuTab);
      });

      if (currentMenuTab === 'home') {
        if (isStarRoster) {
          const curFaction = saveData.faction || 'helios';
          document.documentElement.setAttribute('data-faction', curFaction);
          let filteredUnits = meta.starRosterUnits.filter((item, idx) => {
            item._origIdx = idx;
            if (starCategory === 'hull') return item.cat === 'hull';
            if (starCategory === 'module') return item.cat === 'module';
            if (starCategory === 'zerg') return item.cat === 'zerg';
            return true;
          });
          if (starCategory === 'all') {
            filteredUnits = [...filteredUnits].sort((a, b) => {
              const rank = (it) => {
                if (it.cat === 'hull' && (it.faction === curFaction || it.faction === 'all')) return 0;
                if (it.cat === 'module') return 1;
                if (it.cat === 'zerg') return 2;
                return 3;
              };
              return rank(a) - rank(b) || (a._origIdx - b._origIdx);
            });
          }
          if (!filteredUnits.some((it) => it._origIdx === selectedUnitIdx)) {
            selectedUnitIdx = filteredUnits[0] ? filteredUnits[0]._origIdx : 0;
          }
          const u = meta.starRosterUnits[selectedUnitIdx] || meta.starRosterUnits[0];
          const merits = (saveData.currency?.warMerits ?? 1200).toLocaleString();
          const scraps = (saveData.currency?.scraps ?? 150).toLocaleString();
          const wLv = saveData.weaponLv ?? 1;
          const activeHullKey = saveData.selectedHull || 'hullDelta';
          const isCurrentFlagship = u.cat === 'hull' && u.hullKey === activeHullKey && u.faction === curFaction;

          let actionBtnHtml = '';
          if (u.cat === 'hull') {
            actionBtnHtml = `
              <button class="sd-action-pill equip" id="sd-btn-equip-unit">
                ${isCurrentFlagship ? '★ 当前旗舰·已就绪' : '★ 设为出战旗舰'}
              </button>
            `;
          } else if (u.cat === 'module') {
            actionBtnHtml = `
              <button class="sd-action-pill equip" id="sd-btn-equip-unit">
                ⚙ 挂载至旗舰方舱
              </button>
            `;
          } else {
            actionBtnHtml = `
              <button class="sd-action-pill equip" id="sd-btn-equip-unit">
                ⌖ 载入弹道模拟场
              </button>
            `;
          }

          body.innerHTML = `
            <div class="sd-roster-workbench">
              <div class="sd-roster-toolbar">
                <div class="sd-faction-switch">
                  <button class="sd-pill-btn faction-helios ${curFaction === 'helios' ? 'active' : ''}" data-sd-faction="helios">
                    <span>☀ 赫利俄斯 (24K金箔)</span>
                  </button>
                  <button class="sd-pill-btn faction-glacies ${curFaction === 'glacies' ? 'active' : ''}" data-sd-faction="glacies">
                    <span>✦ 格拉基斯 (深冷超导)</span>
                  </button>
                </div>
                <div class="sd-cat-pills">
                  <button class="sd-pill-btn ${starCategory === 'all' ? 'active' : ''}" data-sd-cat="all">全部 (${meta.starRosterUnits.length})</button>
                  <button class="sd-pill-btn ${starCategory === 'hull' ? 'active' : ''}" data-sd-cat="hull">星舰与战机 (${meta.starRosterUnits.filter(x => x.cat === 'hull').length})</button>
                  <button class="sd-pill-btn ${starCategory === 'module' ? 'active' : ''}" data-sd-cat="module">方舱 (${meta.starRosterUnits.filter(x => x.cat === 'module').length})</button>
                  <button class="sd-pill-btn ${starCategory === 'zerg' ? 'active' : ''}" data-sd-cat="zerg">虫群 (${meta.starRosterUnits.filter(x => x.cat === 'zerg').length})</button>
                </div>
              </div>

              <div class="sd-roster-main">
                <div class="sd-roster-grid">
                  ${filteredUnits.map((unit) => `
                    <div class="sd-unit-card ${unit._origIdx === selectedUnitIdx ? 'selected' : ''}" data-cat="${unit.cat}" data-unit-idx="${unit._origIdx}">
                      <div class="sd-unit-card-head">
                        <span>${unit.no}</span>
                        <span>${unit.badge}</span>
                      </div>
                      <div class="sd-unit-svg-wrap">
                        <img src="../assets/${meta.id}/sprites/${unit.file}?v=20261102a" alt="${unit.name}" />
                      </div>
                      <div class="sd-unit-card-foot">
                        <span>${unit.name}</span>
                        <small>${unit.weight}</small>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="sd-inspector-dock" id="sd-insp-preview-box" data-unit-cat="${u.cat}" data-unit-file="${u.file}">
                  <!-- 顶部金铭牌标题 -->
                  <div class="sd-stage-top-plaque">
                    <div style="min-width:0;">
                      <div class="sd-insp-title">${u.fullTitle}</div>
                      <div class="sd-insp-code">${u.subCode}</div>
                    </div>
                    <span class="sd-insp-badge">${u.no} · Lv.${wLv}</span>
                  </div>

                  <!-- 中左：24K金刻度陀飞轮星盘内嵌巨幅实体剖析区 -->
                  <div class="sd-astrolabe-specimen-well">
                    <div class="sd-insp-rig-stage" id="sd-insp-rig-stage">
                      <img src="../assets/${meta.id}/sprites/${u.file}?v=20261102a" alt="${u.name}" />
                    </div>
                  </div>

                  <!-- 中右：三联圆柱形蓝宝石发光真空管遥测计 (Armor / Ballistics / Reactor Core) -->
                  <div class="sd-vacuum-tubes-stack">
                    <div class="sd-vacuum-tube">
                      <div class="sd-tube-plasma-bar">
                        <div class="sd-tube-plasma-fill" style="width:${u.armorPct}%"></div>
                      </div>
                      <div class="sd-tube-label-row">
                        <span class="sd-tube-name">Armor · ${u.cat === 'zerg' ? '甲壳' : '装甲'}</span>
                        <span class="sd-tube-val">${u.armorVal}</span>
                      </div>
                    </div>

                    <div class="sd-vacuum-tube">
                      <div class="sd-tube-plasma-bar">
                        <div class="sd-tube-plasma-fill ballistics" style="width:${u.velPct}%"></div>
                      </div>
                      <div class="sd-tube-label-row">
                        <span class="sd-tube-name">Ballistics · ${u.cat === 'zerg' ? '机动' : '弹道'}</span>
                        <span class="sd-tube-val">${u.velVal}</span>
                      </div>
                    </div>

                    <div class="sd-vacuum-tube">
                      <div class="sd-tube-plasma-bar">
                        <div class="sd-tube-plasma-fill reactor" style="width:${u.pwrPct}%"></div>
                      </div>
                      <div class="sd-tube-label-row">
                        <span class="sd-tube-name">Reactor Core · ${u.cat === 'zerg' ? '能级' : '堆芯'}</span>
                        <span class="sd-tube-val">${u.pwrVal}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 左下角(陀飞轮旁)：三色挂点宝石铭牌与船坞改装/旗舰切换按钮组 -->
                  <div class="sd-stage-bottom-left-controls">
                    <div class="sd-hardpoint-strip">
                      <span class="sd-hp-tag w">红W</span>
                      <span class="sd-hp-tag b">绿B</span>
                      <span class="sd-hp-tag p">紫P</span>
                      <span style="color:#fde68a;overflow:hidden;text-overflow:ellipsis;">${u.zoneSpec} · 战功:${merits}</span>
                    </div>
                    <div class="sd-horology-sub-btns">
                      ${actionBtnHtml}
                      <button class="sd-action-pill" id="sd-btn-open-dockyard">
                        ⚙ 船坞 3 栏改装
                      </button>
                    </div>
                  </div>

                  <!-- 右下角缺口：3D 滚花 24K 金 T 型推杆与圆形 ENGAGE 点火表冠鼓轮 -->
                  <button class="sd-engage-throttle-widget" id="sd-btn-throttle-engage" title="点火出击 · 进入轨道防线">
                    <div class="sd-engage-drum-label">
                      <strong>ENGAGE</strong>
                      <span>点火出击</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          `;

          body.querySelectorAll('[data-sd-faction]').forEach((btn) => {
            btn.addEventListener('click', () => {
              AudioEngine.upgrade();
              const nextFac = btn.getAttribute('data-sd-faction') || 'helios';
              document.documentElement.setAttribute('data-faction', nextFac);
              const cur = getSaveDataSafe();
              cur.faction = nextFac;
              if (activeStoreInstance) activeStoreInstance.save(cur);
              else localStorage.setItem(`${meta.storagePrefix}${auth.userId}`, JSON.stringify(cur));
              window.dispatchEvent(new CustomEvent('nexus:star-config-changed', { detail: cur }));
              renderTier2Module();
            });
          });

          body.querySelectorAll('[data-sd-cat]').forEach((btn) => {
            btn.addEventListener('click', () => {
              AudioEngine.tap();
              starCategory = btn.getAttribute('data-sd-cat') || 'all';
              renderTier2Module();
            });
          });

          body.querySelectorAll('[data-unit-idx]').forEach((card) => {
            card.addEventListener('click', () => {
              AudioEngine.tap();
              selectedUnitIdx = Number(card.getAttribute('data-unit-idx')) || 0;
              renderTier2Module();
            });
          });

          document.getElementById('sd-btn-equip-unit')?.addEventListener('click', () => {
            AudioEngine.upgrade();
            const cur = getSaveDataSafe();
            if (u.cat === 'hull') {
              cur.selectedHull = u.hullKey || 'hullDelta';
              cur.faction = u.faction || 'helios';
              document.documentElement.setAttribute('data-faction', cur.faction);
              if (activeStoreInstance) activeStoreInstance.save(cur);
              else localStorage.setItem(`${meta.storagePrefix}${auth.userId}`, JSON.stringify(cur));
              window.dispatchEvent(new CustomEvent('nexus:star-config-changed', { detail: cur }));
              renderTier2Module();
            } else if (u.cat === 'module') {
              if (u.zone === 'B' || u.modKey === 'hangar' || u.modKey === 'shield') {
                cur.internalBay = u.modKey;
              } else if (u.zone === 'P' || u.modKey === 'thrusterCompound' || u.modKey === 'thrusterVector' || u.modKey === 'thrusterCruise') {
                cur.engineType = u.modKey;
              } else if (u.zone !== 'CORE' && u.modKey && u.modKey !== 'station') {
                cur.activeModule = u.modKey;
              }
              if (activeStoreInstance) activeStoreInstance.save(cur);
              else localStorage.setItem(`${meta.storagePrefix}${auth.userId}`, JSON.stringify(cur));
              window.dispatchEvent(new CustomEvent('nexus:star-config-changed', { detail: cur }));
              if (enterTier3GameplayFn) enterTier3GameplayFn();
              if (meta.triggerStudio) meta.triggerStudio();
            } else {
              if (enterTier3GameplayFn) enterTier3GameplayFn();
            }
          });

          document.getElementById('sd-btn-open-dockyard')?.addEventListener('click', () => {
            AudioEngine.upgrade();
            if (enterTier3GameplayFn) enterTier3GameplayFn();
            if (meta.triggerStudio) meta.triggerStudio();
          });

          document.getElementById('sd-btn-throttle-engage')?.addEventListener('click', () => {
            AudioEngine.upgrade();
            if (enterTier3GameplayFn) enterTier3GameplayFn();
          });

          document.getElementById('sd-btn-mode-toggle')?.addEventListener('click', () => {
            AudioEngine.tap();
            selectedModeId = selectedModeId === 'solo-campaign' ? 'lan-coop' : 'solo-campaign';
            renderTier2Module();
          });

          window.dispatchEvent(new CustomEvent('nexus:tier2-rendered', {
            detail: { tab: currentMenuTab, unitFile: u.file }
          }));
          return;
        }
        if (isHeavyArmory) {
          const u = meta.rosterUnits[selectedUnitIdx] || meta.rosterUnits[0];
          const coins = (saveData.currency?.tankCoins ?? 500).toLocaleString();
          const rk = saveData.rank ?? 1;
          body.innerHTML = `
            <div class="tb-roster-workbench">
              <div class="tb-roster-grid">
                ${meta.rosterUnits.map((unit, idx) => `
                  <div class="tb-unit-card ${idx === selectedUnitIdx ? 'selected' : ''}" data-unit-idx="${idx}">
                    <div class="tb-unit-card-head">
                      <span>${unit.no}</span>
                      <span>${unit.badge}</span>
                    </div>
                    <div class="tb-unit-svg-wrap">
                      <img src="../assets/${meta.id}/sprites/${unit.file}?v=20261031b" alt="${unit.name}" />
                    </div>
                    <div class="tb-unit-card-foot">
                      <span>${unit.name}</span>
                      <small>${unit.weight}</small>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="tb-inspector-dock tb-rivets">
                <div>
                  <div class="tb-insp-header">
                    <div>
                      <div class="tb-insp-title">${u.fullTitle}</div>
                      <div class="tb-insp-code">${u.subCode}</div>
                    </div>
                    <span style="font-size:0.62rem;font-family:Consolas,monospace;color:#c48f5a;font-weight:700;">${u.ammo}</span>
                  </div>

                  <div class="tb-insp-preview-box" id="tb-insp-preview-box" data-unit-file="${u.file}">
                    <div id="tb-insp-rig-stage" style="width:60px;height:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative;">
                      <img src="../assets/${meta.id}/sprites/${u.file}?v=20261031c" alt="${u.name}" />
                    </div>
                    <div class="tb-insp-specs">
                      <div class="tb-spec-line">
                        <span class="lbl">首上甲</span>
                        <div class="tb-spec-track"><div class="tb-spec-fill" style="width:${u.armorPct}%"></div></div>
                        <span class="tb-spec-val">${u.armorVal}</span>
                      </div>
                      <div class="tb-spec-line">
                        <span class="lbl">膛压初速</span>
                        <div class="tb-spec-track"><div class="tb-spec-fill brass" style="width:${u.velPct}%"></div></div>
                        <span class="tb-spec-val">${u.velVal}</span>
                      </div>
                      <div class="tb-spec-line">
                        <span class="lbl">功率重量</span>
                        <div class="tb-spec-track"><div class="tb-spec-fill" style="width:${u.pwrPct}%"></div></div>
                        <span class="tb-spec-val">${u.pwrVal}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:6px;">
                  <div style="display:flex;justify-content:space-between;font-size:0.66rem;font-family:Consolas,monospace;color:#9aa5b4;padding:0 2px;">
                    <span>军械币储备: <strong style="color:#e0be99;">${coins}</strong></span>
                    <span>当前战车军衔: <strong style="color:#d6deea;">Rank ${rk}</strong></span>
                  </div>
                  <div class="tb-mode-selector">
                    ${meta.modes.map((md) => `
                      <div class="tb-mode-pill ${selectedModeId === md.id ? 'active' : ''}" data-mode-select="${md.id}">
                        ${selectedModeId === md.id ? '● ' : '○ '}${md.name}
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          `;
          body.querySelectorAll('[data-unit-idx]').forEach((card) => {
            card.addEventListener('click', () => {
              AudioEngine.tap();
              selectedUnitIdx = Number(card.getAttribute('data-unit-idx')) || 0;
              renderTier2Module();
            });
          });
          body.querySelectorAll('[data-mode-select]').forEach((pill) => {
            pill.addEventListener('click', () => {
              AudioEngine.tap();
              selectedModeId = pill.getAttribute('data-mode-select');
              if (selectedModeId && selectedModeId.includes('lan')) {
                currentMenuTab = 'lan';
              }
              renderTier2Module();
            });
          });
          window.dispatchEvent(new CustomEvent('nexus:tier2-rendered', {
            detail: { tab: currentMenuTab, unitFile: u.file }
          }));
          return;
        }
        const metrics = meta.getMetrics(saveData);
        body.innerHTML = `
          <div class="nx-t2-grid3">
            ${metrics.map((m) => `
              <div class="nx-t2-card">
                <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">${m.label}</div>
                <div style="font-size:0.88rem;font-weight:800;color:${m.gold ? 'var(--gold,#fbbf24)' : 'var(--text,#f8fafc)'};margin-top:2px;">${m.val}</div>
              </div>
            `).join('')}
          </div>
          <div class="nx-t2-grid2">
            ${meta.modes.map((md) => `
              <div class="nx-t2-card" data-mode-select="${md.id}" style="cursor:pointer;border-color:${selectedModeId === md.id ? 'var(--cyan,#f59e0b)' : 'rgba(255,255,255,0.14)'};">
                <h4>${selectedModeId === md.id ? '● ' : '○ '}${md.name}</h4>
                <p>${md.desc}</p>
              </div>
            `).join('')}
          </div>
          <div class="nx-t2-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <img src="${meta.preview}" alt="${meta.name}" style="width:92px;height:44px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.2);flex-shrink:0;" />
              <div style="min-width:0;">
                <h4>${meta.name} (${meta.en}) · 三层网站结构标准中枢</h4>
                <p>${meta.tagline}</p>
              </div>
            </div>
            <span style="font-size:0.7rem;color:var(--cyan,#f59e0b);font-weight:700;white-space:nowrap;">60Hz 就绪</span>
          </div>
        `;
        body.querySelectorAll('[data-mode-select]').forEach((card) => {
          card.addEventListener('click', () => {
            AudioEngine.tap();
            selectedModeId = card.getAttribute('data-mode-select');
            if (selectedModeId && selectedModeId.includes('lan')) {
              currentMenuTab = 'lan';
            }
            renderTier2Module();
          });
        });
      } else if (currentMenuTab === 'details') {
        body.innerHTML = `
          <div style="font-size:0.74rem;font-weight:800;color:var(--cyan,#f59e0b);">
            核心物理与数值机制百科 (零远端通信 · 100% 客户端确定性解算)
          </div>
          <div class="nx-t2-grid2">
            ${meta.formulas.map((f) => `
              <div class="nx-t2-card">
                <h4>${f.title}</h4>
                <p>${f.desc}</p>
              </div>
            `).join('')}
          </div>
          <div style="font-size:0.74rem;font-weight:800;color:var(--gold,#fbbf24);margin-top:2px;">
            本游戏专属多层 SVG 矢量贴图与同源骨骼图鉴 (${meta.sprites.length} 项核心实体)
          </div>
          <div class="nx-t2-sprites">
            ${meta.sprites.map((sp) => `
              <div class="nx-t2-sp-item">
                <img src="../assets/${meta.id}/sprites/${sp.file}?v=20261101" alt="${sp.name}" />
                <div style="font-size:0.68rem;font-weight:700;color:var(--text,#f8fafc);white-space:nowrap;">${sp.name}</div>
                <div style="font-size:0.6rem;color:var(--muted,#94a3b8);white-space:nowrap;">${sp.role}</div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (currentMenuTab === 'settings') {
        body.innerHTML = `
          <div class="nx-t2-grid2">
            <div class="nx-t2-card">
              <h4>离散瞬态音效开关 (严格 &le; 0.20s 衰减防噪音铁律)</h4>
              <p style="margin-bottom:8px;">全武器与交互采用单次离散瞬态脉冲合成，杜绝任何持续长音或循环嗡鸣。</p>
              <div style="display:flex;gap:8px;">
                <button class="nx-t2-btn" id="nx-set-mute-toggle" style="border-color:var(--cyan,#f59e0b);">
                  ${userSettings.muted ? '当前：已静音 (点击开启瞬态音效)' : '当前：瞬态音效已开启 (点击静音)'}
                </button>
                <button class="nx-t2-btn" id="nx-set-vol-cycle">
                  脉冲音量档位：${Math.round(userSettings.volume * 100)}%
                </button>
              </div>
            </div>
            <div class="nx-t2-card">
              <h4>移动端全屏横屏操控与震动反馈</h4>
              <p style="margin-bottom:8px;">全部触控按钮满足 &ge; 44&times;44px 最小物理命中热区，适配刘海与灵动岛安全区。</p>
              <div style="display:flex;gap:8px;">
                <button class="nx-t2-btn" id="nx-set-haptic-toggle">
                  震动反馈：${userSettings.haptics ? '已开启' : '已关闭'}
                </button>
                <button class="nx-t2-btn" id="nx-set-layout-toggle">
                  触控布局：${userSettings.touchLayout === 'standard' ? '标准横屏双区' : '紧凑拇指热区'}
                </button>
              </div>
            </div>
          </div>
          <div class="nx-t2-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div>
              <h4>60fps 渲染粒子、光影档位与战术辅助线</h4>
              <p>针对移动设备 GPU 优化：支持切换高精满帧/竞技省电粒子档位，以及开关弹道散布辅助线。</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="nx-t2-btn" id="nx-set-particle-toggle">
                画质档位：${userSettings.particleTier === 'high' ? '60Hz 高精满帧' : '竞技省电模式'}
              </button>
              <button class="nx-t2-btn" id="nx-set-guide-toggle">
                战术辅助线：${userSettings.guideLines !== false ? '已开启' : '已关闭'}
              </button>
            </div>
          </div>
        `;
        document.getElementById('nx-set-mute-toggle')?.addEventListener('click', () => {
          userSettings.muted = !userSettings.muted;
          saveSettings(userSettings);
          if (!userSettings.muted) AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-set-vol-cycle')?.addEventListener('click', () => {
          userSettings.volume = userSettings.volume >= 1.0 ? 0.65 : (userSettings.volume >= 0.6 ? 0.35 : 1.0);
          saveSettings(userSettings);
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-set-haptic-toggle')?.addEventListener('click', () => {
          userSettings.haptics = !userSettings.haptics;
          saveSettings(userSettings);
          if (userSettings.haptics && navigator.vibrate) navigator.vibrate(18);
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-set-layout-toggle')?.addEventListener('click', () => {
          userSettings.touchLayout = userSettings.touchLayout === 'standard' ? 'compact' : 'standard';
          saveSettings(userSettings);
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-set-particle-toggle')?.addEventListener('click', () => {
          userSettings.particleTier = userSettings.particleTier === 'high' ? 'eco' : 'high';
          saveSettings(userSettings);
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-set-guide-toggle')?.addEventListener('click', () => {
          userSettings.guideLines = userSettings.guideLines === false;
          saveSettings(userSettings);
          AudioEngine.tap();
          renderTier2Module();
        });
      } else if (currentMenuTab === 'assets') {
        const metrics = meta.getMetrics(saveData);
        const nsKey = `${meta.storagePrefix}${auth.userId}`;
        const encodedSave = btoa(encodeURIComponent(JSON.stringify(saveData)));
        body.innerHTML = `
          <div class="nx-t2-grid3">
            ${metrics.map((m) => `
              <div class="nx-t2-card">
                <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">${m.label}</div>
                <div style="font-size:0.88rem;font-weight:800;color:${m.gold ? 'var(--gold,#fbbf24)' : 'var(--text,#f8fafc)'};margin-top:2px;">${m.val}</div>
              </div>
            `).join('')}
          </div>
          <div class="nx-t2-grid2">
            <div class="nx-t2-card">
              <h4>统帅身份切换与战备资材整备 (${escapeHtml(nsKey)})</h4>
              <p style="margin-bottom:8px;">100% 客户端本地隔离持久化存储。支持一键切换最高统帅调试档 (admin) 或领取本地战备补给：</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="nx-t2-btn" id="nx-asset-bonus-btn" style="border-color:var(--gold,#fbbf24);color:var(--gold,#fbbf24);">
                  + 领取本地战备补给
                </button>
                <button class="nx-t2-btn" id="nx-asset-admin-btn">
                  ${auth.isAdmin ? '切换至标准指挥官档' : '切换 admin 满配统帅档'}
                </button>
              </div>
            </div>
            <div class="nx-t2-card">
              <h4>本地存档备份码导出与恢复 (零远端服务器依赖)</h4>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <input type="text" class="nx-t2-input" id="nx-asset-save-input" value="${encodedSave}" />
                <button class="nx-t2-btn" id="nx-asset-copy-btn">复制存档</button>
                <button class="nx-t2-btn" id="nx-asset-import-btn">导入恢复</button>
              </div>
            </div>
          </div>
        `;
        document.getElementById('nx-asset-bonus-btn')?.addEventListener('click', () => {
          const cur = getSaveDataSafe();
          meta.grantBonus(cur);
          if (activeStoreInstance) activeStoreInstance.save(cur);
          else localStorage.setItem(nsKey, JSON.stringify(cur));
          AudioEngine.upgrade();
          renderTier2Module();
        });
        document.getElementById('nx-asset-admin-btn')?.addEventListener('click', () => {
          AudioEngine.upgrade();
          if (activeStoreInstance) {
            activeStoreInstance.switchProfile(auth.isAdmin ? 'commander' : 'admin');
          }
          window.location.reload();
        });
        document.getElementById('nx-asset-copy-btn')?.addEventListener('click', () => {
          const val = document.getElementById('nx-asset-save-input')?.value || '';
          navigator.clipboard?.writeText(val).catch(() => {});
          AudioEngine.win();
        });
        document.getElementById('nx-asset-import-btn')?.addEventListener('click', () => {
          try {
            const rawStr = document.getElementById('nx-asset-save-input')?.value.trim();
            const parsed = JSON.parse(decodeURIComponent(atob(rawStr)));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              delete parsed.__proto__;
              delete parsed.constructor;
              delete parsed.prototype;
              if (parsed.currency && typeof parsed.currency === 'object') {
                Object.keys(parsed.currency).forEach((k) => {
                  const v = Number(parsed.currency[k]);
                  parsed.currency[k] = Number.isFinite(v) ? Math.max(0, Math.min(9999999, Math.floor(v))) : 0;
                });
              }
              if (parsed.rank !== undefined) {
                const rk = Number(parsed.rank);
                parsed.rank = Number.isFinite(rk) ? Math.max(1, Math.min(4, Math.floor(rk))) : 1;
              }
              if (parsed.stats && typeof parsed.stats === 'object') {
                Object.keys(parsed.stats).forEach((k) => {
                  const v = Number(parsed.stats[k]);
                  parsed.stats[k] = Number.isFinite(v) ? Math.max(0, Math.min(99999999, Math.floor(v))) : 0;
                });
              }
              if (activeStoreInstance) activeStoreInstance.save(parsed);
              else localStorage.setItem(nsKey, JSON.stringify(parsed));
              AudioEngine.win();
              window.location.reload();
            }
          } catch (_) {
            AudioEngine.warn();
          }
        });
      } else if (currentMenuTab === 'services') {
        let storageBytes = 0;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            storageBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
          }
        } catch (_) {}
        body.innerHTML = `
          <div class="nx-t2-grid3">
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">离线 PWA 资源服务</div>
              <div id="nx-srv-sw-status" style="font-size:0.82rem;font-weight:800;color:#10b981;margin-top:2px;">${swCacheStatus}</div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">客户端物理/渲染帧率基准</div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--cyan,#f59e0b);margin-top:2px;">${Number.isFinite(measuredFps) ? measuredFps + ' FPS (实测 rAF 帧率)' : '采样中...'}</div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">本地存储占用 / 音频节点</div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--gold,#fbbf24);margin-top:2px;">${(storageBytes / 1024).toFixed(1)} KB · Audio: ${AudioEngine.getState()}</div>
            </div>
          </div>
          <div class="nx-t2-grid2">
            <div class="nx-t2-card">
              <h4>PWA 离线缓存校验与刷新 (Service Worker &amp; CacheStorage)</h4>
              <p style="margin-bottom:8px;">静态资源、SVG 矢量精灵与骨骼动画脚本均缓存在本地浏览器，支持无外网离线启动。</p>
              <button class="nx-t2-btn" id="nx-svc-refresh-sw" style="border-color:var(--cyan,#f59e0b);">
                校验并刷新本地离线缓存
              </button>
            </div>
            <div class="nx-t2-card">
              <h4>离散瞬态音频自愈与 60Hz 帧率基准自检</h4>
              <p style="margin-bottom:8px;">若移动浏览器切后台后声音挂起，可一键重置 Web Audio 瞬态合成器或重测帧率。</p>
              <div style="display:flex;gap:8px;">
                <button class="nx-t2-btn" id="nx-svc-heal-audio">重置音频上下文并试音</button>
                <button class="nx-t2-btn" id="nx-svc-bench-fps">执行 60Hz 帧率基准诊断</button>
              </div>
            </div>
          </div>
        `;
        document.getElementById('nx-svc-refresh-sw')?.addEventListener('click', async () => {
          AudioEngine.tap();
          swCacheStatus = '正在校验离线运行环境与 CacheStorage...';
          renderTier2Module();
          await probeSwAndCacheStatus(true);
          AudioEngine.win();
          renderTier2Module();
        });
        document.getElementById('nx-svc-heal-audio')?.addEventListener('click', () => {
          AudioEngine.resetContext();
          renderTier2Module();
        });
        document.getElementById('nx-svc-bench-fps')?.addEventListener('click', () => {
          AudioEngine.tap();
          let frames = 0;
          const t0 = performance.now();
          function sample() {
            frames++;
            if (performance.now() - t0 < 500) {
              requestAnimationFrame(sample);
            } else {
              measuredFps = Math.round((frames * 1000) / (performance.now() - t0));
              AudioEngine.win();
              renderTier2Module();
            }
          }
          requestAnimationFrame(sample);
        });
      } else if (currentMenuTab === 'lan') {
        if (!activeLanInstance) {
          activeLanInstance = createLanSession(gameId);
        }
        bindLanAutoRerender();
        const st = activeLanInstance.getStatus ? activeLanInstance.getStatus() : {};
        const autoAi = activeLanInstance.getAutoAiTakeover();
        const rooms = activeLanInstance.getAvailableRooms ? activeLanInstance.getAvailableRooms() : [];
        const otherRooms = rooms.filter((r) => !r.isSelfHost);
        const curRole = st.role || 'host';
        const connStateText = {
          hosting: '房间广播中 · 等待客机加入',
          connecting: '握手连接中...',
          connected: '已联机协同',
          disconnected: '对端已断开 · 房间重新广播中',
          failed: '加入失败 · 已恢复为本机房主'
        }[st.connState] || '房间广播中';
        const transportText = st.transport === 'webrtc' ? 'WebRTC DataChannel 直连'
          : st.transport === 'broadcast' ? '同设备 BroadcastChannel (WebRTC 协商中)'
          : '未连接';
        const rttText = (st.connected && Number.isFinite(st.peerLatencyMs)) ? `${st.peerLatencyMs}ms RTT` : '-- ms';
        const stateColor = st.connected ? '#10b981' : (st.connState === 'failed' || st.connState === 'disconnected' ? '#f43f5e' : 'var(--gold,#fbbf24)');
        lanLastSig = JSON.stringify([st.roomCode, st.role, st.connState, st.connected, st.transport, st.lastError, st.failoverActive, st.autoAiTakeover,
          rooms.map((r) => [r.roomCode, r.players, r.isSelfHost, r.isCurrentJoined, r.isConnecting])]);
        body.innerHTML = `
          <div class="nx-t2-grid3">
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">当前房间状态 (${curRole === 'host' ? '房主 Host' : '客机 Client'})</div>
              <div style="font-size:0.88rem;font-weight:900;color:var(--cyan,#f59e0b);letter-spacing:0.04em;margin-top:2px;">
                ${escapeHtml(st.roomCode || lanCode)}
              </div>
              <div style="font-size:0.7rem;font-weight:700;color:${stateColor};margin-top:2px;">${escapeHtml(connStateText)}${st.peerName && st.connected ? ' · 对端: ' + escapeHtml(st.peerName) : ''}</div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">实测往返延迟 / 传输通道</div>
              <div id="nx-lan-rtt" style="font-size:0.82rem;font-weight:800;color:${st.connected ? '#10b981' : 'var(--muted,#94a3b8)'};margin-top:2px;">${escapeHtml(rttText)}</div>
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);margin-top:2px;">${escapeHtml(transportText)}</div>
            </div>
            <div class="nx-t2-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div>
                <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">3.0s 断线 AI 僚机接管</div>
                <div style="font-size:0.74rem;font-weight:800;color:${autoAi ? '#10b981' : 'var(--muted,#94a3b8)'};margin-top:2px;">${autoAi ? '已开启' : '已关闭'}${st.failoverActive ? ' · AI 接管中' : ''}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="nx-t2-btn" id="nx-lan-toggle-ai">${autoAi ? '关闭' : '开启'}</button>
                <button class="nx-t2-btn" id="nx-lan-new-room" style="border-color:var(--cyan,#f59e0b);">${curRole === 'client' || st.connected ? '退出并新建' : '+ 新建房间'}</button>
              </div>
            </div>
          </div>
          ${st.lastError ? `<div class="nx-t2-card" style="border-color:#f43f5e;color:#fda4af;font-size:0.7rem;">${escapeHtml(st.lastError)}</div>` : ''}

          <div class="nx-t2-grid2">
            <div class="nx-t2-card" style="display:flex;flex-direction:column;gap:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div>
                  <h4 style="margin-bottom:1px;">同设备房间列表 (实时信标 · ${otherRooms.length} 个其他房间)</h4>
                  <p>仅列出本设备其他标签页/窗口真实广播的房间；跨手机联机请使用右侧离线握手码。</p>
                </div>
                <button class="nx-t2-btn" id="nx-lan-refresh-btn" style="border-color:var(--gold,#fbbf24);color:var(--gold,#fbbf24);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  <span>刷新 (${rooms.length})</span>
                </button>
              </div>
              <div class="nx-lan-room-list" id="nx-lan-room-list">
                ${rooms.length === 0 ? `<div style="font-size:0.7rem;color:var(--muted,#94a3b8);padding:8px 2px;">暂无已发现的房间。</div>` : ''}
                ${rooms.map((rm) => {
                  const isJoined = rm.isCurrentJoined;
                  const isSelf = rm.isSelfHost;
                  const rtt = Number.isFinite(rm.rttMs) ? `${rm.rttMs}ms` : '加入后实测';
                  const btnText = isJoined ? '已加入 · 进入战局'
                    : rm.isConnecting ? '握手中...'
                    : isSelf ? '本机房主 · 立即开局'
                    : (rm.players === '2/2' ? '房间已满' : '加入房间');
                  return `
                    <div class="nx-lan-room-row ${isJoined ? 'joined' : ''}">
                      <div class="nx-lan-room-info">
                        <div class="nx-lan-room-title">
                          <span style="color:var(--cyan,#f59e0b);font-family:Consolas,monospace;">[${escapeHtml(rm.roomCode)}]</span>
                          <span>${escapeHtml(rm.title)}</span>
                        </div>
                        <div class="nx-lan-room-meta">
                          <span>房主: ${escapeHtml(rm.hostName)}</span>
                          <span>·</span>
                          <span>人数 ${escapeHtml(rm.players)} · <span class="${Number.isFinite(rm.rttMs) ? 'nx-lan-live-rtt' : ''}">${escapeHtml(rtt)}</span></span>
                        </div>
                      </div>
                      <button class="nx-t2-btn" data-lan-join-room="${escapeHtml(rm.roomCode)}" ${(rm.isConnecting || (!isSelf && !isJoined && rm.players === '2/2')) ? 'disabled' : ''} style="border-color:${isJoined ? '#10b981' : 'var(--cyan,#f59e0b)'};color:${isJoined ? '#10b981' : 'var(--text,#f8fafc)'};">
                        ${btnText}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="nx-t2-card" style="display:flex;flex-direction:column;gap:6px;">
              <h4 style="margin-bottom:1px;">跨设备离线 SDP 握手码 (同 Wi-Fi / 手机热点 · 零公网)</h4>
              <p>房主：① 生成邀请码发给客机 → ③ 粘贴客机返回的应答码。客机：② 粘贴邀请码生成应答码回传。</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="nx-t2-btn" id="nx-lan-offline-offer">① 房主生成邀请码</button>
                <button class="nx-t2-btn" id="nx-lan-offline-copy" ${lanOfflineOut ? '' : 'disabled'}>复制输出码</button>
              </div>
              <textarea id="nx-lan-offline-out" readonly placeholder="此处显示本机生成的邀请码 / 应答码" style="width:100%;min-height:44px;max-height:64px;font-size:0.6rem;font-family:Consolas,monospace;background:rgba(0,0,0,0.35);color:var(--text,#f8fafc);border:1px solid rgba(148,163,184,0.3);border-radius:6px;padding:4px;resize:none;">${escapeHtml(lanOfflineOut)}</textarea>
              <textarea id="nx-lan-offline-in" placeholder="粘贴对方发来的邀请码（客机）或应答码（房主）" style="width:100%;min-height:44px;max-height:64px;font-size:0.6rem;font-family:Consolas,monospace;background:rgba(0,0,0,0.35);color:var(--text,#f8fafc);border:1px solid rgba(148,163,184,0.3);border-radius:6px;padding:4px;resize:none;">${escapeHtml(lanOfflineIn)}</textarea>
              <button class="nx-t2-btn" id="nx-lan-offline-apply">② / ③ 提交对方握手码</button>
              ${lanOfflineMsg ? `<div style="font-size:0.66rem;color:var(--muted,#94a3b8);">${escapeHtml(lanOfflineMsg)}</div>` : ''}
            </div>
          </div>
        `;
        document.getElementById('nx-lan-toggle-ai')?.addEventListener('click', () => {
          activeLanInstance.setAutoAiTakeover(!activeLanInstance.getAutoAiTakeover());
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-lan-new-room')?.addEventListener('click', () => {
          if (activeLanInstance.leave) activeLanInstance.leave();
          lanOfflineOut = ''; lanOfflineIn = ''; lanOfflineMsg = '';
          AudioEngine.upgrade();
          renderTier2Module();
        });
        document.getElementById('nx-lan-refresh-btn')?.addEventListener('click', () => {
          activeLanInstance.refreshRooms();
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-lan-offline-in')?.addEventListener('input', (e) => {
          lanOfflineIn = e.target.value;
        });
        document.getElementById('nx-lan-offline-offer')?.addEventListener('click', async () => {
          AudioEngine.tap();
          lanOfflineMsg = '正在收集局域网 ICE 候选并生成邀请码...';
          renderTier2Module();
          try {
            lanOfflineOut = await activeLanInstance.createOfflineOffer();
            lanOfflineMsg = '邀请码已生成，请发送给客机，并等待客机回传应答码。';
          } catch (err) {
            lanOfflineMsg = '生成失败：' + (err && err.message ? err.message : err);
          }
          renderTier2Module();
        });
        document.getElementById('nx-lan-offline-copy')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(lanOfflineOut);
            lanOfflineMsg = '已复制到剪贴板。';
          } catch (_) {
            const ta = document.getElementById('nx-lan-offline-out');
            if (ta) { ta.select(); try { document.execCommand('copy'); lanOfflineMsg = '已复制到剪贴板。'; } catch (__) { lanOfflineMsg = '请手动长按选择复制。'; } }
          }
          AudioEngine.tap();
          renderTier2Module();
        });
        document.getElementById('nx-lan-offline-apply')?.addEventListener('click', async () => {
          const code = (document.getElementById('nx-lan-offline-in')?.value || lanOfflineIn).trim();
          if (!code) { lanOfflineMsg = '请先粘贴对方的握手码。'; renderTier2Module(); return; }
          AudioEngine.tap();
          try {
            const isOfferCode = (() => { try { return JSON.parse(decodeURIComponent(escape(atob(code.replace(/\s+/g, ''))))).k === 'offer'; } catch (_) { return false; } })();
            if (isOfferCode) {
              lanOfflineMsg = '正在生成应答码...';
              renderTier2Module();
              lanOfflineOut = await activeLanInstance.acceptOfflineOffer(code);
              lanOfflineMsg = '应答码已生成，请回传给房主；房主提交后将自动建立 WebRTC 直连。';
            } else {
              await activeLanInstance.acceptOfflineAnswer(code);
              lanOfflineMsg = '已提交应答码，等待 WebRTC 通道打开...';
            }
            lanOfflineIn = '';
          } catch (err) {
            lanOfflineMsg = '握手失败：' + (err && err.message ? err.message : err);
          }
          renderTier2Module();
        });
        body.querySelectorAll('[data-lan-join-room]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetCode = btn.getAttribute('data-lan-join-room');
            if (!targetCode) return;
            const cur = activeLanInstance.getStatus();
            const isSelf = cur.role === 'host' && cur.roomCode === targetCode;
            if (isSelf || (cur.connected && cur.roomCode === targetCode)) {
              AudioEngine.win();
              if (enterTier3GameplayFn) enterTier3GameplayFn();
              return;
            }
            activeLanInstance.joinRoom(targetCode, 'client');
            AudioEngine.tap();
            renderTier2Module();
          });
        });
      }
      window.dispatchEvent(new CustomEvent('nexus:tier2-rendered', {
        detail: { tab: currentMenuTab, unitFile: null }
      }));
    }

    // Bind Tier 2 module tabs
    menuEl.querySelectorAll('#nx-t2-tabs .nx-t2-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioEngine.tap();
        currentMenuTab = btn.getAttribute('data-menu-tab') || 'home';
        renderTier2Module();
      });
    });

    // Tier 2 -> Tier 1 (Return to Portal Homepage)
    document.getElementById('nx-btn-back-tier1')?.addEventListener('click', () => {
      AudioEngine.tap();
      AudioEngine.cleanup();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'NEXUS_EXIT_GAME', gameId }, '*');
      } else {
        window.location.href = `../index.html?game=${encodeURIComponent(gameId)}`;
      }
    });

    // Tier 2 -> Tier 3 (Enter Gameplay Scene)
    enterTier3GameplayFn = () => {
      AudioEngine.win();
      menuEl.classList.remove('active');
      gameplayActive = true;
      document.body.classList.add('nx-in-tier3');
      // For micro-genesis, automatically enter #page-arena (Tier 3 Gameplay Scene) if currently on intro/lobby
      if (gameId === 'micro-genesis' && !document.body.classList.contains('in-arena-view')) {
        const arenaBtn = document.querySelector('[data-page="arena"]');
        if (arenaBtn) arenaBtn.click();
      }
    };

    openTier2MenuFn = (tabName) => {
      AudioEngine.tap();
      AudioEngine.cleanup();
      if (tabName) currentMenuTab = tabName;
      gameplayActive = false;
      document.body.classList.remove('nx-in-tier3');
      menuEl.classList.add('active');
      renderTier2Module();
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'NEXUS_WAKE_HOST_BACK' }, '*'); } catch (_) {}
      }
    };

    document.getElementById('nx-btn-enter-tier3')?.addEventListener('click', enterTier3GameplayFn);

    document.getElementById('nx-btn-open-studio')?.addEventListener('click', () => {
      AudioEngine.tap();
      menuEl.classList.remove('active');
      gameplayActive = true;
      document.body.classList.add('nx-in-tier3');
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage({ type: 'NEXUS_ENTER_TIER3' }, '*'); } catch (_) {}
      }
      if (meta.triggerStudio) meta.triggerStudio();
    });

    // Floating Top-Right Button in Tier 3 Gameplay Scene -> Returns strictly to Tier 2 (Game Menu Hub)
    if (!document.getElementById('nx-return-btn')) {
      const btn = document.createElement('button');
      btn.id = 'nx-return-btn';
      btn.className = 'nx-return-pill';
      btn.setAttribute('aria-label', '暂停并返回游戏菜单');
      btn.setAttribute('title', '暂停并返回第 2 层游戏菜单');
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <span>菜单</span>
      `;
      btn.addEventListener('click', () => {
        openTier2MenuFn('home');
      });
      document.body.appendChild(btn);
    }

    renderTier2Module();

    // Portrait Screen Guard (严格继承各微游流派 Design Tokens，杜绝硬编码赛博青 #00f0ff)
    const guard = document.createElement('div');
    guard.className = 'nx-guard-overlay';
    guard.innerHTML = `
      <div class="nx-guard-card">
        <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:14px;background:rgba(245,158,11,0.12);border:1px solid var(--cyan, #f59e0b);display:flex;align-items:center;justify-content:center;color:var(--cyan, #f59e0b);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </div>
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;">请横置手机进入「${gameTitle}」</div>
        <div id="nx-guard-desc-text" style="font-size:0.82rem;color:#94a3b8;line-height:1.5;">本微游采用全屏横屏双手操控设计，请将设备横置或点击下方按钮锁定横屏。</div>
        <button class="nx-guard-btn" id="nx-guard-lock-btn">开启全屏横屏模式</button>
        <button class="nx-guard-btn secondary" id="nx-guard-bypass-btn">已横置 · 检测放行</button>
      </div>
    `;
    document.body.appendChild(guard);

    function checkOrientation() {
      const isPortrait = window.innerWidth < window.innerHeight;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 760;
      if (isPortrait && isSmall) {
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
      checkOrientation();
    });

    document.getElementById('nx-guard-bypass-btn')?.addEventListener('click', () => {
      AudioEngine.tap();
      if (window.innerWidth >= window.innerHeight) {
        document.body.classList.remove('nx-portrait-locked');
      } else {
        const descEl = document.getElementById('nx-guard-desc-text');
        if (descEl) {
          descEl.textContent = '检测到当前视口仍处于竖屏状态 (宽 < 高)，请先将手机物理旋转至横屏以自动解除守护遮罩。';
          descEl.style.color = 'var(--gold, #fde047)';
        }
        AudioEngine.warn();
      }
    });
  }

  /* =========================================================================
   * 7. Deterministic Seeded PRNG for Local Seed Challenge Reproducibility
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
    escapeHtml,
    initShellUI,
    createSeededRandom,
    resolveAuthIdentity,
    getSettings: () => currentSettingsObj,
    isGameplayActive: () => gameplayActive,
    openTier2Menu: (tab) => { if (openTier2MenuFn) openTier2MenuFn(tab); },
    enterTier3Gameplay: () => { if (enterTier3GameplayFn) enterTier3GameplayFn(); }
  };
})(window);
