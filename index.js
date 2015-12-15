var Probe = require('./lib/probe');
var store = require('./lib/store');
exports = require('./lib/model');

var Instance = require('mongodb-instance-model');
exports.canonicalize = require('./lib/canonicalize');

/**
 * @param {models.Connection} connection - How to connect to the deployment.
 * @param {Function} done - Callback `(err, {Deployment})`.
 * @return {Probe}
 * @api public
 */
exports.create = function(connection, done) {
  return new Probe(connection, done);
};

/**
 * @param {String} id
 * @param {Function} done - Callback `(err, {Deployment})`.
 * @api public
 */
exports.get = function(id, done) {
  id = Instance.getId(id);
  store.findOne({
    $or: [
      {
        _id: id
      },
      {
        'instances._id': id
      }
    ]
  }, done);
};

exports.getOrCreate = function(connection, done) {
  exports.get(connection.instance_id, function(err, deployment) {
    if (err) {
      return done(err);
    }

    if (deployment) {
      return done(null, deployment);
    }

    exports.create(connection, done);
  });
};

exports.clear = store.clear;
exports.find = store.find;
exports.findOne = store.findOne;
exports.list = store.all;

module.exports = exports;
