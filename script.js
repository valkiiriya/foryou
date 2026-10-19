
const canvas = document.getElementById("heartCanvas");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");

const TAU = Math.PI * 2;
const FOV = 650;

let W = 0;
let H = 0;
let CX = 0;
let CY = 0;
let DPR = 1;
let heartSize = 1;

let particles = [];
let phase = "dark";
let phaseTime = 0;
let time = 0;
let lastTime = 0;

const DURATION = {
  dark: 0.45,
  intro: 1.9,
  breaking: 1.05,
  reform: 1.75
};

const SETTINGS = {
  mobileParticles: 1050,
  desktopParticles: 1700,
  rotationTurns: 1,
  explosionPower: 9,
  heartbeatSpeed: 1.25,
  glow: 9
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function ease(t) {
  t = clamp(t);
  return t * t * (3 - 2 * t);
}

function easeOut(t) {
  t = clamp(t);
  return 1 - Math.pow(1 - t, 3);
}


function heartPoint(t) {
  return {
    x: 16 * Math.sin(t) ** 3,
    y: -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    )
  };
}

function randomHeartPoint() {
  const angle = rand(0, TAU);
  const radius = Math.sqrt(Math.random());
  const p = heartPoint(angle);

  const x = p.x * radius;
  const y = p.y * radius;




  const thickness = Math.sqrt(
    Math.max(0, 1 - radius * radius)
  );

  return {
    x: x * heartSize,
    y: y * heartSize,
    z: rand(-35, 35) * thickness
  };
}




function spherePoint() {
  const angle = rand(0, TAU);
  const y = rand(-1, 1);
  const r = Math.sqrt(1 - y * y);
  const distance = rand(140, 280) * heartSize / 12;

  return {
    x: Math.cos(angle) * r * distance,
    y: y * distance,
    z: Math.sin(angle) * r * distance
  };
}



function heartbeat(t) {
  const cycle = (t * SETTINGS.heartbeatSpeed) % 1;

  const beat1 = Math.exp(
    -Math.pow((cycle - 0.12) / 0.055, 2)
  );

  const beat2 = Math.exp(
    -Math.pow((cycle - 0.29) / 0.065, 2)
  );

  return 1 + 0.075 * beat1 + 0.045 * beat2;
}




function rotateY(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    x: x * c - z * s,
    z: x * s + z * c
  };
}

function project(x, y, z) {
  const perspective = FOV / Math.max(100, FOV + z);

  return {
    x: CX + x * perspective,
    y: CY + y * perspective,
    scale: perspective
  };
}

class Particle {
  constructor() {
    const target = randomHeartPoint();
    const start = spherePoint();

    this.tx = target.x;
    this.ty = target.y;
    this.tz = target.z;

    this.x = start.x;
    this.y = start.y;
    this.z = start.z;

    this.fromX = this.x;
    this.fromY = this.y;
    this.fromZ = this.z;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.size = rand(0.65, 1.65);
    this.seed = rand(0, TAU);
    this.speed = rand(0.7, 2);

    

    const palette = [
      { h: 350, l: 48 },
      { h: 358, l: 45 },
      { h: 3, l: 48 },
      { h: 0, l: 34 },
      { h: 346, l: 59 },
      { h: 338, l: 67 },
      { h: 355, l: 54 }
    ];

    this.color = palette[
      Math.floor(Math.random() * palette.length)
    ];
  }

  

  capturePosition() {
    this.fromX = this.x;
    this.fromY = this.y;
    this.fromZ = this.z;
  }

  explode() {
    const length = Math.hypot(
      this.x, this.y, this.z
    ) || 1;

    const power = rand(
      SETTINGS.explosionPower * 0.55,
      SETTINGS.explosionPower * 1.4
    );

    this.vx = this.x / length * power +
      rand(-3, 3);

    this.vy = this.y / length * power +
      rand(-3, 3);

    this.vz = this.z / length * power +
      rand(-4, 4);
  }

  update(dt) {
    const step = dt * 60;

    if (phase === "intro" || phase === "reform") {
      const duration = DURATION[phase];
      const t = clamp(phaseTime / duration);

     
      const k = ease(t);

      this.x = this.fromX +
        (this.tx - this.fromX) * k;

      this.y = this.fromY +
        (this.ty - this.fromY) * k;

      this.z = this.fromZ +
        (this.tz - this.fromZ) * k;
    }

    if (phase === "idle") {
      
      this.x = this.tx + Math.sin(
        time * this.speed + this.seed
      ) * 0.65;

      this.y = this.ty + Math.cos(
        time * this.speed + this.seed
      ) * 0.65;

      this.z = this.tz + Math.sin(
        time * 0.8 + this.seed
      ) * 0.8;
    }

    if (phase === "breaking") {
      this.x += this.vx * step;
      this.y += this.vy * step;
      this.z += this.vz * step;

      
      const drag = Math.pow(0.984, step);

      this.vx *= drag;
      this.vy *= drag;
      this.vz *= drag;
    }
  }

