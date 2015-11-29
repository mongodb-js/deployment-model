var format = require('util').format;
var debug = require('debug')('mongodb-deployment:canonicalize');

module.exports = function canonicalize(deployment, resp, done) {
  var _id = resp._id || deployment.getId();

  var hostname = _id.split(':')[0];
  var parts = hostname.split('.');
  parts.shift();
  var suffix = parts.join('.');

  if (Array.isArray(resp.instances)) {
    resp.instances = resp.instances.map(function(instance) {
      var p = instance._id.split(':');

      var instanceHostname = p[0];

      /**
       * @see https://jira.mongodb.org/browse/INT-730
       */
      if (instanceHostname === 'localhost'
        || instanceHostname.indexOf('.') > -1
        || !suffix
        || !p[1]) {
        return instance;
      }

      /**
       * TODO (imlucas): Test that the patched instance_id
       * is actually resolvable w/ `require('dns')`?
       */
      instance.aliases = [instance._id];
      instance._id = format('%s.%s:%s', p[0], suffix, p[1]);
      debug('instance_id fix `%s` -> `%s`', instance.aliases[0], instance._id);
      return instance;
    });
  }
  done(null, resp);
};
