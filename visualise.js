// Javascript functions for displaying Bluetruth data

/* eslint no-console: "off" */
/*global $, L, LOCATIONS_URL, JOURNEYS_URL, MB_ACCESS_TOKEN, TF_API_KEY */

// m/sec to mph

var API_TOKEN = 'a62fb5390f070c129591b6ff19c0a8cf06440efc'; //'6909103b0bfbc5e949a31a840f31e17efd58754f';

var TO_MPH = 2.23694;

// Style options for markers and lines
var SITE_OPTIONS = {
    color: 'black',
    fillColor: 'green',
    fill: true,
    fillOpacity: 0.8,
    radius: 7,
    pane: 'markerPane'
};

var NORMAL_LINE = {
    weight: 5,
    offset: -3
};
var HIGHLIGHT_LINE = {
    weight: 10,
    offset: -6
};

var NORMAL_COLOUR = '#3388ff';
var VERY_SLOW_COLOUR = '#9a111a';
var SLOW_COLOUR = '#e00018';
var MEDIUM_COLOUR = '#eb7F1b';
var FAST_COLOUR = '#85cd50';
var BROKEN_COLOUR = '#b0b0b0';

// Script state globals
var map, // The Leaflet map object itself
    sites_layer, // layer containing the sensor sites
    links_layer, // Layer containing the point to point links
    compound_routes_layer, // Layer containing the compound routes
    voronoi_layer,
    layer_control, // The layer control
    clock, // The clock control
    hilighted_line, // The currently highlighted link or route
    speed_display = 'actual', // Line colour mode - 'actual', 'normal' or 'relative'
    line_map = {}; // Lookup link/route id to displayed polyline


var all_sites, all_links, journeys = [];

var minmax, myColors;
var SITE_DB = [];
var links_drawn = [];

var newPts = [];

var BOUNDARY_DB = [];
var boundaryPoints = [];

var combined = [];

var points = [];
points = all_sites;


var voronoi, adjustedSites, vertices, DATA;
var travelTimes;
var travelSpeed;
var historicSpeed;
var speedDeviation;

var pathGroup;
var setColor;

var selectedSites = [];

var lineGroup, dijkstraGroup;


class SpaceFloorplan {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        // this.viz_tools = new VizTools();

        // Transform parameters to scale SVG to screen
      
    }

    // init() called when page loaded
    // init() {}

}

/*------------------------------------------------------*/
/*----------------------MAIN LOOP-----------------------*/
/*------------------------------------------------------*/
$(document).ready(function () {
    initMap();
    load_data();
    add_roads();
});


