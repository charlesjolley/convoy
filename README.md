# Convoy

Convoy is a package-aware, pluggable asset pipeline for node applications. You
can use it to generate static assets either as a part of a live server or via 
a build tool chain.

## Using Shared Libraries In Static Assets

Because Convoy is package-aware, you can include modules, CSS, and other assets
from packages you install from npm or other sources. Including assets in your
build couldn't be easier - just `require()` them!

For example, to include the popular `async` library in your client side app, 
just add it to your dependencies in you package json and then in your _client
side_ javascript:

    var async = require('async');

That's all you have to do! When you build your assets, convoy will notice this
require() and automatically pull in the async module assets.

Convoy technically can include JavaScript from any NPM package. However, the 
code itself must not use any node-specific APIs since they will not be 
available in the browser.

In addition to JavaScript, packages can also include CSS and legacy (i.e. 
non-CommonJS module-based) JavaScript. See the section on "CSS and Legacy
JavaScript" below for more info.

## Using Convoy

To use convoy, you must integrate it into your server code or build scripts.
You can find some examples of how to do this in the examples directory. 

Generally, creating a convoy pipeline is simple. Just invoke the convoy 
function and pass a config defining your assets:

    var convoy = require('convoy');
    var path   = require('path);

    // create a new pipeline with an app.js and app.css file.
    var pipeline = convoy({
      'app.js': {
        packager: 'javascript',  // selects some default plugins
        main:  path.resolve('app/main.js'), // starting module to include
        minify: true // must be set to minify output
      },

      'app.css': {
        packager: 'css',
        main: path.resolve('app/styles') // includes app/styles/index.css
      },

      'assets': {
        packager: 'copy',
        root: 'app/assets'
      }
    });

The pipeline above will know who to generate two assets:

    * `app.js` will include the module found at `'app/main.js'` plus any 
      modules (in any package) required by the module.
    * `app.css` will include the module found at `'app/styles/index.css`' plus
      any css files (in any package) required by that file.

It will also be able to copy any assets found in the `'app/assets'` directory.
They will be available under the `assets` directory in the built output.

Once you have created a pipeline, you can either build the assets into memory
or write them to a file on disk. You will generally want to just build the 
assets if you are using the pipeline in a server and write to disk if you are
using the pipeline in a build script.

When using Convoy with a server you will want to use the `exists()` and 
`build()` methods:

    // returns true if the passed path matches a file in the pipeline, 
    // including an asset found in the copy task.
    pipeline.exists('app.js', function(exists) {
      // handle ..
    });

    // builds app.js, returning a hash with the body and other attributes for
    // streaming to a server.
    pipeline.build('app.js', function(err, asset) {
      if (err) handle_error(err);
      return_asset(asset.body);
    });

When using Convoy as part of a build task, you will want to use the 
`writeFile()` and `writeAllFiles()` tasks:

    // writes app.js to the build directory `public`. Invokes callback when 
    // completed.
    pipeline.writeFile('app.js', path.resolve('public'), function(err) {
      if (err) handle_error(err);
      // go to next step..
    });

    // writes ALL files known to the asset pipeline to disk.
    pipeline.writeAllFiles(path.resolve('public'), function(err) {
      if (err) handle_error(err);
      // go to next step
    });

Eventually I would like to include some rebuilt tasks and a connect middleware
(already stubbed in at pipeline.js). Patches welcome if you would find these
useful.

## CSS and Legacy JavaScript

In addition to modular JavaScript, Convoy also supports building CSS and 
legacy JavaScript files. Since neither of these types of assets support the 
`require()` function, Convoy instead looks for require comments similar to the
ones defined by the Rails Pipeline. Here is how you can make a CSS file that
includes two other CSS files before it:

    /* index css */
    /*= require ./reset.css */
    /*= require ./type.css */
    /*= require bootstrap/styles */

This example file would include `reset.css` and `type.css` stylesheets before
the current one as well as any stylesheets found in the mythical `bootstrap`
package installed via npm.

Legacy JavaScript files work the same way. To build an asset with legacy 
javascript instead of modules, use the `legacy_javascript` packager when 
configuring your pipeline:

    pipeline = convoy({
      'legacy.js': {
        packager: 'legacy_javascript',
        main: 'vendor/index.js'
      }
    });

This will select a set of default plugins that will just merge the JavaScript
instead of packing it in CommonJS modules.


## Plugins - Building Other Asset Types

If Convoy doesn't handle all the file types you want or behave in exactly the
right way for you, it is incredibly easy to customize it via plugins.

When Convoy builds an asset, it passes the asset through several different
stages, each driven by a separate plugin. Plugins all have
the same interface. They are just functions with the following signature:

    function ConvoyPlugin(asset, context, done) {

    }

The `asset` parameter is an object that describes the current asset. In general
your plugin will read and modify properties on this object.

The `context` parameter as an object that contains some utility functions as 
well as the config settings you passed to the `convoy()` function when you
setup the pipeline.

The `done` parameter is a callback you should invoke (with an optional error)
when your plugin is finished with its work.

There are seven different types of plugins, called in order when you build an
asset:

  1.  **compile** - called once for each input file. This plugin should load
      the file contents into the `body` property on the asset. Implement a 
      compiler if you want to add support for another language like CoffeeScript
      or LESS.

  2.  **preprocessors** - an array of optional plugins, these are called on
      each input file just after compile. This allows you to do global 
      manipulation on the file. For example you might remove asserts, etc.

  3.  **analyzer** - called once for each input file to extract dependency
      and module information. This is the plugin you would write if you want
      some new way to extract dependencies. (such as using the `@import` tag
      in LESS).

  4.  **linker** - merges all the input files into a single asset. The passed
      asset will have an `assets` property that is an ordered array of assets
      to merge. The linker should generate a new body and set it to the `body`
      property. Implement a linker if you want to control how assets are 
      merged. CommonJSLinker, for example, wraps modules and adds a default
      loader.

  5.  **postprocessors** - optional array of plugins, these are called on
      the merged asset just after it is linked but before it is minified. You
      might do extra code stripping, etc.

  6.  **minifier** - if the `minify` config is set to true, this plugin will be
      called to minify the merged asset. Implement if you want to define your
      own minifier.

  7.  **finalizers** - optional array of plugins called after minification.
      Implement to add final markup such as copyright statements.

## Using Plugins

To configure your own plugins, you just set them in your pipeline config. You
can also make module ids, in which case the exports of the module must be 
the plugin function:

    // add a custom finalizer to add a copyright statement and setup plugins 
    // to compile LESS with the (currently) fictional `convoy-less` package.

    var COPYRIGHT = '// copyright 2012 MyCompany, Inc.\n\n';
    function CopyrightFinalizer(asset, context, done) {
      asset.body = COPYRIGHT + asset.body;
      done();
    }

    var pipeline = convoy({

      'app.js': {
        packager: 'javascript',
        main: path.resolve('app/main.js'),

        finalizers: [CopyrightFinalizer]
      },

      'app.css': {
        packager: 'css',
        main: path.resolve('app/assets/main.less'),

        compilers: {
          '.less': 'convoy-less/pipeline_plugins/less_compiler'
        },
        minifier: 'convoy-less/pipeline_plugins/css_minifier'
      }
    });

## Hacking/Contributing

If you'd like to make some changes to Convoy, just 
[fork it on github](http://github.com/charlesjolley/convoy), make your change, 
add a unit test, and send me a pull request.

To run unit tests first run `npm install` on the project to add dependencies
and then run `make test`.

## Asking Questions

[StackOverflow](http://stackoverflow.com/questions/tagged/convoy)

## TODO

There are lots of things still to do. See TODOS.txt and Github Issues for some.

## Copyright/License

copyright 2012 Charles Jolley and contributors
MIT License.



