/**
 * Constants related to the map and data categories
 * @constant {Array} CITY_CENTER - Latitude and Longitude of the city center
 * @constant {Array} UNEMPLOYMENT_LEVEL_CATEGORIES - Categories for different levels of unemployment
 * @constant {Array} EXCLUDED_TRACTS - Census tracts to be excluded
 * @constant {Array} EXCLUDED_NEIGHBORHOODS - Neighborhoods to be excluded
 * @constant {Array} EXCLUDED_NEIGHBORHOOD_LABELS - Neighborhood labels to be excluded
 */
const CITY_CENTER = [42.33, -71.1];
const UNEMPLOYMENT_LEVEL_CATEGORIES = [4, 8, 14, 19, 29];
const EXCLUDED_TRACTS = ['25025990101', '25025980101', '25025981501'];
// const EXCLUDED_NEIGHBORHOODS = ['Harbor Islands'];
const EXCLUDED_NEIGHBORHOODS = ['Harbor Islands'];
const EXCLUDED_NEIGHBORHOOD_LABELS = ['Bay Village', 'Leather District', 'Chinatown', 'Waterfront',
                                      'West End'];

/**
 * Constant for color mapping associated with different levels of unemployment
 * @constant {Object} COLOR_MAPPINGS - Mapping of colors for different levels of unemployment
 */
const COLOR_MAPPINGS = {
    colorLevel0: '#f9fbe7',
    colorLevel1: '#fff59d',
    colorLevel2: '#ffb74d',
    colorLevel3: '#ef5350',
    colorLevel4: '#d81b60',
    colorLevel5: '#7b1fa2',
};

/**
 * Constants for other configurations
 * @constant {number} MOE_THRESHOLD - Threshold for Margin of Error
 * @constant {string} IS_SHOW_ABOUT_BOX - Local storage key to determine if about box should be shown
 */
const MOE_THRESHOLD = 20;
const IS_SHOW_ABOUT_BOX = 'isShowAboutBox';

/**
 * Variables to hold various map layers, data, and UI components
 * @property {google.maps.Map} map - The Google Maps object
 * @property {Object} tractsDataLayer - The data layer for the census tracts
 * @property {Object} tractsDataLayer - The data layer for the census tracts hover events
 * @property {Object} neighborhoodsDataLayer - The data layer for the neighborhoods
 * @property {Object} cityTractShapes - The shapes of the census tracts
 * @property {Object} cityTractHoverShapes - The shapes of the census tracts hover events
 * @property {Object} neighborhoodShapes - The shapes of the neighborhoods
 * @property {Object} cityTractWorkforceData - The workforce data for the city's census tracts
 * @property {Object} unemploymentData - The unemployment data for the city's census tracts
 * @property {string} activeTractId - The ID of the currently active census tract
 * @property {Object} mapInfobox - The infobox UI component
 * @property {Object} aboutBox - The about box UI component
 */
let map;
let tractsDataLayer;
let tractsHoverDataLayer;
let neighborhoodsDataLayer;
let cityTractShapes = {};
let cityTractHoverShapes = {};
let neighborhoodShapes = {};
let cityTractWorkforceData = {};
let unemploymentData = null;
let activeTractId = undefined;
let mapInfobox;
let aboutBox;

/**
 * Initializes the map, loads map data, initializes about box and event listeners
 */
function initMap() {
    mapInfobox = document.getElementById('mapInfoBox');
    aboutBox = document.getElementById('aboutBoxContainer');

    loadMapData();
    initializeAboutBox();
    initializeEventListeners();
}

/**
 * Loads the map data from geojson files and draws the neighborhoods and census tracts on the map
 */
function loadMapData() {
    const bostonNeighborhoodsData = 'static/maps/boston_neighborhoods.geojson';
    const bostonCensusTractsData = 'static/maps/boston_census_tracts_2020.geojson';
    const countySubdivisions = 'static/maps/ma_county_subdivisions.geojson';
    const mapDataUriList = [bostonNeighborhoodsData, bostonCensusTractsData, countySubdivisions];

    const latlng = new google.maps.LatLng(CITY_CENTER[0], CITY_CENTER[1]);
    const myOptions = {
        zoom: 12, center: latlng, disableDefaultUI: true, zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },
    };
    map = new google.maps.Map(document.getElementById('map'), myOptions);

    Promise.all(mapDataUriList)
        .then((values) => {
            drawCensusTracts(values[1]);
            neighborhoodShapes = drawNeighborhoods(values[0]);
            drawCensusHoverTracts(values[1]);
            return true;
        })
        .then(() => {
            onRefreshButtonClicked();
        })
        .catch((error) => {
            console.error('Error loading map data:', error);
        });
}

