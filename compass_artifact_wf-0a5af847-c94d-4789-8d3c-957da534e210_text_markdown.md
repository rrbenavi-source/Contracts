# Especificación técnica de visuales personalizados Power BI para dashboards ejecutivos — Heineken México

> **Documento técnico funcional** · Versión 1.0 · Mayo 2026
> **Audiencia**: Desarrollador Senior Power BI Custom Visuals (.pbiviz)
> **Alcance**: Uso interno empresarial vía Organizational Visuals (Admin Portal). **Sin certificación AppSource**.
> **Stack base recomendado**: D3.js v7 modular + TypeScript 5 + powerbi-visuals-api 5.11 + powerbi-visuals-tools 7.0.x

---

## 0. Marco técnico común a los seis visuales

Antes de detallar cada visual, esta sección consolida los requisitos transversales de la plataforma. **Todos los visuales del catálogo Heineken DEBEN cumplir estas bases**; cada sección posterior añade requisitos específicos.

### 0.1 Stack base obligatorio (versiones congeladas para el proyecto)

| Componente | Versión | Justificación |
|---|---|---|
| **Node.js** | 20 LTS o 22 LTS | Mínimo impuesto por `pbiviz` 5.0+: Node 18.0; recomendado última LTS |
| **powerbi-visuals-tools (`pbiviz` CLI)** | **7.0.3** | Última estable. Atención: rompe polyfills Node de webpack desde 7.0.0 |
| **powerbi-visuals-api** | **5.11.0** | Última publicada. Elimina `storageService` (queda `storageV2Service`). `apiVersion` en `pbiviz.json` debe coincidir |
| **TypeScript** | **5.x** | Impuesto desde pbiviz 5.6.0; `target: ES2022`, `module: ES2022` |
| **ESLint** | v9 | Impuesto desde pbiviz 5.6.0 |
| **powerbi-visuals-utils-formattingmodel** | 6.2.2 | Helpers para nuevo Format Pane (`getFormattingModel`) |
| **powerbi-visuals-utils-formattingutils** | 6.1.2 | `valueFormatter`, `textMeasurementService` |
| **powerbi-visuals-utils-tooltiputils** | 6.0.4 | `ITooltipServiceWrapper` |
| **powerbi-visuals-utils-dataviewutils** | 6.1.0 | `dataRoleHelper`, `dataViewWildcard`, `dataViewObjects` |
| **powerbi-visuals-utils-chartutils** | 8.2.1 | Ejes, etiquetas, leyenda. Único utils en evolución activa |
| **powerbi-visuals-utils-colorutils** | 6.0.5 | Manipulación de color (HSL, parseColorString) |
| **powerbi-visuals-utils-typeutils** | 6.0.3 | Pixels, Double, Prototype |
| **powerbi-visuals-utils-svgutils** | 6.0.4 | CssConstants, manipulation, shapes |
| **D3.js** | 7.9.0 | ISC, modular. Importar SIEMPRE por submódulo (`d3-selection`, `d3-shape`, etc.) |
| **@types/d3** | última | Tipos oficiales DefinitelyTyped |
| **Navegadores** | Microsoft Edge (Chromium) y Chrome últimas dos versiones | Power BI Service oficialmente solo soporta navegadores Chromium recientes y Safari para iPad |

**Comando de instalación inicial (proyecto nuevo):**
```bash
npm i -g powerbi-visuals-tools@7.0.3
pbiviz new HnkExecKpiCard
cd HnkExecKpiCard
pbiviz --install-cert     # certificado SSL local para pbiviz start
npm i powerbi-visuals-api@5.11.0 \
      powerbi-visuals-utils-formattingmodel@6.2.2 \
      powerbi-visuals-utils-formattingutils@6.1.2 \
      powerbi-visuals-utils-tooltiputils@6.0.4 \
      powerbi-visuals-utils-dataviewutils@6.1.0 \
      powerbi-visuals-utils-chartutils@8.2.1 \
      powerbi-visuals-utils-colorutils@6.0.5 \
      d3-selection@3 d3-scale@4 d3-shape@3 d3-array@3 d3-format@3 d3-axis@3 d3-transition@3
npm i -D @types/d3-selection @types/d3-scale @types/d3-shape @types/d3-array @types/d3-format @types/d3-axis
```

### 0.2 Estructura de carpetas estándar (igual para los seis visuales)

```
HnkExecKpiCard/
├── pbiviz.json                 # metadata, apiVersion, GUID
├── package.json
├── tsconfig.json               # target ES2022, sourceMap true
├── capabilities.json           # contrato visual ↔ host
├── eslint.config.js            # ESLint v9
├── webpack.config.json         # opcional, override pbiviz
├── assets/
│   └── icon.png                # 20×20, fondo transparente
├── stringResources/
│   ├── en-US/resources.resjson
│   └── es-MX/resources.resjson
├── style/
│   └── visual.less
└── src/
    ├── visual.ts               # IVisual entry point
    ├── settings.ts             # FormattingModel
    ├── dataModel.ts            # transformación dataView → ViewModel
    ├── chart/                  # módulos de render por tipo
    │   ├── kpiCard.ts
    │   └── ...
    └── behavior/
        ├── interactivity.ts    # SelectionManager wrappers
        └── tooltip.ts
```

### 0.3 `pbiviz.json` plantilla

```json
{
  "visual": {
    "name": "hnkExecKpiCard",
    "displayName": "Heineken Exec KPI Card",
    "guid": "HnkExecKpiCard1FB8C9F2A3D047CEB9E4F1A2D3E4F567",
    "visualClassName": "Visual",
    "version": "1.0.0.0",
    "description": "Tarjeta KPI ejecutiva con sparkline, varianza y formato condicional. Heineken México 2026.",
    "supportUrl": "https://heineken-mexico.atlassian.net/servicedesk/customer/portal/12",
    "gitHubUrl": ""
  },
  "apiVersion": "5.11.0",
  "author": { "name": "Heineken México · BI Center of Excellence", "email": "bi-coe@heineken.com.mx" },
  "assets": { "icon": "assets/icon.png" },
  "externalJS": [],
  "style": "style/visual.less",
  "capabilities": "capabilities.json",
  "dependencies": null,
  "stringResources": ["stringResources/en-US/resources.resjson", "stringResources/es-MX/resources.resjson"]
}
```

### 0.4 Privilegios estándar Heineken (`capabilities.json` → `privileges`)

Para uso **interno sin AppSource** y sin llamadas externas (todo dato proviene del modelo Power BI), **el array de privilegios DEBE ser vacío** salvo necesidad explícita:

```json
"privileges": []
```

Si un visual del catálogo necesita persistir estado del usuario (por ejemplo, último drill-down) en el navegador, declarar:

```json
"privileges": [
  { "name": "LocalStorage", "essential": false }
]
```

`WebAccess` **no se declara** porque el alcance del proyecto excluye llamadas a APIs externas (los datos viajan vía dataView de Power BI). `ExportContent` se declara solo en visuales que ofrezcan "Descargar datos" desde menú contextual (no es el caso para los seis del catálogo ejecutivo).

### 0.5 Paleta corporativa Heineken para visuales ejecutivos

| Token | Hex | Uso |
|---|---|---|
| `--hnk-corporate-green` | **#205527** | Color primario, ejes, KPIs positivos sobrios |
| `--hnk-bright-green` | **#A5E600** | Acento, highlights, valor primario en sparklines |
| `--hnk-success` | **#00A651** | Varianzas favorables (KPI ↑, ahorro, crecimiento) |
| `--hnk-warning` | **#F2A900** | Estado intermedio, semáforo amarillo |
| `--hnk-danger` | **#E2231A** | Varianzas desfavorables, fuera de target |
| `--hnk-neutral-700` | **#4A5568** | Texto secundario, ejes |
| `--hnk-neutral-500` | **#A0AEC0** | Líneas auxiliares, conectores waterfall |
| `--hnk-neutral-200` | **#E2E8F0** | Bandas cualitativas (bullet chart), grids suaves |
| `--hnk-bg` | **#FFFFFF** | Fondo principal |
| `--hnk-ibcs-blue` | **#1F4E79** | Totales/subtotales waterfall (convención IBCS) |

