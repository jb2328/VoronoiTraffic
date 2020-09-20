const WEEK = 86400 * 7;

const LINE_GRAPH_COLORS = ['MidnightBlue', 'Fuchsia', 'Red', 'Teal', 'Orange', 'Maroon', 'Olive', 'Green', 'Purple', 'Lime', 'Aqua', 'Blue'];

async function historical_link(link_id, date1, date2) {

  if (date2 != undefined) {

    return await d3.json(

      HISTORICAL_API + link_id +
      "/?start_date=" + date1 + "&end_date=" + date2, {
        headers: new Headers({
          "Authorization": `Token ` + API_TOKEN
        }),
      })
  } else {

    return await d3.json(

      HISTORICAL_API + link_id +
      "/?start_date=" + date1, {
        headers: new Headers({
          "Authorization": `Token ` + API_TOKEN
        }),
      })
  }


}

//DOES NOT SHOW DATA FOR MISSING ROUTES, SO MAYBE IT SHOULD DISPLAY HISTORICAL TRAVEL TIMES INSTEAD
async function show_node_data(site_id, date_start, date_end) {

  //find the requested site_id in the SITE_DB
  let site = SITE_DB.find(x => x.id == site_id);
  let site_name = site.name;

  console.log('site', site, site.neighbors)
  console.log('date', date_start, date_end)

  //lookup neighbours
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

  await_promises(all_lists.length, site.neighbors.length).then(() => {

    let hist_data = restructure_hist_data(all_lists); //  WHY DO I NEED TWO RESTRUCTURINGS

    let min_max = {
      'min_x': Math.min(...hist_data.map(a => a.ts)),
      'min_y': Math.min(...hist_data.map(a => a.speed)),
      'max_x': Math.max(...hist_data.map(a => a.ts)),
      'max_y': Math.max(...hist_data.map(a => a.speed))
    }


    //starts x axis at midnight
    min_max.min_x = toTimestamp(date_start + " 00:00:00")

    //if queried data is for today, our x axis should still show 24hours
    if (min_max.max_x - min_max.min_x < 86399) { //86400
      min_max.max_x = min_max.min_x + 86400;
    }


    try {
      let restructured_route_data = restructure_to_sublists(hist_data)
      show_line_plot(restructured_route_data, min_max, site_name, date_start, date_end);
    } catch (err) {
      console.log('Error message', err)
      document.getElementById('line_graph').innerHTML = "No data received";
      document.getElementById('line_graph').style.opacity = 1;
    }
  })
}

function toTimestamp(strDate) {
  var datum = Date.parse(strDate);
  return datum / 1000;
}

function restructure_hist_data(unstr_fetched_data) {
  let structured_data = []

  unstr_fetched_data.forEach(item => {

    console.log('item', item)
    let elements = item.request_data;

    elements.forEach(element => {

      //console.log('element', element, "time", element.time.slice(11, 20), "date", element.time.slice(0, 10));
      let link_length = all_links.find(x => x.acp_id === element.id).length;

      if ((element.travelTime < 500) && (element.travelTime > 0)) {

        structured_data.push({
          'id': element.id,
          'acp_id': element.id.replace('|', '_'),
          "ts": element.acp_ts,
          "travel_time": element.travelTime, //normalTravelTime
          "normal_travel_time": element.normalTravelTime, //
          "speed": (link_length / element.travelTime) * TO_MPH,
          "normal_speed": (link_length / element.normalTravelTime) * TO_MPH,
          "time": element.time.slice(11, 20),
          "date": element.time.slice(0, 10),
          "length": link_length
        })

      }
    })

  })
  return structured_data;
}
//await_promises() is used to check that all promises have been
//resolved by evaluating the two condition arguments
async function await_promises(cond1, cond2) {
  console.log('waiting to resolve promises');
  await waitForCondition({
    asked: cond1,
    asnwered: cond2
  })
  console.log('promises have been resolved');

}


