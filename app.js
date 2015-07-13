var
	express = require('express'),
  config = require('./config/config'),
	AnalyticsProvider = require('./app/services/analytics').AnalyticsProvider;

var app = express();

require('./config/express')(app, config);

app.analyticsProvider = new AnalyticsProvider(config);

app.listen(config.port);

