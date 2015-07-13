var express = require('express'),
  router = express.Router();

module.exports = function (app) {
  app.use('/', router);
};

router.route('/partials/*')
	.get(function (req, res, next) {
		res.render('partials/' + req.url.replace('/partials/', ''));
	});

router.route('/*')
	.get(function(req, res, next) {
		res.render('layout');
	});


