/**
 * 保卫布丁 · 焦糖烘焙工坊 - 受控游戏运行引擎 (On-Demand Room-Gated Engine)
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

  global.NexusSDK.registerGameEngine('pudding-defense', function (roomBootCtx) {
    let __engineInitialized = false;
    let __engineRunning = false;

    function bootEngineOnce() {
      if (__engineInitialized) return;
      __engineInitialized = true;
(() => {
      NexusSDK.initShellUI({ gameId: 'pudding-defense', gameTitle: '保卫布丁' });

      const store = NexusSDK.createGameStorage('NEXUS_MINI_PUDDING_', (isAdmin) => ({
        currency: { sugarCrystals: isAdmin ? 99999 : 600 },
        goldenPuddings: isAdmin ? 30 : 0,
        clearedChapters: isAdmin ? 5 : 1
      }));
      let saveData = store.load();

      const sprites = NexusSDK.loadSprites('pudding-defense', {
        pudding: 'pudding-core.svg',
        boba: 'tower-boba.svg',
        frost: 'tower-frost.svg',
        sun: 'tower-sun.svg',
        missile: 'tower-missile.svg',
        prism: 'tower-prism.svg',
        sugar: 'obstacle-sugar.svg',
        cake: 'obstacle-cake.svg',
        cookie: 'monster-cookie.svg',
        boar: 'monster-boar.svg',
        jelly: 'monster-jelly.svg',
        glutton: 'boss-glutton.svg'
      });

      const canvas = document.getElementById('td-canvas');
      const ctx = canvas.getContext('2d');
      const COLS = 16;
      const ROWS = 9;
      const CELL = 60; // 16*60 = 960, 9*60 = 540

      const TOWER_DEFS = {
        boba:    { cost: 100, range: 165, cd: 24, dmg: 18, color: '#fb7185' },
        frost:   { cost: 120, range: 150, cd: 38, dmg: 12, color: '#38bdf8', slow: 0.55 },
        sun:     { cost: 160, range: 135, cd: 52, dmg: 26, color: '#fbbf24', aoe: true },
        missile: { cost: 180, range: 260, cd: 55, dmg: 45, color: '#f43f5e' },
        prism:   { cost: 220, range: 210, cd: 32, dmg: 38, color: '#a855f7' }
      };

      // Winding Path Waypoints (Grid Coordinates [col, row])
      const WAYPOINTS = [
        [0, 2], [4, 2], [4, 6], [8, 6], [8, 1], [12, 1], [12, 7], [15, 7]
      ];
      const pathSet = new Set();
      for (let i = 0; i < WAYPOINTS.length - 1; i++) {
        const [c1, r1] = WAYPOINTS[i];
        const [c2, r2] = WAYPOINTS[i + 1];
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            pathSet.add(`${c},${r}`);
          }
        }
      }

      let selectedTowerType = 'boba';
      let gold = 380;
      let wave = 1;
      let puddingHp = 10;
      let speedMult = 1;
      let freezeTimer = 0;
      let focusTarget = null;

      let towers = [];
      let obstacles = [];
      let monsters = [];
      let bullets = [];
      let pulses = [];
      let spawnQueue = 10;
      let spawnTick = 40;

      function initObstacles() {
        obstacles = [];
        const spots = [
          [2, 4, 'sugar'], [3, 4, 'cake'], [6, 3, 'sugar'], [6, 4, 'cake'],
          [10, 3, 'sugar'], [10, 5, 'cake'], [13, 3, 'sugar'], [14, 4, 'cake']
        ];
        spots.forEach(([c, r, type]) => {
          const maxHp = type === 'cake' ? 240 : 130;
          obstacles.push({
            c, r,
            x: c * CELL + CELL / 2,
            y: r * CELL + CELL / 2,
            type,
            hp: maxHp,
            maxHp,
            reward: type === 'cake' ? 150 : 80
          });
        });
      }

      function spawnMonster() {
        const types = ['cookie', 'boar', 'jelly'];
        const type = (spawnQueue === 1 && wave % 2 === 0) ? 'glutton' : types[(spawnQueue + wave) % types.length];
        const baseHp = type === 'glutton' ? 520 : (type === 'boar' ? 135 : 75);
        const spd = type === 'boar' ? 1.55 : (type === 'glutton' ? 0.75 : 1.15);
        monsters.push({
          type,
          wpIdx: 0,
          x: WAYPOINTS[0][0] * CELL + CELL / 2,
          y: WAYPOINTS[0][1] * CELL + CELL / 2,
          hp: baseHp + wave * 32,
          maxHp: baseHp + wave * 32,
          speed: spd,
          slowTimer: 0
        });
      }

      // LAN Co-op Session
      const lan = NexusSDK.createLanSession('pudding-defense', store.getAuth().room);
      lan.onReliable((msg) => {
        if (msg.type === 'place_tower') {
          placeOrUpgradeTower(msg.c, msg.r, msg.tType, false);
        }
      });

      function placeOrUpgradeTower(c, r, tType, broadcast = true) {
        if (pathSet.has(`${c},${r}`)) return;
        const obs = obstacles.find((o) => o.c === c && o.r === r);
        if (obs) {
          focusTarget = obs;
          NexusSDK.audio.tap();
          return;
        }
        const existing = towers.find((t) => t.c === c && t.r === r);
        if (existing) {
          const upCost = 90 * existing.level;
          if (existing.level < 3 && gold >= upCost) {
            gold -= upCost;
            existing.level++;
            existing.dmg = Math.round(existing.dmg * 1.45);
            existing.range += 18;
            NexusSDK.audio.upgrade();
            updateHud();
          }
          return;
        }
        const def = TOWER_DEFS[tType];
        if (!def || gold < def.cost) return;
        gold -= def.cost;
        towers.push({
          c, r,
          x: c * CELL + CELL / 2,
          y: r * CELL + CELL / 2,
          type: tType,
          level: 1,
          range: def.range,
          cdMax: def.cd,
          cd: 0,
          dmg: def.dmg,
          color: def.color,
          slow: def.slow || 0,
          aoe: !!def.aoe
        });
        NexusSDK.audio.pop();
        if (broadcast && lan.isConnected()) {
          lan.sendReliable({ type: 'place_tower', c, r, tType });
        }
        updateHud();
      }

      canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        // Check if user tapped a monster to lock focus
        for (const m of monsters) {
          if (Math.hypot(px - m.x, py - m.y) < 28) {
            focusTarget = m;
            NexusSDK.audio.tap();
            return;
          }
        }

        const c = Math.floor(px / CELL);
        const r = Math.floor(py / CELL);
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          placeOrUpgradeTower(c, r, selectedTowerType, true);
        }
      });

      function updateHud() {
        document.getElementById('hud-wave').textContent = `波次 ${wave} / 15`;
        document.getElementById('hud-gold').textContent = gold.toLocaleString();
        document.getElementById('hud-pudding').textContent = `${puddingHp} / 10 HP`;
        document.getElementById('hud-crystals').textContent = (saveData.currency?.sugarCrystals ?? 0).toLocaleString();
      }

      function stepOnce() {
        if (window.NexusSDK && !window.NexusSDK.isGameplayActive()) return;
        if (freezeTimer > 0) freezeTimer--;

        // Spawn monsters
        if (spawnQueue > 0) {
          spawnTick--;
          if (spawnTick <= 0) {
            spawnMonster();
            spawnQueue--;
            spawnTick = 55;
          }
        } else if (monsters.length === 0) {
          NexusSDK.audio.win();
          wave++;
          gold += 140;
          saveData.currency.sugarCrystals += 45;
          if (puddingHp === 10) saveData.goldenPuddings = (saveData.goldenPuddings || 0) + 1;
          store.save(saveData);
          spawnQueue = 8 + wave * 2;
          updateHud();
        }

        // Move Monsters along Waypoints
        for (let i = monsters.length - 1; i >= 0; i--) {
          const m = monsters[i];
          if (m.slowTimer > 0) m.slowTimer--;
          const targetWp = WAYPOINTS[m.wpIdx + 1];
          if (!targetWp) {
            // Reached Royal Pudding Core
            puddingHp = Math.max(1, puddingHp - 1);
            NexusSDK.audio.warn();
            if (focusTarget === m) focusTarget = null;
            monsters.splice(i, 1);
            updateHud();
            continue;
          }
          const tx = targetWp[0] * CELL + CELL / 2;
          const ty = targetWp[1] * CELL + CELL / 2;
          const dx = tx - m.x;
          const dy = ty - m.y;
          const dist = Math.hypot(dx, dy);
          const spd = freezeTimer > 0 ? m.speed * 0.2 : (m.slowTimer > 0 ? m.speed * 0.55 : m.speed);
          if (dist <= spd) {
            m.x = tx; m.y = ty;
            m.wpIdx++;
          } else {
            m.x += (dx / dist) * spd;
            m.y += (dy / dist) * spd;
          }
        }

        // Towers Attack Logic (Prioritize Focus Target or First Monster / Obstacle)
        towers.forEach((tw) => {
          if (tw.cd > 0) tw.cd--;
          if (tw.cd > 0) return;

          if (tw.aoe) {
            // Sun Tower 360° AOE Pulse
            const hasTarget = monsters.some((m) => Math.hypot(m.x - tw.x, m.y - tw.y) <= tw.range) ||
                              obstacles.some((o) => Math.hypot(o.x - tw.x, o.y - tw.y) <= tw.range);
            if (hasTarget) {
              tw.cd = tw.cdMax;
              pulses.push({ x: tw.x, y: tw.y, r: 16, maxR: tw.range, alpha: 0.9, color: tw.color });
              NexusSDK.audio.pop();
              monsters.forEach((m) => {
                if (Math.hypot(m.x - tw.x, m.y - tw.y) <= tw.range) dDamage(m, tw.dmg);
              });
              obstacles.forEach((o) => {
                if (Math.hypot(o.x - tw.x, o.y - tw.y) <= tw.range) dDamage(o, tw.dmg);
              });
            }
            return;
          }

          let target = null;
          if (focusTarget && focusTarget.hp > 0 && Math.hypot(focusTarget.x - tw.x, focusTarget.y - tw.y) <= tw.range) {
            target = focusTarget;
          } else {
            target = monsters.find((m) => Math.hypot(m.x - tw.x, m.y - tw.y) <= tw.range) ||
                     obstacles.find((o) => Math.hypot(o.x - tw.x, o.y - tw.y) <= tw.range);
          }

          if (target) {
            tw.cd = tw.cdMax;
            bullets.push({
              x: tw.x, y: tw.y,
              target,
              dmg: tw.dmg,
              slow: tw.slow,
              color: tw.color
            });
            NexusSDK.audio.pop();
          }
        });

        // Update Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          if (!b.target || b.target.hp <= 0) {
            bullets.splice(i, 1);
            continue;
          }
          const dx = b.target.x - b.x;
          const dy = b.target.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 12) {
            if (b.slow && b.target.wpIdx !== undefined) b.target.slowTimer = 90;
            dDamage(b.target, b.dmg);
            bullets.splice(i, 1);
          } else {
            b.x += (dx / dist) * 10.5;
            b.y += (dy / dist) * 10.5;
          }
        }

        // Cleanup dead monsters & obstacles
        for (let i = monsters.length - 1; i >= 0; i--) {
          const m = monsters[i];
          if (m.hp <= 0) {
            gold += m.type === 'glutton' ? 120 : 28;
            if (focusTarget === m) focusTarget = null;
            monsters.splice(i, 1);
            updateHud();
          }
        }
        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          if (o.hp <= 0) {
            gold += o.reward;
            saveData.currency.sugarCrystals += 20;
            store.save(saveData);
            NexusSDK.audio.pickup();
            if (focusTarget === o) focusTarget = null;
            obstacles.splice(i, 1);
            updateHud();
          }
        }

        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.r += (p.maxR - p.r) * 0.22;
          p.alpha -= 0.05;
          if (p.alpha <= 0) pulses.splice(i, 1);
        }
      }

      function dDamage(entity, dmg) {
        entity.hp -= dmg;
      }

      function render() {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2b160e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw 16x9 Grid & Winding Path
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const x = c * CELL;
            const y = r * CELL;
            if (pathSet.has(`${c},${r}`)) {
              ctx.fillStyle = 'rgba(253, 224, 71, 0.14)';
              ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
            } else {
              ctx.strokeStyle = 'rgba(255, 251, 235, 0.06)';
              ctx.strokeRect(x, y, CELL, CELL);
            }
          }
        }

                // [PD-P3-01] caramel-wafer-flow: Golden Wafer Path Animated Chevrons
        ctx.save();
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.42)';
        ctx.lineWidth = 2;
        const flowOffset = (Date.now() * 0.03) % 24;
        for (let w = 0; w < WAYPOINTS.length - 1; w++) {
          const [c1, r1] = WAYPOINTS[w];
          const [c2, r2] = WAYPOINTS[w + 1];
          const x1 = c1 * CELL + 30, y1 = r1 * CELL + 30;
          const x2 = c2 * CELL + 30, y2 = r2 * CELL + 30;
          const segLen = Math.hypot(x2 - x1, y2 - y1);
          const ang = Math.atan2(y2 - y1, x2 - x1);
          for (let d = flowOffset; d < segLen; d += 28) {
            const cx = x1 + Math.cos(ang) * d;
            const cy = y1 + Math.sin(ang) * d;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(-4, -4); ctx.lineTo(3, 0); ctx.lineTo(-4, 4);
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
        // Obstacles (Sugar & Cake SVG Sprites)
        obstacles.forEach((o) => {
          const sp = sprites[o.type];
          if (sp?.complete) {
            ctx.drawImage(sp, o.x - 24, o.y - 24, 48, 48);
          }
          if (o.hp < o.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(o.x - 20, o.y - 28, 40, 4);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(o.x - 20, o.y - 28, 40 * (o.hp / o.maxHp), 4);
          }
        });

        // Royal Caramel Pudding Core at last Waypoint [15, 7]
        const [pc, pr] = WAYPOINTS[WAYPOINTS.length - 1];
        if (sprites.pudding?.complete) {
          ctx.drawImage(sprites.pudding, pc * CELL + 4, pr * CELL + 4, 52, 52);
        }

        // Towers (5 Dessert Guardians SVG Sprites)
        towers.forEach((tw) => {
          const sp = sprites[tw.type];
          if (sp?.complete) {
            ctx.drawImage(sp, tw.x - 25, tw.y - 25, 50, 50);
          }
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 11px Orbitron, sans-serif';
          ctx.fillText(`Lv.${tw.level}`, tw.x - 12, tw.y + 26);
        });

        // Monsters (SVG Sprites)
        monsters.forEach((m) => {
          const sp = sprites[m.type] || sprites.cookie;
          const sz = m.type === 'glutton' ? 54 : 44;
          if (sp?.complete) {
            ctx.drawImage(sp, m.x - sz / 2, m.y - sz / 2, sz, sz);
          }
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(m.x - 18, m.y - sz / 2 - 6, 36, 4);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(m.x - 18, m.y - sz / 2 - 6, 36 * Math.max(0, m.hp / m.maxHp), 4);
        });

        // Target Focus Lock Reticle
        if (focusTarget && focusTarget.hp > 0) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(focusTarget.x, focusTarget.y, 26, 0, Math.PI * 2);
          ctx.stroke();
        }

        // AOE Pulses & Bullets
        pulses.forEach((p) => {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });

        bullets.forEach((b) => {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      function startBattleFromRoom() {
        gold = 380;
        wave = 1;
        puddingHp = 10;
        monsters.length = 0;
        bullets.length = 0;
        pulses.length = 0;
        towers.length = 0;
        spawnQueue = 0;
        spawnTick = 40;
        initObstacles();
        towers.push({
          c: 3, r: 3, x: 3 * CELL + 30, y: 3 * CELL + 30,
          type: 'boba', level: 1, range: 165, cdMax: 24, cd: 0, dmg: 18, color: '#fb7185', slow: 0, aoe: false
        });
        updateHud();
      }

      function stopBattleProcess() {
        monsters.length = 0;
        bullets.length = 0;
        pulses.length = 0;
      }

      window.addEventListener('nexus:gameplay-started', () => {
        startBattleFromRoom();
      });
      if (window.NexusSDK && window.NexusSDK.isGameplayActive()) {
        startBattleFromRoom();
      }

      window.addEventListener('nexus:gameplay-stopped', () => {
        stopBattleProcess();
      });

      function loop() {
        const canRun = window.NexusSDK && window.NexusSDK.isGameplayActive() && window.NexusSDK.isRoomSessionActive();
        if (canRun) {
          for (let s = 0; s < speedMult; s++) stepOnce();
          render();
        } else {
          render();
        }
        requestAnimationFrame(loop);
      }

      // UI Dock Bindings
      document.querySelectorAll('#tower-dock .tower-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          NexusSDK.audio.tap();
          selectedTowerType = btn.getAttribute('data-tower');
          document.querySelectorAll('#tower-dock .tower-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      document.getElementById('btn-blizzard').addEventListener('click', () => {
        if (gold < 100) return;
        gold -= 100;
        freezeTimer = 300;
        monsters.forEach((m) => { m.hp -= 45; });
        NexusSDK.audio.laser();
        updateHud();
      });

      document.getElementById('btn-speed').addEventListener('click', (e) => {
        NexusSDK.audio.tap();
        speedMult = speedMult === 1 ? 2 : 1;
        e.currentTarget.style.background = speedMult === 2 ? 'rgba(253, 224, 71, 0.22)' : 'var(--panel)';
        e.currentTarget.style.borderColor = speedMult === 2 ? 'var(--cyan)' : 'var(--border)';
      });

      updateHud();
      requestAnimationFrame(loop);
    })();
    }

    return {
      start: function (ctx) {
        bootEngineOnce();
        __engineRunning = true;
      },
      stop: function () {
        __engineRunning = false;
      },
      getDebug: function () {
        return {
          gameId: 'pudding-defense',
          initialized: __engineInitialized,
          running: __engineRunning && global.NexusSDK.isGameplayActive()
        };
      }
    };
  });
})(window);
