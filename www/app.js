// 1. VARIABLES GLOBALES Y ESTADO
let editId = null; 
let selectedEmoji = "📝"; 
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');
// Variable global para el filtro actual
let currentFilter = 'all';

const noteInput = document.getElementById('noteInput');
const addNoteBtn = document.getElementById('addNoteBtn');

// Variable global para saber si estamos editando una nota existente
let currentEditingNoteId = null;
let selectedTaskData = null; // Guardará la info de la tarea presionada


// Botones de navegación de notas
const openNoteEditorBtn = document.getElementById('openNoteEditorBtn');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
const getTodayStr = () => new Date().toLocaleDateString('es-ES');

// Función que verifica si una fecha es anterior a hoy
function isOverdue(dateStr) {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const taskDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignorar la hora, solo comparar día
    return taskDate < today;
}

let showCompleted = false;
let currentEditingTaskId = null;
let currentEditingTaskKey = 'tasks'; // Nueva variable para saber qué lista editamos

const getLocalNotifications = () => {
    return (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) 
           ? Capacitor.Plugins.LocalNotifications 
           : null;
};
const Notifications = getLocalNotifications();


// 1. Registrar los tipos de acciones



document.getElementById('toggleCompletedBtn').addEventListener('click', () => {
    showCompleted = !showCompleted;
    const container = document.getElementById('completedTaskList');
    container.style.display = showCompleted ? 'block' : 'none';
});

// Abrir editor para nota nueva
openNoteEditorBtn.addEventListener('click', () => {
    currentEditingNoteId = null; // Reset para nota nueva
    document.getElementById('noteInput').value = '';
    switchNoteView('view-notes-editor');
});

// Cancelar y volver a la lista
cancelNoteBtn.addEventListener('click', () => {
    switchNoteView('view-notes');
});

// Función auxiliar para cambiar sub-vistas de notas
document.getElementById('addNoteBtn').addEventListener('click', () => {
    const title = document.getElementById('noteTitleInput').value.trim();
    const content = document.getElementById('noteInput').value.trim();
    
    if (!title && !content) return; // No guardar notas vacías

    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    if (currentEditingNoteId) {
        notes = notes.map(n => n.id === currentEditingNoteId ? { ...n, title, content } : n);
    } else {
        notes.push({ id: Date.now(), title, content });
    }
    
    localStorage.setItem('notes', JSON.stringify(notes));
    switchNoteView('view-notes'); 
});

// Función para cambiar de vista
function switchNoteView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    
    // Controlamos el botón flotante también aquí (ocultarlo en el editor, mostrarlo en la lista)
    const fab = document.getElementById('openNoteEditorBtn');
    if (fab) fab.style.display = (viewId === 'view-notes') ? 'flex' : 'none';

    if(viewId === 'view-notes') renderNotes();
}



// Función para abrir una nota existente
window.openEditNote = (id) => {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const note = notes.find(n => n.id === id);
    if (note) {
        currentEditingNoteId = id;
        document.getElementById('noteTitleInput').value = note.title || '';
        document.getElementById('noteInput').value = note.content || '';
        switchNoteView('view-notes-editor');
    }
};

// ==========================================
// SÚPER CONTROLADOR: FILTRA Y ASIGNA CATEGORÍA
// ==========================================
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        // 1. Quitar color a los demás y dárselo al que tocaste
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        // 2. Actualizar la variable que FILTRA las tareas visualmente
        currentFilter = chip.dataset.filter;

        // 3. Asignar el emoji para GUARDAR nuevas tareas. 
        // Si tocaste "Todas", las nuevas tareas serán "General 📝"
        selectedEmoji = currentFilter === 'all' ? '📝' : currentFilter;

        // 4. Refrescar la lista de la pantalla inmediatamente
        renderAll();
        
        // 5. Devolver el foco al input para que sigas escribiendo rápido
        const inputHoy = document.getElementById('taskInputToday');
        if (inputHoy) inputHoy.focus();
    });
});



// Función para pedir permiso al arrancar la app
// 1.5 VERIFICACIÓN DE CAPACITOR (No rompe el código si falla)


// Función de permisos corregida
async function requestNotificationPermission() {
    
    if (Notifications) {
        try {
            const permission = await Notifications.requestPermissions();
            console.log("Permisos:", permission.display);
        } catch (e) {
            console.error("Error en permisos:", e);
        }
    }
}

// Llamamos al permiso solo cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', requestNotificationPermission);





