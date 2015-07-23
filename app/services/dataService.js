var
	_ = require('underscore'),
	Promise = require('bluebird'),
	fs = require('fs'),
	moment = require('moment'),
	config = require('../../config/config'),
	AnalyticsProvider = require('./analytics').AnalyticsProvider,
  Measure = require('./analytics').Measure;

var analyticsProvider = new AnalyticsProvider(config);

function random (low, high) {
	return Math.random() * (high - low) + low;
}

function randomInt (low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}

function randomDate(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getCollectionName(collectionName, random) {
  if (random) {
    return COLLECTION_PREFIX + RAND_COLLECTION_SUFFIX + '.' + collectionName
  }
  else {
    return COLLECTION_PREFIX + '.' + collectionName
  }
}

var STD_FORMAT_DATE = 'DD.MM.YY';
var COLLECTION_PREFIX = 'ch.heigvd.iflux.paleo2015';
var RAND_COLLECTION_SUFFIX = '.rand';

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

var randomActionsReceived = {
  entries: 0,
  exits: 0
};

module.exports = {
  dropData: function() {
    return analyticsProvider.dropCollectionByPrefix(COLLECTION_PREFIX + RAND_COLLECTION_SUFFIX);
  },

  generateData: function(options) {
    return Promise
      .resolve()
      .then(function() {
        var randDate, asMinutes;

        var startDate = moment(options.startDate).startOf('day');
        var endDate = moment(options.endDate).endOf('day');

        var nbCars = randomInt(options.nbCarsMin, options.nbCarsMax);

        var entryDates = [];

        // Generate the entries dates and values
        for (var i = 0; i < nbCars; i++) {
          randDate = moment(randomDate(startDate.toDate(), endDate.toDate()));

          asMinutes = Math.floor(moment.duration(randDate).asMinutes());

          // Check if the date has already been generated
          var found = _.find(entryDates, function(info) {
            return info.asMinutes == asMinutes;
          });

          // Create a new entry
          if (!found) {
            entryDates.push({
              date: randDate,
              asMinutes: asMinutes,
              value: 1
            });
          }

          // Update the entry
          else {
            found.value++;
          }
        }

        // Sort the entries by date
        entryDates = _.sortBy(entryDates, 'asMinutes');

        var cumulativeEntries = [];

        // Process the entries to generate the measures
        _.each(entryDates, function(info) {
          // Create a cumulative entries cache
          if (cumulativeEntries.length > 0) {
            cumulativeEntries.push({
              date: info.date,
              asMinutes: info.asMinutes,
              value: info.value + cumulativeEntries[cumulativeEntries.length - 1].value
            });
          }
          else {
            cumulativeEntries.push({
              date: info.date,
              asMinutes: info.asMinutes,
              value: info.value
            });
          }

          // Store the measures
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.entries', info.value, info.date.toDate()));
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.movements', info.value, info.date.toDate()));
        });

        // Generate the exits
        for (var i = 0; i < nbCars; i++) {
          // Generate the date
          randDate = moment(randomDate(startDate.toDate(), endDate.toDate()));
          asMinutes = Math.floor(moment.duration(randDate).asMinutes());

          // Find the nearest date
          var cumulativeFound, idx;
          for (var j = 0; j < cumulativeEntries.length; j++) {
            // Store each cumulative entry until one does not match
            if (asMinutes > cumulativeEntries[j].asMinutes) {
              cumulativeFound = cumulativeEntries[j];
              idx = j;
            }
            // Cumulative entry found
            else {
              break;
            }
          }

          // Check the validity of the cumulative
          if (cumulativeFound && cumulativeFound.value - 1 >= 0) {
            // Update the counters
            analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.exits', 1, randDate.toDate()));
            analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.movements', 1, randDate.toDate()));

            // Update the cumulatives
            for (var k = idx; k < cumulativeEntries.length; k++) {
              cumulativeEntries[k].value--;
            }
          }

          // Not possible to use this date, try to generate new one
          else {
            i--;
          }
        }
    });
  },

  addGeneratedData: function(options) {
    var self = this;

    return Promise
      .resolve({})
      .then(function(memo) {
         return analyticsProvider
           .getMetrics(getCollectionName('entries', true), 'yearly')
           .then(function (metrics) {
             var sum = 0;
             _.each(metrics, function(metric) {
               sum += metric.total.sum;
             });

             memo.entries = sum;
             return memo;
           });
      })

      .then(function(memo) {
         return analyticsProvider
           .getMetrics(getCollectionName('exits', true), 'yearly')
           .then(function (metrics) {
             var sum = 0;
             _.each(metrics, function(metric) {
               sum += metric.total.sum;
             });

             memo.exits = sum;
             return memo;
           });
      })

      .then(function(memo) {
        var remainingCars = memo.entries - memo.exits;

        // Prepare the start and end dates
        var startDate = moment().startOf('minute').toDate();
        var endDate = moment(startDate).endOf('minute').toDate();

        // Generate the number of cars in
        var nbCarsIn = randomInt(options.nbCarsMin, options.nbCarsMax);

        // Generate the cars in
        for (var i = 0; i < nbCarsIn; i++) {
          // Generate the date
          var randDate = randomDate(startDate, endDate);

          // Store the measures
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.entries', 1, randDate));
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.movements', 1, randDate));
        }

        // Generate the number of cars out
        var nbCarsOut = remainingCars + nbCarsIn;
        nbCarsOut = nbCarsOut > options.nbCarsMin ? randomInt(options.nbCarsMin, nbCarsOut) : 0;

        // Generate the cars out
        for (var i = 0; i < nbCarsOut; i++) {
          // Generate the date
          var randDate = randomDate(startDate, endDate);

          // Store the measures
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.exits', 1, randDate));
          analyticsProvider.reportMeasure(new Measure('ch.heigvd.iflux.paleo2015.rand.movements', 1, randDate));
        }

        randomActionsReceived = {
          entries: randomActionsReceived.entries + nbCarsIn,
          exits: randomActionsReceived.exits + nbCarsOut
        };
      });
  },

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
      endDate = moment('2015-07-26').tz(analyticsProvider.timeZone).endOf('day');
      startDate = moment(endDate).subtract(6, 'days').startOf('day');

    }
    else {
      endDate = moment().tz(analyticsProvider.timeZone);
      startDate = moment(endDate).subtract(minutes, 'minutes');
    }

		return Promise
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
			})

      .then(function (memo) {
        var nbSamples = memo.scale.max / memo.scale.granularity;
        var ratio = nbSamples / memo.scale.max;

        return analyticsProvider
          .getMetrics(getCollectionName('entries', randomData), 'minutely', startDate, endDate)
          .then(function (metrics) {
            _.each(metrics, function (metric) {
              var diffDateInMilliseconds = moment(metric.header.startDate).diff(startDate);
              var idx = Math.floor(ratio * moment.duration(diffDateInMilliseconds).asMinutes());

              if (memo.carsIn[idx]) {
                memo.carsIn[idx] += metric.total.sum;
              }
              else {
                memo.carsIn[idx] = metric.total.sum;
              }
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
        var ratio = nbSamples / memo.scale.max;

        return analyticsProvider
          .getMetrics(getCollectionName('exits', randomData), 'minutely', startDate)
          .then(function (metrics) {
            _.each(metrics, function (metric) {
              var diffDateInMilliseconds = moment(metric.header.startDate).diff(startDate);
              var idx = Math.floor(ratio * moment.duration(diffDateInMilliseconds).asMinutes());

              if (memo.carsOut[idx]) {
                memo.carsOut[idx] += metric.total.sum;
              }
              else {
                memo.carsOut[idx] = metric.total.sum;
              }
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

      .then(function(memo) {
        return {
          granularity: memo.scale.granularity,
          carsIn: memo.carsIn,
          carsOut: memo.carsOut
        };
      });
	},

	getTiles: function(type, randomData) {
		var promise = Promise.resolve({});

    if (type != 'total') {
      promise = promise
        .then(function (result) {
          var endDate = moment().tz(analyticsProvider.timeZone).endOf('day');
          var startDate = moment(endDate).startOf('day').subtract(6, 'days');

          var nbDays = endDate.diff(startDate, 'days');

          return analyticsProvider
            .getMetrics(getCollectionName(type, randomData), 'daily', startDate, endDate)
            .then(function (metrics) {
              var max = 0;

              for (var i = 0; i <= nbDays; i++) {
                result[i] = {
                  day: moment(startDate).add(i, 'days').format(STD_FORMAT_DATE),
                  values: Array.apply(null, Array(24)).map(Number.prototype.valueOf, 0)
                }
              }

              _.each(metrics, function (metric) {
                var date = moment(metric.header.startDate).tz(analyticsProvider.timeZone).startOf('day').format(STD_FORMAT_DATE);

                var idx =_.reduce(result, function(memo, val, index) {
                  if (val.day == date) {
                    memo = index;
                  }
                  return memo;
                }, -1);

                if (idx > -1) {
                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      result[idx].values[i] = metric.hourly[i].sum;

                      if (result[idx].values[i] > max) {
                        max = result[idx].values[i];
                      }
                    }
                  }
                }
              });

              return {tiles: result, min: 0, max: max};
            });
        });
    }
    else {
      var endDate = moment().tz(analyticsProvider.timeZone).endOf('day');
      var startDate = moment(endDate).subtract(6, 'days').startOf('day');
      var nbDays = endDate.diff(startDate, 'days');

      promise = promise
        .then(function (memo) {
          return analyticsProvider
            .getMetrics(getCollectionName('entries', randomData), 'daily', startDate, endDate)
            .then(function(entries) {
              var result = {};

              for (var i = 0; i <= nbDays; i++) {
                result[i] = {
                  day: moment(startDate).add(i, 'days').format(STD_FORMAT_DATE),
                  values: Array.apply(null, Array(24)).map(Number.prototype.valueOf, 0)
                }
              }

              _.each(entries, function (metric) {
                var date = moment(metric.header.startDate).tz(analyticsProvider.timeZone).startOf('day').format(STD_FORMAT_DATE);

                var idx =_.reduce(result, function(memo, val, index) {
                  if (val.day == date) {
                    memo = index;
                  }
                  return memo;
                }, -1);

                if (idx > -1) {
                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      result[idx].values[i] = metric.hourly[i].sum;
                    }
                  }
                }
              });

              memo.entries = result;

              return memo;
            });
        })
        .then(function (memo) {
          return analyticsProvider
            .getMetrics(getCollectionName('exits', randomData), 'daily', startDate, endDate)
            .then(function(exits) {
              var result = {};

              for (var i = 0; i <= nbDays; i++) {
                result[i] = {
                  day: moment(startDate).add(i, 'days').format(STD_FORMAT_DATE),
                  values: Array.apply(null, Array(24)).map(Number.prototype.valueOf, 0)
                }
              }

              _.each(exits, function (metric) {
                var date = moment(metric.header.startDate).tz(analyticsProvider.timeZone).startOf('day').format(STD_FORMAT_DATE);

                var idx =_.reduce(result, function(memo, val, index) {
                  if (val.day == date) {
                    memo = index;
                  }
                  return memo;
                }, -1);

                if (idx > -1) {
                  for (var i = 0; i < 24; i++) {
                    if (metric.hourly && metric.hourly[i]) {
                      result[idx].values[i] = metric.hourly[i].sum;
                    }
                  }
                }
              });

              memo.exits = result;

              return memo;
            })
        })
        .then(function (memo) {
          var max = 0;
          var result = {};

          for (var i = 0; i <= nbDays; i++) {
            result[i] = { day: memo.entries[i].day, values: [] };

            for (var j = 0; j < 24; j++) {
              var total = memo.entries[i].values[j] - memo.exits[i].values[j];
              result[i].values[j] = total < 0 ? 0 : total;

              if (total > max) {
                max = total;
              }
            }
          }

          return {
            tiles: result,
            min: 0,
            max: max
          };
        });
    }

		return promise;
	},

  getMovements: function(randomData) {
    return Promise
      .resolve()
      .then(function() {
        return randomData ? randomActionsReceived : actionsReceived;
      });
  },

  getDaysAggregation: function(startDate, endDate, randomData) {
    var startDateMoment = moment(startDate, 'YYYY-MM-DD').tz(analyticsProvider.timeZone).startOf('day');
    var endDateMoment = moment(endDate, 'YYYY-MM-DD').tz(analyticsProvider.timeZone).endOf('day');
    var diffDurationInDays = endDateMoment.diff(startDateMoment, 'days');

    return Promise
      .resolve()
      .then(function() { return []; })
      .then(function (finalResult) {
        return analyticsProvider
          .getMetrics(getCollectionName('entries', randomData), 'daily', startDateMoment, endDateMoment)
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
          .getMetrics(getCollectionName('exits', randomData), 'daily', startDateMoment, endDateMoment)
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
  },

  getFacts: function(start, end, randomData) {
    var startDate = moment(start).tz(analyticsProvider.timeZone).startOf('day');
    var endDate = moment(end).tz(analyticsProvider.timeZone).endOf('day');

    return Promise
      .resolve()
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
          .getMetrics(getCollectionName('entries', randomData), 'yearly')
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
          .getMetrics(getCollectionName('exits', randomData), 'yearly')
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
          .getMetrics(getCollectionName('entries', randomData), 'daily', startDate, endDate)
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
          .getMetrics(getCollectionName('exits', randomData), 'daily', startDate, endDate)
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
                minDate = moment(dailyExit.header.startDate);
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
          .getMetrics(getCollectionName('movements', randomData), 'daily', startDate, endDate)
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
};