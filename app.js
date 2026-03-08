// 1. VARIABLES GLOBALES Y ESTADO
let editId = null; 
let selectedEmoji = "📝"; 
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');
// Variable global para el filtro actual
let currentFilter = 'all';

// Eventos para los chips de filtro
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        // 1. Quitar la clase 'active' de todos los chips
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        
        // 2. Poner 'active' al que acabamos de tocar
        chip.classList.add('active');
        
        // 3. Guardar el emoji o 'all' en la variable
        currentFilter = chip.dataset.filter;
        
        // 4. Refrescar la pantalla
        renderAll();
    });
});


    // 2. INICIO, SERVICE WORKER Y TEMA OSCURO
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
        console.log("SW Activo");
        // ¡NUEVO! Pedir permiso de notificaciones al móvil si no lo tiene
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') console.log("Permiso de notificaciones concedido.");
            });
        }
    });
}


// 3. CATEGORÍAS (EMOJIS)
document.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedEmoji = chip.dataset.emoji;
    });
});


addBtn.addEventListener('click', () => {
    const value = taskInput.value.trim();
    if (!value) return;

    // Buscamos si hay una hora (HH:MM am/pm)
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = value.match(timeRegex);

    if (match) {
        // --- CASO A: ES UNA ALARMA (RECUERDO) ---
        procesarAlarma(value, match);
    } else {
        // --- CASO B: ES UNA TAREA (PENDIENTE) ---
        procesarTarea(value);
    }

    // Limpiamos el input y refrescamos la interfaz con la función nueva
    resetState();
    renderAll();
});


// 5. PROCESAR ALARMAS
// 5. PROCESAR ALARMAS (Con tu filtro anti-duplicados)
function procesarAlarma(value, match) {
    let horas = parseInt(match[1]);
    let minutos = match[2] ? parseInt(match[2]) : 0;
    let periodo = match[3] ? match[3].toLowerCase() : null;

    if (periodo === 'pm' && horas < 12) horas += 12;
    else if (periodo === 'am' && horas === 12) horas = 0;

    const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
    let text = value.replace(match[0], '').trim();

    // --- EL FILTRO INTELIGENTE QUE HABÍAS CREADO ---
    if (text.startsWith(selectedEmoji)) {
        text = text.substring(selectedEmoji.length).trim();
    }
    if (!text) text = "Recordatorio";

    let list = JSON.parse(localStorage.getItem('reminders') || '[]');

    if (editId !== null) {
        list = list.map(r => r.id === editId ? { ...r, text, time: fullTime, emoji: selectedEmoji } : r);
    } else {
        list.push({ id: Date.now(), text, time: fullTime, emoji: selectedEmoji, notified: false });
    }
    localStorage.setItem('reminders', JSON.stringify(list));
}

// 6. PROCESAR TAREAS (Con tu filtro anti-duplicados)
function procesarTarea(value) {
    let text = value.trim();

    // --- APLICAMOS EL MISMO FILTRO AQUÍ ---
    if (text.startsWith(selectedEmoji)) {
        text = text.substring(selectedEmoji.length).trim();
    }
    if (!text) text = "Nueva tarea";

    let list = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // Bonus: Ahora también puedes editar las tareas sin hora
    if (editId !== null) {
        list = list.map(t => t.id === editId ? { ...t, text, emoji: selectedEmoji } : t);
    } else {
        list.push({ id: Date.now(), text, emoji: selectedEmoji, completed: false });
        
        let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
        localStorage.setItem('totalCreatedToday', total + 1);
    }
    
    localStorage.setItem('tasks', JSON.stringify(list));
}
// 7. RENDERIZADO GENERAL
function renderAll() {
    renderList('reminders', 'reminderList', true);
    renderList('tasks', 'taskList', false);
    updateProgress();
}

