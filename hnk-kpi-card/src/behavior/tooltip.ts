"use strict";

import powerbi from "powerbi-visuals-api";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import { ViewModel, SparkPoint, fmt_num } from "../dataModel";

export function buildMainTooltip(vm: ViewModel): VisualTooltipDataItem[] {
  const items: VisualTooltipDataItem[] = [];

  items.push({
    displayName: vm.title || "Valor",
    value: vm.valueFormatted,
    color: "#205527",
    header: "KPI Heineken"
  });

  if (vm.hasTarget) {
    items.push({
      displayName: "Objetivo",
      value: vm.targetFormatted,
      color: "#4A5568"
    });

    if (vm.variance != null) {
      const sign = vm.variance >= 0 ? "+" : "";
      items.push({
        displayName: "Varianza",
        value: `${sign}${fmt_num(vm.variance)}`,
        color: vm.variance >= 0 ? "#00A651" : "#E2231A"
      });
    }

    if (vm.variancePct != null) {
      const sign = vm.variancePct >= 0 ? "▲ +" : "▼ ";
      items.push({
        displayName: "Varianza %",
        value: `${sign}${vm.variancePct.toFixed(1)}%`,
        color: vm.variancePct >= 0 ? "#00A651" : "#E2231A"
      });
    }
  }

  return items;
}

export function buildSparkTooltip(
  point: SparkPoint,
  title: string
): VisualTooltipDataItem[] {
  return [
    {
      displayName: title || "Período",
      value: point.label,
      header: "Tendencia",
      color: "#205527"
    },
    {
      displayName: "Valor",
      value: fmt_num(point.value),
      color: "#A5E600"
    }
  ];
}
