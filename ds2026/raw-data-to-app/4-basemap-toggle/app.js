const [
  { createModel },
  { sqlDateLiteral }
] = await $arcgis.import([
  "@arcgis/charts-components",
  "@arcgis/core/core/sql"
]);
const viewElement = document.querySelector("arcgis-map");
const calHeatChart = document.getElementById("cal-heat-chart");
const clearChartFilter = document.getElementById("clear-chart-filter");
const featuresElement = document.querySelector("arcgis-features");
const basemapToggleElement = document.querySelector("arcgis-basemap-toggle");

//////////////////////////////////////////////////////
//  Setup the map and layers
//////////////////////////////////////////////////////

viewElement.padding = { left: 600 };
await viewElement.viewOnReady();

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

//////////////////////////////////////////////////////
//  Basemap toggle
//////////////////////////////////////////////////////

basemapToggleElement.addEventListener("arcgisPropertyChange", (event) => {
  if (event.detail.name !== "nextBasemap") {
    const nextBasemap = event.target[event.detail.name];
    if (nextBasemap?.title == "Imagery with Labels") {
      noiseLayer.effect = "invert(100%)";
      heliLayer.effect = "hue-rotate(120deg)";
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
  viewElement.view.selectionManager.clear();
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


