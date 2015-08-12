var assert = require('assert');
var Deployment = require('../');

describe('mongodb-deployment-model', function() {
  it('should work', function() {
    assert(Deployment);
    assert(new Deployment());
  });
});
