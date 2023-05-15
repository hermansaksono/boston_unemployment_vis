const CITY_CENTER = [42.3513369, -71.137140];
const UNEMPLOYMENT_LEVEL_CATEGORIES = [4, 8, 14, 19, 29];
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Harbor Islands"];
const EXCLUDED_NEIGHBORHOOD_LABELS = ["Bay Village", "Leather District", "Chinatown", "Waterfront",
                                      "West End"];
const COLOR_MAPPINGS = {
    colorLevel0: "#f9fbe7",
    colorLevel1: "#fff59d",
    colorLevel2: "#ffb74d",
    colorLevel3: "#ef5350",
    colorLevel4: "#d81b60",
    colorLevel5: "#7b1fa2",
};
const MOE_THRESHOLD = 20;
const IS_SHOW_ABOUT_BOX = "isShowAboutBox";

let map;
let tractsDataLayer;
let neighborhoodsDataLayer;
let cityTractShapes = {};
let neighborhoodShapes = {};
let cityTractWorkforceData = {};
let unemploymentData = null;
let activeTractId = undefined;
let mapInfobox;
let aboutBox;

function initMap() {
    mapInfobox = document.getElementById("mapInfoBox");
    aboutBox = document.getElementById("aboutBoxContainer");

    loadMapData();
    initializeAboutBox();
    initializeEventListeners();
}

function loadMapData() {
    const bostonNeighborhoodsData = "static/maps/boston_neighborhoods.geojson";
    const bostonCensusTractsData = "static/maps/boston_census_tracts_2020.geojson";
    const countySubdivisions = "static/maps/ma_county_subdivisions.geojson";
    const mapDataUriList = [bostonNeighborhoodsData, bostonCensusTractsData, countySubdivisions];

    const latlng = new google.maps.LatLng(CITY_CENTER[0], CITY_CENTER[1]);
    const myOptions = {
        zoom: 12, center: latlng, disableDefaultUI: true,
    };
    map = new google.maps.Map(document.getElementById("map"), myOptions);

    Promise.all(mapDataUriList)
        .then((values) => {
            cityTractShapes = drawCensusTracts(values[1]);
            neighborhoodShapes = drawNeighborhoods(values[0]);
            return loadWorkforceData("static/json2020/unemployment-all-black.json");
        })
        .then((data) => {
            cityTractWorkforceData = data;
            unemploymentData = data.data;
            colorizeWorkforceMap();
        })
        .catch((error) => {
            console.error("Error loading map data:", error);
        });
}

function drawCensusTracts(GeoJsonUrl) {
    tractsDataLayer = new google.maps.Data({map: map});
    tractsDataLayer.loadGeoJson(GeoJsonUrl);

    tractsDataLayer.addListener("mouseover", setHighlightTractAsHover);
    tractsDataLayer.addListener("mouseout", setHighlightTractAsDefault);
    tractsDataLayer.addListener("click", onTractClicked);

    tractsDataLayer.addListener("addfeature", (event) => {
        const tractFeature = event.feature;
        const tractId = getTractId(tractFeature);

        if (!EXCLUDED_TRACTS.includes(tractId)) {
            cityTractShapes[tractId] = drawTract(tractsDataLayer, tractFeature);
        }
    });

    return cityTractShapes;
}

function drawTract(tractsDataLayer, tractFeature) {
    tractsDataLayer.overrideStyle(tractFeature, {
        fillColor: "#ffffff", fillOpacity: 0.0, strokeWeight: 0.4, strokeColor: "#cb3e3e",
    });
    return tractFeature;
}

function getTractId(tractFeature) {
    return tractFeature.getProperty("GEOID20");
}

