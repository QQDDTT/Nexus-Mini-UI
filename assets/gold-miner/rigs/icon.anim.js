/**
 * @file icon.anim.js
 * @description 单角色骨骼贴图动作整合脚本：icon (gold-miner)
 * 绑定贴图：../icon.svg (9 个骨骼与光影图层组)
 * 遵循 Nexus-Mini v4.0 “一角色一脚本多动画”规范 (RIG_SPEC + 6 ANIMATIONS + 父子矩阵级联)
 */

export const RIG_SPEC = Object.freeze({
  rigId: 'gold-miner-icon-rig',
  entityId: 'icon',
  gameId: 'gold-miner',
  profile: 'mining-rig',
  spritePath: '../icon.svg',
  viewBox: { width: 128, height: 128 },
  rootAnchor: [64, 64],
  hasAura: true,
  parts: [
    { id: 'part-shadow-cast', pivot: [64, 72], parent: 'root', zIndex: 1, blend: 'multiply', role: 'shadow', motion: 'shadow', side: 0, dirY: 1, order: 1 },
    { id: 'part-aura-ring-outer', pivot: [64, 64], parent: 'root', zIndex: 4, blend: 'screen', role: 'aura-outer', motion: 'spin-cw', side: 0, dirY: -1, order: 1 },
    { id: 'part-aura-ring-inner', pivot: [64, 64], parent: 'root', zIndex: 5, blend: 'screen', role: 'aura-inner', motion: 'spin-ccw', side: 1, dirY: -1, order: 1 },
    { id: 'part-gold-core', pivot: [64, 84], parent: 'root', zIndex: 18, blend: 'normal', role: 'core', motion: 'core', side: 0, dirY: -1, order: 1 },
    { id: 'part-claw-hub', pivot: [64, 34], parent: 'root', zIndex: 25, blend: 'normal', role: 'chassis', motion: 'chassis', side: 0, dirY: -1, order: 1 },
    { id: 'part-claw-left', pivot: [48, 38], parent: 'part-claw-hub', zIndex: 32, blend: 'normal', role: 'jaw', motion: 'jaw', side: -1, dirY: 1, order: 2 },
    { id: 'part-claw-right', pivot: [80, 38], parent: 'part-claw-hub', zIndex: 32, blend: 'normal', role: 'jaw', motion: 'jaw', side: 1, dirY: 1, order: 2 },
    { id: 'part-light-rim-gold', pivot: [64, 84], parent: 'part-gold-core', zIndex: 45, blend: 'plus-lighter', role: 'rim-light', motion: 'rim-light', side: 0, dirY: -1, order: 2 },
    { id: 'part-aura-corona-top', pivot: [64, 64], parent: 'root', zIndex: 65, blend: 'screen', role: 'corona-top', motion: 'corona-top', side: 0, dirY: -1, order: 1 }
  ]
});
export const ANIMATIONS = Object.freeze({
  idle: {
    name: 'idle',
    durationMs: 2400,
    loop: true,
    description: '常态待机：呼吸微动、感官/雷达巡航与正反转双光环脉动'
  },
  move: {
    name: 'move',
    durationMs: 800,
    loop: true,
    description: '行进/推进：多节脊椎相位行波、四肢/履带/翼鳍往复与尾焰拉伸'
  },
  attack: {
    name: 'attack',
    durationMs: 520,
    loop: false,
    description: '攻击/开火：火炮轴向/交替后坐回缩、双颚/抓钩对称张合或刺针突刺及受光爆闪'
  },
  skill: {
    name: 'skill',
    durationMs: 1200,
    loop: false,
    description: '过载技能：舱门/护盾翼展开、光环倍速旋转、体积光锥扫射与核心高频电弧'
  },
  hit: {
    name: 'hit',
    durationMs: 360,
    loop: false,
    description: '受击硬直：指数衰减高频震颤、瞬膜/护盾闪烁与装甲后仰'
  },
  death: {
    name: 'death',
    durationMs: 960,
    loop: false,
    description: '殉爆解体：各骨骼部件沿离心矢量解耦飞散、核心坍缩与光环淡出'
  }
});

