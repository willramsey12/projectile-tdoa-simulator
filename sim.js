// ============================================
// CONFIGURATION
// ============================================
const SPEED_OF_SOUND = 343;   // m/s
const TIME_SCALE = 0.005;      // 200x slower than real time
const GRID_M = 4;            // Xm x Ym grid
const PX_PER_M = 150;          // pixels per meter
const MIC_SPACING_M = 1;      // meters between mics

// ============================================
// LAYOUT
// ============================================
const MARGIN_LEFT = 50;
const MARGIN_BOTTOM = 45;
const MARGIN_TOP = 15;
const MARGIN_RIGHT = 15;
const GRID_PX = GRID_M * PX_PER_M;

const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');

const W = MARGIN_LEFT + GRID_PX + MARGIN_RIGHT;
const H = MARGIN_TOP + GRID_PX + MARGIN_BOTTOM;
canvas.width = W;
canvas.height = H;

// Grid origin: (0,0) at bottom-left of plot area
const originX = MARGIN_LEFT;
const originY = MARGIN_TOP + GRID_PX;

// ============================================
// COORDINATE CONVERSION
// ============================================
function mToCanvasX(mx) { return originX + mx * PX_PER_M; }
function mToCanvasY(my) { return originY - my * PX_PER_M; }
function canvasToMx(px) { return (px - originX) / PX_PER_M; }
function canvasToMy(py) { return (originY - py) / PX_PER_M; }
function mToPx(m)       { return m * PX_PER_M; }
function snap(value, step) { return Math.round(value / step) * step; }

function distM(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ============================================
// MICROPHONES
// ============================================
const mics = [
  { mx: 1, my: 0, label: 'M1' },
  { mx: 2, my: 0, label: 'M2' },
  { mx: 3, my: 0, label: 'M3' },
];

// ============================================
// STATE
// ============================================
let bullet = null;           // {mx, my} in meters
let startTime = null;        // performance.now() at click
let hitTimes = [null, null, null];
let running = false;
let animId = null;

// ============================================
// DRAWING FUNCTIONS
// ============================================
function drawGrid() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Grid lines every 1m
  for (let i = 0; i <= GRID_M; i++) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    const px = mToCanvasX(i);
    ctx.beginPath(); ctx.moveTo(px, MARGIN_TOP); ctx.lineTo(px, originY); ctx.stroke();

    const py = mToCanvasY(i);
    ctx.beginPath(); ctx.moveTo(originX, py); ctx.lineTo(originX + GRID_PX, py); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX + GRID_PX, originY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, MARGIN_TOP); ctx.stroke();

  // X-axis numbers
  ctx.fillStyle = '#555';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= GRID_M; i++) {
    ctx.fillText(i, mToCanvasX(i), originY + 6);
  }
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('x (meters)', originX + GRID_PX / 2, originY + 28);

  // Y-axis numbers
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= GRID_M; i++) {
    ctx.fillText(i, originX - 8, mToCanvasY(i));
  }

  // Y-axis label
  ctx.save();
  ctx.translate(16, MARGIN_TOP + GRID_PX / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('y (meters)', 0, 0);
  ctx.restore();
}

function drawMics() {
  mics.forEach((mic, i) => {
    const cx = mToCanvasX(mic.mx);
    const cy = mToCanvasY(mic.my);
    const wasHit = hitTimes[i] !== null;

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = wasHit ? '#e22' : '#333';
    ctx.fill();

    ctx.fillStyle = wasHit ? '#e22' : '#333';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(mic.label, cx, cy - 18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });
}

function drawBullet() {
  if (!bullet) return;
  const bx = mToCanvasX(bullet.mx);
  const by = mToCanvasY(bullet.my);

  // Dot
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();

  // Coordinate label
  ctx.fillStyle = '#333';
  ctx.font = '11px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('(' + bullet.mx.toFixed(2) + ', ' + bullet.my.toFixed(2) + ')', bx + 10, by - 8);

  // Dashed lines + distance to each mic
  mics.forEach((mic) => {
    const mx = mToCanvasX(mic.mx);
    const my = mToCanvasY(mic.my);

    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);

    const d = distM(bullet.mx, bullet.my, mic.mx, mic.my);
    const lx = (bx + mx) / 2;
    const ly = (by + my) / 2;
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(d.toFixed(2) + 'm', lx + 4, ly - 4);
  });
}

