var
	_ = require('underscore'),
	express = require('express'),
	router = express.Router(),
	config = require('../../config/config'),
	actionService = require('../services/actionService');

module.exports = function (app) {
  app.use('/actions', router);
};

router.route('/')
	/* POST actions */
	.post(function (req, res) {
  	var actions = req.body;

  	console.log('Received %s actions.', actions.length);

		_.each(actions, function(action) {
			console.log('Consider action: %s', action.type);
			if (action.type === config.app.actionTypes.carIn || action.type === config.app.actionTypes.carOut) {
				console.log('Process action: %s', action.type);
				actionService.store(action);
			}
		});

		res.status(204).send();
	});