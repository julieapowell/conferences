const [
    OAuthInfo,
    identityManager,
    colorRendererCreator,
    sizeRendererCreator,
    univariateColorSizeRendererCreator,
    relationshipRendererCreator,
    colorSchemes,
    symbolUtils,
    PortalItem,
    esriRequest,
] = await $arcgis.import([
    "@arcgis/core/identity/OAuthInfo.js",
    "@arcgis/core/identity/IdentityManager.js",
    "@arcgis/core/smartMapping/renderers/color.js",
    "@arcgis/core/smartMapping/renderers/size.js",
    "@arcgis/core/smartMapping/renderers/univariateColorSize.js",
    "@arcgis/core/smartMapping/renderers/relationship.js",
    "@arcgis/core/smartMapping/symbology/color.js",
    "@arcgis/core/symbols/support/symbolUtils.js",
    "@arcgis/core/portal/PortalItem.js",
    "@arcgis/core/request.js",
]);

const webMapId = "5904891c2ee54113af7c8f1ee0550569";
const sharingGroupId = "4f7c73a26a58490a906dca4fe7a280c3";
const portalUrl = "https://www.arcgis.com";
const oauthInfo = new OAuthInfo({
    appId: "No2Lhym7wqkgUyOG",
    portalUrl,
    popup: false,
});

identityManager.registerOAuthInfos([oauthInfo]);

const mapElement = document.querySelector("#mapElement");
const primaryField = document.querySelector("#primaryField");
const secondaryField = document.querySelector("#secondaryField");
const styleControl = document.querySelector("#styleControl");
const themeControl = document.querySelector("#themeControl");
const themeLabel = document.querySelector("#themeLabel");
const colorRampControl = document.querySelector("#colorRampControl");
const colorRampLabel = document.querySelector("#colorRampLabel");
const applyButton = document.querySelector("#applyButton");
const resetButton = document.querySelector("#resetButton");
const saveButton = document.querySelector("#saveButton");
const statusNotice = document.querySelector("#statusNotice");
const statusTitle = statusNotice.querySelector("calcite-notice-title");
const statusMessage = statusNotice.querySelector("calcite-notice-message");
const loader = document.querySelector("#loader");
const signOutButton = document.querySelector("#signOutButton");
const navigationUser = document.querySelector("#navigationUser");
const stylePanel = document.querySelector("#stylePanel");
const styleMenuButton = document.querySelector("#styleMenuButton");
const closePanelButton = document.querySelector("#closePanelButton");
const navigationLogo = document.querySelector("calcite-navigation-logo");
const mobileLayout = matchMedia("(max-width: 700px)");

const numericFieldTypes = new Set(["small-integer", "integer", "single", "double", "long", "big-integer"]);
const attributeTagPrefix = "Mapped attribute: ";
const automaticRampValue = "recommended-automatic";
const colorThemes = [
    ["high-to-low", "High to low"],
    ["above-and-below", "Above and below"],
    ["centered-on", "Centered on"],
    ["extremes", "Extremes"],
];
const sizeThemes = [
    ["high-to-low", "High to low"],
    ["above", "Above midpoint"],
    ["below", "Below midpoint"],
];
const layerState = new Map();
let featureLayers = [];
let savedPortalItem = null;

function updateResponsiveLayout(event = mobileLayout) {
    const isMobile = event.matches;
    stylePanel.displayMode = isMobile ? "overlay" : "dock";
    stylePanel.collapsed = isMobile;
    stylePanel.resizable = !isMobile;
    navigationUser.textDisabled = isMobile;
    styleMenuButton.hidden = !isMobile;
    closePanelButton.hidden = !isMobile;
    navigationLogo.heading = isMobile ? "Style Lab" : "Biodiversity Style Lab";
    navigationLogo.description = isMobile ? "" : "Explore conservation patterns";
}

function closeMobilePanel() {
    if (mobileLayout.matches) {
        stylePanel.collapsed = true;
    }
}

function setStatus(kind, title, message) {
    statusNotice.kind = kind;
    statusNotice.icon = kind === "danger" ? "exclamation-mark-triangle" : "information";
    statusTitle.textContent = title;
    statusMessage.textContent = message;
}

function setSavedStatus(portalItem) {
    const itemLink = document.createElement("calcite-link");
    itemLink.href = `${portalItem.portal.url}/home/item.html?id=${portalItem.id}`;
    itemLink.target = "_blank";
    itemLink.rel = "noopener noreferrer";
    itemLink.iconEnd = "launch";
    itemLink.textContent = `Open ${portalItem.title} (opens in a new window)`;

    setStatus("success", "WebMap saved and shared", "");
    statusMessage.replaceChildren(itemLink);
}

function getWebMapTitle() {
    const attributes = [primaryField.value, secondaryField.value].filter(Boolean);
    return `biodiversity-${attributes.join("-")}`;
}

