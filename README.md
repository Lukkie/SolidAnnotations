# SolidAnnotations
Linked data annotations based on the Solid stack.

## Requirements
- Node.js
- Browserify (`npm install browserify -g`)

## Install as bookmarklet
- Run `npm install`
- Upload `assets\themes\flat-theme.css` to some location (e.g. dropbox, with `raw=1` flag enabled)
- Change URL of the theme file in `src/annotations.js`
- Run `npm build` to create `out/bundle.js`. 
- Upload this new file
- Replace the script source in `assets/Bookmarklet-content.txt` with the URL of `bundle.js`
- Create a bookmark in your browser, and use the content of `assets/Bookmarklet-content.txt` as value.



# Solid Generator
Can be found in browser_scripts/solid-generator.js
Note that it requires a `random-user' dependency, but this will not work with HTTPS. Simply change its source code to use HTTPS instead of HTTP (pull request has not been accepted yet).
