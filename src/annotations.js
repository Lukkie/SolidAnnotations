/******************************IMPORTS ******************************/
// Libraries
const solid = require("solid-client");
const rdf = require("rdflib");
const ns = require("rdf-ns")(rdf);
const MediumEditor = require("medium-editor");
const rangy = require("rangy");
const rangyClassApplier = require("rangy/lib/rangy-classapplier");
const uuidv1 = require("uuid/v1");
// Modules
const util = require("./util.js");
/********************************************************************/

css_files = [
  "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", // font awesome
  "//cdn.jsdelivr.net/npm/medium-editor@latest/dist/css/medium-editor.min.css", // core medium editor CSS
  "https://vanhoucke.me/annotationscripts/assets/themes/flat-theme.css", // medium theme CSS (can be swapped)
  "https://vanhoucke.me/annotationscripts/assets/annotations.css"
]; // Custom CSS for annotation plugin (e.g. for button to load all annotations)

/** Config **/
var selector = ".slide";
var contextLength = 32; // Based on dokieli; The number of characters (at most) to add for context
var save_location = "https://lukas.vanhoucke.me/public/annotations"; // Temporary, use webIDs annotationService for this.
var inbox_location = "https://lukas.vanhoucke.me/inbox"; // Temporary -- ldp:inbox
var listing_location = "https://lukas.vanhoucke.me/public/listing.ttl"; // Temporary -- Location where annotation URLs are stored (server's annotationService)
/**/

var d = document;
function loadCSS(url) {
  var s = d.createElement("link");
  s.href = url;
  s.media = "all";
  s.type = "text/css";
  s.rel = "stylesheet";
  s.charset = "utf-8";
  d.head.appendChild(s);
}
css_files.forEach(function(url) {
  loadCSS(url);
});

rangy.init();
var vocab = solid.vocab;
vocab.oa = ns.base("http://www.w3.org/ns/oa#");
vocab.as = ns.base("http://www.w3.org/ns/activitystreams#");

