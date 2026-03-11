const [
  { createModel },
  { sqlDateLiteral },
  Graphic,
  GraphicsLayer,
  unionOperator,
  SketchViewModel
] = await $arcgis.import([
  "@arcgis/charts-components",
  "@arcgis/core/core/sql",
  "@arcgis/core/Graphic.js",
  "@arcgis/core/layers/GraphicsLayer.js",
  "@arcgis/core/geometry/operators/unionOperator.js",
  "@arcgis/core/widgets/Sketch/SketchViewModel.js"
]);
const viewElement = document.querySelector("arcgis-map");
const calHeatChart = document.getElementById("cal-heat-chart");
const clearChartFilter = document.getElementById("clear-chart-filter");
const featuresElement = document.querySelector("arcgis-features");
const basemapToggleElement = document.querySelector("arcgis-basemap-toggle");
const tableElement = document.querySelector("arcgis-feature-table");

//////////////////////////////////////////////////////
//  Setup the map and layers
//////////////////////////////////////////////////////

viewElement.padding = { left: 600 };
await viewElement.viewOnReady();
const view = viewElement.view;

const heliLayer = viewElement.map?.allLayers.find((layer) => {
  return layer.title === "Helicopter tracks";
});
const heliLayerView = await viewElement.whenLayerView(heliLayer);

const censusLayer = viewElement.map?.layers.find((layer) => {
  return layer.title === "NYC Enriched Census Tracts";
});

const noiseLayer = viewElement.map?.allLayers.find((layer) => {
  return layer.title === "Complaints since Jan 2025";
});
const noiseLayerView = await viewElement.whenLayerView(noiseLayer);

//////////////////////////////////////////////////////
//  Setup selection
//////////////////////////////////////////////////////
const polygonGraphicsLayer = new GraphicsLayer();
viewElement.map.add(polygonGraphicsLayer);

const sketchViewModel = new SketchViewModel({
  view: view,
  layer: polygonGraphicsLayer,
  updateOnGraphicClick: false,
});

// set up sketch view model to draw a rectangle when user clicks the button
document.getElementById("select-menu-item").addEventListener("calciteMenuItemSelect", () => {
  viewElement.closePopup();
  sketchViewModel.create("rectangle");
});

// clear the selection and highlights on the map.
document.getElementById("clear-menu-item").addEventListener("calciteMenuItemSelect", () => {
  clearSelection();
});

// Highlight features from the national parks layer when the user finishes drawing a rectangle on the map
sketchViewModel.on("create", async (event) => {
  if (event.state === "complete") {
    const geometries = polygonGraphicsLayer.graphics.map((graphic) => graphic.geometry);
    const queryGeometry = unionOperator.executeMany(geometries.toArray());
    selectFeatures(queryGeometry, noiseLayerView);
  }
});

async function selectFeatures(geometry, layerView) {
  try {
    const query = { geometry };
    const result = await layerView.queryFeatures(query);

    if (result.features.length === 0) {
      clearSelection();
    } else {
      const highlightIds = result.features.map((feature) => feature.attributes.ObjectId);
      view.selectionManager.replace(noiseLayer, highlightIds);
    }
  } catch (error) {
    console.error("Error selecting features:", error);
  }
}

function clearSelection() {
  view.selectionManager.clear();
  polygonGraphicsLayer.removeAll();
  noiseLayerView.featureEffect = null;
}

view.selectionManager.on("selection-change", async (event) => {
  const results = await view.selectionManager.getSelection(noiseLayer);

  if (results == undefined) {
    return;
  }
  else if (results.length) {
    console.log(results);
    noiseLayerView.featureEffect = {
      filter: { objectIds: results },
      excludedEffect: "blur(5px) grayscale(90%) opacity(40%)",
    };
  }
  else {
    clearSelection();
  }
});

//////////////////////////////////////////////////////
//  Setup the table
//////////////////////////////////////////////////////

tableElement.layer = noiseLayer;

viewElement.addEventListener("arcgisViewChange", () => {
  tableElement.filterGeometry = viewElement.view.extent;
});

//////////////////////////////////////////////////////
//  Basemap toggle
//////////////////////////////////////////////////////

basemapToggleElement.addEventListener("arcgisPropertyChange", (event) => {
  if (event.detail.name !== "nextBasemap") {
    const nextBasemap = event.target[event.detail.name];
    if (nextBasemap?.title == "Imagery with Labels") {
      noiseLayer.effect = "invert(100%)";
      heliLayer.effect = "hue-rotate(217deg) brightness(101%) contrast(126%)";
    } else {
      noiseLayer.effect = null;
      heliLayer.effect = null;
    }
  }
});

//////////////////////////////////////////////////////
//  Features
//////////////////////////////////////////////////////

viewElement.addEventListener("arcgisViewClick", async (event) => {
  const { results } = await viewElement.hitTest(event.detail, {
    include: [censusLayer],
  });
  if (results?.length > 0) {
    featuresElement.features = [results[0].graphic];
  }
});

censusAccordion.addEventListener("calciteAccordionItemExpand", () => {
  censusLayer.visible = true;
});

censusAccordion.addEventListener("calciteAccordionItemCollapse", () => {
  censusLayer.visible = false;
});

//////////////////////////////////////////////////////
//  Cal heat chart
//////////////////////////////////////////////////////

await heliLayer.load();

calHeatChart.model = await createModel({
  layer: heliLayer,
  config: heliLayer.charts[0],
});
calHeatChart.model.hideEmptyRowsAndColumns = true;
calHeatChart.view = viewElement.view;

calHeatChart.addEventListener("arcgisSelectionComplete", async (event) => {
  const selectionData = event.detail.selectionData;
  if (!selectionData?.selectionItems?.length) {
    return;
  }

  const day = selectionData.selectionItems[0].arcgis_charts_heat_chart_x;
  const month = selectionData.selectionItems[0].arcgis_charts_heat_chart_y;
  const year = 2026;

  const selectedDate = new Date(year, month - 1, day).getTime();

  // heliLayer.definitionExpression = `DateOfFlight = ${sqlDateLiteral(
  //   startDate
  // )}`;

  heliLayerView.filter = {
    where: `DateOfFlight = ${sqlDateLiteral(selectedDate)}`,
  };

  clearChartFilter.style.display = "block";

});

clearChartFilter.addEventListener("click", () => {
  heliLayerView.filter.where = "1=1";
  calHeatChart.clearSelection();
  clearChartFilter.style.display = "none";
});


