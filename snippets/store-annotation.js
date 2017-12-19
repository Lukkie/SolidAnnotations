// dokieli: ~completeFormSave
var solid = require('solid-client');
var rdf = require('rdflib');
var ns = require('rdf-ns')()

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');

var save_location = 'https://lukasvanhoucke.databox.me/Public/Annotations';

var graph = rdf.graph(); // create an empty graph
var thisResource = rdf.sym(save_location); // saves url as NamedNode
// graph.add(thisResource, vocab.dct('title'), rdf.lit('testtitle2')); // Add a triple to the graph
// graph.add(thisResource, vocab.sioc('content'), rdf.lit('testcomment data 2', 'en'));
// graph.add(thisResource, vocab.sioc('about'), rdf.sym('www.example.com')); // Note: Websites are not literals, use rdf.sym!
var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization

console.log(data.toString());

solid.web.post(save_location, data/*, 'custom_slug'*/).then(function(meta) {
    var url = meta.url;
    console.log("Comment was saved at " + url);
}).catch(function(err) {
    // do something with the error
    console.log(err);
});
