const mapEl = document.querySelector("arcgis-map");
const panelBottom = document.getElementById("panel-bottom");
const statusChip = document.getElementById("status-chip");
const statusChipLabel = statusChip ? statusChip.textContent.trim() : "";
const statusTooltip = document.getElementById("status-tooltip");
const sheetToggleEl = document.getElementById("sheet-toggle");
const sheetEl = document.getElementById("sheet");
const tabTitleEls = document.querySelectorAll("#shell-panel-bottom calcite-tab-title, #dialog calcite-tab-title");
const tabsEls = document.querySelectorAll("#shell-panel-bottom calcite-tabs, #dialog calcite-tabs");
const listItemEls = document.querySelectorAll("#sheet calcite-list-item");

const shellPanelBottom = document.getElementById("shell-panel-bottom");
const dialogEl = document.getElementById("dialog");
const popOutAction = document.getElementById("pop-out");
const dockAction = document.getElementById("dock");

const BREAKPOINT_SMALL = 800;

function init() {
    sheetToggleEl.addEventListener("click", () => handleSheetOpen());

    listItemEls.forEach((el) => {
        el.addEventListener("calciteListItemSelect", (event) => handleListSelect(event));
    });

    tabsEls.forEach((el) => {
        el.addEventListener("calciteTabsActivate", (event) => handleTabSelect(event));
    });

    if (popOutAction && dockAction && shellPanelBottom && dialogEl) {
        popOutAction.addEventListener("click", () => {
            const isSmall = window.innerWidth <= BREAKPOINT_SMALL;
            if (isSmall) {
                return;
            }
            shellPanelBottom.hidden = true;
            dialogEl.open = true;
        });

        dockAction.addEventListener("click", () => {
            dialogEl.open = false;
            shellPanelBottom.hidden = false;
            popOutAction.setFocus();
        });
    }

    // Observe shell panel size changes as an extra trigger for responsive layout.
    if (window.ResizeObserver && shellPanelBottom) {
        const ro = new ResizeObserver(() => handleResponsiveLayout());
        ro.observe(shellPanelBottom);
    }

    window.addEventListener("resize", handleResponsiveLayout);
    handleResponsiveLayout();
}

function handleSheetOpen() {
    sheetEl.open = true;
    panelBottom.collapsed = false;
}

function handleListSelect(event) {
    const selectedItem = event.target;
    const value = selectedItem.getAttribute("value");
    if (!value) {
        return;
    }
    sheetEl.open = false;

    listItemEls.forEach((item) => {
        item.selected = item === selectedItem;
    });

    tabTitleEls.forEach((tabTitle) => {
        tabTitle.selected = tabTitle.getAttribute("value") === value;
    });
}

function handleTabSelect(event) {
    const tabs = event.currentTarget;
    const selectedTitle = tabs.querySelector("calcite-tab-title[selected]");
    const value = selectedTitle ? selectedTitle.getAttribute("value") : null;
    if (!value) {
        return;
    }
    sheetEl.open = false;

    tabTitleEls.forEach((tabTitle) => {
        tabTitle.selected = tabTitle.getAttribute("value") === value;
    });

    listItemEls.forEach((item) => {
        item.selected = item.getAttribute("value") === value;
    });
}

function handleResponsiveLayout() {
    if (!shellPanelBottom || !dialogEl) {
        return;
    }

    const isSmall = window.innerWidth <= BREAKPOINT_SMALL;

    if (isSmall) {
        shellPanelBottom.hidden = false;
        dialogEl.open = false;
        if (popOutAction) {
            popOutAction.hidden = true;
        }
        if (statusChip) {
            statusChip.textContent = "";
            statusChip.setAttribute("interactive", "");
        }
        if (statusTooltip) {
            statusTooltip.hidden = false;
            statusTooltip.setAttribute("reference-element", "status-chip");
        }
    } else {
        if (dialogEl.open) {
            shellPanelBottom.hidden = true;
        } else {
            shellPanelBottom.hidden = false;
        }
        if (popOutAction) {
            popOutAction.hidden = false;
        }
        if (statusChip) {
            statusChip.textContent = statusChipLabel;
            statusChip.removeAttribute("interactive");
        }
        if (statusTooltip) {
            statusTooltip.hidden = true;
            statusTooltip.removeAttribute("reference-element");
        }
    }
}

init();