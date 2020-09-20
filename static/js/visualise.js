"use strict";

// m/sec to mph
//const TO_MPH = 2.23694;


// Script state globals
var map, // The Leaflet map object itself
    clock; // The clock control

var topLeft;

var selected_node;

var all_sites, all_links, all_journeys = [];

var links_drawn = [];

var BOUNDARY_DB = [];
var boundary_points = [];

var polygon_group;
var setColor;


var link_group, zone_outlines, dijkstra_group, road_group;
var svg_canvas;

const ICON_CLOSE_DIV = "<span id='close' onclick='this.parentNode.style.opacity=0; return false;'>x</span>"
const ICON_CLOSE_AND_DESELECT = "<span id='close' onclick='this.parentNode.style.opacity=0; deselect_all(); selected_node=undefined; return false;'>x</span>"

const ICON_LOADING = '<img src="./static/images/loading_icon.gif "width="100px" height="100px" >';

class VoronoiViz {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        // this.viz_tools = new VizTools();

        // Transform parameters to scale SVG to screen
        init_map();

    }



    // init() called when page loaded
    init() {

        load_api_data().then(() => {

            console.log('Creating Nodes');
            this.initialise_nodes();
            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            show_vertical_bar(get_zone_averages());

            console.log('loading Voronoi');
            draw_voronoi();
            generate_hull();

        });


        //have a timeout function here
        // Will execute myCallback every 1 second 
        window.setInterval(this.update, 30000);
    }

    update() {
        console.log('updated', Date.now())

        //SOMEHOW DOESNT WORK
        // initialise_nodes();
        //draw_voronoi();


        load_api_data().then(() => {

            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            show_vertical_bar(get_zone_averages());

            draw_voronoi();
            // generate_hull();
            console.log('loaded api data')


        });
        //hi();
        //this.update_nodes();

        // Display the data's timestamp on the clock
        clock.update(Date.now());

        // this.hi();

    }
    hello() {
        console.log('HI')
    }
    hi() {
        this.hello();
        console.log('HI')
    }

    initialise_nodes() {
        SITE_DB = [];

        for (let i = 0; i < all_sites.length; i++) {
            SITE_DB.push(new Node(all_sites[i].id));
        }

        for (let i = 0; i < SITE_DB.length; i++) {
            SITE_DB[i].findNeighbors();
            SITE_DB[i].computeTravelTime();
            SITE_DB[i].computeTravelSpeed();
            SITE_DB[i].setVisualisation(null); //speed deviation//travel speed

        }

        //acquire bluetooth sensor locations
        all_sites.filter(function (d, i) {
            SITE_DB[i].lat = d.location.lat;
            SITE_DB[i].lng = d.location.lng;
        });
    }

    update_nodes() {
        console.log('updating nodes')
        for (let i = 0; i < SITE_DB.length; i++) {
            SITE_DB[i].computeTravelTime();
            SITE_DB[i].computeTravelSpeed();
        }
    }

    /*------------------------------------------------------*/
    /*--------------------HELPER FUNCT----------------------*/
    /*------------------------------------------------------*/

}


//setTimeout(voronoi_visualisation.update(), delta);


function path_to_poly(path_id) {
    var numPoints = 8;

    var mypath = document.getElementById(path_id);
    var pathLength = mypath.getTotalLength();
    var polygonPoints = [];

    for (var i = 0; i < numPoints; i++) {
        var p = mypath.getPointAtLength(i * pathLength / numPoints);
        polygonPoints.push(p.x);
        polygonPoints.push(p.y);
    }

    return polygonPoints;
}

