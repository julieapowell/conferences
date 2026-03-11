const Map = await $arcgis.import("@arcgis/core/Map.js");
const StreamLayer = await $arcgis.import("@arcgis/core/layers/StreamLayer.js");
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
const Basemap = await $arcgis.import("@arcgis/core/Basemap.js");

//Elements
const timeSlider = document.querySelector("arcgis-time-slider");
const mapElem = document.querySelector("arcgis-map");
const sceneElem = document.querySelector("arcgis-scene");
const toggleMapElem = document.getElementById("2d-3d-toggle-map");
const toggleSceneElem = document.getElementById("2d-3d-toggle-scene");
const liveSwitchElem2D = document.getElementById("2d-live-switch");
const liveSwitchElem3D = document.getElementById("3d-live-switch");

await mapElem.viewOnReady();

const historicObservations = mapElem.map?.allLayers.find((layer) => {
  return layer.title === "ISS - historic observations";
});
historicObservations.refreshInterval = 0.1;

const liveObservations = mapElem.map?.allLayers.find((layer) => {
  return layer.title === "ISS feed";
});

sceneElem.map = mapElem.map;

await mapElem.whenLayerView(historicObservations);
timeSlider.fullTimeExtent = historicObservations.timeInfo.fullTimeExtent.expandTo("hours");
timeSlider.stops = {
  interval: historicObservations.timeInfo.interval,
};

// Toggle between 3D and 2D
toggleMapElem.addEventListener("click", function () {
  mapElem.style.display = "none";
  sceneElem.style.display = "block";
  liveSwitchElem3D.checked = liveSwitchElem2D.checked;
  sceneElem.timeExtent = mapElem.timeExtent;
  timeSlider.referenceElement = sceneElem;
  console.log(sceneElem.map.layers);
});

toggleSceneElem.addEventListener("click", function () {
  mapElem.style.display = "block";
  sceneElem.style.display = "none";
  liveSwitchElem2D.checked = liveSwitchElem3D.checked;
  mapElem.timeExtent = sceneElem.timeExtent;
  timeSlider.referenceElement = mapElem;
  console.log(sceneElem.map.layers);
});

//Switch between historic and live modes
const toggleLive = () => {
  historicObservations.visible = !historicObservations.visible;
  !historicObservations.visible ? (timeSlider.style.display = "none") : (timeSlider.style.display = "inline");
  timeSlider.disabled = !historicObservations.visible;
  if (timeSlider.disabled) {
    mapElem.view.timeExtent = null;
    sceneElem.view.timeExtent = null;
    document.getElementById("statusBlock").setAttribute("status", "valid");
    document.getElementById("statusBlock").setAttribute("description", "LIVE");
  } else {
    document.getElementById("statusBlock").setAttribute("status", "idle");
    document.getElementById("statusBlock").setAttribute("description", "Past observations");
    timeSlider.timeExtent = timeSlider.fullTimeExtent;
  }
  liveObservations.visible = !liveObservations.visible;
  console.log(sceneElem.map.layers);
};

liveSwitchElem2D.addEventListener("calciteSwitchChange", toggleLive);
liveSwitchElem3D.addEventListener("calciteSwitchChange", toggleLive);
