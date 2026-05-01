"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import IVisual                  = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService      = powerbi.extensibility.IVisualEventService;

import { drawGauge, drawQualityRing } from "./charts/gauges";
import {
  drawCondBars, drawMixedChart, drawEvolutionChart,
  drawMomChart, drawYoYChart
} from "./charts/d3charts";

/* ══════════════════════════════════════════════════════════════════
   DATA — Heineken México Contratos 2024-2026
   ══════════════════════════════════════════════════════════════════ */

const MONTHS = [
  'Dic 24','Ene 25','Feb 25','Mar 25','Abr 25','May 25',
  'Jun 25','Jul 25','Ago 25','Sep 25','Oct 25','Nov 25','Dic 25',
  'Ene 26','Feb 26','Mar 26','Abr 26','May 26'
];

const KD: Record<string, { total:number; yelo:number; yecl:number; prom:number; anom:number }> = {
  'all-all':   { total:1668, yelo:1378, yecl:290, prom:120, anom:11 },
  'all-2025':  { total:1614, yelo:1335, yecl:279, prom:118, anom:11 },
  'all-2026':  { total:1668, yelo:1378, yecl:290, prom:120, anom:11 },
  'YELO-all':  { total:1378, yelo:1378, yecl:0,   prom:122, anom:11 },
  'YELO-2025': { total:1335, yelo:1335, yecl:0,   prom:121, anom:11 },
  'YELO-2026': { total:1378, yelo:1378, yecl:0,   prom:122, anom:11 },
  'YECL-all':  { total:290,  yelo:0,    yecl:290, prom:112, anom:0  },
  'YECL-2025': { total:279,  yelo:0,    yecl:279, prom:110, anom:0  },
  'YECL-2026': { total:290,  yelo:0,    yecl:290, prom:112, anom:0  }
};

const COND_LABELS = ['30 días','60 días','90 días','120 días','180 días','Otro/Esp.'];
const COND_AVG    = [30, 60, 90, 120, 180, 45];

const COND_D: Record<string, { y:number[]; e:number[] }> = {
  all:  { y:[580,350,245,148,45,10], e:[72,73,36,30,50,29] },
  YELO: { y:[580,350,245,148,45,10], e:[0,0,0,0,0,0] },
  YECL: { y:[0,0,0,0,0,0],           e:[72,73,36,30,50,29] }
};

const EVA_ALL  = [1540,1560,1575,1590,1608,1622,1635,1648,1656,1659,1662,1664,1666,1628,1642,1656,1668,1668];
const EVA_YELO = [1280,1295,1302,1312,1325,1330,1338,1348,1355,1358,1362,1364,1366,1340,1352,1365,1378,1378];
const EVA_YECL = [260,265,273,278,283,292,297,300,301,301,300,300,300,288,290,291,290,290];

// Period → [startIdx, endIdx) of 18-month arrays
const PI: Record<string, [number,number]> = {
  all:    [0, 18],
  '2025': [1, 13],
  '2026': [13, 18]
};

const MOM_D = EVA_ALL.slice(1).map((v, i) => v - EVA_ALL[i]);
const MOM_M = MONTHS.slice(1);

const YOY_LABELS = ['Enero','Febrero','Marzo','Abril'];
const YOY_2025   = [1560, 1575, 1590, 1608];
const YOY_2026   = [1628, 1642, 1656, 1668];

const ANOM_ROWS = [
  { prov:'V028', nombre:'TechSupplies SA de CV',   tipo:'YELO', cond:'0 días',   n:11, riesgo:'Alto'  },
  { prov:'V156', nombre:'Digital Commerce MX',     tipo:'YELO', cond:'15 días',  n:3,  riesgo:'Medio' },
  { prov:'V312', nombre:'Insumos Globales SA',      tipo:'YECL', cond:'0 días',   n:2,  riesgo:'Medio' },
  { prov:'V087', nombre:'Proveedora Nacional',      tipo:'YELO', cond:'8 días',   n:5,  riesgo:'Alto'  },
  { prov:'V201', nombre:'Distribuciones Premium',  tipo:'YELO', cond:'5 días',   n:1,  riesgo:'Bajo'  }
];

