// test_module.js
// Free module outside of a package.


function HelloWorld(foo) {
  console.log('FOO');
}

HelloWorld.prototype.hello = function() {
  return 'world';
};

ASSERT(1>3, 'throw this exception ' +
  foo + 'bar');
  