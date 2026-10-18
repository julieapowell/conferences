const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");

await viewElement.viewOnReady();

const { title, description } = viewElement.map.portalItem;

if (calciteNavLogo) {
    calciteNavLogo.heading = title === "" ? "A web map" : title;
}


