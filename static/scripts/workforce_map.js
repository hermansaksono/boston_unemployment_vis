const MAP_WIDTH = 1280;
const MAP_HEIGHT = 1080;
const UNEMPLOYMENT_LEVEL_CATEGORIES = [4, 8, 14, 19, 29];
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Harbor Islands"];
const EXCLUDED_NEIGHBORHOOD_LABELS = ["Bay Village", "Leather District", "Chinatown", "Waterfront", "West End"];
const CITY_CENTER = [-71.137140, 42.3513369];
const INITIAL_SCALE = 150000;
const LABEL_FONT_SIZE = 0.55;

const MISSING_TRACTS = [ //  These are census tracts that are gone/merged after 2020 census
    "25025020303", "25025030300", "25025060600", "25025061000", "25025070800", "25025070101", "25025070200",
    "25025081100", "25025081300", "25025110103", "25025070800", "25025000100", "25025000803", "25025000802",
    "25025050200", "25025091300", "25025061000", "25025091300"
]

/**
 * This class handles the WorkforceMap, including loading the data asynchronously, draw the map and the colorization,
 * update the infobox, and the click events.
 */
class WorkforceMap {
    /* VARIABLES */
    cityTractWorkforceData = {};
    cityTractShapes = {};
    cityTractHoverShapes = {};
    neighborhoodShapes = {};
    activeTractId = undefined;
    mapContainer = undefined;
    mapInfobox = undefined;
    svgMap = undefined;
    mapParentGroup = undefined;

    /* CONSTRUCTOR */
    constructor(divIdForSvgMap) {
        this.mapContainer = d3.select(divIdForSvgMap);
        this.mapInfobox = d3.select("#mapInfoBox"); // TODO
    }

    /* METHODS */
    /**
     * Initialize the WorkForce map. First, it sets up the D3 SVG. Then populate the DVG with mapping and population
     * data. Finally, add events to the map.
     * @param mapWidth
     * @param mapHeight
     */
    initialize = (mapWidth = MAP_WIDTH, mapHeight = MAP_HEIGHT) => {
        /* INITIALIZATION */
        // Get document information then adjust mapContainerHeight
        let documentHeight = window.innerHeight;
        this.mapContainer.style("height", `${documentHeight}px`);

        // Set up the projection
        let projection = d3.geoMercator().scale(INITIAL_SCALE).center(CITY_CENTER);
        let pathProjector = d3.geoPath().projection(projection);

        // Initialize SVG
        this.svgMap = this.mapContainer.append("svg")
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("class", "svgMap")
            .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
            .call(this.onZoom)
            .classed("svg-content", true);
        this.mapParentGroup = this.svgMap.append("g").attr("id", "mapParent");
        let mapBgGroup = this.mapParentGroup.append("g").attr("id", "mapBgGroup");
        let mapShapeGroup = this.mapParentGroup.append("g").attr("id", "mapShapeGroup");
        let mapLabelGroup = this.mapParentGroup.append("g").attr("id", "mapLabelGroup");
        let mapHoverGroup = this.mapParentGroup.append("g").attr("id", "mapHoverGroup");

        // Load data
        let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
        let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts_2020.geojson");
        let countySubdivisions = d3.json("static/maps/ma_county_subdivisions.geojson");
        let mapDataUriList = [bostonNeighborhoodsData, bostonCensusTractsData, countySubdivisions];

        // Draw map
        Promise.all(mapDataUriList).then((values) => {
            drawSurroundings([values[2]], pathProjector, mapBgGroup);
            this.cityTractShapes = drawCensusTracts(values[1], pathProjector, mapShapeGroup);
            this.neighborhoodShapes = drawNeighborhoods(values[0], pathProjector, mapShapeGroup, mapLabelGroup);
            this.cityTractHoverShapes = drawCensusHovers(values[1], pathProjector, this, mapHoverGroup);
            this.loadWorkforceDataAndColorizeMap("static/json2020/unemployment-all-black.json");
        });

        /* EVENT HANDLING */
        // Refresh Button
        d3.select("#buttonRefreshView").on("click", this.onRefreshButtonClicked);

        // Drop Down filter
        d3.selectAll("#selectDataType, #selectGender, #selectRacialGroup").on("change", this.onDataFilterChanged);

        // Zoom buttons
        d3.select("#buttonZoomIn").on("click", () => {
            this.svgMap.transition().call(this.onZoom.scaleBy, 2);
        });

        d3.select("#buttonZoomOut").on("click", () => {
            this.svgMap.transition().call(this.onZoom.scaleBy, 0.5);
        });
    }

    /* COLORIZING METHODS */
    loadWorkforceDataAndColorizeMap = (dataUri) => {
        let workforceData = d3.json(dataUri);
        Promise.all([workforceData]).then( (values) => {
            this.cityTractWorkforceData = values[0];
            colorizeWorkforceMap(values[0], this.cityTractShapes);
            if (this.activeTractId != undefined)
                this.refreshInfoBoxData(this.activeTractId);
        });
    }