/**
 * Draws the census tracts on the map
 * @param {string} GeoJsonUrl - URL for the GeoJSON data of census tracts
 * @returns {Promise} Promise object represents the completion of drawing census tracts
 */
function drawCensusTracts(GeoJsonUrl) {
    return new Promise((resolve) => {
        tractsDataLayer = new google.maps.Data({map: map});
        tractsDataLayer.loadGeoJson(GeoJsonUrl, {}, (features) => {
            features.forEach((tractFeature) => {
                const tractId = getTractId(tractFeature);
                if (!EXCLUDED_TRACTS.includes(tractId)) {
                    cityTractShapes[tractId] = tractFeature;
                }
            });
        });
    });
}

/**
 * Draws the census hover tracts on the map
 * @param {string} GeoJsonUrl - URL for the GeoJSON data of census tracts
 * @returns {Promise} Promise object represents the completion of drawing census tracts
 */
function drawCensusHoverTracts(GeoJsonUrl) {
    return new Promise((resolve) => {
        tractsHoverDataLayer = new google.maps.Data({map: map});
        tractsHoverDataLayer.loadGeoJson(GeoJsonUrl, {}, (features) => {
            tractsHoverDataLayer.addListener('mouseover', (event) => {
                highlightTract(event.feature, 2);
            });
            tractsHoverDataLayer.addListener('mouseout', setHighlightTractAsDefault);
            tractsHoverDataLayer.addListener('click', onTractClicked);

            tractsHoverDataLayer.setStyle((feature) => {
              return {
                  fillOpacity: 0.0,
                  strokeWeight: 0.4,
                  strokeOpacity: 1.0,
                  strokeColor: '#4d4b4b',
                  zIndex: 10,
                };
            });

            features.forEach((tractFeature) => {
                const tractId = getTractId(tractFeature);
                if (EXCLUDED_TRACTS.includes(tractId)) {
                    cityTractHoverShapes[tractId] = tractFeature;
                    tractsHoverDataLayer.overrideStyle(tractFeature, {
                      fillOpacity: 0.0,
                      strokeWeight: 0.0,
                    });
                }
            });

            resolve();
        });
    });
}

/**
 * Gets the tract ID from a tract feature
 * @param {Object} tractFeature - Feature object containing tract data
 * @returns {string} Tract ID
 */
function getTractId(tractFeature) {
    return tractFeature.getProperty('GEOID20');
}

/**
 * Draws the neighborhoods on the map
 * @param {string} GeoJsonUrl - URL for the GeoJSON data of neighborhoods
 * @returns {Object} Object containing neighborhood shapes
 */
function drawNeighborhoods(GeoJsonUrl) {
    neighborhoodsDataLayer = new google.maps.Data({map: map});
    neighborhoodsDataLayer.loadGeoJson(GeoJsonUrl);
    const neighborhoodShapes = {};

    neighborhoodsDataLayer.addListener('addfeature', (event) => {
        const neighborhoodFeature = event.feature;
        const neighborhoodName = getNeighborhoodName(neighborhoodFeature);

        neighborhoodShapes[neighborhoodName] =
          drawNeighborhoodBorders(neighborhoodFeature, neighborhoodName);
    });

    return neighborhoodShapes;
}

/**
 * Gets the neighborhood name from a neighborhood feature
 * @param {Object} neighborhoodFeature - The feature object of the neighborhood
 * @returns {string} The name of the neighborhood
 */
function getNeighborhoodName(neighborhoodFeature) {
    return neighborhoodFeature.getProperty('Name');
}

/**
 * Styles the neighborhood polygons on the map
 * @param {google.maps.Data.Feature} neighborhoodFeature - The feature object of the neighborhood
 * @param {string} neighborhoodName - The name of the neighborhood
 * @returns {Object} The styled neighborhood feature
 */
function drawNeighborhoodBorders(neighborhoodFeature, neighborhoodName) {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        neighborhoodsDataLayer.overrideStyle(neighborhoodFeature, {
            fillOpacity: 0.0,
            strokeWeight: 0.0,
            clickable: false,
        });
    } else {
        neighborhoodsDataLayer.overrideStyle(neighborhoodFeature, {
            fillColor: '#ffffff',
            fillOpacity: 0.0,
            strokeWeight: 1.5,
            strokeColor: '#4589ff',
            clickable: false,
        });
    }
    return neighborhoodFeature;
}

