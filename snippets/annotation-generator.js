// If possible, make webpage from this
// Could be cleaner with async/await but not supported in my node version
var save_location = 'https://lukas.vanhoucke.me/public/bins';

const solid = require('solid-client');
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);
const uuidv1 = require('uuid/v1');
const randomUserOriginal = require('random-user');
const promiseRetry = require('promise-retry');

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');

const web_workers = 10; // Cannot create all annotations at the same time, so divide work.
                        // TODO http://doduck.com/concurrent-requests-node-js/

const number_of_annotations = 50;
const number_of_users = 10;
const number_of_websites = 10;
const fragments = ["introduction", "chapter_one", "chapter_two", "listing_one",
 "listing_two", "listing_three", "conclusion", "sources", "comments", "about"];

let users = [];
let websites = [];
let annotations = [];


// Adapted function to only return names that match regex /^[A-Za-z]+$/
function randomUser() {
  return promiseRetry(function (retry, number) {
      //console.log('attempt number', number);
      return new Promise(function(resolve, reject) {
        randomUserOriginal('simple')
          .then( (data) => {
            if (/^[A-Za-z]+$/.test(data.firstName) && /^[A-Za-z]+$/.test(data.lastName)) {
              resolve(data);
            } else {
              //console.log("REJECTED: " + data.firstName + " " + data.lastName);
              reject(data);
            }
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
      }).catch(retry);
  });
}

// Generate a list of random users (and create specific bin for each user)
function generate_users() {
  return new Promise(function(resolve, reject) {
    for (let i = 0; i < number_of_users; i++) {
      let user = null;
      randomUser()
        .then( (data) => {
          user = data;
          var username = user.username;
          return solid.web.createContainer(save_location, username);
        })
        .then(function(meta) {
          var url = meta.url;
          console.log("Directory was created at " + url);
          user.directory = url;
          users.push(user);
          if (users.length == number_of_users) resolve();
        })
        .catch( (err) => {
          console.log(err);
          reject(err);
        });
    }
  });
}

// Generate a list of random websites, and multiple fragments per website
function generate_websites() {
  return new Promise(function(resolve, reject) {
    for (let i = 0; i < number_of_websites; i++) {
      let website = null;
      randomUser()
        .then( (data) => {

          website = 'https://www.' + data.firstName + data.lastName + '.com';
          websites.push(website);
          if (websites.length == number_of_websites) resolve();
        })
        .catch( (err) => {
          console.log(err);
          reject(err);
        });
    }
  });
}


// Generate annotation for randomly chosen user on a randomly chosen website + fragment
// Generates random title, text, date
function generate_annotations(number_of_annotations, users, websites, fragments) {
  return new Promise(function(resolve, reject) {
    for (let i = 0; i < number_of_annotations; i++) {
      let user_id = Math.floor(Math.random() * users.length);
      let website_id = Math.floor(Math.random() * websites.length);
      let fragment_id = Math.floor(Math.random() * fragments.length);

      let user = users[user_id];
      let website = websites[website_id];
      let fragment = fragments[fragment_id];

      let annotation = {
        source: rdf.sym(website),
        target: rdf.sym(website + '#' + fragment),
        author: rdf.sym(user.directory + '/card#me'),  // This does not actually exist
        title: rdf.lit(user.firstName +" " + user.lastName + " created an annotation", 'en'),
        date: rdf.lit(new Date().toUTCString()), // TODO
        exact: rdf.lit('text to highlight', 'en'), // TODO
        prefix: rdf.lit('text before highlighted text', 'en'),
        suffix: rdf.lit('text after highlighted text', 'en'),
        comment_text: rdf.lit('Comment text goes here', 'en')
      }

      let slug = uuidv1();
      let save_location = user.directory;

      var thisResource = rdf.sym(save_location + '/' + slug); // saves url as NamedNode
      var selector = rdf.sym(thisResource.uri + '#fragment-selector');
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
      var body = rdf.sym(thisResource.uri + '#body'); // TODO: What about multiple bodies?
      graph.add(thisResource, vocab.oa('hasBody'), body);
      graph.add(body, vocab.rdf('type'), vocab.oa('TextualBody'));
      graph.add(body, vocab.rdf('value'), annotation.comment_text);

      var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization

      solid.web.post(save_location, data/*, slug*/).then(function(meta) {
        var url = meta.url;
        annotations.push(url);
        console.log("Annotation " + annotations.length + " created at " + url);
        if (annotations.length == number_of_annotations) {
          resolve();
        }
      }).catch(function(err) {
          // do something with the error
          console.log(err);
          reject(err);
      });
    }
  });
}

// Call functions to generate users, websites and annotations
generate_users().then(function() {
  console.log("Users created");
  return generate_websites();
}).then(function() {
  console.log("Websites created");
  return generate_annotations(number_of_annotations, users, websites, fragments);
}).then(function() {
  console.log("Annotations created");
}).catch(function(err) {
  console.log(err);
});
