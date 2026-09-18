const [OAuthInfo, identityManager, esriRequest] = await $arcgis.import([
    "@arcgis/core/identity/OAuthInfo.js",
    "@arcgis/core/identity/IdentityManager.js",
    "@arcgis/core/request.js",
]);

const groupId = "4f7c73a26a58490a906dca4fe7a280c3";
const portalUrl = "https://www.arcgis.com";
const oauthInfo = new OAuthInfo({
    appId: "No2Lhym7wqkgUyOG",
    portalUrl,
    popup: false,
});

identityManager.registerOAuthInfos([oauthInfo]);

const navigationLogo = document.querySelector("calcite-navigation-logo");
const navigationUser = document.querySelector("#navigationUser");
const signOutButton = document.querySelector("#signOutButton");
const filterAction = document.querySelector("#filterAction");
const filterSheet = document.querySelector("#filterSheet");
const closeFilterButton = document.querySelector("#closeFilterButton");
const filterRail = document.querySelector("#filterRail");
const mobileFilterMount = document.querySelector("#mobileFilterMount");
const filterControls = document.querySelector("#filterControls");
const searchInput = document.querySelector("#searchInput");
const focusSelect = document.querySelector("#focusSelect");
const sortSelect = document.querySelector("#sortSelect");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const groupTitle = document.querySelector("#groupTitle");
const groupDescription = document.querySelector("#groupDescription");
const groupLink = document.querySelector("#groupLink");
const collectionBanner = document.querySelector("#collectionBanner");
const mapCount = document.querySelector("#mapCount");
const contributorCount = document.querySelector("#contributorCount");
const updatedDate = document.querySelector("#updatedDate");
const resultsCount = document.querySelector("#resultsCount");
const galleryGrid = document.querySelector("#galleryGrid");
const galleryLoader = document.querySelector("#galleryLoader");
const galleryNotice = document.querySelector("#galleryNotice");
const galleryNoticeTitle = galleryNotice.querySelector("calcite-notice-title");
const galleryNoticeMessage = galleryNotice.querySelector("calcite-notice-message");
const mapDialog = document.querySelector("#mapDialog");
const viewerMap = document.querySelector("#viewerMap");
const viewerDescription = document.querySelector("#viewerDescription");
const viewerOwner = document.querySelector("#viewerOwner");
const viewerUpdated = document.querySelector("#viewerUpdated");
const viewerTags = document.querySelector("#viewerTags");
const viewerItemLink = document.querySelector("#viewerItemLink");
const mobileLayout = matchMedia("(max-width: 760px)");
const attributeTagPrefix = "Mapped attribute: ";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
});

let credential;
let galleryItems = [];
const fieldAliasesByServiceUrl = new Map();
const userProfilesByUsername = new Map();

function setNotice(kind, title, message) {
    galleryNotice.kind = kind;
    galleryNotice.icon = kind === "danger" ? "exclamation-mark-triangle" : "information";
    galleryNoticeTitle.textContent = title;
    galleryNoticeMessage.textContent = message;
    galleryNotice.hidden = false;
}

function getThumbnailUrl(item) {
    if (!item.thumbnail) {
        return "";
    }

    const thumbnailPath = item.thumbnail
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
    const url = new URL(`${portalUrl}/sharing/rest/content/items/${item.id}/info/${thumbnailPath}`);
    if (credential?.token) {
        url.searchParams.set("token", credential.token);
    }
    return url.href;
}

function formatDate(timestamp) {
    return timestamp ? dateFormatter.format(new Date(timestamp)) : "Date unavailable";
}

