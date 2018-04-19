/******************************IMPORTS ******************************/
// Libraries
const solid = require('solid-client');
const rdf = require('rdflib');
const ns = require('rdf-ns')(rdf);
const MediumEditor = require('medium-editor');
const rangy = require('rangy');
const rangyClassApplier = require('rangy/lib/rangy-classapplier');
const uuidv1 = require('uuid/v1');
const request = require('superagent');
// Modules
const util = require('./util.js');
/********************************************************************/

css_files = ["https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", // font awesome
             "//cdn.jsdelivr.net/npm/medium-editor@latest/dist/css/medium-editor.min.css", // core medium editor CSS
             "https://www.dropbox.com/s/102ds8wnn9kscqm/flat-theme.css?raw=1", // medium theme CSS (can be swapped)
             "https://www.dropbox.com/s/azniofmg3t0ai9o/annotations.css?raw=1"] // Custom CSS for annotation plugin (e.g. for button to load all annotations)

/** Config **/
var selector = '.slide';
var contextLength = 32; // Based on dokieli; The number of characters (at most) to add for context
let listing_location_prefix = 'https://vanhoucke.me/sparql-2/annotations/website?url='
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
      title: comment_value // TODO:Temporary, also XSS possible? I dont think so.
                  // XSS"><script>alert("XSS ALERT");</script><comment value="
    }
  });
  return classApplier;
}

highlightClassApplier = rangyClassApplier.createClassApplier('highlight', {
  elementTagName: 'highlight', // Was originally mark, but intervened with UGent Shower CSS
  normalize: true,
  elementProperties: {
    style: {
      'background-color': 'yellow'
    }
  }
});

// Function is used in handleSaveClick and handleClick for highlights and comments that need to be stored on the SPARQL server
function saveAnnotation(self, isComment) {
  if (isComment) self.base.restoreSelection();
  var range = MediumEditor.selection.getSelectionRange(self.document);
  var selectedParentElement = self.base.getSelectedParentElement();

  // Determine selection and context
  self.base.selectedDocument = self.document;
  self.base.selection = MediumEditor.selection.getSelectionHtml(self.base.selectedDocument);

  var exact = self.base.selection;
  var selectionState = MediumEditor.selection.exportSelection(selectedParentElement, self.document);
  var start = selectionState.start;
  var end = selectionState.end;
  var prefixStart = Math.max(0, start - contextLength);
  var prefix = selectedParentElement.textContent.substr(prefixStart, start - prefixStart);
  prefix = htmlEntities(prefix);
  // prefix = prefix.trim();

  var suffixEnd = Math.min(selectedParentElement.textContent.length, end + contextLength);
  var suffix = selectedParentElement.textContent.substr(end, suffixEnd - end);
  suffix = htmlEntities(suffix);
  // suffix = suffix.trim();



  // assume annotation service is following endpoint (TODO: Change so user can choose endpoint)
  let annotationService = 'https://vanhoucke.me/sparql-2';

  // Listing here only includes one link, so will simplify the program for now
  // (real-life implementations need to collect a list which contains these links)
  // (not used for now)
  let listing_location = 'https://vanhoucke.me/sparql-2/annotations/website?url=http://www.example.org/blog/1.html'

  // information to be collected from GUI
  let title = "Lukas Vanhoucke created an annotation.";
  let creator = "https://lukas.vanhoucke.me/profile/card#me";
  let source = window.location.href.split('#')[0];


  let annotation = {
    creator: creator,
    title: title,
    source: source,
    exact: exact,
    prefix: prefix,
    suffix: suffix
  }

  if (isComment) annotation.body = self.getInput().value.trim();

  request.post(annotationService)
    .send(annotation)
    .then(function(res) {

      var url = JSON.parse(res.text).url;
      console.log("Annotation was saved at " + url);

      // TODO: POST notification to inbox of webpage (ldp:inbox in RDFa)
      // This step is skipped for now. In future, it should announce the endpoint to collect annotations to the inbox.
      // notifyInbox(inbox_location, url);

      let classApplier = isComment ? getCommentClassApplier(self.getInput().value.trim())
      : highlightClassApplier;
      classApplier.toggleSelection(); // toggle highlight

    }).catch(function(err) {
      // do something with the error
      console.log(err);
    });

  self.base.checkContentChanged();
  if (isComment) self.doFormSave();

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
  },

  handleClick: function (event) {
    var self = this;
    saveAnnotation(self, false);
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
            this.subscribe('editableKeydown', this.handleKeydown.bind(this));
        },

        // Called when the button the toolbar is clicked
        // Overrides ButtonExtension.handleClick
        handleClick: function (event) {
            event.preventDefault();
            event.stopPropagation();

            this.base.checkContentChanged();
            this.showForm();
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
            var self = this;
            saveAnnotation(self, true);
        },

        handleCloseClick: function (event) {
            // Click Close -> close the form
            event.preventDefault();
            this.doFormCancel();
        }
});

window.editor = new MediumEditor(document.querySelectorAll(selector), {
  // TODO: Editor is not centered because of the way Open Webslides is programmed
  // (Try zooming in and out, slide stays same size, but position of editor changes)
  // Displaying slides on chrome with console (Ctrl+Shift+i) is correct.
  buttonLabels: 'fontawesome',
  disableEditing: true,
  spellcheck: false,
  anchorPreview: false,
  extensions: {
    'highlighter': new HighlighterButton(),
    'comment': new CommentButton(),
  },
  toolbar: {
      buttons: ['highlighter', 'comment'],
      allowMultiParagraphSelection: false
  }
});

var loadIcon = '<i class="fa fa-download"></i>';
var floatingLoadButton = document.createElement("button");
floatingLoadButton.innerHTML = loadIcon;
floatingLoadButton.id = 'floatingButton'
document.body.appendChild(floatingLoadButton);
floatingLoadButton.onmouseover = function() {
  floatingLoadButton.innerHTML = 'Load annotations';
}
floatingLoadButton.onmouseout = function() {
  floatingLoadButton.innerHTML = loadIcon;
}
floatingLoadButton.onclick = function() {
  let endpoint = listing_location_prefix + window.location.href.split('#')[0];
  request.get(endpoint)
    .then(function(res) {
      var body = JSON.parse(res.text);
      body.results.bindings.forEach(function(binding) {
        console.log(binding.date.value);

        let prefix = binding.prefix.value;
        let exact = binding.exact.value;
        let suffix = binding.suffix.value;
        console.log('prefix: ' + prefix);
        console.log('exact: ' + exact);
        console.log('suffix: ' + suffix);

        if (binding.text) {
          // comment
          let comment_value = binding.text.value;
          let classApplier = getCommentClassApplier(comment_value);
          applyHighlight(prefix, exact, suffix, classApplier);
        } else {
          // highlight
          applyHighlight(prefix, exact, suffix, highlightClassApplier);
        }
      });
    }).catch(function(err) {
      // do something with the error
      console.log(err);
    });
}
