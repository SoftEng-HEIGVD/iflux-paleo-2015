var app = angular.module('demoapp', ['ui.router']);

app.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	$locationProvider.html5Mode(true);

	$urlRouterProvider.otherwise("/main");

	$stateProvider
    .state('main', {
      url: '/main',
      templateUrl: 'partials/index'
    })
	;
});

function randomInt (low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}

app.factory('DataServiceFactory', ['$http', 'CONTEXT_ROOT', '$rootScope', function($http, CONTEXT_ROOT, $rootScope) {
  if (_.isUndefined($rootScope.mode)) {
    $rootScope.mode = 'real';
    $rootScope.timers = [];
  }

  function enrichUrl(url) {
    return CONTEXT_ROOT +  url + ($rootScope.mode == 'real' ? '' : (url.indexOf('?') > 0 ? '&' : '?') + 'randomData=true' );
  }

	return {
    generateData: function() {
      var min = randomInt(0, 3);

      return $http({
        url:  CONTEXT_ROOT + '/data/random',
        method: 'POST',
        data: {
          add: true,
          nbCarsMin: min,
          nbCarsMax: randomInt(min, 5)
        }
      });
    },

		getEvolution: function (lastMinutes) {
			return $http({
				url: enrichUrl('/data/evolution?minutes=' + lastMinutes)
			})
			.then(function (res) {
				return res.data;
			});
		},

		getTiles: function (type) {
			return $http({
				url: enrichUrl('/data/tiles?type=' + type)
			})
			.then(function (res) {
				return res.data;
			});
		},

    getMovements: function (type) {
      return $http({
        url: enrichUrl('/data/movements')
      })
      .then(function (res) {
        return res.data;
      });
    },

    getDaysAggregation: function(startDate, endDate) {
      return $http({
        url: enrichUrl('/data/daysAggregation?startDate=' + startDate.format('YYYY-MM-DD') + '&endDate=' + endDate.format('YYYY-MM-DD'))
      })
      .then(function(res) {
          return res.data;
      });
    },

    getFacts: function(startDate, endDate) {
      return $http({
        url: enrichUrl('/data/facts?startDate=' + startDate.format('YYYY-MM-DD') + '&endDate=' + endDate.format('YYYY-MM-DD'))
      })
      .then(function(res) {
          return res.data;
      });
    }
	}
}]);

app.controller('GraphController', [ '$scope', '$stateParams', '$interval', 'DataServiceFactory','$rootScope', function($scope, $stateParams, $interval, dataService, $rootScope) {
	var config = {
    hour: {
      q: 60,
      minutes: 60,
      ticks: 10,
      xTitle: 'Last hour'
    },
    six_hours: {
      q: 360,
      minutes: 360,
      ticks: 6,
      xTitle: 'Last six hours'
    },
    twelve_hours: {
      q: 720,
      minutes: 720,
      ticks: 12,
      xTitle: 'Last twelve hours'
    },
    day: {
      q: 1440,
      minutes: 1440,
      ticks: 24,
      xTitle: 'Last day'
    },
    paleo: {
      q: 'paleo',
      minutes: 10080,
      ticks: 7,
      xTitle: 'All the festival'
    }
  };

	var fn = function() {
		dataService
			.getEvolution($scope.graphType.q)
			.then(function(data) {
				if (!data) {
					return;
				}

				var cars = {
					carsIn: [],
					carsOut: [],
					carsMean: [],
					carsTotal: []
				};

				var maxYValue = 0;
				var maxY2Value = 0;

				for (var i = 0; i <= Math.floor($scope.graphType.minutes / data.granularity); i++) {
					cars.carsIn[i] = {
						x: i,
						y: data.carsIn[i] ? data.carsIn[i] : 0
					};

					if (maxYValue < cars.carsIn[i].y) {
						maxYValue = cars.carsIn[i].y;
					}

					cars.carsOut[i] = {
						x: i,
						y: data.carsOut[i] ? -data.carsOut[i] : 0
					};

					if (maxYValue < Math.abs(cars.carsOut[i].y)) {
						maxYValue = Math.abs(cars.carsOut[i].y);
					}

					cars.carsMean[i] = {
						x: i,
						y: cars.carsIn[i].y + cars.carsOut[i].y
					};

					cars.carsTotal[i] = {
						x: i,
						y: cars.carsIn[i].y + cars.carsOut[i].y + (cars.carsTotal[i-1] ? cars.carsTotal[i-1].y : 0)
					};

          if (cars.carsTotal[i].y < 0)  {
            cars.carsTotal[i].y = 0;
          }

					if (maxY2Value < Math.abs(cars.carsTotal[i].y)) {
						maxY2Value = Math.abs(cars.carsTotal[i].y);
					}
				}

				var ratio = maxY2Value / maxYValue;
				_.each(cars.carsTotal, function(value, idx) {
					cars.carsTotal[idx].y = value.y / ratio;
				});

				$scope.granularity = data.granularity;
				$scope.maxYValue = maxYValue;
				$scope.maxY2Value = maxY2Value;
				$scope.cars = cars;
				$scope.ticks = $scope.graphType.ticks;
				$scope.xTitle = $scope.graphType.xTitle;
			});
	};

	$scope.graphType = config.hour;
  $scope.graphTypeName = 'hour';

	$scope.update = function(graphType) {
		$scope.graphTypeName = graphType;
    $scope.graphType = config[graphType];
		fn();
	};

	$scope.getClass = function(graphType) {
		if (graphType == $scope.graphTypeName) {
			return 'btn-success';
		}
		else {
			return 'btn-primary';
		}
	};

	$rootScope.timers.push($interval(fn, 15000));

	fn();
}]);

