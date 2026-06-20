'use strict';

var path = require('path');

var environments = {};

environments.staging = {
    'httpPort': process.env.HTTP_PORT ? Number(process.env.HTTP_PORT) : 8090,
    'httpsPort': 8091,
    'envName': 'staging',
    'hashingSecret': process.env.HASHING_SECRET || 'thisIsASecret',
    // Carpeta raíz que se escanea recursivamente en busca de imágenes.
    // Si no se define IMAGES_DIR en el .env, se usa una carpeta de ejemplo
    // dentro del propio proyecto (queda vacía hasta que el usuario la configure).
    'imagesDir': process.env.IMAGES_DIR
        ? path.resolve(process.env.IMAGES_DIR)
        : path.join(__dirname, '..', 'imagenes-ejemplo'),
    // Cada cuánto (ms) se re-escanea la carpeta para detectar cambios
    'pollIntervalMs': process.env.POLL_INTERVAL_MS && Number(process.env.POLL_INTERVAL_MS) > 0
        ? Number(process.env.POLL_INTERVAL_MS)
        : 4000,
    'templateGlobals': {
        'appName': 'Galería de Imágenes',
        'baseUrl': 'http://localhost:' + (process.env.HTTP_PORT || 8090) + '/',
    }
};

var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

module.exports = environmentToExport;
