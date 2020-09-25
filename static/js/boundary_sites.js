"use strict";

/*The following list has ghost coordinates for voronoi cells that surround
the real BlueTruth sensors. We create ghost voronoi cells so that the real 
cells would not divide the entire map.*/
var boundary_sites = [{
    "lat": 52.24861,
    "lng": 0.11536,
    "x": null,
    "y": null
}, 
{
    "lat": 52.2503,
    "lng": 0.14763,
    "x": null,
    "y": null
},
{
    "lat": 52.24735,
    "lng": 0.17681,
    "x": null,
    "y": null
}, 
{
    "lat": 52.2339,
    "lng": 0.20153,
    "x": null,
    "y": null
},

{
    "lat": 52.21139,
    "lng": 0.21286,
    "x": null,
    "y": null
}, 
{
    "lat": 52.18993,
    "lng": 0.2029,
    "x": null,
    "y": null
},

{
    "lat": 52.16425,
    "lng": 0.1902,
    "x": null,
    "y": null
}, 
{
    "lat": 52.15034,
    "lng": 0.16342,
    "x": null,
    "y": null
},

{
    "lat": 52.1398,
    "lng": 0.12051,
    "x": null,
    "y": null
}, 
{
    "lat": 52.15456,
    "lng": 0.08205,
    "x": null,
    "y": null
},

{
    "lat": 52.16572,
    "lng": 0.06111,
    "x": null,
    "y": null
}, 
{
    "lat": 52.1813,
    "lng": 0.03571,
    "x": null,
    "y": null
},

{
    "lat": 52.20634,
    "lng": 0.01648,
    "x": null,
    "y": null
}, 
{
    "lat": 52.22464,
    "lng": 0.02884,
    "x": null,
    "y": null
},

{
    "lat": 52.23726,
    "lng": 0.05527,
    "x": null,
    "y": null
},
{
    "lat": 52.24441,
    "lng": 0.08446,
    "x": null,
    "y": null
}
];

//boundary_sites=getCircle();
//transforms arbitrary circle coordinates to lat lng.
//That is how the original locations were obtained.
function getCircle() {
    let a = 0;
    let r = 700;
    let arr = [];
    let newPts=[];
    for (let t = 0; t < 6.28; t += 0.05) {
        let x = a + r * Math.cos(t);
        let y = a + r * Math.sin(t);

        let lng = voronoi_viz.map_values(x, -500, 500, 0.03, 0.2);
        let lat = voronoi_viz.map_values(y, -500, 500, 52.15, 52.246)

        newPts.push({
            "x": x,
            "y": y,
            "lng": lng,
            "lat": lat
        });
    }
    // console.log(newPts);
    return newPts;
}