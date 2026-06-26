'use strict';
// Request handlers
// Dependencies
var fs = require('fs');
var path = require('path');
var util = require('util');
var childProcess = require('child_process');
var debug = util.debuglog('handlers');
var helpers = require('./helpers');
var config = require('./config');
var imageStore = require('./imageStore');
var watcher = require('./watcher');
var videoStore = require('./videoStore');
var videoWatcher = require('./videoWatcher');

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

// GET /api/open?p=ruta/relativa — abre PCManFM en la carpeta del archivo,
// con el archivo ya seleccionado. Solo funciona en la máquina donde corre
// el servidor (que es también donde está el escritorio, en el caso de la hpstream).
// El parámetro p puede ser una ruta relativa de imagen o un nombre de archivo de video.
// Se detecta el tipo (imagen/video) buscando en ambos stores.
handlers.apiOpen = function(data, callback) {
	if (data.method != 'get') {
		return callback(405);
	}

	var relPath = typeof(data.queryStringObject.p) == 'string' && data.queryStringObject.p.length > 0
		? data.queryStringObject.p : false;
	if (!relPath) {
		return callback(400, { 'error': 'Parámetro p requerido' });
	}

	try {
		relPath = decodeURIComponent(relPath);
	} catch(e) {
		return callback(400, { 'error': 'Parámetro p inválido' });
	}

	// Determinar si es imagen o video buscando en ambos stores
	var absolutePath = false;

	if (imageStore.index.hasOwnProperty(relPath)) {
		absolutePath = path.join(path.resolve(config.imagesDir), relPath);
	} else if (videoStore.index.hasOwnProperty(relPath)) {
		absolutePath = path.join(path.resolve(config.videosDir), relPath);
	}

	if (!absolutePath) {
		return callback(404, { 'error': 'Archivo no encontrado en el índice' });
	}

	// Verificar que el archivo sigue existiendo en disco
	fs.stat(absolutePath, function(err) {
		if (err) {
			return callback(404, { 'error': 'El archivo ya no existe en disco' });
		}

		// Intenta seleccionar el archivo vía el estándar D-Bus FileManager1
		// (soportado por PCManFM). Si falla, abre la carpeta como fallback.
		var fileUri = 'file://' + absolutePath;
		var env = Object.assign({}, process.env, {
			'DISPLAY': process.env.DISPLAY || ':0',
			'DBUS_SESSION_BUS_ADDRESS': process.env.DBUS_SESSION_BUS_ADDRESS || 'unix:path=/run/user/1000/bus'
		});

		// Comprueba si org.freedesktop.FileManager1 ya está registrado en D-Bus.
		// Si no lo está, lanza pcmanfm-qt primero y espera a que arranque.
		// Si ya está, llama a ShowItems directamente sin abrir una instancia extra.
		childProcess.execFile('dbus-send', [
			'--session',
			'--dest=org.freedesktop.DBus',
			'--type=method_call',
			'--print-reply',
			'/org/freedesktop/DBus',
			'org.freedesktop.DBus.NameHasOwner',
			'string:org.freedesktop.FileManager1'
		], { 'env': env }, function(err, stdout) {
			var alreadyRunning = !err && stdout && stdout.indexOf('true') > -1;

			function callShowItems() {
				childProcess.execFile('dbus-send', [
					'--session',
					'--dest=org.freedesktop.FileManager1',
					'--type=method_call',
					'/org/freedesktop/FileManager1',
					'org.freedesktop.FileManager1.ShowItems',
					'array:string:' + fileUri,
					'string:'
				], { 'env': env }, function(err) {
					if (err) {
						debug('D-Bus ShowItems falló:', err.message);
						var dir = path.dirname(absolutePath);
						childProcess.execFile('pcmanfm-qt', [dir], { 'env': env }, function(err2) {
							if (err2) {
								return callback(500, { 'error': 'No se pudo abrir PCManFM-Qt: ' + err2.message });
							}
							callback(200, { 'ok': true, 'path': absolutePath, 'method': 'folder' });
						});
						return;
					}
					callback(200, { 'ok': true, 'path': absolutePath, 'method': 'dbus' });
				});
			}

			if (alreadyRunning) {
				// Ya hay un FileManager1 registrado — llamar directamente
				callShowItems();
			} else {
				// No hay gestor registrado — arrancar pcmanfm-qt y esperar
				childProcess.execFile('pcmanfm-qt', [], { 'env': env, 'detached': true, 'stdio': 'ignore' }, function() {});
				setTimeout(callShowItems, 800);
			}
		});
	});
};

