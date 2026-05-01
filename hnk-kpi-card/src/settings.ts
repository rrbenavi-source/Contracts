"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

// ─── KPI Settings Card ────────────────────────────────────────────────────────

export class KpiSettingsCard extends formattingSettings.SimpleCard {
  public name: string = "kpiSettings";
  public displayName: string = "Configuración KPI";

  public showSparkline = new formattingSettings.ToggleSwitch({
    name: "showSparkline",
    displayName: "Mostrar sparkline",
    value: true
  });

  public varianceMode = new formattingSettings.ItemDropdown({
    name: "varianceMode",
    displayName: "Modo varianza",
    items: [
      { displayName: "Porcentaje", value: "percent"  },
      { displayName: "Absoluto",   value: "absolute" }
    ],
    value: { displayName: "Porcentaje", value: "percent" }
  });

  public positiveColor = new formattingSettings.ColorPicker({
    name: "positiveColor",
    displayName: "Color favorable",
    value: { value: "#00A651" }
  });

  public negativeColor = new formattingSettings.ColorPicker({
    name: "negativeColor",
    displayName: "Color desfavorable",
    value: { value: "#E2231A" }
  });

  public sparklineColor = new formattingSettings.ColorPicker({
    name: "sparklineColor",
    displayName: "Color sparkline",
    value: { value: "#A5E600" }
  });

  public displayUnits = new formattingSettings.AutoDropdown({
    name: "displayUnits",
    displayName: "Unidades",
    value: 0
  });

  public decimalPlaces = new formattingSettings.NumUpDown({
    name: "decimalPlaces",
    displayName: "Decimales",
    value: 1
  });

  public slices: formattingSettings.Slice[] = [
    this.showSparkline,
    this.varianceMode,
    this.positiveColor,
    this.negativeColor,
    this.sparklineColor,
    this.displayUnits,
    this.decimalPlaces
  ];
}

// ─── Title Settings Card ──────────────────────────────────────────────────────

export class TitleSettingsCard extends formattingSettings.SimpleCard {
  public name: string = "titleSettings";
  public displayName: string = "Título";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Mostrar título",
    value: true
  });

  public titleText = new formattingSettings.TextInput({
    name: "titleText",
    displayName: "Texto del título",
    placeholder: "Vacío = nombre de la medida",
    value: ""
  });

  public fontSize = new formattingSettings.NumUpDown({
    name: "fontSize",
    displayName: "Tamaño de fuente",
    value: 11
  });

  public fontColor = new formattingSettings.ColorPicker({
    name: "fontColor",
    displayName: "Color de fuente",
    value: { value: "#4A5568" }
  });

  public slices: formattingSettings.Slice[] = [
    this.show,
    this.titleText,
    this.fontSize,
    this.fontColor
  ];
}

// ─── Root Model ───────────────────────────────────────────────────────────────

export class VisualFormattingSettingsModel extends formattingSettings.Model {
  public kpiSettings   = new KpiSettingsCard();
  public titleSettings = new TitleSettingsCard();

  public cards: formattingSettings.SimpleCard[] = [
    this.kpiSettings,
    this.titleSettings
  ];
}
