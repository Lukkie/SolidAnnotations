/*
copy the selected text to clipboard
*/
var d = document;

// Medium text selection pop-up
// s = d.createElement('script');
// s.type = 'text/javascript';
// s.setAttribute('src','//cdn.jsdelivr.net/npm/medium-editor@latest/dist/js/medium-editor.min.js');
// d.head.appendChild(s);

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

/*
Add copySelection() as a listener to mouseup events.
*/
document.addEventListener("mouseup", onSelection);

injectScript('//cdn.jsdelivr.net/npm/medium-editor@latest/dist/js/medium-editor.min.js')
    .then(() => {
        var editor = new MediumEditor(document.querySelectorAll('.slide'), {
          buttonLabels: 'fontawesome',
          disableEditing: true,
          spellcheck: false,
          anchorPreview: false
        });
    }).catch(error => {
        console.log(error);
    });


// open webslides
// editor = new MediumEditor(document.querySelectorAll('.slide'), {
//   disableEditing: true,
//   spellcheck: false,
//   anchorPreview: false
// });

// Doortrappers
// editor = new MediumEditor(getSelectionTextAndContainerElement().containerElement, {
//     //options
// });
