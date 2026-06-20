'use strict';
// Lógica de la galería en el navegador.
// Importante: las imágenes NUEVAS se añaden siempre al final del grid y
// las eliminadas se quitan puntualmente — nunca se reconstruye el grid
// completo, así no se pierde la posición del scroll.

(function() {

	var grid = document.getElementById('gallery-grid');
	var emptyState = document.getElementById('empty-state');
	var countEl = document.getElementById('image-count');
	var statusEl = document.getElementById('scan-status');
	var refreshBtn = document.getElementById('refresh-btn');

	// relPath -> true, para saber qué ya está renderizado
	var rendered = {};

	function buildCard(img) {
		var card = document.createElement('div');
		card.className = 'gallery-card';
		card.setAttribute('data-path', img.relPath);

		var thumbWrap = document.createElement('div');
		thumbWrap.className = 'gallery-thumb';

		var imageEl = document.createElement('img');
		imageEl.loading = 'lazy';
		imageEl.decoding = 'async';
		imageEl.alt = img.fileName;
		imageEl.src = 'image?p=' + encodeURIComponent(img.relPath);
		thumbWrap.appendChild(imageEl);

		var caption = document.createElement('div');
		caption.className = 'gallery-caption';

		var folderLine = document.createElement('div');
		folderLine.className = 'gallery-caption-folder';
		folderLine.textContent = img.relDir === '.' ? '/' : img.relDir;

		var nameLine = document.createElement('div');
		nameLine.className = 'gallery-caption-name';
		nameLine.textContent = img.fileName;

		caption.appendChild(folderLine);
		caption.appendChild(nameLine);

		card.appendChild(thumbWrap);
		card.appendChild(caption);
		return card;
	}

	function appendImages(images) {
		images = images || [];
		images.forEach(function(img) {
			if (rendered[img.relPath]) { return; }
			rendered[img.relPath] = true;
			grid.appendChild(buildCard(img));
		});
		afterRenderChange();
	}

	function removeImages(relPaths) {
		relPaths = relPaths || [];
		relPaths.forEach(function(relPath) {
			delete rendered[relPath];
			var card = grid.querySelector('[data-path="' + cssEscape(relPath) + '"]');
			if (card) { grid.removeChild(card); }
		});
		afterRenderChange();
	}

	function cssEscape(str) {
		return String(str).replace(/["\\]/g, '\\$&');
	}

	function afterRenderChange() {
		var total = Object.keys(rendered).length;
		countEl.textContent = total;
		emptyState.style.display = total > 0 ? 'none' : 'block';
		grid.style.display = total > 0 ? 'grid' : 'none';
	}

	function setStatus(text) {
		statusEl.textContent = text;
	}

	function loadInitial() {
		setStatus('Cargando…');
		fetch('api/images')
			.then(function(res) { return res.json(); })
			.then(function(data) {
				if (data.error) {
					setStatus('Error: ' + data.error);
					return;
				}
				appendImages(data.images);
				setStatus(data.scannedAt ? 'Listo' : '');
			})
			.catch(function() {
				setStatus('No se pudo conectar con el servidor');
			});
	}

	function requestRescan() {
		refreshBtn.classList.add('is-spinning');
		fetch('api/rescan')
			.then(function(res) { return res.json(); })
			.then(function() {
				setTimeout(function() { refreshBtn.classList.remove('is-spinning'); }, 400);
			})
			.catch(function() {
				refreshBtn.classList.remove('is-spinning');
				setStatus('No se pudo actualizar');
			});
	}

	refreshBtn.addEventListener('click', requestRescan);

	window.addEventListener('load', function() {
		loadInitial();

		var socket = io();

		socket.on('images:update', function(payload) {
			payload = payload || {};
			if (payload.added && payload.added.length > 0) {
				appendImages(payload.added);
			}
			if (payload.removed && payload.removed.length > 0) {
				removeImages(payload.removed);
			}
			setStatus('Actualizado · ' + Object.keys(rendered).length + ' imágenes');
		});
	});

})();
