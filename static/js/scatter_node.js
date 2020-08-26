async function historical_link(link_id, date1, date2) {
  if (date2 != null) {
    return await d3.json(

      "https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/history/" + link_id +
      "/?start_date=" + date1 + "&end_date" + date2, {
        headers: new Headers({
          "Authorization": `Token a62fb5390f070c129591b6ff19c0a8cf06440efc`
        }),
      })
  }

  return await d3.json(

    "https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/history/" + link_id +
    "/?start_date=" + date1, {
      headers: new Headers({
        "Authorization": `Token a62fb5390f070c129591b6ff19c0a8cf06440efc`
      }),
    })

}

var NODE;
async function show_node_tt_past(site_id, date_start, date_end) {
  //find the requested site_id in the SITE_DB
  let site = SITE_DB.find(x => x.id == site_id);
  console.log('site', site)
  NODE = site_id;
  //lookup neighbours
  let promise_list = []
  let all_lists = []
  for (let i = 0; i < site.neighbors.length; i++) {

    //replace the vertical bars so we have a valid string we can use to query
    let id_out = site.neighbors[i].links.in.acp_id.replace('|', '%7C');
    let id_in = site.neighbors[i].links.out.acp_id.replace('|', '%7C');
    console.log(id_out, id_in)

    historical_link(id_out, date_start, date_end).then((data) => {
      all_lists.push(data)
    });
    historical_link(id_in, date_start, date_end).then((data) => {
      all_lists.push(data)
    });

  }

  compile_data(all_lists.length, site.neighbors.length).then(() => {
    //console.log('all_lists', all_lists)

    let all_data = []

    // console.log('lists', all_lists[0].request_data)
    //console.log('all_lists', all_lists[0].request_data)

    all_lists.forEach(item => {

      console.log('item', item)
      let elements = item.request_data;

      elements.forEach(element => {

        // console.log('element', element, "time", element.time.slice(11, 20), "date", element.time.slice(0, 10));

        if ((element.travelTime < 300) && (element.travelTime > 0)) {

          all_data.push({
            'id': element.id,
            'acp_id': element.acp_id.replace('|', '_'),
            "x": element.acp_ts,
            "y": element.travelTime, //normalTravelTime
            "y_2": element.normalTravelTime, //
            "time": element.time.slice(11, 20),
            "date": element.time.slice(0, 10)
          })

        }
        // console.log();
      })

    })
    //console.log(all_data.length);
    // Add X axis

    let min_max = {
      'min_x': Math.min(...all_data.map(a => a.x)),
      'min_y': Math.min(...all_data.map(a => a.y)),
      'max_x': Math.max(...all_data.map(a => a.x)),
      'max_y': Math.max(...all_data.map(a => a.y))
    }

    //if queried data is for today, our x axis should still show 24hours
    if (min_max.max_x - min_max.min_x < 86400) { //86400
      min_max.max_x = min_max.min_x + 86400;
    }
    let queried_date = new Date(min_max.min_x * 1000)

    let title_date = queried_date.toLocaleString()
    show_line_plot(all_data, min_max, site_id, date_start, date_end);
    //show_plot(all_data, min_max, site_id, date_start, date_end)


  })


}


//compile_data() is used to check that all promises have been
//resolved by evaluating the two condition arguments
async function compile_data(cond1, cond2) {
  console.log('waiting to resolve promises');
  await waitForCondition({
    arg: cond1,
    test: cond2
  })
  console.log('promises have been resolved');

}