Todas las paletas deben validar **WCAG 2.1 AA contraste ≥ 4.5:1** sobre fondo blanco. La paleta soporta el modo high contrast de Power BI vía `ISandboxExtendedColorPalette` (sección 0.10).

### 0.6 Plantilla `visual.ts` (esqueleto reusable)

```ts
"use strict";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { select, Selection } from "d3-selection";

import { VisualFormattingSettingsModel } from "./settings";
import { transform, ViewModel } from "./dataModel";

export class Visual implements IVisual {
  private host: IVisualHost;
  private root: HTMLElement;
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private events: IVisualEventService;
  private selectionManager: ISelectionManager;
  private tooltipService: ITooltipServiceWrapper;
  private formattingService: FormattingSettingsService;
  private settings: VisualFormattingSettingsModel;
  private isHighContrast: boolean;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.root = options.element;
    this.events = this.host.eventService;
    this.selectionManager = this.host.createSelectionManager();
    const lm = this.host.createLocalizationManager();
    this.formattingService = new FormattingSettingsService(lm);
    this.tooltipService = createTooltipServiceWrapper(
      this.host.tooltipService, this.root);

    const cp = this.host.colorPalette as ISandboxExtendedColorPalette;
    this.isHighContrast = cp.isHighContrast;

    this.svg = select(this.root).append("svg")
      .attr("role", "img")
      .attr("aria-label", "Heineken executive visual");

    // Restaurar selección al cambiar bookmark
    this.selectionManager.registerOnSelectCallback(ids => this.applySelectionState(ids));
  }

  public update(options: VisualUpdateOptions): void {
    this.events.renderingStarted(options);
    try {
      this.settings = this.formattingService
        .populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews);

      const vm: ViewModel = transform(options, this.host);
      const { width, height } = options.viewport;
      this.svg.attr("width", width).attr("height", height);

      this.draw(vm, width, height);

      // Datasets > 30k → fetchMoreData
      const dv = options.dataViews?.[0];
      if (dv?.metadata?.segment) this.host.fetchMoreData(true);

      this.events.renderingFinished(options);
    } catch (e) {
      this.events.renderingFailed(options, String(e));
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingService.buildFormattingModel(this.settings);
  }

  private draw(vm: ViewModel, w: number, h: number): void { /* override por visual */ }
  private applySelectionState(ids: powerbi.visuals.ISelectionId[]): void { /* override */ }
}
```

### 0.7 Banderas booleanas de `capabilities.json` aplicables

Estado por defecto del catálogo Heineken:

```json
{
  "supportsHighlight": true,
  "supportsLandingPage": true,
  "supportsEmptyDataView": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": true,
  "supportsSynchronizingFilterState": false,
  "advancedEditModeSupport": 0
}
```

`supportsSynchronizingFilterState` se activa **solo** en visuales tipo slicer (no aplica a los seis del catálogo). `supportsKeyboardFocus: true` exige `tabindex="0"` en cada datapoint y manejadores `keydown` para Enter/Space/flechas.

### 0.8 Reducción de datos (`dataReductionAlgorithm`)

| Algoritmo | Uso recomendado en el catálogo |
|---|---|
| `top: { count: 30000 }` | Default para tablas y categorías acotadas (KPI, Waterfall, Gauge, Treemap) |
| `window: { count: 1000 }` | Heatmap y Combo+Forecast con grandes series temporales: `host.fetchMoreData(true)` paginará hasta el tope agregado de **100 MB** del dataView |
| `sample` | No usado; descarta detalle interior |

`top` con `count` > 30000 será **truncado por Power BI a 30 000** filas (límite duro para visuales JS/TS; visuales R llegan a 150 000).

### 0.9 Despliegue como Organizational Visual (sin AppSource)

**Proceso operativo (rol Fabric Administrator requerido):**

1. Compilar: `pbiviz package` → `dist/HnkExecKpiCard.pbiviz` (≤ 2 MB target).
2. Power BI Service → **Settings (engranaje) → Admin portal** (`https://app.powerbi.com/admin-portal`).
3. Sidebar → **Organizational visuals** (`/organizationVisuals`).
4. **Add visual → From a file** → seleccionar `.pbiviz`.
5. Completar metadatos: **Name** (visible en pestaña "MY ORGANIZATION" del panel Visualizations), **Icon** PNG, **Description**.
6. Aceptar disclaimer de seguridad. Click **Add**. La fuente queda como **"Private File"**.
7. **Access toggle** controla disponibilidad global; deshabilitar lo retira de TODOS los reportes que lo usan.
8. **Actualización**: fila → Actions → Settings → Browse → nuevo `.pbiviz` → Update. Los reportes existentes adoptan la nueva versión en el siguiente render.

**Validaciones que ejecuta Power BI Service:**
- Estructura del paquete `.pbiviz` (manifest + plugin).
- Esquema de `capabilities.json`.
- `apiVersion` declarada (debe ser ≥ 2.x; legacy custom visuals no son admisibles).
- **NO hay revisión de código fuente**: el admin asume el riesgo de seguridad.

**Tenant settings relevantes (Settings → Tenant settings → Power BI visuals):**
- *Allow visuals created using the Power BI SDK* — irrelevante para Org Store (los visuales del Org Store siempre se renderizan).
- *Add and use certified visuals only (block uncertified)* — irrelevante; los del Org Store se renderizan aun cuando contradigan esta política.
- *Allow downloads from custom visuals* — necesario solo si declaras `ExportContent`.

**Limitaciones conocidas para el catálogo Heineken (Org Store, no certificado AppSource):**

| Capacidad | Estado |
|---|---|
| Render en Power BI Service y Desktop | ✅ |
| Render en Power BI Mobile (iOS/Android) | ✅ |
| Power BI Report Server | ❌ no soportado |
| Export a **PowerPoint** | ❌ |
| Export a **PDF** | ❌ |
| **Email subscriptions** del visual | ❌ |
| `exportToFile` REST API | ❌ |
| AppSource auto-update | ❌ (manual por admin) |
| Acceso externo `WebAccess` | ✅ si se declara y admin lo permite |

> Para que un visual recupere export PDF/PPTX se requiere certificación AppSource. Heineken aceptará la limitación: la exportación de páginas y reportes se hace con visuales nativos certificados; estos seis quedan limitados a render online y captura manual de pantalla.

### 0.10 Accesibilidad WCAG 2.1 AA y high contrast

```ts
const cp = this.host.colorPalette as ISandboxExtendedColorPalette;
if (cp.isHighContrast) {
  // Reglas Microsoft:
  // 1. Todos los datapoints usan cp.foreground.value (un solo color)
  // 2. Shapes con stroke ≥ 2px y fill = cp.background.value
  // 3. Diferenciación entre series por dashing/markers, NO por color
  // 4. Highlight: 40% opacidad para no-seleccionados
  // 5. Slicers/selección activa: cp.foregroundSelected.value
}
```

Cada elemento SVG con datos lleva `<title>` para Narrator/JAWS/NVDA, `role="graphics-symbol"` y `aria-label` dinámico. Atajos garantizados por el host: `Ctrl+→` entrar al visual, `Tab` navegar datapoints (con `supportsKeyboardFocus`), `Esc` salir, `Alt+Shift+F11` mostrar tabla HTML accesible (autogenerada por Power BI desde el dataView).

