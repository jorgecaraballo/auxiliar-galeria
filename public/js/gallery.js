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

	var lightbox = document.getElementById('lightbox');
	var lightboxImg = document.getElementById('lightbox-img');
	var lightboxCaption = document.getElementById('lightbox-caption');
	var lightboxClose = document.getElementById('lightbox-close');
	var lightboxPrev = document.getElementById('lightbox-prev');
	var lightboxNext = document.getElementById('lightbox-next');

	// relPath -> descriptor de la imagen ({relPath, relDir, fileName, ...})
	var imagesByPath = {};
	// Orden de renderizado actual (coincide con el orden visual del grid)
	var order = [];
	// Índice actualmente abierto en el lightbox (-1 = cerrado)
	var lightboxIndex = -1;

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
		// Tooltip nativo del navegador: nombre/ruta completa al hacer hover
		imageEl.title = img.relPath;
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
		nameLine.title = img.relPath;

		caption.appendChild(folderLine);
		caption.appendChild(nameLine);

		card.appendChild(thumbWrap);
		card.appendChild(caption);
		return card;
	}

	function appendImages(images) {
		images = images || [];
		images.forEach(function(img) {
			if (imagesByPath.hasOwnProperty(img.relPath)) { return; }
			imagesByPath[img.relPath] = img;
			order.push(img.relPath);
			grid.appendChild(buildCard(img));
		});
		afterRenderChange();
	}

	function removeImages(relPaths) {
		relPaths = relPaths || [];
		relPaths.forEach(function(relPath) {
			if (!imagesByPath.hasOwnProperty(relPath)) { return; }
			delete imagesByPath[relPath];

			var orderIdx = order.indexOf(relPath);
			if (orderIdx > -1) { order.splice(orderIdx, 1); }

			var card = grid.querySelector('[data-path="' + cssEscape(relPath) + '"]');
			if (card) { grid.removeChild(card); }
		});

		// Si la imagen que se estaba viendo en el lightbox fue eliminada, se cierra
		if (lightboxIndex > -1 && relPaths.indexOf(lightboxOpenPath) > -1) {
			closeLightbox();
		}

		afterRenderChange();
	}

	function cssEscape(str) {
		return String(str).replace(/["\\]/g, '\\$&');
	}

	function afterRenderChange() {
		var total = order.length;
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

	/* ===== Lightbox ===== */

	var lightboxOpenPath = null;

	function openLightbox(index) {
		if (index < 0 || index >= order.length) { return; }
		lightboxIndex = index;
		lightboxOpenPath = order[index];

		var img = imagesByPath[lightboxOpenPath];
		if (!img) { return; }

		lightboxImg.src = 'image?p=' + encodeURIComponent(img.relPath);
		lightboxImg.alt = img.fileName;
		lightboxCaption.textContent = img.relPath;

		lightbox.classList.add('is-open');
		lightbox.setAttribute('aria-hidden', 'false');
	}

	function closeLightbox() {
		lightboxIndex = -1;
		lightboxOpenPath = null;
		lightbox.classList.remove('is-open');
		lightbox.setAttribute('aria-hidden', 'true');
		lightboxImg.src = '';
	}

	function showRelative(delta) {
		if (lightboxIndex === -1 || order.length === 0) { return; }
		var nextIndex = (lightboxIndex + delta + order.length) % order.length;
		openLightbox(nextIndex);
	}

	grid.addEventListener('click', function(e) {
		var card = e.target.closest('.gallery-card');
		if (!card) { return; }
		var relPath = card.getAttribute('data-path');
		var idx = order.indexOf(relPath);
		if (idx > -1) { openLightbox(idx); }
	});

	lightboxClose.addEventListener('click', closeLightbox);
	lightboxPrev.addEventListener('click', function() { showRelative(-1); });
	lightboxNext.addEventListener('click', function() { showRelative(1); });

	// Cerrar al hacer click en el fondo oscuro (no en la imagen ni en los botones)
	lightbox.addEventListener('click', function(e) {
		if (e.target === lightbox) { closeLightbox(); }
	});

	document.addEventListener('keydown', function(e) {
		if (!lightbox.classList.contains('is-open')) { return; }
		if (e.key === 'Escape') { closeLightbox(); }
		if (e.key === 'ArrowLeft') { showRelative(-1); }
		if (e.key === 'ArrowRight') { showRelative(1); }
	});

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
			setStatus('Actualizado · ' + order.length + ' imágenes');
		});
	});

})();
