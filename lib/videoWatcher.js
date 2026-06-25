'use strict';
// Re-escanea periódicamente la carpeta de videos y, si hay cambios,
// notifica a todos los clientes conectados vía Socket.IO (evento videos:update).

// Dependencies
var util = require('util');
var debug = util.debuglog('videoWatcher');
var config = require('./config');
var scanner = require('./videoScanner');
var videoStore = require('./videoStore');

// Container for the module
var videoWatcher = {};

videoWatcher.io = null;
videoWatcher.timer = null;
videoWatcher.scanning = false;

// Ejecuta un escaneo inmediato. callback(err, diff)
videoWatcher.scanNow = function(callback) {
	callback = typeof(callback) == 'function' ? callback : function() {};

	if (videoWatcher.scanning) {
		debug('Escaneo de videos ya en curso, se omite esta llamada');
		return callback(false, { 'added': [], 'removed': [], 'skipped': true });
	}

	videoWatcher.scanning = true;
	scanner.scan(config.videosDir, function(err, videos) {
		videoWatcher.scanning = false;

		if (err) {
			videoStore.lastError = err;
			debug('Error escaneando carpeta de videos:', err);
			return callback(err);
		}

		videoStore.lastError = false;
		var diff = videoStore.replace(videos);

		if ((diff.added.length > 0 || diff.removed.length > 0) && videoWatcher.io) {
			videoWatcher.io.emit('videos:update', {
				'added': diff.added,
				'removed': diff.removed,
				'total': videos.length,
				'scannedAt': videoStore.lastScanAt
			});
			debug('Cambios en videos detectados — añadidos:', diff.added.length, 'eliminados:', diff.removed.length);
		}

		callback(false, diff);
	});
};

// Inicia el polling periódico. io = instancia de Socket.IO
videoWatcher.init = function(io) {
	videoWatcher.io = io;

	videoWatcher.scanNow(function(err) {
		if (err) {
			debug('Escaneo inicial de videos falló:', err);
		} else {
			debug('Escaneo inicial de videos completo —', videoStore.getAll().length, 'videos');
		}
	});

	videoWatcher.timer = setInterval(function() {
		videoWatcher.scanNow(function() {});
	}, config.videoPollIntervalMs);
};

// Export the module
module.exports = videoWatcher;
