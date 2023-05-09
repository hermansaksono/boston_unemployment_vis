let map;
let info_window;
let tracts_data_layer;
let neighbourhoods_data_layer;
const CITY_CENTER = [42.3513369, -71.137140];
const UNEMPLOYMENT_LEVEL_CATEGORIES = [4, 8, 14, 19, 29];
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Harbor Islands"];
const EXCLUDED_NEIGHBORHOOD_LABELS = ["Bay Village", "Leather District", "Chinatown", "Waterfront", "West End"];
let cityTractShapes = {};
let neighborhoodShapes = {};
let cityTractWorkforceData = {};
let unemployment_data = null;
let IS_SHOW_ABOUT_BOX = "isShowAboutBox";
let activeTractId = undefined;
let mapInfobox = document.getElementById("mapInfoBox");
let aboutBox = document.getElementById("aboutBoxContainer");
const MOE_THRESHOLD = 20;

// Define your color mappings similar to your CSS class
const COLOR_MAPPINGS = {
    "colorLevel0": "#f9fbe7",
    "colorLevel1": "#fff59d",
    "colorLevel2": "#ffb74d",
    "colorLevel3": "#ef5350",
    "colorLevel4": "#d81b60",
    "colorLevel5": "#7b1fa2",
};
function initMap() {
    // Load data
    let bostonNeighborhoodsData = "static/maps/boston_neighborhoods.geojson";
    let bostonCensusTractsData = "static/maps/boston_census_tracts_2020.geojson";
    let countySubdivisions = "static/maps/ma_county_subdivisions.geojson";
    let mapDataUriList = [bostonNeighborhoodsData, bostonCensusTractsData, countySubdivisions];

    const latlng = new google.maps.LatLng(CITY_CENTER[0], CITY_CENTER[1]);
    const myOptions = {
        zoom: 12, center: latlng, disableDefaultUI: true,
    };
    map = new google.maps.Map(document.getElementById("map"), myOptions);
    google.maps.event.addListener(map, 'click', function () {
        if (info_window) {
            info_window.setMap(null);
            info_window = null;
        }
    });

    // Draw map
    Promise.all(mapDataUriList).then((values) => {
        cityTractShapes = drawCensusTracts(values[1]);
        neighborhoodShapes = drawNeighborhoods(values[0]);
        loadWorkforceDataAndColorizeMap("static/json2020/unemployment-all-black.json", tracts_data_layer);
    });

    // Handle about box during initialization
    aboutBox = document.getElementById('aboutBoxContainer');
    initializeAboutBox(aboutBox);

    // "What is this" Button
    document.getElementById('whatIsThisButton').addEventListener('click', () => {
        toggleAboutBox(aboutBox);
    });

    // About Box
    document.getElementById('aboutCloseButton').addEventListener('click', () => {
        toggleAboutBox(aboutBox);
    });

    // Refresh Button
    document.getElementById('buttonRefreshView').addEventListener('click', onRefreshButtonClicked);

    // Drop Down filter
    document.getElementById('selectDataType').addEventListener('change', onDataFilterChanged);
    document.getElementById('selectGender').addEventListener('change', onDataFilterChanged);
    document.getElementById('selectRacialGroup').addEventListener('change', onDataFilterChanged);
}

/* Drawing Functions */
const drawCensusTracts = (GeoJsonUrl) => {
    tracts_data_layer = new google.maps.Data({map: map});
    tracts_data_layer.loadGeoJson(GeoJsonUrl);

    tracts_data_layer.addListener('mouseover', function (e) {
        setHighlightTractAsHover(e);
    });

    tracts_data_layer.addListener('mouseout', function (e) {
        setHighlightTractAsDefault(e);
    });

    tracts_data_layer.addListener('click', function (e) {
        onTractClicked(e)
    });

    tracts_data_layer.addListener('addfeature', (event) => {
        let tractFeature = event.feature;
        if (EXCLUDED_TRACTS.includes(tractFeature.getProperty('GEOID20'))) {
            console.log(tractFeature.getProperty('GEOID20'));
            // Don't draw the tract
        } else {
            cityTractShapes[getTractId(tractFeature)] = drawTract(tracts_data_layer, tractFeature)
        }
    });
    return cityTractShapes;
}

