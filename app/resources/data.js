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

router.route('/tiles')
	.get(function(req, res, next) {
		var minutes = req.query.type ? req.query.type : 'entries';

		return dataService
			.getTiles(minutes)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});
