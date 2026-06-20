'use strict';
// Re-escanea periódicamente la carpeta de imágenes y, si hay cambios,
// notifica a todos los clientes conectados vía Socket.IO.

// Dependencies
var util = require('util');
var debug = util.debuglog('watcher');
var config = require('./config');
var scanner = require('./imageScanner');
var imageStore = require('./imageStore');

// Container for the module
var watcher = {};

watcher.io = null;
watcher.timer = null;
watcher.scanning = false;

// Ejecuta un escaneo inmediato. callback(err, diff)
// Si ya hay un escaneo en curso, no se solapa: se espera a que termine.
watcher.scanNow = function(callback) {
	callback = typeof(callback) == 'function' ? callback : function() {};

	if (watcher.scanning) {
		debug('Escaneo ya en curso, se omite esta llamada');
		return callback(false, { 'added': [], 'removed': [], 'skipped': true });
	}

	watcher.scanning = true;
	scanner.scan(config.imagesDir, function(err, images) {
		watcher.scanning = false;

		if (err) {
			imageStore.lastError = err;
			debug('Error escaneando carpeta de imágenes:', err);
			return callback(err);
		}

		imageStore.lastError = false;
		var diff = imageStore.replace(images);

		if ((diff.added.length > 0 || diff.removed.length > 0) && watcher.io) {
			watcher.io.emit('images:update', {
				'added': diff.added,
				'removed': diff.removed,
				'total': images.length,
				'scannedAt': imageStore.lastScanAt
			});
			debug('Cambios detectados — añadidas:', diff.added.length, 'eliminadas:', diff.removed.length);
		}

		callback(false, diff);
	});
};

// Inicia el polling periódico. io = instancia de Socket.IO
watcher.init = function(io) {
	watcher.io = io;

	// Escaneo inicial inmediato al arrancar el servidor
	watcher.scanNow(function(err) {
		if (err) {
			debug('Escaneo inicial falló:', err);
		} else {
			debug('Escaneo inicial completo —', imageStore.getAll().length, 'imágenes');
		}
	});

	// Escaneo periódico
	watcher.timer = setInterval(function() {
		watcher.scanNow(function() {});
	}, config.pollIntervalMs);
};

// Export the module
module.exports = watcher;
