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
var svg_canvas;

const ICON_CLOSE_DIV = "<span id='close' onclick='this.parentNode.style.opacity=0; return false;'>x</span>"
const ICON_CLOSE_AND_DESELECT = "<span id='close' onclick='this.parentNode.style.opacity=0; deselect_all(); this.SELECTED_SITE=undefined; return false;'>x</span>"

const ICON_LOADING = '<img src="./static/images/loading_icon.gif "width="100px" height="100px" >';



//----------------------------------//
//---------Drawing Links------------//
//----------------------------------//

//draws a link between two sites
//[*link* is link id, *dur* is the animation duration, *color* (optional) link's color when drawn]
function drawLink(link, dur, color) {

    //add the link_group to the canvas again 
    //(we detach it previously to make it invisible after mouseout is being performed)
    link_group = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //find the sites that the link connects
    let connected_sites = all_links.find(x => x.id === link).sites;

    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    //acquire the direction of the link by checking if it's opposite exists.
    //If the opposite's drawn on screen, make arc's curvature inverse.
    let direction = links_drawn.includes(inverseLink(link)) ? "in" : "out";

    //calculate the speed deviation for the link in question
    let deviation = calculateDeviation(link) //negative slower, positive faster

    //acquire the minmax values for the color scale.
    //we create a new color scale, even though the old one exits
    //because the drawn links always colored based on speed deviation, 
    //whereas the general setColorScale can be changed to speed ranges etc.
    let values = getMinMax();

    var scale = d3.scaleLinear()
        .domain([values.min, values.max])
        .range([values.min, values.max]);

    //if color's not defined, color the link based on speed deviation
    color = color == undefined ? setColor(scale(deviation)) : color;

    let strokeWeight = 5;

    //animate the line
    let link_line = generate_arc(from, to, direction, strokeWeight, color);
    let line_length = link_line.node().getTotalLength();
    animateMovement(link_line, line_length, dur);

    //add to the drawn list so we know what the opposite link's
    //direction is
    links_drawn.push(link);
}

//find the opposite of the link by looking at the *to* and *from*
//nodes and changing the directionality
function inverseLink(link) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    let links = findLinks(from.id, to.id);
    return link === links.in.id ? links.out.id : links.in.id;

}

//----------Generating and Drawing Arcs--------//

function generate_arc(A, B, direction, strokeWeight, stroke) {

    return link_group
        .append('path')
        .attr('d', curvedLine(A.x, A.y, B.x, B.y, direction === "in" ? 1 : -1))
        .attr('class', 'arc_line')
        .style("fill", "none")
        .style("fill-opacity", 0)
        .attr("stroke", stroke)
        .attr("stroke-opacity", 1)
        .style("stroke-width", strokeWeight);
}

//compute the arc points given start/end coordinates
//[start/end coordinates, dir stands for direction]
function curvedLine(start_x, start_y, end_x, end_y, dir) {

    //find the middle location of where the curvature is 0
    let mid_x = (start_x + end_x) / 2;

    let a = Math.abs(start_x - end_x);
    let b = Math.abs(start_y - end_y);

    //curvature height/or how curved the line is
    //[y offset in other words]
    let off = a > b ? b / 10 : 15;

    let mid_x1 = mid_x - off * dir;

    //calculate the slope of the arc line
    let mid_y1 = slope(mid_x1, start_x, start_y, end_x, end_y);

    return ['M', start_x, start_y, // the arc start coordinates (where the starting node is)
            'C', // This means we're gonna build an elliptical arc
            start_x, ",", start_y, ",",
            mid_x1, mid_y1,
            end_x, ',', end_y
        ]
        .join(' ');
}

//computes the slope on which we place the arc lines
//indicate links between sites
function slope(x, x1, y1, x2, y2) {
    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;
    let slope = (y2 - y1) / (x2 - x1);
    return (-1 / slope) * (x - midX) + midY;
}

function animateMovement(line, outboundLength, dur) {

    return line
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function (d, i) {
                // d3.select(this).remove()
            }
        );
}

function drawLinks(start_x, start_y, end_x, end_y, dur, fill) {

    let link_in = link_group
        .append('path')
        .attr('d', curvedLine(start_x, start_y, end_x, end_y, 1))
        .style("fill", fill)
        .style("fill-opacity", 0)
        .attr("stroke", "blue")
        .attr("stroke-opacity", 0.5)
        .style("stroke-width", 2);

    let link_out = link_group
        .append('path')
        .attr('d', curvedLine(end_x, end_y, start_x, start_y, -1))
        .style("fill", fill)
        .style("fill-opacity", 0)
        .attr("stroke", "red")
        .attr("stroke-opacity", 0.5)
        .style("stroke-width", 2)

    //we only calcuate the lenght once since it's the same for both directions
    let outboundLength = link_out.node().getTotalLength();


    //Drawing animation
    link_in
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function () {}
        );

    link_out
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function () {}
        );
}



