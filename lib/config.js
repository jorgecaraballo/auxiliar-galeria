'use strict';

var path = require('path');

var environments = {};

environments.staging = {
    'httpPort': process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 8090,
    'httpsPort': 8091,
    'envName': 'staging',
    'hashingSecret': process.env.HASHING_SECRET || 'thisIsASecret',

    // Carpeta raíz que se escanea recursivamente en busca de imágenes.
    'imagesDir': process.env.IMAGES_DIR
        ? path.resolve(process.env.IMAGES_DIR)
        : path.join(__dirname, '..', 'imagenes-ejemplo'),
    // Cada cuánto (ms) se re-escanea la carpeta de imágenes
    'pollIntervalMs': process.env.POLL_INTERVAL_MS && Number(process.env.POLL_INTERVAL_MS) > 0
        ? Number(process.env.POLL_INTERVAL_MS)
        : 4000,

    // Carpeta plana donde se buscan videos (sin recursión de subcarpetas).
    // Los videos se muestran del más nuevo al más antiguo (por fecha de modificación).
    'videosDir': process.env.VIDEOS_DIR
        ? path.resolve(process.env.VIDEOS_DIR)
        : path.join(__dirname, '..', 'videos-ejemplo'),
    // Cada cuánto (ms) se re-escanea la carpeta de videos
    'videoPollIntervalMs': process.env.VIDEO_POLL_INTERVAL_MS && Number(process.env.VIDEO_POLL_INTERVAL_MS) > 0
        ? Number(process.env.VIDEO_POLL_INTERVAL_MS)
        : 6000,

    'templateGlobals': {
        'appName': 'Galería',
        'baseUrl': 'http://localhost:' + (process.env.HTTP_PORT || 8090) + '/',
    }
};

var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

module.exports = environmentToExport;
