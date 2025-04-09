# Usar una imagen más completa basada en Debian Bullseye
FROM node:18-bullseye

# Instalar FFmpeg y las dependencias necesarias para canvas
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

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Limpiar node_modules si existe (para evitar conflictos)
RUN rm -rf node_modules

# Configurar variables de entorno para node-canvas
ENV PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig
ENV LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu

# Copiar package.json y package-lock.json
COPY audio-viz-app/package*.json ./

# Instalar dependencias de forma limpia
RUN npm ci

# Copiar el resto de la aplicación
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