function colorTransition(value) {
    SITE_DB.forEach((element) => {
        element.setVisualisation(value);
    });
    var setColor = setColorRange();

    polygon_group.selectAll(".cell")
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

function change_modes() {
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
            polygon_group.remove();
            for (let j = 0; j < SITE_DB.length; j++) {

                let id = SITE_DB[j].id;

                let neighbors = SITE_DB.find(x => x.id === id).neighbors;

                //REALLY BROKEN, BOTH DIRECTIONS SHOW THE SAME COLOR;  
                for (let i = 0; i < neighbors.length; i++) {
                    //console.log(i);
                    let inbound = neighbors[i].links.in.id;
                    let outbound = neighbors[i].links.out.id;

                    drawLink(inbound, 1000);
                    drawLink(outbound, 1000);

                }
            }
        }
        if (this.value === "polygons") {
            draw_voronoi();
            generate_hull();

        }
    });
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


//Generate a graph that is used by the Dijkstra algorithm.
//Find all the weights for node edges between the *start* and *finish* nodes
function generate_graph(start, finish) {

    let graph = {};

    //iterate over the SITE_DB to find the start/finish nodes
    //and all the other nodes in between
    SITE_DB.forEach((element) => {

        let neighbors = element.neighbors;

        let obj = {};

        //each neighbour is a node. Computes the weighted graph:
        neighbors.forEach((neighbor) => {

            //and the travel time between the nodes is the edge weight
            if (neighbor.site == start) {
                obj["S"] = neighbor.travelTime; //or dist;
            }

            if (neighbor.site == finish) {
                obj["F"] = neighbor.travelTime; //or dist;
            } else {
                obj[neighbor.site] = neighbor.travelTime;
            }
        });

        if (element.name == start) {
            graph["S"] = obj;
        }

        if (element.name == finish) {
            graph["F"] = obj;

        } else {
            graph[element.name] = obj;
        }

    });

    return graph;
}

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

//calculates speed deviation for a given link
function calculateDeviation(link) {
    let dist = all_links.find(x => x.id === link).length;
    let travelTime, normalTravelTime;
    try {
        travelTime = all_journeys.find(x => x.id === link).travelTime;
        normalTravelTime = all_journeys.find(x => x.id === link).normalTravelTime;
    } catch {
        return undefined
    }

    if (travelTime == null || travelTime == undefined) {
        travelTime = normalTravelTime;
    }

    let current = (dist / travelTime) * TO_MPH;
    let normal = (dist / normalTravelTime) * TO_MPH; //historic speed

    //negative speed is slower, positive speed is faster
    return current - normal;

}


//a general mapping function that takes a value and interpolates it
//in a different range
function map_values(value, start1, stop1, start2, stop2) {
    let result = start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));

    if (result > start2) {
        result = start2;
    }
    if (result < start1) {
        result = start1;
    }
    return result;
}

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


function generate_hull() {

    //get a list of group ids  e.g (north, south, center etc)
    ZONES.forEach((group_id) => {

        let site_id_list = CELL_GROUPS[group_id]['acp_ids']
        let point_list = []
        let point_pairs = []
        //get a list of site IDs inside a group e.g ('SITE_CA31BF74-167C-469D-A2BF-63F9C2CE919A',... etc)
        site_id_list.forEach((site_acp_id) => {
            // let site_id='{'+site_acp_id.replace(SITE_PREFIX,'')+'}';
            // console.log('SITE',site_acp_id, site_id)

            let element = d3.select('#' + site_acp_id).node();
            let total_len = parseInt(element.getTotalLength());

            for (let u = 0; u < total_len; u += 2) {
                point_pairs.push([element.getPointAtLength(u).x, element.getPointAtLength(u).y])
                point_list.push(element.getPointAtLength(u))
            }

        });

        //perhaps 185 for all will just work as well
        let concavity_threshold;
        if (map._zoom <= 12) {
            concavity_threshold = 85
        } else {
            concavity_threshold = 185;

        }

        let defaultHull = d3.concaveHull().distance(concavity_threshold);
        let paddedHull = d3.concaveHull().distance(concavity_threshold).padding(5);

        CELL_GROUPS[group_id]['default_hull'] = defaultHull(point_pairs);
        CELL_GROUPS[group_id]['padded_hull'] = paddedHull(point_pairs);


        let padded_zone_outline = paddedHull(point_pairs)[0]

        let points = []

        for (let j = 0; j < padded_zone_outline.length; j++) {
            points.push({
                'x': padded_zone_outline[j][0],
                'y': padded_zone_outline[j][1]
            })
        }

        CELL_GROUPS[group_id]['points'] = points;

    })
}

