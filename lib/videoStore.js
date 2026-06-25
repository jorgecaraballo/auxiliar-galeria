'use strict';
// Mantiene en memoria la última lista de videos escaneados y calcula
// la diferencia (añadidos/eliminados) respecto al escaneo anterior.

// Container for the module
var videoStore = {};

// Lista actual de videos (array de descriptores)
videoStore.current = [];
// Índice por relPath para diffs rápidos
videoStore.index = {};
// Marca de tiempo del último escaneo exitoso
videoStore.lastScanAt = null;
// Último error de escaneo (false si no hay error)
videoStore.lastError = false;

// Reemplaza la lista actual por newList y devuelve { added, removed }
// added: array de descriptores nuevos
// removed: array de relPath que ya no existen
videoStore.replace = function(newList) {
	newList = Array.isArray(newList) ? newList : [];

	var newIndex = {};
	var added = [];

	newList.forEach(function(video) {
		newIndex[video.relPath] = video;
		if (!videoStore.index.hasOwnProperty(video.relPath)) {
			added.push(video);
		}
	});

	var removed = [];
	Object.keys(videoStore.index).forEach(function(relPath) {
		if (!newIndex.hasOwnProperty(relPath)) {
			removed.push(relPath);
		}
	});

	videoStore.current = newList;
	videoStore.index = newIndex;
	videoStore.lastScanAt = Date.now();

	return { 'added': added, 'removed': removed };
};

// Devuelve la lista actual completa
videoStore.getAll = function() {
	return videoStore.current;
};

// Export the module
module.exports = videoStore;
