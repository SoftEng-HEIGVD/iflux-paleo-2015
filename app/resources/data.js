var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	dataService = require('../services/dataService');

module.exports = function (app) {
  app.use('/data', router);
};

router.route('/evolution')
	.get(function(req, res, next) {
		var minutes = req.query.minutes ? req.query.minutes : 90;

		return dataService
			.getEvolution(minutes)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});

//router.route('/maps/:mapId')
//	.get(function (req, res) {
//		res.status(200).json(actionService.getMap(req.params.mapId)).end();
//	});