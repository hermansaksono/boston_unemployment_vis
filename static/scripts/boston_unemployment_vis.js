const MAP_WIDTH = 1400;
const MAP_HEIGHT = 600;
const EXCLUDED_TRACTS = ["25025990101"];
const CITY_CENTER = [-71.0189, 42.3301];
const INITIAL_SCALE = 145000;
const DIV_ID_FOR_SVG_MAP = "div#mapContainer";

let projection = d3.geoMercator().scale(INITIAL_SCALE).center(CITY_CENTER);
let pathProjector = d3.geoPath().projection(projection);

let cityTractShapes = {};
let neighborhoodShapes = {};

let mapContainer = d3.select(DIV_ID_FOR_SVG_MAP);
let svgMap = mapContainer.append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("class", "svgMap")
    .attr("viewBox", "0 0 " + MAP_WIDTH + " " + MAP_HEIGHT)
    .classed("svg-content", true);

// Load data
let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts.geojson");

// Draw map
Promise.all([bostonNeighborhoodsData, bostonCensusTractsData]).then(function(values){
    drawCensusTracts(values[1]);
    drawNeighborhoods(values[0]);
    loadWorkforceDataAndColorizeMap("static/json/unemployment-all-all.json")
});

// Colorize map
const loadWorkforceDataAndColorizeMap = (dataUri) => {
    let workforceData = d3.json(dataUri);
    Promise.all([workforceData]).then( (values) => {
        colorizeWorkforceMap(values[0]);
    });
}

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
        .attr("id", getTractIdName(tractFeature));
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
    let neighborhoodShape = svg.append("path");
    neighborhoodShape.data([neighborhoodFeature])
        .join('path')
        .attr('d', pathProjector)
        .attr('class', "neighborhoodBorder")
    neighborhoodShapes[getNeighborhoodName(neighborhoodFeature)] = neighborhoodShape;
}

const getNeighborhoodName = (neighborhoodFeature) => {
    return neighborhoodFeature.properties.Name;
}

// COLORIZING MAP
const colorizeWorkforceMap = (workforceData) => {
    console.log(workforceData.data);
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