// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateVideoWithAudioWave, testFFmpeg } = require('./audio-visualizer');

// Almacén de progreso para los trabajos
const jobProgress = {};
const completedJobs = {}; // Para rastrear trabajos realmente completados

// Configurar almacenamiento temporal para archivos subidos
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50MB
});

// Asegurar que existan los directorios necesarios
const dirs = ['uploads', 'outputs'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Inicializar Express
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Ruta para procesar archivos y generar video
app.post('/process', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  try {
    // Verificar que se subieron ambos archivos
    if (!req.files.audio || !req.files.template) {
      return res.status(400).json({ error: 'Se requieren ambos archivos: audio y template' });
    }

    const audioFile = req.files.audio[0];
    const templateFile = req.files.template[0];
    
    // Generar ID único para el trabajo
    const jobId = Date.now().toString();
    const outputFilename = `${jobId}.mp4`;
    const outputPath = path.join('outputs', outputFilename);
    
    // Configurar opciones de visualización
    const waveOptions = {
      color: req.body.color || '#FF0046',
      x: parseInt(req.body.x) || 340,
      y: parseInt(req.body.y) || 200,
      width: parseInt(req.body.width) || 400,
      height: parseInt(req.body.height) || 50
    };
    
    // Inicializar progreso
    updateJobProgress(jobId, 'initializing', 5);
    
    // Configuración para el generador
    const config = {
      audioFile: audioFile.path,
      templateImage: templateFile.path,
      outputFile: outputPath,
      waveOptions: waveOptions,
      textOptions: {
        hashtagDelta: req.body.hashtagDelta || '{"ops":[{"insert":"#SPAINMWC\n"}]}', 
        podcastDelta: req.body.podcastDelta || '{"ops":[{"insert":"La revolución del pensamiento\n"}]}',
        hashtagX: parseInt(req.body.hashtagX) || 108,
        hashtagY: parseInt(req.body.hashtagY) || 128,
        podcastX: parseInt(req.body.podcastX) || 30,
        podcastY: parseInt(req.body.podcastY) || 195
      },
      jobId: jobId
    };
    
    // Primero enviar la respuesta
    res.status(202).json({ 
      message: 'Procesamiento iniciado', 
      jobId: jobId
    });
    
    // Luego iniciar el procesamiento (sin intentar responder de nuevo)
    try {
      await generateVideoWithAudioWave(config);
    } catch (processingError) {
      console.error('Error en el procesamiento:', processingError);
      // No intentamos enviar otra respuesta aquí
    }
    
  } catch (error) {
    console.error('Error al iniciar el procesamiento:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error en el procesamiento del video' });
    }
  }
});

// Ruta para verificar el estado de un trabajo
app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const outputPath = path.join('outputs', `${jobId}.mp4`);
  
  // Verificar si el trabajo está realmente completado (no solo que exista el archivo)
  if (completedJobs[jobId] && fs.existsSync(outputPath)) {
    res.json({ 
      status: 'completed',
      url: `/download/${jobId}` 
    });
  } else if (jobProgress[jobId]) {
    // Si tenemos progreso pero no está completado, seguir mostrando como procesando
    res.json({ 
      status: 'processing',
      ...jobProgress[jobId]
    });
  } else {
    // Trabajo en proceso sin información detallada
    res.json({ 
      status: 'processing',
      currentStep: 'initializing',
      progress: 5
    });
  }
});

// Ruta para descargar el video generado
app.get('/download/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const outputPath = path.join('outputs', `${jobId}.mp4`);
  
  if (fs.existsSync(outputPath)) {
    res.download(outputPath);
  } else {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
});

// Ruta para probar FFmpeg
app.get('/test-ffmpeg', async (req, res) => {
  try {
    await testFFmpeg();
    res.json({ success: true, message: 'Prueba de FFmpeg completada con éxito' });
  } catch (error) {
    console.error('Error en prueba de FFmpeg:', error);
    res.status(500).json({ error: 'Error en prueba de FFmpeg' });
  }
});

// Ruta de prueba alternativa usando child_process directamente
app.get('/test-ffmpeg-direct', (req, res) => {
  const { execFile } = require('child_process');
  console.log('Ejecutando prueba directa de FFmpeg...');
  
  execFile('C:/ffmpeg/bin/ffmpeg.exe', ['-version'], (error, stdout, stderr) => {
    if (error) {
      console.error('Error ejecutando FFmpeg directamente:', error);
      return res.status(500).json({ error: `Error ejecutando FFmpeg: ${error.message}` });
    }
    
    console.log('Salida FFmpeg:', stdout);
    if (stderr) console.log('FFmpeg stderr:', stderr);
    
    return res.json({ 
      success: true, 
      message: 'FFmpeg ejecutado correctamente', 
      version: stdout.split('\n')[0]
    });
  });
});

// Ruta de prueba ultra simple
app.get('/test-simple', (req, res) => {
  console.log('Ejecutando prueba ultra simple...');
  
  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputFile = path.join(outputDir, 'test_basic.mp4');
  console.log(`Creando video en: ${outputFile}`);
  
  const { spawn } = require('child_process');
  const ffmpegProcess = spawn('C:/ffmpeg/bin/ffmpeg.exe', [
    '-f', 'lavfi',
    '-i', 'color=c=blue:s=320x240:d=5',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-y',
    outputFile
  ]);
  
  ffmpegProcess.stderr.on('data', (data) => {
    console.log(`FFmpeg: ${data}`);
  });
  
  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg terminó con código: ${code}`);
    
    if (code === 0) {
      res.json({ 
        success: true, 
        message: 'Video creado correctamente', 
        path: outputFile
      });
    } else {
      res.status(500).json({ 
        error: `FFmpeg salió con código ${code}` 
      });
    }
  });
  
  ffmpegProcess.on('error', (err) => {
    console.error('Error lanzando FFmpeg:', err);
    res.status(500).json({ error: err.message });
  });
});

// Función para actualizar el progreso de un trabajo
function updateJobProgress(jobId, currentStep, progress) {
  jobProgress[jobId] = { currentStep, progress };
  console.log(`Progreso del trabajo ${jobId}: ${currentStep} - ${progress}%`);
}

// Función para marcar un trabajo como completado
function markJobAsCompleted(jobId) {
  completedJobs[jobId] = true;
  console.log(`Trabajo ${jobId} completado correctamente`);
}

// Exportar la función para que audio-visualizer.js pueda usarla
module.exports.updateJobProgress = updateJobProgress;
module.exports.markJobAsCompleted = markJobAsCompleted;

// En server.js, agregar una limpieza periódica del almacén de progreso
// para evitar fugas de memoria con trabajos incompletos
setInterval(() => {
  const now = Date.now();
  Object.keys(jobProgress).forEach(jobId => {
    if (now - parseInt(jobId) > 3600000) {
      delete jobProgress[jobId];
      delete completedJobs[jobId];
    }
  });
}, 3600000);

// Puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});