/**
 * Loads the workforce data from a given URL
 * @param {string} dataUri - The URL of the workforce data
 * @returns {Promise} A promise that resolves with the loaded data
 */
function loadWorkforceData(dataUri) {
    return fetch(dataUri)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error loading workforce data:', error);
        });
}

/**
 * Colors the map according to the unemployment data
 */
function colorizeWorkforceMap() {
    tractsDataLayer.setStyle((feature) => {
        const geoid20 = feature.getProperty('GEOID20');
        const unemployment = unemploymentData[geoid20]?.unemployment_percent || 0;
        const level = getUnemploymentLevelId(unemployment);

        return {
            fillColor: getColorForLevel(level),
            fillOpacity: 0.4,
            strokeWeight: 0.0,
            strokeOpacity: 0.0,
            //strokeColor: '#4d4b4b',
            clickable: false,
        };
    });
}

/**
 * Determines the unemployment level ID based on the given unemployment percent
 * @param {number} unemploymentPercent - The unemployment percentage
 * @returns {number} The unemployment level ID
 */
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

/**
 * Gets the color for a given level
 * @param {number} level - The level of unemployment
 * @returns {string} The color associated with the level
 */
function getColorForLevel(level) {
    return COLOR_MAPPINGS[`colorLevel${level}`] || '#ffffff';
}

/**
 * Initializes the about box visibility based on local storage settings
 */
function initializeAboutBox() {
    const isAboutBoxSet = window.localStorage.getItem(IS_SHOW_ABOUT_BOX) != null;
    const isVisible = isAboutBoxSet ? window.localStorage.getItem(IS_SHOW_ABOUT_BOX) !== 'false'
                                    : true;

    setAboutBoxVisible(isVisible);
    window.localStorage.setItem(IS_SHOW_ABOUT_BOX, isVisible.toString());
}

/**
 * Toggles the visibility of the about box and updates the local storage settings
 */
function toggleAboutBox() {
    const isVisible = !isAboutBoxVisible();
    setAboutBoxVisible(isVisible);
    window.localStorage.setItem(IS_SHOW_ABOUT_BOX, isVisible.toString());
}

/**
 * Checks if the about box is currently visible
 * @returns {boolean} True if the about box is visible, false otherwise
 */
function isAboutBoxVisible() {
    if (isAboutBoxSet()) {
        return window.localStorage.getItem(IS_SHOW_ABOUT_BOX) !== 'false';
    } else {
        return false;
    }
}

/**
 * Sets the visibility of the about box and updates the local storage settings
 * @param {boolean} isVisible - The visibility state of the about box
 */
function setAboutBoxVisible(isVisible) {
    aboutBox.style.display = isVisible ? 'block' : 'none';
}

/**
 * Checks if the about box is set in the local storage
 * @returns {boolean} True if the about box is set, false otherwise
 */
function isAboutBoxSet() {
    return window.localStorage.getItem(IS_SHOW_ABOUT_BOX) != null;
}

/**
 * Initializes event listeners for various UI components
 */
function initializeEventListeners() {
    document.getElementById('whatIsThisButton').addEventListener('click', toggleAboutBox);
    document.getElementById('aboutCloseButton').addEventListener('click', toggleAboutBox);
    document.getElementById('buttonRefreshView').addEventListener('click', onRefreshButtonClicked);
    document.getElementById('selectDataType').addEventListener('change', onDataFilterChanged);
    document.getElementById('selectGender').addEventListener('change', onDataFilterChanged);
    document.getElementById('selectRacialGroup').addEventListener('change', onDataFilterChanged);
}

/**
 * Handles the click event when the refresh button is clicked
 */
function onRefreshButtonClicked() {
    const dataType = document.getElementById('selectDataType').value;
    const gender = document.getElementById('selectGender').value;
    const race = document.getElementById('selectRacialGroup').value;
    const pathString = `static/json2020/${dataType}-${gender}-${race}.json`;

    loadWorkforceData(pathString)
        .then((data) => {
            cityTractWorkforceData = data;
            unemploymentData = data.data;
            colorizeWorkforceMap();
            if (activeTractId !== undefined) {
                refreshInfoBoxData(activeTractId);
            }
        })
        .catch((error) => {
            console.error('Error loading workforce data:', error);
        });

    document.getElementById('buttonRefreshView').disabled = true;
}

