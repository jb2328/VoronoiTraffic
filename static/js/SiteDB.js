"use strict";

class SiteDB {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor() {

        this.site_db = [];

        this.selected_site = null;

    }

    init(node_id) {
        //load all node objects
    }


    set_selected_node(new_selection) {
        this.selected_site = new_selection;
    }
    get_selected_node() {
        return this.selected_site;
    }

    calculate() {}
    update() {}

}