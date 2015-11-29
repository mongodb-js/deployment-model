var assert = require('assert');
var async = require('async');
var Deployment = require('../');
var store = require('../lib/store');
var squash = require('../lib/squash');
var canonicalize = require('../lib/canonicalize');

describe('mongodb-deployment-model', function() {
  it('should work', function() {
    assert(Deployment);
    assert(new Deployment());
  });

  describe('canonicalize', function() {
    describe('Relative hostnames', function() {
      var d = new Deployment({
        _id: 'router1.prod.mongodb.parts:30000'
      });

      var metadata = {
        instances: [
          {
            _id: 'router1.prod.mongodb.parts:30000'
          },
          {
            _id: 'router2:30001'
          },
          {
            _id: 'store1:27017'
          },
          {
            _id: 'store2:27017'
          },
          {
            _id: 'store3:27017'
          }
        ]
      };

      before(function(done) {
        canonicalize(d, metadata, done);
      });

      it('should not stomp existing FQDNs', function() {
        assert.equal(metadata.instances[0]._id, 'router1.prod.mongodb.parts:30000');
      });
      it('should update `router2:30001` to an FQDN', function() {
        assert.equal(metadata.instances[1]._id, 'router2.prod.mongodb.parts:30001');
      });
      it('should update `store1:27017` to an FQDN', function() {
        assert.equal(metadata.instances[2]._id, 'store1.prod.mongodb.parts:27017');
      });
      it('should update `store2:27017` to an FQDN', function() {
        assert.equal(metadata.instances[3]._id, 'store2.prod.mongodb.parts:27017');
      });
      it('should update `store3:27017` to an FQDN', function() {
        assert.equal(metadata.instances[4]._id, 'store3.prod.mongodb.parts:27017');
      });
    });
  });

  describe('Regressions', function() {
    /**
     * @see https://jira.mongodb.org/browse/INT-730
     */
    describe('INT-730: Errant `.` in deployment discovery', function() {
      it('should canonicalize correctly', function(done) {
        var metadata = {
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
        var d = new Deployment({
          _id: 'amit-ubuntu1404-2015-09:27017'
        });

        canonicalize(d, metadata, function(err) {
          if (err) {
            return done(err);
          }

          assert.equal(metadata.instances.length, 1);
          assert.equal(metadata.instances[0]._id, 'amit-ubuntu1404-2015-09:27017');
          done();
        });
      });
    });

    /**
     * @see https://jira.mongodb.org/browse/INT-853
     */
    describe('INT-853: More canonicalization', function() {
      it('should canonicalize correctly', function(done) {
        var metadata = {
          instances: [
            {
              _id: 'abcd001:27017'
            }
          ]
        };
        var d = new Deployment({
          _id: 'abcd006:27017'
        });
        canonicalize(d, metadata, function(err) {
          if (err) {
            return done(err);
          }

          assert.equal(metadata.instances.length, 1);
          assert.equal(metadata.instances[0]._id, 'abcd001:27017');
          done();
        });
      });
    });
    /**
     * @see https://jira.mongodb.org/browse/INT-894
     */
    describe('INT-894: Deployment.squash is squash happy', function() {
      function createDeployment(_id, done) {
        var d = new Deployment({
          _id: _id
        });

        var metadata = {
          instances: [
            {
              _id: _id
            }
          ]
        };

        async.series([
          Deployment.canonicalize.bind(null, d, metadata),
          store.set.bind(store, d.getId(), d)
        ], function(err) {
          if (err) {
            return done(err);
          }
          squash(d, function(_err, squashed) {
            if (_err) {
              return done(_err);
            }

            assert.equal(squashed.length, 0);
            done();
          });
        });
      }
      it('should create `localhost:27000`', function(done) {
        createDeployment('localhost:27000', done);
      });
      it('should create `localhost:27001`', function(done) {
        createDeployment('localhost:27001', done);
      });
      it('should have `localhost:27000` and `localhost:27001` in the deployment list', function(done) {
        Deployment.list(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.length, 2);
          done();
        });
      });
    });
  });
});
