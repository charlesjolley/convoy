// main - should require both conflicting and non-conflicting file

// for GenericLinker testing
//= require uses_conflicting_package
//= require conflicting_package/identical_file
//= require conflicting_package/conflicting_file

// for ModuleLinker testing
require('uses_conflicting_package');
require('conflicting_package/identical_file');
require('conflicting_package/conflicting_file');
