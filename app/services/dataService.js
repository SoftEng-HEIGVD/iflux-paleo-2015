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
}, {
  max: 10080,
  granularity: 120
}];

var actionsReceived = {
  entries: 0,
  exits: 0
};

module.exports = {
  collectAction: function(action) {
    if (action.type == config.app.actionTypes.carIn) {
      actionsReceived.entries += 1;
    }
    else if (action.type == config.app.actionTypes.carOut) {
      actionsReceived.exits++;
    }
  },

	getEvolution: function(minutes) {
		var endDate;
    var startDate;

    if (minutes == 'paleo') {
      endDate = moment('2015-07-27');
      startDate = moment(endDate).subtract(7, 'days');
    }
    else {
      endDate = moment();
      startDate = moment(endDate).subtract(minutes, 'minutes');
    }

		var promise = Promise
			.resolve({
				carsIn: {},
				carsOut: {}
			})

			.then(function(memo) {
        if (minutes == 'paleo') {
          memo.scale = scales[scales.length - 1];
        }
        else {
          memo.scale = _.find(scales, function (scale) {
            return minutes <= scale.max;
          });
        }

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
						var diffDurationInMinutes = moment(endDate).diff(moment(randDate), 'minutes');
						var idx = Math.floor(diffDurationInMinutes / memo.scale.granularity);

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
            var diffDurationInMinutes = moment(endDate).diff(moment(randDate), 'minutes');
            var idx = Math.floor(diffDurationInMinutes / memo.scale.granularity);

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
						.getMetrics('ch.heigvd.iflux.paleo2015.entries', 'minutely', startDate)
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
						.getMetrics('ch.heigvd.iflux.paleo2015.exits', 'minutely', startDate)
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
	},

	getTiles: function(type) {
		var days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

		var promise = Promise.resolve({});

		if (config.app.randomData) {
			promise = promise
				.then(function(memo) {

					var startDay = randomInt(0, 7);

					var max = 0;

					for (var i = 0; i < 7; i++) {
						memo[i] = { day: days[(i + startDay) % 7], values: [] };

						for (var j = 0; j < 24; j++) {
							memo[i].values.push(randomInt(0, 10));

							if (memo[i].values[j] > max) {
								max = memo[i].values[j];
							}
						}
					}

					return { tiles: memo, min: 0, max: max };
				})
		}
		else {
      if (type != 'total') {
        promise = promise
          .then(function (memo) {
            var endDate = moment();
            var startDate = moment(endDate).subtract(7, 'days');

            return analyticsProvider
              .getMetrics('ch.heigvd.iflux.paleo2015.' + type, 'daily', startDate)
              .then(function (metrics) {
                var countDays = 0;
                var max = 0;

                _.each(metrics, function (metric) {
                  var date = moment(metric.header.startDate);
                  var dayNumber = date.day();
                  memo[countDays] = {day: days[dayNumber], values: []};

                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      memo[countDays].values.push(metric.hourly[i].sum);

                      if (memo[countDays].values[i] > max) {
                        max = memo[countDays].values[i];
                      }
                    }
                    else {
                      memo[countDays].values.push(0);
                    }
                  }

                  countDays++;
                });

                return {tiles: memo, min: 0, max: max};
              });
          });
      }
      else {
        var endDate = moment();
        var startDate = moment(endDate).subtract(7, 'days');

        promise = promise
          .then(function (memo) {
            return analyticsProvider
              .getMetrics('ch.heigvd.iflux.paleo2015.entries', 'daily', startDate)
              .then(function(entries) {
                var countDays = 0;
                var result = {};

                _.each(entries, function (metric) {
                  var date = moment(metric.header.startDate);
                  var dayNumber = date.day();
                  result[countDays] = {day: days[dayNumber], values: []};

                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      result[countDays].values.push(metric.hourly[i].sum);
                    }
                    else {
                      result[countDays].values.push(0);
                    }
                  }

                  countDays++;
                });

                memo.entries = result;

                return memo;
              });
          })
          .then(function (memo) {
            return analyticsProvider
              .getMetrics('ch.heigvd.iflux.paleo2015.exits', 'daily', startDate)
              .then(function(exits) {
                var countDays = 0;
                var result = {};

                _.each(exits, function (metric) {
                  var date = moment(metric.header.startDate);
                  var dayNumber = date.day();
                  result[countDays] = {day: days[dayNumber], values: []};

                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      result[countDays].values.push(metric.hourly[i].sum);
                    }
                    else {
                      result[countDays].values.push(0);
                    }
                  }

                  countDays++;
                });

                memo.exits = result;

                return memo;
              })
          })
          .then(function (memo) {
            var max = 0;
            var result = {};

            for (var i = 0; i < _.keys(memo.entries).length; i++) {
              result[i] = { day: memo.entries[i].day, values: [] };

              for (var j = 0; j < 24; j++) {
                var total = memo.entries[i].values[j] - memo.exits[i].values[j];
                result[i].values.push(total < 0 ? 0 : total);

                if (total > max) {
                  max = total;
                }
              }
            }

            return {tiles: result, min: 0, max: max};
          });
      }
		}

		return promise;
	},

  getMovements: function() {
    var promise = Promise.resolve();

    if (config.app.randomData) {
      promise = promise.then(function() {
        return {
          entries: randomInt(0, 10),
          exits: randomInt(0, 10)
        };
      });
    }
    else {
      promise = promise.then(function() {
        return actionsReceived;
      });
    }

    return promise;
  }
};