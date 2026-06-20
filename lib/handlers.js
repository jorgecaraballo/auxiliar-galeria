'use strict';
// Request handlers
// Dependencies
var fs = require('fs');
var path = require('path');
var util = require('util');
var debug = util.debuglog('handlers');
var helpers = require('./helpers');
var config = require('./config');
var imageStore = require('./imageStore');
var watcher = require('./watcher');

// Define the handlers
var handlers = {};

// Mapa de extensión -> contentType reconocido por server.restante()
handlers._imageContentTypes = {
	'.jpg': 'jpg',
	'.jpeg': 'jpg',
	'.png': 'png',
	'.gif': 'gif',
	'.webp': 'webp',
	'.bmp': 'bmp',
	'.svg': 'svg'
};

// Favicon
handlers.favicon = function(data, callback) {
	if (data.method == 'get') {
		helpers.getStaticAsset('favicon.ico', function(err, data) {
			if (!err && data) {
				callback(200, data, 'favicon');
			} else {
				callback(500);
			}
		});
	} else {
		callback(405, undefined, 'html');
	}
};

/* HTML handlers */

// Index handler — página principal de la galería
handlers.index = function(data, callback) {
	if (data.method == 'get') {
		var templateData = {
			'head.title': 'Galería de Imágenes',
			'head.description': 'Galería de solo lectura, escaneo recursivo de carpetas',
			'body.title': 'Galería de Imágenes',
		};
		helpers.getTemplate('index', templateData, function(err, str) {
			if (!err && str) {
				helpers.addUniversalTemplates(str, templateData, function(err, str) {
					if (!err && str) {
						callback(200, str, 'html');
					} else {
						callback(500, undefined, 'html');
					}
				});
			} else {
				callback(500, undefined, 'html');
			}
		});
	} else {
		callback(405, undefined, 'html');
	}
};

// Public assets
handlers.public = function(data, callback) {
	if (data.method == 'get') {
		var trimmedAssetName = data.trimmedPath.replace('public/', '').trim();
		if (trimmedAssetName.length > 0) {
			helpers.getStaticAsset(trimmedAssetName, function(err, data) {
				if (!err && data) {
					var contentType = 'plain';
					if (trimmedAssetName.indexOf('.css') > -1) { contentType = 'css'; }
					if (trimmedAssetName.indexOf('.js') > -1) { contentType = 'js'; }
					if (trimmedAssetName.indexOf('.png') > -1) { contentType = 'png'; }
					if (trimmedAssetName.indexOf('.jpeg') > -1) { contentType = 'jpeg'; }
					if (trimmedAssetName.indexOf('.jpg') > -1) { contentType = 'jpg'; }
					if (trimmedAssetName.indexOf('.ico') > -1) { contentType = 'favicon'; }
					if (trimmedAssetName.indexOf('.json') > -1) { contentType = 'toJson'; }
					callback(200, data, contentType);
				} else {
					callback(404);
				}
			});
		} else {
			callback(404);
		}
	} else {
		callback(405, undefined, 'html');
	}
};

handlers.SocketIoJs = function(data, callback) {
	if (data.method == 'get') {
		var trimmedAssetName = data.trimmedPath.trim();
		if (trimmedAssetName.length > 0) {
			helpers.getStaticAssetSocketIoJs(trimmedAssetName, function(err, data) {
				if (!err && data) {
					var contentType = 'plain';
					if (trimmedAssetName.indexOf('.css') > -1) { contentType = 'css'; }
					if (trimmedAssetName.indexOf('.js') > -1) { contentType = 'js'; }
					if (trimmedAssetName.indexOf('.png') > -1) { contentType = 'png'; }
					if (trimmedAssetName.indexOf('.jpeg') > -1) { contentType = 'jpeg'; }
					if (trimmedAssetName.indexOf('.ico') > -1) { contentType = 'favicon'; }
					if (trimmedAssetName.indexOf('.json') > -1) { contentType = 'toJson'; }
					callback(200, data, contentType);
				} else {
					callback(404, data);
				}
			});
		} else {
			callback(404);
		}
	} else {
		callback(405, undefined, 'html');
	}
};

/* ============================================
 * GALERÍA DE IMÁGENES
 * ============================================ */

// GET /api/images — devuelve la lista completa de imágenes (desde el cache en memoria)
handlers.apiImages = function(data, callback) {
	if (data.method == 'get') {
		callback(200, {
			'images': imageStore.getAll(),
			'total': imageStore.getAll().length,
			'scannedAt': imageStore.lastScanAt,
			'error': imageStore.lastError
		});
	} else {
		callback(405);
	}
};

// GET /api/rescan — fuerza un re-escaneo inmediato (botón "Actualizar").
// El resultado se propaga a TODOS los clientes vía Socket.IO (evento images:update),
// no solo a quien pidió el refresco.
handlers.apiRescan = function(data, callback) {
	if (data.method == 'get') {
		watcher.scanNow(function(err, diff) {
			if (err) {
				callback(500, { 'error': err });
			} else {
				callback(200, {
					'ok': true,
					'added': diff.added ? diff.added.length : 0,
					'removed': diff.removed ? diff.removed.length : 0
				});
			}
		});
	} else {
		callback(405);
	}
};

// GET /image?p=ruta/relativa.jpg — sirve el archivo de imagen ORIGINAL (solo lectura,
// no se genera ningún archivo nuevo). Protegido contra path traversal.
handlers.image = function(data, callback) {
	if (data.method != 'get') {
		return callback(405);
	}

	var relPath = typeof(data.queryStringObject.p) == 'string' && data.queryStringObject.p.length > 0 ? data.queryStringObject.p : false;
	if (!relPath) {
		return callback(400);
	}

	try {
		relPath = decodeURIComponent(relPath);
	} catch (e) {
		return callback(400);
	}

	var rootDir = path.resolve(config.imagesDir);
	var requestedPath = path.resolve(rootDir, relPath);
	var rootWithSep = rootDir + path.sep;

	// Verifica que la ruta resuelta siga DENTRO de la carpeta configurada (anti path-traversal)
	if (requestedPath.indexOf(rootWithSep) !== 0) {
		debug('Intento de acceso fuera de IMAGES_DIR bloqueado:', relPath);
		return callback(403);
	}

	var ext = path.extname(requestedPath).toLowerCase();
	var contentType = handlers._imageContentTypes[ext];
	if (!contentType) {
		return callback(415);
	}

	fs.readFile(requestedPath, function(err, fileData) {
		if (err || !fileData) {
			return callback(404);
		}
		callback(200, fileData, contentType);
	});
};

// Ping handler
handlers.ping = function(data, callback) {
	callback(200);
};

// Not found handler
handlers.notFound = function(data, callback) {
	callback(404);
};

// Export the module
module.exports = handlers;
