/**
 * 钢铁防线 · 重装军械库 - 受控游戏运行引擎 (On-Demand Room-Gated Engine)
 * 严格遵循 GAME_TEMPLATE_SPEC.md：
 * 1. 本文件不在 index.html 中直接引用，杜绝进入菜单页面时自动启动游戏或后台服务。
 * 2. 仅当用户在【⑥ 房间大厅】创建或加入房间并点击【🚀 启动游戏 · 进入战场】后，
 *    由 NexusSDK 启动加载画面 (#nx-boot-loader-overlay) 并按需动态加载执行。
 */
(function (global) {
  'use strict';
  if (!global.NexusSDK || typeof global.NexusSDK.registerGameEngine !== 'function') {
    console.error('[NexusEngine] NexusSDK not found.');
    return;
  }

  global.NexusSDK.registerGameEngine('tank-battle', function (roomBootCtx) {
    let __engineInitialized = false;
    let __engineRunning = false;
    let __rafId = null;
    let __releaseFn = null;
    let __resumeFn = null;
    let __entityCountFn = () => 0;

    function bootEngineOnce() {
      if (__engineInitialized) return;
      __engineInitialized = true;
(() => {
      NexusSDK.initShellUI({ gameId: 'tank-battle', gameTitle: '钢铁防线' });

      const store = NexusSDK.createGameStorage('NEXUS_MINI_TANK_', (isAdmin) => ({
        currency: { tankCoins: isAdmin ? 999999 : 500 },
        stats: { wins: isAdmin ? 999 : 0, highScore: isAdmin ? 99999 : 0 },
        rank: isAdmin ? 4 : 1
      }));
      let saveData = store.load();

      const sprites = NexusSDK.loadSprites('tank-battle', {
        p1: 'player-tank-p1.svg',
        p2: 'player-tank-p2.svg',
        scout: 'enemy-scout.svg',
        raider: 'enemy-raider.svg',
        shooter: 'enemy-shooter.svg',
        mammoth: 'enemy-mammoth.svg',
        boss: 'enemy-boss-train.svg',
        eagle: 'base-eagle.svg',
        brick: 'tile-brick.svg',
        steel: 'tile-steel.svg',
        bush: 'tile-bush.svg',
        crate: 'pickup-crate.svg'
      }, () => {
        terrainDirty = true;
      });

      // 车体与炮塔同源 SVG 分离位图缓存：将 SVG 中车体图层与独立旋转炮塔图层拆分为两张高清离屏贴图
      const splitLayers = {};
      const TANK_SPRITE_FILES = {
        p1: 'player-tank-p1.svg',
        p2: 'player-tank-p2.svg',
        scout: 'enemy-scout.svg',
        raider: 'enemy-raider.svg',
        shooter: 'enemy-shooter.svg',
        mammoth: 'enemy-mammoth.svg',
        boss: 'enemy-boss-train.svg'
      };
      const TURRET_GROUP_IDS = [
        'part-turret-ring', 'part-turret-body', 'part-barrel-main',
        'part-barrel-left', 'part-barrel-right', 'part-barrel-twin-mg',
        'part-barrel-plasma-L', 'part-barrel-plasma-R', 'part-barrel-railgun',
        'part-barrel-heavy-L', 'part-barrel-heavy-R', 'part-rail-jaw-L', 'part-rail-jaw-R',
        'part-cooling-fin-L', 'part-cooling-fin-R', 'part-sensor-optic',
        'part-radar-scanner', 'part-light-cone-main', 'part-light-rim-turret',
        'part-turret-front', 'part-barrel-front', 'part-turret-rear',
        'part-barrel-rear-L', 'part-barrel-rear-R', 'part-aa-turret-L', 'part-aa-turret-R'
      ];

      async function buildSplitTankSprites() {
        if (!window.location.protocol.startsWith('http')) return;
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        await Promise.all(Object.entries(TANK_SPRITE_FILES).map(async ([key, file]) => {
          try {
            const resp = await fetch(`../assets/tank-battle/sprites/${file}`);
            if (!resp.ok) return;
            const rawSvg = await resp.text();

            // 1. Hull SVG (隐藏所有独立炮塔与炮管图层)
            const hullDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
            TURRET_GROUP_IDS.forEach((id) => {
              const el = hullDoc.getElementById(id);
              if (el) el.setAttribute('display', 'none');
            });
            const hullStr = serializer.serializeToString(hullDoc.documentElement);
            const hullImg = new Image();
            hullImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(hullStr);

            // 2. Turret SVG (仅保留炮塔座圈、炮塔本体、炮管、制退器、雷达与扫描光锥，过滤全部非炮塔顶层元素)
            const turretDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
            const rootNodes = turretDoc.querySelectorAll('svg > [id]');
            rootNodes.forEach((node) => {
              const gid = node.getAttribute('id') || '';
              if (!TURRET_GROUP_IDS.includes(gid)) {
                node.setAttribute('display', 'none');
              }
            });
            const turretStr = serializer.serializeToString(turretDoc.documentElement);
            const turretImg = new Image();
            turretImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(turretStr);

            splitLayers[key] = { hullImg, turretImg };
          } catch (_) {}
        }));
      }
      buildSplitTankSprites();

      const canvas = document.getElementById('battle-canvas');
      const ctx = canvas.getContext('2d');
      const stageWrap = document.getElementById('stage-wrap');
      const bezelEl = document.getElementById('battlefield-bezel');
      const modalEl = document.getElementById('battle-result-modal');
      const modalTitleEl = document.getElementById('modal-result-title');
      const modalDescEl = document.getElementById('modal-result-desc');

      const LOGICAL_SIZE = 624; // 624x624 连续二维欧几里得物理空间 (零正交方块网格)
      const DT = 1 / 60;

      // 离屏静态异形工事与极坐标底板缓存层 (624x624)
      const terrainCacheCanvas = document.createElement('canvas');
      terrainCacheCanvas.width = LOGICAL_SIZE;
      terrainCacheCanvas.height = LOGICAL_SIZE;
      const terrainCtx = terrainCacheCanvas.getContext('2d');
      let terrainDirty = true;

      function syncSquareViewport() {
        if (!stageWrap || !bezelEl) return;
        const rect = stageWrap.getBoundingClientRect();
        const side = Math.max(180, Math.floor(Math.min(rect.width, rect.height)));
        bezelEl.style.width = side + 'px';
        bezelEl.style.height = side + 'px';
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const targetPx = Math.round(LOGICAL_SIZE * dpr);
        if (canvas.width !== targetPx || canvas.height !== targetPx) {
          canvas.width = targetPx;
          canvas.height = targetPx;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      window.addEventListener('resize', syncSquareViewport);
      window.addEventListener('orientationchange', () => setTimeout(syncSquareViewport, 60));
      syncSquareViewport();

      function normalizeAngle(a) {
        let r = a % (Math.PI * 2);
        if (r > Math.PI) r -= Math.PI * 2;
        if (r <= -Math.PI) r += Math.PI * 2;
        return r;
      }

      function shortestAngleDiff(from, to) {
        return normalizeAngle(to - from);
      }

      // 军衔等级 -> 车体沉稳极速 (px/s)、原地回转角速度 (rad/s)、高初速穿甲弹速 (px/s)、自动装弹机装填帧数 (cdFrames: 84~114帧 = 1.40~1.90s)
      const RANK_SPECS = [
        { fwdSpd: 78,  revSpd: 48, turnRate: 1.65, bulletSpd: 760,  cdFrames: 114, maxShots: 1, breakSteel: false, dmg: 1 },
        { fwdSpd: 86,  revSpd: 54, turnRate: 1.75, bulletSpd: 980,  cdFrames: 105, maxShots: 1, breakSteel: false, dmg: 1 },
        { fwdSpd: 94,  revSpd: 58, turnRate: 1.85, bulletSpd: 1080, cdFrames: 96,  maxShots: 2, breakSteel: false, dmg: 2 },
        { fwdSpd: 100, revSpd: 62, turnRate: 1.95, bulletSpd: 1200, cdFrames: 90,  maxShots: 2, breakSteel: true,  dmg: 2 },
        { fwdSpd: 108, revSpd: 68, turnRate: 2.05, bulletSpd: 1380, cdFrames: 84,  maxShots: 2, breakSteel: true,  dmg: 3 }
      ];

      // 五大战术空投物资类型
      const CRATE_TYPES = [
        { kind: 'star', tag: '晋升', label: '★ 火力晋升 (提速穿甲)', color: '#fde047' },
        { kind: 'fortify', tag: '筑城', label: '🛡 V型跳弹钢障筑城', color: '#94a3b8' },
        { kind: 'emp', tag: '静默', label: '⚡ 全域火控电磁静默', color: '#f59e0b' },
        { kind: 'nuke', tag: '轰炸', label: '☢ 轨道清场轰炸', color: '#ef4444' },
        { kind: 'shield', tag: '护盾', label: '❖ 360° 偏导量子护盾', color: '#c084fc' }
      ];

      let stage = 1;
      let score = 0;
      let remainingSpawns = 14;
      let spawnCooldown = 60;
      let fortifyTimer = 0;
      let empTimer = 0;
      let baseAlive = true;
      let battleOver = false;
      let netFrameTick = 0;

      // 异形多边形与圆形战术掩体集合 (彻底废除正方形方块网格)
      // 每项结构: { id, kind: 'hex-brick'|'chevron-steel'|'pillbox'|'dragon-teeth'|'basalt'|'trench', x, y, r, rot, vertices, hp, maxHp, sectorMask, isBaseGuard }
      let obstacles = [];
      let canopyBushes = [];
      const eagleBase = { x: 312, y: 580, r: 24 };

      // 1P、2P 与全体敌坦共享：360° 车炮分离 + 转向减速耦合 + 动态移动散布 (Movement Dispersion & Settling)
      const DISP_MIN = 0.005;   // 驻停满缩圈基准散布半角 (~0.28°，指哪打哪激光级精度)
      const DISP_MAX = 0.320;   // 全速移动+转向最大扩圈散布半角 (~18.3°)
      const TAU_BLOOM = 0.11;   // 运动/转向扩圈时间常数 (s，快速扩圈)
      const TAU_SETTLE = 0.52;  // 驻停缩圈时间常数 (s，配合线性收敛底限在 0.65~0.85s 内完全闭合)

      // 敌坦统一规格表：全面下调车体移速 (34~68 px/s)，并延长重炮装填时间 (cdFrames: 120~168帧 = 2.00~2.80s)
      const ENEMY_SPECS = {
        scout:   { hp: 1, speed: 56, turnRate: 1.45, turretRate: 1.75, bulletSpd: 650,  r: 17, size: 40, cdFrames: 126, score: 100,  coins: 10,  haltFrames: 34, settleGoal: 0.042, fireMaxDisp: 0.052 },
        raider:  { hp: 2, speed: 68, turnRate: 1.65, turretRate: 2.10, bulletSpd: 780,  r: 18, size: 42, cdFrames: 120, score: 200,  coins: 20,  haltFrames: 0,  settleGoal: 0.320, fireMaxDisp: 0.320 },
        shooter: { hp: 2, speed: 48, turnRate: 1.25, turretRate: 1.85, bulletSpd: 1260, r: 18, size: 44, cdFrames: 156, score: 300,  coins: 30,  haltFrames: 48, settleGoal: 0.011, fireMaxDisp: 0.018 },
        mammoth: { hp: 4, speed: 40, turnRate: 1.05, turretRate: 1.35, bulletSpd: 820,  r: 20, size: 46, cdFrames: 168, score: 400,  coins: 50,  haltFrames: 40, settleGoal: 0.030, fireMaxDisp: 0.038 },
        boss:    { hp: 18, speed: 34, turnRate: 0.90, turretRate: 1.65, bulletSpd: 920, r: 28, size: 64, cdFrames: 138, score: 1500, coins: 200, haltFrames: 42, settleGoal: 0.026, fireMaxDisp: 0.034 }
      };
      const ENEMY_BOUNTIES = ENEMY_SPECS;

      function updateTankDispersion(tank, maxLinSpd, maxHullTurn, wTurret, dt) {
        const linRatio = Math.min(1.2, Math.abs(tank.vLin || 0) / Math.max(32, maxLinSpd || 70));
        const hullRatio = Math.min(1.2, Math.abs(tank.wHull || 0) / Math.max(0.85, maxHullTurn || 1.55));
        const turRatio = Math.min(1.2, Math.abs(wTurret || 0) / 2.60);
        const sigmaTarget = Math.min(DISP_MAX, DISP_MIN + 0.19 * linRatio + 0.09 * hullRatio + 0.07 * turRatio);
        const cur = tank.dispersion ?? DISP_MIN;
        if (sigmaTarget > cur) {
          tank.dispersion = Math.min(DISP_MAX, cur + (sigmaTarget - cur) * Math.min(1, dt / TAU_BLOOM));
        } else {
          const stepShrink = Math.max((cur - sigmaTarget) * Math.min(1, dt / TAU_SETTLE), 0.22 * dt);
          tank.dispersion = Math.max(sigmaTarget, cur - stepShrink);
        }
      }

      // 敌我通用的重装底盘运动学：强制原地转向 (In-Place Pivot Turning，严禁汽车式边走边拐弧线转向) + 动态移动散布解算器
      function stepTankKinematicsAndDispersion(tank, throttle, hullSteer, wTurret, maxFwdSpd, maxRevSpd, maxTurnRate, dt) {
        // 1. 履带原地中心转向 (In-Place Pivot Turn)：当存在转向输入时，锁定线速度为 0，仅在原地旋转车体
        const isTurning = Math.abs(hullSteer) > 0.04;
        if (isTurning) {
          tank.vLin = 0;
          tank.wHull = hullSteer * maxTurnRate;
          tank.hullAng = normalizeAngle(tank.hullAng + tank.wHull * dt);
          tank.movePhase = (tank.movePhase || 0) + 0.16 * Math.abs(hullSteer);
          recordTread(tank);
        } else {
          tank.wHull = 0;
          // 2. 车体已对准目标航向，仅执行直线加减速推进与制动滑行
          if (throttle > 0.05) {
            const nextV = (tank.vLin || 0) + 210 * throttle * dt;
            tank.vLin = Math.min(maxFwdSpd, nextV);
          } else if (throttle < -0.05) {
            tank.vLin = Math.max(-maxRevSpd, (tank.vLin || 0) + 180 * throttle * dt);
          } else {
            tank.vLin = (tank.vLin || 0) * 0.75;
            if (Math.abs(tank.vLin) < 1.2) tank.vLin = 0;
          }

          // 3. 连续直线位移与异形多边形切向滑移
          if (Math.abs(tank.vLin) > 0.5) {
            moveTankWithPolygonSliding(tank, dt);
            tank.movePhase = (tank.movePhase || 0) + 0.16 * (Math.abs(tank.vLin) / Math.max(35, maxFwdSpd));
            recordTread(tank);
          }
        }

        // 4. 实时解算动态移动散布与驻停火控缩圈
        tank.wTurret = wTurret || 0;
        updateTankDispersion(tank, maxFwdSpd, maxTurnRate, tank.wTurret, dt);
      }

      function getTankAccuracyPct(tank) {
        const d = tank.dispersion ?? DISP_MIN;
        return Math.round(Math.max(0, Math.min(1, 1 - (d - DISP_MIN) / (DISP_MAX - DISP_MIN))) * 100);
      }

      const p1 = {
        x: 215, y: 545, r: 18.5, size: 44,
        hullAng: 0, turretAng: 0, vLin: 0, wHull: 0, wTurret: 0, dispersion: DISP_MIN,
        hp: 3, maxHp: 3, lives: 2, rank: saveData.rank || 1, shield: 150, cd: 0,
        recoil: 0, movePhase: 0, hitShake: 0
      };
      const p2 = {
        x: 409, y: 545, r: 18.5, size: 44,
        hullAng: 0, turretAng: 0, vLin: 0, wHull: 0, wTurret: 0, dispersion: DISP_MIN, haltTimer: 0,
        hp: 3, maxHp: 3, rank: 2, shield: 150, cd: 0, isRemote: false,
        recoil: 0, movePhase: 0, hitShake: 0
      };

      let enemies = [];
      let bullets = [];
      let crates = [];
      let particles = [];
      let treadMarks = [];
      let floatTexts = [];

      // 构建正多边形或异形凸多边形世界顶点
      function makePolygonVertices(cx, cy, localPts, rot = 0) {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        return localPts.map(([lx, ly]) => ({
          x: cx + lx * c - ly * s,
          y: cy + lx * s + ly * c
        }));
      }

      function makeRegularPolygon(cx, cy, radius, sides, rot = 0) {
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const a = rot + (i * Math.PI * 2) / sides;
          pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
        }
        return pts;
      }

      // 创建各类非方块异形掩体
      let nextObsId = 1;
      function createHexBrick(x, y, radius = 25, rot = Math.PI / 6, isBaseGuard = false) {
        return {
          id: nextObsId++,
          kind: 'hex-brick',
          x, y, r: radius, rot,
          vertices: makeRegularPolygon(x, y, radius, 6, rot),
          hp: 4, maxHp: 4,
          sectorMask: 0b1111, // 4 扇区复合装甲砖
          isBaseGuard
        };
      }

      function createChevronSteel(x, y, scale = 1.0, rot = 0, isBaseGuard = false) {
        // V 型钝角折线楔形防爆钢墙 (六边形楔形体，具备真实大倾角跳弹斜面)
        const local = [
          [0, -24 * scale],
          [32 * scale, -4 * scale],
          [26 * scale, 18 * scale],
          [0, 6 * scale],
          [-26 * scale, 18 * scale],
          [-32 * scale, -4 * scale]
        ];
        return {
          id: nextObsId++,
          kind: 'chevron-steel',
          x, y, r: 32 * scale, rot,
          vertices: makePolygonVertices(x, y, local, rot),
          hp: 8, maxHp: 8,
          isBaseGuard
        };
      }

      function createCircularPillbox(x, y, radius = 24) {
        // 圆形钢筋混凝土暗堡 (纯圆包络，360° 零死角切向滑移)
        return {
          id: nextObsId++,
          kind: 'pillbox',
          x, y, r: radius, rot: 0,
          vertices: null,
          hp: 4, maxHp: 4,
          isBaseGuard: false
        };
      }

      function createDragonTeethCluster(x, y, rot = 0) {
        // 正三角形龙牙反坦克锥群 (阻挡坦克车体冲锋，但高初速炮弹可飞越穿射)
        return {
          id: nextObsId++,
          kind: 'dragon-teeth',
          x, y, r: 22, rot,
          vertices: makeRegularPolygon(x, y, 22, 3, rot - Math.PI / 2),
          hp: 999, maxHp: 999,
          allowBulletPass: true,
          isBaseGuard: false
        };
      }

      function createBasaltOutcrop(x, y, radius = 27, rot = 0.3) {
        // 不规则五边形/七边形玄武岩断崖
        const local = [
          [0, -radius * 0.95],
          [radius * 0.92, -radius * 0.32],
          [radius * 0.78, radius * 0.68],
          [-radius * 0.25, radius * 0.96],
          [-radius * 0.96, radius * 0.42],
          [-radius * 0.82, -radius * 0.55]
        ];
        return {
          id: nextObsId++,
          kind: 'basalt',
          x, y, r: radius, rot,
          vertices: makePolygonVertices(x, y, local, rot),
          hp: 999, maxHp: 999,
          isBaseGuard: false
        };
      }

      function createDiagonalTrench(x, y, rot = 0.45) {
        // 斜向反坦克壕沟 (六边形长槽，阻挡车体但炮弹可飞越)
        const local = [
          [-34, -11], [0, -14], [34, -11],
          [30, 11], [0, 14], [-30, 11]
        ];
        return {
          id: nextObsId++,
          kind: 'trench',
          x, y, r: 34, rot,
          vertices: makePolygonVertices(x, y, local, rot),
          hp: 999, maxHp: 999,
          allowBulletPass: true,
          isBaseGuard: false
        };
      }

      // 构建环绕八角鹰标统帅地堡的异形拱卫防线 (六角砖堡或 V 型跳弹钢墙)
      function rebuildBasePerimeter(useSteel = false) {
        obstacles = obstacles.filter((o) => !o.isBaseGuard);
        const arcPositions = [
          { x: 254, y: 582, rot: -0.45 },
          { x: 266, y: 534, rot: -0.25 },
          { x: 312, y: 520, rot: 0 },
          { x: 358, y: 534, rot: 0.25 },
          { x: 370, y: 582, rot: 0.45 }
        ];
        arcPositions.forEach((pos) => {
          if (useSteel) {
            obstacles.push(createChevronSteel(pos.x, pos.y, 0.82, pos.rot, true));
          } else {
            obstacles.push(createHexBrick(pos.x, pos.y, 22, pos.rot + Math.PI / 6, true));
          }
        });
        terrainDirty = true;
      }

      function buildStageMap(stg) {
        obstacles = [];
        canopyBushes = [];
        treadMarks = [];
        floatTexts = [];
        nextObsId = 1;

        const rng = NexusSDK.createSeededRandom(stg * 7919 + 307);

        // 在连续战场空间中按战术环带与交错通道布置非方块异形工事
        const layoutAnchors = [
          // 前沿交火带 (y: 120 ~ 200)
          { x: 115, y: 145 }, { x: 215, y: 135 }, { x: 312, y: 155 }, { x: 409, y: 135 }, { x: 509, y: 145 },
          // 中盘侧翼掩体与跳弹走廊 (y: 230 ~ 330)
          { x: 95, y: 255 }, { x: 185, y: 245 }, { x: 265, y: 270 }, { x: 359, y: 270 }, { x: 439, y: 245 }, { x: 529, y: 255 },
          { x: 145, y: 345 }, { x: 240, y: 360 }, { x: 312, y: 340 }, { x: 384, y: 360 }, { x: 479, y: 345 },
          // 后卫缓冲屏障带 (y: 420 ~ 470)
          { x: 110, y: 445 }, { x: 205, y: 440 }, { x: 312, y: 435 }, { x: 419, y: 440 }, { x: 514, y: 445 }
        ];

        layoutAnchors.forEach((pt, idx) => {
          const jx = pt.x + (rng() - 0.5) * 18;
          const jy = pt.y + (rng() - 0.5) * 16;
          const rot = (rng() - 0.5) * 1.1;
          const roll = rng();

          if (roll < 0.34) {
            obstacles.push(createHexBrick(jx, jy, 25, rot));
          } else if (roll < 0.54) {
            obstacles.push(createChevronSteel(jx, jy, 0.95, rot));
          } else if (roll < 0.70) {
            obstacles.push(createCircularPillbox(jx, jy, 23));
          } else if (roll < 0.82) {
            obstacles.push(createDragonTeethCluster(jx, jy, rot));
          } else if (roll < 0.91) {
            obstacles.push(createBasaltOutcrop(jx, jy, 25, rot));
          } else {
            obstacles.push(createDiagonalTrench(jx, jy, (idx % 2 === 0 ? 1 : -1) * 0.42));
          }
        });

        // 布置椭圆形/六角形光学迷彩纳米林带
        const bushSpots = [
          { x: 150, y: 195 }, { x: 474, y: 195 },
          { x: 145, y: 300 }, { x: 479, y: 300 },
          { x: 255, y: 400 }, { x: 369, y: 400 }
        ];
        bushSpots.forEach((bs) => {
          canopyBushes.push({
            x: bs.x + (rng() - 0.5) * 16,
            y: bs.y + (rng() - 0.5) * 16,
            r: 28,
            rot: rng() * Math.PI * 2
          });
        });

        // 统帅鹰标地堡外围异形拱卫掩体
        rebuildBasePerimeter(false);

        // 初始化 1P / 2P 车体、陀螺稳定炮塔与驻停满缩圈状态
        p1.x = 205; p1.y = 555; p1.hullAng = 0; p1.turretAng = 0; p1.vLin = 0; p1.wHull = 0; p1.wTurret = 0; p1.dispersion = DISP_MIN;
        p1.hp = 3; p1.shield = 160; p1.recoil = 0; p1.hitShake = 0;
        p2.x = 419; p2.y = 555; p2.hullAng = 0; p2.turretAng = 0; p2.vLin = 0; p2.wHull = 0; p2.wTurret = 0; p2.dispersion = DISP_MIN; p2.haltTimer = 0;
        p2.hp = 3; p2.shield = 160; p2.recoil = 0; p2.hitShake = 0;

        enemies = [
          {
            type: 'mammoth', x: 312, y: 58, r: ENEMY_SPECS.mammoth.r, size: ENEMY_SPECS.mammoth.size,
            hullAng: Math.PI, turretAng: Math.PI, vLin: 0, wHull: 0, wTurret: 0, dispersion: DISP_MIN, haltTimer: 0,
            hp: ENEMY_SPECS.mammoth.hp, maxHp: ENEMY_SPECS.mammoth.hp,
            speed: ENEMY_SPECS.mammoth.speed, turnRate: ENEMY_SPECS.mammoth.turnRate,
            turretRate: ENEMY_SPECS.mammoth.turretRate, bulletSpd: ENEMY_SPECS.mammoth.bulletSpd,
            cd: 50, recoil: 0, movePhase: 0, isElite: false, aiSteerTimer: 0, avoidDir: 1
          },
          {
            type: 'raider', x: 110, y: 64, r: ENEMY_SPECS.raider.r, size: ENEMY_SPECS.raider.size,
            hullAng: Math.PI * 0.85, turretAng: Math.PI * 0.9, vLin: 0, wHull: 0, wTurret: 0, dispersion: DISP_MIN, haltTimer: 0,
            hp: ENEMY_SPECS.raider.hp, maxHp: ENEMY_SPECS.raider.hp,
            speed: ENEMY_SPECS.raider.speed, turnRate: ENEMY_SPECS.raider.turnRate,
            turretRate: ENEMY_SPECS.raider.turretRate, bulletSpd: ENEMY_SPECS.raider.bulletSpd,
            cd: 55, recoil: 0, movePhase: 0, isElite: true, aiSteerTimer: 0, avoidDir: -1
          }
        ];

        bullets = [];
        crates = [];
        remainingSpawns = 12 + stg * 2;
        fortifyTimer = 0;
        empTimer = 0;
        baseAlive = true;
        battleOver = false;
        modalEl.classList.remove('visible');

        if (stg % 3 === 0) {
          enemies.push({
            type: 'boss', x: 312, y: 48, r: ENEMY_SPECS.boss.r, size: ENEMY_SPECS.boss.size,
            hullAng: Math.PI, turretAng: Math.PI, vLin: 0, wHull: 0, wTurret: 0, dispersion: DISP_MIN, haltTimer: 0,
            hp: ENEMY_SPECS.boss.hp + stg * 2, maxHp: ENEMY_SPECS.boss.hp + stg * 2,
            speed: ENEMY_SPECS.boss.speed, turnRate: ENEMY_SPECS.boss.turnRate,
            turretRate: ENEMY_SPECS.boss.turretRate, bulletSpd: ENEMY_SPECS.boss.bulletSpd,
            cd: 60, recoil: 0, movePhase: 0, isElite: true, aiSteerTimer: 0, avoidDir: 1
          });
        }
        updateHud();
      }

      function spawnFloatText(x, y, text, color = '#dfc08e') {
        floatTexts.push({ x, y, text, color, life: 48 });
      }

      function recordTread(tank) {
        if (Math.random() > 0.32) return;
        const isEco = window.NexusSDK?.getSettings?.()?.particleTier === 'eco';
        const maxTreads = isEco ? 45 : 110;
        treadMarks.push({
          x: tank.x,
          y: tank.y,
          ang: tank.hullAng,
          alpha: 0.28
        });
        while (treadMarks.length > maxTreads) treadMarks.shift();
      }

      function triggerGameOver(reasonTitle, reasonDesc) {
        if (battleOver) return;
        battleOver = true;
        modalTitleEl.textContent = reasonTitle;
        modalDescEl.textContent = reasonDesc;
        modalEl.classList.add('visible');
        NexusSDK.audio.warn();
      }

      document.getElementById('btn-modal-redeploy').addEventListener('click', () => {
        NexusSDK.audio.tap();
        stage = 1;
        score = 0;
        p1.lives = 2;
        p1.rank = saveData.rank || 1;
        buildStageMap(1);
      });

      document.getElementById('btn-modal-armory').addEventListener('click', () => {
        NexusSDK.audio.tap();
        modalEl.classList.remove('visible');
        document.querySelector('.nx-return-pill')?.click();
      });

      // =========================================================================
      // 几何碰撞与連続射线求交数学引擎 (Circle vs Polygon/Circle & Segment Raycast)
      // =========================================================================

      // 点 P 到线段 AB 的最近点
      function closestPointOnSegment(px, py, ax, ay, bx, by) {
        const abx = bx - ax;
        const aby = by - ay;
        const lenSq = abx * abx + aby * aby;
        if (lenSq < 1e-6) return { x: ax, y: ay };
        const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
        return { x: ax + t * abx, y: ay + t * aby };
      }

      // 判断点是否在凸多边形内部
      function pointInConvexPolygon(px, py, verts) {
        let pos = 0, neg = 0;
        for (let i = 0, n = verts.length; i < n; i++) {
          const a = verts[i];
          const b = verts[(i + 1) % n];
          const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
          if (cross > 0) pos++;
          else if (cross < 0) neg++;
          if (pos > 0 && neg > 0) return false;
        }
        return true;
      }

      // 计算圆形刚体 (cx, cy, cr) 与异形障碍物的碰撞推出向量与切向滑移法线
      function resolveCircleObstaclePenetration(cx, cy, cr, obs) {
        const dx0 = cx - obs.x;
        const dy0 = cy - obs.y;
        const maxDist = cr + obs.r + 4;
        if (dx0 * dx0 + dy0 * dy0 > maxDist * maxDist) return null;

        // 圆形暗堡或圆形底座
        if (!obs.vertices) {
          const dist = Math.hypot(dx0, dy0) || 0.001;
          const pen = cr + obs.r - dist;
          if (pen > 0) {
            return { nx: dx0 / dist, ny: dy0 / dist, pen };
          }
          return null;
        }

        // 凸多边形掩体 (六角蜂巢砖堡、V型防爆钢墙、三角龙牙障、玄武岩断崖、斜壕)
        const verts = obs.vertices;
        let minDistSq = Infinity;
        let bestQ = null;
        for (let i = 0, n = verts.length; i < n; i++) {
          const a = verts[i];
          const b = verts[(i + 1) % n];
          const q = closestPointOnSegment(cx, cy, a.x, a.y, b.x, b.y);
          const dqx = cx - q.x;
          const dqy = cy - q.y;
          const dSq = dqx * dqx + dqy * dqy;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            bestQ = q;
          }
        }
        const inside = pointInConvexPolygon(cx, cy, verts);
        const dist = Math.sqrt(minDistSq);
        if (inside) {
          const nx = (cx - obs.x) / (Math.hypot(cx - obs.x, cy - obs.y) || 1);
          const ny = (cy - obs.y) / (Math.hypot(cx - obs.x, cy - obs.y) || 1);
          return { nx, ny, pen: cr + dist };
        }
        if (dist < cr) {
          const nx = dist > 1e-4 ? (cx - bestQ.x) / dist : (cx - obs.x) / (Math.hypot(cx - obs.x, cy - obs.y) || 1);
          const ny = dist > 1e-4 ? (cy - bestQ.y) / dist : (cy - obs.y) / (Math.hypot(cx - obs.x, cy - obs.y) || 1);
          return { nx, ny, pen: cr - dist };
        }
        return null;
      }

      // 移动战车并执行与所有异形掩体的连续切向滑动导流 (Zero-Snag Tangential Sliding)
      function moveTankWithPolygonSliding(tank, dt) {
        const hx = Math.sin(tank.hullAng);
        const hy = -Math.cos(tank.hullAng);
        let vx = hx * tank.vLin;
        let vy = hy * tank.vLin;

        tank.x += vx * dt;
        tank.y += vy * dt;

        // 战场边界约束
        const margin = tank.r + 4;
        if (tank.x < margin) tank.x = margin;
        if (tank.x > LOGICAL_SIZE - margin) tank.x = LOGICAL_SIZE - margin;
        if (tank.y < margin) tank.y = margin;
        if (tank.y > LOGICAL_SIZE - margin) tank.y = LOGICAL_SIZE - margin;

        // 与异形障碍物多边形及统帅鹰标核心迭代解算切向滑移
        for (let iter = 0; iter < 2; iter++) {
          for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const hit = resolveCircleObstaclePenetration(tank.x, tank.y, tank.r, obs);
            if (hit) {
              tank.x += hit.nx * hit.pen;
              tank.y += hit.ny * hit.pen;
            }
          }
          // 统帅鹰标核心八角底座碰撞
          const dBaseX = tank.x - eagleBase.x;
          const dBaseY = tank.y - eagleBase.y;
          const distBase = Math.hypot(dBaseX, dBaseY) || 1;
          if (distBase < tank.r + eagleBase.r) {
            const pen = tank.r + eagleBase.r - distBase;
            tank.x += (dBaseX / distBase) * pen;
            tank.y += (dBaseY / distBase) * pen;
          }
          // 战车与战车之间的圆-圆刚体防穿模排斥 (1P、2P 与全体敌坦互不重叠)
          const allTanks = [p1, p2, ...enemies];
          for (let j = 0; j < allTanks.length; j++) {
            const other = allTanks[j];
            if (!other || other === tank || other.hp <= 0) continue;
            const dxT = tank.x - other.x;
            const dyT = tank.y - other.y;
            const minSep = (tank.r || 18) + (other.r || 18);
            const distSq = dxT * dxT + dyT * dyT;
            if (distSq < minSep * minSep) {
              const distT = Math.sqrt(distSq) || 0.01;
              const penT = minSep - distT;
              const nxT = dxT / distT;
              const nyT = dyT / distT;
              tank.x += nxT * penT * 0.65;
              tank.y += nyT * penT * 0.65;
              other.x = Math.max(other.r + 4, Math.min(LOGICAL_SIZE - other.r - 4, other.x - nxT * penT * 0.35));
              other.y = Math.max(other.r + 4, Math.min(LOGICAL_SIZE - other.r - 4, other.y - nyT * penT * 0.35));
            }
          }
        }
      }

      // 两个有向线段 P1->P2 与 A->B 的精确交点与外法线求解 (用于高初速穿甲弹 CCD 防穿模与跳弹)
      function intersectSegmentSegment(p1x, p1y, p2x, p2y, ax, ay, bx, by) {
        const rx = p2x - p1x;
        const ry = p2y - p1y;
        const sx = bx - ax;
        const sy = by - ay;
        const rxs = rx * sy - ry * sx;
        if (Math.abs(rxs) < 1e-6) return null;
        const qpx = ax - p1x;
        const qpy = ay - p1y;
        const t = (qpx * sy - qpy * sx) / rxs;
        const u = (qpx * ry - qpy * rx) / rxs;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          const edgeLen = Math.hypot(sx, sy) || 1;
          // 顺时针多边形顶点的外法线为 (sy / edgeLen, -sx / edgeLen)
          let nx = sy / edgeLen;
          let ny = -sx / edgeLen;
          if (nx * rx + ny * ry > 0) {
            nx = -nx;
            ny = -ny;
          }
          return { t, x: p1x + t * rx, y: p1y + t * ry, nx, ny };
        }
        return null;
      }

      // 线段 P1->P2 与圆 (cx, cy, r) 的首次交点与法线求解
      function intersectSegmentCircle(p1x, p1y, p2x, p2y, cx, cy, r) {
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        const fx = p1x - cx;
        const fy = p1y - cy;
        const a = dx * dx + dy * dy;
        if (a < 1e-6) return null;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;
        let disc = b * b - 4 * a * c;
        if (disc < 0) return null;
        disc = Math.sqrt(disc);
        const t = (-b - disc) / (2 * a);
        if (t >= 0 && t <= 1) {
          const hx = p1x + t * dx;
          const hy = p1y + t * dy;
          const len = Math.hypot(hx - cx, hy - cy) || 1;
          return { t, x: hx, y: hy, nx: (hx - cx) / len, ny: (hy - cy) / len };
        }
        return null;
      }

      // 高初速穿甲弹连续碰撞检测 (CCD Raycast vs. Polygon/Circle Obstacles)
      function traceBulletObstacles(x0, y0, x1, y1) {
        let bestHit = null;
        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          if (obs.allowBulletPass) continue; // 龙牙锥与反坦克壕沟允许高初速炮弹飞越

          // 快速包围球剔除
          const midX = (x0 + x1) * 0.5;
          const midY = (y0 + y1) * 0.5;
          const halfStep = Math.hypot(x1 - x0, y1 - y0) * 0.5 + obs.r + 6;
          if (Math.hypot(midX - obs.x, midY - obs.y) > halfStep) continue;

          if (!obs.vertices) {
            const h = intersectSegmentCircle(x0, y0, x1, y1, obs.x, obs.y, obs.r);
            if (h && (!bestHit || h.t < bestHit.t)) {
              bestHit = { ...h, obs, obsIndex: i };
            }
          } else {
            const verts = obs.vertices;
            for (let k = 0, n = verts.length; k < n; k++) {
              const va = verts[k];
              const vb = verts[(k + 1) % n];
              const h = intersectSegmentSegment(x0, y0, x1, y1, va.x, va.y, vb.x, vb.y);
              if (h && (!bestHit || h.t < bestHit.t)) {
                bestHit = { ...h, obs, obsIndex: i };
              }
            }
          }
        }
        return bestHit;
      }

      // 战场障碍物保持永恒不可破坏地形 (Indestructible Terrain Obstacles)：拦截炮弹或触发斜面跳弹，绝不扣血或摧毁地形
      function handleBulletObstacleHit(bullet, hit) {
        const obs = hit.obs;
        const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
        const ux = bullet.vx / speed;
        const uy = bullet.vy / speed;
        const cosIncidence = Math.abs(ux * hit.nx + uy * hit.ny); // cos(入射角)

        if (obs.kind === 'chevron-steel') {
          // V 型折角防爆钢墙：大倾角擦碰触发物理镜面跳弹 (Ricochet)，正入射直接阻挡吸收，地形完好无损
          if ((bullet.bounces || 0) < 1 && cosIncidence < 0.82) {
            const dot = bullet.vx * hit.nx + bullet.vy * hit.ny;
            bullet.vx = (bullet.vx - 2 * dot * hit.nx) * 0.90;
            bullet.vy = (bullet.vy - 2 * dot * hit.ny) * 0.90;
            bullet.x = hit.x + hit.nx * 3.5;
            bullet.y = hit.y + hit.ny * 3.5;
            bullet.bounces = (bullet.bounces || 0) + 1;
            explode(hit.x, hit.y, '#dfc08e', 9);
            NexusSDK.audio.hit();
            return 'ricochet';
          }
          explode(hit.x, hit.y, '#9eb0c7', 6);
          NexusSDK.audio.hit();
          return 'consumed';
        }

        // 六角砖堡、混凝土暗堡、玄武岩断崖等所有障碍物：全部作为不可破坏地形阻挡炮弹并迸发受击火花
        const sparkColor = obs.kind === 'hex-brick' ? '#b5604a' : (obs.kind === 'pillbox' ? '#9aa8bd' : '#8598b0');
        explode(hit.x, hit.y, sparkColor, 7);
        NexusSDK.audio.hit();
        return 'consumed';
      }

      function syncObstacleDamageOverLan(_obs) {
        // 障碍物为不可破坏恒定地形，无需同步毁伤
      }

      function spawnEnemy() {
        if (remainingSpawns <= 0 || enemies.length >= 6) return;
        const spawnXList = [72, 312, 552];
        const sx = spawnXList[remainingSpawns % 3];
        const types = ['scout', 'raider', 'shooter', 'mammoth'];
        const type = types[(remainingSpawns + stage) % types.length];
        const sp = ENEMY_SPECS[type] || ENEMY_SPECS.scout;
        const isElite = (remainingSpawns % 4 === 0);
        enemies.push({
          type,
          x: sx,
          y: 44,
          r: sp.r,
          size: sp.size,
          hullAng: Math.PI,
          turretAng: Math.PI,
          vLin: 0,
          wHull: 0,
          wTurret: 0,
          dispersion: DISP_MIN,
          haltTimer: 0,
          hp: sp.hp,
          maxHp: sp.hp,
          speed: sp.speed,
          turnRate: sp.turnRate,
          turretRate: sp.turretRate,
          bulletSpd: sp.bulletSpd,
          cd: 55,
          recoil: 0,
          movePhase: 0,
          isElite,
          aiSteerTimer: 0,
          avoidDir: remainingSpawns % 2 === 0 ? 1 : -1
        });
        remainingSpawns--;
        updateHud();
      }

      function spawnRandomCrate(x, y) {
        const spec = CRATE_TYPES[Math.floor(Math.random() * CRATE_TYPES.length)];
        const newCrate = {
          x: x ?? (90 + Math.random() * 444),
          y: y ?? (120 + Math.random() * 340),
          life: 660,
          kind: spec.kind,
          tag: spec.tag,
          label: spec.label,
          color: spec.color,
          rot: 0
        };
        crates.push(newCrate);
        if (lan.isConnected() && lanRole === 'host') {
          lan.sendReliable({ type: 'crate_spawn', crate: newCrate });
        }
      }

      function applyCrateEffect(cr, collectorTank) {
        NexusSDK.audio.pickup();
        saveData.currency.tankCoins += 60;
        spawnFloatText(cr.x, cr.y - 12, cr.label, cr.color);

        if (cr.kind === 'star') {
          collectorTank.rank = Math.min(4, (collectorTank.rank || 1) + 1);
          if (collectorTank === p1) saveData.rank = p1.rank;
        } else if (cr.kind === 'fortify') {
          fortifyTimer = 1200;
          rebuildBasePerimeter(true);
        } else if (cr.kind === 'emp') {
          empTimer = 600; // 10.0 秒全场敌坦火控与推进瘫痪 (60Hz * 10s)
          explode(cr.x, cr.y, '#c48f5a', 18);
        } else if (cr.kind === 'nuke') {
          for (let j = enemies.length - 1; j >= 0; j--) {
            const en = enemies[j];
            if (en.type !== 'boss') {
              en.hp = 0;
            } else {
              en.hp = Math.max(1, en.hp - 6);
            }
            explode(en.x, en.y, '#dfc08e', 16);
            if (en.hp <= 0) {
              const bSpec = ENEMY_BOUNTIES[en.type] || ENEMY_BOUNTIES.scout;
              score += bSpec.score;
              saveData.currency.tankCoins += bSpec.coins;
              enemies.splice(j, 1);
            }
          }
          NexusSDK.audio.explosion();
        } else if (cr.kind === 'shield') {
          collectorTank.shield = 600;
          collectorTank.hp = Math.min(3, collectorTank.hp + 1);
        }
        if (score > (saveData.stats.highScore || 0)) saveData.stats.highScore = score;
        store.save(saveData);
        updateHud();
      }

      // 敌我统一高初速穿甲击发函数 (共享动态移动散布角采样 + 驻停满缩圈「定点精密穿甲」奖励 + 开火后坐力瞬态扩圈)
      function fireTank(tank, owner) {
        if (battleOver || tank.cd > 0) return;
        const isEnemy = owner === 'enemy';
        const rSpec = isEnemy ? null : RANK_SPECS[Math.min(4, Math.max(0, tank.rank || 1))];
        const eSpec = isEnemy ? (ENEMY_SPECS[tank.type] || ENEMY_SPECS.scout) : null;

        if (!isEnemy) {
          const myActiveShots = bullets.filter((b) => b.owner === owner).length;
          if (myActiveShots >= rSpec.maxShots + 1) return;
          const reloadFrames = owner === 'p2' ? 108 : (rSpec.cdFrames || 96);
          tank.cd = reloadFrames;
          tank.maxCd = reloadFrames;
        } else {
          const reloadFrames = eSpec.cdFrames || 132;
          tank.cd = reloadFrames;
          tank.maxCd = reloadFrames;
        }
        tank.recoil = 1.0;

        // 计算当前散布半角 sigma 与是否触发「驻停定点精密射击」奖励 (精度 >= 92% 且车体静止)
        const sigma = tank.dispersion ?? DISP_MIN;
        const accPct = getTankAccuracyPct(tank);
        const isPinpoint = Math.abs(tank.vLin || 0) < 2.2 && Math.abs(tank.wHull || 0) < 0.08 && accPct >= 92;

        // 三角分布弹道偏角采样：运动中散布大，驻停缩圈后趋近于 0° 激光精度
        const jitter = isPinpoint ? (Math.random() - 0.5) * 0.004 : ((Math.random() - Math.random()) * sigma);
        const shotAng = tank.turretAng + jitter;

        // 炮口方向仍取 tank.turretAng 计算出膛起点，飞行速度矢量取带散布偏角的 shotAng
        const muzzleX = Math.sin(tank.turretAng);
        const muzzleY = -Math.cos(tank.turretAng);

        // 定点精密射击奖励：穿甲弹初速额外 +12% 膛压增益 (敌我同享)，且我方 2 阶以上附加弱点高爆破片 (+1 伤害)
        const baseBulletSpd = isEnemy ? (tank.bulletSpd || eSpec.bulletSpd || 720) : rSpec.bulletSpd;
        const speed = Math.round(baseBulletSpd * (isPinpoint ? 1.12 : 1.0));
        const hasFragBonus = isPinpoint && !isEnemy && (tank.rank || 1) >= 2;
        const shotDmg = isEnemy ? 1 : (rSpec.dmg + (hasFragBonus ? 1 : 0));

        // 击发后坐力引发瞬时扩圈脉冲 (+0.11 rad，敌我同享)
        tank.dispersion = Math.min(DISP_MAX, sigma + 0.11);

        // 铁幕攻城列车首领 (boss) 触发三联高初速扇形穿甲弹幕，其余单位发射主炮穿甲弹
        const fanOffsets = (isEnemy && tank.type === 'boss') ? [-0.14, 0, 0.14] : [0];
        fanOffsets.forEach((off) => {
          const finalAng = shotAng + off;
          const dirX = Math.sin(finalAng);
          const dirY = -Math.cos(finalAng);
          bullets.push({
            x: tank.x + muzzleX * 22,
            y: tank.y + muzzleY * 22,
            prevX: tank.x + muzzleX * 10,
            prevY: tank.y + muzzleY * 10,
            vx: dirX * speed,
            vy: dirY * speed,
            owner,
            breakSteel: isEnemy ? (tank.type === 'boss') : rSpec.breakSteel,
            dmg: shotDmg,
            fragBonus: hasFragBonus,
            pinpoint: isPinpoint,
            bounces: 0
          });
        });

        if (owner === 'p1' || (owner === 'p2' && lan.isConnected() && lanRole === 'client')) {
          NexusSDK.audio.shoot();
          if (window.NexusSDK?.getSettings?.()?.haptics && navigator.vibrate) {
            navigator.vibrate(14);
          }
          updateHud();
          if (lan.isConnected() && lanRole === 'client' && owner === 'p2') {
            lan.sendFast({
              type: 'p2_state',
              x: Math.round(p2.x),
              y: Math.round(p2.y),
              hullAng: Number(p2.hullAng.toFixed(3)),
              turretAng: Number(p2.turretAng.toFixed(3)),
              dispersion: Number(p2.dispersion.toFixed(3)),
              fire: true
            });
          }
        }
      }

      function explode(x, y, color = '#d8b584', count = 10) {
        const isEco = window.NexusSDK?.getSettings?.()?.particleTier === 'eco';
        const effCount = isEco ? Math.max(3, Math.ceil(count * 0.5)) : count;
        for (let i = 0; i < effCount; i++) {
          const a = (Math.PI * 2 * i) / effCount + Math.random() * 0.4;
          const sp = 1.6 + Math.random() * 3.2;
          particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 16 + Math.floor(Math.random() * 10), color
          });
        }
      }

      // =========================================================================
      // 输入控制：左侧全向车体移动摇杆 + 右侧开火键双翼独立炮塔旋转按钮 (支持多点触控无冲)
      // =========================================================================
      const activeHullCommands = new Set();
      const joyState = { active: false, pointerId: null, dx: 0, dy: 0 };
      let turretTurnDir = 0; // -1: 炮塔逆时针左旋, +1: 炮塔顺时针右旋
      let turretHoldFrames = 0;
      const keys = {};

      window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'KeyK') {
          e.preventDefault();
          const isClient = lan.isConnected() && lanRole === 'client';
          fireTank(isClient ? p2 : p1, isClient ? 'p2' : 'p1');
        }
      });
      window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
      });

      // 绑定左翼全向液压车体移动摇杆 (#hull-joystick)
      const joyHousing = document.getElementById('hull-joystick');
      const joyKnob = document.getElementById('hull-joystick-knob');
      const JOY_MAX_RADIUS = 41;

      function updateJoystickFromClientPoint(clientX, clientY) {
        if (!joyHousing) return;
        const rect = joyHousing.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        let rx = clientX - cx;
        let ry = clientY - cy;
        const dist = Math.hypot(rx, ry);
        const maxR = Math.max(24, Math.min(JOY_MAX_RADIUS, rect.width * 0.31));
        if (dist > maxR) {
          rx = (rx / dist) * maxR;
          ry = (ry / dist) * maxR;
        }
        joyState.dx = rx / maxR;
        joyState.dy = ry / maxR;
        if (joyKnob) {
          joyKnob.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
        }
      }

      function resetJoystick() {
        joyState.active = false;
        joyState.pointerId = null;
        joyState.dx = 0;
        joyState.dy = 0;
        if (joyHousing) joyHousing.classList.remove('active');
        if (joyKnob) joyKnob.style.transform = 'translate3d(0px, 0px, 0)';
      }

      if (joyHousing) {
        joyHousing.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          joyState.active = true;
          joyState.pointerId = e.pointerId;
          joyHousing.classList.add('active');
          try { joyHousing.setPointerCapture(e.pointerId); } catch (_) {}
          updateJoystickFromClientPoint(e.clientX, e.clientY);
        });
        joyHousing.addEventListener('pointermove', (e) => {
          if (!joyState.active || (joyState.pointerId !== null && e.pointerId !== joyState.pointerId)) return;
          e.preventDefault();
          updateJoystickFromClientPoint(e.clientX, e.clientY);
        });
        const onJoyEnd = (e) => {
          if (joyState.pointerId !== null && e.pointerId !== undefined && e.pointerId !== joyState.pointerId) return;
          resetJoystick();
        };
        joyHousing.addEventListener('pointerup', onJoyEnd);
        joyHousing.addEventListener('pointercancel', onJoyEnd);
        joyHousing.addEventListener('lostpointercapture', () => resetJoystick());
      }
      window.__tankJoystick = {
        state: joyState,
        setVector(dx, dy) {
          joyState.active = Math.hypot(dx, dy) > 0.05;
          joyState.dx = Math.max(-1, Math.min(1, dx));
          joyState.dy = Math.max(-1, Math.min(1, dy));
          if (joyKnob) {
            joyKnob.style.transform = `translate3d(${(joyState.dx * JOY_MAX_RADIUS).toFixed(1)}px, ${(joyState.dy * JOY_MAX_RADIUS).toFixed(1)}px, 0)`;
          }
        },
        reset: resetJoystick
      };

      // 绑定右翼开火键两侧的独立炮塔左旋 / 右旋按钮
      const btnTurretCcw = document.getElementById('btn-turret-ccw');
      const btnTurretCw = document.getElementById('btn-turret-cw');
      const btnFire = document.getElementById('btn-fire');

      function bindTurretBtn(btn, dirVal) {
        const start = (e) => {
          e.preventDefault();
          turretTurnDir = dirVal;
          turretHoldFrames = 0;
          btn.classList.add('pressed');
        };
        const end = (e) => {
          e.preventDefault();
          if (turretTurnDir === dirVal) {
            turretTurnDir = 0;
            turretHoldFrames = 0;
          }
          btn.classList.remove('pressed');
        };
        btn.addEventListener('pointerdown', start);
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointercancel', end);
        btn.addEventListener('pointerleave', end);
      }
      bindTurretBtn(btnTurretCcw, -1);
      bindTurretBtn(btnTurretCw, 1);

      btnFire.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btnFire.classList.add('pressed');
        const isClient = lan.isConnected() && lanRole === 'client';
        fireTank(isClient ? p2 : p1, isClient ? 'p2' : 'p1');
      });
      const releaseFire = () => btnFire.classList.remove('pressed');
      btnFire.addEventListener('pointerup', releaseFire);
      btnFire.addEventListener('pointercancel', releaseFire);
      btnFire.addEventListener('pointerleave', releaseFire);

      // 局域网双通道同步 (360° 连续车体角 hullAng + 炮塔角 turretAng + 异形工事毁伤)
      const lan = NexusSDK.createLanSession('tank-battle', store.getAuth().room);
      let lanRole = 'host';

      lan.onStatus((st) => {
        const el = document.getElementById('hud-lan');
        lanRole = st.role || 'host';
        if (st.connected) {
          el.textContent = `LAN 1~5ms (${lanRole.toUpperCase()})`;
          el.style.color = '#dfc08e';
          p2.isRemote = true;
        } else if (st.failoverActive) {
          el.textContent = '3s 自愈 · AI 僚机接管';
          el.style.color = '#c48f5a';
          p2.isRemote = false;
        } else {
          el.textContent = '360° 陀螺火控协同';
          el.style.color = '#c48f5a';
          p2.isRemote = false;
        }
      });

      lan.onFast((msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'p2_state') {
          p2.x = Number(msg.x) || p2.x;
          p2.y = Number(msg.y) || p2.y;
          if (typeof msg.hullAng === 'number') p2.hullAng = msg.hullAng;
          if (typeof msg.turretAng === 'number') p2.turretAng = msg.turretAng;
          if (typeof msg.dispersion === 'number') p2.dispersion = msg.dispersion;
          p2.movePhase += 0.35;
          if (msg.fire && lanRole === 'host') fireTank(p2, 'p2');
        } else if (msg.type === 'world_sync' && lanRole === 'client') {
          if (msg.p1 && typeof msg.p1 === 'object') {
            p1.x = Number(msg.p1.x) || p1.x;
            p1.y = Number(msg.p1.y) || p1.y;
            if (typeof msg.p1.hullAng === 'number') p1.hullAng = msg.p1.hullAng;
            if (typeof msg.p1.turretAng === 'number') p1.turretAng = msg.p1.turretAng;
            if (typeof msg.p1.dispersion === 'number') p1.dispersion = msg.p1.dispersion;
            if (typeof msg.p1.hp === 'number') p1.hp = msg.p1.hp;
            if (typeof msg.p1.rank === 'number') p1.rank = msg.p1.rank;
            if (typeof msg.p1.lives === 'number') p1.lives = msg.p1.lives;
            if (typeof msg.p1.shield === 'number') p1.shield = msg.p1.shield;
          }
          if (msg.p2 && typeof msg.p2 === 'object') {
            if (typeof msg.p2.hp === 'number') p2.hp = msg.p2.hp;
            if (typeof msg.p2.rank === 'number') p2.rank = msg.p2.rank;
            if (typeof msg.p2.shield === 'number') p2.shield = msg.p2.shield;
          }
          if (Array.isArray(msg.enemies)) enemies = msg.enemies;
          if (Array.isArray(msg.bullets)) {
            bullets = msg.bullets.map((b) => ({
              ...b,
              dmg: Number(b.dmg) || 1,
              breakSteel: !!b.breakSteel,
              fragBonus: !!b.fragBonus
            }));
          }
          if (typeof msg.empTimer === 'number') empTimer = msg.empTimer;
          if (typeof msg.fortifyTimer === 'number') fortifyTimer = msg.fortifyTimer;
          if (typeof msg.remainingSpawns === 'number') remainingSpawns = msg.remainingSpawns;
          if (typeof msg.score === 'number') score = msg.score;
          if (typeof msg.stage === 'number' && msg.stage !== stage) {
            stage = msg.stage;
            buildStageMap(stage);
          }
          updateHud();
        }
      });

      lan.onReliable((msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'fortify') {
          fortifyTimer = 1200;
          rebuildBasePerimeter(true);
          NexusSDK.audio.upgrade();
        } else if (msg.type === 'crate_spawn' && msg.crate) {
          crates.push(msg.crate);
        }
      });

      // 2P 智能 AI 僚机：与玩家/敌坦同源调用 stepTankKinematicsAndDispersion (原地转向 + 直线推进) + fireTank
      function updateAIWingman(dt) {
        if (p2.isRemote && lan.isConnected()) return;
        const target = enemies[0];
        const patrolX = 410 + Math.sin(performance.now() * 0.0008) * 75;
        const patrolY = 485 + Math.cos(performance.now() * 0.0006) * 45;
        const destX = target ? (target.x * 0.35 + patrolX * 0.65) : patrolX;
        const destY = target ? Math.min(545, Math.max(360, target.y + 160)) : patrolY;

        let tDiff = Math.PI;
        if (target) {
          const aimAng = Math.atan2(target.x - p2.x, -(target.y - p2.y));
          tDiff = shortestAngleDiff(p2.turretAng, aimAng);
        }

        // 若目标进入射界且主炮装填临近，触发短停制动缩圈 (Short-Halt Brake)
        if (target && Math.abs(tDiff) < 0.35 && p2.cd <= 14 && (p2.haltTimer || 0) <= 0 && (p2.dispersion || DISP_MIN) > 0.036) {
          p2.haltTimer = 34;
        }

        let p2Throttle = 0;
        let p2Steer = 0;
        const prevX = p2.x, prevY = p2.y;

        if ((p2.haltTimer || 0) > 0) {
          p2.haltTimer--;
          p2Throttle = 0;
          p2Steer = 0;
        } else if ((p2.aiSteerTimer || 0) > 0) {
          p2.aiSteerTimer--;
          if (p2.aiSteerTimer > 12) {
            p2Steer = p2.avoidDir || 1;
            p2Throttle = 0;
          } else {
            p2Steer = 0;
            p2Throttle = 1;
          }
        } else if (Math.hypot(destX - p2.x, destY - p2.y) > 24) {
          const desiredHullAng = Math.atan2(destX - p2.x, -(destY - p2.y));
          const hullDiff = shortestAngleDiff(p2.hullAng, desiredHullAng);
          if (Math.abs(hullDiff) > 0.06) {
            p2Steer = Math.sign(hullDiff) * Math.min(1, Math.abs(hullDiff) / (1.50 * dt));
            p2Throttle = 0;
          } else {
            p2.hullAng = desiredHullAng;
            p2Steer = 0;
            p2Throttle = 1;
          }
        }

        // 2P 炮塔独立 360° 索敌瞄准
        let wTur = 0;
        if (target) {
          const stepT = Math.sign(tDiff) * Math.min(Math.abs(tDiff), 2.15 * dt);
          wTur = stepT / dt;
          p2.turretAng = normalizeAngle(p2.turretAng + stepT);
        }

        // 调用统一的底盘加减速、转向降速与动态移动散布方程 (2P 车速 58 px/s)
        stepTankKinematicsAndDispersion(p2, p2Throttle, p2Steer, wTur, 58, 38, 1.50, dt);

        if (p2Throttle > 0 && Math.hypot(p2.x - prevX, p2.y - prevY) < 58 * dt * 0.25 && Math.abs(p2.vLin) > 20 && (p2.aiSteerTimer || 0) <= 0) {
          p2.avoidDir = (p2.avoidDir || 1) * -1;
          p2.aiSteerTimer = 24;
        }

        if (target && Math.abs(tDiff) < 0.18 && p2.cd <= 0 && (p2.dispersion <= 0.042 || p2.haltTimer === 1)) {
          fireTank(p2, 'p2');
          p2.haltTimer = 0;
        }
      }

      function updateHud() {
        const ctrlTank = (lan.isConnected() && lanRole === 'client') ? p2 : p1;
        const rSpec = RANK_SPECS[Math.min(4, Math.max(0, ctrlTank.rank || 1))];
        const hullDeg = Math.round(((normalizeAngle(ctrlTank.hullAng) * 180) / Math.PI + 360) % 360);
        const turDeg = Math.round(((normalizeAngle(ctrlTank.turretAng) * 180) / Math.PI + 360) % 360);
        const accPct = getTankAccuracyPct(ctrlTank);
        const isStationary = Math.abs(ctrlTank.vLin || 0) < 3 && Math.abs(ctrlTank.wHull || 0) < 0.08;
        const isPinpoint = isStationary && accPct >= 92;
        const effVel = isPinpoint ? Math.round(rSpec.bulletSpd * 1.12) : rSpec.bulletSpd;
        document.getElementById('hud-stage').textContent = `第 ${stage} 关`;
        document.getElementById('hud-enemies').textContent = `${remainingSpawns + enemies.length} 辆`;
        document.getElementById('hud-coins').textContent = (saveData.currency?.tankCoins ?? 0).toLocaleString();
        document.getElementById('hud-angles').textContent = `${hullDeg}°/${turDeg}°`;
        const ammoEl = document.getElementById('hud-ammo-vel');
        if (ammoEl) {
          if (ctrlTank.cd > 0) {
            const remSec = (ctrlTank.cd / 60).toFixed(1);
            ammoEl.textContent = `装填${remSec}s·${accPct}%`;
            ammoEl.style.color = '#f59e0b';
          } else {
            ammoEl.textContent = isPinpoint ? `精瞄${accPct}%·${effVel}` : `精度${accPct}%·${effVel}`;
            ammoEl.style.color = isPinpoint ? '#fde047' : (accPct < 60 ? '#fb7185' : '#cbd5e1');
          }
        }
        document.getElementById('hud-hp').textContent = `装甲${ctrlTank.hp}·${baseAlive ? '完好' : '被毁'}`;
        document.getElementById('hud-lives').textContent = `${ctrlTank.rank}阶 · ×${p1.lives}车组`;
        document.getElementById('hud-score').textContent = score.toLocaleString();
      }

      // =====================================================================
      // 坦克体积碰撞解算器：禁止坦克重叠 + 碰撞触发冲撞伤害 (同阵营免疫伤害)
      // =====================================================================
      function resolveTankCollisions() {
        const allTanks = [];
        if (p1.hp > 0 && p1.alive !== false) {
          allTanks.push({ entity: p1, team: 'player', isBoss: false, name: '1P 统帅战车' });
        }
        if (p2.hp > 0 && p2.alive !== false) {
          allTanks.push({ entity: p2, team: 'player', isBoss: false, name: '2P 僚机战车' });
        }
        enemies.forEach((en) => {
          if (en.hp > 0) {
            allTanks.push({
              entity: en,
              team: 'enemy',
              isBoss: en.type === 'boss',
              name: en.type === 'boss' ? '敌军重型陆行巨兽' : '敌方战车'
            });
          }
        });

        for (let i = 0; i < allTanks.length; i++) {
          const tA = allTanks[i];
          const a = tA.entity;
          const rA = a.r || 18.5;

          for (let j = i + 1; j < allTanks.length; j++) {
            const tB = allTanks[j];
            const b = tB.entity;
            const rB = b.r || 18.5;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            const minDist = rA + rB;

            if (dist < minDist) {
              // 1. 硬物理分离：绝对禁止坦克相互重叠
              const overlap = minDist - dist;
              let nx = dx / (dist || 1);
              let ny = dy / (dist || 1);
              if (dist < 0.001) {
                const rndAng = Math.random() * Math.PI * 2;
                nx = Math.cos(rndAng);
                ny = Math.sin(rndAng);
              }

              let weightA = 0.5;
              let weightB = 0.5;
              if (tA.isBoss) { weightA = 0.06; weightB = 0.94; }
              else if (tB.isBoss) { weightA = 0.94; weightB = 0.06; }

              a.x += nx * overlap * weightA;
              a.y += ny * overlap * weightA;
              b.x -= nx * overlap * weightB;
              b.y -= ny * overlap * weightB;

              const marginA = rA + 4;
              a.x = Math.max(marginA, Math.min(LOGICAL_SIZE - marginA, a.x));
              a.y = Math.max(marginA, Math.min(LOGICAL_SIZE - marginA, a.y));
              const marginB = rB + 4;
              b.x = Math.max(marginB, Math.min(LOGICAL_SIZE - marginB, b.x));
              b.y = Math.max(marginB, Math.min(LOGICAL_SIZE - marginB, b.y));

              if (typeof a.vLin === 'number') a.vLin *= 0.65;
              if (typeof b.vLin === 'number') b.vLin *= 0.65;

              // 2. 阵营碰撞判定：同阵营免疫伤害，敌对阵营触发碰撞伤害
              if (tA.team !== tB.team) {
                const now = performance.now();
                const canDamageA = !a.lastRamTime || (now - a.lastRamTime > 600);
                const canDamageB = !b.lastRamTime || (now - b.lastRamTime > 600);

                if (canDamageA || canDamageB) {
                  a.lastRamTime = now;
                  b.lastRamTime = now;

                  const midX = (a.x + b.x) * 0.5;
                  const midY = (a.y + b.y) * 0.5;
                  explode(midX, midY, '#f59e0b', 12);
                  NexusSDK.audio.hit();

                  const dmgToA = tB.isBoss ? 2 : 1;
                  const dmgToB = 1;

                  // 结算 A
                  if (a.shield && a.shield > 0) {
                    a.shield = Math.max(0, a.shield - dmgToA * 80);
                    spawnFloatText(a.x, a.y - 20, `冲撞抵片 -${dmgToA}`, '#38bdf8');
                  } else {
                    a.hp = Math.max(0, a.hp - dmgToA);
                    spawnFloatText(a.x, a.y - 20, `装甲冲撞 -${dmgToA}`, '#ef4444');
                  }
                  a.hitShake = 0.8;

                  // 结算 B
                  if (b.shield && b.shield > 0) {
                    b.shield = Math.max(0, b.shield - dmgToB * 80);
                    spawnFloatText(b.x, b.y - 20, `冲撞抵片 -${dmgToB}`, '#38bdf8');
                  } else {
                    b.hp = Math.max(0, b.hp - dmgToB);
                    spawnFloatText(b.x, b.y - 20, `冲撞受损 -${dmgToB}`, '#fbbf24');
                  }
                  b.hitShake = 0.8;

                  // 敌坦爆毁判定
                  if (tA.team === 'enemy' && a.hp <= 0) {
                    explode(a.x, a.y, '#d8b584', 16);
                    NexusSDK.audio.explosion();
                    const bSpec = ENEMY_BOUNTIES[a.type] || ENEMY_BOUNTIES.scout;
                    score += bSpec.score;
                    saveData.currency.tankCoins += bSpec.coins;
                    enemies = enemies.filter((e) => e !== a);
                  }
                  if (tB.team === 'enemy' && b.hp <= 0) {
                    explode(b.x, b.y, '#d8b584', 16);
                    NexusSDK.audio.explosion();
                    const bSpec = ENEMY_BOUNTIES[b.type] || ENEMY_BOUNTIES.scout;
                    score += bSpec.score;
                    saveData.currency.tankCoins += bSpec.coins;
                    enemies = enemies.filter((e) => e !== b);
                  }

                  // 玩家战车损毁判定
                  if (tA.team === 'player' && a.hp <= 0 && a === p1) {
                    p1.lives--;
                    if (p1.lives <= 0) {
                      explode(p1.x, p1.y, '#c97a63', 24);
                      NexusSDK.audio.explosion();
                      triggerGameOver('战车殉爆 · 作战失败', '统帅重装战车在装甲冲撞中彻底殉爆。');
                    } else {
                      p1.hp = 3;
                      p1.shield = 180;
                      spawnFloatText(p1.x, p1.y - 18, '备用车体投入战场', '#38bdf8');
                    }
                  }
                  if (tB.team === 'player' && b.hp <= 0 && b === p1) {
                    p1.lives--;
                    if (p1.lives <= 0) {
                      explode(p1.x, p1.y, '#c97a63', 24);
                      NexusSDK.audio.explosion();
                      triggerGameOver('战车殉爆 · 作战失败', '统帅重装战车在装甲冲撞中彻底殉爆。');
                    } else {
                      p1.hp = 3;
                      p1.shield = 180;
                      spawnFloatText(p1.x, p1.y - 18, '备用车体投入战场', '#38bdf8');
                    }
                  }

                  updateHud();
                }
              } else {
                // 同阵营：仅硬体积推开防重叠，完全免疫伤害
                if (Math.random() < 0.1) {
                  explode((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#94a3b8', 2);
                }
              }
            }
          }
        }
      }

      function step() {
        if (window.NexusSDK && !window.NexusSDK.isGameplayActive()) return;
        if (battleOver) return;

        if (p1.cd > 0) {
          p1.cd--;
          if (p1.cd === 0 || p1.cd % 6 === 0) updateHud();
        }
        if (p2.cd > 0) {
          p2.cd--;
          if ((lan.isConnected() && lanRole === 'client') && (p2.cd === 0 || p2.cd % 6 === 0)) updateHud();
        }
        if (p1.shield > 0) p1.shield--;
        if (p2.shield > 0) p2.shield--;
        if (p1.recoil > 0) p1.recoil = Math.max(0, p1.recoil - 0.12);
        if (p2.recoil > 0) p2.recoil = Math.max(0, p2.recoil - 0.12);
        if (p1.hitShake > 0) p1.hitShake = Math.max(0, p1.hitShake - 0.1);
        if (p2.hitShake > 0) p2.hitShake = Math.max(0, p2.hitShake - 0.1);

        if (fortifyTimer > 0) {
          fortifyTimer--;
          if (fortifyTimer === 0) rebuildBasePerimeter(false);
        }
        if (empTimer > 0) empTimer--;

        // =====================================================================
        // 1. 车体参照系 (Tank-Centric) 连续移动与差速转向 + 陀螺稳定独立炮塔控制 (Host 控 P1 / Client 控 P2)
        // =====================================================================
        const isClientMode = lan.isConnected() && lanRole === 'client';
        const ctrlTank = isClientMode ? p2 : p1;
        const rSpec = RANK_SPECS[Math.min(4, Math.max(0, ctrlTank.rank || 1))];
        let throttle = 0; // +1: 沿车头前进, -1: 沿车尾倒车
        let hullSteer = 0; // -1: 车体逆时针左转, +1: 车体顺时针右转

        const joyMag = Math.min(1, Math.hypot(joyState.dx, joyState.dy));
        if (joyState.active && joyMag > 0.14) {
          // 履带战车原地转向模式 (In-Place Pivot Turning)：当摇杆方向与车头存在夹角时，先在原地旋转车体对准方向，对准后再直线前进
          const targetHullAng = Math.atan2(joyState.dx, -joyState.dy);
          const angDiff = shortestAngleDiff(ctrlTank.hullAng, targetHullAng);
          const maxStepHull = rSpec.turnRate * DT;
          if (Math.abs(angDiff) <= Math.max(0.06, maxStepHull)) {
            ctrlTank.hullAng = targetHullAng;
            hullSteer = 0;
            throttle = joyMag;
          } else {
            hullSteer = Math.sign(angDiff) * Math.min(1, Math.abs(angDiff) / maxStepHull);
            throttle = 0;
          }
        } else {
          if (keys['KeyA'] || keys['ArrowLeft'] || activeHullCommands.has('ccw') || activeHullCommands.has('fwd-ccw') || activeHullCommands.has('rev-ccw')) {
            hullSteer -= 1;
          }
          if (keys['KeyD'] || keys['ArrowRight'] || activeHullCommands.has('cw') || activeHullCommands.has('fwd-cw') || activeHullCommands.has('rev-cw')) {
            hullSteer += 1;
          }
          // 仅在未执行原地转向时才允许前后直线推进
          if (hullSteer === 0) {
            if (keys['KeyW'] || keys['ArrowUp'] || activeHullCommands.has('fwd') || activeHullCommands.has('fwd-ccw') || activeHullCommands.has('fwd-cw')) {
              throttle += 1;
            }
            if (keys['KeyS'] || keys['ArrowDown'] || activeHullCommands.has('rev') || activeHullCommands.has('rev-ccw') || activeHullCommands.has('rev-cw')) {
              throttle -= 1;
            }
          }
        }

        // 右翼独立炮塔旋转按钮 & 键盘 (Q/J 左旋, E/L 右旋)：双阶阻尼 (点按精瞄 / 长按液压高速调炮)
        let effTurretDir = turretTurnDir;
        if (keys['KeyQ'] || keys['KeyJ']) effTurretDir = -1;
        if (keys['KeyE'] || keys['KeyL']) effTurretDir = 1;

        let ctrlWTurret = 0;
        if (effTurretDir !== 0) {
          turretHoldFrames++;
          const dampingFactor = turretHoldFrames < 10 ? 0.48 : 1.0;
          const turretOmega = 2.85 * dampingFactor; // 最大 163°/s 独立调炮角速度
          ctrlWTurret = effTurretDir * turretOmega;
          ctrlTank.turretAng = normalizeAngle(ctrlTank.turretAng + ctrlWTurret * DT);
        }

        // 调用统一的底盘加减速、转向降速与动态移动散布方程
        const prevAcc = getTankAccuracyPct(ctrlTank);
        stepTankKinematicsAndDispersion(ctrlTank, throttle, hullSteer, ctrlWTurret, rSpec.fwdSpd, rSpec.revSpd, rSpec.turnRate, DT);
        const currAcc = getTankAccuracyPct(ctrlTank);
        if (prevAcc !== currAcc) updateHud();

        if ((hullSteer !== 0 || Math.abs(ctrlTank.vLin) > 1 || effTurretDir !== 0) && netFrameTick % 3 === 0) {
          updateHud();
          if (isClientMode) {
            lan.sendFast({
              type: 'p2_state',
              x: Math.round(p2.x),
              y: Math.round(p2.y),
              hullAng: Number(p2.hullAng.toFixed(3)),
              turretAng: Number(p2.turretAng.toFixed(3)),
              dispersion: Number(p2.dispersion.toFixed(3))
            });
          }
        }

        // 2. 更新 2P AI 僚机 (与玩家共享同一底盘加减速与移动散布方程)
        updateAIWingman(DT);

        // 3. 敌坦刷新与 360° 车炮分离 + 减速滑行 + 移动散布 + 短停精瞄 (与玩家 100% 同源机制)
        if (!isClientMode) {
          spawnCooldown--;
          if (spawnCooldown <= 0) {
            spawnEnemy();
            spawnCooldown = 105;
          }
        }

        const p1InCanopy = canopyBushes.some((bs) => Math.hypot(p1.x - bs.x, p1.y - bs.y) < bs.r + 14);
        const p1DetectRadius = p1InCanopy ? 138 : 250; // 纳米伪装林带使敌坦索敌半径缩短 45%

        enemies.forEach((en) => {
          if (en.recoil > 0) en.recoil = Math.max(0, en.recoil - 0.1);
          if (empTimer > 0) return;
          if (en.cd > 0) en.cd--;

          const eSpec = ENEMY_SPECS[en.type] || ENEMY_SPECS.scout;
          const distP1 = Math.hypot(p1.x - en.x, p1.y - en.y);
          const aimTarget = (distP1 < Math.hypot(eagleBase.x - en.x, eagleBase.y - en.y) * (p1InCanopy ? 0.65 : 1.15))
            ? p1
            : eagleBase;
          const desiredTurret = Math.atan2(aimTarget.x - en.x, -(aimTarget.y - en.y));
          const tDiff = shortestAngleDiff(en.turretAng, desiredTurret);

          // 敌军短停缩圈状态机 (Short-Halt Aim Settling):
          // - 除 raider (边移动边散射突击) 外，其余敌坦在装填临近且炮口指向目标附近时，自动松开油门触发短停制动缩圈
          if (en.type !== 'raider') {
            const triggerCd = en.type === 'shooter' ? 24 : 18;
            if (en.cd <= triggerCd && Math.abs(tDiff) < 0.32 && (en.haltTimer || 0) <= 0 && (en.dispersion || DISP_MIN) > eSpec.settleGoal) {
              en.haltTimer = eSpec.haltFrames;
            }
          }

          let enThrottle = 0;
          let enSteer = 0;
          const prevX = en.x, prevY = en.y;

          if ((en.haltTimer || 0) > 0) {
            // 短停缩圈阶段：切断油门与转向，平滑减速滑行至静止并快速收拢散布圈
            en.haltTimer--;
            enThrottle = 0;
            enSteer = 0;
          } else if (en.aiSteerTimer > 0) {
            // 绕障阶段：先原地转向调整车头，再直线推进脱离障碍
            en.aiSteerTimer--;
            if (en.aiSteerTimer > 14) {
              enSteer = en.avoidDir || 1;
              enThrottle = 0;
            } else {
              enSteer = 0;
              enThrottle = 1;
            }
          } else {
            // 巡航推进阶段：先原地中心转向对准目标方位，对准后再直线前进
            const targetX = en.type === 'raider' ? eagleBase.x : (distP1 < p1DetectRadius ? p1.x : eagleBase.x);
            const targetY = en.type === 'raider' ? eagleBase.y : (distP1 < p1DetectRadius ? p1.y : eagleBase.y);
            const desiredHull = Math.atan2(targetX - en.x, -(targetY - en.y));
            const maxStepHull = (en.turnRate || eSpec.turnRate) * DT;
            const hDiff = shortestAngleDiff(en.hullAng, desiredHull);
            if (Math.abs(hDiff) > Math.max(0.06, maxStepHull)) {
              enSteer = Math.sign(hDiff) * Math.min(1, Math.abs(hDiff) / maxStepHull);
              enThrottle = 0;
            } else {
              en.hullAng = desiredHull;
              enSteer = 0;
              enThrottle = 1;
            }
          }

          // 敌坦炮塔独立 360° 旋转锁定目标
          const maxStepTur = (en.turretRate || eSpec.turretRate) * DT;
          const stepTur = Math.sign(tDiff) * Math.min(Math.abs(tDiff), maxStepTur);
          const enWTurret = stepTur / DT;
          en.turretAng = normalizeAngle(en.turretAng + stepTur);

          // 调用与玩家 100% 相同的重装底盘加减速、转向自动降速与动态移动散布解算器！
          stepTankKinematicsAndDispersion(
            en,
            enThrottle,
            enSteer,
            enWTurret,
            en.speed || eSpec.speed,
            (en.speed || eSpec.speed) * 0.65,
            en.turnRate || eSpec.turnRate,
            DT
          );

          // 若推进受阻位移过小，则启动连续角速度切向绕障
          if (enThrottle > 0 && Math.hypot(en.x - prevX, en.y - prevY) < (en.speed || eSpec.speed) * DT * 0.25 && Math.abs(en.vLin) > 15 && (en.aiSteerTimer || 0) <= 0) {
            en.avoidDir = (en.avoidDir || 1) * (Math.random() < 0.25 ? -1 : 1);
            en.aiSteerTimer = 26;
          }

          // 触发统一火控击发函数 fireTank(en, 'enemy')
          const readyToFire = !isClientMode && en.cd <= 0 && Math.abs(tDiff) < 0.26 && (en.dispersion <= eSpec.fireMaxDisp || en.haltTimer === 1);
          if (readyToFire) {
            en.haltTimer = 0;
            fireTank(en, 'enemy');
          }
        });

        // =====================================================================
        // 3.5 坦克碰撞事件系统：硬体积禁止重叠 + 冲撞伤害结算 (同阵营免疫伤害)
        // =====================================================================
        resolveTankCollisions();

        // =====================================================================
        // 4. 高初速穿甲弹连续射线扫掠检测 (CCD Raycast) 与斜面物理跳弹
        // =====================================================================
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          const x0 = b.x;
          const y0 = b.y;
          const x1 = x0 + b.vx * DT;
          const y1 = y0 + b.vy * DT;
          b.prevX = x0;
          b.prevY = y0;

          if (x1 < 0 || y1 < 0 || x1 >= LOGICAL_SIZE || y1 >= LOGICAL_SIZE) {
            bullets.splice(i, 1);
            continue;
          }

          // 4.1 预计算与地堡/单位的最早碰撞时间参数 earliestUnitT，防止贴墙单位被掩体优先吞弹
          let earliestUnitT = 2.0;
          const eagleHit = intersectSegmentCircle(x0, y0, x1, y1, eagleBase.x, eagleBase.y, eagleBase.r - 2);
          if (eagleHit && eagleHit.t < earliestUnitT) earliestUnitT = eagleHit.t;
          if (b.owner !== 'enemy') {
            for (let j = 0; j < enemies.length; j++) {
              const hEn = intersectSegmentCircle(x0, y0, x1, y1, enemies[j].x, enemies[j].y, enemies[j].r + 3);
              if (hEn && hEn.t < earliestUnitT) earliestUnitT = hEn.t;
            }
          } else {
            const hP1Pre = intersectSegmentCircle(x0, y0, x1, y1, p1.x, p1.y, p1.r + 2);
            if (hP1Pre && hP1Pre.t < earliestUnitT) earliestUnitT = hP1Pre.t;
            const hP2Pre = intersectSegmentCircle(x0, y0, x1, y1, p2.x, p2.y, p2.r + 2);
            if (hP2Pre && hP2Pre.t < earliestUnitT) earliestUnitT = hP2Pre.t;
          }

          // 检测与异形多边形/圆形掩体的连续射线交点 (仅当掩体交点先于单位交点时才拦截/跳弹)
          const obsHit = traceBulletObstacles(x0, y0, x1, y1);
          if (obsHit && obsHit.t <= earliestUnitT) {
            const action = handleBulletObstacleHit(b, obsHit);
            if (action === 'consumed') {
              bullets.splice(i, 1);
              continue;
            } else if (action === 'ricochet') {
              continue; // 发生斜面镜面跳弹，继续飞行
            }
          }

          b.x = x1;
          b.y = y1;

          // 4.2 检测与八角统帅鹰标核心地堡的连续碰撞
          if (eagleHit) {
            baseAlive = false;
            explode(eagleBase.x, eagleBase.y, '#c97a63', 28);
            NexusSDK.audio.explosion();
            updateHud();
            bullets.splice(i, 1);
            triggerGameOver('防线失守 · 统帅地堡被毁', '八角铸钢统帅鹰标地堡遭高初速穿甲弹击穿，防线作战失利。请重新部署或返回军械库整备。');
            continue;
          }

          // 4.3 我方穿甲弹 vs 敌方坦克 (连续线段-圆求交 + 定点破片加成)
          if (b.owner !== 'enemy') {
            let hitEnemy = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
              const en = enemies[j];
              const hEn = intersectSegmentCircle(x0, y0, x1, y1, en.x, en.y, en.r + 3);
              if (hEn) {
                hitEnemy = true;
                const effDmg = Number(b.dmg) || 1;
                en.hp -= effDmg;
                if (b.fragBonus) {
                  explode(hEn.x, hEn.y, '#fde047', 9);
                  spawnFloatText(en.x, en.y - 18, `定点破片 -${effDmg}`, '#fde047');
                }
                if (en.isElite) {
                  en.isElite = false;
                  spawnRandomCrate(en.x, en.y);
                }
                if (en.hp <= 0) {
                  explode(en.x, en.y, '#d8b584', 15);
                  NexusSDK.audio.explosion();
                  const bSpec = ENEMY_BOUNTIES[en.type] || ENEMY_BOUNTIES.scout;
                  score += bSpec.score;
                  saveData.currency.tankCoins += bSpec.coins;
                  if (score > (saveData.stats.highScore || 0)) saveData.stats.highScore = score;
                  store.save(saveData);
                  if (Math.random() < 0.35) spawnRandomCrate(en.x, en.y);
                  enemies.splice(j, 1);
                  updateHud();
                } else {
                  explode(hEn.x, hEn.y, '#c48f5a', 6);
                  NexusSDK.audio.hit();
                }
                break;
              }
            }
            if (hitEnemy) {
              bullets.splice(i, 1);
              continue;
            }
          } else {
            // 4.4 敌方穿甲弹 vs P1 (支持车体首上摆角跳弹机制 Frontal Armor Angling Ricochet)
            const hP1 = intersectSegmentCircle(x0, y0, x1, y1, p1.x, p1.y, p1.r + 2);
            if (hP1) {
              if (p1.shield <= 0) {
                // 计算是否命中车体正前首上复合装甲斜面并形成摆角跳弹
                const bLen = Math.hypot(b.vx, b.vy) || 1;
                const inX = -b.vx / bLen;
                const inY = -b.vy / bLen;
                const hullFwdX = Math.sin(p1.hullAng);
                const hullFwdY = -Math.cos(p1.hullAng);
                const frontDot = inX * hullFwdX + inY * hullFwdY; // > 0.72 表示命中车体正前方 ±44° 首上区域

                if (frontDot > 0.72 && frontDot < 0.94 && Math.random() < 0.38) {
                  // 首上摆角成功触发跳弹！
                  explode(hP1.x, hP1.y, '#fde047', 10);
                  NexusSDK.audio.hit();
                  spawnFloatText(p1.x, p1.y - 18, '首上摆角跳弹！', '#fde047');
                  bullets.splice(i, 1);
                  continue;
                }

                p1.hp -= 1;
                p1.hitShake = 1.0;
                explode(p1.x, p1.y, '#ef4444', 12);
                NexusSDK.audio.warn();
                if (p1.hp <= 0) {
                  if (p1.lives > 0) {
                    p1.lives -= 1;
                    p1.hp = 3;
                    p1.rank = Math.max(1, p1.rank - 1);
                    p1.x = 205; p1.y = 555; p1.hullAng = 0; p1.turretAng = 0;
                    p1.vLin = 0; p1.wHull = 0; p1.wTurret = 0; p1.dispersion = DISP_MIN; p1.cd = 0;
                    p1.shield = 180;
                    spawnFloatText(p1.x, p1.y - 16, '备用车组投入战斗', '#fde047');
                  } else {
                    p1.hp = 0;
                    updateHud();
                    bullets.splice(i, 1);
                    triggerGameOver('装甲全灭 · 防线失守', '1P 主战坦克与备用履带车组已全部阵亡，防线失守。');
                    continue;
                  }
                } else {
                  p1.shield = 90;
                }
                updateHud();
              }
              bullets.splice(i, 1);
              continue;
            }

            // 4.5 敌方穿甲弹 vs P2 协同僚机/副坦 (修复 2P 碰撞漏判，支持首上跳弹与护盾拦截)
            const hP2 = intersectSegmentCircle(x0, y0, x1, y1, p2.x, p2.y, p2.r + 2);
            if (hP2) {
              if (p2.shield <= 0) {
                const bLen = Math.hypot(b.vx, b.vy) || 1;
                const inX = -b.vx / bLen;
                const inY = -b.vy / bLen;
                const hullFwdX = Math.sin(p2.hullAng);
                const hullFwdY = -Math.cos(p2.hullAng);
                const frontDot = inX * hullFwdX + inY * hullFwdY;
                if (frontDot > 0.72 && frontDot < 0.94 && Math.random() < 0.38) {
                  explode(hP2.x, hP2.y, '#fde047', 9);
                  NexusSDK.audio.hit();
                  spawnFloatText(p2.x, p2.y - 18, '2P 首上跳弹！', '#fde047');
                  bullets.splice(i, 1);
                  continue;
                }
                p2.hp -= 1;
                p2.hitShake = 1.0;
                explode(p2.x, p2.y, '#f59e0b', 10);
                NexusSDK.audio.hit();
                if (p2.hp <= 0) {
                  p2.hp = 3;
                  p2.x = 419; p2.y = 555; p2.hullAng = 0; p2.turretAng = 0;
                  p2.vLin = 0; p2.wHull = 0; p2.wTurret = 0; p2.dispersion = DISP_MIN; p2.cd = 0;
                  p2.shield = 180;
                  spawnFloatText(p2.x, p2.y - 16, '2P 僚机重整归建', '#f59e0b');
                } else {
                  p2.shield = 80;
                }
              }
              bullets.splice(i, 1);
              continue;
            }
          }
        }

        // 5. 空投物资箱拾取检测
        for (let i = crates.length - 1; i >= 0; i--) {
          const cr = crates[i];
          cr.life--;
          cr.rot = (cr.rot || 0) + 0.04;
          if (Math.hypot(p1.x - cr.x, p1.y - cr.y) < 34) {
            applyCrateEffect(cr, p1);
            crates.splice(i, 1);
          } else if (Math.hypot(p2.x - cr.x, p2.y - cr.y) < 34) {
            applyCrateEffect(cr, p2);
            crates.splice(i, 1);
          } else if (cr.life <= 0) {
            crates.splice(i, 1);
          }
        }

        // 6. 防区肃清晋级判定
        if (!isClientMode && remainingSpawns <= 0 && enemies.length === 0) {
          NexusSDK.audio.win();
          stage++;
          saveData.stats.wins = (saveData.stats.wins || 0) + 1;
          saveData.currency.tankCoins += 120;
          store.save(saveData);
          buildStageMap(stage);
          spawnFloatText(312, 280, `第 ${stage} 防区解锁 · 全歼敌坦`, '#fde047');
        }

        // 7. 局域网 Host 定时广播 360° 连续世界快照 (包含完整 dmg/breakSteel/fragBonus 与 p1/p2 状态)
        netFrameTick++;
        if (lan.isConnected() && lanRole === 'host' && netFrameTick % 4 === 0) {
          lan.sendFast({
            type: 'world_sync',
            p1: {
              x: Math.round(p1.x), y: Math.round(p1.y),
              hullAng: Number(p1.hullAng.toFixed(3)), turretAng: Number(p1.turretAng.toFixed(3)),
              dispersion: Number((p1.dispersion ?? DISP_MIN).toFixed(3)),
              hp: p1.hp, rank: p1.rank, lives: p1.lives, shield: p1.shield
            },
            p2: {
              hp: p2.hp, rank: p2.rank, shield: p2.shield
            },
            enemies: enemies.map((e) => ({
              type: e.type, x: Math.round(e.x), y: Math.round(e.y),
              hullAng: Number(e.hullAng.toFixed(2)), turretAng: Number(e.turretAng.toFixed(2)),
              dispersion: Number((e.dispersion ?? DISP_MIN).toFixed(3)), haltTimer: e.haltTimer || 0,
              hp: e.hp, maxHp: e.maxHp, size: e.size, r: e.r, isElite: e.isElite
            })),
            bullets: bullets.map((b) => ({
              x: Math.round(b.x), y: Math.round(b.y), prevX: Math.round(b.prevX), prevY: Math.round(b.prevY),
              vx: Math.round(b.vx), vy: Math.round(b.vy), owner: b.owner,
              dmg: Number(b.dmg) || 1, breakSteel: !!b.breakSteel,
              pinpoint: !!b.pinpoint, fragBonus: !!b.fragBonus
            })),
            empTimer,
            fortifyTimer,
            remainingSpawns,
            score,
            stage
          });
        }

        // 8. 更新火花粒子与飘字
        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          pt.x += pt.vx; pt.y += pt.vy; pt.life--;
          if (pt.life <= 0) particles.splice(i, 1);
        }
        for (let i = floatTexts.length - 1; i >= 0; i--) {
          const ft = floatTexts[i];
          ft.y -= 0.45;
          ft.life--;
          if (ft.life <= 0) floatTexts.splice(i, 1);
        }
      }

      // =========================================================================
      // 渲染管线：异形多边形战术掩体缓存 + 车体/炮塔双自由度分离渲染 + 高初速曳光弹道
      // =========================================================================
      function fillAndStrokePoly(targetCtx, verts, fillStyle, strokeStyle, lineWidth = 2) {
        if (!verts || verts.length === 0) return;
        targetCtx.beginPath();
        targetCtx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
          targetCtx.lineTo(verts[i].x, verts[i].y);
        }
        targetCtx.closePath();
        if (fillStyle) {
          targetCtx.fillStyle = fillStyle;
          targetCtx.fill();
        }
        if (strokeStyle) {
          targetCtx.strokeStyle = strokeStyle;
          targetCtx.lineWidth = lineWidth;
          targetCtx.stroke();
        }
      }

      function rebuildTerrainCache() {
        // 1. 90° 上帝俯视角：六方柱状节理玄武岩与 1200°C 熔岩金脉底板 (STYLE-170)
        terrainCtx.fillStyle = '#141216';
        terrainCtx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

        const hexR = 38;
        const hexW = Math.sqrt(3) * hexR;
        const hexH = 1.5 * hexR;
        for (let row = -1; row <= Math.ceil(LOGICAL_SIZE / hexH) + 1; row++) {
          for (let col = -1; col <= Math.ceil(LOGICAL_SIZE / hexW) + 1; col++) {
            const cx = col * hexW + (row % 2 !== 0 ? hexW * 0.5 : 0);
            const cy = row * hexH;
            const hexPts = makeRegularPolygon(cx, cy, hexR - 1.4, 6, Math.PI / 6);
            const shade = ((row * 7 + col * 13) & 3);
            const fillCol = shade === 0 ? '#1b191f' : shade === 1 ? '#18161c' : shade === 2 ? '#1e1c23' : '#16141a';
            const isMagmaSeam = ((row * 11 + col * 19) % 5 === 0);
            const seamStroke = isMagmaSeam ? 'rgba(245, 158, 11, 0.28)' : 'rgba(100, 110, 128, 0.14)';
            fillAndStrokePoly(terrainCtx, hexPts, fillCol, seamStroke, isMagmaSeam ? 1.4 : 0.9);
          }
        }

        // 2. 下沉式防爆弹坑环与熔岩裂隙辉光 (Topology D: Basalt Crater Rings)
        const craters = [
          { x: 170, y: 205, r: 42 },
          { x: 454, y: 205, r: 40 },
          { x: 312, y: 312, r: 54 },
          { x: 200, y: 410, r: 36 },
          { x: 424, y: 410, r: 36 }
        ];
        craters.forEach((cr) => {
          terrainCtx.save();
          const cGrad = terrainCtx.createRadialGradient(cr.x, cr.y, cr.r * 0.15, cr.x, cr.y, cr.r);
          cGrad.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
          cGrad.addColorStop(0.55, 'rgba(15, 13, 18, 0.68)');
          cGrad.addColorStop(1, 'rgba(24, 22, 27, 0)');
          terrainCtx.fillStyle = cGrad;
          terrainCtx.beginPath();
          terrainCtx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2);
          terrainCtx.fill();
          const craterRing = makeRegularPolygon(cr.x, cr.y, cr.r * 0.72, 8, 0.2);
          fillAndStrokePoly(terrainCtx, craterRing, null, 'rgba(245, 158, 11, 0.22)', 1.1);
          terrainCtx.restore();
        });

        // 3. 极坐标陀螺火控测距环
        terrainCtx.save();
        terrainCtx.strokeStyle = 'rgba(245, 158, 11, 0.06)';
        terrainCtx.lineWidth = 1;
        [110, 220, 330].forEach((rad) => {
          terrainCtx.beginPath();
          terrainCtx.arc(312, 312, rad, 0, Math.PI * 2);
          terrainCtx.stroke();
        });
        terrainCtx.restore();

        // 4. 绘制所有非方块异形多边形与圆形掩体 (STYLE-170 × STYLE-142)
        obstacles.forEach((obs) => {
          terrainCtx.save();
          if (obs.kind === 'hex-brick') {
            // 正六边形蜂巢复合砖堡 (支持按受击扇区裁剪剥落)
            fillAndStrokePoly(terrainCtx, obs.vertices, '#261712', '#d97706', 2);
            if (sprites.brick?.complete) {
              terrainCtx.translate(obs.x, obs.y);
              terrainCtx.rotate(obs.rot);
              const sz = obs.r * 2.15;
              const half = sz / 2;
              const mask = obs.sectorMask ?? 15;
              if (mask === 15) {
                terrainCtx.drawImage(sprites.brick, -half, -half, sz, sz);
              } else {
                const srcHalf = Math.round((sprites.brick.naturalWidth || 64) / 2);
                if (mask & 4) terrainCtx.drawImage(sprites.brick, 0, 0, srcHalf, srcHalf, -half, -half, half, half);
                if (mask & 8) terrainCtx.drawImage(sprites.brick, srcHalf, 0, srcHalf, srcHalf, 0, -half, half, half);
                if (mask & 1) terrainCtx.drawImage(sprites.brick, 0, srcHalf, srcHalf, srcHalf, -half, 0, half, half);
                if (mask & 2) terrainCtx.drawImage(sprites.brick, srcHalf, srcHalf, srcHalf, srcHalf, 0, 0, half, half);
              }
            } else {
              fillAndStrokePoly(terrainCtx, obs.vertices, '#6e3828', '#f59e0b', 2.2);
            }
          } else if (obs.kind === 'chevron-steel') {
            // V 型钝角折线防爆跳弹钛钢墙
            fillAndStrokePoly(terrainCtx, obs.vertices, '#282e3a', '#a855f7', 2.0);
            if (sprites.steel?.complete) {
              terrainCtx.translate(obs.x, obs.y);
              terrainCtx.rotate(obs.rot);
              const sz = obs.r * 2.0;
              terrainCtx.drawImage(sprites.steel, -sz / 2, -sz / 2, sz, sz);
            }
            fillAndStrokePoly(terrainCtx, obs.vertices, null, '#fde047', 1.2);
          } else if (obs.kind === 'pillbox') {
            // 圆形钢筋混凝土暗堡 + 放射折面钛钢穹顶
            terrainCtx.beginPath();
            terrainCtx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
            terrainCtx.fillStyle = '#252932';
            terrainCtx.fill();
            terrainCtx.lineWidth = 2.4;
            terrainCtx.strokeStyle = '#646e80';
            terrainCtx.stroke();

            const domeVerts = makeRegularPolygon(obs.x, obs.y, obs.r * 0.64, 8, Math.PI / 8);
            fillAndStrokePoly(terrainCtx, domeVerts, '#363d4a', '#f59e0b', 1.5);
            terrainCtx.beginPath();
            terrainCtx.arc(obs.x, obs.y, 4.5, 0, Math.PI * 2);
            terrainCtx.fillStyle = '#fde047';
            terrainCtx.fill();
          } else if (obs.kind === 'dragon-teeth') {
            // 正三角形龙牙反坦克锥群 (3 枚品字形高标号玄武钛合金三角锥)
            const offsets = [[0, -8], [-10, 8], [10, 8]];
            offsets.forEach(([ox, oy]) => {
              const tri = makeRegularPolygon(obs.x + ox, obs.y + oy, 11, 3, obs.rot - Math.PI / 2);
              fillAndStrokePoly(terrainCtx, tri, '#2d333f', '#94a3b8', 1.6);
              terrainCtx.beginPath();
              terrainCtx.moveTo(obs.x + ox, obs.y + oy);
              terrainCtx.lineTo(tri[0].x, tri[0].y);
              terrainCtx.moveTo(obs.x + ox, obs.y + oy);
              terrainCtx.lineTo(tri[1].x, tri[1].y);
              terrainCtx.moveTo(obs.x + ox, obs.y + oy);
              terrainCtx.lineTo(tri[2].x, tri[2].y);
              terrainCtx.strokeStyle = '#f59e0b';
              terrainCtx.lineWidth = 1.1;
              terrainCtx.stroke();
            });
          } else if (obs.kind === 'basalt') {
            // 六方柱状节理玄武岩熔岩金脉岩柱群 (STYLE-170)
            fillAndStrokePoly(terrainCtx, obs.vertices, '#18161d', '#f59e0b', 2.0);
            const inner = obs.vertices.map((v) => ({
              x: obs.x + (v.x - obs.x) * 0.60,
              y: obs.y + (v.y - obs.y) * 0.60
            }));
            fillAndStrokePoly(terrainCtx, inner, '#282530', '#fde047', 1.3);
          } else if (obs.kind === 'trench') {
            // 熔岩裂隙反坦克战壕沟渠
            fillAndStrokePoly(terrainCtx, obs.vertices, '#0e0c10', '#d97706', 1.8);
          }
          terrainCtx.restore();
        });

        terrainDirty = false;
      }

      // 90° 上帝俯视角：车体与放射多面体隐身炮塔完全分离的 360° 双角渲染器 (STYLE-170 × STYLE-142)
      function drawTankSeparated(spriteKey, fallbackImg, tank, ringColor, isPlayer = false) {
        const sz = tank.size || 44;
        const cx = tank.x;
        const cy = tank.y;
        const recoil = tank.recoil || 0;
        const movePhase = tank.movePhase || 0;
        const shake = (tank.hitShake || 0) * Math.sin(performance.now() * 0.08) * 2.5;
        const split = splitLayers[spriteKey];

        // 1. 绘制锻造碳纤维与楔形首上车体底盘层 (严格按车体朝向角 tank.hullAng 旋转)
        ctx.save();
        ctx.translate(cx + shake, cy);
        ctx.rotate(tank.hullAng);
        const heave = 1 + Math.sin(movePhase) * 0.02;
        ctx.scale(heave, 2 - heave);

        if (split && split.hullImg && split.hullImg.complete && split.hullImg.naturalWidth > 0) {
          ctx.drawImage(split.hullImg, -sz / 2, -sz / 2, sz, sz);
        } else {
          // 离线 file:// 或拆层就绪前：绘制无内置炮塔的 90° 上帝俯视锻造碳纤维与重装双履带底盘（杜绝双炮塔叠影）
          const hw = sz * 0.42;
          const hh = sz * 0.46;
          // 1. 两侧重型差速履带模块
          ctx.fillStyle = '#18181b';
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 1.4;
          ctx.fillRect(-hw, -hh, sz * 0.17, hh * 2);
          ctx.strokeRect(-hw, -hh, sz * 0.17, hh * 2);
          ctx.fillRect(hw - sz * 0.17, -hh, sz * 0.17, hh * 2);
          ctx.strokeRect(hw - sz * 0.17, -hh, sz * 0.17, hh * 2);

          // 2. 楔形多面体车体装甲底盘
          const hullColor = isPlayer
            ? '#166534'
            : (spriteKey === 'p2' ? '#b45309' : (spriteKey === 'shooter' ? '#581c87' : (spriteKey === 'raider' ? '#9a3412' : '#7f1d1d')));
          const hullVerts = [
            { x: -hw * 0.56, y: -hh * 0.96 },
            { x: hw * 0.56, y: -hh * 0.96 },
            { x: hw * 0.72, y: -hh * 0.55 },
            { x: hw * 0.72, y: hh * 0.85 },
            { x: hw * 0.48, y: hh * 0.98 },
            { x: -hw * 0.48, y: hh * 0.98 },
            { x: -hw * 0.72, y: hh * 0.85 },
            { x: -hw * 0.72, y: -hh * 0.55 }
          ];
          fillAndStrokePoly(ctx, hullVerts, hullColor, '#09090b', 1.5);
          // 尾部熔岩散热百叶格栅
          ctx.fillStyle = '#09090b';
          ctx.fillRect(-hw * 0.44, hh * 0.45, hw * 0.88, hh * 0.36);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.0;
          ctx.strokeRect(-hw * 0.44, hh * 0.45, hw * 0.88, hh * 0.36);
        }

        // 车体正前方楔形首上反应装甲方向棱线 (清晰指示当前车头朝向)
        ctx.strokeStyle = isPlayer ? '#fde047' : '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-8, -sz * 0.35);
        ctx.lineTo(0, -sz * 0.47);
        ctx.lineTo(8, -sz * 0.35);
        ctx.stroke();
        ctx.restore();

        // 2. 绘制陀螺稳定【放射多面体隐身炮塔】与【高温回火蓝-紫-金滑膛炮管】层 (严格按 tank.turretAng 旋转)
        ctx.save();
        ctx.translate(cx + shake, cy);
        ctx.rotate(tank.turretAng);

        // 动态火控散布扇形锥与定点精瞄锁定激光 (1P、2P 与全体敌坦 100% 共享实时渲染，响应战术辅助线开关)
        const isAlly = isPlayer || spriteKey === 'p2';
        const showGuides = !(window.NexusSDK && typeof window.NexusSDK.getSettings === 'function') || window.NexusSDK.getSettings('tank-battle').guideLines !== false;
        if (showGuides) {
          ctx.save();
          const sigma = Math.max(DISP_MIN, tank.dispersion ?? DISP_MIN);
          const accPct = getTankAccuracyPct(tank);
          const isStat = Math.abs(tank.vLin || 0) < 3 && Math.abs(tank.wHull || 0) < 0.08;
          const isPinpoint = isStat && accPct >= 92;
          const coneLen = isPlayer ? 215 : (spriteKey === 'p2' ? 165 : (tank.type === 'shooter' ? 195 : 145));
          const muzzleY = -sz * 0.50;

          if (isPinpoint) {
            // 驻停精瞄锁定态 (>=92% 精度)：双线完全合拢为高亮熔岩金/绯红激光锁定束 + 远端菱形精瞄准星
            ctx.strokeStyle = isAlly ? 'rgba(253, 224, 71, 0.78)' : 'rgba(239, 68, 68, 0.76)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(0, muzzleY);
            ctx.lineTo(0, -coneLen);
            ctx.stroke();

            // 远端定点精瞄菱形准星 (Pinpoint Lock Reticle)
            const lockY = isPlayer ? -148 : -coneLen * 0.76;
            ctx.strokeStyle = isAlly ? '#fde047' : '#ef4444';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(0, lockY - 6);
            ctx.lineTo(6, lockY);
            ctx.lineTo(0, lockY + 6);
            ctx.lineTo(-6, lockY);
            ctx.closePath();
            ctx.stroke();
          } else {
            // 运动扩圈与制动缩圈态：绘制 -sigma 与 +sigma 两侧动态包络边界虚线 + 远端散布弧线
            const leftX = -Math.sin(sigma) * coneLen;
            const leftY = -Math.cos(sigma) * coneLen;
            const rightX = Math.sin(sigma) * coneLen;
            const rightY = -Math.cos(sigma) * coneLen;

            // 扇形浅色半透明填充区
            ctx.fillStyle = isAlly ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.07)';
            ctx.beginPath();
            ctx.moveTo(0, muzzleY);
            ctx.lineTo(leftX, leftY);
            ctx.lineTo(rightX, rightY);
            ctx.closePath();
            ctx.fill();

            // 两侧包络边界射线
            ctx.strokeStyle = isAlly
              ? (accPct < 55 ? 'rgba(251, 113, 133, 0.48)' : 'rgba(245, 158, 11, 0.52)')
              : ((tank.haltTimer || 0) > 0 ? 'rgba(239, 68, 68, 0.68)' : 'rgba(239, 68, 68, 0.38)');
            ctx.lineWidth = 1.25;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, muzzleY);
            ctx.lineTo(leftX, leftY);
            ctx.moveTo(0, muzzleY);
            ctx.lineTo(rightX, rightY);
            ctx.stroke();

            // 远端缩圈校准弧线
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(0, 0, coneLen * 0.72, -Math.PI / 2 - sigma, -Math.PI / 2 + sigma);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 炮管开火后坐力轴向位移 (沿炮塔当前指向反向回缩)
        const recoilShiftY = recoil * 5.0;
        ctx.translate(0, recoilShiftY);

        if (split && split.turretImg && split.turretImg.complete && split.turretImg.naturalWidth > 0) {
          ctx.drawImage(split.turretImg, -sz / 2, -sz / 2, sz, sz);
        } else {
          // 90° 上帝俯视原生高精度绘制：放射八角多面体反应装甲隐身炮塔 + 蓝紫金高温回火滑膛炮管 (Topology D + Texture A)
          const barrelGrad = ctx.createLinearGradient(0, -sz * 0.54, 0, -sz * 0.12);
          barrelGrad.addColorStop(0, '#fde047');
          barrelGrad.addColorStop(0.28, '#f59e0b');
          barrelGrad.addColorStop(0.55, '#c084fc');
          barrelGrad.addColorStop(0.82, '#6366f1');
          barrelGrad.addColorStop(1, '#2b313d');

          // 120mm 高温回火滑膛炮管与抽烟装置
          ctx.fillStyle = barrelGrad;
          ctx.strokeStyle = isPlayer ? '#fde047' : '#f59e0b';
          ctx.lineWidth = 1.3;
          ctx.fillRect(-3.4, -sz * 0.54, 6.8, sz * 0.40);
          ctx.strokeRect(-3.4, -sz * 0.54, 6.8, sz * 0.40);
          ctx.fillStyle = '#252a34';
          ctx.fillRect(-4.6, -sz * 0.34, 9.2, sz * 0.11);
          ctx.strokeRect(-4.6, -sz * 0.34, 9.2, sz * 0.11);

          // 放射八角多面体折面炮塔壳体 (Radial Faceted Stealth Turret)
          const rTur = sz * 0.28;
          const octPts = [
            { x: -rTur * 0.52, y: -rTur * 0.95 },
            { x: rTur * 0.52, y: -rTur * 0.95 },
            { x: rTur * 0.98, y: -rTur * 0.25 },
            { x: rTur * 0.82, y: rTur * 0.65 },
            { x: rTur * 0.42, y: rTur * 0.98 },
            { x: -rTur * 0.42, y: rTur * 0.98 },
            { x: -rTur * 0.82, y: rTur * 0.65 },
            { x: -rTur * 0.98, y: -rTur * 0.25 }
          ];
          fillAndStrokePoly(ctx, octPts, '#2f3542', isPlayer ? '#f59e0b' : '#94a3b8', 1.6);

          // 放射折角反应装甲内部棱线与陀螺核心舱盖
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(octPts[0].x, octPts[0].y); ctx.lineTo(0, 0);
          ctx.moveTo(octPts[1].x, octPts[1].y); ctx.lineTo(0, 0);
          ctx.moveTo(octPts[3].x, octPts[3].y); ctx.lineTo(0, 0);
          ctx.moveTo(octPts[6].x, octPts[6].y); ctx.lineTo(0, 0);
          ctx.stroke();

          ctx.fillStyle = isPlayer ? '#f59e0b' : '#c084fc';
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }

        // 车长周视光电热像球 (Panoramic Commander Optic Dome)
        const radarAng = (performance.now() * 0.0045) % (Math.PI * 2);
        ctx.save();
        ctx.translate(sz * 0.11, sz * 0.11);
        ctx.rotate(radarAng);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-3.8, 0);
        ctx.lineTo(3.8, 0);
        ctx.stroke();
        ctx.restore();

        // 主炮膛口制退器高膛压熔岩金/回火紫击发闪光
        if (recoil > 0.15) {
          ctx.save();
          ctx.translate(0, -sz * 0.52);
          ctx.fillStyle = `rgba(253, 224, 71, ${(recoil * 0.92).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(0, -2, 5.8 * recoil, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(-8 * recoil, -2);
          ctx.lineTo(8 * recoil, -2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();

        // 3. 精英敌坦六角熔岩锁定框与偏导护盾环
        if (tank.isElite && Math.floor(performance.now() / 180) % 2 === 0) {
          const hexMark = makeRegularPolygon(cx, cy, sz * 0.54, 6, Math.PI / 6);
          fillAndStrokePoly(ctx, hexMark, null, '#f59e0b', 1.7);
        }
        if (tank.shield > 0) {
          ctx.save();
          const shieldHex = makeRegularPolygon(cx, cy, sz * 0.58, 6, performance.now() * 0.001);
          fillAndStrokePoly(ctx, shieldHex, null, ringColor || '#f59e0b', 1.6);
          ctx.restore();
        }
        // 4. 自动装弹机装填进度条 (1P、2P 与全体敌坦共享显示装填冷却读条)
        if ((tank.cd || 0) > 0) {
          const maxCd = Math.max(tank.cd, tank.maxCd || 105);
          const pct = Math.max(0, Math.min(1, 1 - tank.cd / maxCd));
          const bw = sz * 0.72;
          const bx = cx - bw / 2;
          const by = cy + sz * 0.50 + 3;
          ctx.fillStyle = 'rgba(15, 18, 24, 0.85)';
          ctx.fillRect(bx, by, bw, 3.2);
          ctx.fillStyle = isAlly ? '#f59e0b' : '#c084fc';
          ctx.fillRect(bx, by, bw * pct, 3.2);
        }
      }

      function render() {
        if (window.NexusSDK && !window.NexusSDK.isGameplayActive()) return;
        ctx.shadowBlur = 0;

        if (terrainDirty) {
          rebuildTerrainCache();
        }
        ctx.drawImage(terrainCacheCanvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

        // 1. 360° 连续弯曲重型双履带车辙印
        ctx.fillStyle = 'rgba(10, 12, 16, 0.36)';
        treadMarks.forEach((tm) => {
          ctx.save();
          ctx.translate(tm.x, tm.y);
          ctx.rotate(tm.ang);
          ctx.fillRect(-13, -3, 5, 4);
          ctx.fillRect(8, -3, 5, 4);
          ctx.restore();
        });

        // 2. 八角铸钢统帅鹰标核心地堡
        ctx.save();
        const octBase = makeRegularPolygon(eagleBase.x, eagleBase.y, eagleBase.r + 4, 8, Math.PI / 8);
        fillAndStrokePoly(ctx, octBase, '#222730', '#c48f5a', 2.0);
        if (sprites.eagle?.complete) {
          if (!baseAlive) ctx.globalAlpha = 0.32;
          ctx.drawImage(sprites.eagle, eagleBase.x - 24, eagleBase.y - 24, 48, 48);
        }
        ctx.restore();

        // 3. 八角战术空投补给箱
        crates.forEach((cr) => {
          ctx.save();
          ctx.translate(cr.x, cr.y);
          if (sprites.crate?.complete) {
            ctx.drawImage(sprites.crate, -20, -20, 40, 40);
          }
          const oct = makeRegularPolygon(0, 0, 20, 8, cr.rot);
          fillAndStrokePoly(ctx, oct, null, cr.color || '#dfc08e', 1.5);
          ctx.fillStyle = '#12151a';
          ctx.fillRect(-18, 12, 36, 10);
          ctx.fillStyle = cr.color || '#fde047';
          ctx.font = 'bold 8px "Noto Sans SC", Consolas, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cr.tag || '晋升', 0, 20);
          ctx.restore();
        });

        // 4. 绘制 1P、2P 与敌军战车 (车体与炮塔 360° 独立分离渲染)
        drawTankSeparated('p1', sprites.p1, p1, '#8598b0', true);
        drawTankSeparated('p2', sprites.p2, p2, '#c48f5a', false);
        enemies.forEach((en) => {
          const sp = sprites[en.type] || sprites.scout;
          drawTankSeparated(en.type, sp, en, '#994e3b', false);
          if (en.maxHp > 1) {
            const sz = en.size || 44;
            ctx.fillStyle = 'rgba(15, 18, 22, 0.85)';
            ctx.fillRect(en.x - sz / 2, en.y - sz / 2 - 7, sz, 4);
            ctx.fillStyle = '#b5604a';
            ctx.fillRect(en.x - sz / 2, en.y - sz / 2 - 7, sz * (en.hp / en.maxHp), 4);
          }
        });

        // 5. 高初速尾翼稳定脱壳穿甲弹 (带高速曳光尾迹与定点精瞄 +12% 超速熔岩金光束)
        bullets.forEach((b) => {
          ctx.save();
          const grad = ctx.createLinearGradient(b.prevX ?? b.x, b.prevY ?? b.y, b.x, b.y);
          grad.addColorStop(0, 'rgba(216, 181, 132, 0)');
          if (b.pinpoint && b.owner !== 'enemy') {
            grad.addColorStop(0.55, 'rgba(192, 132, 252, 0.85)');
            grad.addColorStop(1, 'rgba(253, 224, 71, 1)');
          } else {
            grad.addColorStop(1, b.owner === 'enemy' ? 'rgba(239, 68, 68, 0.92)' : 'rgba(245, 235, 214, 0.96)');
          }
          ctx.strokeStyle = grad;
          ctx.lineWidth = b.pinpoint ? 3.8 : 3.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.prevX ?? (b.x - b.vx * DT), b.prevY ?? (b.y - b.vy * DT));
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          const bAng = Math.atan2(b.vy, b.vx);
          ctx.translate(b.x, b.y);
          ctx.rotate(bAng);
          ctx.fillStyle = b.owner === 'enemy' ? '#ef4444' : (b.pinpoint ? '#fde047' : '#dfc08e');
          ctx.beginPath();
          ctx.moveTo(b.pinpoint ? 7.2 : 6, 0);
          ctx.lineTo(-4, -2.4);
          ctx.lineTo(-4, 2.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });

        // 6. 顶层椭圆形/六角纳米迷彩树冠遮蔽层
        if (sprites.bush?.complete) {
          canopyBushes.forEach((bs) => {
            const nearAlly =
              Math.hypot(p1.x - bs.x, p1.y - bs.y) < bs.r + 16 ||
              Math.hypot(p2.x - bs.x, p2.y - bs.y) < bs.r + 16;
            ctx.save();
            ctx.globalAlpha = nearAlly ? 0.58 : 0.90;
            ctx.translate(bs.x, bs.y);
            ctx.rotate(bs.rot);
            ctx.drawImage(sprites.bush, -bs.r, -bs.r, bs.r * 2, bs.r * 2);
            ctx.restore();
          });
        }

        // 7. EMP 全屏电磁静默指示
        if (empTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(196, 143, 90, 0.45)';
          ctx.lineWidth = 2;
          ctx.strokeRect(4, 4, LOGICAL_SIZE - 8, LOGICAL_SIZE - 8);
          ctx.fillStyle = 'rgba(196, 143, 90, 0.9)';
          ctx.font = 'bold 11px Consolas, monospace';
          ctx.fillText(`⚡ EMP 电磁静默生效中: ${(empTimer / 60).toFixed(1)}s`, 12, 18);
          ctx.restore();
        }

        // 8. 火花粒子与飘字
        particles.forEach((pt) => {
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 2, pt.y - 2, 3.5, 3.5);
        });
        floatTexts.forEach((ft) => {
          ctx.save();
          ctx.fillStyle = ft.color;
          ctx.font = 'bold 10px "Noto Sans SC", Consolas, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        });
      }

      // 第二层军械库检视台 (Tier 2 Inspector) 同源骨骼动画挂载驱动 (rigs/*.anim.js)
      let activeInspectorRigAnim = null;
      async function mountInspectorRigAnimation(unitFile) {
        if (activeInspectorRigAnim) {
          cancelAnimationFrame(activeInspectorRigAnim);
          activeInspectorRigAnim = null;
        }
        const stageEl = document.getElementById('tb-insp-rig-stage');
        if (!stageEl || !unitFile) return;

        if (window.location.protocol.startsWith('http')) {
          try {
            const baseName = unitFile.replace(/\.svg$/i, '');
            const [svgResp, rigMod] = await Promise.all([
              fetch(`../assets/tank-battle/sprites/${unitFile}`),
              import(`../assets/tank-battle/rigs/${baseName}.anim.js`)
            ]);
            if (svgResp.ok && rigMod && typeof rigMod.applyToSvgDom === 'function') {
              stageEl.innerHTML = await svgResp.text();
              const svgEl = stageEl.querySelector('svg');
              if (svgEl) {
                svgEl.style.width = '60px';
                svgEl.style.height = '60px';
                const t0 = performance.now();
                const states = ['idle', 'move', 'attack'];
                const tickRig = (now) => {
                  if (!document.body.contains(svgEl)) return;
                  if (window.NexusSDK && window.NexusSDK.isGameplayActive()) {
                    activeInspectorRigAnim = requestAnimationFrame(tickRig);
                    return;
                  }
                  const elapsed = now - t0;
                  const stateIdx = Math.floor(elapsed / 2200) % states.length;
                  rigMod.applyToSvgDom(svgEl, states[stateIdx], elapsed % 2200, {
                    aimAngleDeg: Math.sin(elapsed * 0.0022) * 35
                  });
                  activeInspectorRigAnim = requestAnimationFrame(tickRig);
                };
                activeInspectorRigAnim = requestAnimationFrame(tickRig);
                return;
              }
            }
          } catch (_) {}
        }

        const imgEl = stageEl.querySelector('img');
        if (!imgEl) return;
        const t0 = performance.now();
        const tickLocal = (now) => {
          if (!document.body.contains(imgEl)) return;
          if (window.NexusSDK && window.NexusSDK.isGameplayActive()) {
            activeInspectorRigAnim = requestAnimationFrame(tickLocal);
            return;
          }
          const elapsed = now - t0;
          const cycle = (elapsed % 2400) / 2400;
          const recoilY = cycle > 0.72 && cycle < 0.86 ? 3.5 : 0;
          const rot = Math.sin(cycle * Math.PI * 2) * 8;
          imgEl.style.transform = `translateY(${recoilY}px) rotate(${rot.toFixed(1)}deg)`;
          activeInspectorRigAnim = requestAnimationFrame(tickLocal);
        };
        activeInspectorRigAnim = requestAnimationFrame(tickLocal);
      }

      window.addEventListener('nexus:tier2-rendered', (e) => {
        if (e.detail && e.detail.unitFile) {
          mountInspectorRigAnimation(e.detail.unitFile);
        }
      });
      setTimeout(() => {
        const box = document.getElementById('tb-insp-preview-box');
        if (box) mountInspectorRigAnimation(box.getAttribute('data-unit-file'));
      }, 60);

      function scheduleLoop() {
        if (__rafId === null) {
          __rafId = requestAnimationFrame(loop);
        }
      }

      function cancelLoop() {
        if (__rafId !== null) {
          cancelAnimationFrame(__rafId);
          __rafId = null;
        }
      }

      function startBattleFromRoom() {
        __engineRunning = true;
        stage = 1;
        score = 0;
        p1.lives = 2;
        p1.alive = true;
        p1.hp = p1.maxHp || 3;
        bullets.length = 0;
        enemies.length = 0;
        particles.length = 0;
        buildStageMap(1);
        updateHud();
        scheduleLoop();
      }

      function stopBattleProcess() {
        __engineRunning = false;
        cancelLoop();
        bullets.length = 0;
        enemies.length = 0;
        particles.length = 0;
        if (Array.isArray(map)) map.length = 0;
        remainingSpawns = 0;
        fortifyTimer = 0;
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      __releaseFn = stopBattleProcess;
      __resumeFn = scheduleLoop;
      __entityCountFn = () => bullets.length + enemies.length + particles.length;

      window.addEventListener('nexus:gameplay-started', () => {
        startBattleFromRoom();
      });
      if (window.NexusSDK && window.NexusSDK.isGameplayActive()) {
        startBattleFromRoom();
      }

      window.addEventListener('nexus:gameplay-stopped', () => {
        stopBattleProcess();
      });
      window.addEventListener('nexus:room-exited', () => {
        stopBattleProcess();
      });

      function loop() {
        __rafId = null;
        const canRun = __engineRunning && window.NexusSDK && window.NexusSDK.isGameplayActive() && window.NexusSDK.isRoomSessionActive();
        if (!canRun) {
          return;
        }
        step();
        render();
        scheduleLoop();
      }

      document.getElementById('btn-fortify-base').addEventListener('click', () => {
        if ((saveData.currency?.tankCoins ?? 0) < 50) return;
        saveData.currency.tankCoins -= 50;
        fortifyTimer = 1200;
        rebuildBasePerimeter(true);
        lan.sendReliable({ type: 'fortify' });
        NexusSDK.audio.upgrade();
        store.save(saveData);
        updateHud();
      });

      if (window.NexusSDK && window.NexusSDK.isGameplayActive() && window.NexusSDK.isRoomSessionActive()) {
        scheduleLoop();
      }
      // 调试探针导出
      window.__debugTank = () => ({ p1, p2, enemies, bullets, particles, resolveTankCollisions, rafActive: __rafId !== null });
    })();
    }

    return {
      start: function (ctx) {
        bootEngineOnce();
        __engineRunning = true;
        if (__resumeFn) __resumeFn();
      },
      stop: function () {
        __engineRunning = false;
        if (__releaseFn) __releaseFn();
      },
      getDebug: function () {
        return {
          gameId: 'tank-battle',
          initialized: __engineInitialized,
          running: __engineRunning && global.NexusSDK.isGameplayActive(),
          rafActive: __rafId !== null,
          entityCount: __entityCountFn()
        };
      }
    };
  });
})(window);