function getSelectedAttributeAliases() {
    return [primaryField, secondaryField]
        .filter((fieldSelect) => fieldSelect.value)
        .map((fieldSelect) => fieldSelect.selectedOption?.textContent.trim() || fieldSelect.value);
}

function getWebMapMetadata(webMap) {
    const attributeAliases = getSelectedAttributeAliases();
    const attributeText = new Intl.ListFormat(undefined, { type: "conjunction" }).format(attributeAliases);
    const styleName = styleControl.selectedOption?.textContent.trim() || styleControl.value;
    const description = `Maps ${attributeText} across compatible biodiversity layers using the ${styleName} smart-mapping style.`;
    const existingTags = savedPortalItem?.tags || webMap.portalItem.tags || [];
    const tags = [
        ...existingTags.filter((tag) => !tag.startsWith(attributeTagPrefix)),
        "Biodiversity",
        ...attributeAliases.map((alias) => `${attributeTagPrefix}${alias}`),
    ];

    return {
        title: getWebMapTitle(),
        snippet: description,
        description,
        tags: [...new Set(tags)],
    };
}

async function captureMapThumbnail() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const screenshot = await mapElement.view.takeScreenshot({
        width: 600,
        height: 400,
        format: "png",
    });
    return fetch(screenshot.dataUrl).then((response) => response.blob());
}

function createOption(value, label) {
    const option = document.createElement("calcite-option");
    option.value = value;
    option.textContent = label;
    return option;
}

function getNumericFields(layer) {
    return layer.fields.filter(
        (field) => numericFieldTypes.has(field.type) && field.name !== layer.objectIdField,
    );
}

function styleUsesColor() {
    return ["color", "size", "bivariate-color-size"].includes(styleControl.value);
}

function getColorTheme() {
    return ["above", "below"].includes(themeControl.value) ? "high-to-low" : themeControl.value;
}

function createColorRampItem(value, heading, scheme, description) {
    const item = document.createElement("calcite-combobox-item");
    item.value = value;
    item.heading = heading;
    item.description = description;
    item.label = description ? `${heading}, ${description}` : heading;

    const previewContainer = document.createElement("div");
    previewContainer.slot = "content-start";
    previewContainer.className = "color-ramp-preview";
    previewContainer.append(symbolUtils.renderColorRampPreviewHTML(scheme.colors, {
        align: "horizontal",
        width: 112,
        height: 18,
        gradient: true,
        ariaLabel: `${scheme.name} color ramp`,
    }));
    item.append(previewContainer);
    return item;
}

function populateColorRamps() {
    const previousRamp = colorRampControl.value || automaticRampValue;
    colorRampControl.replaceChildren();

    if (!styleUsesColor() || !featureLayers.length) {
        return;
    }

    const selectedFields = [primaryField.value, secondaryField.value].filter(Boolean);
    const referenceLayer = featureLayers.find((layer) =>
        selectedFields.every((fieldName) => layer.fields.some((field) => field.name === fieldName)),
    ) || featureLayers[0];
    const schemes = colorSchemes.getSchemes({
        basemap: mapElement.map.basemap,
        geometryType: referenceLayer.geometryType,
        theme: getColorTheme(),
    });
    if (!schemes) {
        colorRampControl.value = automaticRampValue;
        return;
    }

    const recommendedSchemes = [schemes?.primaryScheme, ...(schemes?.secondarySchemes || [])];
    const uniqueSchemes = recommendedSchemes.filter(
        (scheme, index) => scheme && recommendedSchemes.findIndex((candidate) => candidate?.name === scheme.name) === index,
    );
    colorRampControl.append(createColorRampItem(
        automaticRampValue,
        "Auto",
        schemes.primaryScheme,
        `Recommended: ${schemes.primaryScheme.name}`,
    ));
    for (const scheme of uniqueSchemes) {
        colorRampControl.append(createColorRampItem(scheme.name, scheme.name, scheme));
    }
    const selectedItem = [...colorRampControl.children].find((item) => item.value === previousRamp)
        || colorRampControl.firstElementChild;
    selectedItem.selected = true;
    colorRampControl.value = selectedItem.value;
}

function updateStyleControls() {
    const isRelationship = styleControl.value === "relationship";
    const isSize = styleControl.value === "size";
    const themes = isSize ? sizeThemes : colorThemes;
    const previousTheme = themeControl.value;

    themeControl.replaceChildren(...themes.map(([value, label]) => createOption(value, label)));
    themeControl.value = themes.some(([value]) => value === previousTheme) ? previousTheme : "high-to-low";
    themeControl.disabled = isRelationship;
    themeLabel.hidden = isRelationship;
    colorRampControl.disabled = !styleUsesColor();
    colorRampLabel.hidden = !styleUsesColor();
    populateColorRamps();
}

