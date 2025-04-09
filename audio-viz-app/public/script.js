document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('upload-form');
    const statusSection = document.querySelector('.status-section');
    const resultSection = document.querySelector('.result-section');
    const progressBar = document.getElementById('progress-bar');
    const statusMessage = document.getElementById('status-message');
    const resultVideo = document.getElementById('result-video');
    const downloadLink = document.getElementById('download-link');
    const newVideoButton = document.getElementById('new-video-button');
    const hashtagContentInput = document.getElementById('hashtag-content');
    const podcastContentInput = document.getElementById('podcast-content');
    
    // Inicializar editores Quill
    const hashtagEditor = new Quill('#hashtag-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'color': [] }],
                [{ 'size': ['small', false, 'large', 'huge'] }]
            ]
        },
        formats: ['bold', 'italic', 'underline', 'color', 'size'], // Especificar formatos explícitamente
        placeholder: 'Escribe tu hashtag aquí...'
    });
    
    const podcastEditor = new Quill('#podcast-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'color': [] }],
                [{ 'size': ['small', false, 'large', 'huge'] }]
            ]
        },
        formats: ['bold', 'italic', 'underline', 'color', 'size'], // Especificar formatos explícitamente
        placeholder: 'Escribe el título del podcast aquí...'
    });
    
    // Agregar contenido por defecto
    hashtagEditor.root.innerHTML = '<span style="color: #FF0046; font-size: 24px; font-weight: bold;">Indica el hashtag aquí</span>';
    podcastEditor.root.innerHTML = '<span style="color: #000000; font-size: 20px;">Indica el título del podcast aquí</span>';
    
    // Manejar envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Recoger archivos del formulario
        const audioFile = document.getElementById('audio-file').files[0];
        const templateFile = document.getElementById('template-file').files[0];
        
        if (!audioFile || !templateFile) {
            alert('Por favor, selecciona ambos archivos (audio y template)');
            return;
        }
        
        // Recoger opciones
        const waveColor = document.getElementById('wave-color').value;
        const waveX = parseInt(document.getElementById('wave-x').value) + 200; // Offset X: +200px
        const waveY = parseInt(document.getElementById('wave-y').value) + 166; // Offset Y: +350px (150 + 200 adicionales)
        const waveWidth = parseInt(document.getElementById('wave-width').value) + 140; // Offset width: +140px
        const waveHeight = document.getElementById('wave-height').value;
        
        // Obtener posiciones de texto
        const hashtagX = parseInt(document.getElementById('hashtag-x').value) + 60; // Offset X: +60px
        const hashtagY = parseInt(document.getElementById('hashtag-y').value) + 100; // Offset Y: +100px
        const podcastX = parseInt(document.getElementById('podcast-x').value) + 24; // Offset X: -30px
        const podcastY = parseInt(document.getElementById('podcast-y').value) + 85; // Offset Y: +10px
        
        // Crear FormData para enviar archivos
        const formData = new FormData();
        formData.append('audio', audioFile);
        formData.append('template', templateFile);
        formData.append('color', waveColor);
        formData.append('x', waveX);
        formData.append('y', waveY);
        formData.append('width', waveWidth);
        formData.append('height', waveHeight);
        
        // Obtener Deltas de los editores Quill
        const hashtagDelta = hashtagEditor.getContents();
        const podcastDelta = podcastEditor.getContents();

        // Convertir Deltas a JSON y añadirlos a FormData
        formData.append('hashtagDelta', JSON.stringify(hashtagDelta));
        formData.append('podcastDelta', JSON.stringify(podcastDelta));
        
        // Ya no se envían hashtagHtml ni podcastHtml
        // formData.append('hashtagHtml', hashtagContentInput.value);
        formData.append('hashtagX', hashtagX);
        formData.append('hashtagY', hashtagY);
        // formData.append('podcastHtml', podcastContentInput.value);
        formData.append('podcastX', podcastX);
        formData.append('podcastY', podcastY);
        
        try {
            // Mostrar sección de estado
            form.style.display = 'none';
            statusSection.style.display = 'block';
            progressBar.style.width = '10%';
            
            // Actualizar estado de progreso en la UI
            updateProgressUI('audio', 'En progreso');
            
            // Enviar solicitud al backend
            const response = await fetch('/process', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Error al enviar los archivos');
            }
            
            const data = await response.json();
            const jobId = data.jobId;
            
            // Consultar estado periódicamente
            checkStatus(jobId);
            
        } catch (error) {
            console.error('Error:', error);
            statusMessage.textContent = 'Error: ' + error.message;
            setTimeout(() => {
                statusSection.style.display = 'none';
                form.style.display = 'block';
            }, 3000);
        }
    });
    
    // Función para actualizar la UI con el progreso
    function updateProgressUI(step, status, progress = 0) {
        // Actualizar estado de los pasos
        document.querySelectorAll('.progress-step').forEach(stepEl => {
            const stepStatus = stepEl.querySelector('.step-status');
            
            if (stepEl.id === `step-${step}`) {
                stepStatus.textContent = status;
                stepEl.classList.add('active');
            }
        });
        
        // Actualizar barra de progreso
        progressBar.style.width = `${progress}%`;
        
        // Actualizar mensaje
        statusMessage.textContent = `Procesando... ${progress}%`;
    }
    
    // Función para verificar el estado del procesamiento
    async function checkStatus(jobId) {
        try {
            const response = await fetch(`/status/${jobId}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.status === 'completed') {
                // Procesamiento completado
                updateProgressUI('video', 'Completado', 100);
                statusMessage.textContent = '¡Procesamiento completado!';
                
                // Mostrar resultado tras una breve pausa para que el usuario vea el 100%
                setTimeout(() => {
                    statusSection.style.display = 'none';
                    resultSection.style.display = 'block';
                    
                    // Configurar video y enlace de descarga
                    resultVideo.src = data.url;
                    downloadLink.href = data.url;
                    downloadLink.download = 'podcast_video.mp4';
                }, 1000);
                
            } else if (data.status === 'processing') {
                // Simular progreso basado en el tiempo transcurrido
                const now = new Date().getTime();
                if (!window.processingStartTime) {
                    window.processingStartTime = now;
                }
                
                // Asumimos que todo el proceso toma aproximadamente 2 minutos (120000ms)
                const elapsedTime = now - window.processingStartTime;
                const estimatedProgress = Math.min(Math.round((elapsedTime / 120000) * 100), 95);
                
                // Determinar en qué etapa estamos basados en el progreso simulado
                let currentStep = 'audio';
                if (estimatedProgress > 30) currentStep = 'frames';
                if (estimatedProgress > 70) currentStep = 'video';
                
                updateProgressUI(currentStep, 'En progreso', estimatedProgress);
                
                // Verificar nuevamente después de 2 segundos
                setTimeout(() => checkStatus(jobId), 2000);
                
            } else if (data.status === 'error') {
                throw new Error(data.message || 'Error en el procesamiento');
            } else {
                // Estado desconocido
                throw new Error('Estado desconocido');
            }
            
        } catch (error) {
            console.error('Error al verificar estado:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            
            // Reintentar después de 5 segundos
            setTimeout(() => checkStatus(jobId), 5000);
        }
    }
    
    // Volver al formulario para crear un nuevo video
    newVideoButton.addEventListener('click', function() {
        resultSection.style.display = 'none';
        form.style.display = 'block';
        
        // Restaurar los valores por defecto en los editores
        hashtagEditor.root.innerHTML = '<span style="color: #FF0046; font-size: 24px; font-weight: bold;">Indica el hashtag aquí</span>';
        podcastEditor.root.innerHTML = '<span style="color: #000000; font-size: 20px;">Indica el título del podcast aquí</span>';
        
        // Actualizar campos ocultos
        hashtagContentInput.value = hashtagEditor.root.innerHTML;
        podcastContentInput.value = podcastEditor.root.innerHTML;
        
        // Limpiar los demás campos del formulario
        document.getElementById('audio-file').value = '';
        document.getElementById('template-file').value = '';
        
        // Limpiar el video
        resultVideo.src = '';
        
        // Resetear progreso
        document.querySelectorAll('.progress-step .step-status').forEach(el => {
            el.textContent = 'Pendiente';
        });
        document.querySelectorAll('.progress-step').forEach(el => {
            el.classList.remove('active');
        });
        progressBar.style.width = '0%';
    });

    // Variables para el sistema de previsualización
    const previewSection = document.querySelector('.preview-section');
    const previewCanvas = document.getElementById('preview-canvas');
    const ctx = previewCanvas.getContext('2d');
    const hashtagPreview = document.getElementById('hashtag-preview');
    const podcastPreview = document.getElementById('podcast-preview');
    const wavePreview = document.getElementById('wave-preview');

    // Configurar áreas de drop
    setupDropArea('audio-drop-area', 'audio-file', 'audio-filename', 'change-audio');
    setupDropArea('template-drop-area', 'template-file', 'template-filename', 'change-template', true);

    function setupDropArea(dropAreaId, inputId, filenameId, changeButtonId, showPreview = false) {
        const dropArea = document.getElementById(dropAreaId);
        const fileInput = document.getElementById(inputId);
        const filenameElement = document.getElementById(filenameId);
        const changeButton = document.getElementById(changeButtonId);
        const previewElement = showPreview ? document.getElementById('template-preview') : null;
        
        // Prevenir comportamiento por defecto para evitar que el navegador abra el archivo
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Resaltar área al arrastrar
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            dropArea.classList.add('highlight');
        }
        
        function unhighlight() {
            dropArea.classList.remove('highlight');
        }
        
        // Manejar archivos soltados
        dropArea.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                fileInput.files = files;
                handleFiles(files[0]);
                // Disparar evento change para que otros listeners se activen
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        }
        
        // Manejar clic en el área de drop
        dropArea.addEventListener('click', function() {
            fileInput.click();
        });
        
        // Cambiar archivo
        changeButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Evitar que se propague al área de drop
            fileInput.click();
        });
        
        // Manejar selección de archivo
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                handleFiles(this.files[0]);
            }
        });
        
        function handleFiles(file) {
            // Mostrar nombre de archivo
            filenameElement.textContent = file.name;
            filenameElement.style.display = 'block';
            
            // Mostrar botón de cambiar
            changeButton.style.display = 'inline-block';
            
            // Ocultar texto de instrucción
            dropArea.querySelector('.icon').style.display = 'none';
            dropArea.querySelector('p:not(#' + filenameId + ')').style.display = 'none';
            dropArea.querySelector('.drop-file-hint').style.display = 'none';
            
            // Si es imagen, mostrar previsualización
            if (showPreview && file.type.match('image.*')) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    previewElement.src = e.target.result;
                    previewElement.style.display = 'block';
                }
                
                reader.readAsDataURL(file);
            }
        }
    }

    // Modifica la función que maneja el cambio del archivo de template
    document.getElementById('template-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Leer la imagen como URL de datos para mostrarla inmediatamente
            const reader = new FileReader();
            reader.onload = function(e) {
                // Actualizar la previsualización pequeña en el área de drop
                document.getElementById('template-preview').src = e.target.result;
                document.getElementById('template-preview').style.display = 'block';
                
                // Crear imagen para obtener dimensiones y cargarla en el canvas
                const img = new Image();
                img.onload = function() {
                    // Configurar el canvas con las dimensiones de la imagen
                    previewCanvas.width = img.width;
                    previewCanvas.height = img.height;
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    
                    // Mostrar la sección de previsualización y hacerla visible
                    previewSection.style.display = 'block';
                    previewSection.scrollIntoView({ behavior: 'smooth' });
                    
                    // Actualizar visualmente los elementos arrastrables
                    updateElementPositions();
                    updatePreviewContent();
                    
                    // Añadir indicación visual sobre qué se puede arrastrar
                    highlightDraggableElements();
                    
                    // Mostrar mensaje instructivo
                    setTimeout(addInstructions, 500);
                    
                    // Añadir estas llamadas al final de la función
                    setupPositionFieldsToggle();
                    updateSizeIndicators();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Función para destacar los elementos arrastrables
    function highlightDraggableElements() {
        // Hacer que los elementos sean más visibles con animación
        [hashtagPreview, podcastPreview, wavePreview].forEach(element => {
            // Aplicar estilos para hacerlos más visibles
            element.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            element.style.border = '2px dashed #FF0046';
            element.style.boxShadow = '0 0 10px rgba(255, 0, 70, 0.5)';
            
            // Añadir animación para llamar la atención
            element.style.animation = 'pulse 2s';
            
            // Añadir la clase para el efecto pulsante
            element.classList.add('highlight-draggable');
        });
        
        // Añadir estilo para la animación pulsante
        if (!document.getElementById('draggable-highlight-style')) {
            const style = document.createElement('style');
            style.id = 'draggable-highlight-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .highlight-draggable {
                    transition: all 0.3s ease;
                }
                .draggable-element {
                    padding: 8px;
                    min-width: 80px;
                    min-height: 30px;
                }
                .element-label {
                    position: absolute;
                    top: -25px;
                    left: 0;
                    font-size: 12px;
                    background-color: #FF0046;
                    color: white;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-weight: bold;
                    white-space: nowrap;
                }
                .preview-container {
                    min-height: 300px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .preview-container:empty::before {
                    content: 'Cargando vista previa...';
                    color: #777;
                    font-style: italic;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Modifica updateElementPositions para asegurar que siempre sean visibles
    function updateElementPositions() {
        const elements = {
            hashtag: {
                element: document.getElementById('hashtag-preview'),
                xInput: document.getElementById('hashtag-x'),
                yInput: document.getElementById('hashtag-y')
            },
            podcast: {
                element: document.getElementById('podcast-preview'),
                xInput: document.getElementById('podcast-x'),
                yInput: document.getElementById('podcast-y')
            },
            wave: {
                element: document.getElementById('wave-preview'),
                xInput: document.getElementById('wave-x'),
                yInput: document.getElementById('wave-y'),
                widthInput: document.getElementById('wave-width'),
                heightInput: document.getElementById('wave-height')
            }
        };

        Object.values(elements).forEach(item => {
            // Leer coordenadas REALES directamente de los inputs
            const realX = parseInt(item.xInput.value);
            const realY = parseInt(item.yInput.value);
            // Convertir a coordenadas de PREVIEW para mostrar en el canvas escalado
            const previewCoords = convertRealToPreviewCoordinates(realX, realY);
            
            // Asegurar que los elementos no se salgan del canvas de preview
            const previewCanvas = document.getElementById('preview-canvas');
            const maxX = previewCanvas.width - item.element.offsetWidth;
            const maxY = previewCanvas.height - item.element.offsetHeight;
            
            const boundedX = Math.max(0, Math.min(previewCoords.x, maxX));
            const boundedY = Math.max(0, Math.min(previewCoords.y, maxY));
            
            item.element.style.left = `${boundedX}px`;
            item.element.style.top = `${boundedY}px`;

            // Ajustar el tamaño de la onda en la PREVIEW (sin offsets)
            if (item.widthInput) {
                const realWidth = parseInt(item.widthInput.value);
                const realHeight = parseInt(item.heightInput.value);
                
                // Escalar dimensiones para la preview
                const previewWidth = realWidth * imageScale;
                const previewHeight = realHeight * imageScale;
                
                item.element.style.width = `${previewWidth}px`;
                item.element.style.height = `${previewHeight}px`;

                // Recalcular límites con el nuevo tamaño
                const updatedMaxX = previewCanvas.width - previewWidth;
                const updatedMaxY = previewCanvas.height - previewHeight;
                const updatedBoundedX = Math.max(0, Math.min(previewCoords.x, updatedMaxX));
                const updatedBoundedY = Math.max(0, Math.min(previewCoords.y, updatedMaxY));

                item.element.style.left = `${updatedBoundedX}px`;
                item.element.style.top = `${updatedBoundedY}px`;
            }
        });
    }

    function createElementLabels() {
        if (!hashtagPreview.querySelector('.element-label')) {
            const hashtagLabel = document.createElement('div');
            hashtagLabel.className = 'element-label';
            hashtagLabel.textContent = 'Hashtag';
            hashtagPreview.insertBefore(hashtagLabel, hashtagPreview.firstChild);
            
            const podcastLabel = document.createElement('div');
            podcastLabel.className = 'element-label';
            podcastLabel.textContent = 'Título';
            podcastPreview.insertBefore(podcastLabel, podcastPreview.firstChild);
            
            const waveLabel = document.createElement('div');
            waveLabel.className = 'element-label';
            waveLabel.textContent = 'Onda';
            wavePreview.insertBefore(waveLabel, wavePreview.firstChild);
        }
    }

    // Posicionar un elemento
    function positionElement(element, x, y) {
        element.style.left = x + 'px';
        element.style.top = y + 'px';
    }

    // Actualizar contenido de previsualización
    function updatePreviewContent() {
        // Actualizar contenido del hashtag directamente desde el editor
        hashtagPreview.querySelector('.preview-content').innerHTML = hashtagEditor.root.innerHTML;
        
        // Actualizar contenido del título del podcast directamente desde el editor
        podcastPreview.querySelector('.preview-content').innerHTML = podcastEditor.root.innerHTML;
    }

    // Observar cambios en los editores Quill para actualizar la previsualización
    // (La lógica original sigue funcionando aquí)
    hashtagEditor.on('text-change', updatePreviewContent);
    podcastEditor.on('text-change', updatePreviewContent);

    // Implementar funcionalidad de arrastrar y soltar
    makeDraggable(hashtagPreview, 'hashtag-x', 'hashtag-y');
    makeDraggable(podcastPreview, 'podcast-x', 'podcast-y');
    makeDraggable(wavePreview, 'wave-x', 'wave-y', 'wave-width', 'wave-height');

    function makeDraggable(element, xInputId, yInputId, widthInputId = null, heightInputId = null) {
        let isDragging = false;
        let startX, startY;
        let elementX, elementY;
        const previewCanvas = document.getElementById('preview-canvas');
        const canvasRect = previewCanvas.getBoundingClientRect();

        element.addEventListener('mousedown', function(e) {
            isDragging = true;
            
            // Calcular la posición inicial relativa al canvas
            const rect = element.getBoundingClientRect();
            startX = e.clientX - canvasRect.left;
            startY = e.clientY - canvasRect.top;
            
            // Guardar la posición actual del elemento
            elementX = parseInt(element.style.left) || 0;
            elementY = parseInt(element.style.top) || 0;
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            // Calcular la nueva posición relativa al canvas
            const currentX = e.clientX - canvasRect.left;
            const currentY = e.clientY - canvasRect.top;
            
            // Calcular el desplazamiento desde la posición inicial
            const dx = currentX - startX;
            const dy = currentY - startY;
            
            // Calcular la nueva posición del elemento
            const newX = elementX + dx;
            const newY = elementY + dy;
            
            // Restringir dentro de los límites del canvas
            const maxX = previewCanvas.width - element.offsetWidth;
            const maxY = previewCanvas.height - element.offsetHeight;
            
            const boundedX = Math.max(0, Math.min(newX, maxX));
            const boundedY = Math.max(0, Math.min(newY, maxY));
            
            // Convertir coordenadas de vista previa a reales
            const realCoords = convertPreviewToRealCoordinates(boundedX, boundedY);
            
            // Actualizar inputs con las coordenadas reales
            document.getElementById(xInputId).value = realCoords.x;
            document.getElementById(yInputId).value = realCoords.y;
            
            // Actualizar posición del elemento en la vista previa
            element.style.left = `${boundedX}px`;
            element.style.top = `${boundedY}px`;
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // Actualizar el rect del canvas cuando cambie el tamaño de la ventana
        window.addEventListener('resize', function() {
            canvasRect = previewCanvas.getBoundingClientRect();
        });
    }

    // Sincronizar cambios en los inputs numéricos con la vista previa
    document.getElementById('hashtag-x').addEventListener('input', updateElementPositions);
    document.getElementById('hashtag-y').addEventListener('input', updateElementPositions);
    document.getElementById('podcast-x').addEventListener('input', updateElementPositions);
    document.getElementById('podcast-y').addEventListener('input', updateElementPositions);
    document.getElementById('wave-x').addEventListener('input', updateElementPositions);
    document.getElementById('wave-y').addEventListener('input', updateElementPositions);
    document.getElementById('wave-width').addEventListener('input', updateElementPositions);
    document.getElementById('wave-height').addEventListener('input', updateElementPositions);
    document.getElementById('wave-color').addEventListener('input', updateElementPositions);

    // Añadir botón para mostrar/ocultar la rejilla de guía
    const gridButton = document.createElement('button');
    gridButton.type = 'button';
    gridButton.className = 'grid-toggle';
    gridButton.textContent = 'Mostrar guías';
    gridButton.style.marginTop = '10px';
    gridButton.style.width = 'auto';
    previewSection.appendChild(gridButton);

    let showGrid = false;
    gridButton.addEventListener('click', function() {
        showGrid = !showGrid;
        if (showGrid) {
            drawGrid();
            gridButton.textContent = 'Ocultar guías';
        } else {
            // Redibujar canvas sin rejilla
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, 0, 0, img.width, img.height);
            };
            img.src = URL.createObjectURL(document.getElementById('template-file').files[0]);
            gridButton.textContent = 'Mostrar guías';
        }
    });

    function drawGrid() {
        // Dibujar líneas de rejilla encima de la imagen
        const gridSize = 50;
        const width = previewCanvas.width;
        const height = previewCanvas.height;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 70, 0.3)';
        ctx.lineWidth = 0.5;
        
        // Líneas verticales
        for (let x = gridSize; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Añadir números de coordenada X
            ctx.fillStyle = 'rgba(255, 0, 70, 0.8)';
            ctx.font = '10px Arial';
            ctx.fillText(x.toString(), x + 2, 10);
        }
        
        // Líneas horizontales
        for (let y = gridSize; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Añadir números de coordenada Y
            ctx.fillStyle = 'rgba(255, 0, 70, 0.8)';
            ctx.font = '10px Arial';
            ctx.fillText(y.toString(), 2, y - 2);
        }
        
        ctx.restore();
    }

    // Actualizar previsualización cuando cambie el color de la onda
    document.getElementById('wave-color').addEventListener('input', function() {
        const color = this.value;
        wavePreview.querySelector('.wave-placeholder').style.background = 
            `repeating-linear-gradient(to right, ${color}, ${color} 2px, transparent 2px, transparent 4px)`;
    });

    // Modifica la función de instrucciones para que sea más visible
    function addInstructions() {
        // Quitar instrucciones anteriores si existen
        const existingInstructions = document.querySelector('.drag-instructions');
        if (existingInstructions) {
            existingInstructions.remove();
        }
        
        // Crear instrucciones
        const instructions = document.createElement('div');
        instructions.className = 'drag-instructions';
        instructions.innerHTML = `
            <div class="instruction-pointer">👇</div>
            <p>1. Arrastra los elementos para posicionarlos en la imagen</p>
            <p>2. Para la onda, puedes redimensionarla desde la esquina inferior derecha</p>
        `;
        
        // Añadir al DOM en una posición más visible
        previewSection.insertBefore(instructions, previewSection.firstChild);
        
        // Animar instrucciones
        setTimeout(() => {
            instructions.classList.add('active');
            // Mantener las instrucciones visible más tiempo
            setTimeout(() => {
                instructions.classList.remove('active');
                setTimeout(() => instructions.remove(), 1000);
            }, 10000);
        }, 500);
    }

    // Actualizar estilos CSS para las instrucciones para hacerlas más visibles
    document.head.insertAdjacentHTML('beforeend', `
    <style>
    .drag-instructions {
        position: relative;
        background-color: rgba(255, 0, 70, 0.9);
        color: white;
        padding: 15px;
        margin: 15px auto;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        opacity: 0;
        transition: all 0.5s;
        z-index: 100;
        max-width: 80%;
        text-align: center;
    }

    .drag-instructions.active {
        opacity: 1;
        transform: translateY(0);
    }

    .instruction-pointer {
        font-size: 24px;
        text-align: center;
        animation: point-down 1s infinite;
    }

    @keyframes point-down {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(10px); }
    }

    .no-image-message {
        padding: 20px;
        background-color: #f8f9fa;
        border: 1px dashed #ccc;
        border-radius: 5px;
        text-align: center;
        color: #555;
        margin: 20px 0;
    }

    .preview-info {
        position: relative;
        padding: 10px;
        background-color: #f0f0f0;
        border-radius: 5px;
        margin-top: 15px;
    }

    .preview-section h3 {
        color: #FF0046;
        margin-bottom: 10px;
    }

    .draggable-element {
        position: absolute;
        cursor: move;
        background-color: rgba(255, 255, 255, 0.6);
        border: 2px dashed #FF0046;
        padding: 8px;
        border-radius: 4px;
        user-select: none;
        min-width: 80px;
        min-height: 30px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        z-index: 10;
    }

    .draggable-element:hover {
        background-color: rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 15px rgba(255, 0, 70, 0.3);
    }

    .drag-handle {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 20px;
        height: 20px;
        background-color: #FF0046;
        color: white;
        border-radius: 50%;
        text-align: center;
        line-height: 20px;
        font-size: 12px;
        cursor: move;
        z-index: 11;
    }

    .element-label {
        position: absolute;
        top: -25px;
        left: 0;
        font-size: 12px;
        background-color: #FF0046;
        color: white;
        padding: 3px 8px;
        border-radius: 3px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 11;
    }

    .wave-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 4px;
        position: relative;
    }

    .wave-placeholder::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background-color: currentColor;
        opacity: 0.7;
    }

    /* Indicadores de dimensiones al mover */
    .draggable-element::after {
        content: attr(data-size);
        position: absolute;
        bottom: -20px;
        right: 0;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 10px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .draggable-element.moving::after,
    .draggable-element.resizing::after {
        opacity: 1;
    }

    /* Indicadores de resize en las esquinas */
    #wave-preview::before {
        content: "";
        position: absolute;
        bottom: 0;
        right: 0;
        width: 10px;
        height: 10px;
        border-right: 2px solid #FF0046;
        border-bottom: 2px solid #FF0046;
        cursor: nwse-resize;
    }

    /* Hacer los campos de posición opcionales */
    .position-fields-toggle {
        font-size: 12px;
        color: #777;
        cursor: pointer;
        display: inline-block;
        margin-left: 10px;
        user-select: none;
    }

    .position-fields-toggle:hover {
        color: #FF0046;
        text-decoration: underline;
    }

    .position-fields.collapsed {
        height: 0;
        overflow: hidden;
        margin: 0;
        padding: 0;
        transition: height 0.3s;
    }
    </style>
    `);

    // Mejorar la visibilidad de los elementos en el canvas
    window.addEventListener('load', function() {
        // Verificar si ya hay una imagen cargada al iniciar
        const templateInput = document.getElementById('template-file');
        if (templateInput.files && templateInput.files[0]) {
            // Disparar el evento change para procesar la imagen
            const event = new Event('change', { bubbles: true });
            templateInput.dispatchEvent(event);
        } else {
            // Mostrar mensaje
            const noImageMsg = document.createElement('div');
            noImageMsg.className = 'no-image-message';
            noImageMsg.textContent = 'Carga una imagen de template para visualizar y posicionar los elementos';
            previewSection.appendChild(noImageMsg);
        }
    });

    // Añadir función para mostrar/ocultar los campos numéricos
    function setupPositionFieldsToggle() {
        // Añadir el enlace para mostrar/ocultar
        const optionsHeadings = document.querySelectorAll('.options-section h3, .text-group h4');
        
        optionsHeadings.forEach(heading => {
            const toggle = document.createElement('span');
            toggle.className = 'position-fields-toggle';
            toggle.textContent = 'Mostrar/ocultar campos';
            toggle.dataset.state = 'visible';
            
            heading.appendChild(toggle);
            
            // Obtener los campos de posición después del encabezado
            const optionGroups = heading.parentElement.querySelectorAll('.option-group');
            
            toggle.addEventListener('click', function() {
                if (this.dataset.state === 'visible') {
                    // Ocultar campos
                    optionGroups.forEach(group => {
                        group.classList.add('collapsed');
                    });
                    this.dataset.state = 'hidden';
                    this.textContent = 'Mostrar campos';
                } else {
                    // Mostrar campos
                    optionGroups.forEach(group => {
                        group.classList.remove('collapsed');
                    });
                    this.dataset.state = 'visible';
                    this.textContent = 'Ocultar campos';
                }
            });
        });
    }

    // Añadir un indicador de tamaño durante arrastre/resize
    function updateSizeIndicators() {
        // Actualizar el atributo data-size
        wavePreview.setAttribute('data-size', 
            `${wavePreview.offsetWidth}×${wavePreview.offsetHeight}`);
        
        // Actualizar clases cuando se está moviendo o redimensionando
        document.addEventListener('mousedown', function(e) {
            if (e.target.closest('.draggable-element')) {
                const element = e.target.closest('.draggable-element');
                
                // Detectar si estamos en bordes para determinar si es resize o move
                const rect = element.getBoundingClientRect();
                const isOnRightEdge = (e.clientX > rect.right - 15);
                const isOnBottomEdge = (e.clientY > rect.bottom - 15);
                
                if (isOnRightEdge || isOnBottomEdge) {
                    element.classList.add('resizing');
                } else {
                    element.classList.add('moving');
                }
            }
        });
        
        document.addEventListener('mouseup', function() {
            document.querySelectorAll('.draggable-element.moving, .draggable-element.resizing')
                .forEach(el => {
                    el.classList.remove('moving');
                    el.classList.remove('resizing');
                });
        });
    }

    // 1. Crear un panel de instrucciones permanente con botón de cerrar
    function addPermanentInstructions() {
        // Eliminar instrucciones anteriores si existen
        const existingInstructions = document.querySelector('.instructions-panel');
        if (existingInstructions) {
            existingInstructions.remove();
        }
        
        // Crear panel de instrucciones
        const instructionsPanel = document.createElement('div');
        instructionsPanel.className = 'instructions-panel';
        instructionsPanel.innerHTML = `
            <div class="instructions-header">
                <h4>Instrucciones</h4>
                <span class="close-instructions">&times;</span>
            </div>
            <div class="instructions-content">
                <p><strong>1.</strong> Arrastra los elementos para posicionarlos en la imagen</p>
                <p><strong>2.</strong> Para la onda, puedes redimensionarla desde la esquina inferior derecha</p>
                <p><strong>3.</strong> La vista previa del audio mostrará cómo se verá la onda de sonido en el video</p>
                <p><strong>4.</strong> Puedes activar la cuadrícula para posicionar con mayor precisión</p>
            </div>
        `;
        
        // Añadir al DOM
        previewSection.insertBefore(instructionsPanel, previewSection.firstChild);
        
        // Manejar cierre
        const closeButton = instructionsPanel.querySelector('.close-instructions');
        closeButton.addEventListener('click', function() {
            instructionsPanel.classList.add('minimized');
            // Mostrar botón para restaurar
            const restoreButton = document.createElement('button');
            restoreButton.className = 'restore-instructions';
            restoreButton.textContent = 'Mostrar instrucciones';
            restoreButton.style.marginBottom = '10px';
            
            // Insertar antes del contenedor de previsualización
            previewSection.insertBefore(restoreButton, instructionsPanel.nextSibling);
            
            restoreButton.addEventListener('click', function() {
                instructionsPanel.classList.remove('minimized');
                restoreButton.remove();
            });
        });
    }

    // 2. Función para asegurar que la onda de audio se muestre correctamente
    function createWaveformSVG() {
        // Crear un SVG más representativo de una forma de onda de audio
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", "0 0 100 30");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.style.display = "block";
        
        // Obtener el color seleccionado para la onda
        const waveColor = document.getElementById('wave-color').value;
        
        // Crear múltiples líneas para simular una onda de audio
        for (let i = 0; i < 50; i++) {
            const x = i * 2;
            // Crear altura aleatoria pero con patrón de onda
            const height = 5 + 10 * Math.sin(i/3) + Math.random() * 10;
            
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", 15 - height/2);
            line.setAttribute("x2", x);
            line.setAttribute("y2", 15 + height/2);
            line.setAttribute("stroke", waveColor);
            line.setAttribute("stroke-width", "1");
            
            svg.appendChild(line);
        }
        
        // Añadir al elemento de la onda
        const wavePlaceholder = wavePreview.querySelector('.wave-placeholder');
        if (wavePlaceholder) {
            wavePlaceholder.innerHTML = '';
            wavePlaceholder.appendChild(svg);
        }
        
        // Asegurarse de que el elemento de onda sea visible
        wavePreview.style.display = 'block';
        wavePreview.style.position = 'absolute';
        wavePreview.style.border = '2px dashed #FF0046';
        wavePreview.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        wavePreview.style.zIndex = '10';
        
        // Actualizar posición y dimensiones
        const waveX = parseInt(document.getElementById('wave-x').value);
        const waveY = parseInt(document.getElementById('wave-y').value);
        const waveWidth = parseInt(document.getElementById('wave-width').value);
        const waveHeight = parseInt(document.getElementById('wave-height').value);
        
        wavePreview.style.left = waveX + 'px';
        wavePreview.style.top = waveY + 'px';
        wavePreview.style.width = waveWidth + 'px';
        wavePreview.style.height = waveHeight + 'px';
        
        // Añadir etiqueta si no existe
        if (!wavePreview.querySelector('.element-label')) {
            const waveLabel = document.createElement('div');
            waveLabel.className = 'element-label';
            waveLabel.textContent = 'Onda';
            waveLabel.style.position = 'absolute';
            waveLabel.style.top = '-25px';
            waveLabel.style.left = '0';
            waveLabel.style.backgroundColor = '#FF0046';
            waveLabel.style.color = 'white';
            waveLabel.style.padding = '3px 8px';
            waveLabel.style.borderRadius = '3px';
            waveLabel.style.fontWeight = 'bold';
            wavePreview.insertBefore(waveLabel, wavePreview.firstChild);
        }
    }

    // 2. Función para ocultar/mostrar las opciones del formulario según el estado de carga
    function toggleFormOptions() {
        const audioFile = document.getElementById('audio-file').files[0];
        const templateFile = document.getElementById('template-file').files[0];
        
        const optionsSection = document.querySelector('.options-section');
        const textOptionsSection = document.querySelector('.text-options-section');
        const previewSection = document.querySelector('.preview-section');
        
        // Verificar si tenemos ambos archivos
        if (audioFile && templateFile) {
            // Mostrar todas las opciones
            if (optionsSection) optionsSection.style.display = 'block';
            if (textOptionsSection) textOptionsSection.style.display = 'block';
            if (previewSection) previewSection.style.display = 'block';
            
            // Asegurar que la onda se muestre
            setTimeout(createWaveformSVG, 300);
        } else {
            // Ocultar opciones si falta algún archivo
            if (optionsSection) optionsSection.style.display = 'none';
            if (textOptionsSection) textOptionsSection.style.display = 'none';
            if (previewSection) previewSection.style.display = 'none';
        }
    }

    // Ocultar inicialmente las secciones de opciones y previsualización
    document.addEventListener('DOMContentLoaded', function() {
        const optionsSection = document.querySelector('.options-section');
        const textOptionsSection = document.querySelector('.text-options-section');
        const previewSection = document.querySelector('.preview-section');
        
        if (optionsSection) optionsSection.style.display = 'none';
        if (textOptionsSection) textOptionsSection.style.display = 'none';
        if (previewSection) previewSection.style.display = 'none';
        
        // Verificar estado inicial
        toggleFormOptions();
        
        // Mostrar mensaje informativo
        const uploadSection = document.querySelector('.upload-section');
        const infoMessage = document.createElement('div');
        infoMessage.className = 'upload-info-message';
        infoMessage.innerHTML = '<p>👉 Carga un archivo de audio y una imagen de template para continuar</p>';
        infoMessage.style.textAlign = 'center';
        infoMessage.style.padding = '15px';
        infoMessage.style.backgroundColor = '#f8f9fa';
        infoMessage.style.borderRadius = '8px';
        infoMessage.style.margin = '15px 0';
        infoMessage.style.color = '#666';
        
        uploadSection.appendChild(infoMessage);
    });

    // Añadir listeners para los inputs de archivo
    document.getElementById('audio-file').addEventListener('change', function() {
        toggleFormOptions();
        updateUploadStatus();
    });

    document.getElementById('template-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Código existente para cargar la imagen...
            
            // Actualizar opciones y onda
            toggleFormOptions();
            updateUploadStatus();
        }
    });

    // Actualizar mensaje informativo
    function updateUploadStatus() {
        const audioFile = document.getElementById('audio-file').files[0];
        const templateFile = document.getElementById('template-file').files[0];
        const infoMessage = document.querySelector('.upload-info-message');
        
        if (!infoMessage) return;
        
        if (audioFile && templateFile) {
            infoMessage.innerHTML = '<p>✅ Ambos archivos cargados. Ahora puedes ajustar las opciones.</p>';
            infoMessage.style.backgroundColor = '#d4edda';
            infoMessage.style.color = '#155724';
            
            // Hacer scroll a las opciones
            setTimeout(() => {
                const previewSection = document.querySelector('.preview-section');
                if (previewSection) {
                    previewSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
        } else if (audioFile) {
            infoMessage.innerHTML = '<p>🎵 Audio cargado. Falta la imagen de template.</p>';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
        } else if (templateFile) {
            infoMessage.innerHTML = '<p>🖼️ Imagen cargada. Falta el archivo de audio.</p>';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
        } else {
            infoMessage.innerHTML = '<p>👉 Carga un archivo de audio y una imagen de template para continuar</p>';
            infoMessage.style.backgroundColor = '#f8f9fa';
            infoMessage.style.color = '#666';
        }
    }

    // Asegurar que la onda sea visible
    function fixWaveDisplay() {
        // 1. Mejorar el estilo de la onda para mayor visibilidad
        document.head.insertAdjacentHTML('beforeend', `
        <style>
        #wave-preview {
            display: block !important;
            position: absolute !important;
            background-color: rgba(255, 255, 255, 0.7) !important;
            border: 2px dashed #FF0046 !important;
            padding: 8px !important;
            min-width: 150px !important;
            min-height: 50px !important;
            z-index: 10 !important;
            box-shadow: 0 0 10px rgba(255, 0, 70, 0.3) !important;
        }
        
        .wave-placeholder {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
        }
        
        /* Añadir puntos de control para el resize */
        #wave-preview::after {
            content: "";
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            background: linear-gradient(135deg, transparent 50%, #FF0046 50%) !important;
            cursor: nwse-resize !important;
        }
        </style>
        `);
        
        // 2. Forzar la creación del SVG de onda
        createWaveformSVG();
    }

    // Añadir esta función para ser llamada cuando se carga la imagen
    document.getElementById('template-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Leer la imagen
            const reader = new FileReader();
            reader.onload = function(e) {
                // Configurar la imagen en el canvas
                const img = new Image();
                img.onload = function() {
                    // Código existente para configurar el canvas
                    
                    // Añadir timeout para asegurar que los elementos se muestren
                    setTimeout(fixWaveDisplay, 500);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Asegurar que la onda se actualice cuando se cambie el color
    document.getElementById('wave-color').addEventListener('input', function() {
        createWaveformSVG();
    });

    // Función para hacer la onda redimensionable
    function makeWaveResizable() {
        const wavePreview = document.getElementById('wave-preview');
        if (!wavePreview) return;
        
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        
        // Evento para iniciar el redimensionamiento
        wavePreview.addEventListener('mousedown', function(e) {
            const rect = wavePreview.getBoundingClientRect();
            const isOnRightEdge = (e.clientX > rect.right - 15);
            const isOnBottomEdge = (e.clientY > rect.bottom - 15);
            
            if (isOnRightEdge && isOnBottomEdge) {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(wavePreview).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(wavePreview).height, 10);
                e.preventDefault();
            }
        });
        
        // Evento para redimensionar
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            if (width > 50) {
                wavePreview.style.width = width + 'px';
                document.getElementById('wave-width').value = width;
            }
            
            if (height > 20) {
                wavePreview.style.height = height + 'px';
                document.getElementById('wave-height').value = height;
            }
        });
        
        // Evento para terminar el redimensionamiento
        document.addEventListener('mouseup', function(e) {
            isResizing = false;
            
            // Actualizar el SVG para que se ajuste al nuevo tamaño
            if (wavePreview.querySelector('.wave-placeholder')) {
                createWaveformSVG();
            }
        });
    }

    // Llamar a esta función después de que la página esté cargada
    window.addEventListener('load', function() {
        makeWaveResizable();
    });

    // Función que se ejecuta cuando el DOM está completamente cargado
    function initializeFormBehavior() {
        // Ocultar todas las secciones de opciones inicialmente
        hideOptionsUntilFilesUploaded();
        
        // Añadir listeners para los inputs de archivo
        setupFileUploadListeners();
        
        // Añadir estilos adicionales para mejorar la visibilidad
        document.head.insertAdjacentHTML('beforeend', `
        <style>
        .draggable-element {
            position: absolute !important;
            display: block !important;
            min-width: 80px !important;
            min-height: 30px !important;
            background-color: rgba(255, 255, 255, 0.7) !important;
            border: 2px dashed #FF0046 !important;
            padding: 8px !important;
            z-index: 10 !important;
        }
        
        #wave-preview {
            min-width: 150px !important;
            min-height: 50px !important;
        }
        
        .wave-placeholder {
            width: 100% !important;
            height: 100% !important;
        }
        
        .element-label {
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background-color: #FF0046 !important;
            color: white !important;
            padding: 3px 8px !important;
            border-radius: 3px !important;
            font-weight: bold !important;
            z-index: 11 !important;
            font-size: 12px !important;
        }
        
        .upload-info-message {
            margin: 20px 0 !important;
            padding: 15px !important;
            text-align: center !important;
            border-radius: 8px !important;
        }
        </style>
        `);
    }

    // Función para ocultar las secciones de opciones
    function hideOptionsUntilFilesUploaded() {
        // Obtener las secciones que debemos ocultar
        const optionsSection = document.querySelector('.options-section');
        const textOptionsSection = document.querySelector('.text-options-section');
        const previewSection = document.querySelector('.preview-section');
        
        // Ocultar secciones mediante CSS
        if (optionsSection) {
            optionsSection.style.display = 'none';
        }
        
        if (textOptionsSection) {
            textOptionsSection.style.display = 'none';
        }
        
        if (previewSection) {
            previewSection.style.display = 'none';
        }
        
        // También inhabilitar el botón de generar video
        const submitButton = document.getElementById('process-button');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.style.opacity = '0.5';
            submitButton.style.cursor = 'not-allowed';
        }
        
        // Añadir mensaje informativo
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            const infoMessage = document.createElement('div');
            infoMessage.id = 'upload-info-message';
            infoMessage.className = 'upload-info-message';
            infoMessage.innerHTML = '<p>⚠️ Carga un archivo de audio y una imagen de template para continuar.</p>';
            
            // Estilos para el mensaje
            infoMessage.style.textAlign = 'center';
            infoMessage.style.padding = '15px';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
            infoMessage.style.borderRadius = '8px';
            infoMessage.style.margin = '20px 0';
            infoMessage.style.border = '1px solid #ffeeba';
            
            // Añadir al DOM antes del botón submit
            if (submitButton && submitButton.parentNode) {
                submitButton.parentNode.insertBefore(infoMessage, submitButton);
            } else {
                uploadSection.appendChild(infoMessage);
            }
        }
    }

    // Configurar listeners para los inputs de archivo
    function setupFileUploadListeners() {
        const audioInput = document.getElementById('audio-file');
        const templateInput = document.getElementById('template-file');
        
        if (audioInput) {
            audioInput.addEventListener('change', checkFilesUploaded);
        }
        
        if (templateInput) {
            templateInput.addEventListener('change', checkFilesUploaded);
        }
    }

    // Verificar si ambos archivos han sido cargados
    function checkFilesUploaded() {
        const audioInput = document.getElementById('audio-file');
        const templateInput = document.getElementById('template-file');
        
        const audioFile = audioInput ? audioInput.files[0] : null;
        const templateFile = templateInput ? templateInput.files[0] : null;
        
        // Actualizar mensaje informativo
        updateInfoMessage(audioFile, templateFile);
        
        // Si ambos archivos están cargados, mostrar opciones
        if (audioFile && templateFile) {
            showOptions();
        }
    }

    // Actualizar el mensaje informativo según el estado de carga
    function updateInfoMessage(audioFile, templateFile) {
        const infoMessage = document.getElementById('upload-info-message');
        if (!infoMessage) return;
        
        if (audioFile && templateFile) {
            infoMessage.innerHTML = '<p>✅ Ambos archivos cargados. Ahora puedes configurar las opciones.</p>';
            infoMessage.style.backgroundColor = '#d4edda';
            infoMessage.style.color = '#155724';
            infoMessage.style.border = '1px solid #c3e6cb';
        } else if (audioFile) {
            infoMessage.innerHTML = '<p>🎵 Audio cargado. Falta la imagen de template.</p>';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
            infoMessage.style.border = '1px solid #ffeeba';
        } else if (templateFile) {
            infoMessage.innerHTML = '<p>🖼️ Imagen cargada. Falta el archivo de audio.</p>';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
            infoMessage.style.border = '1px solid #ffeeba';
        } else {
            infoMessage.innerHTML = '<p>⚠️ Carga un archivo de audio y una imagen de template para continuar.</p>';
            infoMessage.style.backgroundColor = '#fff3cd';
            infoMessage.style.color = '#856404';
            infoMessage.style.border = '1px solid #ffeeba';
        }
    }

    // Mostrar las secciones de opciones
    function showOptions() {
        // Obtener las secciones que debemos mostrar
        const optionsSection = document.querySelector('.options-section');
        const textOptionsSection = document.querySelector('.text-options-section');
        const previewSection = document.querySelector('.preview-section');
        
        // Mostrar secciones con animación
        if (optionsSection) {
            optionsSection.style.display = 'block';
            optionsSection.style.animation = 'fadeIn 0.5s';
        }
        
        if (textOptionsSection) {
            textOptionsSection.style.display = 'block';
            textOptionsSection.style.animation = 'fadeIn 0.5s';
        }
        
        // Esperar un momento antes de mostrar la previsualización
        // para dar tiempo a que se cargue la imagen en el canvas
        setTimeout(() => {
            if (previewSection) {
                previewSection.style.display = 'block';
                previewSection.style.animation = 'fadeIn 0.5s';
                
                // Hacer scroll hacia la previsualización
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            // Asegurar que la onda se muestre
            setTimeout(createWaveformSVG, 300);
        }, 500);
        
        // Habilitar el botón de generar video
        const submitButton = document.getElementById('process-button');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        }
        
        // Añadir animación para mostrar secciones
        document.head.insertAdjacentHTML('beforeend', `
        <style>
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        </style>
        `);
    }

    // Ejecutar la inicialización cuando la página cargue
    initializeFormBehavior();

    // Función para crear y mostrar de manera forzada el elemento de onda
    function forceDisplayWaveElement() {
        // 1. Verificar si el elemento ya existe
        let wavePreview = document.getElementById('wave-preview');
        
        // Si no existe, lo creamos desde cero
        if (!wavePreview) {
            wavePreview = document.createElement('div');
            wavePreview.id = 'wave-preview';
            wavePreview.className = 'draggable-element wave-element';
            
            // Crear contenido interno
            wavePreview.innerHTML = `
                <div class="drag-handle">+</div>
                <div class="wave-placeholder"></div>
            `;
            
            // Añadir al contenedor de previsualización
            const previewContainer = document.querySelector('.preview-container');
            if (previewContainer) {
                previewContainer.appendChild(wavePreview);
            }
        }
        
        // 2. Asegurar que sea visible y tenga estilos prominentes
        wavePreview.style.display = 'block';
        wavePreview.style.position = 'absolute';
        wavePreview.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        wavePreview.style.border = '3px solid #FF0046';
        wavePreview.style.borderRadius = '5px';
        wavePreview.style.boxShadow = '0 0 15px rgba(255, 0, 70, 0.4)';
        wavePreview.style.padding = '8px';
        wavePreview.style.zIndex = '100';
        
        // 3. Obtener valores de posicionamiento de los inputs
        const waveX = parseInt(document.getElementById('wave-x').value) || 250;
        const waveY = parseInt(document.getElementById('wave-y').value) || 400;
        const waveWidth = parseInt(document.getElementById('wave-width').value) || 250;
        const waveHeight = parseInt(document.getElementById('wave-height').value) || 60;
        
        // 4. Aplicar posición y dimensiones
        wavePreview.style.left = waveX + 'px';
        wavePreview.style.top = waveY + 'px';
        wavePreview.style.width = waveWidth + 'px';
        wavePreview.style.height = waveHeight + 'px';
        
        // 5. Añadir etiqueta descriptiva
        let waveLabel = wavePreview.querySelector('.element-label');
        if (!waveLabel) {
            waveLabel = document.createElement('div');
            waveLabel.className = 'element-label';
            waveLabel.textContent = 'Onda';
            wavePreview.insertBefore(waveLabel, wavePreview.firstChild);
        }
        
        // 6. Crear un SVG realmente visible para la onda
        createProminentWaveSVG();
        
        // 7. Hacer que el elemento sea redimensionable y arrastrable
        makeElementDraggable(wavePreview, 'wave-x', 'wave-y', 'wave-width', 'wave-height');
        
        // 8. Añadir un botón para reposicionar la onda si está fuera de vista
        addWaveResetButton();
    }

    // Función para crear un SVG de onda prominente y muy visible
    function createProminentWaveSVG() {
        const wavePreview = document.getElementById('wave-preview');
        if (!wavePreview) return;
        
        const wavePlaceholder = wavePreview.querySelector('.wave-placeholder');
        if (!wavePlaceholder) return;
        
        // Limpiar contenido anterior
        wavePlaceholder.innerHTML = '';
        
        // Obtener el color de la onda
        const waveColor = document.getElementById('wave-color').value || '#FF0046';
        
        // Crear SVG
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", "0 0 100 30");
        svg.setAttribute("preserveAspectRatio", "none");
        
        // Crear un rectángulo base para mejor visibilidad
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("width", "100");
        rect.setAttribute("height", "30");
        rect.setAttribute("fill", "rgba(255, 255, 255, 0.5)");
        svg.appendChild(rect);
        
        // Crear una línea de base horizontal
        const baseLine = document.createElementNS(svgNS, "line");
        baseLine.setAttribute("x1", "0");
        baseLine.setAttribute("y1", "15");
        baseLine.setAttribute("x2", "100");
        baseLine.setAttribute("y2", "15");
        baseLine.setAttribute("stroke", waveColor);
        baseLine.setAttribute("stroke-width", "0.5");
        baseLine.setAttribute("stroke-opacity", "0.5");
        svg.appendChild(baseLine);
        
        // Crear múltiples líneas para una onda muy visible
        for (let i = 0; i < 100; i += 2) {
            // Uso de múltiples funciones seno para un patrón más realista
            const amplitude = 13 * Math.sin(i/10) * (0.5 + 0.5 * Math.sin(i/3));
            
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", i);
            line.setAttribute("y1", 15 - amplitude);
            line.setAttribute("x2", i);
            line.setAttribute("y2", 15 + amplitude);
            line.setAttribute("stroke", waveColor);
            line.setAttribute("stroke-width", "2");
            svg.appendChild(line);
        }
        
        // Añadir texto "AUDIO" como marca de agua
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", "50");
        text.setAttribute("y", "17");
        text.setAttribute("font-family", "Arial");
        text.setAttribute("font-size", "6");
        text.setAttribute("fill", waveColor);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("opacity", "0.5");
        text.textContent = "AUDIO";
        svg.appendChild(text);
        
        // Añadir el SVG al placeholder
        wavePlaceholder.appendChild(svg);
        
        // Asegurar que el placeholder sea visible
        wavePlaceholder.style.width = "100%";
        wavePlaceholder.style.height = "100%";
        wavePlaceholder.style.display = "block";
        wavePlaceholder.style.overflow = "hidden";
    }

    // Función para hacer que el elemento sea arrastrable y redimensionable
    function makeElementDraggable(element, xInputId, yInputId, widthInputId, heightInputId) {
        let isDragging = false;
        let isResizing = false;
        let startX, startY, startWidth, startHeight, offsetX, offsetY;
        
        // Añadir controlador de resize si no existe
        if (!element.querySelector('.resize-handle') && widthInputId && heightInputId) {
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.width = '15px';
            resizeHandle.style.height = '15px';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.right = '0';
            resizeHandle.style.cursor = 'nwse-resize';
            resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, #FF0046 50%)';
            element.appendChild(resizeHandle);
        }
        
        // Manejar inicio de arrastre o resize
        element.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('resize-handle') && widthInputId && heightInputId) {
                // Estamos redimensionando
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);
            } else {
                // Estamos arrastrando
                isDragging = true;
                const rect = element.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                element.style.opacity = '0.8';
            }
            e.preventDefault();
        });
        
        // Manejar movimiento
        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                const containerRect = document.querySelector('.preview-container').getBoundingClientRect();
                const x = e.clientX - containerRect.left - offsetX;
                const y = e.clientY - containerRect.top - offsetY;
                
                // Limitar al contenedor
                const newX = Math.max(0, Math.min(x, containerRect.width - element.offsetWidth));
                const newY = Math.max(0, Math.min(y, containerRect.height - element.offsetHeight));
                
                element.style.left = newX + 'px';
                element.style.top = newY + 'px';
                
                // Actualizar inputs
                document.getElementById(xInputId).value = Math.round(newX);
                document.getElementById(yInputId).value = Math.round(newY);
            } else if (isResizing && widthInputId && heightInputId) {
                const width = startWidth + (e.clientX - startX);
                const height = startHeight + (e.clientY - startY);
                
                if (width > 50) {
                    element.style.width = width + 'px';
                    document.getElementById(widthInputId).value = width;
                }
                
                if (height > 20) {
                    element.style.height = height + 'px';
                    document.getElementById(heightInputId).value = height;
                }
                
                // Actualizar el SVG
                createProminentWaveSVG();
            }
        });
        
        // Manejar fin de arrastre
        document.addEventListener('mouseup', function() {
            isDragging = false;
            isResizing = false;
            element.style.opacity = '1';
        });
    }

    // Añadir un botón para reposicionar la onda
    function addWaveResetButton() {
        // Verificar si ya existe el botón
        if (document.getElementById('reset-wave-position')) return;
        
        const resetButton = document.createElement('button');
        resetButton.id = 'reset-wave-position';
        resetButton.textContent = 'Mostrar/Reposicionar Onda';
        resetButton.style.marginTop = '10px';
        resetButton.style.marginBottom = '10px';
        resetButton.style.backgroundColor = '#FF0046';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        resetButton.style.padding = '8px 15px';
        resetButton.style.cursor = 'pointer';
        resetButton.style.width = 'auto';
        resetButton.style.display = 'inline-block';
        
        resetButton.addEventListener('click', function() {
            forceDisplayWaveElement();
        });
        
        // Añadir al contenedor de previsualización
        const previewInfo = document.querySelector('.preview-info');
        if (previewInfo) {
            previewInfo.appendChild(resetButton);
        }
    }

    // Añadir estilos adicionales para garantizar la visibilidad
    function addEnhancedStyles() {
        document.head.insertAdjacentHTML('beforeend', `
        <style>
        .wave-element {
            background-color: rgba(255, 255, 255, 0.8) !important;
            border: 3px solid #FF0046 !important;
            box-shadow: 0 0 15px rgba(255, 0, 70, 0.4) !important;
            z-index: 100 !important;
            display: block !important;
            position: absolute !important;
        }
        
        .wave-placeholder {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
            overflow: hidden !important;
        }
        
        .element-label {
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background-color: #FF0046 !important;
            color: white !important;
            padding: 3px 8px !important;
            border-radius: 3px !important;
            font-weight: bold !important;
            z-index: 101 !important;
            font-size: 12px !important;
        }
        
        .resize-handle {
            position: absolute !important;
            width: 15px !important;
            height: 15px !important;
            bottom: 0 !important;
            right: 0 !important;
            cursor: nwse-resize !important;
            z-index: 102 !important;
        }
        
        #reset-wave-position:hover {
            background-color: #e60040 !important;
        }
        </style>
        `);
    }

    // Función principal para ejecutar cuando se carga la imagen
    function enhanceWaveVisualization() {
        // Añadir estilos mejorados
        addEnhancedStyles();
        
        // Mostrar forzosamente el elemento de onda
        forceDisplayWaveElement();
        
        // Añadir botón de reset
        addWaveResetButton();
        
        // Añadir listener para actualizar la onda cuando cambia el color
        document.getElementById('wave-color').addEventListener('input', function() {
            createProminentWaveSVG();
        });
    }

    // Ejecutar cuando se carga la imagen
    document.getElementById('template-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Dar tiempo para que se cargue la imagen y se muestre el canvas
            setTimeout(enhanceWaveVisualization, 1000);
        }
    });

    // Intentar ejecutar inmediatamente si ya hay una imagen cargada
    window.addEventListener('load', function() {
        if (document.querySelector('.preview-container') && 
            document.getElementById('template-file').files.length > 0) {
            setTimeout(enhanceWaveVisualization, 500);
        }
    });

    // También podemos añadir un botón específico en las opciones de onda
    function addWaveVisibilityToggle() {
        const waveOptionsLabel = document.querySelector('label[for="wave-color"]');
        if (waveOptionsLabel && !document.getElementById('toggle-wave-visibility')) {
            const toggleButton = document.createElement('button');
            toggleButton.id = 'toggle-wave-visibility';
            toggleButton.textContent = 'Ver onda';
            toggleButton.style.marginLeft = '10px';
            toggleButton.style.padding = '2px 8px';
            toggleButton.style.fontSize = '12px';
            toggleButton.style.backgroundColor = '#FF0046';
            toggleButton.style.color = 'white';
            toggleButton.style.border = 'none';
            toggleButton.style.borderRadius = '3px';
            toggleButton.style.cursor = 'pointer';
            
            toggleButton.addEventListener('click', function(e) {
                e.preventDefault();
                forceDisplayWaveElement();
            });
            
            waveOptionsLabel.parentNode.appendChild(toggleButton);
        }
    }

    // Ejecutar cuando el DOM esté completamente cargado
    document.addEventListener('DOMContentLoaded', function() {
        addWaveVisibilityToggle();
    });

    // Variables globales para el escalado
    let imageScale = 1;
    let originalImageWidth = 0;
    let originalImageHeight = 0;

    function setupImagePreview() {
        const templateFile = document.getElementById('template-file');
        const previewCanvas = document.getElementById('preview-canvas');
        const previewContainer = document.querySelector('.preview-container');
        const ctx = previewCanvas.getContext('2d');

        templateFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        // Guardar dimensiones originales
                        originalImageWidth = img.width;
                        originalImageHeight = img.height;

                        // Calcular escala para ajustar al contenedor
                        const containerWidth = previewContainer.clientWidth;
                        const containerHeight = previewContainer.clientHeight;
                        
                        const scaleX = containerWidth / img.width;
                        const scaleY = containerHeight / img.height;
                        imageScale = Math.min(scaleX, scaleY);

                        // Ajustar tamaño del canvas
                        previewCanvas.width = img.width * imageScale;
                        previewCanvas.height = img.height * imageScale;

                        // Dibujar imagen escalada
                        ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);

                        // Actualizar posiciones de los elementos
                        updateElementPositions();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Función para convertir coordenadas de vista previa a coordenadas reales
    function convertPreviewToRealCoordinates(previewX, previewY) {
        return {
            x: Math.round(previewX / imageScale),
            y: Math.round(previewY / imageScale)
        };
    }

    // Función para convertir coordenadas reales a coordenadas de vista previa
    function convertRealToPreviewCoordinates(realX, realY) {
        return {
            x: Math.round(realX * imageScale),
            y: Math.round(realY * imageScale)
        };
    }

    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        setupImagePreview();
        updateElementPositions();
        
        // Hacer draggables los elementos sin offsets
        makeDraggable(document.getElementById('hashtag-preview'), 'hashtag-x', 'hashtag-y');
        makeDraggable(document.getElementById('podcast-preview'), 'podcast-x', 'podcast-y');
        makeDraggable(document.getElementById('wave-preview'), 'wave-x', 'wave-y', 'wave-width', 'wave-height');
    });
});