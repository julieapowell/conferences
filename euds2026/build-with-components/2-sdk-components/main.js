const mapElement = document.querySelector("arcgis-map");
const navigationUser = document.getElementById("navigation-user");
const sharedTabs = document.getElementById("shared-tabs");
const shellPanelBottom = document.getElementById("shell-panel-bottom");
const dialogEl = document.getElementById("dialog");
const panelTabsHost = document.getElementById("panel-tabs-host");
const dialogTabsHost = document.getElementById("dialog-tabs-host");
const popOutAction = document.getElementById("pop-out");
const dockAction = document.getElementById("dock");

const BREAKPOINT_SMALL = 800;

async function populateNavigationUser(portal) {
    if (!navigationUser || !portal) {
        return;
    }

    await portal.load();
    const user = portal.user;
    if (!user) {
        return;
    }

    navigationUser.fullName = user.fullName || user.username;
    navigationUser.username = user.username;
    navigationUser.userId = user.username;
    navigationUser.hidden = false;
}

function moveTabsTo(host) {
    if (host && sharedTabs.parentElement !== host) {
        host.prepend(sharedTabs);
    }
}

function openDataExplorerDialog() {
    const refreshLayout = sharedTabs.parentElement !== dialogTabsHost && dialogEl.open;
    moveTabsTo(dialogTabsHost);

    if (refreshLayout) {
        dialogEl.open = false;
        setTimeout(() => {
            dialogEl.open = true;
        }, 0);
        return;
    }

    dialogEl.open = true;
}

function init() {
    if (popOutAction && dockAction && shellPanelBottom && dialogEl) {
        popOutAction.addEventListener("click", () => {
            const isSmall = window.innerWidth <= BREAKPOINT_SMALL;
            if (isSmall) {
                return;
            }
            shellPanelBottom.hidden = true;
            openDataExplorerDialog();
        });

        dockAction.addEventListener("click", () => {
            dialogEl.open = false;
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
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

function handleResponsiveLayout() {
    if (!shellPanelBottom || !dialogEl) {
        return;
    }

    const isSmall = window.innerWidth <= BREAKPOINT_SMALL;

    if (isSmall) {
        shellPanelBottom.hidden = false;
        dialogEl.open = false;
        moveTabsTo(panelTabsHost);
        if (popOutAction) {
            popOutAction.hidden = true;
        }
    } else {
        if (dialogEl.open || dialogEl.hasAttribute("open")) {
            shellPanelBottom.hidden = true;
            openDataExplorerDialog();
        } else {
            shellPanelBottom.hidden = false;
            moveTabsTo(panelTabsHost);
        }
        if (popOutAction) {
            popOutAction.hidden = false;
        }
    }
}

init();
mapElement.viewOnReady()
    .then(() => populateNavigationUser(mapElement.map?.portalItem?.portal))
    .catch((error) => console.warn("Unable to display the signed-in user", error));