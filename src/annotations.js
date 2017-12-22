/******************************IMPORTS ******************************/
// Libraries
const solid = require('solid-client'); // or require('solid') ?
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf)
const MediumEditor = require('medium-editor');
const rangy = require('rangy');
const rangyClassApplier = require('rangy/lib/rangy-classapplier');
const uuidv1 = require('uuid/v1');
// Modules
const util = require('./util.js');
/********************************************************************/

css_files = ["https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", // font awesome
             "//cdn.jsdelivr.net/npm/medium-editor@latest/dist/css/medium-editor.min.css", // core medium editor CSS
             "https://www.dropbox.com/s/102ds8wnn9kscqm/flat-theme.css?raw=1"] // medium theme CSS (can be swapped)

/** Config **/
var selector = '.slide';
var contextLength = 32; // Based on dokieli; The number of characters (at most) to add for context
var save_location = 'https://lukasvanhoucke.databox.me/Public/Annotations'; // Temporary
var inbox_location = 'https://lukasvanhoucke.databox.me/Public/Inbox'; // Temporary
var listing_location = 'https://lukasvanhoucke.databox.me/Public/Listings/test'; // Temporary -- Location where annotation URLs are stored
/**/

var d = document;
function loadCSS(url) {
  var s = d.createElement('link');
  s.href = url;
  s.media = 'all';
  s.type = 'text/css';
  s.rel = 'stylesheet';
  s.charset = "utf-8";
  d.head.appendChild(s);
}
css_files.forEach(function(url) {
  loadCSS(url);
});

rangy.init();
var vocab = solid.vocab;
vocab.oa = ns.base('http://www.w3.org/ns/oa#');
vocab.as = ns.base('http://www.w3.org/ns/activitystreams#');
vocab.example = ns.base('http://www.example.com/ns#'); // TODO: Remove this by finding correct terms



