"use strict";

import { Selection } from "d3-selection";
import powerbi from "powerbi-visuals-api";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;

export function applyOpacity(
  container: Selection<SVGGElement, unknown, null, undefined>,
  selectedIds: ISelectionId[]
): void {
  if (selectedIds.length === 0) {
    container.selectAll(".hnk-datum").style("opacity", "1");
    return;
  }
  container.selectAll<SVGElement, { selectionId: ISelectionId }>(".hnk-datum")
    .style("opacity", d => {
      const id = d?.selectionId;
      const selected = id && selectedIds.some(s => s.equals(id));
      return selected ? "1" : "0.25";
    });
}

export function handleClick(
  event: MouseEvent,
  selectionId: ISelectionId | null,
  selectionManager: ISelectionManager
): void {
  if (!selectionId) return;
  const multiSelect = event.ctrlKey || event.metaKey;
  selectionManager.select(selectionId, multiSelect).then(() => {});
  event.stopPropagation();
}

export function handleKeydown(
  event: KeyboardEvent,
  selectionId: ISelectionId | null,
  selectionManager: ISelectionManager
): void {
  if (event.key === "Enter" || event.key === " ") {
    if (!selectionId) return;
    selectionManager.select(selectionId, false).then(() => {});
    event.preventDefault();
  }
}
