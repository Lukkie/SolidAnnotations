var rangy = require('rangy');

var exports = module.exports = {};


// Heavily based on MediumEditor's importSelection function.
exports.createRangyRange = function(selectionState, root, doc) {
    if (!selectionState || !root) {
        return;
    }

    // var range = doc.createRange();
    // range.setStart(root, 0);
    // range.collapse(true);

    var range = rangy.createRange(doc);
    range.setStart(root, 0);

    var node = root,
        nodeStack = [],
        charIndex = 0,
        foundStart = false,
        foundEnd = false,
        trailingImageCount = 0,
        stop = false,
        nextCharIndex,
        allowRangeToStartAtEndOfNode = false,
        lastTextNode = null;

    // When importing selection, the start of the selection may lie at the end of an element
    // or at the beginning of an element.  Since visually there is no difference between these 2
    // we will try to move the selection to the beginning of an element since this is generally
    // what users will expect and it's a more predictable behavior.
    //
    // However, there are some specific cases when we don't want to do this:
    //
    //  1) The selection starts with an image, which is special since an image doesn't have any 'content'
    //     as far as selection and ranges are concerned
    //  2) The selection starts after a specified number of empty block elements (selectionState.emptyBlocksIndex)
    //
    // For these cases, we want the selection to start at a very specific location, so we should NOT
    // automatically move the cursor to the beginning of the first actual chunk of text
    if (selectionState.startsWithImage || typeof selectionState.emptyBlocksIndex !== 'undefined') {
        allowRangeToStartAtEndOfNode = true;
    }

    while (!stop && node) {
        // Only iterate over elements and text nodes
        if (node.nodeType > 3) {
            node = nodeStack.pop();
            continue;
        }

        // If we hit a text node, we need to add the amount of characters to the overall count
        if (node.nodeType === 3 && !foundEnd) {
            nextCharIndex = charIndex + node.length;
            // Check if we're at or beyond the start of the selection we're importing
            if (!foundStart && selectionState.start >= charIndex && selectionState.start <= nextCharIndex) {
                // NOTE: We only want to allow a selection to start at the END of an element if
                //  allowRangeToStartAtEndOfNode is true
                if (allowRangeToStartAtEndOfNode || selectionState.start < nextCharIndex) {
                    range.setStart(node, selectionState.start - charIndex);
                    foundStart = true;
                }
                // We're at the end of a text node where the selection could start but we shouldn't
                // make the selection start here because allowRangeToStartAtEndOfNode is false.
                // However, we should keep a reference to this node in case there aren't any more
                // text nodes after this, so that we have somewhere to import the selection to
                else {
                    lastTextNode = node;
                }
            }
            // We've found the start of the selection, check if we're at or beyond the end of the selection we're importing
            if (foundStart && selectionState.end >= charIndex && selectionState.end <= nextCharIndex) {
                if (!selectionState.trailingImageCount) {
                    range.setEnd(node, selectionState.end - charIndex);
                    stop = true;
                } else {
                    foundEnd = true;
                }
            }
            charIndex = nextCharIndex;
        } else {
            if (selectionState.trailingImageCount && foundEnd) {
                if (node.nodeName.toLowerCase() === 'img') {
                    trailingImageCount++;
                }
                if (trailingImageCount === selectionState.trailingImageCount) {
                    // Find which index the image is in its parent's children
                    var endIndex = 0;
                    while (node.parentNode.childNodes[endIndex] !== node) {
                        endIndex++;
                    }
                    range.setEnd(node.parentNode, endIndex + 1);
                    stop = true;
                }
            }

            if (!stop && node.nodeType === 1) {
                // this is an element
                // add all its children to the stack
                var i = node.childNodes.length - 1;
                while (i >= 0) {
                    nodeStack.push(node.childNodes[i]);
                    i -= 1;
                }
            }
        }

        if (!stop) {
            node = nodeStack.pop();
        }
    }

    // If we've gone through the entire text but didn't find the beginning of a text node
    // to make the selection start at, we should fall back to starting the selection
    // at the END of the last text node we found
    if (!foundStart && lastTextNode) {
        range.setStart(lastTextNode, lastTextNode.length);
        range.setEnd(lastTextNode, lastTextNode.length);
    }

    return range;
};