app.directive('paleoAreaGraph', [ function() {
	var margin = {top: 5, right: 30, bottom: 40, left: 30},
		width = 850 - margin.left - margin.right,
		height = 450 - margin.top - margin.bottom;

	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/areaGraph',
		scope: {
			cars: '='
		},
		controller: 'GraphController',
		link: function ($scope, element, attrs) {
			var x, y, y2, svg, carsInArea, carsOutArea, carsTotalPath, carsMeanPath, noData;

			var area = d3.svg
				.area()
				.interpolate("basis")
				.x(function (d) {
					return x(d.x);
				})
				.y0(height / 2)
				.y1(function (d) {
					return y(d.y);
				});

			var line = d3.svg
				.line()
				.interpolate("basis")
				.x(function (d) {
					return x(d.x);
				})
				.y(function (d) {
					return y(d.y);
				});

			function redrawBase() {
				var el = d3.select(element.find('.graph')[0]);

				el.select('*').remove();

				svg = el
					.append("svg")
					.attr('viewBox', "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
					.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

				x = d3.scale
					.linear()
					.range([0, width]);

				y = d3.scale.linear()
					.range([height, 0]);

				y2 = d3.scale.linear()
					.range([height, 0]);
			}

			function redrawAxis() {
        var base = (Math.floor($scope.graphType.minutes / $scope.granularity) / $scope.ticks);

				var ticks = _.reduce(_.range($scope.ticks + 1), function(memo, val) {
					memo.push(val * base);
					return memo;
				}, []);

				var xAxis = d3.svg.axis()
					.scale(x)
					//.ticks($scope.ticks)
					.tickValues(ticks)
					.tickFormat(function (d) {
            var max = (ticks[ticks.length - 1] * $scope.granularity);
            var cur = d * $scope.granularity;
            var duration = moment.duration((max - cur) * 60000);

						if ($scope.graphTypeName == 'paleo') {
              str = (27 - duration.days()) + '.07.15';
            }
            else {
              var str = '-';

  						if (duration.days() > 1) {
  							str += duration.days() + 'd ';
  						}
  						else if (duration.days() == 1) {
  							str += '24h';
  						}

  						if (duration.hours() > 0) {//} || str.length > 0) {
  							str += duration.hours() + 'h';
  						}

  						if (duration.minutes() > 0) {
  							str += duration.minutes() + 'm';
  						}
  						else if (str.length == 1) {
                str = 'now';
  						}
            }

						return  str;
					})
					.orient("bottom");

				var yAxis = d3.svg.axis()
					.scale(y)
					.tickFormat(function (d) {
						return d3.format("d")(Math.abs(d));
					})
					.orient("left");

				var yAxis2 = d3.svg.axis()
					.scale(y2)
					.tickFormat(d3.format("d"))
					.orient("right");

				svg.append("g")
					.attr("class", "x axis")
					.attr("transform", "translate(0," + height + ")")
					.call(xAxis)
					.append("text")
					.attr("y", 50)
					.attr("x", width / 2)
					.style("text-anchor", "middle")
					.attr("class", "axisText")
					.text($scope.xTitle);

				svg
					.append("g")
					.attr("class", "y axis")
					.call(yAxis);

				svg
					.append("g")
					.attr("class", "y axis")
					.attr("transform", "translate(" + width + ",0)")
					.call(yAxis2);
			}

			$scope.$watch('cars', function(cars) {
				if (!cars) {
					return;
				}

				if ($scope.graphType != $scope.oldGraphType) {
					redrawBase();
				}

        x.domain([0, $scope.graphType.minutes / $scope.granularity]);
				y.domain([-$scope.maxYValue, $scope.maxYValue]);
				y2.domain([-$scope.maxY2Value, $scope.maxY2Value]);

				if (carsInArea) {
					carsInArea.remove();
				}

				if (carsOutArea) {
					carsOutArea.remove();
				}

				if (carsMeanPath) {
					carsMeanPath.remove();
				}

				if (carsTotalPath) {
					carsTotalPath.remove();
				}

        if (noData) {
          noData.remove();
        }

        var carsInTotal = _.reduce(cars.carsIn, function(memo, value) { memo += value.y; return memo; }, 0);
        var carsOutTotal = _.reduce(cars.carsOut, function(memo, value) { memo += value.y; return memo; }, 0);

        if (carsInTotal != 0 || carsOutTotal != 0) {
          if (carsInTotal > 0) {
            carsInArea = svg.append("path")
              .datum(cars.carsIn)
              .attr("class", "area1")
              .attr("d", area);
          }

          if (carsOutTotal < 0) {
            carsOutArea = svg.append("path")
              .datum(cars.carsOut)
              .attr("class", "area2")
              .attr("d", area);
          }

          carsMeanPath = svg.append("path")
            .datum(cars.carsMean)
            .attr("class", "line2")
            .attr("d", line);

          carsTotalPath = svg.append("path")
            .datum(cars.carsTotal)
            .attr("class", "line1")
            .attr("d", line);
        }
        else {
          noData = svg
            .append("text")
            .attr("x", width / 2 - 50)
            .attr("y", height / 2)
            .attr("class", "graph-no-data")
            .text("No data");
        }

				if ($scope.graphType != $scope.oldGraphType) {
					redrawAxis();
					$scope.oldGraphType = $scope.graphType;
				}
			});
		}
	};
}]);

