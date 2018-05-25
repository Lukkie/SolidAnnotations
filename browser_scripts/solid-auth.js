/******************************IMPORTS ******************************/
// Libraries
const solid = require("solid-client"); // or require('solid') ?
const rdf = require("rdflib");
const ns = require("rdf-ns")(rdf);

const uuidv1 = require("uuid/v1");

// var inbox_location = 'https://lukas.vanhoucke.me/inbox'; // Temporary
var inbox_location = null; // Temporary

var vocab = solid.vocab;
vocab.oa = ns.base("http://www.w3.org/ns/oa#");
vocab.as = ns.base("http://www.w3.org/ns/activitystreams#");
vocab.example = ns.base("http://www.example.com/ns#"); // TODO: Remove this by finding correct terms

solid
  .login() // the browser automatically provides the client key/cert for you
  .then(webId => {
    console.log("Current WebID: %s", webId);
    return solid.getProfile(webId);
  })
  .then(function(profile) {
    console.log("User logged in: " + profile.name);
    var name = profile.name;
    var webId = profile.webId;
    inbox_location = profile.find(solid.vocab.ldp("inbox")) || inbox_location; // -> 'https://example.com/inbox/'
    if (!inbox_location) throw new Exception("No inbox location found");

    var exact = "exact";
    var prefix = "prefix";
    var suffix = "suffix";

    // Create triples with solid
    var annotation = {
      source: rdf.sym(window.location.href.split("#")[0]),
      target: rdf.sym(window.location.href),
      author: rdf.sym(webId),
      title: rdf.lit(name + " created an annotation", "en"),
      date: rdf.lit(new Date().toUTCString()),
      exact: rdf.lit(exact, "en"), // TODO: Language is not important here? Or is it 'required' for good RDF
      prefix: rdf.lit(prefix, "en"),
      suffix: rdf.lit(suffix, "en")
      //comment_text: rdf.lit('Comment text goes here', 'en')
    };
    var slug = uuidv1();

    var thisResource = rdf.sym(inbox_location + "/" + slug); // saves url as NamedNode
    var selector = rdf.sym(thisResource.uri + "#fragment-selector"); // TODO: Is there a more natural way of creating hash URIs
    var text_quote_selector = rdf.sym(
      thisResource.uri + "#text-quote-selector"
    );

    var graph = rdf.graph(); // create an empty graph

    // Uses WebAnnotations recommended ontologies
    graph.add(thisResource, vocab.rdf("type"), vocab.oa("Annotation"));
    graph.add(thisResource, vocab.oa("hasTarget"), annotation.target);
    graph.add(thisResource, vocab.dct("creator"), annotation.author);
    graph.add(thisResource, vocab.dct("created"), annotation.date);
    graph.add(thisResource, vocab.rdfs("label"), annotation.title);
    graph.add(thisResource, vocab.oa("motivatedBy"), vocab.oa("tagging")); //https://www.w3.org/TR/annotation-vocab/#named-individuals

    graph.add(
      annotation.target,
      vocab.rdf("type"),
      vocab.oa("SpecificResource")
    );
    graph.add(annotation.target, vocab.oa("hasSelector"), selector);
    graph.add(annotation.target, vocab.oa("hasSource"), annotation.source);

    graph.add(selector, vocab.rdf("type"), vocab.oa("FragmentSelector"));
    graph.add(selector, vocab.oa("refinedBy"), text_quote_selector);

    graph.add(
      text_quote_selector,
      vocab.rdf("type"),
      vocab.oa("TextQuoteSelector")
    );
    graph.add(text_quote_selector, vocab.oa("exact"), annotation.exact);
    graph.add(text_quote_selector, vocab.oa("prefix"), annotation.prefix);
    graph.add(text_quote_selector, vocab.oa("suffix"), annotation.suffix);

    var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization

    return solid.web.post(inbox_location, data, slug);
  })
  .then(function(meta) {
    var url = meta.url;
    console.log("Comment was saved at " + url);
    // TODO: POST notification to inbox of webpage (ldp:inbox in RDFa)
  })
  .catch(err => {
    console.log(err);
  });