/**
 * Handles the change event when the data filter is changed
 */
function onDataFilterChanged() {
    document.getElementById('buttonRefreshView').disabled = false;
}

/**
 * Handles the click event when a census tract is clicked
 * @param {Object} event - The click event object
 */
function onTractClicked(event) {
    const tractId = event.feature.getProperty('GEOID20');
    if (activeTractId === undefined) {
        activeTractId = tractId;
        highlightTract(event.feature, 5);
        showInfoBox(tractId);
        hideGuideText();
    } else {
        if (activeTractId === tractId) {
            activeTractId = undefined;
            setTractAsNotActive(event.feature);
            hideInfoBox(tractId);
            showGuideText();
        } else {
            setTractAsNotActive(cityTractHoverShapes[activeTractId]);
            activeTractId = tractId;
            highlightTract(event.feature, 5);
            showInfoBox(tractId);
            hideGuideText();
        }
    }
}

/**
 * Shows the info box with data for a given tract ID
 * @param {string} tractId - The ID of the census tract
 */
function showInfoBox(tractId) {
    refreshInfoBoxData(tractId);
    mapInfobox.className = 'mapInfoBox visible';
}

/**
 * Hides the info box
 */
function hideInfoBox() {
    mapInfobox.className = 'mapInfoBox hidden';
}

/**
 * Refreshes the data in the info box for a given tract ID
 * @param {string} tractId - The ID of the census tract
 */
function refreshInfoBoxData(tractId) {
    const tractData = cityTractWorkforceData.data[tractId];

    if (tractData === undefined) {
        document.getElementById('infoBoxUnemploymentPercent').textContent = 'Missing data';
        document.getElementById('infoBoxMoePercent').textContent = 'Missing data';
        document.getElementById('infoBoxNumberOfSamples').textContent = 'Missing data';
        document.getElementById('infoBoxTotalSamples').textContent = 'Missing data';
        document.getElementById('infoBoxTractId').textContent = tractId;
    } else {
        const unemploymentPercent = tractData.unemployment_percent;
        const marginOfError = tractData.margin_of_error_percent;
        const numSamples = tractData.unemployment_number;
        const totalSamples = tractData.total_samples;

        document.getElementById('infoBoxUnemploymentPercent').textContent =
            unemploymentPercent.toFixed(2) + '%';
        document.getElementById('infoBoxMoePercent').textContent = marginOfError.toFixed(2) + '%';
        document.getElementById('infoBoxNumberOfSamples').textContent = numSamples;
        document.getElementById('infoBoxTotalSamples').textContent = totalSamples;
        document.getElementById('infoBoxTractId').textContent = tractId;

        const infoBoxMoePercentRow = document.getElementById('infoBoxMoePercentRow');
        if (marginOfError > MOE_THRESHOLD) {
            infoBoxMoePercentRow.classList.add('highMoE');
        } else {
            infoBoxMoePercentRow.classList.remove('highMoE');
        }
    }
}

/**
 * Hides the guide text
 */
function hideGuideText() {
    document.getElementById('mapGuideText').classList.add('hidden');
}

/**
 * Shows the guide text
 */
function showGuideText() {
    document.getElementById('mapGuideText').classList.remove('hidden');
}

/**
 * Highlights a tract feature with a given highlight weight
 * @param {google.maps.Data.Feature} tractFeature - The feature object of the tract
 * @param {number} highlightWeight - The strokeWeight to highlight the tract
 */
function highlightTract(tractFeature, highlightWeight) {
    tractsHoverDataLayer.overrideStyle(tractFeature, {
        strokeWeight: highlightWeight,
    });
}

/**
 * Sets the highlight of a tract to the default style
 * @param {Object} event - The mouseout event object
 */
function setHighlightTractAsDefault(event) {
    const tractId = getTractId(event.feature);
    if (tractId !== activeTractId) {
        tractsHoverDataLayer.revertStyle(event.feature);
    }
}

/**
 * Sets a tract as not active
 * @param {google.maps.Data.Feature} tractFeature - The feature object of the tract
 */
function setTractAsNotActive(tractFeature) {
    tractsHoverDataLayer.revertStyle(tractFeature);
    tractsHoverDataLayer.overrideStyle(tractFeature, {
        strokeWeight: 0.4,
    });
}

window.initMap = initMap;
