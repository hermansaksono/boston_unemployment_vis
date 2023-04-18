let map;

function initMap() {
    var latlng = new google.maps.LatLng(42.361145, -71.057083);
    var myOptions = {
        zoom: 12,
        center: latlng,
    };
    map = new google.maps.Map(document.getElementById("map"), myOptions);

    var tracts_data_layer = new google.maps.Data({map: map});
    var neighbourhoods_data_layer = new google.maps.Data({map: map});

    // NOTE: This uses cross-domain XHR, and may not work on older browsers.
    tracts_data_layer.loadGeoJson(
        "../static/maps/boston_census_tracts_2020.geojson"
    );

    neighbourhoods_data_layer.loadGeoJson(
        "../static/maps/boston_neighborhoods.geojson"
    );

    neighbourhoods_data_layer.setStyle({
                                           fillColor: "#ffffff",
                                           fillOpacity: 0.0,
                                           strokeWeight: 1,
                                           strokeColor: "#339eef",
                                           clickable: false
                                       });

    // Set the data layer styles.
    tracts_data_layer.setStyle({
                          fillColor: "#ffffff",
                          fillOpacity: 0.0,
                          strokeWeight: 1,
                          strokeColor: "#cb3e3e",
                      });



    tracts_data_layer.addListener('mouseover', function(e) {
        tracts_data_layer.overrideStyle(e.feature, {
            fillColor: "#e87d7d",
            fillOpacity: 0.4,
            strokeWeight: 1,
            strokeColor: '#00ff15'
        });
    });

    tracts_data_layer.addListener('mouseout', function(e) {
        tracts_data_layer.overrideStyle(e.feature, {
            fillColor: "#ffffff",
            fillOpacity: 0.0,
            strokeWeight: 1,
            strokeColor: "#cb3e3e",
        });
    });

}

window.initMap = initMap;