//wait for condition work with compile_data() to
//check that promises have been resolved. We set
//a timeout every second to check the conditional
//statement.
async function waitForCondition(conditionObj) {
  let start_time = new Date().getTime()

  while (true) {
    //arg and test are the two parameters that 
    //have the conditional information on promises
    if (conditionObj.arg == conditionObj.test) {
      console.log('met');
      break; // or return
    }
    if (new Date() > start_time + 2000) {
      console.log('not met, time out');
      break; // or throw
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}


function show_line_plot(total_list, min_max, NODE, START, END) {
  // set the dimensions and margins of the graph
  var margin = {
      top: 30,
      right: 100,
      bottom: 40,
      left: 40
    },
    width = 500 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  //MAKE SURE THE DIV IS EMPTY 
  d3.select('#test_graph')._groups[0][0].innerHTML = '';
  // append the svg object to the body of the page
  var svg = d3.select("#test_graph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");

  // console.log('domains', min_x, max_x, min_y, max_y);

  var x = d3.scaleLinear()
    .domain([min_max.min_x, min_max.max_x])
    .range([0, width]);

  var x_axis = d3.axisBottom(x).ticks(15).tickFormat(function (d, i) {

    let dateObject = new Date(d * 1000)

    let humanDateFormat = dateObject.toLocaleString() //2019-12-9 10:30:15

    // console.log(d, i, humanDateFormat)
    return humanDateFormat; //.slice(11, 20);
  });

  END = END == 'undefined' ? '' : END;
  svg.append("text")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("text-decoration", "none") //underline  
    .text("Travel time for " + NODE + " on " + START + ' ' + END);

  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(x_axis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", function (d) {
      return "rotate(-30)"
    });

  // Add Y axis
  let y_padding = 100;
  var y = d3.scaleLinear()
    .domain([min_max.min_y - y_padding, min_max.max_y + y_padding])
    .range([height, 0]);

  svg.append("g")
    .call(d3.axisLeft(y));

  console.log('list totale', total_list)
  let new_list = []
  let temp_id = total_list[0].acp_id;
  let new_sublist = [];
  let colors = ['Black', 'Fuchsia', 'Red', 'Teal', 'Orange', 'Maroon', 'Olive', 'Green', 'Purple', 'Lime', 'Aqua', 'Blue'];

  for (let i = 0; i < total_list.length; i++) {
    let current_id = total_list[i].acp_id;
    if (current_id != temp_id) {
      temp_id = current_id;
      new_list.push(new_sublist)
      new_sublist = [];
    }
    new_sublist.push(total_list[i]);
    console.log(total_list[i].acp_id)
  }
  new_list.push(new_sublist)

  console.log('new list', new_list)

  //remove the first element
  //new_list.shift()
  let keys = []
  for (let u = 0; u < new_list.length; u++) {
    // Add the line
    svg.append("path")
      .datum(new_list[u])
      .attr("fill", "none")
      .attr("id", "LG_" + new_list[u][0].acp_id) //LG for line graph
      .attr("class", "connected_scatter_line")
      .attr("stroke", colors[u])
      .attr("stroke-width", 2.5)
      .attr("d", d3.line()
        .x(function (d) {
          return x(d.x)
        })
        .y(function (d) {
          return y(d.y)
        })
      );

    d3.select('#META_' + new_list[u][0].acp_id).style('color', colors[u])

    //27 is th lenght of a rout id, whreas 12 martks the star of the unique string in "CAMBRIDGE_JTMS_9800Z0SUAHN1"

    keys.push({
      'name': new_list[u][0].acp_id.substr(27 - 12, 27),
      'color': colors[u]
    })
    //document.getElementById("meta_"+dir_in).getAttribute('stroke')

    //let get_route_stroke_to=document.getElementById("LG_"+dir_in).getAttribute('stroke')
    //let get_route_stroke_from=document.getElementById("LG_"+dir_out).getAttribute('stroke')
    //console.log("STROKES",get_route_stroke_to,get_route_stroke_from)

    // create a tooltip
    // var tooltip = d3.select("#my_dataviz")
    // .append("div")
    //   .style("position", "absolute")
    //   .style("visibility", "hidden")
    //   .text("I'm a circle!");

    // //
    // d3.select("#circleBasicTooltip")
    // .on("mouseover", function(){return tooltip.style("visibility", "visible");})
    // .on("mousemove", function(){return tooltip.style("top", (event.pageY-800)+"px").style("left",(event.pageX-800)+"px");})
    // .on("mouseout", function(){return tooltip.style("visibility", "hidden");});

  }


  // Add one dot in the legend for each name.
  var size = 15
  let y_sizing = 0
  let x_sizing = 360
  console.log('keys', keys)
  svg.selectAll("mydots")
    .data(keys)
    .enter()
    .append("rect")
    .attr("x", x_sizing)
    .attr("y", function (d, i) {
      return y_sizing + i * (size + 5)
    }) // 100 is where the first dot appears. size+5 is the distance between dots
    .attr("width", size)
    .attr("height", size)
    .style("fill", function (d) {
      return d.color
    })
    .attr("id", function (d, i) {
      return "LEGEND_CAMBRIDGE_JTMS_" + d.name
    }) //LG for line graph
    .attr("class", "legend")
    .on('mouseover', function (d, i) {
      let selected = 'CAMBRIDGE_JTMS_' + d.name
      console.log(d, i)
      // Use D3 to select element, change color and size
      d3.selectAll('.connected_scatter_line', '.legend').transition().duration(250).style('opacity', 0.4)
      d3.select('#LEGEND_' + selected).transition().duration(250).style('opacity', 1)

      d3.selectAll().transition().duration(250).style('opacity', 0.4)
      d3.select('#LG_' + selected).transition().duration(250).style('opacity', 1).attr("stroke-width", 4);
      drawLink(selected, 350, colors[i]);

    })
    .on('mouseout', function (d) {
      let selected = 'CAMBRIDGE_JTMS_' + d.name
      // Use D3 to select element, change color and size
      d3.selectAll('.legend').transition().duration(250).style('opacity', 1)
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 1)
      d3.select('#LG_' + selected).attr("stroke-width", 2.5);
      lineGroup.remove();
      d3.selectAll('.arch_line').remove()
    });

  // Add one dot in the legend for each name.
  svg.selectAll("mylabels")
    .data(keys)
    .enter()
    .append("text")
    .attr("x", x_sizing + size * 1.2)
    .attr("y", function (d, i) {
      return y_sizing + i * (size + 5) + (size / 2)
    }) // 100 is where the first dot appears. 25 is the distance between dots
    .style("fill", function (d) {
      return d.color
    })
    .text(function (d) {
      return d.name
    })
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle")
    .style("font-size", "10px");


  d3.selectAll('.connected_scatter_line')
    .on('mouseover', function (d, i) {
      console.log(d[0].acp_id)
      // Use D3 to select element, change color and size
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 0.4)
      d3.select(this).transition().duration(250).style('opacity', 1).attr("stroke-width", 4);
      drawLink(d[0].acp_id, 350, colors[i]);


    })
    .on('mouseout', function () {
      // Use D3 to select element, change color and size
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 1)
      d3.select(this).attr("stroke-width", 2.5);
      lineGroup.remove();
      d3.selectAll('.arch_line').remove()
    })


  console.log('LOOOOOOOOOOOOOOOOOADED')

}