### 0.11 Comandos de build / desarrollo

```bash
pbiviz start                           # https://localhost:8080 + developer visual en Service
pbiviz package                         # genera dist/*.pbiviz
pbiviz package --certification-audit   # auditor (incluso si no certificas, detecta antipatrones)
pbiviz lint                            # ESLint v9 con config recomendada
pbiviz info                            # versión API, GUID, nombre
```

Para usar el "Developer visual" en Power BI Service: Settings → **Developer settings → Enable developer visual for testing**.

### 0.12 Tooltips, Selección y eventos comunes

```ts
// Tooltip contextual sobre cualquier datapoint
this.tooltipService.addTooltip(
  this.svg.selectAll<SVGElement, DatumWithSelection>(".datum"),
  (d) => [
    { displayName: d.category, value: this.fmt(d.value), color: d.color, header: "Detalle" }
  ],
  (d) => d.selectionId
);

// Cross-filter en click
selection.on("click", (event: MouseEvent, d: DatumWithSelection) => {
  const multi = event.ctrlKey || event.metaKey;
  this.selectionManager.select(d.selectionId, multi).then(ids => {
    this.applyOpacity(ids);
  });
  event.stopPropagation();
});

// Limpiar selección al click en fondo
this.svg.on("click", () => this.selectionManager.clear());

// Menú contextual (right-click + Shift+F10 con keyboard)
selection.on("contextmenu", (event: MouseEvent, d) => {
  this.selectionManager.showContextMenu(d.selectionId, { x: event.clientX, y: event.clientY });
  event.preventDefault();
});
```

---

## 1. Tarjeta KPI avanzada (Advanced KPI Card)

Tarjeta ejecutiva con valor principal, comparación con target, varianza porcentual con indicador semafórico, sparkline histórico de 12 períodos y formato condicional aplicado al color del valor.

### 1.1 Requisitos técnicos de certificación Power BI

Aplica el stack base de §0. Especificidades:
- `apiVersion: "5.11.0"` en `pbiviz.json`.
- **Renderizado síncrono**: la KPI Card no requiere `fetchMoreData`; el dataView típico tiene 1–24 filas (la serie del sparkline). La llamada `events.renderingFinished` es síncrona inmediata.
- **Tamaño objetivo bundle**: < 80 kB pbiviz (sólo `d3-selection`, `d3-shape`, `d3-scale`, `d3-format`, `d3-array`).
- **Browser**: Edge/Chrome últimas dos versiones; testeado en iPad Safari para Power BI Mobile.

### 1.2 Características funcionales

**Tipos de datos soportados:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `value` (Measure) | numeric/integer | exactamente 1 |
| `target` (Measure) | numeric/integer | 0–1 (opcional) |
| `trend` (Grouping) | date/text | 0–1 (sparkline) |
| `trendValue` (Measure) | numeric | 0–1 (vinculado a `trend`) |

**`dataViewMappings` recomendado**: `categorical` con dos secciones (single value para `value`/`target`, categorical para `trend`/`trendValue`).

**Capabilities.json (extracto):**

```json
{
  "privileges": [],
  "dataRoles": [
    { "displayName": "Valor", "name": "value",  "kind": "Measure", "requiredTypes": [{ "numeric": true }, { "integer": true }] },
    { "displayName": "Target", "name": "target", "kind": "Measure", "requiredTypes": [{ "numeric": true }, { "integer": true }] },
    { "displayName": "Tendencia (eje)", "name": "trend", "kind": "Grouping", "requiredTypes": [{ "temporal": true }, { "text": true }] },
    { "displayName": "Tendencia (valor)", "name": "trendValue", "kind": "Measure", "requiredTypes": [{ "numeric": true }] }
  ],
  "dataViewMappings": [{
    "conditions": [{ "value": { "max": 1 }, "target": { "max": 1 }, "trend": { "max": 1 }, "trendValue": { "max": 1 } }],
    "categorical": {
      "categories": { "for": { "in": "trend" }, "dataReductionAlgorithm": { "top": { "count": 100 } } },
      "values": { "select": [
        { "for": { "in": "value" } }, { "for": { "in": "target" } }, { "for": { "in": "trendValue" } }
      ] }
    }
  }],
  "objects": {
    "kpiSettings": {
      "properties": {
        "displayUnits": { "type": { "formatting": { "labelDisplayUnits": true } } },
        "decimalPlaces": { "type": { "numeric": true } },
        "positiveColor": { "type": { "fill": { "solid": { "color": true } } } },
        "negativeColor": { "type": { "fill": { "solid": { "color": true } } } },
        "showSparkline": { "type": { "bool": true } },
        "varianceMode": { "type": { "enumeration": [
          { "value": "absolute", "displayName": "Absoluto" },
          { "value": "percent",  "displayName": "Porcentaje" }
        ] } }
      }
    }
  },
  "supportsHighlight": true,
  "supportsLandingPage": true,
  "supportsEmptyDataView": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": false
}
```

**Manejo de datos faltantes:**
- Si `value` es null o undefined → mostrar guion largo `—` con color neutral-500.
- Si `target` falta → ocultar bloque de varianza.
- Si `trend` tiene huecos → la línea del sparkline omite los nulls (`d3.line().defined(d => d != null)`).
- Cero divisiones cuando `target = 0` → render `n/a` en varianza.

**Filtrado en dashboards**: cuando otro visual filtra, el host re-emite `update` con el dataView re-agregado. La KPI Card respeta `supportsHighlight`: si el filtro proviene de un click cruzado, el host envía `values` y `highlights`. La tarjeta usa el `highlight` para el valor activo y atenua el `value` original al 25% como referencia visual.

### 1.3 Interactividad esperada

- **Tooltip contextual** sobre el valor principal: muestra valor formal, target, varianza absoluta y porcentual, último período de tendencia.
- **Tooltip sobre sparkline**: dot marker al hover con valor del período exacto (`bisector` de `d3-array`).
- **Cross-filtering**: click en la tarjeta filtra el resto del dashboard por la entidad asociada (`selectionId` derivado del scope del medidor — útil cuando la tarjeta está en un small multiple).
- **Drill-through**: menú contextual nativo de Power BI (`selectionManager.showContextMenu`) habilitado.
- **Keyboard**: `tabindex="0"` en el contenedor `<g>` raíz; Enter dispara cross-filter idéntico al click.

### 1.4 Diseño UX ejecutivo

**Layout responsive escalonado (heurísticas por viewport):**

| Tamaño | Width × Height | Composición |
|---|---|---|
| **XS** | < 160 × 80 | Sólo valor + flecha de tendencia (▲/▼); sin target ni sparkline |
| **S** | 160–240 × 80–110 | Valor + varianza % + flecha; sin sparkline |
| **M** | 240–360 × 110–160 | Valor + varianza % + sparkline 60×20 |
| **L** | > 360 × > 160 | Valor + título + target absoluto + varianza % + sparkline 100×30 + min/max marker |

Tipografía: Segoe UI (font-stack default Power BI). Valor principal **font-weight 700, 32–48 px** según viewport; varianza 14 px; etiqueta 11 px uppercase. Color del valor: corporate green `#205527` por defecto, conmutable a `#00A651` (positivo) o `#E2231A` (negativo) según `varianceMode` y signo.

**Status indicators**: triángulo Unicode (▲ U+25B2 / ▼ U+25BC) coloreado; opcional badge circular semafórico con tres niveles configurables vía formatting pane (umbrales en porcentaje sobre target).

**Accesibilidad**: contraste validado ≥ 7:1 para el valor principal; `aria-label` compuesto: `"KPI {nombre}, valor {fmt}, varianza {pct} respecto al objetivo {target}"`.

