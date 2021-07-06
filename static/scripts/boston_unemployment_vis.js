const MAP_WIDTH = 1280;
const MAP_HEIGHT = 1080;
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Bay Village", "Leather District", "Chinatown", "Waterfront", "West End"];
const CITY_CENTER = [-71.137140, 42.3563369];//[-70.970, 42.329];,
const INITIAL_SCALE = 149000;
const LABEL_FONT_SIZE = 0.55;
const DIV_ID_FOR_SVG_MAP = "div#mapSvgContainer";

/*
    WorkforceMap
    This class handles the WorkforceMap, including loading the data asynchronously, draw the map and the colorization,
    update the infobox, and the click events.
 */
let WorkforceMap = {
    /* VARIABLES */
    cityTractWorkforceData: {},
    cityTractShapes: {},
    cityTractHoverShapes: {},
    neighborhoodShapes: {},
    activeTractId: undefined,

    /* INITIALIZATION */
    initialize : () => {
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
        let mapParentGroup = svgMap.append("g").attr("id", "mapParent");
        let mapShapeGroup = mapParentGroup.append("g").attr("id", "mapShapeGroup");
        let mapLabelGroup = mapParentGroup.append("g").attr("id", "mapLabelGroup");
        let mapHoverGroup = mapParentGroup.append("g").attr("id", "mapHoverGroup");

        // Load data
        let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
        let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts.geojson");
        let cambridgeCensusTractsData = d3.json("static/maps/cambridge_census_tracts.geojson");
        let brooklineCensusTractsData = d3.json("static/maps/brookline_census_tracts.geojson");
        let countySubdivisions = d3.json("static/maps/ma_county_subdivisions.geojson");
        let mapDataUriList = [
            bostonNeighborhoodsData, bostonCensusTractsData,
            cambridgeCensusTractsData, brooklineCensusTractsData, countySubdivisions];

        // Adjust mapContainerHeight
        let documentHeight = window.innerHeight;
        mapContainer.style("height", `${documentHeight}px`);

        // Draw map
        Promise.all(mapDataUriList).then((values) => {
            drawCensusTracts(values[1], pathProjector, mapShapeGroup);
            drawSurroundings([values[4]], pathProjector, mapShapeGroup);
            drawNeighborhoods(values[0], pathProjector, mapShapeGroup, mapLabelGroup);
            drawCensusHovers(values[1], pathProjector, mapHoverGroup);
            loadWorkforceDataAndColorizeMap("static/json/unemployment-all-black.json");
        });

        // Initialize the Zoom event
        const zoomMapSemantically = () => {
            let scale = d3.event.transform.k;
            mapShapeGroup.attr("transform", d3.event.transform);
            mapLabelGroup.attr("transform", d3.event.transform);
            mapHoverGroup.attr("transform", d3.event.transform);
            mapLabelGroup.selectAll("text").style("font-size", computeNeighborhoodLabelZoomed(scale) + "em");
        }

        const zoom = d3.zoom()
            .scaleExtent([0.75, 20])
            .on("zoom", zoomMapSemantically);

        svgMap.call(zoom);

        /* EVENT HANDLING */
        // Event for the Refresh button
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
            svgMap.transition().call(zoom.scaleBy, 2)
        });

        d3.select("#buttonZoomOut").on("click", (d, i) => {
            svgMap.transition().call(zoom.scaleBy, 0.5)
        });
    }
}

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
    WorkforceMap.cityTractShapes[getTractId(tractFeature)] = tractShape;
}

const getTractId = (tractFeature) => {
    return tractFeature.properties.GEOID10;
}

const drawNeighborhoods = (neighborhoods, projection, mapShapeGroup, mapLabelGroup) => {
    let neighborhoodShapes = {};
    neighborhoods.features.forEach((neighborhoodFeature) => {
        let name = getNeighborhoodName(neighborhoodFeature);
        let neighborhoodShape = drawNeighborhoodBorders(neighborhoodFeature, name, projection, mapShapeGroup);
        drawNeighborhoodLabel(name, neighborhoodShape, mapLabelGroup);

        neighborhoodShapes[name] = neighborhoodShape;
    });
    WorkforceMap.neighborhoodShapes = neighborhoodShapes;
}

