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

	getEvolution: function(minutes, randomData) {
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

		if (randomData) {
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

	getTiles: function(type, randomData) {
		var days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

		var promise = Promise.resolve({});

		if (randomData) {
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
            var endDate = moment().hour(23).minute(59).second(59).millisecond(999);
            var startDate = moment(endDate).subtract(7, 'days').hour(0).minute(0).second(0).millisecond(0);

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

  getMovements: function(randomData) {
    var promise = Promise.resolve();

    if (randomData) {
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
  },

  getDaysAggregation: function(startDate, endDate, randomData) {
    var startDateMoment = moment(startDate, 'YYYY-MM-DD').hour(0).minute(0).second(0).millisecond(0);
    var endDateMoment = moment(endDate, 'YYYY-MM-DD').hour(23).minute(59).second(59).millisecond(999);
    var diffDurationInDays = endDateMoment.diff(startDateMoment, 'days');

    var promise = Promise.resolve();

    if (randomData) {
      promise = promise.then(function() {
        var result = [];

        _.each(['Car entries', 'Car exits'], function(title) {
          var data = {
            name: title,
            values: []
          };

          for (var i = 0; i <= diffDurationInDays; i++) {
            data.values.push(randomInt(0, 750));
          }

          result.push(data);
        });

        var totalCars = {
          name: 'Total cars in parking',
          values: []
        };

        var totalMovements = {
          name: 'Total cars entries and exits',
          values: []
        };

        for (var i = 0; i <= diffDurationInDays; i++) {
          totalCars.values[i] = result[0].values[i] >= result[1].values[i] ? result[0].values[i] - result[1].values[i] : 0;
          totalMovements.values[i] = result[0].values[i] + result[1].values[i];
        }

        result.push(totalCars, totalMovements);

        return result;
      });
    }
    else {
      promise = promise
        .then(function() { return []; })
        .then(function (finalResult) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.entries', 'daily', startDateMoment, endDateMoment)
            .then(function(entries) {
              var result = {
                name: 'Car entries',
                values: []
              };

              _.each(entries, function(metric) {
                var metricDate = moment(metric.header.startDate);
                var diffDate = metricDate.diff(startDateMoment, 'days');
                result.values[diffDate] = metric.total.sum;
              });

              for (var i = 0; i <= diffDurationInDays; i++) {
                if (_.isUndefined(result.values[i])) {
                  result.values[i] = 0;
                }
              }

              finalResult.push(result);

              return finalResult;
            });
        })
        .then(function (finalResult) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.exits', 'daily', startDateMoment, endDateMoment)
            .then(function(exits) {
              var result = {
                name: 'Car exits',
                values: []
              };

              _.each(exits, function(metric) {
                var metricDate = moment(metric.header.startDate);
                var diffDate = metricDate.diff(startDateMoment, 'days');
                result.values[diffDate] = metric.total.sum;
              });

              for (var i = 0; i <= diffDurationInDays; i++) {
                if (_.isUndefined(result.values[i])) {
                  result.values[i] = 0;
                }
              }

              finalResult.push(result);

              return finalResult;
            })
        })
        .then(function (finalResult) {
          var totalCars = {
            name: 'Total cars in parking',
            values: []
          };

          var totalMovements = {
            name: 'Total cars entries and exits',
            values: []
          };

          for (var i = 0; i <= diffDurationInDays; i++) {
            totalCars.values[i] = finalResult[0].values[i] >= finalResult[1].values[i] ? finalResult[0].values[i] - finalResult[1].values[i] : 0;
            totalMovements.values[i] = finalResult[0].values[i] + finalResult[1].values[i];
          }

          finalResult.push(totalCars, totalMovements);

          return finalResult;
        });
    }

    return promise;
  },

  getFacts: function(start, end, randomData) {
    var startDate = moment(start).hour(0).minute(0).second(0).millisecond(0);
    var endDate = moment(end).hour(23).minute(59).second(59).millisecond(999);

    var promise = Promise.resolve();

    if (randomData) {
      promise = promise.then(function() {
        return {
          total: {
            entries: randomInt(1500, 10000),
            exits: randomInt(1500, 10000),
            movements: randomInt(3000, 20000)
          },
          facts: {
            entries: {
              maxDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              maxHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              }
            },
            exits: {
              maxDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              maxHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              }
            },
            movements: {
              maxDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minDay: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              maxHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              },
              minHour: {
                date: randomDate(startDate.toDate(), endDate.toDate()),
                value: randomInt(1000, 1500)
              }
            }
          }
        };
      });
    }
    else {
      promise = promise
        .then(function() {
          return {
            total: {},
            facts: {
              entries: {},
              exits: {},
              movements: {}
            }
          };
        })

        .then(function (stats) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.entries', 'yearly')
            .then(function(entries) {
              stats.total.entries = 0;

              _.each(entries, function(metric) {
                stats.total.entries += metric.total.sum;
              });

              return stats;
            });
        })

        .then(function (stats) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.exits', 'yearly')
            .then(function(exits) {
              stats.total.exits = 0;

              _.each(exits, function(metric) {
                stats.total.exits += metric.total.sum;
              });

              return stats;
            });
        })

        .then(function(stats) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.entries', 'daily', startDate, endDate)
            .then(function(entries) {
              // Analyze daily
              var
                max = 0, min = Number.MAX_SAFE_INTEGER, maxDate = undefined, minDate = undefined,
                maxHour = 0, minHour = Number.MAX_SAFE_INTEGER, maxHourDate = undefined, minHourDate = undefined;
              _.each(entries, function(dailyEntry) {
                if (dailyEntry.total.sum > max) {
                  max = dailyEntry.total.sum;
                  maxDate = moment(dailyEntry.header.startDate);
                }

                if (dailyEntry.total.sum < min) {
                  min = dailyEntry.total.sum;
                  minDate = moment(dailyEntry.header.startDate);
                }

                for (var i = 0; i < 24; i++) {
                  if (dailyEntry.hourly[i]) {
                    if (dailyEntry.hourly[i].sum > maxHour) {
                      maxHour = dailyEntry.hourly[i].sum;
                      maxHourDate = moment(dailyEntry.header.startDate).add(i, 'hours');
                    }

                    if (dailyEntry.hourly[i].sum < minHour) {
                      minHour = dailyEntry.hourly[i].sum;
                      minHourDate = moment(dailyEntry.header.startDate).add(i, 'hours');
                    }
                  }
                }
              });

              stats.facts.entries = {
                maxDay: { date: maxDate ? maxDate.toDate() : '', value: max },
                minDay: { date: minDate ? minDate.toDate() : '', value: min == Number.MAX_SAFE_INTEGER ? 0 : min },
                maxHour: { date: maxHourDate ? maxHourDate.toDate() : '', value: maxHour },
                minHour: { date: minHourDate ? minHourDate.toDate() : '', value: minHour == Number.MAX_SAFE_INTEGER ? 0 : minHour}
              };

              return stats;
            });
        })

        .then(function(stats) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.exits', 'daily', startDate, endDate)
            .then(function(exits) {
              // Analyze daily
              var
                max = 0, min = Number.MAX_SAFE_INTEGER, maxDate = undefined, minDate = undefined,
                maxHour = 0, minHour = Number.MAX_SAFE_INTEGER, maxHourDate = undefined, minHourDate = undefined;
              _.each(exits, function(dailyExit) {
                if (dailyExit.total.sum > max) {
                  max = dailyExit.total.sum;
                  maxDate = moment(dailyExit.header.startDate);
                }

                if (dailyExit.total.sum < min) {
                  min = dailyExit.total.sum;
                  minDate = moment(dailyExit.header.startDate)
                }

                for (var i = 0; i < 24; i++) {
                  if (dailyExit.hourly[i]) {
                    if (dailyExit.hourly[i].sum > maxHour) {
                      maxHour = dailyExit.hourly[i].sum;
                      maxHourDate = moment(dailyExit.header.startDate).add(i, 'hours');
                    }

                    if (dailyExit.hourly[i].sum < minHour) {
                      minHour = dailyExit.hourly[i].sum;
                      minHourDate = moment(dailyExit.header.startDate).add(i, 'hours');
                    }
                  }
                }
              });

              stats.facts.exits = {
                maxDay: { date: maxDate ? maxDate.toDate() : '', value: max },
                minDay: { date: minDate ? minDate.toDate() : '', value: min == Number.MAX_SAFE_INTEGER ? 0 : min },
                maxHour: { date: maxHourDate ? maxHourDate.toDate() : '', value: maxHour },
                minHour: { date: minHourDate ? minHourDate.toDate() : '', value: minHour == Number.MAX_SAFE_INTEGER ? 0 : minHour}
              };

              return stats;
            });
        })

        .then(function(stats) {
          return analyticsProvider
            .getMetrics('ch.heigvd.iflux.paleo2015.movements', 'daily', startDate, endDate)
            .then(function(movements) {
              // Analyze daily
              var
                max = 0, min = Number.MAX_SAFE_INTEGER, maxDate = undefined, minDate = undefined,
                maxHour = 0, minHour = Number.MAX_SAFE_INTEGER, maxHourDate = undefined, minHourDate = undefined;
              _.each(movements, function(dailyMovement) {
                if (dailyMovement.total.sum > max) {
                  max = dailyMovement.total.sum;
                  maxDate = moment(dailyMovement.header.startDate);
                }

                if (dailyMovement.total.sum < min) {
                  min = dailyMovement.total.sum;
                  minDate = moment(dailyMovement.header.startDate);
                }

                for (var i = 0; i < 24; i++) {
                  if (dailyMovement.hourly[i]) {
                    if (dailyMovement.hourly[i].sum > maxHour) {
                      maxHour = dailyMovement.hourly[i].sum;
                      maxHourDate = moment(dailyMovement.header.startDate).add(i, 'hours');
                    }

                    if (dailyMovement.hourly[i].sum < minHour) {
                      minHour = dailyMovement.hourly[i].sum;
                      minHourDate = moment(dailyMovement.header.startDate).add(i, 'hours');
                    }
                  }
                }
              });

              stats.facts.movements = {
                maxDay: { date: maxDate ? maxDate.toDate() : '', value: max },
                minDay: { date: minDate ? minDate.toDate() : '', value: min == Number.MAX_SAFE_INTEGER ? 0 : min },
                maxHour: { date: maxHourDate ? maxHourDate.toDate() : '', value: maxHour },
                minHour: { date: minHourDate ? minHourDate.toDate() : '', value: minHour == Number.MAX_SAFE_INTEGER ? 0 : minHour}
              };

              return stats;
            });
        })

        .then(function(stats) {
          stats.total.movements = stats.total.entries + stats.total.exits;

          return stats;
        });
    }

    return promise;
  }
};