### 1.5 Optimización Power BI Service

- **Conectividad variable**: la tarjeta es la primera que pinta en pantalla y debe completar `renderingFinished` en < 50 ms para datasets típicos.
- **Refresh programado**: `update` se recibe con el nuevo dataView; aplicar interpolación numérica (`d3.interpolateNumber`) en 400 ms para suavizar transición.
- **Mobile**: heurística `width < 320 || height < 200` activa layout XS/S; `font-size` escala con viewport.
- **Tamaño bundle**: objetivo **< 80 kB**, holgado contra 2 MB.
- **Export PDF/PPTX**: limitación documentada en §0.9 (no soportado para Org Store). Captura manual o reemplazo por core visual KPI nativo cuando se requiera export.

### 1.6 Funcionalidades avanzadas

- **Formato condicional dinámico**: `ColorPicker` con `instanceKind: ConstantOrRule` permite al consumidor BI vincular el color a una medida DAX.
- **FormattingModel**: cards "General", "Valor", "Varianza", "Sparkline", "Formato condicional".
- **Bookmarks**: la tarjeta es stateless en cuanto a selección; al activar bookmark, `registerOnSelectCallback` recibe los IDs del estado previo.
- **persistProperties**: usado para guardar el último umbral semafórico que el usuario haya tuneado *en formato condicional manual* desde el panel.
- **Premium**: compatible con large datasets; el dataView de tarjeta nunca supera 100 filas.

### 1.7 Stack óptimo recomendado

**D3.js v7 modular + SVG nativo + `d3-format`**. Justificación: la tarjeta es composición SVG/HTML, no chart. ~12 kB gzipped. Importar Chart.js (50 kB) o ECharts (135 kB) es overkill. El sparkline es 20 líneas con `d3.line().curve(curveMonotoneX)`.

**Imports requeridos**: `d3-selection`, `d3-shape`, `d3-scale`, `d3-format`, `d3-array`. **No** importar `d3` completo.

---

## 2. Waterfall Chart personalizado

Waterfall ejecutivo con categorías, deltas señalizados por color (verde = favorable, rojo = desfavorable), pillars de subtotales y totales (azul IBCS), conectores punteados entre barras y etiquetas con valor absoluto y delta acumulado.

### 2.1 Requisitos técnicos de certificación Power BI

Stack base de §0. Específicos:
- `apiVersion: "5.11.0"`, `supportsHighlight: true` (esencial para que un slicer en otra visual atenue las barras no incluidas).
- Bundle objetivo < 120 kB. Imports: `d3-selection`, `d3-scale`, `d3-axis`, `d3-shape` (para conectores), `d3-array`, `d3-format`.
- Soporta hasta 30 000 filas de categorías (poco realista; los waterfalls ejecutivos suelen tener 5–25 categorías).

### 2.2 Características funcionales

**Roles de datos:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `category` (Grouping) | text | 1..N (orden importa) |
| `value` (Measure) | numeric/integer | 1 |
| `stepType` (Grouping) | text | 0–1 (valores: `delta`, `subtotal`, `total`) |

Si `stepType` no se asigna, el visual aplica reglas: la primera y última fila son `total`; toda fila con prefijo `=` o etiqueta `Subtotal *` se interpreta como `subtotal`; el resto son `delta`. Esta heurística es configurable vía formatting pane.

**`dataViewMappings`**: tipo `categorical` con `categories.dataReductionAlgorithm.top.count = 200`.

**capabilities.json (extracto):**

```json
{
  "dataRoles": [
    { "displayName": "Categoría", "name": "category", "kind": "Grouping", "requiredTypes": [{ "text": true }, { "temporal": true }] },
    { "displayName": "Valor", "name": "value", "kind": "Measure", "requiredTypes": [{ "numeric": true }, { "integer": true }] },
    { "displayName": "Tipo de paso", "name": "stepType", "kind": "Grouping", "requiredTypes": [{ "text": true }] }
  ],
  "dataViewMappings": [{
    "categorical": {
      "categories": { "select": [{ "for": { "in": "category" } }, { "for": { "in": "stepType" } }],
                       "dataReductionAlgorithm": { "top": { "count": 200 } } },
      "values": { "select": [{ "for": { "in": "value" } }] }
    }
  }],
  "objects": {
    "barColors": {
      "properties": {
        "positive": { "type": { "fill": { "solid": { "color": true } } } },
        "negative": { "type": { "fill": { "solid": { "color": true } } } },
        "totalPillar": { "type": { "fill": { "solid": { "color": true } } } },
        "subtotalPillar": { "type": { "fill": { "solid": { "color": true } } } }
      }
    },
    "labels": {
      "properties": {
        "show": { "type": { "bool": true } },
        "showDelta": { "type": { "bool": true } },
        "decimalPlaces": { "type": { "numeric": true } },
        "displayUnits": { "type": { "formatting": { "labelDisplayUnits": true } } }
      }
    },
    "connectors": { "properties": { "show": { "type": { "bool": true } }, "color": { "type": { "fill": { "solid": { "color": true } } } } } }
  },
  "supportsHighlight": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": true
}
```

**Algoritmo de cómputo (ya validado):** se itera con un acumulador `running`. Para `total`/`subtotal`, la barra ancla en 0 (pillar). Para `delta`, ancla en `running` y acumula.

**Manejo de nulos / duplicados**: categoría null se omite con warning en consola; valor null se trata como cero pero la barra se renderiza con stroke punteado y opacidad 0.4.

### 2.3 Interactividad esperada

- **Tooltip por barra**: categoría, valor del paso, valor acumulado tras este paso, contribución porcentual al total final.
- **Highlight**: filtros cruzados atenúan barras no incluidas a opacidad 0.35.
- **Drill-down**: si la categoría es jerárquica (Año → Trimestre → Mes), respetar el contrato de drill nativo: declarar `"drilldown": { "roles": ["category"] }`.
- **Keyboard**: flecha izquierda/derecha mueve foco entre barras; Enter aplica selección.

### 2.4 Diseño UX ejecutivo

- **Convención IBCS**: pillars en azul `#1F4E79`; deltas positivos `#00A651`, negativos `#E2231A`.
- **Conectores**: línea punteada `stroke-dasharray="2,2"` color `#A0AEC0` entre el final de una barra y el inicio de la siguiente.
- **Etiquetas**: encima de barras positivas, debajo de negativas; pillars muestran valor absoluto en negrita; deltas muestran +/- con signo.
- **Eje Y**: tics con grid suave `#E2E8F0`; `valueFormatter` con `displayUnits` (M, K) según `formattingutils`.
- **Responsive**: en viewport < 360 px de ancho, etiquetas se rotan 45° o se truncan con ellipsis si la categoría supera el ancho de banda.

### 2.5 Optimización Power BI Service

- Render < 100 ms para 25 categorías.
- Mobile: rotación de etiquetas y reducción de font 12→10 cuando width < 320.
- Bundle target ~120 kB (tree-shaking imprescindible).

### 2.6 Funcionalidades avanzadas

- **Formato condicional por barra**: `ColorPicker` con `selector: dataViewWildcard.createDataViewWildcardSelector(InstancesAndTotals)` y `altConstantSelector: selectionId.getSelector()` para overrides individuales.
- **FormattingModel**: cards "Colores de barra" (CompositeCard con grupos Positivo/Negativo/Total/Subtotal), "Etiquetas", "Conectores", "Eje Y", "Detección de tipo de paso".
- **persistProperties**: guarda el orden custom de categorías cuando el usuario reordena drag-and-drop (requiere implementación en handler `mouseup`).
- **Bookmarks**: barras seleccionadas persisten vía `selectionManager`.
- **Premium**: sin requerimientos especiales; el cómputo del waterfall es O(N).

