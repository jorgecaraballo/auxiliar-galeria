# auxiliar-galeria

Galería de imágenes **de solo lectura**, en **Node.js puro** (sin frameworks), basada en [`auxiliar-prototipo`](https://github.com/jorgecaraballo/auxiliar-prototipo).

Escanea recursivamente una carpeta (y todas sus subcarpetas) en busca de imágenes, muestra sus miniaturas en una cuadrícula responsive, y se actualiza sola en cuanto detecta una imagen o subcarpeta nueva — sin recargar la página ni perder la posición del scroll.

## Características

- **Solo lectura**: nunca crea, mueve ni modifica archivos. Las miniaturas son las imágenes originales, redimensionadas por el navegador (`object-fit: cover`), no copias en disco.
- **Escaneo recursivo** de subcarpetas, mostrando la ruta relativa bajo cada miniatura.
- **Auto-actualización**: la carpeta se re-escanea periódicamente (configurable, `POLL_INTERVAL_MS`) y, si hay cambios, todos los clientes conectados se actualizan en vivo vía Socket.IO.
- **Botón de actualizar**: fuerza un re-escaneo inmediato sin esperar al siguiente ciclo.
- **Preserva el scroll**: las imágenes nuevas se añaden al final de la cuadrícula y las eliminadas se quitan puntualmente — nunca se reconstruye la vista completa, así no pierdes de vista lo que ya estabas mirando.
- **Mobile-responsive**: grid con columnas automáticas (`auto-fill`), pensado para verse bien desde el celular hasta escritorio.
- Protegido contra *path traversal* al servir las imágenes.

## Estructura

```
├── index.js                 — punto de entrada
├── lib/
│   ├── server.js            — router principal + Socket.IO
│   ├── handlers.js          — handlers por ruta (estilo REST artesanal)
│   ├── helpers.js           — utilidades (templates, assets)
│   ├── config.js            — configuración (puerto, carpeta de imágenes, polling)
│   ├── imageScanner.js      — escaneo recursivo de imágenes (callback puro)
│   ├── imageStore.js        — cache en memoria + cálculo de diffs (añadidas/eliminadas)
│   ├── watcher.js           — polling periódico + notificación vía Socket.IO
│   └── logs.js              — utilidades de logging (heredado de la base)
├── public/
│   ├── css/gallery.css      — estilos de la galería
│   ├── js/gallery.js        — lógica de cliente (fetch inicial + Socket.IO + render append-only)
│   ├── main.css             — estilos generales heredados de la base
│   └── favicon.ico
├── templates/                — HTML servido desde el servidor
│   ├── _header.html
│   ├── _footer.html
│   └── index.html
├── imagenes-ejemplo/         — carpeta de ejemplo (vacía) usada si no configuras IMAGES_DIR
└── .env                      — variables de entorno (no versionado)
```

## Convenciones del código

- **Sin frameworks** en backend (Node.js puro, nada de Express)
- **Callbacks** (no Promises ni async/await) en todo el backend
- Módulos al estilo `var modulo = {}; modulo.metodo = function() {}; module.exports = modulo;`
- `debug` (vía `util.debuglog`) en lugar de `console.log` para logs de desarrollo

## Instalación

```bash
git clone https://github.com/jorgecaraballo/auxiliar-galeria.git
cd auxiliar-galeria
npm install
cp .env.example .env   # editar IMAGES_DIR con la ruta real a tus imágenes
node index.js
```

## Variables de entorno (`.env`)

```
NODE_ENV=staging
HTTP_PORT=8090
HASHING_SECRET=changeThisSecret

# Ruta absoluta a la carpeta raíz que se escaneará recursivamente
IMAGES_DIR=/ruta/absoluta/a/tu/carpeta/de/imagenes

# Cada cuántos ms se re-escanea la carpeta para detectar cambios
POLL_INTERVAL_MS=4000
```

Si no defines `IMAGES_DIR`, se usa la carpeta `imagenes-ejemplo/` dentro del propio proyecto (vacía por defecto).

## Rutas disponibles

| Ruta | Descripción |
|------|-------------|
| `GET /` | Página principal de la galería |
| `GET /ping` | Health check |
| `GET /api/images` | Lista JSON de todas las imágenes encontradas (desde el cache en memoria) |
| `GET /api/rescan` | Fuerza un re-escaneo inmediato (lo usa el botón "Actualizar") |
| `GET /image?p=ruta/relativa.jpg` | Sirve el archivo de imagen original (solo lectura) |

## Cómo funciona la auto-actualización

1. Al arrancar, `watcher.init()` hace un primer escaneo y luego repite el escaneo cada `POLL_INTERVAL_MS` milisegundos.
2. Cada escaneo se compara contra el anterior (`imageStore.replace`), calculando qué imágenes son nuevas y cuáles desaparecieron.
3. Si hubo cambios, se emite `images:update` por Socket.IO a todos los clientes conectados, con `{ added, removed }`.
4. El cliente (`public/js/gallery.js`) añade las tarjetas nuevas al final del grid y quita las que ya no existen, sin tocar el resto del DOM — por eso no se pierde el scroll.
5. El botón "Actualizar" simplemente llama a `GET /api/rescan`, que dispara el mismo ciclo de inmediato (en vez de esperar al siguiente polling).

## Partiendo de este proyecto

Este proyecto, a su vez, puede servir de base para futuros derivados:

1. Clonar este repositorio
2. Añadir/editar templates en `templates/`
3. Añadir rutas en `server.router` (en `lib/server.js`)
4. Añadir handlers en `lib/handlers.js`
5. Añadir assets en `public/`
