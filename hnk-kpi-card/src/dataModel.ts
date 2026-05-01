"use strict";

import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewCategoricalColumn = powerbi.DataViewCategoricalColumn;

export interface SparkPoint {
  label: string;
  value: number | null;
  selectionId: powerbi.visuals.ISelectionId | null;
}

export interface ViewModel {
  isValid: boolean;
  title: string;
  value: number | null;
  valueFormatted: string;
  target: number | null;
  targetFormatted: string;
  hasTarget: boolean;
  variance: number | null;
  variancePct: number | null;
  trend: SparkPoint[];
  hasSparkline: boolean;
  selectionId: powerbi.visuals.ISelectionId | null;
  highlights: boolean;
  highlightValue: number | null;
  highlightFormatted: string;
}

const EMPTY_VM: ViewModel = {
  isValid: false, title: "", value: null, valueFormatted: "—",
  target: null, targetFormatted: "—", hasTarget: false,
  variance: null, variancePct: null, trend: [], hasSparkline: false,
  selectionId: null, highlights: false, highlightValue: null, highlightFormatted: "—"
};

export function transform(options: VisualUpdateOptions, host: IVisualHost): ViewModel {
  const dv = options?.dataViews?.[0];
  if (!dv?.categorical) return EMPTY_VM;

  const { categories, values } = dv.categorical;

  const valueCol     = values?.find(v => v.source?.roles?.["value"]);
  const targetCol    = values?.find(v => v.source?.roles?.["target"]);
  const trendValCol  = values?.find(v => v.source?.roles?.["trendValue"]);
  const trendCat     = categories?.find(c => c.source?.roles?.["trend"]);

  if (!valueCol) return EMPTY_VM;

  const rawValue = valueCol.values?.[0] as number | null;
  const rawTarget = targetCol ? (targetCol.values?.[0] as number | null) : null;

  // Highlight support: when cross-filter active, use highlighted value
  const hlValues = valueCol.highlights;
  const hlValue  = hlValues ? (hlValues[0] as number | null) : null;
  const hasHighlights = hlValues != null;

  const displayValue = hasHighlights && hlValue != null ? hlValue : rawValue;
  const fmt = valueCol.source?.format ?? "";

  const variance    = displayValue != null && rawTarget != null ? displayValue - rawTarget : null;
  const variancePct = variance != null && rawTarget != null && rawTarget !== 0
    ? (variance / Math.abs(rawTarget)) * 100 : null;

  const title = valueCol.source?.displayName ?? "";

  // Build sparkline series
  const trend: SparkPoint[] = [];
  if (trendCat && trendValCol) {
    const labels = trendCat.values as (string | Date)[];
    const vals   = trendValCol.values as (number | null)[];
    for (let i = 0; i < labels.length; i++) {
      trend.push({
        label: formatLabel(labels[i]),
        value: vals[i],
        selectionId: host.createSelectionIdBuilder()
          .withCategory(trendCat as any, i)
          .createSelectionId()
      });
    }
  }

  return {
    isValid: true,
    title,
    value: rawValue,
    valueFormatted: fmt_num(rawValue),
    target: rawTarget,
    targetFormatted: fmt_num(rawTarget),
    hasTarget: rawTarget != null,
    variance,
    variancePct,
    trend,
    hasSparkline: trend.length >= 2,
    selectionId: trendCat
      ? host.createSelectionIdBuilder()
          .withCategory(trendCat as any, 0)
          .createSelectionId()
      : null,
    highlights: hasHighlights,
    highlightValue: hlValue,
    highlightFormatted: fmt_num(hlValue)
  };
}

function fmt_num(val: number | null): string {
  if (val == null) return "—";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000)        return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return val.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

function formatLabel(v: string | Date): string {
  if (v instanceof Date) return v.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  return String(v ?? "");
}

export { fmt_num };