function getFocus(item) {
    const text = `${item.title} ${item.snippet || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    if (/species|threatened|richness|red list|wildlife/.test(text)) {
        return "species";
    }
    if (/population|worldpop|human|urban|people/.test(text)) {
        return "people";
    }
    if (/land|water|forest|crop|habitat|protected|wdpa|ecosystem/.test(text)) {
        return "habitats";
    }
    return "overview";
}

function getFocusLabel(focus) {
    return {
        species: "Species",
        people: "People & pressure",
        habitats: "Land & habitats",
        overview: "Overview",
    }[focus];
}

function createTextElement(tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    return element;
}

function getMappedAttributes(item) {
    return (item.tags || [])
        .filter((tag) => tag.startsWith(attributeTagPrefix))
        .map((tag) => tag.slice(attributeTagPrefix.length));
}

function collectFieldMetadata(layers, aliasesByName, serviceUrls) {
    for (const layer of layers || []) {
        for (const field of layer.layerDefinition?.fields || []) {
            aliasesByName.set(field.name, field.alias || field.name);
        }
        for (const fieldInfo of layer.popupInfo?.fieldInfos || []) {
            aliasesByName.set(fieldInfo.fieldName, fieldInfo.label || fieldInfo.fieldName);
        }
        if (layer.url) {
            serviceUrls.add(layer.url);
        }
        collectFieldMetadata(layer.layers, aliasesByName, serviceUrls);
        collectFieldMetadata(layer.featureCollection?.layers, aliasesByName, serviceUrls);
    }
}

function getServiceFieldAliases(url) {
    if (!fieldAliasesByServiceUrl.has(url)) {
        fieldAliasesByServiceUrl.set(url, esriRequest(url, {
            query: { f: "json" },
        }).then(({ data }) => new Map(
            (data.fields || []).map((field) => [field.name, field.alias || field.name]),
        )));
    }
    return fieldAliasesByServiceUrl.get(url);
}

function getUserProfile(username) {
    if (!userProfilesByUsername.has(username)) {
        userProfilesByUsername.set(username, esriRequest(
            `${portalUrl}/sharing/rest/community/users/${encodeURIComponent(username)}`,
            { query: { f: "json" } },
        ).then(({ data }) => data).catch(() => ({ username })));
    }
    return userProfilesByUsername.get(username);
}

function getUserThumbnailUrl(profile) {
    if (!profile.thumbnail) {
        return "";
    }
    const url = new URL(
        `${portalUrl}/sharing/rest/community/users/${encodeURIComponent(profile.username)}/info/${encodeURIComponent(profile.thumbnail)}`,
    );
    if (credential?.token) {
        url.searchParams.set("token", credential.token);
    }
    return url.href;
}

async function getLegacyMappedAttributes(item) {
    if (!item.title.startsWith("biodiversity-")) {
        return [];
    }

    const fieldNames = item.title.slice("biodiversity-".length).split("-").filter(Boolean);
    try {
        const { data } = await esriRequest(`${portalUrl}/sharing/rest/content/items/${item.id}/data`, {
            query: { f: "json" },
        });
        const aliasesByName = new Map();
        const serviceUrls = new Set();
        collectFieldMetadata([...(data.operationalLayers || []), ...(data.tables || [])], aliasesByName, serviceUrls);
        for (const url of serviceUrls) {
            const serviceAliases = await getServiceFieldAliases(url);
            for (const [fieldName, alias] of serviceAliases) {
                aliasesByName.set(fieldName, alias);
            }
            if (fieldNames.every((fieldName) => aliasesByName.has(fieldName))) {
                break;
            }
        }
        return fieldNames.map((fieldName) => aliasesByName.get(fieldName) || fieldName);
    } catch (error) {
        console.warn(`Could not resolve attribute aliases for ${item.id}.`, error);
        return fieldNames;
    }
}

function getItemDescription(item) {
    if (item.description) {
        return new DOMParser().parseFromString(item.description, "text/html").body.textContent.trim();
    }
    return item.snippet || "Explore a global biodiversity and conservation perspective through this interactive map.";
}

function getMappedDescription(item, mappedAttributes) {
    const itemDescription = getItemDescription(item);
    const includesMappedAttributes = mappedAttributes.every((alias) =>
        itemDescription.toLowerCase().includes(alias.toLowerCase()),
    );
    if (!mappedAttributes.length || includesMappedAttributes) {
        return itemDescription;
    }

    const attributeText = new Intl.ListFormat(undefined, { type: "conjunction" }).format(mappedAttributes);
    return `Maps ${attributeText} across global biodiversity and conservation layers.`;
}

function createMapCard(item) {
    const card = document.createElement("calcite-card");
    card.className = "map-card";
    card.setAttribute("label", item.attributeTitle);

    const thumbnailUrl = getThumbnailUrl(item);
    if (thumbnailUrl) {
        const image = document.createElement("img");
        image.slot = "thumbnail";
        image.className = "map-thumbnail";
        image.src = thumbnailUrl;
        image.alt = `Map preview for ${item.title}`;
        image.loading = "lazy";
        card.append(image);
    } else {
        const fallback = document.createElement("div");
        fallback.slot = "thumbnail";
        fallback.className = "map-thumbnail map-thumbnail-fallback";
        const icon = document.createElement("calcite-icon");
        icon.icon = "map";
        icon.scale = "l";
        fallback.append(icon);
        card.append(fallback);
    }

    const title = createTextElement("span", item.attributeTitle);
    title.slot = "heading";
    card.append(title);

    const details = document.createElement("div");
    details.slot = "description";
    details.className = "map-card-details";
    const author = document.createElement("div");
    author.className = "map-author";
    const avatar = document.createElement("calcite-avatar");
    avatar.scale = "s";
    avatar.fullName = item.author.fullName || item.owner;
    avatar.username = item.owner;
    avatar.thumbnail = getUserThumbnailUrl(item.author);
    avatar.label = `Author: ${avatar.fullName}`;
    const authorText = document.createElement("span");
    authorText.className = "map-author-text";
    authorText.textContent = item.author.fullName || item.owner;
    author.append(avatar, authorText);

    const description = createTextElement(
        "span",
        item.displayDescription,
        "map-summary",
    );
    details.append(author, description);
    card.append(details);

    const chips = document.createElement("div");
    chips.slot = "footer-start";
    chips.className = "map-chips";
    const focusChip = document.createElement("calcite-chip");
    focusChip.scale = "s";
    focusChip.value = item.focus;
    focusChip.textContent = getFocusLabel(item.focus);
    chips.append(focusChip);
    if (item.numViews > 0) {
        const viewsChip = document.createElement("calcite-chip");
        viewsChip.scale = "s";
        viewsChip.icon = "view-visible";
        viewsChip.textContent = `${item.numViews.toLocaleString()} views`;
        chips.append(viewsChip);
    }
    card.append(chips);

    const exploreButton = document.createElement("calcite-button");
    exploreButton.slot = "footer-end";
    exploreButton.appearance = "solid";
    exploreButton.iconEnd = "arrow-right";
    exploreButton.textContent = "Explore";
    exploreButton.addEventListener("click", () => openMap(item));
    card.append(exploreButton);

    return card;
}

function getVisibleItems() {
    const query = searchInput.value.trim().toLowerCase();
    const focus = focusSelect.value;
    const filteredItems = galleryItems.filter((item) => {
        const searchableText = `${item.title} ${item.owner} ${item.author.fullName || ""} ${item.snippet || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
        return (!query || searchableText.includes(query)) && (focus === "all" || item.focus === focus);
    });

    return filteredItems.sort((first, second) => {
        switch (sortSelect.value) {
            case "title":
                return first.title.localeCompare(second.title);
            case "views":
                return second.numViews - first.numViews || second.modified - first.modified;
            case "oldest":
                return first.modified - second.modified;
            case "newest":
            default:
                return second.modified - first.modified;
        }
    });
}

