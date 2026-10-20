const $ = (id) => document.getElementById(id);
let T,
  renderer,
  scene,
  camera,
  hero,
  road,
  items = [],
  decor = [],
  particles = [],
  fallback,
  finish,
  aura,
  powerRing;
const pools = {},
  particlePool = [];
let lastSafe = 0;
let lastPowerMarkup = "";
let ready = false;
let lastAction="Not started";
window.FingerDashDiagnostics=()=>({build:"2.7.0",ready,mode:renderer?"3D":"Lite",phase:state.phase,rawJams:state.jams,rewards:state.jamRewards,score:state.score,distance:Math.floor(state.distance),lives:state.lives,level:state.level,levelDistance:levelDistance(state.level),levelUnlocked:levelProgress.unlocked,levelCompleted:levelProgress.completed.slice(),levelTotal:levelProgress.total,mapsUnlocked:levelProgress.mapsUnlocked,highestCompleted:levelProgress.highestCompleted,map:currentMapIndex,mapName:MAPS[currentMapIndex-1]?.name||"",ammo:state.ammo,collectedBullets:state.collectedBullets,shotsFired:state.shotsFired,bulletHits:state.bulletHits,automaticPowers:settings.autoPowers,activePower:Object.values(state.powers).map(p=>({name:p.name,seconds:+p.remaining.toFixed(2)})),powerAwards:state.powerAwards,lifeAwards:state.lifeAwards,lastAction,boundary:!!boundaryGroup,boundaryParts:boundaryGroup?boundaryGroup.children.length:0,character:selectedCharacter,characterName:characterById(selectedCharacter).name,charactersUnlocked:unlockedCharacterIds(),characterNext:nextCharacterUnlock(levelProgress.highestCompleted+1)?.id||null,heroBodies:Object.keys(heroBodies).length});
let settings = {
  sound: true,
  vibration: false,
  quality: "auto",
  autoPowers: true,
};
let storageOK = true;
try {
  const saved = JSON.parse(
    localStorage.getItem("fingerDashSettings") || "null",
  );
  if (saved && typeof saved === "object") {
    settings.autoPowers = true; // Powers always activate automatically, including old saved manual settings.
    settings.sound = typeof saved.sound === "boolean" ? saved.sound : true;
    settings.vibration = saved.vibration === true;
    settings.quality = ["auto", "low", "high"].includes(saved.quality)
      ? saved.quality
      : "auto";
  }
} catch {
  storageOK = false;
}
function saveSettings() {
  try {
    localStorage.setItem("fingerDashSettings", JSON.stringify(settings));
  } catch {
    storageOK = false;
  }
}
function vibrate(pattern) {
  if (settings.vibration && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

const PROGRESSION = {
  powerEvery: 10,
  lifeEvery: 50,
  startingLives: 3,
  recoverySeconds: 2.2,
};
// Progression uses ONE consistent model. levelDistance(n) is the total
// distance milestone for level n (600, 1,000, 1,400, ... +400). A run starts
// at the previous milestone, so level 1 is 600 m and every later level adds
// exactly 400 m of new distance instead of repeating the whole campaign.
const LEVELS = {
  baseDistance: 600,
  step: 400,
  milestoneEvery: 5,
  maxMaps: 30,
  storageKey: "fingerDashLevels",
};
const levelDistance = (n) =>
  LEVELS.baseDistance + (Math.max(1, n | 0) - 1) * LEVELS.step;
const levelStartDistance = (n) => (n <= 1 ? 0 : levelDistance(n - 1));
const levelRunDistance = (n) => levelDistance(n) - levelStartDistance(n);
const isMilestoneLevel = (n) => n % LEVELS.milestoneEvery === 0;
// Map 1 covers levels 1-5, map 2 covers 6-10 ... map 30 covers 146-150.
// Completing level 5 unlocks map 2, and completing level 145 unlocks map 30,
// which then stays in use for every later level.
const mapForLevel = (n) =>
  Math.min(
    LEVELS.maxMaps,
    1 + Math.floor((Math.max(1, n | 0) - 1) / LEVELS.milestoneEvery),
  );
const firstLevelOfMap = (m) =>
  m <= 1 ? 1 : (m - 1) * LEVELS.milestoneEvery + 1;
// ---------------------------------------------------------------------------
// 30 map themes. Each map changes the sky, fog, lighting, ground, road, props
// and weather; gameplay geometry and collisions stay identical.
// ---------------------------------------------------------------------------
const MAPS = [
  {
    name: "Green Forest",
    sky: ["#8fe4ff", "#e2f8ce"], fog: ["#b7e6c8", 34, 118],
    ground: "#4a9548", road: ["#e9dcc2", "#ffffff", "#cbb68e"],
    hemi: ["#fff8e6", "#2f5d35", 1.7], sun: [0xfff2b8, 2.1],
    props: [{ k: "pine", n: 12, c: [0x6b4a2e, 0x2f6b3c, 0x3f8f45] }, { k: "rock", n: 4, c: [0x6f7f6a] }],
    disk: { c: 0xfff3b0, x: -38, y: 30, z: -104, s: 7 },
    weather: { k: "leaf", c: 0x9fe07a, n: 60, s: 0.17 },
  },
  {
    name: "Sandy Desert",
    sky: ["#ffd48a", "#fff3d6"], fog: ["#f0cf9a", 38, 126],
    ground: "#d8a95f", road: ["#f2e3c0", "#ffffff", "#d9c08a"],
    hemi: ["#fff0cf", "#8a5a2a", 1.75], sun: [0xffd88a, 2.3],
    props: [{ k: "cactus", n: 10, c: [0x3f7f4a] }, { k: "rock", n: 6, c: [0xc98f4e] }],
    disk: { c: 0xffe6a8, x: 40, y: 26, z: -104, s: 8 },
    weather: { k: "dust", c: 0xf3d9a4, n: 60, s: 0.14 },
  },
  {
    name: "Snowy Mountains",
    sky: ["#9fd3ff", "#f0faff"], fog: ["#dceef8", 30, 112],
    ground: "#e8f4fb", road: ["#f4f8fb", "#ffffff", "#cfe2ee"],
    hemi: ["#ffffff", "#7a9ab0", 1.8], sun: [0xffffff, 1.9],
    props: [{ k: "pine", n: 10, c: [0x5a4632, 0xdfeff5, 0xa9d4e8] }, { k: "spike", n: 5, c: [0xeaf7ff] }],
    disk: { c: 0xffffff, x: 36, y: 32, z: -104, s: 6 },
    weather: { k: "snow", c: 0xffffff, n: 120, s: 0.16 },
  },
  {
    name: "Night City", dark: 1,
    sky: ["#050a1f", "#1b2a57"], fog: ["#0b1430", 26, 100],
    ground: "#101828", road: ["#2a3346", "#9fb8d8", "#6b7f9a"],
    hemi: ["#8fa8d8", "#0a1020", 1.1], sun: [0xbcd0ff, 1.2],
    props: [{ k: "tower", n: 12, c: [0x2c3d63, 0xffe08a], s: [2.2, 4.6] }],
    disk: { c: 0xfff3c8, x: -44, y: 34, z: -104, s: 5 },
    weather: { k: "sparkle", c: 0x9fb8ff, n: 40, s: 0.12 },
    stars: 0xdfe8ff,
  },
  {
    name: "Tropical Beach",
    sky: ["#69d8ff", "#d9fbff"], fog: ["#bfeef2", 42, 130],
    ground: "#e7d3a0", road: ["#f4e6c4", "#ffffff", "#d9c28f"],
    hemi: ["#fff6dc", "#2f7a6a", 1.8], sun: [0xfff0c0, 2.2],
    props: [{ k: "palm", n: 10, c: [0x8a5a34, 0x2fa86b] }, { k: "rock", n: 3, c: [0xd8c39a] }],
    disk: { c: 0xfff6c8, x: 40, y: 30, z: -104, s: 8 },
    weather: { k: "bubble", c: 0xbfefff, n: 34, s: 0.12 },
  },
  {
    name: "Volcanic World", dark: 1,
    sky: ["#3a0f12", "#b8402a"], fog: ["#5a1a12", 24, 96],
    ground: "#46201c", road: ["#3a2420", "#ffb08a", "#7a3a2a"],
    hemi: ["#ff9a6a", "#2a0a08", 1.3], sun: [0xff7a4a, 1.6],
    props: [{ k: "volcano", n: 3, c: [0x4a2a24, 0xff5a2a], s: [2.2, 3.2] }, { k: "rock", n: 8, c: [0x5a3a32] }],
    weather: { k: "ember", c: 0xff7a3a, n: 80, s: 0.14 },
    special: "lava",
  },
  {
    name: "Futuristic Neon City", dark: 1,
    sky: ["#0a0524", "#3a1060"], fog: ["#1a0a38", 26, 104],
    ground: "#120b28", road: ["#232040", "#35f0ff", "#4a3a7a"],
    hemi: ["#b08aff", "#120820", 1.15], sun: [0x8fb8ff, 1.3],
    props: [{ k: "tower", n: 12, c: [0x35276a, 0x35f0ff], s: [2.4, 5.2], neon: true }],
    weather: { k: "rain", c: 0x9fd8ff, n: 100, s: 0.12 },
    stars: 0xbfa8ff,
  },
  {
    name: "Ancient Temple",
    sky: ["#7fd0c0", "#e8f2c0"], fog: ["#bfe0c8", 34, 120],
    ground: "#4e7a3a", road: ["#e8dcc0", "#ffffff", "#c9b48a"],
    hemi: ["#fff6d8", "#3a5a2a", 1.7], sun: [0xfff0b8, 2.0],
    props: [{ k: "pyramid", n: 4, c: [0x9a8a5f], s: [1.8, 2.6] }, { k: "pillar", n: 8, c: [0xa89a72] }],
    disk: { c: 0xfff6c0, x: 38, y: 30, z: -104, s: 7 },
    weather: { k: "dust", c: 0xe8d9a8, n: 46, s: 0.13 },
  },
  {
    name: "Jungle Ruins",
    sky: ["#2f6f55", "#a8d59a"], fog: ["#3f7a52", 22, 90],
    ground: "#2c5b32", road: ["#c8c0a0", "#ffffff", "#8a9a70"],
    hemi: ["#d8ffcf", "#1a3a20", 1.5], sun: [0xfff0b0, 1.5],
    props: [{ k: "pillar", n: 9, c: [0x8a9a70] }, { k: "leafTree", n: 9, c: [0x5a4028, 0x2f7a3a] }],
    weather: { k: "firefly", c: 0xd6ff7a, n: 50, s: 0.14 },
  },
  {
    name: "Candy World",
    sky: ["#ff9ad5", "#ffe7f6"], fog: ["#ffc2e2", 40, 128],
    ground: "#ffc9e6", road: ["#fff0f6", "#ffffff", "#ffb8d8"],
    hemi: ["#fff0ff", "#a85a8a", 1.8], sun: [0xfff0c8, 2.0],
    props: [{ k: "lollipop", n: 10, c: [0xff6fb5, 0x9be7ff] }, { k: "mushroom", n: 5, c: [0xff8fc7] }],
    disk: { c: 0xfff6c8, x: -38, y: 30, z: -104, s: 7 },
    weather: { k: "sparkle", c: 0xfff0a8, n: 60, s: 0.13 },
  },
  {
    name: "Underwater Tunnel", dark: 1,
    sky: ["#043a5a", "#0a7f9f"], fog: ["#075a7a", 14, 70],
    ground: "#0b4a5f", road: ["#0f5a70", "#8fe8ff", "#2a8aa0"],
    hemi: ["#8fe8ff", "#04202a", 1.4], sun: [0x9fe8ff, 1.3],
    props: [{ k: "coral", n: 12, c: [0xff8f6a, 0x6ae0d0] }, { k: "crystal", n: 6, c: [0x59d6ff] }],
    weather: { k: "bubble", c: 0xbfefff, n: 70, s: 0.14 },
  },
  {
    name: "Space Highway", dark: 1,
    sky: ["#000006", "#101a3a"], fog: ["#050818", 40, 140],
    ground: "#060a18", road: ["#2a2f45", "#8fd8ff", "#5a6a9a"],
    hemi: ["#8fa8ff", "#05060f", 0.9], sun: [0xbcd0ff, 1.4],
    props: [{ k: "rock", n: 9, c: [0x6a6f8a], s: [0.8, 2.2] }],
    weather: { k: "sparkle", c: 0xbfe0ff, n: 40, s: 0.1 },
    stars: 0xffffff, special: "planets",
  },
  {
    name: "Moon Surface", dark: 1,
    sky: ["#000005", "#0c1020"], fog: ["#080a12", 36, 130],
    ground: "#8b8b93", road: ["#c8c8cc", "#ffffff", "#9a9aa2"],
    hemi: ["#dfe4ff", "#2a2a30", 1.1], sun: [0xffffff, 1.8],
    props: [{ k: "rock", n: 12, c: [0x9a9aa2], s: [0.8, 2.0] }],
    disk: { c: 0x8fc8ff, x: 42, y: 36, z: -104, s: 6 },
    weather: { k: "dust", c: 0xcfcfd6, n: 30, s: 0.1 },
    stars: 0xffffff, special: "craters",
  },
  {
    name: "Crystal Cave", dark: 1,
    sky: ["#140a2e", "#2a1450"], fog: ["#1a0f38", 18, 82],
    ground: "#1a1030", road: ["#2a2048", "#b08aff", "#6a4aa0"],
    hemi: ["#b08aff", "#0a0618", 1.2], sun: [0x8f7aff, 1.1],
    props: [{ k: "crystal", n: 12, c: [0x8a5aff, 0x4ad8ff] }, { k: "rock", n: 5, c: [0x3a2a5a] }],
    weather: { k: "sparkle", c: 0xbfa8ff, n: 70, s: 0.14 },
  },
  {
    name: "Autumn Forest",
    sky: ["#ffd0a0", "#ffe8c8"], fog: ["#f0cfa8", 36, 124],
    ground: "#8a5a2a", road: ["#f0dcb8", "#ffffff", "#d0b080"],
    hemi: ["#ffe0b8", "#5a3a1a", 1.7], sun: [0xffd8a0, 2.1],
    props: [{ k: "leafTree", n: 12, c: [0x6b4426, 0xd46a2a, 0xe8a13a] }, { k: "rock", n: 3, c: [0x8a6a4a] }],
    disk: { c: 0xffe8b0, x: -40, y: 28, z: -104, s: 7 },
    weather: { k: "leaf", c: 0xe08a3a, n: 80, s: 0.17 },
  },
  {
    name: "Waterfall Valley",
    sky: ["#5fc8d8", "#d8fff8"], fog: ["#a8e8e0", 32, 118],
    ground: "#3a7a5a", road: ["#e8e0c8", "#ffffff", "#b8c8a0"],
    hemi: ["#e0fff8", "#2a5a4a", 1.6], sun: [0xffffff, 1.8],
    props: [{ k: "rock", n: 7, c: [0x5a7a6a] }, { k: "pine", n: 6, c: [0x4a3a28, 0x2f7a5a, 0x3f8a6a] }],
    weather: { k: "mist", c: 0xd8fff8, n: 60, s: 0.2 },
    special: "waterfall",
  },
  {
    name: "Cyberpunk Streets", dark: 1,
    sky: ["#12041f", "#4a0a5a"], fog: ["#22082e", 22, 92],
    ground: "#1a0a24", road: ["#2a1038", "#ff3ac8", "#6a2070"],
    hemi: ["#ff8ad8", "#120418", 1.2], sun: [0xff5ac8, 1.3],
    props: [{ k: "tower", n: 12, c: [0x3a1a54, 0xff5ad8], s: [2.4, 5.2], neon: true }, { k: "pipe", n: 4, c: [0x4a2a5a] }],
    weather: { k: "rain", c: 0xff8ad8, n: 100, s: 0.12 },
    stars: 0xffa8e8,
  },
  {
    name: "Frozen Ice World",
    sky: ["#0a2a4a", "#7fd8ff"], fog: ["#8fd8f0", 26, 104],
    ground: "#cfeeff", road: ["#eaf8ff", "#ffffff", "#a8d8f0"],
    hemi: ["#d8f8ff", "#2a5a7a", 1.7], sun: [0xd8f4ff, 1.9],
    props: [{ k: "spike", n: 12, c: [0xd8f6ff, 0x8fd8ff] }, { k: "pine", n: 5, c: [0x8a7a6a, 0xe8f8ff, 0xbfe8ff] }],
    weather: { k: "snow", c: 0xffffff, n: 100, s: 0.15 },
    stars: 0xd8f8ff, special: "aurora",
  },
  {
    name: "Ancient Egypt",
    sky: ["#ffcf7a", "#ffeccb"], fog: ["#f0d49a", 40, 128],
    ground: "#d8b76a", road: ["#f4e4bc", "#ffffff", "#d8bc82"],
    hemi: ["#fff0c8", "#8a5a2a", 1.8], sun: [0xffd88a, 2.3],
    props: [{ k: "pyramid", n: 4, c: [0xd8b76a], s: [2.6, 3.6] }, { k: "obelisk", n: 6, c: [0xe8cf8a] }],
    disk: { c: 0xffe8b0, x: 42, y: 30, z: -104, s: 8 },
    weather: { k: "dust", c: 0xe8d0a0, n: 50, s: 0.13 },
  },
  {
    name: "Cloud Kingdom",
    sky: ["#4ab8ff", "#e8f8ff"], fog: ["#cfefff", 48, 140],
    ground: "#bfe8ff", road: ["#ffffff", "#8fd8ff", "#d8f0ff"],
    hemi: ["#ffffff", "#7ab8d8", 1.9], sun: [0xffffff, 2.0],
    props: [{ k: "cloud", n: 12, c: [0xffffff] }, { k: "island", n: 5, c: [0x8ad8ff, 0xffffff] }],
    disk: { c: 0xfff6e0, x: -42, y: 32, z: -104, s: 7 },
    weather: { k: "sparkle", c: 0xffffff, n: 50, s: 0.14 },
    special: "floating",
  },
  {
    name: "Lava Caverns", dark: 1,
    sky: ["#1a0505", "#5a1a0a"], fog: ["#2a0a06", 16, 78],
    ground: "#2a0f0c", road: ["#3a1a14", "#ff9a5a", "#7a2a1a"],
    hemi: ["#ff7a4a", "#120404", 1.2], sun: [0xff6a3a, 1.4],
    props: [{ k: "spike", n: 12, c: [0x3a1a18, 0x7a2a20] }, { k: "rock", n: 5, c: [0x4a2a24] }],
    weather: { k: "ember", c: 0xff8a4a, n: 90, s: 0.14 },
    special: "lava",
  },
  {
    name: "Japanese Garden",
    sky: ["#ffd8e8", "#e8f8ff"], fog: ["#ffe0ee", 38, 126],
    ground: "#4a8a4a", road: ["#efe6cf", "#ffffff", "#cdbf9a"],
    hemi: ["#fff4f8", "#3a6a3a", 1.7], sun: [0xfff0d8, 2.0],
    props: [{ k: "torii", n: 4, c: [0xd84a3a] }, { k: "leafTree", n: 10, c: [0x5a3a28, 0xff9ac8] }],
    disk: { c: 0xffe8f0, x: 38, y: 28, z: -104, s: 6 },
    weather: { k: "leaf", c: 0xffb8d8, n: 70, s: 0.15 },
  },
  {
    name: "Dinosaur Valley",
    sky: ["#8ac88a", "#e8f2c0"], fog: ["#a8d0a0", 30, 116],
    ground: "#3f6a2a", road: ["#d8cfa8", "#ffffff", "#a8a070"],
    hemi: ["#e8ffd8", "#2a4a1a", 1.6], sun: [0xfff0b8, 1.8],
    props: [{ k: "palm", n: 8, c: [0x6a5a2a, 0x3f8a3a] }, { k: "bone", n: 5, c: [0xe8e0c8] }, { k: "volcano", n: 1, c: [0x4a3a2a, 0x8a3a2a], s: [2.4, 3.0] }],
    weather: { k: "mist", c: 0xd8f0c8, n: 50, s: 0.2 },
  },
  {
    name: "Rainbow Fantasy World",
    sky: ["#7ac8ff", "#ffe8f8"], fog: ["#d8e8ff", 44, 136],
    ground: "#8ad88a", road: ["#fff0f8", "#ffffff", "#e0b8d8"],
    hemi: ["#ffffff", "#6a8a6a", 1.8], sun: [0xffffff, 2.0],
    props: [{ k: "cloud", n: 7, c: [0xffffff] }, { k: "crystal", n: 7, c: [0xff7ac8, 0x7ad8ff] }],
    weather: { k: "sparkle", c: 0xfff0a0, n: 80, s: 0.14 },
    special: "rainbow",
  },
  {
    name: "Haunted Castle", dark: 1,
    sky: ["#0a0518", "#3a1a4a"], fog: ["#1a0a24", 18, 84],
    ground: "#241a2e", road: ["#3a2a44", "#9a8ab0", "#5a4a6a"],
    hemi: ["#9a8ab0", "#0a0512", 1.0], sun: [0xbfa8ff, 1.1],
    props: [{ k: "castle", n: 4, c: [0x2a2038], s: [2.0, 3.0] }, { k: "deadTree", n: 8, c: [0x3a2a2a] }],
    disk: { c: 0xcfd8ff, x: -44, y: 34, z: -104, s: 5 },
    weather: { k: "mist", c: 0x9a8ab0, n: 60, s: 0.22 },
    stars: 0xcfd8ff,
  },
  {
    name: "Robot Factory", dark: 1,
    sky: ["#201a1a", "#5a3a2a"], fog: ["#2a2020", 22, 94],
    ground: "#3a3a3a", road: ["#4a4a4e", "#ffa03a", "#7a7a80"],
    hemi: ["#ffb86a", "#1a1414", 1.2], sun: [0xffa860, 1.4],
    props: [{ k: "tower", n: 8, c: [0x6a7078, 0xffb35a], s: [2.4, 4.4] }, { k: "gear", n: 6, c: [0x7a8088] }, { k: "pipe", n: 5, c: [0x8a9098] }],
    weather: { k: "ember", c: 0xffc86a, n: 70, s: 0.12 },
    special: "lava",
  },
  {
    name: "Golden Desert City",
    sky: ["#ffb86a", "#ffe8b8"], fog: ["#f0c88a", 42, 132],
    ground: "#d8a85a", road: ["#f4e0b0", "#ffffff", "#d8b878"],
    hemi: ["#fff0c0", "#8a5a2a", 1.85], sun: [0xffcc7a, 2.3],
    props: [{ k: "dome", n: 9, c: [0xe8c46a, 0xfff0b0], s: [1.4, 2.2] }, { k: "obelisk", n: 4, c: [0xf0d490] }],
    disk: { c: 0xffe0a0, x: 44, y: 28, z: -104, s: 8 },
    weather: { k: "dust", c: 0xf0d090, n: 46, s: 0.13 },
  },
  {
    name: "Alien Planet", dark: 1,
    sky: ["#08102a", "#2a0a4a"], fog: ["#120a2a", 30, 112],
    ground: "#1a2038", road: ["#2a3048", "#7affc8", "#4a5a7a"],
    hemi: ["#7affc8", "#0a0a1a", 1.3], sun: [0xb06aff, 1.4],
    props: [{ k: "crystal", n: 9, c: [0x7affc8, 0xb06aff] }, { k: "mushroom", n: 9, c: [0x9a5aff] }],
    weather: { k: "bubble", c: 0xbfffe8, n: 60, s: 0.13 },
    stars: 0xbfffe8, special: "planets",
  },
  {
    name: "Magical Forest", dark: 1,
    sky: ["#0a2a2a", "#2a6a5a"], fog: ["#12403a", 24, 100],
    ground: "#1f4a3a", road: ["#2a4a40", "#8affd8", "#4a7a6a"],
    hemi: ["#8affd8", "#0a2018", 1.3], sun: [0x8affd8, 1.4],
    props: [{ k: "mushroom", n: 11, c: [0x8affd8] }, { k: "leafTree", n: 8, c: [0x4a3a58, 0x3ad8b8] }],
    weather: { k: "firefly", c: 0xc8ffe0, n: 80, s: 0.15 },
  },
  {
    name: "Ultimate Neon Galaxy", dark: 1,
    sky: ["#02000a", "#180a3a"], fog: ["#0a0420", 36, 136],
    ground: "#0a0620", road: ["#1a1030", "#ff4ad8", "#3a2a6a"],
    hemi: ["#ff4ad8", "#05020f", 1.1], sun: [0x4af0ff, 1.4],
    props: [{ k: "crystal", n: 8, c: [0xff4ad8, 0x4af0ff] }, { k: "rock", n: 5, c: [0x3a2a6a] }],
    weather: { k: "sparkle", c: 0xff8ae8, n: 80, s: 0.14 },
    stars: 0xffa8f0, special: "planets",
  },
];

let levelProgress = { unlocked: 1, completed: [], total: 0, mapsUnlocked: 1, highestCompleted: 0 };
let levelWindow = 0;
function progressFromCompleted(completed) {
  // Repairs corrupt saves: whole integers only, de-duplicated, sorted, and
  // contiguous from level 1. A gap means the levels after it were never
  // legitimately reached, so they are not trusted.
  const clean = [];
  const seen = new Set();
  for (const raw of completed) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1 || n > 9999 || seen.has(n)) continue;
    seen.add(n);
    clean.push(n);
  }
  clean.sort((a, b) => a - b);
  const sequential = [];
  for (const n of clean) {
    if (n === sequential.length + 1) sequential.push(n);
    else if (n > sequential.length + 1) break;
  }
  const highest = sequential.length ? sequential[sequential.length - 1] : 0;
  return {
    unlocked: highest + 1,
    completed: sequential,
    total: highest ? levelDistance(highest) : 0,
    highestCompleted: highest,
    // A map unlocks only after its milestone level is completed.
    mapsUnlocked: Math.min(
      LEVELS.maxMaps,
      1 + Math.floor(highest / LEVELS.milestoneEvery),
    ),
  };
}

