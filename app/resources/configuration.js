var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	config = require('../../config/config'),
	viewConfigService = require('../services/viewConfigService');

module.exports = function (app) {
  app.use('/configure', router);
};

router.route('/')
	.post(function (req, res) {
		if (req.body.target) {
			viewConfigService.upsert(req.body.target, req.body.properties);
		}

		return res.status(204).end();
	});