function resetState() {
    editId = null;
    selectedEmoji = "📝"; // Importante para que la siguiente tarea no use el emoji de la anterior
    taskInput.value = "";
    addBtn.innerText = "Fijar";
    addBtn.style.backgroundColor = ""; // Limpia el color si estabas editando
    cancelBtn.style.display = "none";
}

// Asegúrate de que el evento esté justo debajo
if (cancelBtn) {
    cancelBtn.addEventListener('click', resetState);
}









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



addBtn.addEventListener('click', async () => {
    const value = taskInput.value.trim();
    if (!value) return;

    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = value.match(timeRegex);

    try {
        if (match) {
            // Si hay hora, es una alarma válida
            await procesarAlarma(value, match);
            taskInput.classList.remove('input-error'); // Quitamos error si existía
        } else {
            // ERROR: Si estamos en Recordatorios, EXIGIMOS una hora
            // En lugar de llamar a procesarTarea, avisamos al usuario
            taskInput.classList.add('input-error');
            console.log("Error: Se requiere una hora para fijar un recordatorio.");
            return; // Detenemos la ejecución aquí
        }
    } catch (error) {
        console.error("Error en el flujo:", error);
    }

    resetState(); 
    renderAll();  
});
// 5. PROCESAR ALARMAS
// 5. PROCESAR ALARMAS (Con tu filtro anti-duplicados)
// Importamos la herramienta nativa (Capacitor lo hace posible)

// 1. Verificación de Seguridad de Capacitor al inicio
const isPushAvailable = typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications;

// 2. Función para pedir permisos (Llamarla al cargar la app)
// 1. Función para pedir permisos
async function requestPermissions() {
    if (isPushAvailable) {
        try {
            const permissions = await Capacitor.Plugins.LocalNotifications.requestPermissions();
            console.log("Estado de permisos:", permissions.display);
        } catch (e) {
            console.error("Error pidiendo permisos:", e);
        }
    }
}

// 2. Función para registrar los botones (Hecho/Posponer)
// PASO 0: Registrar los botones para que el sistema operativo los conozca
async function registerNotificationActions() {
   
    if (Notifications) {
        try {
            await Notifications.registerActionTypes({
                types: [
                    {
                        id: 'REMINDER_ACTIONS',
                        actions: [
                            { id: 'done', title: '✔️ Hecho' },
                            { id: 'snooze', title: '⏰ Posponer 5 min' }
                        ]
                    }
                ]
            });
            console.log("Tipos de acciones registrados correctamente");
        } catch (e) {
            console.error("Error registrando acciones:", e);
        }
    }
}

// LLAMADA IMPORTANTE: Ejecútala al cargar la app
document.addEventListener('DOMContentLoaded', () => {
    registerNotificationActions(); // Sin esto, los botones no salen
    renderAll();
});
requestPermissions();





// 3. Escuchar las acciones de la notificación

if (Notifications) {
    Notifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const reminderId = notificationAction.notification.extra.reminderId;
        const actionId = notificationAction.actionId;

        if (actionId === 'done') {
            // SI LE DA A "HECHO": Borramos de la lista de recordatorios
            console.log("Tarea marcada como hecha desde notificación");
            window.deleteItem('reminders', reminderId); 
        } 
        else if (actionId === 'snooze') {
            // SI LE DA A "POSPONER": Calculamos 5 minutos más
            
           const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() + 5);
    const nuevaHora = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // Actualizamos el registro en el localStorage para que se vea en la lista
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list = list.map(r => r.id === reminderId ? { ...r, time: nuevaHora, notified: false } : r);
    localStorage.setItem('reminders', JSON.stringify(list));
    
    // Opcional: Podrías llamar a procesarAlarma de nuevo con la nueva hora
    renderAll();
    console.log("Recordatorio pospuesto 5 minutos");
        }
    });
}

































