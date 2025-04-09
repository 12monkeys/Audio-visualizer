# Usar Node.js 16 con una imagen completa Debian
FROM node:16-buster

# Instalar FFmpeg y dependencias para Sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libvips-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY audio-viz-app/package*.json ./

# Instalar sharp explícitamente primero
RUN npm install sharp --verbose

# Instalar el resto de dependencias 
RUN npm install

# Copiar el resto de la aplicación
COPY audio-viz-app/. .

# Crear directorios necesarios
RUN mkdir -p uploads outputs

# Puerto en el que escucha la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
