var AmpersandModel = require('ampersand-model');
var AmpersandCollection = require('ampersand-rest-collection');
var getInstanceId = require('mongodb-instance-model').getId;
var InstanceCollection = require('mongodb-instance-model').Collection;
var ENDS_WITH_NUMBER = /\d$/;

var dataTypes = {
  deployment_id: {
    set: function(newVal) {
      return {
        type: 'deployment_id',
        val: getInstanceId(newVal)
      };
    }
  }
};

var Deployment = AmpersandModel.extend({
  idAttribute: '_id',
  dataTypes: dataTypes,
  props: {
    _id: {
      type: 'deployment_id',
      required: true
    },
    name: {
      type: 'string',
      required: true
    },
    sharding: {
      type: 'any',
      required: false,
      allowNull: true,
      default: null
    }
  },
  collections: {
    instances: InstanceCollection
  },
  derived: {
    /**
     * Simple hueristics to see if we might be connected directly to a shard
     * which shows up like a replicaset and has no way of knowing that it
     * is merely a shard and not a replicaset.
     */
    maybe_sharded: {
      deps: ['sharding', 'replicaset'],
      fn: function() {
        if (this.sharding) {
          return true;
        }
        return ENDS_WITH_NUMBER.test(this.rs || '');
      }
    },
    instance_ids: {
      deps: ['instances.length'],
      fn: function() {
        return this.instances.pluck('_id');
      }
    },
    type: {
      deps: ['sharding', 'replicaset'],
      fn: function() {
        if (this.sharding) {
          return 'cluster';
        }
        if (this.replicaset) {
          return 'replicaset';
        }
        return 'standalone';
      }
    },
    /**
     * The replicaset name if this is a replicaset deployment.
     */
    replicaset: {
      deps: ['instance_ids'],
      fn: function() {
        var first = this.instances.at(0);
        if (!first) {
          return undefined;
        }
        return first.replicaset;
      }
    },
    is_standalone: {
      deps: ['type'],
      fn: function() {
        return this.type === 'standalone';
      }
    },
    has_sharding: {
      deps: ['type'],
      fn: function() {
        return this.type === 'cluster';
      }
    },
    has_replication: {
      deps: ['type'],
      fn: function() {
        return this.type !== 'standalone';
      }
    }
  },
  initialize: function() {
    this.listenTo(this.instances, 'add remove sync reset', function() {
      this.instances.trigger('change:length');
    }.bind(this));
  }
});

Deployment.getId = getInstanceId;

var DeploymentCollection = AmpersandCollection.extend({
  comparator: '_id',
  model: Deployment,
  modelType: 'DeploymentCollection'
});

module.exports = Deployment;
module.exports.Collection = DeploymentCollection;
module.exports.canonicalize = require('./canonicalize');
