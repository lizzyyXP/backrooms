"use strict";

const WIDTH = 900;
const HEIGHT = 720;
const COLS = 20;
const ROWS = 12;
const CELL_W = WIDTH / COLS;
const CELL_H = HEIGHT / ROWS;
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const characters = [
  { key: "runner", name: "Elliot", gender: "MENINO", subtitle: "rápido e evasivo", color: "#6edc8c" },
  { key: "guardian", name: "Luigi", gender: "MENINO", subtitle: "forte e resistente", color: "#78aaff" },
  { key: "ghost", name: "Nixie", gender: "MENINA", subtitle: "silenciosa e furtiva", color: "#ffbe6e" },
  { key: "scout", name: "Yunah", gender: "MENINA", subtitle: "inteligente e observadora", color: "#dc87cd" },
];

const monsters = [
  { name: "Rastejante", color: "#8fbe5e", image: "monster_crawler" },
  { name: "Chifrudo", color: "#b8533a", image: "monster_horned" },
  { name: "Brutamontes", color: "#686491", image: "monster_brute" },
  { name: "Aparição", color: "#66bebe", image: "monster_wraith" },
];

function buildLevel(verticalGaps, horizontalGaps) {
  const level = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let x = 0; x < COLS; x += 1) {
    level[0][x] = 1;
    level[ROWS - 1][x] = 1;
  }
  for (let y = 0; y < ROWS; y += 1) {
    level[y][0] = 1;
    level[y][COLS - 1] = 1;
  }
  for (const [x, gaps] of Object.entries(verticalGaps)) {
    for (let y = 1; y < ROWS - 1; y += 1) {
      if (!gaps.includes(y)) level[y][Number(x)] = 1;
    }
  }
  for (const [y, gaps] of Object.entries(horizontalGaps)) {
    for (let x = 1; x < COLS - 1; x += 1) {
      if (!gaps.includes(x)) level[Number(y)][x] = 1;
    }
  }
  level[10][18] = 2;
  return level;
}

const levels = [
  buildLevel({ 5: [2, 8], 12: [3, 9] }, { 4: [3, 10, 16], 8: [2, 9, 15] }),
  buildLevel({ 5: [4, 9], 9: [2, 6, 9], 12: [2, 7] }, { 4: [4, 5, 6, 14], 7: [3, 10, 16], 8: [4, 11, 17] }),
  buildLevel({ 4: [2, 6, 9], 8: [3, 7], 12: [5, 9], 16: [2, 6, 9] }, { 3: [3, 9, 15], 6: [2, 7, 12, 17], 8: [5, 10, 16] }),
  buildLevel({ 4: [2, 6, 9], 8: [3, 7], 12: [2, 6, 9], 16: [4, 8] }, { 3: [3, 9, 15], 5: [5, 11, 17], 7: [2, 8, 14], 9: [5, 10, 14] }),
];

const enemyPositions = [
  [[17, 2]],
  [[17, 2], [17, 9]],
  [[17, 2], [17, 9], [2, 10]],
  [[17, 2], [17, 9], [2, 10], [10, 1]],
];
const enemyIntervals = [0.95, 0.75, 0.58, 0.43];
const directions = {
  ArrowLeft: [-1, 0, "left"], a: [-1, 0, "left"],
  ArrowRight: [1, 0, "right"], d: [1, 0, "right"],
  ArrowUp: [0, -1, "back"], w: [0, -1, "back"],
  ArrowDown: [0, 1, "front"], s: [0, 1, "front"],
};
const assets = {};
const assetNames = [
  "exit", "floor", "game_over", "wall",
  ...characters.flatMap(({ key }) => [`${key}_front`, `${key}_back`, `${key}_left`, `${key}_right`]),
  ...monsters.map(({ image }) => image),
];

let state = "menu";
let selectedCharacter = 0;
let currentLevel = 0;
let map = levels[0];
let player = { x: 1, y: 1, facing: "front" };
let enemies = [];
let heldDirection = null;
let playerTimer = 0;
let enemyTimer = 0;
let lastFrame = 0;

for (const name of assetNames) {
  const image = new Image();
  image.src = `images/${name}.png`;
  image.addEventListener("error", () => {
    console.error(`Não foi possível carregar a imagem: images/${name}.png`);
  });
  assets[name] = image;
}

function neighbors(x, y) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
}

