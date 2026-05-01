"use strict";

import { select, Selection, pointer } from "d3-selection";
import { line, curveMonotoneX, area } from "d3-shape";
import { scaleLinear, scalePoint } from "d3-scale";
import { extent, bisector } from "d3-array";

import powerbi from "powerbi-visuals-api";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { ViewModel, SparkPoint } from "../dataModel";
import { VisualFormattingSettingsModel } from "../settings";
import { handleClick, handleKeydown } from "../behavior/interactivity";
import { buildMainTooltip, buildSparkTooltip } from "../behavior/tooltip";

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  green:      "#205527",
  brightGrn:  "#A5E600",
  success:    "#00A651",
  warning:    "#F2A900",
  danger:     "#E2231A",
  n700:       "#4A5568",
  n500:       "#A0AEC0",
  n200:       "#E2E8F0",
  white:      "#FFFFFF"
};

type SizeClass = "xs" | "s" | "m" | "l";

function sizeOf(w: number, h: number): SizeClass {
  if (w < 160 || h < 80)  return "xs";
  if (w < 240 || h < 110) return "s";
  if (w < 360 || h < 160) return "m";
  return "l";
}

// ─── Main render entry ────────────────────────────────────────────────────────

export function renderKpiCard(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  vm: ViewModel,
  settings: VisualFormattingSettingsModel,
  w: number, h: number,
  isHighContrast: boolean,
  selectionManager: ISelectionManager,
  tooltipService: ITooltipServiceWrapper
): void {
  svg.selectAll("*").remove();

  const sz = sizeOf(w, h);
  const PAD = sz === "xs" ? 6 : sz === "s" ? 8 : 12;

  if (!vm.isValid) {
    renderLanding(svg, w, h);
    return;
  }

  // Resolve user-configured colors (fall back to defaults)
  const posColor = isHighContrast ? C.n700 :
    (settings.kpiSettings.positiveColor.value?.value ?? C.success);
  const negColor = isHighContrast ? C.n700 :
    (settings.kpiSettings.negativeColor.value?.value ?? C.danger);
  const spkColor = isHighContrast ? C.n700 :
    (settings.kpiSettings.sparklineColor.value?.value ?? C.brightGrn);

  const varColor  = vm.variancePct != null
    ? (vm.variancePct >= 0 ? posColor : negColor) : C.n500;
  const varArrow  = vm.variancePct != null ? (vm.variancePct >= 0 ? "▲" : "▼") : "";
  const varPctStr = vm.variancePct != null ? `${varArrow} ${Math.abs(vm.variancePct).toFixed(1)}%` : "";

  const showSpark = settings.kpiSettings.showSparkline.value && vm.hasSparkline;
  const showTitle = settings.titleSettings.show.value;
  const varMode   = (settings.kpiSettings.varianceMode.value as any)?.value ?? "percent";

  // Root group — keyboard navigation
  const root = svg.append("g")
    .attr("class", "hnk-kpi-root")
    .attr("tabindex", "0")
    .attr("role", "img")
    .attr("aria-label", buildAriaLabel(vm, varPctStr));

  root
    .on("click", (evt: MouseEvent) =>
      handleClick(evt, vm.selectionId, selectionManager))
    .on("keydown", (evt: KeyboardEvent) =>
      handleKeydown(evt, vm.selectionId, selectionManager))
    .on("contextmenu", (evt: MouseEvent) => {
      if (vm.selectionId) {
        selectionManager.showContextMenu(vm.selectionId,
          { x: evt.clientX, y: evt.clientY });
        evt.preventDefault();
      }
    });

  switch (sz) {
    case "xs": drawXS(root, vm, w, h, PAD, varColor, varArrow); break;
    case "s":  drawS(root, vm, w, h, PAD, varColor, varPctStr); break;
    case "m":  drawM(root, vm, w, h, PAD, varColor, varPctStr, spkColor, showSpark, showTitle, settings); break;
    case "l":  drawL(root, vm, w, h, PAD, varColor, varPctStr, spkColor, showSpark, showTitle, varMode, settings); break;
  }

  // Tooltip on the whole visual area
  tooltipService.addTooltip(
    root as any,
    () => buildMainTooltip(vm),
    () => vm.selectionId as any
  );

  // Sparkline dot tooltip — only rendered in M/L
  if (showSpark && (sz === "m" || sz === "l")) {
    attachSparkTooltip(root, vm, w, h, PAD, sz, spkColor, tooltipService, settings);
  }
}