// ------------------------------ runners ------------------------------
// Six runners share one rig: identical collider, speed, jump, powers and
// animations. Only the palette and a few decorative meshes differ, so the
// gameplay body can never change how a run plays.
// Unlocks are derived from the completed-level list that already drives
// checkpoints and maps — no second progression system to keep in sync.
const CHARACTERS = [
  {
    id: "original",
    name: "Original Runner",
    tag: "The classic finger",
    need: 0,
    deco: "",
    skin: 0xffb994, shade: 0xff8e81, nail: 0xffe4d4, band: 0xffc7a5,
    shoe: 0xffffff, eye: 0xffffff, pupil: 0x19384b, mouth: 0x803d51,
    aura: 0x8dffee,
    ui: { body: "#ffb994", shade: "#ff8e81", nail: "#ffe4d4", band: "#ffc7a5", shoe: "#ffffff", eye: "#ffffff", pupil: "#19384b", mouth: "#803d51", glow: "#8dffee", wash: "#eef7f6", ink: "#174051", edge: "#cfe7e6" },
  },
  {
    id: "shadow",
    name: "Shadow Runner",
    tag: "Violet in the dark",
    need: 25,
    deco: "spikes",
    skin: 0x3a2f55, shade: 0x221a38, nail: 0x8b5cf6, band: 0x51427a,
    shoe: 0x0f0b1a, eye: 0xffffff, pupil: 0x140a26, mouth: 0xb98bff,
    aura: 0xa77bff,
    ui: { body: "#3a2f55", shade: "#221a38", nail: "#8b5cf6", band: "#51427a", shoe: "#0f0b1a", eye: "#e9d8ff", pupil: "#1a0b30", mouth: "#a97bff", glow: "#a77bff", wash: "#f1ecff", ink: "#2a1f4d", edge: "#cdbcf5" },
  },
  {
    id: "cyber",
    name: "Cyber Runner",
    tag: "Neon circuitry",
    need: 50,
    deco: "circuit",
    skin: 0xa8c2d9, shade: 0x7b93a9, nail: 0x2ef2ff, band: 0xcfe3f2,
    shoe: 0x16283a, eye: 0xf2ffff, pupil: 0x04353f, mouth: 0x2ef2ff,
    aura: 0x2ef2ff,
    ui: { body: "#a8c2d9", shade: "#7b93a9", nail: "#2ef2ff", band: "#cfe3f2", shoe: "#16283a", eye: "#d6feff", pupil: "#046677", mouth: "#2ef2ff", glow: "#2ef2ff", wash: "#e4f4fd", ink: "#12303f", edge: "#8fc9dd" },
  },
  {
    id: "flame",
    name: "Flame Runner",
    tag: "Burning bright",
    need: 75,
    deco: "flames",
    skin: 0xf25c2a, shade: 0xbf2b10, nail: 0xffd05a, band: 0xff8a3d,
    shoe: 0x3a1206, eye: 0xffffff, pupil: 0x3d0b00, mouth: 0xffd05a,
    aura: 0xff8a3d,
    ui: { body: "#f25c2a", shade: "#bf2b10", nail: "#ffd05a", band: "#ff8a3d", shoe: "#3a1206", eye: "#fff6d0", pupil: "#7a1a00", mouth: "#ffd05a", glow: "#ffb347", wash: "#fff0e6", ink: "#5c1d08", edge: "#f6b48d" },
  },
  {
    id: "ice",
    name: "Ice Runner",
    tag: "Frost and crystal",
    need: 100,
    deco: "crystals",
    skin: 0xa2dcfb, shade: 0x74b2d9, nail: 0xffffff, band: 0xd9f2ff,
    shoe: 0x2f7fb5, eye: 0xffffff, pupil: 0x0d4d75, mouth: 0x6fc8f2,
    aura: 0xbff4ff,
    ui: { body: "#aee0fb", shade: "#7cb8dd", nail: "#ffffff", band: "#d9f2ff", shoe: "#2f7fb5", eye: "#ffffff", pupil: "#1b5f8f", mouth: "#6fc8f2", glow: "#bff4ff", wash: "#e3f4fe", ink: "#144460", edge: "#8ec9e8" },
  },
  {
    id: "galaxy",
    name: "Galaxy Runner",
    tag: "Stardust trail",
    need: 125,
    deco: "stars",
    skin: 0x2b1f5e, shade: 0x170f3c, nail: 0x9b8cff, band: 0x40318a,
    shoe: 0x0a0620, eye: 0xffffff, pupil: 0x1a1060, mouth: 0xb39bff,
    aura: 0x9f7bff,
    ui: { body: "#2b1f5e", shade: "#170f3c", nail: "#9b8cff", band: "#40318a", shoe: "#0a0620", eye: "#ffffff", pupil: "#6a4bff", mouth: "#b39bff", glow: "#9f7bff", wash: "#f0ecff", ink: "#211456", edge: "#c3b4ef" },
  },
];
let selectedCharacter = "original";
let pendingCharacter = "original";
let charAuraColor = CHARACTERS[0].aura;
let heroBody = null;
let heroBodies = {};
let heroEyes = [];
let heroDecor = [];
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewModels = {};
let previewActive = false;
function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
function characterUnlocked(c) {
  c = typeof c === "string" ? characterById(c) : c;
  // "Completed", not "reached": levelProgress.completed only ever holds levels
  // that were actually cleared, so reaching 25 never unlocks anything.
  return c.need === 0 || levelProgress.completed.includes(c.need);
}
function unlockedCharacterIds() {
  return CHARACTERS.filter(characterUnlocked).map((c) => c.id);
}
function nextCharacterUnlock(level) {
  return CHARACTERS.find((c) => c.need === level) || null;
}
function charactersForSheet() {
  return CHARACTERS.map((c) => ({
    id: c.id,
    name: c.name,
    need: c.need,
    unlocked: characterUnlocked(c),
    selected: c.id === selectedCharacter,
  }));
}
try {
  const raw = JSON.parse(localStorage.getItem(LEVELS.storageKey) || "null");
  if (raw && typeof raw === "object") {
    levelProgress = progressFromCompleted(
      Array.isArray(raw.completed) ? raw.completed : [],
    );
    // Restore the chosen runner only if it is a real id that is still
    // unlocked by the saved level progress (tampered saves fall back safely).
    if (typeof raw.character === "string") {
      const saved = characterById(raw.character);
      if (saved.id === raw.character && characterUnlocked(saved))
        selectedCharacter = saved.id;
    }
  }
} catch {}
pendingCharacter = selectedCharacter;
charAuraColor = characterById(selectedCharacter).aura;
function saveLevelProgress() {
  try {
    localStorage.setItem(
      LEVELS.storageKey,
      JSON.stringify({
        v: 2,
        ...levelProgress,
        character: selectedCharacter,
        // Informational; unlocks are always re-derived from `completed`.
        unlockedChars: unlockedCharacterIds(),
      }),
    );
  } catch {}
}
function completeLevel(n) {
  n = Math.floor(Number(n)) || 0;
  // Only the current frontier can be completed, and only once: this is what
  // makes checkpoint saves idempotent and blocks level skipping.
  if (n !== levelProgress.unlocked || levelProgress.completed.includes(n))
    return false;
  levelProgress.completed.push(n);
  levelProgress.unlocked = n + 1;
  levelProgress.total = levelDistance(n);
  levelProgress.highestCompleted = n;
  levelProgress.mapsUnlocked = Math.min(
    LEVELS.maxMaps,
    1 + Math.floor(n / LEVELS.milestoneEvery),
  );
  saveLevelProgress();
  return true;
}
function resetLevelProgress() {
  levelProgress = { unlocked: 1, completed: [], total: 0, mapsUnlocked: 1, highestCompleted: 0 };
  levelWindow = 0;
  applyCharacter("original");
  saveLevelProgress();
}
const state = {
  phase: "menu",
  mode: "endless",
  // Resume on the level the player should play next (highest unlocked).
  level: levelProgress.unlocked,
  distance: 0,
  score: 0,
  lane: 0,
  x: 0,
  speed: 14,
  growth: 0,
  time: 0,
  spawn: 26,
  best: 0,
  jams: 0,
  collectedJams: 0,
  jamRewards: 0,
  ammo: 0,
  collectedBullets: 0,
  shotsFired: 0,
  bulletHits: 0,
  hitFlash: 0,
  nextPowerMilestone: PROGRESSION.powerEvery,
  nextLifeMilestone: PROGRESSION.lifeEvery,
  lives: PROGRESSION.startingLives,
  y: 0,
  vy: 0,
  jumpsUsed: 0,
  extraJumps: 0,
  landing: 0,
  recovery: 0,
  worldSpeed: 14,
  worldTime: 0,
  powers: {},
  readyPowers: [],
  milestones: new Set(),
  lifeMilestones: new Set(),
  powerAwards: 0,
  lifeAwards: 0,
};
try {
  state.best = Math.max(
    0,
    Math.min(999999999, Number(localStorage.getItem("fingerDashBest")) || 0),
  );
} catch {}
$("best").textContent = state.best;
let muted = !settings.sound,
  audio;
function beep(freq = 650, duration = 0.09) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    let o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.5,
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(0.06, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}

// All run timers use dt from the one existing animation loop, never setInterval.
const POWER_DEFS = [
  { id: "slow", name: "Slow Motion", duration: 5, color: 0x9ceaff },
  { id: "shield", name: "Shield", duration: 5, color: 0x73ffdd },
  { id: "jumpBoost", name: "Super Jump", duration: 5, color: 0xbba1ff },
  { id: "magnet", name: "Magnet", duration: 5, color: 0xff80cf },
  { id: "freeze", name: "Time Freeze", duration: 3, color: 0xd7ffff },
  { id: "double", name: "Double Jam", duration: 5, color: 0xafff67 },
  { id: "speed", name: "Speed Boost", duration: 5, color: 0xffa953 },
  { id: "invincible", name: "Invincibility", duration: 4, color: 0xffed67 },
  { id: "extraJump", name: "Air Jump", duration: 5, color: 0xa5b4ff },
  { id: "multiplier", name: "Score Multiplier", duration: 5, color: 0xffc1e0 },
];
let gesture = null,
  lastLaneInput = -Infinity,
  noticeQueue = [],
  noticeRemaining = 0;
