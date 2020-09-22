"use strict";

class VoronoiViz {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(site_db) {

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        // this.viz_tools = new VizTools();

        // Transform parameters to scale SVG to screen
        this.init_map();

      //  this.hud=new Hud(this); 

        this.SELECTED_SITE = '';
       

    }



    // init() called when page loaded
    init() {


        this.get_url_date();

        //-------------------------------//
        //--------LOADING API DATA-------//
        //-------------------------------//

        load_api_data().then(() => {

            console.log('Creating Nodes');
            this.initialise_nodes();
            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            show_vertical_bar(get_zone_averages());

            if (URL_NODE != '*') {
                this.SELECTED_SITE = SITE_DB.find(x => x.node_acp_id === URL_NODE);
                console.log('URL NODE', URL_NODE, this.SELECTED_SITE)

                //------------------------HUD---------------------------//
                let selected_date=YYYY+"-"+"0"+MM+"-"+DD

                //make HUD elements visible
                document.getElementById("selected_cell").style.opacity = 1;
                document.getElementById("selected_cell").innerHTML = ICON_CLOSE_AND_DESELECT + "<br>" + "<h1>" + this.SELECTED_SITE.name + "</h1>";
                document.getElementById("datepicker").style.opacity = 1;

                //make the date navigation buttons visible 
                //(made invisible prior since without a cell selection, changing the date does not make sense)
                set_nav_date_visible(1);

                //load metadata for the node
                show_node_information(this.SELECTED_SITE.node_acp_id,selected_date );

                //add d3/css styling to the selected cell to make it pop
                select_cell(this.SELECTED_SITE.node_acp_id)

                //update url and add event listeners for date changes
                onchange_feature_select(this.SELECTED_SITE.node_acp_id, DD + "-" + MM + "-" + YYYY)
               //------------------------/HUD---------------------------//

            }


            console.log('loading Voronoi');
            this.draw_voronoi();
            generate_hull();


        });


        //attach map event listeners
        map.on("viewreset moveend", this.draw_voronoi);
        map.on("viewreset moveend", generate_hull);

        //Will execute myCallback every X seconds 
        //the use of .bind(this) is critical otherwise we can't call other class methods
        //https://stackoverflow.com/questions/42238984/uncaught-typeerror-this-method-is-not-a-function-node-js-class-export
        window.setInterval(this.update.bind(this), 30000);
    }

    update() {


        console.log(this.SELECTED_SITE);

        load_api_data().then(() => {

            this.update_nodes();
            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            show_vertical_bar(get_zone_averages());

            this.draw_voronoi();

            console.log('reloaded api data')


        });

        console.log('updated', Date.now())
        clock.update(Date.now());
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

    get_url_date() {
        let date, month_long;
        if (URL_DATE == '*') {
            date = new Date()
            month_long = date.toLocaleString('default', {
                month: 'long'
            });
        } else {
            let spllit_date = URL_DATE.split('-')

            let months = [];
            //use moment.js for the date conversion from '9' or '09' to Septemeber
            months.push(moment().month(spllit_date[1] - 1).format("MMMM"));

            //make a string again to keep new Date() happy
            let date_string = spllit_date[0].toString() + ' ' + months[0].toString() + ' ' + spllit_date[2].toString();

            date = new Date(date_string)
            month_long = date.toLocaleString('default', {
                month: 'long'
            });
        }


        YYYY = date.getFullYear(); //'{{ YYYY }}';
        MM = date.getMonth() + 1; //'{{ MM }}';
        DD = date.getDate(); //'{{ DD }}';

        document.getElementById('date_now').innerHTML = "<h2 id='date_now_header'>" + DD + " " +
            month_long + " " + YYYY +
            "</h2>"
    }

    draw_voronoi() {

        console.log('selected_site',this.SELECTED_SITE)
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
                let color = SITE_DB.find(x => x.node_id === d.data.id).selected;

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
                let neighbors = SITE_DB.find(x => x.node_id === id).neighbors;

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
                this.SELECTED_SITE = SITE_DB.find(x => x.node_acp_id === d.data.acp_id);
                let selected_date=YYYY+"-"+MM+"-"+DD
                //make HUD elements visible
                document.getElementById("selected_cell").style.opacity = 1;
                document.getElementById("selected_cell").innerHTML = ICON_CLOSE_AND_DESELECT + "<br>" + "<h1>" + this.SELECTED_SITE.name + "</h1>";
                document.getElementById("datepicker").style.opacity = 1;

                //make the date navigation buttons visible 
                //(made invisible prior since without a cell selection, changing the date does not make sense)
                set_nav_date_visible(1);

                //load metadata for the node
                show_node_information(this.SELECTED_SITE.node_acp_id,selected_date);

                //add d3/css styling to the selected cell to make it pop
                select_cell(this.SELECTED_SITE.node_acp_id)

                //update url and add event listeners for date changes
                onchange_feature_select(this.SELECTED_SITE.node_acp_id, DD + "-" + MM + "-" + YYYY)
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
        // -historical(normal) speed
        // -deviation in speed from the normal
        change_modes();

        console.log(this.SELECTED_SITE)
        //in case the selected node has been mislabeled:
        if (this.SELECTED_SITE != undefined) {
            select_cell(this.SELECTED_SITE.node_acp_id);
        }


    }

    //-----------------------------------------------------//
    //-----------------END draw_voronoi()------------------//
    //-----------------------------------------------------//

    // move page to new date +n days from current date
    date_shift(n, node_id) {
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

    
    init_map() {

        let stamenToner = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
            attribution: 'Map tiles by Stamen Design, CC BY 3.0 - Map data © OpenStreetMap',
            subdomains: 'abcd',
            minZoom: 0,
            maxZoom: 20,
            ext: 'png'
        });
        let cambridge = new L.LatLng(52.20038, 0.1);

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
            "<input type='radio' name='mode' value='historical'> Normal Speed<br>" +
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
    }


    /*------------------------------------------------------*/
    /*--------------------HELPER FUNCT----------------------*/
    /*------------------------------------------------------*/

}



var show_node_information = (acp_id, START, END) => {
    document.getElementById("line_graph").style.opacity = 1;
    document.getElementById("line_graph").innerHTML = ICON_LOADING;

    if (START == undefined) {
        START = new Date().toISOString().slice(0, 10)
    }
    console.log('show_node_info', acp_id)
    show_node_metadata(acp_id)
    show_node_data(acp_id, START, END)
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