### 2.7 Stack óptimo recomendado

**D3.js v7 layout custom**. Razones: D3 no tiene layout waterfall nativo, pero implementarlo son ~10 líneas. ECharts sí tiene preset waterfall (dos series `bar` apiladas, una invisible) **pero no soporta nativamente subtotales IBCS ni etiquetado dual valor/delta** — terminas escribiendo `formatter` y `markPoint` custom igual que en D3 pero pagando 135 kB de bundle. El control granular sobre cada `<rect>` y los conectores es absoluto en D3.

---

## 3. Gauge / Bullet Chart

Gauge ejecutivo orientado a Bullet Chart horizontal de Stephen Few (más eficaz que gauge radial para dashboards), con tres bandas cualitativas (insatisfactorio / satisfactorio / excelente), barra principal de performance y línea de target. Modo radial opcional con `d3.arc()`.

### 3.1 Requisitos técnicos

Stack base de §0. Específicos:
- `apiVersion: "5.11.0"`.
- Bundle objetivo < 100 kB. Imports: `d3-selection`, `d3-scale`, `d3-shape` (solo si modo radial), `d3-format`, `d3-array`.
- DataView típico: 1 fila × 5 medidas (actual, target, range1, range2, range3). Render trivial.

### 3.2 Características funcionales

**Roles:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `actual` (Measure) | numeric | 1 |
| `target` (Measure) | numeric | 1 |
| `qualitativeRange` (Measure) | numeric | hasta 3 (orden = peor → mejor) |
| `category` (Grouping) | text | 0–1 (etiqueta del bullet) |

`dataViewMappings`: `categorical` con `values.select` enumerando los cinco medidores.

**capabilities.json (extracto):**

```json
{
  "dataRoles": [
    { "displayName": "Valor actual", "name": "actual", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "Objetivo", "name": "target", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "Banda cualitativa", "name": "qualitativeRange", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "Categoría", "name": "category", "kind": "Grouping", "requiredTypes": [{ "text": true }] }
  ],
  "dataViewMappings": [{
    "conditions": [{ "actual": { "max": 1 }, "target": { "max": 1 }, "qualitativeRange": { "max": 3 } }],
    "categorical": {
      "categories": { "for": { "in": "category" } },
      "values": { "select": [
        { "for": { "in": "actual" } }, { "for": { "in": "target" } }, { "for": { "in": "qualitativeRange" } }
      ] }
    }
  }],
  "objects": {
    "general": { "properties": { "orientation": { "type": { "enumeration": [
      { "value": "horizontal", "displayName": "Bullet horizontal" },
      { "value": "radial", "displayName": "Gauge radial" }
    ] } } } },
    "thresholds": { "properties": {
      "color1": { "type": { "fill": { "solid": { "color": true } } } },
      "color2": { "type": { "fill": { "solid": { "color": true } } } },
      "color3": { "type": { "fill": { "solid": { "color": true } } } }
    } },
    "performance": { "properties": {
      "colorAboveTarget": { "type": { "fill": { "solid": { "color": true } } } },
      "colorBelowTarget": { "type": { "fill": { "solid": { "color": true } } } }
    } }
  },
  "supportsLandingPage": true,
  "supportsEmptyDataView": true,
  "supportsKeyboardFocus": true
}
```

**Manejo de datos**: si `qualitativeRange` no se provee, el visual deriva tres bandas iguales [0, target × 0.7, target × 1.0, target × 1.3]. Si `target = 0`, la línea de target se omite.

### 3.3 Interactividad esperada

- **Tooltip**: actual, target, varianza absoluta y porcentual, banda donde cae el actual.
- **Click en barra principal**: cross-filter por `category` si está vinculada.
- **Keyboard**: tabindex en barra principal; Enter dispara selección.
- **No multi-select** (`supportsMultiVisualSelection: false`): el bullet representa un único KPI.

### 3.4 Diseño UX ejecutivo

- **Bullet horizontal** (recomendado por defecto):
  - Bandas cualitativas en grises de claro a oscuro `#E0E0E0`, `#BDBDBD`, `#9E9E9E` (ergonómicas, no distractivas).
  - Barra de performance al 40% de la altura, color `#00A651` si actual ≥ target, `#E2231A` si menor.
  - Línea de target perpendicular, 2 px, color `#205527`.
  - Etiquetas: categoría a la izquierda, valor actual al final de la barra.
- **Gauge radial** (modo alternativo): `d3.arc()` con `innerRadius=0.7×r, outerRadius=r`, `startAngle = -π/2`, fill proporcional a `actual / max`. Recomendado **solo si la dirección ejecutiva insiste**; bullet es superior técnicamente.
- **Responsive**: en width < 200 px, ocultar etiqueta de categoría y mostrar solo número actual + delta.

### 3.5 Optimización Power BI Service

- Render < 30 ms.
- Mobile: layout adaptado (bullet escala width; radial mantiene aspect ratio).
- Bundle ~100 kB.

### 3.6 Funcionalidades avanzadas

- **FormattingModel**: cards "General" (orientation), "Bandas" (3 ColorPicker), "Performance" (above/below target), "Target line" (color, grosor, dashing).
- **Formato condicional sobre `colorAboveTarget`**: vincula a medida DAX que retorna hex string.
- **Bookmarks**: estado de selección minimalista.
- **persistProperties**: opcional para guardar última orientación elegida si se cambia desde un toggle in-canvas.

### 3.7 Stack óptimo recomendado

**D3.js v7 + `d3-shape` arc generators** (solo si modo radial está activo). Para bullet horizontal puro, `d3-scale` + `d3-selection` bastan. Justificación: ECharts gauge nativo es estéticamente atractivo pero rígido; reemplazar etiquetas, anillos y umbrales custom requiere ~70 líneas de `option` JSON anidado, y el bundle de 135 kB no se justifica frente a 30 líneas D3 y 8 kB.

---

## 4. Treemap jerárquico con drill-down

Treemap navegable por niveles (categoría → subcategoría → SKU), con header del nodo actual, breadcrumb de navegación, transiciones suaves usando `treemapResquarify` para preservar topología visual durante el drill.

### 4.1 Requisitos técnicos

Stack base de §0. Específicos:
- `apiVersion: "5.11.0"`.
- Bundle objetivo < 130 kB. Imports: `d3-selection`, `d3-hierarchy`, `d3-scale`, `d3-format`, `d3-transition` (necesario para `.transition()`).
- DataView jerárquico → `dataViewMappings.matrix` (única opción que entrega árbol implícito).

### 4.2 Características funcionales

**Roles:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `category` (Grouping) | text/temporal | 1..N niveles (rows del matrix) |
| `value` (Measure) | numeric | 1 |
| `colorMeasure` (Measure) | numeric | 0–1 (controla color del nodo) |

**`dataViewMappings.matrix`** con `rows.dataReductionAlgorithm.top.count = 5000` y `rows.levels.dataReductionAlgorithm.top.count = 100` por nivel.

**capabilities.json (extracto):**

