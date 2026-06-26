'use strict';
// Escanea una carpeta plana (sin subcarpetas) en busca de archivos de video.
// Los videos se ordenan por fecha de modificación, del más nuevo al más antiguo.
// Estilo: Node.js puro, sin Promises/async-await, callbacks únicamente.

// Dependencies
var fs = require('fs');
var path = require('path');
var util = require('util');
var debug = util.debuglog('videoScanner');

// Container for the module
var scanner = {};

// Extensiones de video soportadas (minúsculas)
scanner.videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

// Escanea videosDir (un solo nivel, sin recursión). callback(err, videos)
// Cada descriptor: { relPath, fileName, ext, sizeBytes, mtimeMs }
scanner.scan = function(videosDir, callback) {
	videosDir = typeof(videosDir) == 'string' && videosDir.length > 0 ? videosDir : false;
	if (!videosDir) {
		return callback('No se especificó una carpeta válida para escanear videos');
	}

	fs.stat(videosDir, function(err, stats) {
		if (err) {
			return callback('La carpeta configurada (VIDEOS_DIR) no existe o no es accesible: ' + videosDir);
		}
		if (!stats.isDirectory()) {
			return callback('La ruta configurada (VIDEOS_DIR) no es una carpeta: ' + videosDir);
		}

		fs.readdir(videosDir, { withFileTypes: true }, function(err, entries) {
			if (err) {
				return callback('No se pudo leer la carpeta de videos: ' + err.message);
			}

			// Filtrar solo archivos con extensión de video
			var videoEntries = entries.filter(function(entry) {
				if (!entry.isFile()) { return false; }
				var ext = path.extname(entry.name).toLowerCase();
				return scanner.videoExtensions.indexOf(ext) > -1;
			});

			if (videoEntries.length === 0) {
				return callback(false, []);
			}

			var results = [];
			var pending = videoEntries.length;

			videoEntries.forEach(function(entry) {
				var fullPath = path.join(videosDir, entry.name);
				fs.stat(fullPath, function(err, stats) {
					if (err) {
						debug('No se pudo leer el archivo de video', fullPath, err.message);
					} else {
						results.push({
							'relPath': entry.name,
							'fileName': entry.name,
							'ext': path.extname(entry.name).toLowerCase(),
							'sizeBytes': stats.size,
							'mtimeMs': stats.mtimeMs
						});
					}

					pending--;
					if (pending === 0) {
						// Ordenar del más antiguo al más nuevo (mtimeMs ascendente)
						results.sort(function(a, b) {
							return a.mtimeMs - b.mtimeMs;
						});
						callback(false, results);
					}
				});
			});
		});
	});
};

// Export the module
module.exports = scanner;
