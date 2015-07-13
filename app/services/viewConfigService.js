var
	_ = require('underscore'),
	fs = require('fs'),
	config = require('../../config/config');

var viewConfig = {};

module.exports = {
	load: function() {
		if (config.app.storage.enabled) {
			fs.readFile(config.app.storage.path + '/parkings.json', function(err, data) {
				if (err) {
					console.log(err);
				}
				else {
					viewConfig = JSON.parse(data);
				}
			});
		}
	},

	save: function() {
		if (config.app.storage.enabled) {
			var configToSave = _.reduce(viewConfig, function(memo, config, key) {
				memo[key] = { conf: config.conf };
				return memo;
			}, {});

			fs.writeFile(config.app.storage.path + '/parkings.json', JSON.stringify(configToSave), function (err) {
				if (err) {
					console.log(err);
				}
			});
		}
	},

	upsert: function(instanceId, config) {
		viewConfig[instanceId] = { conf: config };
		this.save();
	},

	getMaps: function() {
		return _.reduce(viewConfig, function(memo, config, key) {
			memo.push({
				mapId: key,
				name: config.conf.mapName
			});

			return memo;
		}, []);
	},

	get: function(instanceId) {
		return viewConfig[instanceId];
	}
};