/**
 * 2D 仿射变换矩阵乘法: M = A * B (SVG matrix(a, b, c, d, e, f))
 */
function multiplyMatrix(A, B) {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5]
  ];
}

/**
 * 构建围绕部件枢轴 (px, py) 的局部 2D 仿射矩阵:
 * M = T(tx, ty) * T(px, py) * R(rotDeg) * S(sx, sy) * T(-px, -py)
 */
function buildPivotMatrix(px, py, tx, ty, rotDeg, sx, sy) {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  const e = tx + px - a * px - c * py;
  const f = ty + py - b * px - d * py;
  return [a, b, c, d, e, f];
}

/**
 * 计算单个部件在指定动作与时刻下的局部运动学姿态
 */
function computePartLocalPose(part, animName, timeMs, context) {
  const safeContext = (context && typeof context === 'object') ? context : {};
  const anim = ANIMATIONS[animName] || ANIMATIONS.idle;
  const validTime = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;
  const walkSpeed = (typeof safeContext.walkSpeed === 'number' && Number.isFinite(safeContext.walkSpeed))
    ? Math.max(0.1, safeContext.walkSpeed)
    : 1.0;
  const effectiveTime = animName === 'move' ? validTime * walkSpeed : validTime;
  const tSec = effectiveTime / 1000;
  const safeDuration = Math.max(1, Number(anim.durationMs) || 1000);
  const progress = anim.loop
    ? ((effectiveTime % safeDuration) / safeDuration)
    : Math.min(1, Math.max(0, effectiveTime / safeDuration));
  const phase = progress * Math.PI * 2;
  const side = part.side || 0;
  const signedSide = side || 1;
  const dirY = part.dirY || -1;
  // 镜像开合符号：向上延伸的双颚 (dirY=-1) 左逆右顺为张开；向下悬挂的抓钩 (dirY=+1) 左顺右逆为张开
  const openSign = signedSide * (-dirY);
  const order = part.order || 1;

  let tx = 0;
  let ty = 0;
  let rotDeg = 0;
  let scaleX = 1;
  let scaleY = 1;
  let opacity = 1;

  // 1. 光影与光环图层常驻联动 (Aura & Lighting Layers)
  if (part.role === 'shadow') {
    const breathe = 1 + 0.03 * Math.sin(phase);
    scaleX = breathe;
    scaleY = breathe;
    if (animName === 'death') opacity = Math.max(0, 1 - progress);
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }
  if (part.role === 'aura-outer') {
    const speedMult = animName === 'skill' ? 3.0 : animName === 'move' ? 1.5 : 1.0;
    rotDeg = (tSec * 36 * speedMult) % 360;
    const pulse = animName === 'skill' ? (1 + 0.1 * Math.sin(phase * 3)) : (1 + 0.04 * Math.sin(phase));
    scaleX = pulse;
    scaleY = pulse;
    if (animName === 'death') opacity = Math.max(0, 1 - progress * 1.2);
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }
  if (part.role === 'aura-inner') {
    const speedMult = animName === 'skill' ? 3.5 : animName === 'attack' ? 2.0 : 1.0;
    rotDeg = (-tSec * 54 * speedMult) % 360;
    const pulse = 1 + 0.05 * Math.cos(phase * 2);
    scaleX = pulse;
    scaleY = pulse;
    if (animName === 'death') opacity = Math.max(0, 1 - progress * 1.2);
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }
  if (part.role === 'light-cone') {
    if (typeof safeContext.aimAngleDeg === 'number' && Number.isFinite(safeContext.aimAngleDeg)) {
      rotDeg += safeContext.aimAngleDeg;
    }
    if (animName === 'idle') {
      rotDeg += 8 * Math.sin(phase);
      opacity = 0.75 + 0.2 * Math.sin(phase * 2);
    } else if (animName === 'attack' || animName === 'skill') {
      scaleX = 1 + 0.18 * Math.sin(progress * Math.PI);
      scaleY = 1 + 0.12 * Math.sin(progress * Math.PI);
      opacity = 1.0;
    } else if (animName === 'death') {
      opacity = Math.max(0, 1 - progress * 1.4);
    }
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }
  if (part.role === 'corona-top') {
    const flare = animName === 'skill' || animName === 'attack'
      ? 1 + 0.12 * Math.sin(phase * 4)
      : 1 + 0.04 * Math.sin(phase * 2);
    scaleX = flare;
    scaleY = flare;
    opacity = animName === 'death' ? Math.max(0, 1 - progress) : (0.82 + 0.18 * Math.sin(phase * 3));
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }
  if (part.role === 'rim-light') {
    if (animName === 'attack' || animName === 'skill' || animName === 'hit') {
      opacity = 0.9 + 0.1 * Math.sin(phase * 6);
    } else if (animName === 'death') {
      opacity = Math.max(0, 1 - progress);
    } else {
      opacity = 0.7 + 0.25 * Math.sin(phase * 2);
    }
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }

  // 1B. 机械/生物自转转子部件 (Mechanical / Bio Rotors: radar, coil-ring, grav-ring, winch-drum, vortex-maw)
  if (part.role === 'rotor-cw' || part.role === 'rotor-ccw') {
    const dir = part.role === 'rotor-cw' ? 1 : -1;
    const speedMult = animName === 'skill' ? 2.8 : animName === 'attack' ? 1.8 : animName === 'move' ? 1.4 : 1.0;
    rotDeg = (dir * tSec * 48 * speedMult) % 360;
    if (animName === 'skill' || animName === 'attack') {
      const pulse = 1 + 0.06 * Math.sin(phase * 3);
      scaleX = pulse;
      scaleY = pulse;
    } else if (animName === 'hit') {
      const damp = Math.exp(-progress * 4.5);
      tx = 3.5 * Math.sin(progress * Math.PI * 10) * damp;
    } else if (animName === 'death') {
      const easeOut = 1 - Math.pow(1 - progress, 2);
      scaleX = Math.max(0.2, 1 - 0.6 * easeOut);
      scaleY = scaleX;
      opacity = Math.max(0, 1 - Math.pow(progress, 1.4));
    }
    return { tx, ty, rotDeg, scaleX, scaleY, opacity };
  }

  // 2. 六大标准动作状态骨骼解算 (Skeletal Kinematics by State)
  switch (animName) {
    case 'idle': {
      if (part.role === 'chassis') {
        ty = 1.2 * Math.sin(phase);
        if (RIG_SPEC.profile.includes('elastic-dessert')) {
          scaleX = 1 + 0.035 * Math.sin(phase);
          scaleY = 1 - 0.035 * Math.sin(phase);
        }
      } else if (part.role === 'somite') {
        rotDeg = 2.2 * Math.sin(phase - order * 1.35);
      } else if (part.role === 'jaw') {
        rotDeg = openSign * 5.5 * (0.5 + 0.5 * Math.sin(phase));
      } else if (part.role === 'wing' || part.role === 'limb') {
        rotDeg = signedSide * 6.0 * Math.sin(phase - order * 0.45);
      } else if (part.role === 'flagella') {
        rotDeg = 6.0 * Math.sin(phase - order * 1.25);
      } else if (part.role === 'turret') {
        rotDeg = (typeof safeContext.aimAngleDeg === 'number' && Number.isFinite(safeContext.aimAngleDeg))
          ? safeContext.aimAngleDeg
          : 10.0 * Math.sin(phase * 0.5);
      } else if (part.role === 'eye') {
        tx = 1.8 * Math.sin(phase);
        ty = 1.2 * Math.cos(phase);
      } else if (part.role === 'thruster') {
        scaleY = 0.80 + 0.08 * Math.sin(phase * 4);
      } else if (part.role === 'core') {
        scaleX = 1 + 0.05 * Math.sin(phase * 2);
        scaleY = 1 + 0.05 * Math.sin(phase * 2);
      } else if (part.role === 'barrel') {
        ty = 0.6 * Math.sin(phase);
      } else if (part.role === 'hatch') {
        rotDeg = openSign * 2.5 * Math.sin(phase - order * 0.4);
      } else if (part.role === 'wheel') {
        ty = 0.6 * Math.sin(phase + order * 0.5);
      }
      break;
    }

    case 'move': {
      if (part.role === 'chassis') {
        ty = 2.0 * Math.sin(phase * 2);
        if (RIG_SPEC.profile.includes('elastic-dessert')) {
          scaleX = 1 + 0.07 * Math.sin(phase * 2);
          scaleY = 1 - 0.07 * Math.sin(phase * 2);
        }
      } else if (part.role === 'somite') {
        rotDeg = 5.0 * Math.sin(phase - order * 1.35);
        tx = 1.2 * Math.sin(phase - order * 1.35);
      } else if (part.role === 'wing') {
        rotDeg = signedSide * 14.0 * Math.sin(phase - order * 0.45);
      } else if (part.role === 'limb') {
        rotDeg = signedSide * 18.0 * Math.sin(phase + (order % 2) * Math.PI);
      } else if (part.role === 'flagella') {
        rotDeg = 11.0 * Math.sin(phase - order * 1.25);
      } else if (part.role === 'wheel') {
        ty = 1.5 * Math.sin(phase * 4 + order * 0.9);
        rotDeg = 8.0 * Math.sin(phase * 2);
      } else if (part.role === 'thruster') {
        scaleY = 0.92 + 0.10 * Math.sin(phase * 6);
        scaleX = 0.98 + 0.06 * Math.cos(phase * 6);
      } else if (part.role === 'jaw') {
        rotDeg = openSign * 8.0 * Math.sin(phase);
      } else if (part.role === 'turret') {
        rotDeg = (typeof safeContext.aimAngleDeg === 'number' && Number.isFinite(safeContext.aimAngleDeg))
          ? safeContext.aimAngleDeg
          : 8.0 * Math.sin(phase);
      } else if (part.role === 'barrel') {
        ty = 1.2 * Math.sin(phase * 2);
      } else if (part.role === 'hatch') {
        rotDeg = openSign * 4.5 * Math.sin(phase - order * 0.4);
      } else if (part.role === 'eye') {
        tx = 2.4 * Math.sin(phase);
        ty = -1.5 * Math.abs(Math.cos(phase));
      } else if (part.role === 'core') {
        scaleX = 1 + 0.08 * Math.sin(phase * 2);
        scaleY = 1 + 0.08 * Math.sin(phase * 2);
      }
      break;
    }

    case 'attack': {
      const strikeEnv = progress < 0.28
        ? -(progress / 0.28) * 0.6
        : progress < 0.52
          ? 1.0
          : Math.cos(((progress - 0.52) / 0.48) * (Math.PI / 2));

      if (part.role === 'jaw') {
        // 前 28% 蓄力向外大张 (+28°)，后 72% 极速向内钳合咬死 (-18°)
        const jawAngle = progress < 0.28
          ? (progress / 0.28) * 28.0
          : -18.0 * Math.sin(((progress - 0.28) / 0.72) * Math.PI);
        rotDeg = openSign * jawAngle;
      } else if (part.role === 'barrel') {
        const thrustForward = /lance|stinger|proboscis|needle|tongue|spike|fork|probe|cowcatcher|drill|harpoon/.test(part.id);
        const recoilDir = thrustForward ? dirY : -dirY;
        let barrelEnv = strikeEnv;
        // 双联装炮管支持左/右交替后坐力伸缩 (recoil-y-alt-L / recoil-y-alt-R)
        if (part.motion === 'recoil-y-alt-L' || (!thrustForward && side === -1)) {
          const pL = Math.min(1, progress / 0.62);
          barrelEnv = pL < 0.25 ? -(pL / 0.25) * 0.4 : Math.sin(((pL - 0.25) / 0.75) * Math.PI);
        } else if (part.motion === 'recoil-y-alt-R' || (!thrustForward && side === 1)) {
          const pR = Math.max(0, Math.min(1, (progress - 0.32) / 0.68));
          barrelEnv = pR === 0 ? 0 : (pR < 0.25 ? -(pR / 0.25) * 0.4 : Math.sin(((pR - 0.25) / 0.75) * Math.PI));
        }
        ty = recoilDir * 9.5 * barrelEnv;
      } else if (part.role === 'turret') {
        if (typeof safeContext.aimAngleDeg === 'number' && Number.isFinite(safeContext.aimAngleDeg)) {
          rotDeg = safeContext.aimAngleDeg;
        }
        ty = 2.5 * strikeEnv;
      } else if (part.role === 'limb' || part.role === 'wing') {
        rotDeg = -openSign * 14.0 * strikeEnv;
      } else if (part.role === 'chassis' || part.role === 'somite') {
        ty = 2.0 * strikeEnv;
      } else if (part.role === 'core') {
        scaleX = 1 + 0.14 * Math.abs(strikeEnv);
        scaleY = 1 + 0.14 * Math.abs(strikeEnv);
      } else if (part.role === 'thruster') {
        scaleY = 0.94 + 0.10 * Math.abs(strikeEnv);
        scaleX = 1.06;
      } else if (part.role === 'flagella') {
        rotDeg = 12.0 * Math.sin(phase * 2 - order * 1.25);
      } else if (part.role === 'eye') {
        ty = dirY * 2.5 * strikeEnv;
        scaleX = 1 + 0.16 * Math.abs(strikeEnv);
        scaleY = scaleX;
      } else if (part.role === 'hatch') {
        rotDeg = openSign * 14.0 * strikeEnv;
        tx = signedSide * 2.5 * strikeEnv;
      } else if (part.role === 'wheel') {
        ty = 2.0 * strikeEnv;
        scaleY = 1 - 0.08 * Math.abs(strikeEnv);
      }
      break;
    }

    case 'skill': {
      const env = Math.sin(progress * Math.PI);
      if (part.role === 'hatch') {
        if (side !== 0) {
          tx = side * 8.5 * env;
          rotDeg = openSign * 20.0 * env;
        } else {
          ty = dirY * 8.5 * env;
          scaleX = 1 + 0.12 * env;
        }
      } else if (part.role === 'wing') {
        rotDeg = openSign * 20.0 * env;
      } else if (part.role === 'jaw') {
        rotDeg = openSign * (18.0 * env + 6.0 * Math.sin(phase * 4));
      } else if (part.role === 'barrel') {
        ty = dirY * 6.0 * Math.sin(phase * 3);
      } else if (part.role === 'turret') {
        rotDeg = 18.0 * Math.sin(phase * 2);
      } else if (part.role === 'limb') {
        rotDeg = signedSide * 18.0 * Math.sin(phase * 2 - order * 0.6);
      } else if (part.role === 'flagella') {
        rotDeg = 14.0 * Math.sin(phase * 2 - order * 1.25);
      } else if (part.role === 'core') {
        scaleX = 1 + 0.18 * env;
        scaleY = 1 + 0.18 * env;
      } else if (part.role === 'thruster') {
        scaleY = 0.95 + 0.09 * Math.sin(phase * 8);
        scaleX = 1.08 + 0.06 * Math.cos(phase * 8);
      } else if (part.role === 'chassis') {
        ty = -2.5 * env;
        scaleX = 1 + 0.06 * Math.sin(phase * 2);
        scaleY = 1 - 0.06 * Math.sin(phase * 2);
      } else if (part.role === 'somite') {
        rotDeg = 6.5 * Math.sin(phase * 2 - order * 1.35);
        tx = 1.5 * Math.sin(phase * 2 - order * 1.35);
      } else if (part.role === 'eye') {
        scaleX = 1 + 0.18 * env;
        scaleY = scaleX;
        ty = -1.5 * Math.sin(phase * 2);
      } else if (part.role === 'wheel') {
        ty = -2.0 * env + 1.5 * Math.sin(phase * 4);
        rotDeg = 12.0 * Math.sin(phase * 3);
      }
      break;
    }

    case 'hit': {
      const damp = Math.exp(-progress * 4.5);
      const shake = Math.sin(progress * Math.PI * 10) * damp;
      tx = 4.5 * shake * signedSide;
      ty = 3.0 * damp;
      rotDeg = openSign * 9.0 * shake;
      if (part.role === 'hatch' || part.role === 'eye') {
        scaleY = Math.max(0.2, 1 - 0.7 * damp);
      }
      break;
    }

    case 'death': {
      const easeOut = 1 - Math.pow(1 - progress, 2);
      const dx = part.pivot[0] - RIG_SPEC.rootAnchor[0];
      const dy = part.pivot[1] - RIG_SPEC.rootAnchor[1];
      const rawDist = Math.hypot(dx, dy);
      const fallbackAngle = order * 2.39996 + side * 0.8;
      const ux = rawDist >= 2.0 ? (dx / rawDist) : Math.cos(fallbackAngle);
      const uy = rawDist >= 2.0 ? (dy / rawDist) : Math.sin(fallbackAngle);
      tx = ux * 18.0 * easeOut + (side * 6.0 * easeOut);
      ty = uy * 18.0 * easeOut + 10.0 * easeOut;
      rotDeg = signedSide * 42.0 * easeOut + (order * 7.0 * easeOut);
      const shrink = Math.max(0.15, 1 - 0.65 * easeOut);
      scaleX = shrink;
      scaleY = shrink;
      opacity = Math.max(0, 1 - Math.pow(progress, 1.4));
      break;
    }
  }

  // 3. 外部上下文参数覆盖与叠加 (Context Parameter Overrides: jawOpenRatio / thrustRatio)
  if (part.role === 'jaw' && typeof safeContext.jawOpenRatio === 'number' && Number.isFinite(safeContext.jawOpenRatio)) {
    const clampedJaw = Math.max(-1, Math.min(1.5, safeContext.jawOpenRatio));
    rotDeg += openSign * clampedJaw * 25.0;
  }
  if (part.role === 'thruster' && typeof safeContext.thrustRatio === 'number' && Number.isFinite(safeContext.thrustRatio)) {
    const clampedThrust = Math.max(0, Math.min(2.0, safeContext.thrustRatio));
    scaleY *= (0.75 + 0.65 * clampedThrust);
  }

  return { tx, ty, rotDeg, scaleX, scaleY, opacity };
}