function updateStyleAvailability() {
    const hasSecondaryField = Boolean(secondaryField.value);
    const colorItem = styleControl.querySelector('[value="color"]');
    const sizeItem = styleControl.querySelector('[value="size"]');
    const relationshipItem = styleControl.querySelector('[value="relationship"]');
    const colorSizeItem = styleControl.querySelector('[value="bivariate-color-size"]');

    colorItem.disabled = hasSecondaryField;
    sizeItem.disabled = hasSecondaryField;
    relationshipItem.disabled = !hasSecondaryField;
    colorSizeItem.disabled = !hasSecondaryField;

    if (hasSecondaryField && ["color", "size"].includes(styleControl.value)) {
        styleControl.value = "relationship";
    } else if (!hasSecondaryField && ["relationship", "bivariate-color-size"].includes(styleControl.value)) {
        styleControl.value = "color";
    }
    updateStyleControls();
}

function populateFields() {
    const fieldsByName = new Map();
    for (const layer of featureLayers) {
        for (const field of getNumericFields(layer)) {
            if (!fieldsByName.has(field.name)) {
                fieldsByName.set(field.name, field);
            }
        }
    }
    const fields = [...fieldsByName.values()].sort((first, second) =>
        (first.alias || first.name).localeCompare(second.alias || second.name),
    );

    primaryField.replaceChildren();
    secondaryField.replaceChildren(createOption("", "None"));

    for (const field of fields) {
        const label = field.alias || field.name;
        primaryField.append(createOption(field.name, label));
        secondaryField.append(createOption(field.name, label));
    }

    secondaryField.value = "";

    if (!fields.length) {
        primaryField.disabled = true;
        secondaryField.disabled = true;
        styleControl.disabled = true;
        applyButton.disabled = true;
        styleMenuButton.disabled = true;
        setStatus("danger", "No numeric attributes", "The WebMap does not contain numeric FeatureLayer attributes.");
        return;
    }

    primaryField.value = fields[0].name;
    primaryField.disabled = false;
    secondaryField.disabled = false;
    styleControl.disabled = false;
    applyButton.disabled = false;
    resetButton.disabled = false;
    saveButton.disabled = false;
    styleMenuButton.disabled = false;
    updateStyleAvailability();
    setStatus("info", "Attributes ready", `${fields.length} numeric attributes are available across ${featureLayers.length} layers.`);
}

async function createRenderer(layer) {
    const selectedColorScheme = colorRampControl.value !== automaticRampValue
        ? colorSchemes.getSchemeByName({
            basemap: mapElement.map.basemap,
            geometryType: layer.geometryType,
            theme: getColorTheme(),
            name: colorRampControl.value,
        })
        : null;
    const parameters = {
        layer,
        view: mapElement.view,
        field: primaryField.value,
        theme: themeControl.value,
    };

    switch (styleControl.value) {
        case "size":
            return univariateColorSizeRendererCreator.createContinuousRenderer({
                ...parameters,
                colorOptions: {
                    isContinuous: true,
                    colorScheme: selectedColorScheme,
                },
            });
        case "relationship":
            return relationshipRendererCreator.createRenderer({
                layer,
                view: mapElement.view,
                field1: { field: primaryField.value },
                field2: { field: secondaryField.value },
                numClasses: 3,
                outlineOptimizationEnabled: true,
            });
        case "bivariate-color-size": {
            const [colorResult, sizeResult] = await Promise.all([
                colorRendererCreator.createContinuousRenderer({
                    ...parameters,
                    colorScheme: selectedColorScheme,
                }),
                sizeRendererCreator.createContinuousRenderer({
                    ...parameters,
                    field: secondaryField.value,
                    theme: "high-to-low",
                }),
            ]);
            const renderer = sizeResult.renderer.clone();
            const colorVariable = colorResult.renderer.visualVariables.find((variable) => variable.type === "color");
            renderer.visualVariables = [
                ...renderer.visualVariables.filter((variable) => variable.type !== "color"),
                colorVariable.clone(),
            ];
            return { renderer };
        }
        case "color":
        default:
            return colorRendererCreator.createContinuousRenderer({
                ...parameters,
                colorScheme: selectedColorScheme,
            });
    }
}

