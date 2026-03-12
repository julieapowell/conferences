async function load() {
    const connectionInvoke = document.getElementById("connection-invoke");
    const connectionScrim = document.getElementById("connection-scrim");
    const connectionPopover = document.getElementById("connection-popover");
    const connectionPanel = document.getElementById("connection-panel");
    const connectionNotice = document.getElementById("connection-notice");
    const connectionNoticeTitle = document.getElementById(
        "connection-notice-title"
    );
    const blockAttribute = document.getElementById("block-attribute");
    const blockSpatial = document.getElementById("block-spatial");
    const blockLegend = document.getElementById("block-legend");
    const legendEl = document.querySelector("arcgis-legend");
    const navigationEl = document.getElementById("nav");
    navigationEl.addEventListener("calciteNavigationActionSelect", () => handleSheetOpen());
    connectionInvoke.addEventListener("click", function () {
        connectionScrim.hidden = false;
        connectionPanel.removeAttribute("closed")

    });

    connectionPanel.addEventListener("calcitePanelClose", function () {
        connectionScrim.hidden = true;
        connectionPopover.open = false;
    });

    connectionPopover.addEventListener("calcitePopoverClose", function () {
        connectionScrim.hidden = true;
        connectionPanel.closed = true;
    });

    const mapElem = document.querySelector("arcgis-map");
    mapElem.addEventListener("arcgisViewReadyChange", async (event) => {
        const WebStyleSymbol = await $arcgis.import(
            "esri/symbols/WebStyleSymbol"
        );
        const StreamLayer = await $arcgis.import("esri/layers/StreamLayer");
        const Graphics = await $arcgis.import("esri/Graphic");
        const GraphicsLayer = await $arcgis.import(
            "esri/layers/GraphicsLayer"
        );
        const Polygon = await $arcgis.import("esri/geometry/Polygon");
        const SketchViewModel = await $arcgis.import(
            "esri/widgets/Sketch/SketchViewModel"
        );
        const reactiveUtils = await $arcgis.import("esri/core/reactiveUtils");
        const map = event.target.map;
        const view = event.target.view;
        let streamLayer, streamLayerView;
        const template = {
            title: "ID: {ident}",
            content: [
                {
                    type: "fields",
                    fieldInfos: [
                        {
                            fieldName: "alt",
                            label: "Altitude (feet)",
                        },
                        {
                            fieldName: "heading",
                            label: "Heading",
                        },
                        {
                            fieldName: "gs",
                            label: "Ground speed",
                        },
                    ],
                },
            ],
        };
        /*************************************************
         * Functions to add and remove Stream Layer
         *************************************************/
        const toggleLayerButton = document.getElementById(
            "toggleStreamLayerButton"
        );
        toggleLayerButton.addEventListener("click", function () {
            if (streamLayer) {
                map.remove(streamLayer);
                streamLayer.destroy();
                streamLayer = null;
                mapElem.graphics.removeAll();
                processDisconnect();
            } else {
                //toggleLayerButton.setAttribute("loading", true);
                addStreamLayer();
            }
        });
        async function addStreamLayer() {
            // URL to stream service
            var svcUrl = document.getElementById("streamUrlText").value;
            // Construct Stream Layer
            const planeSymbol = new WebStyleSymbol({
                name: "Point symbol_18",
                styleUrl:
                    "https://cdn.arcgis.com/sharing/rest/content/items/0d9f00ffc3af4d128ac5771e3dbce440/data",
            });
            // Construct Stream Layer
            streamLayer = new StreamLayer({
                url: svcUrl,
                popupTemplate: template,
                purgeOptions: {
                    displayCount: 10000,
                },
                effect: "drop-shadow(2px, 2px, 6px black)",
                renderer: {
                    type: "simple",
                    symbol: planeSymbol,
                    visualVariables: [
                        {
                            type: "rotation",
                            field: "heading",
                            rotationType: "geographic",
                        },
                        {
                            type: "size",
                            field: "alt",
                            stops: [
                                {
                                    value: 6100,
                                    size: 10,
                                },
                                {
                                    value: 10000,
                                    size: 25,
                                },
                            ],
                        },
                    ],
                },
            });
            mapElem.map.add(streamLayer);
            // When graphics controller created, register listeners for events
            streamLayerView = await view.whenLayerView(streamLayer);
            reactiveUtils.watch(
                () => streamLayerView.connectionStatus,
                () => {
                    if (streamLayerView.connectionStatus === "connected") {
                        processConnect();
                    } else {
                        processDisconnect();
                    }
                }
            );
            streamLayerView.on("update-rate", showUpdateRate);
        }
        /*********************************************************
         * Stream layer event handlers
         *********************************************************/
        let serverUpdateRate, clientUpdateRate;
        const websocketRateSpan = document.getElementById("websocketRate");
        const clientRateSpan = document.getElementById("clientRate");
        function showUpdateRate(event) {
            serverUpdateRate = event.websocket;
            clientUpdateRate = event.client;
            websocketRateSpan.hidden = false;
            clientRateSpan.hidden = false;
            websocketRateSpan.innerHTML =
                "Server rate: " + serverUpdateRate + "ms";
            clientRateSpan.innerHTML =
                "Client processing rate: " + clientUpdateRate + "ms";
        }

        function processConnect() {
            websocketRateSpan.hidden = false;
            clientRateSpan.hidden = false;
            websocketRateSpan.innerHTML = "Server rate: 0ms";
            clientRateSpan.innerHTML = "Client processing rate: 0ms";
            connectionNoticeTitle.innerHTML = "Connected";
            connectionNotice.icon = "activity-monitor";
            connectionNotice.kind = "success";
            toggleLayerButton.removeAttribute("disabled");
            toggleLayerButton.innerText = "Disconnect";
            drawSpatialFilter.removeAttribute("disabled");
            connectionPopover.open = false;
            connectionInvoke.iconStart = "pencil";
            blockAttribute.collapsible = true;
            blockAttribute.description = "";
            blockSpatial.collapsible = true;
            blockSpatial.description = "";
            blockLegend.open = true;
            blockLegend.disabled = false;
            legendEl.hidden = false;
            toggleLayerButton.kind = "danger";
            connectionScrim.hidden = true;
        }

        function processDisconnect() {
            toggleLayerButton.innerText = "Connect";
            toggleLayerButton.kind = "brand";
            drawSpatialFilter.setAttribute("disabled", true);
            clearFilterButton.setAttribute("disabled", true);
            clearFilterButton.setAttribute("icon", "blank");
            clearFilterButton.removeAttribute("text-enabled");
            document.getElementById("websocketRate").innerHTML = "";
            document.getElementById("clientRate").innerHTML = "";
            document.getElementById("websocketRate").hidden = true;
            document.getElementById("clientRate").hidden = true;
            connectionInvoke.iconStart = "plus";
            connectionNotice.icon = "circle";
            connectionNotice.kind = "warning";
            connectionNoticeTitle.innerHTML = "Not connected";
            blockAttribute.open = false;
            blockAttribute.collapsible = false;
            blockAttribute.description = "Add a connection to adjust";
            blockSpatial.open = false;
            blockSpatial.collapsible = false;
            blockSpatial.description = "Add a connection to adjust";
            blockLegend.open = false;
            blockLegend.disabled = true;
            legendEl.hidden = true;
            connectionScrim.hidden = false;
        }
        //////////////////////////////////////////////////////
        //  Filter by altitude
        //////////////////////////////////////////////////////
        const altitudeFilterSelect = document.getElementById(
            "attribute-filter-select"
        );
        altitudeFilterSelect.addEventListener(
            "calciteSelectChange",
            filterChanged
        );
        const clientsideSwitch = document.getElementById("clientside-switch");
        clientsideSwitch.addEventListener(
            "calciteSwitchChange",
            filterChanged
        );

        function filterChanged() {
            let filterValue;
            clearFilterButton.removeAttribute("disabled");
            clearFilterButton.setAttribute("icon", "trash");
            clearFilterButton.setAttribute("text-enabled", true);
            switch (altitudeFilterSelect.value) {
                case "-1":
                    filterValue = null;
                    break;
                case "10000":
                    filterValue = "alt >= 10000";
                    break;
                case "6000":
                    filterValue = "alt >= 6000";
                    break;
                case "3000":
                    filterValue = "alt >= 3000";
                    break;
                case "2999":
                    filterValue = "alt < 3000";
                    break;
            }
            if (clientsideSwitch.checked) {
                streamLayerView.filter = {
                    where: filterValue,
                };
                streamLayer.definitionExpression = null;
            } else {
                streamLayer.definitionExpression = filterValue;
                streamLayerView.filter = null;
            }
        }
        const clearFilterButton =
            document.getElementById("clearFilterButton");
        clearFilterButton.addEventListener("click", function () {
            streamLayerView.filter = null;
            streamLayer.definitionExpression = null;
            clearFilterButton.setAttribute("disabled", true);
            clearFilterButton.setAttribute("icon", "blank");
            clearFilterButton.removeAttribute("text-enabled");
        });
        //////////////////////////////////////////////////////
        //  Feature effect
        //////////////////////////////////////////////////////
        const polygonGraphicsLayer = new GraphicsLayer();
        mapElem.map.add(polygonGraphicsLayer);
        // create a new sketch view model set its layer
        const sketchViewModel = new SketchViewModel({
            view: view,
            layer: polygonGraphicsLayer,
            polygonSymbol: {
                type: "simple-fill",
                style: "none",
                outline: {
                    width: 1,
                    style: "solid",
                    color: "#4FA6D8",
                },
            },
        });
        const drawButton = document.getElementById("drawSpatialFilter");
        // click event for the select by rectangle button
        drawButton.addEventListener("click", () => {
            //mapElem.popup.close();
            polygonGraphicsLayer.removeAll();
            sketchViewModel.create("rectangle");
        });
        document
            .getElementById("clearSpatialFilter")
            .addEventListener("click", () => {
                streamLayerView.featureEffect = null;
                polygonGraphicsLayer.removeAll();
                // Adam note - hide again when user clears
                clearSpatialFilter.setAttribute("disabled", true);
                clearSpatialFilter.setAttribute("icon", "blank");
                clearSpatialFilter.removeAttribute("text-enabled");
                drawSpatialFilter.removeAttribute("disabled");
                blockSpatial.iconStart = "extent";
            });
        // Once user is done drawing a rectangle on the map
        // use the rectangle to select features on the map and table
        sketchViewModel.on("create", async (event) => {
            if (event.state === "complete") {
                // Adam note - only show the clear button when there is a drawn item, disable create button when one present
                clearSpatialFilter.removeAttribute("disabled");
                clearSpatialFilter.setAttribute("icon", "trash");
                clearSpatialFilter.setAttribute("text-enabled", true);
                drawSpatialFilter.setAttribute("disabled", true);
                blockSpatial.iconStart = "extent-filter";
                const featureFilter = {
                    geometry: event.graphic.geometry,
                };
                streamLayerView.featureEffect = {
                    filter: featureFilter,
                    includedEffect: "bloom(1)",
                    excludedEffect: "grayscale(80%) opacity(50%)",
                };
            }
        });
        //////////////////////////////////////////////////////
        //  Handle theme & layout
        //////////////////////////////////////////////////////
        const modeToggle = document.getElementById("toggle-mode");
        const updateDarkMode = () => {
            // Calcite mode
            document.body.classList.toggle("calcite-mode-dark");
            // ArcGIS Maps SDK theme
            const dark = document.querySelector("#arcgis-maps-sdk-theme-dark");
            const light = document.querySelector(
                "#arcgis-maps-sdk-theme-light"
            );
            dark.disabled = !dark.disabled;
            light.disabled = !light.disabled;
            // ArcGIS Maps SDK basemap
            event.target.map.basemap = dark.disabled
                ? "gray-vector"
                : "dark-gray-vector";
        };
        modeToggle.addEventListener("click", updateDarkMode);
    });
    document.querySelector("calcite-shell").hidden = false;
    document.querySelector("calcite-loader").hidden = true;
}
load();