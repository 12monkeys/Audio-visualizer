// audio-visualizer.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');
const { AudioContext } = require('web-audio-api');

// Importar la función updateJobProgress desde server.js
let server;
try {
  server = require('./server');
} catch (e) {
  // Manejo para evitar dependencia circular durante la inicialización
  server = { 
    updateJobProgress: (jobId, step, progress) => {
      console.log(`Progreso simulado: ${jobId} - ${step} - ${progress}%`);
    },
    markJobAsCompleted: (jobId) => {
      console.log(`Trabajo simulado completado: ${jobId}`);
    }
  };
}

// Configurar el path a FFmpeg
ffmpeg.setFfmpegPath('C:/ffmpeg/bin/ffmpeg.exe');
ffmpeg.setFfprobePath('C:/ffmpeg/bin/ffprobe.exe');

// Nueva función para renderizar texto desde un Delta
function renderDeltaText(ctx, deltaString, startX, startY) {
  try {
    const delta = JSON.parse(deltaString || '{}');
    if (!delta.ops) return; // Salir si no hay operaciones

    let currentX = startX;
    let currentY = startY;
    const initialFontSize = 20; // Tamaño base por defecto
    const lineHeightMultiplier = 1.2; // Espacio entre líneas

    delta.ops.forEach(op => {
      if (op.insert) {
        if (typeof op.insert === 'string') {
          const text = op.insert;
          const attributes = op.attributes || {};
          
          // Extraer atributos o usar defaults
          const color = attributes.color || '#000000';
          const isBold = attributes.bold || false;
          const isItalic = attributes.italic || false;
          const isUnderline = attributes.underline || false;
          // Extraer tamaño y convertir unidades (pt, px, etc.) a número
          let fontSize = initialFontSize;
          if (attributes.size) {
            const sizeMatch = String(attributes.size).match(/^(\d+(\.\d+)?)/); // Extraer número inicial
            if (sizeMatch) {
              fontSize = parseFloat(sizeMatch[1]);
            } else if (attributes.size === 'small') {
              fontSize = initialFontSize * 0.8;
            } else if (attributes.size === 'large') {
              fontSize = initialFontSize * 1.5;
            } else if (attributes.size === 'huge') {
              fontSize = initialFontSize * 2;
            }
          } 
          const font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px Arial`;

          // Separar texto por saltos de línea
          const lines = text.split('\n');
          lines.forEach((line, index) => {
            if (line) {
              // Aplicar estilos
              ctx.font = font;
              ctx.fillStyle = color;
              
              // Dibujar texto
              ctx.fillText(line, currentX, currentY);

              // Subrayado (si aplica)
              if (isUnderline) {
                const metrics = ctx.measureText(line);
                const lineY = currentY + 2; // Ligeramente debajo de la línea base
                ctx.beginPath();
                ctx.moveTo(currentX, lineY);
                ctx.lineTo(currentX + metrics.width, lineY);
                ctx.strokeStyle = color; // Usar el mismo color que el texto
                ctx.lineWidth = Math.max(1, fontSize / 15); // Grosor proporcional
                ctx.stroke();
              }
              
              // Avanzar X para el siguiente segmento en la misma línea
              currentX += ctx.measureText(line).width;
            }
            
            // Si hay un salto de línea o no es la última línea del segmento
            if (index < lines.length - 1) {
              currentY += fontSize * lineHeightMultiplier; // Mover a la siguiente línea
              currentX = startX; // Resetear X al inicio de la línea
            }
          });
        } else if (typeof op.insert === 'object') {
          // Manejar embeds (imágenes, etc.) si fuera necesario en el futuro
          // Por ahora, simplemente avanzamos X (los embeds tienen longitud 1)
          // Podríamos dibujar un placeholder o intentar cargar la imagen si es op.insert.image
          currentX += 20; // Espacio arbitrario para embeds
        }
      }
      // Se podrían manejar 'delete' y 'retain' si fuera necesario, pero para renderizar contenido completo, solo 'insert' importa.
    });

  } catch (error) {
    console.error('Error rendering Delta text:', deltaString, error);
    // Dibujar mensaje de error en el canvas como fallback
    ctx.fillStyle = 'red';
    ctx.font = '12px Arial';
    ctx.fillText('[Error renderizando texto]', startX, startY);
  }
}

// Función para generar el video con visualización de audio
async function generateVideoWithAudioWave(config) {
  const { audioFile, templateImage, outputFile, waveOptions, textOptions, jobId } = config;
  
  // Generar frames de la visualización de audio
  const framesDir = path.join('outputs', 'frames_' + path.basename(outputFile, '.mp4'));
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  
  try {
    // 1. Analizar el archivo de audio para obtener los datos de la forma de onda
    if (jobId) server.updateJobProgress(jobId, 'audio', 10);
    const audioData = await analyzeAudio(audioFile);
    if (jobId) server.updateJobProgress(jobId, 'audio', 30);
    
    // 2. Generar frames para cada segmento de audio, pasando las opciones de texto
    if (jobId) server.updateJobProgress(jobId, 'frames', 35);
    await generateFrames(audioData, templateImage, framesDir, waveOptions, textOptions, jobId);
    
    // 3. Usar FFmpeg para crear el video a partir de los frames y el audio
    if (jobId) server.updateJobProgress(jobId, 'video', 75);
    await createVideoFromFrames(framesDir, audioFile, outputFile, jobId);
    
    // 4. Limpiar los frames temporales
    if (jobId) server.updateJobProgress(jobId, 'finalizing', 98);
    
    // Añadir un pequeño retraso antes de borrar los frames
    console.log('[generateVideoWithAudioWave] Waiting 2 seconds before cleaning up frames...');
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    console.log('[generateVideoWithAudioWave] Attempting to clean up frames directory:', framesDir);
    await new Promise((resolve, reject) => {
      fs.rm(framesDir, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error('Error al eliminar frames temporales:', err);
        }
        // Marcar explícitamente como completado
        if (jobId) server.markJobAsCompleted(jobId);
        resolve();
      });
    });
    
    return outputFile;
  } catch (error) {
    console.error('Error en la generación del video:', error);
    throw error;
  }
}

// Función para analizar el archivo de audio y obtener datos para la visualización
async function analyzeAudio(audioFile) {
  return new Promise((resolve, reject) => {
    try {
      const buffer = fs.readFileSync(audioFile);
      const context = new AudioContext();
      
      context.decodeAudioData(buffer, (audioBuffer) => {
        // Obtener datos del canal izquierdo (o mono)
        const channel = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Calcular número total de frames (24 fps es bastante estándar)
        const fps = 24;
        const totalFrames = Math.ceil(duration * fps);
        
        // Dividir los datos de audio en segmentos para cada frame
        const samplesPerFrame = Math.floor(channel.length / totalFrames);
        
        const frames = [];
        for (let i = 0; i < totalFrames; i++) {
          const startSample = i * samplesPerFrame;
          const endSample = Math.min(startSample + samplesPerFrame, channel.length);
          
          const segment = channel.slice(startSample, endSample);
          
          // Calcular amplitudes para la visualización
          const amplitudes = processSegment(segment, 100); // 100 puntos por frame
          
          frames.push({
            index: i,
            time: i / fps,
            amplitudes
          });
        }
        
        resolve({
          frames,
          duration,
          sampleRate,
          totalFrames,
          fps
        });
      }, reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Procesar un segmento de audio para obtener amplitudes para visualización
function processSegment(segment, numPoints) {
  const pointsPerSample = segment.length / numPoints;
  const amplitudes = [];
  
  for (let i = 0; i < numPoints; i++) {
    const startSample = Math.floor(i * pointsPerSample);
    const endSample = Math.floor((i + 1) * pointsPerSample);
    
    let sum = 0;
    for (let j = startSample; j < endSample; j++) {
      sum += Math.abs(segment[j] || 0);
    }
    
    // Normalizar entre 0 y 1
    const average = sum / (endSample - startSample) || 0;
    amplitudes.push(average);
  }
  
  return amplitudes;
}

// Generar frames con la visualización de audio
async function generateFrames(audioData, templateImage, framesDir, waveOptions, textOptions = {}, jobId) {
  const { frames } = audioData;
  const { color, x, y, width, height } = waveOptions;
  // Log recibido waveOptions
  //console.log(`[generateFrames] Received waveOptions: x=${x}, y=${y}, width=${width}, height=${height}`); 
  // Recibir Deltas y coordenadas X/Y
  const { hashtagDelta, podcastDelta, hashtagX, hashtagY, podcastX, podcastY } = textOptions;
  //console.log(`[generateFrames] Received hashtagDelta:`, hashtagDelta);
  //console.log(`[generateFrames] Received podcastDelta:`, podcastDelta);
  //console.log(`[generateFrames] Text Coords: H(${hashtagX},${hashtagY}), P(${podcastX},${podcastY})`);
  
  // Crear canvas con el tamaño de la imagen de template
  const img = new Image();
  
  return new Promise((resolve, reject) => {
    img.onload = async () => {
      try {
        const canvasWidth = img.width % 2 === 0 ? img.width : img.width + 1;
        const canvasHeight = img.height % 2 === 0 ? img.height : img.height + 1;
        
        //console.log(`[generateFrames] Original image: ${img.width}x${img.height}`);
        //console.log(`[generateFrames] Canvas adjusted: ${canvasWidth}x${canvasHeight}`);
        
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        
        const nominalTop = y - height / 2;
        const nominalBottom = y + height / 2;
        //console.log(`[generateFrames] Expected nominal wave vertical range: ${nominalTop} to ${nominalBottom} (Canvas height: ${canvasHeight})`);
        
        //console.log(`Generando ${frames.length} frames...`);
        
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(img, 0, 0, img.width, img.height);
          
          // Renderizar Hashtag usando Delta
          console.log(`[generateFrames Frame ${i}] Rendering Hashtag Delta at (${hashtagX}, ${hashtagY})`);
          renderDeltaText(ctx, hashtagDelta, hashtagX, hashtagY);
          
          // Renderizar Título del Podcast usando Delta
          console.log(`[generateFrames Frame ${i}] Rendering Podcast Delta at (${podcastX}, ${podcastY})`);
          renderDeltaText(ctx, podcastDelta, podcastX, podcastY);

          // Dibujar visualización de audio
          const { color: waveColor, x: waveX, y: waveY_center, width: waveWidth, height: waveHeight } = waveOptions;
          drawWaveform(ctx, frame.amplitudes, waveColor, waveX, waveY_center, waveWidth, waveHeight);
          
          // Guardar frame como imagen
          const framePath = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`);
          const out = fs.createWriteStream(framePath);
          const stream = canvas.createPNGStream();
          stream.pipe(out);
          
          await new Promise((res) => out.on('finish', res)); // Corregido para evitar conflicto de nombres
          
          if (i % 50 === 0) {
            const frameProgress = Math.round((i / frames.length) * 40);
            if (jobId) server.updateJobProgress(jobId, 'frames', 35 + frameProgress);
            console.log(`Progreso: ${Math.round((i / frames.length) * 100)}%`);
          }
        }
        
        console.log('Frames generados correctamente');
        resolve();
      } catch (error) {
        console.error(`[generateFrames] Error during frame generation:`, error);
        reject(error);
      }
    };
    
    img.onerror = (err) => {
        console.error(`[generateFrames] Error loading template image:`, err);
        reject(err);
    };
    img.src = templateImage;
  });
}