function show_plot(total_list, min_max, NODE, START, END) {
  // set the dimensions and margins of the graph
  var margin = {
      top: 30,
      right: 10,
      bottom: 30,
      left: 40
    },
    width = 500 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  //MAKE SURE THE DIV IS EMPTY 
  d3.select('#my_dataviz')._groups[0][0].innerHTML = '';
  // append the svg object to the body of the page
  var svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");

  // console.log('domains', min_x, max_x, min_y, max_y);

  var x = d3.scaleLinear()
    .domain([min_max.min_x, min_max.max_x])
    .range([0, width]);

  var x_axis = d3.axisBottom(x).ticks(15).tickFormat(function (d, i) {

    let dateObject = new Date(d * 1000)

    let humanDateFormat = dateObject.toLocaleString() //2019-12-9 10:30:15

    // console.log(d, i, humanDateFormat)
    return humanDateFormat; //.slice(11, 20);
  });
  END = END == 'undefined' ? '' : END;
  svg.append("text")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("text-decoration", "none") //underline  
    .text("Travel time for " + NODE + " on " + START + ' ' + END);

  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(x_axis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", function (d) {
      return "rotate(-30)"
    });

  // Add Y axis
  let y_padding = 100;
  var y = d3.scaleLinear()
    .domain([min_max.min_y - y_padding, min_max.max_y + y_padding])
    .range([height, 0]);

  svg.append("g")
    .call(d3.axisLeft(y));

  // Add dots
  svg.append('g')
    .selectAll("dot")
    .data(total_list)
    .enter()
    .append("circle")
    .attr("cx", function (d, i) {
      return x(d.x);
    }) //console.log(d,i,total_list[i].x,d.y);
    .attr("cy", function (d, i) {
      return y(d.y_2);
    })
    .attr("r", 1.5)
    .style("fill", "#ff0000")
    .style('opacity', 0.1);

  // Add dots
  svg.append('g')
    .selectAll("dot")
    .data(total_list)
    .enter()
    .append("circle")
    .attr("cx", function (d, i) {
      return x(d.x);
    }) //console.log(d,i,total_list[i].x,d.y);
    .attr("cy", function (d, i) {
      return y(d.y);
    })
    .attr("r", 2.5)
    .style("fill", "#69b3a2");



  d3.selectAll('circle')
    .on('mouseover', function (d, i) {
      console.log(d)
      // Use D3 to select element, change color and size
      d3.select(this).attr("r", 10)
        .style("fill", "#ff00f9");
    })
    .on('mouseout', function () {
      // Use D3 to select element, change color and size
      d3.select(this).attr("r", 2.5)
        .style("fill", "#69b3a2");
    })

}