    /* INFOBOX FUNCTIONS */
    onTractClicked = (tractId) => {
        if (this.activeTractId == undefined) {
            this.activeTractId = tractId;
            this.setTractAsActive(tractId);
            this.showInfoBox(tractId);
            this.hideGuideText();
        } else {
            if (this.activeTractId == tractId) {
                this.activeTractId = undefined;
                this.setTractAsNotActive(tractId);
                this.hideInfoBox(tractId);
                this.showGuideText();
            } else {
                this.setTractAsNotActive(this.activeTractId);
                this.setTractAsActive(tractId);
                this.activeTractId = tractId;
                this.showInfoBox(tractId);
                this.hideGuideText();
            }
        }
    }

    showInfoBox = (tractId) => {
        this.refreshInfoBoxData(tractId);
        this.mapInfobox.attr("class", "mapInfoBox visible");
    };

    hideInfoBox = (tractId) => {
        this.mapInfobox.attr("class", "mapInfoBox hidden");
    };

    refreshInfoBoxData = (tractId) => {
        /*
        let unemployment_percent = this.cityTractWorkforceData.data[tractId].unemployment_percent;
        let margin_of_error = this.cityTractWorkforceData.data[tractId].margin_of_error_percent;
        let num_samples = this.cityTractWorkforceData.data[tractId].unemployment_number;
        let total_samples = this.cityTractWorkforceData.data[tractId].total_samples;

        d3.select("#infoBoxUnemploymentPercent").text(unemployment_percent.toFixed(2) + "%");
        d3.select("#infoBoxMoePercent").text(margin_of_error.toFixed(2) + "%");
        d3.select("#infoBoxNumberOfSamples").text(num_samples);
        d3.select("#infoBoxTotalSamples").text(total_samples);
        d3.select("#infoBoxTractId").text(tractId);
         */
        let tract_data = this.cityTractWorkforceData.data[tractId];
        if (tract_data == undefined) {
            d3.select("#infoBoxUnemploymentPercent").text("Missing data");
            d3.select("#infoBoxMoePercent").text("Missing data");
            d3.select("#infoBoxNumberOfSamples").text("Missing data");
            d3.select("#infoBoxTotalSamples").text("Missing data");
            d3.select("#infoBoxTractId").text(tractId);
        } else {
            let unemployment_percent = tract_data.unemployment_percent;
            let margin_of_error = tract_data.margin_of_error_percent;
            let num_samples = tract_data.unemployment_number;
            let total_samples = tract_data.total_samples;

            d3.select("#infoBoxUnemploymentPercent").text(unemployment_percent.toFixed(2) + "%");
            d3.select("#infoBoxMoePercent").text(margin_of_error.toFixed(2) + "%");
            d3.select("#infoBoxNumberOfSamples").text(num_samples);
            d3.select("#infoBoxTotalSamples").text(total_samples);
            d3.select("#infoBoxTractId").text(tractId);
        }
    }

    /* TOGGLE ACTIVE TRACT */
    setTractAsActive = (tractId) => {
        let tractHoverShape = this.cityTractHoverShapes[tractId];
        setHighlightTractAsActive(tractHoverShape);
    }

    setTractAsNotActive = (tractId) => {
        let tractHoverShape = this.cityTractHoverShapes[tractId];
        setHighlightTractAsNotActive(tractHoverShape);
    }

    /* GUIDE TEXT FUNCTIONS */
    hideGuideText = () => { d3.select("#mapGuideText").attr("class", "mapGuideText hidden"); }

    showGuideText = () => { d3.select("#mapGuideText").attr("class", "mapGuideText visible"); }

    /* EVENT HANDLING */
    onRefreshButtonClicked = () => {
        let dataType = d3.select("#selectDataType").node().value;
        let gender = d3.select("#selectGender").node().value;
        let race = d3.select("#selectRacialGroup").node().value;
        let pathString = `static/json2020/${dataType}-${gender}-${race}.json`;
        this.loadWorkforceDataAndColorizeMap(pathString);
        d3.select("#buttonRefreshView").node().disabled = true;
    }

    onDataFilterChanged = () => {
        d3.select("#buttonRefreshView").node().disabled = false;
    }

    /* ZOOM HANDLING */
    onZoomSemantically = () => {
        let scale = d3.event.transform.k;
        let mapLabelGroup = this.mapParentGroup.select("#mapLabelGroup")
        this.mapParentGroup.attr("transform", d3.event.transform);
        mapLabelGroup.selectAll("text").style("font-size", `${computeNeighborhoodLabelZoomed(scale)} em`);
    }

    onZoom = d3.zoom()
        .scaleExtent([0.5, 20])
        .on("zoom", this.onZoomSemantically);
}

