const mapElement = document.querySelector("arcgis-map");
const sharedTabs = document.getElementById("shared-tabs");
const mapConfigurationTab = document.getElementById("map-configuration-tab");
const mapConfigurationBlocks = document.getElementById("map-configuration-blocks");
const symbolStyleBlock = document.getElementById("symbol-style-block");
const colorRampAction = document.getElementById("color-ramp-action");
const colorRampPopover = document.getElementById("color-ramp-popover");
const colorRampList = document.getElementById("color-ramp-list");
const shellPanelBottom = document.getElementById("shell-panel-bottom");
const dialogEl = document.getElementById("dialog");
const panelTabsHost = document.getElementById("panel-tabs-host");
const dialogTabsHost = document.getElementById("dialog-tabs-host");
const popOutAction = document.getElementById("pop-out");
const dockAction = document.getElementById("dock");
const minimizeDialogAction = document.getElementById("minimize-dialog");
const minimizedDataExplorer = document.getElementById("minimized-data-explorer");
const restoreDialogAction = document.getElementById("restore-dialog");
const navigationUser = document.getElementById("navigation-user");
const saveAction = document.getElementById("save");
const saveAlert = document.getElementById("save-alert");
const saveAlertLink = document.getElementById("save-alert-link");
const saveErrorAlert = document.getElementById("save-error-alert");
const saveErrorMessage = document.getElementById("save-error-message");
const galleryAction = document.getElementById("gallery-action");
const selectedAttributeChip = document.getElementById("selected-attribute-chip");
const selectionVariableChip = document.getElementById("selection-variable-chip");
const popupElement = document.getElementById("popup");
const similarFeaturesAction = document.getElementById("similar-features-action");
const selectionList = document.getElementById("selection-list");
const selectedValueBlock = document.getElementById("SelectedValueBlock");
const toggleCodeAction = document.getElementById("toggle-code");
const codeDialog = document.getElementById("code-dialog");
const codeSnippets = document.getElementById("code-snippets");

const GALLERY_PATH = "/apps/instant/gallery/index.html?appid=053eb0c7ab7345fca7bd43f94e4b9274&sortField=modified&sortOrder=desc&view=grid";
const MAP_CONFIGURATION_HEIGHT_BUFFER = 86;
const AUTOMATIC_RAMP_VALUE = "recommended-automatic";
let mapConfigurationHeightFrozen = false;
let selectedColorRamp = AUTOMATIC_RAMP_VALUE;

function moveTabsTo(host) {
    if (host && sharedTabs.parentElement !== host) {
        colorRampPopover.open = false;
        host.prepend(sharedTabs);
    }
}

function lockTabsToMapConfigurationHeight() {
    if (!mapConfigurationTab?.selected || mapConfigurationHeightFrozen) {
        return;
    }

    const tabNav = sharedTabs.querySelector("calcite-tab-nav");
    const tabRect = mapConfigurationTab.getBoundingClientRect();
    const blocksRect = mapConfigurationBlocks?.getBoundingClientRect();
    const renderedContentHeight = blocksRect
        ? blocksRect.bottom - tabRect.top
        : 0;
    const height = Math.ceil(
        renderedContentHeight + tabNav.getBoundingClientRect().height + MAP_CONFIGURATION_HEIGHT_BUFFER
    );

    if (height > 0) {
        const value = `${height}px`;
        const tabNavHeight = `${tabNav.getBoundingClientRect().height}px`;
        dialogTabsHost.style.setProperty("--map-configuration-tabs-height", value);
        dialogTabsHost.style.setProperty("--tabs-navigation-height", tabNavHeight);
        panelTabsHost.style.setProperty("--map-configuration-tabs-height", value);
        panelTabsHost.style.setProperty("--tabs-navigation-height", tabNavHeight);
    }
}