function get_svg_data(file_name){
    console.log('getting','static/'+file_name)
    $.get('static/'+file_name, function(data) {
        let a =new XMLSerializer().serializeToString(data)
        console.log(a.slice(0, 25));
        console.log('done')
        let y=0.008;
    let x=0.018;
    let road_a = [52.15245+y, 0.004669+x]
    let road_b = [52.23011+y, 0.19+x]
   
    var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
    svgElement.setAttribute("viewBox", "0 0 973.7 808.7");
    svgElement.innerHTML = a;
    var svgElementBounds = [ road_a, road_b];
    console.log('L.svgOverlay')
    L.svgOverlay(svgElement, svgElementBounds, {interactive: true}).addTo(map);

        // $bg.append(data);
    });
}
function add_roads() {
    // let wgb_a = [52.210499, 0.091332]
    // let wgb_b = [52.211359, 0.092735]
    // wgb_svg_data = '<path class="st0" id="wgb" d="M507.5,169.1l16.6-61L129.1,0.3L0.3,472.1l147.6,40.3l17.2-60.7L412,519l16.4-60l-27.3-6.4l31-126l28,5l18-70l-27-7l24-94L507.5,169.1z M333.4,429l-144.6-38.5L221.9,266l144.6,38.5L333.4,429z M384.4,236.4l-141.2-37.6l24.7-92.8l141.2,37.6L384.4,236.4z"/></svg>'
    // wgb_bounds = [wgb_a, wgb_b];
    // var wgb_svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // wgb_svg.setAttribute('xmlns', "http://www.w3.org/2000/svg");
    // wgb_svg.setAttribute("viewBox", "0 0 524.4 519.3");
    // wgb_svg.innerHTML = wgb_svg_data;
    // var wgb_bounds = [wgb_a, wgb_b];
    // L.svgOverlay(wgb_svg, wgb_bounds, {
    //     interactive: true
    // }).addTo(map);

    console.log('adding roads')
    let y=0.008;
    let x=0.018;
    let road_a = [52.15245+y, 0.004669+x]
    let road_b = [52.23011+y, 0.19+x]
    L.marker(road_a).addTo(map);
    L.marker(road_b).addTo(map);

    get_svg_data('roads.svg')

    


    // var road_loc = 'static/roads.svg',
    //     road_bounds = [road_a, road_b];
    // L.imageOverlay(road_loc, road_bounds, {
    //     interactive: true
    // }).addTo(map);
    console.log('roads added', map)

    //L.imageOverlay(wgb_loc, wgb_bounds).bringToFront();
}
// Async load data, display it and reschedule
function load_data() {
    console.log("load initiated with " + API_TOKEN);
    var headers = {
        Authorization: 'Token ' + API_TOKEN
    };


    $.when(
            $.get({
                url: 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/site/',
                headers: headers,
                dataType: 'json',
            }, function () {
                console.log("loaded")
            }),
            $.get({
                url: 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/link/',
                headers: headers,
                dataType: 'json',
            }),
            $.get({
                url: 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/route/',
                headers: headers,
                dataType: 'json',
            }),
            $.get({
                url: 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/latest/',
                headers: headers,
                dataType: 'json',
            })
        )
        .done(function (site_response, link_response, route_response, journey_response) {
            console.log("done starting");

            all_sites = site_response[0].site_list;
            all_links = link_response[0].link_list; //.concat(route_response[0].route_list);
            console.log(link_response[0].link_list.length, route_response[0].route_list.length)
            console.log('NEW ', all_sites[0], all_links[0]);

            // Sites
            // all_sites = locations.sites;
            // all_links = locations.links

            journeys = journey_response[0].request_data;
            console.log('journeysA', journeys)
            //draw_sites(sites);
            //process_journeys(journeys, links, sites);

            // Display the data's timestamp on the clock
            var timestamp = journey_response[0].ts * 1000;
            clock.update(new Date(timestamp));


            // The underlying API updates journey times every 5 minutes.
            // Schedule an update 5 and-a-bit minutes from the last
            // timestamp if that looks believable, and in a minute
            // otherwise.
            var now = Date.now();
            var delta = timestamp - now + (5.25 * 60000);
            if (delta <= 0 || delta > 10 * 60000) {
                delta = 60000;
            }
            console.log('Timestamp was ' + new Date(timestamp));
            console.log('Delta is ' + delta);
            console.log('Now is ' + new Date(now));
            console.log('Next at ' + new Date(now + delta));
            setTimeout(load_data, delta);

            // Reset the clock
            clock.update();

            // Re-schedule for a minute in the future
            // setTimeout(load_journey_times, 60000);

            d3.select('svg').remove(); //#overlay
            drawVoronoi();
            // add_roads();

        })

        // If anything went wrong, try again in a minute
        .fail(function () {
            console.log('API call failed - default reschedule');
            setTimeout(load_data, 60000);
        });

}


// Set line colour based on travel time (aka speed) compared to normal
function update_relative_speed(polyline) {

    var journey = polyline.properties.journey;
    var choice;
    // Missing
    if (!journey.travelTime) {
        choice = BROKEN_COLOUR;
    }
    // Worse than normal
    else if (journey.travelTime > 1.2 * journey.normalTravelTime) {
        choice = SLOW_COLOUR;
    }
    // Better then normal
    else if (journey.travelTime < 0.8 * journey.normalTravelTime) {
        choice = FAST_COLOUR;
    }
    // Normal(ish)
    else {
        choice = NORMAL_COLOUR;
    }
    polyline.setStyle({
        color: choice
    });

}

