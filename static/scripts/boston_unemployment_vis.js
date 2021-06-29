const w = 1400;
const h = 640;
let mapContainer = d3.select("div#mapContainer");
let svg = mapContainer.append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet").style("background-color","#ffffff")
    .attr("viewBox", "0 0 " + w + " " + h)
    .classed("svg-content", true);

let projection = d3.geoMercator().scale(150000).center([-71.0589, 42.3301]);
let path = d3.geoPath().projection(projection);

// Load data
let bostonNeighborhoods = d3.json("static/maps/boston_neighborhoods.geojson");
let bostonCensusTracts = d3.json("static/maps/boston_census_tracts.geojson");
//var cities = d3.csv("cities.csv");

// Draw maps
Promise.all([bostonNeighborhoods, bostonCensusTracts]).then(function(values){
    // Draw neighborhoods
    drawCensusTracts(values[0], values[1]);
});

const drawNeighborhoods = (geoJson) => {
    svg.selectAll("path")
        .data(geoJson.features)
        .join('path')
        .attr('d', path)
        .style("stroke", "#4589ff")
        .style("fill-opacity", "0");
}

const drawCensusTracts = (neighborhoods, tracts) => {

    tracts.features.forEach((tract) => {
        console.log(tract.properties.GEOID10);
    });

    svg.selectAll("path")
        .data(tracts.features)
        .join('path')
        .attr('d', path)
        .attr('class', "defaultTract")
        .enter()
        .data(neighborhoods.features)
        .join('path')
        .attr('d', path)
        .attr('class', "neighborhoodBorder");

}