function freezeMapConfigurationHeight() {
    const height = dialogTabsHost.getBoundingClientRect().height || panelTabsHost.getBoundingClientRect().height;
    if (height <= 0) {
        return;
    }

    const value = `${Math.ceil(height)}px`;
    dialogTabsHost.style.setProperty("--map-configuration-tabs-height", value);
    panelTabsHost.style.setProperty("--map-configuration-tabs-height", value);
    mapConfigurationHeightFrozen = true;
}

async function populateNavigationUser(portal) {
    if (!navigationUser || !portal) {
        return;
    }

    await portal.load();
    const user = portal.user;
    if (!user) {
        return;
    }

    navigationUser.fullName = user.fullName || user.username;
    navigationUser.username = user.username;
    navigationUser.userId = user.username;
    navigationUser.textDisabled = false;
    navigationUser.hidden = false;
}

const BREAKPOINT_SMALL = 800;

// Wire the UI before any awaits so docking never waits on map or chart loading.
init();

//////////////////////////////////////////////////////
//  Map config
//////////////////////////////////////////////////////

await mapElement.viewOnReady();
const view = mapElement.view;
let selectedSizeField = null;

const {
    portalItem
} = mapElement.map;
mapElement.aria = {
    label: portalItem.title,
};
populateNavigationUser(portalItem.portal).catch((error) => {
    console.warn("Unable to display the signed-in user", error);
});

const biodiversityLayer = mapElement.map?.allLayers.find((layer) => {
    return layer.title === "Biodiversity and Conservation";
});

await biodiversityLayer.load();
biodiversityLayer.outFields = ["*"];
const biodiversityLayerView = await view.whenLayerView(biodiversityLayer);
const [colorSchemes, symbolUtils, univariateColorSizeRendererCreator, reactiveUtils] = await $arcgis.import([
    "@arcgis/core/smartMapping/symbology/color.js",
    "@arcgis/core/symbols/support/symbolUtils.js",
    "@arcgis/core/smartMapping/renderers/univariateColorSize.js",
    "@arcgis/core/core/reactiveUtils.js"
]);

//////////////////////////////////////////////////////
//  Selection list and selected hexagon
//////////////////////////////////////////////////////

let selectionChipUpdateId = 0;

function updateSelectionListVisibility() {
    selectionList.hidden = !view.selectionManager.hasSelection;
}

async function updateSelectionListChip(field, item) {
    const updateId = ++selectionChipUpdateId;

    if (!field) {
        return;
    }

    if (!item) {
        selectionVariableChip.textContent = "";
        return;
    }

    selectedValueBlock.expanded = true;
    selectedValueBlock.heading = field.alias;
    selectionVariableChip.textContent = "";

    const selectedLayer = item.layer ?? biodiversityLayer;
    const selectedLayerView = item.layerView ?? biodiversityLayerView;
    let itemValue = item.graphic?.getAttribute(field.name);
    if (itemValue === undefined) {
        const objectId = item.objectId ??
            item.graphic?.getObjectId?.() ??
            item.graphic?.getAttribute(selectedLayer.objectIdField);

        if (objectId != null) {
            try {
                const featureSet = await selectedLayerView.queryFeatures({
                    objectIds: [objectId],
                    outFields: [field.name],
                    returnGeometry: false
                });
                itemValue = featureSet.features[0]?.getAttribute(field.name);
            } catch (error) {
                console.warn(`Unable to load ${field.name} for the selected feature`, error);
            }
        }
    }

    if (updateId === selectionChipUpdateId && itemValue !== undefined) {
        selectionVariableChip.textContent = `${itemValue}`;
    }
}

selectionList.afterListItemSelect = ({ item }) => updateSelectionListChip(selectedSizeField, item);
view.selectionManager.on("selection-change", updateSelectionListVisibility);
updateSelectionListVisibility();

//////////////////////////////////////////////////////
//  Smart mapping and field picker logic
//////////////////////////////////////////////////////

const sizeValuePicker = document.getElementById("size-attribute-picker");
const sizeThemeSelector = document.getElementById("size-theme-selector");
const symbolStyleSelector = document.getElementById("symbol-style-selector");
const featureTable = document.querySelector("arcgis-feature-table");