async function procesarAlarma(value, match) {
    let horas = parseInt(match[1]);
    let minutos = match[2] ? parseInt(match[2]) : 0;
    let periodo = match[3] ? match[3].toLowerCase() : null;

    if (periodo === 'pm' && horas < 12) horas += 12;
    else if (periodo === 'am' && horas === 12) horas = 0;

    const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
    let text = value.replace(match[0], '').trim();
    if (!text) text = "Recordatorio";

    const idUnico = Math.floor(Math.random() * 1000000);
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    
    // Forzamos el emoji ⏰ ya que esta sección ya no tiene selector
    list.push({ id: idUnico, text, time: fullTime, emoji: "⏰", notified: false });
    localStorage.setItem('reminders', JSON.stringify(list));

    
    if (Notifications) {
        const fechaAlarma = new Date();
        fechaAlarma.setHours(horas, minutos, 0, 0);
        if (fechaAlarma < new Date()) fechaAlarma.setDate(fechaAlarma.getDate() + 1);

        try {
           // En tu función procesarAlarma...
                await Notifications.schedule({
                    notifications: [{
                        title: "🔔 " + text, 
                        body: "Recordatorio fijado a las " + fullTime,
                        id: idUnico,
                        schedule: { at: fechaAlarma, allowWhileIdle: true, exact: true },
                        importance: 5,
                        sound: 'res://platform_default',
                        actionTypeId: 'REMINDER_ACTIONS', // <-- ESTA LÍNEA ES LA CLAVE
                        extra: { reminderId: idUnico }    // Pasamos el ID para saber cuál borrar
                    }]
                });
        } catch (err) {
            console.error("Fallo al programar nativa:", err);
        }
    }
    
}
requestNotificationPermission();













































function procesarTarea(value) {
    let text = value.trim();
    if (!text) return; // Si no hay texto, no hacemos nada

    let list = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // Guardamos el texto puro, pero le asignamos el emoji que teníamos en memoria
    list.push({ id: Date.now(), text: text, emoji: selectedEmoji, completed: false });
    
    let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
    localStorage.setItem('totalCreatedToday', total + 1);
    
    localStorage.setItem('tasks', JSON.stringify(list));
}





















// 7. RENDERIZADO GENERAL
function renderAll() {
    renderList('reminders', 'reminderList', true);
    renderList('tasks', 'taskList', false);
    renderNotes();
    updateProgress();
    updateComboUI();
}

function renderList(key, elementId, isAlarm) {
    let list = JSON.parse(localStorage.getItem(key) || '[]');

    const today = getTodayStr();

   
    
    // --- CORRECCIÓN: Aplicar el filtro de categoría ---
    if (key === 'tasks' && currentFilter !== 'all') {
        list = list.filter(item => item.emoji === currentFilter);
    }

    // Si no son alarmas, filtramos por completadas/pendientes
    if (!isAlarm && key === 'tasks') {
        // PRIMERO filtramos por la fecha:
        // - Las de hoy
        // - Las que no tienen fecha
        // - Las VENCIDAS (días anteriores) que aún NO están completadas
        list = list.filter(t => 
            t.date === today || !t.date || (!t.completed && isOverdue(t.date))
        );

        const pending = list.filter(t => !t.completed);
        const completed = list.filter(t => t.completed);
        
        drawTasks(pending, 'taskList', false, key);
        drawTasks(completed, 'completedTaskList', true, key);
        
        // --- OCULTAR SECCIÓN DE COMPLETADAS SI ESTÁ VACÍA ---
        const toggleBtn = document.getElementById('toggleCompletedBtn');
        const completedContainer = document.getElementById('completedTaskList');
        if (completed.length === 0) {
            if (toggleBtn) toggleBtn.style.display = 'none';
            if (completedContainer) completedContainer.style.display = 'none';
        } else {
            if (toggleBtn) toggleBtn.style.display = 'block';
            if (completedContainer) completedContainer.style.display = showCompleted ? 'block' : 'none';
        }
    } else {
        drawTasks(list, elementId, isAlarm, key);
    }
}


