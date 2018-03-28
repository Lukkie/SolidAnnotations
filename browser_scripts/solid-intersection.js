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
        resolve(Object.keys(container.resource.resources));
    })
  });
}

function collectAnnotations(locations) {
  return new Promise(function(resolve, reject) {
    let graph = null;
    // Collect the annotations and store in graph
    console.log(locations);
    let counter = 0;
    for (let i = 0; i < locations.length; i++) {
      let location = locations[i];
      console.log(location);
      solid.web.get(location)
        .then(function (response) {
          // Merge graph with current graph
          // console.log(response.parsedGraph());
          if (graph === null) graph = response.parsedGraph();
          else graph.add(response.parsedGraph());
          // console.log(graph);
          // If last location: Return the graph
          counter++;
          if (counter == locations.length) resolve(graph);
        }).catch(function(err) {
          reject(err);
        });
    }
  });
}

function queryAnnotations(graph) {
  return new Promise(function(resolve, reject) {
    if (graph === null) {
      displayResults(null);
      resolve();
    }
    let stringToBeContained = document.getElementById("querystring").value;
    let results = [];
    // example query: Find all strings that contain 'Lorem ipsum dolor'
    console.log(graph);
    let comments = graph.statementsMatching(undefined, vocab.rdf('value'), undefined);
    comments.forEach(function(comment) {
      let value = comment.object.value;
      console.log(value);
      if (value.indexOf(stringToBeContained) !== -1) results.push(comment);
    })
    displayResults(results);
    resolve();
  });
}

function displayResults(results) {
  let resultString = "";
  if (results === null || results.length == 0) {
    resultString = "No results found.";
  } else {
    results.forEach(function(result) {
      resultString += result.why.value + ' --> ' + result.object.value + '\n';
    });
  }

  document.getElementById("results").value = resultString;
}

var initializeButton = document.getElementById("initializeButton");
initializeButton.onclick = function() {
  doIntersection();
}
