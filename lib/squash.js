var async = require('async');
var debug = require('debug')('mongodb-deployment-model:squash');
var store = require('./store');

/**
 * If you connect to a shard in a cluster (`DeploymentA`), and then connect
 * to a router in the same logical (`DeploymentB`), `DeploymentA` will end
 * up as a subset of `DeploymentB`.  To avoid tricky state machines over `T`,
 * `DeploymentA` should be removed from the store and the next time `scope-client`
 * makes a request against an instance that was formerly in `DeploymentA`,
 * it will seemlessly transition to using `DeploymentB`, e.g. `client.deployment()`
 * at `T2` will have more `instances[]` than a call performed before the squash
 * at `T1`.
 *
 * @param {Deployment} deployment - The newest deployment being added to the store.
 * @param {Function} done - Callback `(err, [squashedDeployments])`
 */

function squash(deployment, done) {
  var query = {
    _id: {
      $ne: deployment.getId()
    },
    'instance._id': {
      $in: deployment.getInstanceIds()
    }
  };

  debug('looking for existing deployments in store that match `%j`...', query);
  store.find(query, function(err, res) {
    if (err) {
      return done(err);
    }

    if (res.length === 0) {
      debug('nothing to remove');
      return done(null, []);
    }

    debug('removing deployments `%j`', res);
    async.parallel(res.map(function(d) {
      return store.remove.bind(null, d._id);
    }), function(_err) {
      done(_err, res);
    });
  });
}

module.exports = squash;
