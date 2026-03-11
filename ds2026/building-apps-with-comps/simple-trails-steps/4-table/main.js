const mapElement = document.querySelector("arcgis-map");
const tableElement = document.querySelector("arcgis-feature-table");
const popupElement = document.querySelector("arcgis-popup");

popupElement.dockOptions = {
  buttonEnabled: false,
  breakpoint: false,
  position: "top-right",
};

await mapElement.viewOnReady();

//////////////////////////////////////////////////////
//  Table setup
//////////////////////////////////////////////////////

const trailsLayer = mapElement.map?.layers.find((layer) => {
  console.log(layer.title);
  return layer.title === "National Park Trails";
});

tableElement.layer = trailsLayer;
tableElement.multipleSelectionDisabled = true;

mapElement.addEventListener("arcgisViewChange", () => {
  tableElement.filterGeometry = mapElement.view.extent;
});
