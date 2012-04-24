# nap - the node asset pipeline

Nap is a pluggable, package-aware asset pipeline for node applications. You 
can use nap both as connect middleware and as part of a build tool chain to
generate any kind of static assets, including static websites, app skeletons,
documentation and so on.

# Finally, Sharing Client Side Code Is Easy

Because nap is package-aware, you can include modules and other assets 
published by packages you install as well as sharing code of your own for 
others via npm. 

For example, you could include the popular `async` utility by just adding it
to your dependencies and then in your _client side_ javascript:

    var async = require('async');

That's all! When you build your assets, nap will notice this require and
automatically pull in the async module assets.

If a package was so configured, requiring the package could also 
automatically pull in any CSS or image assets required by the package as well.


# Usage In Connect

Use nap as connect middleware by creating a pipeline instance. You should
create one pipeline instance for every URL location where you want to host
static assets.

    var nap = require('nap');
    var app = connect()
      .use(connect.logger('dev'))
      .use(nap.pipeline('/my_app', {

      }))
      .listen(3000);

# Usage In Code / Build Tools

Use nap as part of a build process. Just create a pipeline instance and 
then ask the pipeline to build specific assets on demand. You can also 
activate autocache - which will watch files and automatically rebuild on 
demand whenever watched files change.

    var nap = require('nap');
    var pipeline = nap.pipeline({
      // CONFIG OPTIONS
    });

    pipeline.build('asset_name', 'buildpath', function(err) {
      // called when build is complete
    });

You can also build all output assets known to the pipeline with buildAll

    // prepare pipeline
    pipeline.prepare(function(err) {
      var builder = pipeline.builder(pipeline.publicAssets);

      // add listeners to various events to log during build
      builder.on('log:all', console.log);

      builder.run(function(err) {
        // called when build is complete or errors out
      });
    });


# Configuring a Pipeline

You configure a pipeline by adding _generated assets_ such as a JavaScript or Stylesheet. For each generated asset you specify one or more main modules to include in the asset. Nap will then automatically pull in any required modules to go along with them, including any assets found in installed 
packages.

    // TODO: Example

  
# In Your Apps

All dependencies are based on searching your JavaScript modules. To include
other JavaScript, just `require()` like normal. To include stylesheets, be
sure to use the '.css' extension:

    require('./styles/main.css');

You can use @import and other less convensions from within your CSS files to
include other CSS files.

When nap sees this require it will generate a module stub to satisfy the
require and will add the CSS and any dependencies to the stylesheet output.



