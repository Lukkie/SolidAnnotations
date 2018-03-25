"use strict";

/******************************IMPORTS ******************************/
// Libraries
const solid = require('solid-client'); // or require('solid') ?
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);

// var save_location = 'https://lukas.vanhoucke.me/inbox'; // Temporary
var save_location = null; // Temporary
// const sparql_endpoint = 'https://vanhoucke.me/sparql';
var sparql_endpoint = window.location.protocol + '//' + window.location.host + '/sparql';

var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');
vocab.example = ns.base('http://www.example.com/ns#'); // TODO: Remove this by finding correct terms


const content = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";


// Collect annotation directory
// Collect all annotations in this directory
// Store the annotations in a graph
// Query the graph
// (Could also query each annotation in case the annotation directory would be huge, but is realistically not the case)

function doIntersection() {
  return new Promise(function(resolve, reject) {
    let annotations = [];
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
        return collectAnnotationLocations();
      }).then(function(locations) {
        return collectAnnotations(locations)
      }).then(function(graph) {
        console.log("Annotations collected");
        return queryAnnotations(graph);
      }).then(function() {
        console.log("Finished.");
      }).catch(function(err) {
        console.log(err);
        reject(err);
      });
    });
}

function collectAnnotationLocations() {
  return new Promise(function(resolve, reject) {
    // Get all annotation locations
    solid.web.get(save_location)
                  .then(function (container) {
                    console.log(container)
                    resolve(Object.keys(container.resource.resources));
    })
  });
}

function collectAnnotations(locations) {
  return new Promise(function(resolve, reject) {
    let graph = rdf.graph();
    // Collect the annotations and store in graph
    console.log(locations);
    let counter = 0;
    for (let i = 0; i < locations.length; i++) {
      let location = locations[i];
      solid.web.get(location)
                    .then(function (response) {
                      console.log(response.parsedGraph());
                      // Merge graph with current graph
                      // graph.add(response.parsedGraph()); ??
                      // If last location: Return the graph
                      counter++;
                      if (counter == locations.length) resolve(graph);
      });
    }

  });
}

function queryAnnotations(graph) {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}

var initializeButton = document.getElementById("initializeButton");
initializeButton.onclick = function() {
  doIntersection();
}