// Dibujar forma de onda en el canvas
function drawWaveform(ctx, amplitudes, color, x, y, width, height) {
  // Log en drawWaveform
  //console.log(`[drawWaveform] Drawing wave centered at y=${y}, nominal height=${height}`);
  
  const barWidth = width / amplitudes.length;
  
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  // La coordenada 'y' ahora representa el centro vertical.
  const centerY = y; 
  
  // Dibujar línea centrada en la nueva 'centerY'
  ctx.beginPath();
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + width, centerY);
  ctx.stroke();
  
  // Dibujar cada barra de amplitud centrada en 'centerY'
  for (let i = 0; i < amplitudes.length; i++) {
    const amplitude = amplitudes[i];
    // La altura de la barra se calcula igual, pero se posiciona relativa a centerY
    const barHeight = amplitude * height; 
    
    // Dibujar línea vertical para esta muestra, centrada en centerY
    ctx.beginPath();
    // Punto superior de la barra: centerY - barHeight / 2
    ctx.moveTo(x + i * barWidth, centerY - barHeight / 2); 
    // Punto inferior de la barra: centerY + barHeight / 2
    ctx.lineTo(x + i * barWidth, centerY + barHeight / 2); 
    ctx.stroke();
  }
}

// Crear video a partir de los frames usando FFmpeg
function createVideoFromFrames(framesDir, audioFile, outputFile, jobId) {
  return new Promise((resolve, reject) => {
    console.log(`Iniciando FFmpeg con: 
      - Frames: ${framesDir}
      - Audio: ${audioFile}
      - Salida: ${outputFile}`);
    
    // Verificar que los archivos existan
    if (!fs.existsSync(framesDir)) {
      return reject(new Error(`El directorio de frames no existe: ${framesDir}`));
    }
    
    if (!fs.existsSync(audioFile)) {
      return reject(new Error(`El archivo de audio no existe: ${audioFile}`));
    }
    
    // Crear directorio de salida si no existe
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Obtener la lista de frames para verificar
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.startsWith('frame_') && f.endsWith('.png'));
    console.log(`Encontrados ${frameFiles.length} frames.`);
    
    if (frameFiles.length === 0) {
      return reject(new Error('No se encontraron frames para procesar'));
    }
    
    // Comando FFmpeg con filtro para asegurar dimensiones pares
    ffmpeg()
      .input(path.join(framesDir, 'frame_%06d.png'))
      .inputFPS(24)
      .input(audioFile)
      .outputOptions([
        // Asegurar dimensiones compatibles con h264 (divisibles por 2)
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',         // Usar codec H.264
        '-pix_fmt', 'yuv420p',     // Formato de pixel estándar
        '-preset', 'ultrafast',    // Priorizar velocidad sobre compresión
        '-crf', '23',              // Calidad razonable
        '-c:a', 'aac',             // Codec de audio AAC
        '-b:a', '192k',            // Bitrate de audio
        '-shortest'                // Usar la duración del input más corto
      ])
      .output(outputFile)
      .on('start', (commandLine) => {
        console.log('FFmpeg iniciado con comando:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          const videoProgress = Math.min(75 + (progress.percent * 0.2), 95); // 75% a 95%
          if (jobId) server.updateJobProgress(jobId, 'video', Math.round(videoProgress));
          console.log(`Progreso FFmpeg: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('stderr', (stderrLine) => {
        console.log('FFmpeg stderr:', stderrLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error en FFmpeg:', err);
        if (stdout) console.log('FFmpeg stdout:', stdout);
        if (stderr) console.log('FFmpeg stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('Video generado correctamente');
        if (jobId) {
          server.updateJobProgress(jobId, 'video', 100);
          // Marcar el trabajo como completado
          server.markJobAsCompleted(jobId);
        }
        resolve(outputFile);
      })
      .run();
  });
}

// Función de prueba realmente básica
async function testFFmpeg() {
  return new Promise((resolve, reject) => {
    console.log('Ejecutando prueba básica de FFmpeg...');
    
    const outputDir = path.join('outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Crear una imagen simple para la prueba
    const testImage = path.join('outputs', 'test-image.png');
    const canvas = createCanvas(640, 480);
    const ctx = canvas.getContext('2d');
    
    // Dibujar un fondo azul
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 640, 480);
    
    // Dibujar texto
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Prueba de FFmpeg', 320, 240);
    
    // Guardar la imagen
    const out = fs.createWriteStream(testImage);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    
    out.on('finish', () => {
      console.log('Imagen de prueba creada, generando video...');
      
      const outputFile = path.join('outputs', 'test.mp4');
      
      // Usar try-catch adicional para capturar errores
      try {
        // Generar un video estático de 5 segundos con la imagen
        ffmpeg()
          .input(testImage)
          .inputOptions(['-loop', '1']) // Repetir la imagen
          .outputOptions([
            '-y',                // Sobrescribir archivo si existe
            '-t', '5',           // Duración en segundos
            '-c:v', 'libx264',   // Codec de video
            '-pix_fmt', 'yuv420p', // Formato de pixel
            '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2'
          ])
          .output(outputFile)
          .on('start', (commandLine) => {
            console.log('FFmpeg iniciado con comando:', commandLine);
          })
          .on('stderr', (stderrLine) => {
            console.log('FFmpeg stderr:', stderrLine);
          })
          .on('error', (err, stdout, stderr) => {
            console.error('Error en FFmpeg:', err.message);
            if (stdout) console.error('FFmpeg stdout:', stdout);
            if (stderr) console.error('FFmpeg stderr:', stderr);
            reject(new Error(`Error FFmpeg: ${err.message}`));
          })
          .on('end', () => {
            console.log('Prueba de FFmpeg completada con éxito');
            try {
              // Limpiar archivo temporal
              if (fs.existsSync(testImage)) {
                fs.unlinkSync(testImage);
              }
              
              // Verificar que el archivo de salida existe
              if (fs.existsSync(outputFile)) {
                console.log(`Archivo generado correctamente: ${outputFile}`);
                resolve(true);
              } else {
                reject(new Error('El archivo de salida no fue creado'));
              }
            } catch (cleanupErr) {
              console.error('Error en la limpieza:', cleanupErr);
              // Pero seguimos considerando exitosa la prueba
              resolve(true);
            }
          })
          .run();
      } catch (ffmpegSetupErr) {
        console.error('Error configurando FFmpeg:', ffmpegSetupErr);
        reject(ffmpegSetupErr);
      }
    });
    
    out.on('error', (err) => {
      console.error('Error generando imagen de prueba:', err);
      reject(err);
    });
  });
}

module.exports = { generateVideoWithAudioWave, testFFmpeg };