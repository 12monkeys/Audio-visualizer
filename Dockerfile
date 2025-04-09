# Usar una imagen oficial de Node.js (versión 18 LTS es una buena opción)
FROM node:18-slim

# Instalar FFmpeg y otras utilidades necesarias
# 'apt-get update' actualiza la lista de paquetes
# 'apt-get install -y --no-install-recommends ffmpeg' instala ffmpeg sin paquetes extra no necesarios
# 'rm -rf /var/lib/apt/lists/*' limpia la caché de apt para mantener la imagen pequeña
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && \
    rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo FINAL DENTRO del contenedor
WORKDIR /usr/src/app

# Copiar PRIMERO los archivos package.json y package-lock.json
COPY audio-viz-app/package*.json ./

# ------ PASO DE DEPURACIÓN ------
# Listar el contenido del directorio de trabajo para verificar si package.json está aquí
RUN echo "--- Listing files in /usr/src/app before npm install ---" && ls -la
# ---------------------------------

# Instalar las dependencias de la aplicación
RUN npm install
# Si tuvieras dependencias de desarrollo que NO necesitas en producción:
# RUN npm ci --omit=dev

# Copiar TODO el contenido restante de la carpeta local 'audio-viz-app'
COPY audio-viz-app/. .

# Crear directorios si la aplicación los necesita explícitamente
# (Asegúrate de que las rutas en tu server.js coincidan si descomentas esto)
# RUN mkdir -p uploads outputs

# Informar a Docker que la aplicación escuchará en el puerto 3000
# Render inyectará la variable PORT, pero es bueno exponerlo igualmente.
EXPOSE 3000

# Definir el comando para ejecutar la aplicación
# server.js ahora está en el WORKDIR actual (/usr/src/app)
CMD [ "node", "server.js" ]
