var app = angular.module('demoapp', ['ui.router']);

app.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	$locationProvider.html5Mode(true);

	$urlRouterProvider.otherwise("/main");

	$stateProvider
    .state('main', {
      url: '/main',
      templateUrl: 'partials/index'
    })
	  .state('map', {
		  url: '/maps/:mapId',
		  templateUrl: 'partials/map'
	  })
    .state('archi', {
      url: '/archi',
      templateUrl: 'partials/architecture'
    })
	;
});

app.factory('DataServiceFactory', ['$http', 'CONTEXT_ROOT', function($http, CONTEXT_ROOT) {
	return {
		getEvolution: function (lastMinutes) {
			return $http({
				url: CONTEXT_ROOT + '/data/evolution?minutes=' + lastMinutes
			})
			.then(function (res) {
				//maps = res.data;
				return res.data;
			});
		}
	}
}]);

app.controller('GraphController', [ '$scope', '$stateParams', '$interval', 'DataServiceFactory', function($scope, $stateParams, $interval, dataService) {
	var ticks = {
		60: 10,
		360: 6,
		720: 12,
		1440: 24
	};

	var xTitles = {
		60: 'Last hour',
		360: 'Last six hours',
		720: 'Last twelve hours',
		1440: 'Last day'
	};

	var fn = function() {
		dataService
			.getEvolution($scope.interval)
			.then(function(data) {
				if (!data) {
					return;
				}

				var cars = {
					carsIn: [],
					carsOut: [],
					carsTotal: []
				};

				var maxYValue = 0;

				for (var i = 0; i <= Math.floor($scope.interval / data.granularity); i++) {
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

					cars.carsTotal[i] = {
						x: i,
						y: cars.carsIn[i].y + cars.carsOut[i].y
					};
				}

				$scope.granularity = data.granularity;
				$scope.maxYValue = maxYValue;
				$scope.cars = cars;
				$scope.ticks = ticks[$scope.interval];
				$scope.xTitle = xTitles[$scope.interval];
			});
	};

	$scope.interval = 60;

	$scope.updateInterval = function(minutes) {
		$scope.interval = minutes;
		fn();
	};

	$interval(fn, 15000);

	fn();
}]);


app.directive('paleoAreaGraph', [ function() {
	var margin = {top: 20, right: 60, bottom: 60, left: 60},
		width = 960 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;

	return {
		restrict: 'E',
    replace: true,
    templateUrl: 'partials/widgets/areaGraph',
		scope: {
			cars: '='
		},
		controller: 'GraphController',
		link: function ($scope, element, attrs) {
			var x, y, svg, carsInArea, carsOutArea, carsTotalPath;

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
					.attr("width", width + margin.left + margin.right)
					.attr("height", height + margin.top + margin.bottom)
					.append("g")
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

				x = d3.scale
					.linear()
					.range([0, width]);

				y = d3.scale.linear()
					.range([height, 0]);
			}

			function redrawAxis() {
				var base = (Math.floor($scope.interval / $scope.granularity) / $scope.ticks);
				var ticks = _.reduce(_.range($scope.ticks + 1), function(memo, val) {
					memo.push(val * base);
					return memo;
				}, []);

				//console.log(ticks.reverse())

				//ticks = ticks.reverse();

				var xAxis = d3.svg.axis()
					.scale(x)
					//.ticks($scope.ticks)
					.tickValues(ticks)
					.tickFormat(function (d) {
						var str = '-';

						var max = (ticks[ticks.length - 1] * $scope.granularity);
						var cur = d * $scope.granularity;
						var duration = moment.duration((max - cur) * 60000);

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
					.scale(y)
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
					.call(yAxis)
					.append("text")
					.attr("transform", "rotate(-90)")
					.attr("y", -35)
					.attr("x", height / -2)
					.style("text-anchor", "middle")
					.attr("class", "axisText")
					.text("Nb cars in/out. (areas)");

				svg
					.append("g")
					.attr("class", "y axis")
					.attr("transform", "translate(" + width + ",0)")
					.call(yAxis2)
					.append("text")
					.attr("transform", "rotate(-90)")
					.attr("y", 50)
					.attr("x", height / -2)
					.style("text-anchor", "middle")
					.attr("class", "axisText")
					.text("Total nb cars. (line)");
			}

			$scope.$watch('cars', function(cars) {
				if (!cars) {
					return;
				}

				if ($scope.interval != $scope.oldInterval) {
					redrawBase();
				}

				x.domain([0, $scope.interval / $scope.granularity]);
				y.domain([-$scope.maxYValue, $scope.maxYValue]);

				if (carsInArea) {
					carsInArea.remove();
				}

				if (carsOutArea) {
					carsOutArea.remove();
				}

				if (carsTotalPath) {
					carsTotalPath.remove();
				}

				carsInArea = svg.append("path")
					.datum(cars.carsIn)
					.attr("class", "area1")
					.attr("d", area);

				carsOutArea = svg.append("path")
					.datum(cars.carsOut)
					.attr("class", "area2")
					.attr("d", area);

				carsTotalPath = svg.append("path")
		      .datum(cars.carsTotal)
		      .attr("class", "line")
		      .attr("d", line);

				if ($scope.interval != $scope.oldInterval) {
					redrawAxis();
					$scope.oldInterval = $scope.interval;
				}
			});
		}
	};
}]);