"use strict";
const API_TOKEN = 'a62fb5390f070c129591b6ff19c0a8cf06440efc'; //'6909103b0bfbc5e949a31a840f31e17efd58754f';
const LINK_URL = 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/link/';
const SITE_URL = 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/site/';
const JOURNEY_URL = 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/latest/';
const ROUTE_URL = 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/route/';


async function load_road_svg() {
    return await d3.svg('./static/roads_test.svg');
}

async function load_journeys() {
    return await d3.json(JOURNEY_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_links() {
    return await d3.json(LINK_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_routes() {
    return await d3.json(ROUTE_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
async function load_sites() {
    return await d3.json(SITE_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}

