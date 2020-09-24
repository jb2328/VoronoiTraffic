"use strict";

// m/sec to mph
//const TO_MPH = 2.23694;


// Script state globals
var map, // The Leaflet map object itself
    clock; // The clock control

var topLeft;


var all_sites, all_links, all_journeys = [];

var links_drawn = [];

var BOUNDARY_DB = [];
var boundary_points = [];

var polygon_group;
var setColor;


var link_group, zone_outlines, dijkstra_group, road_group;


var YYYY, MM, DD;





// ************************************************************************************
// ************** Date forwards / backwards function **********************************
// ************************************************************************************


function update_url(node, date) {
    // console.log('UPDATING URL', date)
    // if (date == undefined || date== 'undefined') {
    let new_date = new Date()
    let today = new_date.getDate() + "-" + (new_date.getMonth() + 1) + "-" + new_date.getFullYear();
    // }

    var searchParams = new URLSearchParams(window.location.search)

    searchParams.set("node", node);

    console.log('DATES', today, date, today == date)
    if (today != date) {
        searchParams.set("date", date);

    }
    var newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
    window.history.pushState(null, '', newRelativePathQuery);
    console.log('updated URL', node, date)
}


function onchange_feature_select(node_id, date) {
    console.log("onchange_feature_select", window.location.href);
    //let features = sensor_metadata["acp_type_info"]["features"];

    set_date_onclicks(node_id);
    // Change the URL in the address bar
    update_url(node_id, date);
}

function set_date_onclicks(node_id) {
    // set up onclick calls for day/week forwards/back buttons
    document.getElementById("back_1_week").onclick = function () {
        voronoi_viz.date_shift(-7, node_id)
    };
    document.getElementById("back_1_day").onclick = function () {
        voronoi_viz.date_shift(-1, node_id)
    };
    document.getElementById("forward_1_week").onclick = function () {
        voronoi_viz.date_shift(7, node_id)
    };
    document.getElementById("forward_1_day").onclick = function () {
        voronoi_viz.date_shift(1, node_id)
    };
}

