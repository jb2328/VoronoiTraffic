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
var links_drawn_SVG = [];

var BOUNDARY_DB = [];
var boundaryPoints = [];

var pathGroup;
var setColor;

var selectedSites = [];

var lineGroup, cell_outlines, dijkstraGroup, road_group;
var voronoi_cells;

const ICON_CLOSE_DIV="<span id='close' onclick='this.parentNode.style.opacity=0; return false;'>x</span>"
const ICON_CLOSE_AND_DESELECT="<span id='close' onclick='this.parentNode.style.opacity=0; deselect_all(); selected_node=undefined; return false;'>x</span>"

const ICON_LOADING='<img src="./static/images/loading_icon.gif "width="100px" height="100px" >';

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

           // show_horizontal_bar(get_zone_averages());
            show_vertical_bar(get_zone_averages());

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
}
 function create_element(element_id, position, inner_text){

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
            this.new_element.innerHTML =inner_text==undefined?'':ICON_CLOSE_DIV+inner_text;
            this.new_element.style.opacity=inner_text==undefined?0:1;
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

   let  info_viz_text= '<h4>Information</h4>' +
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

    var datepicker_text= '<h4>Pick time and Date</h4>' +
    '<br>' +
    '<input type="text" name="datefilter" id="datepicker" value="" />';


    var line_graph_element=create_element('test_graph','bottomleft')
    var datepicker_widget =create_element('datepicker','bottomleft',datepicker_text)//datepicker_text
    document.getElementById("datepicker").style.opacity=0;
    set_nav_date_visible(0)

    var metadata_element=create_element('metadata_table','bottomleft')

    var selected_cell=create_element('selected_cell','topright','<h4>Select a Cell</h4>')

    var info_widget =create_element('info_bar','topright',info_viz_text)

    var horizontal_chart=create_element('bar_chart','topright',ICON_LOADING)
    var zone_table=create_element('zone_table','bottomright')

    

    //also change so that zones would not mess up position
    //change so the api would not be reset
    map.on("viewreset moveend", drawVoronoi);
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

function drawVoronoi() {
    console.log('executing DRAW VORONOI')

    d3.select('#cell_overlay').remove();

    // Reset the clock
    clock.update();


    var bounds = map.getBounds();
    topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    var bottomRight = map.latLngToLayerPoint(bounds.getSouthEast()),
    drawLimit = bounds.pad(0.4);

    console.log('topLeft', topLeft)
    var filteredPoints = [];

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

    //cell paths
    pathGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");
    let circleGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    lineGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    cell_outlines = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    dijkstraGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");


    //console.log('voronoi_polygons', readyVoronoiPolygons)
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
        .on('click', function(d,i){
            console.log("CLICKED",d, d.data.acp_id)
            selected_node=d;

            document.getElementById("selected_cell").style.opacity =1;
            document.getElementById("selected_cell").innerHTML =ICON_CLOSE_AND_DESELECT+"<br>"+"<h1>"+d.data.name+"</h1>";
            document.getElementById("datepicker").style.opacity =1;
            set_nav_date_visible(1);
            
            show_node_information(d);
            select_cell(d.data.acp_id)

            onchange_feature_select(d.data.acp_id, DD+"-"+MM+"-"+YYYY)
            //update_url(d.data.acp_id, DD+"-"+MM+"-"+YYYY)
        })

        .on('mouseover', function (d) {
         

            cell_mouseover(this);


            //I ASSUME THIS WILL FIX THE BUG WHERE UPON MOVING THE MAP COLORS CHANGE AS NOT ALL CELLS ARE LOADED.
            //COLOR HAS TO BE LOADED BASED ON   d   RATHER THAN i
            let id = d.data.id;
            let neighbors = SITE_DB.find(x => x.id === id).neighbors;

            console.log('list of links')
            d3.selectAll('.arc_line').remove()

            lineGroup.remove();
            for (let i = 0; i < neighbors.length; i++) {
                let inbound = neighbors[i].links.in.id;
                let outbound = neighbors[i].links.out.id;

                drawLink(inbound, 350);
                drawLink(outbound, 350);

                // drawSVGLinks(inbound, 500);
                // drawSVGLinks(outbound, 500);
            }



        })



        .on("dblclick", function (d) { //dblclick
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
        .on('mouseout', function (d, i) {
            d3.selectAll('.road').style('stroke-width', '0px')



            links_drawn = [];
            links_drawn_SVG = [];


            cell_mouseout(this);



            lineGroup.remove();
            d3.selectAll('.arc_line').remove()

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


    if(selected_node!=undefined){
        select_cell(selected_node.data.acp_id);
    }
}

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
        .style('stroke-opacity',1).style('stroke','black').style('stroke-width',4);

}
var cell_regular = (cell) => {
    d3.select(cell)
    .style('stroke', 'black')
    .style('stroke-width', 0.5)
    .style("stroke-opacity", 0.3)
    .style("fill-opacity", 0.3);

}



var show_node_information=(d, START, END)=>{
    document.getElementById("test_graph").style.opacity =1;
    document.getElementById("test_graph").innerHTML =ICON_LOADING;

    let NODE= d.data.id;

    if(START==undefined){
        START = new Date().toISOString().slice(0,10)
    }

    show_node_data(NODE, START,END)      
    show_node_metadata(NODE)
}


function drawSVGLinks(link, dur) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

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

function drawLink(link, dur) {

    lineGroup = voronoi_cells.append("g")
        .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

    let connected_sites = all_links.find(x => x.id === link).sites;

    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    let direction = links_drawn.includes(inverseLink(link)) ? "in" : "out";

    let values = getMinMax();
    let deviation = calculateDeviation(link) //negative slower, positive faster

    var scale = d3.scaleLinear()
        .domain([values.min, values.max])
        .range([values.min, values.max]);
        
    let color = setColor(scale(deviation));
   // let color = col == undefined ? setColor(strokeWeight) : col;
    let strokeWeight = 5;

    console.log('DEVIATION:',link,deviation, color);

    let link_line = generate_arc(from, to, direction, strokeWeight, color); //setColor(strokeWeight)
    let line_length = link_line.node().getTotalLength();

    links_drawn.push(link);

    animateMovement(link_line, line_length, dur);

}



function inverseLink(link) {
    let connected_sites = all_links.find(x => x.id === link).sites;
    let from = SITE_DB.find(x => x.id === connected_sites[0]);
    let to = SITE_DB.find(x => x.id === connected_sites[1]);

    let links = findLinks(from.id, to.id);
    return link === links.in.id ? links.out.id : links.in.id;

}



function generate_arc(A, B, direction, strokeWeight, stroke) {

    return lineGroup
        .append('path')
        .attr('d', curvedLine(A.x, A.y, B.x, B.y, direction === "in" ? 1 : -1))
        .attr('class', 'arc_line')
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
    var setColor = setColorRange();

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


function generateGraph(start, finish) {

    var graph = {};

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
    let normal = (dist / normalTravelTime) * TO_MPH;

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
        "max": max  //10
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
        if(map._zoom<=12){
            concavity_threshold=85
        }
        else{
            concavity_threshold=185;

        }
        
        let defaultHull = d3.concaveHull().distance(concavity_threshold);
        let paddedHull = d3.concaveHull().distance(concavity_threshold).padding(5);

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
        //.curve(d3.curveBasisClosed);
        //.curve(d3.curveCatmullRomClosed.alpha(0.95)); //d3.curveCardinal.tension(0.1)//d3.curveNatural
        
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
function set_nav_date_visible(trigger){
    let nav_date_list=document.getElementsByClassName('nav_date')
            for(let i=0;i<nav_date_list.length;i++){
                nav_date_list[i].style.opacity=trigger;
            }
}



// ************************************************************************************
// ************** Date forwards / backwards function             *********************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n, node_id)
{
    let year, month, day;
    console.log('date_shift()');
    if (YYYY == '') {
        year = plot_date.slice(0,4);
        month = plot_date.slice(5,7);
        day = plot_date.slice(8,10);
    } else {
        year = YYYY;
        month = MM;
        day = DD;
    }

    let new_date = new Date(year,month-1,day); // as loaded in page template config_ values;

    new_date.setDate(new_date.getDate()+n);

    let new_year = new_date.getFullYear();
    let new_month = ("0" + (new_date.getMonth()+1)).slice(-2);
    let new_month_long = new_date.toLocaleString('default', { month: 'long' });

    let new_day = ("0" + new_date.getDate()).slice(-2);

    let query_date=new_year+"-"+new_month+"-"+new_day;
    document.getElementById('date_now').innerHTML = "<h2>"+new_day+" "+new_month_long+" "+new_year+"</h2>"
    
    let node_element={};
    node_element['data']= SITE_DB.find(x => x.acp_id === node_id);

    console.log(node_element,node_id,new_year+'-'+new_month+'-'+new_day);

    show_node_information(node_element, query_date);


}



function update_url(node, date) {
    if(date==undefined){
        let new_date=new Date()
        date=new_date.getDate()+"-"+new_date.getMonth()+1+"-"+new_date.getFullYear();
    }
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set("node", node);
    searchParams.set("date", date);
    var newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
    window.history.pushState(null, '', newRelativePathQuery);
}


function onchange_feature_select(node_id, date) {
    console.log("onchange_feature_select",window.location.href);
    //let features = sensor_metadata["acp_type_info"]["features"];

    set_date_onclicks(node_id);
    // Change the URL in the address bar
    update_url(node_id,date);
 //   draw_chart(readings, features[feature_id]);
}

function set_date_onclicks(node_id) {
        // set up onclick calls for day/week forwards/back buttons
        document.getElementById("back_1_week").onclick = function () { date_shift(-7, node_id) };
        document.getElementById("back_1_day").onclick = function () { date_shift(-1, node_id) };
        document.getElementById("forward_1_week").onclick = function () { date_shift(7, node_id) };
        document.getElementById("forward_1_day").onclick = function () { date_shift(1, node_id) };
}


function select_cell(id) {

    deselect_all()
    let cell = document.getElementById(id)

    cell_clicked(cell)


    //    d3.select('#' + id).style('stroke-opacity', 1).style('stroke', 'black').style('stroke-width', 4)

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