const GRID_ID_FIELD = "Grid_ID";

let numericalFields = [];
const statisticsByField = new Map();
let mappingUpdateId = 0;
let requestedMappingKey = "";

async function getClientStatistics(fieldName) {
    const cachedStatistics = statisticsByField.get(fieldName);
    if (cachedStatistics) {
        return cachedStatistics;
    }

    await biodiversityLayerView.when();
    await reactiveUtils.whenOnce(() => !biodiversityLayerView.suspended && !biodiversityLayerView.updating);
    const query = biodiversityLayerView.createQuery();
    query.outStatistics = ["min", "max", "avg", "stddev", "count"].map((statisticType) => ({
        onStatisticField: fieldName,
        outStatisticFieldName: statisticType,
        statisticType
    }));
    query.returnGeometry = false;

    const featureSet = await biodiversityLayerView.queryFeatures(query);
    const attributes = featureSet.features[0]?.attributes ?? {};
    const statistics = {
        min: attributes.min ?? null,
        max: attributes.max ?? null,
        avg: attributes.avg ?? null,
        stddev: attributes.stddev ?? null,
        count: attributes.count ?? 0
    };
    statisticsByField.set(fieldName, statistics);
    return statistics;
}

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

function updateSelectedAttributeChip(field) {
    if (selectedAttributeChip && field) {
        selectedAttributeChip.textContent = field.alias;
    }
}

function getColorTheme() {
    return ["above", "below"].includes(sizeThemeSelector?.value)
        ? "high-to-low"
        : "above-and-below";
}

function createColorRampItem(value, heading, scheme, description = "") {
    const item = document.createElement("calcite-list-item");
    item.dataset.rampValue = value;
    item.heading = heading;
    item.description = description;
    item.label = description ? `${heading}, ${description}` : heading;
    item.selected = value === selectedColorRamp;

    const previewContainer = document.createElement("div");
    previewContainer.slot = "content-start";
    previewContainer.className = "color-ramp-preview";
    previewContainer.append(symbolUtils.renderColorRampPreviewHTML(scheme.colors, {
        align: "horizontal",
        width: 112,
        height: 18,
        gradient: true,
        ariaLabel: `${scheme.name} color ramp`
    }));
    item.append(previewContainer);
    return item;
}

function populateColorRamps(resetToAutomatic = false) {
    if (resetToAutomatic) {
        selectedColorRamp = AUTOMATIC_RAMP_VALUE;
    }

    const schemes = colorSchemes.getSchemes({
        basemap: mapElement.map.basemap,
        geometryType: biodiversityLayer.geometryType,
        theme: getColorTheme()
    });
    colorRampList.replaceChildren();

    if (!schemes?.primaryScheme) {
        return;
    }

    const recommendedSchemes = [schemes.primaryScheme, ...(schemes.secondarySchemes || [])];
    const uniqueSchemes = recommendedSchemes.filter(
        (scheme, index) => scheme && recommendedSchemes.findIndex((candidate) => candidate?.name === scheme.name) === index
    );
    const availableValues = new Set(uniqueSchemes.map((scheme) => scheme.name));
    if (selectedColorRamp !== AUTOMATIC_RAMP_VALUE && !availableValues.has(selectedColorRamp)) {
        selectedColorRamp = AUTOMATIC_RAMP_VALUE;
    }

    colorRampList.append(createColorRampItem(
        AUTOMATIC_RAMP_VALUE,
        "Auto",
        schemes.primaryScheme,
        `Recommended: ${schemes.primaryScheme.name}`
    ));
    for (const scheme of uniqueSchemes) {
        colorRampList.append(createColorRampItem(scheme.name, scheme.name, scheme));
    }
}

