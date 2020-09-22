"use strict";

const SITE_PREFIX = 'SITE_';

class Node {
    constructor(node_id) {

        this.node_id = node_id;//node_id
        this.node_acp_id = SITE_PREFIX + this.node_id.replace('{', '').replace('}', '');

        this.name = null;

        this.lat = null;
        this.lng = null;
        this.x = null;
        this.y = null;

        this.neighbors = [];

        this.travelTime = null;
        this.travelSpeed = null;
        this.historicalSpeed = null;
        this.speedDeviation = null;

        //selected variable output - tt,ts,hs or sd
        //to be changed since this is silly
        this.selected = null;
        this.selectedName = null;

        this.parent = this.getParent();
        this.name = this.getName();
    }

    getParent() {

        let groups = Object.keys(CELL_GROUPS);
        for (let i = 0; i < groups.length; i++) {
            let group_id = groups[i];
            if (CELL_GROUPS[group_id]['acp_ids'].includes(this.node_acp_id)) {
                return group_id;
            }
        }
    }

    getName() {
        return all_sites.find(x => x.id === this.node_id).name;


    }
    fetchName(id) {
        return all_sites.find(x => x.id === id).name;

    }
    setVisualisation(vis) {
        this.selectedName = vis;
        switch (vis) {
            case "historical speed":
                this.selected = this.historicalSpeed;
                break;
            case "travel speed":
                this.selected = this.travelSpeed;
                break;
            case "speed deviation":
                this.selected = this.speedDeviation;
                break;
            default:
                this.selected = this.speedDeviation; //this.travelSpeed;
                break;

        }
        //this.visualise=vis;
    }
    getLocation() {
        let data = all_sites; //"this.sites;
        for (let i = 0; i < data.length; i++) {
            if (this.node_id == data[i].id) {
                return {
                    "x": data[i].x,
                    "y": data[i].y
                }
            }
        }
    }
    findNeighbors() //data is all_links
    {
        this.neighbors = [];
        let tt, ntt, travelTime;
        for (let i = 0; i < all_links.length; i++) {
            if (this.node_id == all_links[i].sites[0]) { //from this id
                //console.log('journeysB',journeys[i].id, this.node_id,data[i])
                //console.log(data.length, journeys.length,i);
                try {
                    tt = all_journeys.find(x => x.id === all_links[i].id).travelTime;
                    ntt = all_journeys.find(x => x.id === all_links[i].id).normalTravelTime;
                    travelTime = tt == undefined || null ? ntt : tt;
                } catch (err) {
                    travelTime = undefined;
                    ntt = undefined;
                }

                //console.log(tt, travelTime);
                let link = findLinks(this.node_id, all_links[i].sites[1]);
                this.neighbors.push({
                    "links": {
                        "out": link.out,
                        "in": link.in
                    },
                    "name": all_links[i].name,
                    "id": all_links[i].sites[1], //to this id
                    "site": this.fetchName(all_links[i].sites[1]),
                    "travelTime": travelTime,
                    "normalTravelTime": ntt,
                    "dist": all_links[i].length
                });
            }
        }
    }

    computeTravelTime() {
        let avg = [];
        let sum = 0;
        for (let i = 0; i < this.neighbors.length; i++) {
            let link = this.neighbors[i].links.out.id;

            for (let u = 0; u < all_journeys.length; u++) {
                if (link == all_journeys[u].id) {
                    avg.push(all_journeys[u].travelTime);
                }
            }
        }

        for (let i = 0; i < avg.length; i++) {
            sum += avg[i];
        }
        this.travelTime = sum / avg.length;
    }

    computeTravelSpeed() {
        let currentAverage = [];
        let historicalAverage = [];

        for (let i = 0; i < this.neighbors.length; i++) {
            let link = this.neighbors[i].links.out.id;
            let dist = this.neighbors[i].dist;

            for (let u = 0; u < all_journeys.length; u++) {
                if (link == all_journeys[u].id) {
                    let travelTime = all_journeys[u].travelTime;
                    let historicalTime = all_journeys[u].normalTravelTime;
                    // console.log(historicalTime);

                    let currentSpeed = (dist / travelTime) * TO_MPH;
                    let historicalSpeed = (dist / historicalTime) * TO_MPH;

                    if (currentSpeed == Infinity || historicalSpeed == Infinity) {
                        break;
                    }

                    historicalAverage.push(historicalSpeed);
                    currentAverage.push(currentSpeed);
                }
            }
            //console.log(historicalAverage);

        }
        if (historicalAverage.length > 0) {
            let historicalSum = historicalAverage.reduce((previous, current) => current += previous);
            this.historicalSpeed = historicalSum / historicalAverage.length;
        }

        if (currentAverage.length > 0) {
            let currentSum = currentAverage.reduce((previous, current) => current += previous);
            this.travelSpeed = currentSum / currentAverage.length;
        }

        //double check
        this.speedDeviation = this.travelSpeed - this.historicalSpeed;

    }
}