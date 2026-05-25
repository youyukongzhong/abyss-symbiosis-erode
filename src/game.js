const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  hpBar: document.querySelector("#hpBar"),
  hpText: document.querySelector("#hpText"),
  erosionBar: document.querySelector("#erosionBar"),
  erosionText: document.querySelector("#erosionText"),
  xpBar: document.querySelector("#xpBar"),
  xpText: document.querySelector("#xpText"),
  bagText: document.querySelector("#bagText"),
  geneText: document.querySelector("#geneText"),
  organSlots: document.querySelector("#organSlots"),
  missionTitle: document.querySelector("#missionTitle"),
  missionTimer: document.querySelector("#missionTimer"),
  startOverlay: document.querySelector("#startOverlay"),
  startButton: document.querySelector("#startButton"),
  mutationOverlay: document.querySelector("#mutationOverlay"),
  mutationCards: document.querySelector("#mutationCards"),
  resultOverlay: document.querySelector("#resultOverlay"),
  resultKicker: document.querySelector("#resultKicker"),
  resultTitle: document.querySelector("#resultTitle"),
  resultBody: document.querySelector("#resultBody"),
  restartButton: document.querySelector("#restartButton"),
};

const SLOT_LABELS = {
  head: "头部",
  torso: "躯干",
  leftArm: "左臂",
  rightArm: "右臂",
  legs: "双腿",
};

const RARITY_WEIGHT = {
  common: 60,
  rare: 25,
  epic: 12,
  abyssal: 3,
};

const RARITY_LABEL = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  abyssal: "深渊",
};

const MUTATIONS = [
  {
    id: "regenerative_heart",
    name: "再生心核",
    slot: "torso",
    rarity: "common",
    desc: "生命上限提高，移植时立刻恢复一段生命。",
    apply(game) {
      game.player.maxHp += 35;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 45);
      game.player.traits.regenHeart = true;
    },
  },
  {
    id: "mantis_blade",
    name: "螳螂刃",
    slot: "leftArm",
    rarity: "common",
    desc: "攻击时额外挥出近距离骨刃，适合贴脸处决。",
    apply(game) {
      game.player.traits.mantisBlade = true;
      game.player.damage += 4;
    },
  },
  {
    id: "spider_legs",
    name: "蛛行腿",
    slot: "legs",
    rarity: "common",
    desc: "移动速度提高，冲刺冷却缩短。",
    apply(game) {
      game.player.speed += 44;
      game.player.dashCooldownMax = Math.max(0.85, game.player.dashCooldownMax - 0.45);
      game.player.traits.spiderLegs = true;
    },
  },
  {
    id: "compound_eyes",
    name: "复眼簇",
    slot: "head",
    rarity: "rare",
    desc: "弱点命中更容易暴击，子弹可穿透一个目标。",
    apply(game) {
      game.player.traits.compoundEyes = true;
      game.player.pierce += 1;
      game.player.critBonus += 0.45;
    },
  },
  {
    id: "venom_gland",
    name: "腐毒腺",
    slot: "rightArm",
    rarity: "rare",
    desc: "弹体命中后留下腐蚀毒池，持续烧灼敌群。",
    apply(game) {
      game.player.traits.venomGland = true;
      game.player.damage += 2;
    },
  },
  {
    id: "chitin_shell",
    name: "几丁甲壳",
    slot: "torso",
    rarity: "rare",
    desc: "获得伤害减免与额外生命，但身体更沉。",
    apply(game) {
      game.player.maxHp += 28;
      game.player.hp += 28;
      game.player.armor += 0.18;
      game.player.speed -= 14;
      game.player.traits.chitinShell = true;
    },
  },
  {
    id: "hunger_maw",
    name: "饥饿胃袋",
    slot: "torso",
    rarity: "epic",
    desc: "胃袋容量提高，拾取基因物质时回复少量生命。",
    apply(game) {
      game.player.bagCapacity += 4;
      game.player.traits.hungerMaw = true;
    },
  },
  {
    id: "bone_launcher",
    name: "骨刺发射器",
    slot: "rightArm",
    rarity: "epic",
    desc: "射速提高，弹体速度提高，适合中远距离压制。",
    apply(game) {
      game.player.fireRate += 1.2;
      game.player.bulletSpeed += 120;
      game.player.damage += 3;
      game.player.traits.boneLauncher = true;
    },
  },
  {
    id: "abyss_crown",
    name: "深渊冠冕",
    slot: "head",
    rarity: "abyssal",
    desc: "侵蚀带来的伤害收益提高，幻觉出现时会被短暂标记。",
    apply(game) {
      game.player.traits.abyssCrown = true;
      game.player.damage += 6;
      game.player.critBonus += 0.25;
    },
  },
];

const input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distance = (a, b, c, d) => Math.hypot(a - c, b - d);
const angleTo = (a, b, c, d) => Math.atan2(d - b, c - a);
const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const chance = (value) => Math.random() < value;

let dpr = 1;
let viewW = 0;
let viewH = 0;
let game;
let nextEntityId = 1;

function createPlayer() {
  return {
    x: 220,
    y: 220,
    r: 18,
    hp: 100,
    maxHp: 100,
    speed: 208,
    damage: 16,
    fireRate: 4.2,
    bulletSpeed: 560,
    armor: 0,
    pierce: 0,
    critBonus: 0,
    xp: 0,
    xpNeed: 60,
    level: 1,
    genes: 0,
    bag: 0,
    bagCapacity: 10,
    fireCooldown: 0,
    slashCooldown: 0,
    dashCooldown: 0,
    dashCooldownMax: 1.65,
    dashTime: 0,
    facing: 0,
    organs: {
      head: null,
      torso: null,
      leftArm: null,
      rightArm: null,
      legs: null,
    },
    traits: {},
  };
}

