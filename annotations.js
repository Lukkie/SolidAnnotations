/*
copy the selected text to clipboard
*/
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

// function getSelectionTextAndContainerElement() {
//     var text = "", containerElement = null;
//     if (typeof window.getSelection != "undefined") {
//         var sel = window.getSelection();
//         if (sel.rangeCount) {
//             var node = sel.getRangeAt(0).commonAncestorContainer;
//             containerElement = node.nodeType == 1 ? node : node.parentNode;
//             text = sel.toString();
//         }
//     } else if (typeof document.selection != "undefined" &&
//                document.selection.type != "Control") {
//         var textRange = document.selection.createRange();
//         containerElement = textRange.parentElement();
//         text = textRange.text;
//     }
//     return {
//         text: text,
//         containerElement: containerElement
//     };
// }

function onSelection() {
    // var selection = getSelectionTextAndContainerElement();
    // var selectedText = selection.text.trim();
    // var selectedContainerElement = selection.containerElement;
    var selectedText = window.getSelection().toString().trim();

    if (selectedText) {
        console.log("Selected text: " + selectedText);
    }
}
document.addEventListener("mouseup", onSelection);




injectScript('//cdn.jsdelivr.net/npm/medium-editor@latest/dist/js/medium-editor.min.js')
    .then(() => {
      return injectScript("https://cdnjs.cloudflare.com/ajax/libs/rangy/1.3.0/rangy-core.js");
    })
    .then(() => {
      return injectScript("https://cdnjs.cloudflare.com/ajax/libs/rangy/1.3.0/rangy-classapplier.min.js");
    })
    .then(() => {
        rangy.init();
        var HighlighterButton = MediumEditor.Extension.extend({
          name: 'highlighter',

          init: function () {
            this.button = this.document.createElement('button');
            this.button.classList.add('medium-editor-action');
            this.button.innerHTML = '<i class="fa fa-thumbs-up"></i>';
            this.button.contentFA = '<i class="fa fa-thumbs-up"></i>';
            this.button.title = ' Highlight'

            this.classApplier = rangy.createClassApplier('highlight', {
              elementTagName: 'mark',
              normalize: true
            });
            this.on(this.button, 'click', this.handleClick.bind(this));


          },

          getButton: function () {
            return this.button;
          },

          handleClick: function (event) {
            this.classApplier.toggleSelection();

            // Ensure the editor knows about an html change so watchers are notified
            // ie: <textarea> elements depend on the editableInput event to stay synchronized
            this.base.checkContentChanged();

            console.log("Button clicked");
          }
        });


        // var button = createHighlightButton('highlight', 'highlight');
        var editor = new MediumEditor(document.querySelectorAll('.slide'), {
          buttonLabels: 'fontawesome',
          disableEditing: true,
          spellcheck: false,
          anchorPreview: false,
          extensions: {
            //'highlight': new ANNO.U.Editor.Note({action:'highlight', label:'highlight'})
            'highlighter': new HighlighterButton()
          },
          toolbar: {
              buttons: ['highlighter'],
              // buttons: ['highlight'],
              allowMultiParagraphSelection: false
          }
        });
    })
    .catch(error => {
        console.log(error);
    });
