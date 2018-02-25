"use strict";

/******************************IMPORTS ******************************/
// Libraries
const solid = require('solid-client'); // or require('solid') ?
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);

const uuidv1 = require('uuid/v1');
const randomUserOriginal = require('random-user');
const promiseRetry = require('promise-retry');
const request = require('superagent');
const hrtime = require('browser-process-hrtime');

// var save_location = 'https://lukas.vanhoucke.me/inbox'; // Temporary
var save_location = null; // Temporary
// const sparql_endpoint = 'https://vanhoucke.me/sparql';
var sparql_endpoint = window.location.protocol + '//' + window.location.host + '/sparql';

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');
vocab.example = ns.base('http://www.example.com/ns#'); // TODO: Remove this by finding correct terms


const web_workers = 10; // Cannot create all annotations at the same time, so divide work.
                        // TODO http://doduck.com/concurrent-requests-node-js/

const fragments = ["introduction", "chapter_one", "chapter_two", "listing_one",
 "listing_two", "listing_three", "conclusion", "sources", "comments", "about"];



 // Adapted function to only return names that match regex /^[A-Za-z]+$/
 // function randomUser() {
 //   return promiseRetry(function (retry, number) {
 //       //console.log('attempt number', number);
 //       return new Promise(function(resolve, reject) {
 //         randomUserOriginal('simple')
 //           .then( (data) => {
 //             if (/^[A-Za-z]+$/.test(data.firstName) && /^[A-Za-z]+$/.test(data.lastName)) {
 //               resolve(data);
 //             } else {
 //               //console.log("REJECTED: " + data.firstName + " " + data.lastName);
 //               reject(data);
 //             }
 //           }).catch((err) => {
 //             console.log(err);
 //             reject(err);
 //           });
 //       }).catch(retry);
 //   });
 // }

 // dummy function for localhost testing, since it does not allow cross-origin requests.
 function randomUser() {
   return new Promise(function(resolve, reject) {
     let data = {};
     try {
       data.firstName = Math.random().toString(36).substring(7);
       data.lastName = Math.random().toString(36).substring(7);
       resolve(data);
     } catch(err) {
       reject(err);
     }
   });
  }

 // Generate a list of random users (and create specific bin for each user)
 function generateUsers(number_of_users, users) {
   return new Promise(function(resolve, reject) {
     for (let i = 0; i < number_of_users; i++) {
       let user = null;
       randomUser()
         .then( (data) => {
           user = data;
           user.id = i;
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
 function generateWebsites(number_of_websites, websites) {
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
 function generateAnnotations(number_of_annotations, users, websites, fragments, annotations) {
   return new Promise(function(resolve, reject) {
     let annotations_timer = hrtime();
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

       let individual_annotation_timer = hrtime();
       solid.web.post(save_location, data, slug).then(function(meta) {
         let elapsedS = hrtime(individual_annotation_timer)[0];
         let elapsedMs = hrtime(individual_annotation_timer)[1] / 1e6;
         let elapsed = 1000*elapsedS + elapsedMs;
         var url = meta.url;
         annotations.push(url);
         console.log("Annotation " + annotations.length + " created at " + url + " (" + elapsed + " ms)");
         showAnnotation(meta.url, user, website + '#' + fragment)
         if (annotations.length == number_of_annotations) {
           elapsedS = hrtime(annotations_timer)[0];
           elapsedMs = hrtime(annotations_timer)[1] / 1e6;
           elapsed = 1000*elapsedS + elapsedMs;
           console.log("-- [SOLID] Annotations created in " + elapsed + " ms --");
           let average_time = elapsed / number_of_annotations;
           console.log("-- [SOLID] Average storage time for " + number_of_annotations +
                       " annotations is " + average_time + " ms --");
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

function generateSPARQLAnnotations(annotations) {
  return new Promise(function(resolve, reject) {
    let annotations_timer = hrtime();

    let number_of_annotations = annotations.length;
    let counter = 0;
    for (let i = 0; i < number_of_annotations; i++) {
      let annotation = annotations[i];
      let individual_annotation_timer = hrtime();
      request.post(sparql_endpoint)
        .send({
          graph: annotation
        })
        .then(function(res) {
          let elapsedS = hrtime(individual_annotation_timer)[0];
          let elapsedMs = hrtime(individual_annotation_timer)[1] / 1e6;
          let elapsed = 1000*elapsedS + elapsedMs;
          let annotation_split = annotation.split('/');
          console.log("(" + i + ") Succesfully created graph of " + annotation +" ( " +
              sparql_endpoint + '/' + annotation_split[annotation_split.length - 2]  +
              '/' + annotation_split[annotation_split.length - 1] + ' ) (' + elapsed + " ms)");
          counter++;
          if (counter == number_of_annotations) {
            elapsedS = hrtime(annotations_timer)[0];
            elapsedMs = hrtime(annotations_timer)[1] / 1e6;
            elapsed = 1000*elapsedS + elapsedMs;
            console.log("-- [SPARQL] Annotations created in " + elapsed + " ms --");
            let average_time = elapsed / number_of_annotations;
            console.log("-- [SPARQL] Average storage time for " + number_of_annotations +
                        " annotations is " + average_time + " ms --");
            resolve();
          }
        })
        .catch(function(err) {
          console.log("Received error: " + err);
          reject();
        })
    }

  });
}

function generate(number_of_annotations, number_of_users, number_of_websites) {
  return new Promise(function(resolve, reject) {
    let annotations = [];
    let users = [];
    let websites = [];
    solid.login() // the browser automatically provides the client key/cert for you
      .then(webId => {
        console.log('Current WebID: %s', webId);
        return solid.getProfile(webId);
        })
      .then(function (profile) {
        console.log("User logged in: " + profile.name);
        var name = profile.name;
        var webId = profile.webId;
        save_location = profile.find(vocab.oa('annotationService')) || save_location;
        if (!save_location) throw new Exception("No annotation storage location (oa:annotationService) found in profile.");
        return generateUsers(number_of_users, users)
      }).then(function() {
        console.log("Users created");
        return generateWebsites(number_of_websites, websites);
      }).then(function() {
        console.log("Websites created");
        return generateAnnotations(number_of_annotations, users, websites, fragments, annotations);
      }).then(function() {
        return generateSPARQLAnnotations(annotations);
      }).then(function() {
        console.log("Annotations copied to SPARQL server");
        resolve(annotations);
      }).catch(function(err) {
        console.log(err);
        reject(err);
      });
    });
}

// This is just collection, no querying etc.
function loadSolidAnnotations(annotations) {
  return new Promise(function(resolve, reject) {
    let counter = 0;
    let annotations_timer = hrtime();
    for (let i = 0; i < annotations.length; i++) {
      let individual_annotation_timer = hrtime();
      solid.web.get(annotations[i]).then(function(response) {
        let elapsedS = hrtime(individual_annotation_timer)[0];
        let elapsedMs = hrtime(individual_annotation_timer)[1] / 1e6;
        let elapsed = 1000*elapsedS + elapsedMs;
        counter++;
        console.log("Collected annotation " + i + " at " + annotations[i] +" collected (" + elapsed + " ms)");
        if (counter == annotations.length) {
          elapsedS = hrtime(annotations_timer)[0];
          elapsedMs = hrtime(annotations_timer)[1] / 1e6;
          elapsed = 1000*elapsedS + elapsedMs;
          console.log("-- [Solid] All annotations collected --");
          let average_time = elapsed / annotations.length;
          console.log("-- [Solid] Average collection time for " + annotations.length +
                      " annotations is " + average_time + " ms --");
          resolve();
        }
      })
      .catch(function(err) {
        reject(err);
      });
    }
  });
}

function loadSPARQLAnnotations(annotations) {
  return new Promise(function(resolve, reject) {
    let annotations_timer = hrtime();

    let counter = 0;
    for (let i = 0; i < annotations.length; i++) {
      let annotation_split = annotations[i].split('/');
      let annotation_url = sparql_endpoint + '/' + annotation_split[annotation_split.length - 2]  +
      '/' + annotation_split[annotation_split.length - 1];

      let individual_annotation_timer = hrtime();
      request
        .get(annotation_url)
        .end((err, res) => {
          if (!err) {
            let elapsedS = hrtime(individual_annotation_timer)[0];
            let elapsedMs = hrtime(individual_annotation_timer)[1] / 1e6;
            let elapsed = 1000*elapsedS + elapsedMs;
            counter++;
            console.log("Collected annotation " + i + " at " + annotation_url +" collected (" + elapsed + " ms)");
            // This is just collection, no querying etc.
            if (counter == annotations.length) {
              elapsedS = hrtime(annotations_timer)[0];
              elapsedMs = hrtime(annotations_timer)[1] / 1e6;
              elapsed = 1000*elapsedS + elapsedMs;
              console.log("-- [SPARQL] All annotations collected --");
              let average_time = elapsed / annotations.length;
              console.log("-- [SPARQL] Average collection time for " + annotations.length +
                          " annotations is " + average_time + " ms --");
              resolve();
            }
          } else reject(err);
        });

    }
  });
}

function loadAnnotations(annotations) {
  return new Promise(function(resolve, reject) {
    loadSolidAnnotations(annotations)
    .then(function() {
      return loadSPARQLAnnotations(annotations);
    })
    .then(resolve)
    .catch(function(err) {
      reject(err);
    });
  });
}

function showAnnotation(annotation_url, user, site) {
  let userList = document.getElementById("userList_" + user.id);
  if (!userList) {
    // create list
    let listItem = document.createElement('li');
    listItem.appendChild(document.createTextNode("User " + user.id));
    userList = document.createElement('ul');
    userList.setAttribute("id", "userList_" + user.id);
    listItem.appendChild(userList);
    document.getElementById("annotationsList").append(listItem);
  }

  // append to list
  let newListItem = document.createElement('li');
  newListItem.appendChild(document.createTextNode(user.firstName + " " + user.lastName + " (" + user.id + ") created an annotation for \"" + site +
  "\" stored at "));

  let link = document.createElement('a');
  let linkText = document.createTextNode(annotation_url);
  link.appendChild(linkText);
  link.href = annotation_url;
  link.title = annotation_url;
  newListItem.appendChild(link);

  userList.appendChild(newListItem);
}

function synchronizeInputAndSlider(inputId, sliderId) {
  var slider = document.getElementById(sliderId);
  var input = document.getElementById(inputId);
  input.value = slider.value;
  var min = parseInt(slider.min);
  var max = parseInt(slider.max);

  // Update the current slider value (each time you drag the slider handle)
  slider.oninput = function() {
      input.value = this.value;
  }

  input.oninput = function() {
    this.value = this.value.replace(/[^0-9.]/g, '');
    this.value = parseInt(this.value);
    if (this.value != "") {
      if (this.value < min) {
        this.value = min;
      } else if (this.value > max) {
        this.value = max;
      }
      slider.value = this.value;
    }
  }
}

synchronizeInputAndSlider("usersInput", "usersRange");
synchronizeInputAndSlider("websitesInput", "websitesRange");
synchronizeInputAndSlider("annotationsInput", "annotationsRange");

var generateButton = document.getElementById("generateButton");
generateButton.onclick = function() {
  let number_of_annotations = document.getElementById("annotationsRange").value;
  let number_of_users = document.getElementById("usersRange").value;
  let number_of_websites = document.getElementById("websitesRange").value;
  generate(number_of_annotations, number_of_users, number_of_websites);
}

var loadButton = document.getElementById("loadButton");
loadButton.onclick = function() {
  let number_of_annotations = document.getElementById("annotationsRange").value;
  let number_of_users = document.getElementById("usersRange").value;
  let number_of_websites = document.getElementById("websitesRange").value;
  generate(number_of_annotations, number_of_users, number_of_websites)
  .then(function(annotations) {
    loadAnnotations(annotations);
  }).catch(function(err) {
    console.log(err);
  });

}
