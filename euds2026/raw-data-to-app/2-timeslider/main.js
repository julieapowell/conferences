const timeUtils = await $arcgis.import("@arcgis/core/support/timeUtils.js");
const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");
const timeBar = document.querySelector("arcgis-time-bar");

await viewElement.viewOnReady();
await timeBar.componentOnReady();
const { title, description } = viewElement.map.portalItem;

if (calciteNavLogo) {
    calciteNavLogo.heading = title === "" ? "A web map" : title;
}