function drawNeighborhoods(GeoJsonUrl) {
    neighborhoodsDataLayer = new google.maps.Data({map: map});
    neighborhoodsDataLayer.loadGeoJson(GeoJsonUrl);
    const neighborhoodShapes = {};

    neighborhoodsDataLayer.addListener("addfeature", (event) => {
        const neighborhoodFeature = event.feature;
        const neighborhoodName = getNeighborhoodName(neighborhoodFeature);

        if (!EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
            neighborhoodShapes[neighborhoodName] =
                drawNeighborhoodBorders(neighborhoodFeature, neighborhoodName);
        }
    });

    return neighborhoodShapes;
}

function getNeighborhoodName(neighborhoodFeature) {
    return neighborhoodFeature.getProperty("Name");
}

function drawNeighborhoodBorders(neighborhoodFeature, neighborhoodName) {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        console.log(neighborhoodName);
    } else {
        neighborhoodsDataLayer.overrideStyle(neighborhoodFeature, {
            fillColor: "#ffffff",
            fillOpacity: 0.0,
            strokeWeight: 1.5,
            strokeColor: "#4589ff",
            clickable: false,
        });
    }
    return neighborhoodFeature;
}

function loadWorkforceData(dataUri) {
    return fetch(dataUri)
        .then((response) => response.json())
        .catch((error) => {
            console.error("Error loading workforce data:", error);
        });
}

function colorizeWorkforceMap() {
    tractsDataLayer.setStyle((feature) => {
        const geoid20 = feature.getProperty("GEOID20");
        const unemployment = unemploymentData[geoid20]?.unemployment_percent || 0;
        const level = getUnemploymentLevelId(unemployment);

        return {
            fillColor: getLevelColor(level),
            fillOpacity: 0.4,
            strokeWeight: 1,
            strokeColor: "#989393",
        };
    });
}

function getUnemploymentLevelId(unemploymentPercent) {
    let level = 0;
    for (const levelValue of UNEMPLOYMENT_LEVEL_CATEGORIES) {
        if (unemploymentPercent <= levelValue) {
            break;
        } else {
            level++;
        }
    }
    return level;
}

function getLevelColor(level) {
    return COLOR_MAPPINGS[`colorLevel${level}`] || "#ffffff";
}

function initializeAboutBox() {
    const isAboutBoxSet = window.localStorage.getItem(IS_SHOW_ABOUT_BOX) != null;
    const isVisible = isAboutBoxSet ? window.localStorage.getItem(IS_SHOW_ABOUT_BOX) !== "false"
                                    : true;

    setAboutBoxVisible(isVisible);
    window.localStorage.setItem(IS_SHOW_ABOUT_BOX, isVisible.toString());
}

function toggleAboutBox() {
    const isVisible = !isAboutBoxVisible();
    setAboutBoxVisible(isVisible);
    window.localStorage.setItem(IS_SHOW_ABOUT_BOX, isVisible.toString());
}

function isAboutBoxVisible() {
    if (isAboutBoxSet()) {
        return window.localStorage.getItem(IS_SHOW_ABOUT_BOX) !== "false";
    } else {
        return false;
    }
}

function setAboutBoxVisible(isVisible) {
    aboutBox.style.display = isVisible ? "block" : "none";
}

function isAboutBoxSet() {
    return window.localStorage.getItem(IS_SHOW_ABOUT_BOX) != null;
}

function initializeEventListeners() {
    document.getElementById("whatIsThisButton").addEventListener("click", toggleAboutBox);
    document.getElementById("aboutCloseButton").addEventListener("click", toggleAboutBox);
    document.getElementById("buttonRefreshView").addEventListener("click", onRefreshButtonClicked);
    document.getElementById("selectDataType").addEventListener("change", onDataFilterChanged);
    document.getElementById("selectGender").addEventListener("change", onDataFilterChanged);
    document.getElementById("selectRacialGroup").addEventListener("change", onDataFilterChanged);
}

function onRefreshButtonClicked() {
    const dataType = document.getElementById("selectDataType").value;
    const gender = document.getElementById("selectGender").value;
    const race = document.getElementById("selectRacialGroup").value;
    const pathString = `static/json2020/${dataType}-${gender}-${race}.json`;

    loadWorkforceData(pathString)
        .then((data) => {
            cityTractWorkforceData = data;
            unemploymentData = data.data;
            colorizeWorkforceMap();
        })
        .catch((error) => {
            console.error("Error loading workforce data:", error);
        });

    if (activeTractId !== undefined)
        refreshInfoBoxData(activeTractId);
    document.getElementById("buttonRefreshView").disabled = true;
}