//wait for condition work with await_promises() to
//check that promises have been resolved. We set
//a timeout every second to check the conditional
//statement.
async function waitForCondition(conditionObj) {
  let start_time = new Date().getTime()

  while (true) {
    //arg and test are the two parameters that 
    //have the conditional information on promises
    if (conditionObj.asked == conditionObj.asnwered) {
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
var x_scale, y_scale;

function show_line_plot(route_data, min_max, site_name, START, END) {
  // set the dimensions and margins of the graph
  var margin = {
      top: 30,
      right: 100,
      bottom: 45,
      left: 40
    },
    width = 500 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  //MAKE SURE THE DIV IS EMPTY and visible
  document.getElementById('line_graph').innerHTML = ICON_CLOSE_DIV;
  document.getElementById('line_graph').style.opacity = 1;

  // append the svg object to the body of the page
  var svg = d3.select("#line_graph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");

  // console.log('domains', min_x, max_x, min_y, max_y);

  x_scale = d3.scaleLinear()
    .domain([min_max.min_x, min_max.max_x])
    .range([0, width]);

  var x_axis = d3.axisBottom(x_scale).ticks(27).tickFormat(function (d, i) {
    let event = new Date(d * 1000);

    let options = {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    };
    let humanDateFormat = event.toLocaleDateString('en-GB', options)

    return humanDateFormat;
  });

  console.log(START, END, 'startend')
  END = (END == undefined) || (END == START) ? '' : END;
  svg.append("text")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("text-decoration", "none") //underline  
    .text(site_name + " on " + START + ' ' + END);

  // text label for the y axis
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Speed (MPH)");

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
  let y_padding = 20;
  y_scale = d3.scaleLinear()
    .domain([0, min_max.max_y + y_padding]) //[min_max.min_y - y_padding, min_max.max_y + y_padding]
    .range([height, 0]);

  svg.append("g")
    .call(d3.axisLeft(y_scale));

  let legend_keys = []
  for (let u = 0; u < route_data.length; u++) {
    console.log('route_data', route_data[u])
    let route_acp_id = route_data[u][0].acp_id;

    // Add the line
    let path = create_path(svg, route_data[u], route_acp_id, LINE_GRAPH_COLORS[u]);


    d3.select('#META_' + route_acp_id).style('color', LINE_GRAPH_COLORS[u])

    //27 is th lenght of a rout id, whreas 12 martks the star of the unique string in "CAMBRIDGE_JTMS_9800Z0SUAHN1"

    legend_keys.push({
      'name': route_acp_id.substr(27 - 12, 27),
      'color': LINE_GRAPH_COLORS[u]
    });

  }

  legend_keys.push({
    'name': 'HISTORIC DATA',
    'color': 'LightGrey'
  });

  // Add one dot in the legend for each name.
  var size = 15
  let y_sizing = 0
  let x_sizing = 360

  let normal_speed_line;

  console.log('legend_keys', legend_keys)
  svg.selectAll("mydots")
    .data(legend_keys)
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
    .style("stroke-dasharray", function (d) {
      if (d.color == "LightGrey") return ("1,1") // make the stroke dashed

    })
    .style("stroke", function (d) {
      if (d.color == "LightGrey") return 'black' // make the stroke dashed

    })
    .attr("id", function (d, i) {
      return "LEGEND_CAMBRIDGE_JTMS_" + d.name
    }) //LG for line graph
    .attr("class", "legend")
    .on('mouseover', function (d, i) {
      let selected = 'CAMBRIDGE_JTMS_' + d.name
      console.log(d, i)

      // Use D3 to select element, change color and size
      d3.selectAll('.legend').transition().duration(250).style('opacity', 0.2)
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 0.2)
      d3.select('#LEGEND_' + selected).transition().duration(250).style('opacity', 1)
      d3.select('#LG_' + selected).transition().duration(250).style('opacity', 1).attr("stroke-width", 4);
      drawLink(selected, 350, LINE_GRAPH_COLORS[i]);
    })
    .on('mouseout', function (d) {
      let selected = 'CAMBRIDGE_JTMS_' + d.name
      // Use D3 to select element, change color and size
      d3.selectAll('.legend').transition().duration(250).style('opacity', 1)
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 1)
      d3.select('#LG_' + selected).attr("stroke-width", 2.5);
      link_group.remove();
      d3.selectAll('.arc_line').remove()
      d3.selectAll('.dashed_scatter_line').remove()
    })
    .on('click', function (d, i) {
      d3.select(this).transition()
        .duration(50)
        .style('fill', 'black')
        .on('end', function (d) {
          d3.select(this).transition()
            .duration(100)
            .style('fill', d.color)
        });


      let link_id = "CAMBRIDGE_JTMS%7C" + d.name

      //get a date that's a week ago
      let week_ago = (Date.parse(START) / 1000) - WEEK
      let new_ts = new Date(week_ago * 1000)
      let new_date = new_ts.getFullYear() + "-" + (new_ts.getMonth() + 1) + "-" + new_ts.getDate()

      historical_link(link_id, new_date).then((data) => {
        console.log('received', data)

        let hist_data = restructure_hist_data([data]); //  WHY DO I NEED TWO RESTRUCTURINGS
        console.log('HIST data', hist_data);

        let route_acp_id = 'DASH_' + hist_data[0].acp_id;

        // Add the line
        normal_speed_line = create_path(svg, hist_data, route_acp_id, 'black', 'historical')
        console.log(normal_speed_line)
      });

    });

  // Add one dot in the legend for each name.
  svg.selectAll("mylabels")
    .data(legend_keys)
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
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 0.2)
      d3.select(this).transition().duration(250).style('opacity', 1).attr("stroke-width", 4);
      drawLink(d[0].acp_id, 350, LINE_GRAPH_COLORS[i]);
    })
    .on('mouseout', function () {
      // Use D3 to select element, change color and size
      d3.selectAll('.connected_scatter_line').transition().duration(250).style('opacity', 1)
      d3.select(this).attr("stroke-width", 2.5);
      link_group.remove();
      d3.selectAll('.arc_line').remove()
    });



}

