const mapElement = document.querySelector("arcgis-map");
const chartElement = document.querySelector("arcgis-chart");
const panelBottom = document.getElementById("panel-bottom");
const statusChip = document.getElementById("status-chip");
let statusChipLabel = statusChip ? statusChip.textContent.trim() : "";
const statusTooltip = document.getElementById("status-tooltip");
const sheetToggleEl = document.getElementById("sheet-toggle");
const sheetEl = document.getElementById("sheet");
const sharedTabs = document.getElementById("shared-tabs");
const tabTitleEls = sharedTabs.querySelectorAll("calcite-tab-title");
const listItemEls = document.querySelectorAll("#sheet calcite-list-item");

const shellPanelBottom = document.getElementById("shell-panel-bottom");
const dialogEl = document.getElementById("dialog");
const panelTabsHost = document.getElementById("panel-tabs-host");
const dialogTabsHost = document.getElementById("dialog-tabs-host");
const popOutAction = document.getElementById("pop-out");
const dockAction = document.getElementById("dock");
const saveAction = document.getElementById("save");
const saveAlert = document.getElementById("save-alert");
const saveAlertLink = document.getElementById("save-alert-link");
const saveErrorAlert = document.getElementById("save-error-alert");
const saveErrorMessage = document.getElementById("save-error-message");
const galleryAction = document.getElementById("gallery-action");

const PORTAL_URL = "https://jsapi.maps.arcgis.com/";
const SAVE_GROUP_TITLE = "Global Biodiversity and Conservation Maps";
const GALLERY_URL = "https://jsapi.maps.arcgis.com/apps/instant/gallery/index.html?appid=053eb0c7ab7345fca7bd43f94e4b9274&sortField=modified&sortOrder=desc&view=grid";

function moveTabsTo(host) {
    if (host && sharedTabs.parentElement !== host) {
        host.prepend(sharedTabs);
    }
}

const BREAKPOINT_SMALL = 800;

// Wire the UI before any awaits so docking never waits on map or chart loading.
init();


//////////////////////////////////////////////////////
//  Map config
//////////////////////////////////////////////////////

await mapElement.viewOnReady();
const view = mapElement.view;

const {
    portalItem
} = mapElement.map;
mapElement.aria = {
    label: portalItem.title,
};

const biodiversityLayer = mapElement.map?.allLayers.find((layer) => {
    return layer.title === "Global Hexagons: Biodiversity and Conservation (Level 3)";
});

await biodiversityLayer.load();

//////////////////////////////////////////////////////
//  Chart setup
//////////////////////////////////////////////////////

const [{ createModel }] = await $arcgis.import(["@arcgis/charts-components"]);

chartElement.model = await createModel({
    layer: biodiversityLayer,
    config: biodiversityLayer.charts[0]
});

chartElement.model.hideEmptyRowsAndColumns = true;
chartElement.view = view;
chartElement.layer = biodiversityLayer;

//////////////////////////////////////////////////////
//  Smart mapping and field picker logic
//////////////////////////////////////////////////////

const sizeValuePicker = document.getElementById("size-attribute-picker");
const sizeThemeSelector = document.getElementById("size-theme-selector");

let numericalFields = [];
let selectedSizeField = null;

function extractNumericalFields() {
    numericalFields = [];

    if (!biodiversityLayer || !biodiversityLayer.fields) {
        return;
    }

    biodiversityLayer.fields.forEach((field) => {
        if (
            field.type === "esriFieldTypeInteger" ||
            field.type === "esriFieldTypeSmallInteger" ||
            field.type === "esriFieldTypeDouble" ||
            field.type === "esriFieldTypeSingle" ||
            field.type === "double"
        ) {
            numericalFields.push({
                name: field.name,
                alias: field.alias || field.name,
                type: field.type
            });
        }
    });
}

async function populateAttributeLists() {
    const items = numericalFields.map((field) => ({
        value: field.name,
        label: field.alias
    }));

    if (!sizeValuePicker) {
        return;
    }

    try {
        await customElements.whenDefined("arcgis-value-picker-combobox");
    } catch (error) {
        // ignore; the value picker may already be upgraded
    }

    sizeValuePicker.items = items;
    sizeValuePicker.value = undefined;
    requestAnimationFrame(() => {
        sizeValuePicker.items = items;
    });
}

