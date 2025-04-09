# Usar una imagen oficial de Node.js (versión 18 LTS es una buena opción)
FROM node:18-slim

# Instalar FFmpeg y todas las dependencias necesarias para compilar canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo FINAL DENTRO del contenedor
WORKDIR /usr/src/app

# Copiar PRIMERO los archivos package.json y package-lock.json
COPY audio-viz-app/package*.json ./

# Instalar canvas PRIMERO con todas las flags necesarias
RUN npm install canvas --build-from-source

# Instalar el resto de dependencias
RUN npm install

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
