var solid = require('solid-client');
var rdf = require('rdflib');
var ns = require('rdf-ns')(rdf)

var vocab = solid.vocab;
vocab.example = ns.base('http://www.example.com/ns#');
vocab.oa = ns.base('http://www.w3.org/ns/oa#');

var listing_location = 'https://lukasvanhoucke.databox.me/Public/Listings/test'; // This should be announced by the webpage!

var graph;
solid.web.get(listing_location).then(function(response) {
    graph = response.parsedGraph();  // graph is part of rdflib, see link at top of page.

    current_url = 'https://openwebslides.github.io/cocos_kickoff/';  // In browser code: window.location.href.split('#')[0]
    graph.each(rdf.sym(current_url), vocab.example('hasAnnotation'), undefined).forEach(function(annotation_url) { // TODO: Change predicate
        console.log("Found matching annotation: " + annotation_url.value);
        // Do something with annotation
        // e.g. collect prefix, exact and suffix
        solid.web.get(annotation_url.value).then(function(response) {
            let annotation_graph = response.parsedGraph();
            let motivation = annotation_graph.any(annotation_url, vocab.oa('hasTarget'), undefined);
            let selector = annotation_graph.any(motivation, vocab.oa('hasSelector'), undefined);
            let text_quote = annotation_graph.any(selector, vocab.oa('refinedBy'), undefined);

            let prefix = annotation_graph.any(text_quote, vocab.oa('prefix'), undefined);
            let exact = annotation_graph.any(text_quote, vocab.oa('exact'), undefined);
            let suffix = annotation_graph.any(text_quote, vocab.oa('suffix'), undefined);

            console.log(prefix + '] ' + exact + ' [' + suffix);
        }).catch(function(err) {
            // do something with the error
            console.log("Received error: " + err.stack);
        });
    });
})
.catch(function(err) {
    // do something with the error
    console.log("Received error: " + err);
});