```json
{
  "dataRoles": [
    { "displayName": "Categoría (jerarquía)", "name": "category", "kind": "Grouping",
      "requiredTypes": [{ "text": true }, { "temporal": true }] },
    { "displayName": "Valor (tamaño)", "name": "value", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "Medida de color", "name": "colorMeasure", "kind": "Measure", "requiredTypes": [{ "numeric": true }] }
  ],
  "dataViewMappings": [{
    "matrix": {
      "rows": { "for": { "in": "category" }, "dataReductionAlgorithm": { "top": { "count": 5000 } } },
      "values": { "select": [{ "for": { "in": "value" } }, { "for": { "in": "colorMeasure" } }] }
    }
  }],
  "drilldown": { "roles": ["category"] },
  "objects": {
    "tilemap": { "properties": {
      "tile": { "type": { "enumeration": [
        { "value": "squarify", "displayName": "Squarify (default)" },
        { "value": "binary",   "displayName": "Binary" },
        { "value": "slice",    "displayName": "Slice" },
        { "value": "dice",     "displayName": "Dice" }
      ] } },
      "paddingInner": { "type": { "numeric": true } }
    } },
    "labels": { "properties": {
      "show": { "type": { "bool": true } },
      "showValue": { "type": { "bool": true } },
      "fontSize": { "type": { "formatting": { "fontSize": true } } }
    } },
    "colorScale": { "properties": {
      "minColor":  { "type": { "fill": { "solid": { "color": true } } } },
      "midColor":  { "type": { "fill": { "solid": { "color": true } } } },
      "maxColor":  { "type": { "fill": { "solid": { "color": true } } } },
      "diverging": { "type": { "bool": true } }
    } }
  },
  "supportsHighlight": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": true,
  "supportsLandingPage": true
}
```

**Manejo de datos**: nodos con valor null se omiten; nodos con valor 0 se incluyen con tamaño mínimo de 1 px² y stroke punteado. Cardinalidad alta (> 5000 hojas) activa `fetchMoreData` con algoritmo `window`.

### 4.3 Interactividad esperada

- **Tooltip**: nombre del nodo, ruta jerárquica completa, valor, % del padre, % del raíz.
- **Click**: si el nodo tiene hijos, drill-down (zoom-in al subárbol con transición de 600 ms vía `treemapResquarify`); si es hoja, cross-filter.
- **Doble click / breadcrumb back**: drill-up.
- **Highlight**: filtros cruzados atenúan nodos no incluidos a opacidad 0.3.
- **Keyboard**: Tab navega hojas del nivel actual; Enter ejecuta drill o selección; Backspace/Esc drill-up.

### 4.4 Diseño UX ejecutivo

- **Header/breadcrumb**: 18 px de alto en el nivel raíz, muestra ruta jerárquica clickeable separada por "›".
- **Padding interno**: 2 px entre nodos hermanos; 1 px en el último nivel.
- **Color**:
  - Modo "Por categoría": paleta categórica fija de 12 colores Heineken (corporate green + gama derivada por shifting de luminosidad).
  - Modo "Por medida de color" (`colorMeasure` asignado): escala secuencial `interpolateRgbBasis([#E2231A, #F2A900, #00A651])` para varianzas.
- **Etiquetas**: nombre del nodo en negrita 11–14 px (escala con tamaño del rect); valor formateado en línea inferior si el rect ≥ 60×30 px.
- **Truncado**: `textMeasurementService.getTailoredTextOrDefault(text, maxWidth)` de `formattingutils`.

### 4.5 Optimización Power BI Service

- Render inicial < 200 ms para árbol de 500 nodos.
- Cuando rect < 4×4 px, no se renderiza etiqueta.
- Cuando árbol > 5000 nodos, paginar con `fetchMoreData`.
- Mobile: drill ejecuta automáticamente fullscreen al subnivel; tap-and-hold abre menú contextual.

### 4.6 Funcionalidades avanzadas

- **persistProperties**: guarda el path del último nodo donde el usuario hizo drill-down, para restaurar al recargar el reporte.
- **Bookmarks**: ambos el path drill y la selección se restauran. El path se serializa como propiedad en `general.objects.savedDrillPath` en formato JSON.
- **FormattingModel**: cards "Treemap" (algoritmo, padding), "Etiquetas", "Escala de color" (CompositeCard con grupo Categórica/Secuencial), "Highlights".
- **Premium**: árboles muy grandes (> 50k nodos) se benefician del `large dataset` mode con paginación `window`.
- **Formato condicional**: el color por hoja puede vincularse a medida DAX (override por `selectionId`).

### 4.7 Stack óptimo recomendado

**D3.js v7 + `d3-hierarchy` (`treemapResquarify` por defecto)**. Justificación:
- 5 algoritmos de tiling vs 1 en ECharts.
- `treemapResquarify` preserva topología en transiciones de drill-down (el feature ejecutivo clave; ECharts no lo tiene).
- Bundle ~25 kB (con d3-selection y d3-transition) vs 135 kB de ECharts.
- Control total sobre etiquetado, truncamiento y headers jerárquicos.

---

## 5. Heatmap matricial

Heatmap fila × columna con coloración secuencial o divergente, ejes ordenables, filtrado por umbral, soporte para celdas con valor null (gris diagonal). Default SVG; switch a Canvas si el dataset supera 5 000 celdas.

### 5.1 Requisitos técnicos

Stack base de §0. Específicos:
- `apiVersion: "5.11.0"`.
- Bundle objetivo < 110 kB. Imports: `d3-selection`, `d3-scale`, `d3-scale-chromatic` (interpolators), `d3-array`, `d3-axis`, `d3-format`, `d3-quadtree` (solo si Canvas).
- DataView óptimo: `matrix` (filas y columnas explícitas) o `categorical` con dos categorías agrupadas.

### 5.2 Características funcionales

**Roles:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `rows` (Grouping) | text/temporal | 1 (eje vertical) |
| `columns` (Grouping) | text/temporal | 1 (eje horizontal) |
| `value` (Measure) | numeric | 1 |

**capabilities.json (extracto):**

```json
{
  "dataRoles": [
    { "displayName": "Filas", "name": "rows", "kind": "Grouping" },
    { "displayName": "Columnas", "name": "columns", "kind": "Grouping" },
    { "displayName": "Valor", "name": "value", "kind": "Measure", "requiredTypes": [{ "numeric": true }] }
  ],
  "dataViewMappings": [{
    "matrix": {
      "rows":    { "for": { "in": "rows" },    "dataReductionAlgorithm": { "window": { "count": 500 } } },
      "columns": { "for": { "in": "columns" }, "dataReductionAlgorithm": { "window": { "count": 500 } } },
      "values":  { "select": [{ "for": { "in": "value" } }] }
    }
  }],
  "objects": {
    "scale": { "properties": {
      "type":    { "type": { "enumeration": [
        { "value": "sequential", "displayName": "Secuencial" },
        { "value": "diverging",  "displayName": "Divergente" },
        { "value": "quantize",   "displayName": "Discretizada (5 buckets)" }
      ] } },
      "palette": { "type": { "enumeration": [
        { "value": "RdYlGn",   "displayName": "Rojo-Amarillo-Verde" },
        { "value": "Viridis",  "displayName": "Viridis" },
        { "value": "Heineken", "displayName": "Verde Heineken" }
      ] } },
      "minColor": { "type": { "fill": { "solid": { "color": true } } } },
      "maxColor": { "type": { "fill": { "solid": { "color": true } } } },
      "midColor": { "type": { "fill": { "solid": { "color": true } } } }
    } },
    "cells": { "properties": {
      "showValues": { "type": { "bool": true } },
      "fontSize":   { "type": { "formatting": { "fontSize": true } } },
      "showLegend": { "type": { "bool": true } }
    } }
  },
  "supportsHighlight": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": true
}
```

**Manejo de datos**: celdas null muestran patrón diagonal `#E2E8F0`; duplicados se agregan según el agg semántico de la medida (suma/promedio definido en DAX).

**`fetchMoreData`**: cuando filas × columnas > 5 000, activa modo `window` para paginar.

### 5.3 Interactividad esperada

- **Tooltip por celda**: fila, columna, valor, percentil dentro del dataset.
- **Hover en encabezado de fila/columna**: highlight de toda la fila/columna respectiva (cambio de stroke).
- **Click en celda**: cross-filter por la combinación fila+columna.
- **Click en encabezado**: cross-filter por la fila o columna entera; segundo click ordena por suma del eje.
- **Keyboard**: flechas direccionales mueven foco entre celdas.

