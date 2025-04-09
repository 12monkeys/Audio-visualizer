// audio-visualizer.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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

// Configurar el path a FFmpeg - solo para entorno Windows local
try {
  // Detectar si estamos en Windows
  if (process.platform === 'win32') {
    console.log('Detectado entorno Windows, usando rutas explícitas para FFmpeg');
    if (fs.existsSync('C:/ffmpeg/bin/ffmpeg.exe')) {
      ffmpeg.setFfmpegPath('C:/ffmpeg/bin/ffmpeg.exe');
      ffmpeg.setFfprobePath('C:/ffmpeg/bin/ffprobe.exe');
    }
  } else {
    console.log('Detectado entorno no-Windows, usando FFmpeg del PATH');
    // En Docker/Linux, ffmpeg estará disponible en el PATH
  }
} catch (error) {
  console.log('Error configurando FFmpeg:', error);
  console.log('Se usará FFmpeg del PATH del sistema');
}

// Nueva función para renderizar texto con sharp en lugar de canvas
async function renderText(imageBuffer, text, x, y, options = {}) {
  const { 
    fontSize = 20, 
    color = '#000000', 
    fontWeight = 'normal',
    fontStyle = 'normal'
  } = options;
  
  // Obtener metadata de la imagen para obtener ancho y alto
  const metadata = await sharp(imageBuffer).metadata();
  
  // Crear un SVG con el texto
  const svgText = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <text 
        x="${x}" 
        y="${y}" 
        font-family="Arial, sans-serif"
        font-size="${fontSize}px"
        font-weight="${fontWeight}"
        font-style="${fontStyle}"
        fill="${color}"
      >${text}</text>
    </svg>
  `;
  
  // Aplicar el SVG como overlay a la imagen usando sharp
  return await sharp(imageBuffer)
    .composite([{
      input: Buffer.from(svgText),
      top: 0,
      left: 0
    }])
    .toBuffer();
}

// Simplificar la función para delta text
async function renderDeltaText(imageBuffer, deltaString, startX, startY) {
  try {
    const delta = JSON.parse(deltaString || '{}');
    if (!delta.ops) return imageBuffer; // Retornar imagen sin cambios si no hay operaciones
    
    // Concatenar todo el texto en un texto plano
    let plainText = '';
    let color = '#000000';
    let fontWeight = 'normal';
    let fontStyle = 'normal';
    let fontSize = 20;
    
    for (const op of delta.ops) {
      if (op.insert && typeof op.insert === 'string') {
        plainText += op.insert;
        
        // Usar el último atributo encontrado (simplificación)
        if (op.attributes) {
          color = op.attributes.color || color;
          fontWeight = op.attributes.bold ? 'bold' : 'normal';
          fontStyle = op.attributes.italic ? 'italic' : 'normal';
          if (op.attributes.size) {
            // Intentar extraer el número de tamaño
            const sizeMatch = String(op.attributes.size).match(/^(\d+(\.\d+)?)/);
            if (sizeMatch) {
              fontSize = parseFloat(sizeMatch[1]);
            }
          }
        }
      }
    }
    
    // Renderizar el texto plano con los últimos atributos encontrados
    return await renderText(imageBuffer, plainText, startX, startY, {
      fontSize,
      color,
      fontWeight,
      fontStyle
    });
    
  } catch (error) {
    console.error('Error rendering Delta text:', deltaString, error);
    return imageBuffer; // Retornar imagen sin cambios en caso de error
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
  // Recibir Deltas y coordenadas X/Y
  const { hashtagDelta, podcastDelta, hashtagX, hashtagY, podcastX, podcastY } = textOptions;
  
  try {
    // Cargar la imagen de plantilla
    let templateBuffer = await sharp(templateImage).toBuffer();
    const metadata = await sharp(templateBuffer).metadata();
    
    // Asegurar dimensiones pares para h264
    const outputWidth = metadata.width % 2 === 0 ? metadata.width : metadata.width + 1;
    const outputHeight = metadata.height % 2 === 0 ? metadata.height : metadata.height + 1;
    
    // Redimensionar si es necesario
    if (metadata.width !== outputWidth || metadata.height !== outputHeight) {
      templateBuffer = await sharp(templateBuffer)
        .resize(outputWidth, outputHeight)
        .toBuffer();
    }
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      // Comenzar con la imagen de plantilla
      let currentBuffer = templateBuffer;
      
      // Renderizar textos
      if (hashtagDelta) {
        currentBuffer = await renderDeltaText(
          currentBuffer, 
          hashtagDelta, 
          hashtagX, 
          hashtagY
        );
      }
      
      if (podcastDelta) {
        currentBuffer = await renderDeltaText(
          currentBuffer, 
          podcastDelta, 
          podcastX, 
          podcastY
        );
      }
      
      // Crear una capa SVG para la forma de onda
      const waveformSVG = generateWaveformSVG(
        frame.amplitudes, 
        color, 
        x, 
        y, 
        width, 
        height, 
        outputWidth, 
        outputHeight
      );
      
      // Aplicar la forma de onda a la imagen
      currentBuffer = await sharp(currentBuffer)
        .composite([{
          input: Buffer.from(waveformSVG),
          top: 0,
          left: 0
        }])
        .toBuffer();
      
      // Guardar el frame
      const framePath = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`);
      await sharp(currentBuffer).toFile(framePath);
      
      if (i % 50 === 0) {
        const frameProgress = Math.round((i / frames.length) * 40);
        if (jobId) server.updateJobProgress(jobId, 'frames', 35 + frameProgress);
        console.log(`Progreso: ${Math.round((i / frames.length) * 100)}%`);
      }
    }
    
    console.log('Frames generados correctamente');
    return true;
  } catch (error) {
    console.error('Error generando frames:', error);
    throw error;
  }
}

// Generar SVG para la forma de onda
function generateWaveformSVG(amplitudes, color, x, y, width, height, canvasWidth, canvasHeight) {
  const barWidth = width / amplitudes.length;
  const centerY = y;
  
  // Crear SVG para la forma de onda
  let svgContent = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Línea central
  svgContent += `<line x1="${x}" y1="${centerY}" x2="${x + width}" y2="${centerY}" stroke="${color}" stroke-width="2" />`;
  
  // Dibujar barras de amplitud
  for (let i = 0; i < amplitudes.length; i++) {
    const amplitude = amplitudes[i];
    const barHeight = amplitude * height;
    
    svgContent += `<line 
      x1="${x + i * barWidth}" 
      y1="${centerY - barHeight / 2}" 
      x2="${x + i * barWidth}" 
      y2="${centerY + barHeight / 2}" 
      stroke="${color}" 
      stroke-width="2" 
    />`;
  }
  
  svgContent += `</svg>`;
  return svgContent;
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

// Exportar funciones que se utilizarán desde server.js
module.exports = {
  generateVideoWithAudioWave,
  createVideoFromFrames
};