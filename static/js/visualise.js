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




//creates a d3 color interpolator 
//from the min/max values of the data
function setColorRange() {

    let values = getMinMax();
    let min = values.min;
    let max = values.max;

    //create a d3 color interpolator
    return d3.scaleSequential().domain([min, max])
        .interpolator(d3.interpolateRdYlGn);
}

//MAKE A FUNCTION OF SITE_DB
//computs min and max values from the data
//this lets us create appropriate color ranges
function getMinMax() {
    //finds min/max from the *selected* setting 
    //(can be speed deviation, current speed, normal speed)
    let findMax = (ma, v) => Math.max(ma, v.selected)
    let findMin = (mi, v) => Math.min(mi, v.selected)

    let max = SITE_DB.reduce(findMax, -Infinity)
    let min = SITE_DB.reduce(findMin, Infinity)

    //we used placeholder value during development
    //to privide higher color differences

    return {
        "min": min, //-5
        "max": max //10
    };
}




// ************************************************************************************
// ************** Date forwards / backwards function **********************************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n, node_id) {
    let year, month, day;
    console.log('date_shift()');
    if (YYYY == '') {
        year = plot_date.slice(0, 4);
        month = plot_date.slice(5, 7);
        day = plot_date.slice(8, 10);
    } else {
        year = YYYY;
        month = MM;
        day = DD;
    }

    console.log(year, month, day) //document.getElementById('date_now_header')
    let new_date = new Date(document.getElementById('date_now_header').innerHTML); // as loaded in page template config_ values;
    console.log('new_date', new_date)

    new_date.setDate(new_date.getDate() + n);
    console.log('new_new_date', new_date)

    let new_year = new_date.getFullYear();
    let new_month = ("0" + (new_date.getMonth() + 1)).slice(-2);
    let new_month_long = new_date.toLocaleString('default', {
        month: 'long'
    });

    let new_day = ("0" + new_date.getDate()).slice(-2);

    let query_date = new_year + "-" + new_month + "-" + new_day;
    document.getElementById('date_now_header').innerHTML = new_day + " " + new_month_long + " " + new_year

    show_node_information(node_id, query_date);

    let url_date = new_day + '-' + new_month + '-' + new_year;
    update_url(node_id, url_date);
}



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
        date_shift(-7, node_id)
    };
    document.getElementById("back_1_day").onclick = function () {
        date_shift(-1, node_id)
    };
    document.getElementById("forward_1_week").onclick = function () {
        date_shift(7, node_id)
    };
    document.getElementById("forward_1_day").onclick = function () {
        date_shift(1, node_id)
    };
}