function initializeFromExistingRenderer() {
    const renderer = biodiversityLayer?.renderer;
    const sizeVariable = renderer?.visualVariables?.find((visualVariable) => visualVariable.type === "size");
    const sizeFieldName = sizeVariable?.field ?? sizeVariable?.valueExpression?.split(/\b/).pop();
    const initialField = numericalFields.find((field) => field.name === sizeFieldName);
    const themeFromRenderer = renderer?.authoringInfo?.theme ||
        renderer?.visualVariables?.find((visualVariable) => visualVariable.type === "size")?.theme ||
        "above";

    if (sizeThemeSelector) {
        sizeThemeSelector.value = themeFromRenderer;
    }

    if (initialField && sizeValuePicker) {
        selectedSizeField = initialField;
        sizeValuePicker.currentValue = {
            value: initialField.name,
            label: initialField.alias
        };
    }
}

function wireUpEvents() {
    if (sizeValuePicker) {
        sizeValuePicker.addEventListener("arcgisPropertyChange", async (event) => {
            if (event.detail?.name !== "currentValue") {
                return;
            }

            const selected = sizeValuePicker.currentValue;
            if (!selected || !selected.value) {
                return;
            }

            const field = numericalFields.find((item) => item.name === selected.value);
            if (!field) {
                return;
            }

            if (selectedSizeField && selected.value === selectedSizeField.name) {
                return;
            }

            selectedSizeField = field;
            await applyMapping();
        });
    }

    if (sizeThemeSelector) {
        sizeThemeSelector.addEventListener("calciteSegmentedControlChange", async () => {
            if (!selectedSizeField) {
                return;
            }

            await applyMapping();
        });
    }
}

async function applyMapping() {
    if (!selectedSizeField) {
        return;
    }

    const [sizeRendererCreator, colorRendererCreator] = await $arcgis.import([
        "@arcgis/core/smartMapping/renderers/size.js",
        "@arcgis/core/smartMapping/renderers/color.js"
    ]);

    const sizeTheme = sizeThemeSelector?.value || "above";

    const sizeParams = {
        layer: biodiversityLayer,
        view: mapElement.view,
        field: selectedSizeField.name,
        theme: sizeTheme,
        symbolOptions: {
            symbolStyle: "circle"
        }
    };

    const sizeResult = await sizeRendererCreator.createContinuousRenderer(sizeParams);
    const renderer = sizeResult.renderer;

    const colorParams = {
        layer: biodiversityLayer,
        view: mapElement.view,
        field: selectedSizeField.name,
        theme: sizeTheme,
        symbolOptions: {
            symbolStyle: "circle"
        }
    };

    const colorResult = await colorRendererCreator.createContinuousRenderer(colorParams);
    const colorRenderer = colorResult.renderer;

    if (renderer?.defaultSymbol && colorRenderer?.defaultSymbol) {
        renderer.defaultSymbol = colorRenderer.defaultSymbol.clone();
    }

    if (colorRenderer?.visualVariables?.length) {
        const existingSizeVisualVariables = renderer?.visualVariables?.filter((visualVariable) => visualVariable.type !== "color") ?? [];
        renderer.visualVariables = [...existingSizeVisualVariables, ...colorRenderer.visualVariables];
    }

    biodiversityLayer.renderer = renderer;
}

extractNumericalFields();
await populateAttributeLists();
initializeFromExistingRenderer();
wireUpEvents();

//////////////////////////////////////////////////////
//  Save the web map
//////////////////////////////////////////////////////

async function findSaveGroup(portal) {
    const { results } = await portal.queryGroups({
        query: `title:"${SAVE_GROUP_TITLE}"`,
        num: 20
    });

    return results.find((group) => group.title === SAVE_GROUP_TITLE) ?? null;
}

async function saveWebMap() {
    const [Portal] = await $arcgis.import(["@arcgis/core/portal/Portal.js"]);

    const portal = new Portal({ url: PORTAL_URL });
    await portal.signIn();

    const attributeName = selectedSizeField?.alias ?? selectedSizeField?.name ?? "";
    const webmap = mapElement.map;

    await webmap.updateFrom(mapElement.view);

    const savedItem = await webmap.saveAs({
        portal,
        title: `Biodiversity and Conservation - ${attributeName}`,
        snippet: `Biodiversity and conservation hexagons mapped by ${attributeName}.`,
        tags: ["biodiversity", "conservation", "hexagons"]
    });

    // The item exists at this point, so thumbnail and sharing failures must not fail the save.
    try {
        const screenshot = await mapElement.takeScreenshot({ width: 600, height: 400 });
        await savedItem.updateThumbnail({ thumbnail: screenshot.dataUrl, filename: "thumbnail.png" });
    } catch (error) {
        console.warn("Unable to store the web map thumbnail", error);
    }

    try {
        const group = await findSaveGroup(portal);
        if (group) {
            await portal.request(`${savedItem.userItemUrl}/share`, {
                method: "post",
                query: { groups: group.id }
            });
        } else {
            console.warn(`Group "${SAVE_GROUP_TITLE}" was not found, the item was not shared`);
        }
    } catch (error) {
        console.warn("Unable to share the web map with the group", error);
    }

    return savedItem;
}

