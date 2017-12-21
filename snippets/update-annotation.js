const solid = require('solid-client');
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');

function updateObject(graph, subject, predicate, new_object) {
  // Removes ALL statements matching subject and predicate
  // Adds a new triple with the new object value
  var statements = graph.statementsMatching(subject, predicate, undefined);
  graph.remove(statements);
  graph.add(subject, predicate, new_object);
}

var updated_annotation = {
  exact: rdf.lit('UPDATED text to highlight', 'en'), // TODO: Language is not important here? Or is it 'required' for good RDF
  comment_text: rdf.lit('UPDATED Comment text goes here', 'en')
}


var annotation_location = 'https://lukasvanhoucke.databox.me/Public/Annotations/9cce07a0-e636-11e7-8c9e-4954a14d4412';
var thisResource = rdf.sym(annotation_location); // saves url as NamedNode
var selector = rdf.sym(thisResource.uri + '#fragment-selector'); // TODO: Is there a more natural way of creating hash URIs?
var text_quote_selector = rdf.sym(thisResource.uri + '#text-quote-selector');
var body = rdf.sym(thisResource.uri + '#body'); // TODO: Extend for multiple bodies

var graph;
solid.web.get(annotation_location).then(function(response) {
    graph = response.parsedGraph();  // graph is part of rdflib, see link at top of page.

    updateObject(graph, text_quote_selector, vocab.oa('exact'), updated_annotation.exact)
    updateObject(graph, body, vocab.rdf('value'), updated_annotation.comment_text)

    var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization
    solid.web.put(annotation_location, data).then(function(meta) {
        var url = meta.url;
        console.log("Comment was saved at " + url);
    }).catch(function(err) {
        // do something with the error
        console.log(err);
    });
});
