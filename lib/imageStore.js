'use strict';
// Mantiene en memoria la última lista de imágenes escaneadas y calcula
// la diferencia (añadidas/eliminadas) respecto al escaneo anterior.

// Container for the module
var imageStore = {};

// Lista actual de imágenes (array de descriptores)
imageStore.current = [];
// Índice por relPath para diffs rápidos
imageStore.index = {};
// Marca de tiempo del último escaneo exitoso
imageStore.lastScanAt = null;
// Último error de escaneo (false si no hay error)
imageStore.lastError = false;

// Reemplaza la lista actual por newList y devuelve { added, removed }
// added: array de descriptores nuevos
// removed: array de relPath que ya no existen
imageStore.replace = function(newList) {
	newList = Array.isArray(newList) ? newList : [];

	var newIndex = {};
	var added = [];

	newList.forEach(function(img) {
		newIndex[img.relPath] = img;
		if (!imageStore.index.hasOwnProperty(img.relPath)) {
			added.push(img);
		}
	});

	var removed = [];
	Object.keys(imageStore.index).forEach(function(relPath) {
		if (!newIndex.hasOwnProperty(relPath)) {
			removed.push(relPath);
		}
	});

	imageStore.current = newList;
	imageStore.index = newIndex;
	imageStore.lastScanAt = Date.now();

	return { 'added': added, 'removed': removed };
};

// Devuelve la lista actual completa
imageStore.getAll = function() {
	return imageStore.current;
};

// Export the module
module.exports = imageStore;