async function handleSaveClick() {
    if (saveAction.loading) {
        return;
    }

    saveAction.loading = true;

    try {
        const savedItem = await saveWebMap();
        statusChip.icon = "check-circle-f";
        statusChip.classList.remove("warning-chip");
        statusChipLabel = "Saved";
        statusChip.textContent = statusChipLabel;

        saveAlertLink.href = savedItem.itemPageUrl;
        saveAlertLink.textContent = savedItem.title;
        saveAlert.open = true;
    } catch (error) {
        console.error("Unable to save the web map", error);
        saveErrorMessage.textContent = error?.message ?? "An unexpected error occurred.";
        saveErrorAlert.open = true;
    } finally {
        saveAction.loading = false;
    }
}

//////////////////////////////////////////////////////
//  Init UI
//////////////////////////////////////////////////////

function init() {
    sheetToggleEl.addEventListener("click", () => handleSheetOpen());

    listItemEls.forEach((el) => {
        el.addEventListener("calciteListItemSelect", (event) => handleListSelect(event));
    });

    sharedTabs.addEventListener("calciteTabsActivate", () => handleTabSelect());

    saveAction.addEventListener("click", () => handleSaveClick());

    galleryAction.addEventListener("click", () => window.open(GALLERY_URL, "_blank", "noopener"));

    if (popOutAction && dockAction && shellPanelBottom && dialogEl) {
        popOutAction.addEventListener("click", () => {
            const isSmall = window.innerWidth <= BREAKPOINT_SMALL;
            if (isSmall) {
                return;
            }
            shellPanelBottom.hidden = true;
            moveTabsTo(dialogTabsHost);
            dialogEl.open = true;
        });

        dockAction.addEventListener("click", () => {
            dialogEl.open = false;
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
            popOutAction.setFocus();
        });
    }

    // Observe shell panel size changes as an extra trigger for responsive layout.
    if (window.ResizeObserver && shellPanelBottom) {
        const ro = new ResizeObserver(() => handleResponsiveLayout());
        ro.observe(shellPanelBottom);
    }

    window.addEventListener("resize", handleResponsiveLayout);
    handleResponsiveLayout();
}

function handleSheetOpen() {
    sheetEl.open = true;
    panelBottom.collapsed = false;
}

function handleListSelect(event) {
    const selectedItem = event.target;
    const value = selectedItem.getAttribute("value");
    if (!value) {
        return;
    }
    sheetEl.open = false;

    listItemEls.forEach((item) => {
        item.selected = item === selectedItem;
    });

    tabTitleEls.forEach((tabTitle) => {
        tabTitle.selected = tabTitle.getAttribute("value") === value;
    });
}

function handleTabSelect() {
    const selectedTitle = sharedTabs.querySelector("calcite-tab-title[selected]");
    const value = selectedTitle ? selectedTitle.getAttribute("value") : null;
    if (!value) {
        return;
    }
    sheetEl.open = false;

    listItemEls.forEach((item) => {
        item.selected = item.getAttribute("value") === value;
    });
}

function handleResponsiveLayout() {
    if (!shellPanelBottom || !dialogEl) {
        return;
    }

    const isSmall = window.innerWidth <= BREAKPOINT_SMALL;

    if (isSmall) {
        shellPanelBottom.hidden = false;
        dialogEl.open = false;
        moveTabsTo(panelTabsHost);
        if (popOutAction) {
            popOutAction.hidden = true;
        }
        if (statusChip) {
            statusChip.textContent = "";
            statusChip.setAttribute("interactive", "");
        }
        if (statusTooltip) {
            statusTooltip.hidden = false;
            statusTooltip.setAttribute("reference-element", "status-chip");
        }
    } else {
        if (dialogEl.open) {
            shellPanelBottom.hidden = true;
            moveTabsTo(dialogTabsHost);
        } else {
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
        }
        if (popOutAction) {
            popOutAction.hidden = false;
        }
        if (statusChip) {
            statusChip.textContent = statusChipLabel;
            statusChip.removeAttribute("interactive");
        }
        if (statusTooltip) {
            statusTooltip.hidden = true;
            statusTooltip.removeAttribute("reference-element");
        }
    }
}