const active = (id) => (state.powers[id]?.remaining || 0) > 0;
function resetRunSystems() {
  Object.assign(state, {
    jams: 0,
    collectedJams: 0,
    jamRewards: 0,
    ammo: 0,
    collectedBullets: 0,
    shotsFired: 0,
    bulletHits: 0,
    hitFlash: 0,
    nextPowerMilestone: PROGRESSION.powerEvery,
    nextLifeMilestone: PROGRESSION.lifeEvery,
    lives: PROGRESSION.startingLives,
    y: 0,
    vy: 0,
    jumpsUsed: 0,
    extraJumps: 0,
    landing: 0,
    recovery: 0,
    worldSpeed: 14,
    worldTime: 0,
    powers: {},
    readyPowers: [],
    milestones: new Set(),
    lifeMilestones: new Set(),
    powerAwards: 0,
    lifeAwards: 0,
  });
  gesture = null;
  lastLaneInput = -Infinity;
  lastShotAt = -Infinity;
  noticeQueue = [];
  noticeRemaining = 0;
  $("unlockNotice").hidden = true;
}
function announce(text, priority = false) {
  if (priority) {
    noticeQueue.unshift(text);
    noticeRemaining = 0;
    showNextNotice();
    return;
  }
  noticeQueue.push(text);
  if (!noticeRemaining) showNextNotice();
}
function showNextNotice() {
  let text = noticeQueue.shift();
  if (!text) {
    noticeRemaining = 0;
    $("unlockNotice").hidden = true;
    return;
  }
  let el = $("unlockNotice");
  el.textContent = text;
  el.hidden = false;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  noticeRemaining = 1.8;
}
function awardMilestones() {
  // Scan only the next crossed milestone; sets are a defensive once-only guard.
  while (state.nextPowerMilestone <= state.jams) {
    const m = state.nextPowerMilestone;
    state.nextPowerMilestone += PROGRESSION.powerEvery;
    if (state.milestones.has(m)) continue;
    state.milestones.add(m);
    state.powerAwards++;
    const index = m / PROGRESSION.powerEvery - 1,
      def = POWER_DEFS[index % POWER_DEFS.length];
    grantTimedPower({ ...def, milestone: m, multiplier: 2 });
  }
  while (state.nextLifeMilestone <= state.jams) {
    const m = state.nextLifeMilestone;
    state.nextLifeMilestone += PROGRESSION.lifeEvery;
    if (state.lifeMilestones.has(m)) continue;
    state.lifeMilestones.add(m);
    state.lives++;
    state.lifeAwards++;
    announce(`${m} JAMS · +1 EXTRA LIFE ♥`);
  }
}
function grantTimedPower(p) {
  applyPower(p, true);
}
function applyPower(p, automatic = false) {
  // New power replaces the previous power, preventing incompatible overlap.
  lastAction="Power: "+p.name;
  state.powers = {};
  state.extraJumps = p.id === "extraJump" ? 1 : 0;
  state.powers[p.id] = {
    ...p,
    remaining: p.duration,
    multiplier: p.multiplier || 2,
  };
  beep(1100, 0.12);
  updateUI();
  return true;
}
function activatePower() {
  if (state.phase !== "playing" || !state.readyPowers.length) return false;
  return applyPower(state.readyPowers.shift());
}
function jump() {
  lastAction="JUMP input";
  if (state.phase !== "playing") return false;
  if (state.y > 0 && state.jumpsUsed >= 1 + state.extraJumps) return false;
  state.jumpsUsed = state.y <= 0 ? 1 : state.jumpsUsed + 1;
  state.vy = active("jumpBoost") ? 12.4 : 9.6;
  state.y = Math.max(0.001, state.y);
  state.landing = 0;
  beep(480, 0.06);
  updateControls();
  return true;
}
function tickRunSystems(dt) {
  for (const [id, p] of Object.entries(state.powers)) {
    p.remaining = Math.max(0, p.remaining - dt);
    if (p.remaining === 0) delete state.powers[id];
  }
  if (
    settings.autoPowers &&
    !Object.keys(state.powers).length &&
    state.readyPowers.length
  )
    applyPower(state.readyPowers.shift(), true);
  state.extraJumps = active("extraJump") ? 1 : 0;
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.recovery = Math.max(0, state.recovery - dt);
  state.landing = Math.max(0, state.landing - dt);
  if (state.y > 0 || state.vy > 0) {
    state.vy -= 24 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
      state.jumpsUsed = 0;
      state.landing = 0.16;
    }
  }
  if (noticeRemaining > 0) {
    noticeRemaining -= dt;
    if (noticeRemaining <= 0) showNextNotice();
  }
}
function updateControls() {
  const playing = state.phase === "playing";
  $("left").disabled = !playing;
  $("right").disabled = !playing;
  $("jump").disabled =
    !playing || (state.y > 0 && state.jumpsUsed >= 1 + state.extraJumps);
  $("power").disabled = !playing || !state.readyPowers.length;
  const next = state.readyPowers[0];
  $("powerLabel").textContent = settings.autoPowers ? "AUTO" : "POWER";
  $("power").title = settings.autoPowers
    ? "Powers start automatically at every 10 Jams."
    : "Tap to activate the next earned power";
  $("powerReady").textContent = next
    ? `${next.name} · ${state.readyPowers.length} READY`
    : `${settings.autoPowers ? "ON · " : ""}${PROGRESSION.powerEvery - (state.jams % PROGRESSION.powerEvery)} JAMS TO NEXT POWER`;
  $("jumpStatus").textContent =
    state.y > 0
      ? `${Math.max(0, 1 + state.extraJumps - state.jumpsUsed)} AIR JUMPS`
      : state.extraJumps
        ? `JUMP + ${state.extraJumps} EXTRA`
        : "JUMP READY";
  $("ammo").textContent = state.ammo;
  $("shootAmmo").textContent = `${state.ammo} AMMO`;
  $("shoot").disabled = !playing || state.ammo <= 0;
  $("shoot").classList.toggle(
    "hasTarget",
    playing && state.ammo > 0 && !!shootTarget(),
  );
}
function damage(i) {
  if (i.hit || state.phase !== "playing") return;
  if (state.recovery > 0 || active("invincible")) {
    i.hit = true;
    return;
  }
  if (active("shield")) {
    i.hit = true;
    delete state.powers.shield;
    // Shield absorbs silently; no power-name caption.
    beep(700, 0.08);
    updateUI();
    return;
  }
  i.hit = true;
  if (state.lives > 0) {
    // Hearts are remaining lives: the last consumed heart ends the run.
    if (state.lives === 1) {
      state.lives = 0;
      state.hitFlash = 0.4;
      end(false);
      return;
    }
    state.lives--;
    state.recovery = PROGRESSION.recoverySeconds;
    state.hitFlash = 0.4;
    state.y = 0;
    state.vy = 0;
    state.jumpsUsed = 0;
    state.landing = 0.16;
    // Clear the immediate danger zone in ALL lanes before any later collision.
    for (const other of items)
      if (
        !["gem", "gate", "bullet"].includes(other.type) &&
        other.d > state.distance - 3 &&
        other.d < state.distance + 22
      )
        other.hit = true;
    const lanes = [-1, 0, 1];
    lanes.sort(
      (a, b) =>
        items.filter(
          (t) =>
            !t.hit &&
            !["gem", "gate", "bullet"].includes(t.type) &&
            t.lane === a &&
            t.d > state.distance &&
            t.d < state.distance + 40,
        ).length -
          items.filter(
            (t) =>
              !t.hit &&
              !["gem", "gate", "bullet"].includes(t.type) &&
              t.lane === b &&
              t.d > state.distance &&
              t.d < state.distance + 40,
          ).length || Math.abs(a) - Math.abs(b),
    );
    state.lane = lanes[0];
    state.x = state.lane * 2.4;
    gesture = null;
    announce(`LIFE LOST ♥ · ${state.lives} remaining · Recovery`, true);
    vibrate([30, 40, 30]);
    beep(320, 0.14);
    updateUI();
    return;
  }
  end(false);
}

const colors = {
  gem: 0xafff67,
  block: 0xff6e80,
  gap: 0x146b8a,
  gate: 0x8d78ff,
  rotor: 0xff9d45,
  slider: 0x40a7ff,
  // Jump-proof obstacle family. Each type has a distinct silhouette so the
  // required avoidance (lane change vs. staying low) is readable at speed.
  barrier: 0xff4f6d,
  antiJump: 0x9b5cff,
  heavy: 0x596273,
  laser: 0xff2e63,
  bullet: 0x54e0ff,
};
function mat(c) {
  return new T.MeshStandardMaterial({ color: c, roughness: 0.65 });
}
let mats = {},
  geo = {};
function mesh(g, c, parent, x = 0, y = 0, z = 0) {
  let m = new T.Mesh(g, (mats[c] ??= mat(c)));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(parent, c, x, y, z, w, h, d) {
  return mesh(new T.BoxGeometry(w, h, d), c, parent, x, y, z);
}
function face(parent, y, z, scale = 1, c = null) {
  // Returns the eye meshes so the blink animation works no matter how deep
  // the face sits inside a character rig.
  const eyes = [];
  for (let x of [-0.23, 0.23]) {
    let e = mesh(geo.eye, c ? c.eye : 0xffffff, parent, x * scale, y, z);
    e.scale.setScalar(scale);
    let p = mesh(
      geo.pupil,
      c ? c.pupil : 0x19384b,
      parent,
      x * scale,
      y,
      z + 0.07 * scale,
    );
    p.scale.setScalar(scale);
    eyes.push(e, p);
  }
  let smile = mesh(
    new T.TorusGeometry(0.16 * scale, 0.035 * scale, 6, 16, Math.PI),
    c ? c.mouth : 0x803d51,
    parent,
    0,
    y - 0.25 * scale,
    z,
  );
  smile.rotation.z = Math.PI;
  return eyes;
}
// One shared body rig per runner. Same capsule, same proportions, same
// origin as the original finger — only colours and small ornaments differ.
function buildHeroBody(c, parent) {
  const g = new T.Group();
  g.name = "runner-" + c.id;
  const neon = c.id !== "original";
  const part = (geometry, color, x, y, z, glow = 0) => {
    const m = new T.Mesh(
      geometry,
      glow ? glowMat(color, glow) : (mats[color] ??= mat(color)),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const block = (color, x, y, z, w, h, d) =>
    part(new T.BoxGeometry(w, h, d), color, x, y, z);
  // Body + nail: identical silhouette to v2.7.0 so the hitbox is untouched.
  // A faint self-glow keeps each runner's colour readable on every map theme
  // (warm Candy World light used to wash pale runners out to beige).
  part(new T.CapsuleGeometry(0.47, 1.5, 6, 16), c.skin, 0, 1.22, 0, neon ? 0.16 : 0);
  const nail = part(
    new T.SphereGeometry(1, 16, 12),
    c.nail,
    0,
    1.82,
    0.405,
    neon ? 0.75 : 0,
  );
  nail.scale.set(0.32, 0.4, 0.09);
  const eyes = face(g, 1, 0.46, 1, c);
  block(c.shade, 0, 0.22, 0, 1.12, 0.3, 0.85); // palm
  const palm = part(new T.SphereGeometry(1, 16, 10), c.skin, 0, 0.37, 0.04);
  palm.scale.set(0.68, 0.31, 0.5);
  for (let j = 0; j < 3; j++) {
    const knuckle = part(
      new T.CapsuleGeometry(0.13, 0.22, 3, 8),
      c.band,
      -0.38 + j * 0.28,
      0.37,
      0.46,
    );
    knuckle.rotation.x = Math.PI / 2;
  }
  const thumb = part(
    new T.CapsuleGeometry(0.16, 0.35, 4, 10),
    c.skin,
    0.57,
    0.55,
    0.12,
  );
  thumb.rotation.z = -0.7;
  for (const side of [-1, 1]) {
    const shoe = part(
      new T.SphereGeometry(0.23, 12, 8),
      c.shoe,
      side * 0.32,
      0.12,
      0.15,
    );
    shoe.scale.set(1, 0.55, 1.4);
  }
  const decor = [];
  // Ornaments live above the face (y > 1.3) or outside the body silhouette so
  // they never cover the eyes/smile or read as part of the hitbox.
  if (c.deco === "spikes") {
    for (const side of [-1, 1]) {
      const spike = part(
        new T.ConeGeometry(0.13, 0.46, 6),
        c.nail,
        side * 0.3,
        2.3,
        0.02,
        0.85,
      );
      spike.rotation.z = -side * 0.42;
      decor.push(spike);
    }
    const halo = part(new T.TorusGeometry(0.5, 0.03, 6, 22), c.nail, 0, 2.05, 0, 0.9);
    halo.rotation.x = Math.PI / 2;
    decor.push(halo);
  } else if (c.deco === "circuit") {
    part(new T.CylinderGeometry(0.035, 0.035, 0.3, 6), c.shade, 0, 2.55, 0);
    const bulb = part(new T.SphereGeometry(0.12, 10, 8), c.nail, 0, 2.74, 0, 1.4);
    bulb.userData.spin = true;
    decor.push(bulb);
    for (const side of [-1, 1]) {
      const ear = part(
        new T.CylinderGeometry(0.1, 0.1, 0.06, 12),
        c.nail,
        side * 0.5,
        1.52,
        0,
        1.1,
      );
      ear.rotation.z = Math.PI / 2;
      decor.push(ear);
    }
    const crown = part(new T.TorusGeometry(0.56, 0.025, 6, 22), c.nail, 0, 2.06, 0, 0.9);
    crown.rotation.x = Math.PI / 2;
    decor.push(crown);
  } else if (c.deco === "flames") {
    const flames = [
      [-0.21, 2.24, 0.46],
      [0.02, 2.3, 0.66],
      [0.24, 2.22, 0.4],
    ];
    for (const [x, base, h] of flames) {
      const f = part(
        new T.ConeGeometry(h * 0.22, h, 6),
        c.nail,
        x,
        base + h * 0.5,
        -0.02,
        0.95,
      );
      f.rotation.z = x * 0.55;
      f.userData.spin = true;
      decor.push(f);
    }
  } else if (c.deco === "crystals") {
    const spots = [
      [-0.5, 1.78, -0.05, 0.26],
      [0.5, 1.62, 0.0, 0.22],
      [0.02, 2.62, 0.0, 0.24],
    ];
    for (const [x, y, z, s] of spots) {
      const crystal = part(new T.OctahedronGeometry(s, 0), c.nail, x, y, z, 0.5);
      crystal.rotation.z = x * 0.9;
      crystal.rotation.y = x;
      decor.push(crystal);
    }
  } else if (c.deco === "stars") {
    const dots = [
      [-0.3, 1.96, 0.34, 0.055],
      [0.31, 1.8, 0.33, 0.045],
      [0.06, 1.55, 0.46, 0.04],
      [-0.36, 1.42, 0.28, 0.035],
    ];
    for (const [x, y, z, s] of dots)
      decor.push(part(new T.SphereGeometry(s, 8, 6), 0xffffff, x, y, z, 1.8));
    const ring = part(new T.TorusGeometry(0.62, 0.03, 6, 26), c.nail, 0, 2.02, 0, 0.9);
    ring.rotation.x = Math.PI / 2 - 0.5;
    ring.userData.spin = true;
    decor.push(ring);
  }
  g.userData.eyes = eyes;
  g.userData.decor = decor;
  parent.add(g);
  return g;
}
function applyCharacter(id) {
  const c = characterById(id);
  if (!characterUnlocked(c)) return false;
  selectedCharacter = c.id;
  pendingCharacter = c.id;
  charAuraColor = c.aura;
  if (hero) {
    if (!heroBodies[c.id]) heroBodies[c.id] = buildHeroBody(c, hero);
    for (const key of Object.keys(heroBodies))
      heroBodies[key].visible = key === c.id;
    heroBody = heroBodies[c.id];
    heroEyes = heroBody.userData.eyes;
    heroDecor = heroBody.userData.decor;
  }
  if (aura) aura.material.color.setHex(c.aura);
  saveLevelProgress();
  syncCharacterChip();
  renderCharacters();
  return true;
}

// ------------------------------ map renderer ------------------------------
const mapGeo = {},
  mapMatCache = new Map();
let currentMapIndex = 0,
  hemiLight,
  sunLight,
  groundMesh,
  skyMesh,
  skyTexture,
  starField,
  weatherMesh,
  weatherPos,
  weatherSeed = [],
  weatherCfg = null,
  bgGroup,
  scenery = [],
  roadSlab,
  roadEdges = [],
  roadDashes = [];
// Track boundaries: a kerb + safety railing along both outer edges of the road.
// The kerb's inner face starts exactly at the road slab edge (3.6 m) so there
// is no seam, and every playable lane (±2.4 m) stays well inside it.
const BOUNDARY = {
  halfRoad: 3.6,
  laneX: 2.4,
  kerbW: 0.46,
  kerbH: 0.28,
  kerbEmbed: 0.06, // sinks into the slab edge so the two surfaces meet with no seam
  kerbX: 3.83, // halfRoad + kerbW / 2
  railX: 3.99,
  railTop: 1.22,
  spanZ: 112,
  centreZ: -43,
  postStep: 6,
  postW: 0.17,
};
let boundaryGroup = null,
  boundaryCurbs = [],
  boundaryTopRails = [],
  boundaryMidRails = [],
  boundaryPosts = [];
function mg(key, make) {
  return mapGeo[key] || (mapGeo[key] = make());
}
function colorMat(c) {
  return (mats[c] ??= mat(c));
}
function glowMat(c, k = 1.2) {
  const key = "glow:" + c + ":" + k;
  if (!mapMatCache.has(key))
    mapMatCache.set(
      key,
      new T.MeshStandardMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: k,
        roughness: 0.4,
      }),
    );
  return mapMatCache.get(key);
}
function mp(parent, key, make, color, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, glow = 0) {
  const m = new T.Mesh(mg(key, make), glow ? glowMat(color, glow) : colorMat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = ry;
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}
const G = {
  box: () => new T.BoxGeometry(1, 1, 1),
  cyl: () => new T.CylinderGeometry(1, 1, 1, 7),
  cyl4: () => new T.CylinderGeometry(0.82, 1, 1, 4),
  cone: () => new T.ConeGeometry(1, 1, 7),
  cone4: () => new T.ConeGeometry(1, 1, 4),
  sph: () => new T.SphereGeometry(1, 10, 8),
  semi: () => new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  ico: () => new T.IcosahedronGeometry(1, 0),
  oct: () => new T.OctahedronGeometry(1, 0),
  torus: () => new T.TorusGeometry(1, 0.24, 6, 18),
  plane: () => new T.PlaneGeometry(1, 1),
};
function buildProp(kind, c, r) {
  const g = new T.Group(),
    a = c[0] ?? 0x888888,
    b = c[1] ?? a,
    d = c[2] ?? b;
  if (kind === "pine") {
    mp(g, "cyl", G.cyl, 0x6b4a2e, 0, 0.4, 0, 0.12, 0.8, 0.12);
    mp(g, "cone", G.cone, a, 0, 1.15, 0, 0.98, 1.4, 0.98);
    mp(g, "cone", G.cone, b, 0, 1.95, 0, 0.74, 1.15, 0.74);
    mp(g, "cone", G.cone, d, 0, 2.65, 0, 0.5, 0.85, 0.5);
  } else if (kind === "leafTree") {
    mp(g, "cyl", G.cyl, a, 0, 0.7, 0, 0.14, 1.4, 0.14);
    mp(g, "sph", G.sph, b, 0, 1.9, 0, 1.05, 0.9, 1.05);
    mp(g, "sph", G.sph, d, 0.62, 1.6, 0.18, 0.62, 0.58, 0.62);
  } else if (kind === "palm") {
    for (let i = 0; i < 3; i++)
      mp(g, "cyl", G.cyl, c[0], 0.05 * i, 0.45 + i * 0.62, 0, 0.14, 0.68, 0.14, 0.1 * i);
    for (let i = 0; i < 7; i++) {
      const frond = mp(g, "box", G.box, i % 2 ? b : d, 0, 2.25, 0, 1.7, 0.07, 0.42, (i / 7) * Math.PI * 2);
      frond.rotation.z = 0.18;
    }
    mp(g, "sph", G.sph, 0x6b4a2e, 0.16, 2.1, 0.1, 0.1, 0.1, 0.1);
    mp(g, "sph", G.sph, 0x6b4a2e, -0.14, 2.06, -0.12, 0.09, 0.09, 0.09);
  } else if (kind === "cactus") {
    mp(g, "cyl", G.cyl, a, 0, 0.85, 0, 0.3, 1.7, 0.3);
    mp(g, "cyl", G.cyl, a, 0.4, 1.05, 0, 0.13, 0.55, 0.13, 0, 0);
    mp(g, "cyl", G.cyl, a, 0.4, 1.35, 0, 0.13, 0.45, 0.13);
    mp(g, "cyl", G.cyl, a, -0.36, 0.78, 0, 0.12, 0.45, 0.12);
    mp(g, "cyl", G.cyl, a, -0.36, 1.02, 0, 0.12, 0.35, 0.12);
  } else if (kind === "rock") {
    mp(g, "ico", G.ico, a, 0, 0.5, 0, 0.95, 0.72, 0.85);
    mp(g, "ico", G.ico, b, 0.75, 0.22, 0.2, 0.4, 0.3, 0.38);
  } else if (kind === "crystal") {
    mp(g, "oct", G.oct, a, 0, 1.15, 0, 0.42, 1.15, 0.42, 0, 0.8);
    mp(g, "oct", G.oct, b, 0.5, 0.75, 0.1, 0.26, 0.75, 0.26, 0.3, 0.8);
    mp(g, "oct", G.oct, a, -0.45, 0.6, -0.1, 0.22, 0.6, 0.22, -0.3, 0.8);
  } else if (kind === "tower") {
    const h = 3.2;
    mp(g, "box", G.box, a, 0, h / 2, 0, 1, h, 1);
    const win = b;
    for (let i = 0; i < 3; i++)
      for (const wx of [-0.24, 0.24])
        mp(g, "box", G.box, win, wx, 0.85 + i * 0.78, 0.51, 0.3, 0.26, 0.03, 0, 2.2);
    if (c[1] !== undefined && c[1] !== a)
      mp(g, "cyl", G.cyl, win, 0, h + 0.25, 0, 0.04, 0.5, 0.04, 0, 1.8);
  } else if (kind === "pyramid") {
    mp(g, "cone4", G.cone4, a, 0, 1.5, 0, 2.2, 3, 2.2, Math.PI / 4);
    mp(g, "box", G.box, a, 0, 0.15, 0, 3.1, 0.3, 3.1);
  } else if (kind === "pillar") {
    mp(g, "box", G.box, a, 0, 0.14, 0, 1.15, 0.28, 1.15);
    const broken = r() < 0.35;
    mp(g, "cyl", G.cyl, a, 0, broken ? 0.78 : 1.35, 0, 0.36, broken ? 1.05 : 2.2, 0.36);
    if (!broken) mp(g, "box", G.box, a, 0, 2.55, 0, 1.05, 0.26, 1.05);
  } else if (kind === "torii") {
    mp(g, "cyl", G.cyl, a, -0.95, 1.3, 0, 0.16, 2.6, 0.16);
    mp(g, "cyl", G.cyl, a, 0.95, 1.3, 0, 0.16, 2.6, 0.16);
    mp(g, "box", G.box, 0x2a2228, 0, 2.72, 0, 2.7, 0.26, 0.34);
    mp(g, "box", G.box, a, 0, 2.25, 0, 2.15, 0.18, 0.28);
  } else if (kind === "mushroom") {
    mp(g, "cyl", G.cyl, 0xf4e8d8, 0, 0.4, 0, 0.15, 0.8, 0.15);
    mp(g, "semi", G.semi, a, 0, 0.75, 0, 0.55, 0.42, 0.55);
    mp(g, "sph", G.sph, 0xffffff, 0.2, 0.95, 0.12, 0.07, 0.05, 0.07);
    mp(g, "sph", G.sph, 0xffffff, -0.24, 0.98, -0.1, 0.06, 0.04, 0.06);
  } else if (kind === "lollipop") {
    mp(g, "cyl", G.cyl, 0xf4f0e8, 0, 0.75, 0, 0.07, 1.5, 0.07);
    mp(g, "cyl", G.cyl, a, 0, 1.62, 0, 0.6, 0.12, 0.6);
    mp(g, "cyl", G.cyl, b, 0, 1.72, 0, 0.42, 0.1, 0.42);
    mp(g, "cyl", G.cyl, a, 0, 1.8, 0, 0.22, 0.08, 0.22);
  } else if (kind === "dome") {
    mp(g, "box", G.box, a, 0, 0.45, 0, 1.5, 0.9, 1.5);
    mp(g, "semi", G.semi, b, 0, 0.9, 0, 0.78, 0.72, 0.78);
    mp(g, "cone", G.cone, 0xffe6a0, 0, 1.75, 0, 0.1, 0.35, 0.1, 0, 1.4);
  } else if (kind === "gear") {
    mp(g, "torus", G.torus, a, 0, 1.1, 0, 0.62, 0.62, 0.62);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      mp(g, "box", G.box, a, Math.cos(t) * 0.78, 1.1 + Math.sin(t) * 0.78, 0, 0.2, 0.2, 0.18, t);
    }
    mp(g, "box", G.box, 0x3a3a3e, 0, 0.25, 0, 0.5, 0.5, 0.5);
  } else if (kind === "cloud") {
    mp(g, "sph", G.sph, a, 0, 1.1, 0, 1.1, 0.62, 0.9);
    mp(g, "sph", G.sph, b, 0.85, 1.0, 0.1, 0.7, 0.45, 0.65);
    mp(g, "sph", G.sph, a, -0.8, 0.95, -0.1, 0.62, 0.4, 0.6);
  } else if (kind === "island") {
    const inv = mp(g, "cone", G.cone, a, 0, 0.6, 0, 1.25, 1.3, 1.25);
    inv.rotation.z = Math.PI;
    mp(g, "cyl", G.cyl, b, 0, 1.3, 0, 1.28, 0.18, 1.28);
    mp(g, "sph", G.sph, 0x8ad8ff, 0.4, 1.5, 0.2, 0.22, 0.3, 0.22);
  } else if (kind === "volcano") {
    mp(g, "cone", G.cone, a, 0, 1.6, 0, 2.3, 3.2, 2.3);
    mp(g, "cone", G.cone, b, 0, 3.05, 0, 0.62, 0.42, 0.62, 0, 1.6);
    mp(g, "box", G.box, b, 0.5, 1.4, 0.9, 0.18, 1.2, 0.1, 0, 1.2);
  } else if (kind === "spike") {
    mp(g, "cone", G.cone, a, 0, 1.2, 0, 0.36, 2.4, 0.36);
    mp(g, "cone", G.cone, b, 0.45, 0.75, 0.1, 0.24, 1.5, 0.24);
    mp(g, "cone", G.cone, a, -0.42, 0.55, -0.12, 0.2, 1.1, 0.2);
  } else if (kind === "obelisk") {
    mp(g, "cyl4", G.cyl4, a, 0, 1.5, 0, 0.28, 3, 0.28);
    mp(g, "cone4", G.cone4, 0xffe6a0, 0, 3.08, 0, 0.22, 0.35, 0.22, Math.PI / 4, 1.2);
  } else if (kind === "bone") {
    const rib = mp(g, "cyl", G.cyl, a, 0, 0.25, 0, 0.09, 1.6, 0.09);
    rib.rotation.z = Math.PI / 2;
    mp(g, "sph", G.sph, a, -0.8, 0.25, 0, 0.16, 0.16, 0.16);
    mp(g, "sph", G.sph, a, 0.8, 0.25, 0, 0.16, 0.16, 0.16);
  } else if (kind === "castle") {
    mp(g, "box", G.box, a, 0, 1.6, 0, 1.5, 3.2, 1.5);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
      mp(g, "cyl", G.cyl, a, x, 1.9, z, 0.3, 0.7, 0.3);
      mp(g, "cone", G.cone, b, x, 3.1, z, 0.42, 0.7, 0.42);
    }
    for (let i = 0; i < 4; i++)
      mp(g, "box", G.box, a, -0.6 + i * 0.4, 3.35, 0.6, 0.22, 0.3, 0.22);
  } else if (kind === "pipe") {
    const h = mp(g, "cyl", G.cyl, a, 0, 1.1, 0, 0.28, 2.2, 0.28);
    h.rotation.z = Math.PI / 2;
    mp(g, "cyl", G.cyl, a, -0.9, 0.55, 0, 0.28, 1.1, 0.28);
  } else if (kind === "coral") {
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * Math.PI * 2;
      const branch = mp(g, "cyl", G.cyl, i % 2 ? a : b, Math.cos(t) * 0.3, 0.7, Math.sin(t) * 0.3, 0.11, 1.4, 0.11);
      branch.rotation.z = Math.cos(t) * 0.35;
      branch.rotation.x = Math.sin(t) * 0.35;
    }
  } else if (kind === "deadTree") {
    mp(g, "cyl", G.cyl, a, 0, 1.1, 0, 0.16, 2.2, 0.16);
    for (let i = 0; i < 3; i++) {
      const br = mp(g, "cyl", G.cyl, a, (i - 1) * 0.25, 1.6 + i * 0.25, 0, 0.06, 0.9, 0.06);
      br.rotation.z = (i - 1) * 0.8;
    }
  }
  g.traverse((o) => {
    if (o.isMesh) o.frustumCulled = true;
  });
  return g;
}
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function clearScenery() {
  for (const g of scenery) scene.remove(g);
  scenery = [];
}
function clearBackground() {
  if (!bgGroup) return;
  while (bgGroup.children.length) bgGroup.remove(bgGroup.children[0]);
}
function skyGradient(top, bottom) {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 256;
  const ctx = cv.getContext("2d"),
    gr = ctx.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(0.62, top);
  gr.addColorStop(1, bottom);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 32, 256);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