app.controller('TilesController', [ '$scope', '$stateParams', '$interval', 'DataServiceFactory', '$rootScope', function($scope, $stateParams, $interval, dataService, $rootScope) {
	$scope.hours = _.range(24);

	var fn = function() {
		dataService
			.getTiles($scope.type)
			.then(function (data) {
				$scope.tiles = data.tiles;

				var step = (data.max - data.min) / 10;

				$scope.steps = _.reduce(_.range(11), function (memo, i) {
					memo.push({cl: 'q' + (i + 1), val: (i) * step});
					return memo;
				}, []);
			});
	};

	$scope.type = 'entries';

	$scope.update = function(type) {
		$scope.type = type;
		fn();
	};

	$scope.getClass = function(value) {
		if (value != 0 && value == '') {
			return '';
		}
		else if (value == 'n/a') {
			return 'no-data';
		}
		else {
			var step = _.find($scope.steps, function (step) {
				return value <= step.val;
			});

			return step.cl;
		}
	};

	$scope.getActionClass = function(type) {
		if ($scope.type == type) {
			return 'btn-success';
		}
		else {
			return 'btn-primary';
		}
	};

	$scope.getValue = function(value) {
		if (value != 0 && (value == '' || value == 'n/a')) {
			return '';
		}
		else {
			return value;
		}
	};

	$rootScope.timers.push($interval(fn, 60000));

	fn();
}]);

app.directive('paleoTiles', [ function() {
	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/tiles',
		controller: 'TilesController',
    scope: {}
	};
}]);

app.controller('PulsorController', [ '$scope', '$timeout', '$interval', 'DataServiceFactory', '$rootScope', function($scope, $timeout, $interval, dataService, $rootScope) {
	$scope.movements = {
    entries: 0,
    exits: 0
  };

  var fn = function() {
		dataService
			.getMovements()
			.then(function (data) {
        if ($scope.movements.entries != data.entries) {
          $scope.update('entries');
        }

        if ($scope.movements.exits != data.exits) {
          $scope.update('exits');
        }

        $scope.movements = data;
			});
	};

	$scope.entriesClass = '';
	$scope.exitsClass = '';

	$scope.update = function(type) {
		if ($scope[type + 'Class'] == '') {
			$timeout.cancel($scope[type + 'Timeout']);

			$scope[type + 'Class'] = 'pulsor-anim-' + type;

			$scope[type + 'Timeout'] = $timeout(function () {
				$scope[type + 'Class'] = '';
			}, 2000); // Delay is the same as the animation speed
		}
	};

	$rootScope.timers.push($interval(fn, 5000));

	fn();
}]);