function create_element(element_id, position, inner_text) {

    //to be modified with https://stackoverflow.com/questions/33614912/how-to-locate-leaflet-zoom-control-in-a-desired-position
    let new_element = L.control({
        position: position
    }); //{       position: 'bottom'    }
    new_element.onAdd = function (map) {
        this.new_element = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        this.new_element.id = element_id;
        this.update();

        return this.new_element;
    };
    new_element.update = function (e) {
        if (e === undefined) {
            this.new_element.innerHTML = inner_text == undefined ? '' : ICON_CLOSE_DIV + inner_text;
            this.new_element.style.opacity = inner_text == undefined ? 0 : 1;
            return;
        }

    };


    return new_element.addTo(map);

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



function init_map() {

    var stamenToner = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
        attribution: 'Map tiles by Stamen Design, CC BY 3.0 - Map data © OpenStreetMap',
        subdomains: 'abcd',
        minZoom: 0,
        maxZoom: 20,
        ext: 'png'
    });
    var cambridge = new L.LatLng(52.20038, 0.1);

    map = new L.Map("map", {
        center: cambridge,
        zoom: 12,
        zoomDelta: 0.1,
        wheelPxPerZoomLevel: 150,
        layers: [stamenToner],
        doubleClickZoom: false,
    });

    map.doubleClickZoom.disable();


    // Clock
    clock = get_clock().addTo(map)

    const info_viz_text = '<h4>Information</h4>' +
        "<br>" +
        "<div>" +
        "<form id='routes'>" +
        "<input type='radio' name='mode' value='routes'> Routes<br>" +
        "<input type='radio' name='mode' value='polygons'checked='checked'> Polygons<br>" +

        "</form>" +
        "<br>" +
        "</div>" +
        "<br>" +
        "<div>" +
        "<form id='modes'>" +
        "<input type='radio' name='mode' value='current'> Current Speed<br>" +
        "<input type='radio' name='mode' value='historic'> Normal Speed<br>" +
        "<input type='radio' name='mode' value='deviation' checked='checked'> Deviation<br>" +
        "</form>" +
        "</div>";

    const datepicker_text = '<h4>Pick time and Date</h4>' +
        '<br>' +
        '<input type="text" name="datefilter" id="datepicker" value="" />';


    let line_graph_element = create_element('line_graph', 'bottomleft')
    let datepicker_widget = create_element('datepicker', 'bottomleft', datepicker_text) //datepicker_text
    document.getElementById("datepicker").style.opacity = 0;
    set_nav_date_visible(0)

    let metadata_element = create_element('metadata_table', 'bottomleft')

    let selected_cell = create_element('selected_cell', 'topright', '<h4>Select a Cell</h4>')

    let info_widget = create_element('info_bar', 'topright', info_viz_text)

    let horizontal_chart = create_element('bar_chart', 'topright', ICON_LOADING)
    let zone_table = create_element('zone_table', 'bottomright')



    //also change so that zones would not mess up position
    //change so the api would not be reset
    map.on("viewreset moveend", draw_voronoi);
    map.on("viewreset moveend", generate_hull);


}

function draw_road(loaded_svg) {
    let road_a = [52.16045, 0.0226689]
    let road_b = [52.23811, 0.208]
    // L.marker(road_a).addTo(map);
    // L.marker(road_b).addTo(map);


    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
    svgElement.setAttribute("viewBox", "0 0 973.7 808.7");
    svgElement.setAttribute("id", 'roads');

    svgElement.innerHTML = new XMLSerializer().serializeToString(loaded_svg);
    var svgElementBounds = [road_a, road_b];
    console.log('loading svg')
    L.svgOverlay(svgElement, svgElementBounds, {
        interactive: false
    }).addTo(map); //L.imageOverlay(wgb_loc, wgb_bounds).bringToFront();bringToBack()

    d3.select('#roads').style('fill', 'none').style('stroke', 'blue');

}

