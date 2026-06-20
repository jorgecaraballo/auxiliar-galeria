'use strict';
// Escanea recursivamente una carpeta en busca de archivos de imagen.
// Estilo: Node.js puro, sin Promises/async-await, callbacks únicamente.

// Dependencies
var fs = require('fs');
var path = require('path');
var util = require('util');
var debug = util.debuglog('imageScanner');

// Container for the module
var scanner = {};

// Extensiones de imagen soportadas (minúsculas)
scanner.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

// Comparador de "orden natural": compara tramos numéricos como números y
// tramos de texto como texto, para que "carpeta2" venga antes que
// "carpeta10" (en vez del orden alfabético puro, donde "10" < "2").
scanner._naturalCompare = function(a, b) {
	var ax = [];
	var bx = [];

	a.replace(/(\d+)|(\D+)/g, function(_, numero, texto) {
		ax.push([numero || Infinity, texto || '']);
	});
	b.replace(/(\d+)|(\D+)/g, function(_, numero, texto) {
		bx.push([numero || Infinity, texto || '']);
	});

	while (ax.length && bx.length) {
		var an = ax.shift();
		var bn = bx.shift();
		var diferencia = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
		if (diferencia) {
			return diferencia;
		}
	}

	return ax.length - bx.length;
};

// Recorre recursivamente un directorio acumulando descriptores de imagen en resultsArr.
// callback(err) — err es false/undefined si todo salió bien.
scanner._walk = function(dir, rootDir, resultsArr, callback) {
	fs.readdir(dir, { withFileTypes: true }, function(err, entries) {
		if (err) {
			// No se pudo leer esta subcarpeta (permisos, etc.) — se ignora y se continúa
			debug('No se pudo leer la carpeta', dir, err.message);
			return callback(false);
		}

		var pending = entries.length;
		if (pending === 0) {
			return callback(false);
		}

		var finished = false;
		var checkDone = function() {
			pending--;
			if (pending === 0 && !finished) {
				finished = true;
				callback(false);
			}
		};

		entries.forEach(function(entry) {
			var fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				scanner._walk(fullPath, rootDir, resultsArr, function() {
					checkDone();
				});
				return;
			}

			if (!entry.isFile()) {
				// symlinks, sockets, etc. — se ignoran
				checkDone();
				return;
			}

			var ext = path.extname(entry.name).toLowerCase();
			if (scanner.imageExtensions.indexOf(ext) === -1) {
				checkDone();
				return;
			}

			fs.stat(fullPath, function(err, stats) {
				if (err) {
					debug('No se pudo leer el archivo', fullPath, err.message);
					checkDone();
					return;
				}

				var relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
				var relDirRaw = path.relative(rootDir, dir).split(path.sep).join('/');

				resultsArr.push({
					'relPath': relPath,
					'relDir': relDirRaw.length > 0 ? relDirRaw : '.',
					'fileName': entry.name,
					'ext': ext,
					'sizeBytes': stats.size,
					'mtimeMs': stats.mtimeMs
				});

				checkDone();
			});
		});
	});
};

// Escanea rootDir recursivamente. callback(err, images)
scanner.scan = function(rootDir, callback) {
	rootDir = typeof(rootDir) == 'string' && rootDir.length > 0 ? rootDir : false;
	if (!rootDir) {
		return callback('No se especificó una carpeta válida para escanear');
	}

	fs.stat(rootDir, function(err, stats) {
		if (err) {
			return callback('La carpeta configurada (IMAGES_DIR) no existe o no es accesible: ' + rootDir);
		}
		if (!stats.isDirectory()) {
			return callback('La ruta configurada (IMAGES_DIR) no es una carpeta: ' + rootDir);
		}

		var results = [];
		scanner._walk(rootDir, rootDir, results, function() {
			// Orden natural por ruta relativa: carpeta "2" antes que "10",
			// y dentro de cada carpeta, los archivos en el mismo orden natural.
			results.sort(function(a, b) {
				return scanner._naturalCompare(a.relPath, b.relPath);
			});
			callback(false, results);
		});
	});
};

// Export the module
module.exports = scanner;