// Función para marcar como completada
// Función para marcar como completada (CON CONTADOR)
window.toggleTaskComplete = (id) => {
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let completedDelta = 0;

    tasks = tasks.map(t => {
        if (t.id === id) {
            const newState = !t.completed;
            // Si la tarea pasa a estar completada, sumamos 1. Si se desmarca, restamos 1.
            completedDelta = newState ? 1 : -1;
            return { ...t, completed: newState };
        }
        return t;
    });

    // Actualizar el contador de completadas para el fuego
    let currentDone = parseInt(localStorage.getItem('completedToday') || 0);
    localStorage.setItem('completedToday', Math.max(0, currentDone + completedDelta));

    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderAll(); // Refrescar la vista principal y el fuego
    
    // Refrescar calendario dinámicamente si está abierto
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView) {
        renderCalendar();
        renderCalendarTasks(selectedCalendarDate);
    }
};
function drawTasks(list, containerId, isCompletedOrAlarm, key) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Lógica de "Empty State"
    if (list.length === 0) {
        let icon = "📝";
        let text = "No hay tareas disponibles";

        if (containerId === 'reminderList') {
            icon = "🔔";
            text = "No hay recordatorios configurados";
        } else if (containerId === 'completedTaskList') {
            container.innerHTML = ''; // No dibujar caja vacía para evitar el espacio
            return;
        } else if (containerId === 'taskList' && currentFilter !== 'all') {
            text = `Sin tareas en la categoría ${currentFilter}`;
        }

        container.innerHTML = `
            <div class="empty-state">
                <span>${icon}</span>
                <p>${text}</p>
            </div>
        `;
        return;
    }

    // Si hay items, dibujamos normal (ahora el CSS los pondrá alineados)
    container.innerHTML = list.map(item => {
        const isTaskOverdue = item.date && !item.completed && isOverdue(item.date);
        const urgentClass = isTaskOverdue ? 'urgent' : '';
        return `
        <div class="reminder-card ${item.completed ? 'completed-task' : ''} ${urgentClass}" 
             data-id="${item.id}" data-key="${key}" 
             onclick="openTaskSheet(${item.id})">
            <div class="card-info">
                <span class="category-emoji">${item.emoji || '📝'}</span>
                <span class="task-text-content">${item.text} ${isTaskOverdue ? '<span style="color:var(--error); font-size:11px; font-weight:bold; margin-left:6px;">(Vencida)</span>' : ''}</span>
            </div>
            <div class="actions">
                <button onclick="event.stopPropagation(); toggleTaskComplete(${item.id})" class="btn-check">
                    ${item.completed ? '↩️' : '✓'}
                </button>
            </div>
        </div>
    `}).join('');
    
    attachLongPressEvents();
}
window.deleteItem = (key, id) => {
    // 1. Borramos de la memoria local (lo que ya tenías)
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(i => i.id !== id);
    localStorage.setItem(key, JSON.stringify(list));

    // 2. NUEVO: Cancelar la notificación nativa si estamos borrando un recordatorio
    if (key === 'reminders') {
        
        if (Notifications) {
            // Le decimos a Android que olvide la notificación con este ID
            Notifications.cancel({ 
                notifications: [{ id: parseInt(id) }] 
            });
            console.log("Alarma cancelada en el sistema para el ID:", id);
        }
    }

    renderAll();
    
    // Refrescar calendario dinámicamente si está abierto al eliminar
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView && key === 'tasks') {
        renderCalendar();
        renderCalendarTasks(selectedCalendarDate);
    }
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






// 9. BARRA DE PROGRESO
function updateProgress() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const total = tasks.length;
    
    // Contamos cuántas tareas tienen "completed: true"
    const done = tasks.filter(t => t.completed).length;
    
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (progressBar) {
        progressBar.style.width = percent + "%";
        // Cambiar colores según progreso
        if (percent < 40) progressBar.style.backgroundColor = "#ff5252";
        else if (percent < 80) progressBar.style.backgroundColor = "#ffd740";
        else progressBar.style.backgroundColor = "#00e676";
    }

    if (progressText) {
        progressText.innerText = `${percent}% completado (${done}/${total})`;
    }
}

// INICIO
renderAll();







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



async function checkSystemHealth() {
    console.log("⚙️ 1. Iniciando checkSystemHealth...");

    const statusCard = document.getElementById('permission-status-card');
    const statusIcon = document.getElementById('status-icon');
    const statusTitle = document.getElementById('status-title');
    const statusDesc = document.getElementById('status-desc');
    const fixBtn = document.getElementById('fix-permissions-btn');

    // Verificamos si los IDs existen en el HTML
    if (!statusCard || !statusTitle) {
        console.error("❌ 2. ERROR: No encuentro los IDs en el HTML. Revisa tu index.html");
        return; // Salimos para no romper la app
    }

    console.log("✅ 3. Elementos HTML encontrados perfectamente.");

    // Forma ultra-segura de buscar Capacitor
    let LocalNotifications = null;
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins) {
        LocalNotifications = Capacitor.Plugins.LocalNotifications;
    }

    if (!LocalNotifications) {
        console.log("💻 4. Capacitor no detectado. Cambiando a Modo Web...");
        statusTitle.innerText = "Modo Desarrollo";
        statusDesc.innerText = "Estás en el navegador. Las alarmas reales solo funcionan en el móvil.";
        statusIcon.innerText = "💻";
        return;
    }

    console.log("📱 5. Capacitor detectado. Solicitando estado de permisos a Android...");
    
    try {
        const perms = await LocalNotifications.checkPermissions();
        console.log("🔐 6. Respuesta de Android:", perms.display);
        
        if (perms.display === 'granted') {
            statusCard.className = "status-card status-ok";
            statusIcon.innerText = "✅";
            statusTitle.innerText = "Alarmas Listas";
            statusDesc.innerText = "Los permisos están activos y el sistema responde.";
            fixBtn.style.display = "none";
        } else {
            statusCard.className = "status-card status-error";
            statusIcon.innerText = "⚠️";
            statusTitle.innerText = "Acción Requerida";
            statusDesc.innerText = "Las notificaciones están bloqueadas.";
            fixBtn.style.display = "block";
            fixBtn.onclick = async () => {
                await LocalNotifications.requestPermissions();
                checkSystemHealth();
            };
        }
    } catch (error) {
        console.error("❌ 7. Error fatal al hablar con Android:", error);
        statusTitle.innerText = "Error de Sistema";
        statusDesc.innerText = "No pudimos conectar con el motor de alarmas.";
    }
}

    























