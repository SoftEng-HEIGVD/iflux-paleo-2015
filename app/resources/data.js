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
			.getEvolution(minutes, req.query.randomData)
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
			.getTiles(minutes, req.query.randomData)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});

router.route('/movements')
	.get(function(req, res, next) {
		return dataService
			.getMovements(req.query.randomData)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});

router.route('/daysAggregation')
	.get(function(req, res, next) {
    var startDate = req.query.startDate ? req.query.startDate : '2015-07-20';
    var endDate = req.query.endDate ? req.query.endDate : '2015-07-26';

		return dataService
			.getDaysAggregation(startDate, endDate, req.query.randomData)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});

router.route('/facts')
	.get(function(req, res, next) {
    var startDate = req.query.startDate ? req.query.startDate : '2015-07-20';
    var endDate = req.query.endDate ? req.query.endDate : '2015-07-26';

		return dataService
			.getFacts(startDate, endDate, req.query.randomData)
			.then(function(result) {
				return res.status(200).json(result).end();
			})
			.error(function(err) {
				return next(err);
			})
	});

router.route('/random')
  .post(function(req, res, next) {
    if (req.body.add) {
      return dataService
        .addGeneratedData(req.body)
        .then(function () {
          return res.status(200).json({message: 'data generation added.'}).end();
        });
    }
    else {
      return dataService
        .generateData(req.body)
        .then(function () {
          return res.status(200).json({message: 'data generated.'}).end();
        });
    }
  })

  .delete(function(req, res, next) {
    return dataService
      .dropData()
      .then(function() {
        return res.status(200).json({ message: 'data erased.' }).end();
      });
  });