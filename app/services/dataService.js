var
	_ = require('underscore'),
	Promise = require('bluebird'),
	fs = require('fs'),
	moment = require('moment'),
	config = require('../../config/config'),
	AnalyticsProvider = require('./analytics').AnalyticsProvider;

var analyticsProvider = new AnalyticsProvider(config);

// TODO: Remove the following
function random (low, high) {
	return Math.random() * (high - low) + low;
}

function randomInt (low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}

// TODO: NOT USED YET!
function randomDate(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
// TODO: End of the following


var scales = [{
	max: 60,
	granularity: 1
}, {
	max: 360,
	granularity: 5
}, {
	max: 720,
	granularity: 15
}, {
	max: 1440,
	granularity: 30
}];

module.exports = {
	getEvolution: function(minutes) {
		var endDate = moment();
		var startDate = moment(endDate).subtract(minutes, 'minutes');

		var promise = Promise
			.resolve({
				carsIn: {},
				carsOut: {}
			})

			.then(function(memo) {
				memo.scale = _.find(scales, function (scale) {
					return minutes <= scale.max;
				});

				return memo;
			});

		if (config.app.randomData) {
			promise = promise
				.then(function(memo) {
					memo.nbCarsIn =  randomInt(150, 250);
					memo.nbCarsOut = randomInt(150, 250);
					memo.minDate = startDate.toDate();
					memo.maxDate = endDate.toDate();

					return memo;
				})

				.then(function(memo) {
					var carsIn = {};
					for (var i = 0; i < memo.nbCarsIn; i++) {
						var randDate = randomDate(memo.minDate, memo.maxDate);
						var calcDate = moment(endDate).subtract(moment(randDate));
						var idx = Math.floor(moment.duration(calcDate).asMinutes() / memo.scale.granularity);

						if (!carsIn[idx]) {
							carsIn[idx] = 0;
						}

						carsIn[idx]++;
					}

					memo.carsIn = _.reduce(carsIn, function (memo, val, key) {
						memo[parseInt(key)] = val;
						return memo;
					}, {});

					return memo;
				})

				.then(function(memo) {
					var carsOut = {};
					for (var i = 0; i < memo.nbCarsOut; i++) {
						var randDate = randomDate(memo.minDate, memo.maxDate);
						var calcDate = moment(endDate).subtract(moment(randDate));
						var idx = Math.floor(moment.duration(calcDate).asMinutes() / memo.scale.granularity);

						if (!carsOut[idx]) {
							carsOut[idx] = 0;
						}

						carsOut[idx]++;
					}

					memo.carsOut = _.reduce(carsOut, function(memo, val, key) {
						memo[parseInt(key)] = val;
						return memo;
					}, {});

					return memo;
				});
		}
		else {
			promise = promise
				.then(function (memo) {
					var nbSamples = memo.scale.max / memo.scale.granularity;

					return analyticsProvider
						.getMetrics('ch.heigvd.iflux.paleo2015.westEntry.carsIn', 'minutely', startDate)
						.then(function (metrics) {
							_.each(metrics, function (metric) {
								var calcDate = moment(endDate).subtract(moment(metric.header.startDate));
								var idx = nbSamples - Math.floor(moment.duration(calcDate).asMinutes() / memo.scale.granularity);

								if (!memo.carsIn[idx]) {
									memo.carsIn[idx] = 0;
								}

								memo.carsIn[idx] += _.reduce(metric.secondly, function (memo, second) {
									return memo + second.sum;
								}, 0);
							});

							for (var i = 0; i < nbSamples; i++) {
								if (!memo.carsIn[i]) {
									memo.carsIn[i] = 0;
								}
							}

							memo.carsIn = _.reduce(memo.carsIn, function (memo, val, key) {
								//memo.push({ tick: parseInt(key), nbCars: val });
								memo[parseInt(key)] = val;
								return memo;
							}, {});

							return memo;
						});
				})

				.then(function (memo) {
					var nbSamples = memo.scale.max / memo.scale.granularity;

					return analyticsProvider
						.getMetrics('ch.heigvd.iflux.paleo2015.westEntry.carsOut', 'minutely', startDate)
						.then(function (metrics) {
							_.each(metrics, function (metric) {
								var calcDate = moment(endDate).subtract(moment(metric.header.startDate));
								var idx = nbSamples - Math.floor(moment.duration(calcDate).asMinutes() / memo.scale.granularity);

								if (!memo.carsOut[idx]) {
									memo.carsOut[idx] = 0;
								}

								memo.carsOut[idx] += _.reduce(metric.secondly, function (memo, second) {
									return memo + second.sum;
								}, 0);
							});

							for (var i = 0; i < nbSamples; i++) {
								if (!memo.carsOut[i]) {
									memo.carsOut[i] = 0;
								}
							}

							memo.carsOut = _.reduce(memo.carsOut, function (memo, val, key) {
								memo[parseInt(key)] = val;
								return memo;
							}, {});

							return memo;
						});
				})
		}

		return promise
			.then(function(memo) {

				return {
					granularity: memo.scale.granularity,
					carsIn: memo.carsIn,
					carsOut: memo.carsOut
				};
			});
	}
};