// 1. Lleva el recordatorio al input principal



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















































// Al guardar (addBtn), usa selectedEmoji como parte del texto o como una propiedad nueva.
// CONTROLADOR DEL TEMA (Oscuro / Claro)
// --- LÓGICA DEL MENÚ LATERAL ---
const sideMenu = document.getElementById('sideMenu');
const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');

// Abrir menú
menuBtn.onclick = () => {
    // Para que la animación de entrada funcione, primero mostramos el bloque
    sideMenu.style.display = 'block';
    // Usamos un pequeño delay para que el navegador note el cambio y dispare la transición
    setTimeout(() => sideMenu.classList.add('active'), 10);
};

// Cerrar menú (al darle a X o al fondo oscuro)
const closeMenu = () => {
    // 1. Iniciamos la animación de salida (el CSS se encarga del movimiento)
    sideMenu.classList.remove('active');
    
    // 2. Esperamos a que termine la animación (400ms) para ocultar el contenedor por completo
    setTimeout(() => {
        if (!sideMenu.classList.contains('active')) {
            sideMenu.style.display = 'none';
        }
    }, 400);
};
closeMenuBtn.onclick = closeMenu;
sideMenu.onclick = (e) => { if (e.target === sideMenu) closeMenu(); };

// Mover Lógica de TEMA OSCURO al nuevo botón del menú
const themeToggleMenu = document.getElementById('themeToggleMenu');
if (themeToggleMenu) {
    themeToggleMenu.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        closeMenu(); // Cerramos el menú tras cambiar el tema
    });
}

// Lógica para que los items del menú también cambien de vista
document.querySelectorAll('.menu-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.dataset.view;
        
        // Simular clic en la barra de navegación inferior (si existe)
        const navBtn = document.querySelector(`.nav-item[data-view="${targetView}"]`);
        if (navBtn) navBtn.click();
        
        closeMenu();
    });
});

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
        countText.style.color = "#a7a5a5";
    } 
    else if (completadasHoy < 10) {
        // --- ESTADO 1: FUEGO NARANJA (1 a 9 tareas) ---
        container.classList.remove('super-fire'); // Quitamos el azul si venía de ahí
        container.classList.add('on-fire');       // Ponemos el naranja
        
        fireImg.src = 'fuego_naranja.gif';       // Cambiamos la imagen al GIF naranja
        fireImg.style.display = 'block';         // Mostramos la imagen
        countText.style.color = "#747272";         // Texto blanco
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

const openTaskSheetBtn = document.getElementById('openTaskSheetBtn');
if (openTaskSheetBtn) {
    openTaskSheetBtn.addEventListener('click', () => {
        openTaskSheet(null); // Abrir en modo "Nueva Tarea"
    });
}







/// 1. Buscamos todos los botones del menú inferior
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetView = btn.dataset.view;

        // 2. Quitamos el estado activo de los otros y lo ponemos en este
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 3. Ocultamos todas las secciones y mostramos la que toca
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        document.getElementById(targetView).style.display = 'block';

        
        const fabTask = document.getElementById('openTaskSheetBtn');
        const fabNote = document.getElementById('openNoteEditorBtn');
        // Solo mostrar el botón + de tareas en la vista 'Hoy'
        if (fabTask) fabTask.style.display = (targetView === 'view-today') ? 'flex' : 'none';
        
        // Solo mostrar el botón + de notas en la vista 'Notas'
        if (fabNote) fabNote.style.display = (targetView === 'view-notes') ? 'flex' : 'none';


        // --- RECUPERAMOS EL BOTÓN FLOTANTE ---
        const fab = document.getElementById('openNoteEditorBtn');
        if (fab) {
            fab.style.display = (targetView === 'view-notes') ? 'flex' : 'none';
        }

        // 4. ¡AQUÍ ESTÁ EL TRUCO! 
        // Solo si el usuario tocó el botón de perfil, cargamos las estadísticas
        if (targetView === 'view-profile') {
            renderStats();
            checkSystemHealth(); 
        }
    });
});

