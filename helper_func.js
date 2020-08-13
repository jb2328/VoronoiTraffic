
function path_to_poly(path_id){
var  numPoints = 8;

var  mypath = document.getElementById(path_id);
var  pathLength = mypath.getTotalLength();
var  polygonPoints= [];

for (var i=0; i<numPoints; i++) {
  var p = mypath.getPointAtLength(i * pathLength / numPoints);
  polygonPoints.push(p.x);
  polygonPoints.push(p.y);
}

//modify to create a new element
var  mypolygon = document.getElementById(path_id);
mypolygon.setAttribute("points", polygonPoints.join(","));
}


function showPointsAndHull() {
	
	var hull = convexhull.makeHull(points);
	var s = hull.map(function(point, i) {
		return (i == 0 ? "M" : "L") + point.x + "," + point.y;
	}).join("") + "Z";
	pathElem.setAttribute("d", s);
	
	var hullSet = new Set(hull);
	points.forEach(function(point) {
		var circElem = document.createElementNS(svgElem.namespaceURI, "circle");
		circElem.setAttribute("cx", point.x);
		circElem.setAttribute("cy", point.y);
		circElem.setAttribute("r", POINT_RADIUS);
		if (hullSet.has(point))
			onHullGroupElem.appendChild(circElem);
		else
			offHullGroupElem.appendChild(circElem);
	});
}