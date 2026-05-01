"use strict";

import { select }                            from "d3-selection";
import { scaleLinear, scaleBand, scaleOrdinal } from "d3-scale";
import { axisBottom, axisLeft, axisRight }   from "d3-axis";
import { line, area, arc, pie, curveCatmullRom } from "d3-shape";
import { max, min, extent }                  from "d3-array";

/* ── Color tokens ── */
const G  = '#205527';
const G2 = '#A5E600';
const GS = '#00A651';
const AM = '#F2A900';
const RD = '#E2231A';
const BL = '#1D6FA4';
const N7 = '#4A5568';
const N5 = '#A0AEC0';
const N2 = '#E2E8F0';
const WH = '#FFFFFF';

const COND_COLORS = [GS, BL, G, '#9B59B6', AM, N5];

/* ─────────────────────────────────────────────────────────────────
   Condition horizontal grouped bar chart — Tab 1
   ──────────────────────────────────────────────────────────────── */
export function drawCondBars(
  wrap: HTMLElement,
  yelo: number[],
  yecl: number[],
  labels: string[]
): void {
  const W = wrap.clientWidth  || 400;
  const H = wrap.clientHeight || 200;
  const mg = { top: 8, right: 20, bottom: 24, left: 72 };
  const w = W - mg.left - mg.right;
  const h = H - mg.top  - mg.bottom;

  select(wrap).select('svg').remove();
  const svg = select(wrap).append('svg')
    .attr('width', W).attr('height', H);

  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const totals = labels.map((_, i) => yelo[i] + yecl[i]);
  const xMax = (max(totals) ?? 1) * 1.08;

  const xSc = scaleLinear().domain([0, xMax]).range([0, w]);
  const ySc = scaleBand().domain(labels).range([0, h]).padding(0.28);
  const subSc = scaleBand().domain(['YELO','YECL']).range([0, ySc.bandwidth()]).padding(0.1);

  // Grid lines
  g.append('g').attr('class', 'd3-grid')
    .selectAll('line').data(xSc.ticks(5)).join('line')
    .attr('x1', d => xSc(d)).attr('x2', d => xSc(d))
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', N2).attr('stroke-dasharray', '3,3');

  // YELO bars
  const yeloG = g.append('g');
  labels.forEach((lbl, i) => {
    if (yelo[i] <= 0) return;
    yeloG.append('rect')
      .attr('x', 0)
      .attr('y', ySc(lbl)! + subSc('YELO')!)
      .attr('width', xSc(yelo[i]))
      .attr('height', subSc.bandwidth())
      .attr('rx', 3).attr('fill', G)
      .append('title').text(`YELO ${lbl}: ${yelo[i].toLocaleString('es-MX')} contratos`);

    yeloG.append('text')
      .attr('x', xSc(yelo[i]) + 3)
      .attr('y', ySc(lbl)! + subSc('YELO')! + subSc.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 8).attr('fill', N7)
      .text(yelo[i] > 0 ? yelo[i].toLocaleString('es-MX') : '');
  });

  // YECL bars
  const yeclG = g.append('g');
  labels.forEach((lbl, i) => {
    if (yecl[i] <= 0) return;
    yeclG.append('rect')
      .attr('x', 0)
      .attr('y', ySc(lbl)! + subSc('YECL')!)
      .attr('width', xSc(yecl[i]))
      .attr('height', subSc.bandwidth())
      .attr('rx', 3).attr('fill', BL)
      .append('title').text(`YECL ${lbl}: ${yecl[i].toLocaleString('es-MX')} contratos`);

    yeclG.append('text')
      .attr('x', xSc(yecl[i]) + 3)
      .attr('y', ySc(lbl)! + subSc('YECL')! + subSc.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 8).attr('fill', N7)
      .text(yecl[i] > 0 ? yecl[i].toLocaleString('es-MX') : '');
  });

  // Axes
  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h})`)
    .call(axisBottom(xSc).ticks(5).tickFormat(d => +d >= 1000 ? `${+d/1000}K` : `${+d}`))
    .select('.domain').remove();

  g.append('g').attr('class', 'd3-axis')
    .call(axisLeft(ySc).tickSize(0))
    .selectAll('text').attr('x', -6).attr('font-size', 9);

  g.select('.d3-axis .domain').remove();
}

/* ─────────────────────────────────────────────────────────────────
   Mixed bar + line chart — Tab 2 (Condiciones)
   ──────────────────────────────────────────────────────────────── */
export function drawMixedChart(
  wrap: HTMLElement,
  yelo: number[],
  yecl: number[],
  labels: string[],
  avgDays: number[]
): void {
  const W = wrap.clientWidth  || 500;
  const H = wrap.clientHeight || 240;
  const mg = { top: 14, right: 55, bottom: 38, left: 55 };
  const w = W - mg.left - mg.right;
  const h = H - mg.top  - mg.bottom;

  select(wrap).select('svg').remove();
  const svg = select(wrap).append('svg')
    .attr('width', W).attr('height', H);

  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const totals = labels.map((_, i) => yelo[i] + yecl[i]);
  const xSc = scaleBand().domain(labels).range([0, w]).padding(0.3);
  const yScL = scaleLinear().domain([0, (max(totals) ?? 1) * 1.12]).range([h, 0]);
  const yScR = scaleLinear().domain([0, (max(avgDays) ?? 180) * 1.12]).range([h, 0]);
  const bw = xSc.bandwidth();

  // Y Grid
  g.append('g').attr('class', 'd3-grid')
    .selectAll('line').data(yScL.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', d => yScL(d)).attr('y2', d => yScL(d))
    .attr('stroke', N2).attr('stroke-dasharray', '3,3');

  // Stacked bars (YELO bottom, YECL top)
  labels.forEach((lbl, i) => {
    const y = yelo[i], e = yecl[i], tot = y + e;
    const x = xSc(lbl)!;

    // YELO portion
    if (y > 0) {
      const yBot = yScL(0), yTop = yScL(y);
      g.append('rect')
        .attr('x', x).attr('y', yTop)
        .attr('width', bw).attr('height', yBot - yTop)
        .attr('rx', 3).attr('fill', G).attr('opacity', 0.85)
        .append('title').text(`YELO ${lbl}: ${y}`);
    }

    // YECL portion (on top)
    if (e > 0) {
      const yBot = yScL(y), yTop = yScL(tot);
      g.append('rect')
        .attr('x', x).attr('y', yTop)
        .attr('width', bw).attr('height', yBot - yTop)
        .attr('rx', 3).attr('fill', BL).attr('opacity', 0.80)
        .append('title').text(`YECL ${lbl}: ${e}`);
    }

    // Total label
    if (tot > 0) {
      g.append('text')
        .attr('x', x + bw / 2).attr('y', yScL(tot) - 4)
        .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', N7)
        .attr('font-weight', '600').text(tot.toLocaleString('es-MX'));
    }
  });

  // Avg days line
  const lineGen = line<number>()
    .x((_, i) => xSc(labels[i])! + bw / 2)
    .y(d => yScR(d))
    .curve(curveCatmullRom);

  g.append('path')
    .datum(avgDays)
    .attr('fill', 'none')
    .attr('stroke', AM)
    .attr('stroke-width', 2.5)
    .attr('stroke-dasharray', '5,3')
    .attr('d', lineGen as any);

  avgDays.forEach((d, i) => {
    g.append('circle')
      .attr('cx', xSc(labels[i])! + bw / 2)
      .attr('cy', yScR(d))
      .attr('r', 4).attr('fill', AM).attr('stroke', WH).attr('stroke-width', 1.5)
      .append('title').text(`Prom ${labels[i]}: ${d} días`);
  });

  // Axes
  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h})`)
    .call(axisBottom(xSc).tickSize(0))
    .selectAll('text').attr('font-size', 9).attr('dy', '1em');

  g.append('g').attr('class', 'd3-axis')
    .call(axisLeft(yScL).ticks(5).tickFormat(d => `${d}`))
    .selectAll('text').attr('font-size', 9);

  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(${w},0)`)
    .call(axisRight(yScR).ticks(5).tickFormat(d => `${d}d`))
    .selectAll('text').attr('font-size', 9);

  // Axis labels
  g.append('text').attr('x', -h/2).attr('y', -42).attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', N7)
    .text('Contratos');
  g.append('text').attr('x', -h/2).attr('y', w + 48).attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', AM)
    .text('Días Promedio');
}

/* ─────────────────────────────────────────────────────────────────
   Evolution multi-line chart — Tab 4
   ──────────────────────────────────────────────────────────────── */
export function drawEvolutionChart(
  wrap: HTMLElement,
  months: string[],
  all: number[],
  yelo: number[],
  yecl: number[],
  tipo: string
): void {
  const W = wrap.clientWidth  || 600;
  const H = wrap.clientHeight || 180;
  const mg = { top: 10, right: 16, bottom: 32, left: 58 };
  const w = W - mg.left - mg.right;
  const h = H - mg.top  - mg.bottom;

  select(wrap).select('svg').remove();
  const svg = select(wrap).append('svg')
    .attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const n = months.length;
  const series: Array<{ data: number[]; col: string; label: string }> = [];
  if (tipo === 'all' || tipo === 'YELO') series.push({ data: yelo, col: G,  label: 'YELO Local' });
  if (tipo === 'all' || tipo === 'YECL') series.push({ data: yecl, col: BL, label: 'YECL Global' });
  if (tipo === 'all') series.unshift({ data: all,  col: G2, label: 'Total' });

  const allVals = series.flatMap(s => s.data);
  const vMin = (min(allVals) ?? 0) * 0.97;
  const vMax = (max(allVals) ?? 1) * 1.04;

  const xSc = scaleLinear().domain([0, n - 1]).range([0, w]);
  const ySc = scaleLinear().domain([vMin, vMax]).range([h, 0]);

  // Grid
  g.append('g').attr('class', 'd3-grid')
    .selectAll('line').data(ySc.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', d => ySc(d)).attr('y2', d => ySc(d))
    .attr('stroke', N2).attr('stroke-dasharray', '2,3');

  const lineGen = (data: number[]) => line<number>()
    .x((_, i) => xSc(i))
    .y(d => ySc(d))
    .curve(curveCatmullRom)(data);

  const areaGen = (data: number[]) => area<number>()
    .x((_, i) => xSc(i))
    .y0(h)
    .y1(d => ySc(d))
    .curve(curveCatmullRom)(data);

  // Area fills
  series.forEach(s => {
    g.append('path')
      .attr('d', areaGen(s.data) ?? '')
      .attr('fill', s.col).attr('opacity', 0.07);
  });

  // Lines + end dot
  series.forEach(s => {
    g.append('path')
      .attr('d', lineGen(s.data) ?? '')
      .attr('fill', 'none')
      .attr('stroke', s.col)
      .attr('stroke-width', s.label === 'Total' ? 2.5 : 2)
      .attr('stroke-dasharray', s.label === 'Total' ? '' : '');

    // Last point
    const last = s.data[s.data.length - 1];
    g.append('circle')
      .attr('cx', xSc(s.data.length - 1))
      .attr('cy', ySc(last))
      .attr('r', 4).attr('fill', s.col)
      .attr('stroke', WH).attr('stroke-width', 1.5)
      .append('title').text(`${s.label}: ${last.toLocaleString('es-MX')}`);

    // End label
    g.append('text')
      .attr('x', xSc(s.data.length - 1) + 5)
      .attr('y', ySc(last))
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 8.5).attr('font-weight', '700').attr('fill', s.col)
      .text(last.toLocaleString('es-MX'));
  });

  // X Axis — show every 3rd month
  const step = Math.max(1, Math.floor(n / 7));
  const xTicks = months.filter((_, i) => i % step === 0);
  const xDomain = xTicks.map(m => months.indexOf(m));

  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h})`)
    .call(axisBottom(xSc)
      .tickValues(xDomain)
      .tickFormat((_, i) => xTicks[i] ?? '')
      .tickSize(0))
    .selectAll('text').attr('font-size', 8).attr('dy', '1.2em');

  g.append('g').attr('class', 'd3-axis')
    .call(axisLeft(ySc).ticks(5).tickFormat(d => `${(+d/1000).toFixed(1)}K`))
    .selectAll('text').attr('font-size', 9);

  g.select('.d3-axis .domain').remove();
}