// Ping handler
handlers.ping = function(data, callback) {
	callback(200);
};

/* ============================================
 * GALERÍA DE VIDEOS
 * ============================================ */

// Tipos MIME de video soportados
handlers._videoContentTypes = {
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mov': 'video/quicktime',
	'.avi': 'video/x-msvideo',
	'.mkv': 'video/x-matroska',
	'.m4v': 'video/mp4'
};

// GET /api/videos — devuelve la lista completa de videos
handlers.apiVideos = function(data, callback) {
	if (data.method == 'get') {
		callback(200, {
			'videos': videoStore.getAll(),
			'total': videoStore.getAll().length,
			'scannedAt': videoStore.lastScanAt,
			'error': videoStore.lastError
		});
	} else {
		callback(405);
	}
};

// GET /api/rescan-videos — fuerza un re-escaneo inmediato de la carpeta de videos
handlers.apiRescanVideos = function(data, callback) {
	if (data.method == 'get') {
		videoWatcher.scanNow(function(err, diff) {
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

// GET /video?p=nombre-archivo.mp4 — sirve el video con soporte de HTTP Range requests.
// Range requests son IMPRESCINDIBLES para que el navegador pueda buscar dentro del
// video sin descargarlo completo (seek en la barra de progreso).
// Solo permite acceder a archivos dentro de VIDEOS_DIR (anti path-traversal).
handlers.video = function(data, callback) {
	if (data.method != 'get') {
		return callback(405);
	}

	var fileName = typeof(data.queryStringObject.p) == 'string' && data.queryStringObject.p.length > 0
		? data.queryStringObject.p : false;
	if (!fileName) {
		return callback(400);
	}

	try {
		fileName = decodeURIComponent(fileName);
	} catch(e) {
		return callback(400);
	}

	var rootDir = path.resolve(config.videosDir);
	var requestedPath = path.resolve(rootDir, fileName);
	var rootWithSep = rootDir + path.sep;

	// Anti path-traversal: la ruta resuelta debe empezar con la carpeta de videos
	if (requestedPath.indexOf(rootWithSep) !== 0) {
		debug('Intento de acceso fuera de VIDEOS_DIR bloqueado:', fileName);
		return callback(403);
	}

	var ext = path.extname(requestedPath).toLowerCase();
	var mimeType = handlers._videoContentTypes[ext];
	if (!mimeType) {
		return callback(415);
	}

	fs.stat(requestedPath, function(err, stats) {
		if (err || !stats.isFile()) {
			return callback(404);
		}

		var fileSize = stats.size;
		var rangeHeader = data.headers && data.headers['range'];

		if (rangeHeader) {
			// Range request — el navegador pide un fragmento concreto del archivo
			var parts = rangeHeader.replace(/bytes=/, '').split('-');
			var start = parseInt(parts[0], 10);
			var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

			// Clamp por seguridad
			if (isNaN(start) || start < 0) { start = 0; }
			if (isNaN(end) || end >= fileSize) { end = fileSize - 1; }

			if (start > end) {
				return callback(416);
			}

			var chunkSize = (end - start) + 1;

			fs.open(requestedPath, 'r', function(err, fd) {
				if (err) { return callback(500); }

				var buf = Buffer.alloc(chunkSize);
				fs.read(fd, buf, 0, chunkSize, start, function(err) {
					fs.close(fd, function() {});
					if (err) { return callback(500); }

					// Usamos un contentType especial 'videoRange' que server.js interpreta
					callback(206, buf, 'videoRange', {
						'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
						'Accept-Ranges': 'bytes',
						'Content-Length': chunkSize,
						'Content-Type': mimeType
					});
				});
			});
		} else {
			// Petición completa (sin Range) — responde con el archivo entero
			fs.readFile(requestedPath, function(err, fileData) {
				if (err || !fileData) { return callback(404); }
				callback(200, fileData, 'videoFull', {
					'Accept-Ranges': 'bytes',
					'Content-Length': fileSize,
					'Content-Type': mimeType
				});
			});
		}
	});
};

// Not found handler
handlers.notFound = function(data, callback) {
	callback(404);
};

// Export the module
module.exports = handlers;
