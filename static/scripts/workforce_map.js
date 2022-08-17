const MAP_WIDTH = 1280;
const MAP_HEIGHT = 1080;
const UNEMPLOYMENT_LEVEL_CATEGORIES = [4, 8, 14, 19, 29];
const EXCLUDED_TRACTS = ["25025990101", "25025980101", "25025981501"];
const EXCLUDED_NEIGHBORHOODS = ["Harbor Islands"];
const EXCLUDED_NEIGHBORHOOD_LABELS = ["Bay Village", "Leather District", "Chinatown", "Waterfront", "West End"];
const CITY_CENTER = [-71.137140, 42.3513369];
const INITIAL_SCALE = 150000;
const LABEL_FONT_SIZE = 0.55;
const MOE_THRESHOLD = 20;

/**
 * This class handles the WorkforceMap, including loading the data asynchronously, draw the map and the colorization,
 * update the infobox, and the click events.
 */
class WorkforceMap {
    /* VARIABLES */
    cityTractWorkforceData = {};
    cityTractShapes = {};
    cityTractMoEShapes = {};
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
        let mapMoEGroup = this.mapParentGroup.append("g").attr("id", "mapMoEGroup");
        let mapNeighborhoodGroup = this.mapParentGroup.append("g").attr("id", "mapNeighborhoodGroup");
        let mapLabelGroup = this.mapParentGroup.append("g").attr("id", "mapLabelGroup");
        let mapHoverGroup = this.mapParentGroup.append("g").attr("id", "mapHoverGroup");

        // Initialize pattern
        this.svgMap
            .append('defs')
            .append('pattern')
                .attr('id', 'diagonalHatch')
                .attr('patternUnits', 'userSpaceOnUse')
                .attr('width', 4)
                .attr('height', 4)
            .append('path')
                .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
                .attr('stroke', '#00000066')
                .attr('stroke-width', 0.5);

        // Load data
        let bostonNeighborhoodsData = d3.json("static/maps/boston_neighborhoods.geojson");
        let bostonCensusTractsData = d3.json("static/maps/boston_census_tracts_2020.geojson");
        let countySubdivisions = d3.json("static/maps/ma_county_subdivisions.geojson");
        let mapDataUriList = [bostonNeighborhoodsData, bostonCensusTractsData, countySubdivisions];

        // Draw map
        Promise.all(mapDataUriList).then((values) => {
            drawSurroundings([values[2]], pathProjector, mapBgGroup);
            this.cityTractShapes = drawCensusTracts(values[1], pathProjector, mapShapeGroup);
            this.cityTractMoEShapes = drawMoETracts(values[1], pathProjector, mapMoEGroup)
            this.neighborhoodShapes = drawNeighborhoods(values[0], pathProjector, mapNeighborhoodGroup, mapLabelGroup);
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

        // What is this Button
        d3.select("#whatIsThisButton").on("click", this.toggleAboutBox);

        // About Box
        d3.select("#aboutCloseButton").on("click", this.toggleAboutBox);
    }

    /* COLORIZING METHODS */
    loadWorkforceDataAndColorizeMap = (dataUri) => {
        let workforceData = d3.json(dataUri);
        Promise.all([workforceData]).then( (values) => {
            this.cityTractWorkforceData = values[0];
            colorizeWorkforceMap(values[0], this.cityTractShapes, this.cityTractMoEShapes);
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

            if (margin_of_error > MOE_THRESHOLD)
                d3.select("#infoBoxMoePercentRow").classed("highMoE", true);
            else
                d3.select("#infoBoxMoePercentRow").classed("highMoE", false);
        }
    }

    /* TOGGLE ABOUT BOX */
    toggleAboutBox = () => {
        let aboutBox = d3.select('#aboutBoxContainer');
        console.log(aboutBox);
        if (aboutBox.style("display") == "none")
            aboutBox.style("display", "block");
        else
            aboutBox.style("display", "none");
    };

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

const drawTract = (tractFeature, projection, svg) => {
    let tractShape = svg.append("path");
    tractShape.data([tractFeature.geometry])
        .join('path')
        .attr('d', projection)
        .attr('class', "defaultTract")
        .attr("id", getTractId2020(tractFeature))
    return tractShape;
}

const drawMoETracts = (tracts, projection, mapShapeGroup) => {
    let cityTractShapes = {};
    tracts.features.forEach((tractFeature) => {
        if (EXCLUDED_TRACTS.includes(tractFeature.properties.GEOID10)) {
            // Don't draw the tract
        } else {
            cityTractShapes[getTractId2020(tractFeature)] = drawMoETract(tractFeature, projection, mapShapeGroup);
        }
    });
    return cityTractShapes;
}

const drawMoETract = (tractFeature, projection, svg) => {
    let tractShape = svg.append("path");
    tractShape.data([tractFeature.geometry])
        .join('path')
        .attr('d', projection)
        .attr('class', "tractUnemploymentLevelUnknown")
        .attr("id", getTractId2020(tractFeature))
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

const drawTractHover = (tractFeature, projection, workforceMapObj, svg) => {
    let tractShape = svg.append("path");
    let tractId = getTractId2020(tractFeature);
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
const colorizeWorkforceMap = (workforceData, cityTractShapes, moeTractShapes) => {
    for (const key in workforceData.data ) {
        colorizeTract(key, workforceData.data[key], cityTractShapes, moeTractShapes);
    }
}

const colorizeTract = (tractId, tractData, cityTractShapes, moeTractShapes) => {
    if (tractId in cityTractShapes) {
        let tractShape = cityTractShapes[tractId];
        let moeTractShape = moeTractShapes[tractId];

        if (tractData.margin_of_error_percent > MOE_THRESHOLD) {
            moeTractShape.attr("visibility", "visible");
        } else {
            moeTractShape.attr("visibility", "hidden");
        }

        tractShape.attr("class", "tractUnemploymentLevel" + getUnemploymentLevelId(tractData.unemployment_percent));
    }
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
