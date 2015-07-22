var
	_ = require('underscore'),
	moment = require('moment-timezone'),
	pmongo = require('promised-mongo'),
	Promise = require('bluebird'),
	config = require('../../config/config');

var db = pmongo(config.db, ['metrics']);

/**
 * Represents a measure
 * @constructor
 * @param {string} metric - the name of the metric (e.g. 'number of events', 'temperature', 'number of critical exceptions')
 * @param {string} value - the value measured by a sensor (e.g. temperature) or 1 if the metric is a simple counter
 * @param {string} timestamp - the time at which the measure was taken
 */
var Measure = function (metric, value, timestamp) {
  this.metric = metric;
  this.value = value;
  this.timestamp = timestamp;
};


/**
 * Constructor for the service
 * @constructor
 */
var AnalyticsProvider = function (options) {

  /*
   * The analytics provider works in a specific timezone. This is important, for example, when defining
   * start and end date for a given interval. The timestamps associated to measures are always in UTC. The
   * start and end dates in the metrics documents are also in UTC. Hence, if the analytics provider works in
   * timezone 'Europe/Zurich' (UTC+1 in Winter, UTC+2 in Summer), then dates for the yearly metric document
   * of year 2011 are: start date: 2010-12-31 23:00:00.000Z, end date: 2011-12-31 22:59:59.999Z
   */
  if (options === undefined || options.timeZone === undefined) {
    this.timeZone = "CET";
  } else {
    this.timeZone = options.timeZone;
  }
};


AnalyticsProvider.prototype.getMetricsDescriptions = function() {
  var results = [];

  function extractData(collectionName, collection, count) {
    var metric = collectionName.substring('metrics.'.length);
    var lastDotIndex = metric.lastIndexOf('.');
    var urlPrefix = metric.substring(0, lastDotIndex);
    var granularity = metric.substring(lastDotIndex + 1);

	  var data = {
		  metric: metric,
		  collectionName: collectionName,
		  collection: collection,
		  count: count,
		  url: urlPrefix + '/' + granularity
	  };

	  return data;
  }

  function grabCollectionInformation(collectionName) {
    var col = db.collection(collectionName);

	  return col
		  .count()
	    .then(function(result) {
			  results.push(extractData(collectionName, col, result));
		  });
  }

  return db
	  .getCollectionNames()
	  .then(function(collectionNames) {
		  if (collectionNames.length > 0) {
			  return Promise
				  .resolve(collectionNames)
				  .each(function (collectionName) {
					  if (collectionName.indexOf('metrics.') === 0) {
						  return grabCollectionInformation(collectionName);
					  }
				  });
		  }
	  })
	  .then(function() {
		  return results;
	  });
};

/**
 * This function defines all the facets that we want to build for metrics. Today, a facet correspond to a time granularity
 * (daily, etc.), but in the future we might have facets based on other properties.
 */
AnalyticsProvider.prototype.getFacets = function (measure) {
  var facets = [];
  var ts = moment(measure.timestamp).tz(this.timeZone);

  facets.push({
    collection: 'metrics.' + measure.metric + '.yearly',
    header: {
      metric: measure.metric,
      facet: 'yearly',
      startDate: moment(ts).startOf('year').toDate(),
      endDate: moment(ts).endOf('year').toDate(),
      timeZone: this.timeZone
    },
    levels: [
      {
        position: 'total'
      },
      {
        position: 'monthly.' + ts.month()
      }
    ]
  });

  facets.push({
    collection: 'metrics.' + measure.metric + '.daily',
    header: {
      metric: measure.metric,
      facet: 'daily',
      startDate: moment(ts).startOf('day').toDate(),
      endDate: moment(ts).endOf('day').toDate(),
      timeZone: this.timeZone
    },
    levels: [
      {
        position: 'total'
      },
      {
        position: 'hourly.' + ts.hour()
      },
      {
        position: 'minutely.' + ts.hour() + '.' + ts.minute()
      }
    ]
  });

  facets.push({
    collection: 'metrics.' + measure.metric + '.hourly',
    header: {
      metric: measure.metric,
      facet: 'hourly',
      startDate: moment(ts).startOf('hour').toDate(),
      endDate: moment(ts).endOf('hour').toDate(),
      timeZone: this.timeZone
    },
    levels: [
      {
        position: 'total'
      },
      {
        position: 'minutely.' + ts.minute()
      },
      {
        position: 'secondly.' + ts.minute() + '.' + ts.second()
      }
    ]
  });

	facets.push({
   collection: 'metrics.' + measure.metric + '.minutely',
   header: {
     metric: measure.metric,
     facet: 'minutely',
     startDate: moment(ts).startOf('minute').toDate(),
     endDate: moment(ts).endOf('minute').toDate(),
     timeZone: this.timeZone
   },
   levels: [
     {
       position: 'total'
     },
     {
       position: 'secondly.' + ts.second()
     }
   ]
 });

  return facets;

};

/**
 * Call this function to update a metric, by reporting a measure. The function will update the mongodb documents
 * that are impacted by the mesaure.
 */
AnalyticsProvider.prototype.reportMeasure = function (measure) {
  var facets = this.getFacets(measure);

  for (var i = 0; i < facets.length; i++) {
    var facet = facets[i];

	  var delta = {
      $set: {},
      $inc: {},
      $min: {},
      $max: {},
      $push: {}
    };

	  delta.$set = {
      header: facet.header,
      lastMeasure : measure
    };

    delta.$push = {
      last5Measures : {
        $each: [ measure ],
        $slice: -5
      }
    };

	  for (var j = 0; j < facet.levels.length; j++) {
      var level = facet.levels[j];
      delta.$inc[level.position + '.count'] = 1;
      delta.$inc[level.position + '.sum'] = measure.value;
      delta.$min[level.position + '.min'] = measure.value;
      delta.$max[level.position + '.max'] = measure.value;
    }

    db
	    .collection(facet.collection)
	    .update({ header: delta.$set.header }, delta, { upsert: true })
	    .then(function (doc, lastErrorObject) {
				// TODO: See what we want to log exactly
	      //console.log(err);
	      //console.log(doc);
      });
  }
};

AnalyticsProvider.prototype.getMetrics = function (metric, granularity, startDate, endDate) {
  var collectionName = 'metrics.' + metric + '.' + granularity;
  var startOf;

	var selectedFields = {
    header: 1,
    total: 1,
    lastMeasure : 1,
    last5Measures : 1,
    _id: 0
  };

  switch (granularity) {
	  case 'minutely':
	    startOf = 'minute';
	    selectedFields.secondly = 1;
	    break;
	  case 'hourly':
	    startOf = 'hour';
	    selectedFields.minutely = 1;
	    break;
	  case 'daily':
	    startOf = 'day';
	    selectedFields.hourly = 1;
	    break;
    case 'yearly':
 	    startOf = 'year';
 	    selectedFields.monthly = 1;
 	    break;
  }

  var filter = {};

  if (startDate) {
    filter["header.startDate"] = { $gte: startDate.toDate() };
  }

  if (endDate) {
    filter['header.endDate'] = { $lte: endDate.toDate() };
  }

	// TODO: See what we want to log exactly
  //console.log(filter);
  //console.log(selectedFields);
  return db
	  .collection(collectionName)
	  .find(filter, selectedFields)
    .sort({ 'header.startDate': 1 });
};

exports.AnalyticsProvider = AnalyticsProvider;
exports.Measure = Measure;