function get_outline(zone_id) {
    //generate_hull(); // perhaps should initiate somewhere else

    let cell_group_list = Object.keys(CELL_GROUPS);

    var lineFunction = d3.line()
        .x(function (d, i) {
            return d.x;
        })
        .y(function (d, i) {
            return d.y;
        });
    //.curve(d3.curveBasisClosed);
    //.curve(d3.curveCatmullRomClosed.alpha(0.95)); //d3.curveCardinal.tension(0.1)//d3.curveNatural

    if (zone_id != undefined) {
        zone_outlines.append("g")
            .append("path")
            .attr('class', 'zone_outline')
            .attr("d", lineFunction(CELL_GROUPS[zone_id]['points']))
            .style("stroke-width", 5)
            .style("stroke", CELL_GROUPS[zone_id]['color'])
            .style("fill", "none")
            .style("opacity", 0)
            .transition()
            .duration(500)
            .ease(d3.easeLinear)
            .style("opacity", 1)

            .on("end", function (d, i) {});
    } else {
        for (let j = 0; j < cell_group_list.length; j++) {
            zone_outlines.append("g")
                .append("path")
                .attr('class', 'zone_outline')
                .attr("d", lineFunction(CELL_GROUPS[cell_group_list[j]]['points']))
                .style("stroke-width", 5)
                .style("stroke", CELL_GROUPS[cell_group_list[j]]['color'])
                .style("fill", "none")
                .style("opacity", 0)
                .transition()
                .duration(500)
                .ease(d3.easeLinear)
                .style("opacity", 1)

                .on("end", function (d, i) {});
        }
    }

}

function set_nav_date_visible(trigger) {
    let nav_date_list = document.getElementsByClassName('nav_date')
    for (let i = 0; i < nav_date_list.length; i++) {
        nav_date_list[i].style.opacity = trigger;
    }
}



// ************************************************************************************
// ************** Date forwards / backwards function **********************************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n, node_id) {
    let year, month, day;
    console.log('date_shift()');
    if (this.YYYY == '') {
        year = plot_date.slice(0, 4);
        month = plot_date.slice(5, 7);
        day = plot_date.slice(8, 10);
    } else {
        year = this.YYYY;
        month = this.MM;
        day = this.DD;
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
    console.log('UPDATING URL', date)
    if (date == undefined || date== 'undefined') {
        console.log('URL UNDEFINED')
        let new_date = new Date()
        date = new_date.getDate() + "-" + new_date.getMonth() + 1 + "-" + new_date.getFullYear();
    }
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set("node", node);
    searchParams.set("date", date);
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


function select_cell(id) {
    deselect_all()
    let cell = document.getElementById(id)
    cell_clicked(cell)
}

function select_all() {
    let cells = document.getElementsByClassName("cell")
    for (let i = 0; i < cells.length; i++) {
        cell_clicked(cells[i])
    }

}


function deselect_all() {
    let cells = document.getElementsByClassName("cell")
    for (let i = 0; i < cells.length; i++) {
        cell_regular(cells[i])
    }
}


//cell manipulation + interactivity
var cell_mouseover = (cell) => {
    d3.select(cell).transition()
        .duration('300')
        .style('stroke', 'black')
        //.style('stroke-width', 10)
        .style("stroke-opacity", 1)
        .style("fill-opacity", 0.85);
}
var cell_mouseout = (cell) => {
    d3.select(cell).transition()
        .duration('300')
        .style('stroke', 'black')
        // .style('stroke-width', 0.5)
        .style("stroke-opacity", 0.3)
        .style("fill-opacity", 0.3);
}

var cell_clicked = (cell) => {
    d3.select(cell)
        .style('stroke-opacity', 1).style('stroke', 'black').style('stroke-width', 4);

}
var cell_regular = (cell) => {
    d3.select(cell)
        .style('stroke', 'black')
        .style('stroke-width', 0.5)
        .style("stroke-opacity", 0.3)
        .style("fill-opacity", 0.3);
}