function newGame(startPlaying = false) {
  const next = {
    status: startPlaying ? "playing" : "menu",
    world: {
      w: 3200,
      h: 2200,
      time: 0,
      spawnTimer: 0.8,
      hallucinationTimer: 5,
      patches: [],
      props: [],
      loot: [],
      enemies: [],
      bullets: [],
      enemyShots: [],
      particles: [],
      texts: [],
      slashes: [],
      puddles: [],
      hallucinations: [],
      exit: { x: 2960, y: 1940, r: 94 },
      extraction: {
        active: false,
        time: 60,
        spawnTimer: 0,
      },
    },
    player: createPlayer(),
    camera: { x: 0, y: 0 },
    erosion: 0,
    mutationChoices: [],
    mutationPauseQueued: false,
    messageTimer: 0,
  };

  buildWorld(next);
  for (let i = 0; i < 18; i += 1) spawnEnemy(next, choose(["charger", "charger", "spitter"]), rand(420, 2700), rand(360, 1750));
  for (let i = 0; i < 26; i += 1) spawnLoot(next, choose(["gene", "gene", "flesh", "syringe", "organ"]), rand(280, 2880), rand(260, 1900));
  return next;
}

function choose(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildWorld(target) {
  const { world } = target;
  for (let i = 0; i < 58; i += 1) {
    world.patches.push({
      x: rand(120, world.w - 120),
      y: rand(120, world.h - 120),
      r: rand(34, 118),
      wobble: rand(0, Math.PI * 2),
      tone: choose(["green", "red", "amber"]),
    });
  }

  for (let i = 0; i < 42; i += 1) {
    world.props.push({
      x: rand(120, world.w - 120),
      y: rand(120, world.h - 120),
      w: rand(34, 88),
      h: rand(22, 70),
      rot: rand(-0.2, 0.2),
      type: choose(["tank", "crate", "console"]),
    });
  }
}

function spawnEnemy(target, type, x, y, elite = false) {
  const stats = {
    charger: { hp: 46, speed: 134, r: 17, damage: 12, xp: 18 },
    spitter: { hp: 38, speed: 92, r: 16, damage: 10, xp: 20 },
    merc: { hp: 52, speed: 104, r: 15, damage: 9, xp: 16 },
  }[type];

  target.world.enemies.push({
    id: nextEntityId,
    type,
    x: clamp(x, 72, target.world.w - 72),
    y: clamp(y, 72, target.world.h - 72),
    vx: 0,
    vy: 0,
    hp: stats.hp * (elite ? 1.65 : 1),
    maxHp: stats.hp * (elite ? 1.65 : 1),
    speed: stats.speed * (elite ? 1.12 : 1),
    r: stats.r * (elite ? 1.22 : 1),
    damage: stats.damage * (elite ? 1.35 : 1),
    xp: stats.xp * (elite ? 1.8 : 1),
    elite,
    attackCooldown: rand(0.2, 1.6),
    weakAngle: rand(0, Math.PI * 2),
    weakBroken: false,
    poisonTimer: 0,
    hitFlash: 0,
  });
  nextEntityId += 1;
}

function spawnLoot(target, type, x, y, value = null) {
  const values = {
    flesh: value ?? randInt(12, 24),
    gene: value ?? randInt(6, 18),
    syringe: value ?? randInt(22, 40),
    organ: value ?? randInt(28, 42),
  };

  target.world.loot.push({
    type,
    x,
    y,
    value: values[type],
    r: type === "organ" ? 13 : 10,
    pulse: rand(0, Math.PI * 2),
  });
}

function resize() {
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  canvas.style.width = `${viewW}px`;
  canvas.style.height = `${viewH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function screenToWorld(x, y) {
  return {
    x: x + game.camera.x,
    y: y + game.camera.y,
  };
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  input.mouse.x = event.clientX - rect.left;
  input.mouse.y = event.clientY - rect.top;
  if (game) {
    const world = screenToWorld(input.mouse.x, input.mouse.y);
    input.mouse.worldX = world.x;
    input.mouse.worldY = world.y;
  }
}

function resetAndStart() {
  game = newGame(true);
  ui.startOverlay.classList.remove("active");
  ui.resultOverlay.classList.remove("active");
  ui.mutationOverlay.classList.remove("active");
  syncHud();
}

function showResult(win) {
  game.status = win ? "won" : "dead";
  const carried = game.player.genes;
  const level = game.player.level;
  ui.resultKicker.textContent = win ? "净化电梯已抵达" : "基因链崩溃";
  ui.resultTitle.textContent = win ? "撤离成功" : "实验体死亡";
  ui.resultBody.textContent = win
    ? `带回 ${carried} 份基因碎片，实验体进化至 ${level} 级。下一步可以把这些收益接入局外避难所。`
    : `本局携带的 ${carried} 份基因碎片与器官全部丢失。重新进入深渊会从基础形态开始。`;
  ui.resultOverlay.classList.add("active");
}

function startExtraction() {
  if (game.world.extraction.active || game.status !== "playing") return;
  game.status = "extracting";
  game.world.extraction.active = true;
  game.world.extraction.time = 60;
  game.world.extraction.spawnTimer = 0.1;
  game.erosion = clamp(game.erosion + 8, 0, 100);
  addText("净化电梯充能", game.player.x, game.player.y - 34, "#d7ff4a");
}

function openMutationChoices() {
  game.status = "mutation";
  game.mutationPauseQueued = false;
  game.mutationChoices = pickMutations();
  ui.mutationCards.innerHTML = "";

  game.mutationChoices.forEach((mutation) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `mutation-card ${mutation.rarity}`;
    card.innerHTML = `
      <div>
        <h3>${mutation.name}</h3>
        <small>${RARITY_LABEL[mutation.rarity]} / ${SLOT_LABELS[mutation.slot]}</small>
        <p>${mutation.desc}</p>
      </div>
      <span class="slot-tag">${game.player.organs[mutation.slot] ? "替换器官" : "空槽移植"}</span>
    `;
    card.addEventListener("click", () => chooseMutation(mutation));
    ui.mutationCards.appendChild(card);
  });

  ui.mutationOverlay.classList.add("active");
}

function chooseMutation(mutation) {
  if (game.status !== "mutation") return;
  mutation.apply(game);
  game.player.organs[mutation.slot] = mutation;
  game.erosion = clamp(game.erosion + (mutation.rarity === "abyssal" ? 14 : 7), 0, 100);
  addBurst(game.player.x, game.player.y, mutation.rarity === "abyssal" ? "#ffd166" : "#75ff94", 28);
  ui.mutationOverlay.classList.remove("active");
  game.status = game.world.extraction.active ? "extracting" : "playing";
  syncHud();
}

function pickMutations() {
  const picked = [];
  let guard = 0;
  while (picked.length < 3 && guard < 80) {
    guard += 1;
    const total = MUTATIONS.reduce((sum, mutation) => sum + RARITY_WEIGHT[mutation.rarity], 0);
    let roll = rand(0, total);
    const selected = MUTATIONS.find((mutation) => {
      roll -= RARITY_WEIGHT[mutation.rarity];
      return roll <= 0;
    }) ?? MUTATIONS[0];

    if (!picked.some((mutation) => mutation.id === selected.id)) picked.push(selected);
  }
  return picked;
}

function damageMultiplier() {
  const erosionScale = game.player.traits.abyssCrown ? 0.017 : 0.012;
  return 1 + game.erosion * erosionScale;
}

function addText(text, x, y, color = "#eef5e6") {
  game.world.texts.push({ text, x, y, color, life: 1, vy: -26 });
}

function addBurst(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 210);
    game.world.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: rand(2, 5),
      color,
      life: rand(0.35, 0.9),
      maxLife: 0.9,
    });
  }
}

function firePlayerAttack() {
  const p = game.player;
  const a = angleTo(p.x, p.y, input.mouse.worldX, input.mouse.worldY);
  p.facing = a;

  if (p.fireCooldown <= 0) {
    p.fireCooldown = 1 / p.fireRate;
    const spread = p.traits.boneLauncher ? rand(-0.025, 0.025) : rand(-0.045, 0.045);
    const shotAngle = a + spread;
    game.world.bullets.push({
      x: p.x + Math.cos(shotAngle) * 24,
      y: p.y + Math.sin(shotAngle) * 24,
      vx: Math.cos(shotAngle) * p.bulletSpeed,
      vy: Math.sin(shotAngle) * p.bulletSpeed,
      r: 4,
      damage: p.damage * damageMultiplier(),
      life: 1.3,
      pierce: p.pierce,
      poison: Boolean(p.traits.venomGland),
      color: p.traits.venomGland ? "#d7ff4a" : "#7cf8ff",
    });
    addBurst(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, "#7cf8ff", 3);
  }

  if (p.traits.mantisBlade && p.slashCooldown <= 0) {
    p.slashCooldown = 0.42;
    game.world.slashes.push({
      x: p.x,
      y: p.y,
      angle: a,
      life: 0.16,
      maxLife: 0.16,
      radius: 86,
      hit: new Set(),
    });
  }
}

function update(dt) {
  if (!game || !["playing", "extracting"].includes(game.status)) return;

  const { player, world } = game;
  world.time += dt;
  game.messageTimer = Math.max(0, game.messageTimer - dt);
  game.erosion = clamp(game.erosion + dt * (game.status === "extracting" ? 0.08 : 0.035), 0, 100);

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.slashCooldown = Math.max(0, player.slashCooldown - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.dashTime = Math.max(0, player.dashTime - dt);

  updatePlayer(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateLoot(dt);
  updatePuddles(dt);
  updateSlashes(dt);
  updateParticles(dt);
  updateSpawning(dt);
  updateExtraction(dt);
  updateHallucinations(dt);
  updateCamera();

  if (player.hp <= 0) showResult(false);
  if (game.mutationPauseQueued) openMutationChoices();
}

function updatePlayer(dt) {
  const p = game.player;
  const dir = { x: 0, y: 0 };
  if (input.keys.has("w")) dir.y -= 1;
  if (input.keys.has("s")) dir.y += 1;
  if (input.keys.has("a")) dir.x -= 1;
  if (input.keys.has("d")) dir.x += 1;

  const len = Math.hypot(dir.x, dir.y);
  if (len > 0) {
    dir.x /= len;
    dir.y /= len;
  }

  const bagSlow = lerp(1, 0.74, p.bag / p.bagCapacity);
  const dashBoost = p.dashTime > 0 ? 2.55 : 1;
  p.x = clamp(p.x + dir.x * p.speed * bagSlow * dashBoost * dt, p.r, game.world.w - p.r);
  p.y = clamp(p.y + dir.y * p.speed * bagSlow * dashBoost * dt, p.r, game.world.h - p.r);

  const desiredFacing = angleTo(p.x, p.y, input.mouse.worldX, input.mouse.worldY);
  p.facing = lerpAngle(p.facing, desiredFacing, 0.35);

  if (input.mouse.down) firePlayerAttack();

  if (p.traits.regenHeart && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + dt * 1.4);
  }
}

function lerpAngle(a, b, t) {
  return a + normAngle(b - a) * t;
}

function updateProjectiles(dt) {
  const { world } = game;

  for (const bullet of world.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const hit = distance(bullet.x, bullet.y, enemy.x, enemy.y) <= enemy.r + bullet.r;
      if (!hit) continue;

      const weak = weakpoint(enemy);
      const weakHit = !enemy.weakBroken && distance(bullet.x, bullet.y, weak.x, weak.y) < enemy.r * 0.55;
      const crit = weakHit ? 2.25 + game.player.critBonus : 1;
      enemy.weakBroken = enemy.weakBroken || weakHit;
      hurtEnemy(enemy, bullet.damage * crit, weakHit);
      if (bullet.poison) {
        world.puddles.push({
          x: enemy.x,
          y: enemy.y,
          r: 44,
          life: 3.2,
          damage: 6.5 * damageMultiplier(),
        });
      }
      bullet.pierce -= 1;
      if (bullet.pierce < 0) {
        bullet.life = 0;
        break;
      }
    }

    for (const illusion of world.hallucinations) {
      if (distance(bullet.x, bullet.y, illusion.x, illusion.y) < illusion.r + bullet.r) {
        illusion.life = 0;
        bullet.life = 0;
        addBurst(illusion.x, illusion.y, "#c389ff", 8);
        break;
      }
    }
  }

  world.bullets = world.bullets.filter((bullet) => (
    bullet.life > 0 &&
    bullet.x > -40 &&
    bullet.y > -40 &&
    bullet.x < world.w + 40 &&
    bullet.y < world.h + 40
  ));

  for (const shot of world.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (distance(shot.x, shot.y, game.player.x, game.player.y) <= game.player.r + shot.r) {
      damagePlayer(shot.damage, 1.3);
      shot.life = 0;
      addBurst(shot.x, shot.y, shot.color, 8);
    }
  }

  world.enemyShots = world.enemyShots.filter((shot) => shot.life > 0);
}

function updateEnemies(dt) {
  const { world, player } = game;

  for (const enemy of world.enemies) {
    enemy.attackCooldown -= dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.poisonTimer = Math.max(0, enemy.poisonTimer - dt);
    if (enemy.poisonTimer > 0) hurtEnemy(enemy, dt * 9 * damageMultiplier(), false, false);

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (enemy.type === "charger") {
      enemy.vx = nx * enemy.speed;
      enemy.vy = ny * enemy.speed;
      if (dist < enemy.r + player.r + 7 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 0.78;
        damagePlayer(enemy.damage, 1.8);
        addBurst(player.x, player.y, "#ff4b55", 10);
      }
    }

    if (enemy.type === "spitter") {
      const desired = dist > 280 ? 1 : dist < 210 ? -1 : 0;
      enemy.vx = nx * enemy.speed * desired;
      enemy.vy = ny * enemy.speed * desired;
      if (enemy.attackCooldown <= 0 && dist < 720) {
        enemy.attackCooldown = enemy.elite ? 1.2 : 1.75;
        fireEnemyShot(enemy, "#d7ff4a", 225, enemy.damage, 5);
      }
    }

    if (enemy.type === "merc") {
      const strafe = Math.sin(world.time * 1.8 + enemy.x) > 0 ? 1 : -1;
      const desired = dist > 420 ? 1 : dist < 300 ? -0.8 : 0;
      enemy.vx = nx * enemy.speed * desired + -ny * enemy.speed * 0.45 * strafe;
      enemy.vy = ny * enemy.speed * desired + nx * enemy.speed * 0.45 * strafe;
      if (enemy.attackCooldown <= 0 && dist < 820) {
        enemy.attackCooldown = enemy.elite ? 0.85 : 1.25;
        fireEnemyShot(enemy, "#ffb6a8", 360, enemy.damage, 4);
      }
    }

    enemy.x = clamp(enemy.x + enemy.vx * dt, enemy.r, world.w - enemy.r);
    enemy.y = clamp(enemy.y + enemy.vy * dt, enemy.r, world.h - enemy.r);
  }

  const dead = world.enemies.filter((enemy) => enemy.hp <= 0);
  world.enemies = world.enemies.filter((enemy) => enemy.hp > 0);
  for (const enemy of dead) killEnemy(enemy);
}

function fireEnemyShot(enemy, color, speed, damage, radius) {
  const a = angleTo(enemy.x, enemy.y, game.player.x, game.player.y) + rand(-0.06, 0.06);
  game.world.enemyShots.push({
    x: enemy.x + Math.cos(a) * (enemy.r + 6),
    y: enemy.y + Math.sin(a) * (enemy.r + 6),
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: radius,
    damage,
    color,
    life: 3,
  });
}

function updateLoot() {
  const { world, player } = game;

  for (const item of world.loot) {
    item.pulse += 0.06;
    const dist = distance(item.x, item.y, player.x, player.y);
    const canMagnet = dist < 118 && (item.type === "flesh" || item.type === "syringe" || player.bag < player.bagCapacity);
    if (canMagnet) {
      const a = angleTo(item.x, item.y, player.x, player.y);
      const pull = item.type === "flesh" ? 280 : 160;
      item.x += Math.cos(a) * pull * (1 / 60);
      item.y += Math.sin(a) * pull * (1 / 60);
    }

    if (distance(item.x, item.y, player.x, player.y) <= player.r + item.r + 4) {
      item.collected = collectLoot(item);
    }
  }

  world.loot = world.loot.filter((item) => !item.collected);
}

function collectLoot(item) {
  const p = game.player;

  if (item.type === "flesh") {
    gainXp(item.value);
    game.erosion = clamp(game.erosion + 1.6, 0, 100);
    addText(`+${item.value} 血肉`, item.x, item.y, "#7cf8ff");
    return true;
  }

  if (item.type === "syringe") {
    p.hp = Math.min(p.maxHp, p.hp + item.value);
    addText(`+${item.value} 生命`, item.x, item.y, "#75ff94");
    addBurst(item.x, item.y, "#75ff94", 8);
    return true;
  }

  const bagCost = item.type === "organ" ? 2 : 1;
  if (p.bag + bagCost > p.bagCapacity) {
    if (game.messageTimer <= 0) {
      addText("胃袋已满", p.x, p.y - 38, "#ffd166");
      game.messageTimer = 1.2;
    }
    return false;
  }

  p.bag += bagCost;
  if (item.type === "gene") {
    p.genes += item.value;
    game.erosion = clamp(game.erosion + rand(4, 8), 0, 100);
    addText(`基因 +${item.value}`, item.x, item.y, "#ffd166");
  }

  if (item.type === "organ") {
    gainXp(item.value);
    p.genes += Math.floor(item.value / 3);
    game.erosion = clamp(game.erosion + rand(8, 14), 0, 100);
    addText("器官样本", item.x, item.y, "#c389ff");
  }

  if (p.traits.hungerMaw) {
    p.hp = Math.min(p.maxHp, p.hp + 5);
  }
  return true;
}

function gainXp(amount) {
  const p = game.player;
  p.xp += amount;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.xpNeed = Math.round(p.xpNeed * 1.34 + 18);
    p.level += 1;
    game.mutationPauseQueued = true;
    break;
  }
}

function updatePuddles(dt) {
  for (const puddle of game.world.puddles) {
    puddle.life -= dt;
    for (const enemy of game.world.enemies) {
      if (distance(puddle.x, puddle.y, enemy.x, enemy.y) < puddle.r + enemy.r) {
        enemy.poisonTimer = Math.max(enemy.poisonTimer, 0.5);
        hurtEnemy(enemy, puddle.damage * dt, false, false);
      }
    }
  }
  game.world.puddles = game.world.puddles.filter((puddle) => puddle.life > 0);
}

function updateSlashes(dt) {
  for (const slash of game.world.slashes) {
    slash.life -= dt;
    for (const enemy of game.world.enemies) {
      if (slash.hit.has(enemy.id)) continue;
      const dist = distance(slash.x, slash.y, enemy.x, enemy.y);
      const a = angleTo(slash.x, slash.y, enemy.x, enemy.y);
      const inCone = Math.abs(normAngle(a - slash.angle)) < 0.75;
      if (dist < slash.radius + enemy.r && inCone) {
        slash.hit.add(enemy.id);
        hurtEnemy(enemy, game.player.damage * damageMultiplier() * 2.1, true);
        addBurst(enemy.x, enemy.y, "#ff4b55", 12);
      }
    }
  }
  game.world.slashes = game.world.slashes.filter((slash) => slash.life > 0);
}

function updateParticles(dt) {
  const { world } = game;
  for (const particle of world.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
    particle.life -= dt;
  }
  world.particles = world.particles.filter((particle) => particle.life > 0);

  for (const text of world.texts) {
    text.y += text.vy * dt;
    text.life -= dt;
  }
  world.texts = world.texts.filter((text) => text.life > 0);
}

function updateSpawning(dt) {
  if (game.status === "extracting") return;
  const { world } = game;
  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;

  const pressure = 3.2 - clamp(game.erosion / 65, 0, 1.5);
  world.spawnTimer = Math.max(1.2, pressure);
  if (world.enemies.length > 34) return;

  const pos = spawnPointAwayFromPlayer();
  const type = Math.random() < 0.18 ? "merc" : choose(["charger", "charger", "spitter"]);
  spawnEnemy(game, type, pos.x, pos.y, game.erosion > 72 && chance(0.18));
}

function updateExtraction(dt) {
  const { world, player } = game;
  const distToExit = distance(player.x, player.y, world.exit.x, world.exit.y);

  if (!world.extraction.active) {
    if (distToExit < world.exit.r + player.r) {
      ui.missionTitle.textContent = "净化电梯就绪";
      ui.missionTimer.textContent = "按 E";
    }
    return;
  }

  world.extraction.time -= dt;
  world.extraction.spawnTimer -= dt;

  if (world.extraction.spawnTimer <= 0) {
    const intensity = 0.55 + game.erosion / 75 + player.bag / player.bagCapacity;
    world.extraction.spawnTimer = clamp(1.25 - intensity * 0.28, 0.34, 1.2);
    const count = Math.round(rand(1, 3 + intensity));
    for (let i = 0; i < count; i += 1) {
      const pos = spawnPointNearExit();
      const type = choose(["charger", "charger", "spitter", "merc"]);
      spawnEnemy(game, type, pos.x, pos.y, world.extraction.time < 18 && chance(0.18));
    }
  }

  if (world.extraction.time <= 0) showResult(true);
}

function updateHallucinations(dt) {
  const { world, player } = game;
  world.hallucinationTimer -= dt;
  const stage = game.erosion;

  if (stage > 42 && world.hallucinationTimer <= 0) {
    world.hallucinationTimer = rand(3.2, 6.8) - clamp(stage / 100, 0, 0.9) * 2;
    const pos = spawnPointAwayFromPlayer(240, 520);
    world.hallucinations.push({
      x: pos.x,
      y: pos.y,
      r: 16,
      speed: rand(95, 145),
      life: rand(7, 12),
      attackCooldown: 1,
    });
  }

  for (const illusion of world.hallucinations) {
    illusion.life -= dt;
    illusion.attackCooldown -= dt;
    const a = angleTo(illusion.x, illusion.y, player.x, player.y);
    illusion.x += Math.cos(a) * illusion.speed * dt;
    illusion.y += Math.sin(a) * illusion.speed * dt;
    if (distance(illusion.x, illusion.y, player.x, player.y) < illusion.r + player.r + 4 && illusion.attackCooldown <= 0) {
      illusion.attackCooldown = 1.25;
      damagePlayer(5.5, 0.6);
      addText("幻痛", player.x, player.y - 30, "#c389ff");
    }
  }

  world.hallucinations = world.hallucinations.filter((illusion) => illusion.life > 0);
}

function updateCamera() {
  const targetX = game.player.x - viewW / 2;
  const targetY = game.player.y - viewH / 2;
  game.camera.x = clamp(lerp(game.camera.x, targetX, 0.13), 0, Math.max(0, game.world.w - viewW));
  game.camera.y = clamp(lerp(game.camera.y, targetY, 0.13), 0, Math.max(0, game.world.h - viewH));
  const worldMouse = screenToWorld(input.mouse.x, input.mouse.y);
  input.mouse.worldX = worldMouse.x;
  input.mouse.worldY = worldMouse.y;
}

function spawnPointAwayFromPlayer(min = 620, max = 1100) {
  const a = rand(0, Math.PI * 2);
  const d = rand(min, max);
  return {
    x: clamp(game.player.x + Math.cos(a) * d, 60, game.world.w - 60),
    y: clamp(game.player.y + Math.sin(a) * d, 60, game.world.h - 60),
  };
}

function spawnPointNearExit() {
  const a = rand(0, Math.PI * 2);
  const d = rand(180, 520);
  return {
    x: clamp(game.world.exit.x + Math.cos(a) * d, 40, game.world.w - 40),
    y: clamp(game.world.exit.y + Math.sin(a) * d, 40, game.world.h - 40),
  };
}

function hurtEnemy(enemy, amount, crit = false, show = true) {
  enemy.hp -= amount;
  enemy.hitFlash = 0.09;
  if (show) addText(`${crit ? "!" : ""}${Math.round(amount)}`, enemy.x, enemy.y - enemy.r - 8, crit ? "#ffd166" : "#eef5e6");
}

function killEnemy(enemy) {
  addBurst(enemy.x, enemy.y, enemy.type === "merc" ? "#ffb6a8" : "#ff4b55", enemy.elite ? 24 : 14);
  spawnLoot(game, "flesh", enemy.x + rand(-12, 12), enemy.y + rand(-12, 12), Math.round(enemy.xp));
  if (chance(enemy.type === "merc" ? 0.68 : 0.42)) spawnLoot(game, "gene", enemy.x + rand(-24, 24), enemy.y + rand(-24, 24));
  if (chance(0.08)) spawnLoot(game, "syringe", enemy.x + rand(-28, 28), enemy.y + rand(-28, 28));
  if (chance(enemy.elite ? 0.22 : 0.06)) spawnLoot(game, "organ", enemy.x + rand(-30, 30), enemy.y + rand(-30, 30));
}

function damagePlayer(amount, erosionGain = 1) {
  const reduced = amount * (1 - clamp(game.player.armor, 0, 0.55));
  game.player.hp -= reduced;
  game.erosion = clamp(game.erosion + erosionGain, 0, 100);
}

function weakpoint(enemy) {
  return {
    x: enemy.x + Math.cos(enemy.weakAngle) * enemy.r * 0.58,
    y: enemy.y + Math.sin(enemy.weakAngle) * enemy.r * 0.58,
  };
}

function draw() {
  if (!game) return;
  syncHud();

  ctx.clearRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-game.camera.x, -game.camera.y);

  drawWorld();
  drawLoot();
  drawPuddles();
  drawExit();
  drawProjectiles();
  drawEnemies();
  drawHallucinations();
  drawSlashes();
  drawPlayer();
  drawParticles();

  ctx.restore();
  drawVignette();
}

function drawWorld() {
  const { world } = game;
  ctx.fillStyle = "#050706";
  ctx.fillRect(0, 0, world.w, world.h);

  const startX = Math.floor(game.camera.x / 80) * 80;
  const startY = Math.floor(game.camera.y / 80) * 80;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(215,255,74,0.055)";
  for (let x = startX; x < game.camera.x + viewW + 120; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, game.camera.y - 80);
    ctx.lineTo(x, game.camera.y + viewH + 80);
    ctx.stroke();
  }
  for (let y = startY; y < game.camera.y + viewH + 120; y += 80) {
    ctx.beginPath();
    ctx.moveTo(game.camera.x - 80, y);
    ctx.lineTo(game.camera.x + viewW + 80, y);
    ctx.stroke();
  }

  drawCorridorBands();

  for (const patch of world.patches) {
    const visible = patch.x > game.camera.x - patch.r && patch.x < game.camera.x + viewW + patch.r && patch.y > game.camera.y - patch.r && patch.y < game.camera.y + viewH + patch.r;
    if (!visible) continue;
    ctx.save();
    ctx.translate(patch.x, patch.y);
    ctx.rotate(Math.sin(world.time * 0.3 + patch.wobble) * 0.08);
    const color = patch.tone === "green" ? "117,255,148" : patch.tone === "red" ? "255,75,85" : "215,255,74";
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, patch.r);
    gradient.addColorStop(0, `rgba(${color},0.15)`);
    gradient.addColorStop(1, `rgba(${color},0.01)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, patch.r * 1.2, patch.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${color},0.16)`;
    ctx.stroke();
    ctx.restore();
  }

  for (const prop of world.props) {
    const visible = prop.x > game.camera.x - 120 && prop.x < game.camera.x + viewW + 120 && prop.y > game.camera.y - 120 && prop.y < game.camera.y + viewH + 120;
    if (!visible) continue;
    ctx.save();
    ctx.translate(prop.x, prop.y);
    ctx.rotate(prop.rot);
    ctx.fillStyle = prop.type === "tank" ? "rgba(117,255,148,0.12)" : "rgba(238,245,230,0.08)";
    ctx.strokeStyle = "rgba(238,245,230,0.12)";
    roundRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h, 5);
    ctx.fill();
    ctx.stroke();
    if (prop.type === "tank") {
      ctx.fillStyle = "rgba(215,255,74,0.18)";
      ctx.fillRect(-prop.w / 4, -prop.h / 2, prop.w / 2, prop.h);
    }
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(255,75,85,0.36)";
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, world.w - 24, world.h - 24);
}

function drawCorridorBands() {
  ctx.save();
  ctx.fillStyle = "rgba(238,245,230,0.025)";
  for (let y = 220; y < game.world.h; y += 420) {
    ctx.fillRect(80, y, game.world.w - 160, 118);
  }
  for (let x = 320; x < game.world.w; x += 560) {
    ctx.fillRect(x, 80, 112, game.world.h - 160);
  }
  ctx.restore();
}

function drawExit() {
  const { exit, extraction } = game.world;
  const pulse = 0.5 + Math.sin(game.world.time * 3) * 0.5;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.fillStyle = "rgba(215,255,74,0.09)";
  ctx.beginPath();
  ctx.arc(0, 0, exit.r + pulse * 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = extraction.active ? "#ff4b55" : "#d7ff4a";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, exit.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(238,245,230,0.12)";
  roundRect(-44, -30, 88, 60, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(238,245,230,0.28)";
  ctx.stroke();
  ctx.fillStyle = extraction.active ? "#ff4b55" : "#75ff94";
  ctx.fillRect(-28, -8, 56 * pulse, 16);
  ctx.restore();
}

function drawLoot() {
  for (const item of game.world.loot) {
    const bob = Math.sin(item.pulse) * 3;
    ctx.save();
    ctx.translate(item.x, item.y + bob);
    const color = {
      flesh: "#7cf8ff",
      gene: "#ffd166",
      syringe: "#75ff94",
      organ: "#c389ff",
    }[item.type];
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    if (item.type === "syringe") {
      ctx.rotate(-0.65);
      roundRect(-12, -4, 24, 8, 4);
      ctx.fill();
      ctx.fillRect(10, -1, 8, 2);
    } else if (item.type === "organ") {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(5,7,6,0.55)";
      ctx.beginPath();
      ctx.arc(3, -2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
    }
    ctx.restore();
  }
}

function drawPuddles() {
  for (const puddle of game.world.puddles) {
    const alpha = clamp(puddle.life / 3.2, 0, 1);
    ctx.fillStyle = `rgba(215,255,74,${0.14 * alpha})`;
    ctx.strokeStyle = `rgba(215,255,74,${0.34 * alpha})`;
    ctx.beginPath();
    ctx.arc(puddle.x, puddle.y, puddle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawProjectiles() {
  for (const bullet of game.world.bullets) {
    ctx.save();
    ctx.shadowColor = bullet.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const shot of game.world.enemyShots) {
    ctx.save();
    ctx.shadowColor = shot.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = shot.color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const enemy of game.world.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    const base = enemy.type === "merc" ? "#d1d6cc" : enemy.type === "spitter" ? "#d7ff4a" : "#ff4b55";
    ctx.shadowColor = enemy.hitFlash > 0 ? "#ffffff" : base;
    ctx.shadowBlur = enemy.elite ? 20 : 9;
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : base;

    if (enemy.type === "charger") {
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.r * 1.25, enemy.r * 0.9, angleTo(enemy.x, enemy.y, game.player.x, game.player.y), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(5,7,6,0.55)";
      ctx.beginPath();
      ctx.arc(-enemy.r * 0.25, -enemy.r * 0.15, enemy.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    if (enemy.type === "spitter") {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(5,7,6,0.5)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (enemy.type === "merc") {
      roundRect(-enemy.r, -enemy.r * 0.8, enemy.r * 2, enemy.r * 1.6, 4);
      ctx.fill();
      ctx.fillStyle = "#ffb6a8";
      ctx.fillRect(enemy.r * 0.2, -3, enemy.r * 1.2, 6);
    }

    const weak = weakpoint(enemy);
    if (!enemy.weakBroken && enemy.type !== "merc") {
      ctx.fillStyle = "#75ff94";
      ctx.shadowColor = "#75ff94";
      ctx.shadowBlur = game.player.traits.compoundEyes ? 20 : 10;
      ctx.beginPath();
      ctx.arc(weak.x - enemy.x, weak.y - enemy.y, enemy.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(-enemy.r, -enemy.r - 12, enemy.r * 2, 4);
    ctx.fillStyle = enemy.elite ? "#ffd166" : "#75ff94";
    ctx.fillRect(-enemy.r, -enemy.r - 12, enemy.r * 2 * hpRatio, 4);
    ctx.restore();
  }
}

function drawHallucinations() {
  for (const illusion of game.world.hallucinations) {
    ctx.save();
    ctx.translate(illusion.x, illusion.y);
    ctx.globalAlpha = game.player.traits.abyssCrown ? 0.45 : 0.28;
    ctx.strokeStyle = "#c389ff";
    ctx.fillStyle = "rgba(195,137,255,0.18)";
    ctx.shadowColor = "#c389ff";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, illusion.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawSlashes() {
  for (const slash of game.world.slashes) {
    const t = slash.life / slash.maxLife;
    ctx.save();
    ctx.translate(slash.x, slash.y);
    ctx.rotate(slash.angle);
    ctx.globalAlpha = t;
    ctx.strokeStyle = "#ff4b55";
    ctx.shadowColor = "#ff4b55";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, slash.radius, -0.65, 0.65);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.facing);

  if (p.dashTime > 0) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#75ff94";
    ctx.beginPath();
    ctx.ellipse(-26, 0, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (p.traits.spiderLegs) {
    ctx.strokeStyle = "rgba(117,255,148,0.72)";
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-4, i * 7);
      ctx.lineTo(-24, i * 13);
      ctx.stroke();
    }
  }

  ctx.shadowColor = p.traits.abyssCrown ? "#ffd166" : "#75ff94";
  ctx.shadowBlur = p.traits.abyssCrown ? 24 : 13;
  ctx.fillStyle = p.traits.chitinShell ? "#a4ff8d" : "#75ff94";
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 1.16, p.r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#050706";
  ctx.beginPath();
  ctx.arc(p.r * 0.42, -6, 4, 0, Math.PI * 2);
  ctx.arc(p.r * 0.42, 6, 4, 0, Math.PI * 2);
  ctx.fill();

  if (p.traits.compoundEyes) {
    ctx.fillStyle = "#7cf8ff";
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(p.r * 0.15, i * 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (p.traits.mantisBlade) {
    ctx.strokeStyle = "#ff4b55";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(3, -p.r * 0.9);
    ctx.quadraticCurveTo(26, -34, 56, -28);
    ctx.stroke();
  }

  if (p.traits.venomGland) {
    ctx.fillStyle = "#d7ff4a";
    ctx.beginPath();
    ctx.arc(9, p.r * 0.82, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.traits.abyssCrown) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 8 + Math.sin(game.world.time * 5) * 2, -0.8, 0.8);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  for (const particle of game.world.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.font = "700 13px Inter, sans-serif";
  ctx.textAlign = "center";
  for (const text of game.world.texts) {
    ctx.globalAlpha = clamp(text.life, 0, 1);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
    ctx.globalAlpha = 1;
  }
}

function drawVignette() {
  const erosion = game.erosion / 100;
  const minSide = Math.min(viewW, viewH);
  const radius = lerp(minSide * 0.92, minSide * 0.38, erosion);
  const gradient = ctx.createRadialGradient(viewW / 2, viewH / 2, radius * 0.42, viewW / 2, viewH / 2, radius);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, `rgba(0,0,0,${0.12 + erosion * 0.28})`);
  gradient.addColorStop(1, `rgba(0,0,0,${0.72 + erosion * 0.22})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewW, viewH);

  if (erosion > 0.36) {
    ctx.strokeStyle = `rgba(255,75,85,${(erosion - 0.36) * 0.42})`;
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, viewW - 18, viewH - 18);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function syncHud() {
  if (!game) return;
  const p = game.player;
  ui.hpBar.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
  ui.hpText.textContent = `${Math.max(0, Math.round(p.hp))}/${Math.round(p.maxHp)}`;
  ui.erosionBar.style.width = `${Math.round(game.erosion)}%`;
  ui.erosionText.textContent = `${Math.round(game.erosion)}%`;
  ui.xpBar.style.width = `${clamp((p.xp / p.xpNeed) * 100, 0, 100)}%`;
  ui.xpText.textContent = `${Math.round(p.xp)}/${p.xpNeed}`;
  ui.bagText.textContent = `${p.bag}/${p.bagCapacity}`;
  ui.geneText.textContent = `基因 ${p.genes}`;

  ui.organSlots.innerHTML = Object.entries(SLOT_LABELS)
    .map(([slot, label]) => {
      const organ = p.organs[slot];
      return `<div class="organ-slot ${organ ? "filled" : ""}">${organ ? organ.name : label}</div>`;
    })
    .join("");

  if (game.world.extraction.active) {
    ui.missionTitle.textContent = "撤离尸潮";
    ui.missionTimer.textContent = `${Math.ceil(game.world.extraction.time)}s`;
  } else if (distance(p.x, p.y, game.world.exit.x, game.world.exit.y) < game.world.exit.r + p.r) {
    ui.missionTitle.textContent = "净化电梯就绪";
    ui.missionTimer.textContent = "按 E";
  } else {
    const d = Math.round(distance(p.x, p.y, game.world.exit.x, game.world.exit.y));
    ui.missionTitle.textContent = p.level < 2 ? "吞噬血肉，完成首次变异" : "前往净化电梯";
    ui.missionTimer.textContent = `${d}m`;
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - loop.last) / 1000 || 0);
  loop.last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
loop.last = performance.now();

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  input.keys.add(key);
  if (key === "shift" && game && ["playing", "extracting"].includes(game.status) && game.player.dashCooldown <= 0) {
    game.player.dashTime = 0.14;
    game.player.dashCooldown = game.player.dashCooldownMax;
  }
  if (key === "e" && game && game.status === "playing") {
    const nearExit = distance(game.player.x, game.player.y, game.world.exit.x, game.world.exit.y) < game.world.exit.r + game.player.r;
    if (nearExit) startExtraction();
  }
});
window.addEventListener("keyup", (event) => input.keys.delete(event.key.toLowerCase()));
canvas.addEventListener("mousemove", onPointerMove);
canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) input.mouse.down = true;
});
window.addEventListener("mouseup", () => {
  input.mouse.down = false;
});

ui.startButton.addEventListener("click", resetAndStart);
ui.restartButton.addEventListener("click", resetAndStart);

resize();
game = newGame(false);
updateCamera();
requestAnimationFrame(loop);
