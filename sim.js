// constants for calculations
const SPEED_OF_SOUND = 343;
const TIME_SCALE = 0.005;
const GRID_M = 4;
const PX_PER_M = 150; // scaling for pixel to meter
const MIC_SPACING_M = 1;

// graph layout
const MARGIN_LEFT = 50;
const MARGIN_BOTTOM = 45;
const MARGIN_TOP = 15;
const MARGIN_RIGHT = 15;
const GRID_PX = GRID_M * PX_PER_M;

// access graph element of page
const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');

const W = MARGIN_LEFT + GRID_PX + MARGIN_RIGHT;
const H = MARGIN_TOP + GRID_PX + MARGIN_BOTTOM;
canvas.width = W;
canvas.height = H;

// grid origin (0,0) at bottom left of graph element
const originX = MARGIN_LEFT;
const originY = MARGIN_TOP + GRID_PX;

// conversion functions from m to pixel
function mToCanvasX(mx) { return originX + mx * PX_PER_M; }
function mToCanvasY(my) { return originY - my * PX_PER_M; }

// conversion functions from pixel to m
function canvasToMx(px) { return (px - originX) / PX_PER_M; }
function canvasToMy(py) { return (originY - py) / PX_PER_M; }
function mToPx(m)       { return m * PX_PER_M; }

// snaps the clicked bullet location to nearest mm
function snap(value, step) { return Math.round(value / step) * step; }

// pythagorean distance formula of 2 points
function distM(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// mic locations
const mics = [
  { mx: 1, my: 0, label: 'M1' },
  { mx: 2, my: 0, label: 'M2' },
  { mx: 3, my: 0, label: 'M3' },
];

// initial simulation state
let bullet = null;  // has x and y
let startTime = null;
let hitTimes = [null, null, null];  // times it takes for mic 1, 2, 3 to detect wave
let running = false;  // simulation running flag
let animId = null;

// functions for drawing simulation
function drawGrid() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // draw grid lines every 1 meter
  for (let i = 0; i <= GRID_M; i++) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    const px = mToCanvasX(i);
    ctx.beginPath(); ctx.moveTo(px, MARGIN_TOP); ctx.lineTo(px, originY); ctx.stroke();

    const py = mToCanvasY(i);
    ctx.beginPath(); ctx.moveTo(originX, py); ctx.lineTo(originX + GRID_PX, py); ctx.stroke();
  }

  // draw x and y axes
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX + GRID_PX, originY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(originX, MARGIN_TOP); ctx.stroke();

  // x axis labels
  ctx.fillStyle = '#555';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= GRID_M; i++) {
    ctx.fillText(i, mToCanvasX(i), originY + 10);
  }
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('x (meters)', originX + GRID_PX / 2, originY + 28);

  // y axis labels
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= GRID_M; i++) {
    ctx.fillText(i, originX - 10, mToCanvasY(i));
  }
  // rotate 90 degrees for y axis title
  ctx.save();
  ctx.translate(16, MARGIN_TOP + GRID_PX / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('y (meters)', 0, 0);
  ctx.restore();
}

// draw the mics on bottom of graph
function drawMics() {
  // loop through each mic
  mics.forEach((mic, i) => {
    // get pixel location for mics
    const cx = mToCanvasX(mic.mx);
    const cy = mToCanvasY(mic.my);
    const wasHit = hitTimes[i] !== null;

    // draw each mic and label
    // red = detected bullet
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

// function for drawing the bullet
function drawBullet() {
  if (!bullet) return;
  const bx = mToCanvasX(bullet.mx);
  const by = mToCanvasY(bullet.my);

  // draw bullet as dot
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();

  // draw meter coordinates above bullet
  ctx.fillStyle = '#333';
  ctx.font = '11px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('(' + bullet.mx.toFixed(2) + ', ' + bullet.my.toFixed(2) + ')', bx + 10, by - 8);

  // draw a direct line from bullet to each mic
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

    // draw the direct distance from bullet to mic along the dotted line
    const d = distM(bullet.mx, bullet.my, mic.mx, mic.my);
    const lx = (bx + mx) / 2;
    const ly = (by + my) / 2;
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(d.toFixed(2) + 'm', lx + 4, ly - 4);
  });
}

// function for drawing the outward expainding mach cone
function drawWave(simTime) {
  if (!bullet || simTime === null) return;

  // set radius for each function call 
  // r = time (s) * speed of sound (m/s)
  const radiusM = SPEED_OF_SOUND * simTime;
  const radiusPx = mToPx(radiusM);
  const bx = mToCanvasX(bullet.mx);
  const by = mToCanvasY(bullet.my);

  // draw the circle on the grid
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

  // draw radius and sim time in top left of grid
  ctx.fillStyle = '#2a7fff';
  ctx.font = '11px Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('r = ' + radiusM.toFixed(3) + ' m', originX + 15, MARGIN_TOP + 16);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.fillText('t = ' + (simTime * 1000).toFixed(4) + ' ms', originX + 15, MARGIN_TOP + 32);
}

// function to draw the data panel output
function updatePanel() {
  // loop through mics
  for (let i = 0; i < 3; i++) {
    // get mic[i] element
    const el = document.getElementById('t' + (i + 1));
    if (hitTimes[i] !== null) {
      el.textContent = (hitTimes[i] * 1000).toFixed(5) + ' ms';
      el.className = 'hit';
    } else {
      el.textContent = '\u2014';
      el.className = 'waiting';
    }
  }

  // initialize the pair of times of each mics
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

// function that calls drawing functions while simulation is running
function frame() {
  if (!running) return;

  const elapsed = (performance.now() - startTime) / 1000;
  const simTime = elapsed * TIME_SCALE;
  const radiusM = SPEED_OF_SOUND * simTime;

  // check mic hits
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
  // call update panel if a mic detect happens
  if (changed) updatePanel();

  // draw everything
  drawGrid();
  drawWave(simTime);
  drawBullet();
  drawMics();

  // stop drawing once wave passes the grid
  const allHit = hitTimes.every(t => t !== null);
  if (allHit && radiusM > GRID_M * 1.5) {
    running = false;
    drawGrid(); drawBullet(); drawMics();
    return;
  }

  // call frame again
  animId = requestAnimationFrame(frame);
}

// handler for mouse cliclk on grid
canvas.addEventListener('click', function (e) {
  // get click position
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (W / rect.width);
  const cy = (e.clientY - rect.top) * (H / rect.height);

  // convert click position to meters
  let mx = canvasToMx(cx);
  let my = canvasToMy(cy);

  // snap to nearest mm
  mx = snap(mx, 0.001);
  my = snap(my, 0.001);

  // only run if the click is in the grid
  if (mx < 0 || mx > GRID_M || my < 0.2 || my > GRID_M) return;
  if (animId) cancelAnimationFrame(animId);

  // initialize the state data and start simulation with frame()
  bullet = { mx, my };
  hitTimes = [null, null, null];
  startTime = performance.now();
  running = true;
  updatePanel();
  frame();
});

// draw the first grid
drawGrid();
drawMics();