// Set line colour based on actual or expected speed
function update_actual_normal_speed(polyline) {

    var journey = polyline.properties.journey;
    var line = polyline.properties.line;
    var time = speed_display === 'actual' ? journey.travelTime : journey.normalTravelTime;
    var speed = (line.length / time) * TO_MPH;
    var choice;
    if (time === null) {
        choice = BROKEN_COLOUR;
    } else if (speed < 5) {
        choice = VERY_SLOW_COLOUR;
    } else if (speed < 10) {
        choice = SLOW_COLOUR;
    } else if (speed < 20) {
        choice = MEDIUM_COLOUR;
    } else {
        choice = FAST_COLOUR;
    }
    polyline.setStyle({
        color: choice
    });
}




function get_clock() {
    var control = L.control({
        position: 'topleft'
    });
    control.onAdd = function () {
        var div = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control-layers-expanded clock');
        div.innerHTML = 'Loading...';
        return div;
    };
    control.update = function () {
        //needs fixing as time end us being 1:1 instead of 01:01
        var now = new Date();
        var hh = now.getHours();
        var mm = now.getMinutes();
        var ss = now.getSeconds();
        // If datetime is today
        control.getContainer().innerHTML = 'Updated ' + hh + ':' + mm;
        
        console.log("updated")

    };
    return control;
}



function initMap() {

    var stamenToner = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
        attribution: 'Map tiles by Stamen Design, CC BY 3.0 - Map data © OpenStreetMap',
        subdomains: 'abcd',
        minZoom: 0,
        maxZoom: 20,
        ext: 'png'
    });
    var cambridge = new L.LatLng(52.20038, 0.165);
    map = new L.Map("map", {
        center: cambridge,
        zoom: 12,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 95, 
        layers: [stamenToner],
    });

    // Clock
    clock = get_clock().addTo(map)

    var info_widget = L.control();
    var datepicker_widget = L.control();

    info_widget.onAdd = function (map) {
        this.info_div = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        this.update();

        return this.info_div;
    };

    datepicker_widget.onAdd = function (map) {
        this.datepicker_div = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        //this.datepicker_div.id="datepicker";
        this.update();

        return this.datepicker_div;
    };

    info_widget.update = function (e) {
        if (e === undefined) {
            this.info_div.innerHTML =
                '<h4>Information</h4>' +
                "<br>" +
                "<div>" +
                "<form id='routes'>" +
                "<input type='radio' name='mode' value='routes'> Routes<br>" +
                "<input type='radio' name='mode' value='polygons'> Polygons" +
                "</form>" +
                "<br>" +
                "</div>" +
                "<br>" +
                "<div>" +
                "<form id='modes'>" +
                "<input type='radio' name='mode' value='current'> Current Speed<br>" +
                "<input type='radio' name='mode' value='historic'> Normal Speed<br>" +
                "<input type='radio' name='mode' value='deviation'> Deviation<br>" +
                "</form>" +
                "</div>";

            return;
        }
        d3.select(".info").attr("id", "test").append("div").attr("class", "hover_val").text("Hello World");
    };

    datepicker_widget.update = function (e) {
        if (e === undefined) {
            this.datepicker_div.innerHTML =
                '<h4>Pick time and Date</h4>' +
                '<br>' +
                '<input type="text" name="datefilter" id="datepicker" value="" />';



            return;
        }

    };

    info_widget.addTo(map);
    datepicker_widget.addTo(map);


    map.on("viewreset moveend", drawVoronoi);

}

