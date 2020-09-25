"use strict";

class SiteDB {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        this.all = [];

        this.selected_site = null;

        //I think it would make most sense to move data_building.js functions to the site_db class where in the constructor(?) or elsewhere
        //would fetch initial data etc. Having those types of global functions perhaps isn't the best way to approach this.
        // var all_sites, all_links, all_journeys, all_routes = [];

    }

    /*------------------------------------------------------*/

    async load_api_data() {

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


    initialise_nodes() {

        console.log('all_sites', all_sites)
        for (let i = 0; i < all_sites.length; i++) {

            let node = new Node(all_sites[i].id)

            node.lat = all_sites[i].acp_lat;
            node.lng = all_sites[i].acp_lng;

            node.findNeighbors();
            node.computeTravelTime();
            node.computeTravelSpeed();
            node.setVisualisation(null); //speed deviation//travel speed

            this.all.push(node);


        }

    }

    update_nodes() {
        console.log('updating nodes')
        for (let i = 0; i < this.all.length; i++) {
            this.all[i].computeTravelTime();
            this.all[i].computeTravelSpeed();
        }
    }

    get_zone_averages() {
        let zones = Object.keys(CELL_GROUPS);
        let zone_readings = [];
        for (let i = 0; i < zones.length; i++) {
            let zone_temp = []
            this.all.filter(node => node.parent == zones[i]).forEach(zone_node => zone_temp.push(zone_node.travelSpeed))
            zone_readings.push({
                'zone': zones[i],
                'value': arrAvg(zone_temp)
            })

        }
        return zone_readings
    }

    set_selected_node(new_selection) {
        this.selected_site = new_selection;
    }
    get_selected_node() {
        return this.selected_site;
    }

    //computs min and max values from the data
    //this lets us create appropriate color ranges
    get_min_max() {
        //finds min/max from the *selected* setting 
        //(can be speed deviation, current speed, normal speed)
        let findMax = (ma, v) => Math.max(ma, v.selected)
        let findMin = (mi, v) => Math.min(mi, v.selected)

        let max = this.all.reduce(findMax, -Infinity)
        let min = this.all.reduce(findMin, Infinity)

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
    get_acp_id(node_acp_id) {
        return this.all.find(x => x.node_acp_id === node_acp_id);

    }

    //returns a node based on its node id property
    get_id(node_id) {
        return this.all.find(x => x.node_id === node_id);
    }

    //returns a node based on its node name property
    get_name(node_name) {
        return this.all.find(x => x.name === node_name);
    }

    //returns a node based on its node name property
    get_length() {
        return this.all.length;
    }
    set_visualisations(viz_type) {
        this.all.forEach((element) => {
            element.setVisualisation(viz_type);
        });
    }


}