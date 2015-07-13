var app = angular.module('demoapp', ['ui.router', 'leaflet-directive']);

var defaults = {
	tileLayer: "http://api.tiles.mapbox.com/v4/prevole.lg1gah58/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicHJldm9sZSIsImEiOiJYblZPX3d3In0.AtoGoTAtUJAcBDEI0df6qw"
};

var legends = {
	bike: {
		position: 'bottomleft',
		colors: [ '#7BB128', '#E47E2D', '#D94835' ],
		labels: [ '3 bikes or more', 'Less than 3 bikes', 'No more bike' ]
	},
	citizen: {
		position: 'bottomleft',
		colors: [ '#E47E2D', '#329ACA', '#3D6471', '#C94EB1', '#D94835', '#7BB128' ],
		labels: [ 'Created issues', 'Assigned issues', 'Acknowledged issues', 'In progress issues', 'Rejected issues', 'Resolved issues']
	}
};

var changeStateActions = {
	created: 'orange',
	assigned: 'blue',
	acknowledged: 'cadetblue',
	in_progress: 'purple',
	rejected: 'red',
	resolved: 'green'
};

var issueTypeCodes = {
	bsl: 'lightbulb-o',
	dcr: 'road',
	grf: 'asterisk'
};

function defineBikeColor(bikes) {
	if (bikes > 0 && bikes < 3) {
		return 'orange';
	}
	else if (bikes >= 3) {
		return 'green';
	}
	else {
		return 'red';
	}
};


var markerMakers = {
	bike: function(station) {
		return {
			lat: station.lat,
			lng: station.lng,
			compileMessage: true,
			message: '<p>At ' + station.date + ', the station ' + station.name + ', ' + station.street + ', ' + station.zip + ' ' + station.city +
				' has only:<ul><li>' + station.bikes + ' bike' + (station.bikes > 1 ? 's' : '') +  ' available,</li>' +
				'<li>' + station.freeholders + ' holder' + (station.freeholders > 1 ? 's' : '') +  ' available.</li></ul></p>',
			icon: {
				type: 'awesomeMarker',
				prefix: 'fa',
				markerColor: defineBikeColor(station.bikes),
					icon: 'bicycle'
			}
		};
	},

	citizen: function(issue) {
		return {
			lat: issue.lat,
			lng: issue.lng,
			compileMessage: true,
			message: '<p>' + issue.description + '</p>' + (issue.imageUrl ? '<p><img src="'+ issue.imageUrl + '" width="200px" /></p>' : '') + '<p><strong>By ' + issue.owner + ' at ' + issue.createdOn + '</strong></p>',
			icon: {
				type: "awesomeMarker",
				prefix: 'fa',
				markerColor: changeStateActions[issue.state],
				icon: issueTypeCodes[issue.issueTypeCode]
			}
		};
	}
};

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
	var maps = [];

	return {
		getMaps: function () {
			return $http({
				url: CONTEXT_ROOT + '/data/maps'
			})
			.then(function (res) {
				maps = res.data;
				return res.data;
			});
		},

		getMap: function(mapId) {
			return $http({
				url: CONTEXT_ROOT + '/data/maps/' + mapId
			})
			.then(function(res) {
				return res.data;
			});
		}
	}
}]);

app.controller('MapsListController', [ '$scope', 'DataServiceFactory', function($scope, dataService) {
	$scope.maps = [];

	$scope.init = function() {
		dataService
			.getMaps()
			.then(function(data) {
				$scope.maps = data;
			});
	}
}]);

app.controller('MapController', [ '$scope', '$stateParams', '$interval', 'DataServiceFactory', function($scope, $stateParams, $interval, dataService) {
	$scope.mapId;

	$scope.map = undefined;

	$scope.center = {
		lat: 0,
		lng: 0,
		zoom: 12
	};

	$scope.defaults = defaults;

	var fn = function() {
		dataService
			.getMap($stateParams.mapId)
			.then(function(data) {
				if (!data) {
					return;
				}

				if ($scope.mapId != $stateParams.mapId) {
					$scope.mapId = $stateParams.mapId;
					$scope.map = data;
					$scope.center = _.pick(data.config, 'lat', 'lng', 'zoom');
					$scope.legend = legends[data.legendType];
				}

				$scope.markers = _.reduce(data.markers, function (memo, marker) {
					if (markerMakers[marker.type]) {
						memo.push(markerMakers[marker.type](marker));
					}
					else {
						console.log('Marker maker is not defined for type: %s', marker.type);
					}

					return memo;
				}, []);
			});
	};

	$interval(fn, 15000);

	fn();
}]);
