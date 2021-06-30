const MAP_WIDTH = 800;
const MAP_HEIGHT = 620;
const EXCLUDED_TRACTS = ["25025990101", "25025980101"];
const EXCLUDED_NEIGHBORHOODS = ["Bay Village", "Leather District", "Chinatown", "Waterfront"];
const CITY_CENTER = [-71.0299, 42.3181];
const INITIAL_SCALE = 120000;
const DIV_ID_FOR_SVG_MAP = "div#mapSvgContainer";

let projection = d3.geoMercator().scale(INITIAL_SCALE).center(CITY_CENTER);
let pathProjector = d3.geoPath().projection(projection);

let cityTractWorkforceData = {};
let cityTractShapes = {};
let cityTractHoverShapes = {};
let neighborhoodShapes = {};
let activeTractId = undefined;

let mapContainer = d3.select(DIV_ID_FOR_SVG_MAP);
let zoom = d3.zoom()
    .scaleExtent([1, 5]) //.scale(projection.scale())
    .on("zoom", function () {
            svgMap.attr("transform", d3.event.transform)
    });

let svgMap = mapContainer.append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("class", "svgMap")
    .attr("viewBox", "0 0 " + MAP_WIDTH + " " + MAP_HEIGHT)
    .call(zoom)
    .classed("svg-content", true);

// Load data
let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts.geojson");

// Draw map
Promise.all([bostonNeighborhoodsData, bostonCensusTractsData]).then(function(values){
    drawCensusTracts(values[1]);
    drawNeighborhoods(values[0]);
    drawCensusHovers(values[1]);
    loadWorkforceDataAndColorizeMap("static/json/unemployment-all-all.json")
});

// Colorize map
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

// Events for the Refresh button
d3.select("#buttonRefreshView").on("click", (d, i) => {
   let dataType = d3.select("#selectDataType").node().value;
   let gender = d3.select("#selectGender").node().value;
   let race = d3.select("#selectRacialGroup").node().value;
   let pathString = `static/json/${dataType}-${gender}-${race}.json`;
   loadWorkforceDataAndColorizeMap(pathString);
});

// Events for the Zoom buttons
d3.select("#buttonZoomIn").on("click", (d, i) => {
    console.log("Zoom in");
    zoom();
});

// HELPER FUNCTIONS
const drawCensusTracts = (tracts) => {
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the tract
        } else {
            drawTract(tractFeature, svgMap);
        }
    });
}

const drawTract = (tractFeature, svg) => {
    let tractShape = svg.append("path");
    tractShape.data([tractFeature])
        .join('path')
        .attr('d', pathProjector)
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

const drawNeighborhoods = (neighborhoods) => {
    neighborhoods.features.forEach((neighborhoodFeature) => {
        drawNeighborhoodBorders(neighborhoodFeature, svgMap);
    });
}

const drawNeighborhoodBorders = (neighborhoodFeature, svg) => {
    let neighborhoodName = getNeighborhoodName(neighborhoodFeature);
    let neighborhoodShape = svg.append("path");
    neighborhoodShape.data([neighborhoodFeature])
        .join('path')
        .attr('d', pathProjector)
        .attr('class', "neighborhoodBorder")

    drawNeighborhoodName(neighborhoodName, neighborhoodShape, svg);
    neighborhoodShapes[neighborhoodName] = neighborhoodShape;
}

const drawNeighborhoodName = (neighborhoodName, neighborhoodShape, svg) => {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        // Don't do anything
    } else {
        let neighborhoodBBox = neighborhoodShape.node().getBBox();
        svg.append("text")
            .attr("x", neighborhoodBBox.x + neighborhoodBBox.width / 2)
            .attr("y", neighborhoodBBox.y + neighborhoodBBox.height / 2)
            .attr("text-anchor", "middle")
            .attr("class", "neighborhoodName")
            .text(neighborhoodName);
    }
}

const getNeighborhoodName = (neighborhoodFeature) => {
    return neighborhoodFeature.properties.Name;
}

const drawCensusHovers = (tracts) => {
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the census tract
        } else {
            drawTractHovers(tractFeature, svgMap);
        }
    });
}

const drawTractHovers = (tractFeature, svg) => {
    let tractShape = svg.append("path");
    let tractId = getTractId(tractFeature);

    tractShape.data([tractFeature])
        .join('path')
        .attr('d', pathProjector)
        .attr('class', "hoverTract")
        .attr("id", getTractId(tractFeature))
        /*
        .on("mouseover", (d, i) => {
            let unemployment_percent = cityTractWorkforceData.data[d.properties.GEOID10].unemployment_percent;
            let margin_of_error = cityTractWorkforceData.data[d.properties.GEOID10].margin_of_error_percent;
            let num_samples = cityTractWorkforceData.data[d.properties.GEOID10].unemployment_number;
            let total_samples = cityTractWorkforceData.data[d.properties.GEOID10].total_samples;
            updateInfoBox(unemployment_percent, margin_of_error, num_samples, total_samples, tractId);
            showInfoBox();
            highlightTract(d.properties.GEOID10);
        })
        .on("mouseout", (d, i) => {
            hideInfoBox();
            unHighlightTract(d.properties.GEOID10);
        });
         */
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
        toggleGuideText();
        activeTractId = undefined;
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