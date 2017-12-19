/** Config **/
var selector = '.slide';
var contextLength = 32; // Based on dokieli; The number of characters (at most) to add for context
var save_location = 'https://lukasvanhoucke.databox.me/Public/comments/';
/**/

var d = document;

// Font awesome CSS
var s = d.createElement('link');
s.href = "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css";
s.media = 'all';
s.type = 'text/css'
s.rel = 'stylesheet'
d.head.appendChild(s);

// Core Medium CSS
s = d.createElement('link');
s.href = "//cdn.jsdelivr.net/npm/medium-editor@latest/dist/css/medium-editor.min.css";
s.media = 'screen';
s.type = 'text/css'
s.rel = 'stylesheet'
s.charset = "utf-8"
d.head.appendChild(s);

// Medium Theme CSS
s = d.createElement('link');
s.href = "https://www.dropbox.com/s/102ds8wnn9kscqm/flat-theme.css?raw=1";
s.media = 'all';
s.type = 'text/css'
s.rel = 'stylesheet'
s.charset = "utf-8"
d.head.appendChild(s);

function injectScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        script.src = src;
        script.addEventListener('load', resolve);
        script.addEventListener('error', () => reject('Error loading script.'));
        script.addEventListener('abort', () => reject('Script loading aborted.'));
        document.head.appendChild(script);
    });
}

function htmlEntities(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Following function is for testing purposes
function onSelection() {
    var selectedText = window.getSelection().toString().trim();

    if (selectedText) {
        console.log("Selected text: " + selectedText);
    }
}
document.addEventListener("mouseup", onSelection);




injectScript('//cdn.jsdelivr.net/npm/medium-editor@latest/dist/js/medium-editor.min.js')
    .then(() => {
      return injectScript("https://www.dropbox.com/s/ezo4ijj1m46d7vq/rdflib-0.12.2.min.js?raw=1");
    })
    .then(() => {
      return injectScript("https://www.dropbox.com/s/kwm6x0v5d6dtds8/solid-client.js?raw=1");
    })
    .then(() => {
      return injectScript("https://cdnjs.cloudflare.com/ajax/libs/rangy/1.3.0/rangy-core.js");
    })
    .then(() => {
      return injectScript("https://cdnjs.cloudflare.com/ajax/libs/rangy/1.3.0/rangy-classapplier.min.js");
    })
    .then(() => {
        rangy.init();
        var solid = SolidClient;
        var vocab = solid.vocab;
        vocab.oa = ''

        var HighlighterButton = MediumEditor.extensions.button.extend({
          name: 'highlighter',

          tagNames: ['mark'], // nodeName which indicates the button should be 'active' when isAlreadyApplied() is called
          contentDefault: '<b>Highlight</b>', // default innerHTML of the button
          contentFA: '<i class="fa fa-lightbulb-o"></i>', // innerHTML of button when 'fontawesome' is being used
          aria: 'Highlight', // used as both aria-label and title attributes
          action: 'highlight', // used as the data-action attribute of the button

          init: function () {
            MediumEditor.extensions.button.prototype.init.call(this);

            this.classApplier = rangy.createClassApplier('highlight', {
              elementTagName: 'mark',
              normalize: true
            });
          },

          handleClick: function (event) {
            // this.classApplier.toggleSelection();



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


        // var button = createHighlightButton('highlight', 'highlight');
        var editor = new MediumEditor(document.querySelectorAll(selector), {
          // TODO: Editor is not centered because of the way Open Webslides is programmed
          // (Try zooming in and out, slide stays same size, but position of editor changes)
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
    })
    .catch(error => {
        console.log(error);
    });
