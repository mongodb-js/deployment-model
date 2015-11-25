var assert = require('assert');
var Deployment = require('../');

describe('mongodb-deployment-model', function() {
  it('should work', function() {
    assert(Deployment);
    assert(new Deployment());
  });
  describe('Regressions', function() {
    /**
     * @see https://jira.mongodb.org/browse/INT-730
     */
    describe('INT-730: Errant `.` in deployment discovery', function() {
      it('should cannonicalize correctly', function(done) {
        var opts = {
          _id: 'amit-ubuntu1404-2015-09:27017',
          instances: [
            {
              _id: 'amit-ubuntu1404-2015-09:27017'
            }
          ]
        };
        /**
         * Error reports showed us that in `compass@0.4.3`
         * the above would be errantly cannonicalized
         * as `amit-ubuntu1404-2015-09.:27017`.
         */
        var d = new Deployment();
        Deployment.canonicalize(d, opts, function(err) {
          if (err) {
            return done(err);
          }

          assert.equal(d.instances.length, 1);
          assert.equal(d.instances.at(0).getId(), 'amit-ubuntu1404-2015-09:27017');
          done();
        });
      });
    });
  });
});
