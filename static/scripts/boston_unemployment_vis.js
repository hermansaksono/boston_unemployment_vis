const MAP_WIDTH = 900;
const MAP_HEIGHT = 700;
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Bay Village", "Leather District", "Chinatown", "Waterfront"];
const CITY_CENTER = [-71.065, 42.357];
const INITIAL_SCALE = 140000;
const DIV_ID_FOR_SVG_MAP = "div#mapSvgContainer";

let cityTractWorkforceData = {};
let cityTractShapes = {};
let cityTractHoverShapes = {};
let neighborhoodShapes = {};
let activeTractId = undefined;

/* INITIALIZATION */
const initialize = () => {
    // Set up the projection
    let projection = d3.geoMercator().scale(INITIAL_SCALE).center(CITY_CENTER);
    let pathProjector = d3.geoPath().projection(projection);

    // Initialize SVG
    let mapContainer = d3.select(DIV_ID_FOR_SVG_MAP);
    let svgMap = mapContainer.append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("class", "svgMap")
        .attr("viewBox", "0 0 " + MAP_WIDTH + " " + MAP_HEIGHT)
        .classed("svg-content", true);
    let mapParentGroup = svgMap.append("g");
    let mapShapeGroup = mapParentGroup.append("g").attr("id", "mapShapeGroup");
    let mapLabelGroup = mapParentGroup.append("g").attr("id", "mapLabelGroup");
    let mapHoverGroup = mapParentGroup.append("g").attr("id", "mapHoverGroup");

    // Load data
    let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
    let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts.geojson");
    let cambridgeCensusTractsData = d3.json("static/maps/cambridge_census_tracts.geojson");
    let brooklineCensusTractsData = d3.json("static/maps/brookline_census_tracts.geojson");
    let mapDataUriList = [
        bostonNeighborhoodsData, bostonCensusTractsData, cambridgeCensusTractsData, brooklineCensusTractsData];

    // Draw map
    Promise.all(mapDataUriList).then(function(values){
        drawCensusTracts(values[1], pathProjector, mapShapeGroup);
        drawSurroundings([values[2], values[3]], pathProjector, mapShapeGroup);
        drawNeighborhoods(values[0], pathProjector, mapShapeGroup, mapLabelGroup);
        drawCensusHovers(values[1], pathProjector, mapHoverGroup);
        loadWorkforceDataAndColorizeMap("static/json/unemployment-all-black.json");
    });

    // Initialize the Zoom event
    let zoom = d3.zoom()
        .scaleExtent([1, 20])
        .on("zoom", function () {
            mapParentGroup.attr("transform", d3.event.transform);
        });
    svgMap.call(zoom);
}

/* NOW INITIALIZE THE VISUALIZATION */
initialize();

/* EVENT HANDLING */
// Events for the Refresh button
d3.select("#buttonRefreshView").on("click", (d, i) => {
   let dataType = d3.select("#selectDataType").node().value;
   let gender = d3.select("#selectGender").node().value;
   let race = d3.select("#selectRacialGroup").node().value;
   let pathString = `static/json/${dataType}-${gender}-${race}.json`;
   loadWorkforceDataAndColorizeMap(pathString);
   d3.select("#buttonRefreshView").node().disabled = true;
});

// Events for the Drop Down menu
d3.selectAll("#selectDataType, #selectGender, #selectRacialGroup").on("change", () => {
   d3.select("#buttonRefreshView").node().disabled = false;
});

// Events for the Zoom buttons
d3.select("#buttonZoomIn").on("click", (d, i) => {
    console.log("Zoom in");
    zoom();
});

/* HELPER FUNCTIONS */
/* DRAWING FUNCTIONS */
const drawCensusTracts = (tracts, projection, mapShapeGroup) => {
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the tract
        } else {
            drawTract(tractFeature, projection, mapShapeGroup);
        }
    });
}