app.directive('paleoPulsor', [ function() {
	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/pulsor',
		controller: 'PulsorController',
    scope: {}
  };
}]);

app.controller('RoundController', [ '$scope', '$interval', 'DataServiceFactory', '$rootScope', function($scope, $interval, dataService, $rootScope) {
  var endDate = moment();
  var startDate = moment(endDate).subtract(6, 'days');

  $scope.nbDays = endDate.diff(startDate, 'days') + 1;

  var fn = function() {
		dataService
			.getDaysAggregation(startDate, endDate)
			.then(function (data) {
        $scope.carAggregations = data;
			});
	};

	$rootScope.timers.push($interval(fn, 60000));

	fn();
}]);

app.directive('paleoRounds', [function() {
  var
    margin = {top: 45, right: 175, bottom: 0, left: 20},
  	width = 175,
  	height = 90;

  function truncate(str, maxLength, suffix) {
  	if(str.length > maxLength) {
  		str = str.substring(0, maxLength + 1);
  		str = str.substring(0, Math.min(str.length, str.lastIndexOf(" ")));
  		str = str + suffix;
  	}
  	return str;
  }

  function mouseover(p) {
 		var g = d3.select(this).node().parentNode;
 		d3.select(g).selectAll("circle").style("display","none");
 		d3.select(g).selectAll("text.value").style("display","block");
 	}

 	function mouseout(p) {
 		var g = d3.select(this).node().parentNode;
 		d3.select(g).selectAll("circle").style("display","block");
 		d3.select(g).selectAll("text.value").style("display","none");
 	}

  return {
    restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/rounds',
    scope: {
      carAggregations: '='
    },
    controller: 'RoundController',
    link: function($scope, element, attrs) {
      var startDay = 0;
      var endDay = $scope.nbDays - 1;

      var svg, c, x, xAxis, xScale;

      function redrawBase() {
        var el = d3.select(element.find('.rounds')[0]);

        el.select('*').remove();

        svg = el.append("svg")
          .attr('viewBox', "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        c = d3.scale.category20b();

        x = d3.scale.linear().range([0, width]);

        xAxis = d3.svg
          .axis()
          .scale(x)
          .orient("top");

        xAxis
          .tickFormat(function(d) {
            return moment().subtract($scope.nbDays - d - 1, 'days').date() + '.7.15';
          })
          .ticks($scope.nbDays);
      }

      function redrawAxis() {
        x.domain([startDay, endDay]);

        xScale = d3
          .scale
          .linear()
       		.domain([startDay, endDay])
       		.range([0, width]);

       	svg.append("g")
       		.attr("class", "x axis round-axis")
       		.attr("transform", "translate(0," + 0 + ")")
       		.call(xAxis)
          .selectAll('text')
          .attr("transform", "rotate(-45), translate(25, 3)");
      }

      $scope.$watch('carAggregations', function(carAggregations) {
        if (!carAggregations) {
          return;
        }

        redrawBase();
        redrawAxis();

        for (var j = 0; j < carAggregations.length; j++) {
          // TODO:
          var g = svg.append("g").attr("class", "journal");

          var circles = g
            .selectAll("circle")
            .data(carAggregations[j].values)
            .enter()
            .append("circle");

          var text = g
            .selectAll("text")
            .data(carAggregations[j].values)
            .enter()
            .append("text");

          var rScale = d3.scale
            .linear()
            .domain([0, d3.max(carAggregations[j].values)])
            .range([2, 9]);

          circles
            .attr("cx", function (d, i) {
              return xScale(i);
            })
            .attr("cy", j * 20 + 20)
            .attr("r", function (d) {
              return rScale(d);
            })
            .style("fill", function (d) {
              return c(j);
            });

          text
            .attr("y", j * 20 + 25)
            .attr("x", function (d, i) {
              var result = xScale(i);

              if (d > 999) {
                return result - 13;
              }
              else if (d > 99) {
                return result - 10;
              }
              else if (d > 9) {
                return result - 5;
              }
              else {
                return result - 2;
              }
            })
            .attr("class", "value")
            .text(function (d) {
              return d;
            })
            .style("fill", function (d) {
              return c(j);
            })
            .style("display", "none");

          g.append("text")
            .attr("y", j * 20 + 25)
            .attr("x", width + 20)
            .attr("class", "label")
            .text(truncate(carAggregations[j].name, 30, "..."))
            .style("fill", function (d) {
              return c(j);
            })
            .on("mouseover", mouseover)
            .on("mouseout", mouseout);
        }
      });
    }
  };
}]);

app.controller('FactsController', [ '$scope', '$interval', 'DataServiceFactory', '$rootScope', function($scope, $interval, dataService, $rootScope) {
  var endDate = moment().hour(23).minute(59).second(59).millisecond(999);
  var startDate = moment(endDate).subtract(7, 'days').hour(0).minute(0).second(0).millisecond(0);

  $scope.facts = {
    total: {
      entries: '-',
      exits: '-',
      movements: '-'
    },
    facts: {
      entries: {
        maxDay: { date: '-', value: '-' },
        minDay: { date: '-', value: '-' },
        maxHour: { date: '-', value: '-' },
        minHour: { date: '-', value: '-'}
      },
      exits: {
        maxDay: { date: '-', value: '-' },
        minDay: { date: '-', value: '-' },
        maxHour: { date: '-', value: '-' },
        minHour: { date: '-', value: '-' }
      },
      movements: {
        maxDay: { date: '-', value: '-' },
        minDay: { date: '-', value: '-' },
        maxHour: { date: '-', value: '-' },
        minHour: { date: '-', value: '-' }
      }
    }
  };

  var formatDayOut = 'DD.MM.YYYY';
  var formatHourOut = 'DD.MM.YYYY h';
  var hourSuffix = 'h';

  function normalizeData(data, formatOut, suffix) {
    if (data.date) {
      return {
        date: moment(data.date).format(formatOut) + (suffix ? suffix : ''),
        value: data.value
      };
    }
    else {
      return {
        date: '-',
        value: '-'
      }
    }
  }

	var fn = function() {
		dataService
			.getFacts(startDate, endDate)
			.then(function (data) {
        data.facts.entries.maxDay = normalizeData(data.facts.entries.maxDay, formatDayOut);
        data.facts.entries.minDay = normalizeData(data.facts.entries.minDay, formatDayOut);
        data.facts.entries.maxHour = normalizeData(data.facts.entries.maxHour, formatHourOut, hourSuffix);
        data.facts.entries.minHour = normalizeData(data.facts.entries.minHour, formatHourOut, hourSuffix);

        data.facts.exits.maxDay = normalizeData(data.facts.exits.maxDay, formatDayOut);
        data.facts.exits.minDay = normalizeData(data.facts.exits.minDay, formatDayOut);
        data.facts.exits.maxHour = normalizeData(data.facts.exits.maxHour, formatHourOut, hourSuffix);
        data.facts.exits.minHour = normalizeData(data.facts.exits.minHour, formatHourOut, hourSuffix);

        data.facts.movements.maxDay = normalizeData(data.facts.movements.maxDay, formatDayOut);
        data.facts.movements.minDay = normalizeData(data.facts.movements.minDay, formatDayOut);
        data.facts.movements.maxHour = normalizeData(data.facts.movements.maxHour, formatHourOut, hourSuffix);
        data.facts.movements.minHour = normalizeData(data.facts.movements.minHour, formatHourOut, hourSuffix);

        $scope.facts = data;
			});
	};

	$rootScope.timers.push($interval(fn, 60000));

	fn();
}]);

app.directive('paleoFacts', [ function() {
	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/facts',
		controller: 'FactsController',
    scope: {
      facts: '='
    }
	};
}]);

app.controller('SummaryController', [ '$scope', '$rootScope', '$state', '$interval', 'DataServiceFactory', function($scope, $rootScope, $state, $interval, dataService) {
	$scope.getClass = function(mode) {
		if ($rootScope.mode == mode) {
			return 'btn-success';
		}
		else {
			return 'btn-primary';
		}
	};

  $scope.update = function(mode) {
    $rootScope.mode = mode;

    _.each($rootScope.timers, function(timer) {
      $interval.cancel(timer);
    });

    $rootScope.timers = [];

    $state.go('main', {}, { reload: true });
  };

  var fn = function() {
    if (randomInt(0, 100) <= 25) {
 		  dataService.generateData();
    }
 	};

  if ($rootScope.mode == 'random') {
 	  $rootScope.timers.push($interval(fn, 15000));
  }
}]);

app.directive('paleoSummary', [ function() {
	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/summary',
		controller: 'SummaryController',
    scope: {}
	};
}]);