// ─── XS ──────────────────────────────────────────────────────────────────────

function drawXS(
  g: Selection<SVGGElement, unknown, null, undefined>,
  vm: ViewModel, w: number, h: number, pad: number,
  varColor: string, varArrow: string
): void {
  const fs = Math.min(h * 0.45, w * 0.28, 38);
  g.append("text")
    .attr("x", w / 2).attr("y", h / 2 - 2)
    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-weight", "700").attr("font-size", fs)
    .attr("fill", C.green)
    .text(vm.valueFormatted);

  if (varArrow && vm.variancePct != null) {
    g.append("text")
      .attr("x", w / 2).attr("y", h / 2 + fs * 0.72)
      .attr("text-anchor", "middle")
      .attr("font-size", "12").attr("fill", varColor)
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .text(varArrow);
  }
}

// ─── S ───────────────────────────────────────────────────────────────────────

function drawS(
  g: Selection<SVGGElement, unknown, null, undefined>,
  vm: ViewModel, w: number, h: number, pad: number,
  varColor: string, varPctStr: string
): void {
  const fs = Math.min(h * 0.38, w * 0.22, 32);
  const cy = h * 0.45;

  g.append("text")
    .attr("x", pad).attr("y", cy)
    .attr("dominant-baseline", "middle")
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-weight", "700").attr("font-size", fs)
    .attr("fill", C.green)
    .text(vm.valueFormatted);

  if (varPctStr) {
    g.append("text")
      .attr("x", pad).attr("y", cy + fs * 0.72)
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .attr("font-size", "12").attr("fill", varColor)
      .text(varPctStr);
  }
}

// ─── M ───────────────────────────────────────────────────────────────────────

function drawM(
  g: Selection<SVGGElement, unknown, null, undefined>,
  vm: ViewModel, w: number, h: number, pad: number,
  varColor: string, varPctStr: string, spkColor: string,
  showSpark: boolean, showTitle: boolean,
  settings: VisualFormattingSettingsModel
): void {
  const fs = Math.min(h * 0.36, 36);
  let yOff = pad;

  if (showTitle && vm.title) {
    g.append("text")
      .attr("x", pad).attr("y", yOff + 11)
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .attr("font-size", settings.titleSettings.fontSize.value ?? 11)
      .attr("font-weight", "600").attr("fill", C.n700)
      .text(vm.title.toUpperCase());
    yOff += 18;
  }

  g.append("text")
    .attr("x", pad).attr("y", yOff + fs)
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-weight", "700").attr("font-size", fs)
    .attr("fill", C.green)
    .text(vm.valueFormatted);

  if (varPctStr) {
    g.append("text")
      .attr("x", pad).attr("y", yOff + fs + 16)
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .attr("font-size", "12").attr("fill", varColor)
      .text(varPctStr);
  }

  if (showSpark) {
    const spH = 20;
    const spY = h - spH - pad;
    drawSparkline(g, vm.trend, pad, spY, w - pad * 2, spH, spkColor);
  }
}

// ─── L ───────────────────────────────────────────────────────────────────────