function draw_voronoi() {

    //remove old cell overlay and prepare to draw a new one
    d3.select('#cell_overlay').remove();

    // Reset the clock
    clock.update();

    //create a variable for the dbclick functionality
    ///that finds the shortest path between two selected cites
    let selected_sites = [];

    //create map bounds to know where to stop drawing
    //as well topLeft && bottomRight values  
    let bounds = map.getBounds(),
        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
        drawLimit = bounds.pad(0.4);

    //topLeft is a global since it's used outside the scope to position
    //other objects in relation to the Voronoi diagram
    topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

    /*
     Lat/Lng to pixel conversion
     
     Here we use all_sites(Bluetooth sensor sites) and boundary_sites(imaginary sites that close off the Voronoi diagram)
     Naming conventions: "sites" is refering to physical lat/lng location, whereas "points" are pixel values on screen,
     hence the creation of variables like boundary_sites and boundary_points. 

     */


    //we filter out sites from all_sites that are within our drawing box
    //e.g. when zoomed in, not all sites get drawn since they appear out of the screen
    var filtered_points = [];

    //filtered points are voronoi center points - bluetooth sensor locations
    filtered_points = all_sites.filter(function (d, i) {
        let latlng = new L.latLng(d.location.lat, d.location.lng);

        //make sure not drawing out of bounds
        if (!drawLimit.contains(latlng)) {
            return false
        };

        let point = map.latLngToLayerPoint(latlng);

        //set coordinates values in all_sites for further use
        d.x = point.x;
        d.y = point.y;

        //set coordinates values in SITE_DB for further use
        SITE_DB[i].x = point.x;
        SITE_DB[i].y = point.y;

        return true;
    });

    //boundary_points are voronoi center points that limit the perimeter of the visible cells.
    //We created a list of invisible cells so that the Voronoi diagram does not triangulate
    //itself to inifinity. The coordinates for these can be found in boundary_sites.js
    boundary_points = boundary_sites.filter(function (d, i) {
        let latlng = new L.latLng(d.lat, d.lng);
        if (!drawLimit.contains(latlng)) {
            return false
        };

        let point = map.latLngToLayerPoint(latlng);

        //set coordinates values in boundary_sites for further use
        d.x = point.x;
        d.y = point.y;

        //set coordinates values in BOUNDARY_DB for further reuse
        BOUNDARY_DB.push({
            "lat": d.lat,
            "lng": d.lng,
            "x": point.x,
            "y": point.y
        });
        return true;
    });

    //create color a range to be able to color in cells based on their values
    setColor = setColorRange();

    //findLatLng(); //optional function, provides lat/lng coordinates if clicked on the map

    /*
    Creating the voronoi triangulation, using the previously defined boundaries

    This is integral to the visualisation, and d3.js provides some very nice
    functions that do all the work for us.
    */

    let voronoi = d3.voronoi()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        })
        .extent([
            [topLeft.x, topLeft.y],
            [bottomRight.x, bottomRight.y]
        ]);


    //the lines below might be a bit counterintuitive, but we have to create both
    //visible and invisible polygons at once to ensure even triangulation.

    //combine boundary(invisible) nodes with the actual sensor node to make polygons
    //that are evenly triangulated
    for (let i = 0; i < boundary_points.length; i++) {
        filtered_points.push(boundary_points[i]);
    }

    //create voronoi polygons from all the nodes.
    //this wouldn't work if we did voronoi.polygons(boundary_points)
    //and voronoi.polygons(filtered_points) separately
    let voronoi_polygons = voronoi.polygons(filtered_points);

    //list containing all visible polygons. Here we separate
    //filetered_points from boundary_points again
    let ready_voronoi_polygons = [];

    //invisible polygons are undefined so we ignore them
    for (let i = 0; i < voronoi_polygons.length; ++i) {
        if (voronoi_polygons[i] !== undefined) {
            ready_voronoi_polygons.push(voronoi_polygons[i]);
        }
    }

    //appending the d3.js SVG to the map.
    //the svg_canvas variable will also contain all of the d3.generated proto objects
    //like lines, outlines and the polygons (voronoi cells).
    svg_canvas = d3.select(map.getPanes().overlayPane).append("svg")
        .attr("id", "cell_overlay")
        .attr("class", "leaflet-zoom-hide")
        .style("width", map.getSize().x + "px")
        .style("height", map.getSize().y + "px")
        .style("margin-left", topLeft.x + "px")
        .style("margin-top", topLeft.y + "px");

    //append voronoi polygons to the canvas
    polygon_group = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //append zone outlines to the canvas
    zone_outlines = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //append drawn links to the canvas
    link_group = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //append dijkstra shortest path generated line to the canvas
    dijkstra_group = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //append circles that illustrate sensors and polygons centers to the canvas.
    //It's not a global so we just declare it here
    let circle_group = svg_canvas.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");


    /*Drawing the Voronoi polygons on the map.

    The code below will have all of the d3.js shenanigans for interactivity including 
    what happens on:

    -mouseover (highlight cell)
    -mouseout (unhighlight cell)
    -click (selects the cell as the *selected node* and draws all the graphs)
    -doubleclick (selects cell #1 and #2 and draws the shortest path betwen them)
    

    Cells/Polygons are used interchangeably in the documentation, but generally speaking
    polygons are the digital representation as just the numbers in a list, whereas
    the cells are drawn objects on the screen, based on the polygon data.
    */

    //creates paths objects from the genetated polygon data 
    //(polygons are drawn as paths FYI)
    polygon_group.selectAll("g")
        .data(ready_voronoi_polygons)
        .enter()
        .append("path")
        .attr('id', (d) => d.data.acp_id)
        .attr("class", function (d, i) {
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

    //-------------------------------------//
    //----------D3.js interactivity--------//
    //---------------START-----------------//

    //add some visual properties to the drawn cells
    polygon_group.selectAll(".cell")
        .attr('fill', function (d) {

            //color the cell based on the selected reading from the SITE_DB
            //the lookup is done based on the matching id values (from SVG and in Nodes)
            let color = SITE_DB.find(x => x.id === d.data.id).selected;

            //if undefined,set to gray
            if (color == null || color == undefined) {
                return "rgb(50,50,50);"
            } else {
                return setColor(color)
            }
        })

        //----------ON MOUSEOVER---------//

        .on('mouseover', function (d) {

            //highlight the cell that is being hovered on
            cell_mouseover(this);

            //get the id and the neighbors for the node that this cell represents
            let id = d.data.id;
            let neighbors = SITE_DB.find(x => x.id === id).neighbors;

            //remove old links that were drawn for the other nodes 
            //that were hoverd in before
            d3.selectAll('.arc_line').remove()
            link_group.remove();

            //draw links for every neighbor that the node has
            for (let i = 0; i < neighbors.length; i++) {

                let inbound = neighbors[i].links.in.id;
                let outbound = neighbors[i].links.out.id;

                drawLink(inbound, 350);
                drawLink(outbound, 350);
            }
        })
        //----------ON MOUSEOUT---------//

        .on('mouseout', function () {

            //unhighlight the cell that was being hovered on
            cell_mouseout(this);

            //cleanup the links that were drawn
            links_drawn = [];
            link_group.remove();
            d3.selectAll('.arc_line').remove()

        })

        //----------ON CLICK---------//

        .on('click', function (d, i) {

            //set as the main global selection 
            selected_node = d;

            //make HUD elements visible
            document.getElementById("selected_cell").style.opacity = 1;
            document.getElementById("selected_cell").innerHTML = ICON_CLOSE_AND_DESELECT + "<br>" + "<h1>" + d.data.name + "</h1>";
            document.getElementById("datepicker").style.opacity = 1;

            //make the date navigation buttons visible 
            //(made invisible prior since without a cell selection, changing the date does not make sense)
            set_nav_date_visible(1);

            //load metadata for the node
            show_node_information(d);

            //add d3/css styling to the selected cell to make it pop
            select_cell(d.data.acp_id)

            //update url and add event listeners for date changes
            onchange_feature_select(d.data.acp_id, DD + "-" + MM + "-" + YYYY)
        })

        //--------ON DOUBLE CLICK-------//

        .on("dblclick", function (d) {

            //remove old if there were any
            d3.select('#shortest_path').remove();

            //add the selected site to the list
            selected_sites.push(d.data);

            //make sure to only have a max of two sites
            if (selected_sites.length > 2) {
                selected_sites = [];
            }

            //if the list is full, interpolate shortest path
            if (selected_sites.length === 2) {

                //create the problem graph with start and finish nodes
                let problem = generate_graph(selected_sites[0].name, selected_sites[1].name);

                //run the Dijkstra shortest path on the generated graph  
                //[returns the names of the nodes in order of the shortest path]
                let result = dijkstra(problem, selected_sites[0].name, selected_sites[1].name);

                //this will contain the coordinates of the nodes that the shortest path passes through
                let path = [];

                //fill the path variable with the shortest path data returned by the Dijkstra algorithm
                for (let i = 0; i < result.path.length; i++) {

                    console.log(result.path[i]);

                    var found = SITE_DB.find(x => x.name == result.path[i]);

                    if (found.x != null || found.x != undefined) {
                        path.push({
                            "x": found.x,
                            "y": found.y
                        });;
                    }

                }

                //d3's line interpolator/generator
                let line = d3.line()
                    .x(function (d, ) {
                        return d.x;
                    }) // set the x values for the line generator
                    .y(function (d) {
                        return d.y;
                    }) // set the y values for the line generator 
                    // apply smoothing to the line, I found curveCatmullRom works best
                    .curve(d3.curveCatmullRom.alpha(1)); //or d3.curveCardinal.tension(0.1)//or d3.curveNatural

                //append the generated shortest path line to the dijkstra group on the global svg canvas
                let shortest_path_line = dijkstra_group.append("path")
                    .attr("d", line(path))
                    .attr('id', 'shortest_path')
                    .attr("stroke", "green")
                    .attr("stroke-width", 5)
                    .attr("fill", "none");

                //get the total length, so we can animate it
                let total_line_length = shortest_path_line.node().getTotalLength();

                //do the animation and make the illusion of it being drawn
                shortest_path_line
                    .attr("stroke-dasharray", total_line_length + " " + total_line_length)
                    .attr("stroke-dashoffset", total_line_length)
                    .transition()
                    .duration(500)
                    .ease(d3.easeLinear)
                    .attr("stroke-dashoffset", 0);

                //clear selected sites and prepare for the new selections
                selected_sites = [];
            }

            //the double clicked cells have special dashed outlines
            //that differentiate them from the rest of the cells
            d3.select(this).attr("class", "selected");
        });

    //-------------------------------------//
    //----------D3.js interactivity--------//
    //----------------END------------------//

    //add the *title* so that the name of the node appears when the cell is being hovered on
    polygon_group.selectAll(".cell").append("title").text(function (d) {
        return d.data.name;
    });

    //add nodes' locations on the map (they're also cell/polygon centers)
    circle_group.selectAll(".point")
        .data(filtered_points)
        .enter()
        .append("circle")
        .attr("class", function (d) {
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


    //filtered_points = [];

    //change_modes adds the option of coloring in the cells based on:
    // -current speed
    // -historic(normal) speed
    // -deviation in speed from the normal
    change_modes();

    //in case the selected node has been mislabeled:
    if (selected_node != undefined) {
        select_cell(selected_node.data.acp_id);
    }
}

//-----------------------------------------------------//
//-----------------END draw_voronoi()------------------//
//-----------------------------------------------------//




var show_node_information = (d, START, END) => {
    document.getElementById("line_graph").style.opacity = 1;
    document.getElementById("line_graph").innerHTML = ICON_LOADING;

    let NODE = d.data.id;

    if (START == undefined) {
        START = new Date().toISOString().slice(0, 10)
    }

    show_node_data(NODE, START, END)
    show_node_metadata(NODE)
}


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

function drawLinks(x, y, X, Y, dur, fill) {
  
    var blue = link_group
        .append('path')
        .attr('d', curvedLine(x, y, X, Y, 1))
        .style("fill", fill)
        .style("fill-opacity", 0)
        .attr("stroke", "blue")
        .attr("stroke-opacity", 0.5)
        .style("stroke-width", 2);

    //d.data.x,d.data.y,x_coord,y_coord
    var red = link_group
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

                    // drawSVGLinks(inbound, 1500);
                    // drawSVGLinks(outbound, 1500);

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

//computes the slope on which we place the arc lines
//indicate links between sites
function slope(x, x1, y1, x2, y2) {
    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;
    let slope = (y2 - y1) / (x2 - x1);
    return (-1 / slope) * (x - midX) + midY;
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

    let node_element = {};
    node_element['data'] = SITE_DB.find(x => x.acp_id === node_id);

    console.log(node_element, node_id, new_year + '-' + new_month + '-' + new_day);

    show_node_information(node_element, query_date);

    let url_date = new_day + '-' + new_month + '-' + new_year;
    update_url(node_id, url_date);
}



function update_url(node, date) {
    if (date == undefined) {
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