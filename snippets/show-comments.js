//http://dig.csail.mit.edu/2005/ajar/ajaw/Developer.html
var solid = require('solid-client');
var rdf = require('rdflib');
var ns = require('rdf-ns')()

var vocab = solid.vocab;

var save_location = 'https://lukasvanhoucke.databox.me/Public/comments/'; // forward slash was added for compatibility with older snippets

var graph;
solid.web.get('https://lukasvanhoucke.databox.me/Public/comments').then(function(response) {
    graph = response.parsedGraph();  // graph is part of rdflib, see link at top of page.

    var fs = require('fs'); // For debugging purposes, write graph to file.
    fs.writeFile("output.txt", graph.toString(), function(err) {
        if(err) {
            return console.log(err);
        }
    });

    var comment_urls = []; // save all links that contain comments
    graph.each(rdf.sym(save_location), vocab.ldp('contains'), undefined).forEach(function(node) {
      comment_urls.push(node.value); // adds link of comments to comment_urls
    });
    console.log(comment_urls);

    // NEEDS CLEANUP (Promises!)
    comment_urls.forEach(function(url) { // for each comment url, go to its url and parse the graph
        solid.web.get(url).then(function(response) {
            comment_graph = response.parsedGraph();
            var content = comment_graph.any(rdf.sym(url), vocab.sioc('content'), undefined); // see below
            /**
            Querying can be done with .each, .any (takes one) and .the (expects only one)
            Arguments: (s, p, o, why).
                Fourth argument isn't really clear: "The optional why argument can be used to keep track of which resource was the source for each triple."
                "in fact can take a fourth argument to select data from a particular source. "
            **/
            if (content) {
              console.log("content found: " + content.toString()); // or .value

            } else {
              console.log("No content found for url: " + url);
              /** The reason why no content is found, is because the subject in those urls is not the url itself **/
              /** Could be fixed by creating query like select ?s ?content from .. where ?s vocab.sioc('content') ?content  **/
              /** Note that rdf.any, rdf.the and rdf.each does not support double wildcards AFAIK. **/
              /** This can be fixed with the following code, which uses statementsMatching **/

              var statements = comment_graph.statementsMatching(undefined, vocab.sioc('content'), undefined);
              statements.forEach(function(statement) {
                console.log("Using statementsMatching workaround: Content is: "+ statement.object.value);
              });
            }

        });
    });
})
.catch(function(err) {
    // do something with the error
    console.log("Received error: " + err);
});
