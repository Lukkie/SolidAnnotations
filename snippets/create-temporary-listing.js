const solid = require('solid-client');
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');
vocab.example = ns.base('http://www.example.com/ns#');

var listing_location = 'https://lukasvanhoucke.databox.me/Public/Listings'; // Temporary -- Location where annotation URLs are stored
var slug = 'test';

var annotations = [
  'https://lukasvanhoucke.databox.me/Public/Annotations/b79007b0-e702-11e7-9e23-196ff7ed8e65',
  'https://lukasvanhoucke.databox.me/Public/Annotations/ec4a4290-e702-11e7-9e23-196ff7ed8e65',
  'https://lukasvanhoucke.databox.me/Public/Annotations/ff227a90-e702-11e7-9e23-196ff7ed8e65'
];

function store(graph) {
  var data = new rdf.Serializer(graph).toN3(graph);
  solid.web.get(listing_location + '/' + slug).then(function(response) {
    // put
    solid.web.put(listing_location + '/' + slug, data).then(function(meta) {
        var url = meta.url;
        console.log("Annotations were saved at " + url);
    }).catch(function(err) {
        console.log(err);
    });
  }).catch(function(err) {
    // post
    solid.web.post(listing_location, data, slug).then(function(meta) {
        var url = meta.url;
        console.log("Annotations were saved at " + url);
    }).catch(function(err) {
        console.log(err);
    });
  });
}

var thisResource = rdf.sym(listing_location + '/' + slug); // saves url as NamedNod
var graph = rdf.graph(); // create an empty graph
var count = 0; // TODO: Replace by async.map()? (Requires async module)
for (var i = 0; i < annotations.length; i++) {
  let annotation = annotations[i];
  // GET TARGET URL
  solid.web.get(annotation).then(function(response) {
      let annotation_graph = response.parsedGraph();  // graph is part of rdflib, see link at top of page.
      let target_url = annotation_graph.any(rdf.sym(annotation), vocab.oa('hasTarget'), undefined); // hasTarget
      let source_url = annotation_graph.any(rdf.sym(target_url.value), vocab.oa('hasSource'), undefined); // hasSource
      if (source_url) {
        // ADD TO GRAPH
        console.log(source_url.value);
        graph.add(rdf.sym(source_url.value), vocab.example('hasAnnotation'), rdf.sym(annotation)); // TODO: find correct predicate
        // Wait until all are added to graph, and then store graph
        count++;
        if (count >= annotations.length) {
            // Store graph
            store(graph);
        }
      } else {
        console.log("No source URL was found for annotation with URL " + annotation);
      }
  }).catch(function(err) {
      // do something with the error
      console.log("Received error: " + err);
  });
}