function drawVoronoi() {


    travelTimes = [];
    travelSpeed = [];
    historicSpeed = [];
    speedDeviation = [];


    d3.select(".hover_val").remove();

    // Reset the clock
    clock.update();

    // voronoi = d3.voronoi().extent([
    //     [0, 0],
    //     [2000, 2000]
    // ]); 

    // draw the flow line
    let flowLine = d3.line()
        .x((d) => {
            return d.x;
        })
        .y((d) => {
            return d.y;
        })
        .curve(d3.curveBundle.beta(0.5));

    SITE_DB = [];
    BOUNDARY_DB = [];
    filteredPoints = [];

    InitialiseNodes();



    for (let i = 0; i < SITE_DB.length; i++) {
        travelTimes.push(SITE_DB[i].travelTime);
        travelSpeed.push(SITE_DB[i].travelSpeed);
        historicSpeed.push(SITE_DB[i].travelSpeed);
        speedDeviation.push(SITE_DB[i].speedDeviation);
    }


    var bounds = map.getBounds(),
        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
        drawLimit = bounds.pad(0.4);

    filteredPoints = [];


    filteredPoints = all_sites.filter(function (d, i) {
        let latlng = new L.latLng(d.location.lat, d.location.lng);
        if (!drawLimit.contains(latlng)) {
            return false
        };

        let point = map.latLngToLayerPoint(latlng);
        d.x = point.x;
        d.y = point.y;

        SITE_DB[i].x = d.x;
        SITE_DB[i].y = d.y;
        SITE_DB[i].lat = d.location.lat;
        SITE_DB[i].lng = d.location.lng;

        return true;
    });

    boundaryPoints = boundarySites.filter(function (d, i) {
        let latlng = new L.latLng(d.lat, d.lng);
        if (!drawLimit.contains(latlng)) {
            return false
        };

        let point = map.latLngToLayerPoint(latlng);
        d.x = point.x;
        d.y = point.y;

        BOUNDARY_DB.push({
            "lat": d.lat,
            "lng": d.lng,
            "x": d.x,
            "y": d.y
        });
        return true;
    });

    setColor = setColorRange();

    // var maxLength = d3.max(filteredPoints, function (e) {
    //     return +e.length;
    // });
    // var color = d3.scaleLinear()
    //     .domain([0, maxLength])
    //     .range(['rgb(255,245,235)', 'rgb(127,39,4)']);

    findLatLng();

    var voronoi = d3.voronoi()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        })
        .extent([
            [topLeft.x, topLeft.y],
            [bottomRight.x, bottomRight.y]
        ]); // To get all points included, change from previous version


    //tempfix
    let a = filteredPoints;
    let b = boundaryPoints;
    let c = getCircle();
    for (let i = 0; i < b.length; i++) {
        a.push(b[i]);
    }
    var voronoiPolygons = voronoi.polygons(a); //filteredpoints
    var readyVoronoiPolygons = [];

    for (let i = 0; i < voronoiPolygons.length; ++i) {
        // console.log(i)
        if (voronoiPolygons[i] !== undefined) {
            readyVoronoiPolygons.push(voronoiPolygons[i]);
        }
    }

    // var voronoiBoundaryPolygons = voronoi.polygons(boundaryPoints);
    // for (let i = 0; i < voronoiBoundaryPolygons.length; ++i) {
    //     if (voronoiBoundaryPolygons[i] !== undefined) {
    //         readyVoronoiPolygons.push(voronoiBoundaryPolygons[i]);
    //     }
    // }

    d3.select("svg").remove();
    //d3.selectAll(".tooltip").remove(); //style("visibility", "hidden")

    var voronoi_cells = d3.select(map.getPanes().overlayPane).append("svg")
        .attr("id", "overlay")
        .attr("class", "leaflet-zoom-hide")
        .style("width", map.getSize().x + "px")
        .style("height", map.getSize().y + "px")
        .style("margin-left", topLeft.x + "px")
        .style("margin-top", topLeft.y + "px");

    pathGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
    var circleGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    var circleGroupB = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    lineGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    dijkstraGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    // create a tooltip
    var tooltip = d3.select(map.getPanes().tooltipPane)
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")

        .style("stroke", "black")
        .style("background", "white")
        .on("mouseover", function (d, i) {
            d3.select(this).style("visibility", "visible")
        })
        .style("visibility", "hidden");


    pathGroup.selectAll("g")
        .data(readyVoronoiPolygons)
        .enter()
        .append("path")
        //.attr("class","cell")//"cell"
        .attr("class", function (d, i) {
            //console.log(d.data.description);
            if (d.data.description !== undefined) {
                return "cell"
            } else {
                return "invisibleCell"
            }
        })
        .attr("z-index", -1)
        .attr("d", function (d) {
            return "M" + d.join("L") + "Z"
        });

    pathGroup.selectAll(".cell")
        .attr("id", function (d) { //let id="test"+d;
            //console.log(d.data.name);
            return d.data.name
        })
        .attr('fill', function (d, i) {
            // console.log("\ni", i, SITE_DB[i]);

            let color = SITE_DB[i].selected;
            if (color == null || color == undefined) {
                return "rgb(50,50,50);"
            } else {
                return setColor(color) //c10[i % 10]
            }
        })
        //.style("stroke", "rgb(0,0,0)")
        //.style("fill-opacity", 0.3)
        //.style("stroke-opacity", 0.3)

        .on('mouseover', function (d, i) {
            lineGroup.remove();
            lineGroup = voronoi_cells.append("g")
                .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
            //info.update(d.data);
            //console.log(SITE_DB[i].name); //WRONG APPROACH, CAUSES RANODM OBJECT DRIFTS
            // /console.log(d.data.name); //SHOULD FIX THE PROBLEM WITH BS MARKING ON THE MAP AND RANDOM RELOCATIONS
            d3.select(this).transition()
                .duration('300')
                .attr('stroke', 'black')
                .attr('stroke-width', '2px')
                .style("stroke-opacity", 1)
                .style("fill-opacity", 0.6);

            let id = d.data.id;

            let neighbors = SITE_DB.find(x => x.id === id).neighbors;

            for (let i = 0; i < neighbors.length; i++) {
                //console.log(i);
                let inbound = neighbors[i].links.in.id;
                let outbound = neighbors[i].links.out.id;

                drawLink(inbound, 350);
                drawLink(outbound, 350);

            }

            // tooltip.style("visibility", "visible")
            //     .text(SITE_DB[i].name);

            //d3.select(".hover_val").remove();
            //d3.select(".info").attr("id", "test").append("div").attr("class", "hover_val").text(SITE_DB[i].name);//selected


        })



        .on("mousemove", function (d, i) {
            //  tooltip.style("top", (SITE_DB[i].y) + "px") //(event.clientY)+"px"
            //    .style("left", (SITE_DB[i].x) + "px"); //(event.clientY)+"px"
            //  console.log(event.clientX,event.clientY);

        })

        .on("click", function (d) { //dblclick
            let id = d.data.id;
            console.log(id, " was clicked");

            selectedSites.push(d.data);
            if (selectedSites.length > 2) {
                selectedSites = [];
                console.log("selected sites cleaned");
            }
            if (selectedSites.length === 2) {
                console.log("from ", selectedSites[0].name, " to ", selectedSites[1].name);

                let problem = generateGraph(selectedSites[0].name, selectedSites[1].name);
                let result = dijkstra(problem, selectedSites[0].name, selectedSites[1].name);
                console.log(result);

                let path = [];
                //console.log(SITE_DB);
                for (let i = 0; i < result.path.length; i++) {

                    console.log(result.path[i]);
                    //   d3.select(document.getElementById(result.path[i]))
                    // .transition()
                    // .duration(1000)
                    // .attr("class","selected");
                    //.attr("fill-opacity", 0.5)
                    //.attr("fill", "black");

                    var found = SITE_DB.find(x => x.name == result.path[i]);

                    //console.log(found);
                    //console.log(xc[id]);
                    if (found.x != null || found.x != undefined) {
                        path.push({
                            "x": found.x,
                            "y": found.y
                        });;
                    }



                }
                //console.log("P ", path);
                // 7. d3's line generator
                var line = d3.line()
                    .x(function (d, ) {
                        return d.x;
                    }) // set the x values for the line generator
                    .y(function (d) {
                        return d.y;
                    }) // set the y values for the line generator 
                    // apply smoothing to the line
                    .curve(d3.curveCatmullRom.alpha(1)); //d3.curveCardinal.tension(0.1)//d3.curveNatural

                var lineGraph = dijkstraGroup.append("path")
                    .attr("d", line(path))
                    .attr("stroke", "green")
                    .attr("stroke-width", 5)
                    .attr("fill", "none");

                var totalLength = lineGraph.node().getTotalLength();

                lineGraph
                    .attr("stroke-dasharray", totalLength + " " + totalLength)
                    .attr("stroke-dashoffset", totalLength)
                    .transition()
                    .duration(500)
                    .ease(d3.easeLinear)
                    .attr("stroke-dashoffset", 0);

                selectedSites = [];
            }


            d3.select(this).attr("class", "selected");
        })
        //.on("click",  d3.selectAll(".tooltip").style("visibility", "hidden"))
        .on('mouseout', function (d, i) {
            lineGroup.remove();
            links_drawn = [];
            d3.select(this).transition()
                .duration('500')
                //JUST CHANGE TO CLASS
                .attr('stroke', 'black')
                .attr('stroke-width', '0.5px')
                .style("stroke-opacity", 0.3)
                .style("fill-opacity", 0.3);
            //    tooltip.text(SITE_DB[i].name)
            //        .style("visibility", "hidden");
        });




    pathGroup.selectAll(".cell").append("title").text(function (d) {
        return d.data.name;
    });

    circleGroup.selectAll(".point")
        .data(filteredPoints)
        .enter()
        .append("circle")
        .attr("class", function (d, i) {
            //console.log(d.data.description);
            if (d.id !== undefined) {
                return "point"
            } else {
                return "invisiblePoint"
            }
        })
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        .attr("r", 2.5);


    console.log("next");
    //d3.select(map.getPanes().tooltipPane).append("title").text(function(d) { return d.data.name + "\n" + d.data.selected ; })
    filteredPoints = [];

    changeModes();
}

