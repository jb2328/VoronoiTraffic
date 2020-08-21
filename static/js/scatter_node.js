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


function show_node_tt_past(site_id, date_start, date_end) {
  //console.log('showing', site_id)
  //find the requested site_id in the SITE_DB
  let site = SITE_DB.find(x => x.id == site_id);
  //console.log('site', site)

  //lookup neighbours
  let promise_list = []
  let all_lists = []
  for (let i = 0; i < site.neighbors.length; i++) {

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
    let x_vals = []
    let y_vals = []
    // console.log('lists', all_lists[0].request_data)
    //console.log('all_lists', all_lists[0].request_data)

    all_lists.forEach(item => {

      console.log('item', item)
      let elements = item.request_data;

      elements.forEach(element => {

       // console.log('element', element, "time", element.time.slice(11, 20), "date", element.time.slice(0, 10));

        if (element.travelTime < 500) {

          all_data.push({
            "x": element.acp_ts,
            "y": element.travelTime, //normalTravelTime
            "y_2": element.normalTravelTime, //
            "time": element.time.slice(11, 20),
            "date": element.time.slice(0, 10)
          })

          x_vals.push(element.acp_ts);
          y_vals.push(element.travelTime);

        }
        // console.log();
      })

    })
    //console.log(all_data.length);
    // Add X axis

    let min_max = {
      'min_x':Math.min(...all_data.map(a => a.x)) ,
      'min_y':Math.min(...all_data.map(a => a.y)) ,
      'max_x': Math.max(...all_data.map(a => a.x)),
      'max_y':Math.max(...all_data.map(a => a.y))
    }
   
    //if queried data is for today, our x axis should still show 24hours
    if (min_max.max_x - min_max.min_x < 86400) { //86400
      min_max.max_x = min_max.min_x + 86400;
    }
    let queried_date = new Date(min_max.min_x * 1000)

    let title_date = queried_date.toLocaleString()
    show_plot(all_data, min_max, site_id, date_start, date_end)

  })


}
async function compile_data(cond1, cond2) {
  console.log('before');
  await waitForCondition({
    arg: cond1,
    test: cond2
  })
  console.log('after');
}
async function waitForCondition(conditionObj) {
  let start_time = new Date().getTime()

  while (true) {
    if (conditionObj.arg == conditionObj.test) {
      console.log('met');
      break; // or return
    }
    if (new Date() > start_time + 3000) {
      console.log('not met, time out');
      break; // or throw
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

function show_node_tt_now(site_id) {
  console.log('showing', site_id)
  //find the requested site_id in the SITE_DB
  let site = SITE_DB.find(x => x.id == site_id);
  console.log('site', site)

  //compute average in+out travel time from all neighbors
  let combined_tt = 0;
  for (let i = 0; i < site.neighbors.length; i++) {
    combined_tt += site.neighbors[i]
      .travelTime; //this will change when Node class get restructured to differentiate between in and out travel time
  }
  //compute average
  let avg_tt = combined_tt / site.neighbors.length;
  //the answer doesnt match with site.travelTime for some reason
  console.log('avg speed now', avg_tt)

}


function acquire_hist_data(data) {
  let total_list = [];
 
 /* do something */
 data.request_data.forEach((element) => {
   total_list.push({
     "x": element.acp_ts,
     "y": element.travelTime, //normalTravelTime
     "y_2": element.normalTravelTime, //
     "time": element.time.slice(11, 20),
     "date": element.time.slice(0, 10)
   })
 
 })
 console.log(total_list.length);
 // Add X axis

 let min_x = Math.min(...x_vals);
 let min_y = Math.min(...y_vals);

 let max_x = Math.max(...x_vals);
 let max_y = Math.max(...y_vals);

 //if queried data is for today, our x axis should still show 24hours
 if (max_x - min_x < 86400) { //86400
   max_x = min_x + 86400;
 }
 let queried_date = new Date(min_x * 1000)

 let title_date = queried_date.toLocaleString()

}

function acquire_data(data) {
  let total_list = [];
 
 /* do something */
 data.request_data.forEach((element) => {
   total_list.push({
     "x": element.acp_ts,
     "y": element.travelTime, //normalTravelTime
     "y_2": element.normalTravelTime, //
     "time": element.time.slice(11, 20),
     "date": element.time.slice(0, 10)
   })
 
 })
 console.log(total_list.length);
 // Add X axis

 let min_x = Math.min(...x_vals);
 let min_y = Math.min(...y_vals);

 let max_x = Math.max(...x_vals);
 let max_y = Math.max(...y_vals);

 //if queried data is for today, our x axis should still show 24hours
 if (max_x - min_x < 86400) { //86400
   max_x = min_x + 86400;
 }
 let queried_date = new Date(min_x * 1000)

 let title_date = queried_date.toLocaleString()

  show_plot(total_list, min_max, NODE, START, END)
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
d3.select('#test_graph')._groups[0][0].innerHTML='';
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
  END=END=='undefined'?'':END;
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