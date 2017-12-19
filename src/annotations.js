var solid = require('solid-client'); // or require('solid') ?
var rdflib = require('rdflib');
var ns = require('rdf-ns')()
var MediumEditor = require('medium-editor');
var rangy = require('rangy');
var rangyClassApplier = require('rangy/lib/rangy-classapplier');

css_files = ["https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", // font awesome
             "//cdn.jsdelivr.net/npm/medium-editor@latest/dist/css/medium-editor.min.css", // core medium editor CSS
             "https://www.dropbox.com/s/102ds8wnn9kscqm/flat-theme.css?raw=1"] // medium theme CSS (can be swapped)

/** Config **/
var selector = '.slide';
var contextLength = 32; // Based on dokieli; The number of characters (at most) to add for context
var save_location = 'https://lukasvanhoucke.databox.me/Public/comments/';
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


function htmlEntities(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    this.classApplier.toggleSelection();



    this.base.restoreSelection();
    var range = MediumEditor.selection.getSelectionRange(this.document);
    var selectedParentElement = this.base.getSelectedParentElement();
    console.log('getSelectedParentElement:');
    console.log(selectedParentElement);

    // Determine selection and context
    this.base.selectedDocument = this.document;
    this.base.selection = MediumEditor.selection.getSelectionHtml(this.base.selectedDocument);
    console.log('this.base.selection:');
    console.log(this.base.selection);

    var exact = this.base.selection;
    var selectionState = MediumEditor.selection.exportSelection(selectedParentElement, this.document);
    var start = selectionState.start;
    var end = selectionState.end;
    var prefixStart = Math.max(0, start - contextLength);
    console.log('pS ' + prefixStart);
    var prefix = selectedParentElement.textContent.substr(prefixStart, start - prefixStart);
    console.log('-' + prefix + '-');
    prefix = htmlEntities(prefix);

    var suffixEnd = Math.min(selectedParentElement.textContent.length, end + contextLength);
    console.log('sE ' + suffixEnd);
    var suffix = selectedParentElement.textContent.substr(end, suffixEnd - end);
    console.log('-' + suffix + '-');
    suffix = htmlEntities(suffix);



    // Create triples with solid
    // var graph = $rdf.graph();
    // var thisResource = $rdf.sym('');
    // graph.add(thisResource, vocab.dct('title'), $rdf.lit(request.title));
    // graph.add(thisResource, vocab.sioc('content'), $rdf.lit(request.value));
    // graph.add(thisResource, vocab.sioc('about'), $rdf.lit(request.url)); // THIS IS THE WRONG TERM, but which one is the right one?
    // var data = new $rdf.Serializer(graph).toN3(graph);







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
    'highlighter': new HighlighterButton()
  },
  toolbar: {
      buttons: ['highlighter'],
      allowMultiParagraphSelection: false
  }
});