function connectTarget(level, target) {
  const reachable = new Set(["1,1"]);
  const queue = [[1, 1]];
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    for (const [nx, ny] of neighbors(x, y)) {
      const key = `${nx},${ny}`;
      if (nx > 0 && nx < 19 && ny > 0 && ny < 11 && level[ny][nx] !== 1 && !reachable.has(key)) {
        reachable.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  const startKey = `${target[0]},${target[1]}`;
  const parents = new Map([[startKey, null]]);
  const search = [target];
  let connection = null;
  for (let index = 0; index < search.length && connection === null; index += 1) {
    const [x, y] = search[index];
    const key = `${x},${y}`;
    if (reachable.has(key)) {
      connection = [x, y];
      break;
    }
    for (const [nx, ny] of neighbors(x, y)) {
      const nextKey = `${nx},${ny}`;
      if (nx > 0 && nx < 19 && ny > 0 && ny < 11 && !parents.has(nextKey)) {
        parents.set(nextKey, key);
        search.push([nx, ny]);
      }
    }
  }
  while (connection) {
    const [x, y] = connection;
    if (x !== 18 || y !== 10) level[y][x] = 0;
    const parentKey = parents.get(`${x},${y}`);
    connection = parentKey === null || parentKey === undefined
      ? null
      : parentKey.split(",").map(Number);
  }
}

for (const level of levels) connectTarget(level, [18, 10]);
for (let index = 0; index < levels.length; index += 1) {
  for (const position of enemyPositions[index]) connectTarget(levels[index], position);
  levels[index][10][18] = 2;
}

function loadLevel(index) {
  currentLevel = index;
  map = levels[index];
  player = { x: 1, y: 1, facing: "front" };
  enemies = enemyPositions[index].map(([x, y]) => ({ x, y, image: monsters[index].image }));
  playerTimer = 0;
  enemyTimer = 0;
}

function startGame() {
  loadLevel(0);
  state = "game";
}

function image(name, x, y, width, height, centered = false) {
  const sprite = assets[name];
  if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;
  if (centered) ctx.drawImage(sprite, x - width / 2, y - height / 2, width, height);
  else ctx.drawImage(sprite, x, y, width, height);
}

function text(value, x, y, size, color, align = "left", weight = "normal") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function outline(x, y, width, height, color, thickness = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.strokeRect(x + thickness / 2, y + thickness / 2, width - thickness, height - thickness);
}

function drawMenu() {
  ctx.fillStyle = "#0f1110";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let x = 0; x < WIDTH; x += 90) {
    ctx.fillStyle = "#111412";
    ctx.fillRect(x, 0, 45, HEIGHT);
  }
  ctx.fillStyle = "#181b18";
  ctx.fillRect(24, 20, 852, 680);
  outline(24, 20, 852, 680, "#5b6737", 2);
  text("ARQUIVO  01  /  SETOR DESCONHECIDO", 58, 55, 16, "#b0b78e");
  text("BACKROOMS", WIDTH / 2, 112, 58, "#e8d679", "center", "bold");
  text("FUJA DO LABIRINTO. NÃO OLHE PARA TRÁS.", WIDTH / 2, 170, 20, "#cccfbe", "center");
  text("ESCOLHA SEU PERSONAGEM", WIDTH / 2, 208, 18, "#b0b78e", "center");

  characters.forEach((character, index) => {
    const x = 50 + index * 210;
    const y = 235;
    const selected = index === selectedCharacter;
    ctx.fillStyle = selected ? "#2a3027" : "#1f2320";
    ctx.fillRect(x, y, 190, 230);
    outline(x, y, 190, 230, selected ? character.color : "#495045", selected ? 3 : 2);
    if (selected) text("SELECIONADO", x + 95, y + 18, 13, character.color, "center");
    image(`${character.key}_front`, x + 95, y + 77, 45, 54, true);
    text(character.gender, x + 95, y + 131, 13, character.color, "center");
    text(character.name, x + 95, y + 160, 25, "#fff", "center", "bold");
    text(character.subtitle, x + 95, y + 198, 13, "#cccfbe", "center");
  });

  ctx.fillStyle = "#3e4527";
  ctx.fillRect(300, 530, 300, 70);
  outline(300, 530, 300, 70, "#e8d679", 3);
  text("ENTRAR NO LABIRINTO", WIDTH / 2, 565, 27, "#fff", "center", "bold");
  text("CLIQUE OU USE 1-4 PARA ESCOLHER  |  ENTER: JOGAR", WIDTH / 2, 640, 15, "#b0b78e", "center");
}

function drawGame() {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = map[y][x];
      image(tile === 1 ? "wall" : tile === 2 ? "exit" : "floor",
        x * CELL_W, y * CELL_H, CELL_W, CELL_H);
    }
  }
  const character = characters[selectedCharacter];
  image(`${character.key}_${player.facing}`,
    player.x * CELL_W + CELL_W / 2, player.y * CELL_H + CELL_H / 2, 45, 54, true);
  for (const enemy of enemies) {
    image(enemy.image, enemy.x * CELL_W + CELL_W / 2, enemy.y * CELL_H + CELL_H / 2, 50, 48, true);
  }

  text(`NÍVEL ${currentLevel + 1}`, 18, 25, 20, character.color);
  text(`AMEAÇAS: ${enemies.length}`, WIDTH - 18, 25, 20, "#eb785a", "right");
  text(monsters[currentLevel].name, WIDTH - 18, 49, 16, monsters[currentLevel].color, "right");

  const px = player.x * CELL_W + CELL_W / 2;
  const py = player.y * CELL_H + CELL_H / 2;
  const gradient = ctx.createRadialGradient(px, py, 48, px, py, 150);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.8, "rgba(0, 0, 0, 0.15)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (state === "gameover") {
    image("game_over", 0, 0, WIDTH, HEIGHT);
    text("R = REINICIAR", WIDTH / 2, 560, 30, "#fff", "center", "bold");
  } else if (state === "victory") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    text("VOCÊ ESCAPOU!", WIDTH / 2, 250, 50, "#56df75", "center", "bold");
    text("R = JOGAR NOVAMENTE", WIDTH / 2, 350, 28, "#fff", "center");
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (state === "menu") drawMenu();
  else drawGame();
}

