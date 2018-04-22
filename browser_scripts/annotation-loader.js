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
var sparql_onegraph_endpoint = window.location.protocol + '//' + window.location.host + '/sparql-2';

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');
vocab.example = ns.base('http://www.example.com/ns#'); // TODO: Remove this by finding correct terms


// This is just collection, no querying etc.
function loadSolidAnnotations(annotations) {
  return new Promise(function(resolve, reject) {
    let annotations = [];
    let counter = 0;
    let annotations_timer = hrtime();
    solid.login() // the browser automatically provides the client key/cert for you
      .then(webId => {
        console.log('Current WebID: %s', webId);
        // Load extended profile? At the moment: No -- Solid cannot parse text -> leads to issues
        let options = {ignoreExtended: true};
        return solid.getProfile(webId, options);
        })
      .then(function (profile) {
        console.log("User logged in: " + profile.name);
        save_location = profile.find(vocab.oa('annotationService')) || save_location;
        if (!save_location) throw new Exception("No annotation storage location (oa:annotationService) found in profile.");
        return solid.web.get(save_location);
      }).then(function(annotations_directory) {
        if (annotations_directory.isContainer()) {
          // collect all annotations
          let number_of_annotations = Object.keys(annotations_directory.resource.resources).length;
          for (let annotation in annotations_directory.resource.resources) {
            solid.web.get(annotation).then(function(annotation_response) {
              annotations.push(annotation_response.parsedGraph());
              counter++;
              if (counter == number_of_annotations) {
                let elapsedS = hrtime(annotations_timer)[0];
                let elapsedMs = hrtime(annotations_timer)[1] / 1e6;
                let elapsed = 1000*elapsedS + elapsedMs;
                console.log("-- [SOLID] All annotations collected --");
                let average_time = elapsed / number_of_annotations;
                console.log("-- [SOLID] Average collection time for " + number_of_annotations +
                            " annotations is " + average_time + " ms --");
                resolve(annotations);
              }
            })
          }
        } else throw new Exception("Annotation service is not a directory");
      })
      .catch(function(err) {
        reject(err);
      });
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

function displayAnnotations(annotations) {
  // TODO
  annotations.forEach(function(annotation) {
    console.log(annotation);
  })
}



var loadButtonSolid = document.getElementById("loadButtonSolid");
loadButtonSolid.onclick = function() {
  loadSolidAnnotations()
    .then(function(annotations) {
      displayAnnotations(annotations);
    }).catch(function(err) {
      console.log(err);
    });
}

var loadButtonSPARQL = document.getElementById("loadButtonSPARQL");
loadButtonSPARQL.onclick = function() {
  loadSPARQLAnnotations()
    .then(function(annotations) {
      displayAnnotations(annotations);
    }).catch(function(err) {
      console.log(err);
    });
}