function drawLink(link, dur) {

    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    links_drawn.push(link);

    let color = links_drawn.includes(inverseLink(link)) ? "red" : "blue";

    let values = getMinMax();
    let deviation = calculateDeviation(link)

    //console.log(deviation);

    var data = [100, 400, 300, 900, 850, 1000];

    var scale = d3.scaleLinear()
        .domain([values.min, values.max])
        .range([0.5, 10]);
    //let strokeWeight=5;
    let strokeWeight = scale(deviation);
    //console.log(deviation, strokeWeight);

    let inbound = lineGroup_(from, to, color, 5, setColor(strokeWeight));
    // let outbound =lineGroup_(to, from, "blue");

    let lineLength = inbound.node().getTotalLength();

    animateMovement(inbound, lineLength, dur);
    //animateMovement(outbound, lineLength,350);

}

function inverseLink(link) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);
    //console.log(from,to);

    let links = findLinks(from.id, to.id);
    return link === links.in.id ? links.out.id : links.in.id;

}

function lineGroup_(A, B, color, strokeWeight, col) {

    return lineGroup
        .append('path')
        .attr('d', curvedLine(A.x, A.y, B.x, B.y, color === "red" ? 1 : -1))
        .style("fill", "none")
        .style("fill-opacity", 0)
        .attr("stroke", col)
        .attr("stroke-opacity", 1)
        .style("stroke-width", strokeWeight);
}