### 5.4 Diseño UX ejecutivo

- **Escala de color**:
  - Secuencial: `scaleSequential(interpolateRgbBasis([#FFFFFF, #205527]))` (paleta Heineken corporate).
  - Divergente: `scaleSequential(interpolateRgbBasis([#E2231A, #FFFFFF, #00A651]))` con dominio simétrico [-max, +max].
  - Discretizada: `scaleQuantize` con 5 buckets, etiquetas legibles.
- **Leyenda**: barra de color horizontal arriba del heatmap con tics min/median/max y etiqueta de unidad.
- **Etiquetas en celda**: texto blanco si luminance del fill < 0.5, negro en caso contrario (cálculo en `colorutils`).
- **Ejes**: rotación 30°/45° automática si las etiquetas exceden el bandwidth.
- **Responsive**: en width < 320, ocultar etiquetas en celda y mostrar solo en hover.

### 5.5 Optimización Power BI Service

- Render objetivo: 50×50 SVG en < 100 ms; 200×200 Canvas en < 300 ms.
- **Decisión runtime SVG vs Canvas**: si `rows.length × columns.length > 5000`, switch a Canvas con `d3-quadtree` para hit-testing en hover.
- Mobile: vista compacta sin etiquetas; tap muestra tooltip flotante.
- Bundle ~110 kB.

### 5.6 Funcionalidades avanzadas

- **FormattingModel**: cards "Escala" (CompositeCard con grupos Tipo/Paleta/Colores), "Celdas" (etiquetas, fuente), "Leyenda", "Ordenamiento".
- **persistProperties**: guarda orden de filas/columnas cuando el usuario hace click en encabezado para ordenar.
- **Bookmarks**: orden y selección persisten.
- **Premium / large datasets**: con `window` algorithm + `fetchMoreData(true)`, soporta hasta el límite agregado de 100 MB del dataView.
- **Formato condicional**: aplicable al `minColor`/`maxColor` vía medida DAX.

### 5.7 Stack óptimo recomendado

**D3.js v7 + `d3-scale-chromatic`** con render adaptativo (SVG por defecto, Canvas + `d3-quadtree` si > 5 000 celdas). Justificación: ECharts heatmap nativo es Canvas-first y soporta `visualMap` y zoom listos, pero su bundle de ~140 kB sólo se justifica para matrices > 50 000 celdas (telemetría IoT cervecería). Para los dashboards ejecutivos típicos (matrices ≤ 50×50), D3 + SVG ofrece interactividad por celda con menos código y un tercio del bundle.

---

## 6. Combo Chart con Forecast

Combo chart con barras (volumen) y línea (KPI métrico) sobre eje X temporal compartido, doble eje Y, con extensión de pronóstico a horizonte configurable, banda de confianza al 95% y marcador de inicio del forecast.

### 6.1 Requisitos técnicos

Stack base de §0. Específicos:
- `apiVersion: "5.11.0"`.
- Bundle objetivo < 200 kB (incluye motor de forecasting). Imports: `d3-selection`, `d3-scale`, `d3-shape`, `d3-axis`, `d3-array`, `d3-format`, `d3-time`, `d3-time-format`, `simple-statistics` (~30 kB MIT zero deps), opcional `ml-regression-exponential` y `ml-regression-polynomial`.
- DataView: `categorical` con eje temporal y dos medidas; soporta hasta 30 000 puntos con `top`, ampliable a > con `window`.

### 6.2 Características funcionales

**Roles:**

| Rol | Tipo | Cardinalidad |
|---|---|---|
| `axis` (Grouping) | temporal/numeric | 1 |
| `barValue` (Measure) | numeric | 1 |
| `lineValue` (Measure) | numeric | 1 |
| `forecastHorizon` (Measure) | numeric (constante) | 0–1 (override del horizonte) |

**capabilities.json (extracto):**

```json
{
  "dataRoles": [
    { "displayName": "Eje (X)", "name": "axis", "kind": "Grouping",
      "requiredTypes": [{ "temporal": true }, { "numeric": true }] },
    { "displayName": "Volumen (barras)", "name": "barValue", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "KPI (línea)",      "name": "lineValue", "kind": "Measure", "requiredTypes": [{ "numeric": true }] },
    { "displayName": "Horizonte",        "name": "forecastHorizon", "kind": "Measure", "requiredTypes": [{ "integer": true }] }
  ],
  "dataViewMappings": [{
    "categorical": {
      "categories": { "for": { "in": "axis" }, "dataReductionAlgorithm": { "window": { "count": 1000 } } },
      "values": { "select": [
        { "for": { "in": "barValue" } }, { "for": { "in": "lineValue" } }, { "for": { "in": "forecastHorizon" } }
      ] }
    }
  }],
  "objects": {
    "forecast": { "properties": {
      "enable": { "type": { "bool": true } },
      "model":  { "type": { "enumeration": [
        { "value": "linear",      "displayName": "Regresión lineal" },
        { "value": "exponential", "displayName": "Exponencial (ml.js)" },
        { "value": "polynomial",  "displayName": "Polinomial deg 2" }
      ] } },
      "horizon":         { "type": { "integer": true } },
      "confidenceLevel": { "type": { "numeric": true } },
      "showBand":        { "type": { "bool": true } }
    } },
    "axes": { "properties": {
      "showSecondaryY": { "type": { "bool": true } },
      "syncZero":       { "type": { "bool": true } }
    } },
    "colors": { "properties": {
      "barColor":      { "type": { "fill": { "solid": { "color": true } } } },
      "lineColor":     { "type": { "fill": { "solid": { "color": true } } } },
      "forecastColor": { "type": { "fill": { "solid": { "color": true } } } }
    } }
  },
  "supportsHighlight": true,
  "supportsKeyboardFocus": true,
  "supportsMultiVisualSelection": true
}
```

**Manejo de nulos**: `d3.line().defined(d => d.lineValue != null)` rompe la línea visual; barras nulas se omiten. La regresión filtra nulls antes de fittear.

### 6.3 Interactividad esperada

- **Tooltip vertical (crosshair)** al mover el mouse sobre el área del chart: muestra fecha, valor barra, valor línea, valor forecast (si aplica), banda de confianza.
- **Click en barra o punto**: cross-filter por el período.
- **Brush horizontal opcional** para zoom temporal (toggle en formatting pane).
- **Drill nativo** (`drilldown.roles: ["axis"]`) cuando el eje es jerárquico (Año → Mes → Día).
- **Keyboard**: flechas izquierda/derecha mueven crosshair entre puntos.

### 6.4 Diseño UX ejecutivo

- **Barras**: color `#1F4E79` con opacidad 0.7 para no competir con la línea.
- **Línea histórica**: stroke 2 px, color `#205527` (corporate green Heineken), `curveMonotoneX`.
- **Forecast**: línea con `stroke-dasharray="5,3"` color corporate green; banda de confianza al 95% (`±1.96σ` sobre residuos para regresión lineal) en `#205527` opacidad 0.15.
- **Marcador de inicio del forecast**: línea vertical punteada gris en el primer punto pronosticado, etiquetada "Pronóstico desde {fecha}".
- **Doble eje**: izquierdo línea (KPI), derecho barras (volumen); `syncZero` opcional para alinear zeros.
- **Responsive**: en width < 360, ocultar segundo eje y usar tooltip exclusivamente; en width < 240, mostrar solo línea.

### 6.5 Optimización Power BI Service

