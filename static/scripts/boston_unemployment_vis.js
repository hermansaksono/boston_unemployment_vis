const MAP_WIDTH = 800;
const MAP_HEIGHT = 620;
const EXCLUDED_TRACTS = ["25025990101", "25025980101"];
const CITY_CENTER = [-71.0499, 42.3351];
const INITIAL_SCALE = 145000;
const DIV_ID_FOR_SVG_MAP = "div#mapSvgContainer";

let projection = d3.geoMercator().scale(INITIAL_SCALE).center(CITY_CENTER);
let pathProjector = d3.geoPath().projection(projection);

let cityTractWorkforceData = {};
let cityTractShapes = {};
let cityTractHoverShapes = {};
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
    drawCensusHovers(values[1]);
    loadWorkforceDataAndColorizeMap("static/json/unemployment-all-all.json")
});

// Colorize map
const loadWorkforceDataAndColorizeMap = (dataUri) => {
    let workforceData = d3.json(dataUri);
    Promise.all([workforceData]).then( (values) => {
        cityTractWorkforceData = values[0];
        colorizeWorkforceMap(values[0]);
    });
}

// Events for the Refresh Button
d3.select("#buttonRefreshView").on("click", (d, i) => {
   let dataType = d3.select("#selectDataType").node().value;
   let gender = d3.select("#selectGender").node().value;
   let race = d3.select("#selectRacialGroup").node().value;
   let pathString = `static/json/${dataType}-${gender}-${race}.json`;
   loadWorkforceDataAndColorizeMap(pathString);
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
    cityTractHoverShapes[getTractId(tractFeature)] = tractShape;
}

const showInfoBox = () => {
    d3.select("#mapInfoBox").attr("class", "mapInfoBox visible");
};

const hideInfoBox = () => {
    d3.select("#mapInfoBox").attr("class", "mapInfoBox hidden");
};

const updateInfoBox = (unemployment_percent, margin_of_error, num_samples, total_samples, tractId) => {
    d3.select("#infoBoxUnemploymentPercent").text(unemployment_percent.toFixed(2) + "%");
    d3.select("#infoBoxMoePercent").text(margin_of_error.toFixed(2) + "%");
    d3.select("#infoBoxNumberOfSamples").text(num_samples);
    d3.select("#infoBoxTotalSamples").text(total_samples);
    d3.select("#infoBoxTractId").text(tractId);
}

const highlightTract = (tractId) => {
    cityTractHoverShapes[tractId].attr("class", "hoverTract highlight");
}

const unHighlightTract = (tractId) => {
    cityTractHoverShapes[tractId].attr("class", "hoverTract");
}

// COLORIZING MAP
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