/**
 * 计算当前时刻全角色所有骨骼部件的局部姿态与级联世界矩阵 (Parent -> Child Cascade)
 */
export function evaluatePose(animName = 'idle', timeMs = 0, context = {}) {
  const localMap = new Map();
  const worldMatrixMap = new Map();
  const worldOpacityMap = new Map();

  for (const part of RIG_SPEC.parts) {
    const local = computePartLocalPose(part, animName, timeMs, context);
    const localMatrix = buildPivotMatrix(
      part.pivot[0],
      part.pivot[1],
      local.tx,
      local.ty,
      local.rotDeg,
      local.scaleX,
      local.scaleY
    );
    localMap.set(part.id, { part, local, localMatrix });
  }

  function resolveWorldMatrix(partId, visited = new Set()) {
    if (worldMatrixMap.has(partId)) return worldMatrixMap.get(partId);
    const entry = localMap.get(partId);
    if (!entry) return [1, 0, 0, 1, 0, 0];
    const parentId = entry.part.parent;
    if (!parentId || parentId === 'root' || !localMap.has(parentId) || visited.has(parentId)) {
      worldMatrixMap.set(partId, entry.localMatrix);
      return entry.localMatrix;
    }
    visited.add(partId);
    const parentWorld = resolveWorldMatrix(parentId, visited);
    const combined = multiplyMatrix(parentWorld, entry.localMatrix);
    worldMatrixMap.set(partId, combined);
    return combined;
  }

  function resolveWorldOpacity(partId, visited = new Set()) {
    if (worldOpacityMap.has(partId)) return worldOpacityMap.get(partId);
    const entry = localMap.get(partId);
    if (!entry) return 1;
    const parentId = entry.part.parent;
    if (!parentId || parentId === 'root' || !localMap.has(parentId) || visited.has(parentId)) {
      worldOpacityMap.set(partId, entry.local.opacity);
      return entry.local.opacity;
    }
    visited.add(partId);
    const parentOp = resolveWorldOpacity(parentId, visited);
    const combinedOp = Math.max(0, Math.min(1, parentOp * entry.local.opacity));
    worldOpacityMap.set(partId, combinedOp);
    return combinedOp;
  }

  const poseList = [];
  for (const part of RIG_SPEC.parts) {
    const { local } = localMap.get(part.id);
    const worldMatrix = resolveWorldMatrix(part.id);
    const worldOpacity = resolveWorldOpacity(part.id);
    const matrixSvg = 'matrix(' + worldMatrix.map((n) => Number(n.toFixed(4))).join(', ') + ')';
    poseList.push({
      id: part.id,
      role: part.role,
      motion: part.motion,
      parent: part.parent,
      pivot: part.pivot,
      zIndex: part.zIndex,
      blend: part.blend,
      local,
      worldMatrix,
      svgTransform: matrixSvg,
      opacity: Number(worldOpacity.toFixed(3))
    });
  }

  poseList.sort((a, b) => a.zIndex - b.zIndex);

  return {
    rigId: RIG_SPEC.rigId,
    entityId: RIG_SPEC.entityId,
    animName,
    timeMs,
    parts: poseList
  };
}