function getSelectedColorScheme() {
    if (selectedColorRamp === AUTOMATIC_RAMP_VALUE) {
        return null;
    }

    return colorSchemes.getSchemeByName({
        basemap: mapElement.map.basemap,
        geometryType: biodiversityLayer.geometryType,
        theme: getColorTheme(),
        name: selectedColorRamp
    });
}


async function updateFeatureTable(field) {
    if (!featureTable || !field) {
        return;
    }

    const [TableTemplate, FieldColumnTemplate] = await $arcgis.import([
        "@arcgis/core/widgets/FeatureTable/support/TableTemplate.js",
        "@arcgis/core/widgets/FeatureTable/support/FieldColumnTemplate.js"
    ]);

    featureTable.tableTemplate = new TableTemplate({
        columnTemplates: [
            new FieldColumnTemplate({
                fieldName: GRID_ID_FIELD,
                label: "Grid ID"
            }),
            new FieldColumnTemplate({
                fieldName: field.name,
                label: field.alias,
                initialSortPriority: 0,
                direction: "desc"
            })
        ]
    });
    featureTable.tableTitle = field.alias;
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
        updateSymbolStyleVisibility();
    }

    if (initialField && sizeValuePicker) {
        selectedSizeField = initialField;
        updateSelectedAttributeChip(initialField);
        updateSelectionListChip(initialField, null);
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

            updateSelectedAttributeChip(field);
            updateSelectionListChip(field, null);

            if (selectedSizeField && selected.value === selectedSizeField.name) {
                return;
            }

            selectedSizeField = field;
            populateColorRamps();
            await Promise.all([
                applyMapping(),
                updateFeatureTable(field)
            ]);
        });
    }

    if (sizeThemeSelector) {
        sizeThemeSelector.addEventListener("calciteSegmentedControlChange", async () => {
            freezeMapConfigurationHeight();
            updateSymbolStyleVisibility();
            populateColorRamps();

            if (!selectedSizeField) {
                return;
            }

            await applyMapping();
        });
    }

    if (symbolStyleSelector) {
        symbolStyleSelector.addEventListener("calciteComboboxChange", async () => {
            if (sizeThemeSelector?.value !== "above-and-below" || !selectedSizeField) {
                return;
            }

            await applyMapping();
        });
    }


    colorRampAction?.addEventListener("click", (event) => {
        event.stopPropagation();
        colorRampPopover.open = true;
    });

    colorRampList?.addEventListener("click", async (event) => {
        const item = event.composedPath().find((element) => element?.tagName === "CALCITE-LIST-ITEM");
        if (!item?.dataset.rampValue) {
            return;
        }

        colorRampPopover.open = false;
        if (item.dataset.rampValue === selectedColorRamp) {
            return;
        }

        selectedColorRamp = item.dataset.rampValue;
        for (const rampItem of colorRampList.querySelectorAll("calcite-list-item")) {
            rampItem.selected = rampItem === item;
        }
        await applyMapping();
    });
}

function updateSymbolStyleVisibility() {
    if (symbolStyleBlock) {
        symbolStyleBlock.hidden = sizeThemeSelector?.value !== "above-and-below";
    }
}

async function applyMapping() {
    if (!selectedSizeField) {
        return;
    }

    const field = selectedSizeField;
    const sizeTheme = sizeThemeSelector?.value || "above";
    const symbolStyle = sizeTheme === "above-and-below"
        ? symbolStyleSelector?.value || "arrow"
        : "circle";
    const colorScheme = getSelectedColorScheme();
    const mappingKey = [field.name, sizeTheme, symbolStyle, colorScheme?.name || selectedColorRamp].join("|");
    if (mappingKey === requestedMappingKey) {
        return;
    }

    requestedMappingKey = mappingKey;
    const updateId = ++mappingUpdateId;
    const statistics = await getClientStatistics(field.name);

    const params = {
        layer: biodiversityLayer,
        view: mapElement.view,
        field: field.name,
        theme: sizeTheme,
        statistics,
        symbolOptions: {
            symbolStyle
        },
        colorOptions: {
            isContinuous: true,
            colorScheme
        }
    };

    try {
        const { renderer } = await univariateColorSizeRendererCreator.createContinuousRenderer(params);
        if (updateId !== mappingUpdateId) {
            return;
        }

        biodiversityLayer.renderer = renderer;
    } catch (error) {
        if (updateId === mappingUpdateId) {
            requestedMappingKey = "";
        }
        throw error;
    }
}