function canMove(x, y) {
  return y >= 0 && y < ROWS && x >= 0 && x < COLS && map[y][x] !== 1;
}

function movePlayer(direction) {
  if (!direction || state !== "game") return;
  const [dx, dy, facing] = direction;
  player.facing = facing;
  if (canMove(player.x + dx, player.y + dy)) {
    player.x += dx;
    player.y += dy;
  }
}

function moveEnemy(enemy) {
  const queue = [[enemy.x, enemy.y, null]];
  const visited = new Set([`${enemy.x},${enemy.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y, firstStep] = queue[index];
    if (x === player.x && y === player.y) {
      if (firstStep) [enemy.x, enemy.y] = firstStep;
      return;
    }
    for (const [nx, ny] of neighbors(x, y)) {
      const key = `${nx},${ny}`;
      if (canMove(nx, ny) && !visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny, firstStep || [nx, ny]]);
      }
    }
  }
}

function update(dt) {
  if (state !== "game") return;
  playerTimer += dt;
  if (playerTimer >= 0.14) {
    playerTimer = 0;
    movePlayer(heldDirection);
  }
  enemyTimer += dt;
  if (enemyTimer >= enemyIntervals[currentLevel]) {
    enemyTimer = 0;
    enemies.forEach(moveEnemy);
  }
  if (enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y)) {
    state = "gameover";
  }
  if (map[player.y][player.x] === 2) {
    if (currentLevel < levels.length - 1) loadLevel(currentLevel + 1);
    else state = "victory";
  }
}

function frame(timestamp) {
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.1);
  lastFrame = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * WIDTH / bounds.width,
    y: (event.clientY - bounds.top) * HEIGHT / bounds.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (state !== "menu") return;
  const point = canvasPoint(event);
  if (point.y >= 530 && point.y <= 600 && point.x >= 300 && point.x <= 600) {
    startGame();
    return;
  }
  characters.forEach((_, index) => {
    const x = 50 + index * 210;
    if (point.x >= x && point.x <= x + 190 && point.y >= 235 && point.y <= 465) {
      selectedCharacter = index;
    }
  });
});

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (state === "menu") {
    if (["1", "2", "3", "4"].includes(key)) selectedCharacter = Number(key) - 1;
    if (key === "Enter" || key === " ") startGame();
    return;
  }
  if ((state === "gameover" || state === "victory") && key.toLowerCase() === "r") {
    startGame();
    return;
  }
  if (directions[key]) {
    event.preventDefault();
    heldDirection = directions[key];
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (directions[key] === heldDirection) heldDirection = null;
});

window.addEventListener("blur", () => { heldDirection = null; });

document.querySelectorAll("[data-move]").forEach((button) => {
  const vectors = {
    up: directions.ArrowUp,
    down: directions.ArrowDown,
    left: directions.ArrowLeft,
    right: directions.ArrowRight,
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    heldDirection = vectors[button.dataset.move];
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(eventName, () => { heldDirection = null; });
  }
});

requestAnimationFrame(frame);
