# VoronoiTraffic
### Cambridge traffic visualisation
 
![alt text](imgs/main.png "Main")


### Data
The data is collected in real-time from 38 Bluetruth sensors deployed all around the city.
#### Types of data
* Route information
* Site metadata
* Link information
* Journey information
#### Data retrieval
* Most Recent
```
const JOURNEY_URL = 'https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/latest/';

async function load_journeys() {
    return await d3.json(JOURNEY_URL, {
        headers: new Headers({
            "Authorization": `Token ` + API_TOKEN
        }),
    })
}
```

* Historical
```
const JOURNEY_URL_HIST="https://tfc-app1.cl.cam.ac.uk/api/v1/traffic/btjourney/history/"

async function historical_link(link_id, date1, date2) {
    return await d3.json(

      JOURNEY_URL_HIST + link_id +
      "/?start_date=" + date1 + "&end_date" + date2, {
        headers: new Headers({
          "Authorization": `Token` + API_TOKEN
        }),
      })
  
```
#### Nodes and SITE_DB
![alt text](imgs/nodes.png "Nodes")

### Run

```
cd VoronoiTraffic
python3 -m http.server
```


