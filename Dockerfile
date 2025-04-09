# Usar la imagen oficial de Sharp que ya incluye todas las dependencias necesarias
FROM node:16-alpine

# Instalar FFmpeg
RUN apk add --no-cache ffmpeg

# Configurar variables de entorno para sharp
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_arch=x64
ENV npm_config_platform=linux

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY audio-viz-app/package*.json ./

# Eliminar node_modules si existe (por seguridad)
RUN rm -rf node_modules

# Instalar dependencias con flag específico para problemas de plataforma
RUN npm install --verbose --unsafe-perm

# Copiar el resto de la aplicación
COPY audio-viz-app/. .

# Crear directorios necesarios
RUN mkdir -p uploads outputs

# Puerto en el que escucha la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