//turn it into create_speed_path and create_hist_path
function create_path(canvas, data, id, stroke, mode) {
  // Add the line
  let path = canvas.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("id", "LG_" + id) //LG for line graph
    .attr("stroke", stroke)
    .attr("stroke-width", 2.5)
    .attr("d", d3.line()
      .x(function (d) {
        let time_parameter = mode == 'historical' ? d.ts + WEEK : d.ts;
        return x_scale(time_parameter)
      })
      .y(function (d) {
        let speed_parameter = mode == 'historical' ? d.normal_speed : d.speed;
        return y_scale(speed_parameter)
      })
    );


  let totalLength = path.node().getTotalLength();
  if (mode) {
    let dash_step = 3;
    path
      .attr("class", "dashed_scatter_line")
      .attr("stroke-dasharray", dash_step + " " + dash_step)
      .attr("stroke-dashoffset", 0)
      .style('opacity', 0)
      .transition()
      .duration(350)
      .ease(d3.easeLinear)
      .style('opacity', 1)
  } else {
    path
      .attr("class", "connected_scatter_line")
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(700)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);
  }
  return path

}

//The fetched data has a problem that it does not differentiate different
//links into different sublists, instead, we recieve all date in a single
//list that makes creating separate line graphs difficult.
//Therefore, we parse the fetched data and create unique sublists with 
//each acp_id having its own list.
function restructure_to_sublists(old_list) {
  let new_list = []
  let new_sublist = [];

  //create a separate array for used acp_ids as 
  //sometimes there are doubles that will create
  //problems for the scatter plot.
  //Doubles appear beacause some links have "-fixed"
  //clones in the API, so we just avoid them.
  let past_ids = [];

  let temp_id = old_list[0].acp_id;

  //iterate over a list of fetched readings that have 
  //all acp_id's in a single list
  for (let i = 0; i < old_list.length; i++) {
    let current_id = old_list[i].acp_id;
  
    //ignore the doubled link readings
    if (past_ids.includes(current_id)) {
      continue;
    }

    //new acp_id incoming, start a new list
    if (current_id != temp_id) {
      //put the last value to past ids to ensure
      //we don't have duplicates
      past_ids.push(temp_id)

      temp_id = current_id;

      //sort the new sublist by ts
      new_list.push(new_sublist.sort((a, b) => a.ts - b.ts))

      new_sublist = [];
    }

    //push items with the same acp_id to a single list
    new_sublist.push(old_list[i]);
    console.log(new_sublist.length)
  }

  //the last unique acp_id does not get pushed by itself
  //since no new entry follows, so we do it here instead.
  new_list.push(new_sublist.sort((a, b) => a.ts - b.ts))

  //returns a list of lists containing unique acp_ids in each
  return new_list;
}



