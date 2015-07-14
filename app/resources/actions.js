var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	config = require('../../config/config'),
	Measure = require('../services/analytics').Measure;;

module.exports = function (app) {
	router.app = app;

  app.use('/actions', router);
};

router.route('/')
	/* POST actions */
	.post(function (req, res) {
  	var actions = req.body;

  	console.log('Received %s actions.', actions.length);

		_.each(actions, function(action) {
			console.log('Consider action: %s', action.type);
			var value = action.properties.value;

			var timestamp = action.properties.timestamp;
			if (timestamp === undefined) {
				timestamp = new Date();
			}

			if (value === undefined) {
				value = 1;
			}

			if (action.type === config.app.actionTypes.carIn) {
				var measure = new Measure('ch.heigvd.iflux.paleo2015.' + action.properties.location + '.carsIn', value, timestamp);

				router.app.analyticsProvider.reportMeasure(measure);
			}
			else if (action.type === config.app.actionTypes.carOut) {
				var measure = new Measure('ch.heigvd.iflux.paleo2015.' + action.properties.location + '.carsOut', value, timestamp);

				router.app.analyticsProvider.reportMeasure(measure);
			}
		});

		res.status(204).send();
	});