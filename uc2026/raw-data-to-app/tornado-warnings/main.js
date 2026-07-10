const timeUtils = await $arcgis.import("@arcgis/core/support/timeUtils.js");
const { watch } = await $arcgis.import("@arcgis/core/core/reactiveUtils.js");
const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");
const timeSlider = document.querySelector("arcgis-time-slider");
const seasonChips = document.querySelector("calcite-chip-group");

await viewElement.viewOnReady();
const { title, description } = viewElement.map.portalItem;

if (calciteNavLogo) {
    calciteNavLogo.heading = title === "" ? "A web map" : title;
}

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

//////////////////////////////////////////////////////////////
//  Emphasize high levels of warnings for current time extent
//////////////////////////////////////////////////////////////

let currentYearColumn = "duration2006";

const handle = watch(
    () => viewElement.timeExtent,
    (timeExtent) => {
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