function animateMovement(blue, outboundLength, dur) {

    return blue
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function (d, i) {

            }

        );

}

function drawLinks(x, y, X, Y, dur, fill) {
    // Add the links
    //x_coord,y_coord,d.data.x,d.data.y



    var blue = lineGroup
        .append('path')
        .attr('d', curvedLine(x, y, X, Y, 1))
        .style("fill", fill)
        .style("fill-opacity", 0)
        .attr("stroke", "blue")
        .attr("stroke-opacity", 0.5)
        .style("stroke-width", 2);

    //d.data.x,d.data.y,x_coord,y_coord
    var red = lineGroup
        .append('path')
        .attr('d', curvedLine(X, Y, x, y, -1))
        .style("fill", fill)
        .style("fill-opacity", 0)
        .attr("stroke", "red")
        .attr("stroke-opacity", 0.5)
        .style("stroke-width", 2)
    // .transition()
    //  .duration(1000)

    let outboundLength = red.node().getTotalLength();

    blue
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function (d, i) {

            }

        );

    red
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function () {
                // red.transition()
                // .duration(dur)
                // .style("fill-opacity", 1);
            }


        );
}

function curvedLine(x, y, X, Y, dir) {

    let start_X = x;
    let start_Y = y;
    let end_X = X;
    let end_Y = Y;
    let midX = (start_X + end_X) / 2;
    let a = Math.abs(start_X - end_X);
    let b = Math.abs(start_Y - end_Y);
    let off = a > b ? b / 10 : 15;

    let mid_X1 = midX - off * dir;

    let mid_Y1 = slope(mid_X1, start_X, start_Y, end_X, end_Y);
    return ['M', start_X, start_Y, // the arc starts at the coordinate x=start, y=height-30 (where the starting node is)
            'C', // This means we're gonna build an elliptical arc
            start_X, ",", start_Y, ",",
            mid_X1, mid_Y1,
            // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
            end_X, ',', end_Y
        ] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
        .join(' ');
}

