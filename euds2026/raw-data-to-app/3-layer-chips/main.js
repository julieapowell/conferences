const viewElement = document.querySelector("arcgis-map");
const calciteNavLogo = document.querySelector("calcite-navigation-logo");
const toggleCodeAction = document.getElementById("toggle-code");
const codeDialog = document.getElementById("code-dialog");
const filterCodeSnippets = document.getElementById("filter-code-snippets");
const chipGroupSnippets = document.getElementById("chip-group-snippets");

const seasonChips = document.querySelector("calcite-chip-group");

await viewElement.viewOnReady();
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

//////////////////////////////////////////////////////
//  Code snippets
//////////////////////////////////////////////////////

const editorOptions = {
    detectIndentation: false,
    fontSize: 18,
    insertSpaces: true,
    readOnly: true,
    tabSize: 2
};
filterCodeSnippets.editorOptions = editorOptions;
chipGroupSnippets.editorOptions = editorOptions;
filterCodeSnippets.value = changeLayerVisibility.toString();
const chipGroupMarkup = seasonChips.outerHTML;
const markupLines = chipGroupMarkup.split("\n");
const baseIndentation = markupLines.at(-1).match(/^\s*/)[0];
chipGroupSnippets.value = markupLines
    .map((line) => line.startsWith(baseIndentation) ? line.slice(baseIndentation.length) : line)
    .join("\n");
toggleCodeAction.addEventListener("click", () => {
    codeDialog.open = true;
});