function renderGallery() {
    const visibleItems = getVisibleItems();
    galleryGrid.replaceChildren(...visibleItems.map(createMapCard));
    resultsCount.textContent = `${visibleItems.length} of ${galleryItems.length} maps`;
    galleryNotice.hidden = visibleItems.length > 0;

    if (!visibleItems.length) {
        setNotice("info", "No maps found", "Try another keyword or conservation focus.");
    }
}

function updateCollection(group) {
    groupTitle.textContent = group.title;
    groupDescription.textContent = group.snippet || "Explore maps that reveal biodiversity patterns, conservation priorities, and human pressures around the world.";
    groupLink.href = `${portalUrl}/home/group.html?id=${group.id}`;
    mapCount.textContent = `${galleryItems.length} maps`;
    contributorCount.textContent = `${new Set(galleryItems.map((item) => item.owner)).size} contributors`;
    updatedDate.textContent = `Updated ${formatDate(Math.max(...galleryItems.map((item) => item.modified)))}`;

    const featuredItem = galleryItems.find((item) => item.thumbnail);
    const featuredImage = featuredItem && getThumbnailUrl(featuredItem);
    if (featuredImage) {
        collectionBanner.style.setProperty("--collection-image", `url("${featuredImage}")`);
    }
}

async function queryAllMaps() {
    const items = [];
    let start = 1;

    do {
        const { data } = await esriRequest(`${portalUrl}/sharing/rest/search`, {
            query: {
                f: "json",
                q: `group:${groupId} AND type:"Web Map"`,
                num: 100,
                start,
                sortField: "modified",
                sortOrder: "desc",
            },
        });
        items.push(...data.results);
        start = data.nextStart;
    } while (start > 0);

    return items;
}