function onDataFilterChanged() {
    document.getElementById("buttonRefreshView").disabled = false;
}

function onTractClicked(event) {
    const tractId = event.feature.getProperty("GEOID20");

    if (activeTractId === undefined) {
        activeTractId = tractId;
        setTractAsActive(tractId);
        showInfoBox(tractId);
        hideGuideText();
    } else {
        if (activeTractId === tractId) {
            activeTractId = undefined;
            setTractAsNotActive(tractId);
            hideInfoBox(tractId);
            showGuideText();
        } else {
            setTractAsNotActive(activeTractId);
            setTractAsActive(tractId);
            activeTractId = tractId;
            showInfoBox(tractId);
            hideGuideText();
        }
    }
}

function showInfoBox(tractId) {
    refreshInfoBoxData(tractId);
    mapInfobox.className = "mapInfoBox visible";
}

function hideInfoBox() {
    mapInfobox.className = "mapInfoBox hidden";
}

function refreshInfoBoxData(tractId) {
    const tractData = cityTractWorkforceData.data[tractId];

    if (tractData === undefined) {
        document.getElementById("infoBoxUnemploymentPercent").textContent = "Missing data";
        document.getElementById("infoBoxMoePercent").textContent = "Missing data";
        document.getElementById("infoBoxNumberOfSamples").textContent = "Missing data";
        document.getElementById("infoBoxTotalSamples").textContent = "Missing data";
        document.getElementById("infoBoxTractId").textContent = tractId;
    } else {
        const unemploymentPercent = tractData.unemployment_percent;
        const marginOfError = tractData.margin_of_error_percent;
        const numSamples = tractData.unemployment_number;
        const totalSamples = tractData.total_samples;

        document.getElementById("infoBoxUnemploymentPercent").textContent =
            unemploymentPercent.toFixed(2) + "%";
        document.getElementById("infoBoxMoePercent").textContent = marginOfError.toFixed(2) + "%";
        document.getElementById("infoBoxNumberOfSamples").textContent = numSamples;
        document.getElementById("infoBoxTotalSamples").textContent = totalSamples;
        document.getElementById("infoBoxTractId").textContent = tractId;

        const infoBoxMoePercentRow = document.getElementById("infoBoxMoePercentRow");
        if (marginOfError > MOE_THRESHOLD) {
            infoBoxMoePercentRow.classList.add("highMoE");
        } else {
            infoBoxMoePercentRow.classList.remove("highMoE");
        }
    }
}

function setTractAsActive(tractId) {
    const tractHoverShape = tractsDataLayer.getFeatureById(tractId);
    setHighlightTractAsActive(tractHoverShape);
}

function setTractAsNotActive(tractId) {
    const tractHoverShape = tractsDataLayer.getFeatureById(tractId);
    setHighlightTractAsNotActive(tractHoverShape);
}

function hideGuideText() {
    document.getElementById("mapGuideText").classList.add("hidden");
}

function showGuideText() {
    document.getElementById("mapGuideText").classList.remove("hidden");
}

function setHighlightTractAsHover(event) {
    tractsDataLayer.overrideStyle(event.feature, {
        fillOpacity: 1,
        // strokeWeight: 2, strokeColor: "#00ff15",
    });
}

function setHighlightTractAsDefault(event) {
    tractsDataLayer.revertStyle();
}

function setHighlightTractAsActive(tractShape) {
    tractsDataLayer.overrideStyle(tractShape, {
        strokeWeight: 2, strokeColor: "#00ff15",
    });
}

function setHighlightTractAsNotActive(tractShape) {
    tractsDataLayer.revertStyle();
}

window.initMap = initMap;