/* ══════════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════════ */
interface DashState { tipo: string; periodo: string; tab: number; }

/* ══════════════════════════════════════════════════════════════════
   VISUAL
   ══════════════════════════════════════════════════════════════════ */
export class Visual implements IVisual {
  private el:          HTMLElement;
  private host:        IVisualHost;
  private events:      IVisualEventService;
  private initialized: boolean = false;
  private st:          DashState = { tipo:'all', periodo:'all', tab:1 };
  private tabInit      = new Set<number>();

  constructor(options: VisualConstructorOptions) {
    this.el     = options.element;
    this.host   = options.host;
    this.events = options.host.eventService;
    this.el.classList.add('hnk-dash');
  }

  /* ── update ── */
  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    try {
      const { width, height } = options.viewport;
      this.el.style.width  = `${width}px`;
      this.el.style.height = `${height}px`;

      if (!this.initialized) {
        this.buildDOM();
        this.initialized = true;
        this.activateTab(1);
      } else {
        this.renderTab(this.st.tab);
      }
      this.events.renderingFinished(options);
    } catch (err) {
      this.events.renderingFailed(options, String(err));
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return { cards: [] };
  }

  /* ══════════════════════════════════════════════════════════════
     DOM BUILDER
     ══════════════════════════════════════════════════════════════ */
  private buildDOM(): void {
    this.el.innerHTML = `
      <!-- HEADER -->
      <div class="hnk-hdr">
        <svg width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="18" fill="#205527"/>
          <polygon points="18,5 21.5,15 32,15 23.5,21 27,31 18,25 9,31 12.5,21 4,15 14.5,15"
                   fill="#E8321C" stroke="#B01D15" stroke-width="0.5"/>
          <polygon points="18,5 14.5,15 18,11 21.5,15" fill="rgba(0,0,0,.2)"/>
        </svg>
        <div class="hnk-hdr-text">
          <div class="ht1">HEINEKEN</div>
          <div class="ht2">México · Área de Compras · Contratos</div>
        </div>
        <div class="hnk-badge" id="hdr-badge">1,668 contratos activos</div>
      </div>

      <!-- SLICER BAR -->
      <div class="hnk-sbar">
        <span class="hnk-slbl">📁 Tipo:</span>
        <span class="hnk-sc active" data-g="tipo" data-v="all">Todos</span>
        <span class="hnk-sc"        data-g="tipo" data-v="YELO">YELO · Local</span>
        <span class="hnk-sc"        data-g="tipo" data-v="YECL">YECL · Global</span>
        <div class="hnk-ssep"></div>
        <span class="hnk-slbl">📅 Período:</span>
        <span class="hnk-sc active" data-g="periodo" data-v="all">2024–2026</span>
        <span class="hnk-sc"        data-g="periodo" data-v="2025">2025</span>
        <span class="hnk-sc"        data-g="periodo" data-v="2026">2026</span>
      </div>

      <!-- TAB NAVIGATION -->
      <div class="hnk-tabs">
        <div class="hnk-tab active" data-tab="1">📊 Resumen Ejecutivo</div>
        <div class="hnk-tab"        data-tab="2">📋 Condiciones de Pago</div>
        <div class="hnk-tab"        data-tab="3">⚠️ Anomalías &amp; Calidad</div>
        <div class="hnk-tab"        data-tab="4">📈 Evolución Temporal</div>
      </div>

      <!-- CONTENT -->
      <div class="hnk-content">

        <!-- PAGE 1: Resumen Ejecutivo -->
        <div id="pg1" class="hnk-pg active">
          <div class="kpi-row" id="kpi-row"></div>
          <div class="chart-row" style="flex:1;min-height:0;">
            <div class="chart-card" style="width:36%;min-width:140px;">
              <div class="cc-title">Días Promedio de Crédito</div>
              <div class="cc-inner" id="gauge-wrap"></div>
            </div>
            <div class="chart-card" style="flex:1;">
              <div class="cc-title">Distribución por Condición de Pago</div>
              <div class="cc-inner" id="cond-bars-wrap"></div>
              <div class="chart-legend">
                <div class="cl-item"><div class="cl-dot" style="background:#205527"></div>YELO Local</div>
                <div class="cl-item"><div class="cl-dot" style="background:#1D6FA4"></div>YECL Global</div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 2: Condiciones -->
        <div id="pg2" class="hnk-pg">
          <div class="chart-card" style="flex:1;">
            <div class="cc-title">Contratos y Días Promedio por Condición de Pago</div>
            <div class="cc-inner" id="mixed-wrap"></div>
            <div class="chart-legend">
              <div class="cl-item"><div class="cl-dot" style="background:#205527"></div>YELO Local</div>
              <div class="cl-item"><div class="cl-dot" style="background:#1D6FA4"></div>YECL Global</div>
              <div class="cl-item"><div class="cl-dot" style="background:#F2A900;width:24px;height:4px;border-radius:2px"></div>Días Prom.</div>
            </div>
          </div>
        </div>

        <!-- PAGE 3: Anomalías & Calidad -->
        <div id="pg3" class="hnk-pg">
          <div class="chart-row" style="flex:1;min-height:0;">
            <div class="chart-card" style="width:34%;min-width:150px;">
              <div class="cc-title">Calidad de Datos del Modelo</div>
              <div class="cc-inner" id="qual-wrap"></div>
            </div>
            <div class="chart-card" style="flex:1;overflow:auto;">
              <div class="cc-title" id="anom-title">Anomalías Detectadas — V028 · Condición 0 Días</div>
              <div class="cc-inner" style="overflow:auto;" id="anom-wrap"></div>
            </div>
          </div>
        </div>

        <!-- PAGE 4: Evolución Temporal -->
        <div id="pg4" class="hnk-pg">
          <div class="chart-card" style="flex:0 0 52%;">
            <div class="cc-title">Evolución de Contratos Activos (18 meses)</div>
            <div class="cc-inner" id="evo-wrap"></div>
          </div>
          <div class="chart-row" style="flex:1;min-height:0;">
            <div class="chart-card" style="flex:1;">
              <div class="cc-title">Variación Mensual (MoM Δ)</div>
              <div class="cc-inner" id="mom-wrap"></div>
            </div>
            <div class="chart-card" style="flex:1;">
              <div class="cc-title">Comparativo YoY — Ene–Abr 2025 vs 2026</div>
              <div class="cc-inner" id="yoy-wrap"></div>
            </div>
          </div>
        </div>

      </div><!-- /hnk-content -->
    `;

    this.attachSlicers();
    this.attachTabs();
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT BINDING
     ══════════════════════════════════════════════════════════════ */
  private attachSlicers(): void {
    this.el.querySelectorAll<HTMLElement>('.hnk-sc').forEach(chip => {
      chip.addEventListener('click', () => {
        const g = chip.dataset.g!;
        const v = chip.dataset.v!;
        this.el.querySelectorAll<HTMLElement>(`.hnk-sc[data-g="${g}"]`)
          .forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        (this.st as any)[g] = v;
        this.updateBadge();
        this.renderTab(this.st.tab);
      });
    });
  }

  private attachTabs(): void {
    this.el.querySelectorAll<HTMLElement>('.hnk-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const n = parseInt(tab.dataset.tab!, 10);
        this.activateTab(n);
      });
    });
  }

  private activateTab(n: number): void {
    this.el.querySelectorAll('.hnk-tab').forEach(t => t.classList.remove('active'));
    const tabEl = this.el.querySelector<HTMLElement>(`.hnk-tab[data-tab="${n}"]`);
    if (tabEl) tabEl.classList.add('active');

    this.el.querySelectorAll('.hnk-pg').forEach(p => p.classList.remove('active'));
    const pg = this.el.querySelector<HTMLElement>(`#pg${n}`);
    if (pg) pg.classList.add('active');

    this.st.tab = n;
    this.renderTab(n);
  }

  private updateBadge(): void {
    const kd  = this.kd();
    const bdg = this.el.querySelector<HTMLElement>('#hdr-badge');
    if (bdg) bdg.textContent = `${kd.total.toLocaleString('es-MX')} contratos activos`;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER DISPATCHER
     ══════════════════════════════════════════════════════════════ */
  private renderTab(n: number): void {
    switch (n) {
      case 1: this.renderTab1(); break;
      case 2: this.renderTab2(); break;
      case 3: this.renderTab3(); break;
      case 4: this.renderTab4(); break;
    }
  }

  private kd() {
    return KD[`${this.st.tipo}-${this.st.periodo}`] ?? KD['all-all'];
  }

  private condData() {
    return COND_D[this.st.tipo] ?? COND_D['all'];
  }

  private sliceEvo(arr: number[]): number[] {
    const [s, e] = PI[this.st.periodo] ?? [0, 18];
    return arr.slice(s, e);
  }

  /* ══════════════════════════════════════════════════════════════
     TAB 1 — Resumen Ejecutivo
     ══════════════════════════════════════════════════════════════ */
  private renderTab1(): void {
    const kd = this.kd();
    const cd = this.condData();

    /* KPI Cards */
    const row = this.el.querySelector<HTMLElement>('#kpi-row');
    if (row) {
      const pctYelo = kd.total > 0 ? ((kd.yelo / kd.total) * 100).toFixed(1) : '0';
      const pctYecl = kd.total > 0 ? ((kd.yecl / kd.total) * 100).toFixed(1) : '0';

      const kpis = [
        { lbl:'Total Contratos',        val:kd.total.toLocaleString('es-MX'),  sub:'contratos activos',    cls:'' },
        { lbl:'YELO · Local',           val:kd.yelo.toLocaleString('es-MX'),   sub:`${pctYelo}% del portafolio`, cls:'' },
        { lbl:'YECL · Global',          val:kd.yecl.toLocaleString('es-MX'),   sub:`${pctYecl}% del portafolio`, cls:'kc-blue' },
        { lbl:'Prom. Días de Crédito',  val:`${kd.prom}`,                       sub:'días promedio ponderado', cls:'kc-warn' },
        { lbl:'Anomalías Detectadas',   val:`${kd.anom}`,                       sub:kd.anom>0?'contratos irregulares':'sin anomalías', cls:kd.anom>0?'kc-danger':'kc-ok' }
      ];
      row.innerHTML = kpis.map(k => `
        <div class="kpi-card ${k.cls}">
          <div class="kc-lbl">${k.lbl}</div>
          <div class="kc-val">${k.val}</div>
          <div class="kc-sub">${k.sub}</div>
        </div>`).join('');
    }

    /* Gauge */
    const gwrap = this.el.querySelector<HTMLElement>('#gauge-wrap');
    if (gwrap) drawGauge(gwrap, kd.prom);

    /* Condition bars */
    const bwrap = this.el.querySelector<HTMLElement>('#cond-bars-wrap');
    if (bwrap) drawCondBars(bwrap, cd.y, cd.e, COND_LABELS);
  }

  /* ══════════════════════════════════════════════════════════════
     TAB 2 — Análisis de Condiciones
     ══════════════════════════════════════════════════════════════ */
  private renderTab2(): void {
    const cd   = this.condData();
    const wrap = this.el.querySelector<HTMLElement>('#mixed-wrap');
    if (wrap) drawMixedChart(wrap, cd.y, cd.e, COND_LABELS, COND_AVG);
  }

  /* ══════════════════════════════════════════════════════════════
     TAB 3 — Anomalías & Calidad
     ══════════════════════════════════════════════════════════════ */
  private renderTab3(): void {
    const kd    = this.kd();
    const tipo  = this.st.tipo;

    /* Quality ring */
    const qwrap = this.el.querySelector<HTMLElement>('#qual-wrap');
    if (qwrap) {
      const pct = tipo === 'YECL' ? 100 : 99.34;
      drawQualityRing(qwrap, pct);
    }

    /* Anomaly section */
    const awrap = this.el.querySelector<HTMLElement>('#anom-wrap');
    const title = this.el.querySelector<HTMLElement>('#anom-title');
    if (awrap) {
      if (tipo === 'YECL' || kd.anom === 0) {
        // No anomalies for YECL
        awrap.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;
                      justify-content:center;height:100%;gap:8px;">
            <div style="font-size:32px;">✅</div>
            <div style="font-size:14px;font-weight:700;color:#00A651;">Sin Anomalías</div>
            <div style="font-size:11px;color:#A0AEC0;">
              ${tipo === 'YECL' ? 'YECL no presenta contratos con condición irregular' : 'No se detectaron anomalías en el período seleccionado'}
            </div>
          </div>`;
        if (title) title.textContent = 'Anomalías Detectadas — Estado del Portafolio';
      } else {
        // Filter rows by tipo filter
        const rows = tipo === 'all'
          ? ANOM_ROWS
          : ANOM_ROWS.filter(r => r.tipo === tipo);

        if (title) {
          const cnt = rows.reduce((s, r) => s + r.n, 0);
          title.textContent = `Anomalías Detectadas — ${cnt} contratos con condición ≤ 15 días`;
        }

        awrap.innerHTML = `
          <table class="anom-tbl">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Razón Social</th>
                <th>Tipo</th>
                <th>Condición</th>
                <th style="text-align:center;">Contratos</th>
                <th style="text-align:center;">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${r.prov}</strong></td>
                  <td>${r.nombre}</td>
                  <td><span class="badge ${r.tipo.toLowerCase()}">${r.tipo}</span></td>
                  <td style="color:#E2231A;font-weight:600;">${r.cond}</td>
                  <td style="text-align:center;font-weight:700;">${r.n}</td>
                  <td style="text-align:center;"><span class="badge ${r.riesgo.toLowerCase()}">${r.riesgo}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     TAB 4 — Evolución Temporal
     ══════════════════════════════════════════════════════════════ */
  private renderTab4(): void {
    const [s, e] = PI[this.st.periodo] ?? [0, 18];
    const months = MONTHS.slice(s, e);
    const all    = EVA_ALL.slice(s, e);
    const yelo   = EVA_YELO.slice(s, e);
    const yecl   = EVA_YECL.slice(s, e);

    /* Evolution line chart */
    const ewrap = this.el.querySelector<HTMLElement>('#evo-wrap');
    if (ewrap && months.length >= 2) {
      drawEvolutionChart(ewrap, months, all, yelo, yecl, this.st.tipo);
    }

    /* MoM delta — slice correspondingly */
    const mwrap = this.el.querySelector<HTMLElement>('#mom-wrap');
    if (mwrap) {
      const momSlice  = MOM_D.slice(s === 0 ? 0 : s - 1, e - 1);
      const momMonths = MOM_M.slice(s === 0 ? 0 : s - 1, e - 1);
      if (momSlice.length >= 2) {
        drawMomChart(mwrap, momMonths, momSlice);
      }
    }

    /* YoY chart — only show if period includes 2025-2026 overlap */
    const ywrap = this.el.querySelector<HTMLElement>('#yoy-wrap');
    if (ywrap) {
      if (this.st.periodo === '2025') {
        // Show 2025 monthly trend only
        const y25 = [1448, 1462, 1478, 1491, 1506, 1520, 1535, 1548, 1560, 1575, 1590, 1608];
        const lbls = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        drawYoYChart(ywrap, lbls, y25, y25.map(_ => 0));
      } else {
        drawYoYChart(ywrap, YOY_LABELS, YOY_2025, YOY_2026);
      }
    }
  }
}