extractNumericalFields();
await populateAttributeLists();
initializeFromExistingRenderer();
populateColorRamps(true);
await updateFeatureTable(selectedSizeField);
wireUpEvents();

////////////////////////////////////////////////////////////////////////////////////////////
//  Find hexagons within 1/4 standard deviation of the selected feature's attribute value
////////////////////////////////////////////////////////////////////////////////////////////

async function clearSimilarFeatures() {
    await biodiversityLayerView.when();
    biodiversityLayerView.featureEffect = null;
}

async function highlightSimilarFeatures() {
    if (similarFeaturesAction.loading || !selectedSizeField) {
        return;
    }

    const field = selectedSizeField;
    const selectedFeature = popupElement.selectedFeature;
    const selectedFeatureLayer = selectedFeature?.sourceLayer ?? selectedFeature?.layer;
    if (!selectedFeature || selectedFeatureLayer?.id !== biodiversityLayer.id) {
        return;
    }

    let itemValue = selectedFeature.attributes?.[field.name];
    if (itemValue === undefined) {
        const objectId = selectedFeature.getObjectId?.() ??
            selectedFeature.attributes?.[biodiversityLayer.objectIdField];

        if (objectId != null) {
            const featureSet = await biodiversityLayerView.queryFeatures({
                objectIds: [objectId],
                outFields: [field.name],
                returnGeometry: false
            });
            itemValue = featureSet.features[0]?.getAttribute(field.name);
        }
    }

    const attributeValue = Number(itemValue);
    if (!Number.isFinite(attributeValue)) {
        return;
    }

    similarFeaturesAction.loading = true;

    try {
        const [FeatureEffect] = await $arcgis.import([
            "@arcgis/core/layers/support/FeatureEffect.js"
        ]);
        await biodiversityLayerView.when();
        await reactiveUtils.whenOnce(() => !biodiversityLayerView.updating);

        const statistics = await getClientStatistics(field.name);
        const val = statistics?.stddev / 4;

        if (!Number.isFinite(val) || !popupElement.open) {
            return;
        }

        biodiversityLayerView.featureEffect = new FeatureEffect({
            filter: {
                where: `${field.name} BETWEEN ${attributeValue - val} AND ${attributeValue + val}`
            },
            includedEffect: "brightness(130%) saturate(150%)",
            excludedEffect: "grayscale(100%) opacity(25%)"
        });
    } finally {
        similarFeaturesAction.loading = false;
    }
}

//////////////////////////////////////////////////////
//  Save the web map
//////////////////////////////////////////////////////

