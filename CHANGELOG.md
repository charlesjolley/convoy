# v0.3.2
  * Better reporting when modules are not found.
  * Expanded list of excepted modules
  
# v0.3.1
  * Add convoy binary - mostly for testing purposes.
  * Now ignores requires for built-in node modules.
  * Add exception to ignore some requires for jquery so that it will work as
    expected. This is a temporary solution; it would be better to get that 
    package author to change his code.
    
# v0.3.0

  * Better logging, multiple bug fixes.
  * Refactored internal Pipeline so that Copier and AssetPackager are treated
    the same way.
  * Removed placeholders for LESS compiler. (will be separate)
  * Added CoffeeScript support
  
# v0.2.0

  * Better factoring for packagers. Now you can create your own. (should enable
    scenarios like an HTML5 manifest)
  * Better testing for copiers.
  * watch config option will automatically invalidate assets when dependent
    source files change.
    
# v0.1.2 

 * Changelog created