const drawTract = (tractFeature, projection, svg) => {
    let tractShape = svg.append("path");
    tractShape.data([tractFeature])
        .join('path')
        .attr('d', projection)
        .attr('class', "defaultTract")
        .attr("id", getTractId(tractFeature))
    cityTractShapes[getTractId(tractFeature)] = tractShape;
}

const getTractId = (tractFeature) => {
    return tractFeature.properties.GEOID10;
}

const getTractIdName = (tractFeature) => {
    return "tract" + getTractId(tractFeature);
}

const drawNeighborhoods = (neighborhoods, projection, mapShapeGroup, mapLabelGroup) => {
    neighborhoods.features.forEach((neighborhoodFeature) => {
        drawNeighborhoodBorders(neighborhoodFeature, projection, mapShapeGroup, mapLabelGroup);
    });
}

const drawNeighborhoodBorders = (neighborhoodFeature, projection, mapShapeGroup, mapLabelGroup) => {
    let neighborhoodName = getNeighborhoodName(neighborhoodFeature);
    let neighborhoodShape = mapShapeGroup.append("path");
    neighborhoodShape.data([neighborhoodFeature])
        .join('path')
        .attr('d', projection)
        .attr('class', "neighborhoodBorder")

    drawNeighborhoodName(neighborhoodName, neighborhoodShape, mapLabelGroup);
    neighborhoodShapes[neighborhoodName] = neighborhoodShape;
}

const drawNeighborhoodName = (neighborhoodName, neighborhoodShape, mapLabelGroup) => {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        // Don't do anything
    } else {
        let neighborhoodBBox = neighborhoodShape.node().getBBox();
        mapLabelGroup.append("text")
            .attr("x", neighborhoodBBox.x + neighborhoodBBox.width / 2)
            .attr("y", neighborhoodBBox.y + neighborhoodBBox.height / 2)
            .attr("text-anchor", "middle")
            .attr("class", "neighborhoodName")
            .text(neighborhoodName);
    }
}

const drawSurroundings = (surroundingsDataList, projection, mapShapeGroup) => {
    surroundingsDataList.forEach((surroundingsData) => {
        drawOneSurrounding(surroundingsData, projection, mapShapeGroup);
    });
}

const drawOneSurrounding = (data, projection, mapShapeGroup) => {
    data.features.forEach((feature) => {
        drawSurroundingsBorders(feature, projection, mapShapeGroup);
    });
}

const drawSurroundingsBorders = (feature, projection, mapShapeGroup) => {
    let neighborhoodShape = mapShapeGroup.append("path");
    neighborhoodShape.data([feature])
        .join('path')
        .attr('d', projection)
        .attr('class', "surroundingBorder")
}

const getNeighborhoodName = (neighborhoodFeature) => {
    return neighborhoodFeature.properties.Name;
}

const drawCensusHovers = (tracts, projection, mapHoverGroup) => {
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the census tract
        } else {
            drawTractHovers(tractFeature, projection, mapHoverGroup);
        }
    });
}

const drawTractHovers = (tractFeature, projection, svg) => {
    let tractShape = svg.append("path");
    let tractId = getTractId(tractFeature);

    tractShape.data([tractFeature])
        .join('path')
        .attr('d', projection)
        .attr('class', "hoverTract")
        .attr("id", getTractId(tractFeature))
        .on("mouseover", (d, i) => {
            setHighlightTractAsHover(d.properties.GEOID10);
        })
        .on("mouseout", (d, i) => {
            setHighlightTractAsDefault(d.properties.GEOID10);
        })
        .on("click", () => {
            toggleInfoBox(tractId);
        })
    cityTractHoverShapes[getTractId(tractFeature)] = tractShape;
}

/* INFOBOX FUNCTIONS */
const toggleInfoBox = (tractId) => {
    if (activeTractId == tractId) {
        hideInfoBox();
        setHighlightTractAsNotActive(tractId);
        activeTractId = undefined;
        toggleGuideText();
    } else {
        trySetCurrentHighlightTractAsNotActive();
        refreshInfoBox(tractId);
        toggleGuideText();
    }
}