async function openMap(item) {
    mapDialog.heading = item.title;
    viewerDescription.textContent = item.displayDescription;
    viewerOwner.textContent = item.author.fullName
        ? `${item.author.fullName} (@${item.owner})`
        : item.owner;
    viewerUpdated.textContent = formatDate(item.modified);
    viewerTags.replaceChildren();

    const tags = item.tags?.length ? item.tags.slice(0, 5) : [getFocusLabel(item.focus)];
    for (const tag of tags) {
        const chip = document.createElement("calcite-chip");
        chip.scale = "s";
        chip.textContent = tag;
        viewerTags.append(chip);
    }

    viewerItemLink.href = `${portalUrl}/home/item.html?id=${item.id}`;
    viewerMap.itemId = item.id;
    mapDialog.open = true;
}

function clearFilters() {
    searchInput.value = "";
    focusSelect.value = "all";
    sortSelect.value = "newest";
    renderGallery();
}

function updateResponsiveLayout(event = mobileLayout) {
    const isMobile = event.matches;
    navigationLogo.heading = isMobile ? "Biodiversity Atlas" : "Living Biodiversity Atlas";
    navigationLogo.description = isMobile ? "" : "Global conservation map gallery";
    navigationUser.textDisabled = isMobile;
    filterAction.hidden = !isMobile;

    if (isMobile) {
        mobileFilterMount.append(filterControls);
    } else {
        filterSheet.open = false;
        filterRail.append(filterControls);
    }
}

async function initialize() {
    try {
        credential = await identityManager.getCredential(`${portalUrl}/sharing`);
        navigationUser.username = credential.userId;
        navigationUser.userId = credential.userId;
        navigationUser.hidden = false;
        signOutButton.hidden = false;

        const [{ data: group }, items] = await Promise.all([
            esriRequest(`${portalUrl}/sharing/rest/community/groups/${groupId}`, {
                query: { f: "json" },
            }),
            queryAllMaps(),
        ]);

        galleryItems = await Promise.all(items.map(async (item) => {
            const author = await getUserProfile(item.owner);
            const savedAttributes = getMappedAttributes(item);
            const mappedAttributes = savedAttributes.length
                ? savedAttributes
                : await getLegacyMappedAttributes(item);
            return {
                ...item,
                author,
                attributeTitle: mappedAttributes.join(" + ") || item.title,
                displayDescription: getMappedDescription(item, mappedAttributes),
                focus: getFocus(item),
            };
        }));
        const portalUser = group.owner === credential.userId
            ? await esriRequest(`${portalUrl}/sharing/rest/community/users/${encodeURIComponent(credential.userId)}`, {
                query: { f: "json" },
            }).then(({ data }) => data)
            : null;
        navigationUser.fullName = portalUser?.fullName || credential.userId;

        updateCollection(group);
        renderGallery();
        galleryLoader.hidden = true;
    } catch (error) {
        console.error(error);
        galleryLoader.hidden = true;
        setNotice("danger", "Gallery could not be loaded", error.message);
    }
}

searchInput.addEventListener("calciteInputTextInput", renderGallery);
searchInput.addEventListener("input", renderGallery);
focusSelect.addEventListener("calciteSelectChange", renderGallery);
sortSelect.addEventListener("calciteSelectChange", renderGallery);
clearFiltersButton.addEventListener("click", clearFilters);
filterAction.addEventListener("click", () => {
    filterSheet.open = true;
});
closeFilterButton.addEventListener("click", () => {
    filterSheet.open = false;
});
mobileLayout.addEventListener("change", updateResponsiveLayout);
signOutButton.addEventListener("click", () => {
    identityManager.destroyCredentials();
    location.reload();
});

updateResponsiveLayout();
initialize();