function groundTexture(base, accent, grid) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const r = seeded(base.replace("#", "").length * 977 + accent.replace("#", "").length * 31);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
    const x = r() * 128,
      y = r() * 128,
      w = 1 + r() * 3;
    ctx.fillRect(x, y, w, w);
  }
  if (grid) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.28;
    for (let i = 32; i < 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(18, 34);
  return tex;
}
// Background set pieces are authored at world scale but phones only see a
// narrow slice of the sky in portrait (~±24 m at z -104). Clamp horizontal
// placement into the visible band so suns, planets and landmarks actually show.
function bgX(x, z, margin = 0.88) {
  const fov = (camera?.fov || 48) * (Math.PI / 180);
  const dist = Math.max(20, (camera?.position.z || 12) - z);
  const halfW = Math.tan(fov / 2) * 0.46 * dist * margin;
  return Math.max(-halfW, Math.min(halfW, x));
}
function buildBackground(cfg) {
  clearBackground();
  if (cfg.disk) {
    const disk = new T.Mesh(
      mg("disk", () => new T.CircleGeometry(1, 28)),
      new T.MeshBasicMaterial({ color: cfg.disk.c, fog: false, depthWrite: false }),
    );
    // The camera looks slightly down, so the visible sky is a shallow band:
    // keep suns near the horizon instead of high above the frame.
    disk.position.set(bgX(cfg.disk.x, cfg.disk.z), Math.min(cfg.disk.y, 9.5), cfg.disk.z);
    disk.scale.setScalar(cfg.disk.s * 0.55);
    bgGroup.add(disk);
    const halo = new T.Mesh(
      mg("disk", () => new T.CircleGeometry(1, 28)),
      new T.MeshBasicMaterial({
        color: cfg.disk.c,
        fog: false,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    halo.position.copy(disk.position);
    halo.position.z -= 0.5;
    halo.scale.setScalar(cfg.disk.s * 1.35);
    bgGroup.add(halo);
  }
  if (cfg.special === "rainbow") {
    [0xff6b6b, 0xffd166, 0x6bcBff, 0x8affc1].forEach((color, i) => {
      const arc = new T.Mesh(
        mg("arc", () => new T.TorusGeometry(1, 0.06, 6, 40, Math.PI)),
        new T.MeshBasicMaterial({
          color,
          fog: false,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      arc.position.set(bgX(-4, -108), 0, -108);
      arc.scale.setScalar(9 + i * 1.35);
      bgGroup.add(arc);
    });
  }
  if (cfg.special === "planets") {
    const planet = (x, y, s, color, ring) => {
      const p = new T.Mesh(
        mg("sph", G.sph),
        new T.MeshBasicMaterial({ color, fog: false, depthWrite: false }),
      );
      p.position.set(bgX(x, -112, 0.8), y, -112);
      p.scale.setScalar(s);
      bgGroup.add(p);
      if (ring) {
        const r = new T.Mesh(
          mg("torus", G.torus),
          new T.MeshBasicMaterial({
            color: ring,
            fog: false,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
        );
        r.position.copy(p.position);
        r.scale.setScalar(s * 1.7);
        r.rotation.x = 1.25;
        bgGroup.add(r);
      }
    };
    planet(-13, 8.5, 3.6, 0xb06aff, 0xffa8f0);
    planet(12, 6.5, 2.4, 0x4af0ff, 0);
  }
  if (cfg.special === "aurora") {
    [0x7affc8, 0x6ab8ff, 0xb06aff].forEach((color, i) => {
      const band = new T.Mesh(
        mg("plane", G.plane),
        new T.MeshBasicMaterial({
          color,
          fog: false,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      band.position.set(-10 + i * 7, 22 + i * 2, -112);
      band.scale.set(26, 9, 1);
      band.rotation.z = 0.25 - i * 0.12;
      bgGroup.add(band);
    });
  }
  if (cfg.special === "waterfall") {
    for (const side of [-1, 1]) {
      const fall = new T.Mesh(
        mg("plane", G.plane),
        new T.MeshBasicMaterial({
          color: 0x8fe8ff,
          fog: false,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      fall.position.set(bgX(side * 15, -58), 9, -58);
      fall.scale.set(4.5, 26, 1);
      fall.rotation.y = side * 0.35;
      bgGroup.add(fall);
    }
  }
  if (cfg.special === "lava") {
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const crack = new T.Mesh(
        mg("box", G.box),
        glowMat(0xff5a2a, 1.5),
      );
      crack.position.set(side * (5 + (i % 3) * 2.4), -0.28, -12 - i * 12);
      crack.scale.set(0.5, 0.05, 5 + (i % 4) * 2);
      crack.rotation.y = i * 0.3;
      bgGroup.add(crack);
    }
  }
  if (cfg.special === "floating") {
    const r = seeded(4242);
    for (let i = 0; i < 4; i++) {
      const isle = buildProp("island", [0x9ad8ff, 0xffffff], r);
      isle.position.set(bgX((i % 2 ? 1 : -1) * (10 + i * 3), -46 - i * 14), 4 + i * 2.2, -46 - i * 14);
      isle.scale.setScalar(1.6 + r() * 0.8);
      bgGroup.add(isle);
    }
  }
  if (cfg.special === "craters") {
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const crater = new T.Mesh(
        mg("cyl", G.cyl),
        colorMat(0x6f6f77),
      );
      crater.position.set(side * (8 + (i % 3) * 5), -0.3, -18 - i * 14);
      crater.scale.set(2.2 + (i % 2), 0.03, 2.2 + (i % 2));
      bgGroup.add(crater);
    }
  }
}
function applyMapTheme(index, force = false) {
  if (!renderer || !scene || !MAPS.length) return;
  index = Math.max(1, Math.min(MAPS.length, Math.floor(Number(index)) || 1));
  if (!force && index === currentMapIndex) return;
  currentMapIndex = index;
  const cfg = MAPS[index - 1];
  scene.background = new T.Color(cfg.sky[1]);
  if (!scene.fog) scene.fog = new T.Fog(cfg.fog[0], cfg.fog[1], cfg.fog[2]);
  scene.fog.color.set(cfg.fog[0]);
  scene.fog.near = cfg.dark ? Math.max(cfg.fog[1], 46) : cfg.fog[1];
  scene.fog.far = cfg.dark ? Math.max(cfg.fog[2], 132) : cfg.fog[2];
  if (hemiLight) {
    hemiLight.color.set(cfg.hemi[0]);
    hemiLight.groundColor.set(cfg.hemi[1]);
    hemiLight.intensity = cfg.hemi[2];
  }
  if (sunLight) {
    sunLight.color.set(cfg.sun[0]);
    sunLight.intensity = cfg.sun[1];
  }
  if (skyMesh) {
    skyTexture?.dispose();
    skyTexture = skyGradient(cfg.sky[0], cfg.sky[1]);
    skyMesh.material.map = skyTexture;
    skyMesh.material.needsUpdate = true;
  }
  if (groundMesh) {
    groundMesh.material.color.set(cfg.ground);
    if (groundMesh.material.map) groundMesh.material.map.dispose();
    groundMesh.material.map = null;
    groundMesh.material.needsUpdate = true;
    groundMesh.material.map = groundTexture(cfg.ground, cfg.road[1], !!cfg.grid);
    groundMesh.material.needsUpdate = true;
  }
  if (roadSlab) roadSlab.material = colorMat(cfg.road[0]);
  // The old flat edge trim is now the glowing lip on the kerb.
  roadEdges.forEach((m) => (m.material = glowMat(cfg.road[1], 0.9)));
  roadDashes.forEach((m) => (m.material = colorMat(cfg.road[2])));
  applyBoundaryTheme(cfg);
  if (starField) {
    starField.visible = !!cfg.stars;
    starField.material.color.set(cfg.stars || 0xffffff);
  }
  clearScenery();
  buildBackground(cfg);
  const rnd = seeded(index * 7919 + 13);
  const landmarkKinds = new Set(["pyramid", "dome", "volcano", "castle"]);
  const bigKinds = new Set(["tower", "gear", "pipe", "island", "cloud"]);
  // Keep the authored prop counts (draw calls stay phone-friendly) but make
  // sure no map looks empty: the first prop kind tops the map up to 12.
  const authored = cfg.props.reduce((sum, spec) => sum + (spec.n || 6), 0);
  for (const spec of cfg.props) {
    const isFirst = spec === cfg.props[0];
    const count = isFirst
      ? (spec.n || 6) + Math.max(0, Math.min(6, 12 - authored))
      : spec.n || 6;
    const landmark = landmarkKinds.has(spec.k),
      big = landmark || bigKinds.has(spec.k);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const z = landmark
        ? -66 - (i / count) * 42 - rnd() * 8
        : -15 - (i + 0.5) * (72 / count) - rnd() * 3;
      const row = i % 4 >= 2; // every other prop per side sits further back
      const x = side * (landmark
        ? bgX(12 + rnd() * 10, z, 0.8)
        : big
          ? (row ? 14.5 + rnd() * 5 : 8.4 + rnd() * 3.4)
          : (row ? 10.5 + rnd() * 5 : 5.6 + rnd() * 4.2));
      const prop = buildProp(spec.k, spec.c, rnd);
      prop.position.set(x, spec.float ? 3 + rnd() * 6 : 0, z);
      const s = spec.s ? spec.s[0] + rnd() * (spec.s[1] - spec.s[0]) : 1.15 + rnd() * 0.75;
      prop.scale.setScalar(s);
      prop.rotation.y = rnd() * Math.PI * 2;
      if (landmark) {
        bgGroup.add(prop);
      } else {
        scene.add(prop);
        scenery.push(prop);
      }
    }
  }
  // weather
  weatherCfg = cfg.weather || null;
  if (weatherMesh) {
    weatherMesh.visible = !!weatherCfg;
    if (weatherCfg) {
      weatherMesh.material.color.set(weatherCfg.c);
      weatherMesh.material.size = weatherCfg.s;
      weatherMesh.material.needsUpdate = true;
      const count = Math.min(weatherCfg.n || 60, WEATHER_MAX);
      weatherMesh.geometry.setDrawRange(0, count);
      weatherSeed = [];
      for (let i = 0; i < count; i++)
        weatherSeed.push({
          speed: 0.5 + Math.random(),
          phase: Math.random() * Math.PI * 2,
          x: (Math.random() - 0.5) * 36,
          y: Math.random() * 14,
          z: -58 + Math.random() * 68,
        });
      resetWeather();
    }
  }
  document.body?.setAttribute?.("data-map", String(index));
  document.body?.setAttribute?.("data-dark", cfg.dark ? "1" : "0");
  if ($("mapLabel"))
    $("mapLabel").textContent = `✦ MAP ${index} · ${cfg.name.toUpperCase()}`;
  if ($("mapThemeName")) $("mapThemeName").textContent = cfg.name;
}
// Static boundary geometry: built once per world, never per frame. Both sides
// use two long boxes plus one InstancedMesh of posts, so the whole system costs
// ~8 draw calls regardless of track length.
function buildTrackBoundaries() {
  if (!T || !road || boundaryGroup) return;
  const B = BOUNDARY;
  boundaryGroup = new T.Group();
  boundaryGroup.name = "track-boundaries";
  road.add(boundaryGroup);
  boundaryCurbs = [];
  boundaryTopRails = [];
  boundaryMidRails = [];
  boundaryPosts = [];
  const kerbGeo = new T.BoxGeometry(B.kerbW, B.kerbH, B.spanZ);
  const topGeo = new T.BoxGeometry(0.24, 0.16, B.spanZ);
  const midGeo = new T.BoxGeometry(0.13, 0.08, B.spanZ);
  const postGeo = new T.BoxGeometry(B.postW, B.railTop - B.kerbH, B.postW);
  const postCount = Math.round(B.spanZ / B.postStep);
  const kerbTop = B.kerbH - B.kerbEmbed;
  const m = new T.Matrix4();
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "left" : "right";
    const kerb = mesh(
      kerbGeo,
      0xffffff,
      boundaryGroup,
      side * B.kerbX,
      B.kerbH / 2 - B.kerbEmbed,
      B.centreZ,
    );
    kerb.name = "kerb-" + tag;
    kerb.castShadow = false; // thin trim: keeps the shadow pass cheap on phones
    boundaryCurbs.push(kerb);
    const top = mesh(topGeo, 0xffffff, boundaryGroup, side * B.railX, B.railTop, B.centreZ);
    top.name = "top-rail-" + tag;
    top.castShadow = false;
    boundaryTopRails.push(top);
    const mid = mesh(midGeo, 0xffffff, boundaryGroup, side * B.railX, kerbTop + 0.3, B.centreZ);
    mid.name = "mid-rail-" + tag;
    mid.castShadow = false;
    boundaryMidRails.push(mid);
    const posts = new T.InstancedMesh(postGeo, colorMat(0xffffff), postCount);
    posts.name = "boundary-posts-" + tag;
    posts.castShadow = false;
    posts.receiveShadow = true;
    posts.frustumCulled = false; // one long row spans the whole visible track
    for (let i = 0; i < postCount; i++) {
      const z = B.centreZ + B.spanZ / 2 - (i + 0.5) * (B.spanZ / postCount);
      m.makeTranslation(side * B.railX, kerbTop + (B.railTop - kerbTop) / 2, z);
      posts.setMatrixAt(i, m);
    }
    posts.instanceMatrix.needsUpdate = true;
    boundaryGroup.add(posts);
    boundaryPosts.push(posts);
  }
  applyBoundaryTheme(MAPS[currentMapIndex - 1] || MAPS[0]);
}
function shadeColor(hex, k) {
  // Theme colours are stored as CSS strings, so scale them through T.Color and
  // hand back a number the material caches can key on.
  const c = new T.Color(hex).multiplyScalar(k);
  return c.getHex();
}
function applyBoundaryTheme(cfg) {
  if (!boundaryGroup || !cfg) return;
  // Kerb and posts are a darker, sturdier version of the road colour so they
  // read as a built edge on every one of the 30 maps; the hand-rails keep the
  // map's bright accent colour.
  // A little emissive lift keeps the vertical faces readable under every
  // theme's light direction instead of turning into a black strip.
  const base = shadeColor(cfg.road[0], 0.58),
    accent = cfg.road[1];
  for (const part of boundaryCurbs) part.material = glowMat(base, 0.35);
  for (const part of boundaryPosts) part.material = glowMat(base, 0.3);
  for (const part of boundaryMidRails) part.material = glowMat(base, 0.55);
  for (const part of boundaryTopRails) part.material = glowMat(accent, 0.6);
}
const WEATHER_MAX = 140;
function resetWeather() {
  if (!weatherMesh) return;
  const pos = weatherMesh.geometry.attributes.position;
  for (let i = 0; i < weatherSeed.length; i++) {
    const s = weatherSeed[i];
    pos.setXYZ(i, s.x, s.y, s.z);
  }
  pos.needsUpdate = true;
}
function tickMapEffects(dt) {
  if (!renderer) return;
  if (state.phase !== "paused")
    for (let d of decor) {
      d.position.z += state.phase === "playing" ? state.worldSpeed * dt : dt * 2;
      if (d.position.z > 12) d.position.z -= 108;
    }
  if (state.phase !== "paused")
    for (let d of scenery) {
      d.position.z += state.phase === "playing" ? state.worldSpeed * dt : dt * 2;
      if (d.position.z > 12) d.position.z -= 84;
    }
  if (starField?.visible) starField.rotation.y += dt * 0.004;
  if (weatherMesh?.visible && weatherCfg && state.phase !== "paused") {
    const pos = weatherMesh.geometry.attributes.position,
      kind = weatherCfg.k;
    for (let i = 0; i < weatherSeed.length; i++) {
      const s = weatherSeed[i];
      let x = pos.getX(i),
        y = pos.getY(i);
      if (kind === "snow") {
        y -= (0.9 + s.speed) * dt;
        x += Math.sin(state.time * 0.7 + s.phase) * 0.25 * dt;
      } else if (kind === "rain") {
        y -= (12 + s.speed * 4) * dt;
      } else if (kind === "ember") {
        y += (0.7 + s.speed * 0.8) * dt;
        x += Math.sin(state.time * 1.2 + s.phase) * 0.2 * dt;
      } else if (kind === "bubble") {
        y += (0.5 + s.speed * 0.6) * dt;
        x += Math.sin(state.time * 0.9 + s.phase) * 0.2 * dt;
      } else if (kind === "leaf") {
        y -= (0.7 + s.speed * 0.7) * dt;
        x += Math.sin(state.time * 0.8 + s.phase) * 0.7 * dt;
      } else if (kind === "dust") {
        x += (0.4 + s.speed * 0.5) * dt;
        y += Math.sin(state.time * 0.5 + s.phase) * 0.05 * dt;
      } else if (kind === "firefly") {
        x += Math.sin(state.time * 0.8 + s.phase) * 0.5 * dt;
        y += Math.cos(state.time * 0.6 + s.phase) * 0.3 * dt;
      } else if (kind === "mist") {
        x += (0.2 + s.speed * 0.25) * dt;
      } else if (kind === "sparkle") {
        y += 0.1 * dt;
        x += Math.sin(state.time * 0.4 + s.phase) * 0.1 * dt;
      }
      if (y < -0.6) y = 14;
      if (y > 15) y = 0;
      if (x > 18) x = -18;
      if (x < -18) x = 18;
      pos.setXY(i, x, y);
    }
    pos.needsUpdate = true;
  }
}

async function init() {
  try {
    T = await import("./vendor/three.module.js");
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      if (["playing", "countdown"].includes(state.phase)) pause();
      const old = renderer;
      renderer = null;
      old.domElement.remove();
      old.dispose();
      scene.clear();
      items.forEach((i) => {
        i.obj = null;
        i.spin = null;
      });
      particles = [];
      Object.keys(pools).forEach((k) => (pools[k] = []));
      particlePool.length = 0;
      fallback = document.createElement("canvas");
      $("world").appendChild(fallback);
      $("status").textContent = "LITE MODE · SWIPE TO STEER";
      resize();
    });
    $("world").appendChild(renderer.domElement);
    scene = new T.Scene();
    scene.background = new T.Color(0x38d0df);
    scene.fog = new T.Fog(0x38d0df, 32, 105);
    camera = new T.PerspectiveCamera(48, 1, 0.1, 150);
    camera.position.set(0, 8, 12);
    camera.lookAt(0, 0, -14);
    hemiLight = new T.HemisphereLight(0xffffff, 0x3e8d99, 1.8);
    scene.add(hemiLight);
    sunLight = new T.DirectionalLight(0xfff5df, 2);
    sunLight.position.set(-8, 16, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    // Cover the whole visible corridor: a small shadow box clamps its edge
    // texels and paints a hard light/shadow boundary across the ground.
    Object.assign(sunLight.shadow.camera, {
      left: -42,
      right: 42,
      top: 34,
      bottom: -70,
      near: 1,
      far: 120,
    });
    sunLight.shadow.bias = -0.0006;
    scene.add(sunLight);
    groundMesh = new T.Mesh(
      new T.PlaneGeometry(150, 190),
      new T.MeshStandardMaterial({ color: 0x4a9548, roughness: 1 }),
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.32, -78);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    skyMesh = new T.Mesh(
      new T.SphereGeometry(122, 24, 16),
      new T.MeshBasicMaterial({ side: T.BackSide, depthWrite: false, fog: false }),
    );
    scene.add(skyMesh);
    {
      const pos = [];
      const sr = seeded(991);
      for (let i = 0; i < 260; i++) {
        const theta = sr() * Math.PI * 2,
          phi = Math.acos(0.15 + sr() * 0.85);
        pos.push(
          Math.sin(phi) * Math.cos(theta) * 108,
          Math.cos(phi) * 108,
          Math.sin(phi) * Math.sin(theta) * 108,
        );
      }
      const geoStars = new T.BufferGeometry();
      geoStars.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      starField = new T.Points(
        geoStars,
        new T.PointsMaterial({
          color: 0xffffff,
          size: 0.75,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          fog: false,
          sizeAttenuation: true,
        }),
      );
      starField.visible = false;
      scene.add(starField);
    }
    {
      const geoW = new T.BufferGeometry();
      weatherPos = new Float32Array(WEATHER_MAX * 3);
      for (let i = 0; i < WEATHER_MAX; i++) {
        weatherPos[i * 3] = (Math.random() - 0.5) * 36;
        weatherPos[i * 3 + 1] = Math.random() * 14;
        weatherPos[i * 3 + 2] = -58 + Math.random() * 68;
      }
      geoW.setAttribute("position", new T.BufferAttribute(weatherPos, 3));
      weatherMesh = new T.Points(
        geoW,
        new T.PointsMaterial({
          color: 0xffffff,
          size: 0.15,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          sizeAttenuation: true,
        }),
      );
      weatherMesh.visible = false;
      weatherMesh.frustumCulled = false;
      scene.add(weatherMesh);
    }
    bgGroup = new T.Group();
    scene.add(bgGroup);
    geo.eye = new T.SphereGeometry(0.13, 12, 8);
    geo.pupil = new T.SphereGeometry(0.065, 10, 8);
    road = new T.Group();
    scene.add(road);
    roadSlab = box(road, 0xfff2da, 0, -0.3, -43, 7.2, 0.6, 112);
    // Sits on the kerb top (built just below) as its bright edge highlight.
    for (let x of [-3.72, 3.72])
      roadEdges.push(
        box(
          road,
          0xffffff,
          x,
          BOUNDARY.kerbH - BOUNDARY.kerbEmbed + 0.01,
          -43,
          0.18,
          0.06,
          112,
        ),
      );
    for (let z = 8; z > -100; z -= 4) {
      for (let x of [-1.2, 1.2]) {
        let m = box(road, 0xe7d3b8, x, 0.015, z, 0.045, 0.025, 1.5);
        roadDashes.push(m);
        decor.push(m);
      }
    }
    buildTrackBoundaries();
    hero = new T.Group();
    scene.add(hero);
    aura = new T.Mesh(
      new T.SphereGeometry(1.5, 16, 12),
      new T.MeshBasicMaterial({
        color: 0x8dffee,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
        depthWrite: false,
      }),
    );
    aura.position.y = 1.35;
    aura.visible = false;
    hero.add(aura);
    powerRing = new T.Mesh(
      new T.TorusGeometry(0.92, 0.045, 5, 24),
      new T.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
      }),
    );
    powerRing.rotation.x = -Math.PI / 2;
    scene.add(powerRing);
    // The rig lives in its own child group so a runner can be swapped without
    // touching hero.position / rotation / scale (the animation contract).
    heroBodies = {};
    heroBody = buildHeroBody(characterById(selectedCharacter), hero);
    heroBodies[selectedCharacter] = heroBody;
    heroEyes = heroBody.userData.eyes;
    heroDecor = heroBody.userData.decor;
    finish = new T.Group();
    scene.add(finish);
    for (let x of [-3.5, 3.5]) box(finish, 0xffffff, x, 2, 0, 0.16, 4, 0.16);
    for (let x = 0; x < 12; x++)
      for (let y = 0; y < 2; y++)
        box(
          finish,
          (x + y) % 2 ? 0x244353 : 0xffffff,
          -3.3 + x * 0.6,
          3.5 + y * 0.3,
          0,
          0.6,
          0.3,
          0.15,
        );
    applyQuality();
    resize();
    applyMapTheme(mapForLevel(levelProgress.unlocked), true);
  } catch (e) {
    console.warn("3D unavailable; using built-in canvas renderer.");
    renderer?.domElement.remove();
    renderer = null;
    fallback = document.createElement("canvas");
    $("world").appendChild(fallback);
    $("status").textContent = "LITE MODE · SWIPE TO STEER";
    resize();
  }
  ready = true;
  $("play").disabled = false;
  window.__fdBootReady?.(renderer?"3D ready":"Lite ready");
  requestAnimationFrame(loop);
}
function resize() {
  let w = $("app").clientWidth,
    h = $("app").clientHeight;
  if (renderer) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (fallback) {
    fallback.width = w;
    fallback.height = h;
  }
}
window.addEventListener("resize", resize);
function createItem(type, lane, d) {
  let it = { type, lane, d, hit: false, obj: null, offset: 0, phase: d * 0.7 };
  let recycled = pools[type]?.pop();
  if (recycled) {
    it.obj = recycled.obj;
    it.spin = recycled.spin;
    it.obj.visible = true;
    scene.add(it.obj);
  } else if (renderer) {
    let g = new T.Group();
    scene.add(g);
    it.obj = g;
    g.position.set(lane * 2.4, 0, -d);
    if (type === "gem") {
      let a = mesh(new T.OctahedronGeometry(0.35), colors.gem, g, 0, 0.8, 0);
      a.rotation.z = 0.2;
      mesh(new T.TorusGeometry(0.45, 0.025, 5, 20), 0xffffff, g, 0, 0.8, 0);
    }
    if (type === "bullet") {
      // Cyan dart with a white tip and fins: clearly different from a Jam.
      let core = mesh(
        new T.CapsuleGeometry(0.11, 0.36, 4, 10),
        colors.bullet,
        g,
        0,
        0.8,
        0,
      );
      core.rotation.x = Math.PI / 2;
      let tip = mesh(
        new T.ConeGeometry(0.17, 0.3, 10),
        0xffffff,
        g,
        0,
        0.8,
        -0.31,
      );
      tip.rotation.x = -Math.PI / 2;
      for (let side of [-1, 1]) {
        let fin = mesh(
          new T.BoxGeometry(0.22, 0.07, 0.2),
          0xbdf3ff,
          g,
          side * 0.17,
          0.8,
          0.27,
        );
        fin.rotation.z = side * 0.55;
      }
      mesh(new T.TorusGeometry(0.31, 0.026, 5, 18), 0xffffff, g, 0, 0.8, 0);
    }
    if (type === "block") {
      box(g, colors.block, 0, 0.55, 0, 1.35, 1.1, 0.9);
      face(g, 0.67, 0.49, 0.85);
      for (let x of [-0.55, 0.55])
        mesh(new T.ConeGeometry(0.15, 0.35, 8), 0xffe7af, g, x, 1.25, 0);
    }
    if (type === "gap") {
      box(g, colors.gap, 0, 0.025, 0, 2.22, 0.08, 2.5);
      for (let z of [-1.3, 1.3]) box(g, 0xffc34a, 0, 0.08, z, 2.3, 0.09, 0.15);
    }
    if (type === "gate") {
      if (!geo.gateBadge) {
        let cv = document.createElement("canvas");
        cv.width = 128;
        cv.height = 64;
        let ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff364";
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = "#49328b";
        ctx.font = "bold 44px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+5", 64, 34);
        geo.gateBadge = new T.CanvasTexture(cv);
        geo.gateBadge.colorSpace = T.SRGBColorSpace;
        mats.gateBadge = new T.MeshBasicMaterial({ map: geo.gateBadge });
        geo.badgePlane = new T.PlaneGeometry(0.9, 0.45);
      }
      let badge = new T.Mesh(geo.badgePlane, mats.gateBadge);
      badge.position.set(0, 2.45, 0.13);
      g.add(badge);
      for (let x of [-0.9, 0.9])
        box(g, colors.gate, x, 1.25, 0, 0.15, 2.5, 0.2);
      box(g, colors.gate, 0, 2.45, 0, 1.95, 0.3, 0.2);
    }
    if (type === "rotor") {
      box(g, 0xffd25f, 0, 0.4, 0, 0.3, 0.8, 0.3);
      let spin = new T.Group();
      spin.position.y = 0.9;
      g.add(spin);
      box(spin, colors.rotor, 0, 0, 0, 1.9, 0.25, 0.25);
      mesh(new T.SphereGeometry(0.24, 12, 8), 0xffffff, spin);
      it.spin = spin;
    }
    if (type === "slider") {
      box(g, 0xe0f7ff, 0, 0.08, 0, 2.15, 0.1, 1.1);
      let carriage = new T.Group();
      g.add(carriage);
      box(carriage, colors.slider, 0, 0.65, 0, 1.1, 1.2, 0.8);
      face(carriage, 0.8, 0.45, 0.75);
      it.spin = carriage;
    }
    if (type === "barrier") {
      // Full-height wall: solid from the floor past the hero's jump apex.
      box(g, 0x2b2d42, 0, 1.3, 0, 2.04, 2.6, 0.3);
      for (let y of [0.42, 1.02, 1.62, 2.22]) {
        box(g, colors.barrier, 0, y, 0.2, 1.9, 0.4, 0.2);
        box(g, 0xffffff, 0, y + 0.12, 0.32, 1.9, 0.13, 0.06);
      }
      for (let x of [-0.97, 0.97])
        box(g, 0x2b2d42, x, 1.3, 0, 0.16, 2.6, 0.5);
    }
    if (type === "antiJump") {
      // Open energy frame with horizontal field bars: jumping still hits.
      for (let x of [-0.96, 0.96])
        box(g, 0x3b2a66, x, 1.3, 0, 0.18, 2.6, 0.34);
      for (let y of [0.55, 1.1, 1.65, 2.2]) {
        box(g, colors.antiJump, 0, y, 0.02, 1.86, 0.26, 0.16);
        box(g, 0xffffff, 0, y, 0.12, 1.86, 0.07, 0.04);
      }
      box(g, 0x3b2a66, 0, 2.55, 0, 2.08, 0.22, 0.46);
      mesh(new T.ConeGeometry(0.18, 0.4, 8), 0xffffff, g, 0, 2.55, 0.24);
    }
    if (type === "heavy") {
      // Deep, wide lane blocker; jumping or staying low cannot pass it.
      box(g, 0x333947, 0, 0.95, 0, 2.18, 1.9, 1.5);
      for (let y of [0.42, 0.95, 1.48])
        box(g, 0xffd25f, 0, y, 0.78, 2.18, 0.16, 0.06);
      box(g, 0x232833, 0, 1.95, 0, 2.34, 0.22, 1.62);
      for (let x of [-0.82, 0.82])
        mesh(new T.ConeGeometry(0.13, 0.3, 8), 0x9aa4b5, g, x, 2.12, 0.35);
    }
    if (type === "laser") {
      // Overhead gate: grounded runners stay low and pass under; jumping hits.
      for (let x of [-1.02, 1.02])
        box(g, 0x2b2d42, x, 1.9, 0, 0.16, 3.8, 0.2);
      box(g, colors.laser, 0, 3.72, 0, 2.12, 0.14, 0.16);
      box(g, 0xffc2d0, 0, 3.72, 0, 2.12, 0.045, 0.2);
      for (let x of [-1.02, 1.02]) {
        box(g, 0x2b2d42, x, 3.86, 0, 0.34, 0.22, 0.34);
        box(g, colors.laser, x, 3.86, 0.18, 0.2, 0.1, 0.06);
      }
      box(g, 0xffd25f, 0, 0.035, 0.75, 2.1, 0.05, 0.14);
    }
  }
  if (it.obj) {
    it.obj.position.set(lane * 2.4, 0, state.distance - d);
    if (it.spin) {
      it.spin.rotation.set(0, 0, 0);
      it.spin.position.x = 0;
    }
  }
  items.push(it);
  return it;
}
function disposeObj(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse((o) => {
    if (o.geometry && !Object.values(geo).includes(o.geometry))
      o.geometry.dispose();
  });
}
function releaseItem(i) {
  if (!i.obj) return;
  scene.remove(i.obj);
  i.obj.visible = false;
  let pool = (pools[i.type] ??= []);
  if (pool.length < 32) pool.push(i);
  else disposeObj(i.obj);
}
function releaseParticle(p) {
  scene.remove(p.obj);
  p.obj.visible = false;
  if (particlePool.length < 64) particlePool.push(p.obj);
  else disposeObj(p.obj);
}
function clear() {
  items.forEach(releaseItem);
  items = [];
  projectiles.forEach(releaseProjectile);
  projectiles = [];
  particles.forEach(releaseParticle);
  particles = [];
}

function lowObstacle() {
  // Existing obstacles stay jumpable. They remain the majority of rows.
  const r = Math.random();
  return r < 0.34 ? "block" : r < 0.62 ? "gap" : r < 0.82 ? "rotor" : "slider";
}
function sideObstacle(d) {
  // Low jumpable obstacles remain common; the +5 score gate is preserved in
  // the mix and never blocks a lane. New jump-proof types phase in gradually.
  const r = Math.random();
  if (d < 60) return r < 0.72 ? lowObstacle() : "gate";
  if (d < 120) {
    if (r < 0.54) return lowObstacle();
    if (r < 0.62) return "gate";
    if (r < 0.85) return "barrier";
    return "antiJump";
  }
  if (d < 180) {
    if (r < 0.46) return lowObstacle();
    if (r < 0.54) return "gate";
    if (r < 0.68) return "barrier";
    if (r < 0.82) return "antiJump";
    return "heavy";
  }
  if (r < 0.44) return lowObstacle();
  if (r < 0.52) return "gate";
  if (r < 0.65) return "barrier";
  if (r < 0.77) return "antiJump";
  if (r < 0.88) return "heavy";
  return "laser";
}
// Jams and Bullets share the same collectible trail. Each trail holds one
// Jam-two Bullet or two Jam-one Bullet, alternating, so exactly half of the
// collectibles are Jams (a 50% reduction) and every trail has both types.
let trailFlip = false;
// Distance target for the current run. Level mode uses the level formula;
// sprint keeps its original fixed 600 m; endless has no finish.
function runTarget() {
  // Level runs are measured from the saved checkpoint: 600 m for level 1,
  // then 400 m of new distance for every later level.
  if (state.mode === "level") return levelRunDistance(state.level);
  if (state.mode === "sprint") return 600;
  return Infinity;
}
function spawnTrail(lane, d) {
  trailFlip = !trailFlip;
  const pattern = trailFlip
    ? ["gem", "bullet", "gem"]
    : ["bullet", "gem", "bullet"];
  pattern.forEach((type, j) => createItem(type, lane, d + j * 1.4));
}
function seed() {
  // Fairness rules:
  // 1. A normal row has one completely clear, gem-guided lane. Its other two
  //    lanes may contain solid or jumpable obstacles, so a lane change always
  //    exists for jump-proof obstacles.
  // 2. A laser row has no fully clear lane, but the centre laser is passable
  //    by staying grounded while both side lanes hold jumpable low obstacles.
  //    This makes "stay low" a real choice without ever requiring a new input.
  // 3. Rows are spaced for at least ~0.6 s of reaction time at top speed.
  let d = state.spawn;
  state.spawn += Math.max(15, 20 - state.distance / 170);
  const target = runTarget();
  if (Number.isFinite(target) && d > target - 14) return;
  if (d >= 150 && Math.random() < 0.14) {
    createItem("laser", 0, d);
    spawnTrail(0, d);
    for (let lane of [-1, 1]) createItem(lowObstacle(), lane, d);
    lastSafe = 0;
    return;
  }
  let choices = [lastSafe - 1, lastSafe, lastSafe + 1].filter(
    (n) => n >= -1 && n <= 1,
  );
  if (d < 90) choices = [0];
  let safe = choices[Math.floor(Math.random() * choices.length)];
  lastSafe = safe;
  for (let lane = -1; lane <= 1; lane++) {
    if (lane === safe) {
      spawnTrail(lane, d);
    } else {
      createItem(sideObstacle(d), lane, d);
    }
  }
}
function start() {
  lastSafe = 0;
  clear();
  resetRunSystems();
  Object.assign(state, {
    phase: "playing",
    distance: 0,
    score: 0,
    lane: 0,
    x: 0,
    speed: 14,
    growth: 0,
    time: 0,
    spawn: 27,
  });
  while (state.spawn < 100) seed();
  $("overlay").hidden = true;
  $("toast").textContent = "";
  $("pause").textContent = "Ⅱ";
  $("restart").hidden = false;
  $("pause").disabled = false;
  beep();
  updateUI();
}
function updateUI() {
  $("jams").textContent = state.jams;
  $("jamRewards").textContent = state.jamRewards;
  $("lives").textContent = state.lives;
  $("activePowers").textContent = "";
  $("nextReward").textContent =
    `NEXT REWARD · ${state.nextPowerMilestone} JAMS · NEXT LIFE · ${state.nextLifeMilestone}`;
  updateControls();
  $("score").textContent = state.score;
  const target = runTarget();
  $("distance").textContent = Number.isFinite(target)
    ? `${Math.floor(state.distance)} / ${target} m`
    : `${Math.floor(state.distance)} m`;
  $("progress").style.width =
    (Number.isFinite(target)
      ? Math.min(100, (state.distance / target) * 100)
      : (state.distance % 600) / 6) + "%";
  $("best").textContent = state.best;
  const levelMode = state.mode === "level";
  $("level").textContent = levelMode
    ? `LEVEL ${state.level}${isMilestoneLevel(state.level) ? " ★" : ""} · ${MAPS[mapForLevel(state.level) - 1].name.toUpperCase()}`
    : `LEVEL ${1 + Math.floor(state.distance / 200)} · ${state.mode === "sprint" ? "SPRINT" : "ENDLESS"}`;
  if ($("totalProgress")) {
    $("totalProgress").hidden = !levelMode;
    if (levelMode) {
      const start = levelStartDistance(state.level);
      const total = start + Math.floor(state.distance);
      $("totalProgress").textContent =
        `TOTAL ${total} / ${levelDistance(state.level)} m · CHECKPOINT ${start} m`;
    }
  }
  if ($("mapLabel") && state.mode !== "level") {
    $("mapLabel").textContent = "✦ CANDY WORLD";
  } else if ($("mapLabel")) {
    $("mapLabel").textContent =
      `✦ MAP ${mapForLevel(state.level)} · ${MAPS[mapForLevel(state.level) - 1].name.toUpperCase()}`;
  }
}
function end(win) {
  const isLevel = state.mode === "level";
  const level = state.level;
  const startTotal = isLevel ? levelStartDistance(level) : 0;
  const runLen = isLevel ? levelRunDistance(level) : 0;
  const targetTotal = isLevel ? levelDistance(level) : 0;
  const nextMap = isLevel ? mapForLevel(level + 1) : 0;
  let advanced = false,
    mapUnlockedNow = false;
  state.phase = win ? "won" : "lost";
  $("pause").disabled = true;
  $("restart").hidden = true;
  vibrate(win ? [30, 50, 30] : 120);
  if (state.score > state.best) {
    state.best = state.score;
    try {
      localStorage.setItem("fingerDashBest", state.best);
    } catch {}
  }
  // Only a genuine distance completion saves a checkpoint, and only the
  // current frontier can advance it (duplicate calls return false).
  let runnerUnlockedNow = null;
  if (win && isLevel) {
    advanced = completeLevel(level);
    mapUnlockedNow = advanced && nextMap > mapForLevel(level);
    if (advanced) runnerUnlockedNow = nextCharacterUnlock(level);
  }
  updateUI();
  $("overlay").hidden = false;
  $("intro").hidden = true;
  if (isLevel) {
    const next = level + 1;
    $("eyebrow").textContent = win
      ? `LEVEL ${level} COMPLETE · CHECKPOINT SAVED`
      : `LEVEL ${level} NOT CLEARED`;
    $("title").innerHTML = win
      ? `Level<br><em>${level}!</em>`
      : `Try<br><em>again!</em>`;
    $("description").textContent = win
      ? `${targetTotal} m total · +${runLen} m this level · Score ${state.score} · Jams ${state.jams}`
      : `${Math.floor(state.distance)} / ${runLen} m this run · checkpoint ${startTotal} m kept · Score ${state.score}`;
    $("play").hidden = win;
    $("play").innerHTML = `RETRY LEVEL ${level} <span>↻</span>`;
    $("continueLevel").hidden = !win;
    $("replayLevel").hidden = !win;
    $("levelsFromEnd").hidden = !win;
    $("levelActions").hidden = !win;
    if (win) {
      $("continueLevel").innerHTML =
        `CONTINUE → LEVEL ${next}${isMilestoneLevel(next) ? " ★" : ""} <span>→</span>`;
      $("replayLevel").innerHTML = `REPLAY LEVEL ${level}`;
      $("levelsFromEnd").innerHTML = "LEVEL MAP";
    }
    $("home").hidden = false;
    $("hint").textContent = win
      ? `Checkpoint saved at ${targetTotal} m. Next: map ${nextMap} · ${MAPS[nextMap - 1].name}.` +
        (runnerUnlockedNow
          ? ` NEW RUNNER UNLOCKED: ${runnerUnlockedNow.name.toUpperCase()} — pick it from the menu.`
          : "")
      : `Retry level ${level} — your saved checkpoint stays at ${startTotal} m.`;
    if (runnerUnlockedNow) {
      $("toast").textContent = `✦ ${runnerUnlockedNow.name} unlocked!`;
      toastTimer = 3;
    }
    showMapUnlock(mapUnlockedNow ? nextMap : 0);
  } else {
    $("eyebrow").textContent = win
      ? "A SMALL FINGER. A HUGE WIN."
      : "A LITTLE BUMP IN THE ROAD";
    $("title").innerHTML = win
      ? "Nailed<br><em>it!</em>"
      : "Oops!<br><em>Again?</em>";
    $("description").textContent =
      `${state.jams} Jams · ${state.jamRewards} rewards • Score ${state.score} • ${Math.floor(state.distance)} meters • Best ${state.best}`;
    $("play").hidden = false;
    $("play").innerHTML = "DASH AGAIN <span>↻</span>";
    $("continueLevel").hidden = true;
    $("replayLevel").hidden = true;
    $("levelsFromEnd").hidden = true;
    $("levelActions").hidden = true;
    $("home").hidden = false;
    $("hint").textContent = win
      ? "Try endless mode for a bigger adventure."
      : "Watch the track ahead. Every row has a safe lane.";
    showMapUnlock(0);
  }
  renderLevels();
  syncContinueButton();
  beep(win ? 950 : 160, 0.25);
}
let mapUnlockTimer = 0;
function showMapUnlock(mapIndex) {
  const el = $("mapUnlock");
  if (!el) return;
  clearTimeout(mapUnlockTimer);
  if (!mapIndex || mapIndex > MAPS.length) {
    el.hidden = true;
    el.classList.remove("show");
    return;
  }
  el.hidden = false;
  el.innerHTML = `<strong>MAP ${mapIndex} UNLOCKED</strong><span>${MAPS[mapIndex - 1].name}</span>`;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  mapUnlockTimer = setTimeout(() => el.classList.remove("show"), 5600);
}
function syncContinueButton() {
  const btn = $("continueRun");
  if (!btn) return;
  const show = state.phase === "menu" && levelProgress.unlocked > 1;
  btn.hidden = !show;
  const n = levelProgress.unlocked,
    m = mapForLevel(n);
  btn.innerHTML =
    levelProgress.unlocked > 1
      ? `CONTINUE · LEVEL ${n} · ${MAPS[m - 1].name.toUpperCase()} <span>→</span>`
      : "CONTINUE <span>→</span>";
}

function pause() {
  gesture = null;
  if (state.phase === "countdown") {
    cancelCountdown();
    state.phase = "playing";
  }
  if (state.phase === "playing") {
    state.phase = "paused";
    $("overlay").hidden = false;
    $("intro").hidden = true;
    $("eyebrow").textContent = "TAKE A BREATHER";
    $("title").innerHTML = "On<br><em>pause.</em>";
    $("description").textContent = "Your tiny hero is waiting for you.";
    $("play").innerHTML = "KEEP GOING <span>→</span>";
    $("home").hidden = false;
    $("hint").textContent = "Tap to resume your run.";
    $("pause").textContent = "▶";
    $("restart").hidden = false;
  } else if (state.phase === "paused") {
    state.phase = "playing";
    $("overlay").hidden = true;
    $("pause").textContent = "Ⅱ";
  }
  updateControls();
}
function move(n, now = performance.now()) {
  if (state.phase !== "playing" || now - lastLaneInput < 180) return false;
  lastLaneInput = now;
  state.lane = Math.max(-1, Math.min(1, state.lane + Math.sign(n)));
  beep(260, 0.035);
  return true;
}
let toastTimer = 0;
function collect(i) {
  if (i.hit || state.phase !== "playing") return false;
  i.hit = true;
  const value =
    (i.type === "gate"
      ? 5
      : i.type === "bullet"
        ? 1
        : active("double")
          ? 2
          : 1) *
    (active("multiplier") ? state.powers.multiplier.multiplier : 1);
  state.score += value;
  if (i.type === "gem") {
    lastAction="Jam collected";
    state.collectedJams++;
    state.jams++;
    state.jamRewards += active("double") ? 2 : 1;
    awardMilestones();
  } else if (i.type === "bullet") {
    // Ammunition only: no Jam, reward, milestone, growth or power change.
    lastAction="Bullet collected";
    state.collectedBullets++;
    state.ammo++;
    spawnSparks(state.x, 0.95, -0.25, 0x9ff4ff, 0xffffff, 6, 0.3);
    beep(880, 0.05);
    vibrate(8);
    pulseAmmo();
    updateUI();
    return true;
  }
  state.growth = Math.min(1, state.growth + 0.035);
  $("toast").textContent =
    i.type === "gate"
      ? `+${value} • SUPER GROW!`
      : `✦ JAM +1${active("double") ? " · BONUS +1" : ""} · SCORE +${value}`;
  toastTimer = 0.65;
  vibrate(12);
  beep(i.type === "gate" ? 1000 : 650 + (state.score % 5) * 80);
  if (renderer) {
    for (let j = 0; j < 8 && particles.length < 64; j++) {
      let o = particlePool.pop();
      if (o) {
        scene.add(o);
        o.visible = true;
        o.position.set(state.x, 1, -0.2);
        o.scale.setScalar(1);
        o.material = (mats[j % 2 ? 0xfff36a : 0xffffff] ??= mat(
          j % 2 ? 0xfff36a : 0xffffff,
        ));
      } else {
        o = mesh(
          (geo.particle ??= new T.SphereGeometry(0.07, 5, 4)),
          j % 2 ? 0xfff36a : 0xffffff,
          scene,
          state.x,
          1,
          -0.2,
        );
      }
      particles.push({
        obj: o,
        vx: (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 4,
        life: 0.65,
      });
    }
  }
  updateUI();
}
// ── Bullet shooting ────────────────────────────────────────────────────────
// Only obstacles that cannot be cleared by jumping are valid targets. A round
// travels forward in the lane it was fired from; it destroys the first valid
// target it meets and fizzles harmlessly on a jumpable obstacle.
const SHOOT = { range: 46, speed: 52, cooldown: 0.16, life: 2.2 };
let muzzle = null, muzzleLife = 0;
const SHOOTABLE = new Set(["barrier", "antiJump", "heavy", "laser"]);
let lastShotAt = -Infinity, projectiles = [], shotPool = [];
function shootTarget() {
  if (state.phase !== "playing") return null;
  let best = null;
  for (const i of items)
    if (
      !i.hit &&
      SHOOTABLE.has(i.type) &&
      i.lane === state.lane &&
      i.d > state.distance + 0.5 &&
      i.d < state.distance + SHOOT.range &&
      (!best || i.d < best.d)
    )
      best = i;
  return best;
}
function shotObj() {
  const obj = new T.Group();
  const core = new T.Mesh(
    (geo.shot ??= new T.CapsuleGeometry(0.07, 0.46, 4, 8)),
    (mats.shot ??= new T.MeshBasicMaterial({ color: 0x9ff4ff })),
  );
  core.rotation.x = Math.PI / 2;
  obj.add(core);
  const halo = new T.Mesh(
    (geo.shotHalo ??= new T.TorusGeometry(0.17, 0.03, 4, 12)),
    (mats.shotHalo ??= new T.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    })),
  );
  obj.add(halo);
  // Stretched tracer tail so the round reads clearly while travelling.
  const tail = new T.Mesh(
    (geo.shotTail ??= new T.CylinderGeometry(0.035, 0.09, 1.5, 6, 1, true)),
    (mats.shotTail ??= new T.MeshBasicMaterial({
      color: 0x54e0ff,
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
      depthWrite: false,
    })),
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 0.85;
  obj.add(tail);
  return obj;
}
function releaseProjectile(p) {
  if (!p.obj) return;
  scene.remove(p.obj);
  p.obj.visible = false;
  if (shotPool.length < 8) shotPool.push(p.obj);
  else disposeObj(p.obj);
  p.obj = null;
}
function shoot() {
  if (state.phase !== "playing" || state.ammo <= 0) return false;
  if (state.time - lastShotAt < SHOOT.cooldown) return false;
  lastShotAt = state.time;
  state.ammo--;
  state.shotsFired++;
  lastAction = "Bullet fired";
  let obj = null;
  if (renderer) {
    obj = shotPool.pop() || shotObj();
    obj.visible = true;
    obj.position.set(state.x, 0.95 + state.y, -0.7);
    scene.add(obj);
  }
  projectiles.push({ obj, z: -0.7, lane: state.lane, ttl: SHOOT.life });
  spawnSparks(state.x, 0.95 + state.y, -0.8, 0x9ff4ff, 0xffffff, 4, 0.22);
  if (renderer && state.powers && !muzzle) {
    muzzle = new T.Mesh(
      (geo.muzzle ??= new T.SphereGeometry(0.26, 10, 8)),
      (mats.muzzle ??= new T.MeshBasicMaterial({
        color: 0xd8ffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })),
    );
    scene.add(muzzle);
  }
  muzzleLife = 0.18;
  beep(1080, 0.05);
  vibrate(6);
  updateUI();
  return true;
}
function destroyObstacle(i) {
  // Removed from the array (collision) and the scene (visible object) at once.
  i.hit = true;
  state.bulletHits++;
  const z = state.distance - i.d;
  spawnSparks(i.lane * 2.4, 1.0, z, 0x9ff4ff, 0xfff36a, 10, 0.45);
  const at = items.indexOf(i);
  if (at >= 0) items.splice(at, 1);
  releaseItem(i);
  lastAction = "Obstacle destroyed";
  beep(520, 0.07);
  updateUI();
}
function spawnSparks(x, y, z, colorA, colorB, count, life = 0.35) {
  if (!renderer) return;
  for (let j = 0; j < count && particles.length < 64; j++) {
    let o = particlePool.pop();
    if (o) {
      scene.add(o);
      o.visible = true;
      o.position.set(x, y, z);
      o.scale.setScalar(1);
    } else {
      o = mesh(
        (geo.particle ??= new T.SphereGeometry(0.07, 5, 4)),
        j % 2 ? colorA : colorB,
        scene,
        x,
        y,
        z,
      );
    }
    o.material = (mats[j % 2 ? colorA : colorB] ??= mat(j % 2 ? colorA : colorB));
    particles.push({
      obj: o,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.2) * 3,
      vz: (Math.random() - 0.5) * 4 - 2,
      life,
    });
  }
}
function pulseAmmo() {
  const el = $("ammo");
  if (!el) return;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function step(dt) {
  if (state.phase !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  tickRunSystems(dt);
  const oldLevel = Math.floor(state.distance / 200);
  state.time += dt;
  state.speed = Math.min(25, 14 + state.distance / 80);
  state.worldSpeed =
    state.speed *
    (active("slow") ? 0.55 : 1) *
    (active("speed") ? 1.4 : 1) *
    (active("freeze") ? 0 : 1);
  state.worldTime += dt * (active("freeze") ? 0 : active("slow") ? 0.55 : 1);
  let dz = state.worldSpeed * dt;
  state.distance += dz;
  // The legacy 200 m "LEVEL" toast would contradict real level numbers.
  if (state.mode !== "level" && Math.floor(state.distance / 200) > oldLevel) {
    $("toast").textContent = `LEVEL ${1 + Math.floor(state.distance / 200)} ✦`;
    toastTimer = 1.4;
    beep(900, 0.15);
  }
  state.x += (state.lane * 2.4 - state.x) * Math.min(1, dt * 18);
  // The railing starts at ±3.6 m: clamp the runner to the outer lane centre so
  // no state change can ever push the character into (or past) a boundary.
  if (state.x > BOUNDARY.laneX) state.x = BOUNDARY.laneX;
  else if (state.x < -BOUNDARY.laneX) state.x = -BOUNDARY.laneX;
  if (state.spawn - state.distance < 95) seed();
  for (let i of items) {
    let z = state.distance - i.d;
    i.offset =
      i.type === "slider"
        ? Math.sin(state.worldTime * 2.8 + i.phase) * 0.35
        : 0;
    if (i.obj) {
      i.obj.position.z = z;
      if (i.type === "gem" || i.type === "bullet") {
        i.obj.rotation.y += dt * (i.type === "bullet" ? 3.2 : 2);
        i.obj.position.y =
          Math.sin(state.time * 4 + i.d) * (i.type === "bullet" ? 0.08 : 0.12);
      }
      if (i.spin) {
        if (i.type === "rotor")
          i.spin.rotation.y +=
            dt * 4 * (active("freeze") ? 0 : active("slow") ? 0.55 : 1);
        else i.spin.position.x = i.offset;
      }
      i.obj.visible = !i.hit;
    }
    // Magnet is collection-only and never mutates lane ownership or item identity.
    if (
      !i.hit &&
      (i.type === "gem" || i.type === "bullet") &&
      active("magnet") &&
      z > -9 &&
      z < 2
    ) {
      i.attraction = Math.min(1, (i.attraction || 0) + dt * 7);
      if (i.obj) {
        i.obj.position.x =
          i.lane * 2.4 + (state.x - i.lane * 2.4) * i.attraction;
        i.obj.position.y = state.y * i.attraction;
        i.obj.position.z = z * (1 - i.attraction);
      }
      if (i.attraction >= 1) collect(i);
    }
    // Per-obstacle collision rules. Low obstacles keep their jump clearances;
    // solid obstacles ignore vertical position entirely, and the overhead
    // laser only passes a grounded runner (staying low / auto-slide).
    const depth =
      i.type === "gap"
        ? 1
        : i.type === "heavy"
          ? 1.5
          : i.type === "laser"
            ? 0.9
            : 0.65;
    const halfWidth =
      i.type === "heavy"
        ? 1.08
        : i.type === "barrier" || i.type === "antiJump" || i.type === "laser"
          ? 1.0
          : 0.77;
    const crosses =
      Math.min(z, z - dz) <= depth && Math.max(z, z - dz) >= -depth;
    if (
      !i.hit &&
      crosses &&
      Math.abs(state.x - (i.lane * 2.4 + i.offset)) < halfWidth
    ) {
      if (i.type === "gem" || i.type === "bullet" || i.type === "gate") {
        if (i.type === "gate" || state.y < 1.9) collect(i);
      } else if (
        i.type === "barrier" ||
        i.type === "antiJump" ||
        i.type === "heavy"
      ) {
        // Jumping cannot clear these; only a lane change can.
        damage(i);
        if (state.phase === "lost") return;
      } else if (i.type === "laser") {
        // The beam is overhead: grounded runners pass under it. Any jump,
        // take-off or airborne frame at the gate is a collision.
        if (state.y > 0.05 || state.vy > 0) damage(i);
        if (state.phase === "lost") return;
      } else {
        const clearance =
          i.type === "gap" ? 0.25 : i.type === "slider" ? 1.3 : 1.2;
        if (state.y < clearance) damage(i);
        if (state.phase === "lost") return;
      }
    }
  }
  items = items.filter((i) => {
    if (state.distance - i.d > 12) {
      releaseItem(i);
      return false;
    }
    return true;
  });
  for (const p of projectiles) {
    p.z -= SHOOT.speed * dt;
    p.ttl -= dt;
    if (p.obj) {
      p.obj.position.z = p.z;
      p.obj.position.x = p.lane * 2.4;
    }
    if (p.ttl <= 0 || p.z < -80) continue;
    for (const i of items) {
      if (i.hit || i.lane !== p.lane || i.d < state.distance) continue;
      if (["gem", "bullet", "gate"].includes(i.type)) continue;
      const iz = state.distance - i.d;
      if (Math.abs(iz - p.z) > 0.95) continue;
      p.ttl = 0;
      if (SHOOTABLE.has(i.type)) destroyObstacle(i);
      else spawnSparks(i.lane * 2.4, 0.95, iz, 0xcfd8e3, 0xffffff, 5, 0.25);
      break;
    }
  }
  if (muzzleLife > 0) muzzleLife = Math.max(0, muzzleLife - dt);
  projectiles.forEach((p) => {
    if (p.ttl <= 0) releaseProjectile(p);
  });
  projectiles = projectiles.filter((p) => p.ttl > 0);
  const target = runTarget();
  if (Number.isFinite(target) && state.distance >= target) {
    state.distance = target;
    end(true);
  }
  updateUI();
}
function drawLite() {
  let c = fallback.getContext("2d"),
    w = fallback.width,
    h = fallback.height;
  c.fillStyle = "#38d0df";
  c.fillRect(0, 0, w, h);
  let horizon = h * 0.3;
  c.fillStyle = "#fff2da";
  c.beginPath();
  c.moveTo(w * 0.4, horizon);
  c.lineTo(w * 0.6, horizon);
  c.lineTo(w * 1.1, h);
  c.lineTo(-w * 0.1, h);
  c.fill();
  // Kerb + safety railing along both road edges (Lite parity with the 3D
  // boundary): one tapered band per side, a lit hand-rail and a few posts.
  {
    const railSide = (xTop, xBottom, side) => {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10,
          bx = xTop + (xBottom - xTop) * t,
          by = horizon + (h - horizon) * t,
          hgt = 3 + 34 * t * t;
        pts.push([bx, by, bx + side * (1 + 7 * t), by - hgt]);
      }
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) c.lineTo(p[0], p[1]);
      for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][2], pts[i][3]);
      c.closePath();
      c.fillStyle = "#bfae8a";
      c.fill();
      c.beginPath();
      c.moveTo(pts[0][2], pts[0][3]);
      for (const p of pts) c.lineTo(p[2], p[3]);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      c.stroke();
      c.strokeStyle = "#8d7d5c";
      c.lineWidth = 2.5;
      for (let i = 2; i < 10; i += 2) {
        const p = pts[i];
        c.beginPath();
        c.moveTo(p[0], p[1]);
        c.lineTo(p[2], p[3]);
        c.stroke();
      }
    };
    railSide(w * 0.4, -w * 0.1, -1);
    railSide(w * 0.6, w * 1.1, 1);
  }
  function project(x, d) {
    let k = 1 / (1 + Math.max(-1, d) * 0.075);
    return [w / 2 + x * w * 0.12 * k, horizon + (h * 0.82 - horizon) * k, k];
  }
  for (let i of [...items].sort((a, b) => b.d - a.d)) {
    if (i.hit) continue;
    let d = i.d - state.distance;
    if (d < -3 || d > 90) continue;
    let [x, y, k] = project(i.lane * 2.4 + (i.offset || 0), d);
    const tint = "#" + colors[i.type].toString(16).padStart(6, "0");
    c.fillStyle = tint;
    if (i.type === "gem") {
      c.beginPath();
      c.moveTo(x, y - 35 * k);
      c.lineTo(x + 14 * k, y - 17 * k);
      c.lineTo(x, y);
      c.lineTo(x - 14 * k, y - 17 * k);
      c.fill();
    } else if (i.type === "bullet") {
      // Cyan dart, distinct from the green Jam diamond.
      c.fillStyle = "#54e0ff";
      c.beginPath();
      c.moveTo(x, y - 34 * k);
      c.lineTo(x + 9 * k, y - 12 * k);
      c.lineTo(x, y);
      c.lineTo(x - 9 * k, y - 12 * k);
      c.fill();
      c.fillStyle = "#ffffff";
      c.fillRect(x - 2 * k, y - 26 * k, 4 * k, 14 * k);
    } else if (i.type === "laser") {
      // Tall gate with an overhead beam; grounded runners pass underneath.
      c.fillStyle = "#2b2d42";
      c.fillRect(x - 38 * k, y - 96 * k, 9 * k, 96 * k);
      c.fillRect(x + 29 * k, y - 96 * k, 9 * k, 96 * k);
      c.fillStyle = tint;
      c.fillRect(x - 38 * k, y - 94 * k, 76 * k, 6 * k);
      c.fillStyle = "#ffd25f";
      c.fillRect(x - 30 * k, y - 3 * k, 60 * k, 4 * k);
    } else if (i.type === "barrier") {
      c.fillStyle = "#2b2d42";
      c.fillRect(x - 36 * k, y - 94 * k, 72 * k, 94 * k);
      c.fillStyle = tint;
      for (let row = 0; row < 4; row++)
        c.fillRect(x - 32 * k, y - (80 - row * 20) * k, 64 * k, 9 * k);
    } else if (i.type === "antiJump") {
      c.fillStyle = "#3b2a66";
      c.fillRect(x - 36 * k, y - 92 * k, 10 * k, 92 * k);
      c.fillRect(x + 26 * k, y - 92 * k, 10 * k, 92 * k);
      c.fillStyle = tint;
      for (let row = 0; row < 4; row++)
        c.fillRect(x - 32 * k, y - (82 - row * 21) * k, 64 * k, 8 * k);
    } else if (i.type === "heavy") {
      c.fillStyle = tint;
      c.fillRect(x - 39 * k, y - 62 * k, 78 * k, 62 * k);
      c.fillStyle = "#ffd25f";
      for (let row = 0; row < 3; row++)
        c.fillRect(x - 39 * k, y - (52 - row * 19) * k, 78 * k, 6 * k);
    } else {
      c.fillRect(x - 32 * k, y - 45 * k, 64 * k, 45 * k);
      if (i.type !== "gap") {
        c.fillStyle = "white";
        c.fillRect(x - 18 * k, y - 34 * k, 12 * k, 12 * k);
        c.fillRect(x + 6 * k, y - 34 * k, 12 * k, 12 * k);
      }
    }
  }
  for (const p of projectiles) {
    if (p.z > 0) continue;
    const [px, py, pk] = project(p.lane * 2.4, -p.z);
    c.fillStyle = "#9ff4ff";
    c.fillRect(px - 3 * pk, py - 62 * pk, 6 * pk, 16 * pk);
    c.fillStyle = "#ffffff";
    c.fillRect(px - 1.5 * pk, py - 64 * pk, 3 * pk, 6 * pk);
  }
  let [x, y] = project(state.x, 0);
  y -= state.y * 38;
  if (active("shield") || active("invincible") || state.recovery > 0) {
    c.strokeStyle = "#fff36b";
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(x, y - 55, 39, 74, 0, 0, 7);
    c.stroke();
  }
  // Same silhouette, chosen runner's palette (Lite renderer parity).
  const pc = characterById(selectedCharacter).ui;
  c.fillStyle = pc.body;
  c.beginPath();
  c.ellipse(x, y - 7, 33, 18, 0, 0, 7);
  c.fill();
  c.fillStyle = pc.body;
  c.beginPath();
  c.roundRect(x - 22, y - 110, 44, 112, 22);
  c.fill();
  c.fillStyle = pc.nail;
  c.beginPath();
  c.ellipse(x, y - 84, 13, 18, 0, 0, 7);
  c.fill();
  c.fillStyle = pc.pupil;
  c.beginPath();
  c.arc(x - 9, y - 43, 3, 0, 7);
  c.arc(x + 9, y - 43, 3, 0, 7);
  c.fill();
  c.strokeStyle = pc.mouth;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y - 31, 7, 0, Math.PI);
  c.stroke();
}
let last = 0,
  slow = 0,
  adaptive = false;
function loop(t) {
  let dt = Math.min(0.1, Math.max(0, (t - last) / 1000) || 0.016);
  last = t;
  if (
    renderer &&
    !adaptive &&
    settings.quality === "auto" &&
    state.phase === "playing"
  ) {
    slow = dt > 0.029 ? slow + dt : Math.max(0, slow - dt);
    if (slow > 2) {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      adaptive = true;
      resize();
    }
  }
  if (state.phase === "countdown") tickCountdown(dt);
  // Substeps keep jump/collision physics stable without slowing timers at 20–30 FPS.
  if (state.phase === "playing") {
    let remaining = dt;
    while (remaining > 1e-8 && state.phase === "playing") {
      const slice = Math.min(0.02, remaining);
      step(slice);
      remaining -= slice;
    }
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $("toast").textContent = "";
  }
  if (renderer) {
    hero.position.x = state.x;
    hero.position.y =
      state.y +
      (state.phase === "playing"
        ? Math.abs(Math.sin(state.time * 11)) * 0.12
        : Math.sin(t * 0.002) * 0.06);
    hero.rotation.z =
      state.phase === "playing"
        ? (state.x - state.lane * 2.4) * -0.1
        : Math.sin(t * 0.001) * 0.06;
    hero.scale.x = 1 + state.hitFlash * 0.15;
    if (state.hitFlash > 0)
      hero.rotation.z += Math.sin(state.time * 35) * state.hitFlash * 0.35;
    hero.scale.y =
      (1 + state.growth * 0.6) *
      (state.landing > 0 ? 0.92 : state.y > 0 ? 1.04 : 1);
    if (powerRing) {
      const p = Object.values(state.powers)[0];
      powerRing.visible = !!p;
      powerRing.position.set(state.x, 0.06, 0);
      powerRing.rotation.z = state.time * 2;
      if (p) powerRing.material.color.setHex(p.color || 0xffffff);
      powerRing.scale.setScalar(
        active("speed") ? 1.1 + Math.sin(state.time * 12) * 0.1 : 1,
      );
    }
    if (muzzle) {
      muzzle.visible = muzzleLife > 0;
      if (muzzleLife > 0) {
        muzzle.position.set(state.x, 0.95 + state.y, -0.85);
        const k = muzzleLife / 0.18;
        muzzle.scale.setScalar(0.6 + (1 - k) * 1.5);
        muzzle.material.opacity = 0.9 * k;
      }
    }
    if (aura) {
      aura.visible =
        active("shield") || active("invincible") || state.recovery > 0;
      aura.material.color.setHex(
        active("invincible") ? 0xffe35b : charAuraColor,
      );
      aura.material.wireframe = active("invincible");
      aura.rotation.y += dt;
    }
    hero.visible =
      state.recovery > 0 ? Math.floor(state.time * 12) % 2 === 0 : true;
    const blink = Math.sin(t * 0.002) > 0.992 ? 0.12 : 1;
    for (const eye of heroEyes) eye.scale.y = blink;
    for (const d of heroDecor)
      if (d.userData.spin) d.rotation.y += dt * 1.8;
    if (state.phase !== "paused")
      for (let d of decor) {
        d.position.z +=
          state.phase === "playing" ? state.worldSpeed * dt : dt * 2;
        if (d.position.z > 12) d.position.z -= 108;
      }
    if (state.phase !== "paused")
      for (let p of particles) {
        p.life -= dt;
        p.obj.position.x += p.vx * dt;
        p.obj.position.y += p.vy * dt;
        p.obj.position.z += p.vz * dt;
        p.vy -= 10 * dt;
        p.obj.scale.setScalar(Math.max(0, p.life / 0.65));
      }
    particles = particles.filter((p) => {
      if (p.life <= 0) {
        releaseParticle(p);
        return false;
      }
      return true;
    });
    if (previewActive && previewRenderer && previewScene) {
      const model = previewModels[pendingCharacter];
      if (model) model.rotation.y = 0.35 + Math.sin(t * 0.0009) * 0.5;
      previewRenderer.render(previewScene, previewCamera);
    }
    camera.position.x += (state.x * 0.17 - camera.position.x) * dt * 3;
    if (finish) {
      finish.visible =
        ["sprint", "level"].includes(state.mode) && state.phase !== "menu";
      finish.position.z = state.distance - runTarget();
    }
    // Context loss can precede the browser event by one animation frame.
    if (!renderer.getContext().isContextLost()) renderer.render(scene, camera);
  } else if (fallback) drawLite();
  requestAnimationFrame(loop);
}
function syncModeButtons() {
  for (const m of ["sprint", "endless", "levels"])
    $(m).classList.toggle("selected", m === state.mode);
}
function renderLevels() {
  const grid = $("levelGrid");
  if (!grid) return;
  // A rolling window keeps the list lightweight while future levels stay
  // visible as locked cards; "MORE LEVELS" extends it by ten.
  // Cap the window so a tampered save cannot build thousands of DOM nodes on
  // a phone; legitimate play never approaches this many levels.
  const total = Math.min(
    200,
    Math.max(15, levelProgress.unlocked + 4, levelWindow),
  );
  grid.innerHTML = "";
  for (let n = 1; n <= total; n++) {
    const unlocked = n <= levelProgress.unlocked;
    const done = levelProgress.completed.includes(n);
    const map = mapForLevel(n);
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "levelCard " +
      (unlocked ? "unlocked" : "locked") +
      (done ? " done" : "") +
      (isMilestoneLevel(n) ? " milestone" : "") +
      (n === levelProgress.unlocked ? " current" : "");
    card.dataset.level = n;
    card.dataset.map = map;
    card.disabled = !unlocked;
    card.setAttribute(
      "aria-label",
      `Level ${n}, map ${map} ${MAPS[map - 1].name}, ${levelDistance(n)} metres total, ${levelRunDistance(n)} metres this level, ${done ? "completed" : unlocked ? "unlocked" : "locked"}`,
    );
    card.innerHTML =
      `<span class="lvNum">LEVEL ${n}${isMilestoneLevel(n) ? " ★" : ""}</span>` +
      `<span class="lvMap">MAP ${map} · ${MAPS[map - 1].name.toUpperCase()}</span>` +
      `<span class="lvDist">${levelDistance(n)} m total</span>` +
      `<span class="lvRun">${levelRunDistance(n)} m this level</span>` +
      `<span class="lvState">${done ? "✔ CLEARED" : unlocked ? "▶ PLAY" : "🔒 LOCKED"}</span>` +
      (isMilestoneLevel(n) ? '<span class="lvBadge">★ MILESTONE</span>' : "");
    grid.appendChild(card);
  }
  $("levelProgressLine").textContent =
    `UNLOCKED ${levelProgress.unlocked} · CLEARED ${levelProgress.completed.length} · CHECKPOINT ${levelProgress.total} m`;
  renderMapStrip();
}
function renderMapStrip() {
  const strip = $("mapStrip");
  if (!strip) return;
  strip.innerHTML = "";
  for (let m = 1; m <= MAPS.length; m++) {
    const open = m <= levelProgress.mapsUnlocked;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "mapChip " + (open ? "open" : "locked");
    chip.dataset.map = m;
    chip.disabled = !open;
    chip.title = open
      ? `${MAPS[m - 1].name} — levels ${firstLevelOfMap(m)}–${firstLevelOfMap(m) + 4}`
      : `${MAPS[m - 1].name} — complete level ${firstLevelOfMap(m)} to unlock`;
    chip.innerHTML =
      `<b>MAP ${m}</b><span>${MAPS[m - 1].name}</span><em>${open ? "OPEN" : "🔒"}</em>`;
    strip.appendChild(chip);
  }
  if ($("mapUnlockedLine"))
    $("mapUnlockedLine").textContent =
      `MAPS UNLOCKED ${levelProgress.mapsUnlocked} / ${MAPS.length}`;
}
function focusMap(m) {
  const first = firstLevelOfMap(m);
  levelWindow = Math.max(levelWindow, first + 4);
  renderLevels();
  const card = document.querySelector(`.levelCard[data-level="${first}"]`);
  if (!card) return;
  card.scrollIntoView({ block: "center", behavior: "smooth" });
  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 1300);
}
function openLevels() {
  if (["playing", "countdown"].includes(state.phase)) pause();
  renderLevels();
  $("levelPanel").hidden = false;
  $("closeLevels").focus?.();
}
function closeLevels() {
  $("levelPanel").hidden = true;
}

// ---------------------------- character sheet ----------------------------
function portraitSVG(c, extra = "") {
  const u = c.ui;
  const aura =
    c.id === "original"
      ? ""
      : `<circle cx="24" cy="34" r="17" fill="${u.glow}" opacity="0.18"/>`;
  const deco =
    {
      spikes: `<path d="M15 11 L17.5 3 L20.5 11 Z" fill="${u.nail}"/><path d="M33 11 L30.5 4.5 L27.5 11 Z" fill="${u.nail}"/>`,
      circuit: `<rect x="9" y="24.5" width="30" height="3.2" rx="1.6" fill="${u.glow}"/><circle cx="24" cy="52" r="4" fill="${u.glow}"/><rect x="23.1" y="4" width="1.8" height="9" fill="${u.glow}"/><circle cx="24" cy="3" r="2.8" fill="${u.glow}"/>`,
      flames: `<path d="M16 12 Q19 2 23 9 Q25 1 29 9.5 Q31 4.5 33 12 Z" fill="${u.nail}"/>`,
      crystals: `<path d="M10 23 L14.5 12 L19 23 Z" fill="${u.nail}" opacity="0.92"/><path d="M29 21 L33.5 9 L38 21 Z" fill="${u.nail}" opacity="0.85"/>`,
      stars: `<circle cx="17" cy="17" r="1.8" fill="#fff"/><circle cx="31" cy="25" r="1.5" fill="#fff"/><circle cx="21" cy="48" r="1.3" fill="#fff"/><ellipse cx="24" cy="44" rx="17" ry="4.6" fill="none" stroke="${u.nail}" stroke-width="1.6" opacity="0.85" transform="rotate(-16 24 44)"/>`,
    }[c.deco] || "";
  return `<svg class="charArt ${extra}" viewBox="0 0 48 64" aria-hidden="true">${aura}<ellipse cx="24" cy="57" rx="14" ry="6" fill="${u.shade}"/><rect x="13" y="10" width="22" height="46" rx="11" fill="${u.body}" stroke="${u.shade}" stroke-width="0.9"/><ellipse cx="24" cy="21" rx="6.5" ry="8.5" fill="${u.nail}"/>${deco}<circle cx="19" cy="33" r="2.2" fill="${u.pupil}"/><circle cx="29" cy="33" r="2.2" fill="${u.pupil}"/><path d="M20 41 q4 3.6 8 0" stroke="${u.mouth}" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
}
function renderCharacters() {
  const grid = $("charGrid");
  if (!grid) return;
  const list = charactersForSheet();
  grid.innerHTML = list
    .map((c) => {
      const data = characterById(c.id);
      const ui = data.ui;
      const state = c.selected
        ? "SELECTED"
        : c.unlocked
          ? "TAP TO PREVIEW"
          : `🔒 CLEAR LEVEL ${c.need}`;
      return `<button type="button" class="charCard${c.selected ? " isSelected" : ""}${c.unlocked ? "" : " locked"}${
        c.id === pendingCharacter ? " isPending" : ""
      }" data-char="${c.id}" style="--cardWash:${ui.wash};--cardEdge:${ui.edge};--cardInk:${ui.ink};--cardGlow:${ui.glow}"${
        c.unlocked ? "" : ' aria-disabled="true"'
      } aria-label="${c.name}${c.selected ? " (selected)" : c.unlocked ? "" : `, locked until level ${c.need} is cleared`}">
        <span class="charArtWrap">${portraitSVG(data)}</span>
        <span class="charName">${c.name}</span>
        <span class="charState">${state}</span>
      </button>`;
    })
    .join("");
}
function syncCharacterChip() {
  const c = characterById(selectedCharacter);
  const art = $("heroChipArt");
  if (art) art.innerHTML = portraitSVG(c);
  const name = $("heroChipName");
  if (name) name.textContent = c.name;
  const chip = $("heroPick");
  if (chip) chip.style.setProperty("--chipGlow", c.ui.glow);
}
function initCharacterPreview() {
  if (previewRenderer) return true;
  if (!T) return false;
  const canvas = $("charPreview");
  if (!canvas) return false;
  try {
    const pr = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    pr.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    pr.setClearColor(0x000000, 0);
    const s = new T.Scene();
    s.add(new T.HemisphereLight(0xffffff, 0x25404f, 1.8));
    const key = new T.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 5, 4);
    s.add(key);
    const rim = new T.DirectionalLight(0xaad8ff, 0.9);
    rim.position.set(-3, 2.5, -3);
    s.add(rim);
    const cam = new T.PerspectiveCamera(30, 1, 0.1, 40);
    cam.position.set(0, 2.3, 6.3);
    cam.lookAt(0, 1.12, 0);
    previewRenderer = pr;
    previewScene = s;
    previewCamera = cam;
    return true;
  } catch {
    previewRenderer = null;
    return false;
  }
}
function syncCharacterPreview() {
  const c = characterById(pendingCharacter);
  const unlocked = characterUnlocked(c);
  $("charPreviewName").textContent = c.name;
  $("charPreviewNote").textContent =
    c.id === selectedCharacter
      ? "Currently running"
      : unlocked
        ? c.tag
        : `Clear level ${c.need} to unlock`;
  const art = $("charPreviewArt");
  art.innerHTML = portraitSVG(c, "big");
  const btn = $("charSelect");
  const equipped = c.id === selectedCharacter;
  btn.textContent = equipped ? "EQUIPPED ✓" : "SELECT RUNNER";
  btn.disabled = equipped || !unlocked;
  const ok3d = initCharacterPreview();
  $("charPreview").hidden = !ok3d;
  art.classList.toggle("hidden", ok3d);
  if (!ok3d) return;
  if (!previewModels[c.id]) previewModels[c.id] = buildHeroBody(c, previewScene);
  for (const key of Object.keys(previewModels))
    previewModels[key].visible = key === c.id;
  const size = Math.round($("charPreview").clientWidth || 168);
  if (size > 0) {
    previewRenderer.setSize(size, size, false);
    previewCamera.aspect = 1;
    previewCamera.updateProjectionMatrix();
  }
}
function openCharacters() {
  if (["playing", "countdown"].includes(state.phase)) pause();
  pendingCharacter = selectedCharacter;
  renderCharacters();
  $("characterPanel").hidden = false;
  syncCharacterPreview();
  previewActive = !!previewRenderer;
  $("closeCharacters").focus?.();
}
function closeCharacters() {
  previewActive = false;
  $("characterPanel").hidden = true;
}
function chooseCharacter(id) {
  const c = characterById(id);
  if (!characterUnlocked(c)) return false;
  pendingCharacter = c.id;
  renderCharacters();
  syncCharacterPreview();
  beep(520, 0.05);
  return true;
}
$("charGrid").addEventListener("click", (e) => {
  const card = e.target.closest?.(".charCard");
  if (!card) return;
  if (!chooseCharacter(card.dataset.char)) {
    const c = characterById(card.dataset.char);
    card.classList.remove("nope");
    void card.offsetWidth;
    card.classList.add("nope");
    $("charPreviewNote").textContent = `Locked — clear level ${c.need} first`;
    vibrate(40);
  }
});
$("charSelect").onclick = () => {
  if (!applyCharacter(pendingCharacter)) return;
  closeCharacters();
  beep(760, 0.08);
};
$("charBack").onclick = closeCharacters;
$("closeCharacters").onclick = closeCharacters;
$("heroPick").onclick = openCharacters;
renderCharacters();
syncCharacterChip();

function startLevel(n) {
  n = Math.floor(Number(n)) || 1;
  if (n < 1) n = 1;
  // Locked levels are rejected, never silently swapped for another level.
  if (n > levelProgress.unlocked) return false;
  state.mode = "level";
  state.level = n;
  applyMapTheme(mapForLevel(n));
  closeLevels();
  $("play").hidden = false;
  $("continueLevel").hidden = true;
  $("replayLevel").hidden = true;
  $("levelsFromEnd").hidden = true;
  $("levelActions").hidden = true;
  showMapUnlock(0);
  syncModeButtons();
  beginCountdown();
  return true;
}
$("levelGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".levelCard");
  if (!card || card.disabled) return;
  startLevel(Number(card.dataset.level));
});
$("mapStrip")?.addEventListener("click", (e) => {
  const chip = e.target.closest(".mapChip");
  if (!chip || chip.disabled) return;
  focusMap(Number(chip.dataset.map));
});
$("continueRun").onclick = () => {
  if (state.phase !== "menu") return;
  if (!startLevel(levelProgress.unlocked)) openLevels();
};
$("replayLevel").onclick = () => startLevel(state.level);
$("levelsFromEnd").onclick = openLevels;
$("levelMore").onclick = () => {
  levelWindow = Math.max(
    levelWindow,
    Math.max(15, levelProgress.unlocked + 4),
  ) + 10;
  renderLevels();
};
$("levels").onclick = openLevels;
$("closeLevels").onclick = closeLevels;
$("continueLevel").onclick = () => {
  const next = state.level + 1;
  if (next <= levelProgress.unlocked) startLevel(next);
  else openLevels();
};
$("play").onclick = () => {
  if (state.phase === "paused") pause();
  else if (state.phase === "won" && state.mode === "level")
    $("continueLevel").click();
  else beginCountdown();
};
$("restart").onclick = beginCountdown;
$("pause").onclick = pause;
$("left").onclick = () => move(-1);
$("right").onclick = () => move(1);
$("jump").onclick = jump;
$("shoot").onclick = shoot;
$("power").onclick = activatePower;
$("sound").onclick = () => {
  settings.sound = !settings.sound;
  syncSettings();
  saveSettings();
  if (!muted) beep();
};
for (let mode of ["sprint", "endless"])
  $(mode).onclick = () => {
    state.mode = mode;
    applyMapTheme(10); // sprint/endless keep the original Candy World look
    closeLevels();
    syncModeButtons();
    $("level").textContent =
      mode === "sprint" ? "SUNSHINE SPRINT" : "ENDLESS ADVENTURE";
    updateUI();
  };
$("home").onclick = () => {
  cancelCountdown();
  state.phase = "menu";
  // Leaving a level returns to the normal menu default; the level map, not
  // the big DASH button, is how a level is chosen.
  if (state.mode === "level") state.mode = "endless";
  applyMapTheme(mapForLevel(levelProgress.unlocked));
  clear();
  resetRunSystems();
  updateUI();
  $("pause").disabled = true;
  $("restart").hidden = true;
  state.x = 0;
  state.growth = 0;
  $("intro").hidden = false;
  $("eyebrow").textContent = "TINY HERO. BIG ENERGY. · v2.7.0";
  $("title").innerHTML = "Finger<br><em>Dash</em><sup>3D</sup>";
  $("description").textContent = "One little finger. A whole lot of adventure.";
  $("play").hidden = false;
  $("play").innerHTML = "LET’S DASH <span>→</span>";
  $("continueLevel").hidden = true;
  $("replayLevel").hidden = true;
  $("levelsFromEnd").hidden = true;
  $("levelActions").hidden = true;
  $("home").hidden = true;
  showMapUnlock(0);
  closeLevels();
  syncModeButtons();
  renderLevels();
  syncContinueButton();
  $("hint").innerHTML =
    "Swipe or drag to change lanes<br>Desktop: ← → or A / D · P to pause";
};
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(e.key))
    e.preventDefault();
  if (e.repeat) return;
  if ([" ", "ArrowUp", "w", "W"].includes(e.key)) jump();
  if (["f", "F"].includes(e.key)) shoot();
  if (["e", "E"].includes(e.key)) activatePower();
  if (["ArrowLeft", "a", "A"].includes(e.key)) move(-1);
  if (["ArrowRight", "d", "D"].includes(e.key)) move(1);
  if (["p", "P", "Escape"].includes(e.key)) pause();
});
// Responsive horizontal steering: commit once after 70 CSS pixels, not only
// on release (a late release could previously arrive after an obstacle hit).
function pointerDown(e){
 if(state.phase!=='playing'||gesture||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
 if(e.target?.closest?.('button,input,select,dialog,#overlay'))return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,done:false};
 try{$('app').setPointerCapture(e.pointerId)}catch{}
}
function completeLaneSwipe(e){
 if(!gesture||gesture.id!==e.pointerId||gesture.done)return;
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 if(Math.abs(dx)>=70&&Math.abs(dx)>Math.abs(dy)*1.2){gesture.done=true;lastAction='Lane swipe '+(dx>0?'right':'left');move(Math.sign(dx))}
}
function pointerMove(e){if(gesture?.id===e.pointerId){if(e.cancelable)e.preventDefault();completeLaneSwipe(e)}}
function pointerUp(e){if(!gesture||gesture.id!==e.pointerId)return;completeLaneSwipe(e);gesture=null;try{if($('app').hasPointerCapture(e.pointerId))$('app').releasePointerCapture(e.pointerId)}catch{}}
function pointerCancel(e){if(gesture?.id===e.pointerId)gesture=null}
$('app').addEventListener('pointerdown',pointerDown);
$('app').addEventListener('pointermove',pointerMove,{passive:false});
$('app').addEventListener('pointerup',pointerUp);
$('app').addEventListener('pointercancel',pointerCancel);
$('app').addEventListener('lostpointercapture',pointerCancel);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["playing", "countdown"].includes(state.phase))
    pause();
});
// Explicit opt-in deterministic hooks for the automated test suite, absent in normal play.
if (new URLSearchParams(location.search).has("test"))
  window.__test = {
    state,
    collect,
    shoot,
    shootTarget,
    SHOOT,
    SHOOTABLE,
    projectiles: () => projectiles,
    awardMilestones,
    activatePower,
    jump,
    damage,
    tickRunSystems,
    POWER_DEFS,
    PROGRESSION,
    LEVELS,
    MAPS,
    mapForLevel,
    firstLevelOfMap,
    levelDistance,
    levelStartDistance,
    levelRunDistance,
    applyMapTheme,
    currentMap: () => currentMapIndex,
    scenery: () => scenery,
    bg: () => bgGroup,
    scene: () => scene,
    drawCalls: () => renderer?.info?.render?.calls ?? -1,
    isMilestoneLevel,
    levelProgress: () => levelProgress,
    runTarget,
    startLevel,
    openLevels,
    closeLevels,
    completeLevel,
    renderLevels,
    saveLevelProgress,
    applyPower,
    pointerDown,
    pointerUp,pointerMove,
    start,
    step,
    beginCountdown,
    tickCountdown,
    settings,
    clear,
    createItem,
    end,
    move,
    pause,
    pools: () => pools,
    particles: () => particles,
    items: () => items,
    stats: () => renderer?.info,
    renderer: () => !!renderer,
    loseContext: () => renderer?.forceContextLoss(),
    audio: () => audio?.state,
    particlePool: () => particlePool,
    CHARACTERS,
    characterById,
    characterUnlocked,
    charactersForSheet,
    applyCharacter,
    selectedCharacter: () => selectedCharacter,
    unlockedCharacterIds,
    pendingCharacter: () => pendingCharacter,
    renderCharacters,
    openCharacters,
    closeCharacters,
    heroBody: () => heroBody,
    heroEyes: () => heroEyes,
    heroBodies: () => heroBodies,
    BOUNDARY,
    boundaries: () => ({
      built: !!boundaryGroup,
      name: boundaryGroup?.name || "",
      curbs: boundaryCurbs.length,
      topRails: boundaryTopRails.length,
      midRails: boundaryMidRails.length,
      postDrawCalls: boundaryPosts.length,
      posts: boundaryPosts.reduce((n, p) => n + p.count, 0),
      meshes: boundaryGroup ? boundaryGroup.children.length : 0,
      kerbInnerX: BOUNDARY.halfRoad,
      kerbOuterX: BOUNDARY.kerbX + BOUNDARY.kerbW / 2,
      railX: BOUNDARY.railX,
      railTopY: BOUNDARY.railTop,
      zNear: BOUNDARY.centreZ + BOUNDARY.spanZ / 2,
      zFar: BOUNDARY.centreZ - BOUNDARY.spanZ / 2,
      laneLimit: BOUNDARY.laneX,
      staticGroup: !!boundaryGroup && boundaryGroup.parent === road,
    }),
    heroMeshCount: (id) => {
      let n = 0;
      (heroBodies[id] || heroBody)?.traverse?.((o) => o.isMesh && n++);
      return n;
    },
  };

// Menu state machine: no world simulation takes place during countdown or pause.
let countdownRemaining = 0,
  countdownLast = 0;
function cancelCountdown() {
  countdownRemaining = 0;
  $("countdown").hidden = true;
}
function beginCountdown() {
  if (!ready) return;
  if ($("settingsDialog").open) return;
  start();
  state.phase = "countdown";
  updateControls();
  countdownRemaining = 3.2;
  countdownLast = 0;
  $("countdown").hidden = false;
  $("countdown").querySelector("strong").textContent = "3";
  audio?.resume().catch(() => {});
  beep(420, 0.08);
}
function tickCountdown(dt) {
  countdownRemaining -= dt;
  let n = Math.ceil(countdownRemaining - 0.2);
  if (n <= 0) {
    cancelCountdown();
    state.phase = "playing";
    updateControls();
    beep(1000, 0.13);
    return;
  }
  if (n !== countdownLast) {
    countdownLast = n;
    beep(420, 0.07);
  }
  $("countdown").querySelector("strong").textContent = n;
}
function applyQuality() {
  if (!renderer) return;
  adaptive = false;
  slow = 0;
  let low = settings.quality === "low";
  renderer.setPixelRatio(
    low
      ? 1
      : Math.min(devicePixelRatio, settings.quality === "high" ? 1.6 : 1.35),
  );
  renderer.shadowMap.enabled = !low;
  resize();
}
renderLevels();
syncContinueButton();
function syncSettings() {
  muted = !settings.sound;
  $("sound").textContent = muted ? "♪̸" : "♪";
  $("sound").setAttribute("aria-pressed", String(!muted));
  $("soundSetting").checked = settings.sound;
  $("autoPowerSetting").checked = settings.autoPowers;
  $("vibrationSetting").checked = settings.vibration;
  $("qualitySetting").value = settings.quality;
  $("vibrationNote").textContent =
    typeof navigator.vibrate === "function"
      ? "Vibration is optional; your browser or device may ignore it."
      : "Vibration is not supported in this browser.";
  $("vibrationSetting").disabled = typeof navigator.vibrate !== "function";
  $("storageNote").textContent = storageOK
    ? "Best score and settings save on this device."
    : "Storage is unavailable. Scores and settings will last only this session.";
}
$("settings").onclick = () => {
  if (["playing", "countdown"].includes(state.phase)) pause();
  syncSettings();
  $("diagnosticOutput").textContent=JSON.stringify(window.FingerDashDiagnostics(),null,2);
  $("settingsDialog").showModal();
};
function closeSettings() {
  $("settingsDialog").close();
}
$("closeSettings").onclick = closeSettings;
$("doneSettings").onclick = closeSettings;
$("newGame").onclick = () => {
  closeSettings();
  $("resetDialog").showModal();
};
$("cancelReset").onclick = () => $("resetDialog").close();
$("cancelReset2").onclick = () => $("resetDialog").close();
$("confirmReset").onclick = () => {
  resetLevelProgress();
  $("resetDialog").close();
  state.level = 1;
  state.mode = "endless";
  $("home").click();
  applyMapTheme(1, true);
  syncContinueButton();
  beep(300, 0.2);
};
$("soundSetting").onchange = (e) => {
  settings.sound = e.target.checked;
  syncSettings();
  saveSettings();
  beep();
};
$("vibrationSetting").onchange = (e) => {
  settings.vibration = e.target.checked;
  saveSettings();
  vibrate(30);
};
$('autoPowerSetting').checked = true;
$('autoPowerSetting').disabled = true;
$("qualitySetting").onchange = (e) => {
  settings.quality = e.target.value;
  applyQuality();
  saveSettings();
};
// Escape closes settings, not the paused game beneath it.
window.addEventListener(
  "keydown",
  (e) => {
    if ($("settingsDialog").open) e.stopImmediatePropagation();
  },
  true,
);
$("pause").disabled = true;
$("play").disabled = true;
syncSettings();
updateUI();
init();
