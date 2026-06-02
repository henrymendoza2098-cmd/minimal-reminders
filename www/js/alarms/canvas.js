export let isDrawing = false;
export let ctx = null;
export let currentBrushColor = '#000000';
export let currentBrushSize = 3;
export let isEraserMode = false;

export function getNoteCanvas() {
    return document.getElementById('noteCanvas');
}

export function setupCanvasTools() {
    const wrapper = document.getElementById('canvasWrapper');
    const noteCanvas = getNoteCanvas();
    if (!wrapper || document.getElementById('myCanvasTools')) return;

    const toolsDiv = document.createElement('div');
    toolsDiv.id = 'myCanvasTools';
    toolsDiv.className = 'canvas-tools';
    toolsDiv.innerHTML = `
        <button class="tool-color active" style="background: #000000;" onclick="setBrushColor('#000000', this)"></button>
        <button class="tool-color" style="background: #EB5757;" onclick="setBrushColor('#EB5757', this)"></button>
        <button class="tool-color" style="background: #54A3D6;" onclick="setBrushColor('#54A3D6', this)"></button>
        <button class="tool-color" style="background: #52BD94;" onclick="setBrushColor('#52BD94', this)"></button>
        
        <div class="tool-divider"></div>
        
        <button class="tool-size active" onclick="setBrushSize(3, this)"><div style="width:6px;height:6px;background:#333;border-radius:50%;"></div></button>
        <button class="tool-size" onclick="setBrushSize(8, this)"><div style="width:14px;height:14px;background:#333;border-radius:50%;"></div></button>
        
        <div class="tool-divider"></div>
        
        <button class="tool-eraser" onclick="toggleEraser(this)">🧽</button>
        <button onclick="clearCanvas()">🗑️</button>
    `;
    wrapper.insertBefore(toolsDiv, noteCanvas);
}

export function initCanvas() {
    setupCanvasTools(); 
    const noteCanvas = getNoteCanvas();
    if (!noteCanvas) return;
    ctx = noteCanvas.getContext('2d');
    const container = document.getElementById('canvasWrapper');
    if (container && container.offsetWidth > 0) {
        noteCanvas.width = container.offsetWidth;
        noteCanvas.height = noteCanvas.offsetHeight || (window.innerHeight * 0.65); 
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentBrushSize;
    ctx.strokeStyle = isEraserMode ? '#ffffff' : currentBrushColor;
}
window.initCanvas = initCanvas;

export function startDrawing(e) {
    isDrawing = true;
    if (ctx) ctx.beginPath();
    draw(e);
}

export function stopDrawing() {
    isDrawing = false;
    if (ctx) ctx.beginPath();
}

export function draw(e) {
    if (!isDrawing || !ctx) return;
    e.preventDefault(); 
    const noteCanvas = getNoteCanvas();
    const rect = noteCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

document.addEventListener('DOMContentLoaded', () => {
    const noteCanvas = getNoteCanvas();
    if (noteCanvas) {
        noteCanvas.addEventListener('touchstart', startDrawing, { passive: false });
        noteCanvas.addEventListener('touchmove', draw, { passive: false });
        noteCanvas.addEventListener('touchend', stopDrawing);
    }

    const toggleDrawBtn = document.getElementById('toggleDrawBtn');
    if (toggleDrawBtn) {
        toggleDrawBtn.onclick = () => {
            const wrapper = document.getElementById('canvasWrapper');
            if (!wrapper) return;
            const isHidden = wrapper.style.display === 'none' || wrapper.style.display === '';
            wrapper.style.display = isHidden ? 'flex' : 'none';
            
            document.getElementById('noteInput').style.display = isHidden ? 'none' : 'block';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = isHidden ? 'none' : 'flex';

            if (isHidden) {
                toggleDrawBtn.classList.add('active');
                setTimeout(initCanvas, 10); 
            } else {
                toggleDrawBtn.classList.remove('active');
                if (ctx && noteCanvas) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
                }
            }
        };
    }
});

window.setBrushColor = (color, btn) => {
    isEraserMode = false;
    currentBrushColor = color;
    if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineWidth = currentBrushSize;
    }
    if (btn) {
        document.querySelectorAll('.tool-color, .tool-eraser').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

window.setBrushSize = (size, btn) => {
    currentBrushSize = size;
    if (ctx) ctx.lineWidth = isEraserMode ? size * 2 : size; 
    if (btn) {
        document.querySelectorAll('.tool-size').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

window.toggleEraser = (btn) => {
    isEraserMode = true;
    if (ctx) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = currentBrushSize * 2; 
    }
    if (btn) {
        document.querySelectorAll('.tool-color, .tool-eraser').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

window.clearCanvas = () => { 
    const noteCanvas = getNoteCanvas();
    if (ctx && noteCanvas) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
    } 
};