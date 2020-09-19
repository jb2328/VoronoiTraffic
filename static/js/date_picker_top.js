"use strict";

// Called on page load
function init() {

    // Set plot_date to today, or date given in URL (& parsed into template)
    if (YYYY=='') {
        plot_date = new Date().toISOString().split('T')[0];
    }
    else {
        plot_date = YYYY+'-'+MM+'-'+DD;
    }

    // Animated "loading" gif, shows until readings are loaded from api
    //loading_el = document.getElementById('loading');
    //feature_select_el = document.getElementById("form_feature");

    // The cool date picker
    var form_date = document.getElementById("form_date");

    form_date.setAttribute('value', plot_date);


}



// ************************************************************************************
// ************** Date forwards / backwards function             *********************
// ************************************************************************************

// move page to new date +n days from current date
function date_shift(n, feature_id)
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
    let new_day = ("0" + new_date.getDate()).slice(-2);

    console.log(new_year+'-'+new_month+'-'+new_day);
    window.location.href = '?date='+new_year+'-'+new_month+'-'+new_day+'&feature='+feature_id;
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


function onchange_feature_select(e, readings, features) {
    console.log("onchange_feature_select",window.location.href);
    //let features = sensor_metadata["acp_type_info"]["features"];
    let feature_id = feature_select_el.value;

    set_date_onclicks(feature_id);
    // Change the URL in the address bar
    update_url(feature_id,plot_date);
 //   draw_chart(readings, features[feature_id]);
}

function set_date_onclicks(node_id) {
        // set up onclick calls for day/week forwards/back buttons
        document.getElementById("back_1_week").onclick = function () { date_shift(-7, node_id) };
        document.getElementById("back_1_day").onclick = function () { date_shift(-1, node_id) };
        document.getElementById("forward_1_week").onclick = function () { date_shift(7, node_id) };
        document.getElementById("forward_1_day").onclick = function () { date_shift(1, node_id) };
}