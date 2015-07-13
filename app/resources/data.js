var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	actionService = require('../services/actionService'),
	viewConfigService = require('../services/viewConfigService');

module.exports = function (app) {
  app.use('/data', router);
};

router.route('/maps')
	.get(function(req, res, next) {
		res.status(200).json(viewConfigService.getMaps()).end();
	});

router.route('/maps/:mapId')
	.get(function (req, res) {
		res.status(200).json(actionService.getMap(req.params.mapId)).end();
	});