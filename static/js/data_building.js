"use strict";

const TO_MPH = 2.23694;
const SITE_PREFIX = 'SITE_';

// var travelTimes;
// var travelSpeed;
// var historicalSpeed;
// var speedDeviation;


var all_sites, all_links, all_journeys, all_routes = [];

const arrAvg = arr => arr.reduce((a, b) => a + b, 0) / arr.length

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