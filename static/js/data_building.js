"use strict";

const TO_MPH = 2.23694;

var SITE_DB;

var travelTimes;
var travelSpeed;
var historicSpeed;
var speedDeviation;

var all_sites, all_links, all_journeys, all_routes = [];

/*------------------------------------------------------*/

async function load_api_data() {

    await Promise.all([load_sites(), load_routes(), load_links(), load_journeys()]).then((combined_api_reponse) => {


        let site_response = combined_api_reponse[0]
        let route_response = combined_api_reponse[1]
        let link_response = combined_api_reponse[2]
        let journey_response = combined_api_reponse[3]


        all_sites = site_response.site_list;
        all_routes = route_response.route_list
        all_links = link_response.link_list;
        all_journeys = journey_response.request_data;


        /*--------------------------DATA CLEANUP-----------------------------*/

        //Some genious assumed that it was OK to use | vertical bars for link ids 
        //(e.g CAMBRIDGE_JTMS|9800WLZSM8UU), thus not only messing up the ability 
        //to access such links with D3.js or regex but also not being able to 
        //reference it in XML for SVG paths.
        //So here I delete the vertical bars and replace it with '_' so
        // the actual unique link value becomes CAMBRIDGE_JTMS_9800WLZSM8UU

        all_links.forEach((element) => {
            element.id = element.id.replace('|', '_');
        });;

        all_journeys.forEach((element) => {
            element.id = element.id.replace('|', '_');
        });
        //For site, we have to add a prefix SITE_ in front of site ids,
        //'{1F867FB8-83E6-4E63-A265-51CD2E71E053}' =>'SITE_{1F867FB8-83E6-4E63-A265-51CD2E71E053}', 
        //otherwise we will not be able to select site id from html id tag
        //because it will start with an invalid character '{'
        all_sites.forEach((element) => {
            element.acp_id = SITE_PREFIX + element.id.replace('{', '').replace('}', '');
        });

       
    })

    //DO SOMETHING WHEN FAILED, LIKE HERE
    // .fail(function () {
    //     console.log('API call failed - default reschedule');
    //     setTimeout(load_data, 60000);
    // });
}

const arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length

function get_zone_averages() {
    let zones = Object.keys(CELL_GROUPS);
    let zone_readings = [];
    for (let i = 0; i < zones.length; i++) {
        let zone_temp = []
        SITE_DB.filter(node => node.parent == zones[i]).forEach(zone_node => zone_temp.push(zone_node.travelSpeed))
        zone_readings.push({
            'zone': zones[i],
            'value': arrAvg(zone_temp)
        })

    }
    return zone_readings
}

function findLinks(id1, id2) {
    //id1 from (outbound)
    //id2 to (inbound)

    let obj = {
        "out": null,
        "in": null
    }

    for (let i = 0; i < all_links.length; i++) {
        if (id1 == all_links[i].sites[0] && id2 == all_links[i].sites[1]) {
            obj["out"] = all_links[i];
        }
        if (id1 == all_links[i].sites[1] && id2 == all_links[i].sites[0]) {
            obj["in"] = all_links[i];
        }
    }
    return obj;
}