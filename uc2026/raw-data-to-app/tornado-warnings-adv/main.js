const timeUtils = await $arcgis.import("@arcgis/core/support/timeUtils.js");
const { watch } = await $arcgis.import("@arcgis/core/core/reactiveUtils.js");
const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");
const timeSlider = document.getElementById("time-slider-desktop");
const timeSliderMobile = document.getElementById("time-slider-mobile");
const seasonChips = document.querySelector("calcite-chip-group");
const sheetToggle = document.getElementById("sheet-toggle");
const analysisSheet = document.getElementById("analysis-sheet");
const overviewFlowItem = document.getElementById("overview-flow-item");
const featureFlowItem = document.getElementById("feature-flow-item");
const featureDetails = document.getElementById("feature-details");
const mobileOverviewFlowItem = document.getElementById("mobile-overview-flow-item");
const mobileFeatureFlowItem = document.getElementById("mobile-feature-flow-item");
const mobileFeatureDetails = document.getElementById("mobile-feature-details");

await viewElement.viewOnReady();
const view = viewElement.view;
const { title } = viewElement.map.portalItem;

if (calciteNavLogo) {
    calciteNavLogo.heading = title === "" ? "A web map" : title;
}

viewElement.padding = {
    left: 300,
};

const allSeasonsLayer = viewElement.map?.allLayers.find((layer) => {
    return layer.title === "All seasons";
});
const allSeasonsLayerView = await viewElement.whenLayerView(allSeasonsLayer);

//////////////////////////////////////////////////////
//  Time slider setup
//////////////////////////////////////////////////////

timeUtils.getTimeSliderSettingsFromWebDocument(viewElement.map).then((timeSliderSettings) => {
    timeSlider.applyTimeSliderSettings(timeSliderSettings);
});
timeUtils.getTimeSliderSettingsFromWebDocument(viewElement.map).then((timeSliderSettings) => {
    timeSliderMobile.applyTimeSliderSettings(timeSliderSettings);
});

//////////////////////////////////////////////////////
//  Layer visibility
//////////////////////////////////////////////////////

seasonChips.addEventListener("calciteChipGroupSelect", changeLayerVisibility);
let selectedSeason = allSeasonsLayer;

function changeLayerVisibility() {
    if (seasonChips.selectedItems[0]) {
        selectedSeason.visible = false;
        const season = seasonChips.selectedItems[0].value;

        if (season === "max-warnings") {
            selectedSeason = allSeasonsLayer;
            applyFeatureEffect();
        }
        else {
            allSeasonsLayerView.featureEffect = null;
            selectedSeason = viewElement.map?.allLayers.find((layer) => {
                return layer.title === season;
            });
        }
        selectedSeason.visible = true;
    }
}

//////////////////////////////////////////////////////
//  Flow-based feature detail workflow
//////////////////////////////////////////////////////

sheetToggle.addEventListener("click", () => {
    analysisSheet.open = true;
});

function resetDesktopWorkflow() {
    featureFlowItem.selected = false;
    overviewFlowItem.selected = true;
    featureDetails.features = [];
}

function resetMobileWorkflow() {
    mobileFeatureFlowItem.selected = false;
    mobileOverviewFlowItem.selected = true;
    mobileFeatureDetails.features = [];
}

featureFlowItem.addEventListener("calciteFlowItemBack", () => {
    resetDesktopWorkflow();
});

mobileFeatureFlowItem.addEventListener("calciteFlowItemBack", () => {
    resetMobileWorkflow();
});

viewElement.addEventListener("arcgisViewClick", async (event) => {
    const { results } = await viewElement.hitTest(event.detail);
    const hitResult = results?.find((result) => result.graphic?.attributes);

    if (hitResult?.graphic) {
        featureDetails.features = [hitResult.graphic];
        overviewFlowItem.selected = false;
        featureFlowItem.selected = true;

        mobileFeatureDetails.features = [hitResult.graphic];
        mobileOverviewFlowItem.selected = false;
        mobileFeatureFlowItem.selected = true;
        if (window.matchMedia("(max-width: 900px)").matches) {
            analysisSheet.open = true;
        }
    }
});

//////////////////////////////////////////////////////////////
//  Emphasize high levels of warnings for current time extent
//////////////////////////////////////////////////////////////

let currentYearColumn = "duration2006";

const handle = watch(
    () => viewElement.timeExtent,
    () => {
        if (seasonChips.selectedItems[0].value === "max-warnings") {
            applyFeatureEffect();
        }
    }
);

function applyFeatureEffect() {
    const year = viewElement.timeExtent.start.getFullYear();
    currentYearColumn = "duration" + year;
    const where = `${currentYearColumn} >= 80640`; //duration of warnings is at least 4 weeks of the year
    allSeasonsLayerView.featureEffect = {
        filter: {
            where,
        },
        includedEffect: "drop-shadow(1.5px 1.5px 4.5px #323232ff)",
        excludedEffect: "opacity(35%)",
    };
}