const showInfoBox = () => {
    d3.select("#mapInfoBox").attr("class", "mapInfoBox visible");
};

const hideInfoBox = () => {
    d3.select("#mapInfoBox").attr("class", "mapInfoBox hidden");
};

const refreshInfoBox = (tractId) => {
    activeTractId = tractId;
    let unemployment_percent = cityTractWorkforceData.data[tractId].unemployment_percent;
    let margin_of_error = cityTractWorkforceData.data[tractId].margin_of_error_percent;
    let num_samples = cityTractWorkforceData.data[tractId].unemployment_number;
    let total_samples = cityTractWorkforceData.data[tractId].total_samples;
    updateInfoBox(unemployment_percent, margin_of_error, num_samples, total_samples, tractId);
    showInfoBox();
    setHighlightTractAsActive(tractId);
}

const updateInfoBox = (unemployment_percent, margin_of_error, num_samples, total_samples, tractId) => {
    d3.select("#infoBoxUnemploymentPercent").text(unemployment_percent.toFixed(2) + "%");
    d3.select("#infoBoxMoePercent").text(margin_of_error.toFixed(2) + "%");
    d3.select("#infoBoxNumberOfSamples").text(num_samples);
    d3.select("#infoBoxTotalSamples").text(total_samples);
    d3.select("#infoBoxTractId").text(tractId);
}

/* TRACT HIGHLIGHTING FUNCTIONS */
const setHighlightTractAsHover = (tractId) => {
    cityTractHoverShapes[tractId].classed("highlight", true);
}

const setHighlightTractAsDefault = (tractId) => {
    //cityTractHoverShapes[tractId].attr("class", "hoverTract");
    cityTractHoverShapes[tractId].classed("highlight", false);
}

const setHighlightTractAsActive = (tractId) => {
    cityTractHoverShapes[tractId].classed("active", true);
}

const setHighlightTractAsNotActive = (tractId) => {
    cityTractHoverShapes[tractId].classed("active", false);
}

const trySetCurrentHighlightTractAsNotActive = () => {
        if (activeTractId != undefined) setHighlightTractAsNotActive(activeTractId);
}

/* COLORIZING MAP FUNCTIONS */
const loadWorkforceDataAndColorizeMap = (dataUri) => {
    let workforceData = d3.json(dataUri);
    Promise.all([workforceData]).then( (values) => {
        /*
        trySetCurrentHighlightTractAsNotActive();
        hideInfoBox();
         */
        cityTractWorkforceData = values[0];
        colorizeWorkforceMap(values[0]);
        if (activeTractId != undefined) refreshInfoBox(activeTractId);
    });
}

const colorizeWorkforceMap = (workforceData) => {
    for (const key in workforceData.data ) {
        colorizeTract(key, workforceData.data[key]);
    }
}

const colorizeTract = (tractId, tractData) => {
    if (tractId in cityTractShapes) {
        let tractShape = cityTractShapes[tractId];
        tractShape.attr("class", "tractUnemploymentLevel" + getUnemploymentLevel(tractData.unemployment_percent));
    }
}

const getUnemploymentLevel = (unemploymentPercent) => {
    if (unemploymentPercent <= 4.0) {
        return 0;
    } else if (unemploymentPercent <= 8.0) {
        return 1;
    } else if (unemploymentPercent <= 14.0) {
        return 2;
    } else if (unemploymentPercent <= 19.0) {
        return 3;
    } else if (unemploymentPercent <= 29.0) {
        return 4;
    } else {
        return 5;
    }
}

/* GUIDE TEXT FUNCTIONS */
const toggleGuideText = () => {
    if (activeTractId == undefined) {
        d3.select("#mapGuideText").attr("class", "mapGuideText visible");
    } else {
        d3.select("#mapGuideText").attr("class", "mapGuideText hidden");
    }
}