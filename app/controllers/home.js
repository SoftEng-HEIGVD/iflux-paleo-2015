var express = require('express'),
  router = express.Router();

module.exports = function (app) {
  app.use('/', router);
};

router.route('/partials/:page')
	.get(function (req, res, next) {
		res.render('partials/' + req.params.page);
	});

router.route('/*')
	.get(function(req, res, next) {
		res.render('layout');
	});


