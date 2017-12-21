// dokieli: ~completeFormSave
const solid = require('solid-client');
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);
const uuidv1 = require('uuid/v1');

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');

var annotation = {
  source: rdf.sym('https://openwebslides.github.io/cocos_kickoff'),
  target: rdf.sym('https://openwebslides.github.io/cocos_kickoff/#title'),
  author: rdf.sym('https://lukasvanhoucke.databox.me/profile/card#me'),
  title: rdf.lit("Lukas Vanhoucke created an annotation", 'en'),
  date: rdf.lit(new Date().toUTCString()),
  exact: rdf.lit('text to highlight', 'en'), // TODO: Language is not important here? Or is it 'required' for good RDF
  prefix: rdf.lit('text before highlighted text', 'en'),
  suffix: rdf.lit('text after highlighted text', 'en'),
  comment_text: rdf.lit('Comment text goes here', 'en')
}


var save_location = 'https://lukasvanhoucke.databox.me/Public/Annotations';
var slug = uuidv1();


var thisResource = rdf.sym(save_location + '/' + slug); // saves url as NamedNode
var selector = rdf.sym(thisResource.uri + '#fragment-selector'); // TODO: Is there a more natural way of creating hash URIs
var text_quote_selector = rdf.sym(thisResource.uri + '#text-quote-selector');

var graph = rdf.graph(); // create an empty graph

// Uses WebAnnotations recommended ontologies
graph.add(thisResource, vocab.rdf('type'), vocab.oa('Annotation'));
graph.add(thisResource, vocab.oa('hasTarget'), annotation.target);
graph.add(thisResource, vocab.dct('creator'), annotation.author);
graph.add(thisResource, vocab.dct('created'), annotation.date);
graph.add(thisResource, vocab.rdfs('label'), annotation.title);
graph.add(thisResource, vocab.oa('motivatedBy'), vocab.oa('commenting')); //https://www.w3.org/TR/annotation-vocab/#named-individuals

// graph.add(thisResource, vocab.oa('canonical'), TODO);

graph.add(annotation.target, vocab.rdf('type'), vocab.oa('SpecificResource'));
graph.add(annotation.target, vocab.oa('hasSelector'), selector);
graph.add(annotation.target, vocab.oa('hasSource'), annotation.source);

graph.add(selector, vocab.rdf('type'), vocab.oa('FragmentSelector'));
graph.add(selector, vocab.oa('refinedBy'), text_quote_selector);

graph.add(text_quote_selector, vocab.rdf('type'), vocab.oa('TextQuoteSelector'));
graph.add(text_quote_selector, vocab.oa('exact'), annotation.exact);
graph.add(text_quote_selector, vocab.oa('prefix'), annotation.prefix);
graph.add(text_quote_selector, vocab.oa('suffix'), annotation.suffix);

/** If annotation contains note **/
var body = rdf.sym(thisResource.uri + '#body'); // TODO: Extend for multiple bodies
graph.add(thisResource, vocab.oa('hasBody'), body);
graph.add(body, vocab.rdf('type'), vocab.oa('TextualBody'));
graph.add(body, vocab.rdf('value'), annotation.comment_text);
// dokieli adds schema:description and schema:name and dcterms:conformsTo

// dokieli also adds some info about author, but I think this is redundant.



// console.log(graph.toString());

var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization

console.log(data.toString());

solid.web.post(save_location, data, slug).then(function(meta) {
    var url = meta.url;
    console.log("Comment was saved at " + url);
}).catch(function(err) {
    // do something with the error
    console.log(err);
});