const saveTaskBtn = document.getElementById('saveTaskBtn');
if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', saveTaskFromSheet);
}

    function renderStats() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    
    // 1. Contadores básicos
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length + reminders.length;
    
    document.getElementById('total-completed').innerText = completed;
    document.getElementById('active-tasks').innerText = pending;

    // 2. Cálculo por categoría (usando los emojis)
    const categoryCount = {};
    tasks.concat(reminders).forEach(item => {
        const cat = item.emoji || '📝';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    // 3. Renderizar barras
    const container = document.getElementById('category-bars-container');
    container.innerHTML = '';
    
    const totalItems = tasks.length + reminders.length;

    Object.entries(categoryCount).forEach(([emoji, count]) => {
        const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
        
        container.innerHTML += `
            <div class="cat-stat-item">
                <div class="cat-info">
                    <span>${emoji}</span>
                    <span>${count} items</span>
                </div>
                <div class="cat-bar-bg">
                    <div class="cat-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
}












// ==========================================
// LÓGICA DE GESTOS TÁCTILES (SWIPE)
// ==========================================


function attachLongPressEvents() {
    const cards = document.querySelectorAll('.reminder-card');

    cards.forEach(card => {
        // CORRECCIÓN: Si ya tiene eventos, no se los volvemos a poner
        if (card.classList.contains('long-press-active')) return;
        card.classList.add('long-press-active');

        let timer;
        let isLongPress = false;
        let startY = 0; // Guardamos dónde empezó el toque verticalmente
        let hasMoved = false; // Flag para saber si hubo movimiento

        card.addEventListener('touchstart', (e) => {
            isLongPress = false;
            hasMoved = false;
            startY = e.touches[0].clientY; // Registramos la posición inicial Y
            
            card.classList.add('pressing');
            
            timer = setTimeout(() => {
                isLongPress = true;
                showActionMenu(card);
                card.classList.remove('pressing');
            }, 600); 
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            // Si el dedo se mueve más de 10 píxeles, es un scroll
            if (Math.abs(currentY - startY) > 10) {
                hasMoved = true;
                clearTimeout(timer); // Cancelamos el menú de borrar
                card.classList.remove('pressing'); // Quitamos el efecto visual
            }
        }, { passive: true });

        card.addEventListener('touchend', () => {
            clearTimeout(timer);
            card.classList.remove('pressing');
            
            // SOLO abrimos la nota si:
            // 1. No fue una pulsación larga
            // 2. ¡Y NO HUBO MOVIMIENTO de scroll!
            if (!isLongPress && !hasMoved) {
                const id = parseInt(card.dataset.id);
                const key = card.dataset.key;
                
                if (key === 'notes') {
                    openEditNote(id);
                }
            }
        });
    });
}

function showActionMenu(card) {
    selectedTaskData = {
        id: parseInt(card.dataset.id),
        key: card.dataset.key,
        text: card.dataset.text
    };
    const id = parseInt(card.dataset.id);
    const key = card.dataset.key;
    let text = card.dataset.text;

    // CORRECCIÓN: Si es una nota, buscamos el contenido real en la base de datos
    // porque el atributo data-text puede no estar presente o estar incompleto.
    if (key === 'notes') {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const note = notes.find(n => n.id === id);
        if (note) text = note.content; 
    }

    selectedTaskData = { id, key, text };
    document.getElementById('actionMenu').classList.add('active');
}

// Botones del menú
document.getElementById('menuCancelBtn').onclick = () => {
    document.getElementById('actionMenu').classList.remove('active');
};

document.getElementById('menuDeleteBtn').onclick = () => {
    if (selectedTaskData) {
        // 1. Buscamos la tarjeta física en la pantalla por su ID
        const cardToAnimate = document.querySelector(`.reminder-card[data-id="${selectedTaskData.id}"]`);
        
        if (cardToAnimate) {
            // 2. Activamos la animación de salida
            cardToAnimate.classList.add('removing');
            
            // 3. Cerramos el menú
            document.getElementById('actionMenu').classList.remove('active');

            // 4. Esperamos a que termine la animación (400ms) para borrarla de verdad
            setTimeout(() => {
                deleteItem(selectedTaskData.key, selectedTaskData.id);
            }, 400);
        } else {
            // Si por algo no la encuentra, borramos normal
            deleteItem(selectedTaskData.key, selectedTaskData.id);
            document.getElementById('actionMenu').classList.remove('active');
        }
    }
};
document.getElementById('menuEditBtn').onclick = () => {
    if (selectedTaskData) {
        editItem(selectedTaskData.key, selectedTaskData.id, selectedTaskData.text);
        // Si es una NOTA, abrimos el editor de notas grande
        if (selectedTaskData.key === 'notes') {
            openEditNote(selectedTaskData.id);
        } else {
            // Si es una TAREA, usamos la edición simple en la barra inferior
            editItem(selectedTaskData.key, selectedTaskData.id, selectedTaskData.text);
        }
        document.getElementById('actionMenu').classList.remove('active');
    }
};
// Función para cargar la tarea en el cuadro de texto y activarla
window.editItem = (key, id, text) => {
    editId = id; // Guardamos el ID que estamos editando globalmente
    editKey = key; // Guardamos si es task o reminder
    
    
    // Mandamos el texto al input principal
    const input = document.getElementById('taskInputToday');
    if (input) {
        input.value = text;
        input.focus();
    }
    
    renderAll(); // Refresca para que la tarjeta vuelva a su lugar si cancelamos la edición
};
// Botón Copiar


document.getElementById('menuCopyBtn').onclick = () => {
    if (selectedTaskData) {
        // Copiar el texto al portapapeles nativo
        navigator.clipboard.writeText(selectedTaskData.text).then(() => {
            showCopyToast(); // Mostrar el círculo abajo
        });
        
        // Cerrar el menú de opciones
        document.getElementById('actionMenu').classList.remove('active');
    }
};
function showCopyToast() {
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.innerHTML = '<span>📋</span>Copiado';
        document.body.appendChild(toast);
    }
    
    // Pequeño truco para reiniciar la animación si se pulsa varias veces
    toast.classList.remove('show');
    void toast.offsetWidth; // Forzar redibujado
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

function renderNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const container = document.getElementById('notesList');
    if (!container) return;

    // 1. Mensaje de "No hay notas" con el nuevo estilo
    if (notes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🗒️</span>
                <p>No tienes notas guardadas.</p>
            </div>`;
        return;
    }

    // 2. Renderizado Compacto: Emoji al lado del texto
    container.innerHTML = notes.map(n => `
       <div class="note-card reminder-card" 
            data-id="${n.id}" 
            data-key="notes" 
            data-text="${n.content.replace(/"/g, '&quot;')}"
            onclick="window.openEditNote(${n.id})"> <div class="card-info" style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 18px;"></span> <div style="display: flex; flex-direction: column; overflow: hidden;">
                <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${n.title || 'Sin título'}
                </div>
                <div class="task-text-content" style="font-size: 12px; opacity: 0.7;">
                    ${n.content}
                </div>
            </div>
        </div>
    </div>
    `).join('');

    attachLongPressEvents(); 
}

// 1. Función para abrir el panel
function openTaskSheet(id = null) {
    const sheet = document.getElementById('taskBottomSheet');
    const input = document.getElementById('sheetTaskInput');
    const label = document.getElementById('sheetCategoryLabel');
    const fabTask = document.getElementById('openTaskSheetBtn'); // El botón + verde
    
    if (id) {
        // Modo edición
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        currentEditingTaskId = id;
        input.value = task.text;
        label.innerText = task.emoji || '📝';
    } else {
        // Modo creación
        currentEditingTaskId = null;
        input.value = '';
        label.innerText = selectedEmoji || '📝';
    }
    document.body.classList.add('stop-scrolling');
    document.body.style.overflow = 'hidden';
    input.focus();

   
    sheet.classList.add('active'); // Esto dispara la transición CSS
   
    
    setTimeout(() => document.getElementById('sheetTaskInput').focus(), 300);
    
    // OCULTAR el botón + al abrir
    if (fabTask) fabTask.style.display = 'none';

   
}
// Vincular el nuevo botón flotante de tareas
document.getElementById('openTaskSheetBtn').addEventListener('click', () => openTaskSheet());


function saveTaskFromSheet() {
    const newText = document.getElementById('sheetTaskInput').value.trim();
    const fabTask = document.getElementById('openTaskSheetBtn'); // El botón + verde
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    
    if (newText) {
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        if (currentEditingTaskId) {
            tasks = tasks.map(t => t.id === currentEditingTaskId ? { ...t, text: newText } : t);
        } else {
            let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
            localStorage.setItem('totalCreatedToday', total + 1);

            const taskDate = isCalendarView ? selectedCalendarDate : new Date().toLocaleDateString('es-ES');
            
            tasks.push({ 
                id: Date.now(), 
                text: newText, 
                emoji: selectedEmoji, 
                completed: false,
                date: taskDate // Nueva propiedad de fecha
            });
        }
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
    
    document.getElementById('taskBottomSheet').classList.remove('active');
    document.body.classList.remove('stop-scrolling');
    document.body.style.overflow = 'auto';
    
    
    // MOSTRAR el botón + de nuevo al cerrar (si estamos en la vista de hoy)
    const currentView = document.querySelector('.nav-item.active').dataset.view;
    if (fabTask && currentView === 'view-today') {
        fabTask.style.display = 'flex';
    }
    
    
    renderAll();
    if (isCalendarView) {
        renderCalendar(); // Actualiza los puntitos del calendario
        renderCalendarTasks(selectedCalendarDate); // Actualiza la lista de tareas abajo
    }
   
}

// 3. Vincular los eventos de los botones (Pon esto donde tengas tus otros listeners)

// Asegúrate de que el botón de volver también cierre correctamente
document.getElementById('closeSheetBtn').onclick = saveTaskFromSheet;

const initialHeight = window.innerHeight;

window.addEventListener('resize', () => {
    const bottomNav = document.querySelector('.bottom-nav');
    const currentHeight = window.innerHeight;

    if (currentHeight < initialHeight * 0.8) {
        // El teclado está abierto (la pantalla se redujo más de un 20%)
        bottomNav.style.visibility = 'hidden';
        bottomNav.style.opacity = '0';
    } else {
        // El teclado se cerró
        bottomNav.style.visibility = 'visible';
        bottomNav.style.opacity = '1';
    }
});



document.getElementById('taskSearchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // Filtramos las tareas que coincidan con el texto
    const filtered = allTasks.filter(t => t.text.toLowerCase().includes(term));
    
    // Dibujamos solo las filtradas
    const pending = filtered.filter(t => !t.completed);
    drawTasks(pending, 'taskList', false, 'tasks');
});
document.getElementById('addNewCategoryBtn').onclick = () => {
    const name = prompt("Nombre de la categoría (ej: 📚 Estudios):");
    if (name) {
        const container = document.querySelector('.filter-container');
        const btn = document.createElement('button');
        btn.className = 'filter-chip';
        btn.dataset.filter = name;
        btn.innerText = name;
        
        // Le damos funcionalidad al nuevo botón
        btn.onclick = () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = name;
            selectedEmoji = name;
            renderAll();
        };
        
        container.appendChild(btn);
    }
};
let selectedCalendarDate = new Date().toLocaleDateString();
let calendarDate = new Date(); // Esta es la variable que faltaba crear

// --- C. LÓGICA DEL CALENDARIO ---
document.getElementById('openCalendarBtn').onclick = () => {
    document.getElementById('view-today').style.display = 'none';
    document.getElementById('view-calendar').style.display = 'block';
    renderCalendar();
};

document.getElementById('closeCalendarBtn').onclick = () => {
    document.getElementById('view-calendar').style.display = 'none';
    document.getElementById('view-today').style.display = 'block';
};

// Funciones para cambiar de mes
document.getElementById('prevMonth').onclick = () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('nextMonth').onclick = () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
};

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const monthYearText = document.getElementById('currentMonthYear');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    container.innerHTML = '';

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    monthYearText.innerText = calendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Espacios vacíos
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        container.innerHTML += '<div></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${day}/${month + 1}/${year}`;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = day;
        
        // 1. MARCADOR: Si este día tiene tareas, añadimos el puntito visual
        const hasTasks = tasks.some(t => t.date === dateKey);
        if (hasTasks) dayDiv.classList.add('has-tasks');

        // 2. SELECCIÓN: Resaltar el día que estamos viendo
        if (dateKey === selectedCalendarDate) dayDiv.classList.add('active');

        dayDiv.onclick = () => {
            selectedCalendarDate = dateKey; // Actualizamos la fecha seleccionada
            renderCalendar(); // Refresca los estilos (clase active)
            renderCalendarTasks(dateKey); // Carga las tareas de ese día
        };
        container.appendChild(dayDiv);
    }
}

// Función para dibujar las tareas de un día específico en el calendario
function renderCalendarTasks(date) {
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const tasksForDay = allTasks.filter(t => t.date === date);
    
    // Usamos tu función drawTasks ya existente para mantener el diseño
    drawTasks(tasksForDay, 'calendarTaskList', false, 'tasks');
    
    // Actualizamos el subtítulo
    document.getElementById('selectedDateTitle').innerText = `Tareas para el ${date}`;
}
