function show_bar(data) {
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
            return d.zone+'_bar'
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
                    d3.select('#' + ZONES[u]+'_bar').transition().duration(250).style('opacity', 0.4)
                }

            }

        })
        .on('mouseout', function (d, i) {

            d3.selectAll('.cell_outline').remove();

            for (let u = 0; u < ZONES.length; u++) {
                d3.select('#' + ZONES[u]+'_bar').transition().duration(250).style('opacity', 1)
            }
        });


    // add the x Axis
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    // add the y Axis
    svg.append("g")
        .call(d3.axisLeft(y));
}