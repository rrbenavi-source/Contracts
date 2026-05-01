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
  { condPago:'V028', prov:'PRV-10456', nombre:'TechSupplies SA de CV',    tipo:'YELO', n:7,  riesgo:'Alto'  },
  { condPago:'V028', prov:'PRV-30087', nombre:'Proveedora Nacional SA',   tipo:'YELO', n:3,  riesgo:'Alto'  },
  { condPago:'V037', prov:'PRV-20156', nombre:'Digital Commerce MX',      tipo:'YELO', n:1,  riesgo:'Medio' },
  { condPago:'V060', prov:'PRV-40201', nombre:'Distribuciones Premium MX',tipo:'YELO', n:1,  riesgo:'Bajo'  }
];
// Anomaly = dias_de_credito = 0 AND condiciones_pago_clave ≠ V000

/* ══════════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════════ */
interface DashState { tipo: string; periodo: string; tab: number; }

interface LiveKpi { total: number; yelo: number; yecl: number; prom: number; anom: number; }
interface LiveCond { label: string; yelo: number; yecl: number; }
interface LiveEvo  { month: string; all:  number; yelo: number; yecl: number; }

interface LiveData {
  kpi?:  LiveKpi;
  cond?: LiveCond[];
  evo?:  LiveEvo[];
}

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
  private live:        LiveData = {};

  constructor(options: VisualConstructorOptions) {
    this.el     = options.element;
    this.host   = options.host;
    this.events = options.host.eventService;
    this.el.classList.add('hnk-dash');

    // Event delegation — attached once to the root, survives innerHTML rebuilds
    this.el.addEventListener('click', (evt: MouseEvent) => {
      if (!this.initialized) return;
      const target = evt.target as HTMLElement;

      const chip = target.closest<HTMLElement>('.hnk-sc');
      if (chip) {
        const g = chip.dataset.g;
        const v = chip.dataset.v;
        if (g && v) {
          this.el.querySelectorAll<HTMLElement>(`.hnk-sc[data-g="${g}"]`)
            .forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          (this.st as any)[g] = v;
          this.updateBadge();
          this.renderTab(this.st.tab);
        }
        return;
      }

      const tabEl = target.closest<HTMLElement>('.hnk-tab');
      if (tabEl) {
        const n = parseInt(tabEl.dataset.tab ?? '0', 10);
        if (n > 0) this.activateTab(n);
      }
    });
  }

  /* ── update ── */
  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    try {
      const { width, height } = options.viewport;
      this.el.style.width  = `${width}px`;
      this.el.style.height = `${height}px`;

      this.readDataView(options);

      if (!this.initialized) {
        this.buildDOM();
        this.initialized = true;
        this.activateTab(1);
      } else {
        this.updateBadge();
        this.renderTab(this.st.tab);
      }
      this.events.renderingFinished(options);
    } catch (err) {
      this.events.renderingFailed(options, String(err));
    }
  }

  /* ── dataView reader ── */
  private readDataView(options: VisualUpdateOptions): void {
    this.live = {};
    const dv  = options.dataViews?.[0];
    if (!dv?.categorical) return;

    const cat    = dv.categorical;
    const cats   = cat.categories?.[0];
    const vals   = cat.values;
    if (!vals || vals.length === 0) return;

    // Locate measure columns by role
    let iTotal = -1, iYELO = -1, iYECL = -1, iProm = -1, iAnom = -1;
    vals.forEach((v, i) => {
      const roles: Record<string, boolean> = (v as any).source?.roles ?? {};
      if (roles['totalContratos']) iTotal = i;
      if (roles['contratosYELO'])  iYELO  = i;
      if (roles['contratosYECL'])  iYECL  = i;
      if (roles['promDias'])       iProm  = i;
      if (roles['anomalias'])      iAnom  = i;
    });

    const num = (idx: number, row: number): number => {
      if (idx < 0) return 0;
      const v = vals[idx]?.values?.[row];
      return typeof v === 'number' ? v : (v != null ? +v : 0);
    };
    const sum = (idx: number): number => {
      if (idx < 0) return 0;
      return (vals[idx]?.values ?? []).reduce<number>((s, v) =>
        s + (typeof v === 'number' ? v : (v != null ? +v : 0)), 0);
    };

    const rowCount = cats ? cats.values.length : (vals[0]?.values?.length ?? 0);

    if (!cats || rowCount === 0) {
      // No category: scalar summary from first row
      const total = iTotal >= 0 ? num(iTotal, 0) : 0;
      const yelo  = iYELO  >= 0 ? num(iYELO,  0) : 0;
      const yecl  = iYECL  >= 0 ? num(iYECL,  0) : 0;
      const prom  = iProm  >= 0 ? num(iProm,   0) : 0;
      const anom  = iAnom  >= 0 ? num(iAnom,   0) : 0;
      if (total > 0 || yelo > 0 || yecl > 0) {
        this.live.kpi = { total, yelo, yecl, prom, anom };
      }
      return;
    }

    // Detect category type: dateTime → evolution, text → condition bars
    const isDate: boolean = cats.source?.type?.dateTime === true
      || cats.values[0] instanceof Date;

    if (isDate) {
      const evo: LiveEvo[] = [];
      cats.values.forEach((cv, i) => {
        let label: string;
        if (cv instanceof Date) {
          label = cv.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        } else if (typeof cv === 'string') {
          const d = new Date(cv);
          label = isNaN(d.getTime()) ? cv : d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
        } else {
          label = String(cv ?? '');
        }
        evo.push({
          month: label,
          all:   iTotal >= 0 ? num(iTotal, i) : 0,
          yelo:  iYELO  >= 0 ? num(iYELO,  i) : 0,
          yecl:  iYECL  >= 0 ? num(iYECL,  i) : 0
        });
      });
      if (evo.length > 0) {
        this.live.evo = evo;
        // KPI = last row (most recent)
        const last = evo.length - 1;
        this.live.kpi = {
          total: evo[last].all,
          yelo:  evo[last].yelo,
          yecl:  evo[last].yecl,
          prom:  iProm >= 0 ? num(iProm, last) : 0,
          anom:  iAnom >= 0 ? num(iAnom, last) : 0
        };
      }
    } else {
      // Text category → condition / tipo breakdown
      const cond: LiveCond[] = [];
      cats.values.forEach((cv, i) => {
        cond.push({
          label: String(cv ?? ''),
          yelo:  iYELO  >= 0 ? num(iYELO, i)  : (iTotal >= 0 ? num(iTotal, i) : 0),
          yecl:  iYECL  >= 0 ? num(iYECL, i)  : 0
        });
      });
      if (cond.length > 0) {
        this.live.cond = cond;
        this.live.kpi  = {
          total: iTotal >= 0 ? sum(iTotal) : cond.reduce((s, c) => s + c.yelo + c.yecl, 0),
          yelo:  iYELO  >= 0 ? sum(iYELO)  : cond.reduce((s, c) => s + c.yelo, 0),
          yecl:  iYECL  >= 0 ? sum(iYECL)  : cond.reduce((s, c) => s + c.yecl, 0),
          prom:  iProm  >= 0 ? num(iProm, 0) : 0,
          anom:  iAnom  >= 0 ? sum(iAnom)   : 0
        };
      }
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
        <svg class="hnk-logo-star" width="34" height="34" viewBox="0 0 36 36">
          <polygon points="18,2 21.8,13.1 33.5,13.1 24.1,20.0 27.6,31.2 18,24.4 8.4,31.2 11.9,20.0 2.5,13.1 14.2,13.1"/>
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

  private kd(): { total:number; yelo:number; yecl:number; prom:number; anom:number } {
    if (this.live.kpi) return this.live.kpi;
    return KD[`${this.st.tipo}-${this.st.periodo}`] ?? KD['all-all'];
  }

  private condData(): { y:number[]; e:number[] } {
    if (this.live.cond && this.live.cond.length > 0) {
      return {
        y: this.live.cond.map(c => c.yelo),
        e: this.live.cond.map(c => c.yecl)
      };
    }
    return COND_D[this.st.tipo] ?? COND_D['all'];
  }

  private condLabels(): string[] {
    if (this.live.cond && this.live.cond.length > 0) {
      return this.live.cond.map(c => c.label);
    }
    return COND_LABELS;
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
    if (bwrap) drawCondBars(bwrap, cd.y, cd.e, this.condLabels());
  }

  /* ══════════════════════════════════════════════════════════════
     TAB 2 — Análisis de Condiciones
     ══════════════════════════════════════════════════════════════ */
  private renderTab2(): void {
    const cd   = this.condData();
    const lbls = this.condLabels();
    // avg days per label — use embedded reference or derive from label text
    const avg  = lbls.map((l, i) => COND_AVG[i] ?? (parseInt(l) || 30));
    const wrap = this.el.querySelector<HTMLElement>('#mixed-wrap');
    if (wrap) drawMixedChart(wrap, cd.y, cd.e, lbls, avg);
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

    /* Anomaly section — criteria: dias_de_credito = 0 AND condPago ≠ V000 */
    const awrap = this.el.querySelector<HTMLElement>('#anom-wrap');
    const title = this.el.querySelector<HTMLElement>('#anom-title');
    if (awrap) {
      const isYecl = tipo === 'YECL';
      if (isYecl || kd.anom === 0) {
        awrap.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;
                      justify-content:center;height:100%;gap:8px;">
            <div style="font-size:32px;">&#10003;</div>
            <div style="font-size:14px;font-weight:700;color:#00A651;">Sin Anomalías</div>
            <div style="font-size:11px;color:#A0AEC0;">
              ${isYecl ? 'YECL no presenta contratos con días de crédito = 0' : 'No se detectaron anomalías en el período seleccionado'}
            </div>
          </div>`;
        if (title) title.textContent = 'Anomalías — dias_de_credito = 0 y Cond. ≠ V000';
      } else {
        const rows = tipo === 'all'
          ? ANOM_ROWS
          : ANOM_ROWS.filter(r => r.tipo === tipo);

        const cnt = rows.reduce((s, r) => s + r.n, 0);
        if (title) title.textContent = `Anomalías — ${cnt} contratos: dias_credito=0 y Cond.≠V000`;

        awrap.innerHTML = `
          <table class="anom-tbl">
            <thead>
              <tr>
                <th>Condición de Pago</th>
                <th>Proveedor</th>
                <th>Razón Social</th>
                <th>Tipo</th>
                <th style="text-align:center;">Contratos</th>
                <th style="text-align:center;">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong style="color:#E2231A;">${r.condPago}</strong>
                    <span style="font-size:9px;color:#A0AEC0;margin-left:4px;">0 días</span></td>
                  <td>${r.prov}</td>
                  <td>${r.nombre}</td>
                  <td><span class="badge ${r.tipo.toLowerCase()}">${r.tipo}</span></td>
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

    let months: string[];
    let all:    number[];
    let yelo:   number[];
    let yecl:   number[];

    if (this.live.evo && this.live.evo.length >= 2) {
      months = this.live.evo.map(r => r.month);
      all    = this.live.evo.map(r => r.all);
      yelo   = this.live.evo.map(r => r.yelo);
      yecl   = this.live.evo.map(r => r.yecl);
    } else {
      months = MONTHS.slice(s, e);
      all    = EVA_ALL.slice(s, e);
      yelo   = EVA_YELO.slice(s, e);
      yecl   = EVA_YECL.slice(s, e);
    }

    /* Evolution line chart */
    const ewrap = this.el.querySelector<HTMLElement>('#evo-wrap');
    if (ewrap && months.length >= 2) {
      drawEvolutionChart(ewrap, months, all, yelo, yecl, this.st.tipo);
    }

    /* MoM delta — derive from live evo or static */
    const mwrap = this.el.querySelector<HTMLElement>('#mom-wrap');
    if (mwrap) {
      let momSlice:  number[];
      let momMonths: string[];
      if (this.live.evo && this.live.evo.length >= 2) {
        momSlice  = this.live.evo.slice(1).map((r, i) => r.all - this.live.evo![i].all);
        momMonths = this.live.evo.slice(1).map(r => r.month);
      } else {
        momSlice  = MOM_D.slice(s === 0 ? 0 : s - 1, e - 1);
        momMonths = MOM_M.slice(s === 0 ? 0 : s - 1, e - 1);
      }
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
