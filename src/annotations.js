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
    classApplier.applyToRange(rangyRange); // TODO: use toggleRange if you want option to hide markings.
  }
}

function getCommentClassApplier(comment_value) {
  let classApplier = rangyClassApplier.createClassApplier('comment', {
    elementTagName: 'comment', // Was originally mark, but intervened with UGent Shower CSS
    normalize: true,
    elementProperties: {
      style: {
        'background-color': 'orange'
      }
    },
    elementAttributes: {
      value: comment_value // TODO:Temporary, also XSS possible? I dont think so.
                  // XSS"><script>alert("XSS ALERT");</script><comment value="
    }
  });
  return classApplier;
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
      elementTagName: 'highlight', // Was originally mark, but intervened with UGent Shower CSS
      normalize: true,
      elementProperties: {
        style: {
          'background-color': 'yellow'
        }
      }
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
    graph.add(thisResource, vocab.oa('motivatedBy'), vocab.oa('tagging')); //https://www.w3.org/TR/annotation-vocab/#named-individuals

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
  aria: 'Load', // used as both aria-label and title attributes
  action: 'load', // used as the data-action attribute of the button

  init: function () {
    MediumEditor.extensions.button.prototype.init.call(this);
    this.highlightClassApplier = rangyClassApplier.createClassApplier('highlight', {
      elementTagName: 'highlight', // Was originally mark, but intervened with UGent Shower CSS
      normalize: true,
      elementProperties: {
        style: {
          'background-color': 'yellow'
        }
      }
    });
  },

  handleClick: function (event) {
    var self = this;
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
                if (annotation_graph.any(annotation_url, vocab.oa('hasBody'), undefined)) {
                    let body = annotation_graph.any(annotation_url, vocab.oa('hasBody'), undefined);
                    let comment_value = annotation_graph.any(body, vocab.rdf('value'), undefined);

                    let classApplier = getCommentClassApplier(comment_value);
                    applyHighlight(prefix.value, exact.value, suffix.value, classApplier);
                } else {
                    applyHighlight(prefix.value, exact.value, suffix.value, self.highlightClassApplier);
                }
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

var CommentButton = MediumEditor.extensions.form.extend({
        //Form options
        placeholderText: 'Insert text here',
        formSaveLabel: '<b>Save</b>',
        formCloseLabel: '<b>Close</b>',

        // Options for the Button base class
        name: 'comment',
        tagNames: ['comment'], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
        contentDefault: '<b>Comment</b>', // default innerHTML of the button
        contentFA: '<i class="fa fa-comment-o"></i>', // innerHTML of button when 'fontawesome' is being used
        aria: 'Comment', // used as both aria-label and title attributes
        action: 'comment', // used as the data-action attribute of the button

        init: function () {
            MediumEditor.extensions.form.prototype.init.apply(this, arguments);
            this.classApplier = rangyClassApplier.createClassApplier('comment', {
              elementTagName: 'comment', // Was originally mark, but intervened with UGent Shower CSS
              normalize: true,
              elementProperties: {
                style: {
                  'background-color': 'orange'
                }
              }
            });
            this.subscribe('editableKeydown', this.handleKeydown.bind(this));
        },

        // Called when the button the toolbar is clicked
        // Overrides ButtonExtension.handleClick
        handleClick: function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (!this.classApplier.isAppliedToSelection()) {
              this.base.checkContentChanged();
              this.showForm();
            } else console.log("Text is already highlighted.");
            return false;
        },

        // Called when user hits the defined shortcut (CTRL / COMMAND + K)
        handleKeydown: function (event) {
            if (MediumEditor.util.isKey(event, MediumEditor.util.keyCode.K) && MediumEditor.util.isMetaCtrlKey(event) && !event.shiftKey) {
                this.handleClick(event);
            }
        },

        // Called by medium-editor to append form to the toolbar
        getForm: function () {
            if (!this.form) {
                this.form = this.createForm();
            }
            return this.form;
        },

        getTemplate: function () {
            var template = [
                '<input type="text" class="medium-editor-toolbar-input" placeholder="', this.placeholderText, '">'
            ];

            template.push(
                '<a href="#" class="medium-editor-toolbar-save">',
                this.getEditorOption('buttonLabels') === 'fontawesome' ? '<i class="fa fa-check"></i>' : this.formSaveLabel,
                '</a>'
            );

            template.push('<a href="#" class="medium-editor-toolbar-close">',
                this.getEditorOption('buttonLabels') === 'fontawesome' ? '<i class="fa fa-times"></i>' : this.formCloseLabel,
                '</a>');

            return template.join('');

        },

        // Used by medium-editor when the default toolbar is to be displayed
        isDisplayed: function () {
            return MediumEditor.extensions.form.prototype.isDisplayed.apply(this);
        },

        hideForm: function () {
            MediumEditor.extensions.form.prototype.hideForm.apply(this);
            this.getInput().value = '';
        },

        showForm: function (opts) {
            var input = this.getInput();

            opts = opts || { value: '' };
            // TODO: This is for backwards compatability
            // We don't need to support the 'string' argument in 6.0.0
            if (typeof opts === 'string') {
                opts = {
                    value: opts
                };
            }

            this.base.saveSelection();
            this.hideToolbarDefaultActions();
            MediumEditor.extensions.form.prototype.showForm.apply(this);
            this.setToolbarPosition();

            input.value = opts.value;
            input.focus();
        },

        // Called by core when tearing down medium-editor (destroy)
        destroy: function () {
            if (!this.form) {
                return false;
            }

            if (this.form.parentNode) {
                this.form.parentNode.removeChild(this.form);
            }

            delete this.form;
        },

        // core methods

        getFormOpts: function () {
            var opts = {
                    value: this.getInput().value.trim()
                };


            return opts;
        },

        doFormSave: function () {
            var opts = this.getFormOpts();
            this.completeFormSave(opts);
        },

        completeFormSave: function (opts) {
            this.base.restoreSelection();
            this.execAction(this.action, opts);
            this.base.checkSelection();
        },

        doFormCancel: function () {
            this.base.restoreSelection();
            this.base.checkSelection();
        },

        // form creation and event handling
        attachFormEvents: function (form) {
            var close = form.querySelector('.medium-editor-toolbar-close'),
                save = form.querySelector('.medium-editor-toolbar-save'),
                input = form.querySelector('.medium-editor-toolbar-input');

            // Handle clicks on the form itself
            this.on(form, 'click', this.handleFormClick.bind(this));

            // Handle typing in the textbox
            this.on(input, 'keyup', this.handleTextboxKeyup.bind(this));

            // Handle close button clicks
            this.on(close, 'click', this.handleCloseClick.bind(this));

            // Handle save button clicks (capture)
            this.on(save, 'click', this.handleSaveClick.bind(this), true);

        },

        createForm: function () {
            var doc = this.document,
                form = doc.createElement('div');

            // Anchor Form (div)
            form.className = 'medium-editor-toolbar-form';
            form.id = 'medium-editor-toolbar-form-anchor-' + this.getEditorId();
            form.innerHTML = this.getTemplate();
            this.attachFormEvents(form);

            return form;
        },

        getInput: function () {
            return this.getForm().querySelector('input.medium-editor-toolbar-input');
        },

        handleTextboxKeyup: function (event) {
            // For ENTER -> create the anchor
            if (event.keyCode === MediumEditor.util.keyCode.ENTER) {
                event.preventDefault();
                this.doFormSave();
                return;
            }

            // For ESCAPE -> close the form
            if (event.keyCode === MediumEditor.util.keyCode.ESCAPE) {
                event.preventDefault();
                this.doFormCancel();
            }
        },

        handleFormClick: function (event) {
            // make sure not to hide form when clicking inside the form
            event.stopPropagation();
        },

        handleSaveClick: function (event) {
            // Clicking Save -> create the anchor
            event.preventDefault();

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
              suffix: rdf.lit(suffix, 'en'),
              comment_text: rdf.lit(this.getInput().value.trim(), 'en')
            };

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

            var body = rdf.sym(thisResource.uri + '#body'); // TODO: Extend for multiple bodies
            graph.add(thisResource, vocab.oa('hasBody'), body);
            graph.add(body, vocab.rdf('type'), vocab.oa('TextualBody'));
            graph.add(body, vocab.rdf('value'), annotation.comment_text);

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

            let classApplier = getCommentClassApplier(this.getInput().value.trim());

            classApplier.toggleSelection(); // toggle highlight
            this.base.checkContentChanged();

            this.doFormSave();
        },

        handleCloseClick: function (event) {
            // Click Close -> close the form
            event.preventDefault();
            this.doFormCancel();
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
    'loader': new LoadHighlightsButton(),
    'comment': new CommentButton()
  },
  toolbar: {
      buttons: ['highlighter', 'loader', 'comment'],
      allowMultiParagraphSelection: false
  }
});

window.editor = editor;