const drawTract = (tracts_data_layer, tractFeature) => {
    tracts_data_layer.overrideStyle(tractFeature, {
        fillColor: "#ffffff",
        fillOpacity: 0.0,
        strokeWeight: 0.4,
        strokeColor: "#cb3e3e",
    });
    return tractFeature;
}

const getTractId = (tractFeature) => {
    return tractFeature.getProperty('GEOID20');
}


const drawNeighborhoods = (GeoJsonUrl) => {
    neighbourhoods_data_layer = new google.maps.Data({map: map});
    neighbourhoods_data_layer.loadGeoJson(GeoJsonUrl);
    let neighborhoodShapes = {};
    neighbourhoods_data_layer.addListener('addfeature', (event) => {
        let neighborhoodFeature = event.feature;
        let name = getNeighborhoodName(neighborhoodFeature);
        let neighborhoodShape = drawNeighborhoodBorders(neighborhoodFeature, name);
        neighborhoodShapes[name] = neighborhoodShape;
    });
    // console.log(neighborhoodShapes)
    return neighborhoodShapes;
}

const getNeighborhoodName = (neighborhoodFeature) => { return neighborhoodFeature.getProperty('Name') }

const drawNeighborhoodBorders = (neighborhoodFeature, neighborhoodName) => {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        console.log(neighborhoodName);
    }
    else {
        neighbourhoods_data_layer.overrideStyle(neighborhoodFeature, {
            fillColor: "#ffffff",
            fillOpacity: 0.0,
            strokeWeight: 1,
            strokeColor: "#4589ff",
            clickable: false
        });}
    return neighborhoodFeature;
}


/* COLORIZING METHODS */
const loadWorkforceDataAndColorizeMap = (dataUri, tracts_data_layer) => {
    fetch(dataUri)
        .then(response => response.json())
        .then(data => {
            cityTractWorkforceData = data;
            unemployment_data = data.data;
            colorizeWorkforceMap(tracts_data_layer);
        });
    if (activeTractId !== undefined)
        refreshInfoBoxData(activeTractId);
}

const colorizeWorkforceMap = (tracts_data_layer) => {
    tracts_data_layer.setStyle(feature => {
        let geoid20 = feature.getProperty('GEOID20');
        let unemployment = unemployment_data[geoid20] ? unemployment_data[geoid20].unemployment_percent : 0;
        return {
            fillColor: getLevelColor(getUnemploymentLevelId(unemployment)), // set the color based on unemployment rate
            fillOpacity: 0.4,
            strokeWeight: 1,
            strokeColor: "#cb3e3e",
        };
    });
}

// const colorizeTract = (tractId, tractData) => {
//     cityTractShapes.overrideStyle(cityTractShapes.getFeatureById(tractId), {
//         fillColor: getUnemploymentLevelId(tractData.unemployment_percent),
//         fillOpacity: 0.6,
//         strokeWeight: 1,
//         strokeColor: "#cb3e3e",
//     });
// }