async function applyVisualization() {
    if (!primaryField.value) {
        return;
    }

    const requiredFields = [primaryField.value, secondaryField.value].filter(Boolean);
    const compatibleLayers = featureLayers.filter((layer) =>
        requiredFields.every((fieldName) => layer.fields.some((field) => field.name === fieldName)),
    );

    if (!compatibleLayers.length) {
        setStatus("danger", "No compatible layers", "No FeatureLayer contains all selected attributes.");
        return;
    }

    applyButton.loading = true;
    loader.hidden = false;
    setStatus("info", "Generating renderer", "Smart mapping is analyzing the selected attributes.");

    try {
        const results = await Promise.all(
            compatibleLayers.map(async (layer) => ({ layer, ...(await createRenderer(layer)) })),
        );
        for (const { layer, renderer } of results) {
            layer.renderer = renderer;
        }
        const skippedCount = featureLayers.length - compatibleLayers.length;
        const skippedMessage = skippedCount ? ` ${skippedCount} without the selected attributes were skipped.` : "";
        setStatus(
            "success",
            "Visualization applied",
            `${compatibleLayers.length} layers now use the ${styleControl.value} style.${skippedMessage}`,
        );
        closeMobilePanel();
    } catch (error) {
        console.error(error);
        setStatus("danger", "Renderer could not be generated", error.message);
    } finally {
        applyButton.loading = false;
        loader.hidden = true;
    }
}

function resetVisualization() {
    for (const layer of featureLayers) {
        layer.renderer = layerState.get(layer.id).clone();
    }

    secondaryField.value = "";
    styleControl.value = "color";
    updateStyleAvailability();
    setStatus("info", "Original styles restored", `${featureLayers.length} FeatureLayer renderers were reset.`);
    closeMobilePanel();
}

async function saveAndShareWebMap() {
    saveButton.loading = true;
    setStatus("info", "Saving WebMap", "Capturing the map and saving its current layer styles to ArcGIS Online.");

    try {
        const webMap = mapElement.map;
        const metadata = getWebMapMetadata(webMap);
        const thumbnail = await captureMapThumbnail();
        if (savedPortalItem) {
            await webMap.save();
        } else {
            savedPortalItem = await webMap.saveAs(
                new PortalItem({
                    ...metadata,
                    portal: webMap.portalItem.portal,
                }),
            );
        }
        Object.assign(savedPortalItem, metadata);
        await savedPortalItem.update();
        await savedPortalItem.updateThumbnail({ thumbnail, filename: "map-thumbnail.png" });

        const shareUrl = `${savedPortalItem.portal.url}/sharing/rest/content/users/${encodeURIComponent(savedPortalItem.owner)}/items/${savedPortalItem.id}/share`;
        const { data: sharingResult } = await esriRequest(shareUrl, {
            method: "post",
            query: {
                f: "json",
                everyone: false,
                org: false,
                groups: sharingGroupId,
            },
        });
        if (sharingResult.notSharedWith?.length) {
            throw new Error("The WebMap was saved, but ArcGIS Online could not share it to the configured group.");
        }

        setSavedStatus(savedPortalItem);
        closeMobilePanel();
    } catch (error) {
        console.error(error);
        setStatus("danger", "WebMap could not be saved and shared", error.message);
    } finally {
        saveButton.loading = false;
    }
}

async function initialize() {
    try {
        setStatus("info", "Sign-in required", "Connecting to your ArcGIS Online account.");
        const credential = await identityManager.getCredential(`${portalUrl}/sharing`);
        navigationUser.username = credential.userId;
        navigationUser.userId = credential.userId;
        navigationUser.hidden = false;
        signOutButton.hidden = false;
        mapElement.itemId = webMapId;
        await mapElement.viewOnReady();
        navigationUser.fullName = mapElement.map.portalItem.portal.user?.fullName || credential.userId;
        featureLayers = mapElement.map.allLayers.filter((layer) => layer.type === "feature").toArray();

        if (!featureLayers.length) {
            throw new Error("This WebMap does not contain a FeatureLayer.");
        }

        for (const layer of featureLayers) {
            await layer.load();
            layerState.set(layer.id, layer.renderer.clone());
        }

        populateFields();
    } catch (error) {
        console.error(error);
        setStatus("danger", "App could not start", error.message);
    }
}

primaryField.addEventListener("calciteSelectChange", populateColorRamps);
secondaryField.addEventListener("calciteSelectChange", updateStyleAvailability);
styleControl.addEventListener("calciteSelectChange", () => {
    updateStyleControls();
    setStatus("info", "Style selected", styleControl.selectedOption.textContent);
});
themeControl.addEventListener("calciteSelectChange", populateColorRamps);
colorRampControl.addEventListener("calciteComboboxChange", () => {
    setStatus("info", "Color ramp selected", colorRampControl.selectedItems[0]?.heading || "Recommended");
});
applyButton.addEventListener("click", applyVisualization);
resetButton.addEventListener("click", resetVisualization);
saveButton.addEventListener("click", saveAndShareWebMap);
styleMenuButton.addEventListener("click", () => {
    stylePanel.collapsed = false;
});
closePanelButton.addEventListener("click", closeMobilePanel);
mobileLayout.addEventListener("change", updateResponsiveLayout);
signOutButton.addEventListener("click", () => {
    identityManager.destroyCredentials();
    location.reload();
});

updateResponsiveLayout();
initialize();