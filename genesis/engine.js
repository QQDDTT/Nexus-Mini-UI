/**
 * 微界演化 · 培养皿基因序列库 - 受控游戏运行引擎 (On-Demand Room-Gated Engine)
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

  global.NexusSDK.registerGameEngine('micro-genesis', function (roomBootCtx) {
    let __engineInitialized = false;
    let __engineRunning = false;

    function bootEngineOnce() {
      if (__engineInitialized) return;
      __engineInitialized = true;
(() => {
      'use strict';

      NexusSDK.initShellUI({ gameId: 'micro-genesis', gameTitle: '微界演化：基因沙盘' });

      /* =====================================================================
       * 1. 权威器官与躯干分阶图鉴数据库 (100% 对齐 05 & 06 规范)
       * ===================================================================== */
      const TORSOS = {
        'torso-t1-micro': {
          id: 'torso-t1-micro', code: 'T01', name: '微型单节原核体', shortName: 'T01 原核',
          sprite: 'torso-t1-micro.svg', volume: 1.0, baseHp: 70, bmr: 0.8, moveDrain: 0.25, kv: 1.25, kw: 1.30,
          reproThreshold: 0.75, reproCostAdd: 0.00, childERatioMult: 1.00, reproCooldown: 4.0, maxColonyPop: 20,
          baseGrowSec: 3.5, juvenileStartScale: 0.78, juvenileMinHpMult: 0.72, juvenileMinDmgMult: 0.72, juvenileMinArmorMult: 0.75,
          transitionGp: 0, totalSlots: 5,
          slots: { core: 1, sensory: 1, mouth: 1, locomotion: 1, utility: 1 },
          sizePx: 24, segments: [1.0]
        },
        'torso-t2-stream': {
          id: 'torso-t2-stream', code: 'T02', name: '流线三节真核体', shortName: 'T02 流线',
          sprite: 'torso-t2-stream.svg', volume: 2.2, baseHp: 140, bmr: 2.2, moveDrain: 0.85, kv: 1.00, kw: 1.00,
          reproThreshold: 0.82, reproCostAdd: 0.08, childERatioMult: 0.92, reproCooldown: 7.5, maxColonyPop: 14,
          baseGrowSec: 10.0, juvenileStartScale: 0.65, juvenileMinHpMult: 0.50, juvenileMinDmgMult: 0.50, juvenileMinArmorMult: 0.50,
          transitionGp: 150, totalSlots: 7,
          slots: { core: 1, sensory: 1, mouth: 1, locomotion: 2, utility: 2 },
          sizePx: 30, segments: [0.95, 1.05, 0.78]
        },
        'torso-t3-predator': {
          id: 'torso-t3-predator', code: 'T03', name: '宽幅五节掠食体', shortName: 'T03 掠食',
          sprite: 'torso-t3-predator.svg', volume: 4.0, baseHp: 240, bmr: 5.2, moveDrain: 2.40, kv: 0.72, kw: 0.68,
          reproThreshold: 0.90, reproCostAdd: 0.18, childERatioMult: 0.82, reproCooldown: 14.0, maxColonyPop: 8,
          baseGrowSec: 22.0, juvenileStartScale: 0.54, juvenileMinHpMult: 0.34, juvenileMinDmgMult: 0.35, juvenileMinArmorMult: 0.30,
          transitionGp: 320, totalSlots: 9,
          slots: { core: 1, sensory: 2, mouth: 1, locomotion: 2, utility: 3 },
          sizePx: 38, segments: [0.92, 1.15, 1.08, 0.88, 0.68]
        },
        'torso-t4-titan': {
          id: 'torso-t4-titan', code: 'T04', name: '巨型多节深渊泰坦', shortName: 'T04 泰坦',
          sprite: 'torso-t4-titan.svg', volume: 7.5, baseHp: 420, bmr: 11.5, moveDrain: 5.50, kv: 0.48, kw: 0.42,
          reproThreshold: 0.96, reproCostAdd: 0.28, childERatioMult: 0.72, reproCooldown: 24.0, maxColonyPop: 4,
          baseGrowSec: 38.0, juvenileStartScale: 0.45, juvenileMinHpMult: 0.22, juvenileMinDmgMult: 0.25, juvenileMinArmorMult: 0.15,
          transitionGp: 600, totalSlots: 12,
          slots: { core: 1, sensory: 2, mouth: 2, locomotion: 3, utility: 4 },
          sizePx: 48, segments: [0.95, 1.20, 1.22, 1.12, 0.98, 0.82, 0.65]
        }
      };

      const ORGAN_CATALOG = {
        /* 1. 核心插槽 (Core) */
        'core-vacuole': {
          id: 'core-vacuole', category: 'core', branchName: '原质消化泡 (代谢储能系)',
          levels: {
            1: { name: '单室消化液泡', sprite: 'core-vacuole-lv1.svg', gp: 0, bmr: 0, baseE: 100, digestEff: 1.00, regenPerE: 0.8, regenCap: 0.8, reproRatio: 0.70, childERatio: 0.45 },
            2: { name: '双循环线粒体腔', sprite: 'core-vacuole-lv2.svg', gp: 120, bmr: 0, baseE: 155, digestEff: 1.30, regenPerE: 1.3, regenCap: 1.5, reproRatio: 0.60, childERatio: 0.42 },
            3: { name: '超频多核代谢中枢', sprite: 'core-vacuole-lv3.svg', gp: 320, bmr: 0, baseE: 230, digestEff: 1.65, regenPerE: 2.0, regenCap: 2.6, reproRatio: 0.50, childERatio: 0.40 }
          }
        },
        'core-mitosis': {
          id: 'core-mitosis', category: 'core', branchName: '裂变生殖核 (繁衍再生系)',
          levels: {
            1: { name: '初级裂变生殖核', sprite: 'core-mitosis-lv1.svg', gp: 0, bmr: 0, baseE: 90, digestEff: 0.95, regenPerE: 1.2, regenCap: 1.2, reproRatio: 0.60, childERatio: 0.42 },
            2: { name: '双螺旋造血内脏', sprite: 'core-mitosis-lv2.svg', gp: 120, bmr: 0, baseE: 135, digestEff: 1.15, regenPerE: 2.0, regenCap: 2.4, reproRatio: 0.50, childERatio: 0.40 },
            3: { name: '母体永生繁衍矩阵', sprite: 'core-mitosis-lv3.svg', gp: 320, bmr: 0, baseE: 190, digestEff: 1.35, regenPerE: 3.2, regenCap: 4.0, reproRatio: 0.42, childERatio: 0.35 }
          }
        },

        /* 2. 感官插槽 (Sensory —— 整合感官体系：近体绝对感知彩色区 + 视觉长距中心清晰向外渐变模糊扇形 + 听觉远距衰减雷达场) */
        'sensory-eye': {
          id: 'sensory-eye', category: 'sensory', senseType: 'eye', branchName: '光学视觉眼 (扇形长距 · 渐模糊)',
          levels: {
            1: { name: '原始感光眼点', sprite: 'sensory-eye-lv1.svg', gp: 0, bmr: 0.15, dayAngle: 76, nightAngle: 56, dayRange: 380, nightRange: 215, sat: 0.55 },
            2: { name: '晶状体折光单眼', sprite: 'sensory-eye-lv2.svg', gp: 100, bmr: 0.30, dayAngle: 96, nightAngle: 72, dayRange: 470, nightRange: 265, sat: 0.95 },
            3: { name: '全光谱棱镜复眼', sprite: 'sensory-eye-lv3.svg', gp: 280, bmr: 0.55, dayAngle: 116, nightAngle: 88, dayRange: 560, nightRange: 320, sat: 1.25 }
          }
        },
        'sensory-ear': {
          id: 'sensory-ear', category: 'sensory', senseType: 'ear', branchName: '声呐听觉耳 (360°广域 · 远距衰减)',
          levels: {
            1: { name: '初级震动膜耳', sprite: 'sensory-ear-lv1.svg', gp: 0, bmr: 0.15, sonarRange: 420, pulseSec: 0.95, staticRange: 145 },
            2: { name: '环状微流侧线', sprite: 'sensory-ear-lv2.svg', gp: 110, bmr: 0.30, sonarRange: 510, pulseSec: 0.65, staticRange: 195 },
            3: { name: '深渊高频回声耳', sprite: 'sensory-ear-lv3.svg', gp: 290, bmr: 0.55, sonarRange: 600, pulseSec: 0.35, staticRange: 245 }
          }
        },

        /* 3. 口部插槽 (Mouth) */
        'mouth-herb': {
          id: 'mouth-herb', category: 'mouth', diet: 'herbivore', branchName: '微孔滤食吸管 (植食高转化)',
          levels: {
            1: { name: '微孔滤食吸管', sprite: 'mouth-herb-lv1.svg', gp: 0, bmr: 0.15, herbEff: 1.40, carnEff: 0, funnelR: 52, biteDmg: 3, biteCost: 0.8, lifesteal: 0 },
            2: { name: '涡流纤毛虹吸漏斗', sprite: 'mouth-herb-lv2.svg', gp: 90, bmr: 0.30, herbEff: 1.65, carnEff: 0, funnelR: 78, biteDmg: 5, biteCost: 1.0, lifesteal: 0 },
            3: { name: '晶化共鸣研磨齿盘', sprite: 'mouth-herb-lv3.svg', gp: 240, bmr: 0.50, herbEff: 1.95, carnEff: 0, funnelR: 105, biteDmg: 10, biteCost: 1.2, lifesteal: 0 }
          }
        },
        'mouth-carn': {
          id: 'mouth-carn', category: 'mouth', diet: 'carnivore', branchName: '撕裂几丁骨颚 (肉食强撕咬·击杀食肉)',
          levels: {
            1: { name: '裂噬几丁单颚', sprite: 'mouth-carn-lv1.svg', gp: 0, bmr: 0.45, herbEff: 0, carnEff: 1.35, funnelR: 34, biteDmg: 26, biteCost: 2.2, lifesteal: 0 },
            2: { name: '倒钩锯齿双巨颚', sprite: 'mouth-carn-lv2.svg', gp: 130, bmr: 0.85, herbEff: 0, carnEff: 1.60, funnelR: 40, biteDmg: 42, biteCost: 3.0, lifesteal: 0 },
            3: { name: '深渊断骨碎甲利刃', sprite: 'mouth-carn-lv3.svg', gp: 340, bmr: 1.40, herbEff: 0, carnEff: 1.90, funnelR: 46, biteDmg: 64, biteCost: 4.0, lifesteal: 0 }
          }
        },
        'mouth-omni': {
          id: 'mouth-omni', category: 'mouth', diet: 'omnivore', branchName: '双用刺吸口吻 (杂食均衡)',
          levels: {
            1: { name: '初级双用刺吸吻', sprite: 'mouth-omni-lv1.svg', gp: 0, bmr: 0.25, herbEff: 0.85, carnEff: 0.90, funnelR: 36, biteDmg: 14, biteCost: 1.6, lifesteal: 0 },
            2: { name: '钳状分节咀嚼喙', sprite: 'mouth-omni-lv2.svg', gp: 100, bmr: 0.45, herbEff: 0.95, carnEff: 1.05, funnelR: 42, biteDmg: 22, biteCost: 2.2, lifesteal: 0 },
            3: { name: '酸解高频融合口器', sprite: 'mouth-omni-lv3.svg', gp: 260, bmr: 0.75, herbEff: 1.10, carnEff: 1.20, funnelR: 48, biteDmg: 32, biteCost: 2.8, lifesteal: 0 }
          }
        },

        /* 4. 运动插槽 (Locomotion) */
        'loco-flagella': {
          id: 'loco-flagella', category: 'locomotion', branchName: '柔性推进鞭毛 (省能巡航)',
          levels: {
            1: { name: '单丝螺旋鞭毛', sprite: 'loco-flagella-lv1.svg', gp: 0, bmr: 0.15, thrust: 32, torque: 28, skill: null, skillCost: 0, skillCd: 0 },
            2: { name: '双联谐振长鞭', sprite: 'loco-flagella-lv2.svg', gp: 95, bmr: 0.30, thrust: 52, torque: 45, skill: null, skillCost: 0, skillCd: 0 },
            3: { name: '量子波导多束尾纤', sprite: 'loco-flagella-lv3.svg', gp: 250, bmr: 0.50, thrust: 78, torque: 68, skill: null, skillCost: 0, skillCd: 0 }
          }
        },
        'loco-fin': {
          id: 'loco-fin', category: 'locomotion', branchName: '矢量转向侧鳍 (高敏侧闪)',
          levels: {
            1: { name: '薄膜平衡侧鳍', sprite: 'loco-fin-lv1.svg', gp: 0, bmr: 0.20, thrust: 18, torque: 55, skill: 'sidestep', skillCost: 12, skillCd: 4.0 },
            2: { name: '双翼矢量折跃鳍', sprite: 'loco-fin-lv2.svg', gp: 110, bmr: 0.40, thrust: 30, torque: 88, skill: 'sidestep', skillCost: 10, skillCd: 2.8 },
            3: { name: '幻影多轴流体翼阵列', sprite: 'loco-fin-lv3.svg', gp: 280, bmr: 0.65, thrust: 46, torque: 130, skill: 'sidestep', skillCost: 8, skillCd: 1.8 }
          }
        },
        'loco-jet': {
          id: 'loco-jet', category: 'locomotion', branchName: '高压喷水推进囊 (爆发冲刺)',
          levels: {
            1: { name: '单腔脉动喷水囊', sprite: 'loco-jet-lv1.svg', gp: 0, bmr: 0.30, thrust: 60, torque: 14, skill: 'jetdash', skillCost: 18, skillCd: 4.5 },
            2: { name: '双管增压水力喷嘴', sprite: 'loco-jet-lv2.svg', gp: 125, bmr: 0.55, thrust: 95, torque: 24, skill: 'jetdash', skillCost: 16, skillCd: 3.2 },
            3: { name: '超空泡等离子推进引擎', sprite: 'loco-jet-lv3.svg', gp: 330, bmr: 0.90, thrust: 145, torque: 38, skill: 'jetdash', skillCost: 14, skillCd: 2.2 }
          }
        },

        /* 5. 功能插槽 (Utility) */
        'util-scales': {
          id: 'util-scales', category: 'utility', branchName: '硬化鳞片 (减伤装甲)',
          levels: {
            1: { name: '角质覆瓦薄鳞', sprite: 'util-scales-lv1.svg', gp: 0, bmr: 0.25, dr: 0.22, bonusHp: 25, reflect: 0, skill: null, skillCost: 0, skillCd: 0 },
            2: { name: '几丁质六角重鳞', sprite: 'util-scales-lv2.svg', gp: 110, bmr: 0.50, dr: 0.38, bonusHp: 55, reflect: 0, skill: null, skillCost: 0, skillCd: 0 },
            3: { name: '深渊棱镜反伤晶甲', sprite: 'util-scales-lv3.svg', gp: 290, bmr: 0.85, dr: 0.55, bonusHp: 100, reflect: 0.30, skill: null, skillCost: 0, skillCd: 0 }
          }
        },
        'util-mimic': {
          id: 'util-mimic', category: 'utility', branchName: '拟态皮肤 (欺骗视觉)',
          levels: {
            1: { name: '初级色素拟态膜', sprite: 'util-mimic-lv1.svg', gp: 80, bmr: 0.15, dr: 0, bonusHp: 0, skill: 'mimic', skillCost: 10, skillCd: 8.0, mimicDur: 6.0 },
            2: { name: '动态光学折射皮层', sprite: 'util-mimic-lv2.svg', gp: 180, bmr: 0.25, dr: 0, bonusHp: 0, skill: 'mimic', skillCost: 10, skillCd: 6.0, mimicDur: 9.0 },
            3: { name: '幽灵全息隐形表皮', sprite: 'util-mimic-lv3.svg', gp: 350, bmr: 0.40, dr: 0, bonusHp: 0, skill: 'mimic', skillCost: 8, skillCd: 4.5, mimicDur: 14.0 }
          }
        },
        'util-ink': {
          id: 'util-ink', category: 'utility', branchName: '蓄能墨囊 (致盲视觉)',
          levels: {
            1: { name: '单泡暗影墨囊', sprite: 'util-ink-lv1.svg', gp: 75, bmr: 0.15, dr: 0, bonusHp: 0, skill: 'ink', skillCost: 20, skillCd: 7.0, inkR: 120, inkDur: 4.0 },
            2: { name: '高压浓雾双墨腺', sprite: 'util-ink-lv2.svg', gp: 165, bmr: 0.25, dr: 0, bonusHp: 0, skill: 'ink', skillCost: 18, skillCd: 5.5, inkR: 165, inkDur: 5.5 },
            3: { name: '深渊窒息黑洞墨囊', sprite: 'util-ink-lv3.svg', gp: 310, bmr: 0.40, dr: 0, bonusHp: 0, skill: 'ink', skillCost: 16, skillCd: 4.2, inkR: 220, inkDur: 7.5 }
          }
        },
        'util-venom': {
          id: 'util-venom', category: 'utility', branchName: '毒腺器官 (持续毒伤)',
          levels: {
            1: { name: '微弱酸性毒胞', sprite: 'util-venom-lv1.svg', gp: 85, bmr: 0.20, dr: 0, bonusHp: 0, skill: 'venom', skillCost: 15, skillCd: 5.0, dot: 5, dotDur: 4.0 },
            2: { name: '麻痹神经双毒腺', sprite: 'util-venom-lv2.svg', gp: 185, bmr: 0.35, dr: 0, bonusHp: 0, skill: 'venom', skillCost: 16, skillCd: 4.2, dot: 9, dotDur: 5.5 },
            3: { name: '坏死融骨剧毒母囊', sprite: 'util-venom-lv3.svg', gp: 340, bmr: 0.55, dr: 0, bonusHp: 0, skill: 'venom', skillCost: 18, skillCd: 3.5, dot: 15, dotDur: 7.0 }
          }
        },
        'util-spike': {
          id: 'util-spike', category: 'utility', branchName: '骨刺发射器 (远程穿刺)',
          levels: {
            1: { name: '单发钙化骨刺鞘', sprite: 'util-spike-lv1.svg', gp: 90, bmr: 0.20, dr: 0, bonusHp: 0, skill: 'spike', skillCost: 8, skillCd: 1.4, spikeDmg: 18, spikeCount: 1, spikeRange: 250 },
            2: { name: '双联倒钩连射骨刺', sprite: 'util-spike-lv2.svg', gp: 195, bmr: 0.35, dr: 0, bonusHp: 0, skill: 'spike', skillCost: 10, skillCd: 1.1, spikeDmg: 16, spikeCount: 2, spikeRange: 310 },
            3: { name: '超速电磁穿甲棘阵列', sprite: 'util-spike-lv3.svg', gp: 360, bmr: 0.55, dr: 0, bonusHp: 0, skill: 'spike', skillCost: 12, skillCd: 0.85, spikeDmg: 22, spikeCount: 3, spikeRange: 380 }
          }
        },
        'util-electric': {
          id: 'util-electric', category: 'utility', branchName: '生物放电器官 (范围麻痹)',
          levels: {
            1: { name: '微弱生物电斑', sprite: 'util-electric-lv1.svg', gp: 100, bmr: 0.25, dr: 0, bonusHp: 0, skill: 'electric', skillCost: 22, skillCd: 6.0, elecR: 110, elecDmg: 16, stunSec: 0.8 },
            2: { name: '高压环状电鳗腺', sprite: 'util-electric-lv2.svg', gp: 220, bmr: 0.45, dr: 0, bonusHp: 0, skill: 'electric', skillCost: 24, skillCd: 4.8, elecR: 150, elecDmg: 30, stunSec: 1.3 },
            3: { name: '雷暴等离子电弧核心', sprite: 'util-electric-lv3.svg', gp: 380, bmr: 0.70, dr: 0, bonusHp: 0, skill: 'electric', skillCost: 26, skillCd: 3.8, elecR: 195, elecDmg: 48, stunSec: 1.8 }
          }
        }
      };

      /* 官方化石记录：5 大官方标准生态物种 (完整 5 插槽配方) */
      const OFFICIAL_FOSSILS = [
        {
          speciesId: 'fossil_t1_herb', origin: 'official_fossil', speciesName: '浅水草食游虫', torsoId: 'torso-t1-micro',
          desc: '温和浅滩常见的高转化植食微虫，凭借滤食吸管与低代谢迅速繁衍种群。',
          slots: {
            core: { id: 'core-vacuole', level: 1 },
            sensory: [{ id: 'sensory-eye', level: 1 }],
            mouth: [{ id: 'mouth-herb', level: 1 }],
            locomotion: [{ id: 'loco-flagella', level: 1 }],
            utility: [{ id: 'util-scales', level: 1 }]
          },
          aiWeights: { w_aggr: 0.15, w_flock: 0.80, w_flee: 0.75, w_repro: 0.90, w_mut: 0.20 }
        },
        {
          speciesId: 'fossil_t2_spike', origin: 'official_fossil', speciesName: '游荡掠食刺虫', torsoId: 'torso-t2-stream',
          desc: '中层水域敏捷猎手，发现目标后齐射钙化骨刺并启动水囊突进撕咬。',
          slots: {
            core: { id: 'core-vacuole', level: 1 },
            sensory: [{ id: 'sensory-eye', level: 1 }],
            mouth: [{ id: 'mouth-carn', level: 1 }],
            locomotion: [{ id: 'loco-jet', level: 1 }, { id: 'loco-flagella', level: 1 }],
            utility: [{ id: 'util-spike', level: 1 }, { id: 'util-scales', level: 1 }]
          },
          aiWeights: { w_aggr: 0.80, w_flock: 0.35, w_flee: 0.30, w_repro: 0.65, w_mut: 0.25 }
        },
        {
          speciesId: 'fossil_t2_sonar', origin: 'official_fossil', speciesName: '剧毒声呐潜猎虫', torsoId: 'torso-t2-stream',
          desc: '搭载 360° 环状微流侧线的夜行刺客，在黑夜中释放神经毒环与墨云猎杀视觉生物。',
          slots: {
            core: { id: 'core-vacuole', level: 2 },
            sensory: [{ id: 'sensory-ear', level: 2 }],
            mouth: [{ id: 'mouth-omni', level: 2 }],
            locomotion: [{ id: 'loco-flagella', level: 2 }, { id: 'loco-fin', level: 1 }],
            utility: [{ id: 'util-venom', level: 2 }, { id: 'util-ink', level: 1 }]
          },
          aiWeights: { w_aggr: 0.70, w_flock: 0.45, w_flee: 0.50, w_repro: 0.75, w_mut: 0.30 }
        },
        {
          speciesId: 'fossil_t3_carapace', origin: 'official_fossil', speciesName: '重甲深水巨鳌', torsoId: 'torso-t3-predator',
          desc: '装备视听双感官与双层几丁质六角重鳞的重装掠食者，正面交锋极难破防。',
          slots: {
            core: { id: 'core-mitosis', level: 2 },
            sensory: [{ id: 'sensory-eye', level: 2 }, { id: 'sensory-ear', level: 1 }],
            mouth: [{ id: 'mouth-carn', level: 2 }],
            locomotion: [{ id: 'loco-fin', level: 2 }, { id: 'loco-jet', level: 2 }],
            utility: [{ id: 'util-scales', level: 2 }, { id: 'util-scales', level: 2 }, { id: 'util-spike', level: 2 }]
          },
          aiWeights: { w_aggr: 0.85, w_flock: 0.50, w_flee: 0.20, w_repro: 0.60, w_mut: 0.20 }
        },
        {
          speciesId: 'fossil_t4_titan', origin: 'official_fossil', speciesName: '深渊电弧泰坦', torsoId: 'torso-t4-titan',
          desc: '深渊裂谷食物链顶端的七节巨兽，视听满级全向锁定，超空泡冲刺配合雷暴电弧统治全场。',
          slots: {
            core: { id: 'core-vacuole', level: 3 },
            sensory: [{ id: 'sensory-eye', level: 3 }, { id: 'sensory-ear', level: 3 }],
            mouth: [{ id: 'mouth-carn', level: 3 }, { id: 'mouth-carn', level: 3 }],
            locomotion: [{ id: 'loco-jet', level: 3 }, { id: 'loco-jet', level: 3 }, { id: 'loco-fin', level: 3 }],
            utility: [{ id: 'util-electric', level: 3 }, { id: 'util-scales', level: 3 }, { id: 'util-spike', level: 3 }, { id: 'util-mimic', level: 3 }]
          },
          aiWeights: { w_aggr: 0.95, w_flock: 0.30, w_flee: 0.10, w_repro: 0.55, w_mut: 0.15 }
        }
      ];

      const EPIC_BOSSES = [
        { id: 'boss_1', chapter: '第一章 · 浅海温床', name: '1. 吞天水螅 (Hydra Goliath)', unlock: '首通解锁：T02 流线躯干 + 晶状体单眼 Lv.2 | 3星：暗影墨囊 Lv.1', desc: '定居中央泉眼，伸展 6 条弹性触手旋涡捕捞；HP < 50% 时断触化为 3 只游猎分身。' },
        { id: 'boss_2', chapter: '第二章 · 嗜热喷口', name: '2. 晶甲熔岩虱 (Magma Louse)', unlock: '首通解锁：双管喷水嘴 Lv.2 + 六角重鳞 Lv.2 | 3星：造血内脏 Lv.2', desc: '正面硫化晶甲减免 80% 伤害，需绕后破坏尾部散热喷口使其停机瘫痪。' },
        { id: 'boss_3', chapter: '第三章 · 极寒冰隙', name: '3. 霜刃水母 (Cryo-Bladed Medusa)', unlock: '首通解锁：T03 掠食躯干 + 微流侧线 Lv.2 | 3星：光学拟态皮层 Lv.2', desc: '周期性收缩伞盖释放 60% 减速冰刺与 8 秒限时冰晶护盾。' },
        { id: 'boss_4', chapter: '第四章 · 剧毒沼泽', name: '4. 千目原质母体 (Primordial Slime)', unlock: '首通解锁：神经双毒腺 Lv.2 + 双墨腺 Lv.2 | 3星：倒钩骨刺 Lv.2', desc: '吞噬死亡生物即时拟态同化其器官（最多保留 2 个 FIFO 同化槽位，持续 12.0s）。' },
        { id: 'boss_5', chapter: '第五章 · 深渊裂谷', name: '5. 虚空噬菌裂变兽 (Void Leviathan)', unlock: '首通解锁：T04 深渊泰坦 + 高频回声耳 Lv.3 | 3星：多核中枢 Lv.3 + 雷暴核心 Lv.3', desc: '释放向心黑洞引力场与 4.0 秒逆转基因光束（临时将受击者器官压制为 Lv.1）。' }
      ];

      const BIOMES = [
        {
          id: 0, name: '1. 浅海温床', era: '太古宙 · 透光硅藻海', sub: '丁达尔焦散 · 吞天水螅',
          bgTint: '#041824', bgInner: '#0a3340', bgOuter: '#020c14', outerRgb: '2, 12, 20', accentRgba: '45, 212, 191', secondaryRgba: '52, 211, 153',
          motif: 'caustics', bmrMult: 1.0, dragMult: 1.0, forceNight: false,
          desc: '第一章【浅海温床 · 太古宙透光层】：阳光穿透温暖的原初浅海，形成摇曳的丁达尔焦散光网与叶绿素海雪；中央【起源浅滩】涌出原生营养质，关底首领：吞天水螅。'
        },
        {
          id: 1, name: '2. 嗜热喷口', era: '冥古宙 · 黑烟囱裂谷', sub: '熔岩微裂隙 · 晶甲熔岩虱',
          bgTint: '#16070d', bgInner: '#2b0f19', bgOuter: '#0b0306', outerRgb: '11, 3, 6', accentRgba: '251, 146, 60', secondaryRgba: '244, 63, 94',
          motif: 'magma', bmrMult: 1.05, dragMult: 0.95, forceNight: false,
          desc: '第二章【嗜热喷口 · 冥古宙黑烟囱】：海底遍布明灭脉动的地幔熔岩微裂隙与金色硫化余烬气泡，热流使流体阻力 -5%、代谢 +5%，关底首领：晶甲熔岩虱。'
        },
        {
          id: 2, name: '3. 极寒冰隙', era: '新元古代 · 雪球冰川期', sub: '六角冰晶网 · 霜刃水母',
          bgTint: '#031522', bgInner: '#082c42', bgOuter: '#020911', outerRgb: '2, 9, 17', accentRgba: '56, 189, 248', secondaryRgba: '125, 211, 252',
          motif: 'frost', bmrMult: 1.15, dragMult: 1.25, forceNight: false,
          desc: '第三章【极寒冰隙 · 雪球地球期】：百米封冻冰盖下折射出六角冰晶几何裂纹与极光冷流，流体黏阻 +25%，推荐挂载鞭毛或折跃鳍，关底首领：霜刃水母。'
        },
        {
          id: 3, name: '4. 剧毒沼泽', era: '古元古代 · 腐殖酸海盆', sub: '毒沼孢子圈 · 千目母体',
          bgTint: '#06170f', bgInner: '#0f2e1e', bgOuter: '#030b07', outerRgb: '3, 11, 7', accentRgba: '74, 222, 128', secondaryRgba: '168, 85, 247',
          motif: 'miasma', bmrMult: 1.30, dragMult: 1.05, forceNight: false,
          desc: '第四章【剧毒沼泽 · 大氧化腐殖盆地】：海底沉积腐殖磷脂与缓慢鼓泡的酸蚀毒液环，基础代谢能耗 +30%，关底首领：千目原质母体（双槽 FIFO 12s 同化）。'
        },
        {
          id: 4, name: '5. 深渊裂谷', era: '埃迪卡拉 · 超深渊无光带', sub: '永恒黑夜 · 虚空裂变兽',
          bgTint: '#030510', bgInner: '#0a122c', bgOuter: '#010206', outerRgb: '1, 2, 6', accentRgba: '168, 85, 247', secondaryRgba: '45, 212, 191',
          motif: 'abyss', bmrMult: 1.20, dragMult: 1.0, forceNight: true,
          desc: '第五章【深渊裂谷 · 超深渊无光带】：阳光彻底断绝的永恒黑夜，唯生物电脉冲星尘与深渊暗流闪烁，视觉视距缩短 45%，终极首领：虚空噬菌裂变兽。'
        }
      ];

      /* =====================================================================
       * 2. 全量 60 枚模块化果冻软胶 SVG 贴图预加载器
       * ===================================================================== */
      const spriteMap = {
        'env-algae.svg': 'env-algae.svg',
        'env-meat.svg': 'env-meat.svg',
        'env-vent.svg': 'env-vent.svg',
        'boss-ch1-hydra.svg': 'boss-ch1-hydra.svg',
        'boss-ch2-trilobite.svg': 'boss-ch2-trilobite.svg',
        'boss-ch3-jellyfish.svg': 'boss-ch3-jellyfish.svg',
        'boss-ch4-chimera.svg': 'boss-ch4-chimera.svg',
        'boss-ch5-voidphage.svg': 'boss-ch5-voidphage.svg'
      };
      Object.values(TORSOS).forEach((t) => { spriteMap[t.sprite] = t.sprite; });
      Object.values(ORGAN_CATALOG).forEach((series) => {
        [1, 2, 3].forEach((lv) => {
          const sp = series.levels[lv].sprite;
          spriteMap[sp] = sp;
        });
      });
      const SPRITE_IMGS = NexusSDK.loadSprites('micro-genesis', spriteMap);

      /* =====================================================================
       * 3. 物种蓝图数学计算引擎与六重反作弊 Schema 校验器 (05 第 5.1 & 5.4 节)
       * ===================================================================== */
      function sanitizeSpeciesName(rawName) {
        const cleaned = String(rawName || '未命名物种').replace(/[<>"'&\x00-\x1f]/g, '').trim();
        return (cleaned || '未命名物种').slice(0, 12);
      }

      function escapeHtml(rawStr) {
        return String(rawStr ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function clampAiWeight(val) {
        const num = Number(val);
        return Number.isFinite(num) ? Math.min(1.0, Math.max(0.0, num)) : 0.50;
      }

      function validateAndSanitizeBlueprint(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const torsoId = TORSOS[src.torsoId] ? src.torsoId : 'torso-t2-stream';
        const torso = TORSOS[torsoId];
        const rawSlots = src.slots && typeof src.slots === 'object' ? src.slots : {};

        // ① 核心插槽
        let coreId = rawSlots.core && ORGAN_CATALOG[rawSlots.core.id] && ORGAN_CATALOG[rawSlots.core.id].category === 'core'
          ? rawSlots.core.id : 'core-vacuole';
        let coreLv = Math.min(3, Math.max(1, Math.round(Number(rawSlots.core?.level) || 1)));

        function sanitizeSlotArray(arr, cat, maxLen, fallbackId) {
          const list = Array.isArray(arr) ? arr.slice(0, maxLen) : [];
          const out = [];
          list.forEach((item) => {
            if (item && ORGAN_CATALOG[item.id] && ORGAN_CATALOG[item.id].category === cat) {
              const lv = Math.min(3, Math.max(1, Math.round(Number(item.level) || 1)));
              out.push({ id: item.id, level: lv });
            }
          });
          if (out.length === 0 && fallbackId) {
            out.push({ id: fallbackId, level: 1 });
          }
          return out;
        }

        const sensory = sanitizeSlotArray(rawSlots.sensory, 'sensory', torso.slots.sensory, 'sensory-eye');
        const mouth = sanitizeSlotArray(rawSlots.mouth, 'mouth', torso.slots.mouth, 'mouth-omni');
        // ④ 双口部插槽强制同食性校验
        if (mouth.length > 1) {
          mouth[1].id = mouth[0].id;
        }
        const locomotion = sanitizeSlotArray(rawSlots.locomotion, 'locomotion', torso.slots.locomotion, 'loco-flagella');
        const utility = sanitizeSlotArray(rawSlots.utility, 'utility', torso.slots.utility, 'util-scales');

        const rawAi = src.aiWeights && typeof src.aiWeights === 'object' ? src.aiWeights : {};
        const aiWeights = {
          w_aggr: clampAiWeight(rawAi.w_aggr ?? 0.65),
          w_flock: clampAiWeight(rawAi.w_flock ?? 0.50),
          w_flee: clampAiWeight(rawAi.w_flee ?? 0.40),
          w_repro: clampAiWeight(rawAi.w_repro ?? 0.75),
          w_mut: clampAiWeight(rawAi.w_mut ?? 0.25)
        };

        const bp = {
          speciesId: String(src.speciesId || ('sp_' + Date.now() + '_' + Math.floor(Math.random() * 999))),
          origin: src.origin === 'official_fossil' ? 'official_fossil' : 'player',
          speciesName: sanitizeSpeciesName(src.speciesName),
          torsoId,
          slots: {
            core: { id: coreId, level: coreLv },
            sensory,
            mouth,
            locomotion,
            utility
          },
          aiWeights,
          wildEnabled: src.wildEnabled !== false,
          records: {
            maxPopulation: Math.max(1, Math.round(Number(src.records?.maxPopulation) || 1)),
            totalKills: Math.max(0, Math.round(Number(src.records?.totalKills) || 0)),
            longestSurvivalSec: Math.max(0, Math.round(Number(src.records?.longestSurvivalSec) || 0))
          }
        };
        const computed = computeBlueprintStats(bp, false);
        const suppressedComputed = computeBlueprintStats(bp, true);
        bp.dietType = computed.dietType;
        bp.statsSummary = computed.statsSummary;
        bp.suppressedStatsSummary = suppressedComputed.statsSummary;
        return bp;
      }

      function getEffectiveStats(org) {
        if (!org || !org.blueprint) return {};
        const base = (org.suppressedTimer > 0 && org.blueprint.suppressedStatsSummary)
          ? org.blueprint.suppressedStatsSummary
          : org.blueprint.statsSummary;
        if (org.maturity !== undefined && org.maturity < 1.0) {
          const m = Math.max(0, Math.min(1, org.maturity));
          const dmgMult = (base.juvenileMinDmgMult || 0.5) + (1 - (base.juvenileMinDmgMult || 0.5)) * m;
          const armMult = (base.juvenileMinArmorMult || 0.5) + (1 - (base.juvenileMinArmorMult || 0.5)) * m;
          const spdMult = 1.0 + 0.14 * (1 - m);
          const bmrMult = 0.65 + 0.35 * m;
          return {
            ...base,
            biteDmg: Math.max(1, Math.round(base.biteDmg * dmgMult)),
            damageReduction: +(base.damageReduction * armMult).toFixed(3),
            maxSpeed: Math.round(base.maxSpeed * spdMult),
            bmr: +(base.bmr * bmrMult).toFixed(2)
          };
        }
        return base;
      }

      function computeBlueprintStats(bp, forceLv1 = false) {
        const torso = TORSOS[bp.torsoId] || TORSOS['torso-t2-stream'];
        const effLv = (lv) => (forceLv1 ? 1 : lv);
        const coreSpec = ORGAN_CATALOG[bp.slots.core.id].levels[effLv(bp.slots.core.level)];

        let maxHp = torso.baseHp;
        const maxEnergy = Math.round(coreSpec.baseE * Math.pow(torso.volume, 0.6));
        let bmr = torso.bmr + coreSpec.bmr;
        let totalGpCost = torso.transitionGp + coreSpec.gp;

        // 口部插槽合成 (双同系口器 +35% 伤害/吸附半径，能耗 +50%) —— 先确定食性生态位以驱动视觉光学分化
        const firstMouthSeries = ORGAN_CATALOG[bp.slots.mouth[0].id];
        const firstMouthSpec = firstMouthSeries.levels[effLv(bp.slots.mouth[0].level)];
        const dietType = firstMouthSeries.diet;
        const dualMouthMult = bp.slots.mouth.length > 1 ? 1.35 : 1.0;
        const dualMouthCostMult = bp.slots.mouth.length > 1 ? 1.50 : 1.0;
        bp.slots.mouth.forEach((m) => {
          const spec = ORGAN_CATALOG[m.id].levels[effLv(m.level)];
          bmr += spec.bmr;
          totalGpCost += spec.gp;
        });

        // 视觉系统生态位分化法则：
        // 1. 掠食者 (carnivore)：长距离 (1.30x) · 高精度 (coreFocus=0.80, maxBlur=1.5px) · 窄视野 (0.62x 聚焦扇角)
        // 2. 生产者 (herbivore)：中距离 (0.76x) · 低精度 (coreFocus=0.24, maxBlur=6.8px) · 宽视野 (1.68x 广角全景)
        // 3. 杂食者 (omnivore)：中长距离 (1.00x) · 标准精度 (coreFocus=0.50, maxBlur=4.2px) · 标准视野 (1.08x)
        const visionProfile = dietType === 'carnivore' ? 'predator' : (dietType === 'herbivore' ? 'producer' : 'omnivore');
        const dietRangeMult = visionProfile === 'predator' ? 1.30 : (visionProfile === 'producer' ? 0.76 : 1.00);
        const dietAngleMult = visionProfile === 'predator' ? 0.62 : (visionProfile === 'producer' ? 1.68 : 1.08);
        const dietAngleDayCap = visionProfile === 'predator' ? 86 : (visionProfile === 'producer' ? 220 : 148);
        const dietAngleNightCap = visionProfile === 'predator' ? 65 : (visionProfile === 'producer' ? 168 : 112);
        const visionCoreFocus = visionProfile === 'predator' ? 0.80 : (visionProfile === 'producer' ? 0.24 : 0.50);
        const visionBlurMax = visionProfile === 'predator' ? 1.50 : (visionProfile === 'producer' ? 6.80 : 4.20);
        const visionSatMult = visionProfile === 'predator' ? 1.15 : (visionProfile === 'producer' ? 0.85 : 1.00);
        const visionModeLabel = visionProfile === 'predator'
          ? '掠食聚焦 (长距·高精·窄视野)'
          : (visionProfile === 'producer' ? '广角警戒 (中距·低精·宽视野)' : '均衡视觉 (中长距·标精·中视野)');

        // 感官插槽合成
        let eyeOrgans = [];
        let earOrgans = [];
        bp.slots.sensory.forEach((s) => {
          const lv = effLv(s.level);
          const spec = ORGAN_CATALOG[s.id].levels[lv];
          bmr += spec.bmr;
          totalGpCost += spec.gp;
          if (s.id === 'sensory-eye') eyeOrgans.push({ level: lv, ...spec });
          if (s.id === 'sensory-ear') earOrgans.push({ level: lv, ...spec });
        });
        eyeOrgans.sort((a, b) => b.level - a.level);
        earOrgans.sort((a, b) => b.level - a.level);

        let dayEyeRange = 0, nightEyeRange = 0, dayEyeAngle = 0, nightEyeAngle = 0, eyeSat = 0.35, maxEyeLv = 0;
        if (eyeOrgans.length > 0) {
          const mainEye = eyeOrgans[0];
          maxEyeLv = mainEye.level;
          const multRange = (eyeOrgans.length > 1 ? 1.25 : 1.0) * dietRangeMult;
          const multAngle = (eyeOrgans.length > 1 ? 1.15 : 1.0) * dietAngleMult;
          dayEyeRange = Math.round(mainEye.dayRange * multRange);
          nightEyeRange = Math.round(mainEye.nightRange * multRange);
          dayEyeAngle = Math.min(dietAngleDayCap, Math.round(mainEye.dayAngle * multAngle));
          nightEyeAngle = Math.min(dietAngleNightCap, Math.round(mainEye.nightAngle * multAngle));
          eyeSat = +(mainEye.sat * visionSatMult).toFixed(2);
        }

        let sonarRange = 0, sonarPulseSec = 1.40, staticSenseRange = 0, maxEarLv = 0;
        if (earOrgans.length > 0) {
          const mainEar = earOrgans[0];
          maxEarLv = mainEar.level;
          const multRange = earOrgans.length > 1 ? 1.25 : 1.0;
          const multPulse = earOrgans.length > 1 ? 0.80 : 1.0;
          sonarRange = Math.round(mainEar.sonarRange * multRange);
          sonarPulseSec = +(mainEar.pulseSec * multPulse).toFixed(2);
          staticSenseRange = mainEar.staticRange;
        }

        // 运动插槽合成
        let sumThrust = 0;
        let sumTorque = 0;
        let activeSkill = null;
        let hasFin = false;
        let hasJet = false;
        let maxFlagellaLv = 0;
        bp.slots.locomotion.forEach((l) => {
          const lv = effLv(l.level);
          const spec = ORGAN_CATALOG[l.id].levels[lv];
          bmr += spec.bmr;
          totalGpCost += spec.gp;
          sumThrust += spec.thrust;
          sumTorque += spec.torque;
          if (l.id === 'loco-fin') hasFin = true;
          if (l.id === 'loco-jet') hasJet = true;
          if (l.id === 'loco-flagella') maxFlagellaLv = Math.max(maxFlagellaLv, lv);
          if (spec.skill && !activeSkill) {
            activeSkill = { type: spec.skill, organId: l.id, level: lv, sprite: spec.sprite, cost: spec.skillCost, cd: spec.skillCd, spec };
          }
        });

        // 功能插槽合成 (多鳞片乘法叠加硬上限 70%)
        let scaleProd = 1.0;
        let reflectRatio = 0;
        bp.slots.utility.forEach((u) => {
          const lv = effLv(u.level);
          const spec = ORGAN_CATALOG[u.id].levels[lv];
          bmr += spec.bmr;
          totalGpCost += spec.gp;
          if (u.id === 'util-scales') {
            maxHp += spec.bonusHp;
            scaleProd *= (1 - spec.dr);
            reflectRatio = Math.max(reflectRatio, spec.reflect || 0);
          }
          if (spec.skill) {
            activeSkill = { type: spec.skill, organId: u.id, level: lv, sprite: spec.sprite, cost: spec.skillCost, cd: spec.skillCd, spec };
          }
        });
        const damageReduction = Math.min(0.70, +(1 - scaleProd).toFixed(3));
        const maxSpeed = Math.round((45 + sumThrust) * torso.kv);
        const maxTurnRate = +((1.6 + 0.040 * sumTorque) * torso.kw).toFixed(2);
        bmr = +bmr.toFixed(2);

        const dietGrowMult = dietType === 'carnivore' ? 1.35 : (dietType === 'omnivore' ? 1.15 : 1.00);
        const dietFragileMult = dietType === 'carnivore' ? 0.85 : (dietType === 'omnivore' ? 0.92 : 1.00);

        return {
          dietType,
          statsSummary: {
            maxHp,
            maxEnergy,
            bmr,
            moveDrain: torso.moveDrain || 0.25,
            maxSpeed,
            maxTurnRate,
            hasFin,
            hasJet,
            maxFlagellaLv,
            totalGpCost,
            damageReduction,
            reflectRatio,
            digestEff: coreSpec.digestEff,
            regenPerE: coreSpec.regenPerE,
            regenCap: coreSpec.regenCap,
            reproThreshold: torso.reproThreshold || 0.80,
            reproRatio: Math.min(0.92, +(coreSpec.reproRatio + (torso.reproCostAdd || 0)).toFixed(2)),
            childERatio: +(coreSpec.childERatio * (torso.childERatioMult || 1.0)).toFixed(2),
            reproCooldown: torso.reproCooldown || 4.0,
            maxColonyPop: torso.maxColonyPop || 20,
            growDurationSec: +((torso.baseGrowSec || 8.0) * dietGrowMult).toFixed(1),
            juvenileStartScale: +((torso.juvenileStartScale || 0.65) * (dietType === 'carnivore' ? 0.94 : 1.0)).toFixed(2),
            juvenileMinHpMult: +((torso.juvenileMinHpMult || 0.50) * dietFragileMult).toFixed(2),
            juvenileMinDmgMult: +((torso.juvenileMinDmgMult || 0.50) * dietFragileMult).toFixed(2),
            juvenileMinArmorMult: +((torso.juvenileMinArmorMult || 0.50) * dietFragileMult).toFixed(2),
            herbEff: firstMouthSpec.herbEff,
            carnEff: firstMouthSpec.carnEff,
            funnelR: Math.round(firstMouthSpec.funnelR * dualMouthMult),
            biteDmg: Math.round(firstMouthSpec.biteDmg * dualMouthMult),
            biteCost: +(firstMouthSpec.biteCost * dualMouthCostMult).toFixed(1),
            lifesteal: firstMouthSpec.lifesteal,
            absSenseRange: Math.round(92 + torso.sizePx * 0.65),
            visionProfile, visionCoreFocus, visionBlurMax, visionModeLabel,
            dayEyeRange, nightEyeRange, dayEyeAngle, nightEyeAngle, eyeSat, maxEyeLv,
            sonarRange, sonarPulseSec, staticSenseRange, maxEarLv,
            activeSkill
          }
        };
      }


      /* =====================================================================
       * 4. 默认初始基因库、持久化存储与 Base64URL 基因序列码编解码
       * ===================================================================== */
      const DEFAULT_PLAYER_SPECIES = [
        {
          speciesId: 'sp_default_t2_sonar',
          origin: 'player',
          speciesName: '夜行声呐刺猎虫',
          torsoId: 'torso-t2-stream',
          slots: {
            core: { id: 'core-vacuole', level: 2 },
            sensory: [{ id: 'sensory-ear', level: 2 }],
            mouth: [{ id: 'mouth-carn', level: 2 }],
            locomotion: [
              { id: 'loco-flagella', level: 2 },
              { id: 'loco-jet', level: 1 }
            ],
            utility: [
              { id: 'util-spike', level: 2 },
              { id: 'util-ink', level: 1 }
            ]
          },
          aiWeights: { w_aggr: 0.75, w_flock: 0.40, w_flee: 0.35, w_repro: 0.80, w_mut: 0.25 },
          wildEnabled: true,
          records: { maxPopulation: 9, totalKills: 24, longestSurvivalSec: 420 }
        },
        {
          speciesId: 'sp_default_t1_herb',
          origin: 'player',
          speciesName: '疾风滤食原核虫',
          torsoId: 'torso-t1-micro',
          slots: {
            core: { id: 'core-mitosis', level: 1 },
            sensory: [{ id: 'sensory-eye', level: 1 }],
            mouth: [{ id: 'mouth-herb', level: 1 }],
            locomotion: [{ id: 'loco-flagella', level: 1 }],
            utility: [{ id: 'util-scales', level: 1 }]
          },
          aiWeights: { w_aggr: 0.15, w_flock: 0.85, w_flee: 0.80, w_repro: 0.95, w_mut: 0.30 },
          wildEnabled: true,
          records: { maxPopulation: 16, totalKills: 2, longestSurvivalSec: 510 }
        },
        {
          speciesId: 'sp_default_t3_hybrid',
          origin: 'player',
          speciesName: '重装雷暴猎杀鳌',
          torsoId: 'torso-t3-predator',
          slots: {
            core: { id: 'core-vacuole', level: 2 },
            sensory: [
              { id: 'sensory-eye', level: 2 },
              { id: 'sensory-ear', level: 2 }
            ],
            mouth: [{ id: 'mouth-carn', level: 2 }],
            locomotion: [
              { id: 'loco-jet', level: 2 },
              { id: 'loco-fin', level: 2 }
            ],
            utility: [
              { id: 'util-electric', level: 2 },
              { id: 'util-scales', level: 2 },
              { id: 'util-ink', level: 1 }
            ]
          },
          aiWeights: { w_aggr: 0.85, w_flock: 0.45, w_flee: 0.25, w_repro: 0.70, w_mut: 0.20 },
          wildEnabled: true,
          records: { maxPopulation: 7, totalKills: 31, longestSurvivalSec: 390 }
        }
      ];

      const DEFAULT_UNLOCKED_ITEMS = [
        'torso-t1-micro',
        'torso-t2-stream',
        'torso-t3-predator',
        'core-vacuole:1', 'core-vacuole:2',
        'core-mitosis:1',
        'sensory-eye:1', 'sensory-eye:2',
        'sensory-ear:1', 'sensory-ear:2',
        'mouth-herb:1',
        'mouth-carn:1', 'mouth-carn:2',
        'mouth-omni:1',
        'loco-flagella:1', 'loco-flagella:2',
        'loco-fin:1', 'loco-fin:2',
        'loco-jet:1', 'loco-jet:2',
        'util-scales:1', 'util-scales:2',
        'util-spike:1', 'util-spike:2',
        'util-ink:1',
        'util-electric:2'
      ];

      const DEFAULT_ORGAN_INVENTORY = {
        'core-vacuole:1': 3, 'core-vacuole:2': 3,
        'core-mitosis:1': 3,
        'sensory-eye:1': 3, 'sensory-eye:2': 2,
        'sensory-ear:1': 3, 'sensory-ear:2': 3,
        'mouth-herb:1': 3,
        'mouth-carn:1': 3, 'mouth-carn:2': 3,
        'mouth-omni:1': 3,
        'loco-flagella:1': 4, 'loco-flagella:2': 3,
        'loco-fin:1': 3, 'loco-fin:2': 2,
        'loco-jet:1': 2, 'loco-jet:2': 2,
        'util-scales:1': 4, 'util-scales:2': 2,
        'util-spike:1': 3, 'util-spike:2': 2,
        'util-ink:1': 3,
        'util-electric:2': 2
      };

      const gameStorage = NexusSDK.createGameStorage('NEXUS_MINI_MICRO_GENESIS_', () => ({
        version: '3.4.0',
        gpReserve: 480,
        evolutionPoints: 260,
        maxSampleSlots: 3,
        selectedSampleSlotIdx: 0,
        unlockedItems: DEFAULT_UNLOCKED_ITEMS,
        organInventory: DEFAULT_ORGAN_INVENTORY,
        geneBank: DEFAULT_PLAYER_SPECIES.map(validateAndSanitizeBlueprint)
      }));
      let savedData = gameStorage.load() || {};
      let playerGeneBank = Array.isArray(savedData.geneBank) && savedData.geneBank.length > 0
        ? savedData.geneBank.map(validateAndSanitizeBlueprint)
        : DEFAULT_PLAYER_SPECIES.map(validateAndSanitizeBlueprint);
      let officialFossils = OFFICIAL_FOSSILS.map(validateAndSanitizeBlueprint);
      function sanitizeOrganInventory(rawInv) {
        const clean = { ...DEFAULT_ORGAN_INVENTORY };
        if (rawInv && typeof rawInv === 'object') {
          Object.keys(rawInv).forEach((k) => {
            const v = Number(rawInv[k]);
            if (Number.isFinite(v)) {
              clean[k] = Math.max(0, Math.min(99, Math.round(v)));
            }
          });
        }
        return clean;
      }

      let globalGpReserve = Number.isFinite(savedData.gpReserve) ? Math.max(0, Math.min(999999, Math.round(savedData.gpReserve))) : 480;
      let evolutionPoints = Number.isFinite(savedData.evolutionPoints) ? Math.max(0, Math.min(999999, Math.round(savedData.evolutionPoints))) : 260;
      let maxSampleSlots = Number.isFinite(savedData.maxSampleSlots) ? Math.max(3, Math.min(6, Math.round(savedData.maxSampleSlots))) : 3;
      let selectedSampleSlotIdx = Number.isFinite(savedData.selectedSampleSlotIdx)
        ? Math.max(0, Math.min(maxSampleSlots - 1, Math.round(savedData.selectedSampleSlotIdx)))
        : 0;
      let unlockedItems = new Set(Array.isArray(savedData.unlockedItems) && savedData.unlockedItems.length > 0 ? savedData.unlockedItems.filter((x) => typeof x === 'string') : DEFAULT_UNLOCKED_ITEMS);
      DEFAULT_UNLOCKED_ITEMS.forEach((item) => unlockedItems.add(item));
      let organInventory = sanitizeOrganInventory(savedData.organInventory);

      // 确保客户储存样本槽数量对齐 maxSampleSlots (初始 3 槽，可用进化点扩充至最多 6 槽)
      function ensureCustomerSampleSlots() {
        while (playerGeneBank.length < maxSampleSlots) {
          const templateIdx = playerGeneBank.length % DEFAULT_PLAYER_SPECIES.length;
          const cloned = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(DEFAULT_PLAYER_SPECIES[templateIdx])));
          cloned.speciesId = 'sp_slot_' + (playerGeneBank.length + 1) + '_' + Date.now();
          cloned.speciesName = sanitizeSpeciesName(`样本${playerGeneBank.length + 1}·${cloned.speciesName}`);
          playerGeneBank.push(cloned);
        }
        if (selectedSampleSlotIdx >= maxSampleSlots) {
          selectedSampleSlotIdx = 0;
        }
      }
      ensureCustomerSampleSlots();

      function getOrganKey(organId, level) {
        return `${organId}:${level}`;
      }
      function isTorsoUnlocked(torsoId) {
        return unlockedItems.has(torsoId) || torsoId === 'torso-t1-micro';
      }
      function isOrganUnlocked(organId, level) {
        return unlockedItems.has(getOrganKey(organId, level));
      }
      function getOwnedOrganCount(organId, level) {
        const v = Number(organInventory[getOrganKey(organId, level)] || 0);
        return Number.isFinite(v) ? Math.max(0, Math.min(99, Math.round(v))) : 0;
      }
      function countBlueprintOrganUsage(bp, organId, level, excludeSlotObj = null) {
        if (!bp || !bp.slots) return 0;
        let used = 0;
        const allSlots = [
          bp.slots.core,
          ...(bp.slots.sensory || []),
          ...(bp.slots.mouth || []),
          ...(bp.slots.locomotion || []),
          ...(bp.slots.utility || [])
        ];
        allSlots.forEach((s) => {
          if (!s || s === excludeSlotObj) return;
          if (s.id === organId && Number(s.level) === Number(level)) {
            used += 1;
          }
        });
        return used;
      }

      // 强制校验客户样本蓝图中的躯干与器官是否已解锁且拥有足够库存副本（防止通过化石克隆或基因码导入白嫖未解锁/未购买的高阶躯干与器官）
      function enforceOwnedBlueprintConstraints(bp, notifyOnDowngrade = false) {
        const clean = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(bp || {})));
        let downgradedCount = 0;

        if (!isTorsoUnlocked(clean.torsoId)) {
          const fallbackOrder = ['torso-t3-predator', 'torso-t2-stream', 'torso-t1-micro'];
          clean.torsoId = fallbackOrder.find((tid) => isTorsoUnlocked(tid)) || 'torso-t1-micro';
          downgradedCount += 1;
        }

        const fallbackByCat = {
          core: { id: 'core-vacuole', level: 1 },
          sensory: { id: 'sensory-eye', level: 1 },
          mouth: { id: 'mouth-omni', level: 1 },
          locomotion: { id: 'loco-flagella', level: 1 },
          utility: { id: 'util-scales', level: 1 }
        };
        const usedMap = {};

        function coerceSlot(slotObj, catKey) {
          if (!slotObj) return;
          const tryCandidates = [
            { id: slotObj.id, level: Number(slotObj.level) || 1 },
            { id: slotObj.id, level: 2 },
            { id: slotObj.id, level: 1 },
            fallbackByCat[catKey]
          ];
          for (let i = 0; i < tryCandidates.length; i++) {
            const cand = tryCandidates[i];
            if (!cand || !ORGAN_CATALOG[cand.id]) continue;
            const key = getOrganKey(cand.id, cand.level);
            const usedSoFar = usedMap[key] || 0;
            const owned = getOwnedOrganCount(cand.id, cand.level);
            if (isOrganUnlocked(cand.id, cand.level) && owned >= usedSoFar + 1) {
              if (cand.id !== slotObj.id || cand.level !== Number(slotObj.level)) {
                downgradedCount += 1;
              }
              slotObj.id = cand.id;
              slotObj.level = cand.level;
              usedMap[key] = usedSoFar + 1;
              return;
            }
          }
          const fb = fallbackByCat[catKey];
          if (slotObj.id !== fb.id || Number(slotObj.level) !== fb.level) {
            downgradedCount += 1;
          }
          slotObj.id = fb.id;
          slotObj.level = fb.level;
          const fbKey = getOrganKey(fb.id, fb.level);
          usedMap[fbKey] = (usedMap[fbKey] || 0) + 1;
        }

        coerceSlot(clean.slots.core, 'core');
        (clean.slots.sensory || []).forEach((s) => coerceSlot(s, 'sensory'));
        (clean.slots.mouth || []).forEach((m) => coerceSlot(m, 'mouth'));
        (clean.slots.locomotion || []).forEach((l) => coerceSlot(l, 'locomotion'));
        (clean.slots.utility || []).forEach((u) => coerceSlot(u, 'utility'));

        const finalBp = validateAndSanitizeBlueprint(clean);
        if (notifyOnDowngrade && downgradedCount > 0 && typeof showToast === 'function') {
          showToast(`已自动将 ${downgradedCount} 处未解锁/库存不足的高阶部件降级为已拥有的基础部件`);
        }
        return finalBp;
      }
      function getTorsoUnlockCostEp(torsoId) {
        if (torsoId === 'torso-t1-micro') return 0;
        if (torsoId === 'torso-t2-stream') return 50;
        if (torsoId === 'torso-t3-predator') return 95;
        return 160;
      }
      function getOrganUnlockCostEp(organId, level) {
        const gp = ORGAN_CATALOG[organId]?.levels?.[level]?.gp || (level * 50);
        return Math.max(25, Math.round(gp * 0.42));
      }
      function getOrganBuyCostEp(organId, level) {
        const gp = ORGAN_CATALOG[organId]?.levels?.[level]?.gp || (level * 40);
        return Math.max(15, Math.round(gp * 0.28));
      }
      function getNextSampleSlotCostEp() {
        if (maxSampleSlots >= 6) return 0;
        const costs = { 3: 120, 4: 180, 5: 260 };
        return costs[maxSampleSlots] || 200;
      }

      // 计算单个蓝图或存活个体的【营养物质总量 (Nutrient Biomass)】
      function computeBlueprintBaseNutrients(bp) {
        if (!bp || !bp.statsSummary) return 80;
        const torso = TORSOS[bp.torsoId] || TORSOS['torso-t1-micro'];
        const st = bp.statsSummary;
        return Math.round(32 * Math.pow(torso.volume, 0.80) + st.maxEnergy * 0.85 + st.maxHp * 0.35 + st.totalGpCost * 0.08);
      }

      function computeOrganismNutrients(org) {
        if (!org || org.hp <= 0 || !org.blueprint) return 0;
        const torso = TORSOS[org.blueprint.torsoId] || TORSOS['torso-t1-micro'];
        const g = org.growthScale !== undefined ? org.growthScale : 1.0;
        const gpVal = org.blueprint.statsSummary?.totalGpCost || 120;
        return Math.max(10, Math.round(
          32 * Math.pow(torso.volume, 0.80) * g +
          Math.max(0, org.energy) +
          Math.max(0, org.hp) * 0.35 +
          gpVal * 0.08 * g
        ));
      }

      function syncEvolutionPointsUI() {
        const navEpEl = document.getElementById('nav-ep-text');
        if (navEpEl) navEpEl.textContent = `进化点: ${evolutionPoints} EP`;
        const edEpEl = document.getElementById('editor-ep-balance-lbl');
        if (edEpEl) edEpEl.textContent = `进化点: ${evolutionPoints} EP`;
        const slotCountLbl = document.getElementById('editor-slot-count-lbl');
        if (slotCountLbl) slotCountLbl.textContent = `${maxSampleSlots} / 6 槽`;
        const nextSlotCost = getNextSampleSlotCostEp();
        ['workshop-buy-slot-btn', 'editor-buy-slot-inline-btn'].forEach((btnId) => {
          const btn = document.getElementById(btnId);
          if (!btn) return;
          if (maxSampleSlots >= 6) {
            btn.textContent = '样本槽已满 (6/6)';
            btn.disabled = true;
          } else {
            btn.textContent = `+ 购买样本槽位 (${nextSlotCost} EP)`;
            btn.disabled = false;
          }
        });
      }

      function persistState() {
        ensureCustomerSampleSlots();
        gameStorage.save({
          version: '3.4.0',
          gpReserve: globalGpReserve,
          evolutionPoints,
          maxSampleSlots,
          selectedSampleSlotIdx,
          unlockedItems: Array.from(unlockedItems),
          organInventory,
          geneBank: playerGeneBank
        });
        syncEvolutionPointsUI();
      }

      function encodeGeneCode(bp) {
        try {
          const compact = {
            n: bp.speciesName,
            t: bp.torsoId,
            s: bp.slots,
            w: bp.aiWeights
          };
          const json = JSON.stringify(compact);
          const b64 = btoa(unescape(encodeURIComponent(json)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          return 'MG3_' + b64;
        } catch (_e) {
          return 'MG3_INVALID';
        }
      }

      function decodeGeneCode(codeStr) {
        try {
          const raw = String(codeStr || '').trim();
          const payload = raw.startsWith('MG3_') ? raw.slice(4) : raw;
          const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
          const json = decodeURIComponent(escape(atob(b64)));
          const parsed = JSON.parse(json);
          return validateAndSanitizeBlueprint({
            speciesName: parsed.n || parsed.speciesName,
            torsoId: parsed.t || parsed.torsoId,
            slots: parsed.s || parsed.slots,
            aiWeights: parsed.w || parsed.aiWeights
          });
        } catch (_e) {
          return null;
        }
      }

      let toastTimer = null;
      function showToast(msg) {
        const el = document.getElementById('mg-toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
      }

      /* =====================================================================
       * 5. 多节连续贝塞尔有机体节包络 + 多层 SVG 器官贴图合成渲染器
       * ===================================================================== */
      function drawSpriteCentered(ctx, spriteKey, x, y, drawW, drawH, rotRad, alpha) {
        const img = SPRITE_IMGS[spriteKey];
        if (!img || !img.complete || !img.naturalWidth) return;
        ctx.save();
        ctx.translate(x, y);
        if (rotRad) ctx.rotate(rotRad);
        if (alpha !== undefined) ctx.globalAlpha *= alpha;
        ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
        ctx.restore();
      }

      // 听觉声呐色彩分类法则：同类 = 绿色 (#10b981, 16,185,129)，食物/可捕食猎物 = 黄色 (#fbbf24, 251,191,36)，危险/敌害 = 红色 (#ef4444, 239,68,68)
      function classifySonarRelation(org, observer) {
        const ref = observer || (typeof arenaState !== 'undefined' ? arenaState.alpha : null);
        if (!org) return 'danger';
        if (
          org === ref ||
          org.faction === 'player' ||
          (ref && org.colonyId && org.colonyId === ref.colonyId) ||
          (ref && org.blueprint?.speciesId && org.blueprint.speciesId === ref.blueprint?.speciesId)
        ) {
          return 'kin'; // 同类：绿色
        }
        // 若非 Boss 且为体型不大于玩家的可捕食草食猎物（当玩家为肉食/杂食时视作活体食物）
        const refDiet = ref?.blueprint?.dietType || 'omnivore';
        if (!org.isBoss && org.blueprint?.dietType === 'herbivore' && (refDiet === 'carnivore' || refDiet === 'omnivore') && (org.radius || 16) <= (ref?.radius || 18) * 1.05) {
          return 'food'; // 食物：黄色
        }
        return 'danger'; // 危险：红色
      }

      function getSonarPalette(relation, alpha = 0.92) {
        if (relation === 'kin') {
          return {
            fill: `rgba(6, 56, 38, ${0.86 * alpha})`,
            stroke: `rgba(16, 185, 129, ${alpha})`,
            core: `rgba(52, 211, 153, ${alpha * 0.96})`,
            sub: `rgba(16, 185, 129, ${alpha * 0.72})`,
            filter: 'sepia(100%) saturate(380%) hue-rotate(95deg) brightness(115%) contrast(130%)',
            hex: '#10b981'
          };
        }
        if (relation === 'food') {
          return {
            fill: `rgba(56, 40, 6, ${0.86 * alpha})`,
            stroke: `rgba(251, 191, 36, ${alpha})`,
            core: `rgba(253, 224, 71, ${alpha * 0.96})`,
            sub: `rgba(251, 191, 36, ${alpha * 0.72})`,
            filter: 'sepia(100%) saturate(420%) hue-rotate(8deg) brightness(128%) contrast(130%)',
            hex: '#fbbf24'
          };
        }
        return {
          fill: `rgba(62, 10, 16, ${0.88 * alpha})`,
          stroke: `rgba(239, 68, 68, ${alpha})`,
          core: `rgba(248, 113, 113, ${alpha * 0.96})`,
          sub: `rgba(239, 68, 68, ${alpha * 0.72})`,
          filter: 'sepia(100%) saturate(460%) hue-rotate(315deg) brightness(112%) contrast(135%)',
          hex: '#ef4444'
        };
      }

      function drawOrganism(ctx, org, opts = {}) {
        const bp = org.blueprint;
        const torso = TORSOS[bp.torsoId] || TORSOS['torso-t2-stream'];
        const isSonar = Boolean(opts.sonarWireframe);
        const phase = opts.freezePhase !== undefined
          ? opts.freezePhase
          : ((opts.timeSec || 0) * 6.5 + (org.phaseOffset || 0));
        const maturityScale = (org.growthScale && org.growthScale > 0) ? org.growthScale : 1.0;
        const scale = (opts.scale || 1.0) * maturityScale;
        const baseR = (torso.sizePx * 0.44) * scale;
        const segMultipliers = torso.segments || [1.0];
        const segCount = segMultipliers.length;
        const segSpacing = baseR * 0.68;

        ctx.save();
        ctx.translate(org.x, org.y);
        ctx.rotate(org.angle || 0);

        // 碰撞受压弹性微形变
        if (org.squashTimer && org.squashTimer > 0) {
          ctx.scale(1.12, 0.88);
        }

        // 计算脊椎节点坐标 (从头节 i=0 到尾节 i=segCount-1)
        const spine = [];
        const totalHalfLen = ((segCount - 1) * segSpacing) * 0.5;
        for (let i = 0; i < segCount; i++) {
          const sx = totalHalfLen - i * segSpacing;
          const wag = i === 0 ? 0 : Math.sin(phase - i * 0.85) * (baseR * 0.12 * (i / segCount));
          spine.push({
            x: sx,
            y: wag,
            r: baseR * segMultipliers[i]
          });
        }

        // ① 绘制连续双切线二次贝塞尔有机包络胶膜
        ctx.beginPath();
        const head = spine[0];
        const tail = spine[spine.length - 1];
        ctx.arc(head.x, head.y, head.r, -Math.PI * 0.48, Math.PI * 0.48, false);
        for (let i = 0; i < spine.length - 1; i++) {
          const c = spine[i];
          const n = spine[i + 1];
          const midX = (c.x + n.x) * 0.5;
          const midY = (c.y + c.r + n.y + n.r) * 0.5;
          ctx.quadraticCurveTo(c.x, c.y + c.r, midX, midY);
        }
        ctx.arc(tail.x, tail.y, tail.r, Math.PI * 0.52, Math.PI * 1.48, false);
        for (let i = spine.length - 1; i > 0; i--) {
          const c = spine[i];
          const p = spine[i - 1];
          const midX = (c.x + p.x) * 0.5;
          const midY = (c.y - c.r + p.y - p.r) * 0.5;
          ctx.quadraticCurveTo(c.x, c.y - c.r, midX, midY);
        }
        ctx.closePath();

        if (isSonar) {
          // 听觉 360° 声呐雷达定格视图：危险=红色 (#ef4444)，食物=黄色 (#fbbf24)，同类=绿色 (#10b981)
          const pulseAlpha = opts.sonarAlpha !== undefined ? opts.sonarAlpha : 0.92;
          const relation = opts.sonarRelation || classifySonarRelation(org, opts.observer);
          const pal = getSonarPalette(relation, pulseAlpha);
          ctx.fillStyle = pal.fill;
          ctx.fill();
          ctx.lineWidth = 1.9 * scale;
          ctx.strokeStyle = pal.stroke;
          ctx.stroke();

          // 声呐内部脊椎回波环与器官几何线框
          spine.forEach((pt, idx) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r * 0.62, 0, Math.PI * 2);
            ctx.lineWidth = 1.0 * scale;
            ctx.strokeStyle = idx === 0 ? pal.core : pal.sub;
            ctx.stroke();
          });

          // 头部口器与尾部推进器声呐矢量轮廓
          ctx.beginPath();
          ctx.moveTo(head.x + head.r * 0.85, head.y - head.r * 0.35);
          ctx.lineTo(head.x + head.r * 1.38, head.y);
          ctx.lineTo(head.x + head.r * 0.85, head.y + head.r * 0.35);
          ctx.moveTo(tail.x - tail.r * 0.8, tail.y);
          ctx.lineTo(tail.x - tail.r * 1.55, tail.y + Math.sin(phase * 1.6) * (tail.r * 0.45));
          ctx.strokeStyle = pal.core;
          ctx.stroke();

          // 叠加分类色彩声呐滤镜渲染全部定格躯体与模块化器官 SVG 贴图
          ctx.save();
          ctx.filter = pal.filter;
          ctx.globalAlpha *= pulseAlpha * 0.88;
          renderModularTorsoAndOrgans(ctx, org, bp, torso, spine, head, tail, totalHalfLen, baseR, scale, phase);
          ctx.restore();
          if (org.spawnShieldTimer && org.spawnShieldTimer > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, baseR * 1.85, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.92)';
            ctx.lineWidth = 2.0 * scale;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
          return;
        }

        // 5.0 秒【破膜适应期】初生羊水护膜光环
        if (org.spawnShieldTimer && org.spawnShieldTimer > 0) {
          const pulseR = baseR * (1.78 + 0.12 * Math.sin((opts.timeSec || 0) * 8.0));
          ctx.beginPath();
          ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.88)';
          ctx.lineWidth = 1.8 * scale;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 视觉彩色模式：Chroma-Muse [范式C: 高对比果冻软胶 STYLE-30×11] + [纯粹躯体底盘与独立模块化器官插槽组装] + [材质D: 生物荧光叶脉神经网与栉水母薄膜虹彩 STYLE-23×96]
        let coreHex = '#2dd4bf';
        let subHex = '#0d9488';
        let veinHex = '#5eead4';
        if (org.faction === 'enemy' || org.faction === 'wild') {
          if (bp.dietType === 'herbivore') {
            coreHex = '#10b981';
            subHex = '#047857';
            veinHex = '#6ee7b7';
          } else if (bp.dietType === 'carnivore') {
            coreHex = '#fb7185';
            subHex = '#be123c';
            veinHex = '#fda4af';
          } else {
            coreHex = '#fbbf24';
            subHex = '#b45309';
            veinHex = '#fde047';
          }
        }
        if (org.isBoss) {
          coreHex = '#c084fc';
          subHex = '#6b21a8';
          veinHex = '#fde047';
        }
        if (org.mimicTimer > 0) {
          ctx.globalAlpha *= 0.48;
        }

        // 1.1 绘制果冻软胶次表面散射躯体包络胶膜 (STYLE-11 Hydro-Jelly SSS) + 栉水母薄膜虹彩边缘 (STYLE-96 Comb-Jelly Iridescence)
        const jellyGrad = ctx.createRadialGradient(head.x * 0.25, -baseR * 0.25, baseR * 0.1, 0, 0, totalHalfLen + baseR * 1.2);
        jellyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
        jellyGrad.addColorStop(0.38, coreHex + '3d');
        jellyGrad.addColorStop(0.82, subHex + '4d');
        jellyGrad.addColorStop(1, 'rgba(4, 31, 36, 0.65)');
        ctx.fillStyle = jellyGrad;
        ctx.fill();

        const iridGrad = ctx.createLinearGradient(-totalHalfLen - baseR, -baseR, totalHalfLen + baseR, baseR);
        iridGrad.addColorStop(0, '#2dd4bf');
        iridGrad.addColorStop(0.28, '#38bdf8');
        iridGrad.addColorStop(0.55, '#c084fc');
        iridGrad.addColorStop(0.78, '#f472b6');
        iridGrad.addColorStop(1, '#34d399');
        ctx.lineWidth = (org.isAlpha ? 2.2 : 1.55) * scale;
        ctx.strokeStyle = iridGrad;
        ctx.stroke();

        // 1.2 绘制纯粹躯体底盘与 5 大类自由搭配模块化器官 SVG 插槽合成
        renderModularTorsoAndOrgans(ctx, org, bp, torso, spine, head, tail, totalHalfLen, baseR, scale, phase);

        // 1.3 绘制脊椎动态 L-System 生物荧光神经脉冲与水润腰果高光斑
        ctx.save();
        ctx.strokeStyle = veinHex;
        ctx.lineWidth = 0.95 * scale;
        ctx.globalAlpha *= 0.68 + 0.20 * Math.sin(phase * 1.6);
        ctx.beginPath();
        for (let i = 0; i < spine.length; i++) {
          const pt = spine[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();

        // 同族电脑 NPC 细微光环标记与幼体发育进度环 (Juvenile Ontogeny Ring)
        if (org.maturity !== undefined && org.maturity < 1.0) {
          ctx.beginPath();
          ctx.arc(0, 0, baseR * 1.58, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * Math.max(0.05, org.maturity));
          ctx.strokeStyle = org.faction === 'player' ? 'rgba(56, 189, 248, 0.85)' : 'rgba(251, 191, 36, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (org.faction === 'player' && !org.isAlpha && !org.formerKin) {
          ctx.beginPath();
          ctx.arc(0, 0, baseR * 1.45, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.34)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
          for (let v = 0; v < 4; v++) {
            const vAng = (v / 4) * Math.PI * 2 + phase * 0.25;
            ctx.beginPath();
            ctx.arc(Math.cos(vAng) * baseR * 1.45, Math.sin(vAng) * baseR * 1.45, 1.8 * scale, 0, Math.PI * 2);
            ctx.fillStyle = v % 2 === 0 ? '#5eead4' : '#c084fc';
            ctx.fill();
          }
        }
        ctx.restore();
      }

      /* 模块化躯体底盘与独立器官插槽自由拼装渲染器 (Torso Chassis + Separated Organ Sockets) */
      function renderModularTorsoAndOrgans(ctx, org, bp, torso, spine, head, tail, totalHalfLen, baseR, scale, phase) {
        // ① 运动器官插槽 (Locomotion —— 底层接驳：侧鳍对称挂载于胸侧翼插槽，鞭毛/喷水囊挂载于尾端推进插槽)
        const locoList = bp.slots.locomotion || [];
        let finSlotIdx = 0;
        const axialLocos = [];
        locoList.forEach((loco, idx) => {
          const lLv = org.suppressedTimer > 0 ? 1 : loco.level;
          const spec = ORGAN_CATALOG[loco.id].levels[lLv];
          if (loco.id === 'loco-fin') {
            // 矢量转向侧鳍：成对挂载于躯体左右胸侧插槽，随游动对称拍水
            const segIdx = Math.min(spine.length - 1, Math.max(0, 1 + finSlotIdx));
            const seg = spine[segIdx] || head;
            const flap = Math.sin(phase * 1.6 + finSlotIdx * 1.1) * 0.24;
            const finSize = baseR * (1.62 - finSlotIdx * 0.16);
            // 左侧鳍 (side = -1, 指向左后外侧) & 右侧鳍 (side = +1, 指向右后外侧)
            drawSpriteCentered(ctx, spec.sprite, seg.x - baseR * 0.06, seg.y - seg.r * 1.18, finSize, finSize, Math.PI - 0.52 + flap);
            drawSpriteCentered(ctx, spec.sprite, seg.x - baseR * 0.06, seg.y + seg.r * 1.18, finSize, finSize, 0.52 - flap);
            finSlotIdx++;
          } else {
            axialLocos.push({ loco, spec, idx });
          }
        });
        axialLocos.forEach((item, aIdx) => {
          const wagRot = Math.sin(phase * 1.65 + aIdx * 0.9) * 0.22;
          const thrusterSize = baseR * 1.68;
          if (axialLocos.length === 1) {
            // 单推进器：接驳于尾节正后方尾椎插槽 (SVG 顶部基座朝向 +X 躯体，鞭毛/喷流朝向 -X 后方)
            drawSpriteCentered(ctx, item.spec.sprite, tail.x - tail.r * 1.28, tail.y, thrusterSize, thrusterSize, Math.PI * 0.5 + wagRot);
          } else if (axialLocos.length === 2) {
            const side = aIdx === 0 ? -1 : 1;
            drawSpriteCentered(ctx, item.spec.sprite, tail.x - tail.r * 1.12, tail.y + side * tail.r * 0.68, thrusterSize * 0.92, thrusterSize * 0.92, Math.PI * 0.5 - side * 0.28 + wagRot);
          } else {
            const offsetMode = aIdx === 0 ? 0 : (aIdx === 1 ? -1 : 1);
            const tx = tail.x - tail.r * (offsetMode === 0 ? 1.32 : 1.02);
            const ty = tail.y + offsetMode * tail.r * 0.76;
            drawSpriteCentered(ctx, item.spec.sprite, tx, ty, thrusterSize * 0.88, thrusterSize * 0.88, Math.PI * 0.5 - offsetMode * 0.34 + wagRot);
          }
        });

        // ② 纯粹果冻软胶躯体底盘 (Pure Torso Chassis —— 不含预烘焙眼/鳍/核，全长自适应覆盖头尾脊椎)
        const bodyLenX = (totalHalfLen * 2 + head.r + tail.r) * 1.16;
        const bodyWidY = baseR * 2.32;
        drawSpriteCentered(ctx, torso.sprite, 0, 0, bodyWidY, bodyLenX, Math.PI * 0.5);
        if (org.isBoss) {
          const bossSprites = ['boss-ch1-hydra.svg', 'boss-ch2-trilobite.svg', 'boss-ch3-jellyfish.svg', 'boss-ch4-chimera.svg', 'boss-ch5-voidphage.svg'];
          const bSprite = bossSprites[Math.min(4, Math.max(0, selectedBiomeId || 0))];
          drawSpriteCentered(ctx, bSprite, 0, 0, bodyWidY * 1.12, bodyLenX * 1.08, Math.PI * 0.5, 0.72);
        }

        // ③ 体内核心器官插槽 (Core —— 精准嵌入躯体中央透明内脏腔凹槽，随代谢呼吸脉动)
        const coreLv = org.suppressedTimer > 0 ? 1 : bp.slots.core.level;
        const coreSpec = ORGAN_CATALOG[bp.slots.core.id].levels[coreLv];
        const pulseScale = 0.94 + 0.10 * Math.sin(phase * 0.9);
        const coreNode = spine[Math.min(spine.length - 1, Math.floor(spine.length * 0.42))];
        drawSpriteCentered(ctx, coreSpec.sprite, coreNode.x, coreNode.y, baseR * 1.24 * pulseScale, baseR * 1.24 * pulseScale, Math.PI * 0.5);

        // ④ 躯体中后段背侧/侧翼功能器官插槽 (Utility + 第四章首领双槽 FIFO 同化器官 —— 避开头节感官区，沿胸腹体节插槽专属分布)
        const utilList = [...(bp.slots.utility || []), ...((org.assimilatedOrgans || []).map((a) => ({ id: a.id, level: a.level })))];
        utilList.forEach((u, idx) => {
          const uLv = org.suppressedTimer > 0 ? 1 : u.level;
          const spec = ORGAN_CATALOG[u.id].levels[uLv];
          const uSize = baseR * 1.18;
          if (utilList.length === 1) {
            const midSeg = spine[Math.min(spine.length - 1, Math.floor(spine.length * 0.5))];
            drawSpriteCentered(ctx, spec.sprite, midSeg.x - baseR * 0.12, midSeg.y - midSeg.r * 1.04, uSize, uSize, -0.22);
            drawSpriteCentered(ctx, spec.sprite, midSeg.x - baseR * 0.12, midSeg.y + midSeg.r * 1.04, uSize, uSize, Math.PI + 0.22);
          } else {
            const side = idx % 2 === 0 ? -1 : 1;
            const pairRow = Math.floor(idx / 2);
            const totalRows = Math.max(1, Math.ceil(utilList.length / 2));
            // 严格锚定于头节后方的胸腹体节 (segIdx >= 1)，绝不与头部眼/耳重叠
            const minSeg = spine.length > 1 ? 1 : 0;
            const segIdx = Math.min(spine.length - 1, minSeg + Math.floor((pairRow * (spine.length - minSeg)) / totalRows));
            const seg = spine[segIdx];
            const xShift = spine.length === 1 ? (-baseR * 0.22 * (pairRow + 1)) : (-baseR * 0.08);
            const rotOut = side < 0 ? (-0.22 - pairRow * 0.12) : (Math.PI + 0.22 + pairRow * 0.12);
            drawSpriteCentered(ctx, spec.sprite, seg.x + xShift, seg.y + side * seg.r * 1.06, uSize, uSize, rotOut);
          }
        });

        // ⑤ 头节前端吃食口器插槽 (Mouth —— 接驳于头端吻部凹槽，尖端朝向正前方 +X)
        const mouthList = bp.slots.mouth || [];
        const bitePulse = 1.0 + 0.06 * Math.sin(phase * 2.2);
        mouthList.forEach((m, idx) => {
          const mLv = org.suppressedTimer > 0 ? 1 : m.level;
          const spec = ORGAN_CATALOG[m.id].levels[mLv];
          const mSize = baseR * 1.56 * bitePulse;
          if (mouthList.length === 1) {
            drawSpriteCentered(ctx, spec.sprite, head.x + head.r * 1.08, head.y, mSize, mSize, Math.PI * 0.5);
          } else {
            const side = idx === 0 ? -1 : 1;
            drawSpriteCentered(ctx, spec.sprite, head.x + head.r * 0.98, head.y + side * head.r * 0.52, mSize * 0.92, mSize * 0.92, Math.PI * 0.5 + side * 0.24);
          }
        });

        // ⑥ 头节前侧感官器官插槽 (Sensory: 视觉眼/听觉耳 —— 镶嵌于头节眼眶/听囊凹槽，朝向正前外侧)
        const senseList = bp.slots.sensory || [];
        senseList.forEach((s, idx) => {
          const sLv = org.suppressedTimer > 0 ? 1 : s.level;
          const spec = ORGAN_CATALOG[s.id].levels[sLv];
          const sSize = baseR * (idx === 0 ? 1.05 : 0.94);
          const fwdOffset = idx === 0 ? head.r * 0.46 : -head.r * 0.04;
          const latOffset = idx === 0 ? head.r * 0.68 : head.r * 0.92;
          const splayAng = idx === 0 ? 0.28 : 0.56;
          drawSpriteCentered(ctx, spec.sprite, head.x + fwdOffset, head.y - latOffset, sSize, sSize, Math.PI * 0.5 - splayAng);
          drawSpriteCentered(ctx, spec.sprite, head.x + fwdOffset, head.y + latOffset, sSize, sSize, Math.PI * 0.5 + splayAng);
        });
      }

      /* =====================================================================
       * 6. 页面导航与局外样本工坊控制器 (进入房间直达 #page-arena，仅局外可打开 #page-editor)
       * ===================================================================== */
      let currentActivePage = 'arena';
      let selectedGbSpeciesId = playerGeneBank[0]?.speciesId || '';
      let selectedFossilSpeciesId = officialFossils[0]?.speciesId || '';
      let editorDraft = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(playerGeneBank[selectedSampleSlotIdx] || playerGeneBank[0])));
      let editorPreviewIsNight = false;
      let selectedLobbySpeciesId = playerGeneBank[selectedSampleSlotIdx]?.speciesId || playerGeneBank[0]?.speciesId || '';
      let selectedBiomeId = 0;

      // 局外进化点操作：购买样本槽位、解锁躯干、解锁器官、购买器官库存
      function buySampleSlotWithEp() {
        if (maxSampleSlots >= 6) {
          showToast('客户样本槽已达上限 (6 / 6 槽)！');
          return false;
        }
        const cost = getNextSampleSlotCostEp();
        if (evolutionPoints < cost) {
          NexusSDK.audio.warn();
          showToast(`进化点不足！购买第 ${maxSampleSlots + 1} 号样本槽位需 ${cost} EP（当前 ${evolutionPoints} EP）`);
          return false;
        }
        evolutionPoints -= cost;
        maxSampleSlots += 1;
        ensureCustomerSampleSlots();
        selectedSampleSlotIdx = maxSampleSlots - 1;
        editorDraft = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(playerGeneBank[selectedSampleSlotIdx])));
        persistState();
        NexusSDK.audio.upgrade();
        showToast(`成功消耗 ${cost} EP 购买样本槽位 #${maxSampleSlots}！`);
        if (currentActivePage === 'editor') renderEditorPage();
        renderArenaSampleSwitcher();
        return true;
      }

      function unlockTorsoWithEp(torsoId) {
        if (isTorsoUnlocked(torsoId)) return true;
        const cost = getTorsoUnlockCostEp(torsoId);
        if (evolutionPoints < cost) {
          NexusSDK.audio.warn();
          showToast(`进化点不足！解锁躯干【${TORSOS[torsoId]?.shortName || torsoId}】需 ${cost} EP（当前 ${evolutionPoints} EP）`);
          return false;
        }
        evolutionPoints -= cost;
        unlockedItems.add(torsoId);
        persistState();
        NexusSDK.audio.upgrade();
        showToast(`已消耗 ${cost} EP 解锁躯干底盘：【${TORSOS[torsoId]?.name || torsoId}】！`);
        return true;
      }

      function unlockOrganWithEp(organId, level) {
        const key = getOrganKey(organId, level);
        if (unlockedItems.has(key)) return true;
        const cost = getOrganUnlockCostEp(organId, level);
        const sp = ORGAN_CATALOG[organId]?.levels?.[level];
        if (evolutionPoints < cost) {
          NexusSDK.audio.warn();
          showToast(`进化点不足！解锁器官【${sp?.name || organId}】需 ${cost} EP（当前 ${evolutionPoints} EP）`);
          return false;
        }
        evolutionPoints -= cost;
        unlockedItems.add(key);
        // 解锁器官时赠送 1 件初始器官库存
        organInventory[key] = (organInventory[key] || 0) + 1;
        persistState();
        NexusSDK.audio.upgrade();
        showToast(`已消耗 ${cost} EP 解锁器官【${sp?.name || organId}】并获赠 1 件库存！`);
        return true;
      }

      function buyOrganCopyWithEp(organId, level) {
        const key = getOrganKey(organId, level);
        if (!unlockedItems.has(key)) {
          return unlockOrganWithEp(organId, level);
        }
        const cost = getOrganBuyCostEp(organId, level);
        const sp = ORGAN_CATALOG[organId]?.levels?.[level];
        if (evolutionPoints < cost) {
          NexusSDK.audio.warn();
          showToast(`进化点不足！购买 1 件【${sp?.name || organId}】需 ${cost} EP（当前 ${evolutionPoints} EP）`);
          return false;
        }
        evolutionPoints -= cost;
        organInventory[key] = (organInventory[key] || 0) + 1;
        persistState();
        NexusSDK.audio.pickup();
        showToast(`已消耗 ${cost} EP 购买器官【${sp?.name || organId}】×1（当前库存: ${organInventory[key]} 件）`);
        return true;
      }

      function switchPage(pageKey) {
        // 铁律：当游戏对局正在进行中且未结束时，禁止在房间对局内进入物种编辑界面
        if (pageKey !== 'arena' && arenaState.running && !arenaState.matchEnded) {
          NexusSDK.audio.warn();
          showToast('对局进行期间禁止生物编辑！请使用底部切换栏切换已储存的样本');
          return;
        }
        currentActivePage = pageKey;
        document.querySelectorAll('.mg-page').forEach((sec) => {
          sec.classList.toggle('active', sec.id === 'page-' + pageKey);
        });
        document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.page === pageKey);
        });
        const topNav = document.getElementById('mg-top-nav');
        if (topNav) {
          topNav.style.display = pageKey === 'arena' ? 'none' : 'flex';
        }
        syncEvolutionPointsUI();
        NexusSDK.audio.tap();

        if (pageKey === 'gene-bank') renderGeneBankPage();
        if (pageKey === 'fossil') renderFossilPage();
        if (pageKey === 'editor') renderEditorPage();
        if (pageKey === 'lobby') renderLobbyPage();
        if (pageKey === 'arena') {
          if (!arenaState.running) {
            startArenaMatch();
          } else {
            resizeArenaCanvas();
          }
        }
      }

      // 打开局外样本与进化点工坊 (从结算弹窗或第二层菜单调用)
      function openOutOfGameWorkshop() {
        arenaState.running = false;
        arenaState.matchEnded = true;
        document.getElementById('arena-settlement-modal')?.classList.remove('open');
        document.getElementById('arena-rejoin-modal')?.classList.remove('open');
        const t2Overlay = document.getElementById('nx-tier2-overlay');
        if (t2Overlay) {
          t2Overlay.classList.remove('open');
          t2Overlay.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('nx-tier2-active');
        ensureCustomerSampleSlots();
        editorDraft = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(playerGeneBank[selectedSampleSlotIdx] || playerGeneBank[0])));
        switchPage('editor');
      }
      window.openMicroGenesisWorkshop = openOutOfGameWorkshop;

      document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
      });

      document.getElementById('workshop-buy-slot-btn')?.addEventListener('click', buySampleSlotWithEp);
      document.getElementById('editor-buy-slot-inline-btn')?.addEventListener('click', buySampleSlotWithEp);
      document.getElementById('workshop-back-room-btn')?.addEventListener('click', () => {
        saveBlueprintToGeneBank(editorDraft);
        if (window.NexusSDK && window.NexusSDK.openTier2Menu) {
          window.NexusSDK.openTier2Menu('lan');
          return;
        }
        startArenaMatch();
        switchPage('arena');
      });

      // 页面 1：游戏介绍快捷跳转
      document.getElementById('intro-to-fossil-btn')?.addEventListener('click', () => switchPage('fossil'));
      document.getElementById('intro-to-lobby-btn')?.addEventListener('click', () => switchPage('lobby'));
      document.getElementById('intro-to-editor-btn')?.addEventListener('click', () => switchPage('editor'));

      // 页面 2：个人基因库渲染与交互
      function renderGeneBankPage() {
        const countLbl = document.getElementById('gb-count-lbl');
        if (countLbl) countLbl.textContent = String(playerGeneBank.length);
        const listEl = document.getElementById('gb-card-list');
        const detailEl = document.getElementById('gb-detail-panel');
        if (!listEl || !detailEl) return;

        if (!playerGeneBank.some((s) => s.speciesId === selectedGbSpeciesId) && playerGeneBank.length > 0) {
          selectedGbSpeciesId = playerGeneBank[0].speciesId;
        }

        listEl.innerHTML = '';
        playerGeneBank.forEach((sp) => {
          const torso = TORSOS[sp.torsoId];
          const dietName = sp.dietType === 'herbivore' ? '植食' : (sp.dietType === 'carnivore' ? '肉食' : '杂食');
          const dietCls = sp.dietType === 'herbivore' ? 'green' : (sp.dietType === 'carnivore' ? 'red' : 'gold');
          const card = document.createElement('div');
          card.className = 'species-card' + (sp.speciesId === selectedGbSpeciesId ? ' selected' : '');
          card.innerHTML = `
            <div class="sp-card-top">
              <div class="sp-thumb"><img src="../assets/micro-genesis/sprites/${torso.sprite}" alt="" /></div>
              <div style="flex:1;min-width:0;">
                <div class="sp-title">${escapeHtml(sp.speciesName)}</div>
                <div class="sp-meta">${torso.code} ${torso.shortName} · ${sp.statsSummary.totalGpCost} GP</div>
              </div>
              <span class="badge-tag ${dietCls}">${dietName}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.62rem;color:var(--mg-text-secondary);">
              <span>HP ${sp.statsSummary.maxHp} · E ${sp.statsSummary.maxEnergy}</span>
              <span>航速 ${sp.statsSummary.maxSpeed}</span>
            </div>
          `;
          card.addEventListener('click', () => {
            selectedGbSpeciesId = sp.speciesId;
            NexusSDK.audio.tap();
            renderGeneBankPage();
          });
          listEl.appendChild(card);
        });

        const cur = playerGeneBank.find((s) => s.speciesId === selectedGbSpeciesId);
        if (!cur) {
          detailEl.innerHTML = `<div style="margin:auto;color:var(--mg-text-secondary);font-size:0.75rem;">基因库暂无物种，请点击下方【+ 新建物种】。</div>`;
          return;
        }
        const torso = TORSOS[cur.torsoId];
        const st = cur.statsSummary;
        const geneCode = encodeGeneCode(cur);
        const organBadges = [
          ORGAN_CATALOG[cur.slots.core.id].levels[cur.slots.core.level],
          ...cur.slots.sensory.map((s) => ORGAN_CATALOG[s.id].levels[s.level]),
          ...cur.slots.mouth.map((m) => ORGAN_CATALOG[m.id].levels[m.level]),
          ...cur.slots.locomotion.map((l) => ORGAN_CATALOG[l.id].levels[l.level]),
          ...cur.slots.utility.map((u) => ORGAN_CATALOG[u.id].levels[u.level])
        ];

        detailEl.innerHTML = `
          <div class="sec-title">
            <span>物种档案：${escapeHtml(cur.speciesName)} (${torso.name})</span>
            <span class="badge-tag gold">总估值 ${st.totalGpCost} GP</span>
          </div>
          <div class="stat-mini-grid">
            <div class="stat-box"><div class="lbl">生命上限 / 护甲减伤</div><div class="val">${st.maxHp} HP · ${Math.round(st.damageReduction * 100)}%</div></div>
            <div class="stat-box"><div class="lbl">能量上限 / 静态总代谢</div><div class="val cyan">${st.maxEnergy} E · ${st.bmr} E/s</div></div>
            <div class="stat-box"><div class="lbl">最大航速 / 转向角速度</div><div class="val">${st.maxSpeed} px/s · ${st.maxTurnRate}</div></div>
            <div class="stat-box"><div class="lbl">整合感官 (绝对 / 视觉 / 声呐)</div><div class="val gold">${st.absSenseRange}px / ${st.dayEyeRange || 0}px / ${st.sonarRange || 0}px</div></div>
          </div>
          <div style="font-size:0.64rem;color:var(--mg-text-secondary);display:flex;flex-wrap:wrap;gap:4px;">
            ${organBadges.map((ob) => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(15,23,42,0.85);border:1px solid var(--mg-border-subtle);border-radius:6px;padding:2px 6px;"><img src="../assets/micro-genesis/sprites/${ob.sprite}" width="14" height="14" alt=""/>${ob.name}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.75);border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:5px 8px;font-size:0.65rem;">
            <span>历史最高种群：<strong>${cur.records.maxPopulation} 只</strong> · 累计击杀：<strong>${cur.records.totalKills}</strong></span>
            <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:var(--mg-accent-cyan);">
              <input type="checkbox" id="gb-wild-toggle" ${cur.wildEnabled ? 'checked' : ''} />
              <span>允许作为野生NPC种群刷新</span>
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:5px;">
            <input type="text" class="mg-input" readonly value="${geneCode}" id="gb-code-readonly" style="flex:1;font-size:0.62rem;color:var(--mg-accent-gold);" />
            <button class="btn-ghost" id="gb-copy-code-btn">复制基因码</button>
          </div>
          <div style="display:flex;gap:6px;margin-top:auto;">
            <button class="btn-ghost" id="gb-edit-in-page4-btn" style="flex:1;border-color:var(--mg-accent-cyan);color:var(--mg-accent-cyan);">载入 4.编辑页面 修改</button>
            <button class="cta-primary" id="gb-launch-in-page5-btn" style="flex:1;min-height:44px;">设为出战并前往 5.大厅 ➔</button>
            <button class="btn-ghost danger" id="gb-delete-btn">删除</button>
          </div>
        `;

        document.getElementById('gb-wild-toggle')?.addEventListener('change', (e) => {
          cur.wildEnabled = Boolean(e.target.checked);
          persistState();
          showToast(cur.wildEnabled ? '已加入单人沙盘野生种群池' : '已从野生种群池移除');
        });
        document.getElementById('gb-copy-code-btn')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(geneCode).catch(() => {});
          showToast('已复制 Base64URL 基因序列码！');
        });
        document.getElementById('gb-edit-in-page4-btn')?.addEventListener('click', () => {
          editorDraft = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(cur)));
          switchPage('editor');
          showToast('已载入【' + cur.speciesName + '】至 4.编辑页面');
        });
        document.getElementById('gb-launch-in-page5-btn')?.addEventListener('click', () => {
          selectedLobbySpeciesId = cur.speciesId;
          switchPage('lobby');
        });
        document.getElementById('gb-delete-btn')?.addEventListener('click', () => {
          if (playerGeneBank.length <= 1) {
            showToast('基因库至少保留 1 个自创物种！');
            return;
          }
          playerGeneBank = playerGeneBank.filter((s) => s.speciesId !== cur.speciesId);
          selectedGbSpeciesId = playerGeneBank[0].speciesId;
          persistState();
          renderGeneBankPage();
          showToast('已删除物种档案');
        });
      }

      document.getElementById('gb-import-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('gb-import-input');
        const decodedRaw = decodeGeneCode(inp?.value || '');
        if (!decodedRaw) {
          NexusSDK.audio.warn();
          showToast('基因序列码校验失败，请检查格式！');
          return;
        }
        const decoded = enforceOwnedBlueprintConstraints(decodedRaw, true);
        playerGeneBank[selectedSampleSlotIdx] = decoded;
        selectedGbSpeciesId = decoded.speciesId;
        if (inp) inp.value = '';
        persistState();
        renderGeneBankPage();
        NexusSDK.audio.upgrade();
        showToast('成功导入样本至槽位 #' + (selectedSampleSlotIdx + 1) + '：【' + decoded.speciesName + '】');
      });

      document.getElementById('gb-new-species-btn')?.addEventListener('click', () => {
        editorDraft = validateAndSanitizeBlueprint({
          speciesId: 'sp_' + Date.now(),
          speciesName: '新创微界虫',
          torsoId: 'torso-t1-micro',
          slots: {
            core: { id: 'core-vacuole', level: 1 },
            sensory: [{ id: 'sensory-eye', level: 1 }],
            mouth: [{ id: 'mouth-omni', level: 1 }],
            locomotion: [{ id: 'loco-flagella', level: 1 }],
            utility: [{ id: 'util-scales', level: 1 }]
          }
        });
        switchPage('editor');
      });

      // 页面 3：官方化石记录与全谱系器官图鉴
      function renderFossilPage() {
        const spListEl = document.getElementById('fossil-species-list');
        const organCatEl = document.getElementById('fossil-organ-catalog');
        const bossListEl = document.getElementById('fossil-boss-list');
        if (!spListEl || !organCatEl || !bossListEl) return;

        spListEl.innerHTML = '';
        officialFossils.forEach((f) => {
          const torso = TORSOS[f.torsoId];
          const card = document.createElement('div');
          card.className = 'species-card' + (f.speciesId === selectedFossilSpeciesId ? ' selected' : '');
          card.innerHTML = `
            <div class="sp-card-top">
              <div class="sp-thumb"><img src="../assets/micro-genesis/sprites/${torso.sprite}" alt="" /></div>
              <div style="flex:1;min-width:0;">
                <div class="sp-title">${escapeHtml(f.speciesName)}</div>
                <div class="sp-meta">${torso.code} · 估值 ${f.statsSummary.totalGpCost} GP</div>
              </div>
              <span class="badge-tag">官方化石</span>
            </div>
            <div style="font-size:0.61rem;color:var(--mg-text-secondary);line-height:1.35;">${escapeHtml(f.desc || '')}</div>
          `;
          card.addEventListener('click', () => {
            selectedFossilSpeciesId = f.speciesId;
            NexusSDK.audio.tap();
            renderFossilPage();
          });
          spListEl.appendChild(card);
        });

        organCatEl.innerHTML = '';
        Object.values(ORGAN_CATALOG).forEach((series) => {
          const box = document.createElement('div');
          box.style.cssText = 'background:rgba(15,23,42,0.82);border:1px solid var(--mg-border-subtle);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;';
          box.innerHTML = `
            <div style="font-size:0.65rem;font-weight:800;color:var(--mg-accent-cyan);">${series.branchName}</div>
            <div style="display:flex;justify-content:space-between;gap:4px;">
              ${[1, 2, 3].map((lv) => {
                const sp = series.levels[lv];
                return `<div style="flex:1;text-align:center;background:rgba(7,12,24,0.8);border-radius:6px;padding:3px;">
                  <img src="../assets/micro-genesis/sprites/${sp.sprite}" width="22" height="22" alt="" style="display:block;margin:0 auto 2px;"/>
                  <div style="font-size:0.56rem;color:var(--mg-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Lv.${lv}</div>
                  <div style="font-size:0.54rem;color:var(--mg-accent-gold);">${sp.gp}GP</div>
                </div>`;
              }).join('')}
            </div>
          `;
          organCatEl.appendChild(box);
        });

        bossListEl.innerHTML = '';
        EPIC_BOSSES.forEach((b) => {
          const item = document.createElement('div');
          item.style.cssText = 'background:rgba(15,23,42,0.85);border:1px solid rgba(251,191,36,0.28);border-radius:8px;padding:6px 8px;';
          item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:0.7rem;color:var(--mg-accent-gold);">${b.name}</strong>
              <span style="font-size:0.58rem;color:var(--mg-accent-cyan);">${b.chapter}</span>
            </div>
            <div style="font-size:0.61rem;color:var(--mg-text-secondary);margin-top:2px;">${b.desc}</div>
            <div style="font-size:0.58rem;color:var(--mg-accent-emerald);margin-top:2px;">${b.unlock}</div>
          `;
          bossListEl.appendChild(item);
        });
      }

      document.getElementById('fossil-clone-to-editor-btn')?.addEventListener('click', () => {
        const f = officialFossils.find((item) => item.speciesId === selectedFossilSpeciesId) || officialFossils[0];
        const cloned = JSON.parse(JSON.stringify(f));
        cloned.speciesId = 'sp_' + Date.now();
        cloned.origin = 'player';
        cloned.speciesName = sanitizeSpeciesName(f.speciesName + '改');
        editorDraft = enforceOwnedBlueprintConstraints(cloned, true);
        switchPage('editor');
        showToast('已克隆官方化石【' + f.speciesName + '】至 4.编辑页面（按已解锁/库存部件自动适配）！');
      });

      /* =====================================================================
       * 7. 页面 4：局外样本与进化点工坊 (#page-editor —— 解锁器官 / 购买样本槽位 / 购买器官 / 装配客户样本)
       * ===================================================================== */
      function buildSlotControls(blueprint, torsoRowEl, slotListEl, onChangeCallback) {
        if (!torsoRowEl || !slotListEl) return;
        const curTorso = TORSOS[blueprint.torsoId] || TORSOS['torso-t1-micro'];

        // 1. 4阶躯干底盘切换按钮组 (支持进化点解锁高阶躯干)
        torsoRowEl.innerHTML = '';
        Object.values(TORSOS).forEach((t) => {
          const unlocked = isTorsoUnlocked(t.id);
          const unlockCost = getTorsoUnlockCostEp(t.id);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'torso-btn' + (t.id === blueprint.torsoId ? ' active' : '');
          btn.innerHTML = `
            <img src="../assets/micro-genesis/sprites/${t.sprite}" alt="" />
            <span class="t-name">${t.shortName}</span>
            <span class="t-sub" style="color:${unlocked ? 'var(--mg-text-secondary)' : 'var(--mg-accent-gold)'};">
              ${unlocked ? `${t.totalSlots}槽·V${t.volume}` : `解锁 ${unlockCost}EP`}
            </span>
          `;
          btn.addEventListener('click', () => {
            if (!isTorsoUnlocked(t.id)) {
              if (!unlockTorsoWithEp(t.id)) return;
            }
            blueprint.torsoId = t.id;
            const rebuilt = validateAndSanitizeBlueprint(blueprint);
            Object.assign(blueprint, rebuilt);
            NexusSDK.audio.tap();
            onChangeCallback();
          });
          torsoRowEl.appendChild(btn);
        });

        // 2. 五大器官插槽列表 (支持进化点解锁器官与购买器官库存)
        slotListEl.innerHTML = '';

        function appendSlotRow(catLabel, categoryKey, slotObj, indexInCat) {
          const seriesOptions = Object.values(ORGAN_CATALOG).filter((s) => s.category === categoryKey);
          const curSeries = ORGAN_CATALOG[slotObj.id] || seriesOptions[0];
          const curSpec = curSeries.levels[slotObj.level];
          const curUnlocked = isOrganUnlocked(slotObj.id, slotObj.level);
          const ownedCount = getOwnedOrganCount(slotObj.id, slotObj.level);
          const usedTotal = countBlueprintOrganUsage(blueprint, slotObj.id, slotObj.level, null);
          const buyCost = getOrganBuyCostEp(slotObj.id, slotObj.level);
          const unlockCost = getOrganUnlockCostEp(slotObj.id, slotObj.level);

          const row = document.createElement('div');
          row.className = 'slot-row';
          row.innerHTML = `
            <div class="slot-ico"><img src="../assets/micro-genesis/sprites/${curSpec.sprite}" alt="" /></div>
            <span class="slot-cat">${catLabel}</span>
            <select class="slot-select" name="slot-${categoryKey}-${indexInCat}" aria-label="${catLabel}器官选择">
              ${seriesOptions.map((opt) => `<option value="${opt.id}" ${opt.id === slotObj.id ? 'selected' : ''}>${opt.branchName}</option>`).join('')}
            </select>
            <div class="lvl-pill-group">
              ${[1, 2, 3].map((lv) => {
                const lvUnlocked = isOrganUnlocked(slotObj.id, lv);
                return `<button type="button" class="lvl-pill ${slotObj.level === lv ? 'active' : ''}" data-lv="${lv}" title="${lvUnlocked ? '已解锁' : '点击使用进化点解锁'}">Lv.${lv}${lvUnlocked ? '' : '·锁'}</button>`;
              }).join('')}
            </div>
            <button type="button" class="btn-ghost gold slot-ep-action-btn" style="min-height:44px;min-width:44px;padding:0 6px;font-size:0.55rem;white-space:nowrap;" title="使用进化点解锁或购买该器官库存">
              ${curUnlocked ? `库存${usedTotal}/${ownedCount}(+${buyCost}EP)` : `解锁(${unlockCost}EP)`}
            </button>
          `;

          const selectEl = row.querySelector('.slot-select');
          selectEl.addEventListener('change', (e) => {
            const nextId = e.target.value;
            const nextLv = slotObj.level;
            const neededCopies = (categoryKey === 'mouth' && blueprint.slots.mouth.length > 1)
              ? blueprint.slots.mouth.length
              : (countBlueprintOrganUsage(blueprint, nextId, nextLv, slotObj) + 1);
            if (!isOrganUnlocked(nextId, nextLv)) {
              if (!unlockOrganWithEp(nextId, nextLv)) {
                e.target.value = slotObj.id;
                return;
              }
            }
            while (getOwnedOrganCount(nextId, nextLv) < neededCopies) {
              if (!buyOrganCopyWithEp(nextId, nextLv)) {
                e.target.value = slotObj.id;
                return;
              }
            }
            slotObj.id = nextId;
            if (categoryKey === 'mouth' && blueprint.slots.mouth.length > 1) {
              blueprint.slots.mouth.forEach((m) => { m.id = slotObj.id; });
            }
            const updated = validateAndSanitizeBlueprint(blueprint);
            Object.assign(blueprint, updated);
            NexusSDK.audio.tap();
            onChangeCallback();
          });

          row.querySelectorAll('.lvl-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
              const targetLv = Number(pill.dataset.lv);
              const neededCopies = countBlueprintOrganUsage(blueprint, slotObj.id, targetLv, slotObj) + 1;
              if (!isOrganUnlocked(slotObj.id, targetLv)) {
                if (!unlockOrganWithEp(slotObj.id, targetLv)) return;
              }
              while (getOwnedOrganCount(slotObj.id, targetLv) < neededCopies) {
                if (!buyOrganCopyWithEp(slotObj.id, targetLv)) return;
              }
              slotObj.level = targetLv;
              const updated = validateAndSanitizeBlueprint(blueprint);
              Object.assign(blueprint, updated);
              NexusSDK.audio.tap();
              onChangeCallback();
            });
          });

          row.querySelector('.slot-ep-action-btn')?.addEventListener('click', () => {
            if (!isOrganUnlocked(slotObj.id, slotObj.level)) {
              unlockOrganWithEp(slotObj.id, slotObj.level);
            } else {
              buyOrganCopyWithEp(slotObj.id, slotObj.level);
            }
            onChangeCallback();
          });

          slotListEl.appendChild(row);
        }

        // 确保数组长度对齐当前躯干插槽容量
        while (blueprint.slots.sensory.length < curTorso.slots.sensory) {
          blueprint.slots.sensory.push({ id: 'sensory-ear', level: 1 });
        }
        blueprint.slots.sensory.length = curTorso.slots.sensory;

        while (blueprint.slots.mouth.length < curTorso.slots.mouth) {
          blueprint.slots.mouth.push({ id: blueprint.slots.mouth[0]?.id || 'mouth-omni', level: 1 });
        }
        blueprint.slots.mouth.length = curTorso.slots.mouth;

        while (blueprint.slots.locomotion.length < curTorso.slots.locomotion) {
          blueprint.slots.locomotion.push({ id: 'loco-flagella', level: 1 });
        }
        blueprint.slots.locomotion.length = curTorso.slots.locomotion;

        while (blueprint.slots.utility.length < curTorso.slots.utility) {
          blueprint.slots.utility.push({ id: 'util-scales', level: 1 });
        }
        blueprint.slots.utility.length = curTorso.slots.utility;

        const synced = validateAndSanitizeBlueprint(blueprint);
        Object.assign(blueprint, synced);

        appendSlotRow('核心槽', 'core', blueprint.slots.core, 0);
        blueprint.slots.sensory.forEach((s, idx) => appendSlotRow('感官槽' + (idx + 1), 'sensory', s, idx));
        blueprint.slots.mouth.forEach((m, idx) => appendSlotRow('口部槽' + (idx + 1), 'mouth', m, idx));
        blueprint.slots.locomotion.forEach((l, idx) => appendSlotRow('运动槽' + (idx + 1), 'locomotion', l, idx));
        blueprint.slots.utility.forEach((u, idx) => appendSlotRow('功能槽' + (idx + 1), 'utility', u, idx));
      }

      // 渲染右栏【3. 进化点商城 · 解锁器官 / 购买器官库存】
      function renderEditorEpOrganShop() {
        const shopEl = document.getElementById('editor-ep-organ-shop');
        if (!shopEl) return;
        shopEl.innerHTML = '';
        Object.values(ORGAN_CATALOG).forEach((series) => {
          [1, 2, 3].forEach((lv) => {
            const spec = series.levels[lv];
            const unlocked = isOrganUnlocked(series.id, lv);
            const owned = getOwnedOrganCount(series.id, lv);
            const cost = unlocked ? getOrganBuyCostEp(series.id, lv) : getOrganUnlockCostEp(series.id, lv);
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 6px;border-radius:6px;background:rgba(15,23,42,0.86);border:1px solid rgba(45,212,191,0.18);font-size:0.60rem;';
            item.innerHTML = `
              <div style="display:flex;align-items:center;gap:5px;min-width:0;">
                <img src="../assets/micro-genesis/sprites/${spec.sprite}" width="18" height="18" alt="" />
                <div style="min-width:0;">
                  <div style="color:var(--mg-text-primary);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${spec.name} (Lv.${lv})</div>
                  <div style="color:${unlocked ? 'var(--mg-accent-emerald)' : 'var(--mg-text-secondary)'};font-size:0.54rem;">
                    ${unlocked ? `已解锁 · 库存 ${owned} 件` : '未解锁器官图纸'}
                  </div>
                </div>
              </div>
              <button type="button" class="btn-ghost ${unlocked ? '' : 'gold'}" style="min-height:44px;min-width:44px;padding:0 8px;font-size:0.56rem;white-space:nowrap;border-color:${unlocked ? 'var(--mg-accent-cyan)' : 'var(--mg-accent-gold)'};color:${unlocked ? 'var(--mg-accent-cyan)' : 'var(--mg-accent-gold)'};">
                ${unlocked ? `+购买器官 (${cost} EP)` : `解锁器官 (${cost} EP)`}
              </button>
            `;
            item.querySelector('button')?.addEventListener('click', () => {
              if (!unlocked) {
                unlockOrganWithEp(series.id, lv);
              } else {
                buyOrganCopyWithEp(series.id, lv);
              }
              renderEditorPage();
            });
            shopEl.appendChild(item);
          });
        });
      }

      function renderEditorSampleSlotsBar() {
        const barEl = document.getElementById('editor-sample-slots-bar');
        if (!barEl) return;
        ensureCustomerSampleSlots();
        barEl.innerHTML = '';
        for (let i = 0; i < maxSampleSlots; i++) {
          const sp = playerGeneBank[i];
          const t = TORSOS[sp.torsoId] || TORSOS['torso-t1-micro'];
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sample-slot-pill' + (i === selectedSampleSlotIdx ? ' active' : '');
          btn.style.minHeight = '44px';
          btn.style.minWidth = '88px';
          btn.innerHTML = `
            <img src="../assets/micro-genesis/sprites/${t.sprite}" alt="" />
            <div class="sample-slot-info">
              <span class="sample-slot-name">#${i + 1} ${escapeHtml(sp.speciesName)}</span>
              <span class="sample-slot-sub">${t.code} · ${computeBlueprintBaseNutrients(sp)}质</span>
            </div>
          `;
          btn.addEventListener('click', () => {
            // 切换前自动将当前修改保存到原样本槽（强制校验已解锁与库存副本约束）
            playerGeneBank[selectedSampleSlotIdx] = enforceOwnedBlueprintConstraints(editorDraft, false);
            selectedSampleSlotIdx = i;
            editorDraft = enforceOwnedBlueprintConstraints(playerGeneBank[i], false);
            persistState();
            NexusSDK.audio.tap();
            renderEditorPage();
          });
          barEl.appendChild(btn);
        }
      }

      function renderEditorPage() {
        syncEvolutionPointsUI();
        renderEditorSampleSlotsBar();
        const torsoRowEl = document.getElementById('editor-torso-row');
        const slotListEl = document.getElementById('editor-slot-list');
        buildSlotControls(editorDraft, torsoRowEl, slotListEl, renderEditorPage);
        renderEditorEpOrganShop();

        const torso = TORSOS[editorDraft.torsoId];
        const st = editorDraft.statsSummary;
        const dietLabel = editorDraft.dietType === 'herbivore' ? '植食滤食者' : (editorDraft.dietType === 'carnivore' ? '肉食掠食者' : '全能杂食者');

        const capLbl = document.getElementById('editor-slot-cap-lbl');
        if (capLbl) capLbl.textContent = torso.totalSlots + ' 槽';
        const titleEl = document.getElementById('editor-preview-title');
        if (titleEl) titleEl.textContent = `样本槽 #${selectedSampleSlotIdx + 1}：${editorDraft.speciesName}`;
        const subEl = document.getElementById('editor-preview-sub');
        const visionTag = st.maxEyeLv > 0 ? ` · ${st.visionModeLabel || ''}` : (st.maxEarLv > 0 ? ' · 纯声呐广域监听' : ' · 近体绝对感知');
        if (subEl) subEl.textContent = `${torso.name} (${torso.code}) · ${dietLabel}${visionTag}`;
        const nameInp = document.getElementById('editor-species-name');
        if (nameInp && document.activeElement !== nameInp) nameInp.value = editorDraft.speciesName;

        const hpEl = document.getElementById('ed-stat-hp');
        if (hpEl) hpEl.textContent = `${st.maxHp} HP (减伤${Math.round(st.damageReduction * 100)}%)`;
        const enEl = document.getElementById('ed-stat-energy');
        if (enEl) enEl.textContent = `${st.maxEnergy} E (消化${Math.round(st.digestEff * 100)}%)`;
        const bmrEl = document.getElementById('ed-stat-bmr');
        if (bmrEl) bmrEl.textContent = `${st.bmr} E/s`;
        const spdEl = document.getElementById('ed-stat-speed');
        if (spdEl) spdEl.textContent = `${st.maxSpeed} px/s · ${st.maxTurnRate}`;
        const gpEl = document.getElementById('ed-stat-gpcost');
        if (gpEl) gpEl.textContent = `${computeBlueprintBaseNutrients(editorDraft)} 营养质`;

        // 同步 5 维 AI 滑块
        const aiKeys = [
          ['w_aggr', 'ai-w-aggr', 'ai-val-aggr'],
          ['w_flock', 'ai-w-flock', 'ai-val-flock'],
          ['w_flee', 'ai-w-flee', 'ai-val-flee'],
          ['w_repro', 'ai-w-repro', 'ai-val-repro'],
          ['w_mut', 'ai-w-mut', 'ai-val-mut']
        ];
        aiKeys.forEach(([k, sliderId, valId]) => {
          const sl = document.getElementById(sliderId);
          const vl = document.getElementById(valId);
          const pct = Math.round((editorDraft.aiWeights[k] ?? 0.5) * 100);
          if (sl) sl.value = String(pct);
          if (vl) vl.textContent = pct + '%';
        });
      }

      ['aggr', 'flock', 'flee', 'repro', 'mut'].forEach((shortKey) => {
        const sl = document.getElementById('ai-w-' + shortKey);
        const vl = document.getElementById('ai-val-' + shortKey);
        if (sl) {
          sl.addEventListener('input', () => {
            const pct = Number(sl.value);
            editorDraft.aiWeights['w_' + shortKey] = clampAiWeight(pct / 100);
            if (vl) vl.textContent = pct + '%';
          });
        }
      });

      document.getElementById('editor-species-name')?.addEventListener('input', (e) => {
        editorDraft.speciesName = sanitizeSpeciesName(e.target.value);
        const titleEl = document.getElementById('editor-preview-title');
        if (titleEl) titleEl.textContent = `样本槽 #${selectedSampleSlotIdx + 1}：${editorDraft.speciesName}`;
      });

      document.getElementById('editor-toggle-daynight-btn')?.addEventListener('click', (e) => {
        editorPreviewIsNight = !editorPreviewIsNight;
        e.currentTarget.textContent = '预览环境：' + (editorPreviewIsNight ? '黑夜 (视距-45%)' : '白昼');
        NexusSDK.audio.tap();
      });

      function saveBlueprintToGeneBank(bp) {
        ensureCustomerSampleSlots();
        const sanitized = enforceOwnedBlueprintConstraints(bp, true);
        if (playerGeneBank[selectedSampleSlotIdx]) {
          sanitized.speciesId = playerGeneBank[selectedSampleSlotIdx].speciesId || ('sp_slot_' + (selectedSampleSlotIdx + 1));
          sanitized.records = playerGeneBank[selectedSampleSlotIdx].records || sanitized.records;
          playerGeneBank[selectedSampleSlotIdx] = sanitized;
        } else {
          playerGeneBank[0] = sanitized;
        }
        editorDraft = JSON.parse(JSON.stringify(sanitized));
        selectedGbSpeciesId = sanitized.speciesId;
        selectedLobbySpeciesId = sanitized.speciesId;
        persistState();
        renderEditorSampleSlotsBar();
        renderArenaSampleSwitcher();
        NexusSDK.audio.upgrade();
        showToast(`已保存至客户储存样本槽 #${selectedSampleSlotIdx + 1}：【${sanitized.speciesName}】！`);
        return sanitized;
      }

      document.getElementById('editor-save-to-gb-btn')?.addEventListener('click', () => {
        saveBlueprintToGeneBank(editorDraft);
      });

      document.getElementById('editor-quick-play-btn')?.addEventListener('click', () => {
        saveBlueprintToGeneBank(editorDraft);
        startArenaMatch();
        switchPage('arena', { allowDuringMatch: true });
      });

      document.getElementById('editor-buy-slot-inline-btn')?.addEventListener('click', () => {
        buySampleSlotWithEp();
      });

      document.getElementById('workshop-buy-slot-btn')?.addEventListener('click', () => {
        buySampleSlotWithEp();
      });

      document.getElementById('workshop-back-room-btn')?.addEventListener('click', () => {
        saveBlueprintToGeneBank(editorDraft);
        if (window.NexusSDK && window.NexusSDK.openTier2Menu) {
          window.NexusSDK.openTier2Menu('lan');
          return;
        }
        startArenaMatch();
        switchPage('arena', { allowDuringMatch: true });
      });

      // 编辑页面中栏 60Hz 实时生物体节与感官仿真培养皿动画
      function renderEditorPreviewLoop(nowMs) {
        if (currentActivePage === 'editor') {
          const canvas = document.getElementById('editor-preview-canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const tSec = nowMs * 0.001;
            const st = editorDraft.statsSummary;
            const isSonarOnly = st.maxEarLv > 0 && st.maxEyeLv === 0;

            ctx.shadowBlur = 0;
            ctx.clearRect(0, 0, w, h);
            const cx = w * 0.46;
            const cy = h * 0.52;
            const previewBgGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(w, h) * 0.72);
            if (isSonarOnly) {
              previewBgGrad.addColorStop(0, '#041222');
              previewBgGrad.addColorStop(1, '#02050d');
            } else if (editorPreviewIsNight) {
              previewBgGrad.addColorStop(0, '#071b2e');
              previewBgGrad.addColorStop(1, '#020712');
            } else {
              previewBgGrad.addColorStop(0, '#0b3240');
              previewBgGrad.addColorStop(0.6, '#051b28');
              previewBgGrad.addColorStop(1, '#020b14');
            }
            ctx.fillStyle = previewBgGrad;
            ctx.fillRect(0, 0, w, h);

            // 培养皿微网格与丁达尔焦散微光波纹
            ctx.strokeStyle = 'rgba(45, 212, 191, 0.065)';
            ctx.lineWidth = 1;
            for (let x = 20; x < w; x += 32) {
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 20; y < h; y += 32) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
            for (let i = 0; i < 12; i++) {
              const px = (i * 47 + Math.sin(tSec * 0.8 + i) * 14 + w) % w;
              const py = (i * 31 + Math.cos(tSec * 0.7 + i * 1.3) * 12 + h) % h;
              ctx.fillStyle = i % 2 === 0 ? 'rgba(45, 212, 191, 0.16)' : 'rgba(52, 211, 153, 0.14)';
              ctx.beginPath();
              ctx.arc(px, py, 1.4 + (i % 3) * 0.6, 0, Math.PI * 2);
              ctx.fill();
            }

            const swimAng = Math.sin(tSec * 1.4) * 0.16;
            const absPreviewR = (st.absSenseRange || 110) * 0.28;

            // 绘制个体附近【绝对感知彩色区】渐变光晕预览 (所有感官配置均具备近体彩色感知)
            const absPreviewGrad = ctx.createRadialGradient(cx, cy, absPreviewR * 0.25, cx, cy, absPreviewR);
            absPreviewGrad.addColorStop(0, 'rgba(45, 212, 191, 0.20)');
            absPreviewGrad.addColorStop(0.65, 'rgba(45, 212, 191, 0.09)');
            absPreviewGrad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
            ctx.beginPath();
            ctx.arc(cx, cy, absPreviewR, 0, Math.PI * 2);
            ctx.fillStyle = absPreviewGrad;
            ctx.fill();

            // 绘制视觉扇形锥预览 (生态位分化：掠食者=长距离·高精度·窄视野，生产者=中距离·低精度·宽视野)
            if (st.maxEyeLv > 0) {
              const r = (editorPreviewIsNight ? st.nightEyeRange : st.dayEyeRange) * 0.24;
              const halfRad = ((editorPreviewIsNight ? st.nightEyeAngle : st.dayEyeAngle) * 0.5) * (Math.PI / 180);
              const isPred = st.visionProfile === 'predator';
              const isProd = st.visionProfile === 'producer';
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(swimAng);
              const coneGrad = ctx.createRadialGradient(0, 0, absPreviewR * 0.35, 0, 0, r);
              if (isPred) {
                coneGrad.addColorStop(0, 'rgba(45, 212, 191, 0.28)');
                coneGrad.addColorStop(0.75, 'rgba(45, 212, 191, 0.16)');
                coneGrad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
              } else if (isProd) {
                coneGrad.addColorStop(0, 'rgba(52, 211, 153, 0.20)');
                coneGrad.addColorStop(0.42, 'rgba(52, 211, 153, 0.09)');
                coneGrad.addColorStop(1, 'rgba(52, 211, 153, 0.0)');
              } else {
                coneGrad.addColorStop(0, 'rgba(45, 212, 191, 0.22)');
                coneGrad.addColorStop(0.55, 'rgba(45, 212, 191, 0.10)');
                coneGrad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
              }
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, r, -halfRad, halfRad);
              ctx.closePath();
              ctx.fillStyle = coneGrad;
              ctx.fill();
              ctx.restore();
            }

            // 绘制听觉 360° 广域声呐与距离衰减预览
            if (st.maxEarLv > 0) {
              const maxR = st.sonarRange * 0.20;
              const pulseFrac = (tSec % st.sonarPulseSec) / st.sonarPulseSec;
              const snapTick = Math.floor(tSec / st.sonarPulseSec) * st.sonarPulseSec;
              // 雷达距离环与十字刻度线 (随距离衰减)
              [0.35, 0.7, 1.0].forEach((ratio) => {
                const falloff = Math.max(0.08, 1 - ratio * 0.72);
                ctx.beginPath();
                ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(56, 189, 248, ${(0.36 * falloff).toFixed(3)})`;
                ctx.setLineDash(ratio === 1.0 ? [4, 4] : []);
                ctx.stroke();
                ctx.setLineDash([]);
              });
              ctx.beginPath();
              ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
              ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
              ctx.stroke();

              // 雷达扫描脉冲波前 (距离越远信号越弱)
              const waveFalloff = Math.pow(1 - pulseFrac, 1.35);
              ctx.beginPath();
              ctx.arc(cx, cy, maxR * pulseFrac, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(56, 189, 248, ${(waveFalloff * 0.82).toFixed(3)})`;
              ctx.lineWidth = Math.max(0.8, 1.8 * waveFalloff);
              ctx.stroke();

              // 演示听觉远端目标信号衰减与渐变融合 (置于侧后方声呐盲区，直观展现复合感知下“前视全彩 + 侧后声呐”协同效果)
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
              ctx.clip();
              drawOrganism(ctx, {
                x: cx - maxR * 0.65,
                y: cy - maxR * 0.38,
                angle: Math.PI * 0.18,
                faction: 'enemy',
                isAlpha: false,
                blueprint: officialFossils[1]
              }, {
                freezePhase: snapTick * 6.5,
                scale: 0.95,
                sonarWireframe: true,
                sonarAlpha: Math.max(0.22, (1.0 - pulseFrac * 0.55) * 0.52)
              });
              ctx.restore();
            }

            // 若装备视觉器官，在前方视觉扇形远端演示光学精度差异 (掠食者=远距高精度锐利对焦，生产者=中距低精度散焦模糊)
            if (st.maxEyeLv > 0) {
              const eyePreviewR = (editorPreviewIsNight ? st.nightEyeRange : st.dayEyeRange) * 0.24;
              const targetDist = Math.max(absPreviewR + 38, Math.min(w * 0.44, eyePreviewR * 0.76));
              const demoBlur = st.visionProfile === 'producer' ? 3.4 : (st.visionProfile === 'predator' ? 0 : 1.5);
              ctx.save();
              if (demoBlur > 0.3) ctx.filter = `blur(${demoBlur}px)`;
              drawOrganism(ctx, {
                x: cx + Math.cos(swimAng) * targetDist,
                y: cy + Math.sin(swimAng) * targetDist,
                angle: swimAng + Math.PI * 0.75,
                faction: 'herbivore',
                isAlpha: false,
                blueprint: officialFossils[0]
              }, {
                timeSec: tSec,
                scale: 0.86,
                sonarWireframe: false
              });
              ctx.restore();
            }

            // 绘制预览物种有机体 (位于绝对感知彩色区内，始终呈现彩色实时动画)
            ctx.save();
            const satPct = Math.round((st.maxEyeLv > 0 ? Math.max(0.85, st.eyeSat) : 0.95) * 100);
            ctx.filter = `saturate(${satPct}%)`;
            drawOrganism(ctx, {
              x: cx,
              y: cy,
              angle: swimAng,
              faction: 'player',
              isAlpha: true,
              blueprint: editorDraft
            }, {
              timeSec: tSec,
              scale: 1.38,
              sonarWireframe: false
            });
            ctx.restore();
          }
        }
        requestAnimationFrame(renderEditorPreviewLoop);
      }

      /* =====================================================================
       * 8. 页面 5：游戏大厅 (#page-lobby —— 局域网房间在房主移动端设备运行)
       * ===================================================================== */
      let lanSession = null;
      let lanRoomCode = '';
      let isLanGuest = false;
      let lanStatusBound = false;
      let lobbyRoomSig = '';
      let lastLobbyConnState = '';

      function syncLobbyLanBadges(st) {
        const s = st || (lanSession && lanSession.getStatus ? lanSession.getStatus() : null);
        if (!s) return;
        lanRoomCode = s.roomCode;
        isLanGuest = s.role === 'client' && s.connected;
        const badgeEl = document.getElementById('lobby-host-room-code');
        if (badgeEl) badgeEl.textContent = '房间号: ' + s.roomCode;
        const statusEl = document.getElementById('lobby-lan-status-badge');
        if (statusEl) {
          const rtt = Number.isFinite(s.peerLatencyMs) ? s.peerLatencyMs + 'ms' : '测速中';
          const via = s.transport === 'webrtc' ? 'WebRTC' : '同设备通道';
          const text = s.connected
            ? `已联机 · ${s.role === 'host' ? '房主' : '客机'} · 实测 RTT ${rtt} (${via})`
            : s.connState === 'connecting' ? '握手连接中...'
            : (s.connState === 'failed' || s.connState === 'disconnected') ? (s.lastError || '连接已断开')
            : '本机房主广播中 · 等待客机加入';
          statusEl.textContent = text;
          statusEl.style.color = s.connected ? 'var(--mg-accent-emerald)'
            : (s.connState === 'failed' || s.connState === 'disconnected') ? '#f43f5e' : 'var(--mg-text-secondary)';
        }
        if (s.connState !== lastLobbyConnState) {
          if (s.connState === 'connected') {
            NexusSDK.audio.pickup();
            showToast(s.role === 'host' ? `客机已加入房间 (${s.roomCode})` : `已加入房间 ${s.roomCode}（房主已应答）`);
          } else if ((s.connState === 'failed' || s.connState === 'disconnected') && s.lastError) {
            showToast(s.lastError);
          }
          lastLobbyConnState = s.connState;
        }
      }

      // 与第二层菜单「⑥ 局域网管理」共用同一 SDK 会话单例（杜绝双套大厅各自广播不同房间号）
      function initLanHostSession() {
        lanSession = NexusSDK.createLanSession('micro-genesis');
        if (!lanStatusBound) {
          lanStatusBound = true;
          const onMsg = (msg) => {
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'GUEST_INPUT' && !isLanGuest && arenaState.running && arenaState.rivalAlpha) {
              // 房主移动端接收客机操控指令驱动 2P 始祖
              arenaState.rivalAlpha.targetAngle = Number(msg.angle) || 0;
              if (msg.skill) triggerEntityActiveSkill(arenaState.rivalAlpha);
              if (msg.mitosis) tryMitosisReproduce(arenaState.rivalAlpha);
            } else if (msg.type === 'HOST_STATE' && isLanGuest && arenaState.running && arenaState.rivalAlpha) {
              // 客机接收房主移动端 20Hz 权威状态帧同步
              if (Number.isFinite(msg.hostX)) arenaState.rivalAlpha.x = msg.hostX;
              if (Number.isFinite(msg.hostY)) arenaState.rivalAlpha.y = msg.hostY;
              if (Number.isFinite(msg.hostAng)) arenaState.rivalAlpha.angle = msg.hostAng;
              if (Number.isFinite(msg.hostHp)) arenaState.rivalAlpha.hp = msg.hostHp;
            } else if ((msg.type === 'SAMPLE_SWITCH' || msg.type === 'SAMPLE_REJOIN') && arenaState.running && msg.blueprint) {
              // 局域网可靠通道同步对端玩家切换客户样本或中途重生
              const safeRivalBp = validateAndSanitizeBlueprint(msg.blueprint);
              if (arenaState.rivalAlpha && arenaState.rivalAlpha.hp > 0 && msg.type === 'SAMPLE_SWITCH') {
                const rSt = safeRivalBp.statsSummary;
                arenaState.rivalAlpha.blueprint = safeRivalBp;
                arenaState.rivalAlpha.maxHp = rSt.maxHp;
                arenaState.rivalAlpha.hp = Math.min(rSt.maxHp, arenaState.rivalAlpha.hp);
                arenaState.rivalAlpha.maxEnergy = rSt.maxEnergy;
                arenaState.rivalAlpha.energy = Math.min(rSt.maxEnergy, arenaState.rivalAlpha.energy);
                arenaState.rivalAlpha.radius = TORSOS[safeRivalBp.torsoId].sizePx * 0.44;
                syncOrganismMaturity(arenaState.rivalAlpha, false);
              } else if (msg.type === 'SAMPLE_REJOIN' && !isFinalPhaseLockout()) {
                const shoalX = arenaState.genesisShoal ? arenaState.genesisShoal.x + 80 : WORLD_W * 0.55;
                const shoalY = arenaState.genesisShoal ? arenaState.genesisShoal.y : WORLD_H * 0.5;
                const rebornRival = spawnOrganismEntity(safeRivalBp, shoalX, shoalY, 'enemy', {
                  colonyId: 'rival_colony',
                  isAlpha: false,
                  hpRatio: 1.0,
                  energyRatio: 0.90,
                  spawnShieldSec: 5.0
                });
                arenaState.rivalAlpha = rebornRival;
                arenaState.organisms.push(rebornRival);
              }
            }
          };
          lanSession.onReliable(onMsg);
          lanSession.onFast(onMsg);
          lanSession.onStatus((st) => {
            syncLobbyLanBadges(st);
            renderLobbyRoomList();
          });
          lanSession.onRooms(() => renderLobbyRoomList());
        }
        syncLobbyLanBadges();
      }

      function renderLobbyPage() {
        const pickerEl = document.getElementById('lobby-species-picker');
        const allChoices = [...playerGeneBank, ...officialFossils];
        if (!allChoices.some((s) => s.speciesId === selectedLobbySpeciesId) && allChoices.length > 0) {
          selectedLobbySpeciesId = allChoices[0].speciesId;
        }
        if (pickerEl) {
          pickerEl.innerHTML = allChoices.map((s) => {
            const tag = s.origin === 'official_fossil' ? '[化石]' : '[基因库]';
            return `<option value="${s.speciesId}" ${s.speciesId === selectedLobbySpeciesId ? 'selected' : ''}>${tag} ${s.speciesName}</option>`;
          }).join('');
        }

        const chosen = allChoices.find((s) => s.speciesId === selectedLobbySpeciesId) || allChoices[0];
        if (chosen) {
          const torso = TORSOS[chosen.torsoId];
          const imgEl = document.getElementById('lobby-selected-sp-img');
          if (imgEl) imgEl.src = `../assets/micro-genesis/sprites/${torso.sprite}`;
          const nameEl = document.getElementById('lobby-selected-sp-name');
          if (nameEl) nameEl.textContent = chosen.speciesName;
          const metaEl = document.getElementById('lobby-selected-sp-meta');
          if (metaEl) metaEl.textContent = `${torso.code} ${torso.name} · 估值 ${chosen.statsSummary.totalGpCost} GP`;
        }

        const biomeListEl = document.getElementById('lobby-biome-list');
        if (biomeListEl) {
          biomeListEl.innerHTML = '';
          BIOMES.forEach((b) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'torso-btn' + (b.id === selectedBiomeId ? ' active' : '');
            btn.innerHTML = `
              <span class="t-name">${b.name}</span>
              <span class="t-sub">${b.era || b.sub}</span>
            `;
            btn.addEventListener('click', () => {
              selectedBiomeId = b.id;
              const descEl = document.getElementById('lobby-biome-desc');
              if (descEl) descEl.textContent = b.desc;
              NexusSDK.audio.tap();
              renderLobbyPage();
            });
            biomeListEl.appendChild(btn);
          });
          const activeBiomeObj = BIOMES.find((b) => b.id === selectedBiomeId) || BIOMES[0];
          const descEl = document.getElementById('lobby-biome-desc');
          if (descEl && activeBiomeObj) descEl.textContent = activeBiomeObj.desc;
        }

        renderLobbyRoomList();
      }

      function renderLobbyRoomList(force) {
        const listEl = document.getElementById('lobby-room-list');
        if (!listEl) return;
        if (!lanSession) initLanHostSession();
        const rooms = lanSession.getAvailableRooms();
        const sig = JSON.stringify(rooms.map((r) => [r.roomCode, r.players, r.isSelfHost, r.isCurrentJoined, r.isConnecting, r.rttMs]));
        if (!force && sig === lobbyRoomSig && listEl.childElementCount > 0) return;
        lobbyRoomSig = sig;
        if (rooms.length === 0) {
          listEl.innerHTML = `<div style="font-size:0.64rem;color:var(--mg-text-secondary);padding:6px 2px;">暂无已发现的房间。同设备其他窗口建房后会实时出现；跨手机联机请在第二层菜单「⑥ 局域网管理」使用离线握手码。</div>`;
          return;
        }
        listEl.innerHTML = rooms.map((rm) => {
          const isJoined = rm.isCurrentJoined;
          const isSelf = rm.isSelfHost;
          const rtt = Number.isFinite(rm.rttMs) ? `${rm.rttMs}ms` : '加入后实测';
          const full = !isSelf && !isJoined && rm.players === '2/2';
          const label = isJoined ? '已连入' : rm.isConnecting ? '握手中' : isSelf ? '本机房主' : (full ? '已满' : '加入');
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(3,24,28,0.75);border:1px solid ${isJoined ? 'var(--mg-accent-cyan)' : 'var(--mg-border-subtle)'};">
              <div style="min-width:0;flex:1;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--mg-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  <span style="color:var(--mg-accent-cyan);font-family:Consolas,monospace;">[${NexusSDK.escapeHtml ? NexusSDK.escapeHtml(rm.roomCode) : rm.roomCode}]</span> ${NexusSDK.escapeHtml ? NexusSDK.escapeHtml(rm.title) : rm.title}
                </div>
                <div style="font-size:0.6rem;color:var(--mg-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  房主: ${NexusSDK.escapeHtml ? NexusSDK.escapeHtml(rm.hostName) : rm.hostName} · <span style="color:var(--mg-accent-emerald);">${rm.players} (${rtt})</span>
                </div>
              </div>
              <button type="button" class="btn-ghost" data-lobby-join-code="${rm.roomCode}" ${(rm.isConnecting || full) ? 'disabled' : ''} style="min-height:44px;padding:0 10px;font-size:0.66rem;white-space:nowrap;border-color:${isJoined ? 'var(--mg-accent-emerald)' : 'var(--mg-accent-cyan)'};color:${isJoined ? 'var(--mg-accent-emerald)' : 'var(--mg-accent-cyan)'};">
                ${label}
              </button>
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('[data-lobby-join-code]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const targetCode = btn.getAttribute('data-lobby-join-code');
            if (!targetCode) return;
            const st = lanSession.getStatus();
            if ((st.role === 'host' && st.roomCode === targetCode) || (st.connected && st.roomCode === targetCode)) {
              NexusSDK.audio.tap();
              showToast(st.connected ? '已在该房间内，可直接出击' : '这是本机房间，等待客机加入');
              return;
            }
            NexusSDK.audio.tap();
            lanSession.joinRoom(targetCode, 'client');
            showToast('正在与房间 ' + targetCode + ' 握手...');
            renderLobbyRoomList(true);
          });
        });
      }

      document.getElementById('lobby-species-picker')?.addEventListener('change', (e) => {
        selectedLobbySpeciesId = e.target.value;
        NexusSDK.audio.tap();
        renderLobbyPage();
      });

      document.getElementById('lobby-create-room-btn')?.addEventListener('click', () => {
        if (!lanSession) initLanHostSession();
        lanSession.leave();
        NexusSDK.audio.upgrade();
        showToast('已在房主移动端建立局域网房间：' + lanSession.getRoomCode());
        renderLobbyRoomList(true);
      });

      document.getElementById('lobby-refresh-rooms-btn')?.addEventListener('click', () => {
        if (lanSession) lanSession.refreshRooms();
        NexusSDK.audio.tap();
        renderLobbyRoomList(true);
        showToast('已刷新局域网可加入房间列表');
      });

      document.getElementById('lobby-launch-arena-btn')?.addEventListener('click', () => {
        startArenaMatch();
        switchPage('arena');
      });

      /* =====================================================================
       * 9. 页面 6：游戏画面 (#page-arena) 核心微观生态沙盘仿真引擎 (2800 × 1800)
       * ===================================================================== */
      const WORLD_W = 2800;
      const WORLD_H = 1800;
      const PHEROMONE_MODES = ['forage', 'guard', 'hunt'];

      const arenaState = {
        running: false,
        matchMode: 'pve_campaign',
        gpRule: 'standard',
        biome: BIOMES[0],
        timeSec: 0,
        lastTickMs: 0,
        lastAlgaeSpawnSec: 0,
        lastLanSyncSec: 0,
        pheromoneIdx: 0,
        showSensoryOverlay: true,
        intraSpeciesCd: 0,
        crossTorsoCd: 0,
        playerFullBlueprint: null,
        playerActiveBlueprint: null,
        alpha: null,
        rivalAlpha: null,
        organisms: [],
        foods: [],
        vents: [],
        territories: [],
        projectiles: [],
        hazards: [],
        pointerDown: false,
        pointerWorldX: WORLD_W * 0.5,
        pointerWorldY: WORLD_H * 0.5,
        drawerDraft: null,
        drawerSelectedGbId: '',
        pendingCrossTorsoTarget: null,
        unlockedTorsos: new Set(['torso-t1-micro']),
        unlockedOrganLevels: new Map()
      };

      function getBlueprintOrganEntries(bp) {
        if (!bp || !bp.slots) return [];
        const list = [{ key: `core:0:${bp.slots.core.id}`, id: bp.slots.core.id, level: bp.slots.core.level }];
        ['sensory', 'mouth', 'locomotion', 'utility'].forEach((cat) => {
          (bp.slots[cat] || []).forEach((s, idx) => {
            list.push({ key: `${cat}:${idx}:${s.id}`, id: s.id, level: s.level });
          });
        });
        return list;
      }

      function recordBlueprintUnlocked(bp) {
        if (!bp) return;
        arenaState.unlockedTorsos.add(bp.torsoId);
        getBlueprintOrganEntries(bp).forEach((entry) => {
          const prevLv = arenaState.unlockedOrganLevels.get(entry.key) || 0;
          if (entry.level > prevLv) {
            arenaState.unlockedOrganLevels.set(entry.key, entry.level);
          }
        });
      }

      function computeBlueprintDeltaGp(targetBp) {
        if (!targetBp || arenaState.matchMode === 'free_sandbox') return 0;
        let delta = 0;
        const tSpec = TORSOS[targetBp.torsoId];
        if (tSpec && !arenaState.unlockedTorsos.has(targetBp.torsoId)) {
          delta += tSpec.transitionGp || 0;
        }
        getBlueprintOrganEntries(targetBp).forEach((entry) => {
          const unlockedLv = arenaState.unlockedOrganLevels.get(entry.key) || 0;
          if (entry.level > unlockedLv) {
            const cat = ORGAN_CATALOG[entry.id];
            if (cat && cat.levels) {
              const targetCost = cat.levels[entry.level]?.gp || 0;
              const unlockedCost = unlockedLv > 0 ? (cat.levels[unlockedLv]?.gp || 0) : 0;
              delta += Math.max(0, targetCost - unlockedCost);
            }
          }
        });
        return delta;
      }

      function makeStarterLv1Blueprint(fullBp) {
        const clone = JSON.parse(JSON.stringify(fullBp));
        clone.torsoId = 'torso-t1-micro';
        clone.slots.core.level = 1;
        clone.slots.sensory = clone.slots.sensory.slice(0, 1).map((s) => ({ id: s.id, level: 1 }));
        clone.slots.mouth = clone.slots.mouth.slice(0, 1).map((m) => ({ id: m.id, level: 1 }));
        clone.slots.locomotion = clone.slots.locomotion.slice(0, 1).map((l) => ({ id: l.id, level: 1 }));
        clone.slots.utility = clone.slots.utility.slice(0, 1).map((u) => ({ id: u.id, level: 1 }));
        return validateAndSanitizeBlueprint(clone);
      }

      // 同步幼体发育进度 (maturity ∈ [0, 1]) 对体型半径、最大生命值与当前生命值的动态插值
      function syncOrganismMaturity(org, isInitialSpawn = false) {
        if (!org || !org.blueprint) return;
        const st = org.blueprint.statsSummary;
        const torso = TORSOS[org.blueprint.torsoId] || TORSOS['torso-t2-stream'];
        const adultRadius = (torso.sizePx * 0.44) * (org.isBoss ? 1.35 : 1.0);
        const adultMaxHp = st.maxHp * (org.isBoss ? 2.4 : 1.0);
        const m = org.maturity !== undefined ? Math.max(0, Math.min(1, org.maturity)) : 1.0;

        if (m >= 1.0) {
          org.maturity = 1.0;
          org.isJuvenile = false;
          org.growthScale = 1.0;
          if (org.maxHp < adultMaxHp) {
            const diffHp = adultMaxHp - org.maxHp;
            org.maxHp = adultMaxHp;
            org.hp = Math.min(adultMaxHp, org.hp + diffHp);
          }
          org.radius = adultRadius;
          return;
        }

        org.isJuvenile = true;
        const startScale = st.juvenileStartScale || 0.65;
        const minHpMult = st.juvenileMinHpMult || 0.50;
        org.growthScale = +(startScale + (1.0 - startScale) * m).toFixed(3);
        org.radius = +(adultRadius * org.growthScale).toFixed(2);
        const targetMaxHp = Math.max(8, Math.round(adultMaxHp * (minHpMult + (1.0 - minHpMult) * m)));
        if (isInitialSpawn) {
          org.maxHp = targetMaxHp;
          org.hp = targetMaxHp;
        } else if (targetMaxHp > org.maxHp) {
          const gainedMaxHp = targetMaxHp - org.maxHp;
          org.maxHp = targetMaxHp;
          org.hp = Math.min(targetMaxHp, org.hp + gainedMaxHp);
        } else if (targetMaxHp < org.maxHp) {
          const hpRatio = org.maxHp > 0 ? Math.min(1, org.hp / org.maxHp) : 1;
          org.maxHp = targetMaxHp;
          org.hp = Math.max(1, Math.round(targetMaxHp * hpRatio));
        }
      }

      // 幼体进食加速发育：吞食通用营养质/微藻/肉块获得能量时，同步催化幼体成熟
      function accelerateJuvenileGrowth(org, gainE) {
        if (!org || org.maturity === undefined || org.maturity >= 1.0 || gainE <= 0) return;
        const wasJuvenile = org.maturity < 1.0;
        const feedBoost = (gainE / Math.max(40, org.maxEnergy)) * 0.55;
        org.maturity = Math.min(1.0, org.maturity + feedBoost);
        syncOrganismMaturity(org, false);
        if (wasJuvenile && org.maturity >= 1.0 && org.colonyId === 'player_colony') {
          NexusSDK.audio.upgrade();
        }
      }

      function spawnOrganismEntity(bp, x, y, faction, opts = {}) {
        const st = bp.statsSummary;
        const torso = TORSOS[bp.torsoId];
        const isJuv = Boolean(opts.isJuvenile);
        const initMaturity = isJuv ? (opts.maturity !== undefined ? opts.maturity : 0.0) : 1.0;
        const ent = {
          id: 'ent_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          x: Math.max(60, Math.min(WORLD_W - 60, x)),
          y: Math.max(60, Math.min(WORLD_H - 60, y)),
          vx: 0,
          vy: 0,
          angle: Math.random() * Math.PI * 2,
          targetAngle: 0,
          radius: torso.sizePx * 0.44,
          faction,
          colonyId: opts.colonyId || faction,
          isAlpha: Boolean(opts.isAlpha),
          isBoss: Boolean(opts.isBoss),
          formerKin: Boolean(opts.formerKin),
          isJuvenile: isJuv,
          maturity: initMaturity,
          growthScale: 1.0,
          blueprint: bp,
          hp: st.maxHp * (opts.hpRatio ?? 1.0),
          maxHp: st.maxHp,
          energy: st.maxEnergy * (opts.energyRatio ?? 0.85),
          maxEnergy: st.maxEnergy,
          skillCd: 0,
          biteCd: 0,
          reproCd: 0,
          mimicTimer: 0,
          blindTimer: 0,
          stunTimer: 0,
          slowTimer: 0,
          iceShieldTimer: 0,
          bossSplitDone: false,
          poisonTimer: 0,
          poisonDps: 0,
          suppressedTimer: 0,
          squashTimer: 0,
          // 5.0 秒【破膜适应期】初生免疫护膜 (仅赋予新降生的始祖个体，主动攻击立即解除)
          spawnShieldTimer: opts.spawnShieldSec !== undefined ? opts.spawnShieldSec : (opts.isAlpha ? 5.0 : 0),
          // 生态位 NPC 智能角色系统：领主智能 (apex) | 狼群协同智能 (pack) | 羊群群居智能 (herd)
          nicheRole: (function() {
            if (opts.nicheRole) return opts.nicheRole;
            if (opts.isBoss || (bp.dietType === 'carnivore' && torso.sizePx >= 38)) return 'apex';
            if (bp.dietType === 'herbivore') return 'herd';
            return 'pack';
          })(),
          territoryCenter: opts.territoryCenter || { x, y, radius: 460 },
          territoryAngle: Math.random() * Math.PI * 2,
          packFlankAngle: (Math.random() < 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.35),
          hitAndRunTimer: 0,
          herdPanicTimer: 0,
          herdPanicTarget: null,
          assimilatedOrgans: [], // Boss 4 双槽 FIFO 12.0s 同化队列
          hatredMap: new Map(),
          phaseOffset: Math.random() * Math.PI * 2,
          sonarLastSeenX: x,
          sonarLastSeenY: y,
          sonarRelX: null,
          sonarRelY: null,
          sonarSnapAngle: 0,
          sonarSnapPhase: 0,
          sonarDetectedCycle: -1,
          sonarLastPulseSec: -10
        };
        if (isJuv) {
          syncOrganismMaturity(ent, true);
        }
        return ent;
      }

      // 辅助函数：将野生捕食者/领主坐标约束在【起源浅滩 (Genesis Shoal)】安全半径之外
      function clampOutsideGenesisShoal(x, y, minDistFromCenter = 560) {
        const cx = WORLD_W * 0.5;
        const cy = WORLD_H * 0.5;
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d >= minDistFromCenter) return { x, y };
        const ang = d > 1 ? Math.atan2(dy, dx) : (Math.random() * Math.PI * 2);
        return {
          x: Math.max(90, Math.min(WORLD_W - 90, cx + Math.cos(ang) * minDistFromCenter)),
          y: Math.max(90, Math.min(WORLD_H - 90, cy + Math.sin(ang) * minDistFromCenter))
        };
      }

      function spawnAlgaeCluster(cx, cy, count) {
        for (let i = 0; i < count; i++) {
          if (arenaState.foods.length >= 260) break;
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * 110;
          arenaState.foods.push({
            id: 'f_' + Math.random(),
            type: 'algae',
            x: Math.max(40, Math.min(WORLD_W - 40, cx + Math.cos(ang) * dist)),
            y: Math.max(40, Math.min(WORLD_H - 40, cy + Math.sin(ang) * dist)),
            energy: 14.3,
            radius: 8,
            sourceColonyId: null,
            ttl: 95
          });
        }
      }

      // 【起源浅滩 (Genesis Shoal)】专属：生成适应所有食性（植食/肉食/杂食均可高效吸收）的通用【原生营养质 (Universal Nutrient)】
      function spawnNutrientCluster(cx, cy, count) {
        for (let i = 0; i < count; i++) {
          if (arenaState.foods.length >= 260) break;
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * 210;
          arenaState.foods.push({
            id: 'nut_' + Math.random(),
            type: 'nutrient',
            x: Math.max(40, Math.min(WORLD_W - 40, cx + Math.cos(ang) * dist)),
            y: Math.max(40, Math.min(WORLD_H - 40, cy + Math.sin(ang) * dist)),
            energy: 16.5,
            radius: 8.5,
            sourceColonyId: null,
            ttl: 115
          });
        }
      }

      function startArenaMatch() {
        ensureCustomerSampleSlots();
        const chosen = playerGeneBank[selectedSampleSlotIdx] || playerGeneBank[0] || officialFossils[0];
        const modeSel = document.getElementById('lobby-match-mode');
        const gpSel = document.getElementById('lobby-gp-rule');
        arenaState.matchMode = modeSel ? modeSel.value : 'pve_campaign';
        arenaState.gpRule = gpSel ? gpSel.value : 'apex';
        arenaState.biome = BIOMES[selectedBiomeId] || BIOMES[0];
        arenaState.timeSec = 0;
        arenaState.matchDurationSec = 180;
        arenaState.timeLeftSec = 180;
        arenaState.finalPhaseSec = 30;
        arenaState.finalPhaseAnnounced = false;
        arenaState.matchEnded = false;
        arenaState.waitingForRejoin = false;
        arenaState.activeSampleSlotIdx = selectedSampleSlotIdx;
        arenaState.rejoinSelectedSlotIdx = selectedSampleSlotIdx;
        arenaState.sampleSwitchCd = 0;
        arenaState.lastAlgaeSpawnSec = 0;
        arenaState.lastLanSyncSec = 0;
        arenaState.intraSpeciesCd = 0;
        arenaState.crossTorsoCd = 0;
        arenaState.organisms = [];
        arenaState.foods = [];
        arenaState.projectiles = [];
        arenaState.hazards = [];
        arenaState.vents = [];
        arenaState.territories = [];
        document.getElementById('arena-rejoin-modal')?.classList.remove('open');
        document.getElementById('arena-settlement-modal')?.classList.remove('open');

        // 【起源浅滩 (Genesis Shoal)】：位于培养皿中央的新物种摇篮生态庇护区 (半径 340px，阻挡野生捕食者与首领入内)
        arenaState.genesisShoal = {
          name: '起源浅滩 (Genesis Shoal)',
          x: WORLD_W * 0.5,
          y: WORLD_H * 0.5,
          radius: 340
        };

        // 铁律：对局内禁止生物编辑，直接使用客户储存的完整样本出战，并支持局内切换样本
        arenaState.playerFullBlueprint = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(chosen)));
        arenaState.playerActiveBlueprint = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(chosen)));
        arenaState.unlockedTorsos = new Set([arenaState.playerActiveBlueprint.torsoId]);
        arenaState.unlockedOrganLevels = new Map();
        recordBlueprintUnlocked(arenaState.playerActiveBlueprint);

        // 生成 8 处海底热泉喷口 (Hydrothermal Vents)
        for (let i = 0; i < 8; i++) {
          arenaState.vents.push({
            x: 320 + (i % 4) * 720 + (Math.random() - 0.5) * 140,
            y: 380 + Math.floor(i / 4) * 980 + (Math.random() - 0.5) * 140,
            radius: 56
          });
        }

        // 生成 12 处外围生态群落领地 (Ecological Territories，避开中央起源浅滩)
        for (let i = 0; i < 12; i++) {
          const rawTx = 240 + (i % 4) * 760;
          const rawTy = 260 + Math.floor(i / 4) * 640;
          const safePos = clampOutsideGenesisShoal(rawTx, rawTy, 580);
          arenaState.territories.push({
            x: safePos.x,
            y: safePos.y,
            radius: 420,
            ownerColony: null
          });
        }

        // 开局在中央【起源浅滩】内生成 1 只玩家控制的客户样本始祖个体 Alpha，附带 5.0s【破膜适应期】
        const alpha = spawnOrganismEntity(arenaState.playerActiveBlueprint, arenaState.genesisShoal.x, arenaState.genesisShoal.y, 'player', {
          colonyId: 'player_colony',
          isAlpha: true,
          hpRatio: 1.0,
          energyRatio: 0.90,
          spawnShieldSec: 5.0
        });
        arenaState.alpha = alpha;
        arenaState.organisms.push(alpha);

        // 初始局部食物群落（【起源浅滩】内部富集全食性通用【原生营养质】，适配植食/肉食/杂食一切新生始祖）
        arenaState.vents.forEach((v) => spawnAlgaeCluster(v.x, v.y, 12));
        spawnNutrientCluster(arenaState.genesisShoal.x, arenaState.genesisShoal.y, 24);
        spawnAlgaeCluster(alpha.x + 150, alpha.y - 110, 10);

        // 生成野生生态种群与章节首领
        const wildPool = [
          ...officialFossils,
          ...playerGeneBank.filter((s) => s.wildEnabled && s.speciesId !== chosen.speciesId)
        ];
        for (let i = 0; i < 18; i++) {
          const ringIdx = i % 4;
          const wBp = ringIdx <= 1 ? officialFossils[0] : wildPool[i % wildPool.length];
          const isHerb = wBp.dietType === 'herbivore';
          const dist = isHerb ? (ringIdx === 0 ? 230 : 310) : (580 + (i % 3) * 210);
          const ang = (i / 18) * Math.PI * 2;
          let wx = WORLD_W * 0.5 + Math.cos(ang) * dist;
          let wy = WORLD_H * 0.5 + Math.sin(ang) * dist;
          if (!isHerb) {
            const safeW = clampOutsideGenesisShoal(wx, wy, 580);
            wx = safeW.x;
            wy = safeW.y;
          }
          const terr = arenaState.territories[i % arenaState.territories.length];
          arenaState.organisms.push(spawnOrganismEntity(wBp, wx, wy, 'wild', {
            colonyId: 'wild_' + wBp.speciesId,
            territoryCenter: { x: terr ? terr.x : wx, y: terr ? terr.y : wy, radius: 440 }
          }));
        }

        // 生成关底史诗首领 (Boss，属于顶级领主 apex，驻守远端深渊领地)
        const bossBp = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(officialFossils[Math.min(4, selectedBiomeId)])));
        bossBp.speciesName = EPIC_BOSSES[selectedBiomeId].name.split(' ')[1] || '远古首领';
        const bossPos = clampOutsideGenesisShoal(WORLD_W * 0.80, WORLD_H * 0.25, 720);
        const bossEnt = spawnOrganismEntity(bossBp, bossPos.x, bossPos.y, 'enemy', {
          colonyId: 'boss_colony',
          isBoss: true,
          nicheRole: 'apex',
          territoryCenter: { x: bossPos.x, y: bossPos.y, radius: 520 }
        });
        bossEnt.maxHp *= 2.4;
        bossEnt.hp = bossEnt.maxHp;
        bossEnt.radius *= 1.35;
        arenaState.organisms.push(bossEnt);
        arenaState.rivalAlpha = bossEnt;

        arenaState.running = true;
        arenaState.lastTickMs = performance.now();

        syncArenaHudButtons();
        renderArenaSampleSwitcher();
        updateMatchTimerAndScoreboard(0);
        resizeArenaCanvas();
        showToast(`限时演化对局开启 (03:00)！当前投放样本 #${selectedSampleSlotIdx + 1}【${chosen.speciesName}】，按控制的种群营养总和决胜负`);
      }

      function syncArenaHudButtons() {
        const alpha = arenaState.alpha;
        if (!alpha) return;
        const bp = alpha.blueprint;
        const st = bp.statsSummary;

        // 同步感官图标
        const fovImg = document.getElementById('fov-btn-organ-img');
        if (fovImg) {
          const s0 = bp.slots.sensory[0];
          const sSpec = ORGAN_CATALOG[s0.id].levels[s0.level];
          fovImg.src = `../assets/micro-genesis/sprites/${sSpec.sprite}`;
        }

        // 同步主动技能图标
        const skillImg = document.getElementById('skill-btn-organ-img');
        if (skillImg) {
          const skSprite = st.activeSkill ? st.activeSkill.sprite : ORGAN_CATALOG[bp.slots.utility[0].id].levels[bp.slots.utility[0].level].sprite;
          skillImg.src = `../assets/micro-genesis/sprites/${skSprite}`;
        }

        // 同步分裂繁殖核心图标
        const mitImg = document.getElementById('mitosis-btn-organ-img');
        if (mitImg) {
          const cSpec = ORGAN_CATALOG[bp.slots.core.id].levels[bp.slots.core.level];
          mitImg.src = `../assets/micro-genesis/sprites/${cSpec.sprite}`;
        }
      }

      /* =====================================================================
       * 10. 局内主动技能、分裂繁殖与【存入基因库】/【加载基因库】核心法则
       * ===================================================================== */
      function triggerEntityActiveSkill(ent) {
        if (!ent || ent.hp <= 0 || ent.stunTimer > 0) return;
        if (ent.energy <= 0) {
          if (ent === arenaState.alpha) {
            NexusSDK.audio.warn();
            showToast('重度饥饿衰竭中，无法释放主动技能！');
          }
          return;
        }
        let sk = getEffectiveStats(ent).activeSkill;
        // 第四章首领【千目原质母体】优先或交替使用已同化器官的主动技能
        if (ent.assimilatedOrgans && ent.assimilatedOrgans.length > 0) {
          const latestAssim = ent.assimilatedOrgans[ent.assimilatedOrgans.length - 1];
          const assimSpec = ORGAN_CATALOG[latestAssim.id]?.levels?.[latestAssim.level];
          if (assimSpec && assimSpec.skill) {
            sk = {
              type: assimSpec.skill,
              organId: latestAssim.id,
              level: latestAssim.level,
              sprite: assimSpec.sprite,
              cost: assimSpec.skillCost,
              cd: assimSpec.skillCd,
              spec: assimSpec
            };
          }
        }
        if (!sk) {
          if (ent === arenaState.alpha) showToast('当前物种未装配主动技能器官');
          return;
        }
        if (ent.skillCd > 0) return;
        if (ent.energy < sk.cost) {
          if (ent === arenaState.alpha) {
            NexusSDK.audio.warn();
            showToast('能量不足，无法释放器官主动技！');
          }
          return;
        }

        ent.energy -= sk.cost;
        ent.skillCd = sk.cd;

        if (sk.type === 'jetdash') {
          ent.vx += Math.cos(ent.angle) * 340;
          ent.vy += Math.sin(ent.angle) * 340;
          NexusSDK.audio.shoot();
        } else if (sk.type === 'sidestep') {
          const sideAng = ent.angle + (Math.random() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5);
          ent.vx += Math.cos(sideAng) * 290;
          ent.vy += Math.sin(sideAng) * 290;
          NexusSDK.audio.tap();
        } else if (sk.type === 'mimic') {
          ent.mimicTimer = sk.spec.mimicDur || 8.0;
          NexusSDK.audio.pop();
        } else if (sk.type === 'ink') {
          arenaState.hazards.push({
            type: 'ink',
            x: ent.x - Math.cos(ent.angle) * ent.radius,
            y: ent.y - Math.sin(ent.angle) * ent.radius,
            radius: sk.spec.inkR || 140,
            ttl: sk.spec.inkDur || 5.0,
            ownerColony: ent.colonyId
          });
          NexusSDK.audio.pop();
        } else if (sk.type === 'venom') {
          ent.spawnShieldTimer = 0;
          arenaState.hazards.push({
            type: 'venom',
            x: ent.x,
            y: ent.y,
            radius: 125,
            dps: sk.spec.dot || 9,
            dotDur: sk.spec.dotDur || 5.0,
            ttl: 4.5,
            ownerColony: ent.colonyId,
            ownerId: ent.id
          });
          NexusSDK.audio.laser();
        } else if (sk.type === 'spike') {
          ent.spawnShieldTimer = 0;
          const count = sk.spec.spikeCount || 1;
          for (let i = 0; i < count; i++) {
            const spread = count === 1 ? 0 : (i - (count - 1) * 0.5) * 0.16;
            const ang = ent.angle + spread;
            arenaState.projectiles.push({
              x: ent.x + Math.cos(ang) * (ent.radius + 8),
              y: ent.y + Math.sin(ang) * (ent.radius + 8),
              vx: Math.cos(ang) * 440,
              vy: Math.sin(ang) * 440,
              dmg: sk.spec.spikeDmg || 18,
              ttl: (sk.spec.spikeRange || 280) / 440,
              ownerColony: ent.colonyId,
              ownerIsAlpha: ent.isAlpha
            });
          }
          NexusSDK.audio.shoot();
        } else if (sk.type === 'electric') {
          ent.spawnShieldTimer = 0;
          const elecR = sk.spec.elecR || 140;
          arenaState.hazards.push({
            type: 'electric',
            x: ent.x,
            y: ent.y,
            radius: elecR,
            ttl: 0.35,
            ownerColony: ent.colonyId
          });
          arenaState.organisms.forEach((other) => {
            if (other.hp > 0 && other.colonyId !== ent.colonyId) {
              const d = Math.hypot(other.x - ent.x, other.y - ent.y);
              if (d <= elecR + other.radius) {
                applyDamage(other, sk.spec.elecDmg || 28, ent);
                other.stunTimer = Math.max(other.stunTimer, sk.spec.stunSec || 1.2);
              }
            }
          });
          NexusSDK.audio.laser();
        }
      }

      // 分裂繁殖同族电脑 NPC 后代 (大型物种 T02~T04 拥有更高能量门槛、更高繁衍能耗、更长繁衍冷却与更严生态承载上限；分裂出的后代需经历幼体发育期)
      function tryMitosisReproduce(parent) {
        if (!parent || parent.hp <= 0) return false;
        if (parent.maturity !== undefined && parent.maturity < 1.0) {
          if (parent === arenaState.alpha) {
            NexusSDK.audio.warn();
            showToast(`当前个体尚处于幼体发育期 (${Math.round(parent.maturity * 100)}%)，成年后方可分裂繁衍！`);
          }
          return false;
        }
        const st = parent.blueprint.statsSummary;
        if (parent.reproCd && parent.reproCd > 0) {
          if (parent === arenaState.alpha) {
            NexusSDK.audio.warn();
            showToast(`大型躯干细胞分裂恢复中 (${parent.reproCd.toFixed(1)}s)！`);
          }
          return false;
        }
        const reqRatio = st.reproThreshold || 0.80;
        const needE = parent.maxEnergy * reqRatio;
        if (parent.energy < needE) {
          if (parent === arenaState.alpha) {
            NexusSDK.audio.warn();
            showToast(`能量需达到 ${Math.round(reqRatio * 100)}% 上限方可分裂繁殖同族 NPC（单次扣除 ${Math.round(st.reproRatio * 100)}% MaxE）！`);
          }
          return false;
        }

        // 检查同族配额上限 (按躯干层级动态限制：T01=20, T02=14, T03=8, T04=4，防止巨型物种泛滥破坏生态)
        const myColonyCount = arenaState.organisms.filter((o) => o.colonyId === parent.colonyId && !o.formerKin).length;
        const torsoPopCap = st.maxColonyPop || 20;
        const maxColonyCap = Math.min(torsoPopCap, arenaState.matchMode === 'lan_2v2' ? 12 : 20);
        if (myColonyCount >= maxColonyCap || arenaState.organisms.length >= 64) {
          if (parent === arenaState.alpha) showToast(`当前体型物种已达生态承载上限（最多 ${maxColonyCap} 只）！`);
          return false;
        }

        parent.energy = Math.max(0, parent.energy - parent.maxEnergy * st.reproRatio);
        parent.reproCd = st.reproCooldown || 4.0;
        const childX = parent.x - Math.cos(parent.angle) * (parent.radius * 2.1);
        const childY = parent.y - Math.sin(parent.angle) * (parent.radius * 2.1);
        const child = spawnOrganismEntity(parent.blueprint, childX, childY, parent.faction, {
          colonyId: parent.colonyId,
          isAlpha: false,
          isJuvenile: true,
          hpRatio: 1.0,
          energyRatio: st.childERatio
        });
        arenaState.organisms.push(child);

        if (parent.colonyId === 'player_colony') {
          const newPop = myColonyCount + 1;
          arenaState.playerFullBlueprint.records.maxPopulation = Math.max(arenaState.playerFullBlueprint.records.maxPopulation, newPop);
          NexusSDK.audio.pickup();
          if (parent === arenaState.alpha) {
            showToast(`分裂成功！诞生 1 只同族幼体（发育时长 ${st.growDurationSec}s，进食可加速成年 · 当前种群 ${newPop} 只）`);
          }
        }
        return true;
      }

      /* =====================================================================
       * 10.B 局内客户储存样本切换栏、中途死亡再次加入 (最后阶段禁止复活) 与限时种群营养物质总和胜负结算
       * ===================================================================== */
      function formatSecondsMmSs(sec) {
        const s = Math.max(0, Math.ceil(sec));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
      }

      function isFinalPhaseLockout() {
        return (arenaState.timeLeftSec !== undefined ? arenaState.timeLeftSec : 180) <= (arenaState.finalPhaseSec || 30);
      }

      // 渲染对局画面底部的【客户储存样本切换栏】(#arena-sample-switcher —— 游戏期间禁止生物编辑，仅可切换客户储存的样本)
      function renderArenaSampleSwitcher() {
        const barEl = document.getElementById('arena-sample-switcher');
        if (!barEl) return;
        ensureCustomerSampleSlots();
        const inFinal = isFinalPhaseLockout();
        barEl.innerHTML = '';

        for (let i = 0; i < maxSampleSlots; i++) {
          const sp = playerGeneBank[i];
          if (!sp) continue;
          const t = TORSOS[sp.torsoId] || TORSOS['torso-t1-micro'];
          const dietTag = sp.dietType === 'herbivore' ? '植食' : (sp.dietType === 'carnivore' ? '肉食' : '杂食');
          const isActive = i === arenaState.activeSampleSlotIdx;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sample-slot-pill' + (isActive ? ' active' : '');
          btn.disabled = Boolean(arenaState.waitingForRejoin && inFinal);
          btn.title = inFinal && arenaState.waitingForRejoin
            ? '最后30秒决胜阶段禁止复活投放'
            : `切换为客户样本 #${i + 1}：${sp.speciesName} (${t.code} · ${dietTag})`;
          btn.innerHTML = `
            <img src="../assets/micro-genesis/sprites/${t.sprite}" alt="" />
            <div class="sample-slot-info">
              <span class="sample-slot-name">#${i + 1} ${escapeHtml(sp.speciesName)}</span>
              <span class="sample-slot-sub">${t.code} · ${dietTag} · ${computeBlueprintBaseNutrients(sp)}质</span>
            </div>
          `;
          btn.addEventListener('click', () => {
            switchArenaSample(i);
          });
          barEl.appendChild(btn);
        }
      }

      // 局内切换客户储存的样本 (存活时立即切换受控样本表型并保留场上同族；中途死亡且非最后阶段时直接投放该样本重返战场)
      function switchArenaSample(slotIdx) {
        if (arenaState.matchEnded) return;
        ensureCustomerSampleSlots();
        const targetRaw = playerGeneBank[slotIdx];
        if (!targetRaw) return;

        // 若当前处于中途阵亡等待再次加入状态：
        if (arenaState.waitingForRejoin || !arenaState.alpha || arenaState.alpha.hp <= 0) {
          if (isFinalPhaseLockout()) {
            NexusSDK.audio.warn();
            showToast('最后决胜阶段（剩余 ≤30秒）禁止复活！');
            return;
          }
          respawnPlayerWithSample(slotIdx);
          return;
        }

        if (slotIdx === arenaState.activeSampleSlotIdx) {
          NexusSDK.audio.tap();
          showToast(`当前已在使用样本槽 #${slotIdx + 1}：【${targetRaw.speciesName}】`);
          return;
        }
        if (arenaState.sampleSwitchCd > 0) {
          NexusSDK.audio.warn();
          showToast(`样本切换冷却中 (${arenaState.sampleSwitchCd.toFixed(1)}s)`);
          return;
        }

        const targetBp = enforceOwnedBlueprintConstraints(targetRaw, false);
        const newSt = targetBp.statsSummary;
        const alpha = arenaState.alpha;
        const oldTorsoId = alpha.blueprint?.torsoId || 'torso-t1-micro';
        const isSameTorso = targetBp.torsoId === oldTorsoId;
        const reqEnergyRatio = isSameTorso ? 0.25 : 0.40;
        const costEnergyRatio = isSameTorso ? 0.15 : 0.25;

        if (alpha.maxEnergy > 0 && alpha.energy < alpha.maxEnergy * reqEnergyRatio) {
          NexusSDK.audio.warn();
          showToast(`能量低于 ${Math.round(reqEnergyRatio * 100)}%，无法切换样本（防止濒死刷状态）！`);
          return;
        }

        // 严格守恒：绝不凭空抬高生命比例或能量比例，扣除切换代谢成本并保留主动技能冷却
        const hpRatio = alpha.maxHp > 0 ? Math.max(0.02, Math.min(1, alpha.hp / alpha.maxHp)) : 1.0;
        const postCostEnergy = Math.max(2, alpha.energy - alpha.maxEnergy * costEnergyRatio);
        const enRatio = alpha.maxEnergy > 0 ? Math.max(0.02, Math.min(1, postCostEnergy / alpha.maxEnergy)) : 0.50;

        alpha.blueprint = targetBp;
        alpha.maxHp = newSt.maxHp;
        alpha.hp = Math.max(1, Math.round(newSt.maxHp * hpRatio));
        alpha.maxEnergy = newSt.maxEnergy;
        alpha.energy = Math.max(2, Math.round(newSt.maxEnergy * enRatio));
        alpha.radius = TORSOS[targetBp.torsoId].sizePx * 0.44;
        alpha.skillCd = Math.max(alpha.skillCd || 0, 2.0);
        syncOrganismMaturity(alpha, false);

        // 同步场上同族电脑 NPC：同躯干样本排入待蜕皮队列；跨躯干样本剥离旧躯干同族为野生竞争种群 (formerKin = true)
        arenaState.organisms.forEach((org) => {
          if (!org || org.hp <= 0 || org === alpha || org.colonyId !== 'player_colony' || org.formerKin) return;
          if (isSameTorso) {
            org.pendingBlueprint = targetBp;
          } else {
            org.formerKin = true;
            org.colonyId = 'former_kin_colony';
            org.faction = 'wild';
          }
        });

        selectedSampleSlotIdx = slotIdx;
        arenaState.activeSampleSlotIdx = slotIdx;
        arenaState.rejoinSelectedSlotIdx = slotIdx;
        arenaState.playerActiveBlueprint = targetBp;
        arenaState.playerFullBlueprint = targetBp;
        arenaState.sampleSwitchCd = isSameTorso ? 8.0 : 15.0;
        if (lanSession && lanSession.sendReliable) {
          lanSession.sendReliable({ type: 'SAMPLE_SWITCH', slotIdx, blueprint: targetBp });
        }
        persistState();
        syncArenaHudButtons();
        renderArenaSampleSwitcher();
        NexusSDK.audio.upgrade();
        showToast(isSameTorso
          ? `已切换同躯干样本 #${slotIdx + 1}：【${targetBp.speciesName}】（同族后代保留并同步蜕皮）`
          : `已切换跨躯干样本 #${slotIdx + 1}：【${targetBp.speciesName}】（开启新躯干种群演化）`);
      }

      // 中途死亡后选择客户储存样本再次加入战场 (仅限常规阶段 timeLeftSec > 30；最后阶段禁止复活)
      function respawnPlayerWithSample(slotIdx) {
        if (arenaState.matchEnded) return false;
        if (isFinalPhaseLockout()) {
          NexusSDK.audio.warn();
          showToast('最后决胜阶段（剩余 ≤30秒）禁止复活！');
          return false;
        }
        ensureCustomerSampleSlots();
        const idx = (slotIdx !== undefined && playerGeneBank[slotIdx]) ? slotIdx : selectedSampleSlotIdx;
        const targetBp = validateAndSanitizeBlueprint(JSON.parse(JSON.stringify(playerGeneBank[idx] || playerGeneBank[0])));
        selectedSampleSlotIdx = idx;
        arenaState.activeSampleSlotIdx = idx;
        arenaState.rejoinSelectedSlotIdx = idx;
        arenaState.playerActiveBlueprint = targetBp;
        arenaState.playerFullBlueprint = targetBp;

        const shoalX = arenaState.genesisShoal ? arenaState.genesisShoal.x : WORLD_W * 0.5;
        const shoalY = arenaState.genesisShoal ? arenaState.genesisShoal.y : WORLD_H * 0.5;
        const reborn = spawnOrganismEntity(targetBp, shoalX, shoalY, 'player', {
          colonyId: 'player_colony',
          isAlpha: true,
          hpRatio: 1.0,
          energyRatio: 0.90,
          spawnShieldSec: 5.0
        });
        arenaState.alpha = reborn;
        arenaState.organisms.push(reborn);
        arenaState.waitingForRejoin = false;
        if (lanSession && lanSession.sendReliable) {
          lanSession.sendReliable({ type: 'SAMPLE_REJOIN', slotIdx: idx, blueprint: targetBp });
        }
        spawnNutrientCluster(shoalX, shoalY, 10);
        document.getElementById('arena-rejoin-modal')?.classList.remove('open');
        persistState();
        syncArenaHudButtons();
        renderArenaSampleSwitcher();
        NexusSDK.audio.upgrade();
        showToast(`已投放样本 #${idx + 1}【${targetBp.speciesName}】再次加入战场（附带 5 秒破膜保护）！`);
        return true;
      }

      function openMidGameRejoinModal() {
        const modal = document.getElementById('arena-rejoin-modal');
        if (!modal || arenaState.matchEnded) return;
        ensureCustomerSampleSlots();
        const inFinal = isFinalPhaseLockout();
        const titleEl = document.getElementById('rejoin-modal-title');
        const tagEl = document.getElementById('rejoin-modal-timer-tag');
        const descEl = document.getElementById('rejoin-modal-desc');
        const listEl = document.getElementById('rejoin-sample-list');
        const confirmBtn = document.getElementById('btn-rejoin-confirm');
        const settleNowBtn = document.getElementById('btn-rejoin-settle-now');

        if (titleEl) {
          titleEl.textContent = inFinal
            ? '最后决胜阶段 · 禁止复活'
            : '中途阵亡 · 选择客户储存样本再次加入';
          titleEl.style.color = inFinal ? '#f43f5e' : 'var(--mg-accent-cyan)';
        }
        if (tagEl) {
          tagEl.textContent = inFinal
            ? `决胜阶段 (${formatSecondsMmSs(arenaState.timeLeftSec)}) · 禁止复活`
            : `常规阶段 (${formatSecondsMmSs(arenaState.timeLeftSec)}) · 可再次加入`;
          tagEl.classList.toggle('locked', inFinal);
        }
        if (descEl) {
          descEl.innerHTML = inFinal
            ? '对局已进入<strong>最后 30 秒决胜阶段</strong>，遵循规则<strong>【最后阶段禁止复活】</strong>，无法再次投放样本。您可以等待倒计时归零，或点击下方按钮立即按当前种群营养物质总和结算！'
            : '当前处于<strong>常规阶段</strong>，中途死亡可从您储存的样本槽中任选一个样本<strong>再次加入战场</strong>（对局期间禁止生物编辑）。';
        }

        if (listEl) {
          listEl.innerHTML = '';
          for (let i = 0; i < maxSampleSlots; i++) {
            const sp = playerGeneBank[i];
            if (!sp) continue;
            const t = TORSOS[sp.torsoId] || TORSOS['torso-t1-micro'];
            const dietName = sp.dietType === 'herbivore' ? '植食' : (sp.dietType === 'carnivore' ? '肉食' : '杂食');
            const card = document.createElement('div');
            card.className = 'species-card' + (i === arenaState.rejoinSelectedSlotIdx ? ' selected' : '');
            card.style.opacity = inFinal ? '0.5' : '1';
            card.innerHTML = `
              <div class="sp-card-top">
                <div class="sp-thumb"><img src="../assets/micro-genesis/sprites/${t.sprite}" alt="" /></div>
                <div style="flex:1;min-width:0;">
                  <div class="sp-title">#${i + 1} ${escapeHtml(sp.speciesName)}</div>
                  <div class="sp-meta">${t.code} · ${dietName} · 基准 ${computeBlueprintBaseNutrients(sp)} 质</div>
                </div>
              </div>
            `;
            card.addEventListener('click', () => {
              if (inFinal) return;
              arenaState.rejoinSelectedSlotIdx = i;
              NexusSDK.audio.tap();
              openMidGameRejoinModal();
            });
            listEl.appendChild(card);
          }
        }

        if (confirmBtn) {
          confirmBtn.disabled = inFinal;
          confirmBtn.textContent = inFinal
            ? '最后决胜阶段禁止复活'
            : `投放样本 #${(arenaState.rejoinSelectedSlotIdx || 0) + 1} · 再次加入战场`;
        }
        if (settleNowBtn) {
          settleNowBtn.style.display = inFinal ? 'inline-flex' : 'none';
        }
        modal.classList.add('open');
      }

      document.getElementById('btn-rejoin-confirm')?.addEventListener('click', () => {
        respawnPlayerWithSample(arenaState.rejoinSelectedSlotIdx);
      });
      document.getElementById('btn-rejoin-settle-now')?.addEventListener('click', () => {
        settleTimedMatch();
      });

      // 实时统计全场所有种群的【营养物质总和】并排序
      function computeColonyStandings() {
        const map = new Map();
        const playerBpName = arenaState.playerActiveBlueprint?.speciesName || playerGeneBank[selectedSampleSlotIdx]?.speciesName || '我方受控种群';
        map.set('player_colony', {
          colonyId: 'player_colony',
          isPlayer: true,
          name: `我方 · ${playerBpName}`,
          count: 0,
          totalNutrients: 0
        });

        arenaState.organisms.forEach((org) => {
          if (!org || org.hp <= 0) return;
          const cid = (org.colonyId === 'player_colony' && !org.formerKin) ? 'player_colony' : (org.colonyId || 'wild_colony');
          let entry = map.get(cid);
          if (!entry) {
            const spName = org.blueprint?.speciesName || '野生种群';
            entry = {
              colonyId: cid,
              isPlayer: false,
              name: org.isBoss ? `首领 · ${spName}` : `野生 · ${spName}`,
              count: 0,
              totalNutrients: 0
            };
            map.set(cid, entry);
          }
          entry.count += 1;
          entry.totalNutrients += computeOrganismNutrients(org);
        });

        const standings = Array.from(map.values()).sort((a, b) => (b.totalNutrients - a.totalNutrients) || (b.count - a.count));
        return standings;
      }

      // 更新顶部限时赛倒计时、阶段标签与控制的种群营养物质总和计分板
      function updateMatchTimerAndScoreboard(dt) {
        if (arenaState.matchEnded) return;
        if (arenaState.sampleSwitchCd > 0) {
          arenaState.sampleSwitchCd = Math.max(0, arenaState.sampleSwitchCd - dt);
        }
        if (dt > 0) {
          arenaState.timeLeftSec = Math.max(0, (arenaState.timeLeftSec !== undefined ? arenaState.timeLeftSec : 180) - dt);
        }

        const inFinal = isFinalPhaseLockout();
        if (inFinal && !arenaState.finalPhaseAnnounced) {
          arenaState.finalPhaseAnnounced = true;
          NexusSDK.audio.warn();
          showToast('进入最后 30 秒决胜阶段！中途死亡将禁止复活，全力冲刺种群营养物质总和！');
          renderArenaSampleSwitcher();
          if (arenaState.waitingForRejoin) {
            openMidGameRejoinModal();
          }
        }

        const timerEl = document.getElementById('hud-match-timer');
        if (timerEl) timerEl.textContent = formatSecondsMmSs(arenaState.timeLeftSec);
        const timerBox = document.getElementById('hud-match-timer-box');
        if (timerBox) timerBox.classList.toggle('final-phase', inFinal);

        const phaseBadge = document.getElementById('hud-match-phase-badge');
        if (phaseBadge) {
          phaseBadge.textContent = inFinal ? '决胜阶段·禁止复活' : '常规阶段·可换样本/复活';
          phaseBadge.classList.toggle('locked', inFinal);
        }

        const standings = computeColonyStandings();
        const pIdx = standings.findIndex((s) => s.isPlayer);
        const playerRank = pIdx >= 0 ? (pIdx + 1) : standings.length;
        const playerEntry = pIdx >= 0 ? standings[pIdx] : { totalNutrients: 0, count: 0 };
        const topRival = standings.find((s) => !s.isPlayer) || { name: '竞争种群', totalNutrients: 0, count: 0 };

        const pNutEl = document.getElementById('hud-player-nutrients');
        if (pNutEl) {
          pNutEl.textContent = `我方种群营养: ${playerEntry.totalNutrients} 质 (${playerEntry.count}只)`;
        }
        const pRankEl = document.getElementById('hud-player-rank');
        if (pRankEl) {
          pRankEl.textContent = `第 ${playerRank} / ${standings.length} 名`;
          pRankEl.style.color = playerRank === 1 ? 'var(--mg-accent-gold)' : '#f43f5e';
        }
        const rNutEl = document.getElementById('hud-rival-nutrients');
        if (rNutEl) {
          rNutEl.textContent = `头名竞争 [${topRival.name}]: ${topRival.totalNutrients} 质 · 进化点: ${evolutionPoints} EP`;
        }

        if (arenaState.waitingForRejoin) {
          const rejoinTagEl = document.getElementById('rejoin-modal-timer-tag');
          if (rejoinTagEl) {
            rejoinTagEl.textContent = inFinal
              ? `决胜阶段 (${formatSecondsMmSs(arenaState.timeLeftSec)}) · 禁止复活`
              : `常规阶段 (${formatSecondsMmSs(arenaState.timeLeftSec)}) · 可再次加入`;
          }
        }

        if (arenaState.timeLeftSec <= 0) {
          settleTimedMatch();
        }
      }

      // 限时游戏结束：按控制的种群营养物质总和判断胜负，并奖励进化点 (EP)
      function settleTimedMatch(opts = {}) {
        if (arenaState.matchEnded) return;
        arenaState.matchEnded = true;
        arenaState.running = false;
        arenaState.waitingForRejoin = false;
        document.getElementById('arena-rejoin-modal')?.classList.remove('open');

        const standings = computeColonyStandings();
        const pIdx = standings.findIndex((s) => s.isPlayer);
        const playerRank = pIdx >= 0 ? (pIdx + 1) : standings.length;
        const playerEntry = pIdx >= 0 ? standings[pIdx] : { totalNutrients: 0, count: 0, name: '我方受控种群' };

        const matchDuration = arenaState.matchDurationSec || 180;
        const timeLeft = Math.max(0, arenaState.timeLeftSec !== undefined ? arenaState.timeLeftSec : 0);
        const elapsedSec = Math.max(0, matchDuration - timeLeft);
        const finalEliminated = isFinalPhaseLockout() && (!arenaState.alpha || arenaState.alpha.hp <= 0);
        const isEarlyAbort = Boolean(opts && opts.earlyAbort) && timeLeft > 0 && !finalEliminated;

        // 唯有真正完成限时对局（或决胜阶段阵亡完赛）且营养物质总和排名第 1 方可判定为游戏胜利，彻底阻断“开局 1 秒点提前结算无限刷胜利进化点”漏洞
        const isVictory = !isEarlyAbort && playerRank === 1 && playerEntry.totalNutrients > 0;

        let rewardEp = 0;
        if (isEarlyAbort) {
          if (elapsedSec < 45) {
            rewardEp = 0;
          } else {
            const progressRatio = Math.min(0.85, elapsedSec / matchDuration);
            rewardEp = Math.round((25 + Math.min(35, playerEntry.totalNutrients * 0.05)) * progressRatio);
          }
        } else {
          rewardEp = isVictory
            ? (180 + Math.min(220, Math.round(playerEntry.totalNutrients * 0.22)))
            : (playerRank === 2
              ? (80 + Math.min(80, Math.round(playerEntry.totalNutrients * 0.10)))
              : (45 + Math.min(50, Math.round(playerEntry.totalNutrients * 0.08))));
        }

        evolutionPoints = Math.min(999999, evolutionPoints + rewardEp);
        persistState();

        const titleEl = document.getElementById('settle-modal-title');
        if (titleEl) {
          titleEl.textContent = isEarlyAbort
            ? `提前结束对局 · 当前种群营养总和第 ${playerRank} 名`
            : (isVictory
              ? `限时演化胜利 · 控制的种群营养总和第 1 名！`
              : `限时演化结束 · 控制的种群营养总和第 ${playerRank} 名`);
          titleEl.style.color = isVictory ? 'var(--mg-accent-gold)' : 'var(--mg-accent-cyan)';
        }
        const subEl = document.getElementById('settle-modal-sub');
        if (subEl) {
          subEl.textContent = isEarlyAbort && elapsedSec < 45
            ? `本局仅进行 ${Math.round(elapsedSec)} 秒（提前退赛未满 45 秒不发放进化点） · 当前营养总和：${playerEntry.totalNutrients} 质`
            : `我方最终营养物质总和：${playerEntry.totalNutrients} 质（存活 ${playerEntry.count} 只）`;
        }
        const epBadge = document.getElementById('settle-ep-reward-badge');
        if (epBadge) {
          epBadge.textContent = isEarlyAbort
            ? `提前结算 +${rewardEp} 进化点 (EP)`
            : `${isVictory ? '胜利奖励' : '完赛奖励'} +${rewardEp} 进化点 (EP)`;
        }
        const totalEpLbl = document.getElementById('settle-total-ep-lbl');
        if (totalEpLbl) {
          totalEpLbl.textContent = `${evolutionPoints} EP`;
        }

        const boardEl = document.getElementById('settle-colony-leaderboard');
        if (boardEl) {
          boardEl.innerHTML = standings.slice(0, 6).map((item, idx) => {
            const rankNum = idx + 1;
            const highlight = item.isPlayer ? 'border:1.5px solid var(--mg-accent-cyan);background:rgba(45,212,191,0.16);' : 'border:1px solid rgba(148,163,184,0.22);background:rgba(15,23,42,0.82);';
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;font-size:0.68rem;${highlight}">
                <div style="display:flex;align-items:center;gap:8px;">
                  <strong style="color:${rankNum === 1 ? 'var(--mg-accent-gold)' : 'var(--mg-text-secondary)'};">#${rankNum}</strong>
                  <span style="font-weight:${item.isPlayer ? '900' : '600'};color:var(--mg-text-primary);">${escapeHtml(item.name)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="color:var(--mg-text-secondary);font-size:0.62rem;">存活 ${item.count} 只</span>
                  <strong style="color:${item.isPlayer ? 'var(--mg-accent-cyan)' : 'var(--mg-accent-gold)'};">${item.totalNutrients} 营养质</strong>
                </div>
              </div>
            `;
          }).join('');
        }

        document.getElementById('arena-settlement-modal')?.classList.add('open');
        if (isVictory) {
          NexusSDK.audio.win();
        } else {
          NexusSDK.audio.upgrade();
        }
      }

      document.getElementById('btn-settle-open-workshop')?.addEventListener('click', () => {
        openOutOfGameWorkshop();
      });
      document.getElementById('btn-settle-rematch')?.addEventListener('click', () => {
        document.getElementById('arena-settlement-modal')?.classList.remove('open');
        startArenaMatch();
        switchPage('arena', { allowDuringMatch: true });
      });
      document.getElementById('btn-settle-back-room')?.addEventListener('click', () => {
        document.getElementById('arena-settlement-modal')?.classList.remove('open');
        if (window.NexusSDK && window.NexusSDK.openTier2Menu) {
          window.NexusSDK.openTier2Menu('lan');
          return;
        }
        switchPage('lobby');
      });
      document.getElementById('btn-arena-settle-early')?.addEventListener('click', () => {
        settleTimedMatch({ earlyAbort: true });
      });

      // 底部 HUD 其余纯 SVG 图标按钮事件
      document.getElementById('btn-pheromone')?.addEventListener('click', () => {
        arenaState.pheromoneIdx = (arenaState.pheromoneIdx + 1) % PHEROMONE_MODES.length;
        const mode = PHEROMONE_MODES[arenaState.pheromoneIdx];
        const btn = document.getElementById('btn-pheromone');
        const svg = document.getElementById('pheromone-svg-ico');
        const color = mode === 'forage' ? '#10b981' : (mode === 'guard' ? '#2dd4bf' : '#ef4444');
        if (btn) btn.style.borderColor = color;
        if (svg) svg.setAttribute('stroke', color);
        NexusSDK.audio.tap();
        const modeText = mode === 'forage' ? '采食散开 (Forage)' : (mode === 'guard' ? '护卫环绕 (Guard)' : '猎杀包抄 (Hunt)');
        showToast('同族 NPC 信息素信标已切换：' + modeText);
      });

      document.getElementById('btn-toggle-fov')?.addEventListener('click', () => {
        arenaState.showSensoryOverlay = !arenaState.showSensoryOverlay;
        NexusSDK.audio.tap();
        showToast(arenaState.showSensoryOverlay ? '已开启感官扇区与仇恨连线辅助层' : '已隐藏感官边界辅助层');
      });

      document.getElementById('btn-organ-skill')?.addEventListener('click', () => {
        triggerEntityActiveSkill(arenaState.alpha);
        if (isLanGuest && lanSession && lanSession.sendFast && arenaState.alpha) {
          lanSession.sendFast({ type: 'GUEST_INPUT', angle: arenaState.alpha.targetAngle, skill: true, mitosis: false });
        }
      });

      document.getElementById('btn-mitosis')?.addEventListener('click', () => {
        tryMitosisReproduce(arenaState.alpha);
        if (isLanGuest && lanSession && lanSession.sendFast && arenaState.alpha) {
          lanSession.sendFast({ type: 'GUEST_INPUT', angle: arenaState.alpha.targetAngle, skill: false, mitosis: true });
        }
      });

      document.getElementById('arena-back-lobby-btn')?.addEventListener('click', () => {
        if (window.NexusSDK && window.NexusSDK.openTier2Menu) { window.NexusSDK.openTier2Menu('lan'); return; }
        switchPage('lobby');
      });

      /* =====================================================================
       * 11. 伤害结算、热力学肉块掉落、GP 差分掉落与感官驱动 AI 决策循环
       * ===================================================================== */
      // 计算生物有效体型体积 (综合躯干基础体积、幼体发育比例与首领倍率)
      function getEntityEffectiveVolume(ent) {
        if (!ent || !ent.blueprint) return 1.0;
        const torso = TORSOS[ent.blueprint.torsoId] || TORSOS['torso-t1-micro'];
        const g = ent.growthScale !== undefined ? ent.growthScale : 1.0;
        const bossMult = ent.isBoss ? 2.4 : 1.0;
        return torso.volume * g * g * bossMult;
      }

      // 判定捕食者与猎物是否存在【极大体型悬殊】从而允许直接一口吞噬活体 (Swallow Whole)：
      function canSwallowWhole(predator, prey) {
        if (!predator || !prey || predator.hp <= 0 || prey.hp <= 0) return false;
        if (predator.colonyId === prey.colonyId || prey.isBoss) return false;
        if (prey.spawnShieldTimer && prey.spawnShieldTimer > 0) return false;
        const predSt = getEffectiveStats(predator);
        if ((predSt.carnEff || 0) <= 0) return false;
        const predVol = getEntityEffectiveVolume(predator);
        const preyVol = getEntityEffectiveVolume(prey);
        const volRatio = predVol / Math.max(0.1, preyVol);
        const radRatio = predator.radius / Math.max(1, prey.radius);
        return volRatio >= 3.2 && radRatio >= 1.55;
      }

      function applyDamage(victim, rawDmg, attacker) {
        if (!victim || victim.hp <= 0) return;
        // 主动发起攻击时立即解除攻击者的 5 秒【破膜适应期】初生免疫
        if (attacker && attacker.spawnShieldTimer > 0 && attacker !== victim) {
          attacker.spawnShieldTimer = 0;
        }
        // 处于 5 秒【破膜适应期】的新生始祖完全免疫一切伤害
        if (victim.spawnShieldTimer && victim.spawnShieldTimer > 0) return;
        const vSt = getEffectiveStats(victim);
        let finalDmg = rawDmg * (1 - vSt.damageReduction);

        // 在相似/相近体型下（未达到直接吞噬的极大悬殊阈值），单次攻击伤害上限不超过猎物最大生命的 42%，确保满血猎物必须经过多次真实撕咬战斗才会被杀死转化为肉
        if (attacker && !canSwallowWhole(attacker, victim)) {
          finalDmg = Math.min(finalDmg, victim.maxHp * 0.42);
        }

        // 第二章首领【晶甲熔岩虱】正面硫化晶甲减免伤害
        if (victim.isBoss && selectedBiomeId === 1 && attacker) {
          const angToAttacker = Math.atan2(attacker.y - victim.y, attacker.x - victim.x);
          const diff = Math.abs(Math.atan2(Math.sin(angToAttacker - victim.angle), Math.cos(angToAttacker - victim.angle)));
          if (diff < Math.PI * 0.55) finalDmg *= 0.20;
        }

        // 第三章首领【霜刃水母】8 秒限时冰晶护盾减伤
        if (victim.isBoss && selectedBiomeId === 2 && victim.iceShieldTimer > 0) {
          finalDmg *= 0.35;
        }

        victim.hp -= finalDmg;

        // 第一章首领【吞天水螅】HP < 50% 时断触化为 3 只游猎分身
        if (victim.isBoss && selectedBiomeId === 0 && !victim.bossSplitDone && victim.hp > 0 && victim.hp < victim.maxHp * 0.50) {
          victim.bossSplitDone = true;
          for (let k = 0; k < 3; k++) {
            const ang = (k / 3) * Math.PI * 2;
            const clone = spawnOrganismEntity(victim.blueprint, victim.x + Math.cos(ang) * 65, victim.y + Math.sin(ang) * 65, 'enemy', {
              colonyId: victim.colonyId,
              isBoss: false,
              hpRatio: 0.45,
              energyRatio: 0.80
            });
            arenaState.organisms.push(clone);
          }
          showToast('首领【吞天水螅】生命低于 50%，断触裂变为 3 只游猎分身！');
        }

        // 伤害仇恨记入仇恨表
        if (attacker && attacker.id !== victim.id) {
          const prev = victim.hatredMap.get(attacker.id) || 0;
          victim.hatredMap.set(attacker.id, prev + finalDmg * 1.35);

          // Lv.3 棱镜晶甲反伤 30%
          if (vSt.reflectRatio > 0) {
            attacker.hp = Math.max(1, attacker.hp - finalDmg * vSt.reflectRatio);
          }
        }

        if (victim.hp <= 0) {
          handleEntityDeath(victim, attacker, { swallowedWhole: false });
        }
      }

      function handleEntityDeath(victim, killer, opts = {}) {
        victim.hp = 0;
        const swallowedWhole = Boolean(opts && opts.swallowedWhole);
        const torso = TORSOS[victim.blueprint.torsoId];
        const biomassScale = victim.growthScale !== undefined ? victim.growthScale : 1.0;
        // 热力学守恒肉块能量公式: E_meat = round(12 * V^0.65 * growthScale + 0.28 * E_remaining); 跨躯干剥离旧种群 (formerKin) 肉块能量减半
        const rawMeatEnergy = Math.max(6, Math.round(12 * Math.pow(torso.volume, 0.65) * biomassScale + 0.28 * Math.max(0, victim.energy)));
        const meatEnergy = victim.formerKin ? Math.max(3, Math.round(rawMeatEnergy * 0.5)) : rawMeatEnergy;

        if (swallowedWhole && killer && killer.hp > 0) {
          // 体型极大悬殊下的直接吞噬：猎物被一口整吞，生物质能量直接消化入腹，不掉落地面肉块
          const kSt = getEffectiveStats(killer);
          const gainE = meatEnergy * (kSt.carnEff || 1.0) * (kSt.digestEff || 1.0);
          killer.energy = Math.min(killer.maxEnergy, killer.energy + gainE);
          accelerateJuvenileGrowth(killer, gainE);
          if (killer === arenaState.alpha) {
            NexusSDK.audio.pickup();
            showToast(`体型悬殊！直接吞噬了微型猎物【${victim.blueprint.speciesName}】(+${Math.round(gainE)} E)`);
          }
        } else {
          // 相似/相近体型击杀：猎物死后转化为 1~3 块可见的【有机肉块 (meat)】，经历 0.45s 凝结散落期后方可被肉食者吞噬
          const chunkCount = torso.volume >= 4.0 ? 3 : (torso.volume >= 2.0 ? 2 : 1);
          const perChunkEnergy = +(meatEnergy / chunkCount).toFixed(1);
          const baseAng = killer ? Math.atan2(victim.y - killer.y, victim.x - killer.x) : (Math.random() * Math.PI * 2);
          for (let ci = 0; ci < chunkCount; ci++) {
            const spread = chunkCount === 1 ? 0 : ((ci / (chunkCount - 1)) - 0.5) * 1.35;
            const ang = baseAng + spread + (Math.random() - 0.5) * 0.25;
            const burstSpd = chunkCount === 1 ? 26 : (34 + ci * 10);
            arenaState.foods.push({
              id: 'meat_' + Date.now() + '_' + ci + '_' + Math.random(),
              type: 'meat',
              x: Math.max(36, Math.min(WORLD_W - 36, victim.x + Math.cos(ang) * 6)),
              y: Math.max(36, Math.min(WORLD_H - 36, victim.y + Math.sin(ang) * 6)),
              vx: Math.cos(ang) * burstSpd,
              vy: Math.sin(ang) * burstSpd,
              energy: perChunkEnergy,
              radius: chunkCount === 1 ? 10.5 : 9.5,
              sourceColonyId: victim.colonyId, // 同族禁食校验标记
              eatReadyAt: arenaState.timeSec + 0.45, // 猎物死亡转化为肉块的 0.45s 凝结显现期，杜绝死亡同帧瞬间消失
              ttl: 85
            });
          }
        }

        // 第四章首领【千目原质母体】双槽 FIFO 12.0s 器官同化
        arenaState.organisms.forEach((b) => {
          if (b.isBoss && b.hp > 0 && selectedBiomeId === 3 && Math.hypot(b.x - victim.x, b.y - victim.y) < 320) {
            const victimUtil = victim.blueprint.slots.utility[0];
            if (victimUtil) {
              if (b.assimilatedOrgans.length >= 2) b.assimilatedOrgans.shift();
              b.assimilatedOrgans.push({ id: victimUtil.id, level: victimUtil.level, expireAt: arenaState.timeSec + 12.0 });
            }
          }
        });

        // 击败异族奖励战地基因值与击杀记录
        if (killer && killer.colonyId === 'player_colony' && victim.colonyId !== 'player_colony' && !victim.formerKin) {
          const dropChance = victim.isBoss ? 1.0 : (killer.isAlpha ? 0.75 : 0.12);
          if (Math.random() <= dropChance) {
            const gpGain = victim.isBoss ? 220 : Math.max(2, Math.round(18 * Math.pow(torso.volume, 0.75) * biomassScale));
            globalGpReserve += gpGain;
            arenaState.playerFullBlueprint.records.totalKills += 1;
            persistState();
            NexusSDK.audio.pickup();
          }
        }

        // 若玩家当前控制的始祖死亡：
        // 1. 若场上仍有存活的同族电脑 NPC 后代，无缝移交控制权；
        // 2. 若场上已无存活同族个体：
        //    - 常规阶段 (剩余 >30s)：弹出【中途阵亡 · 选择客户储存样本再次加入】面板，允许换样本或原样本再次加入；
        //    - 最后决胜阶段 (剩余 <=30s)：严格执行【最后阶段禁止复活】，锁定再次加入并提示等待或立即结算！
        if (victim === arenaState.alpha) {
          const survivingKin = arenaState.organisms
            .filter((o) => o.hp > 0 && o.colonyId === 'player_colony' && !o.formerKin && o !== victim)
            .sort((a, b) => (((b.maturity ?? 1) >= 1 ? 1 : 0) - ((a.maturity ?? 1) >= 1 ? 0 : 0)) || (b.hp - a.hp));
          if (survivingKin.length > 0) {
            const heir = survivingKin[0];
            heir.isAlpha = true;
            arenaState.alpha = heir;
            NexusSDK.audio.warn();
            showToast('受控个体陨落！控制权已无缝移交至场上存活的同族后代');
          } else {
            arenaState.waitingForRejoin = true;
            arenaState.rejoinSelectedSlotIdx = selectedSampleSlotIdx;
            NexusSDK.audio.warn();
            renderArenaSampleSwitcher();
            openMidGameRejoinModal();
          }
        }
      }

      // 判断坐标是否位于【起源浅滩 (Genesis Shoal)】生态庇护区内
      function isInsideGenesisShoal(x, y, margin = 0) {
        const shoal = arenaState.genesisShoal;
        if (!shoal) return false;
        return Math.hypot(x - shoal.x, y - shoal.y) <= (shoal.radius + margin);
      }

      // 判断观察者 observer 能否通过自身感官发现 target (02 第 2.3 节 & 04 第 2.2 节)
      function canEntitySenseTarget(observer, target, isNight, isStaticAlgae) {
        const dx = target.x - observer.x;
        const dy = target.y - observer.y;
        const dist = Math.hypot(dx, dy);
        const st = getEffectiveStats(observer);
        const absR = st.absSenseRange || 110;
        if (dist <= absR) return { sensed: true, mode: 'absolute', signalStrength: 1.0 };

        // 1. 听觉声呐判定 (360° 全向，无视黑夜、墨囊与光学拟态；距离越远信号越弱；对静止微藻或怠速静止生物仅在 staticSenseRange 内可测)
        if (st.maxEarLv > 0) {
          const targetSpeed = isStaticAlgae ? 0 : Math.hypot(target.vx || 0, target.vy || 0);
          const isStationary = isStaticAlgae || targetSpeed < 8;
          const effSonarR = isStationary ? Math.max(absR, st.staticSenseRange) : st.sonarRange;
          if (dist <= effSonarR) {
            const distNorm = Math.max(0, Math.min(1, (dist - absR * 0.65) / Math.max(40, effSonarR - absR * 0.65)));
            const signalStrength = Math.max(0.12, Math.pow(1 - distNorm, 1.55));
            return { sensed: true, mode: 'sonar', signalStrength };
          }
        }

        // 2. 视觉扇形锥判定 (距离长，中心清晰，越靠外越模糊衰减；受黑夜、墨囊致盲与敌方拟态皮肤克制)
        if (st.maxEyeLv > 0) {
          const effRange = observer.blindTimer > 0 ? Math.max(absR, 115) : (isNight ? st.nightEyeRange : st.dayEyeRange);
          if (dist <= effRange) {
            const effAngleRad = ((isNight ? st.nightEyeAngle : st.dayEyeAngle) * 0.5) * (Math.PI / 180);
            const angToTarget = Math.atan2(dy, dx);
            const diff = Math.abs(Math.atan2(Math.sin(angToTarget - observer.angle), Math.cos(angToTarget - observer.angle)));
            if (diff <= effAngleRad) {
              // 拟态皮肤判定：同级或高级拟态在绝对感知区外欺骗纯视觉
              if (!isStaticAlgae && target.mimicTimer > 0 && dist > absR) {
                const targetMimic = (target.blueprint?.slots?.utility || []).find((u) => u.id === 'util-mimic');
                if (targetMimic && targetMimic.level >= st.maxEyeLv) {
                  return { sensed: false, mode: null, signalStrength: 0 };
                }
              }
              const rNorm = Math.max(0, Math.min(1, (dist - absR * 0.5) / Math.max(40, effRange - absR * 0.5)));
              const aNorm = effAngleRad > 0 ? Math.min(1, diff / effAngleRad) : 0;
              const clarity = Math.max(0.15, (1 - 0.72 * Math.pow(rNorm, 1.4)) * (1 - 0.45 * Math.pow(aNorm, 1.8)));
              return { sensed: true, mode: 'visual', signalStrength: clarity };
            }
          }
        }
        return { sensed: false, mode: null, signalStrength: 0 };
      }

      function stepArenaSimulation(dt) {
        arenaState.timeSec += dt;
        if (arenaState.intraSpeciesCd > 0) arenaState.intraSpeciesCd = Math.max(0, arenaState.intraSpeciesCd - dt);
        if (arenaState.crossTorsoCd > 0) arenaState.crossTorsoCd = Math.max(0, arenaState.crossTorsoCd - dt);

        // 昼夜交替周期 180s: 白昼 0~75s, 黄昏 75~90s, 黑夜 90~165s, 黎明 165~180s
        const cyc = arenaState.timeSec % 180;
        const isNight = arenaState.biome.forceNight || (cyc >= 82 && cyc <= 170);

        // 环境定时局部刷新营养质与微藻 (每 3.5s 在【起源浅滩】刷新全食性通用【原生营养质】，在热泉与随机生态点注入微藻；黑夜刷新率减半)
        if (arenaState.timeSec - arenaState.lastAlgaeSpawnSec >= 3.5) {
          arenaState.lastAlgaeSpawnSec = arenaState.timeSec;
          if (arenaState.genesisShoal) {
            spawnNutrientCluster(arenaState.genesisShoal.x, arenaState.genesisShoal.y, isNight ? 3 : 6);
          }
          const v = arenaState.vents[Math.floor(Math.random() * arenaState.vents.length)];
          if (v) spawnAlgaeCluster(v.x, v.y, isNight ? 2 : 4);
          spawnAlgaeCluster(200 + Math.random() * (WORLD_W - 400), 200 + Math.random() * (WORLD_H - 400), isNight ? 3 : 6);
        }

        // 补充野生生态种群维持沙盘活力（肉食/杂食掠食者强制生成在【起源浅滩】安全距离 580px 之外）
        if (arenaState.organisms.length < 22 && Math.random() < dt * 0.8) {
          const fBp = officialFossils[Math.floor(Math.random() * officialFossils.length)];
          let rx = 180 + Math.random() * (WORLD_W - 360);
          let ry = 180 + Math.random() * (WORLD_H - 360);
          if (fBp.dietType !== 'herbivore') {
            const safeW = clampOutsideGenesisShoal(rx, ry, 580);
            rx = safeW.x;
            ry = safeW.y;
          }
          arenaState.organisms.push(spawnOrganismEntity(fBp, rx, ry, 'wild', {
            colonyId: 'wild_' + fBp.speciesId,
            territoryCenter: { x: rx, y: ry, radius: 440 }
          }));
        }

        // 更新投射物 (骨刺)
        for (let i = arenaState.projectiles.length - 1; i >= 0; i--) {
          const p = arenaState.projectiles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.ttl -= dt;
          if (p.ttl <= 0) {
            arenaState.projectiles.splice(i, 1);
            continue;
          }
          for (let j = 0; j < arenaState.organisms.length; j++) {
            const org = arenaState.organisms[j];
            if (org.hp > 0 && org.colonyId !== p.ownerColony) {
              if (Math.hypot(org.x - p.x, org.y - p.y) <= org.radius + 6) {
                const shooter = p.ownerIsAlpha ? arenaState.alpha : null;
                applyDamage(org, p.dmg, shooter);
                NexusSDK.audio.hit();
                arenaState.projectiles.splice(i, 1);
                break;
              }
            }
          }
        }

        // 更新区域危害 (墨囊黑雾 / 毒环 / 电弧)
        for (let i = arenaState.hazards.length - 1; i >= 0; i--) {
          const h = arenaState.hazards[i];
          h.ttl -= dt;
          if (h.ttl <= 0) {
            arenaState.hazards.splice(i, 1);
            continue;
          }
          arenaState.organisms.forEach((org) => {
            if (org.hp <= 0 || org.colonyId === h.ownerColony || (org.spawnShieldTimer && org.spawnShieldTimer > 0)) return;
            if (Math.hypot(org.x - h.x, org.y - h.y) <= h.radius + org.radius) {
              if (h.type === 'ink') {
                org.blindTimer = Math.max(org.blindTimer, 1.5);
              } else if (h.type === 'venom') {
                org.poisonTimer = Math.max(org.poisonTimer, h.dotDur || 4.0);
                org.poisonDps = h.dps || 8;
              }
            }
          });
        }

        // 更新所有生物个体：代谢、感官 AI、转向移动、进食与撕咬
        const alpha = arenaState.alpha;
        const pheromoneMode = PHEROMONE_MODES[arenaState.pheromoneIdx];
        const shoal = arenaState.genesisShoal;

        arenaState.organisms.forEach((org) => {
          if (org.hp <= 0) return;
          const st = getEffectiveStats(org);
          if (org.skillCd > 0) org.skillCd = Math.max(0, org.skillCd - dt);
          if (org.biteCd > 0) org.biteCd = Math.max(0, org.biteCd - dt);
          if (org.reproCd > 0) org.reproCd = Math.max(0, org.reproCd - dt);
          if (org.mimicTimer > 0) org.mimicTimer = Math.max(0, org.mimicTimer - dt);
          if (org.blindTimer > 0) org.blindTimer = Math.max(0, org.blindTimer - dt);
          if (org.stunTimer > 0) org.stunTimer = Math.max(0, org.stunTimer - dt);
          if (org.squashTimer > 0) org.squashTimer = Math.max(0, org.squashTimer - dt);
          if (org.suppressedTimer > 0) org.suppressedTimer = Math.max(0, org.suppressedTimer - dt);
          if (org.slowTimer > 0) org.slowTimer = Math.max(0, org.slowTimer - dt);
          if (org.iceShieldTimer > 0) org.iceShieldTimer = Math.max(0, org.iceShieldTimer - dt);
          if (org.spawnShieldTimer > 0) org.spawnShieldTimer = Math.max(0, org.spawnShieldTimer - dt);

          // 幼体发育机制 (Juvenile Ontogeny)：随时间自然成长 (饥饿时放缓至 25%)，营养层级越高发育时间越长
          if (org.maturity !== undefined && org.maturity < 1.0) {
            const growDur = org.blueprint?.statsSummary?.growDurationSec || 10.0;
            const hungerFactor = org.energy > 0 ? 1.0 : 0.25;
            org.maturity = Math.min(1.0, org.maturity + (dt / growDur) * hungerFactor);
            syncOrganismMaturity(org, false);
          }

          // 清理第四章首领【千目原质母体】已到期的 12.0s FIFO 同化器官槽位
          if (org.assimilatedOrgans && org.assimilatedOrgans.length > 0) {
            org.assimilatedOrgans = org.assimilatedOrgans.filter((a) => a.expireAt > arenaState.timeSec);
          }

          // 检查同族电脑 NPC 待蜕皮队列：当能量恢复至 >= 60% MaxE_old 时自动蜕皮同步最新同躯干配置
          if (org.pendingBlueprint && org.energy >= 0.60 * org.maxEnergy) {
            const pBp = org.pendingBlueprint;
            const pSt = pBp.statsSummary;
            const oldMaxHp = org.maxHp;
            const hpRatio = oldMaxHp > 0 ? Math.min(1, org.hp / oldMaxHp) : 1;
            org.blueprint = pBp;
            org.energy = Math.min(pSt.maxEnergy, org.energy);
            org.maxEnergy = pSt.maxEnergy;
            org.maxHp = pSt.maxHp;
            org.hp = Math.max(1, Math.round(pSt.maxHp * hpRatio));
            org.radius = TORSOS[pBp.torsoId].sizePx * 0.44;
            org.pendingBlueprint = null;
            syncOrganismMaturity(org, false);
          }

          // 毒伤结算
          if (org.poisonTimer > 0 && !(org.spawnShieldTimer > 0)) {
            org.poisonTimer = Math.max(0, org.poisonTimer - dt);
            org.hp = Math.max(1, org.hp - org.poisonDps * dt);
          }

          // 各章节首领专属环境与机制（若玩家位于【起源浅滩】内或处于 5s 破膜适应期，免疫首领牵引与压制）：
          const alphaProtected = alpha && ((alpha.spawnShieldTimer > 0) || isInsideGenesisShoal(alpha.x, alpha.y));
          if (org.isBoss && alpha && !alphaProtected) {
            const dToAlpha = Math.hypot(alpha.x - org.x, alpha.y - org.y);
            // 第一章首领【阿米巴吞噬巨核】：周期性旋涡吸附 (<260px 向首领中心牵引)
            if (selectedBiomeId === 0 && dToAlpha < 260 && dToAlpha > 12) {
              const pull = ((260 - dToAlpha) / 260) * 65 * dt;
              alpha.x += ((org.x - alpha.x) / dToAlpha) * pull;
              alpha.y += ((org.y - alpha.y) / dToAlpha) * pull;
            }
            // 第三章首领【寒冰利维坦】：周期性寒潮减速波 (60% 减速) + 冰甲护盾 (正面减伤 75%)
            if (selectedBiomeId === 2) {
              if (Math.floor(arenaState.timeSec) % 10 === 0) {
                org.iceShieldTimer = 6.0;
                if (dToAlpha < 260) alpha.slowTimer = 3.5;
              }
            }
            // 第五章首领【虚空噬菌裂变兽】：向心黑洞引力场 + 周期性 4.0s 基因降阶光束 (强制降为 Lv.1)
            if (selectedBiomeId === 4 && dToAlpha < 280) {
              if (dToAlpha > 12) {
                const pull = ((280 - dToAlpha) / 280) * 80 * dt;
                alpha.x += ((org.x - alpha.x) / dToAlpha) * pull;
                alpha.y += ((org.y - alpha.y) / dToAlpha) * pull;
              }
              if (Math.floor(arenaState.timeSec) % 9 === 0) {
                alpha.suppressedTimer = 4.0;
              }
            }
          }

          // 1. 静态总代谢 BMR + 大型物种推进运动能耗 (moveDrain) 扣减与饥饿扣血 / 饱食自动回血
          const curSpeed = Math.hypot(org.vx || 0, org.vy || 0);
          const speedRatio = Math.min(1.2, curSpeed / Math.max(40, st.maxSpeed || 80));
          const moveEnergyDrain = (st.moveDrain || 0.25) * speedRatio;
          const bmrDrain = (st.bmr + moveEnergyDrain) * arenaState.biome.bmrMult * dt;
          org.energy = Math.max(0, org.energy - bmrDrain);
          if (org.energy <= 0) {
            org.hp -= org.maxHp * 0.05 * dt;
            if (org.hp <= 0) {
              handleEntityDeath(org, null);
              return;
            }
          } else if (org.energy > 0.60 * org.maxEnergy && org.hp < org.maxHp) {
            const regenHp = Math.min(st.regenCap * dt, org.maxHp - org.hp);
            org.hp += regenHp;
            org.energy = Math.max(0, org.energy - (regenHp / st.regenPerE));
          }

          // 热泉上升流恢复能量
          arenaState.vents.forEach((v) => {
            if (Math.hypot(org.x - v.x, org.y - v.y) <= v.radius) {
              org.energy = Math.min(org.maxEnergy, org.energy + 4.5 * dt);
            }
          });

          // 2. 确定目标航向角 targetAngle 与感官前置预警规避算法 (玩家始祖 vs 同族/野生 AI)
          if (org === alpha) {
            if (arenaState.pointerDown) {
              org.targetAngle = Math.atan2(arenaState.pointerWorldY - org.y, arenaState.pointerWorldX - org.x);
            } else {
              org.targetAngle = org.angle;
            }
          } else {
            // 电脑 NPC 感官驱动效用 AI 决策 (含感官前置天敌预警与反比平方逃逸向量合成)
            const role = org.nicheRole || (org.blueprint.dietType === 'herbivore' ? 'herd' : (org.isBoss ? 'apex' : 'pack'));
            const w = org.blueprint.aiWeights;
            // 领主智能 (apex) 独来独往，野生领主不执行成群分裂繁殖；大型物种需满足更高的躯干繁衍能量门槛 (reproThreshold)
            const aiReproThreshold = Math.max(st.reproThreshold || 0.80, 0.95 - 0.15 * w.w_repro);
            if ((role !== 'apex' || org.colonyId === 'player_colony') && org.energy >= org.maxEnergy * aiReproThreshold && Math.random() < dt * w.w_repro) {
              tryMitosisReproduce(org);
            }

            let bestFood = null;
            let bestFoodDist = 9999;
            arenaState.foods.forEach((f) => {
              // 起源浅滩的通用营养物质 (type === 'nutrient') 适应所有食性，任何物种均可摄取；微藻仅限植食/杂食，肉块仅限肉食/杂食
              if (f.type === 'algae' && st.herbEff <= 0) return;
              if (f.type === 'meat' && (st.carnEff <= 0 || f.sourceColonyId === org.colonyId)) return;
              // 野生捕食者不觊觎【起源浅滩】内部的食物
              if (org.colonyId !== 'player_colony' && org.blueprint.dietType !== 'herbivore' && isInsideGenesisShoal(f.x, f.y)) return;
              const d = Math.hypot(f.x - org.x, f.y - org.y);
              if (d < bestFoodDist && canEntitySenseTarget(org, f, isNight, f.type === 'algae').sensed) {
                bestFoodDist = d;
                bestFood = f;
              }
            });

            let nearestEnemy = null;
            let nearestEnemyDist = 9999;
            let bestEnemyScore = 9999;
            let nearestThreat = null;
            let nearestThreatDist = 9999;
            let evadeX = 0;
            let evadeY = 0;
            const myPower = org.maxHp * Math.max(8, st.biteDmg);

            arenaState.organisms.forEach((other) => {
              if (other.hp <= 0 || other.colonyId === org.colonyId) return;
              // 【起源浅滩】与【5秒破膜适应期】双重庇护：野生捕食者忽略处于破膜免疫期或位于起源浅滩内的玩家种群个体
              if (org.colonyId !== 'player_colony' && (
                (other.spawnShieldTimer && other.spawnShieldTimer > 0) ||
                (other.colonyId === 'player_colony' && isInsideGenesisShoal(other.x, other.y))
              )) {
                return;
              }
              const d = Math.hypot(other.x - org.x, other.y - org.y);
              if (canEntitySenseTarget(org, other, isNight, false).sensed) {
                const selfHatred = org.hatredMap.get(other.id) || 0;
                const sharedAlphaHatred = (org.colonyId === 'player_colony' && alpha) ? (alpha.hatredMap.get(other.id) || 0) * 0.65 : 0;
                const hatredBonus = Math.min(180, (selfHatred + sharedAlphaHatred) * 2.2);
                const effScore = d - hatredBonus;
                if (effScore < bestEnemyScore) {
                  bestEnemyScore = effScore;
                  nearestEnemyDist = d;
                  nearestEnemy = other;
                }

                // 判定是否为高危捕食者天敌：一旦进入感官预警圈即刻触发前置斥力合成，无需等残血才逃跑
                const otherSt = getEffectiveStats(other);
                const otherPower = other.maxHp * Math.max(8, otherSt.biteDmg);
                const isPredatorThreat = otherSt.carnEff > 0 && (
                  org.blueprint.dietType === 'herbivore' ||
                  other.isBoss ||
                  otherPower > myPower * 1.15 ||
                  (org.hp / org.maxHp) <= (0.15 + 0.45 * w.w_flee)
                );
                if (isPredatorThreat) {
                  const repWeight = Math.pow(Math.max(40, 420 - d) / 360, 2) * (other.isBoss ? 2.4 : 1.45);
                  evadeX += ((org.x - other.x) / Math.max(1, d)) * repWeight;
                  evadeY += ((org.y - other.y) / Math.max(1, d)) * repWeight;
                  if (d < nearestThreatDist) {
                    nearestThreatDist = d;
                    nearestThreat = other;
                  }
                }
              }
            });

            // 培养皿边界防卡死切向引导分量 (防止弱小个体逃跑时被逼入死角)
            const wallMargin = 140;
            if (org.x < wallMargin) evadeX += ((wallMargin - org.x) / wallMargin) * 1.4;
            if (org.x > WORLD_W - wallMargin) evadeX -= ((org.x - (WORLD_W - wallMargin)) / wallMargin) * 1.4;
            if (org.y < wallMargin) evadeY += ((wallMargin - org.y) / wallMargin) * 1.4;
            if (org.y > WORLD_H - wallMargin) evadeY -= ((org.y - (WORLD_H - wallMargin)) / wallMargin) * 1.4;

            const shouldPreemptiveEvade = nearestThreat && nearestThreatDist < 310 && (
              org.blueprint.dietType === 'herbivore' ||
              (org.hp / org.maxHp) <= (0.22 + 0.45 * w.w_flee) ||
              (org.colonyId === 'player_colony' && pheromoneMode === 'forage')
            );

            // =====================================================================
            // NPC 生态位智能决策系统：羊群群居智能 (herd) | 领主智能 (apex) | 狼群协同智能 (pack)
            // =====================================================================

            // 1. 羊群群居智能 (herd): 单位矢量加权 Boids (凝聚 Cohesion + 对齐 Alignment + 分离 Separation) + 结伴采食 + 惊群连锁逃散
            if (role === 'herd') {
              if (org.herdPanicTimer > 0) org.herdPanicTimer = Math.max(0, org.herdPanicTimer - dt);

              // 检查 240px 内群友是否受惊逃逸 -> 触发羊群连锁惊群 (Stampede Cascade)
              if (org.herdPanicTimer <= 0) {
                for (let ki = 0; ki < arenaState.organisms.length; ki++) {
                  const kin = arenaState.organisms[ki];
                  if (kin !== org && kin.hp > 0 && kin.nicheRole === 'herd' && kin.colonyId === org.colonyId) {
                    if (kin.isEvading || kin.herdPanicTimer > 0) {
                      if (Math.hypot(kin.x - org.x, kin.y - org.y) < 240) {
                        org.herdPanicTimer = 2.4;
                        org.herdPanicTarget = kin.herdPanicTarget || nearestThreat;
                        break;
                      }
                    }
                  }
                }
              }

              if (shouldPreemptiveEvade || org.herdPanicTimer > 0) {
                // 惊群狂奔：合成多威胁斥力向量与群友逃跑方向集体冲刺
                org.isEvading = true;
                const threat = nearestThreat || org.herdPanicTarget;
                if (evadeX !== 0 || evadeY !== 0) {
                  org.targetAngle = Math.atan2(evadeY, evadeX);
                } else if (threat) {
                  org.targetAngle = Math.atan2(org.y - threat.y, org.x - threat.x);
                }
                if (nearestThreatDist < 160 && org.skillCd <= 0 && st.activeSkill) {
                  triggerEntityActiveSkill(org);
                }
              } else {
                org.isEvading = false;
                // 单位向量加权 Boids 算法（彻底修复 ±π 算术平均方向翻转 Bug）
                let cohX = 0, cohY = 0, aliX = 0, aliY = 0, kinCount = 0;
                arenaState.organisms.forEach((kin) => {
                  if (kin === org || kin.hp <= 0 || kin.colonyId !== org.colonyId) return;
                  const kd = Math.hypot(kin.x - org.x, kin.y - org.y);
                  if (kd < 240) {
                    cohX += kin.x;
                    cohY += kin.y;
                    aliX += Math.cos(kin.angle);
                    aliY += Math.sin(kin.angle);
                    kinCount++;
                  }
                });

                let flockVecX = 0;
                let flockVecY = 0;
                if (kinCount > 0) {
                  const cx = (cohX / kinCount) - org.x;
                  const cy = (cohY / kinCount) - org.y;
                  const cLen = Math.hypot(cx, cy) || 1;
                  const aLen = Math.hypot(aliX, aliY) || 1;
                  flockVecX = (aliX / aLen) * 0.58 + (cx / cLen) * 0.42;
                  flockVecY = (aliY / aLen) * 0.58 + (cy / cLen) * 0.42;
                }

                if (bestFood) {
                  // 结伴采食：70% 朝向微藻食物 + 30% 维持羊群凝聚队形，避免一见食物就散伙
                  const fx = (bestFood.x - org.x) / Math.max(1, bestFoodDist);
                  const fy = (bestFood.y - org.y) / Math.max(1, bestFoodDist);
                  const sumX = fx * 0.72 + flockVecX * 0.28;
                  const sumY = fy * 0.72 + flockVecY * 0.28;
                  org.targetAngle = Math.atan2(sumY, sumX);
                } else if (kinCount > 0 && (flockVecX !== 0 || flockVecY !== 0)) {
                  org.targetAngle = Math.atan2(flockVecY, flockVecX);
                } else {
                  org.targetAngle = org.angle + Math.sin(arenaState.timeSec * 0.8 + org.phaseOffset) * 0.22;
                }
              }
            }
            // 2. 领主智能 (apex): 顶级掠食者，独来独往，大片专属领地，仅对【感官发现或已激怒】的领地入侵者狂暴扑杀
            else if (role === 'apex') {
              org.isEvading = false;
              const territory = org.territoryCenter || { x: org.x, y: org.y, radius: 460 };
              const dToTerritory = Math.hypot(org.x - territory.x, org.y - territory.y);

              // 检查是否有异族或另一只领主入侵本领主领地 (必须通过感官探测或受击仇恨感知，杜绝全知透视作弊)
              let intruder = null;
              let intruderDist = 9999;
              arenaState.organisms.forEach((other) => {
                if (other.hp <= 0 || other === org) return;
                // 同族非领主不视作入侵；但若对方也是 apex 领主（一山不容二虎），同样驱逐
                if (other.colonyId === org.colonyId && other.nicheRole !== 'apex') return;
                // 尊重【起源浅滩】与【5秒破膜适应期】保护
                if ((other.spawnShieldTimer && other.spawnShieldTimer > 0) || (other.colonyId === 'player_colony' && isInsideGenesisShoal(other.x, other.y))) return;

                const dIn = Math.hypot(other.x - territory.x, other.y - territory.y);
                if (dIn < territory.radius + 45) {
                  const hasHatred = (org.hatredMap.get(other.id) || 0) > 5;
                  if (hasHatred || canEntitySenseTarget(org, other, isNight, false).sensed) {
                    const dToSelf = Math.hypot(other.x - org.x, other.y - org.y);
                    if (dToSelf < intruderDist) {
                      intruderDist = dToSelf;
                      intruder = other;
                    }
                  }
                }
              });

              if (intruder) {
                // 狂暴扑杀领地入侵者
                org.targetAngle = Math.atan2(intruder.y - org.y, intruder.x - org.x);
                if (intruderDist < 220 && org.skillCd <= 0 && Math.random() < dt * 2.2) {
                  triggerEntityActiveSkill(org);
                }
              } else if (bestFood && st.carnEff > 0 && org.energy < org.maxEnergy * 0.78) {
                // 领地内进食有机肉块
                org.targetAngle = Math.atan2(bestFood.y - org.y, bestFood.x - org.x);
              } else {
                // 独来独往领地巡航：超出领地半径 75% 时向心折返，否则沿专属领地环道从容巡视
                if (dToTerritory > territory.radius * 0.75) {
                  org.targetAngle = Math.atan2(territory.y - org.y, territory.x - org.x);
                } else {
                  org.territoryAngle = (org.territoryAngle || 0) + 0.65 * dt;
                  const patrolX = territory.x + Math.cos(org.territoryAngle) * (territory.radius * 0.55);
                  const patrolY = territory.y + Math.sin(org.territoryAngle) * (territory.radius * 0.55);
                  org.targetAngle = Math.atan2(patrolY - org.y, patrolX - org.x);
                }
              }
            }
            // 3. 狼群协同智能 (pack): 协同狩猎，同伴感官广播共享目标，动态多翼扇形包抄合围 + 扑咬后侧退游走 (Hit-and-Run)
            else {
              if (org.hitAndRunTimer > 0) org.hitAndRunTimer = Math.max(0, org.hitAndRunTimer - dt);

              // 狼群通信与目标共享：呼应半径 380px 内同伴通过感官锁定的目标（且目标未受起源浅滩庇护）
              let sharedPackTarget = nearestEnemy;
              if (!sharedPackTarget) {
                for (let pi = 0; pi < arenaState.organisms.length; pi++) {
                  const mate = arenaState.organisms[pi];
                  if (mate !== org && mate.hp > 0 && mate.colonyId === org.colonyId) {
                    const candidate = mate.packCurrentTarget;
                    if (candidate && candidate.hp > 0 && !(candidate.spawnShieldTimer > 0) && !(candidate.colonyId === 'player_colony' && isInsideGenesisShoal(candidate.x, candidate.y))) {
                      if (Math.hypot(mate.x - org.x, mate.y - org.y) < 380) {
                        sharedPackTarget = candidate;
                        break;
                      }
                    }
                  }
                }
              }
              org.packCurrentTarget = sharedPackTarget;

              if (shouldPreemptiveEvade) {
                org.targetAngle = Math.atan2(evadeY, evadeX);
                org.isEvading = true;
                if (nearestThreatDist < 175 && org.skillCd <= 0 && st.activeSkill) {
                  triggerEntityActiveSkill(org);
                }
              } else if (bestFood && bestFood.type === 'meat' && bestFoodDist < 195 && st.carnEff > 0) {
                // 猎物被击杀转化为肉块后，优先趋近并吞噬肉块
                org.isEvading = false;
                org.hitAndRunTimer = 0;
                org.targetAngle = Math.atan2(bestFood.y - org.y, bestFood.x - org.x);
              } else if (sharedPackTarget && sharedPackTarget.hp > 0) {
                org.isEvading = false;
                const dTarget = Math.hypot(sharedPackTarget.x - org.x, sharedPackTarget.y - org.y);
                const directAng = Math.atan2(sharedPackTarget.y - org.y, sharedPackTarget.x - org.x);

                // 动态计算本个体在围猎狼群中的包抄侧翼槽位序号，形成左右合围扇面
                let packSlotIdx = 0;
                for (let pi = 0; pi < arenaState.organisms.length; pi++) {
                  const mate = arenaState.organisms[pi];
                  if (mate === org) break;
                  if (mate.hp > 0 && mate.colonyId === org.colonyId && mate.packCurrentTarget === sharedPackTarget) {
                    packSlotIdx++;
                  }
                }
                const flankSign = packSlotIdx % 2 === 1 ? 1 : -1;
                const flankMag = packSlotIdx === 0 ? 0 : Math.min(1.15, Math.ceil(packSlotIdx / 2) * 0.52);
                const dynamicFlank = flankSign * flankMag;

                if (org.hitAndRunTimer > 0) {
                  // 刚刚咬完一击：向侧后方切向游走脱离，给同伴让出正面扑咬通道
                  org.targetAngle = directAng + (flankSign * 1.35);
                } else {
                  // 协同包抄合围：距离 > 95px 时按分配的左右翼夹角包抄，抵近后收拢直扑目标
                  const flank = dTarget > 95 ? dynamicFlank : 0;
                  org.targetAngle = directAng + flank;
                  if (dTarget < 210 && org.skillCd <= 0) {
                    triggerEntityActiveSkill(org);
                  }
                }
              } else if (bestFood) {
                org.isEvading = false;
                org.targetAngle = Math.atan2(bestFood.y - org.y, bestFood.x - org.x);
              } else {
                org.isEvading = false;
                org.targetAngle = org.angle + Math.sin(arenaState.timeSec * 0.7 + org.phaseOffset) * 0.25;
              }
            }

            // 防扎堆、领主独来独往强排斥力 (360px) 以及【起源浅滩】对野生捕食者的信息素屏障排斥
            let sepX = 0;
            let sepY = 0;
            const sepDist = role === 'apex' ? 160 : (role === 'herd' ? 38 : 48);
            arenaState.organisms.forEach((otherOrg) => {
              if (otherOrg === org || otherOrg.hp <= 0) return;
              const kx = org.x - otherOrg.x;
              const ky = org.y - otherOrg.y;
              const kd = Math.hypot(kx, ky);
              const bothApex = (role === 'apex' && otherOrg.nicheRole === 'apex');
              const effSepDist = bothApex ? 360 : sepDist;
              if (kd > 0.1 && kd < effSepDist) {
                const pushWeight = bothApex ? 3.2 : 0.9;
                const push = ((effSepDist - kd) / effSepDist) * pushWeight;
                sepX += (kx / kd) * push;
                sepY += (ky / kd) * push;
              }
            });

            // 【起源浅滩 (Genesis Shoal)】生态屏障：排斥一切非玩家阵营的肉食/杂食捕食者与 Boss
            if (shoal && org.colonyId !== 'player_colony' && (org.isBoss || role === 'apex' || role === 'pack' || org.blueprint.dietType !== 'herbivore')) {
              const sx = org.x - shoal.x;
              const sy = org.y - shoal.y;
              const sd = Math.hypot(sx, sy) || 1;
              const warnR = shoal.radius + 95;
              if (sd < warnR) {
                const shoalPush = ((warnR - sd) / 95) * 4.5;
                sepX += (sx / sd) * shoalPush;
                sepY += (sy / sd) * shoalPush;
              }
            }

            if (sepX !== 0 || sepY !== 0) {
              const dirX = Math.cos(org.targetAngle) + sepX;
              const dirY = Math.sin(org.targetAngle) + sepY;
              org.targetAngle = Math.atan2(dirY, dirX);
            }
          }

          // 3. 物种运动动力学算法：急转力矩增益 + 转向-航速余弦耦合 + 各向异性微流体阻尼 + 器官专属运动步态
          if (org.stunTimer <= 0) {
            const angDiff = Math.atan2(Math.sin(org.targetAngle - org.angle), Math.cos(org.targetAngle - org.angle));
            const absDiff = Math.abs(angDiff);
            // 急转辅助：大角度调头时自动提升转向角速度 (最高 +35%，装备侧鳍额外 +25%)
            const finPivotBonus = st.hasFin ? 0.25 : 0;
            const pivotBoost = 1.0 + (0.35 + finPivotBonus) * Math.min(1.0, absDiff / (Math.PI * 0.5));
            const maxTurnStep = st.maxTurnRate * pivotBoost * dt;
            const flagellumWave = st.maxFlagellaLv > 0 ? Math.sin(arenaState.timeSec * 7.5 + org.phaseOffset) * 0.018 : 0;
            org.angle += Math.max(-maxTurnStep, Math.min(maxTurnStep, angDiff)) + flagellumWave;

            const starvationMult = org.energy <= 0 ? 0.65 : 1.0;
            const slowMult = org.slowTimer > 0 ? 0.40 : 1.0;
            // 高阶鞭毛 (Lv.2/Lv.3) 减免环境流体黏滞阻力 30% / 45%
            const rawDragExcuse = st.maxFlagellaLv >= 3 ? 0.45 : (st.maxFlagellaLv === 2 ? 0.30 : 0);
            const effDragMult = 1.0 + Math.max(0, arenaState.biome.dragMult - 1.0) * (1.0 - rawDragExcuse);

            // 转向-航速耦合制动因子 [0.52, 1.00]：大角度急转时自动微降轴向航速以大幅缩小转弯半径
            const turnSpeedCoupling = Math.max(0.52, Math.cos(Math.min(Math.PI / 3, absDiff)));
            // 喷水囊脉动节律与规避危机肾上腺素加速
            const jetPulse = st.hasJet ? (1.0 + 0.14 * Math.sin(arenaState.timeSec * 6.0 + org.phaseOffset)) : 1.0;
            const evadeBurst = org.isEvading ? 1.12 : 1.0;

            let throttle = 1.0;
            if (org === alpha) {
              if (arenaState.pointerDown) {
                const ptrDist = Math.hypot(arenaState.pointerWorldX - org.x, arenaState.pointerWorldY - org.y);
                throttle = Math.min(1.0, Math.max(0.22, ptrDist / 38));
              } else {
                throttle = 0.32; // 松手时平缓低速滑行
              }
            }

            const targetSpd = ((st.maxSpeed * starvationMult * slowMult * turnSpeedCoupling * jetPulse * evadeBurst * throttle) / effDragMult);

            // 各向异性微流体速度分解：轴向平滑推进 + 法向高阻尼抑制侧滑漂移
            const fwdX = Math.cos(org.angle);
            const fwdY = Math.sin(org.angle);
            const latX = -fwdY;
            const latY = fwdX;
            const vFwd = org.vx * fwdX + org.vy * fwdY;
            const vLat = org.vx * latX + org.vy * latY;
            const axialBlend = 1.0 - Math.exp(-8.5 * dt);
            const lateralDamp = Math.exp(-(st.hasFin ? 14.5 : 9.5) * dt);
            const newVFwd = vFwd + (targetSpd - vFwd) * axialBlend;
            const newVLat = vLat * lateralDamp;
            org.vx = fwdX * newVFwd + latX * newVLat;
            org.vy = fwdY * newVFwd + latY * newVLat;
          } else {
            org.vx *= Math.exp(-6.0 * dt);
            org.vy *= Math.exp(-6.0 * dt);
          }

          org.x = Math.max(org.radius, Math.min(WORLD_W - org.radius, org.x + org.vx * dt));
          org.y = Math.max(org.radius, Math.min(WORLD_H - org.radius, org.y + org.vy * dt));

          // 【起源浅滩 (Genesis Shoal)】硬物理势垒：严禁野生捕食者 (apex / pack / 肉食 / 杂食 / Boss) 闯入起源浅滩半径内
          if (shoal && org.colonyId !== 'player_colony' && (org.isBoss || org.nicheRole === 'apex' || org.nicheRole === 'pack' || org.blueprint.dietType !== 'herbivore')) {
            const dxS = org.x - shoal.x;
            const dyS = org.y - shoal.y;
            const distS = Math.hypot(dxS, dyS) || 1;
            const minS = shoal.radius + org.radius + 6;
            if (distS < minS) {
              const nxS = dxS / distS;
              const nyS = dyS / distS;
              org.x = shoal.x + nxS * minS;
              org.y = shoal.y + nyS * minS;
              const dotS = org.vx * nxS + org.vy * nyS;
              if (dotS < 0) {
                org.vx -= 1.5 * dotS * nxS;
                org.vy -= 1.5 * dotS * nyS;
              }
            }
          }

          // 4. 进食通用营养物质 (nutrient)、微藻 (algae) 与猎物死后转化的有机肉块 (meat)
          for (let fi = arenaState.foods.length - 1; fi >= 0; fi--) {
            const f = arenaState.foods[fi];
            const meatReady = f.type !== 'meat' || !f.eatReadyAt || arenaState.timeSec >= f.eatReadyAt;
            if (!meatReady) continue;
            const d = Math.hypot(f.x - org.x, f.y - org.y);
            // 口器漏斗磁吸效应：通用营养物质适应所有食性，植食吸管磁吸微藻，肉食/杂食口器在肉块凝结完成后磁吸肉块
            const canFunnelPull = f.type === 'nutrient' ||
              (f.type === 'algae' && st.herbEff > 0) ||
              (f.type === 'meat' && st.carnEff > 0 && f.sourceColonyId !== org.colonyId);
            if (canFunnelPull && d <= st.funnelR * (f.type === 'meat' ? 1.15 : 1.0)) {
              f.x += ((org.x - f.x) / Math.max(1, d)) * 120 * dt;
              f.y += ((org.y - f.y) / Math.max(1, d)) * 120 * dt;
            }
            if (d <= org.radius + f.radius) {
              if (f.type === 'nutrient') {
                // 【起源浅滩】通用原生营养质：适应植食/肉食/杂食一切物种，取口器最高转化率计算能量增益并加速幼体发育
                const universalEff = Math.max(st.herbEff || 0, st.carnEff || 0, 1.0);
                const gainE = f.energy * universalEff * st.digestEff;
                org.energy = Math.min(org.maxEnergy, org.energy + gainE);
                accelerateJuvenileGrowth(org, gainE);
                arenaState.foods.splice(fi, 1);
                if (org === alpha) NexusSDK.audio.pop();
              } else if (f.type === 'algae' && st.herbEff > 0) {
                const gainE = f.energy * st.herbEff * st.digestEff;
                org.energy = Math.min(org.maxEnergy, org.energy + gainE);
                accelerateJuvenileGrowth(org, gainE);
                arenaState.foods.splice(fi, 1);
                if (org === alpha) NexusSDK.audio.pop();
              } else if (f.type === 'meat' && st.carnEff > 0 && f.sourceColonyId !== org.colonyId) {
                const gainE = f.energy * st.carnEff * st.digestEff;
                org.energy = Math.min(org.maxEnergy, org.energy + gainE);
                accelerateJuvenileGrowth(org, gainE);
                arenaState.foods.splice(fi, 1);
                if (org === alpha) NexusSDK.audio.pickup();
              }
            }
          }

          // 5. 口部接触撕咬与悬殊体型直接吞噬：
          //    - 仅当捕食者与猎物体型存在极大悬殊 (canSwallowWhole: 有效体积 >= 3.2 倍 且 半径 >= 1.55 倍) 时，才能直接一口吞噬活体猎物；
          //    - 在相似/相近体型下，肉食动物严禁直接吞噬活体猎物（且撕咬活体不直接吸取能量），必须通过攻击杀死猎物，待猎物死后转化为【肉 (meat)】，才能吞噬肉块获取能量！
          if (org.biteCd <= 0) {
            for (let oi = 0; oi < arenaState.organisms.length; oi++) {
              const other = arenaState.organisms[oi];
              if (other.hp <= 0 || other.colonyId === org.colonyId) continue;
              const d = Math.hypot(other.x - org.x, other.y - org.y);
              if (d <= org.radius + other.radius + 6) {
                if (canSwallowWhole(org, other)) {
                  // 体型极大悬殊：直接一口吞噬活体猎物
                  org.biteCd = 0.75;
                  org.hitAndRunTimer = 0;
                  org.energy = Math.max(0, org.energy - st.biteCost * 0.6);
                  if (org.spawnShieldTimer > 0) org.spawnShieldTimer = 0;
                  handleEntityDeath(other, org, { swallowedWhole: true });
                } else {
                  // 相似/相近体型：只能通过撕咬攻击扣减猎物生命，杀死猎物转化为肉块后方可吞噬肉块
                  org.biteCd = 0.65;
                  org.energy = Math.max(0, org.energy - st.biteCost);
                  applyDamage(other, st.biteDmg, org);
                  if (other.hp > 0) {
                    org.hitAndRunTimer = 0.75; // 猎物尚存活时协同游走；若已杀死猎物则留在原地吞噬转化出的肉块
                  } else {
                    org.hitAndRunTimer = 0;
                  }
                  if (org === alpha || other === alpha) NexusSDK.audio.hit();
                }
                break;
              }
            }
          }
        });

        // =====================================================================
        // 生物体积硬碰撞解算器：禁止生物重叠 + 弹性排斥与挤压事件
        // =====================================================================
        resolveOrganismCollisions(dt);

        // 清理死亡生物与更新/清理食物（含猎物死亡转化肉块的微流体散落阻尼）
        arenaState.organisms = arenaState.organisms.filter((o) => o.hp > 0);
        for (let i = arenaState.foods.length - 1; i >= 0; i--) {
          const f = arenaState.foods[i];
          if (f.vx || f.vy) {
            f.x = Math.max(36, Math.min(WORLD_W - 36, f.x + (f.vx || 0) * dt));
            f.y = Math.max(36, Math.min(WORLD_H - 36, f.y + (f.vy || 0) * dt));
            const damp = Math.exp(-5.5 * dt);
            f.vx = (f.vx || 0) * damp;
            f.vy = (f.vy || 0) * damp;
          }
          f.ttl -= dt;
          if (f.ttl <= 0) arenaState.foods.splice(i, 1);
        }

        // 局域网 20Hz 状态同步广播 (Host 权威状态 / Guest 航向输入)
        if (lanSession && lanSession.sendFast && alpha && (arenaState.timeSec - (arenaState.lastLanSyncSec || 0) >= 0.05)) {
          arenaState.lastLanSyncSec = arenaState.timeSec;
          if (isLanGuest) {
            lanSession.sendFast({ type: 'GUEST_INPUT', angle: alpha.targetAngle });
          } else {
            lanSession.sendFast({ type: 'HOST_STATE', hostX: alpha.x, hostY: alpha.y, hostAng: alpha.angle, hostHp: alpha.hp });
          }
        }

        // 更新顶部无文字纯 SVG 状态进度条
        if (alpha) {
          const hpBar = document.getElementById('hud-hp-bar');
          if (hpBar) hpBar.style.width = Math.max(0, Math.min(100, (alpha.hp / alpha.maxHp) * 100)) + '%';
          const enBar = document.getElementById('hud-energy-bar');
          if (enBar) enBar.style.width = Math.max(0, Math.min(100, (alpha.energy / alpha.maxEnergy) * 100)) + '%';
          const cdOverlay = document.getElementById('skill-cd-overlay');
          if (cdOverlay) cdOverlay.classList.toggle('active', alpha.skillCd > 0);
        }

        // 实时推进限时游戏倒计时与种群营养物质总和计分板
        updateMatchTimerAndScoreboard(dt);
      }

      // =====================================================================
      // 生物体积硬碰撞解算器：禁止生物重叠 + 弹性排斥与挤压事件
      // =====================================================================
      function resolveOrganismCollisions(dt) {
        for (let i = 0; i < arenaState.organisms.length; i++) {
          const a = arenaState.organisms[i];
          if (a.hp <= 0) continue;

          for (let j = i + 1; j < arenaState.organisms.length; j++) {
            const b = arenaState.organisms[j];
            if (b.hp <= 0) continue;

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.radius + b.radius;

            if (dist < minDist) {
              // 1. 硬物理分离：根据质量（半径平方）推开双方，禁止生物重叠
              const overlap = minDist - dist;
              let nx = dx / (dist || 1);
              let ny = dy / (dist || 1);
              if (dist < 0.001) {
                const rndAng = Math.random() * Math.PI * 2;
                nx = Math.cos(rndAng);
                ny = Math.sin(rndAng);
              }

              const massA = a.radius * a.radius * (a.isBoss ? 4.0 : 1.0);
              const massB = b.radius * b.radius * (b.isBoss ? 4.0 : 1.0);
              const totalMass = massA + massB;
              const ratioA = massB / totalMass;
              const ratioB = massA / totalMass;

              a.x += nx * overlap * ratioA;
              a.y += ny * overlap * ratioA;
              b.x -= nx * overlap * ratioB;
              b.y -= ny * overlap * ratioB;

              // 边界保底约束
              a.x = Math.max(a.radius, Math.min(WORLD_W - a.radius, a.x));
              a.y = Math.max(a.radius, Math.min(WORLD_H - a.radius, a.y));
              b.x = Math.max(b.radius, Math.min(WORLD_W - b.radius, b.x));
              b.y = Math.max(b.radius, Math.min(WORLD_H - b.radius, b.y));

              // 碰撞沿法线消除逼近速度并施加弹性排斥
              const relVx = a.vx - b.vx;
              const relVy = a.vy - b.vy;
              const normalVel = relVx * nx + relVy * ny;
              if (normalVel < 0) {
                const restitution = 0.35;
                const impulse = -(1 + restitution) * normalVel / totalMass;
                a.vx += (nx * impulse * massB);
                a.vy += (ny * impulse * massB);
                b.vx -= (nx * impulse * massA);
                b.vy -= (ny * impulse * massA);
              }

              // 触发生物挤压形变
              a.squashTimer = 0.16;
              b.squashTimer = 0.16;

              // 角刺接触微创反伤 (若异族且一方具备骨刺/坚硬外壳)
              if (a.colonyId !== b.colonyId) {
                const stA = getEffectiveStats(a);
                const stB = getEffectiveStats(b);
                if (stA.hasSpike && Math.random() < 0.15) {
                  applyDamage(b, 4.5, a);
                }
                if (stB.hasSpike && Math.random() < 0.15) {
                  applyDamage(a, 4.5, b);
                }
              }
            }
          }
        }
      }

      /* =====================================================================
       * 12. 感官驱动广角视口渲染器 (VIEWPORT_ZOOM = 0.68 · 视觉扇形彩色 vs 听觉360°声呐雷达定格与边缘裁剪)
       * ===================================================================== */
      const VIEWPORT_ZOOM = 0.68;

      function resizeArenaCanvas() {
        const canvas = document.getElementById('petri-canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
        }
      }
      window.addEventListener('resize', resizeArenaCanvas);

      const petriCanvas = document.getElementById('petri-canvas');
      if (petriCanvas) {
        const updatePointer = (clientX, clientY) => {
          const rect = petriCanvas.getBoundingClientRect();
          const alpha = arenaState.alpha;
          if (!alpha) return;
          const sx = clientX - rect.left;
          const sy = clientY - rect.top;
          arenaState.pointerWorldX = alpha.x + (sx - petriCanvas.width * 0.5) / VIEWPORT_ZOOM;
          arenaState.pointerWorldY = alpha.y + (sy - petriCanvas.height * 0.5) / VIEWPORT_ZOOM;
        };
        petriCanvas.addEventListener('pointerdown', (e) => {
          arenaState.pointerDown = true;
          updatePointer(e.clientX, e.clientY);
        });
        petriCanvas.addEventListener('pointermove', (e) => {
          if (arenaState.pointerDown) updatePointer(e.clientX, e.clientY);
        });
        window.addEventListener('pointerup', () => { arenaState.pointerDown = false; });
      }

      // 计算听觉距离信号衰减系数：距离越远，声呐回波信号越弱 (0.08 ~ 1.00 平滑衰减，边缘与背景融合)
      function getSonarDistanceFactor(dist, maxR, absR = 100) {
        if (dist > maxR) return 0;
        const innerCore = Math.min(absR * 0.65, maxR * 0.22);
        if (dist <= innerCore) return 1.0;
        const t = Math.max(0, Math.min(1, (dist - innerCore) / Math.max(30, maxR - innerCore)));
        const smooth = 1 - t * t * (3 - 2 * t);
        return Math.max(0.06, Math.pow(smooth, 1.35));
      }

      // 计算个体周围【绝对感知彩色区】与【视觉扇形区】的联合感知清晰度与边缘模糊度
      // - 在绝对感知区内 (dist <= absR)：无论是否装备视觉/听觉，始终呈现 100% 彩色高清画面，并在外缘 [0.72*absR, 1.28*absR] 平滑渐变融合
      // - 在视觉扇形区内，严格遵循生态位视觉分化：
      //   1. 掠食者 (predator)：长距离 · 高精度 · 窄视野 (coreFocus=0.80, maxBlur=1.5px，远距猎物纤毫毕现)
      //   2. 生产者 (producer)：中距离 · 低精度 · 宽视野 (coreFocus=0.24, maxBlur=6.8px，广角监控藻群与天敌色块动向)
      //   3. 杂食者 (omnivore)：中长距离 · 标准精度 · 标准视野 (coreFocus=0.50, maxBlur=4.2px)
      function computeColorVisionEnvelope(px, py, alpha, st, isNight) {
        const dx = px - alpha.x;
        const dy = py - alpha.y;
        const dist = Math.hypot(dx, dy);
        const absR = st.absSenseRange || 110;
        const absFeatherEnd = absR * 1.28;

        // 1. 绝对感知区贡献 (360° 全向近体彩色感知)
        let absWeight = 0;
        if (dist <= absR * 0.72) {
          absWeight = 1.0;
        } else if (dist <= absFeatherEnd) {
          const t = (dist - absR * 0.72) / Math.max(12, absFeatherEnd - absR * 0.72);
          absWeight = 1 - t * t * (3 - 2 * t);
        }

        // 2. 生态位分化视觉扇形贡献
        let eyeWeight = 0;
        let eyeBlurPx = 0;
        const coreFocus = st.visionCoreFocus !== undefined ? st.visionCoreFocus : 0.50;
        const maxBlur = st.visionBlurMax !== undefined ? st.visionBlurMax : 4.20;
        if (st.maxEyeLv > 0) {
          const effRange = alpha.blindTimer > 0 ? Math.max(absR * 1.15, 130) : (isNight ? st.nightEyeRange : st.dayEyeRange);
          const halfRad = ((isNight ? st.nightEyeAngle : st.dayEyeAngle) * 0.5) * (Math.PI / 180);
          const angFeather = Math.min(0.34, halfRad * 0.30);
          if (dist <= effRange && halfRad > 0) {
            const angToTarget = Math.atan2(dy, dx);
            const diff = Math.abs(Math.atan2(Math.sin(angToTarget - alpha.angle), Math.cos(angToTarget - alpha.angle)));
            if (diff <= halfRad + angFeather) {
              const rNorm = Math.max(0, Math.min(1, (dist - absR * 0.45) / Math.max(40, effRange - absR * 0.45)));
              const rSmooth = rNorm <= coreFocus ? 1.0 : (1 - Math.pow((rNorm - coreFocus) / Math.max(0.15, 1 - coreFocus), 1.45));
              const aNorm = Math.max(0, Math.min(1, diff / Math.max(0.05, halfRad + angFeather)));
              const aSmooth = aNorm <= coreFocus ? 1.0 : (1 - Math.pow((aNorm - coreFocus) / Math.max(0.15, 1 - coreFocus), 1.55));
              eyeWeight = Math.max(0, Math.min(1, rSmooth * aSmooth));
              // 按生态位光学精度计算散焦模糊度 (掠食者前 80% 保持 0px 锐利；生产者超过 24% 即呈广角低精度散焦模糊)
              const rBlur = rNorm <= coreFocus * 0.85 ? 0 : Math.pow((rNorm - coreFocus * 0.85) / Math.max(0.15, 1 - coreFocus * 0.85), 1.15);
              const aBlur = aNorm <= coreFocus * 0.85 ? 0 : Math.pow((aNorm - coreFocus * 0.85) / Math.max(0.15, 1 - coreFocus * 0.85), 1.35);
              const blurFactor = Math.max(0, Math.min(1, 0.72 * rBlur + 0.42 * aBlur));
              eyeBlurPx = +(blurFactor * maxBlur).toFixed(2);
            }
          }
        }

        const weight = Math.max(absWeight, eyeWeight);
        // 若处于近体绝对感知核心区，强制清晰无模糊；向外过渡时按权重平滑插值模糊度
        const blurPx = absWeight >= 0.85 ? 0 : +(eyeBlurPx * (1 - absWeight * 0.85)).toFixed(2);
        return { weight, blurPx, absWeight, eyeWeight, dist, absR };
      }

      // 五大地质演化纪元生物圈的多层视差海雪、深海散景光斑与地貌微结构确定性缓存
      const biomeDecorCacheMap = {};
      function getBiomeDecorCache(biomeId) {
        if (biomeDecorCacheMap[biomeId]) return biomeDecorCacheMap[biomeId];
        let seed = (biomeId + 1) * 9781 + 1337;
        const nextRand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };

        // Layer 0.5: 深层散景微囊光斑 (Parallax = 0.32)
        const ambientBokeh = [];
        for (let i = 0; i < 42; i++) {
          ambientBokeh.push({
            x: nextRand() * WORLD_W,
            y: nextRand() * WORLD_H,
            r: 22 + nextRand() * 54,
            phase: nextRand() * Math.PI * 2,
            speed: 0.35 + nextRand() * 0.55,
            isSecondary: nextRand() > 0.55
          });
        }

        // Layer 2: 多深度视差海雪与生物荧光胶体微粒 (Parallax = 0.55 ~ 0.92)
        const marineSnow = [];
        for (let i = 0; i < 84; i++) {
          marineSnow.push({
            x: nextRand() * WORLD_W,
            y: nextRand() * WORLD_H,
            r: 1.3 + nextRand() * 2.8,
            parallax: 0.52 + nextRand() * 0.40,
            driftX: (nextRand() - 0.5) * 14,
            driftY: (nextRand() - 0.5) * 14,
            phase: nextRand() * Math.PI * 2,
            isSecondary: nextRand() > 0.62
          });
        }

        // Layer 1: 五大生物圈专属地质演化地貌与光学微结构 (World-Space 1.0x)
        const geologyFeatures = [];
        const featureCount = 22;
        for (let i = 0; i < featureCount; i++) {
          const fx = 160 + nextRand() * (WORLD_W - 320);
          const fy = 140 + nextRand() * (WORLD_H - 280);
          const radius = 58 + nextRand() * 92;
          const angle = nextRand() * Math.PI * 2;
          const phase = nextRand() * Math.PI * 2;
          const branches = [];
          const branchCount = 4 + Math.floor(nextRand() * 3);
          for (let b = 0; b < branchCount; b++) {
            const bAng = angle + (b / branchCount) * Math.PI * 2 + (nextRand() - 0.5) * 0.45;
            const bLen = radius * (0.55 + nextRand() * 0.65);
            branches.push({
              ang: bAng,
              len: bLen,
              midOffset: (nextRand() - 0.5) * 28
            });
          }
          geologyFeatures.push({ x: fx, y: fy, radius, angle, phase, branches });
        }

        const cache = { ambientBokeh, marineSnow, geologyFeatures };
        biomeDecorCacheMap[biomeId] = cache;
        return cache;
      }

      // 渲染感官外围的深海培养皿流体基底 (Layer 0 —— 让所有感官区域平滑渐变融入深邃活体原汤而非死黑矩形)
      function renderOuterPetriFluidBase(ctx, camX, camY, viewW, viewH, alpha, biome) {
        const left = camX - viewW * 0.5;
        const top = camY - viewH * 0.5;
        const outerGrad = ctx.createRadialGradient(alpha.x, alpha.y, 60, alpha.x, alpha.y, Math.max(viewW, viewH) * 0.72);
        outerGrad.addColorStop(0, biome.bgOuter || '#020c14');
        outerGrad.addColorStop(0.65, '#020710');
        outerGrad.addColorStop(1, '#010308');
        ctx.fillStyle = outerGrad;
        ctx.fillRect(left, top, viewW, viewH);

        // 极微弱的深层原汤散景光斑与暗流纹理，赋予感官盲区深海培养皿呼吸感
        const cache = getBiomeDecorCache(biome.id);
        const t = arenaState.timeSec;
        const rgb = biome.accentRgba || '45, 212, 191';
        ctx.save();
        for (let i = 0; i < cache.ambientBokeh.length; i += 2) {
          const b = cache.ambientBokeh[i];
          const wx = b.x + (camX - WORLD_W * 0.5) * 0.22 + Math.sin(t * b.speed + b.phase) * 18;
          const wy = b.y + (camY - WORLD_H * 0.5) * 0.22 + Math.cos(t * b.speed + b.phase) * 18;
          if (wx + b.r < left || wx - b.r > left + viewW || wy + b.r < top || wy - b.r > top + viewH) continue;
          const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, b.r);
          g.addColorStop(0, `rgba(${rgb}, 0.032)`);
          g.addColorStop(1, `rgba(${rgb}, 0.0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(wx, wy, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 渲染生物圈专属多层视差流体、地貌裂隙与丁达尔光学背景 (Layer 1 & Layer 2)
      function renderBiomeEnvironmentBackdrop(ctx, camX, camY, viewW, viewH, isNight, sonarWireframeMode) {
        const alpha = arenaState.alpha;
        const st = getEffectiveStats(alpha);
        const absR = st.absSenseRange || 110;
        const biome = arenaState.biome || BIOMES[0];
        const cache = getBiomeDecorCache(biome.id);
        const left = camX - viewW * 0.5;
        const top = camY - viewH * 0.5;
        const right = left + viewW;
        const bottom = top + viewH;
        const t = arenaState.timeSec;
        const priRgb = biome.accentRgba || '45, 212, 191';
        const secRgb = biome.secondaryRgba || '52, 211, 153';

        // 1. 基底流体径向渐变 (彩色通道呈现章节专属原汤色温，声呐通道呈现深潜雷达微光底色)
        if (sonarWireframeMode) {
          const sonarBgGrad = ctx.createRadialGradient(alpha.x, alpha.y, absR * 0.35, alpha.x, alpha.y, Math.max(absR + 60, st.sonarRange));
          sonarBgGrad.addColorStop(0, 'rgba(5, 20, 36, 0.94)');
          sonarBgGrad.addColorStop(0.62, 'rgba(3, 12, 24, 0.76)');
          sonarBgGrad.addColorStop(1, `rgba(${biome.outerRgb || '2, 8, 16'}, 0.0)`);
          ctx.fillStyle = sonarBgGrad;
          ctx.fillRect(left, top, viewW, viewH);
        } else {
          const fluidGrad = ctx.createRadialGradient(alpha.x, alpha.y, absR * 0.25, alpha.x, alpha.y, Math.max(viewW, viewH) * 0.65);
          if (isNight && !biome.forceNight) {
            fluidGrad.addColorStop(0, '#071a2c');
            fluidGrad.addColorStop(0.58, '#040e1c');
            fluidGrad.addColorStop(1, biome.bgOuter || '#020814');
          } else {
            fluidGrad.addColorStop(0, biome.bgInner || '#0a3340');
            fluidGrad.addColorStop(0.58, biome.bgTint || '#041824');
            fluidGrad.addColorStop(1, biome.bgOuter || '#020c14');
          }
          ctx.fillStyle = fluidGrad;
          ctx.fillRect(left, top, viewW, viewH);

          // 1.1 深海散景微囊光斑 (Layer 0.5 —— 0.32x 视差深度)
          for (let i = 0; i < cache.ambientBokeh.length; i++) {
            const b = cache.ambientBokeh[i];
            const wx = b.x + (camX - WORLD_W * 0.5) * 0.28 + Math.sin(t * b.speed + b.phase) * 20;
            const wy = b.y + (camY - WORLD_H * 0.5) * 0.28 + Math.cos(t * b.speed + b.phase) * 20;
            if (wx + b.r < left || wx - b.r > right || wy + b.r < top || wy - b.r > bottom) continue;
            const rgb = b.isSecondary ? secRgb : priRgb;
            const pulseA = (isNight ? 0.055 : 0.085) * (0.7 + 0.3 * Math.sin(t * 0.9 + b.phase));
            const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, b.r);
            g.addColorStop(0, `rgba(${rgb}, ${pulseA.toFixed(3)})`);
            g.addColorStop(1, `rgba(${rgb}, 0.0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(wx, wy, b.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 2. 显微镜培养皿坐标网与十字微刻度
        ctx.strokeStyle = sonarWireframeMode ? 'rgba(56, 189, 248, 0.065)' : `rgba(${priRgb}, 0.055)`;
        ctx.lineWidth = 1;
        const startX = Math.floor(left / 80) * 80;
        const startY = Math.floor(top / 80) * 80;
        for (let x = startX; x < right; x += 80) {
          ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        }
        for (let y = startY; y < bottom; y += 80) {
          ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        }

        // 3. 五大地质演化章节专属光学与海底地貌微结构 (Layer 1)
        ctx.save();
        for (let i = 0; i < cache.geologyFeatures.length; i++) {
          const f = cache.geologyFeatures[i];
          if (f.x + f.radius * 1.4 < left || f.x - f.radius * 1.4 > right || f.y + f.radius * 1.4 < top || f.y - f.radius * 1.4 > bottom) continue;

          if (sonarWireframeMode) {
            // 听觉声呐区：将海底地貌转化为随距离衰减的声学地形回波等高线
            const dFeat = Math.hypot(f.x - alpha.x, f.y - alpha.y);
            if (dFeat > st.sonarRange + f.radius) continue;
            const sFactor = getSonarDistanceFactor(dFeat, st.sonarRange, absR);
            ctx.strokeStyle = `rgba(56, 189, 248, ${(0.18 * sFactor).toFixed(3)})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * 0.55, 0, Math.PI * 2);
            ctx.stroke();
            continue;
          }

          if (biome.motif === 'caustics') {
            // 第一章【浅海温床】：摇曳的丁达尔焦散光网与透光硅藻环
            const sway = Math.sin(t * 1.15 + f.phase) * 12;
            const causticAlpha = isNight ? 0.06 : 0.14;
            ctx.strokeStyle = `rgba(${priRgb}, ${causticAlpha})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let b = 0; b < f.branches.length; b++) {
              const br = f.branches[b];
              const ex = f.x + Math.cos(br.ang + sway * 0.015) * br.len;
              const ey = f.y + Math.sin(br.ang + sway * 0.015) * br.len;
              const cx = (f.x + ex) * 0.5 + Math.cos(br.ang + 1.57) * br.midOffset;
              const cy = (f.y + ey) * 0.5 + Math.sin(br.ang + 1.57) * br.midOffset;
              ctx.moveTo(f.x + sway * 0.4, f.y);
              ctx.quadraticCurveTo(cx, cy, ex, ey);
            }
            ctx.stroke();
          } else if (biome.motif === 'magma') {
            // 第二章【嗜热喷口】：海底脉动地幔熔岩微裂隙与热液喷口光晕
            const glow = 0.55 + 0.45 * Math.sin(t * 2.2 + f.phase);
            const ventGrad = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.radius * 0.75);
            ventGrad.addColorStop(0, `rgba(251, 146, 60, ${(0.22 * glow).toFixed(3)})`);
            ventGrad.addColorStop(0.5, `rgba(244, 63, 94, ${(0.09 * glow).toFixed(3)})`);
            ventGrad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
            ctx.fillStyle = ventGrad;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * 0.75, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(251, 146, 60, ${(0.24 * glow).toFixed(3)})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let b = 0; b < f.branches.length; b++) {
              const br = f.branches[b];
              const mx = f.x + Math.cos(br.ang) * (br.len * 0.5) + br.midOffset * 0.4;
              const my = f.y + Math.sin(br.ang) * (br.len * 0.5) - br.midOffset * 0.4;
              const ex = f.x + Math.cos(br.ang) * br.len;
              const ey = f.y + Math.sin(br.ang) * br.len;
              ctx.moveTo(f.x, f.y);
              ctx.lineTo(mx, my);
              ctx.lineTo(ex, ey);
            }
            ctx.stroke();
          } else if (biome.motif === 'frost') {
            // 第三章【极寒冰隙】：六角冰晶几何折射晶格与极光冷流
            const shimmer = 0.6 + 0.4 * Math.sin(t * 1.4 + f.phase);
            ctx.strokeStyle = `rgba(125, 211, 252, ${(0.18 * shimmer).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            const hexR = f.radius * 0.52;
            for (let k = 0; k < 6; k++) {
              const a = f.angle + (k * Math.PI) / 3;
              const hx = f.x + Math.cos(a) * hexR;
              const hy = f.y + Math.sin(a) * hexR;
              if (k === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
              ctx.moveTo(f.x, f.y);
              ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          } else if (biome.motif === 'miasma') {
            // 第四章【剧毒沼泽】：腐殖酸海盆缓慢鼓泡扩散的毒沼孢子圈
            const cycle = (t * 0.38 + f.phase) % 1;
            const ringR = f.radius * (0.25 + cycle * 0.75);
            const ringA = (1 - cycle) * 0.22;
            ctx.strokeStyle = `rgba(74, 222, 128, ${ringA.toFixed(3)})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(f.x, f.y, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(168, 85, 247, 0.06)';
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * 0.38, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // 第五章【深渊裂谷】：埃迪卡拉超深渊暗流等深线与生物电脉冲星云
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + f.phase);
            const nebGrad = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius * 0.7);
            nebGrad.addColorStop(0, `rgba(168, 85, 247, ${(0.18 * pulse).toFixed(3)})`);
            nebGrad.addColorStop(0.6, `rgba(45, 212, 191, ${(0.07 * pulse).toFixed(3)})`);
            nebGrad.addColorStop(1, 'rgba(45, 212, 191, 0.0)');
            ctx.fillStyle = nebGrad;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // 4. 多深度视差生物荧光海雪与胶体微粒 (Layer 2 —— 仅在彩色感官通道渲染)
        if (!sonarWireframeMode) {
          ctx.save();
          for (let i = 0; i < cache.marineSnow.length; i++) {
            const p = cache.marineSnow[i];
            const px = (p.x + (camX - WORLD_W * 0.5) * (1 - p.parallax) + Math.sin(t * 0.7 + p.phase) * p.driftX + WORLD_W) % WORLD_W;
            const py = (p.y + (camY - WORLD_H * 0.5) * (1 - p.parallax) + Math.cos(t * 0.6 + p.phase) * p.driftY + WORLD_H) % WORLD_H;
            if (px < left - 10 || px > right + 10 || py < top - 10 || py > bottom + 10) continue;
            const twinkle = 0.14 + 0.18 * Math.sin(t * 2.1 + p.phase);
            const rgb = p.isSecondary ? secRgb : priRgb;
            ctx.fillStyle = `rgba(${rgb}, ${twinkle.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(px, py, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 5. 培养皿世界边界刻度环框 (2800 × 1800 边缘光学护栏)
        ctx.save();
        ctx.strokeStyle = sonarWireframeMode ? 'rgba(56, 189, 248, 0.22)' : `rgba(${priRgb}, 0.28)`;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(8, 8, WORLD_W - 16, WORLD_H - 16);
        ctx.restore();
      }

      function renderWorldPass(ctx, camX, camY, viewW, viewH, isNight, sonarWireframeMode) {
        const alpha = arenaState.alpha;
        const st = getEffectiveStats(alpha);
        const absR = st.absSenseRange || 110;
        const pulsePeriod = st.sonarPulseSec || 0.95;
        const pulseCycle = Math.floor(arenaState.timeSec / pulsePeriod);
        const pulseFrac = (arenaState.timeSec % pulsePeriod) / pulsePeriod;
        const waveR = pulseFrac * st.sonarRange;

        // 1. 渲染五大演化章节专属多层视差流体、地貌微结构与海雪背景
        renderBiomeEnvironmentBackdrop(ctx, camX, camY, viewW, viewH, isNight, sonarWireframeMode);

        // 1.5 绘制中央【起源浅滩 (Genesis Shoal)】新物种摇篮生态庇护区边界环与暖流光晕
        if (arenaState.genesisShoal) {
          const gs = arenaState.genesisShoal;
          ctx.save();
          ctx.beginPath();
          ctx.arc(gs.x, gs.y, gs.radius, 0, Math.PI * 2);
          if (sonarWireframeMode) {
            const dShoal = Math.max(0, Math.hypot(gs.x - alpha.x, gs.y - alpha.y) - gs.radius * 0.5);
            const sFactor = getSonarDistanceFactor(dShoal, st.sonarRange, absR);
            ctx.fillStyle = `rgba(16, 185, 129, ${(0.06 * sFactor).toFixed(3)})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(16, 185, 129, ${(0.52 * sFactor).toFixed(3)})`;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([8, 6]);
            ctx.stroke();
          } else {
            const gradShoal = ctx.createRadialGradient(gs.x, gs.y, gs.radius * 0.15, gs.x, gs.y, gs.radius);
            gradShoal.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
            gradShoal.addColorStop(0.75, 'rgba(45, 212, 191, 0.06)');
            gradShoal.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
            ctx.fillStyle = gradShoal;
            ctx.fill();
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.42)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([10, 6]);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }

        // 声呐雷达模式下绘制同心雷达距离刻度环、十字准星与扩散扫描波前 (距离越远刻度环与波前信号越弱)
        if (sonarWireframeMode && st.maxEarLv > 0) {
          [0.33, 0.66, 1.0].forEach((ratio) => {
            const ringFalloff = Math.max(0.08, 1.0 - ratio * 0.72);
            ctx.beginPath();
            ctx.arc(alpha.x, alpha.y, st.sonarRange * ratio, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${(0.28 * ringFalloff).toFixed(3)})`;
            ctx.lineWidth = ratio === 1.0 ? 1.2 : 1.0;
            ctx.stroke();
          });
          const axisGrad = ctx.createRadialGradient(alpha.x, alpha.y, absR * 0.4, alpha.x, alpha.y, st.sonarRange);
          axisGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
          axisGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.07)');
          axisGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          ctx.beginPath();
          ctx.moveTo(alpha.x - st.sonarRange, alpha.y);
          ctx.lineTo(alpha.x + st.sonarRange, alpha.y);
          ctx.moveTo(alpha.x, alpha.y - st.sonarRange);
          ctx.lineTo(alpha.x, alpha.y + st.sonarRange);
          ctx.strokeStyle = axisGrad;
          ctx.lineWidth = 1;
          ctx.stroke();

          const waveDistFalloff = Math.pow(1 - pulseFrac, 1.35);
          ctx.beginPath();
          ctx.arc(alpha.x, alpha.y, waveR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${(waveDistFalloff * 0.68).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.8, 2.2 * waveDistFalloff);
          ctx.stroke();
        }

        // 2. 绘制海底热泉喷口 (env-vent.svg —— 声呐下按距离衰减，彩色下按视觉包络模糊与透明度渐变融合)
        arenaState.vents.forEach((v) => {
          if (Math.abs(v.x - camX) > viewW * 0.6 || Math.abs(v.y - camY) > viewH * 0.6) return;
          const dist = Math.hypot(v.x - alpha.x, v.y - alpha.y);
          if (sonarWireframeMode) {
            if (dist - v.radius > st.sonarRange) return;
            const sFactor = getSonarDistanceFactor(dist, st.sonarRange, absR);
            ctx.beginPath();
            ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${(0.48 * sFactor).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.7, 1.5 * sFactor);
            ctx.stroke();
          } else {
            const env = computeColorVisionEnvelope(v.x, v.y, alpha, st, isNight);
            if (env.weight <= 0.02) return;
            ctx.save();
            if (env.blurPx >= 0.6) ctx.filter = `blur(${env.blurPx}px)`;
            drawSpriteCentered(ctx, 'env-vent.svg', v.x, v.y, v.radius * 1.8, v.radius * 1.8, 0, 0.85);
            ctx.restore();
          }
        });

        // 3. 绘制食物 (起源浅滩通用营养物质 nutrient、微藻 env-algae.svg 与肉块 env-meat.svg)
        arenaState.foods.forEach((f) => {
          if (Math.abs(f.x - camX) > viewW * 0.55 || Math.abs(f.y - camY) > viewH * 0.55) return;
          const dist = Math.hypot(f.x - alpha.x, f.y - alpha.y);
          if (sonarWireframeMode) {
            const foodSonarCap = f.type === 'algae' ? Math.max(absR, st.staticSenseRange) : st.sonarRange;
            if (dist - f.radius > foodSonarCap) return;
            const distFactor = getSonarDistanceFactor(dist, foodSonarCap, absR);
            if (distFactor <= 0.03) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(alpha.x, alpha.y, foodSonarCap, 0, Math.PI * 2);
            ctx.clip();
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.radius * (0.65 + 0.30 * distFactor), 0, Math.PI * 2);
            // 听觉系统中：食物统一为黄色 (#fbbf24)，距离越远信号越弱、透明度与线宽随距离平滑衰减
            const baseFillA = f.type === 'meat' ? 0.32 : (f.type === 'nutrient' ? 0.38 : 0.22);
            const baseStrokeA = f.type === 'meat' ? 0.96 : (f.type === 'nutrient' ? 1.0 : 0.82);
            ctx.fillStyle = `rgba(251, 191, 36, ${(baseFillA * distFactor).toFixed(3)})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(251, 191, 36, ${(baseStrokeA * distFactor).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.6, 1.5 * distFactor);
            ctx.stroke();
            if (f.type === 'nutrient') {
              ctx.beginPath();
              ctx.arc(f.x, f.y, f.radius * 0.38, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(253, 224, 71, ${(0.95 * distFactor).toFixed(3)})`;
              ctx.fill();
            }
            ctx.restore();
          } else {
            const env = computeColorVisionEnvelope(f.x, f.y, alpha, st, isNight);
            if (env.weight <= 0.02) return;
            ctx.save();
            if (env.blurPx >= 0.6) {
              ctx.filter = `blur(${env.blurPx}px) saturate(${Math.round(st.eyeSat * 100)}%)`;
            }
            if (f.type === 'nutrient') {
              // 【起源浅滩】通用原生营养质：青金双色发光营养液滴 + 微藻核心贴图
              ctx.beginPath();
              ctx.arc(f.x, f.y, f.radius * 1.45, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(45, 212, 191, 0.72)';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              drawSpriteCentered(ctx, 'env-algae.svg', f.x, f.y, f.radius * 2.1, f.radius * 2.1, 0);
              ctx.beginPath();
              ctx.arc(f.x, f.y, f.radius * 0.42, 0, Math.PI * 2);
              ctx.fillStyle = '#fde047';
              ctx.fill();
            } else if (f.type === 'meat') {
              // 猎物死亡转化出的有机肉块：珊瑚红果冻发光包络 + env-meat.svg 贴图（0.45s 凝结期内呈现转化脉冲环）
              const converting = f.eatReadyAt && arenaState.timeSec < f.eatReadyAt;
              ctx.beginPath();
              ctx.arc(f.x, f.y, f.radius * (converting ? 1.65 : 1.35), 0, Math.PI * 2);
              ctx.fillStyle = converting ? 'rgba(244, 63, 94, 0.28)' : 'rgba(244, 63, 94, 0.16)';
              ctx.fill();
              if (converting) {
                ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
              }
              drawSpriteCentered(ctx, 'env-meat.svg', f.x, f.y, f.radius * 2.45, f.radius * 2.45, 0);
            } else {
              drawSpriteCentered(ctx, 'env-algae.svg', f.x, f.y, f.radius * 2.3, f.radius * 2.3, 0);
            }
            ctx.restore();
          }
        });

        // 4. 绘制区域危害 (墨囊、毒雾、电弧)
        arenaState.hazards.forEach((h) => {
          const dist = Math.hypot(h.x - alpha.x, h.y - alpha.y);
          if (sonarWireframeMode) {
            if (dist - h.radius > st.sonarRange) return;
            const sFactor = getSonarDistanceFactor(Math.max(0, dist - h.radius * 0.5), st.sonarRange, absR);
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
            // 听觉系统中：区域危险调整为红色 (#ef4444)，随距离衰减
            ctx.fillStyle = `rgba(239, 68, 68, ${(0.16 * sFactor).toFixed(3)})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(239, 68, 68, ${(0.85 * sFactor).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.7, 1.5 * sFactor);
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            const env = computeColorVisionEnvelope(h.x, h.y, alpha, st, isNight);
            if (env.weight <= 0.02) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
            ctx.fillStyle = h.type === 'ink' ? 'rgba(5, 8, 18, 0.82)' : (h.type === 'venom' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(45, 212, 191, 0.35)');
            ctx.fill();
            ctx.restore();
          }
        });

        // 5. 绘制骨刺投射物
        arenaState.projectiles.forEach((p) => {
          const dist = Math.hypot(p.x - alpha.x, p.y - alpha.y);
          if (sonarWireframeMode) {
            if (dist > st.sonarRange) return;
            const sFactor = getSonarDistanceFactor(dist, st.sonarRange, absR);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${(0.95 * sFactor).toFixed(3)})`;
            ctx.fill();
          } else {
            const env = computeColorVisionEnvelope(p.x, p.y, alpha, st, isNight);
            if (env.weight <= 0.02) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.0, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
            ctx.restore();
          }
        });

        // 6. 绘制所有生物实体
        // - 听觉通道：360° 扩大范围雷达定格影像，距离越远信号越弱 (`distFactor * timeEchoAlpha`)，边缘平滑消隐
        // - 彩色通道：绝对感知区内 100% 清晰彩色；视觉长距扇形区内中心清晰、越靠外越模糊 (`blurPx`) 且透明度渐变融合
        arenaState.organisms.forEach((org) => {
          if (Math.abs(org.x - camX) > viewW * 0.65 || Math.abs(org.y - camY) > viewH * 0.65) return;
          const dist = Math.hypot(org.x - alpha.x, org.y - alpha.y);
          const sonarRel = classifySonarRelation(org, alpha);
          if (org !== alpha) {
            if (sonarWireframeMode) {
              const targetSpeed = Math.hypot(org.vx || 0, org.vy || 0);
              const effSonarR = targetSpeed < 8 ? Math.max(absR, st.staticSenseRange) : st.sonarRange;
              const bodyExtent = org.radius * 2.4;

              // 当雷达扫描脉冲波前扫过目标 (或初始首次进入听觉圈) 时，锁定目标的雷达定格影像快照
              const sweptByWave = (dist - bodyExtent <= waveR) && (org.sonarDetectedCycle !== pulseCycle);
              const initialCapture = org.sonarLastPulseSec < 0 && (dist - bodyExtent <= effSonarR);
              if ((dist - bodyExtent <= effSonarR) && (sweptByWave || initialCapture)) {
                org.sonarLastSeenX = org.x;
                org.sonarLastSeenY = org.y;
                org.sonarRelX = org.x - alpha.x;
                org.sonarRelY = org.y - alpha.y;
                org.sonarSnapAngle = org.angle;
                org.sonarSnapPhase = arenaState.timeSec * 6.5 + (org.phaseOffset || 0);
                org.sonarLastPulseSec = arenaState.timeSec;
                if (sweptByWave) {
                  org.sonarDetectedCycle = pulseCycle;
                }
              }

              if (org.sonarRelX === null || org.sonarRelY === null) return;
              const snapX = alpha.x + org.sonarRelX;
              const snapY = alpha.y + org.sonarRelY;
              const snapDist = Math.hypot(org.sonarRelX, org.sonarRelY);
              const ageSec = arenaState.timeSec - org.sonarLastPulseSec;
              if (snapDist - bodyExtent > effSonarR || ageSec > pulsePeriod * 1.45) return;

              // 听觉信号强度 = 脉冲时间余晖衰减 × 距离平滑衰减 (距离越远信号越弱)
              const timeEchoAlpha = Math.max(0.28, 1.0 - 0.58 * Math.min(1.0, Math.max(0, ageSec) / pulsePeriod));
              const distSignalFactor = getSonarDistanceFactor(Math.max(0, snapDist - org.radius * 0.5), effSonarR, absR);
              const echoAlpha = Math.max(0.06, timeEchoAlpha * distSignalFactor);

              const needsInnerClip = effSonarR < st.sonarRange - 1;
              ctx.save();
              if (needsInnerClip) {
                ctx.beginPath();
                ctx.arc(alpha.x, alpha.y, effSonarR, 0, Math.PI * 2);
                ctx.clip();
              }

              const savedX = org.x;
              const savedY = org.y;
              const savedAng = org.angle;
              org.x = snapX;
              org.y = snapY;
              org.angle = org.sonarSnapAngle || org.angle;
              drawOrganism(ctx, org, {
                freezePhase: org.sonarSnapPhase,
                sonarWireframe: true,
                sonarAlpha: echoAlpha,
                sonarRelation: sonarRel,
                observer: alpha
              });
              org.x = savedX;
              org.y = savedY;
              org.angle = savedAng;
              ctx.restore();

              // 若个体跨越听觉边缘，绘制随距离衰减的微弱声呐截面回波弧
              if (Math.abs(snapDist - effSonarR) < bodyExtent) {
                const edgeAng = Math.atan2(org.sonarRelY, org.sonarRelX);
                const arcSpan = Math.min(0.32, bodyExtent / Math.max(80, effSonarR));
                const edgePal = getSonarPalette(sonarRel, echoAlpha * 0.65);
                ctx.beginPath();
                ctx.arc(alpha.x, alpha.y, effSonarR, edgeAng - arcSpan, edgeAng + arcSpan);
                ctx.strokeStyle = edgePal.stroke;
                ctx.lineWidth = 1.6;
                ctx.stroke();
              }
              return;
            } else {
              // 彩色视觉通道：绝对感知区内无视拟态且 100% 清晰；扇形远端开启拟态可隐匿，且随离心距离与偏角渐变模糊融合
              if (org.mimicTimer > 0 && dist > absR) {
                const targetMimic = (org.blueprint?.slots?.utility || []).find((u) => u.id === 'util-mimic');
                if (targetMimic && targetMimic.level >= st.maxEyeLv) {
                  return;
                }
              }
              const env = computeColorVisionEnvelope(org.x, org.y, alpha, st, isNight);
              if (env.weight <= 0.02) return;
              ctx.save();
              const satPct = Math.round((env.absWeight >= 0.5 ? Math.max(1.0, st.eyeSat) : st.eyeSat) * 100);
              ctx.filter = env.blurPx >= 0.45
                ? `blur(${env.blurPx}px) saturate(${satPct}%)`
                : `saturate(${satPct}%)`;
              drawOrganism(ctx, org, {
                timeSec: arenaState.timeSec,
                sonarWireframe: false,
                sonarRelation: sonarRel,
                observer: alpha
              });
              ctx.restore();
              return;
            }
          }
          // 玩家自身始祖 Alpha 永远位于绝对感知区核心，以全彩高清渲染
          if (!sonarWireframeMode) {
            drawOrganism(ctx, org, {
              timeSec: arenaState.timeSec,
              sonarWireframe: false,
              sonarRelation: sonarRel,
              observer: alpha
            });
          }
        });
      }

      // 离屏复合感官图层与平滑 Alpha 羽化遮罩缓存 (用于将【近体绝对感知彩色区 + 视觉长距扇形】以真实 Alpha 透明度平滑融合至下层【360° 听觉声呐层 / 深海原汤基底】，杜绝黑环断层与黑三角切痕)
      let colorPassCanvas = null;
      let senseMaskCanvas = null;
      function getCompositeSenseCanvases(w, h) {
        if (!colorPassCanvas) colorPassCanvas = document.createElement('canvas');
        if (!senseMaskCanvas) senseMaskCanvas = document.createElement('canvas');
        if (colorPassCanvas.width !== w || colorPassCanvas.height !== h) {
          colorPassCanvas.width = w;
          colorPassCanvas.height = h;
        }
        if (senseMaskCanvas.width !== w || senseMaskCanvas.height !== h) {
          senseMaskCanvas.width = w;
          senseMaskCanvas.height = h;
        }
        return {
          colorCtx: colorPassCanvas.getContext('2d'),
          maskCtx: senseMaskCanvas.getContext('2d')
        };
      }

      function renderArenaFrame() {
        const canvas = document.getElementById('petri-canvas');
        const alpha = arenaState.alpha;
        if (!canvas || !alpha) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const viewW = w / VIEWPORT_ZOOM;
        const viewH = h / VIEWPORT_ZOOM;
        const camX = alpha.x;
        const camY = alpha.y;
        const st = getEffectiveStats(alpha);
        const absR = st.absSenseRange || 110;
        const cyc = arenaState.timeSec % 180;
        const isNight = arenaState.biome.forceNight || (cyc >= 82 && cyc <= 170);

        const hasEye = st.maxEyeLv > 0;
        const hasEar = st.maxEarLv > 0;
        const effEyeRange = hasEye ? (alpha.blindTimer > 0 ? Math.max(absR * 1.15, 130) : (isNight ? st.nightEyeRange : st.dayEyeRange)) : 0;
        const halfEyeRad = hasEye ? (((isNight ? st.nightEyeAngle : st.dayEyeAngle) * 0.5) * (Math.PI / 180)) : 0;
        const eyeAngFeather = Math.min(0.34, halfEyeRad * 0.30);

        ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, w, h);

        // 广角冷冻物镜缩放 (VIEWPORT_ZOOM = 0.68) + 镜头严格锁定玩家当前控制的个体为中心
        ctx.save();
        ctx.translate(w * 0.5, h * 0.5);
        ctx.scale(VIEWPORT_ZOOM, VIEWPORT_ZOOM);
        ctx.translate(-camX, -camY);

        // 0. 铺设深邃深海培养皿原汤环境基底 (所有感官区域外围统一与此活体流体背景平滑渐变融合)
        const activeBiome = arenaState.biome || BIOMES[0];
        const outerRgb = activeBiome.outerRgb || '2, 8, 16';
        renderOuterPetriFluidBase(ctx, camX, camY, viewW, viewH, alpha, activeBiome);

        // 1. 听觉声呐层 (Layer 1 —— 若装备听觉器官，渲染 360° 广域声呐层，信号随距离增加平滑衰减并与背景渐变融合)
        if (hasEar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(alpha.x, alpha.y, st.sonarRange, 0, Math.PI * 2);
          ctx.clip();
          renderWorldPass(ctx, camX, camY, viewW, viewH, isNight, true);

          // 仅在声呐最外圈 (70% ~ 100% 射程) 施加柔和边缘暗角融入深海原汤，保持中近距声呐清晰通透
          const earFadeGrad = ctx.createRadialGradient(alpha.x, alpha.y, st.sonarRange * 0.68, alpha.x, alpha.y, st.sonarRange);
          earFadeGrad.addColorStop(0, `rgba(${outerRgb}, 0.0)`);
          earFadeGrad.addColorStop(0.55, `rgba(${outerRgb}, 0.32)`);
          earFadeGrad.addColorStop(1, `rgba(${outerRgb}, 0.94)`);
          ctx.fillStyle = earFadeGrad;
          ctx.fillRect(alpha.x - st.sonarRange, alpha.y - st.sonarRange, st.sonarRange * 2, st.sonarRange * 2);
          ctx.restore();
        }

        // 2. 复合彩色感知层 (Layer 2 —— 离屏渲染【近体绝对感知彩色区 + 视觉长距扇形】，并通过 destination-in 联合 Alpha 遮罩与下层听觉声呐层/深海背景实现无断层丝滑融合)
        const { colorCtx, maskCtx } = getCompositeSenseCanvases(w, h);
        const absOuterR = absR * 1.28;

        // 2.1 在 colorCtx 上绘制彩色世界通道
        colorCtx.globalCompositeOperation = 'source-over';
        colorCtx.shadowBlur = 0;
        colorCtx.clearRect(0, 0, w, h);
        colorCtx.save();
        colorCtx.translate(w * 0.5, h * 0.5);
        colorCtx.scale(VIEWPORT_ZOOM, VIEWPORT_ZOOM);
        colorCtx.translate(-camX, -camY);
        colorCtx.beginPath();
        colorCtx.arc(alpha.x, alpha.y, Math.max(absOuterR, effEyeRange), 0, Math.PI * 2);
        colorCtx.clip();
        renderWorldPass(colorCtx, camX, camY, viewW, viewH, isNight, false);

        // 在彩色通道内叠加 360° 中心向外单调递减的生物光学聚光场 (由下方 senseMaskCanvas 统一裁切为【近体圆 ∪ 视觉扇形】，彻底杜绝扇形内切线与亮环)
        const beamRgb = activeBiome.accentRgba || '45, 212, 191';
        const maxLightR = Math.max(absOuterR, hasEye ? effEyeRange : absOuterR);
        const lightGrad = colorCtx.createRadialGradient(alpha.x, alpha.y, 0, alpha.x, alpha.y, maxLightR);
        const centerAlpha = st.visionProfile === 'predator' ? 0.14 : (st.visionProfile === 'producer' ? 0.10 : 0.12);
        lightGrad.addColorStop(0, `rgba(${beamRgb}, ${centerAlpha})`);
        lightGrad.addColorStop(0.35, `rgba(${beamRgb}, ${(centerAlpha * 0.68).toFixed(3)})`);
        lightGrad.addColorStop(0.72, `rgba(${beamRgb}, ${(centerAlpha * 0.28).toFixed(3)})`);
        lightGrad.addColorStop(1, `rgba(${beamRgb}, 0.0)`);
        colorCtx.fillStyle = lightGrad;
        colorCtx.beginPath();
        colorCtx.arc(alpha.x, alpha.y, maxLightR, 0, Math.PI * 2);
        colorCtx.fill();
        colorCtx.restore();

        // 2.2 在 maskCtx 上构建【视觉扇形 ∪ 360° 近体绝对感知圆】的连续高斯羽化 Alpha 权重场 (零条纹、零分阶、零黑边)
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.shadowBlur = 0;
        maskCtx.filter = 'none';
        maskCtx.clearRect(0, 0, w, h);
        maskCtx.save();
        maskCtx.translate(w * 0.5, h * 0.5);
        maskCtx.scale(VIEWPORT_ZOOM, VIEWPORT_ZOOM);
        maskCtx.translate(-camX, -camY);
        // 使用 GPU 高斯模糊滤镜直接对遮罩几何体做连续光学羽化，彻底消除多阶折线或扇叶条纹
        maskCtx.filter = 'blur(20px)';

        if (hasEye && effEyeRange > absR * 0.9) {
          const isPred = st.visionProfile === 'predator';
          const isProd = st.visionProfile === 'producer';
          const coreGrad = maskCtx.createRadialGradient(alpha.x, alpha.y, absR * 0.85, alpha.x, alpha.y, effEyeRange);
          if (isPred) {
            // 掠食者：长距离 · 高精度 · 窄视野 (前 75% 保持极高清晰透光度，末端平滑融入背景)
            coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            coreGrad.addColorStop(0.72, 'rgba(255, 255, 255, 0.96)');
            coreGrad.addColorStop(0.88, 'rgba(255, 255, 255, 0.52)');
            coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
          } else if (isProd) {
            // 生产者：中距离 · 低精度 · 宽视野 (广角扇面自近向远柔和散焦衰减)
            coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            coreGrad.addColorStop(0.36, 'rgba(255, 255, 255, 0.88)');
            coreGrad.addColorStop(0.70, 'rgba(255, 255, 255, 0.44)');
            coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
          } else {
            coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            coreGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.92)');
            coreGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.45)');
            coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
          }
          maskCtx.fillStyle = coreGrad;
          maskCtx.beginPath();
          maskCtx.moveTo(alpha.x, alpha.y);
          maskCtx.arc(alpha.x, alpha.y, effEyeRange, alpha.angle - halfEyeRad, alpha.angle + halfEyeRad);
          maskCtx.closePath();
          maskCtx.fill();
        }

        // 叠加 360° 近体绝对感知彩色圆遮罩 (0 ~ 0.90*absR 保持 100% 满 Alpha 覆盖，彻底抹平扇形在圆内的交界，外缘连续高斯羽化)
        const absMaskGrad = maskCtx.createRadialGradient(alpha.x, alpha.y, absR * 0.88, alpha.x, alpha.y, absOuterR);
        absMaskGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        absMaskGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.92)');
        absMaskGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        maskCtx.fillStyle = absMaskGrad;
        maskCtx.beginPath();
        maskCtx.arc(alpha.x, alpha.y, absOuterR, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.filter = 'none';
        maskCtx.restore();

        // 2.3 用 destination-in 将联合感官 Alpha 遮罩裁切至彩色通道，并无损合成至主画布
        colorCtx.globalCompositeOperation = 'destination-in';
        colorCtx.drawImage(senseMaskCanvas, 0, 0);
        colorCtx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(colorPassCanvas, 0, 0);
        ctx.restore();

        // 3. 感官区域声波脉冲层 (全感官区域靠光学渐变自然融合，不绘制生硬扇形切割边框线或冗余亮环)
        if (arenaState.showSensoryOverlay) {
          if (hasEar) {
            const pulseFrac = (arenaState.timeSec % st.sonarPulseSec) / st.sonarPulseSec;
            const waveAlpha = Math.pow(1 - pulseFrac, 1.35) * 0.58;
            ctx.beginPath();
            ctx.arc(alpha.x, alpha.y, st.sonarRange * pulseFrac, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
        }

        ctx.restore();

        // 渲染右上角微缩态势雷达 (#arena-minimap)
        const mini = document.getElementById('arena-minimap');
        if (mini) {
          const mctx = mini.getContext('2d');
          mctx.clearRect(0, 0, 44, 44);
          arenaState.organisms.forEach((o) => {
            const mx = (o.x / WORLD_W) * 40 + 2;
            const my = (o.y / WORLD_H) * 40 + 2;
            mctx.fillStyle = o === alpha ? '#2dd4bf' : (o.colonyId === 'player_colony' ? '#10b981' : (o.isBoss ? '#fbbf24' : '#ef4444'));
            mctx.fillRect(mx - 1.5, my - 1.5, o === alpha || o.isBoss ? 3.5 : 2, o === alpha || o.isBoss ? 3.5 : 2);
          });
        }
      }

      function launchArenaFromRoom() {
        if (!arenaState.organisms || arenaState.organisms.length === 0 || arenaState.matchEnded) {
          startArenaMatch();
        }
        switchPage('arena', { allowDuringMatch: true });
        arenaState.running = true;
        arenaState.lastTickMs = performance.now();
        syncEvolutionPointsUI();
        renderArenaSampleSwitcher();
        updateMatchTimerAndScoreboard(0);
      }
      window.addEventListener('nexus:gameplay-started', launchArenaFromRoom);
      if (window.NexusSDK && window.NexusSDK.isGameplayActive()) {
        launchArenaFromRoom();
      }

      window.addEventListener('nexus:gameplay-stopped', () => {
        arenaState.running = false;
      });

      function mainArenaLoop(nowMs) {
        const canRun = window.NexusSDK ? (window.NexusSDK.isGameplayActive() && window.NexusSDK.isRoomSessionActive()) : arenaState.running;
        if (arenaState.running && currentActivePage === 'arena' && canRun) {
          const dt = Math.min(0.05, Math.max(0.001, (nowMs - arenaState.lastTickMs) * 0.001));
          arenaState.lastTickMs = nowMs;
          stepArenaSimulation(dt);
          renderArenaFrame();
        } else {
          arenaState.lastTickMs = nowMs;
          if (currentActivePage === 'arena') renderArenaFrame();
        }
        requestAnimationFrame(mainArenaLoop);
      }

      /* =====================================================================
       * 13. 启动初始化与 URL 异步基因挑战码自动识别
       * ===================================================================== */
      persistState();
      initLanHostSession(lanRoomCode);
      renderEditorPage();
      requestAnimationFrame(renderEditorPreviewLoop);
      requestAnimationFrame(mainArenaLoop);

      // 检查 URL 参数是否携带 ?challenger=MG3_... 或 ?challenge=MG3_... 基因挑战码
      try {
        const params = new URLSearchParams(window.location.search);
        const challengerCode = params.get('challenger') || params.get('challenge');
        if (challengerCode) {
          const rivalBp = decodeGeneCode(challengerCode);
          if (rivalBp) {
            officialFossils.unshift(rivalBp);
            showToast('已载入 URL 挑战物种：【' + rivalBp.speciesName + '】！');
          }
        }
      } catch (_e) {}
      // 调试探针导出
      window.__debugGenesis = () => ({
        arenaState,
        TORSOS,
        ORGAN_CATALOG,
        getEvolutionPoints: () => evolutionPoints,
        getMaxSampleSlots: () => maxSampleSlots,
        getSelectedSampleSlotIdx: () => selectedSampleSlotIdx,
        getPlayerGeneBank: () => playerGeneBank,
        getUnlockedItems: () => unlockedItems,
        getOrganInventory: () => organInventory,
        sanitizeOrganInventory,
        countBlueprintOrganUsage,
        enforceOwnedBlueprintConstraints,
        validateAndSanitizeBlueprint,
        decodeGeneCode,
        sanitizeSpeciesName,
        executeInGameBlueprintLoad: switchArenaSample,
        switchArenaSample,
        respawnPlayerWithSample,
        openMidGameRejoinModal,
        computeColonyStandings,
        updateMatchTimerAndScoreboard,
        settleTimedMatch,
        openOutOfGameWorkshop,
        buySampleSlotWithEp,
        unlockOrganWithEp,
        unlockTorsoWithEp,
        buyOrganCopyWithEp,
        switchPage,
        startArenaMatch,
        getEffectiveStats,
        syncOrganismMaturity,
        accelerateJuvenileGrowth,
        resolveOrganismCollisions,
        spawnOrganismEntity,
        spawnNutrientCluster,
        tryMitosisReproduce,
        classifySonarRelation,
        getSonarPalette,
        getSonarDistanceFactor,
        computeColorVisionEnvelope,
        canEntitySenseTarget,
        isInsideGenesisShoal,
        clampOutsideGenesisShoal,
        applyDamage,
        stepArenaSimulation
      });
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
          gameId: 'micro-genesis',
          initialized: __engineInitialized,
          running: __engineRunning && global.NexusSDK.isGameplayActive()
        };
      }
    };
  });
})(window);
