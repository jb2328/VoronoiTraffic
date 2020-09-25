"use strict";

class SiteDB {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        this.all = [];

        this.selected_site = null;
        this.all_sites, this.all_routes, this.all_journeys, this.all_links = [];

        //I think it would make most sense to move data_building.js functions to the site_db class where in the constructor(?) or elsewhere
        //would fetch initial data etc. Having those types of global functions perhaps isn't the best way to approach this.
        // var all_sites, all_links, all_journeys, all_routes = [];

    }

    /*------------------------------------------------------*/

    async load_api_data(parent) {

        await Promise.all([load_sites(), load_routes(), load_links(), load_journeys()]).then((combined_api_reponse) => {


            let site_response = combined_api_reponse[0]
            let route_response = combined_api_reponse[1]
            let link_response = combined_api_reponse[2]
            let journey_response = combined_api_reponse[3]


            parent.site_db.all_sites = site_response.site_list;
            parent.site_db.all_routes = route_response.route_list
            parent.site_db.all_links = link_response.link_list;
            parent.site_db.all_journeys = journey_response.request_data;


            /*--------------------------DATA CLEANUP-----------------------------*/

            //Some genious assumed that it was OK to use | vertical bars for link ids 
            //(e.g CAMBRIDGE_JTMS|9800WLZSM8UU), thus not only messing up the ability 
            //to access such links with D3.js or regex but also not being able to 
            //reference it in XML for SVG paths.
            //So here I delete the vertical bars and replace it with '_' so
            // the actual unique link value becomes CAMBRIDGE_JTMS_9800WLZSM8UU

            parent.site_db.all_links.forEach((element) => {
                element.id = element.id.replace('|', '_');
            });;

            parent.site_db.all_journeys.forEach((element) => {
                element.id = element.id.replace('|', '_');
            });
            //For site, we have to add a prefix SITE_ in front of site ids,
            //'{1F867FB8-83E6-4E63-A265-51CD2E71E053}' =>'SITE_{1F867FB8-83E6-4E63-A265-51CD2E71E053}', 
            //otherwise we will not be able to select site id from html id tag
            //because it will start with an invalid character '{'
            parent.site_db.all_sites.forEach((element) => {
                element.acp_id = parent.tools.SITE_PREFIX + element.id.replace('{', '').replace('}', '');
            });


        })

        //DO SOMETHING WHEN FAILED, LIKE HERE
        // .fail(function () {
        //     console.log('API call failed - default reschedule');
        //     setTimeout(load_data, 60000);
        // });
    }
    find_links(parent,id1, id2) {
        //id1 from (outbound)
        //id2 to (inbound)

        let obj = {
            "out": null,
            "in": null
        }

        for (let i = 0; i < parent.site_db.all_links.length; i++) {
            if (id1 == parent.site_db.all_links[i].sites[0] && id2 == parent.site_db.all_links[i].sites[1]) {
                obj["out"] = parent.site_db.all_links[i];
            }
            if (id1 == parent.site_db.all_links[i].sites[1] && id2 == parent.site_db.all_links[i].sites[0]) {
                obj["in"] = parent.site_db.all_links[i];
            }
        }
        return obj;
    }

    initialise_nodes(parent) {

        for (let i = 0; i < parent.site_db.all_sites.length; i++) {

            let node = new Node(parent,parent.site_db.all_sites[i].id)

            node.lat = parent.site_db.all_sites[i].acp_lat;
            node.lng = parent.site_db.all_sites[i].acp_lng;

            node.findNeighbors(parent);
            node.computeTravelTime(parent);
            node.computeTravelSpeed(parent);
            node.setVisualisation(null); //speed deviation//travel speed

            parent.site_db.all.push(node);


        }

    }

    update_nodes(parent) {
        console.log('updating nodes')
        for (let i = 0; i < parent.site_db.all.length; i++) {
            parent.site_db.all[i].computeTravelTime(parent);
            parent.site_db.all[i].computeTravelSpeed(parent);
        }
    }

    get_zone_averages(parent) {
        let zones = Object.keys(CELL_GROUPS);
        let zone_readings = [];
        for (let i = 0; i < zones.length; i++) {
            let zone_temp = []
            parent.site_db.all.filter(node => node.parent == zones[i]).forEach(zone_node => zone_temp.push(zone_node.travelSpeed))
            zone_readings.push({
                'zone': zones[i],
                'value': parent.tools.array_avg(zone_temp)
            })

        }
        return zone_readings
    }

    set_selected_node(parent,new_selection) {
        parent.site_db.selected_site = new_selection;
    }
    get_selected_node(parent) {
        return parent.site_db.selected_site;
    }

    //computs min and max values from the data
    //this lets us create appropriate color ranges
    get_min_max(parent) {
        //finds min/max from the *selected* setting 
        //(can be speed deviation, current speed, normal speed)
        let findMax = (ma, v) => Math.max(ma, v.selected)
        let findMin = (mi, v) => Math.min(mi, v.selected)

        let max = parent.site_db.all.reduce(findMax, -Infinity)
        let min = parent.site_db.all.reduce(findMin, Infinity)

        //we used placeholder value during development
        //to privide higher color differences

        return {
            "min": min, //-5
            "max": max //10
        };
    }

    //OK I KNOW THAT THE GETTERS BELOW WILL BE RENAMES, IDK 
    //WHAT I WAS THINKING

    //returns a node based on its node acp_id property
    get_acp_id(parent,node_acp_id) {
        return parent.site_db.all.find(x => x.node_acp_id === node_acp_id);

    }

    //returns a node based on its node id property
    get_id(parent,node_id) {
        return parent.site_db.all.find(x => x.node_id === node_id);
    }

    //returns a node based on its node name property
    get_name(parent,node_name) {
        return parent.site_db.all.find(x => x.name === node_name);
    }

    //returns a node based on its node name property
    get_length(parent) {
        return parent.site_db.all.length;
    }
    set_visualisations(parent,viz_type) {
        parent.site_db.all.forEach((element) => {
            element.setVisualisation(viz_type);
        });
    }


}