"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import IVisual                  = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions      = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost              = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService      = powerbi.extensibility.IVisualEventService;
import ISelectionManager        = powerbi.extensibility.ISelectionManager;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import {
  createTooltipServiceWrapper,
  ITooltipServiceWrapper
} from "powerbi-visuals-utils-tooltiputils";
import { select, Selection } from "d3-selection";

import { VisualFormattingSettingsModel }  from "./settings";
import { transform, ViewModel }           from "./dataModel";
import { renderKpiCard }                  from "./chart/kpiCard";

export class Visual implements IVisual {
  private host:             IVisualHost;
  private root:             HTMLElement;
  private svg:              Selection<SVGSVGElement, unknown, null, undefined>;
  private events:           IVisualEventService;
  private selectionManager: ISelectionManager;
  private tooltipService:   ITooltipServiceWrapper;
  private fmtService:       FormattingSettingsService;
  private settings:         VisualFormattingSettingsModel;
  private isHighContrast:   boolean;
  private vm:               ViewModel;

  constructor(options: VisualConstructorOptions) {
    this.host            = options.host;
    this.root            = options.element;
    this.events          = this.host.eventService;
    this.selectionManager = this.host.createSelectionManager();

    const lm = this.host.createLocalizationManager();
    this.fmtService = new FormattingSettingsService(lm);

    this.tooltipService = createTooltipServiceWrapper(
      this.host.tooltipService, this.root
    );

    const cp = this.host.colorPalette as ISandboxExtendedColorPalette;
    this.isHighContrast = cp?.isHighContrast ?? false;

    // Wrap root element for scoped styles
    this.root.classList.add("hnk-kpi-card");

    this.svg = (select(this.root) as any).append("svg")
      .attr("width",  "100%")
      .attr("height", "100%")
      .attr("role",   "img")
      .attr("aria-label", "Heineken KPI Card") as
      Selection<SVGSVGElement, unknown, null, undefined>;

    this.settings = new VisualFormattingSettingsModel();

    // Restore selection state when bookmarks activate
    this.selectionManager.registerOnSelectCallback(
      (ids: powerbi.visuals.ISelectionId[]) => {
        // Re-render with restored selection state
        if (this.vm) {
          this.redraw(
            this.svg.attr("width") as unknown as number,
            this.svg.attr("height") as unknown as number
          );
        }
      }
    );

    // Clear selection on background click
    this.svg.on("click", () => {
      this.selectionManager.clear().then(() => {});
    });
  }

  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    try {
      // Parse formatting settings from first dataView
      this.settings = this.fmtService.populateFormattingSettingsModel(
        VisualFormattingSettingsModel,
        options.dataViews?.[0]
      );

      // Transform dataView → ViewModel
      this.vm = transform(options, this.host);

      const { width, height } = options.viewport;
      this.svg
        .attr("width",  width)
        .attr("height", height);

      this.redraw(width, height);

      // Pagination for large datasets (unlikely for KPI card, but correct)
      const dv = options.dataViews?.[0];
      if (dv?.metadata?.segment) {
        this.host.fetchMoreData(true);
      }

      this.events.renderingFinished(options);
    } catch (err) {
      console.error("HnkKpiCard render error:", err);
      this.events.renderingFailed(options, String(err));
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.fmtService.buildFormattingModel(this.settings);
  }

  private redraw(width: number, height: number): void {
    renderKpiCard(
      this.svg,
      this.vm,
      this.settings,
      width,
      height,
      this.isHighContrast,
      this.selectionManager,
      this.tooltipService
    );
  }
}
