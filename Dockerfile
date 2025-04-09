# Usar Alpine Linux que es más ligero y a veces más compatible con módulos nativos
FROM node:18-alpine

# Instalar dependencias de sistema necesarias para Alpine
RUN apk add --no-cache \
    ffmpeg \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    python3

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar los archivos de configuración
COPY audio-viz-app/package*.json ./

# IMPORTANTE: Instalar una versión específica anterior de canvas que es más estable
RUN npm uninstall canvas || true && \
    npm install canvas@2.6.1 --build-from-source

# Instalar el resto de dependencias
RUN npm install 

# Copiar el resto de la aplicación
COPY audio-viz-app/. .

# Crear directorios si son necesarios
RUN mkdir -p uploads outputs

# Informar a Docker que la aplicación escuchará en el puerto 3000
EXPOSE 3000

# Definir el comando para ejecutar la aplicación
CMD ["node", "server.js"]
