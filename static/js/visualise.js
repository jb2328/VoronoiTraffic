// Javascript functions for displaying Bluetruth data

/* eslint no-console: "off" */
/*global $, L, LOCATIONS_URL, JOURNEYS_URL, MB_ACCESS_TOKEN, TF_API_KEY */

// m/sec to mph

//const TO_MPH = 2.23694;

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


var all_sites, all_links, all_journeys = [];

var minmax, myColors;
//var SITE_DB = [];
var links_drawn = [];
var links_drawn_SVG = [];

var newPts = [];

var BOUNDARY_DB = [];
var boundaryPoints = [];

var combined = [];

var points = [];
points = all_sites;


var voronoi, adjustedSites, vertices;

var pathGroup;
var setColor;

var selectedSites = [];

var lineGroup, cell_outlines, dijkstraGroup, road_group;
var voronoi_cells;

var bounds;

class VoronoiViz {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        // this.viz_tools = new VizTools();

        // Transform parameters to scale SVG to screen

    }


    // init() called when page loaded
    init() {
        init_map();

        load_api_data().then(() => {

            console.log('Creating Nodes');
            initialise_nodes();
            console.log('draw bar chart')

            show_bar(get_zone_averages());

            console.log('loading Voronoi');
            drawVoronoi();
            generate_hull();

        });

        // load_road_svg().then((loaded_svg) => {

        //     draw_road(loaded_svg);
        // });


        //have a timeout function here
    }

    update() {
        // The underlying API updates journey times every 5 minutes.
        // Schedule an update 5 and-a-bit minutes from the last
        // timestamp if that looks believable, and in a minute
        // otherwise.

        // Display the data's timestamp on the clock
        //  var timestamp = journey_response.ts * 1000;
        //  clock.update(new Date(timestamp));

        //  console.log('loaded api data')

        var now = Date.now();
        var delta = timestamp - now + (5.25 * 60000);
        if (delta <= 0 || delta > 10 * 60000) {
            delta = 60000;
        }
        console.log('Timestamp was ' + new Date(timestamp));
        console.log('Delta is ' + delta);
        console.log('Now is ' + new Date(now));
        console.log('Next at ' + new Date(now + delta));

        // fix the the timeout from spazing out
        //setTimeout(self.redrawVoronoi(), delta);

        // Reset the clock
        clock.update();
    }

    /*------------------------------------------------------*/
    /*--------------------HELPER FUNCT----------------------*/
    /*------------------------------------------------------*/

}

/*------------------------------------------------------*/
/*----------------------MAIN LOOP-----------------------*/
/*------------------------------------------------------*/

