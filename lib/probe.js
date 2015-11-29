var async = require('async');
var Connection = require('mongodb-connection-model');
var replicaset = require('mongodb-replicaset');
var Deployment = require('./model');
var canonicalize = require('./canonicalize');
var squash = require('./squash');
var store = require('./store');
var debug = require('debug')('mongodb-deployment-model:probe');

/**
 * Use the metadata of `connection` to discover
 * details about the MongoDB deployment behind it
 * and persist the results in `store`.
 *
 * @param {Connection} connection
 * @param {Function} done - Callback `(err, {Deployment})`
 * @return {Probe}
 * @api public
 */
function Probe(connection, done) {
  if (!(this instanceof Probe)) {
    return new Probe(connection, done);
  }

  if (typeof connection === 'string') {
    connection = Connection.from(
      Deployment.getId(connection));
  }
  debug('connection is `%j`', connection);

  this.deployment = new Deployment({
    _id: connection.getId(),
    name: connection.name
  });

  this.connection = connection;

  this.db = null;
  this.metadata = null;

  if (typeof done === 'function') {
    this.exec(done);
  }
}

/**
 * @param {Function} done
 * @api public
 */
Probe.prototype.exec = function(done) {
  async.series({
    connect: this._connect.bind(this),
    'discover metadata': this._discover.bind(this),
    canonicalize: this._canonicalize.bind(this),
    persist: this._persist.bind(this)
  }, function(err) {
    if (this.db) {
      this.db.close();
    }
    done(err, this.deployment);
  }.bind(this));
};

/**
 * Try to get a connection to the deployment the probe will use.
 *
 * @param {Function} done
 * @api private
 */
Probe.prototype._connect = function(done) {
  Connection.connect(this.connection, function(err, db) {
    if (!err && !db) {
      err = new Error('Probe connection failed unexpectedly');
    }
    if (err) {
      debug('connect failed: ', err.stack);
      done(err);
      return;
    }
    this.db = db;
    debug('successfully connected');
    done();
  }.bind(this));
};

/**
 * @param {Function} done
 * @api private
 */
Probe.prototype._discover = function(done) {
  debug('discovering deployment metadata...');
  replicaset.discover(this.db, function(err, res) {
    if (err) {
      debug('discovery failed', err);
      done(err);
      return;
    }
    debug('discovered metadata `%j`', res);
    this.metadata = res;
    done();
  }.bind(this));
};

/**
 * @param {Function} done
 * @api private
 */
Probe.prototype._canonicalize = function(done) {
  debug('canonicalizing metadata...');
  canonicalize(this.deployment, this.metadata, function(err) {
    if (err) {
      debug('canonicalization failed:', err.stack);
      done(err);
      return;
    }
    debug('canonicalized metadata is `%j`', this.metadata);

    debug('applying canonical metadata to deployment model...');
    this.deployment.instances.reset(this.metadata.instances, {
      parse: true
    });

    debug('deployment is now `%j`', this.deployment);

    done();
  }.bind(this));
};

/**
 * @param {Function} done
 * @api private
 */
Probe.prototype._persist = function(done) {
  debug('persisting metadata to store `%j`...', this.deployment);
  store.set(this.deployment.getId(), this.deployment, function(err) {
    if (err) {
      done(err);
      return;
    }

    squash(this.deployment, function(_err) {
      if (_err) {
        done(_err);
        return;
      }
      done();
    });
  }.bind(this));
};

module.exports = Probe;