//unused to function to calculate travelTime (tt) for
//a given site from the SITE_DB
function show_node_tt_now(site_id) {
  console.log('showing', site_id)
  //find the requested site_id in the SITE_DB
  let SITE = SITE_DB.find(x => x.id == site_id);
  
  d3.select('#metadata_table')._groups[0][0].innerHTML = get_site_metadata(SITE)

  console.log('site', SITE)

  //compute average in+out travel time from all neighbors
  let combined_tt = 0;
  for (let i = 0; i < SITE.neighbors.length; i++) {
    combined_tt += SITE.neighbors[i].travelTime; //this will change when Node class get restructured to differentiate between in and out travel time
  }
  //compute average
  let avg_tt = combined_tt / SITE.neighbors.length;
  //the answer doesnt match with site.travelTime for some reason
  console.log('avg speed now', avg_tt)

}

function get_site_metadata(SITE){
  let neighbour_info = "<b>Surrounding nodes:</b> " + "<br>";
  for (let u = 0; u < SITE.neighbors.length; u++) {
    let neighbour = SITE.neighbors[u];

    //double check
    let dir_in = SITE_DB.find(x => x.id === neighbour.links.out.sites[1]).name;
    let dir_out = SITE_DB.find(x => x.id === neighbour.links.in.sites[0]).name;
    console.log('dir', neighbour.links)

    const TAB = '&emsp;&emsp;&emsp;&emsp;'
    const HALF_TAB = '&emsp;&emsp;'
  
    let to = HALF_TAB + "<div class='metadata' id='META_" + neighbour.links.in.id + "'>" + TAB + "<b>To:</b> " + "Current Speed: " + parseInt((neighbour.dist / neighbour.travelTime) * TO_MPH) + "MPH" + "</div>";
    let from = HALF_TAB + "<div class='metadata' id='META_" + neighbour.links.out.id + "'>" + TAB + "<b>From:</b> " + "Current Speed: " + parseInt((neighbour.dist / neighbour.travelTime) * TO_MPH) + "MPH" + "</div>";

    neighbour_info += "<br>" + "<i>" + neighbour.site + "</i>" + to + from;
  }

  return "<b>" + SITE.name + "</b>" + '<br>' +
  "Average Travel Speed: " + parseInt(SITE.travelSpeed) + "MPH" + '<br>' +
  "Speed Deviation: " + SITE.deviation + '<br><br>' + neighbour_info;
}