console.log('lazy_script');
var voronoi_visualisation = new VoronoiViz();
voronoi_visualisation.init();

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
    //modify to create a new element
    //var  mypolygon = document.getElementById(path_id);
    //mypolygon.setAttribute("points", polygonPoints.join(","));
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
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 95,
        layers: [stamenToner],
    });

    // Clock
    clock = get_clock().addTo(map)

    var info_widget = L.control();
    var datepicker_widget = L.control();
    var horizontal_chart = L.control();


    var metadata_table = L.control({
        position: 'bottomleft'
    }); //{       position: 'bottom'    }
    metadata_table.onAdd = function (map) {
        this.metadata_table = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        this.metadata_table.id = "metadata_table";
        this.update();

        return this.metadata_table;
    };
    metadata_table.update = function (e) {
        if (e === undefined) {
            this.metadata_table.innerHTML =
                '<h4>Hover over a Cell - METADATA</h4>'
            // +'<br>' 
            return;
        }

    };



    //to be modified with https://stackoverflow.com/questions/33614912/how-to-locate-leaflet-zoom-control-in-a-desired-position
    var test_graph = L.control({
        position: 'bottomleft'
    }); //{       position: 'bottom'    }
    test_graph.onAdd = function (map) {
        this.test_graph = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        this.test_graph.id = "test_graph";
        this.update();

        return this.test_graph;
    };
    test_graph.update = function (e) {
        if (e === undefined) {
            this.test_graph.innerHTML =
                '<h4>Hover over a Cell</h4>'
            // +'<br>' 
            return;
        }

    };

    test_graph.addTo(map);

    metadata_table.addTo(map);

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

    horizontal_chart.onAdd = function (map) {
        this.horizontal_chart = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
        this.horizontal_chart.id = "bar_chart";
        this.update();

        return this.horizontal_chart;
    };


    horizontal_chart.update = function (e) {
        if (e === undefined) {
            this.horizontal_chart.innerHTML =
                '<h4>Horizontal Bar Chart</h4>'
            // +'<br>' 
            return;
        }

    };


    info_widget.update = function (e) {
        if (e === undefined) {
            this.info_div.innerHTML =
                '<h4>Information</h4>' +
                "<br>" +
                "<div>" +
                "<form id='routes'>" +
                "<input type='radio' name='mode' value='routes'> Routes<br>" +
                "<input type='radio' name='mode' value='polygons'> Polygons<br>" +
                "<input type='radio' name='mode' value='groups'> Show Groups<br>" +
                "<input type='radio' name='mode' value='best_route'> Find Best Route<br>" +


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
    horizontal_chart.addTo(map);


    

    //also change so that zones would not mess up position
    //change so the api would not be reset
    map.on("viewreset moveend", drawVoronoi);

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

function drawVoronoi() {
    d3.select('#cell_overlay').remove();

    // Reset the clock
    clock.update();


    bounds = map.getBounds(),
        topLeft = map.latLngToLayerPoint(bounds.getNorthWest()),
        bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
        drawLimit = bounds.pad(0.4);

    filteredPoints = [];

    //voronoi center points - bluetooth sensor locations
    filteredPoints = all_sites.filter(function (d, i) {
        let latlng = new L.latLng(d.location.lat, d.location.lng);

        //make sure not drawing out of bounds
        if (!drawLimit.contains(latlng)) {
            return false
        };

        let point = map.latLngToLayerPoint(latlng);
        d.x = point.x;
        d.y = point.y;

        SITE_DB[i].x = d.x;
        SITE_DB[i].y = d.y;

        return true;
    });

    //voronoi center points that limit the perimeter of the visible cells
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


    d3.select('#cell_overlay').remove();

    voronoi_cells = d3.select(map.getPanes().overlayPane).append("svg")
        .attr("id", "cell_overlay")
        .attr("class", "leaflet-zoom-hide")
        .style("width", map.getSize().x + "px")
        .style("height", map.getSize().y + "px")
        .style("margin-left", topLeft.x + "px")
        .style("margin-top", topLeft.y + "px");

    pathGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
    var circleGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    //var circleGroupB = voronoi_cells.append("g")
    //   .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    lineGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
    cell_outlines = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    dijkstraGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");


    console.log('voronoi_polygons', readyVoronoiPolygons)
    pathGroup.selectAll("g")
        .data(readyVoronoiPolygons)
        .enter()
        .append("path")
        //.attr("class","cell")//"cell"
        .attr('id', (d) => d.data.acp_id)
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

        .on('mouseover', function (d, i) {
            let today = new Date();

            let START = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
            let END = '2020-08-22'

            console.log(START)

            console.log(d.data.acp_id, d.data.id)
            let NODE = d.data.id
            d3.select('#test_graph')._groups[0][0].innerHTML = '<img src="./static/images/loading_icon.gif "width="100px" height="100px" >'
            console.log('INNERHTML', d3.select('#test_graph')._groups[0][0].innerHTML)
            show_node_tt_past(NODE, START)
            show_node_tt_now(NODE)



            //  lineGroup = voronoi_cells.append("g")
            //     .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

            d3.select(this).transition()
                .duration('300')
                .attr('stroke', 'black')
                .attr('stroke-width', '2px')
                .style("stroke-opacity", 1)
                .style("fill-opacity", 0.6);

            //I ASSUME THIS WILL FIX THE BUG WHERE UPON MOVING THE MAP COLORS CHANGE AS NOT ALL CELLS ARE LOADED.
            //COLOR HAS TO BE LOADED BASED ON   d   RATHER THAN i
            let id = d.data.id;
            let neighbors = SITE_DB.find(x => x.id === id).neighbors;

            console.log('list of links')
            d3.selectAll('.arch_line').remove()

            lineGroup.remove();
            for (let i = 0; i < neighbors.length; i++) {
                //console.log(i);
                let inbound = neighbors[i].links.in.id;
                let outbound = neighbors[i].links.out.id;

                drawLink(inbound, 350);
                drawLink(outbound, 350);

                // drawSVGLinks(inbound, 500);
                // drawSVGLinks(outbound, 500);



            }



        })



        .on("click", function (d) { //dblclick
            let id = d.data.id;
            console.log(id, " was clicked");

            //removes old paths
            d3.select('#shortest_path').remove();

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

                    var found = SITE_DB.find(x => x.name == result.path[i]);

                    if (found.x != null || found.x != undefined) {
                        path.push({
                            "x": found.x,
                            "y": found.y
                        });;
                    }



                }

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
                    .attr('id', 'shortest_path')
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
            d3.selectAll('.road').style('stroke-width', '0px')



            links_drawn = [];
            links_drawn_SVG = [];
            d3.select(this).transition()
                .duration('500')
                //the alterinative is to use .classed('class_name', true) but then it's an equal css hassle
                .attr('stroke', 'black')
                .attr('stroke-width', '0.5px')
                .style("stroke-opacity", 0.3)
                .style("fill-opacity", 0.3);


            lineGroup.remove();
            d3.selectAll('.arch_line').remove()

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






function drawSVGLinks(link, dur) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    // console.log('LINK', link, from, to);



    links_drawn_SVG.push(link);

    let color = links_drawn_SVG.includes(inverseLink(link)) ? "magenta" : "green";
    console.log('SVG', color)
    let dir = color === "green" ? 1 : -1;

    let values = getMinMax();
    let deviation = calculateDeviation(link)

    var scale = d3.scaleLinear()
        .domain([values.min, values.max])
        .range([1, 4]);

    //let strokeWeight = scale(deviation);
    let strokeWeight = '3px';

    let inbound = lineGroupSVG('#' + link, color, strokeWeight) //setColor(strokeWeight)
    try {
        console.log(d3.select('#' + link), d3.select('#' + link).node().children[0].getTotalLength())
        let lineLength = inbound.node().children[0].getTotalLength()
        animateSVGMovement(inbound, lineLength, dur, dir);

    } catch {
        console.log(link)
        drawLink(link, 350);
        console.log('EXCEPTION CAUGHT')

    }


}

function lineGroupSVG(path_id, color, strokeWeight) {
    // d3.selectAll('.road').style('stroke-width', strokeWeight)

    let path = d3.select(path_id)
        .style("fill", "none")
        .style("fill-opacity", 0)
        .attr("stroke", color)
        .attr("stroke-opacity", 1)
        .style("stroke-width", strokeWeight);

    return path
}

function animateSVGMovement(path, outboundLength, dur, dir) {

    return path
        .attr("stroke-dasharray", outboundLength + " " + outboundLength)
        .attr("stroke-dashoffset", dir * outboundLength)
        .transition()
        .duration(dur)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end",
            function (d, i) {

            }

        );

}

function drawLink(link, dur, col) {
    //lineGroup.remove();


    lineGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    console.log('LINK', link)

    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    console.log('LINK ft', from, to)


    links_drawn.push(link);

    let direction = links_drawn.includes(inverseLink(link)) ? "red" : "blue";
    console.log('arcs', direction)
    let values = getMinMax();
    let deviation = calculateDeviation(link)

    //console.log(deviation);

    var scale = d3.scaleLinear()
        .domain([values.min, values.max])
        .range([0.5, 10]);
    let strokeWeight = scale(deviation);
    let color = col == undefined ? setColor(strokeWeight) : col;
    //let strokeWeight = '5px';

    //console.log(deviation, strokeWeight);

    let inbound = lineGroup_(from, to, direction, strokeWeight, color); //setColor(strokeWeight)
    let lineLength = inbound.node().getTotalLength();


    animateMovement(inbound, lineLength, dur);
    //animateMovement(outbound, lineLength,350);

}



function inverseLink(link) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    let links = findLinks(from.id, to.id);
    return link === links.in.id ? links.out.id : links.in.id;

}



function lineGroup_(A, B, direction, strokeWeight, stroke) {

    return lineGroup
        .append('path')
        .attr('d', curvedLine(A.x, A.y, B.x, B.y, direction === "red" ? 1 : -1))
        .attr('class', 'arch_line')
        .style("fill", "none")
        .style("fill-opacity", 0)
        .attr("stroke", stroke)
        .attr("stroke-opacity", 1)
        .style("stroke-width", strokeWeight);
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

                    // drawLink(inbound, 1000);
                    // drawLink(outbound, 1000);

                    drawSVGLinks(inbound, 1500);
                    drawSVGLinks(outbound, 1500);

                }
            }
        }
        if (this.value === "polygons") {
            drawVoronoi();
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
        travelTime = all_journeys.find(x => x.id === link).travelTime;
        normalTravelTime = all_journeys.find(x => x.id === link).normalTravelTime;
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


        let defaultHull = d3.concaveHull().distance(85);
        let paddedHull = d3.concaveHull().distance(85).padding(5);

        CELL_GROUPS[group_id]['default_hull'] = defaultHull(point_pairs);
        CELL_GROUPS[group_id]['padded_hull'] = paddedHull(point_pairs);


        let padded_cell_outline = paddedHull(point_pairs)[0]

        let points = []

        for (let j = 0; j < padded_cell_outline.length; j++) {
            points.push({
                'x': padded_cell_outline[j][0],
                'y': padded_cell_outline[j][1]
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
    if (zone_id != undefined) {
        cell_outlines.append("g")
            .append("path")
            .attr('class', 'cell_outline')
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
            cell_outlines.append("g")
                .append("path")
                .attr('class', 'cell_outline')
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