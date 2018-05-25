"use strict";

/******************************IMPORTS ******************************/
// Libraries
const solid = require("solid-client"); // or require('solid') ?
const rdf = require("rdflib");
const ns = require("rdf-ns")(rdf);

const uuidv1 = require("uuid/v1");
const randomUserOriginal = require("random-user");
const promiseRetry = require("promise-retry");
const request = require("superagent");
const hrtime = require("browser-process-hrtime");

var save_location = null; // Temporary
var sparql_onegraph_endpoint =
  window.location.protocol +
  "//" +
  window.location.host +
  "/sparql-2/annotations";
var sparql_onegraph_endpoint_filter =
  window.location.protocol +
  "//" +
  window.location.host +
  "/sparql-2/annotations/website";

var vocab = solid.vocab;
vocab.oa = ns.base("http://www.w3.org/ns/oa#");
vocab.as = ns.base("http://www.w3.org/ns/activitystreams#");
vocab.example = ns.base("http://www.example.com/ns#"); // TODO: Remove this by finding correct terms

var queryTextBox = document.getElementById("querystring");
var loadButtonSolid = document.getElementById("loadButtonSolid");
var loadButtonSPARQL = document.getElementById("loadButtonSPARQL");

// This is just collection, no querying etc.
// specificUrl is "" when all solid annotations have to be returned
function loadSolidAnnotations(specificUrl) {
  let url = specificUrl || "";
  return new Promise(function(resolve, reject) {
    let annotations = [];
    let counter = 0;
    let annotations_timer = hrtime();
    solid
      .login() // the browser automatically provides the client key/cert for you
      .then(webId => {
        console.log("Current WebID: %s", webId);
        // Load extended profile? At the moment: No -- Solid cannot parse text -> leads to issues
        let options = { ignoreExtended: true };
        return solid.getProfile(webId, options);
      })
      .then(function(profile) {
        console.log("User logged in: " + profile.name);
        save_location =
          profile.find(vocab.oa("annotationService")) || save_location;
        if (!save_location)
          throw new Exception(
            "No annotation storage location (oa:annotationService) found in profile."
          );
        return solid.web.get(save_location);
      })
      .then(function(annotations_directory) {
        if (annotations_directory.isContainer()) {
          // collect all annotations
          let number_of_annotations = Object.keys(
            annotations_directory.resource.resources
          ).length;
          for (let annotation in annotations_directory.resource.resources) {
            solid.web.get(annotation).then(function(annotation_response) {
              let annotation_graph = annotation_response.parsedGraph();
              if (
                url.length == 0 ||
                annotation_graph.any(
                  undefined,
                  vocab.oa("hasSource"),
                  rdf.sym(url)
                )
              ) {
                annotations.push(annotation_response.parsedGraph());
              }
              counter++;
              if (counter == number_of_annotations) {
                let elapsedS = hrtime(annotations_timer)[0];
                let elapsedMs = hrtime(annotations_timer)[1] / 1e6;
                let elapsed = 1000 * elapsedS + elapsedMs;
                console.log("-- [SOLID] All annotations collected --");
                let average_time = elapsed / number_of_annotations;
                console.log(
                  "-- [SOLID] Total collection time for " +
                    number_of_annotations +
                    " annotations is " +
                    elapsed +
                    " ms --"
                );
                console.log(
                  "-- [SOLID] Average collection time for " +
                    number_of_annotations +
                    " annotations is " +
                    average_time +
                    " ms --"
                );
                resolve(annotations);
              }
            });
          }
        } else throw new Exception("Annotation service is not a directory");
      })
      .catch(function(err) {
        reject(err);
      });
  });
}

function loadSPARQLAnnotations() {
  return new Promise(function(resolve, reject) {
    let annotations = [];
    let annotations_timer = hrtime();

    let endpoint = sparql_onegraph_endpoint;
    if (getQueryString().length > 0) {
      endpoint = sparql_onegraph_endpoint_filter;
      endpoint += "?url=";
      endpoint += getQueryString();
    }
    request.get(endpoint).end((err, res) => {
      if (!err) {
        let bindings = JSON.parse(res.text).results.bindings;

        let elapsedS = hrtime(annotations_timer)[0];
        let elapsedMs = hrtime(annotations_timer)[1] / 1e6;
        let elapsed = 1000 * elapsedS + elapsedMs;
        console.log("-- [SPARQL] All annotations collected --");
        let average_time = elapsed / bindings.length;
        console.log(
          "-- [SPARQL] Total collection time for " +
            bindings.length +
            " annotations is " +
            elapsed +
            " ms --"
        );
        console.log(
          "-- [SPARQL] Average collection time for " +
            bindings.length +
            " annotations is " +
            average_time +
            " ms --"
        );
        resolve(bindings);
      } else reject(err);
    });
  });
}

function displayAnnotationsSolid(annotations) {
  annotations.forEach(function(annotation) {
    let annotation_uri = annotation.any(
      undefined,
      vocab.rdf("type"),
      vocab.oa("Annotation")
    ).value;
    let source = annotation.statementsMatching(
      undefined,
      vocab.oa("hasSource"),
      undefined
    )[0].object.value;

    console.log(annotation_uri + ": " + source);
  });
}

function displayAnnotationsSPARQL(annotations) {
  annotations.forEach(function(binding) {
    console.log(binding.annotation.value + ": " + binding.source.value);
  });
}

function getQueryString() {
  return queryTextBox.value.trim();
}

loadButtonSolid.onclick = function() {
  loadSolidAnnotations(getQueryString())
    .then(function(annotations) {
      displayAnnotationsSolid(annotations);
    })
    .catch(function(err) {
      console.log(err);
    });
};

loadButtonSPARQL.onclick = function() {
  loadSPARQLAnnotations()
    .then(function(annotations) {
      displayAnnotationsSPARQL(annotations);
    })
    .catch(function(err) {
      console.log(err);
    });
};
