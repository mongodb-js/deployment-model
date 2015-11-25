/* eslint no-shadow:1 */
var async = require('async');
var _ = require('lodash');
var Connection = require('mongodb-connection-model');
var connect = Connection.connect;
var replicaset = require('mongodb-replicaset');
var store = require('./store');
var Deployment = require('./model');
var canonicalize = require('./canonicalize');
var debug = require('debug')('mongodb-deployment:node');

exports.squash = function(deployment, fn) {
  debug('checking if squash required');
  var ids = _.pluck(deployment.instances, '_id');
  var squish = [];
  async.waterfall([
    store.all, function(docs) {
      docs.map(function(doc) {
        // Skip current
        if (doc._id === deployment._id) {
          return;
        }

        var res = _.chain(doc.instances)
          .pluck('_id')
          .filter(function(id) {
            return ids.indexOf(id) > -1;
          })
          .value();

        if (res.length > 0) {
          squish.push(doc);
        }
      });
      // nothing to squish
      if (squish.length === 0) {
        debug('nothing to squash');
        fn();
        return;
      }

      debug('squishing `%j`', squish);
      var tasks = squish.map(function(d) {
        return store.remove.bind(null, d._id);
      });

      async.parallel(tasks, function(err) {
        fn(err, squish);
      });
    }
  ]);
};

/**
 * Weave our way through to find all of the instances in a deployment.
 *
 * TODO (imlucas): handle dynamic updates (new members, state changes) and
 * update the deployment store.
 *
 * @param {mongodb.Db} db - The database we're connected to.
 * @param {Function} fn - Callback `(err, {Deployment})`.
 */
function discover(db, fn) {
  replicaset.discover(db, fn);
}

/**
 * @param {models.Connection} connection - How to connect to discover the deployment.
 * @param {Function} fn - Callback `(err, {Deployment})`.
 */
exports.create = function(connection, fn) {
  if (typeof connection === 'string') {
    connection = Connection.from(
      Deployment.getId(connection));
  }
  debug('creating from connection `%j`', connection);

  var deployment = new Deployment({
    _id: connection.getId(),
    name: connection.name
  });

  connect(connection, function(err, client) {
    if (err) {
      fn(err);
      return;
    }
    if (!client) {
      fn(new Error('Could not connect'));
      return;
    }

    discover(client, function(err, res) {
      if (err) {
        debug('discovery failed', err);
        client.close();
        fn(err);
        return;
      }

      debug('discover result is', res);

      canonicalize(deployment, res, function(err) {
        if (err) {
          fn(err);
          return;
        }

        debug('closing discovery connection');
        client.close();

        debug('adding to store', deployment.toJSON());
        store.set(deployment.getId(), deployment, function(err) {
          if (err) {
            fn(err);
            return;
          }

          exports.squash(deployment, function() {
            debug('deployment created!');
            fn(null, deployment);
          });
        });
      });
    });
  });
};

exports.get = function(id, fn) {
  debug('get `%s`', id);
  var deployment;

  store.get(id, function(err, dep) {
    deployment = dep;

    if (err) {
      return fn(err);
    }

    if (deployment) {
      return fn(null, deployment);
    }

    store.all(function(err, docs) {
      if (err) {
        return fn(err);
      }

      docs.map(function(doc) {
        doc.instances.map(function(instance) {
          if (instance._id === id && !deployment) {
            deployment = doc;
          }
        });
      });
    });
    fn(null, deployment);
  });
};

exports.clear = store.clear;
exports.find = store.find;
exports.findOne = store.findOne;

exports.list = function(done) {
  store.all(done);
};

exports.getOrCreate = function(model, done) {
  debug('get deployment for `%s`', model.getId());
  Deployment.get(model.getId(), function(err, deployment) {
    if (err) {
      return done(err);
    }

    if (deployment) {
      debug('deployment already exists');
      return done(null, deployment);
    }
    debug('deployment doesnt exist yet so creating...');
    Deployment.create(model, function(err, deployment) {
      if (err) {
        return done(err);
      }
      done(null, deployment);
    });
  });
};

module.exports = exports;