- Render objetivo: 60 puntos históricos + 12 forecast en < 150 ms.
- Forecast se ejecuta síncrono dentro de `update()`; `simple-statistics.linearRegression` es O(N) y < 5 ms para 1000 puntos.
- Si se elige modelo `arima` para SARIMA estacional, importar `arima/async` (WASM > 4 KB requiere compilación asíncrona en Chrome). Implica `await` en `update`; lanzar `events.renderingFinished` tras la promesa.
- Mobile: layout simplificado (línea + forecast, sin barras) cuando width < 300.
- Bundle ~200 kB con simple-statistics; +120 kB si se añade `arima`. **TFJS descartado** por tamaño (~500 KB–1 MB gzipped).

### 6.6 Funcionalidades avanzadas

- **FormattingModel**: cards "Forecast" (CompositeCard con groups Modelo/Banda/Horizonte), "Ejes", "Colores", "Tooltip".
- **Formato condicional**: `barColor` y `lineColor` vinculables a medida DAX.
- **Bookmarks**: estado del modelo de forecast, horizonte y selección persiste vía `persistProperties` + filterState.
- **persistProperties**: guarda último modelo de forecast y horizonte elegidos.
- **Premium**: con `window` algorithm + `fetchMoreData`, series de hasta 100 MB. Útil para datos diarios multi-año (ventas Heineken 5 años × 365 días = 1 825 puntos, holgado).
- **Field parameters** (API ≥ 5.10): si Heineken usa field parameters para alternar medidas dinámicamente, el visual lo detecta vía `DataViewMetadataColumn.sourceFieldParameters`.

### 6.7 Stack óptimo recomendado

**D3.js v7 (composición de ejes/escalas) + simple-statistics** para regresión lineal y banda de confianza vía residuos. Upgrades:
- *Curvas no lineales (estacionalidad simple, growth)*: `ml-regression-exponential` o `ml-regression-polynomial` (degree 2–3), MIT, ~5–10 kB cada uno.
- *Estacionalidad fuerte (12 meses, demanda cervecera estacional)*: paquete `arima` (zemlyansky) con `arima/async` para SARIMA(p,d,q)(P,D,Q,12).
- **Descartar TFJS LSTM**: bundle 500 KB–1 MB excede holgadamente el target; el WebGL backend puede fallar bajo CSP `default-src 'self'`.
- **Descartar forecast-js**: mantenimiento estancado.

Justificación final: la arquitectura modular permite empezar con regresión lineal (95% de los dashboards Heineken) y escalar a SARIMA por demanda específica sin rediseñar el visual.

---

## 7. Resumen ejecutivo del catálogo

### 7.1 Tabla maestra del stack por visual

| # | Visual | Stack ganador | Bundle objetivo | DataView |
|---|---|---|---|---|
| 1 | KPI Card avanzada | D3 modular (`d3-shape`, `d3-scale`, `d3-format`) | ~80 kB | categorical |
| 2 | Waterfall | D3 layout custom + `d3-axis`, `d3-shape` | ~120 kB | categorical |
| 3 | Gauge / Bullet | D3 + `d3-shape.arc` (estilo Stephen Few) | ~100 kB | categorical |
| 4 | Treemap jerárquico | D3 + `d3-hierarchy` + `treemapResquarify` | ~130 kB | matrix |
| 5 | Heatmap matricial | D3 + `d3-scale-chromatic` (SVG ≤ 5k / Canvas) | ~110 kB | matrix |
| 6 | Combo + Forecast | D3 + `simple-statistics` (+ `ml-regression-*`) | ~200 kB | categorical |

**Stack global Heineken**: D3.js v7 modular (ISC) + TypeScript 5 + `pbiviz` 7.0.x + powerbi-visuals-api 5.11. Cero costo de licencia (todas las dependencias MIT/ISC/Apache 2.0). **Highcharts descartado** (CC BY-NC no permite uso comercial interno; licencia anual ~$1 500–$3 000 USD/dev innecesaria cuando D3 cubre 100% de los requerimientos). **Plotly.js descartado** por bundle prohibitivo (~3.5 MB).

### 7.2 Reglas duras del proyecto Heineken

| Regla | Justificación |
|---|---|
| Importar D3 siempre por submódulo (`import { select } from "d3-selection"`) | Webpack tree-shake correcto; sin `import * as d3 from "d3"` |
| `target: "ES2022"` en tsconfig | Sandbox PBI soporta navegadores modernos; mejor minificación |
| Sin CDNs, todo bundled | Sandbox iframe con CSP `default-src 'self'` bloquea recursos externos no declarados |
| Sin Web Workers ni Service Workers | Origen `null` del iframe los bloquea |
| Sin `eval` con datos de usuario, sin `innerHTML` con strings dinámicos | Riesgo XSS; usar `textContent` o DOMPurify |
| `events.renderingStarted/Finished/Failed` en cada `update()` | Garantiza captura para futuro export PDF/PPTX si Heineken decide certificar más adelante |
| `getFormattingModel` (nuevo Format Pane) en lugar de `enumerateObjectInstances` | API ≥ 5.1; menor mantenimiento, soporte de localización integrado |
| `storageV2Service` en lugar de `storageService` | Eliminado en API 5.11 |
| Todos los colores condicionales con `instanceKind: ConstantOrRule` | Habilita formato condicional vinculable a DAX |
| `--certification-audit` en CI aunque no certifiquemos | Detecta antipatrones (eval, fetch externo) tempranamente |

### 7.3 Pipeline CI/CD recomendado para Heineken

```yaml
# .github/workflows/build-pbiviz.yml (esqueleto)
- run: npm ci
- run: npx pbiviz lint
- run: npx pbiviz package --certification-audit
- uses: actions/upload-artifact@v4
  with:
    name: ${{ matrix.visual }}.pbiviz
    path: dist/*.pbiviz
# Despliegue manual al Admin Portal (no API pública para upload Org Visual)
```

### 7.4 Limitaciones aceptadas (Org Store, sin AppSource)

| Limitación | Impacto | Mitigación |
|---|---|---|
| Sin export a **PowerPoint** | Reportes ejecutivos exportados muestran placeholder en lugar del visual | Usar visuales nativos certificados para vistas exportables |
| Sin export a **PDF** | Idem | Idem |
| Sin **email subscriptions** del visual | El visual no aparece en correo programado | Usar core visuals para subscripciones; los custom solo en consumo online |
| Sin Power BI Report Server | No se despliegan en PBIRS | Heineken consume vía Power BI Service / Fabric |
| Actualización manual de versión | Admin debe re-uplodear `.pbiviz` | Pipeline CI publica artifact; admin descarga y sube en Admin Portal |

### 7.5 Conclusión

El catálogo Heineken se construye sobre un **stack único, opensource y consolidado** (D3.js v7 + TypeScript 5 + powerbi-visuals SDK 5.11/7.0), garantizando coherencia arquitectónica entre los seis visuales, un costo total de licencias de cero, y bundles agregados por debajo del umbral 2 MB recomendado. La decisión de **renunciar a la certificación AppSource** y desplegar como **Organizational Visuals** simplifica el time-to-market (despliegue inmediato vs ~4 semanas de revisión Microsoft), preserva todas las capacidades funcionales esenciales (render, drill, cross-filter, bookmarks, mobile, accesibilidad) y solo cede la exportación a PDF/PPTX y email subscriptions —limitación cubierta usando visuales core de Power BI cuando esos canales sean requeridos. La adopción del nuevo Format Pane (`getFormattingModel`) y de la Rendering Events API garantiza que estos visuales seguirán siendo válidos si Heineken decide certificarlos en el futuro sin reescritura mayor. La paleta corporativa (corporate green `#205527`, bright green `#A5E600`) está integrada en cada layer del diseño con validación WCAG 2.1 AA y soporte a high contrast Microsoft, asegurando un dashboard ejecutivo coherente, accesible y técnicamente robusto.