function colorTransition(value) {
    SITE_DB.forEach((element) => {
        element.setVisualisation(value);
    });
    setColor = setColorRange();

    pathGroup.selectAll(".cell")
        .transition()
        .duration('1000')
        .attr('fill', function (d, i) {

            let color = SITE_DB[i].selected;
            if (color == null || color == undefined) {
                return "rgb(50,50,50);"
            } else {
                return setColor(color) //c10[i % 10]
            }
        })

}

function changeModes() {
    d3.selectAll("input").on("change", function () {
        //console.log(d);

        if (this.value === "current") {
            colorTransition("travel speed");
        }
        if (this.value === "deviation") {

            colorTransition("speed deviation");
        }
        if (this.value === "historic") {
            colorTransition("historic speed");
        }
        if (this.value === "routes") {
            console.log("routes");
            pathGroup.remove();
            for (let j = 0; j < SITE_DB.length; j++) {

                let id = SITE_DB[j].id;

                let neighbors = SITE_DB.find(x => x.id === id).neighbors;

                //REALLY BROKEN, BOTH DIRECTIONS SHOW THE SAME COLOR;  
                for (let i = 0; i < neighbors.length; i++) {
                    //console.log(i);
                    let inbound = neighbors[i].links.in.id;
                    let outbound = neighbors[i].links.out.id;

                    //drawLink(inbound,1000);
                    drawLink(outbound, 1000);

                }
            }
        }
        if (this.value === "polygons") {
            drawVoronoi();
        }
    });
}


function InitialiseNodes() {
    for (let i = 0; i < all_sites.length; i++) {
        SITE_DB.push(new Node(all_sites[i].id));
    }

    for (let i = 0; i < SITE_DB.length; i++) {
        SITE_DB[i].findNeighbors();
        SITE_DB[i].computeTravelTime();
        SITE_DB[i].computeTravelSpeed();
        SITE_DB[i].setVisualisation(null); //speed deviation//travel speed

    }
}



function findLinks(id1, id2) {
    //id1 from (outbound)
    //id2 to (inbound)

    let data = all_links; //this.links;
    let obj = {
        "out": null,
        "in": null
    }
    for (let i = 0; i < data.length; i++) {
        if (id1 == data[i].sites[0] && id2 == data[i].sites[1]) {
            obj["out"] = data[i];
        }
        if (id1 == data[i].sites[1] && id2 == data[i].sites[0]) {
            obj["in"] = data[i];
        }
    }
    return obj;
}

