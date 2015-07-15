var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	config = require('../../config/config');

module.exports = function (app) {
	router.app = app;

  app.use('/config', router);
};

router.route('/')
	/* POST actions */
	.post(function (req, res) {
		config.app.randomData = req.body.randomData;

		res.status(204).send();
	});