function htmlEntities(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notifyInbox(inbox_url, annotation_url) {
    // TODO Write this function
    addToExampleListing(listing_location, annotation_url);
}

function addToExampleListing(listing_url, annotation_url) {
  var source_url = window.location.href.split('#')[0];
  solid.web.get(listing_url).then(function(response) {
    let graph = response.parsedGraph();
    graph.add(rdf.sym(source_url), vocab.example('hasAnnotation'), rdf.sym(annotation_url));
    var data = new rdf.Serializer(graph).toN3(graph);
    // put
    solid.web.put(listing_url, data).then(function(meta) {
        var url = meta.url;
        console.log("Annotations were saved at " + url);
    }).catch(function(err) {
        console.log(err);
    });
  }).catch(function(err) {
    var graph = rdf.graph();
    graph.add(rdf.sym(source_url), vocab.example('hasAnnotation'), rdf.sym(annotation_url));
    var data = new rdf.Serializer(graph).toN3(graph);
    // post
    solid.web.post(listing_location, data, slug).then(function(meta) {
        var url = meta.url;
        console.log("Annotations were saved at " + url);
    }).catch(function(err) {
        console.log(err);
    });
  });
}

function applyHighlight(prefix, exact, suffix, classApplier) {
  var selectorIndex = document.body.textContent.indexOf(prefix + exact + suffix);
  // console.log(document.body.textContent);
  console.log("selectorIndex: " + selectorIndex);
  if (selectorIndex >= 0) {
    var exactStart = selectorIndex + prefix.length
    var exactEnd = selectorIndex + prefix.length + exact.length;
    var selection = { start: exactStart, end: exactEnd };
    console.log("selection: ");
    console.log(selection);
    var rangyRange = util.createRangyRange(selection, document.body, document);
    classApplier.applyRange(rangyRange); // TODO: use toggleRange if you want option to hide markings.
  }
}


// Following button highlights text and sends it to the users save location LDP server
var HighlighterButton = MediumEditor.extensions.button.extend({
  name: 'highlighter',

  tagNames: ['mark'], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
  contentDefault: '<b>Highlight</b>', // default innerHTML of the button
  contentFA: '<i class="fa fa-paint-brush"></i>', // innerHTML of button when 'fontawesome' is being used
  aria: 'Highlight', // used as both aria-label and title attributes
  action: 'highlight', // used as the data-action attribute of the button

  init: function () {
    MediumEditor.extensions.button.prototype.init.call(this);

    this.classApplier = rangyClassApplier.createClassApplier('highlight', {
      elementTagName: 'mark',
      normalize: true
    });
  },

  handleClick: function (event) {
    this.base.restoreSelection();
    var range = MediumEditor.selection.getSelectionRange(this.document);
    var selectedParentElement = this.base.getSelectedParentElement();
    console.log('getSelectedParentElement:');
    console.log(selectedParentElement);

    // Determine selection and context
    this.base.selectedDocument = this.document;
    this.base.selection = MediumEditor.selection.getSelectionHtml(this.base.selectedDocument);

    var exact = this.base.selection;
    var selectionState = MediumEditor.selection.exportSelection(selectedParentElement, this.document);
    var start = selectionState.start;
    var end = selectionState.end;
    var prefixStart = Math.max(0, start - contextLength);
    var prefix = selectedParentElement.textContent.substr(prefixStart, start - prefixStart);
    prefix = htmlEntities(prefix);

    var suffixEnd = Math.min(selectedParentElement.textContent.length, end + contextLength);
    console.log('sE ' + suffixEnd);
    var suffix = selectedParentElement.textContent.substr(end, suffixEnd - end);
    console.log('-' + suffix + '-');
    suffix = htmlEntities(suffix);


    // Create triples with solid
    var annotation = {
      source: rdf.sym(window.location.href.split('#')[0]),
      target: rdf.sym(window.location.href ),
      author: rdf.sym('https://lukasvanhoucke.databox.me/profile/card#me'),
      title: rdf.lit("Lukas Vanhoucke created an annotation", 'en'),
      date: rdf.lit(new Date().toUTCString()),
      exact: rdf.lit(exact, 'en'), // TODO: Language is not important here? Or is it 'required' for good RDF
      prefix: rdf.lit(prefix, 'en'),
      suffix: rdf.lit(suffix, 'en')
      //comment_text: rdf.lit('Comment text goes here', 'en')
    }
    // var save_location = 'https://lukasvanhoucke.databox.me/Public/Annotations';
    var slug = uuidv1();

    var thisResource = rdf.sym(save_location + '/' + slug); // saves url as NamedNode
    var selector = rdf.sym(thisResource.uri + '#fragment-selector'); // TODO: Is there a more natural way of creating hash URIs
    var text_quote_selector = rdf.sym(thisResource.uri + '#text-quote-selector');

    var graph = rdf.graph(); // create an empty graph

    // Uses WebAnnotations recommended ontologies
    graph.add(thisResource, vocab.rdf('type'), vocab.oa('Annotation'));
    graph.add(thisResource, vocab.oa('hasTarget'), annotation.target);
    graph.add(thisResource, vocab.dct('creator'), annotation.author);
    graph.add(thisResource, vocab.dct('created'), annotation.date);
    graph.add(thisResource, vocab.rdfs('label'), annotation.title);
    graph.add(thisResource, vocab.oa('motivatedBy'), vocab.oa('commenting')); //https://www.w3.org/TR/annotation-vocab/#named-individuals

    graph.add(annotation.target, vocab.rdf('type'), vocab.oa('SpecificResource'));
    graph.add(annotation.target, vocab.oa('hasSelector'), selector);
    graph.add(annotation.target, vocab.oa('hasSource'), annotation.source);

    graph.add(selector, vocab.rdf('type'), vocab.oa('FragmentSelector'));
    graph.add(selector, vocab.oa('refinedBy'), text_quote_selector);

    graph.add(text_quote_selector, vocab.rdf('type'), vocab.oa('TextQuoteSelector'));
    graph.add(text_quote_selector, vocab.oa('exact'), annotation.exact);
    graph.add(text_quote_selector, vocab.oa('prefix'), annotation.prefix);
    graph.add(text_quote_selector, vocab.oa('suffix'), annotation.suffix);

    var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization
    solid.web.post(save_location, data, slug).then(function(meta) {
        var url = meta.url;
        console.log("Comment was saved at " + url);
        // TODO: POST notification to inbox of webpage (ldp:inbox in RDFa)
        notifyInbox(inbox_location, url);
    }).catch(function(err) {
        // do something with the error
        console.log(err);
    });


    this.classApplier.toggleSelection(); // toggle highlight
    this.base.checkContentChanged();

  }
});


var LoadHighlightsButton = MediumEditor.extensions.button.extend({
  name: 'loader',

  tagNames: ['load'], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
  contentDefault: '<b>Load</b>', // default innerHTML of the button
  contentFA: '<i class="fa fa-download"></i>', // innerHTML of button when 'fontawesome' is being used
  aria: 'load', // used as both aria-label and title attributes
  action: 'load', // used as the data-action attribute of the button

  init: function () {
    MediumEditor.extensions.button.prototype.init.call(this);
    this.classApplier = rangyClassApplier.createClassApplier('highlight', {
      elementTagName: 'mark',
      normalize: true
    });
  },

  handleClick: function (event) {
    var classApplier = this.classApplier;
    solid.web.get(listing_location).then(function(response) {
        graph = response.parsedGraph();  // graph is part of rdflib, see link at top of page.

        current_url = window.location.href.split('#')[0];
        graph.each(rdf.sym(current_url), vocab.example('hasAnnotation'), undefined).forEach(function(annotation_url) { // TODO: Change predicate
            console.log("Found matching annotation: " + annotation_url.value);
            // Do something with annotation
            // e.g. collect prefix, exact and suffix
            solid.web.get(annotation_url.value).then(function(response) {
                let annotation_graph = response.parsedGraph();
                let motivation = annotation_graph.any(annotation_url, vocab.oa('hasTarget'), undefined);
                let selector = annotation_graph.any(motivation, vocab.oa('hasSelector'), undefined);
                let text_quote = annotation_graph.any(selector, vocab.oa('refinedBy'), undefined);

                let prefix = annotation_graph.any(text_quote, vocab.oa('prefix'), undefined);
                let exact = annotation_graph.any(text_quote, vocab.oa('exact'), undefined);
                let suffix = annotation_graph.any(text_quote, vocab.oa('suffix'), undefined);

                console.log(prefix.value + '] ' + exact.value + ' [' + suffix.value);
                applyHighlight(prefix.value, exact.value, suffix.value, classApplier)
            }).catch(function(err) {
                // do something with the error
                console.log("Received error: " + err.stack);
            });
        });
    })
    .catch(function(err) {
        // do something with the error
        console.log("Received error: " + err);
    });

    this.base.checkContentChanged();

  }
});


var editor = new MediumEditor(document.querySelectorAll(selector), {
  // TODO: Editor is not centered because of the way Open Webslides is programmed
  // (Try zooming in and out, slide stays same size, but position of editor changes)
  // Displaying slides on chrome with console (Ctrl+Shift+i) is correct.
  buttonLabels: 'fontawesome',
  disableEditing: true,
  spellcheck: false,
  anchorPreview: false,
  extensions: {
    'highlighter': new HighlighterButton(),
    'loader': new LoadHighlightsButton()
  },
  toolbar: {
      buttons: ['highlighter', 'loader'],
      allowMultiParagraphSelection: false
  }
});

window.editor = editor;