const getUnemploymentLevelId = (unemploymentPercent) => {
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

const getLevelColor = (level) => {
    return COLOR_MAPPINGS[`colorLevel${level}`] || '#ffffff';
}

/* About box functions */
const initializeAboutBox = (aboutBox) => {
    if (isAboutBoxSet()) {
        if (isAboutBoxVisible()) {
            aboutBox.style.display = "block";
        } else {
            aboutBox.style.display = "none";
        }
    } else {
        aboutBox.style.display = "block";
        window.localStorage.setItem(IS_SHOW_ABOUT_BOX, "true");
    }
}

const isAboutBoxVisible = () => {
    if (isAboutBoxSet())
        return window.localStorage.getItem(IS_SHOW_ABOUT_BOX) !== "false";
    else {
        return false;
    }
}

const toggleAboutBox = (aboutBox) => {
    // console.log(isAboutBoxVisible());
    if (isAboutBoxVisible()) {
        setAboutBoxVisible(aboutBox, false);
        window.localStorage.setItem(IS_SHOW_ABOUT_BOX, "false");
    } else {
        setAboutBoxVisible(aboutBox, true);
        window.localStorage.setItem(IS_SHOW_ABOUT_BOX, "true");
    }
};

const setAboutBoxVisible = (aboutBox, isVisible) => {
    if (isVisible) {
        aboutBox.style.display = "block";
    } else {
        aboutBox.style.display = "none";
    }
}

const isAboutBoxSet = () => {
    return(window.localStorage.getItem(IS_SHOW_ABOUT_BOX) != null);
}

const onRefreshButtonClicked = () => {
    let dataType = document.getElementById("selectDataType").value;
    let gender = document.getElementById("selectGender").value;
    let race = document.getElementById("selectRacialGroup").value;
    let pathString = `static/json2020/${dataType}-${gender}-${race}.json`;
    loadWorkforceDataAndColorizeMap(pathString, tracts_data_layer);
    document.getElementById("buttonRefreshView").disabled = true;
}

const onDataFilterChanged = () => {
    document.getElementById("buttonRefreshView").disabled = false;
}

/* INFOBOX FUNCTIONS */
const onTractClicked = (event) => {
    let tractId = event.feature.getProperty('GEOID20');
    let unemployment = unemployment_data[tractId].unemployment_percent;
    // if (info_window) {
    //     info_window.setMap(null);
    //     info_window = null;
    // }
    // info_window = new google.maps.InfoWindow({
    //                                              content: '<div>Census Tract Id: <span style="color:red;">' + census_tract_id
    //                                                       + '</span><br>Unemployment Rate: <span style="color:red;">'
    //                                                       + unemployment + '%</span></div>',
    //                                              size: new google.maps.Size(150, 50),
    //                                              position: e.latLng,
    //                                              map: map
    //                                          });
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

const showInfoBox = (tractId) => {
    refreshInfoBoxData(tractId);
    mapInfobox.className = "mapInfoBox visible";
};

const hideInfoBox = (tractId) => {
    mapInfobox.className = "mapInfoBox hidden";
};


const refreshInfoBoxData = (tractId) => {
    let tract_data = cityTractWorkforceData.data[tractId];
    console.log(cityTractWorkforceData)
    if (tract_data === undefined) {
        document.getElementById("infoBoxUnemploymentPercent").textContent = "Missing data";
        document.getElementById("infoBoxMoePercent").textContent = "Missing data";
        document.getElementById("infoBoxNumberOfSamples").textContent = "Missing data";
        document.getElementById("infoBoxTotalSamples").textContent = "Missing data";
        document.getElementById("infoBoxTractId").textContent = tractId;
    } else {
        let unemployment_percent = tract_data.unemployment_percent;
        let margin_of_error = tract_data.margin_of_error_percent;
        let num_samples = tract_data.unemployment_number;
        let total_samples = tract_data.total_samples;

        document.getElementById("infoBoxUnemploymentPercent").textContent = unemployment_percent.toFixed(2) + "%";
        document.getElementById("infoBoxMoePercent").textContent = margin_of_error.toFixed(2) + "%";
        document.getElementById("infoBoxNumberOfSamples").textContent = num_samples;
        document.getElementById("infoBoxTotalSamples").textContent = total_samples;
        document.getElementById("infoBoxTractId").textContent = tractId;

        if (margin_of_error > MOE_THRESHOLD) {
            document.getElementById("infoBoxMoePercentRow").classList.add("highMoE");
        } else {
            document.getElementById("infoBoxMoePercentRow").classList.remove("highMoE");
        }
    }
}

/* TOGGLE ACTIVE TRACT */
const setTractAsActive = (tractId) => {
    let tractHoverShape = tracts_data_layer.getFeatureById(tractId);
    setHighlightTractAsActive(tractHoverShape);
}

const setTractAsNotActive = (tractId) => {
    let tractHoverShape =tracts_data_layer.getFeatureById(tractId);
    setHighlightTractAsNotActive(tractHoverShape);
}

/* GUIDE TEXT FUNCTIONS */
const hideGuideText = () => {
    document.getElementById("mapGuideText").className = "mapGuideText hidden";
}

const showGuideText = () => {
    document.getElementById("mapGuideText").className = "mapGuideText visible";
}

/* TRACT HIGHLIGHTING FUNCTIONS */
const setHighlightTractAsHover = (event) => {
    tracts_data_layer.overrideStyle(event.feature, {
        strokeWeight: 2,
        strokeColor: '#00ff15'
    });
}

const setHighlightTractAsDefault = (event) => {
    tracts_data_layer.revertStyle();
}

const setHighlightTractAsActive = (tractShape) => {
    tracts_data_layer.overrideStyle(event.feature, {
        strokeWeight: 2,
        strokeColor: '#00ff15'
    });
}

const setHighlightTractAsNotActive = (tractShape) => {
    tracts_data_layer.revertStyle();
}


window.initMap = initMap;