function renderList(key, elementId, isAlarm) {
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    
    // 1. Aplicamos el filtro si no estamos en "Todas"
    if (currentFilter !== 'all') {
        list = list.filter(item => item.emoji === currentFilter);
    }

    const container = document.getElementById(elementId);
    
    // 2. LÓGICA DEL EMPTY STATE
    if (list.length === 0) {
        // Textos dinámicos dependiendo de si es la lista de alarmas o de tareas
        const icon = isAlarm ? "📭" : "🗡️";
        const message = isAlarm 
            ? "No hay alarmas programadas." 
            : "¡Todo limpio! Ni un solo demonio a la vista.";
            
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">${icon}</span>
                <p>${message}</p>
            </div>
        `;
        return; // ¡Importante! Salimos de la función aquí para no ejecutar el map de abajo
    }

    // 3. Si hay tareas, las dibujamos normalmente
    container.innerHTML = list.map(item => `
        <div class="reminder-card ${isAlarm ? 'alarm-style' : ''}">
            <div>
                <span>${item.emoji || '📝'}</span>
                ${isAlarm ? `<strong class="time-badge">${item.time}</strong>` : ''}
                <span>${item.text}</span>
            </div>
            <div class="actions">
                ${!isAlarm ? `<button onclick="completeTask(${item.id})">✓</button>` : ''}
                <button onclick="prepareEdit(${item.id}, '${key}')">✎</button>
                <button onclick="deleteItem('${key}', ${item.id})">✕</button>
            </div>
        </div>
    `).join('');
}

// 8. FUNCIONES DE APOYO
window.deleteItem = (key, id) => {
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(i => i.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
    renderAll();
};

window.completeTask = (id) => {
    // Aumentar el contador
    let completed = parseInt(localStorage.getItem('completedToday') || 0);
    localStorage.setItem('completedToday', completed + 1);
    
    // Eliminar la tarea de la lista principal
    deleteItem('tasks', id);
    
    // Refrescar toda la interfaz (Barra, Listas y Fuego)
    renderAll();
    updateComboUI(); // ¡AÑADE ESTA LÍNEA AQUÍ!
};

window.prepareEdit = (id, key) => {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const item = list.find(i => i.id === id);
    if (item) {
        taskInput.value = item.text + (item.time ? " " + item.time : "");
        editId = id;
        addBtn.innerText = "Actualizar";
        cancelBtn.style.display = "inline-block";
    }
};

function resetState() {
    editId = null;
    selectedEmoji = "📝";
    taskInput.value = '';
    addBtn.innerText = "Fijar";
    cancelBtn.style.display = "none";
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
}

// 9. BARRA DE PROGRESO
function updateProgress() {
    const total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
    const done = parseInt(localStorage.getItem('completedToday') || 0);
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressBar.style.width = percent + "%";
    progressText.innerText = `${percent}% completado (${done}/${total})`;

    // Usamos 'background' a secas para aplastar cualquier degradado previo del CSS
    if (percent === 0) {
        progressBar.style.background = "transparent";
    } else if (percent < 40) {
        progressBar.style.background = "#ff5252"; // Rojo
        progressText.style.color = "white";
    } else if (percent < 80) {
        progressBar.style.background = "#ffd740"; // Amarillo
        progressText.style.color = "black";
    } else {
        progressBar.style.background = "#00e676"; // Verde
        progressText.style.color = "black";
    }
}

// INICIO
renderAll();




// --- MEJORA 2: RENDERIZADO CON URGENCIA ---

function resetEmoji() {
    selectedEmoji = "📝";
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.classList.remove('selected');
    });
}

// Función auxiliar para calcular urgencia
function calcularDiferenciaMinutos(h1, h2) {
    const [hor1, min1] = h1.split(':').map(Number);
    const [hor2, min2] = h2.split(':').map(Number);
    return (hor2 * 60 + min2) - (hor1 * 60 + min1);
}





// 12. EL VIGILANTE DE ALARMAS BLINDADO
setInterval(() => {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const lista = JSON.parse(localStorage.getItem('reminders') || '[]');
    let huboCambios = false;

    lista.forEach(r => {
        const [hActual, mActual] = horaActual.split(':').map(Number);
        const [hReminder, mReminder] = r.time.split(':').map(Number);
        
        if ((hActual * 60 + mActual) >= (hReminder * 60 + mReminder) && !r.notified) {
            
            // MÉTODO ROBUSTO PARA MÓVILES
            if ('serviceWorker' in navigator && Notification.permission === "granted") {
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification("📝 " + (r.emoji || ""), {
                        body: r.text,
                        icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png",
                        vibrate: [200, 100, 200, 100, 200], // Patrón de vibración más fuerte
                        tag: 'reminder-' + r.id // Evita que se dupliquen notificaciones
                    });
                });
            }

            r.notified = true;
            huboCambios = true;
            
            // Aumentamos el tiempo a 20 segundos para que te dé tiempo de leerla antes de que se borre
            setTimeout(() => { deleteItem('reminders', r.id); }, 20000); 
        }
    });

    if (huboCambios) {
        localStorage.setItem('reminders', JSON.stringify(lista));
        renderAll();
    }
}, 10000);
























// 1. Lleva el recordatorio al input principal

function resetState() {
    editId = null;
    addBtn.innerText = "Fijar";
    cancelBtn.style.display = "none";
    taskInput.value = "";
    addBtn.style.backgroundColor = "";
}

cancelBtn.addEventListener('click', resetState);

// 2. Modifica el evento del addBtn para que sepa si está creando o editando

navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'SNOOZE') {
        const id = event.data.id;
        let list = JSON.parse(localStorage.getItem('reminders') || '[]');
        
        // Calculamos la nueva hora (+5 minutos)
        const ahora = new Date();
        ahora.setMinutes(ahora.getMinutes() + 5);
        const nuevaHora = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        list = list.map(r => r.id === id ? { ...r, time: nuevaHora, notified: false } : r);
        localStorage.setItem('reminders', JSON.stringify(list));
        renderAll();
        alert("Pospuesto 5 minutos");
    }
});


document.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const newEmoji = chip.dataset.emoji;
        let currentText = taskInput.value.trim();

        // 1. Deseleccionar todos los chips y seleccionar el actual
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');

        // 2. Eliminar el emoji anterior del texto (si existe)
        // `selectedEmoji` aún tiene el valor *antes* de este clic
        if (currentText.startsWith(selectedEmoji)) {
            currentText = currentText.substring(selectedEmoji.length).trim();
        }

        // 3. Actualizar el emoji global y poner el nuevo emoji al principio del texto
        selectedEmoji = newEmoji;
        taskInput.value = `${selectedEmoji} ${currentText}`.trim();
        taskInput.focus();
    });
});

// Al guardar (addBtn), usa selectedEmoji como parte del texto o como una propiedad nueva.
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    // Guardar preferencia para que no se resetee al recargar
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// Al cargar la página:
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const minToAdd = parseInt(btn.dataset.min);
        const fecha = new Date();
        fecha.setMinutes(fecha.getMinutes() + minToAdd);
        
        const horaCalculada = fecha.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        // Ponemos la hora automáticamente en el input para que el usuario solo escriba el texto
        taskInput.value = (taskInput.value.replace(/\d{1,2}:\d{2}/, '').trim() + " " + horaCalculada).trim();
        taskInput.focus();
    });
});
// --- BOTÓN DE RESETEO DIARIO ---
document.getElementById('resetDayBtn').addEventListener('click', () => {
  // --- LÓGICA DEL MODAL DE RESETEO ---
const modal = document.getElementById('customModal');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const confirmResetBtn = document.getElementById('confirmResetBtn');

// 1. Al presionar el botón de la interfaz, abrimos el modal
document.getElementById('resetDayBtn').addEventListener('click', () => {
    modal.classList.add('active');
});

// 2. Si le da a "Cancelar", cerramos el modal sin hacer nada
cancelResetBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

// 3. Si le da a "Sí, reiniciar", ejecutamos la limpieza
confirmResetBtn.addEventListener('click', () => {
    // Ponemos contadores a cero
    localStorage.setItem('totalCreatedToday', 0);
    localStorage.setItem('completedToday', 0);
    localStorage.setItem('tasks', '[]'); // Vaciamos la lista visual
    
    // Refrescamos la UI
    renderAll();
    updateComboUI(); // Apaga el fuego
    
    // Cerramos el modal
    modal.classList.remove('active');
});

// (Opcional) Cerrar el modal si el usuario hace clic fuera de la caja (en el fondo oscuro)
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});
});
// --- SISTEMA DE RACHAS (STREAKS) ---

// 1. Obtiene la medianoche exacta de cualquier fecha en milisegundos
function getMidnightTime(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// 2. Revisa el estado de la racha al abrir la app
function checkStreak() {
    const todayTime = getMidnightTime();
    const lastTime = parseInt(localStorage.getItem('lastStreakDate') || 0);
    let streak = parseInt(localStorage.getItem('streakCount') || 0);

    const ONE_DAY = 86400000; // Milisegundos en 24 horas
    const diffDays = Math.round((todayTime - lastTime) / ONE_DAY);

    // Si pasaron 2 días o más desde la última tarea completada, se rompe la racha
    if (diffDays > 1) {
        streak = 0;
        localStorage.setItem('streakCount', 0);
    }
    
    updateStreakUI(streak);
}

// --- SISTEMA DE COMBO DIARIO (Tareas completadas hoy) ---

// --- SISTEMA DE COMBO DIARIO CON PIXEL ART DINÁMICO ---

function updateComboUI() {
    const completadasHoy = parseInt(localStorage.getItem('completedToday') || 0);
    
    const container = document.getElementById('streakContainer');
    const fireImg = document.getElementById('streakIcon'); // Ahora es la etiqueta <img>
    const countText = document.getElementById('streakCount');

    // Actualizar el texto
    countText.innerText = `${completadasHoy} ${completadasHoy === 1 ? 'tarea' : 'tareas'}`;

    // Lógica de Estados Visibles
    if (completadasHoy === 0) {
        // --- ESTADO 0: HIELO/APAGADO ---
        container.classList.remove('on-fire', 'super-fire');
       fireImg.src = 'fuego_gris.gif';          // Cargamos el fuego gris
        fireImg.style.display = 'block';         // ¡Aseguramos que sea visible!
        countText.style.color = "#888";
    } 
    else if (completadasHoy < 10) {
        // --- ESTADO 1: FUEGO NARANJA (1 a 9 tareas) ---
        container.classList.remove('super-fire'); // Quitamos el azul si venía de ahí
        container.classList.add('on-fire');       // Ponemos el naranja
        
        fireImg.src = 'fuego_naranja.gif';       // Cambiamos la imagen al GIF naranja
        fireImg.style.display = 'block';         // Mostramos la imagen
        countText.style.color = "white";         // Texto blanco
    } 
    else {
        // --- ESTADO 2: SUPER FUEGO AZUL (10 o más tareas) ---
        container.classList.remove('on-fire');    // Quitamos el naranja
        container.classList.add('super-fire');    // Ponemos el azul/morado
        
        fireImg.src = 'fuego_azul.gif';          // Cambiamos la imagen al GIF azul
        fireImg.style.display = 'block';         // Mostramos la imagen
        countText.style.color = "white";         // Texto blanco
    }
}

// Asegúrate de que esta función se llame al cargar la página y al completar tareas.
// Ejecutar revisión visual al cargar la página
updateComboUI();