/* HELPER FUNCTIONS */
/* Drawing Functions */
const drawCensusTracts = (tracts, projection, mapShapeGroup) => {
    let cityTractShapes = {};
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the tract
        } else {
            cityTractShapes[getTractId2020(tractFeature)] = drawTract(tractFeature, projection, mapShapeGroup);
        }
    });
    return cityTractShapes;
}

const drawTract = (tractFeature, projection, svg) => { // TODO Remove old comments
    // console.log([tractFeature]);
    //console.log(tractFeature.properties.GEOID20)
    //console.log([tractFeature.geometry])
    //console.log(projection)
    let tractShape = svg.append("path");
    tractShape.data([tractFeature.geometry])
        .join('path')
        .attr('d', projection)
        .attr('class', "defaultTract")
        .attr("id", getTractId2020(tractFeature))
    //console.log(tractShape)
    return tractShape;
}

/*
const getTractId = (tractFeature) => {
    return tractFeature.properties.GEOID10;
}
 */

const getTractId2020 = (tractFeature) => {
    return tractFeature.properties.GEOID20;
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


const drawNeighborhoods = (neighborhoods, projection, mapShapeGroup, mapLabelGroup) => {
    let neighborhoodShapes = {};
    neighborhoods.features.forEach((neighborhoodFeature) => {
        let name = getNeighborhoodName(neighborhoodFeature);
        let neighborhoodShape = drawNeighborhoodBorders(neighborhoodFeature, name, projection, mapShapeGroup);
        drawNeighborhoodLabel(name, neighborhoodShape, mapLabelGroup);

        neighborhoodShapes[name] = neighborhoodShape;
    });
    return neighborhoodShapes;
}

const getNeighborhoodName = (neighborhoodFeature) => { return neighborhoodFeature.properties.Name; }

const drawNeighborhoodBorders = (neighborhoodFeature, neighborhoodName, projection, mapShapeGroup) => {
    let neighborhoodShape = mapShapeGroup.append("path");
    neighborhoodShape.data([neighborhoodFeature])
        .join('path')
        .attr('d', projection)

    if (EXCLUDED_NEIGHBORHOODS.includes(neighborhoodName))
        neighborhoodShape.attr("class", "neighborhoodBorder excluded");
    else
        neighborhoodShape.attr("class", "neighborhoodBorder");

    return neighborhoodShape;
}

const drawNeighborhoodLabel = (neighborhoodName, neighborhoodShape, mapLabelGroup) => {
    if (EXCLUDED_NEIGHBORHOOD_LABELS.includes(neighborhoodName)) {
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

const drawCensusHovers = (tracts, projection, workforceMapObj, mapHoverGroup) => {
    let cityTractHoverShapes = {};
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the census tract
        } else {
            cityTractHoverShapes[getTractId2020(tractFeature)] = drawTractHover(
                tractFeature, projection, workforceMapObj, mapHoverGroup);
        }
    });
    return cityTractHoverShapes;
}

const drawTractHover = (tractFeature, projection, workforceMapObj, svg) => { // TODO Remove old comments
    let tractShape = svg.append("path");
    let tractId = getTractId2020(tractFeature);
    //console.log([tractFeature.geometry])
    // tractShape.data([tractFeature])
    tractShape.data([tractFeature.geometry])
        .join('path')
        .attr('d', projection)
        .attr('class', "hoverTract")
        .attr("id", getTractId2020(tractFeature))
        .on("mouseover", (d, i) => {
            setHighlightTractAsHover(tractShape);
        })
        .on("mouseout", (d, i) => {
            setHighlightTractAsDefault(tractShape);
        })
        .on("click", () => {
            workforceMapObj.onTractClicked(tractId);
        })
    return tractShape;
}

/* TRACT HIGHLIGHTING FUNCTIONS */
const setHighlightTractAsHover = (tractShape) => {
    tractShape.classed("highlight", true);
}

const setHighlightTractAsDefault = (tractShape) => {
    tractShape.classed("highlight", false);
}

const setHighlightTractAsActive = (tractShape) => {
    tractShape.classed("active", true);
}

const setHighlightTractAsNotActive = (tractShape) => {
    tractShape.classed("active", false);
}

/* COLORIZING MAP FUNCTIONS */
const colorizeWorkforceMap = (workforceData, cityTractShapes) => {
    // colorizeOldTracts(cityTractShapes);
    for (const key in workforceData.data ) {
        colorizeTract(key, workforceData.data[key], cityTractShapes);
    }
}

const colorizeTract = (tractId, tractData, cityTractShapes) => {
    if (tractId in cityTractShapes) {
        let tractShape = cityTractShapes[tractId];
        tractShape.attr("class", "tractUnemploymentLevel" + getUnemploymentLevelId(tractData.unemployment_percent));
    }
}

const colorizeOldTracts = (cityTractShapes) => {
    MISSING_TRACTS.forEach(tractId => {
        let tractShape = cityTractShapes[tractId];
        tractShape.attr("class", "tractUnemploymentLevelUnknown");
    })
}

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
