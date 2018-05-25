"use strict";

/******************************IMPORTS ******************************/
// Libraries
const hrtime = require("browser-process-hrtime");
const request = require("superagent");

/********************************************************************/

var sparql_endpoint =
  window.location.protocol +
  "//" +
  window.location.host +
  "/sparql-2/annotations/filter";

function collectFilteredAnnotations(filter) {
  let timer = hrtime();
  request
    .get(sparql_endpoint)
    .query({ filter: filter })
    .end((err, res) => {
      if (!err) {
        displayResults(JSON.parse(res.text));
        let elapsedS = hrtime(timer)[0];
        let elapsedMs = hrtime(timer)[1] / 1e6;
        let elapsed = 1000 * elapsedS + elapsedMs;
        document.getElementById("resultsms").innerHTML =
          "Queried all annotations in " + Math.round(elapsed) + " ms.";
      } else console.log(err);
    });
}

function displayResults(results) {
  let bindings = results.results.bindings;
  let resultString = "";
  if (bindings === null || bindings.length == 0) {
    resultString = "No results found.";
  } else {
    for (let i = 0; i < bindings.length; i++) {
      let result = bindings[i];
      resultString +=
        i +
        1 +
        ") " +
        result.annotation.value +
        " --> " +
        result.text.value +
        "\n";
    }
  }
  document.getElementById("results").value = resultString;
}

let stringToBeContained = document.getElementById("querystring").value;

var initializeButton = document.getElementById("initializeButton");
initializeButton.onclick = function() {
  let stringToBeContained = document.getElementById("querystring").value;
  collectFilteredAnnotations(stringToBeContained);
};