function htmlEntities(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function notifyInbox(inbox, annotation_url, source) {
  // Place a Linked Data Notification in the server's inbox.
  let notificationGraph = rdf.graph();
  notificationGraph.add(source, vocab.as("Announce"), annotation_url);
  let notificationData = new rdf.Serializer(notificationGraph).toN3(
    notificationGraph
  );
  solid.web.post(inbox, notificationData).then(function(meta) {
    console.log("Notification sent.");
  });

  // addToExampleListing(listing_location, annotation_url); // Alternative
}

function login() {
  return solid
    .login() // the browser automatically provides the client key/cert for you
    .then(webId => {
      if (!webId)
        return Promise.reject(
          new Error(
            "Login failed. Make sure you have a valid WebID and certificate."
          )
        );
      console.log("Current WebID: %s", webId);

      // Load extended profile? At the moment: No -- Solid cannot parse text -> leads to issues
      let options = { ignoreExtended: true };
      return solid.getProfile(webId, options);
    });
}

function addToExampleListing(listing_url, annotation_url) {
  // TODO: The server should actually run this function upon receiving a notification
  // Since this plugin does not have access to the server, this workaround is used.
  var source_url = window.location.href.split("#")[0];
  solid.web
    .get(listing_url)
    .then(function(response) {
      let graph = response.parsedGraph();
      graph.add(
        rdf.sym(source_url),
        vocab.as("items"),
        rdf.sym(annotation_url)
      );
      var data = new rdf.Serializer(graph).toN3(graph);
      // put
      solid.web
        .put(listing_url, data)
        .then(function(meta) {
          var url = meta.url;
          console.log("Annotations were saved at " + url);
        })
        .catch(function(err) {
          console.log(err);
        });
    })
    .catch(function(err) {
      var graph = rdf.graph();
      graph.add(
        rdf.sym(source_url),
        vocab.as("items"),
        rdf.sym(annotation_url)
      );
      var data = new rdf.Serializer(graph).toN3(graph);
      // post
      let location = listing_location
        .split("/")
        .slice(0, -1)
        .join("/");
      solid.web
        .post(location, data, "listing")
        .then(function(meta) {
          var url = meta.url;
          console.log("Annotations were saved at " + url);
        })
        .catch(function(err) {
          console.log(err);
        });
    });
}

function applyHighlight(prefix, exact, suffix, classApplier) {
  var selectorIndex = document.body.textContent.indexOf(
    prefix + exact + suffix
  );
  // console.log(document.body.textContent);
  console.log("selectorIndex: " + selectorIndex);
  if (selectorIndex >= 0) {
    var exactStart = selectorIndex + prefix.length;
    var exactEnd = selectorIndex + prefix.length + exact.length;
    var selection = { start: exactStart, end: exactEnd };
    console.log("selection: ");
    console.log(selection);
    var rangyRange = util.createRangyRange(selection, document.body, document);
    classApplier.applyToRange(rangyRange); // TODO: use toggleRange if you want option to hide markings.
  }
}

function getCommentClassApplier(comment_value) {
  let classApplier = rangyClassApplier.createClassApplier("comment", {
    elementTagName: "comment", // Was originally mark, but intervened with UGent Shower CSS
    normalize: true,
    elementProperties: {
      style: {
        "background-color": "orange"
      }
    },
    elementAttributes: {
      title: comment_value
    }
  });
  return classApplier;
}

highlightClassApplier = rangyClassApplier.createClassApplier("highlight", {
  elementTagName: "highlight", // Was originally mark, but intervened with UGent Shower CSS
  normalize: true,
  elementProperties: {
    style: {
      "background-color": "yellow"
    }
  }
});

// Function is used in handleSaveClick and handleClick for highlights and comments
function saveAnnotation(self, isComment) {
  if (isComment) self.base.restoreSelection();
  var range = MediumEditor.selection.getSelectionRange(self.document);
  var selectedParentElement = self.base.getSelectedParentElement();
  console.log("getSelectedParentElement:");
  console.log(selectedParentElement);

  // Determine selection and context
  self.base.selectedDocument = self.document;
  self.base.selection = MediumEditor.selection.getSelectionHtml(
    self.base.selectedDocument
  );

  var exact = self.base.selection;
  var selectionState = MediumEditor.selection.exportSelection(
    selectedParentElement,
    self.document
  );
  var start = selectionState.start;
  var end = selectionState.end;
  var prefixStart = Math.max(0, start - contextLength);
  var prefix = selectedParentElement.textContent.substr(
    prefixStart,
    start - prefixStart
  );
  prefix = htmlEntities(prefix);
  // prefix = prefix.trimLeft();

  var suffixEnd = Math.min(
    selectedParentElement.textContent.length,
    end + contextLength
  );
  console.log("sE " + suffixEnd);
  var suffix = selectedParentElement.textContent.substr(end, suffixEnd - end);
  console.log("-" + suffix + "-");
  suffix = htmlEntities(suffix);
  // suffix = suffix.trimRight();

  login().then(function(profile) {
    console.log("User logged in: " + profile.name);
    let annotationService = profile.find(vocab.oa("annotationService"));
    save_location = annotationService || save_location;
    // Determine listing location -- Note: In reality, this is the server's annotationService!
    listing_location = profile.storage
      ? profile.storage + "/listing.ttl"
      : listing_location;

    // Create triples with solid
    var annotation = {
      source: rdf.sym(window.location.href.split("#")[0]),
      author: rdf.sym(profile.webId),
      title: rdf.lit(
        (profile.name || "Unknown user") + " created an annotation",
        "en"
      ),
      date: rdf.lit(new Date().toUTCString()),
      exact: rdf.lit(exact, "en"), // Not strictly english though
      prefix: rdf.lit(prefix, "en"),
      suffix: rdf.lit(suffix, "en")
    };
    if (isComment)
      annotation.comment_text = rdf.lit(self.getInput().value.trim(), "en");

    var slug = uuidv1();

    var thisResource = rdf.sym(save_location + "/" + slug + ".ttl"); // saves url as NamedNode
    var selector = rdf.sym(thisResource.uri + "#fragment-selector"); // TODO: Is there a more natural way of creating hash URIs
    var text_quote_selector = rdf.sym(
      thisResource.uri + "#text-quote-selector"
    );
    var target = rdf.sym(thisResource.uri + "#target");

    var graph = rdf.graph(); // create an empty graph

    // Uses WebAnnotations recommended ontologies
    graph.add(thisResource, vocab.rdf("type"), vocab.oa("Annotation"));
    graph.add(thisResource, vocab.dct("creator"), annotation.author);
    graph.add(thisResource, vocab.dct("created"), annotation.date);
    graph.add(thisResource, vocab.rdfs("label"), annotation.title);
    graph.add(
      thisResource,
      vocab.oa("motivatedBy"),
      isComment ? vocab.oa("commenting") : vocab.oa("tagging")
    ); //https://www.w3.org/TR/annotation-vocab/#named-individuals

    graph.add(thisResource, vocab.oa("hasTarget"), target);
    graph.add(target, vocab.rdf("type"), vocab.oa("SpecificResource"));
    graph.add(target, vocab.oa("hasSelector"), selector);
    graph.add(target, vocab.oa("hasSource"), annotation.source);

    graph.add(selector, vocab.rdf("type"), vocab.oa("FragmentSelector"));
    graph.add(selector, vocab.oa("refinedBy"), text_quote_selector);

    graph.add(
      text_quote_selector,
      vocab.rdf("type"),
      vocab.oa("TextQuoteSelector")
    );
    graph.add(text_quote_selector, vocab.oa("exact"), annotation.exact);
    graph.add(text_quote_selector, vocab.oa("prefix"), annotation.prefix);
    graph.add(text_quote_selector, vocab.oa("suffix"), annotation.suffix);

    if (isComment) {
      var body = rdf.sym(thisResource.uri + "#body"); // TODO: Extend for multiple bodies
      graph.add(thisResource, vocab.oa("hasBody"), body);
      graph.add(body, vocab.rdf("type"), vocab.oa("TextualBody"));
      graph.add(body, vocab.rdf("value"), annotation.comment_text);
    }

    var data = new rdf.Serializer(graph).toN3(graph); // create Notation3 serialization
    solid.web
      .post(save_location, data, slug)
      .then(function(meta) {
        var url = meta.url;
        console.log("Annotation was saved at " + url);

        // POST notification to inbox of webpage (ldp:inbox in RDFa)
        notifyInbox(inbox_location, rdf.sym(url), annotation.source);

        let classApplier = isComment
          ? getCommentClassApplier(self.getInput().value.trim())
          : highlightClassApplier;
        classApplier.toggleSelection(); // toggle highlight
      })
      .catch(function(err) {
        // do something with the error
        console.log(err);
      });

    self.base.checkContentChanged();
    if (isComment) self.doFormSave();
  });
}

// Following button highlights text and sends it to the users save location LDP server
var HighlighterButton = MediumEditor.extensions.button.extend({
  name: "highlighter",

  tagNames: ["mark"], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
  contentDefault: "<b>Highlight</b>", // default innerHTML of the button
  contentFA: '<i class="fa fa-paint-brush"></i>', // innerHTML of button when 'fontawesome' is being used
  aria: "Highlight", // used as both aria-label and title attributes
  action: "highlight", // used as the data-action attribute of the button

  init: function() {
    MediumEditor.extensions.button.prototype.init.call(this);
  },

  handleClick: function(event) {
    var self = this;
    saveAnnotation(self, false);
  }
});

var CommentButton = MediumEditor.extensions.form.extend({
  //Form options
  placeholderText: "Insert text here",
  formSaveLabel: "<b>Save</b>",
  formCloseLabel: "<b>Close</b>",

  // Options for the Button base class
  name: "comment",
  tagNames: ["comment"], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
  contentDefault: "<b>Comment</b>", // default innerHTML of the button
  contentFA: '<i class="fa fa-comment-o"></i>', // innerHTML of button when 'fontawesome' is being used
  aria: "Comment", // used as both aria-label and title attributes
  action: "comment", // used as the data-action attribute of the button

  init: function() {
    MediumEditor.extensions.form.prototype.init.apply(this, arguments);
    this.subscribe("editableKeydown", this.handleKeydown.bind(this));
  },

  // Called when the button the toolbar is clicked
  // Overrides ButtonExtension.handleClick
  handleClick: function(event) {
    event.preventDefault();
    event.stopPropagation();

    this.base.checkContentChanged();
    this.showForm();
    return false;
  },

  // Called when user hits the defined shortcut (CTRL / COMMAND + K)
  handleKeydown: function(event) {
    if (
      MediumEditor.util.isKey(event, MediumEditor.util.keyCode.K) &&
      MediumEditor.util.isMetaCtrlKey(event) &&
      !event.shiftKey
    ) {
      this.handleClick(event);
    }
  },

  // Called by medium-editor to append form to the toolbar
  getForm: function() {
    if (!this.form) {
      this.form = this.createForm();
    }
    return this.form;
  },

  getTemplate: function() {
    var template = [
      '<input type="text" class="medium-editor-toolbar-input" placeholder="',
      this.placeholderText,
      '">'
    ];

    template.push(
      '<a href="#" class="medium-editor-toolbar-save">',
      this.getEditorOption("buttonLabels") === "fontawesome"
        ? '<i class="fa fa-check"></i>'
        : this.formSaveLabel,
      "</a>"
    );

    template.push(
      '<a href="#" class="medium-editor-toolbar-close">',
      this.getEditorOption("buttonLabels") === "fontawesome"
        ? '<i class="fa fa-times"></i>'
        : this.formCloseLabel,
      "</a>"
    );

    return template.join("");
  },

  // Used by medium-editor when the default toolbar is to be displayed
  isDisplayed: function() {
    return MediumEditor.extensions.form.prototype.isDisplayed.apply(this);
  },

  hideForm: function() {
    MediumEditor.extensions.form.prototype.hideForm.apply(this);
    this.getInput().value = "";
  },

  showForm: function(opts) {
    var input = this.getInput();

    opts = opts || { value: "" };
    // TODO: This is for backwards compatability
    // We don't need to support the 'string' argument in 6.0.0
    if (typeof opts === "string") {
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
  destroy: function() {
    if (!this.form) {
      return false;
    }

    if (this.form.parentNode) {
      this.form.parentNode.removeChild(this.form);
    }

    delete this.form;
  },

  // core methods

  getFormOpts: function() {
    var opts = {
      value: this.getInput().value.trim()
    };

    return opts;
  },

  doFormSave: function() {
    var opts = this.getFormOpts();
    this.completeFormSave(opts);
  },

  completeFormSave: function(opts) {
    this.base.restoreSelection();
    this.execAction(this.action, opts);
    this.base.checkSelection();
  },

  doFormCancel: function() {
    this.base.restoreSelection();
    this.base.checkSelection();
  },

  // form creation and event handling
  attachFormEvents: function(form) {
    var close = form.querySelector(".medium-editor-toolbar-close"),
      save = form.querySelector(".medium-editor-toolbar-save"),
      input = form.querySelector(".medium-editor-toolbar-input");

    // Handle clicks on the form itself
    this.on(form, "click", this.handleFormClick.bind(this));

    // Handle typing in the textbox
    this.on(input, "keyup", this.handleTextboxKeyup.bind(this));

    // Handle close button clicks
    this.on(close, "click", this.handleCloseClick.bind(this));

    // Handle save button clicks (capture)
    this.on(save, "click", this.handleSaveClick.bind(this), true);
  },

  createForm: function() {
    var doc = this.document,
      form = doc.createElement("div");

    // Anchor Form (div)
    form.className = "medium-editor-toolbar-form";
    form.id = "medium-editor-toolbar-form-anchor-" + this.getEditorId();
    form.innerHTML = this.getTemplate();
    this.attachFormEvents(form);

    return form;
  },

  getInput: function() {
    return this.getForm().querySelector("input.medium-editor-toolbar-input");
  },

  handleTextboxKeyup: function(event) {
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

  handleFormClick: function(event) {
    // make sure not to hide form when clicking inside the form
    event.stopPropagation();
  },

  handleSaveClick: function(event) {
    // Clicking Save -> create the anchor
    event.preventDefault();
    var self = this;
    saveAnnotation(self, true);
  },

  handleCloseClick: function(event) {
    // Click Close -> close the form
    event.preventDefault();
    this.doFormCancel();
  }
});

window.editor = new MediumEditor(document.querySelectorAll(selector), {
  // TODO: Editor is not centered because of the way Open Webslides is programmed
  // (Try zooming in and out, slide stays same size, but position of editor changes)
  // Displaying slides on chrome with console (Ctrl+Shift+i) is sometimes correct.
  buttonLabels: "fontawesome",
  disableEditing: true,
  spellcheck: false,
  anchorPreview: false,
  extensions: {
    highlighter: new HighlighterButton(),
    comment: new CommentButton()
  },
  toolbar: {
    buttons: ["highlighter", "comment"],
    allowMultiParagraphSelection: false
  }
});

var loadIcon = '<i class="fa fa-download"></i>';
var floatingLoadButton = document.createElement("button");
floatingLoadButton.innerHTML = loadIcon;
floatingLoadButton.id = "floatingButton";
document.body.appendChild(floatingLoadButton);
floatingLoadButton.onmouseover = function() {
  floatingLoadButton.innerHTML = "Load annotations";
};
floatingLoadButton.onmouseout = function() {
  floatingLoadButton.innerHTML = loadIcon;
};
floatingLoadButton.onclick = function() {
  login()
    .then(function(profile) {
      // Determine listing location -- Note: In reality, this is the server's annotationService!
      listing_location = profile.storage
        ? profile.storage + "/listing.ttl"
        : listing_location;
      solid.web
        .get(listing_location)
        .then(function(response) {
          graph = response.parsedGraph(); // graph is part of rdflib, see link at top of page.

          current_url = window.location.href.split("#")[0];
          graph
            .each(rdf.sym(current_url), vocab.as("items"), undefined)
            .forEach(function(annotation_url) {
              // TODO: Change predicate
              console.log("Found matching annotation: " + annotation_url.value);
              // Do something with annotation
              // e.g. collect prefix, exact and suffix
              solid.web
                .get(annotation_url.value)
                .then(function(response) {
                  let annotation_graph = response.parsedGraph();
                  let motivation = annotation_graph.any(
                    annotation_url,
                    vocab.oa("hasTarget"),
                    undefined
                  );
                  let selector = annotation_graph.any(
                    motivation,
                    vocab.oa("hasSelector"),
                    undefined
                  );
                  let text_quote = annotation_graph.any(
                    selector,
                    vocab.oa("refinedBy"),
                    undefined
                  );

                  let prefix = annotation_graph.any(
                    text_quote,
                    vocab.oa("prefix"),
                    undefined
                  ).value;
                  let exact = annotation_graph.any(
                    text_quote,
                    vocab.oa("exact"),
                    undefined
                  ).value;
                  let suffix = annotation_graph.any(
                    text_quote,
                    vocab.oa("suffix"),
                    undefined
                  ).value;
                  console.log("prefix: " + prefix);
                  console.log("exact: " + exact);
                  console.log("suffix: " + suffix);

                  console.log(
                    prefix.value + "] " + exact.value + " [" + suffix.value
                  );
                  if (
                    annotation_graph.any(
                      annotation_url,
                      vocab.oa("hasBody"),
                      undefined
                    )
                  ) {
                    let body = annotation_graph.any(
                      annotation_url,
                      vocab.oa("hasBody"),
                      undefined
                    );
                    let comment_value = annotation_graph.any(
                      body,
                      vocab.rdf("value"),
                      undefined
                    );

                    let classApplier = getCommentClassApplier(comment_value);
                    applyHighlight(prefix, exact, suffix, classApplier);
                  } else {
                    applyHighlight(
                      prefix,
                      exact,
                      suffix,
                      highlightClassApplier
                    );
                  }
                })
                .catch(function(err) {
                  // do something with the error
                  console.log("Received error: " + err.stack);
                });
            });
        })
        .catch(function(err) {
          // do something with the error
          if (err.code == 404) console.log("Annotation listing not found");
          else console.log("Received error: " + err);
        });
    })
    .catch(function(err) {
      // do something with the error
      console.log("Received error: " + err);
    });
};
