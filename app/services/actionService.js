var
	_ = require('underscore'),
	moment = require('moment'),
	config = require('../../config/config'),
	viewConfigService = require('./viewConfigService');

var maps = {};

module.exports = {
	store: function(action) {
		var id = action.properties.markerId;
		var mapId = action.target;

		if (!maps[mapId]) {
			console.log("Unknown map %s, initialize a new collection for it", mapId)
			maps[mapId] = {
				name: viewConfigService.get(mapId).conf.mapName,
				markers: {}
			};
		}

		// Prepare the data to store
		var data = _.pick(action.properties, 'lat', 'lng', 'date');
		data = _.extend(data, action.properties.data);

		// Store/overwrite data
		maps[mapId].markers[id] = data;

		console.log("New element(s) stored in the collection %s", mapId);
	},

	getMap: function(mapId) {
		var mapDef = viewConfigService.get(mapId);

		if (mapDef) {
			var markers = [];

			if (maps[mapId]) {
				var expiration = mapDef.conf.expiration || config.app.viewbox.defaultExpiration;

				if (expiration >= 0) {
					var expirationDate = moment().subtract(expiration, 'milliseconds');

					maps[mapId].markers = _.reduce(maps[mapId].markers, function (memo, data, key) {
						if (moment(data.date, moment.ISO_8601).isAfter(moment(expirationDate))) {
							memo[key] = data;
						}

						return memo;
					}, {});
				}

				markers = maps[mapId].markers;
			}

			return {
				name: mapDef.conf.mapName,
				config: {
					lat: mapDef.conf.mapConfig.centerLat,
					lng: mapDef.conf.mapConfig.centerLng,
					zoom: mapDef.conf.mapConfig.initialZoom
				},
				legendType: mapDef.conf.mapConfig.legendType,
				markers: markers
			};
		}
		else {
			return null;
		}
	}
};