/**
 * 将计算出的骨骼姿态直接应用到内联 <svg> DOM 元素上
 */
export function applyToSvgDom(svgElement, animNameOrPose = 'idle', timeMs = 0, context = {}) {
  if (!svgElement) return null;
  const pose = (typeof animNameOrPose === 'object' && animNameOrPose !== null && Array.isArray(animNameOrPose.parts))
    ? animNameOrPose
    : evaluatePose(animNameOrPose, timeMs, context);
  svgElement.setAttribute('data-anim-state', pose.animName || 'idle');

  for (const p of pose.parts) {
    const g = svgElement.querySelector('#' + p.id);
    if (g) {
      g.setAttribute('transform', p.svgTransform);
      g.style.opacity = String(p.opacity);
      if (p.blend && p.blend !== 'normal') {
        g.style.mixBlendMode = p.blend;
      }
    }
  }
  return pose;
}

/**
 * 在 Canvas 2D 上按 z-index 画家算法分层合成绘制该角色的当前动作姿态
 */
export function renderToCanvas(ctx, partImages, animName = 'idle', timeMs = 0, context = {}) {
  if (!ctx || !partImages) return null;
  const pose = evaluatePose(animName, timeMs, context);
  const blendMap = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    'plus-lighter': 'lighter'
  };

  for (const p of pose.parts) {
    const img = partImages instanceof Map ? partImages.get(p.id) : partImages[p.id];
    if (!img) continue;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = p.opacity;
    ctx.globalCompositeOperation = blendMap[p.blend] || 'source-over';
    const m = p.worldMatrix;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  return pose;
}

export default { RIG_SPEC, ANIMATIONS, evaluatePose, applyToSvgDom, renderToCanvas };