/* ─────────────────────────────────────────────────────────────────
   MoM Delta bar chart — Tab 4
   ──────────────────────────────────────────────────────────────── */
export function drawMomChart(
  wrap: HTMLElement,
  months: string[],
  deltas: number[]
): void {
  const W = wrap.clientWidth  || 320;
  const H = wrap.clientHeight || 160;
  const mg = { top: 10, right: 10, bottom: 38, left: 32 };
  const w = W - mg.left - mg.right;
  const h = H - mg.top  - mg.bottom;

  select(wrap).select('svg').remove();
  const svg = select(wrap).append('svg')
    .attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const xSc = scaleBand().domain(months).range([0, w]).padding(0.22);
  const vMax = (max(deltas) ?? 1) * 1.15;
  const vMin = Math.min(0, (min(deltas) ?? 0) * 1.15);
  const ySc = scaleLinear().domain([vMin, vMax]).range([h, 0]);

  // Zero line
  g.append('line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', ySc(0)).attr('y2', ySc(0))
    .attr('stroke', N5).attr('stroke-width', 1);

  // Bars
  deltas.forEach((d, i) => {
    const col = d >= 15 ? GS : d >= 12 ? AM : RD;
    const bx = xSc(months[i])!;
    const bw = xSc.bandwidth();
    const y0 = ySc(Math.max(0, d));
    const y1 = ySc(Math.min(0, d));
    g.append('rect')
      .attr('x', bx).attr('y', y0)
      .attr('width', bw).attr('height', Math.abs(y1 - y0) || 1)
      .attr('rx', 2).attr('fill', col)
      .append('title').text(`${months[i]}: +${d}`);
  });

  // X axis — every 3rd label
  const step = Math.max(1, Math.floor(months.length / 6));
  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h})`)
    .call(axisBottom(xSc)
      .tickValues(months.filter((_, i) => i % step === 0))
      .tickSize(0))
    .selectAll('text')
    .attr('font-size', 7.5).attr('dy', '1.2em')
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end');

  g.append('g').attr('class', 'd3-axis')
    .call(axisLeft(ySc).ticks(4).tickFormat(d => `+${d}`))
    .selectAll('text').attr('font-size', 8);

  g.select('.d3-axis .domain').remove();
}

/* ─────────────────────────────────────────────────────────────────
   YoY grouped bar chart — Tab 4
   ──────────────────────────────────────────────────────────────── */
export function drawYoYChart(
  wrap: HTMLElement,
  labels: string[],
  data2025: number[],
  data2026: number[]
): void {
  const W = wrap.clientWidth  || 280;
  const H = wrap.clientHeight || 160;
  const mg = { top: 10, right: 10, bottom: 32, left: 48 };
  const w = W - mg.left - mg.right;
  const h = H - mg.top  - mg.bottom;

  select(wrap).select('svg').remove();
  const svg = select(wrap).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  const all = [...data2025, ...data2026];
  const vMin = (min(all) ?? 0) * 0.96;
  const vMax = (max(all) ?? 1) * 1.05;

  const xSc  = scaleBand().domain(labels).range([0, w]).padding(0.25);
  const subSc = scaleBand().domain(['2025','2026']).range([0, xSc.bandwidth()]).padding(0.1);
  const ySc  = scaleLinear().domain([vMin, vMax]).range([h, 0]);

  // Grid
  g.append('g').attr('class', 'd3-grid')
    .selectAll('line').data(ySc.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', w)
    .attr('y1', d => ySc(d)).attr('y2', d => ySc(d))
    .attr('stroke', N2).attr('stroke-dasharray', '2,3');

  [{ data: data2025, year: '2025', col: 'rgba(29,111,164,0.75)' },
   { data: data2026, year: '2026', col: BL }].forEach(s => {
    labels.forEach((lbl, i) => {
      const x = xSc(lbl)! + subSc(s.year)!;
      const bw = subSc.bandwidth();
      g.append('rect')
        .attr('x', x).attr('y', ySc(s.data[i]))
        .attr('width', bw).attr('height', h - ySc(s.data[i]))
        .attr('rx', 2).attr('fill', s.col)
        .append('title').text(`${s.year} ${lbl}: ${s.data[i].toLocaleString('es-MX')}`);
    });
  });

  g.append('g').attr('class', 'd3-axis')
    .attr('transform', `translate(0,${h})`)
    .call(axisBottom(xSc).tickSize(0))
    .selectAll('text').attr('font-size', 9).attr('dy', '1.2em');

  g.append('g').attr('class', 'd3-axis')
    .call(axisLeft(ySc).ticks(4).tickFormat(d => `${(+d/1000).toFixed(1)}K`))
    .selectAll('text').attr('font-size', 8);

  g.select('.d3-axis .domain').remove();

  // Legend
  const leg = g.append('g').attr('transform', `translate(${w - 80}, -4)`);
  [{ col: 'rgba(29,111,164,0.75)', lbl: '2025' },
   { col: BL, lbl: '2026' }].forEach((s, i) => {
    const lx = i * 40;
    leg.append('rect').attr('x', lx).attr('y', 0).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', s.col);
    leg.append('text').attr('x', lx + 12).attr('y', 7).attr('font-size', 8).attr('fill', N7).text(s.lbl);
  });
}
