function show_horizontal_bar(data) {
    
    document.getElementById('bar_chart').innerHTML =ICON_CLOSE_DIV;
    document.getElementById('bar_chart').style.opacity=1;

    // set the dimensions and margins of the graph
    let margin = {
            top: 20,
            right: 20,
            bottom: 30,
            left: 40
        },
        width = 220 - margin.left - margin.right,
        height = 220 - margin.top - margin.bottom;


    // set the ranges
    let y = d3.scaleBand()
        .range([height, 0])
        .padding(0.1);

    let x = d3.scaleLinear()
        .range([0, width]);

    // append the svg object to the body of the page
    // append a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    let svg = d3.select("#bar_chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Scale the range of the data in the domains
    x.domain([0, d3.max(data, function (d) {
        return d.value;
    })])
    y.domain(data.map(function (d) {
        return d.zone;
    }));
    //y.domain([0, d3.max(data, function(d) { return d.sales; })]);

    //append title
    svg.append("text")
        .attr("x", (width / 2))
        .attr("y", 10 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("text-decoration", "none") //underline  
        .text("Zone Speeds");

    // append the rectangles for the bar chart
    svg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr('id', function (d) {
            return d.zone + '_bar'
        })
        .attr("class", "bar")
        //.attr("x", function(d) { return x(d.sales); })
        .attr("width", function (d) {
            return x(d.value);
        })
        .attr("y", function (d) {
            return y(d.zone);
        })
        .attr("height", y.bandwidth())
        .style('fill', function (d) {
            return CELL_GROUPS[d.zone]['color']
        })
        .on('mouseover', function (d, i) {
            get_outline(d.zone);

            for (let u = 0; u < ZONES.length; u++) {
                if (d.zone != ZONES[u]) {
                    d3.select('#' + ZONES[u] + '_bar').transition().duration(250).style('opacity', 0.4)
                }

            }


        })
        .on('click', function (d, i) {
            get_outline(d.zone);

            get_zone_metadata(d.zone)

        })
        .on('dblclick', function (d, i) {
            console.log('DBLCLICK')

        })
        .on('mouseout', function (d, i) {

            d3.selectAll('.cell_outline').remove();
            d3.selectAll('.bar').transition().duration(250).style('opacity', 1)
          
        });


    // add the x Axis
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    // add the y Axis
    svg.append("g")
        .call(d3.axisLeft(y));
}



// d3.select('#metadata_table')._groups[0][0].innerHTML = get_site_metadata(SITE)
function get_zone_metadata(ZONE) {
    let zone_children = SITE_DB.filter(x => x.parent === ZONE);
    let child_info = "<b>Inner nodes for:</b> "+"<b style='color:"+CELL_GROUPS[ZONE].color+"'>"+ZONE+"</b>" + "<br>";
    for (let u = 0; u < zone_children.length; u++) {
        let child = zone_children[u];
        console.log(child)

        const TAB = '&emsp;&emsp;&emsp;&emsp;'
        const HALF_TAB = '&emsp;&emsp;'

        let child_speed = HALF_TAB + TAB + "Current Speed: " + parseInt(child.travelSpeed) + "MPH";

        child_info += "<br>" + "<div class='metadata_zone' id='META_ZONE_" + child.acp_id + "'>" + "<i>" + child.name + "</i>" + "</div>" + child_speed;

    }
    document.getElementById('zone_table').innerHTML =ICON_CLOSE_DIV+child_info;
    document.getElementById('zone_table').style.opacity=1;

    d3.selectAll('.metadata_zone').on('mouseover', function (d, i) {
        d3.select(this).style('color', CELL_GROUPS[ZONE].color).style('font-weight', 'bold')
        let cell = document.getElementById(this.id.replace('META_ZONE_', ''))
        cell_mouseover(cell)
    })
    d3.selectAll('.metadata_zone').on('mouseout', function (d, i) {
        d3.select(this).style('color', 'black').style('font-weight', 'normal')
        let cell = document.getElementById(this.id.replace('META_ZONE_', ''))
        cell_mouseout(cell)
    })
    d3.selectAll('.metadata_zone').on('click', function (d, i) {
        let highlighted_cell = {
            'data': SITE_DB.find(x => x.acp_id == this.id.replace('META_ZONE_', ''))
        }

        console.log('HIGHLIGHT',highlighted_cell)
        
        show_node_information(highlighted_cell)
    })
}