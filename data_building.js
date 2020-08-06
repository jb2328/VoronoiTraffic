var SITE_DB;

var travelTimes;
var travelSpeed;
var historicSpeed;
var speedDeviation;

var all_sites, all_links, all_journeys = [];

const TO_MPH = 2.23694;


async function load_api_data() {

    await Promise.all([load_sites(), load_routes(), load_links(), load_journeys()]).then((combined_api_reponse) => {


        let site_response = combined_api_reponse[0]
        let route_response = combined_api_reponse[1]
        let journey_response = combined_api_reponse[3]
        let link_response = combined_api_reponse[2]

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

    })


}

function initialise_nodes() {
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