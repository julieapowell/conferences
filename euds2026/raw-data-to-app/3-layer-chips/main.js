const timeUtils = await $arcgis.import("@arcgis/core/support/timeUtils.js");
const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");
const timeBar = document.querySelector("arcgis-time-bar");
const seasonChips = document.querySelector("calcite-chip-group");

await viewElement.viewOnReady();
await timeBar.componentOnReady();
const { title, description } = viewElement.map.portalItem;

if (calciteNavLogo) {
    calciteNavLogo.heading = title === "" ? "A web map" : title;
}

const allSeasonsLayer = viewElement.map?.allLayers.find((layer) => {
    return layer.title === "All seasons";
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

        selectedSeason = viewElement.map?.allLayers.find((layer) => {
            return layer.title === season;
        });
        selectedSeason.visible = true;
    }
}