var
	express = require('express'),
  config = require('./config/config'),
	viewConfigService = require('./app/services/viewConfigService');

var app = express();

require('./config/express')(app, config);

viewConfigService.load();

app.listen(config.port);