function drawWave(simTime) {
  if (!bullet || simTime === null) return;

  const radiusM = SPEED_OF_SOUND * simTime;
  const radiusPx = mToPx(radiusM);
  const bx = mToCanvasX(bullet.mx);
  const by = mToCanvasY(bullet.my);

  // Clip wave to grid area
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, MARGIN_TOP, GRID_PX, GRID_PX);
  ctx.clip();

  ctx.beginPath();
  ctx.arc(bx, by, radiusPx, 0, Math.PI * 2);
  ctx.strokeStyle = '#2a7fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Readouts
  ctx.fillStyle = '#2a7fff';
  ctx.font = '11px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('r = ' + radiusM.toFixed(3) + ' m', originX + 8, MARGIN_TOP + 16);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText('t = ' + (simTime * 1000).toFixed(4) + ' ms', originX + 8, MARGIN_TOP + 32);
}

// ============================================
// DATA PANEL UPDATE
// ============================================
function updatePanel() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('t' + (i + 1));
    if (hitTimes[i] !== null) {
      el.textContent = (hitTimes[i] * 1000).toFixed(4) + ' ms';
      el.className = 'hit';
    } else {
      el.textContent = '\u2014';
      el.className = 'waiting';
    }
  }

  const pairs = [
    { id: 'd12', a: 1, b: 0 },
    { id: 'd13', a: 2, b: 0 },
    { id: 'd23', a: 2, b: 1 },
  ];
  pairs.forEach(p => {
    const el = document.getElementById(p.id);
    if (hitTimes[p.a] !== null && hitTimes[p.b] !== null) {
      const diff_us = (hitTimes[p.a] - hitTimes[p.b]) * 1e6;
      el.textContent = diff_us.toFixed(1) + ' \u03BCs';
      el.className = 'hit';
    } else {
      el.textContent = '\u2014';
      el.className = 'waiting';
    }
  });
}

// ============================================
// ANIMATION LOOP
// ============================================
function frame() {
  if (!running) return;

  const elapsed = (performance.now() - startTime) / 1000;
  const simTime = elapsed * TIME_SCALE;
  const radiusM = SPEED_OF_SOUND * simTime;

  // Check mic hits
  let changed = false;
  mics.forEach((mic, i) => {
    if (hitTimes[i] === null) {
      const d = distM(bullet.mx, bullet.my, mic.mx, mic.my);
      const tHit = d / SPEED_OF_SOUND;

      if (simTime >= tHit) {
        hitTimes[i] = tHit;
        changed = true;
      }
    }
  });
  if (changed) updatePanel();

  // Draw everything
  drawGrid();
  drawWave(simTime);
  drawBullet();
  drawMics();

  // Stop once wave passes the grid
  const allHit = hitTimes.every(t => t !== null);
  if (allHit && radiusM > GRID_M * 1.5) {
    running = false;
    drawGrid(); drawBullet(); drawMics();
    return;
  }

  animId = requestAnimationFrame(frame);
}

// ============================================
// CLICK HANDLER
// ============================================
canvas.addEventListener('click', function (e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (W / rect.width);
  const cy = (e.clientY - rect.top) * (H / rect.height);

  let mx = canvasToMx(cx);
  let my = canvasToMy(cy);

  mx = snap(mx, 0.01);   // nearest centimeter
  my = snap(my, 0.01);

  if (mx < 0 || mx > GRID_M || my < 0.2 || my > GRID_M) return;

  if (animId) cancelAnimationFrame(animId);
  bullet = { mx, my };
  hitTimes = [null, null, null];
  startTime = performance.now();
  running = true;
  updatePanel();
  frame();
});

// ============================================
// INITIAL DRAW
// ============================================
drawGrid();
drawMics();
