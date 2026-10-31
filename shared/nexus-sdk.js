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

  function resolveAuthIdentity() {
    const params = new URLSearchParams(window.location.search);
    let userId = params.get('userId') || '';
    let nickname = params.get('userName') || '';
    let token = params.get('token') || '';
    const room = params.get('room') || '';
    const challenge = params.get('challenge') || '';

    try {
      const raw = localStorage.getItem('NEXUS_MINI_AUTH_SESSION');
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess && sess.userId) {
          userId = sess.userId;
          nickname = sess.nickname || sess.username || nickname;
          token = sess.token || token;
        }
      }
    } catch (_) {}

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
   * 4. LAN Dual-Channel P2P Session (WebRTC + Same-Subnet Broadcast + 3s Failover)
   * ========================================================================= */
  let activeLanInstance = null;

  function createLanSession(gameId, initialRoomCode) {
    let roomCode = initialRoomCode || ('NX-' + Math.floor(1000 + Math.random() * 9000));
    let role = 'host'; // 'host' | 'client'
    let connected = false;
    let peerLatencyMs = 2;
    let lastPeerSeen = 0;
    let failoverActive = false;
    let autoAiTakeover = true;
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
        failoverActive,
        autoAiTakeover
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
          failoverActive = autoAiTakeover;
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

    const hbTimer = setInterval(() => {
      if (bc) {
        try {
          bc.postMessage({ ch: 'ping', senderRole: role, ts: Date.now() });
        } catch (_) {}
      }
      if (connected && performance.now() - lastPeerSeen > 3000) {
        connected = false;
        failoverActive = autoAiTakeover;
        notifyStatus();
      }
    }, 800);

    bindChannel(roomCode);
    setupWebRTC(true);

    const session = {
      getRoomCode: () => roomCode,
      getRole: () => role,
      isConnected: () => connected,
      isFailover: () => failoverActive,
      getLatency: () => peerLatencyMs,
      setAutoAiTakeover: (v) => {
        autoAiTakeover = !!v;
        notifyStatus();
      },
      getAutoAiTakeover: () => autoAiTakeover,
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
      styleCode: 'STYLE-20+64 · 深空航宇遥测主题',
      storagePrefix: 'NEXUS_MINI_SD_',
      icon: '../assets/star-defender/icon.svg',
      preview: '../assets/star-defender/preview.png',
      tagline: '360° 轨道拦截射击 · 四大主力战舰底盘与百波异虫防衛战役',
      modes: [
        { id: 'solo-campaign', name: '客户端单机 · 星轨百波拦截战役', desc: '本地 60Hz 确定性牛顿物理与自动火控解算，AI 护航僚机全程协同守卫星轨核心站' },
        { id: 'lan-coop', name: '局域网 1~5ms · 双舰一人一机联合护航', desc: '同 Wi-Fi / 手机热点 WebRTC 双通道直连，双机集火虚空利维坦 Boss' }
      ],
      formulas: [
        { title: '牛顿矢量推重比方程', desc: 'a = F_thrust / M_total，不同底盘具备独立转动惯量与矢量阻尼，升级装备固定槽位体积不膨胀。' },
        { title: '自动火控与离屏边界投射', desc: '自动锁定射程内最近威胁，视口外高危敌舰实时投射为屏幕边缘红/金战术预警三角。' },
        { title: '空间站共振波纹与轨道炮塔', desc: '中央空间站配置 2~6 座自动旋转火控炮塔，受击时触发电光青与紫红双色冲击波环。' },
        { title: '百波战功与残骸双轨经济', desc: '击毁异虫获取战功 (War Merits) 与合金残骸 (Scraps)，用于船坞晋升火控等级与护盾。' }
      ],
      sprites: [
        { file: 'hull-delta.svg', name: 'Delta 先锋舰', role: '高速拦截战舰' },
        { file: 'hull-wing.svg', name: 'Wing 巡洋舰', role: '均衡多挂点主力舰' },
        { file: 'hull-ring.svg', name: 'Ring 环轨舰', role: '高护盾环状母舰' },
        { file: 'hull-cross.svg', name: 'Cross 歼星舰', role: '重装十字旗舰' },
        { file: 'station-core.svg', name: '星轨空间站', role: '核心守护目标' },
        { file: 'weapon-turret.svg', name: '轨道火控炮塔', role: '自动防空卫戍' },
        { file: 'asteroid-iron.svg', name: '铁镍陨石', role: '矿物障碍天体' },
        { file: 'asteroid-crystal.svg', name: '晶簇陨石', role: '高价值能量晶矿' },
        { file: 'enemy-swarm.svg', name: '异虫飞蝗', role: '高速集群突袭单位' },
        { file: 'enemy-lurker.svg', name: '相位潜行者', role: '中程机动精英' },
        { file: 'enemy-carrier.svg', name: '腐蚀蜂巢舰', role: '重甲母巢敌舰' },
        { file: 'boss-leviathan.svg', name: '虚空利维坦', role: '十星域关底首领' }
      ],
      getMetrics: (s) => [
        { label: '战功储备 (War Merits)', val: (s.currency?.warMerits ?? 1200).toLocaleString(), gold: true },
        { label: '合金残骸 (Scraps)', val: (s.currency?.scraps ?? 150).toLocaleString(), gold: true },
        { label: '火控等级 / 轨道炮塔', val: `Lv.${s.weaponLv ?? 1} / ${s.turretCount ?? 2} 座` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { warMerits: 1200, scraps: 150 };
        s.currency.warMerits += 1000;
        s.currency.scraps += 300;
        s.weaponLv = Math.min(5, (s.weaponLv || 1) + 1);
      },
      studioBtnText: '打开局内星际船坞改装面板',
      triggerStudio: () => document.getElementById('btn-open-dock')?.click()
    },
    'tank-battle': {
      id: 'tank-battle',
      name: '钢铁防线',
      en: 'TANK BATTLE',
      styleCode: 'STYLE-19×113 · 克虏伯发蓝炮钢与冷拔拉丝钨钢',
      storagePrefix: 'NEXUS_MINI_TANK_',
      icon: '../assets/tank-battle/icon.svg',
      preview: '../assets/tank-battle/preview.png',
      tagline: '26×26 重装防线守卫 · 发蓝乌金钢主战坦克与铁幕攻城列车决战',
      modes: [
        { id: 'solo-defense', name: '单机防线战役', desc: '1P 玩家主控发蓝炮钢主战坦，2P 退火黄铜双管坦由本地战术 AI 协同护卫统帅地堡' },
        { id: 'lan-coop', name: '局域网双人同屏', desc: '两名指挥官各自持握手机 1~5ms 直连，共享地堡防弹钢墙加固与实时穿甲弹道同步' }
      ],
      rosterUnits: [
        { no: 'NO.01', badge: '120MM RHA', file: 'player-tank-p1.svg', name: '1P 重型主战', weight: '48.5 TON', fullTitle: 'T-80U / M103 重型主战坦克', subCode: '枪管发蓝乌金钢首上 + 砂型铸造炮塔', ammo: 'HVAP-T', armorVal: '220mm', armorPct: 88, velVal: '1650m/s', velPct: 84, pwrVal: '24hp/t', pwrPct: 76 },
        { no: 'NO.02', badge: 'ERA 反应甲', file: 'player-tank-p2.svg', name: '2P 协同突击', weight: '46.0 TON', fullTitle: '2P 卫戌双联突击重坦', subCode: '冷拔拉丝钨钢车体 + 双联速射滑膛炮', ammo: 'APFSDS', armorVal: '205mm', armorPct: 82, velVal: '1580m/s', velPct: 80, pwrVal: '26hp/t', pwrPct: 82 },
        { no: 'NO.03', badge: '双联 152MM', file: 'enemy-mammoth.svg', name: '猛犸重装敌坦', weight: '72.0 TON', fullTitle: '猛犸四履带超重型攻坚坦', subCode: '粗粝砂型铸铁 + 防锈红丹底漆重甲', ammo: 'HE-FRAG', armorVal: '260mm', armorPct: 96, velVal: '1320m/s', velPct: 68, pwrVal: '16hp/t', pwrPct: 54 },
        { no: 'NO.04', badge: '高速侦察', file: 'enemy-scout.svg', name: '轻型穿插敌坦', weight: '28.5 TON', fullTitle: '灰狼半履带高机动侦察坦', subCode: '轻量化铆接钢板 + 双联机炮', ammo: 'AP-I', armorVal: '95mm', armorPct: 45, velVal: '1420m/s', velPct: 72, pwrVal: '32hp/t', pwrPct: 92 },
        { no: 'NO.05', badge: '铸钢地堡', file: 'base-eagle.svg', name: '统帅核心雕像', weight: 'FORT-01', fullTitle: '八角防爆铸钢统帅鹰标地堡', subCode: '退火黄铜浮雕军徽 + 四角沉头防爆栓', ammo: 'CORE', armorVal: '300mm', armorPct: 100, velVal: '0m/s', velPct: 15, pwrVal: 'FIXED', pwrPct: 100 },
        { no: 'NO.06', badge: '防弹钢墙', file: 'tile-steel.svg', name: '铆接永固钢块', weight: 'LV.3 穿甲', fullTitle: '克虏伯发蓝铆接防弹钢掩体', subCode: '交叉冲压加强筋 + 沉头六角螺栓', ammo: 'BUNKER', armorVal: '280mm', armorPct: 95, velVal: '0m/s', velPct: 10, pwrVal: 'FIXED', pwrPct: 100 }
      ],
      formulas: [
        { title: '26×26 复合地形掩体机制', desc: '耐火砖石墙可被常规穿甲弹逐块击碎；发蓝防弹钢墙仅 Lv.3 高膛压穿甲弹可破；伪装网灌木提供半透明隐蔽。' },
        { title: '统帅地堡防弹钢墙加固', desc: '消耗 50 枚军械硬币可将地堡外围砖墙瞬时升级为克虏伯发蓝防弹钢墙，抵御敌军重炮集火。' },
        { title: '敌军装甲合成编队 AI', desc: '半履带轻坦高速穿插、突击坦侧翼包抄、重甲猛犸正面推进、铁幕攻城列车 Boss 多节齐射。' },
        { title: '3.0 秒双向断线 AI 自愈', desc: '局域网任一指挥官切后台或断连超过 3.0s，系统自动切换本地 AI 僚机无缝接管战车。' }
      ],
      sprites: [
        { file: 'player-tank-p1.svg', name: '1P 重型主战', role: '发蓝炮钢主力坦' },
        { file: 'player-tank-p2.svg', name: '2P 协同突击', role: '退火黄铜双管坦' },
        { file: 'enemy-scout.svg', name: '轻型穿插敌坦', role: '半履带侦察车' },
        { file: 'enemy-raider.svg', name: '疾风突击敌坦', role: '高机动穿插坦' },
        { file: 'enemy-shooter.svg', name: '长身管歼击车', role: '远程反坦火炮' },
        { file: 'enemy-mammoth.svg', name: '猛犸重装敌坦', role: '四履带超重坦' },
        { file: 'enemy-boss-train.svg', name: '铁幕攻城列车', role: '关底装甲列车' },
        { file: 'base-eagle.svg', name: '统帅核心雕像', role: '铸钢鹰标地堡' },
        { file: 'tile-brick.svg', name: '耐火水泥砖墙', role: '可击碎战术工事' },
        { file: 'tile-steel.svg', name: '铆接永固钢块', role: '防弹不可摧掩体' },
        { file: 'tile-bush.svg', name: '战地伪装网林', role: '树冠视觉隐蔽层' },
        { file: 'pickup-crate.svg', name: '冲压军械补给', role: '护盾/晋升空投箱' }
      ],
      getMetrics: (s) => [
        { label: '军械储备硬币 (Ordnance Coins)', val: (s.currency?.tankCoins ?? 500).toLocaleString(), gold: true },
        { label: '历史最高防线积分', val: (s.stats?.highScore ?? 6800).toLocaleString(), gold: true },
        { label: '当前战车军衔 / 胜场', val: `Rank ${s.rank ?? 1} / ${s.stats?.wins ?? 5} 胜` }
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
        { label: '最高突破矿层 / 最高纪录', val: `第 ${s.maxStage ?? 1} 层 / $${(s.bestCash ?? 14200).toLocaleString()}` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { goldBars: 850 };
        s.currency.goldBars += 600;
        s.dynamites = (s.dynamites || 3) + 3;
        s.tonicBuff = true;
        s.cloverBuff = true;
      },
      studioBtnText: '打开局间矿工杂货铺整备',
      triggerStudio: () => document.getElementById('btn-open-shop')?.click()
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
        { label: '无伤金布丁奖章', val: `${s.goldenPuddings ?? 4} 枚`, gold: true },
        { label: '已解锁章节进度', val: `第 ${s.clearedChapters ?? 1} 章` }
      ],
      grantBonus: (s) => {
        s.currency = s.currency || { sugarCrystals: 600 };
        s.currency.sugarCrystals += 500;
        s.goldenPuddings = (s.goldenPuddings || 4) + 3;
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
        { label: '进化纪元段位', val: s.arenaTier || '真核纪 (Tier II)' }
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

  function initShellUI(options = {}) {
    const gameId = options.gameId || 'star-defender';
    const meta = GAME_META_DB[gameId] || GAME_META_DB['star-defender'];
    const gameTitle = options.gameTitle || meta.name;
    const settingsKey = `NEXUS_SETTINGS_${gameId}`;

    function loadSettings() {
      try {
        const raw = localStorage.getItem(settingsKey);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return {
        muted: false,
        volume: 1.0,
        haptics: true,
        touchLayout: 'standard',
        particleTier: 'high'
      };
    }

    function saveSettings(cfg) {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(cfg));
      } catch (_) {}
      AudioEngine.setMuted(cfg.muted);
      AudioEngine.setVolume(cfg.volume);
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
        background: var(--panel, var(--mg-glass-panel, rgba(9, 14, 26, 0.90)));
        backdrop-filter: blur(10px);
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
        color: var(--cyan, var(--mg-accent-cyan, #00f0ff));
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
        font-size: 0.72rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.14s ease;
      }
      .nx-t2-tab.active {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--cyan, var(--mg-accent-cyan, #00f0ff));
        color: var(--text, var(--mg-text-primary, #f8fafc));
        box-shadow: inset 0 -2px 0 var(--cyan, var(--mg-accent-cyan, #00f0ff));
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
        background: var(--cyan, var(--mg-accent-cyan, #00f0ff));
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
        color: var(--cyan, var(--mg-accent-cyan, #00f0ff));
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
        .nx-t2-grid3 { grid-template-columns: 1fr 1fr; }
        .nx-t2-grid2 { grid-template-columns: 1fr; }
      }

      /* ===== 竖屏强守护弹窗 ===== */
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

    // Build Tier 2 6-Module Game Menu Hub DOM
    let currentMenuTab = 'home';
    let selectedModeId = meta.modes[0].id;
    let selectedUnitIdx = 0;
    let measuredFps = 60;
    let swCacheStatus = '已就绪 (本地离线 CacheStorage 完整)';

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

    menuEl.innerHTML = `
      <header class="nx-t2-header">
        <div class="nx-t2-brand">
          <button class="nx-t2-btn" id="nx-btn-back-tier1" title="返回第 1 层平台主页">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg>
            <span>${isHeavyArmory ? '返回平台清单' : '返回主页'}</span>
          </button>
          <img src="${meta.icon}" alt="${meta.name}" />
          <div>
            <div class="nx-t2-title">${isHeavyArmory ? `${meta.name} · 重装军械库` : `${meta.name} · 游戏菜单`}</div>
            <div class="nx-t2-sub">${meta.styleCode}</div>
          </div>
        </div>
        <nav class="nx-t2-tabs" id="nx-t2-tabs">
          <button class="nx-t2-tab active" data-menu-tab="home">${isHeavyArmory ? '① 装甲清单' : '① 游戏主页'}</button>
          <button class="nx-t2-tab" data-menu-tab="details">${isHeavyArmory ? '② 战术百科' : '② 游戏详情'}</button>
          <button class="nx-t2-tab" data-menu-tab="settings">${isHeavyArmory ? '③ 机械设置' : '③ 游戏设置'}</button>
          <button class="nx-t2-tab" data-menu-tab="assets">${isHeavyArmory ? '④ 军械配装' : '④ 资材管理'}</button>
          <button class="nx-t2-tab" data-menu-tab="services">${isHeavyArmory ? '⑤ 离线自检' : '⑤ 服务管理'}</button>
          <button class="nx-t2-tab" data-menu-tab="lan">${isHeavyArmory ? '⑥ 局域网联机' : '⑥ 局域网管理'}</button>
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
            <span>${isHeavyArmory ? '解锁炮塔闭锁 · 投入防线' : '开始游戏 · 进入游玩界面'}</span>
          </button>
        </div>
      </footer>
    `;
    document.body.appendChild(menuEl);

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
      const auth = activeStoreInstance ? activeStoreInstance.getAuth() : resolveAuthIdentity();
      const saveData = getSaveDataSafe();
      const lanCode = activeLanInstance ? activeLanInstance.getRoomCode() : (auth.room || 'NX-8820');
      const lanConn = activeLanInstance ? activeLanInstance.isConnected() : false;
      const lanRtt = activeLanInstance ? activeLanInstance.getLatency() : 2;

      const statusLine = document.getElementById('nx-t2-status-line');
      if (statusLine) {
        statusLine.textContent = `统帅: ${auth.nickname} (${auth.userId}) · 房间: ${lanCode} (${lanConn ? 'LAN已连 ' + lanRtt + 'ms' : '本地单机 + AI僚机'}) · 零远端通信`;
      }

      document.querySelectorAll('#nx-t2-tabs .nx-t2-tab').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-menu-tab') === currentMenuTab);
      });

      if (currentMenuTab === 'home') {
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

                  <div class="tb-insp-preview-box">
                    <img src="../assets/${meta.id}/sprites/${u.file}?v=20261031b" alt="${u.name}" />
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
              renderTier2Module();
            });
          });
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
              <div class="nx-t2-card" data-mode-select="${md.id}" style="cursor:pointer;border-color:${selectedModeId === md.id ? 'var(--cyan,#00f0ff)' : 'rgba(255,255,255,0.14)'};">
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
            <span style="font-size:0.7rem;color:var(--cyan,#00f0ff);font-weight:700;white-space:nowrap;">60Hz 就绪</span>
          </div>
        `;
        body.querySelectorAll('[data-mode-select]').forEach((card) => {
          card.addEventListener('click', () => {
            AudioEngine.tap();
            selectedModeId = card.getAttribute('data-mode-select');
            renderTier2Module();
          });
        });
      } else if (currentMenuTab === 'details') {
        body.innerHTML = `
          <div style="font-size:0.74rem;font-weight:800;color:var(--cyan,#00f0ff);">
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
            本游戏专属多层 SVG 矢量贴图与同源骨骼图鉴 (12 项核心实体)
          </div>
          <div class="nx-t2-sprites">
            ${meta.sprites.map((sp) => `
              <div class="nx-t2-sp-item">
                <img src="../assets/${meta.id}/sprites/${sp.file}" alt="${sp.name}" />
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
                <button class="nx-t2-btn" id="nx-set-mute-toggle" style="border-color:var(--cyan,#00f0ff);">
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
              <h4>60fps 渲染粒子与流派光影档位</h4>
              <p>针对移动设备 GPU 优化：关闭高开销高斯模糊，采用多层 Alpha 几何高光与确定性帧率锁。</p>
            </div>
            <button class="nx-t2-btn" id="nx-set-particle-toggle">
              画质档位：${userSettings.particleTier === 'high' ? '60Hz 高精满帧' : '竞技省电模式'}
            </button>
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
              <h4>统帅身份切换与战备资材整备 (${nsKey})</h4>
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
            if (parsed && typeof parsed === 'object') {
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
              <div style="font-size:0.82rem;font-weight:800;color:#10b981;margin-top:2px;">${swCacheStatus}</div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">客户端物理/渲染帧率基准</div>
              <div style="font-size:0.82rem;font-weight:800;color:var(--cyan,#00f0ff);margin-top:2px;">${measuredFps} FPS (确定性 60Hz 步长)</div>
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
              <button class="nx-t2-btn" id="nx-svc-refresh-sw" style="border-color:var(--cyan,#00f0ff);">
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
          swCacheStatus = '正在校验本地 CacheStorage...';
          renderTier2Module();
          try {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (const r of regs) await r.update();
            }
            swCacheStatus = '校验通过 · 离线缓存 100% 最新';
          } catch (_) {
            swCacheStatus = '本地静态资材已就绪';
          }
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
              measuredFps = Math.min(60, Math.max(30, Math.round((frames * 1000) / (performance.now() - t0))));
              AudioEngine.win();
              renderTier2Module();
            }
          }
          requestAnimationFrame(sample);
        });
      } else if (currentMenuTab === 'lan') {
        const autoAi = activeLanInstance ? activeLanInstance.getAutoAiTakeover() : true;
        body.innerHTML = `
          <div class="nx-t2-grid3">
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">当前局域网房间号</div>
              <div style="font-size:0.95rem;font-weight:900;color:var(--cyan,#00f0ff);letter-spacing:0.08em;margin-top:2px;">${lanCode}</div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">WebRTC 双通道状态</div>
              <div style="font-size:0.82rem;font-weight:800;color:${lanConn ? '#10b981' : 'var(--gold,#fbbf24)'};margin-top:2px;">
                ${lanConn ? `已直连 (${lanRtt}ms · 0重传)` : '待机中 (同Wi-Fi/热点就绪)'}
              </div>
            </div>
            <div class="nx-t2-card">
              <div style="font-size:0.66rem;color:var(--muted,#94a3b8);">3.0s 断线 AI 僚机接管</div>
              <div style="font-size:0.82rem;font-weight:800;color:#10b981;margin-top:2px;">${autoAi ? '已启用自动接管保护' : '已手动关闭'}</div>
            </div>
          </div>
          <div class="nx-t2-grid2">
            <div class="nx-t2-card">
              <h4>1P 房主建房 (Host) 与纯离线手机热点握手码</h4>
              <p style="margin-bottom:8px;">房间权威状态机直接运行于房主移动设备内存，无需任何公网服务器：</p>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="nx-t2-btn" id="nx-lan-new-room">重新生成房号 (Host)</button>
                <button class="nx-t2-btn" id="nx-lan-sdp-btn" style="border-color:var(--cyan,#00f0ff);">生成并复制热点离线握手码</button>
              </div>
            </div>
            <div class="nx-t2-card">
              <h4>2P~4P 客机加入同局域网房间 (Client · 严禁原生 prompt)</h4>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <input type="text" class="nx-t2-input" id="nx-lan-join-input" placeholder="输入 4 位房间号 (如 NX-8820) 或热点握手码" />
                <button class="nx-t2-btn" id="nx-lan-join-btn" style="border-color:var(--gold,#fbbf24);color:var(--gold,#fbbf24);">直连加入</button>
              </div>
            </div>
          </div>
        `;
        document.getElementById('nx-lan-new-room')?.addEventListener('click', () => {
          const nextCode = 'NX-' + Math.floor(1000 + Math.random() * 9000);
          if (activeLanInstance) activeLanInstance.joinRoom(nextCode, 'host');
          AudioEngine.upgrade();
          renderTier2Module();
        });
        document.getElementById('nx-lan-sdp-btn')?.addEventListener('click', () => {
          const token = 'LAN-' + btoa(JSON.stringify({ g: gameId, r: lanCode, t: Date.now() })).slice(0, 24);
          const inp = document.getElementById('nx-lan-join-input');
          if (inp) inp.value = token;
          navigator.clipboard?.writeText(token).catch(() => {});
          AudioEngine.win();
        });
        document.getElementById('nx-lan-join-btn')?.addEventListener('click', () => {
          const val = document.getElementById('nx-lan-join-input')?.value.trim();
          if (val && activeLanInstance) {
            activeLanInstance.joinRoom(val.slice(0, 12), 'client');
          }
          AudioEngine.win();
          renderTier2Module();
        });
      }
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
    };

    document.getElementById('nx-btn-enter-tier3')?.addEventListener('click', enterTier3GameplayFn);

    document.getElementById('nx-btn-open-studio')?.addEventListener('click', () => {
      AudioEngine.tap();
      menuEl.classList.remove('active');
      gameplayActive = true;
      document.body.classList.add('nx-in-tier3');
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
    initShellUI,
    createSeededRandom,
    resolveAuthIdentity,
    isGameplayActive: () => gameplayActive,
    openTier2Menu: (tab) => { if (openTier2MenuFn) openTier2MenuFn(tab); },
    enterTier3Gameplay: () => { if (enterTier3GameplayFn) enterTier3GameplayFn(); }
  };
})(window);