function drawL(
  g: Selection<SVGGElement, unknown, null, undefined>,
  vm: ViewModel, w: number, h: number, pad: number,
  varColor: string, varPctStr: string, spkColor: string,
  showSpark: boolean, showTitle: boolean, varMode: string,
  settings: VisualFormattingSettingsModel
): void {
  const spH = showSpark ? 34 : 0;
  let y = pad;

  // Title row
  if (showTitle && vm.title) {
    const titleText = settings.titleSettings.titleText.value?.trim()
      ? settings.titleSettings.titleText.value.trim()
      : vm.title;
    const titleFs   = settings.titleSettings.fontSize.value ?? 11;
    const titleFill = settings.titleSettings.fontColor.value?.value ?? C.n700;

    g.append("text")
      .attr("x", pad).attr("y", y + titleFs)
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .attr("font-size", titleFs).attr("font-weight", "600")
      .attr("fill", titleFill)
      .text(titleText.toUpperCase());
    y += titleFs + 6;
  }

  // Main value
  const fs = Math.min((h - y - spH - pad) * 0.65, 48);
  g.append("text")
    .attr("x", pad).attr("y", y + fs)
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-weight", "700").attr("font-size", fs)
    .attr("fill", C.green)
    .text(vm.valueFormatted);
  y += fs + 8;

  // Variance badge
  if (vm.hasTarget && vm.variancePct != null && varPctStr) {
    const badgeText = varMode === "absolute" && vm.variance != null
      ? `${vm.variance >= 0 ? "▲ +" : "▼ "}${Math.abs(vm.variance).toLocaleString("es-MX", { maximumFractionDigits: 1 })}`
      : varPctStr;

    const charW    = 7.8;
    const badgeW   = badgeText.length * charW + 14;
    const badgeH   = 22;

    g.append("rect")
      .attr("x", pad).attr("y", y)
      .attr("width", badgeW).attr("height", badgeH)
      .attr("rx", 4).attr("ry", 4)
      .attr("fill", varColor);

    g.append("text")
      .attr("x", pad + 7).attr("y", y + badgeH / 2 + 1)
      .attr("dominant-baseline", "middle")
      .attr("font-family", "Segoe UI, Arial, sans-serif")
      .attr("font-size", "13").attr("font-weight", "600")
      .attr("fill", C.white)
      .text(badgeText);

    // Target reference
    if (vm.hasTarget) {
      g.append("text")
        .attr("x", pad + badgeW + 8).attr("y", y + badgeH / 2 + 1)
        .attr("dominant-baseline", "middle")
        .attr("font-family", "Segoe UI, Arial, sans-serif")
        .attr("font-size", "11").attr("fill", C.n700)
        .text(`vs ${vm.targetFormatted}`);
    }

    y += badgeH + 6;
  }

  // Sparkline
  if (showSpark) {
    const spY = h - spH - pad;
    drawSparkline(g, vm.trend, pad, spY, w - pad * 2, spH, spkColor);
  }
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function drawSparkline(
  g: Selection<SVGGElement, unknown, null, undefined>,
  trend: SparkPoint[],
  x: number, y: number,
  w: number, h: number,
  strokeColor: string
): void {
  const valid = trend.filter(d => d.value != null);
  if (valid.length < 2) return;

  const n = trend.length;
  const xSc = scaleLinear().domain([0, n - 1]).range([0, w]);

  const vals = valid.map(d => d.value as number);
  const [vMin, vMax] = extent(vals) as [number, number];
  const pad = (vMax - vMin) * 0.15 || 1;
  const ySc = scaleLinear().domain([vMin - pad, vMax + pad]).range([h, 0]);

  const lineGen = line<SparkPoint>()
    .x((_, i) => xSc(i))
    .y(d => ySc(d.value ?? (vMin - pad)))
    .defined(d => d.value != null)
    .curve(curveMonotoneX);

  const areaGen = area<SparkPoint>()
    .x((_, i) => xSc(i))
    .y0(h)
    .y1(d => ySc(d.value ?? (vMin - pad)))
    .defined(d => d.value != null)
    .curve(curveMonotoneX);

  const spG = g.append("g")
    .attr("class", "hnk-spark-group")
    .attr("transform", `translate(${x},${y})`);

  // Subtle fill
  spG.append("path")
    .datum(trend)
    .attr("class", "hnk-sparkline-fill")
    .attr("fill", strokeColor)
    .attr("opacity", "0.15")
    .attr("d", areaGen as any);

  // Line
  spG.append("path")
    .datum(trend)
    .attr("class", "hnk-sparkline-path")
    .attr("fill", "none")
    .attr("stroke", strokeColor)
    .attr("stroke-width", "1.5")
    .attr("stroke-linecap", "round")
    .attr("d", lineGen as any);

  // End dot
  const last = trend[trend.length - 1];
  if (last.value != null) {
    spG.append("circle")
      .attr("class", "hnk-sparkline-dot hnk-datum")
      .attr("cx", xSc(n - 1))
      .attr("cy", ySc(last.value))
      .attr("r", 3.5)
      .attr("fill", C.green)
      .attr("stroke", C.white)
      .attr("stroke-width", "1.5")
      .datum(last as any);
  }

  // Min / Max markers (L size only — caller decides)
  const maxPt = valid.reduce((a, b) => (b.value! > a.value! ? b : a));
  const minPt = valid.reduce((a, b) => (b.value! < a.value! ? b : a));
  [maxPt, minPt].forEach(pt => {
    const idx = trend.indexOf(pt);
    spG.append("circle")
      .attr("cx", xSc(idx))
      .attr("cy", ySc(pt.value!))
      .attr("r", 2.5)
      .attr("fill", pt === maxPt ? C.success : C.danger)
      .attr("stroke", C.white)
      .attr("stroke-width", "1");
  });
}

// ─── Sparkline hover tooltip ──────────────────────────────────────────────────

function attachSparkTooltip(
  root: Selection<SVGGElement, unknown, null, undefined>,
  vm: ViewModel,
  w: number, h: number, pad: number,
  sz: SizeClass,
  spkColor: string,
  tooltipService: ITooltipServiceWrapper,
  settings: VisualFormattingSettingsModel
): void {
  const spH   = sz === "l" ? 34 : 20;
  const spY   = h - spH - pad;
  const spW   = w - pad * 2;
  const n     = vm.trend.length;
  if (n < 2) return;

  const xSc = scaleLinear().domain([0, n - 1]).range([0, spW]);
  const bis = bisector<SparkPoint, number>((d, i) => xSc(vm.trend.indexOf(d))).center;

  // Invisible overlay rect to capture mouse events on sparkline area
  const overlay = root.append("rect")
    .attr("class", "hnk-spark-overlay")
    .attr("x", pad).attr("y", spY)
    .attr("width", spW).attr("height", spH)
    .attr("fill", "transparent")
    .attr("cursor", "crosshair");

  // Hover dot
  const hoverDot = root.append("circle")
    .attr("class", "hnk-hover-dot")
    .attr("r", 4)
    .attr("fill", spkColor)
    .attr("stroke", C.white)
    .attr("stroke-width", "1.5")
    .attr("pointer-events", "none")
    .style("display", "none");

  const vals = vm.trend.filter(d => d.value != null).map(d => d.value as number);
  const [vMin, vMax] = extent(vals) as [number, number];
  const padV = (vMax - vMin) * 0.15 || 1;
  const ySc  = scaleLinear().domain([vMin - padV, vMax + padV]).range([spH, 0]);

  tooltipService.addTooltip(
    overlay as any,
    (event: any) => {
      if (!event) return [];
      const [mx] = pointer(event, overlay.node()!);
      const xRel = mx - 0;
      const idx  = Math.max(0, Math.min(n - 1, Math.round(xSc.invert(xRel))));
      const pt   = vm.trend[idx];
      if (pt?.value != null) {
        hoverDot
          .style("display", null)
          .attr("cx", pad + xSc(idx))
          .attr("cy", spY + ySc(pt.value));
      }
      return buildSparkTooltip(pt, vm.title);
    },
    () => undefined as any
  );

  overlay.on("mouseleave", () => hoverDot.style("display", "none"));
}

// ─── Landing page ─────────────────────────────────────────────────────────────

function renderLanding(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  w: number, h: number
): void {
  const g = svg.append("g");

  // Heineken star (simplified)
  const cx = w / 2, cy = h / 2 - 18;
  g.append("polygon")
    .attr("points", starPoints(cx, cy, 14, 6, 5).join(" "))
    .attr("fill", "#E8321C");

  g.append("text")
    .attr("x", cx).attr("y", cy + 28)
    .attr("text-anchor", "middle")
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-size", "11").attr("fill", C.n500)
    .text("Asigna una medida al campo Valor");
}

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number): string[] {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r     = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAriaLabel(vm: ViewModel, varStr: string): string {
  const parts = [`KPI ${vm.title}`, `valor ${vm.valueFormatted}`];
  if (vm.hasTarget) parts.push(`objetivo ${vm.targetFormatted}`);
  if (varStr)       parts.push(`varianza ${varStr}`);
  return parts.join(", ");
}