//unused to function to calculate travelTime (tt) for
//a given site from the SITE_DB
function show_node_metadata(site_id) {
  console.log('showing', site_id)
  //find the requested site_id in the SITE_DB
  let SITE = SITE_DB.find(x => x.id == site_id);

  get_site_metadata(SITE)
}

function get_site_metadata(SITE) {
  let neighbour_info = "<b>Surrounding nodes:</b> " + "<br>";
  for (let u = 0; u < SITE.neighbors.length; u++) {
    let neighbour = SITE.neighbors[u];
    console.log('SITE', neighbour.site)

    let link_in = all_journeys.find(journey => journey.id === neighbour.links.in.id)
    let link_out = all_journeys.find(journey => journey.id === neighbour.links.out.id)
    let tt_in, tt_out;


    try {
      if (link_in.travelTime == undefined || link_in.travelTime == null) {
        tt_in = link_in.normalTravelTime;
        console.log('tt in failed', link_in)
      } else {
        tt_in = link_in.travelTime;
      }

      let speed_in = parseInt((neighbour.links.in.length / tt_in) * TO_MPH);
      console.log('journey iD:', neighbour.links.in, tt_in, speed_in)


      if (link_out.travelTime == undefined || link_out.travelTime == null) {
        tt_out = link_out.normalTravelTime;
        console.log('tt our failed', link_out)
      } else {
        tt_out = link_out.travelTime;

      }

      let speed_out = parseInt((neighbour.links.out.length / tt_out) * TO_MPH);

      console.log('journey iD:', neighbour.links.out, tt_out, speed_out)

      const HALF_TAB = '&emsp;&emsp;'
      const TAB = '&emsp;&emsp;&emsp;&emsp;'


      let to = HALF_TAB + "<div class='metadata' id='META_" + neighbour.links.in.id + "'>" + TAB + "<b>To:</b> " + "Current Speed: " + speed_in + "MPH" + "</div>";
      let from = HALF_TAB + "<div class='metadata' id='META_" + neighbour.links.out.id + "'>" + TAB + "<b>From:</b> " + "Current Speed: " + speed_out + "MPH" + "</div>";

      neighbour_info += "<br>" + "<i>" + neighbour.site + "</i>" + to + from;
    } catch {}
  }

  let full_metadata = "<b>" + SITE.name + "</b>" + '<br>' +
    "Average Travel Speed: " + parseInt(SITE.travelSpeed) + "MPH" + '<br>' +
    "Speed Deviation from Regular: " + parseInt(SITE.speedDeviation) + "MPH" + '<br><br>' + neighbour_info;
  document.getElementById('metadata_table').innerHTML = ICON_CLOSE_DIV + full_metadata;
  document.getElementById('metadata_table').style.opacity = 1;
}