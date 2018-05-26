# Decentralized Annotations
Linked data annotations based on the Solid stack.

## Requirements
- Node.js
- Browserify (`npm install browserify -g`)

## Content
```
Decentralized annotations  
│
└─── assets: files that are required for the bookmarklet
│   	└─ Contains the bookmarklet content in Bookmarklet-content.txt
│
└─── browser_scripts: Scripts that drive the test setup
│   	└─ out: Browserified versions of the script.
│   
└─── out: Browserified versions of the annotation plugins that can be used as bookmarklet
│   
└─── snippets: Small code snippets that were used to test out features of Solid etc. Not relevant.
│   
└─── src: Source code for the annotation plugins
	  └─ annotations-sparql.js: Annotation plugin for query-based access using custom middleware
	  └─ annotations.js: Annotation plugin for file-based access using Solid
      └─ util.js: Helper module containing extra code for rangy
```
## Annotation plugins
The plugins are written as bookmarklets so that they can used on any website. In reality, it should be installed as a plugin (after some minor changes). There are two plugins: one for query-based access and another for file-based access.
### Install annotation plugins as bookmarklet
- Run `npm install`
- Upload `assets\themes\flat-theme.css` to some location (e.g. dropbox, with `raw=1` flag enabled)
- Change URL of the theme file in `src/annotations.js` and `src/annotations-sparql.js`
- Run `npm build` to create `out/bundle.js`. 
- Upload this new file
- Replace the script source in `assets/Bookmarklet-content.txt` with the URL of `bundle.js`
- Create a bookmark in your browser, and use the content of `assets/Bookmarklet-content.txt` as value.

## Browser scripts
This directory contains some scripts that are used in the [vanhoucke.me](https://github.ugent.be/lbvhouck/vanhoucke.me) repository. Surely, these scripts are out of place here, but most of them use Solid, and originally this repository was just a collection of scripts for Solid.
* `annotation-loader.js`: Script for the annotation loader test setup.
* `solid-auth.js`: Script that is NOT used in any test setup.
* `solid-generator.js`: Script for the annotation generator. Despite what the name suggests, it also creates annotations for the SPARQL back-end.
* `solid-intersection.js`: Script for file-based access intersections.
* `sparql-intersection.js`: Script for query-based access intersections.

### Building the browser scripts
To allow the browser scripts to work in the browser, they need to be browserified. For example:
```
browserify annotation-loader.js > annotation-loader.out.js
```

