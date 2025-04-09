# Usar Node.js 16 con Debian (más estable)
FROM node:16-buster

# Instalar FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar package.json
COPY audio-viz-app/package*.json ./

# Eliminar canvas y agregar sharp mediante un script
RUN sed -i '/"canvas"/d' ./package.json && \
    npm install sharp@0.32.1 --save

# Instalar dependencias
RUN npm install

# Copiar el resto de la aplicación
COPY audio-viz-app/. .

# Crear directorios necesarios
RUN mkdir -p uploads outputs

# Puerto en el que escucha la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