async function saveWebMap() {
    const [Portal] = await $arcgis.import(["@arcgis/core/portal/Portal.js"]);

    const portal = Portal.getDefault();

    const attributeName = selectedSizeField?.alias ?? selectedSizeField?.name ?? "";
    const webmap = mapElement.map;

    await webmap.updateFrom(mapElement.view);

    const savedItem = await webmap.saveAs({
        portal,
        title: `Biodiversity and Conservation - ${attributeName}`,
        snippet: `Biodiversity and conservation hexagons mapped by ${attributeName}.`,
        tags: ["biodiversity", "conservation", "hexagons"]
    });

    try {
        await portal.request(`${savedItem.userItemUrl}/share`, {
            method: "post",
            query: { groups: "4f7c73a26a58490a906dca4fe7a280c3" }
        });
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

async function buildGalleryUrl() {
    const [Portal] = await $arcgis.import(["@arcgis/core/portal/Portal.js"]);

    const portal = Portal.getDefault();
    await portal.load();

    const host = portal.urlKey ? `${portal.urlKey}.${portal.customBaseUrl}` : portal.customBaseUrl;
    return `https://${host}${GALLERY_PATH}`;
}

//////////////////////////////////////////////////////
//  Init UI
//////////////////////////////////////////////////////

function init() {
    codeSnippets.editorOptions = {
        fontSize: 18,
        readOnly: true
    };
    codeSnippets.value = applyMapping.toString();
    toggleCodeAction.addEventListener("click", () => {
        codeDialog.open = true;
    });

    saveAction.addEventListener("click", () => handleSaveClick());

    galleryAction.addEventListener("click", async () => {
        const galleryUrl = await buildGalleryUrl();
        window.open(galleryUrl, "_blank", "noopener");
    });

    similarFeaturesAction.addEventListener("click", () => {
        highlightSimilarFeatures().catch((error) => {
            console.error("Unable to highlight similar features", error);
        });
    });

    popupElement.addEventListener("arcgisPropertyChange", (event) => {
        if (event.detail?.name === "open" && !popupElement.open) {
            clearSimilarFeatures();
        }
    });

    if (popOutAction && dockAction && shellPanelBottom && dialogEl) {
        popOutAction.addEventListener("click", () => {
            const isSmall = window.innerWidth <= BREAKPOINT_SMALL;
            if (isSmall) {
                return;
            }
            shellPanelBottom.hidden = true;
            minimizedDataExplorer.hidden = true;
            moveTabsTo(dialogTabsHost);
            dialogEl.open = true;
        });

        dockAction.addEventListener("click", () => {
            dialogEl.open = false;
            minimizedDataExplorer.hidden = true;
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
            popOutAction.setFocus();
        });
    }

    minimizeDialogAction?.addEventListener("click", () => {
        dialogEl.open = false;
        minimizedDataExplorer.hidden = false;
        restoreDialogAction.setFocus();
    });

    restoreDialogAction?.addEventListener("click", () => {
        minimizedDataExplorer.hidden = true;
        shellPanelBottom.hidden = true;
        moveTabsTo(dialogTabsHost);
        dialogEl.open = true;
        minimizeDialogAction.setFocus();
    });

    if (window.ResizeObserver && mapConfigurationTab) {
        const tabHeightObserver = new ResizeObserver(lockTabsToMapConfigurationHeight);
        tabHeightObserver.observe(mapConfigurationTab);
        if (mapConfigurationBlocks) {
            tabHeightObserver.observe(mapConfigurationBlocks);
        }
        sharedTabs.addEventListener("calciteTabChange", () => {
            requestAnimationFrame(lockTabsToMapConfigurationHeight);
        });
    }

    // Observe shell panel size changes as an extra trigger for responsive layout.
    if (window.ResizeObserver && shellPanelBottom) {
        const ro = new ResizeObserver(() => handleResponsiveLayout());
        ro.observe(shellPanelBottom);
    }
    window.addEventListener("resize", () => {
        mapConfigurationHeightFrozen = false;
        handleResponsiveLayout();
        requestAnimationFrame(lockTabsToMapConfigurationHeight);
    });
    handleResponsiveLayout();
}

function handleResponsiveLayout() {
    if (!shellPanelBottom || !dialogEl) {
        return;
    }

    const isSmall = window.innerWidth <= BREAKPOINT_SMALL;

    if (isSmall) {
        shellPanelBottom.hidden = false;
        dialogEl.open = false;
        minimizedDataExplorer.hidden = true;
        moveTabsTo(panelTabsHost);
        if (popOutAction) {
            popOutAction.hidden = true;
        }
    } else {
        if (dialogEl.open || dialogEl.hasAttribute("open")) {
            shellPanelBottom.hidden = true;
            moveTabsTo(dialogTabsHost);
        } else {
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
        }
        if (popOutAction) {
            popOutAction.hidden = false;
        }
    }
}