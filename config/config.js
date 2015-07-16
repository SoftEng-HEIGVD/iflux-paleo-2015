var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
		dotenv = require('dotenv'),
    env = process.env.NODE_ENV || 'development';

if (process.env.NODE_ENV != 'docker') {
	dotenv.load();
}

var mongoBaseUri = null;

if (process.env.MONGOLAB_URI) {
	mongoBaseUri = process.env.MONGOLAB_URI;
}
else {
	if (process.env.MONGODB_HOST) {
		mongoBaseUri = 'mongodb://' + process.env.MONGODB_HOST + ':' + process.env.MONGODB_PORT + '/iflux-paleo';
	}
	else {
		mongoBaseUri = 'mongodb://localhost:27017/iflux-paleo';
	}
}

var config = {
  development: {
    root: rootPath,
    app: {
      name: 'MapBox iFLUX Viewer',
	    storage: {
		    enabled: true,
        path: "/tmp"
	    },
	    actionTypes: {
		    carIn: process.env.PALEO_CAR_IN_ACTION_TYPE,
		    carOut: process.env.PALEO_CAR_OUT_ACTION_TYPE
	    },
	    randomData: false
    },
    port: process.env.PORT || 3008,
	  //db: mongoBaseUri + '-development'
	  db: mongoBaseUri + '-docker'
  },

  test: {
    root: rootPath,
    app: {
			name: 'MapBox iFLUX Viewer',
	    storage: {
		    enabled: false,
        path: "/tmp"
	    },
	    actionTypes: {
		    carIn: process.env.PALEO_CAR_IN_ACTION_TYPE,
		    carOut: process.env.PALEO_CAR_OUT_ACTION_TYPE
	    },
	    randomData: true
    },
    port: process.env.PORT || 3008,
	  db: mongoBaseUri + '-test'
  },

  production: {
    root: rootPath,
    app: {
			name: 'MapBox iFLUX Viewer',
	    storage: {
		    enabled: true,
        path: "/tmp"
	    },
	    actionTypes: {
		    carIn: process.env.PALEO_CAR_IN_ACTION_TYPE,
		    carOut: process.env.PALEO_CAR_OUT_ACTION_TYPE
	    },
	    randomData: false
    },
    port: process.env.PORT || 3008,
	  db: mongoBaseUri + '-prod'
  },

	docker: {
		root: rootPath,
		app: {
			name: 'MapBox iFLUX Viewer',
			storage: {
		    enabled: true,
	      path: "/data/paleo"
			},
			actionTypes: {
				carIn: process.env.PALEO_CAR_IN_ACTION_TYPE,
				carOut: process.env.PALEO_CAR_OUT_ACTION_TYPE
			},
			randomData: false
		},
		port: 3000,
		db: 'mongodb://' + process.env.MONGO_PORT_27017_TCP_ADDR + ':' + process.env.MONGO_PORT_27017_TCP_PORT + '/iflux-paleo-docker'
	}
};

module.exports = config[env];
