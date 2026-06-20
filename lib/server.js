'use strict';
// Server-related tasks
// Dependencies
var http = require('http');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var util = require('util');
var debug = util.debuglog('server');

var config = require('./config');
var handlers = require('./handlers');
var helpers = require('./helpers');
var watcher = require('./watcher');

// Instantiate the server module object
var server = {};

// Instantiate the http server
server.httpServer = http.createServer(function(req, res) {
	server.unifiedServer(req, res);
});

// ============================================
// SOCKET.IO — usado para empujar actualizaciones de la galería en vivo
// ============================================

var io = require('socket.io')(server.httpServer);
global.io = io;

io.sockets.on('connection', function(socket) {
	debug('Cliente conectado vía Socket.IO:', socket.id);

	socket.on('disconnect', function() {
		debug('Cliente desconectado:', socket.id);
	});
});

// All the server logic for both the http and https server
server.unifiedServer = function(req, res) {
	// Get the URL and parse it
	var parseUrl = url.parse(req.url, true);
	// Get the path
	var reqPath = parseUrl.pathname;
	// Quita los slashes al principio y al final
	var trimmedPath = reqPath.replace(/^\/+|\/+$/g, '');

	// Get the query string as an object
	var queryStringObject = parseUrl.query;
	// Get the HTTP Method
	var method = req.method.toLowerCase();
	// Get the headers as an object
	var headers = req.headers;
	// Get the payload, if any
	var decoder = new StringDecoder('utf-8');
	var buffer = '';
	req.on('data', function(data) {
		buffer += decoder.write(data);
	});
	req.on('end', function() {
		buffer += decoder.end();

		// Choose the handler this request should go to
		var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

		// Si el request es dentro de /public/, usar el handler public
		chosenHandler = trimmedPath.indexOf('public/') > -1 ? handlers.public : chosenHandler;

		// Construct the data object to send to the handler
		var data;
		try {
			data = {
				'trimmedPath': trimmedPath,
				'queryStringObject': queryStringObject,
				'method': method,
				'headers': headers,
				'payload': JSON.parse(buffer),
			};
		} catch(e) {
			data = {
				'trimmedPath': trimmedPath,
				'queryStringObject': queryStringObject,
				'method': method,
				'headers': headers,
				'payload': helpers.parseQueryStringToObject(buffer),
			};
		} finally {
			server.restante(chosenHandler, data, buffer, req, res);
		}
	});
};

server.restante = function(chosenHandler, data, buffer, req, res) {
	chosenHandler(data, function(statusCode, payload, contentType) {
		try {
			contentType = typeof(contentType) == 'string' ? contentType : 'json';
			statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

			var payloadString = '';
			if (contentType == 'json') {
				res.setHeader('Content-Type', 'application/json');
				payload = typeof(payload) == 'object' ? payload : {};
				payloadString = JSON.stringify(payload, null, 2);
			}
			if (contentType == 'html') {
				res.setHeader('Content-Type', 'text/html');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'favicon') {
				res.setHeader('Content-Type', 'image/x-icon');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'css') {
				res.setHeader('Content-Type', 'text/css');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'js') {
				res.setHeader('Content-Type', 'text/javascript');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'png') {
				res.setHeader('Content-Type', 'image/png');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'jpg' || contentType == 'jpeg') {
				res.setHeader('Content-Type', 'image/jpeg');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'gif') {
				res.setHeader('Content-Type', 'image/gif');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'webp') {
				res.setHeader('Content-Type', 'image/webp');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'bmp') {
				res.setHeader('Content-Type', 'image/bmp');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'svg') {
				res.setHeader('Content-Type', 'image/svg+xml');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'plain') {
				res.setHeader('Content-Type', 'text/plain');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}
			if (contentType == 'toJson') {
				res.setHeader('Content-Type', 'application/json');
				payloadString = typeof(payload) !== 'undefined' ? payload : '';
			}

			res.writeHead(statusCode);
			res.end(payloadString);
		} catch(e) {
			debug('Error al responder la petición:', e);
		}

		// Log de la petición
		if (statusCode == 200) {
			debug('\x1b[32m%s\x1b[0m', data.method.toUpperCase() + ' /' + data.trimmedPath + ' ' + statusCode);
		} else {
			debug('\x1b[31m%s\x1b[0m', data.method.toUpperCase() + ' /' + data.trimmedPath + ' ' + statusCode);
		}
	});
};

// Define a request router
server.router = {
	'': handlers.index,
	'ping': handlers.ping,
	'favicon.ico': handlers.favicon,
	'socket.io.min.js': handlers.SocketIoJs,
	'socket.io.min.js.map': handlers.SocketIoJs,
	'public': handlers.public,
	'api/images': handlers.apiImages,
	'api/rescan': handlers.apiRescan,
	'image': handlers.image,
};

// Init script
server.init = function() {
	server.httpServer.listen(config.httpPort, function() {
		console.log('\x1b[36m%s\x1b[0m', 'The server is listening on port ' + config.httpPort + ' in ' + config.envName + ' mode.');
		console.log('\x1b[36m%s\x1b[0m', 'Carpeta de imágenes: ' + config.imagesDir);

		// Arranca el escaneo + polling de la carpeta de imágenes
		watcher.init(io);
	});
};

// Export the module
module.exports = server;