function findLatLng() {
    map.on('click',
        function (e) {
            var coord = e.latlng.toString().split(',');
            var lat = coord[0].split('(');
            var lng = coord[1].split(')');
            console.log("You clicked the map at latitude: " + lat[1] + " and longitude:" + lng[0]);
        });
}

function drawRoutes() {

    for (let d = 0; d < SITE_DB.length; d++) {

        let id = SITE_DB[d].id;

        let neighbors = SITE_DB.find(x => x.id === id).neighbors;

        for (let i = 0; i < neighbors.length; i++) {

            let x_coord = SITE_DB.find(x => x.id === neighbors[i].id).x;
            let y_coord = SITE_DB.find(x => x.id === neighbors[i].id).y;
        }
    }
}


function generateGraph(s, f) {

    var graph = {};
    start = s; //.name;
    finish = f; //.name;

    SITE_DB.forEach((element) => {

        let neighbors = element.neighbors;



        let obj = {};

        neighbors.forEach((neighbor) => {

            //console.log({"current":neighbor.site, "S": start, "F":finish});
            if (neighbor.site == start) {
                obj["S"] = neighbor.travelTime; //dist;
                //neighbor.site="S";    
            }

            if (neighbor.site == finish) {
                obj["F"] = neighbor.travelTime; //dist;
                //neighbor.site="F";
            } else {
                obj[neighbor.site] = neighbor.travelTime;
            } //dist;}



        });
        if (element.name == start) {
            graph["S"] = obj;
            //element.name="S";    
        }

        if (element.name == finish) {
            graph["F"] = obj;
            //element.name="F";
        } else {
            graph[element.name] = obj;
        }

    });

    //console.log(graph);
    return graph;
}

// function find_old_link_from_sites(sites){
//     var siteA=sites[0]
//     var siteB=sites[1]
//     old_links=old.json()["links"]
//     for links in old_links:
//         if links['sites'][0]==siteA and links['sites'][1]==siteB:
//             return links
//     return undefined
// }

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function calculateDeviation(link) {
    let dist = all_links.find(x => x.id === link).length;
    let travelTime, normalTravelTime;
    try {
        travelTime = journeys.find(x => x.id === link).travelTime;
        normalTravelTime = journeys.find(x => x.id === link).normalTravelTime;
    } catch {
        return undefined
    }
    //TO FIX, MAKE IT NULL
    if (travelTime == null || travelTime == undefined) {
        travelTime = normalTravelTime;
    }
    let current = (dist / travelTime) * TO_MPH;
    let normal = (dist / normalTravelTime) * TO_MPH;

    return current - normal;

}

function getNeighborObject(i) {

    let obj = {};

    neighbors.forEach((neighbor) => {
        obj[neighbor.name] = neighbor.dist;

    });

    return obj;
}


function map_values(value, start1, stop1, start2, stop2) {
    let result = start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
    //console.log(result);
    if (result > start2) {
        result = start2;
    }
    if (result < start1) {
        result = start1;
    }
    return result;
}


function setColorRange() {
    let values = getMinMax();
    let min = values.min;
    let max = values.max;


    console.log("new min_max ", min, max);

    return d3.scaleSequential().domain([-5, 10]) //min, max
        .interpolator(d3.interpolateRdYlGn);
}

function slope(x, x1, y1, x2, y2) {
    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;
    let slope = (y2 - y1) / (x2 - x1);
    return (-1 / slope) * (x - midX) + midY;
}

function getMinMax() {
    let findMax = (ma, v) => Math.max(ma, v.selected)
    let findMin = (mi, v) => Math.min(mi, v.selected)
    let max = SITE_DB.reduce(findMax, -Infinity)
    let min = SITE_DB.reduce(findMin, Infinity)
    // console.log(min,max);
    return {
        "min": -5,
        "max": 10
    };
}
