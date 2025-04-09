# Usar una imagen oficial de Node.js (versión 18 LTS es una buena opción)
FROM node:18-slim

# Instalar FFmpeg y otras utilidades necesarias
# 'apt-get update' actualiza la lista de paquetes
# 'apt-get install -y --no-install-recommends ffmpeg' instala ffmpeg sin paquetes extra no necesarios
# 'rm -rf /var/lib/apt/lists/*' limpia la caché de apt para mantener la imagen pequeña
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Establecer un directorio base de trabajo
WORKDIR /usr/src

# Copiar DESDE la subcarpeta 'audio-viz-app' del contexto (raíz)
# HACIA el WORKDIR actual (.) en el contenedor
COPY audio-viz-app/package*.json ./
COPY audio-viz-app/. .

# Cambiar el directorio de trabajo A DENTRO de la carpeta de la aplicación
WORKDIR /usr/src/app

# Ahora package.json está garantizado en el WORKDIR actual (.)
# Instalar las dependencias de la aplicación
RUN npm install
# Si tuvieras dependencias de desarrollo que NO necesitas en producción:
# RUN npm ci --omit=dev

# Crear directorios si la aplicación los necesita explícitamente
# (Asegúrate de que las rutas en tu server.js coincidan si descomentas esto)
# RUN mkdir -p uploads outputs

# Informar a Docker que la aplicación escuchará en el puerto 3000
# Render inyectará la variable PORT, pero es bueno exponerlo igualmente.
EXPOSE 3000

# Definir el comando para ejecutar la aplicación
# server.js ahora está en el WORKDIR actual (/usr/src/app)
CMD [ "node", "server.js" ]
