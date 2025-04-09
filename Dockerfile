# Usar una imagen oficial de Node.js (versión 18 LTS es una buena opción)
FROM node:18-slim

# Instalar FFmpeg y otras utilidades necesarias
# 'apt-get update' actualiza la lista de paquetes
# 'apt-get install -y --no-install-recommends ffmpeg' instala ffmpeg sin paquetes extra no necesarios
# 'rm -rf /var/lib/apt/lists/*' limpia la caché de apt para mantener la imagen pequeña
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo DENTRO del contenedor
WORKDIR /usr/src/app

# Copiar los archivos package.json y package-lock.json
# DESDE la carpeta 'audio-viz-app' del contexto de build
# HACIA el directorio de trabajo actual '.' (/usr/src/app)
COPY audio-viz-app/package*.json ./

# Instalar las dependencias de la aplicación (ahora encontrará package.json)
RUN npm install
# Si tuvieras dependencias de desarrollo que NO necesitas en producción:
# RUN npm ci --omit=dev

# Copiar TODO el contenido restante de la carpeta local 'audio-viz-app'
# HACIA el directorio de trabajo actual '.' (/usr/src/app)
COPY audio-viz-app/. .

# Crear directorios si la aplicación los necesita explícitamente
# (Si tu código asume que existen, descomenta y ajusta las rutas si es necesario)
# RUN mkdir -p uploads outputs

# Informar a Docker que la aplicación escuchará en el puerto 3000
# Render inyectará la variable PORT, pero es bueno exponerlo igualmente.
EXPOSE 3000

# Definir el comando para ejecutar la aplicación
# server.js ahora está en el WORKDIR (/usr/src/app)
CMD [ "node", "server.js" ]
