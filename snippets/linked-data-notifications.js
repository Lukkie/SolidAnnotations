const solidWebClient = require('solid-web-client')();
const rdf = require('rdflib');
const solid = require('solid-client');
const ldn = require('solid-notifications');


var uri = 'http://csarven.ca/linked-data-notifications';
var inbox_uri = 'https://linkedresearch.org/inbox/csarven.ca/linked-data-notifications/';
// ldn.discoverInboxUri(uri, solid.web);
let options = {
        headers: { 'Accept': 'text/turtle;q=0.8,*/*;q=0.5' }
      }
solid.web.get(inbox_uri, options).then(function(response) {
  console.log(response.toString());
}).catch(function(error) {
  console.log("Received error: " + e.stack);
});
