'use strict';
// Galería: lógica de fotos + videos con pestañas.
// Fotos: append-only (orden del servidor, nunca se reconstruye el grid para no perder scroll).
// Videos: ídem, aunque el servidor ya los ordena del más nuevo al más antiguo.

(function() {

	/* ===== Referencias al DOM ===== */

	var grid        = document.getElementById('gallery-grid');
	var videoGrid   = document.getElementById('video-grid');
	var emptyPhotos = document.getElementById('empty-photos');
	var emptyVideos = document.getElementById('empty-videos');
	var countEl     = document.getElementById('image-count');
	var videoCountEl = document.getElementById('video-count');
	var statusEl    = document.getElementById('scan-status');
	var refreshBtn  = document.getElementById('refresh-btn');

	// Pestañas
	var tabPhotos   = document.getElementById('tab-photos');
	var tabVideos   = document.getElementById('tab-videos');
	var panelPhotos = document.getElementById('panel-photos');
	var panelVideos = document.getElementById('panel-videos');

	// Lightbox de imágenes
	var lightbox        = document.getElementById('lightbox');
	var lightboxImg     = document.getElementById('lightbox-img');
	var lightboxCaption = document.getElementById('lightbox-caption');
	var lightboxClose   = document.getElementById('lightbox-close');
	var lightboxPrev    = document.getElementById('lightbox-prev');
	var lightboxNext    = document.getElementById('lightbox-next');

	// Lightbox de videos
	var videoLightbox        = document.getElementById('video-lightbox');
	var lightboxVideo        = document.getElementById('lightbox-video');
	var videoLightboxCaption = document.getElementById('video-lightbox-caption');
	var videoLightboxClose   = document.getElementById('video-lightbox-close');
	var videoLightboxPrev    = document.getElementById('video-lightbox-prev');
	var videoLightboxNext    = document.getElementById('video-lightbox-next');

	/* ===== Estado de fotos ===== */

	var imagesByPath = {};
	var imagesOrder  = [];
	var lightboxIndex = -1;
	var lightboxOpenPath = null;

	/* ===== Estado de videos ===== */

	var videosByPath = {};
	var videosOrder  = [];
	var videoLightboxIndex = -1;
	var videoLightboxOpenPath = null;

	/* ===== Pestañas ===== */

	var currentTab = 'photos';

	function switchTab(tab) {
		currentTab = tab;
		if (tab === 'photos') {
			tabPhotos.classList.add('tab-btn--active');
			tabVideos.classList.remove('tab-btn--active');
			panelPhotos.classList.add('tab-panel--active');
			panelVideos.classList.remove('tab-panel--active');
		} else {
			tabVideos.classList.add('tab-btn--active');
			tabPhotos.classList.remove('tab-btn--active');
			panelVideos.classList.add('tab-panel--active');
			panelPhotos.classList.remove('tab-panel--active');
		}
	}

	tabPhotos.addEventListener('click', function() { switchTab('photos'); });
	tabVideos.addEventListener('click', function() { switchTab('videos'); });

	/* ===== Utilidades ===== */

	function cssEscape(str) {
		return String(str).replace(/["\\]/g, '\\$&');
	}

	function setStatus(text) {
		statusEl.textContent = text;
	}

	/* ===== Fotos ===== */

	function buildImageCard(img) {
		var card = document.createElement('div');
		card.className = 'gallery-card';
		card.setAttribute('data-path', img.relPath);

		var thumbWrap = document.createElement('div');
		thumbWrap.className = 'gallery-thumb';

		var imageEl = document.createElement('img');
		imageEl.loading = 'lazy';
		imageEl.decoding = 'async';
		imageEl.alt = img.fileName;
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
			imagesOrder.push(img.relPath);
			grid.appendChild(buildImageCard(img));
		});
		afterImagesChange();
	}

	function removeImages(relPaths) {
		relPaths = relPaths || [];
		relPaths.forEach(function(relPath) {
			if (!imagesByPath.hasOwnProperty(relPath)) { return; }
			delete imagesByPath[relPath];
			var idx = imagesOrder.indexOf(relPath);
			if (idx > -1) { imagesOrder.splice(idx, 1); }
			var card = grid.querySelector('[data-path="' + cssEscape(relPath) + '"]');
			if (card) { grid.removeChild(card); }
		});
		if (lightboxIndex > -1 && relPaths.indexOf(lightboxOpenPath) > -1) {
			closeLightbox();
		}
		afterImagesChange();
	}

	function afterImagesChange() {
		var total = imagesOrder.length;
		countEl.textContent = total;
		emptyPhotos.style.display = total > 0 ? 'none' : 'block';
		grid.style.display = total > 0 ? 'grid' : 'none';
	}

	/* ===== Videos ===== */

	function buildVideoCard(v) {
		var card = document.createElement('div');
		card.className = 'gallery-card';
		card.setAttribute('data-path', v.relPath);

		var thumbWrap = document.createElement('div');
		thumbWrap.className = 'video-thumb';

		var videoEl = document.createElement('video');
		videoEl.preload = 'metadata';
		videoEl.muted = true;
		videoEl.title = v.fileName;
		// #t=0.5 hace que el navegador salte al segundo 0.5 para mostrar un fotograma
		// representativo en vez del frame negro del inicio
		videoEl.src = 'video?p=' + encodeURIComponent(v.relPath) + '#t=0.5';
		thumbWrap.appendChild(videoEl);

		var playIcon = document.createElement('span');
		playIcon.className = 'video-play-icon';
		playIcon.textContent = '▶';
		thumbWrap.appendChild(playIcon);

		var caption = document.createElement('div');
		caption.className = 'gallery-caption';

		var nameLine = document.createElement('div');
		nameLine.className = 'gallery-caption-name';
		nameLine.textContent = v.fileName;
		nameLine.title = v.fileName;

		var sizeLine = document.createElement('div');
		sizeLine.className = 'gallery-caption-folder';
		sizeLine.textContent = formatBytes(v.sizeBytes);

		caption.appendChild(nameLine);
		caption.appendChild(sizeLine);
		card.appendChild(thumbWrap);
		card.appendChild(caption);
		return card;
	}

	function formatBytes(bytes) {
		if (!bytes || bytes < 1024) { return bytes + ' B'; }
		if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + ' KB'; }
		if (bytes < 1024 * 1024 * 1024) { return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; }
		return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
	}

	function appendVideos(videos) {
		videos = videos || [];
		videos.forEach(function(v) {
			if (videosByPath.hasOwnProperty(v.relPath)) { return; }
			videosByPath[v.relPath] = v;
			videosOrder.push(v.relPath);
			videoGrid.appendChild(buildVideoCard(v));
		});
		afterVideosChange();
	}

	function removeVideos(relPaths) {
		relPaths = relPaths || [];
		relPaths.forEach(function(relPath) {
			if (!videosByPath.hasOwnProperty(relPath)) { return; }
			delete videosByPath[relPath];
			var idx = videosOrder.indexOf(relPath);
			if (idx > -1) { videosOrder.splice(idx, 1); }
			var card = videoGrid.querySelector('[data-path="' + cssEscape(relPath) + '"]');
			if (card) { videoGrid.removeChild(card); }
		});
		if (videoLightboxIndex > -1 && relPaths.indexOf(videoLightboxOpenPath) > -1) {
			closeVideoLightbox();
		}
		afterVideosChange();
	}

	function afterVideosChange() {
		var total = videosOrder.length;
		videoCountEl.textContent = total;
		emptyVideos.style.display = total > 0 ? 'none' : 'block';
		videoGrid.style.display = total > 0 ? 'grid' : 'none';
	}

	/* ===== Lightbox de imágenes ===== */

	function buildCaption(captionEl, fileName, relPath) {
		captionEl.innerHTML = '';

		var nameDiv = document.createElement('div');
		nameDiv.className = 'lightbox-caption-name';
		nameDiv.textContent = fileName;

		var pathDiv = document.createElement('div');
		pathDiv.className = 'lightbox-caption-path';
		pathDiv.textContent = relPath;

		var openBtn = document.createElement('button');
		openBtn.className = 'lightbox-open-btn';
		openBtn.title = 'Abrir carpeta en PCManFM con el archivo seleccionado';
		openBtn.textContent = '📂 Abrir en PCManFM';
		openBtn.addEventListener('click', function(e) {
			e.stopPropagation();
			fetch('api/open?p=' + encodeURIComponent(relPath))
				.then(function(r) { return r.json(); })
				.then(function(d) {
					if (d.error) { alert('No se pudo abrir PCManFM: ' + d.error); }
				})
				.catch(function() { alert('Error al comunicarse con el servidor'); });
		});

		captionEl.appendChild(nameDiv);
		captionEl.appendChild(pathDiv);
		captionEl.appendChild(openBtn);
	}

	function openLightbox(index) {
		if (index < 0 || index >= imagesOrder.length) { return; }
		lightboxIndex = index;
		lightboxOpenPath = imagesOrder[index];
		var img = imagesByPath[lightboxOpenPath];
		if (!img) { return; }
		lightboxImg.src = 'image?p=' + encodeURIComponent(img.relPath);
		lightboxImg.alt = img.fileName;
		buildCaption(lightboxCaption, img.fileName, img.relPath);
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

	function showImageRelative(delta) {
		if (lightboxIndex === -1 || imagesOrder.length === 0) { return; }
		openLightbox((lightboxIndex + delta + imagesOrder.length) % imagesOrder.length);
	}

	grid.addEventListener('click', function(e) {
		var card = e.target.closest('.gallery-card');
		if (!card) { return; }
		var idx = imagesOrder.indexOf(card.getAttribute('data-path'));
		if (idx > -1) { openLightbox(idx); }
	});

	lightboxClose.addEventListener('click', closeLightbox);
	lightboxPrev.addEventListener('click', function() { showImageRelative(-1); });
	lightboxNext.addEventListener('click', function() { showImageRelative(1); });
	lightbox.addEventListener('click', function(e) {
		if (e.target === lightbox) { closeLightbox(); }
	});

	/* ===== Lightbox de videos ===== */

	function openVideoLightbox(index) {
		if (index < 0 || index >= videosOrder.length) { return; }
		videoLightboxIndex = index;
		videoLightboxOpenPath = videosOrder[index];
		var v = videosByPath[videoLightboxOpenPath];
		if (!v) { return; }
		lightboxVideo.src = 'video?p=' + encodeURIComponent(v.relPath);
		lightboxVideo.load();
		buildCaption(videoLightboxCaption, v.fileName, v.relPath);
		videoLightbox.classList.add('is-open');
		videoLightbox.setAttribute('aria-hidden', 'false');
	}

	function closeVideoLightbox() {
		videoLightboxIndex = -1;
		videoLightboxOpenPath = null;
		lightboxVideo.pause();
		lightboxVideo.src = '';
		videoLightbox.classList.remove('is-open');
		videoLightbox.setAttribute('aria-hidden', 'true');
	}

	function showVideoRelative(delta) {
		if (videoLightboxIndex === -1 || videosOrder.length === 0) { return; }
		openVideoLightbox((videoLightboxIndex + delta + videosOrder.length) % videosOrder.length);
	}

	videoGrid.addEventListener('click', function(e) {
		var card = e.target.closest('.gallery-card');
		if (!card) { return; }
		var idx = videosOrder.indexOf(card.getAttribute('data-path'));
		if (idx > -1) { openVideoLightbox(idx); }
	});

	videoLightboxClose.addEventListener('click', closeVideoLightbox);
	videoLightboxPrev.addEventListener('click', function() { showVideoRelative(-1); });
	videoLightboxNext.addEventListener('click', function() { showVideoRelative(1); });
	videoLightbox.addEventListener('click', function(e) {
		if (e.target === videoLightbox) { closeVideoLightbox(); }
	});

	/* ===== Teclado (ambos lightboxes) ===== */

	document.addEventListener('keydown', function(e) {
		if (lightbox.classList.contains('is-open')) {
			if (e.key === 'Escape') { closeLightbox(); }
			if (e.key === 'ArrowLeft')  { showImageRelative(-1); }
			if (e.key === 'ArrowRight') { showImageRelative(1); }
		}
		if (videoLightbox.classList.contains('is-open')) {
			if (e.key === 'Escape') { closeVideoLightbox(); }
			if (e.key === 'ArrowLeft')  { showVideoRelative(-1); }
			if (e.key === 'ArrowRight') { showVideoRelative(1); }
		}
	});

	/* ===== Refresh ===== */

	function requestRescan() {
		refreshBtn.classList.add('is-spinning');
		var done = 0;
		function checkDone() {
			done++;
			if (done === 2) {
				setTimeout(function() { refreshBtn.classList.remove('is-spinning'); }, 400);
			}
		}
		fetch('api/rescan').then(function(r) { return r.json(); }).then(checkDone).catch(checkDone);
		fetch('api/rescan-videos').then(function(r) { return r.json(); }).then(checkDone).catch(checkDone);
	}

	refreshBtn.addEventListener('click', requestRescan);

	/* ===== Carga inicial ===== */

	function loadInitial() {
		setStatus('Cargando…');

		var done = 0;
		function checkDone() {
			done++;
			if (done === 2) { setStatus('Listo'); }
		}

		fetch('api/images')
			.then(function(res) { return res.json(); })
			.then(function(data) {
				if (!data.error) { appendImages(data.images); }
				checkDone();
			})
			.catch(function() {
				setStatus('Error al cargar fotos');
				checkDone();
			});

		fetch('api/videos')
			.then(function(res) { return res.json(); })
			.then(function(data) {
				if (!data.error) { appendVideos(data.videos); }
				checkDone();
			})
			.catch(function() {
				setStatus('Error al cargar videos');
				checkDone();
			});
	}

	/* ===== Socket.IO ===== */

	window.addEventListener('load', function() {
		loadInitial();

		var socket = io();

		socket.on('images:update', function(payload) {
			payload = payload || {};
			if (payload.added && payload.added.length > 0) { appendImages(payload.added); }
			if (payload.removed && payload.removed.length > 0) { removeImages(payload.removed); }
			setStatus('Actualizado');
		});

		socket.on('videos:update', function(payload) {
			payload = payload || {};
			if (payload.added && payload.added.length > 0) { appendVideos(payload.added); }
			if (payload.removed && payload.removed.length > 0) { removeVideos(payload.removed); }
			setStatus('Actualizado');
		});
	});

})();