  prepareDraw(rotation, pulse) {
    const x = this.x * pulse;
    const y = this.y * pulse;
    const z = this.z * pulse;

    const rotated = rotateY(x, z, rotation);
    const p = project(rotated.x, y, rotated.z);

    this.screenX = p.x;
    this.screenY = p.y;
    this.screenScale = p.scale;
    this.depth = rotated.z;
  }

  draw(alpha) {
    if (alpha <= 0) return;


    const wave = Math.sin(
      time * 3.8 +
      this.tx * 0.018 +
      this.ty * 0.025 +
      this.seed * 0.35
    );

    const secondWave = Math.sin(
      time * 2.1 +
      this.tz * 0.04 -
      this.tx * 0.015
    );

    const brightness =
      this.color.l +
      wave * 12 +
      secondWave * 6;

    const hue = this.color.h + wave * 5;

    const flicker = 0.72 + 0.28 * Math.sin(
      time * this.speed * 3 + this.seed
    );

    const opacity = clamp(
      alpha * (0.65 + flicker * 0.35)
    );

    const radius = Math.max(
      0.25,
      this.size * this.screenScale * 1.3
    );

    ctx.globalAlpha = opacity;

    ctx.fillStyle = `hsl(${hue}, 100%, ${clamp(
      brightness, 20, 85
    )}%)`;

    ctx.shadowColor = `hsl(${hue}, 100%, 55%)`;
    ctx.shadowBlur = SETTINGS.glow * this.screenScale;

    ctx.beginPath();
    ctx.arc(
      this.screenX,
      this.screenY,
      radius,
      0,
      TAU
    );
    ctx.fill();
  }
}

function buildParticles() {
  particles = [];

  const count = W < 700
    ? SETTINGS.mobileParticles
    : SETTINGS.desktopParticles;

  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }
}

function resize() {
  const oldW = W;
  const oldH = H;

  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  CX = W / 2;
  CY = H * 0.45;


  const newSize = Math.min(W / 39, H / 45);

  if (particles.length && oldW && oldH) {
    const ratio = newSize / heartSize;
    heartSize = newSize;

    for (const p of particles) {
      for (const key of [
        "x", "y", "z",
        "tx", "ty", "tz",
        "fromX", "fromY", "fromZ"
      ]) {
        p[key] *= ratio;
      }

      p.vx *= ratio;
      p.vy *= ratio;
      p.vz *= ratio;
    }
  } else {
    heartSize = newSize;
    buildParticles();
  }
}


function changePhase(next) {
  phase = next;
  phaseTime = 0;

  if (next === "intro" || next === "reform") {
   


    particles.forEach(p => p.capturePosition());
  }

  if (next === "breaking") {
    hint.classList.remove("show");
    particles.forEach(p => p.explode());
  }

  if (next === "idle") {
    particles.forEach(p => {
      p.x = p.tx;
      p.y = p.ty;
      p.z = p.tz;
    });

    hint.classList.add("show");
  }
}

function breakHeart() {
  if (phase !== "idle") return;
  changePhase("breaking");
}

canvas.addEventListener("pointerdown", breakHeart);
window.addEventListener("resize", resize);


function animate(timestamp) {
  const dt = lastTime
    ? Math.min((timestamp - lastTime) / 1000, 0.033)
    : 0.016;

  lastTime = timestamp;
  time += dt;
  phaseTime += dt;

  if (phase === "dark" &&
      phaseTime >= DURATION.dark) {
    changePhase("intro");
  }

  if (phase === "intro" &&
      phaseTime >= DURATION.intro) {
    changePhase("idle");
  }

  if (phase === "breaking" &&
      phaseTime >= DURATION.breaking) {
    changePhase("reform");
  }

  if (phase === "reform" &&
      phaseTime >= DURATION.reform) {
    changePhase("idle");
  }

  ctx.clearRect(0, 0, W, H);

  if (phase !== "dark") {
    let rotation = 0;
    let pulse = 1;
    let alpha = 1;

    if (phase === "intro" || phase === "reform") {
      const progress = clamp(
        phaseTime / DURATION[phase]
      );

      
      rotation =
        TAU *
        SETTINGS.rotationTurns *
        ease(progress);

      if (phase === "intro") {
        alpha = easeOut(progress);
      }
    }

    if (phase === "idle") {
      rotation = 0;
      pulse = heartbeat(phaseTime);
    }

    if (phase === "breaking") {
      
      rotation = 0;
    }

    for (const p of particles) {
      p.update(dt);
      p.prepareDraw(rotation, pulse);
    }

 
    particles.sort((a, b) => b.depth - a.depth);

    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      p.draw(alpha);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  requestAnimationFrame(animate);
}


resize();
hint.classList.remove("show");
requestAnimationFrame(animate);
