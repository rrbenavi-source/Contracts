"use strict";

/* ── Color tokens ── */
const G  = '#205527';
const G2 = '#A5E600';
const GS = '#00A651';
const AM = '#F2A900';
const RD = '#E2231A';
const N7 = '#4A5568';
const N5 = '#A0AEC0';

/* ─────────────────────────────────────────────────────────────────
   Semicircle Gauge — días promedio de crédito
   val: 0 – 180 days
   ──────────────────────────────────────────────────────────────── */
export function drawGauge(wrap: HTMLElement, val: number): void {
  wrap.innerHTML = '';
  const W = wrap.clientWidth  || 220;
  const H = wrap.clientHeight || 170;

  const canvas = document.createElement('canvas');
  canvas.width  = W * 2;   // HiDPI
  canvas.height = H * 2;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  const cx = W / 2;
  const cy = H * 0.72;
  const R  = Math.min(cx * 0.85, cy * 0.85);
  const lw = R * 0.20;

  /* Colored zones (proportion of 0-180) */
  const zones = [
    { f: 0,    t: 0.056, col: RD },
    { f: 0.056,t: 0.22,  col: AM },
    { f: 0.22, t: 0.50,  col: '#6EC99A' },
    { f: 0.50, t: 0.78,  col: GS },
    { f: 0.78, t: 1.0,   col: G  }
  ];

  // Track ring (light gray bg)
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI);
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineCap = 'butt';
  ctx.stroke();

  zones.forEach(z => {
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI + z.f * Math.PI, Math.PI + z.t * Math.PI);
    ctx.lineWidth = lw;
    ctx.strokeStyle = z.col;
    ctx.lineCap = 'butt';
    ctx.stroke();
  });

  // Needle
  const pct   = Math.max(0, Math.min(1, val / 180));
  const angle = Math.PI + pct * Math.PI;
  const nLen  = R - lw * 0.6;
  const nx = cx + nLen * Math.cos(angle);
  const ny = cy + nLen * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center pivot dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = '#1A1A2E';
  ctx.fill();

  // Value text
  ctx.textAlign = 'center';
  ctx.fillStyle = G;
  ctx.font = `bold ${Math.round(R * 0.26)}px Segoe UI`;
  ctx.fillText(`${val}`, cx, cy - R * 0.06);
  ctx.fillStyle = N7;
  ctx.font = `${Math.round(R * 0.13)}px Segoe UI`;
  ctx.fillText('días prom.', cx, cy + R * 0.10);

  // Min/Max labels
  ctx.font = `${Math.round(R * 0.11)}px Segoe UI`;
  ctx.fillStyle = N5;
  ctx.textAlign = 'left';
  ctx.fillText('0', cx - R + lw / 2, cy + 14);
  ctx.textAlign = 'right';
  ctx.fillText('180', cx + R - lw / 2, cy + 14);
}

/* ─────────────────────────────────────────────────────────────────
   Quality Ring — calidad de datos (percentage)
   ──────────────────────────────────────────────────────────────── */
export function drawQualityRing(wrap: HTMLElement, pct: number): void {
  wrap.innerHTML = '';
  const W = wrap.clientWidth  || 200;
  const H = wrap.clientHeight || 160;
  const size = Math.min(W, H);

  const canvas = document.createElement('canvas');
  canvas.width  = size * 2;
  canvas.height = size * 2;
  canvas.style.width  = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.style.display = 'block';
  canvas.style.margin  = 'auto';
  wrap.appendChild(canvas);

  // Center text overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;pointer-events:none;
    margin:auto;width:${size}px;height:${size}px;
    left:50%;top:50%;transform:translate(-50%,-50%);
  `;
  overlay.innerHTML = `
    <div style="font-size:${Math.round(size*0.16)}px;font-weight:800;color:${GS};">${pct.toFixed(1)}%</div>
    <div style="font-size:${Math.round(size*0.08)}px;color:${N7};margin-top:2px;">calidad</div>
    <div style="font-size:${Math.round(size*0.07)}px;color:${N5};">de datos</div>
  `;
  wrap.style.position = 'relative';
  wrap.appendChild(overlay);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.42;
  const lw = R * 0.28;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Red section (anomalies)
  const badFrac = (100 - pct) / 100;
  if (badFrac > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + badFrac * 2 * Math.PI);
    ctx.lineWidth = lw;
    ctx.strokeStyle = RD;
    ctx.stroke();
  }

  // Green section (quality)
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2 + badFrac * 2 * Math.PI, -Math.PI / 2 + 2 * Math.PI);
  ctx.lineWidth = lw;
  ctx.strokeStyle = GS;
  ctx.stroke();
}