const drawNeighborhoodBorders = (neighborhoodFeature, neighborhoodName, projection, mapShapeGroup) => {
    let neighborhoodShape = mapShapeGroup.append("path");
    neighborhoodShape.data([neighborhoodFeature])
        .join('path')
        .attr('d', projection)
        .attr('class', "neighborhoodBorder")
    return neighborhoodShape;
}

const drawNeighborhoodLabel = (neighborhoodName, neighborhoodShape, mapLabelGroup) => {
    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName)) {
        // Don't do anything
    } else {
        let neighborhoodBBox = neighborhoodShape.node().getBBox();
        mapLabelGroup.append("text")
            .attr("x", neighborhoodBBox.x + neighborhoodBBox.width / 2)
            .attr("y", neighborhoodBBox.y + neighborhoodBBox.height / 2)
            .attr("text-anchor", "middle")
            .attr("class", "neighborhoodName")
            .style("font-size", `${computeNeighborhoodLabelZoomed(1)}em`)
            .text(neighborhoodName);
    }
}

const computeNeighborhoodLabelZoomed = (scale) => {
    let scaleAddition = scale - 1;
    let scaledFontSize = LABEL_FONT_SIZE * Math.max(0.45, (1 - (scaleAddition / 3)));
    return scaledFontSize;
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
    WorkforceMap.cityTractHoverShapes[getTractId(tractFeature)] = tractShape;
}

/* INFOBOX FUNCTIONS */
const toggleInfoBox = (tractId) => {
    if (WorkforceMap.activeTractId == tractId) {
        hideInfoBox();
        setHighlightTractAsNotActive(tractId);
        WorkforceMap.activeTractId = undefined;
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
    WorkforceMap.activeTractId = tractId;
    let unemployment_percent = WorkforceMap.cityTractWorkforceData.data[tractId].unemployment_percent;
    let margin_of_error = WorkforceMap.cityTractWorkforceData.data[tractId].margin_of_error_percent;
    let num_samples = WorkforceMap.cityTractWorkforceData.data[tractId].unemployment_number;
    let total_samples = WorkforceMap.cityTractWorkforceData.data[tractId].total_samples;
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
    WorkforceMap.cityTractHoverShapes[tractId].classed("highlight", true);
}

const setHighlightTractAsDefault = (tractId) => {
    WorkforceMap.cityTractHoverShapes[tractId].classed("highlight", false);
}

const setHighlightTractAsActive = (tractId) => {
    WorkforceMap.cityTractHoverShapes[tractId].classed("active", true);
}

const setHighlightTractAsNotActive = (tractId) => {
    WorkforceMap.cityTractHoverShapes[tractId].classed("active", false);
}

const trySetCurrentHighlightTractAsNotActive = () => {
        if (WorkforceMap.activeTractId != undefined) setHighlightTractAsNotActive(WorkforceMap.activeTractId);
}

/* COLORIZING MAP FUNCTIONS */
const loadWorkforceDataAndColorizeMap = (dataUri) => {
    let workforceData = d3.json(dataUri);
    Promise.all([workforceData]).then( (values) => {
        WorkforceMap.cityTractWorkforceData = values[0];
        colorizeWorkforceMap(values[0]);
        if (WorkforceMap.activeTractId != undefined) refreshInfoBox(WorkforceMap.activeTractId);
    });
}

const colorizeWorkforceMap = (workforceData) => {
    for (const key in workforceData.data ) {
        colorizeTract(key, workforceData.data[key]);
    }
}

const colorizeTract = (tractId, tractData) => {
    if (tractId in WorkforceMap.cityTractShapes) {
        let tractShape = WorkforceMap.cityTractShapes[tractId];
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
    if (WorkforceMap.activeTractId == undefined) {
        d3.select("#mapGuideText").attr("class", "mapGuideText visible");
    } else {
        d3.select("#mapGuideText").attr("class", "mapGuideText hidden");
    }
}