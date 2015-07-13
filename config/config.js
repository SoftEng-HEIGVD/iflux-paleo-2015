var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
		dotenv = require('dotenv'),
    env = process.env.NODE_ENV || 'development';

if (process.env.NODE_ENV != 'docker') {
	dotenv.load();
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
		    carOut: process.even.PALEO_CAR_OUT_ACTION_TYPE
	    }
    },
    port: process.env.PORT || 3004
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
		    carOut: process.even.PALEO_CAR_OUT_ACTION_TYPE
	    }
    },
    port: process.env.PORT || 3004
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
		    carOut: process.even.PALEO_CAR_OUT_ACTION_TYPE
	    }
    },
    port: process.env.PORT || 3004
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
				carOut: process.even.PALEO_CAR_OUT_ACTION_TYPE
			}
		},
		port: 3000
	}
};

module.exports = config[env];
