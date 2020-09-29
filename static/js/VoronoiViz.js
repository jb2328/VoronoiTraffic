"use strict";
class VoronoiViz {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        this.svg_canvas = null;

        this.site_db = new SiteDB();

        this.hud = new Hud(this, this.site_db);

        this.tools = new VizTools();

        // Transform parameters to scale SVG to screen
        this.init_map(this);

        this.SELECTED_SITE = '';
        this.boundary_db = [];
        this.boundary_points = [];

        //object globals
        this.links_drawn = [];

        //svg groups
        this.polygon_group;
        this.dijkstra_group;
        this.zone_outlines;

        //color range picker
        this.set_color;
    }

    // init() called when page loaded
    init() {
        var parent = this;
        console.log('STARTING')


        parent.get_url_date();

        //-------------------------------//
        //--------LOADING API DATA-------//
        //-------------------------------//

        parent.site_db.load_api_data(parent).then(() => {
            console.log('FETCHING DATA')

            console.log('Creating Nodes');
            parent.site_db.initialise_nodes(parent);

            console.log('draw bar chart')
            parent.hud.show_vertical_bar(parent, parent.site_db.get_zone_averages(parent));

            if (URL_NODE != '*') {
                //merge:
                let node = parent.site_db.get_acp_id(parent, URL_NODE);
                console.log('selecting node', node)
                parent.site_db.set_selected_node(parent, node);
                console.log('selected node', parent.site_db.get_selected_node(parent))

                parent.select_cell(parent, node.node_acp_id)

                parent.hud.show_all(parent, parent.site_db.get_selected_node(parent));

                console.log('from url node', node, parent.site_db.get_selected_node(parent))
            }

            console.log('loading Voronoi');
            parent.draw_voronoi(parent);
            parent.generate_hull(parent);


        });


        //attach map event listeners
        map.on("viewreset moveend", parent.draw_voronoi.bind(parent));
        map.on("viewreset moveend", parent.generate_hull.bind(parent));

        //Will execute myCallback every X seconds 
        //the use of .bind(this) is critical otherwise we can't call other class methods
        //https://stackoverflow.com/questions/42238984/uncaught-typeerror-this-method-is-not-a-function-node-js-class-export
        window.setInterval(parent.update.bind(parent), 30000);
    }

    update() {
        var parent = this;
        console.log('UPDATING')

        parent.site_db.load_api_data(parent).then(() => {

            parent.site_db.update_nodes(parent);
            console.log('draw bar chart')

            // show_horizontal_bar(get_zone_averages());
            parent.hud.show_vertical_bar(parent, parent.site_db.get_zone_averages(parent));

            parent.draw_voronoi(parent);

            console.log('reloaded api data')


        });

        console.log('updated', Date.now())
        clock.update(Date.now());
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

    draw_voronoi(parent) {
        console.log('PARENT1', parent)
        if (parent.type == "moveend") {
            console.log('defining parent', this)
            parent = this;
        }
        console.log('PARENT2', parent)

        console.log('selected_site', parent, parent.site_db.get_selected_node(parent));
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
         hence the creation of variables like boundary_sites and parent.boundary_points. 
    
         */


        //we filter out sites from all_sites that are within our drawing box
        //e.g. when zoomed in, not all sites get drawn since they appear out of the screen
        var filtered_points = [];

        //filtered points are voronoi center points - bluetooth sensor locations
        filtered_points = parent.site_db.all_sites.filter(function (d, i) {
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
            parent.site_db.all[i].x = point.x;
            parent.site_db.all[i].y = point.y;

            return true;
        });

        //parent.boundary_points are voronoi center points that limit the perimeter of the visible cells.
        //We created a list of invisible cells so that the Voronoi diagram does not triangulate
        //itself to inifinity. The coordinates for these can be found in boundary_sites.js
        parent.boundary_points = boundary_sites.filter(function (d, i) {
            let latlng = new L.latLng(d.lat, d.lng);
            if (!drawLimit.contains(latlng)) {
                return false
            };

            let point = map.latLngToLayerPoint(latlng);

            //set coordinates values in boundary_sites for further use
            d.x = point.x;
            d.y = point.y;

            //set coordinates values in BOUNDARY_DB for further reuse
            parent.boundary_db.push({
                "lat": d.lat,
                "lng": d.lng,
                "x": point.x,
                "y": point.y
            });
            return true;
        });

        //create color a range to be able to color in cells based on their values
        parent.set_color = parent.set_color_range(parent);

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
        for (let i = 0; i < parent.boundary_points.length; i++) {
            filtered_points.push(parent.boundary_points[i]);
        }

        //create voronoi polygons from all the nodes.
        //this wouldn't work if we did voronoi.polygons(parent.boundary_points)
        //and voronoi.polygons(filtered_points) separately
        let voronoi_polygons = voronoi.polygons(filtered_points);

        //list containing all visible polygons. Here we separate
        //filetered_points from parent.boundary_points again
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
        parent.svg_canvas = d3.select(map.getPanes().overlayPane).append("svg")
            .attr("id", "cell_overlay")
            .attr("class", "leaflet-zoom-hide")
            .style("width", map.getSize().x + "px")
            .style("height", map.getSize().y + "px")
            .style("margin-left", topLeft.x + "px")
            .style("margin-top", topLeft.y + "px");

        //append voronoi polygons to the canvas
        parent.polygon_group = parent.svg_canvas.append("g")
            .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        //append zone outlines to the canvas
        parent.zone_outlines = parent.svg_canvas.append("g")
            .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        //append drawn links to the canvas
        parent.link_group = parent.svg_canvas.append("g")
            .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        //append dijkstra shortest path generated line to the canvas
        parent.dijkstra_group = parent.svg_canvas.append("g")
            .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        //append circles that illustrate sensors and polygons centers to the canvas.
        //It's not a global so we just declare it here
        let circle_group = parent.svg_canvas.append("g")
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
        parent.polygon_group.selectAll("g")
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
        parent.polygon_group.selectAll(".cell")
            .attr('fill', function (d) {

                //color the cell based on the selected reading from the SITE_DB
                //the lookup is done based on the matching id values (from SVG and in Nodes)

                let color = parent.site_db.get_id(parent, d.data.id).selected;

                //if undefined,set to gray
                if (color == null || color == undefined) {
                    return "rgb(50,50,50);"
                } else {
                    return parent.set_color(color)
                }
            })

            //----------ON MOUSEOVER---------//

            .on('mouseover', function (d) {

                //highlight the cell that is being hovered on
                parent.cell_mouseover(this);

                //get the id and the neighbors for the node that this cell represents
                let node_id = d.data.id;
                let neighbors = parent.site_db.get_id(parent, node_id).neighbors;

                //remove old links that were drawn for the other nodes 
                //that were hoverd in before
                d3.selectAll('.arc_line').remove()
                parent.link_group.remove();

                //draw links for every neighbor that the node has
                for (let i = 0; i < neighbors.length; i++) {

                    let inbound = neighbors[i].links.in.id;
                    let outbound = neighbors[i].links.out.id;

                    parent.draw_link(parent, inbound, 350);
                    parent.draw_link(parent, outbound, 350);
                }
            })
            //----------ON MOUSEOUT---------//

            .on('mouseout', function () {

                //unhighlight the cell that was being hovered on
                parent.cell_mouseout(this);

                //cleanup the links that were drawn
                parent.links_drawn = [];
                parent.link_group.remove();
                d3.selectAll('.arc_line').remove()

            })

            //----------ON CLICK---------//

            .on('click', function (d, i) {

                let selected_node = parent.site_db.get_acp_id(parent, d.data.acp_id)
                //set as the main global selection 
                parent.site_db.set_selected_node(parent, selected_node);

                parent.select_cell(parent, selected_node.node_acp_id)

                parent.hud.show_all(parent, selected_node);

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
                    let problem = parent.generate_graph(parent, selected_sites[0].name, selected_sites[1].name);

                    //run the Dijkstra shortest path on the generated graph  
                    //[returns the names of the nodes in order of the shortest path]
                    let result = dijkstra(problem, selected_sites[0].name, selected_sites[1].name);

                    //this will contain the coordinates of the nodes that the shortest path passes through
                    let path = [];

                    //fill the path variable with the shortest path data returned by the Dijkstra algorithm
                    for (let i = 0; i < result.path.length; i++) {

                        console.log(result.path[i]);

                        let found = voronoi_viz.site_db.get_name(parent, result.path[i]);

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
                    let shortest_path_line = parent.dijkstra_group.append("path")
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
        parent.polygon_group.selectAll(".cell").append("title").text(function (d) {
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
        parent.change_modes(parent);

        //in case the selected node has been mislabeled:

        let node = parent.site_db.get_selected_node(parent).node_acp_id;
        parent.select_cell(parent, node);

    }


    //creates a d3 color interpolator 
    //from the min/max values of the data
    set_color_range(parent) {

        let values = parent.site_db.get_min_max(parent);
        let min = values.min;
        let max = values.max;

        //create a d3 color interpolator
        return d3.scaleSequential().domain([min, max])
            .interpolator(d3.interpolateRdYlGn);
    }

    //-----------------------------------------------------//
    //-----------------END draw_voronoi()------------------//
    //-----------------------------------------------------//

    // move page to new date +n days from current date
    date_shift(n, node_id) {
        let parent = this;

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

        let new_date = new Date(document.getElementById('date_now_header').innerHTML); // as loaded in page template config_ values;

        new_date.setDate(new_date.getDate() + n);

        let new_year = new_date.getFullYear();
        let new_month = ("0" + (new_date.getMonth() + 1)).slice(-2);
        let new_month_long = new_date.toLocaleString('default', {
            month: 'long'
        });

        let new_day = ("0" + new_date.getDate()).slice(-2);

        let query_date = new_year + "-" + new_month + "-" + new_day;
        document.getElementById('date_now_header').innerHTML = new_day + " " + new_month_long + " " + new_year

        parent.hud.show_node_information(parent, node_id, query_date);

        let url_date = new_year + '-' + new_month + '-' + new_day;
        parent.update_url(node_id, url_date);

    }
    // ************************************************************************************
    // ************** Date forwards / backwards function **********************************
    // ************************************************************************************


    update_url(node, date) {

        //get the date for today, later to be used to check if the url needs updating
        let new_date = new Date()
        let today = ("0" + new_date.getDate()).slice(-2) + "-" + ("0"+(new_date.getMonth() + 1)).slice(-2)+ "-" + new_date.getFullYear();

        //update the current date on the top of the screen (in case update_url() called not
        //from within the date_shift() function)
        let passed_date = new Date(date)

        let new_day = ("0" + passed_date.getDate()).slice(-2);
        let new_month = ("0" + (passed_date.getMonth() + 1)).slice(-2);
        let new_year = passed_date.getFullYear();
        let new_month_long = passed_date.toLocaleString('default', {
            month: 'long'
        });

        let header_date = new_day + "-" + new_month_long + "-" + new_year;
        let checker_date = new_day + "-" + new_month + "-" + new_year;

        //set the new date on the top
        document.getElementById('date_now_header').innerHTML = header_date;

        //update the actual url
        let searchParams = new URLSearchParams(window.location.search)

        searchParams.set("node", node);

        console.log('DATES', today, checker_date, today == checker_date)
        console.log('search params',)
        if (searchParams.get("date")!=checker_date) {
           // if(today != checker_date){
            searchParams.set("date", checker_date);           
        }
        else{
           // searchParams=searchParams.toString().split("&")[0]
        }

        let newRelativePathQuery = window.location.pathname + '?' + searchParams.toString();
        window.history.pushState(null, '', newRelativePathQuery);
        console.log('updated URL', node, checker_date)
    }


    onchange_feature_select(parent, node_id, date) {
        console.log("onchange_feature_select", window.location.href);

        parent.set_date_onclicks(parent, node_id);

        // Change the URL in the address bar
        parent.update_url(node_id, date);
    }

    set_date_onclicks(parent, node_id) {
        // set up onclick calls for day/week forwards/back buttons
        document.getElementById("back_1_week").onclick = function () {
            parent.date_shift(-7, node_id)
        };
        document.getElementById("back_1_day").onclick = function () {
            parent.date_shift(-1, node_id)
        };
        document.getElementById("forward_1_week").onclick = function () {
            parent.date_shift(7, node_id)
        };
        document.getElementById("forward_1_day").onclick = function () {
            parent.date_shift(1, node_id)
        };
    }


    init_map(parent) {

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

        //THE FOLLOWING ARE VERY MUCH MISPLACED HERE, SHOULD BE A PART OF Hud CLASS OR AT LEAST VizTools

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
            '<input type="text" name="datefilter" id="datepicker_input" value="" />';


        let line_graph_element = parent.hud.create_element(parent, 'line_graph', 'bottomleft')
        let datepicker_widget = parent.hud.create_element(parent, 'datepicker', 'bottomleft', datepicker_text) //datepicker_text
        document.getElementById("datepicker").style.opacity = 0;

        //probably should make a different function in Hud to hide everything
        parent.hud.set_nav_date_visible(0)

        let metadata_element = parent.hud.create_element(parent, 'metadata_table', 'bottomleft')

        let selected_cell = parent.hud.create_element(parent, 'selected_cell', 'topright', '<h4>Select a Cell</h4>')

        let info_widget = parent.hud.create_element(parent, 'info_bar', 'topright', info_viz_text)

        let horizontal_chart = parent.hud.create_element(parent, 'bar_chart', 'topright', parent.tools.ICON_LOADING)
        let zone_table = parent.hud.create_element(parent, 'zone_table', 'bottomright')
    }

    //----------------------------------//
    //---------Drawing Links------------//
    //----------------------------------//

    //draws a link between two sites
    //[*link* is link id, *dur* is the animation duration, *color* (optional) link's color when drawn]
    //This function has further nested functions that I thought would not make sense as object methods, 
    //since those were only used in the context of draw_link()
    draw_link(parent, link, dur, color) {

        //add the link_group to the canvas again 
        //(we detach it previously to make it invisible after mouseout is being performed)
        parent.link_group = parent.svg_canvas.append("g")
            .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        //find the sites that the link connects
        let connected_sites = parent.site_db.all_links.find(x => x.id === link).sites;

        let from = parent.site_db.get_id(parent, connected_sites[0]);
        let to = parent.site_db.get_id(parent, connected_sites[1]);

        //acquire the direction of the link by checking if it's opposite exists.
        //If the opposite's drawn on screen, make arc's curvature inverse.
        let direction = parent.links_drawn.includes(parent.site_db.inverse_link(parent, link)) ? "in" : "out";

        //calculate the speed deviation for the link in question
        let deviation = parent.site_db.calculate_deviation(parent, link) //negative slower, positive faster

        //acquire the minmax values for the color scale.
        //we create a new color scale, even though the old one exits
        //because the drawn links always colored based on speed deviation, 
        //whereas the general set_colorScale can be changed to speed ranges etc.
        let values = parent.site_db.get_min_max(parent);

        var scale = d3.scaleLinear()
            .domain([values.min, values.max])
            .range([values.min, values.max]);

        //if color's not defined, color the link based on speed deviation
        color = color == undefined ? parent.set_color(scale(deviation)) : color;

        let strokeWeight = 5;

        //animate the line
        let link_line = generate_arc(from, to, direction, strokeWeight, color);
        let line_length = link_line.node().getTotalLength();
        animate_movement(link_line, line_length, dur);

        //add to the drawn list so we know what the opposite link's
        //direction is

        parent.links_drawn.push(link);


        //----------Generating and Drawing Arcs--------//

        function generate_arc(A, B, direction, strokeWeight, stroke) {

            return parent.link_group
                .append('path')
                .attr('d', curved_line(A.x, A.y, B.x, B.y, direction === "in" ? 1 : -1))
                .attr('class', 'arc_line')
                .style("fill", "none")
                .style("fill-opacity", 0)
                .attr("stroke", stroke)
                .attr("stroke-opacity", 1)
                .style("stroke-width", strokeWeight);
        }

        //compute the arc points given start/end coordinates
        //[start/end coordinates, dir stands for direction]
        function curved_line(start_x, start_y, end_x, end_y, dir) {

            //find the middle location of where the curvature is 0
            let mid_x = (start_x + end_x) / 2;

            let a = Math.abs(start_x - end_x);
            let b = Math.abs(start_y - end_y);

            //curvature height/or how curved the line is
            //[y offset in other words]
            let off = a > b ? b / 10 : 15;

            let mid_x1 = mid_x - off * dir;

            //calculate the slope of the arc line
            //let mid_y1 = parent.slope(mid_x1, start_x, start_y, end_x, end_y);

            //computes the slope on which we place the arc lines
            //indicate links between sites
            let midX = (start_x + end_x) / 2;
            let midY = (start_y + end_y) / 2;
            let slope = (end_y - start_y) / (end_x - start_x);

            let mid_y1 = (-1 / slope) * (mid_x1 - midX) + midY;

            return ['M', start_x, start_y, // the arc start coordinates (where the starting node is)
                    'C', // This means we're gonna build an elliptical arc
                    start_x, ",", start_y, ",",
                    mid_x1, mid_y1,
                    end_x, ',', end_y
                ]
                .join(' ');
        }



        //animates lines being rendered as if they move through the map.
        //It's how we create a sense of directionality from links
        function animate_movement(line, outboundLength, dur) {

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

    }



    colorTransition(parent, viz_type) {

        parent.site_db.set_visualisations(parent, viz_type)
        let set_color = parent.set_color_range(parent);

        parent.polygon_group.selectAll(".cell")
            .transition()
            .duration('1000')
            .attr('fill', function (d, i) {

                let color = parent.site_db.all[i].selected;
                if (color == null || color == undefined) {
                    return "rgb(50,50,50);"
                } else {
                    return set_color(color) //c10[i % 10]
                }
            })

    }



    //Generate a graph that is used by the Dijkstra algorithm.
    //Find all the weights for node edges between the *start* and *finish* nodes
    generate_graph(parent, start, finish) {

        let graph = {};

        //iterate over the SITE_DB to find the start/finish nodes
        //and all the other nodes in between
        parent.site_db.all.forEach((element) => {

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


    drawLinks(start_x, start_y, end_x, end_y, dur, fill) {

        let link_in = parent.link_group
            .append('path')
            .attr('d', this.curved_line(start_x, start_y, end_x, end_y, 1))
            .style("fill", fill)
            .style("fill-opacity", 0)
            .attr("stroke", "blue")
            .attr("stroke-opacity", 0.5)
            .style("stroke-width", 2);

        let link_out = parent.link_group
            .append('path')
            .attr('d', this.curved_line(end_x, end_y, start_x, start_y, -1))
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

    drawRoutes(parent) {

        for (let d = 0; d < parent.site_db.all.length; d++) {

            let node_id = parent.site_db.all[d].id;

            let neighbors = parent.site_db.get_id(parent, node_id).neighbors;

            for (let i = 0; i < neighbors.length; i++) {

                let x_coord = parent.site_db.get_id(parent, neighbors[i].id).x;
                let y_coord = parent.site_db.get_id(parent, neighbors[i].id).y;
            }
        }
    }

    change_modes(parent) {
        d3.selectAll("input").on("change", function () {
            //console.log(d);

            if (this.value === "current") {
                parent.colorTransition("travel speed");
            }
            if (this.value === "deviation") {

                parent.colorTransition("speed deviation");
            }
            if (this.value === "historical") {
                parent.colorTransition("historical speed");
            }
            if (this.value === "routes") {
                console.log("routes");
                parent.polygon_group.remove();
                for (let j = 0; j < parent.site_db.get_length(); j++) {

                    let node_id = parent.site_db.all[j].node_id;

                    let neighbors = parent.site_db.get_id(parent, node_id).neighbors;

                    //REALLY BROKEN, BOTH DIRECTIONS SHOW THE SAME COLOR;  
                    for (let i = 0; i < neighbors.length; i++) {
                        //console.log(i);
                        let inbound = neighbors[i].links.in.id;
                        let outbound = neighbors[i].links.out.id;

                        parent.draw_link(parent, inbound, 1000);
                        parent.draw_link(parent, outbound, 1000);

                    }
                }
            }
            if (this.value === "polygons") {
                parent.draw_voronoi(parent);
                parent.generate_hull(parent);

            }
        });
    }
    /*------------------------------------------------------*/
    /*-----------------HULL MANAGEMENT FUNCT----------------*/
    /*------------------------------------------------------*/

    generate_hull(parent) {

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

    get_outline(parent, zone_id) {
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
            parent.zone_outlines.append("g")
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
                parent.zone_outlines.append("g")
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


    /*------------------------------------------------------*/
    /*-----------------SELECTION FUNCT----------------------*/
    /*------------------------------------------------------*/

    select_cell(parent, id) {
        console.log('select_cell', parent)
        parent.deselect_all(parent)
        let cell = document.getElementById(id)
        let node = parent.site_db.get_acp_id(parent, id)
        parent.site_db.set_selected_node(parent, node)
        parent.cell_clicked(cell)
    };

    select_all(parent) {
        let cells = document.getElementsByClassName("cell")
        for (let i = 0; i < cells.length; i++) {
            parent.cell_clicked(cells[i])
        }

    };


    deselect_all(parent) {
        let cells = document.getElementsByClassName("cell")
        for (let i = 0; i < cells.length; i++) {
            parent.cell_regular(cells[i])
        }
    };

    //cell manipulation + interactivity
    cell_mouseover(cell) {
        d3.select(cell).transition()
            .duration('300')
            .style('stroke', 'black')
            //.style('stroke-width', 10)
            .style("stroke-opacity", 1)
            .style("fill-opacity", 0.85);
    };
    cell_mouseout(cell) {
        d3.select(cell).transition()
            .duration('300')
            .style('stroke', 'black')
            // .style('stroke-width', 0.5)
            .style("stroke-opacity", 0.3)
            .style("fill-opacity", 0.3);
    };

    cell_clicked(cell) {
        d3.select(cell)
            .style('stroke-opacity', 1)
            .style('stroke', 'black')
            .style('stroke-width', 4);
    };

    cell_regular(cell) {
        d3.select(cell)
            .style('stroke', 'black')
            .style('stroke-width', 0.5)
            .style("stroke-opacity", 0.3)
            .style("fill-opacity", 0.3);
    };

}

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