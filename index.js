require('dotenv').config();
// ... el resto de tu código (require de server, handlers, etc.)
// Primary file for the API
// Dependencies
var server = require('./lib/server');
// Declare de app
var app = {};
// Init function
app.init = function() {
	// Start the server
	server.init();
};
// Execute
app.init();
// Exports the app
module.exports = app;
