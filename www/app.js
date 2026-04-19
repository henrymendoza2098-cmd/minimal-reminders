// 1. VARIABLES GLOBALES Y ESTADO

let isSelectionMode = false;
let selectedItems = new Set(); // Guardará strings con formato "tipo-id"
let taskViewMode = 'today'; // 'today' or 'all'

let editId = null; 
let selectedEmoji = "📝"; 
let currentEditingAlarmId = null;
let habitHistory = JSON.parse(localStorage.getItem('habitHistory') || '{}');
window.isCreatingNewHabit = false;
// Variable global para el filtro actual
let currentFilter = 'all';
const noteInput = document.getElementById('noteInput');
const addNoteBtn = document.getElementById('addNoteBtn');
let currentNotePhotos = []; // Array temporal para la nota actual
// Variable global para saber si estamos editando una nota existente
let currentEditingNoteId = null;
let selectedTaskData = null; // Guardará la info de la tarea presionada
let currentNoteFilter = 'all';
let noteImages = []; // Array temporal para fotos de la nota actual
// Botones de navegación de notas
const openNoteEditorBtn = document.getElementById('openNoteEditorBtn');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
window.currentFocusedCategory = null;
// Reemplaza la línea 24 de app.js
const getTodayStr = () => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
};
const getTomorrowStr = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = tomorrow.getDate().toString().padStart(2, '0');
    const m = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const y = tomorrow.getFullYear();
    return `${d}/${m}/${y}`;
};

let currentTaskIsPopup = false;
let currentTaskPopupDate = '';
let currentTaskPopupTime = '';
let activePopupTaskId = null;

let showCompleted = false;
let currentEditingTaskId = null;
let currentEditingTaskKey = 'tasks'; // Nueva variable para saber qué lista editamos
// Función que verifica si una fecha es anterior a hoy
const wrapper = document.getElementById('taskSearchWrapper');
const btnJava = document.getElementById('taskSearchInputt');
const inputField = document.getElementById('taskSearchInput');

let currentTaskImportance = 'none';
let currentTaskCategory = 'all';
let currentTaskTime = '';

// Función matemática para crear un ID de 32 bits seguro para Android
function generateSafeId(baseId, timeIdx, dayIdx) {
    let str = `${baseId}-${timeIdx}-${dayIdx}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) || 1;
}

window.getNotificationIdsForAlarm = function(alarm) {
    const ids = [];
    if (alarm.times) {
        alarm.times.forEach((t, tIdx) => {
            for (let i = 1; i <= 7; i++) {
                ids.push(generateSafeId(alarm.id, tIdx, i));
            }
        });
    } else {
        for (let i = 1; i <= 7; i++) {
            ids.push(generateSafeId(alarm.id, 0, i));
        }
    }
    return ids;
};

window.scheduleNotificationsForAlarm = async function(alarm) {
    if (!Notifications) return;
    
    // Cancelar todas las viejas por si se modificó
    const allPossibleIds = window.getNotificationIdsForAlarm(alarm);
    await Notifications.cancel({ notifications: allPossibleIds.map(id => ({ id })) });
    
    if (!alarm.enabled) return;
    
    const newNotifications = [];
    const weekdayMap = [2, 3, 4, 5, 6, 7, 1]; // Android usa 1=Domingo, 2=Lunes... Nuestro UI: L=0

    let times = alarm.times;
    if (!times && alarm.time) times = [alarm.time]; // Compatibilidad con viejas

        // --- REPARACIÓN: Hábitos por intervalos que perdían los días ---
        if (!alarm.days && alarm.repeat) {
            alarm.days = [true, true, true, true, true, true, true];
        }

    (times || []).forEach((timeStr, tIdx) => {
        const timeParts = timeStr.split(':');
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);

        (alarm.days || []).forEach((isDayActive, dayIndex) => {
            if (isDayActive) {
                const weekday = weekdayMap[dayIndex];
                const notificationId = generateSafeId(alarm.id, tIdx, weekday);
                newNotifications.push({
                    id: notificationId,
                    title: (alarm.emoji || '🔔') + " " + alarm.text,
                    body: alarm.message || "Recordatorio de hábito",
                        schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
                    importance: 5,
                    sound: 'res://platform_default',
                    actionTypeId: 'REMINDER_ACTIONS',
                    extra: { reminderId: alarm.id }
                });
            }
        });
    });

    if (newNotifications.length > 0) {
        await Notifications.schedule({ notifications: newNotifications });
    }
};

// Al inicio de app.js, la fecha seleccionada por defecto es hoy. Esta es la fuente de verdad.
let selectedViewDate = getTodayStr();
let calendarDate = new Date(); // Esta es la variable que faltaba crear

function toggleTaskView() {
    const isTodayView = selectedViewDate === getTodayStr();
    if (!isTodayView) {
        taskViewMode = 'today';
        selectedViewDate = getTodayStr(); // Atajo directo a hoy
        const parts = selectedViewDate.split('/');
        calendarDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else if (taskViewMode === 'today') {
        taskViewMode = 'all';
    } else {
        taskViewMode = 'today';
    }
    renderAll();
}
// Categorías iniciales que siempre aparecerán

// Categorías iniciales que siempre aparecerán
const defaultCategories = [
    { name: 'Todas', filter: 'all', icon: '🏠' },
    { name: 'General', filter: '📝', icon: '📝' },
    { name: 'Redes', filter: '🌐', icon: '🌐' },
    { name: 'BD', filter: '🗄️', icon: '🗄️' },
    { name: 'Física', filter: '⚛️', icon: '⚛️' },
    { name: 'Código', filter: '💻', icon: '💻' },
    { name: 'Ocio', filter: '🎮', icon: '🎮' }
];

// Cargamos las que Henry haya creado manualmente
let customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
function renderCategoryChips() {
    const container = document.querySelector('.filter-container');
    if (!container) return;

    // Guardamos el estado para que no se cierre bruscamente si acabamos de añadir una
    const isExpanded = container.classList.contains('expanded');

    container.innerHTML = ''; 

    // Categorías base (No se pueden borrar)
    const defaultCategories = [
        { name: 'Todas', filter: 'all', icon: '🏠' },
        { name: 'General', filter: '📝', icon: '📝' },
        { name: 'Código', filter: '💻', icon: '💻' },
        { name: 'Ocio', filter: '🎮', icon: '🎮' }
    ];

    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
    const allCategories = [...defaultCategories, ...customCategories];

    // --- NUEVO: Cambiar el color de los tres puntitos si hay una categoría filtrada ---
    const moreBtn = document.getElementById('moreOptionsBtn');
    if (moreBtn) {
        moreBtn.style.color = (currentFilter !== 'all') ? 'var(--accent)' : '';
    }

    // --- NUEVO: Mostrar la categoría activa al lado del botón + ---
    const addBtnIcon = document.getElementById('addNewCategoryBtn');
    if (addBtnIcon) {
        let labelSpan = document.getElementById('activeCategoryLabel');
        
        // Si no existe el texto al lado del botón, lo creamos
        if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.id = 'activeCategoryLabel';
            labelSpan.style.marginLeft = '10px';
            labelSpan.style.fontWeight = '600';
            labelSpan.style.fontSize = '16px';
            labelSpan.style.color = 'var(--text-main)';
            addBtnIcon.parentNode.insertBefore(labelSpan, addBtnIcon.nextSibling);
        }
        
        // Buscamos la información de la categoría activa actual
        const activeCat = allCategories.find(c => c.filter === currentFilter) || defaultCategories[0];
        labelSpan.innerText = `${activeCat.icon} ${activeCat.name}`;
    }

    allCategories.forEach((cat, index) => {
        const btn = document.createElement('button');
        const isActive = currentFilter === cat.filter;
        btn.className = `filter-chip ${isActive ? 'active' : ''}`;
        
        btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                ${cat.icon} ${cat.name}
            </div>
            ${isActive ? '<span style="font-weight: bold; font-size: 16px;">✓</span>' : ''}
        `;
        btn.dataset.filter = cat.filter;

        // Clic normal: Filtrar
        btn.onclick = () => {
            currentFilter = cat.filter;
            selectedEmoji = cat.filter === 'all' ? '📝' : cat.filter;
            
            // Ocultar la lista al elegir una categoría y restaurar el icono +
            container.classList.remove('expanded');
            const addBtnIcon = document.getElementById('addNewCategoryBtn');
            if (addBtnIcon) {
                addBtnIcon.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                addBtnIcon.style.transform = 'rotate(0deg)';
            }
            
            renderCategoryChips();
            renderAll();
            
            // Devolver el foco al input para que sigas escribiendo rápido
            const inputHoy = document.getElementById('taskInputToday');
            if (inputHoy) inputHoy.focus();
        };

        // Pulsación larga: Solo para las categorías personalizadas
        // Sabemos que es personalizada si su índice es mayor que el de las default
        if (index >= defaultCategories.length) {
            let timer;
            btn.ontouchstart = () => {
                timer = setTimeout(() => {
                    confirmarBorradoCategoria(cat.name, index - defaultCategories.length);
                }, 800); // 800ms para activar
            };
            btn.ontouchend = () => clearTimeout(timer);
        }

        container.appendChild(btn);
    });

    // Añadir el botón de "Crear nueva categoría" al final de la lista vertical
    const addCatBtn = document.createElement('button');
    addCatBtn.className = 'filter-chip';
    addCatBtn.style.justifyContent = 'center';
    addCatBtn.style.borderStyle = 'dashed';
    addCatBtn.innerHTML = `➕ Nueva Categoría...`;
    addCatBtn.onclick = () => {
        const name = prompt("Nombre de la categoría (ej: Estudios):");
        const emoji = prompt("Emoji para la categoría (ej: 📚):") || '📁';
        
        if (name) {
            const newCat = { name: name, filter: emoji, icon: emoji };
            customCategories.push(newCat);
            localStorage.setItem('customCategories', JSON.stringify(customCategories));
            renderCategoryChips();
            
            // Mantiene la lista abierta para ver la recién creada
            const newContainer = document.querySelector('.filter-container');
            if (newContainer) newContainer.classList.add('expanded');
        }
    };
    container.appendChild(addCatBtn);

    if (isExpanded) {
        container.classList.add('expanded');
    }
}
renderCategoryChips();
function confirmarBorradoCategoria(nombre, indexEnCustom) {
    if (confirm(`¿Quieres eliminar la categoría "${nombre}"?`)) {
        let customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
        
        // Eliminamos del arreglo usando el índice
        customCategories.splice(indexEnCustom, 1);
        
        // Guardamos y refrescamos
        localStorage.setItem('customCategories', JSON.stringify(customCategories));
        
        // Si la categoría borrada era la activa, volvemos a "Todas"
        currentFilter = 'all';
        selectedEmoji = '📝';
        
        renderCategoryChips();
        renderAll();
    }
}




function isOverdue(dateStr) {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const taskDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignorar la hora, solo comparar día
    return taskDate < today;
}




const getLocalNotifications = () => {
    return (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) 
           ? Capacitor.Plugins.LocalNotifications 
           : null;
};
const Notifications = getLocalNotifications();

async function syncNotificationsWithStorage() {
    if (!Notifications) return;

    try {
        // 1. Obtenemos las notificaciones que Android tiene programadas
        const pendingReqs = await Notifications.getPending();
        const pendingList = pendingReqs.notifications;

        // 2. Obtenemos nuestros recordatorios actuales
        const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        const reminderIds = reminders.map(r => parseInt(r.id));

        // 3. Comparamos: Si la alarma de Android no está en nuestra lista, se cancela
        pendingList.forEach(notif => {
            if (!reminderIds.includes(notif.id)) {
                Notifications.cancel({ notifications: [{ id: notif.id }] });
                console.log(`Sincronización: Alarma fantasma ${notif.id} eliminada.`);
            }
        });
    } catch (error) {
        console.error("Error en la sincronización de notificaciones:", error);
    }
}
// 1. Registrar los tipos de acciones
document.getElementById('toggleCompletedBtn').addEventListener('click', () => {
    showCompleted = !showCompleted;
    const container = document.getElementById('completedTaskList');
    container.style.display = showCompleted ? 'block' : 'none';
});
openNoteEditorBtn.addEventListener('click', () => {
    currentEditingNoteId = null;
    currentNotePhotos = []; 
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteInput').value = '';
    document.getElementById('noteInput').style.height = 'auto'; // Resetear altura al crear nueva

    document.getElementById('noteInput').style.display = 'block';
    if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'flex';

    if (document.getElementById('notePhotosPreview')) {
        document.getElementById('notePhotosPreview').innerHTML = '';
    }
    
    const wrapper = document.getElementById('canvasWrapper');
    if (wrapper) wrapper.style.display = 'none';
    if (typeof clearCanvas === 'function') clearCanvas(); // Limpiar el lienzo para la nota nueva
    
    // NUEVO: Preseleccionar categoría si estamos dentro de una
    const catSelect = document.getElementById('noteCategorySelect');
    if (catSelect) {
        if (window.currentFocusedCategory) {
            catSelect.value = window.currentFocusedCategory;
        } else {
            catSelect.value = 'General';
        }
        catSelect.dispatchEvent(new Event('change'));
    }

    switchNoteView('view-notes-editor');
});

// Auto-expandir el textarea a medida que se escribe
if (noteInput) {
    noteInput.addEventListener('input', function() {
        this.style.height = 'auto'; // Resetea para poder encogerse si se borra texto
        this.style.height = (this.scrollHeight) + 'px'; // Crece según el contenido
    });
}

// Auto-expandir el textarea de Tareas a medida que se escribe
const sheetTaskInput = document.getElementById('sheetTaskInput');
if (sheetTaskInput) {
    sheetTaskInput.addEventListener('input', function() {
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight) + 'px'; 
    });
}

// Gestos para el panel de tareas (Deslizar hacia arriba/abajo)
const taskSheetContent = document.querySelector('.sheet-content');
if (taskSheetContent) {
    let taskSheetStartY = 0;
    
    taskSheetContent.addEventListener('touchstart', (e) => {
        taskSheetStartY = e.touches[0].clientY;
    }, { passive: true });

    taskSheetContent.addEventListener('touchend', (e) => {
        if (!taskSheetStartY) return;
        const diffY = e.changedTouches[0].clientY - taskSheetStartY;
        const sheet = document.getElementById('taskBottomSheet');
        
        if (diffY < -40) {
            // Deslizar Arriba: Pantalla completa
            if (!sheet.classList.contains('full-height')) sheet.classList.add('full-height');
        } else if (diffY > 50) {
            // Deslizar Abajo: Reducir o Guardar
            if (taskSheetContent.scrollTop > 0) return; // Permite el scroll normal de lectura si hay mucho texto
            
            if (sheet.classList.contains('full-height')) {
                sheet.classList.remove('full-height');
            } else {
                saveTaskFromSheet(); // Si ya estaba pequeña, guarda y cierra
            }
        }
        taskSheetStartY = 0;
    });
}



if (typeof Capacitor !== 'undefined') {
    const { App } = Capacitor.Plugins;

    if (App) {
        App.addListener('backButton', () => {
            const editor = document.getElementById('view-notes-editor');
            const sideMenu = document.getElementById('sideMenu');
            const imageViewer = document.getElementById('imageViewerModal');
            const habitDetail = document.getElementById('view-habit-detail');
            const calendar = document.getElementById('view-calendar');
            const organize = document.getElementById('view-organize');
            const history = document.getElementById('view-history');
            const categoryNotes = document.getElementById('view-category-notes');

            // 1. Cerrar visor de imágenes
            if (imageViewer && imageViewer.classList.contains('active')) {
                if (typeof closeImageViewer === 'function') closeImageViewer();
            }
            else if (habitDetail && habitDetail.style.display === 'flex') {
                document.getElementById('closeHabitDetailBtn')?.click();
            } 
            // 2. Si el editor de notas está abierto (Autoguardado inteligente)
            else if (editor && (editor.style.display === 'block' || editor.style.display === 'flex' || editor.classList.contains('active'))) {
                const title = document.getElementById('noteTitleInput')?.value.trim();
                const content = document.getElementById('noteInput')?.value.trim();
                const wrapper = document.getElementById('canvasWrapper');
                const hasDrawing = wrapper && wrapper.style.display !== 'none';
                
                if (title || content || currentNotePhotos.length > 0 || hasDrawing) {
                    document.getElementById('addNoteBtn')?.click(); // Autoguarda y sale
                } else {
                    document.getElementById('cancelNoteBtn')?.click(); // Sale sin hacer nada
                }
            } 
            // 3. Cerrar menú lateral
            else if (sideMenu && sideMenu.classList.contains('active')) {
                document.getElementById('closeMenuBtn')?.click();
            } 
            // 4. Salir del calendario
            else if (calendar && calendar.style.display === 'block') {
                document.getElementById('closeCalendarBtn')?.click();
            } 
            // 5. Salir de Organizar Tareas
            else if (organize && organize.style.display === 'block') {
                document.getElementById('closeOrganizeBtn')?.click();
            } 
            // 6. Salir de Historial
            else if (history && history.style.display === 'flex') {
                document.getElementById('closeHistoryBtn')?.click();
            } 
            // 7. Salir de Categoría de Notas
            else if (categoryNotes && categoryNotes.classList.contains('active')) {
                if (typeof closeCategoryNotes === 'function') closeCategoryNotes();
            } else {
                App.exitApp(); // Si está en el inicio, sale de la app
            }
        });
    }
}

// Cancelar y volver a la lista
cancelNoteBtn.addEventListener('click', () => {
    if (window.currentFocusedCategory) {
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        const catView = document.getElementById('view-category-notes');
        catView.style.display = 'flex';
        catView.classList.add('active');
        const fabNote = document.getElementById('openNoteEditorBtn');
        if (fabNote) fabNote.style.display = 'flex';
    } else {
        switchNoteView('view-notes');
    }
});



// --- LÓGICA DE CATEGORÍAS DE NOTAS (CARRUSEL) ---
const defaultNoteCategories = [
    { name: 'Trabajo', color: '#54A3D6' },
    { name: 'Estudio', color: '#52BD94' },
    { name: 'Personal', color: '#F2994A' }
];

function getNotesCategories() {
    let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
    return [...defaultNoteCategories, ...custom];
}

window.renderNoteCategoriesCarousel = () => {
    const carousel = document.getElementById('notesCategoryCarousel');
    if (!carousel) return;
    
    const categories = getNotesCategories();
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    let html = '';
    
    categories.forEach(cat => {
        const catNotes = notes.filter(n => n.category === cat.name);
        const hasNotes = catNotes.length > 0;
        const firstLetter = cat.name.charAt(0).toUpperCase();
        const catColor = cat.color || 'var(--accent)';
        
        html += `
            <div class="note-category-card ${hasNotes ? 'has-notes' : ''}" onclick="openCategoryNotes('${cat.name}')" style="--cat-color: ${catColor};">
                <div class="note-category-icon-wrapper">
                    ${firstLetter}
                </div>
                <div class="note-category-name">${cat.name}</div>
            </div>
        `;
    });
    
    html += `
        <div class="note-category-card add-new" onclick="addNewNoteCategory()">
            <div class="note-category-icon-wrapper">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div class="note-category-name">Nueva</div>
        </div>
    `;
    
    carousel.innerHTML = html;
    updateNoteCategorySelect();
};

function updateNoteCategorySelect() {
    const select = document.getElementById('noteCategorySelect');
    if (!select) return;
    const categories = getNotesCategories();
    select.innerHTML = `
        <option value="General" data-icon="G" data-color="var(--accent)">G General</option>
        ${categories.map(c => {
            const firstLetter = c.name.charAt(0).toUpperCase();
            const catColor = c.color || 'var(--accent)';
            return `<option value="${c.name}" data-icon="${firstLetter}" data-color="${catColor}">${firstLetter} ${c.name}</option>`;
        }).join('')}
    `;
}

window.addNewNoteCategory = () => {
    const name = prompt("Nombre de la nueva categoría:");
    if (!name) return;
    
    let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
    if (!custom.some(c => c.name === name) && !defaultNoteCategories.some(c => c.name === name)) {
        // Creamos temporalmente la categoría para que el usuario la vea rápido
        const newCat = { name, color: '#54A3D6' };
        custom.push(newCat);
        localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
        renderNoteCategoriesCarousel();
        
        // Inmediatamente después, abrimos el selector de color nativo del dispositivo
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#54A3D6';
        colorInput.style.position = 'absolute';
        colorInput.style.opacity = '0';
        document.body.appendChild(colorInput);

        colorInput.addEventListener('input', (e) => {
            newCat.color = e.target.value;
            localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
            renderNoteCategoriesCarousel();
        });

        colorInput.addEventListener('change', () => {
            document.body.removeChild(colorInput);
        });

        colorInput.click();
    } else {
        alert("La categoría ya existe.");
    }
};

// Función para pedir permiso al arrancar la app
// 1.5 VERIFICACIÓN DE CAPACITOR (No rompe el código si falla)











// --- FUNCIÓN PARA ADJUNTAR FOTO ---
document.getElementById('addPhotoBtn').onclick = async () => {
    if (typeof Capacitor === 'undefined') return alert("Cámara solo disponible en el celular.");

    try {
        const image = await Capacitor.Plugins.Camera.getPhoto({
            quality: 50, // Calidad media para no llenar el almacenamiento
            resultType: 'base64',
            source: 'PROMPT' // Permite elegir entre Cámara o Galería
        });

        const base64Image = `data:image/jpeg;base64,${image.base64String}`;
        currentNotePhotos.push(base64Image);
        renderEditorPhotos();
    } catch (error) {
        console.log("Cámara cancelada o error:", error);
    }
};

function renderEditorPhotos() {
    const preview = document.getElementById('notePhotosPreview');
    preview.style.flexDirection = 'column'; // Asegura que las fotos se apilen verticalmente
    preview.style.gap = '15px'; // Espacio entre múltiples fotos
    preview.innerHTML = currentNotePhotos.map((src, index) => `
        <div style="position: relative; width: 100%;">
            <img src="${src}" onclick="openImageViewer(this.src)" style="width: 100%; height: auto; object-fit: cover; border-radius: 12px; cursor: pointer; display: block;">
            <button onclick="removePhoto(${index})" style="position: absolute; top: 10px; right: 10px; background: rgba(235, 87, 87, 0.9); color: white; border-radius: 50%; border: none; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">×</button>
        </div>
    `).join('');
}

window.removePhoto = (index) => {
    currentNotePhotos.splice(index, 1);
    renderEditorPhotos();
};

// 3. GUARDAR NOTA (Corregido: ahora guarda el dibujo también al editar)
document.getElementById('addNoteBtn').addEventListener('click', () => {
    const title = document.getElementById('noteTitleInput').value.trim();
    const content = document.getElementById('noteInput').value.trim();
    const category = document.getElementById('noteCategorySelect')?.value || 'General';
    
    // Usar noteCanvas y guardar solo si está visible
    let drawingData = null;
    const wrapper = document.getElementById('canvasWrapper');
    if (wrapper && wrapper.style.display !== 'none' && typeof noteCanvas !== 'undefined') {
        drawingData = noteCanvas.toDataURL(); 
    }
    
    if (!title && !content && !drawingData && currentNotePhotos.length === 0) return;

    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (currentEditingNoteId) {
        const oldNote = notes.find(n => n.id === currentEditingNoteId) || {};
        const finalDrawing = (wrapper && wrapper.style.display !== 'none') ? drawingData : oldNote.drawing;

        notes = notes.map(n => n.id === currentEditingNoteId ? 
            { ...n, title, content, category, images: currentNotePhotos, drawing: finalDrawing, updatedAt: dateStr } : n);
    } else {
        notes.push({ 
            id: Date.now(), 
            title: title || 'Sin título', 
            content, 
            category,
            images: currentNotePhotos,
            drawing: drawingData,
            createdAt: dateStr,
            updatedAt: dateStr
        });
    }
    
    localStorage.setItem('notes', JSON.stringify(notes));
    
    currentNotePhotos = [];
    if (window.currentFocusedCategory) {
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        const catView = document.getElementById('view-category-notes');
        catView.style.display = 'flex';
        catView.classList.add('active');
        const fabNote = document.getElementById('openNoteEditorBtn');
        if (fabNote) fabNote.style.display = 'flex';
        renderNoteCategoriesCarousel();
        renderCategoryNotesList(window.currentFocusedCategory);
    } else {
        switchNoteView('view-notes'); 
        renderNoteCategoriesCarousel();
        renderNotes(); 
    }
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


window.openEditNote = (id) => {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const note = notes.find(n => n.id === id);
    
    if (note) {
        currentEditingNoteId = id;
        document.getElementById('noteTitleInput').value = note.title || '';
        document.getElementById('noteInput').value = note.content || '';
        
        let dateDisplay = document.getElementById('noteDateDisplay');
        if (!dateDisplay) {
            dateDisplay = document.createElement('div');
            dateDisplay.id = 'noteDateDisplay';
            dateDisplay.style.fontSize = '12px';
            dateDisplay.style.color = 'var(--text-sub)';
            dateDisplay.style.margin = '5px 0 15px 5px';
            const titleInput = document.getElementById('noteTitleInput');
            if (titleInput && titleInput.parentNode) {
                titleInput.parentNode.insertBefore(dateDisplay, titleInput.nextSibling);
            }
        }
        
        if (dateDisplay) {
            let dateText = '';
            if (note.createdAt) dateText += `Creado: ${note.createdAt}`;
            if (note.updatedAt && note.updatedAt !== note.createdAt) {
                dateText += (dateText ? ' • ' : '') + `Editado: ${note.updatedAt}`;
            }
            dateDisplay.innerText = dateText;
        }

        // Cargar Imágenes
        currentNotePhotos = note.images || []; 
        renderEditorPhotos(); 
        
        // --- LÓGICA DE DIBUJO ---
        const wrapper = document.getElementById('canvasWrapper');
        if (note.drawing) {
            // Si hay dibujo, ocultamos el área de texto y fotos
            document.getElementById('noteInput').style.display = 'none';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'none';

            if (wrapper) wrapper.style.display = 'flex'; // Flex mantiene organizada la barra de herramientas
            const img = new Image();
            img.onload = () => {
                if (typeof initCanvas === 'function') initCanvas(); // Preparamos el lienzo
                // Damos un margen de seguridad para que el lienzo tome su tamaño antes de plasmar el dibujo
                setTimeout(() => { if (ctx) ctx.drawImage(img, 0, 0, img.width, img.height); }, 10);
            };
            img.src = note.drawing;
        } else {
            if (wrapper) wrapper.style.display = 'none';
            
            // Si no hay dibujo, mostramos el editor normal
            document.getElementById('noteInput').style.display = 'block';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'flex';
            if (typeof clearCanvas === 'function') clearCanvas(); // Si no hay dibujo, limpiamos el lienzo viejo
        }

        switchNoteView('view-notes-editor');
        
        // Ajustar el textarea al contenido existente después de mostrar la vista
        setTimeout(() => {
            const txtArea = document.getElementById('noteInput');
            if (txtArea) {
                txtArea.style.height = 'auto';
                txtArea.style.height = txtArea.scrollHeight + 'px';
            }
        }, 10);
    }
};




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
    syncNotificationsWithStorage();
    renderAll();
});
requestPermissions();

// Función para inicializar los eventos del teclado




// 3. Escuchar las acciones de la notificación

if (Notifications) {
    Notifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const reminderId = notificationAction.notification.extra.reminderId;
        const actionId = notificationAction.actionId;

        if (actionId === 'done') {
            const list = JSON.parse(localStorage.getItem('reminders') || '[]');
            const item = list.find(r => r.id === reminderId);
            
            if (item && !item.isHabit) {
                // SI LE DA A "HECHO" y es rápido: Borramos de la lista de recordatorios
                console.log("Tarea rápida marcada como hecha desde notificación");
                window.deleteItem('reminders', reminderId); 
            } else {
                console.log("Hábito recurrente marcado como hecho hoy, no se elimina.");
            }
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
    
    // --- AQUÍ ESTÁ EL TRUCO: Capturamos la hora de creación ---
    const ahora = new Date();
    const creadoEl = ahora.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });

    // Guardamos 'createdAt' en el objeto
    list.push({ 
        id: idUnico, 
        text, 
        time: fullTime, 
        emoji: "⏰", 
        notified: false,
        createdAt: creadoEl,
        isHabit: false // Las alarmas rápidas no son hábitos
    });
    
    localStorage.setItem('reminders', JSON.stringify(list));

    if (Notifications) {
        const fechaAlarma = new Date();
        fechaAlarma.setHours(horas, minutos, 0, 0);
        if (fechaAlarma < new Date()) fechaAlarma.setDate(fechaAlarma.getDate() + 1);

        try {
            await Notifications.schedule({
                notifications: [{
                    title: "🔔 " + text, 
                    body: "Recordatorio fijado a las " + fullTime,
                    id: idUnico,
                    schedule: { at: fechaAlarma, allowWhileIdle: true },
                    importance: 5,
                    sound: 'res://platform_default',
                    actionTypeId: 'REMINDER_ACTIONS',
                    extra: { reminderId: idUnico }
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
    updateMainTitle(); // Sincroniza el título y el botón superior al cambiar de día
    const todayView = document.getElementById('view-today');
    if (todayView && (todayView.style.display === 'block' || todayView.style.display === '')) {
        renderWeekView();
    }
    renderList('reminders', 'reminderList', true);
    renderList('tasks', 'taskList', false);
    renderNotes();
    renderNoteCategoriesCarousel();
    renderActiveHabitsWidget();
    updateProgress();
    updateComboUI();
    
    if (window.currentFocusedCategory) {
        if (typeof renderCategoryNotesList === 'function') renderCategoryNotesList(window.currentFocusedCategory);
    }
    
    if (typeof window.renderEnergySuggestion === 'function') window.renderEnergySuggestion();
}

function renderList(key, elementId, isAlarm) {
    let list = JSON.parse(localStorage.getItem(key) || '[]');

    const today = getTodayStr();

   
    
    // --- CORRECCIÓN: Aplicar el filtro de categoría ---
    if (key === 'tasks' && currentFilter !== 'all') {
        list = list.filter(item => item.emoji === currentFilter);
    }

    // Si son alarmas, usamos la nueva interfaz
    if (isAlarm) {
        drawAlarms(list, elementId);
        return;
    }

    // Si no son alarmas, filtramos por completadas/pendientes
    if (!isAlarm && key === 'tasks') {
        const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const mainTaskListContainer = document.getElementById('taskList');
        const pendingTitle = document.getElementById('pendingTasksTitle');
        const completedHeader = document.getElementById('completedTasksHeader');
        const completedContainer = document.getElementById('completedTaskList');

        // Parte 1: Manejar tareas completadas para la fecha seleccionada (esto no cambia)
        const completedForDate = allTasks.filter(t => t.completed && t.date === selectedViewDate);
        drawTasks(completedForDate, 'completedTaskList', true, key);
        if (completedHeader) completedHeader.style.display = completedForDate.length > 0 ? 'flex' : 'none';
        if (completedContainer) completedContainer.style.display = (completedForDate.length > 0 && showCompleted) ? 'block' : 'none';

        // Parte 2: Manejar tareas pendientes según el nuevo modo de vista
        let pendingHtml = '';
        let hasPendingTasks = false;
        

        const isTodayView = selectedViewDate === getTodayStr();

        if (taskViewMode === 'all' && isTodayView) {
            const overdue = allTasks.filter(t => !t.completed && t.date && isOverdue(t.date));
            const notOverdue = allTasks.filter(t => !t.completed && (!t.date || !isOverdue(t.date)));

             if (notOverdue.length > 0) {
                pendingHtml += '<h3 class="section-subtitle">Próximas / Hoy</h3>';
                pendingHtml += drawTasks(notOverdue, null, false, 'tasks');
                hasPendingTasks = true;
            }
            if (overdue.length > 0) {
                pendingHtml += '<h3 class="section-subtitle">Vencidas</h3>';
                pendingHtml += drawTasks(overdue, null, false, 'tasks');
                hasPendingTasks = true;
            }
            if (pendingTitle) pendingTitle.style.display = 'none'; // Usar títulos internos
        } else {
            // Comportamiento por defecto: mostrar solo tareas para la fecha seleccionada
            const pendingForDate = allTasks.filter(t => !t.completed && t.date === selectedViewDate);
            pendingHtml = drawTasks(pendingForDate, null, false, 'tasks');
            hasPendingTasks = pendingForDate.length > 0;
            if (pendingTitle) pendingTitle.style.display = (hasPendingTasks || completedForDate.length > 0) ? 'block' : 'none';
        }

        if (!hasPendingTasks) {
            if (pendingTitle) pendingTitle.style.display = 'none';
           drawTasks([], 'taskList', false, 'tasks'); // Devuelve el Empty State correctamente
        } else {
            mainTaskListContainer.innerHTML = pendingHtml;
        }

        attachGestureEvents();
        return;
    }
    drawTasks(list, elementId, isAlarm, key);
}

let currentAlarmTab = 'rapidos';
window.switchAlarmTab = (tab) => {
    currentAlarmTab = tab;
    const btnRapidos = document.getElementById('tabRapidosBtn');
    const btnFrecuentes = document.getElementById('tabFrecuentesBtn');
    if(btnRapidos && btnFrecuentes) {
        btnRapidos.classList.toggle('active-tab', tab === 'rapidos');
        btnFrecuentes.classList.toggle('active-tab', tab === 'frecuentes');
    }
    
    // Cambiar el título principal dinámicamente (con fallback seguro)
    const mainTitle = document.getElementById('remindersMainTitle') || document.querySelector('#view-reminders h2');
    if (mainTitle) {
        mainTitle.style.transition = 'opacity 0.15s ease';
        mainTitle.style.opacity = '0'; // Desvanece suavemente
        
        setTimeout(() => {
            mainTitle.innerText = tab === 'frecuentes' ? 'Hábitos' : 'Recordatorios';
            mainTitle.style.opacity = '1'; // Reaparece con el nuevo texto
        }, 150);
    }
    
    renderAll();
};

const PREDEFINED_HABITS = [
    { id: 'water', title: 'Tomar agua', icon: '💧', color: 'linear-gradient(135deg, #4A90E2 0%, #2C6EAF 100%)', message: 'Beber agua para mantenerte hidratado 🧴' },
    { id: 'sleep', title: 'Dormir temprano', icon: '😴', color: 'linear-gradient(135deg, #3D5A80 0%, #293241 100%)', message: 'Descansa lo suficiente para rendir al máximo mañana 🌙' },
    { id: 'eat', title: 'Comer sano', icon: '🥗', color: 'linear-gradient(135deg, #52BD94 0%, #2D6A4F 100%)', message: 'Alimenta tu cuerpo con nutrientes de calidad 🍎' },
    { id: 'clean', title: 'Limpiar', icon: '🧹', color: 'linear-gradient(135deg, #F2C94C 0%, #EE964B 100%)', message: 'Un espacio limpio es una mente clara ✨' },
    { id: 'cook', title: 'Cocinar', icon: '🍳', color: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)', message: 'Prepara algo delicioso y casero 🍽️' },
    { id: 'relax', title: 'Descansar', icon: '🧘', color: 'linear-gradient(135deg, #9B5DE5 0%, #6A4C93 100%)', message: 'Tómate un momento para respirar y relajarte 🍃' },
    { id: 'read', title: 'Leer', icon: '📖', color: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)', message: 'Alimenta tu mente con un buen libro 📚' },
    { id: 'exercise', title: 'Hacer ejercicio', icon: '🏃', color: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)', message: 'Mueve tu cuerpo y fortalece tu salud 💪' }
];

window.openHabitSelection = () => {
    const modal = document.getElementById('habitSelectionModal');
    const list = document.getElementById('habitSelectionList');
    list.innerHTML = PREDEFINED_HABITS.map(h => `
        <div class="habit-preset-card" style="background: ${h.color}" onclick="openHabitConfig('${h.id}')">
            <div class="habit-preset-icon">${h.icon}</div>
            <div class="habit-preset-title">${h.title}</div>
        </div>
    `).join('');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeHabitSelection = () => {
    const modal = document.getElementById('habitSelectionModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

let currentConfigHabit = null;
let currentConfigTimes = [];
let currentConfigDays = [true, true, true, true, true, true, true];

window.openHabitConfig = (habitId) => {
    currentConfigHabit = PREDEFINED_HABITS.find(h => h.id === habitId);
    if (!currentConfigHabit) return;
    currentConfigTimes = ['08:00'];
    currentConfigDays = [true, true, true, true, true, true, true];

    document.getElementById('hcHeaderBg').style.background = currentConfigHabit.color;
    document.getElementById('hcIcon').innerText = currentConfigHabit.icon;
    document.getElementById('hcTitle').innerText = currentConfigHabit.title;
    document.getElementById('hcMessage').innerText = currentConfigHabit.message;
    document.getElementById('hcInputName').value = currentConfigHabit.title;

    renderHcDays();
    renderHcTimes();
    
    const modal = document.getElementById('habitConfigModal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeHabitConfig = () => {
    const modal = document.getElementById('habitConfigModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

window.renderHcDays = () => {
    const daysContainer = document.getElementById('hcDaysContainer');
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    daysContainer.innerHTML = labels.map((l, i) => `<span class="habit-day ${currentConfigDays[i] ? 'active' : ''}" style="width: 32px; height: 32px; font-size: 14px;" onclick="toggleHcDay(${i})">${l}</span>`).join('');
};

window.toggleHcDay = (i) => { currentConfigDays[i] = !currentConfigDays[i]; renderHcDays(); };

window.renderHcTimes = () => {
    const container = document.getElementById('hcTimesList');
    container.innerHTML = currentConfigTimes.map((t, i) => `<div class="hc-time-chip"><span>${t}</span><button onclick="removeHcTime(${i})">✕</button></div>`).join('');
};

window.removeHcTime = (i) => { currentConfigTimes.splice(i, 1); renderHcTimes(); };

let isPickingTimeForHabit = false;
window.openCustomTimePickerForHabit = () => { isPickingTimeForHabit = true; openCustomTimePicker(); };

window.saveHabitConfig = () => {
    const name = document.getElementById('hcInputName').value.trim() || currentConfigHabit.title;
    if (currentConfigTimes.length === 0) return alert('Añade al menos una hora para tu hábito.');
    
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');

    // --- NUEVO: Prevenir duplicados ---
    const isDuplicate = list.some(h => h.isHabit && h.text.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        alert('Ya tienes un hábito activo con este nombre. ¡Sigue así!');
        return;
    }
    
    const newHabit = {
        id: Date.now(), text: name, message: currentConfigHabit.message, emoji: currentConfigHabit.icon, color: currentConfigHabit.color,
        isHabit: true, enabled: true, days: [...currentConfigDays], times: [...currentConfigTimes]
    };

    list.push(newHabit);
    localStorage.setItem('reminders', JSON.stringify(list));
    
    scheduleNotificationsForAlarm(newHabit);
    closeHabitConfig(); closeHabitSelection(); renderAll();
};

function drawAlarms(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;


    const filteredList = list.filter(item => currentAlarmTab === 'frecuentes' ? item.isHabit : !item.isHabit);

    let listHtml = '';
    if (filteredList.length === 0) {
        container.style.display = 'block';
        let msgTitle = currentAlarmTab === 'rapidos' ? 'Sin alarmas' : 'Sin hábitos';
        let msgSub = currentAlarmTab === 'rapidos' ? 'No tienes alarmas rápidas configuradas.' : 'No tienes hábitos frecuentes activos.';
        let svgIcon = currentAlarmTab === 'rapidos' 
            ? '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
            : '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>';
            
        listHtml = `
            <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                    ${svgIcon}
                </svg>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">${msgTitle}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">${msgSub}</p>
            </div>
        `;
    } else {
        if (currentAlarmTab === 'rapidos') {
            container.style.display = 'block';
            listHtml = filteredList.map((item, index) => {
                const timeParts = item.time ? item.time.split(':') : ['00', '00'];
                let hours = parseInt(timeParts[0]);
                const mins = timeParts[1] || '00';
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                const displayHours = hours.toString();
                const isSelected = typeof selectedItems !== 'undefined' && selectedItems.has(`reminders-${item.id}`);
                
                return `
                <div class="swipe-container" style="margin-bottom: 14px; border-bottom: none; animation-delay: ${index * 0.05}s;">
                    <div class="swipe-action" onclick="deleteItemWithAnimation(this, 'reminders', ${item.id})">
                        <div class="delete-icon"><span>🗑️</span>Borrar</div>
                    </div>
                    <div class="alarm-card rapid-card ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-key="reminders" onclick="handleItemClick(event, this, ${item.id}, 'reminders')">
                        <div class="alarm-info">
                            <div class="alarm-time">${displayHours}:${mins} <span class="alarm-ampm">${ampm}</span></div>
                            <div class="alarm-label">🔔 ${item.text}</div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(2, 1fr)';
            container.style.gap = '15px';
            container.style.paddingBottom = '15px';
            
            listHtml = filteredList.map((item, index) => {
                const isEnabled = item.enabled;
                
                const timesDisplay = item.times && item.times.length > 0 
                    ? item.times.map(t => {
                        let [h, m] = t.split(':');
                        let hInt = parseInt(h);
                        const ampm = hInt >= 12 ? 'PM' : 'AM';
                        return `${hInt % 12 || 12}:${m} ${ampm}`;
                    }).join(' • ')
                    : (item.time ? (() => {
                        let [h, m] = item.time.split(':');
                        let hInt = parseInt(h);
                        return `${hInt % 12 || 12}:${m} ${hInt >= 12 ? 'PM' : 'AM'}`;
                    })() : '');
                
                const colorClass = getHabitColorClass(item.emoji);
                const dynamicStyle = (isEnabled && item.color) ? `background: ${item.color};` : '';
                const activeClass = isEnabled && !item.color ? `active ${colorClass}` : (isEnabled ? 'active' : '');

                const alarmDays = item.days || [true, true, true, true, true, true, true];
                const daysHtml = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) =>
                    `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span class="habit-day-dot ${alarmDays[i] ? 'active' : ''}" onclick="event.stopPropagation(); toggleAlarmDay(${item.id}, ${i})"></span>
                        <span class="habit-day-text">${d}</span>
                    </div>`
                ).join('');

                return `
                <div class="habit-card-grid ${activeClass}" style="${dynamicStyle} animation-delay: ${index * 0.05}s;" data-id="${item.id}" data-key="reminders" onclick="toggleHabitState(${item.id})">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-start; margin-bottom: 12px;">
                        <div class="habit-icon-wrapper" style="width: 48px; height: 48px; font-size: 24px; border-radius: 15px;">${item.emoji || '📅'}</div>
                        <div class="modern-toggle" style="transform: scale(0.8); transform-origin: top right; margin: 0;"></div>
                    </div>
                    <div class="habit-title" style="font-size: 16px; margin-bottom: 8px; line-height: 1.25; flex-grow: 1; padding-right: 5px;">${item.text}</div>
                    <div class="habit-time" style="font-size: 11px; padding: 4px 10px; margin-bottom: 15px; width: fit-content; border-radius: 12px; font-weight: 700;">⏰ ${timesDisplay}</div>
                    <div class="habit-days-row" style="display: flex; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(150,150,150,0.15);">
                        ${daysHtml}
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    container.innerHTML = listHtml;
    // Volvemos a adjuntar los gestos a todas las tarjetas visibles
    attachGestureEvents();
}

function getHabitColorClass(emoji) {
    // Mapeo de emojis a clases de color
    const colorMap = {
        '💧': 'habit-color-blue',
        '🚿': 'habit-color-blue',
        '😴': 'habit-color-darkblue',
        '💪': 'habit-color-yellow',
        '🏋️': 'habit-color-yellow',
        '🏃': 'habit-color-yellow',
        '🧘': 'habit-color-purple',
        '📖': 'habit-color-purple',
        '🍎': 'habit-color-green',
        '🥗': 'habit-color-green'
    };

    // Devuelve la clase de color correspondiente o una por defecto
    return colorMap[emoji] || 'habit-color-default';
}

function getNextOccurrence(alarm) {
    const now = new Date();
    let next = null;

    let times = [];
    if (alarm.times && alarm.times.length > 0) {
        times = alarm.times.map(t => {
            const [h, m] = t.split(':').map(Number);
            return { h, m };
        });
    } else if (alarm.time) {
        let textTime = alarm.time;
        const match = textTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (match) {
            let h = parseInt(match[1]);
            let m = match[2] ? parseInt(match[2]) : 0;
            let p = match[3] ? match[3].toLowerCase() : null;
            if (p === 'pm' && h < 12) h += 12;
            if (p === 'am' && h === 12) h = 0;
            times.push({ h, m });
        }
    }

    if (times.length === 0) return null;

    const daysActive = alarm.days || [true, true, true, true, true, true, true];
    const jsToUIDay = [6, 0, 1, 2, 3, 4, 5]; // Transforma día de JS (Domingo=0) a nuestra UI (Lunes=0)

    for (let i = 0; i < 8; i++) {
        const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const uiDay = jsToUIDay[checkDate.getDay()];
        
        if (daysActive[uiDay]) {
            for (let t of times) {
                const candidate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), t.h, t.m, 0);
                if (candidate > now) {
                    if (!next || candidate < next) {
                        next = candidate;
                    }
                }
            }
        }
    }
    return next;
}

function renderActiveHabitsWidget() {
    const container = document.getElementById('activeHabitsRow');
    if (!container) return;

    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habits = list.filter(r => r.isHabit && r.enabled !== false);

    if (habits.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const now = new Date();
    const habitData = habits.map(h => ({ ...h, nextDate: getNextOccurrence(h) }))
                            .filter(h => h.nextDate)
                            .sort((a, b) => a.nextDate - b.nextDate);

    if (habitData.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = habitData.map(h => {
        const diffMins = Math.floor((h.nextDate - now) / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        let timeStr = diffHours > 24 ? `en ${Math.floor(diffHours / 24)} d` : (diffHours > 0 ? `${diffHours}h ${diffMins % 60}m` : `${diffMins} min`);
        let percent = diffMins <= 1440 ? 1 - (diffMins / 1440) : 0; // 1440 min = 24h

        const dasharray = 188.5; // Perímetro del círculo
        const dashoffset = dasharray - (percent * dasharray);
        
        // Obtener color del hábito o asignar uno por defecto
        let strokeColor = 'var(--accent)';
        if (h.color) {
            const match = h.color.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
            if (match) strokeColor = match[0];
        }

        return `
            <div class="habit-circle-wrapper" onclick="openHabitDetailView(${h.id})">
                <div class="habit-circle-widget" title="${h.text}">
                    <svg class="habit-circle-svg" viewBox="0 0 68 68">
                        <circle class="habit-circle-bg" cx="34" cy="34" r="30"></circle>
                        <circle class="habit-circle-progress" cx="34" cy="34" r="30" style="stroke: ${strokeColor}; stroke-dasharray: ${dasharray}; stroke-dashoffset: ${dashoffset};"></circle>
                    </svg>
                    ${h.emoji || '📅'}
                    <div class="habit-circle-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

setInterval(() => {
    if (document.getElementById('view-reminders').style.display !== 'none') {
        renderActiveHabitsWidget();
    }
}, 60000); // Se actualiza la barra y el tiempo cada minuto automáticamente

window.toggleHabitState = (id) => {
    if (typeof isSelectionMode !== 'undefined' && isSelectionMode) return;
    
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const index = list.findIndex(r => r.id === id);
    
    if (index !== -1) {
        const currentState = list[index].enabled !== false;
        list[index].enabled = !currentState;

        localStorage.setItem('reminders', JSON.stringify(list));
        window.scheduleNotificationsForAlarm(list[index]);
        renderAll();
    }
};

window.toggleAlarmDay = (alarmId, dayIndex) => {
    // Prevenir si estamos en modo de selección múltiple
    if (typeof isSelectionMode !== 'undefined' && isSelectionMode) return;

    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const index = list.findIndex(r => r.id === alarmId);

    if (index !== -1) {
        // Aseguramos que el array 'days' exista, proveyendo un default si no.
        if (!list[index].days) {
            list[index].days = [true, true, true, true, true, true, true];
        }
        
        list[index].days[dayIndex] = !list[index].days[dayIndex];
        
        localStorage.setItem('reminders', JSON.stringify(list));
        window.scheduleNotificationsForAlarm(list[index]);
        
        // Actualización directa del DOM sin parpadeos
        const card = document.querySelector(`.habit-card-grid[data-id="${alarmId}"]`);
        if (card) {
            const dot = card.querySelectorAll('.habit-day-dot')[dayIndex];
            if (dot) {
                dot.classList.toggle('active', list[index].days[dayIndex]);
            }
            renderActiveHabitsWidget();
        } else {
            renderAll();
        }
    }
};

function confirmDeleteHabit(id) {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = list.find(h => h.id === id);
    if (!habit) return;

    if (confirm(`¿Quieres eliminar el hábito "${habit.text}"?`)) {
        // Usamos la función de borrado con animación que ya existe
        deleteItem('reminders', id);
    }
}

function showCompletionToast() {
    let toast = document.querySelector('.completion-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'completion-toast';
        document.body.appendChild(toast);
    }
    
    const messages = ["¡Bien hecho!", "¡Genial!", "¡Una menos!", "¡Sigue así!", "¡Excelente!"];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    toast.innerHTML = `<span>🎉</span> ${randomMessage}`;
    
    // Pequeño truco para reiniciar la animación si se pulsa varias veces
    toast.classList.remove('show');
    void toast.offsetWidth; // Forzar redibujado
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000); // Se oculta después de 2 segundos
}

function playCompletionSound() {
    try {
        const audio = new Audio('assets/ding.mp3');
        audio.volume = 0.5; // Volumen sutil
        audio.play().catch(error => {
            // La auto-reproducción puede ser bloqueada por el navegador
            console.log("La reproducción de sonido fue bloqueada:", error);
        });
    } catch (e) {
        console.error("No se pudo reproducir el sonido:", e);
    }
}

// Función para marcar como completada
// Función para marcar como completada (CON CONTADOR)
window.toggleTaskComplete = (id) => {
    // Bloquear el check de completado si estamos intentando seleccionar
    if (typeof isSelectionMode !== 'undefined' && isSelectionMode) return;
    
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let completedDelta = 0;
    let wasJustCompleted = false; // Flag para la animación

    tasks = tasks.map(t => {
        if (t.id === id) {
            const newState = !t.completed;
            // Si la tarea pasa a estar completada, sumamos 1. Si se desmarca, restamos 1.
            completedDelta = newState ? 1 : -1;
            if (newState) { // Solo animamos al completar, no al desmarcar
                wasJustCompleted = true;
            }
            return { ...t, completed: newState };
        }
        return t;
    });

    // Actualizar el contador de completadas para el fuego
    let currentDone = parseInt(localStorage.getItem('completedToday') || 0);
    localStorage.setItem('completedToday', Math.max(0, currentDone + completedDelta));

    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    // Si se acaba de completar una tarea, mostramos la animación
    if (wasJustCompleted) {
        showCompletionToast();
        playCompletionSound();
    }

    renderAll(); // Refrescar la vista principal, el fuego y el contador
    
    // Refrescar calendario dinámicamente si está abierto
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView) {
        renderCalendar();
        renderCalendarTasks(selectedViewDate);
    }
};


window.getProfileCircle = function(text, customIcon = 'none') {
    const pastelColors = ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#D4A5A5', '#E6B0AA', '#B5EAD7', '#C7CEEA', '#FFDAC1', '#FF9AA2', '#E2F0CB', '#DEC2CB', '#C5A3FF', '#85E3FF', '#A2E1DB', '#F8B195'];
    const firstLetter = (text || '?').trim().charAt(0).toUpperCase();
    // Usar el valor numérico de la letra para asignar siempre el mismo color a la misma letra
    const charCode = firstLetter.charCodeAt(0) || 0;
    const colorIndex = charCode % pastelColors.length;
    const circleColor = pastelColors[colorIndex];
   
    
    let displayContent = firstLetter;
    if (customIcon && customIcon !== 'none') {
        if (typeof window.getTaskIcon === 'function') {
            displayContent = window.getTaskIcon(customIcon, "18");
        }
    }
    
    return `<div class="task-profile-circle" style="background-color: ${circleColor}; color: #37352F; display: flex; align-items: center; justify-content: center;">${displayContent}</div>`;
};

function drawTasks(list, containerId, isCompletedOrAlarm, key) {
    const container = containerId ? document.getElementById(containerId) : null;

    // Lógica de "Empty State"
    if (list.length === 0) {
       if (containerId === 'completedTaskList') {
            if (container) container.innerHTML = '';
            return container ? undefined : '';
        }

        if (containerId === 'taskList' || containerId === 'calendarTaskList' || !containerId) {
            let msgTitle = "Todo al día";
            let msgSub = currentFilter !== 'all' 
                ? `Sin tareas pendientes en la categoría ${currentFilter}` 
                : "No tienes tareas pendientes aquí.";
                
            const emptyHtml = `
                <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">${msgTitle}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">${msgSub}</p>
                </div>
            `;
            if (container) {
                container.innerHTML = emptyHtml;
                return;
            } else {
                return emptyHtml;
            }
        }

        // Fallback para otras listas
        const fallbackEmpty = `<div class="empty-state"><span>📝</span><p>No hay nada aquí.</p></div>`;
        if (container) container.innerHTML = fallbackEmpty;
        return container ? undefined : fallbackEmpty;
    }

    // --- SORTING: Ordenar poniendo los Anclados primero ---
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // Si hay items, dibujamos normal (ahora el CSS los pondrá alineados)
    const listHtml = list.map((item, index) => {
        const isTaskOverdue = item.date && !item.completed && isOverdue(item.date);
        const urgentClass = isTaskOverdue ? 'urgent' : '';
        const pinIcon = item.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof selectedItems !== 'undefined' && selectedItems.has(`${key}-${item.id}`);
        
        let importanceClass = '';
        if (item.importance === 'high') importanceClass = 'importance-high';
        else if (item.importance === 'medium') importanceClass = 'importance-medium';
        else if (item.importance === 'low') importanceClass = 'importance-low';
        else if (item.importance === 'none') importanceClass = 'importance-none';
        
        return `
        <div class="swipe-container" style="animation-delay: ${index * 0.05}s;">
            <div class="swipe-action" onclick="deleteItemWithAnimation(this, '${key}', ${item.id})">
                <div class="delete-icon">
                    <span>🗑️</span>
                    Borrar
                </div>
            </div>
            <div class="reminder-card ${item.completed ? 'completed-task' : ''} ${urgentClass} ${importanceClass} ${isSelected ? 'selected' : ''}" 
                data-id="${item.id}" data-key="${key}" 
                onclick="handleItemClick(event, this, ${item.id}, '${key}')">
                <div class="card-info">
                    ${pinIcon}
                    ${window.getProfileCircle(item.text, item.icon)}
                    <div class="task-data-wrapper">
                        <span class="task-text-content">
                            ${item.text} 
                            ${isTaskOverdue ? '<span style="color:var(--error); font-size:11px; font-weight:bold; margin-left:6px;">(Vencida)</span>' : ''}
                        </span>
                        
                        <div class="time-badges-container">
                            ${item.time ? `<span class="badge-alarm">🔔 ${item.time}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button onclick="event.stopPropagation(); toggleTaskComplete(${item.id})" class="btn-check">
                        ${item.completed ? '↩️' : '✓'}
                    </button>
                <div class="drag-indicator">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                </div>
                </div>
            </div>
        </div>
    `}).join('');
    
    if (container) {
        container.innerHTML = listHtml;
    } else {
        return listHtml;
    }
}

window.deleteItemWithAnimation = (element, key, id) => {
    const swipeContainer = element.closest('.swipe-container');
    if (swipeContainer) {
        swipeContainer.classList.add('removing');
        // Usamos setTimeout en lugar de transitionend para garantizar que SIEMPRE se ejecute
        setTimeout(() => {
            deleteItem(key, id);
        }, 300); // 300ms, que es lo que dura tu animación en CSS
    } else {
        // Fallback si no hay animación
        deleteItem(key, id);
    }
};

window.deleteItem = (key, id) => {
    let list = JSON.parse(localStorage.getItem(key) || '[]');

    // 2. NUEVO: Cancelar la notificación nativa si estamos borrando un recordatorio
    if (key === 'reminders' && typeof Notifications !== 'undefined' && Notifications) {
        const itemToDelete = list.find(i => String(i.id) === String(id));
        if (itemToDelete) {
            const idsToCancel = window.getNotificationIdsForAlarm(itemToDelete);
            // También añadimos el id por defecto por si es una alarma rápida
            idsToCancel.push(id); 
            Notifications.cancel({ notifications: idsToCancel.map(cancelId => ({ id: parseInt(cancelId) })) });
        }
    }

    list = list.filter(i => String(i.id) !== String(id));
    localStorage.setItem(key, JSON.stringify(list));

    renderAll();
    
    // Refrescar calendario dinámicamente si está abierto al eliminar
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView && key === 'tasks') {
        renderCalendar();
        renderCalendarTasks(selectedViewDate);
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

// Función para actualizar el título principal inteligente ("Hoy", "Ayer", "12 abr")
function updateMainTitle() {
    const titleEl = document.getElementById('mainDateTitle');
    const toggleBtn = document.getElementById('taskViewToggle');
    if (!titleEl || !toggleBtn) return;

    const todayStr = getTodayStr();
    const isTodayView = selectedViewDate === todayStr;

    // 1. Actualizar texto del botón lateral
    if (!isTodayView) {
        toggleBtn.innerText = 'Hoy';
    } else {
        toggleBtn.innerText = taskViewMode === 'today' ? 'Todas' : 'Hoy';
    }

    // 2. Actualizar el Título Central
    if (isTodayView) {
        titleEl.innerText = 'Hoy';
    } else {
        const parts = selectedViewDate.split('/');
        const selectedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);
        
        const diffDays = Math.round((selectedDate - todayDate) / (1000 * 60 * 60 * 24));

        if (diffDays === -1) titleEl.innerText = 'Ayer';
        else if (diffDays === 1) titleEl.innerText = 'Mañana';
        else {
            // Devuelve formato como "12 abr" o "5 oct"
            let formatted = selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
            titleEl.innerText = formatted;
        }
    }
}

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
        // Cambiar colores dinámicos con gradientes
        if (percent < 40) {
            progressBar.style.background = "linear-gradient(90deg, #ff5252, #ff8a8a)";
            progressBar.style.boxShadow = "0 0 8px rgba(255, 82, 82, 0.4)";
        } else if (percent < 80) {
            progressBar.style.background = "linear-gradient(90deg, #f2c94c, #ffd740)";
            progressBar.style.boxShadow = "0 0 8px rgba(242, 201, 76, 0.4)";
        } else {
            progressBar.style.background = "linear-gradient(90deg, #00e676, #69f0ae)";
            progressBar.style.boxShadow = "0 0 8px rgba(0, 230, 118, 0.4)";
        }
    }

    if (progressText) {
        progressText.innerText = `${percent}% completado (${done}/${total})`;
    }
}

// --- NUEVO: Lógica para ocultar/mostrar el texto de progreso ---
function initProgressToggle() {
    const progressContainer = document.querySelector('.progress-container');
    const progressText = document.getElementById('progressText');

    // Solo proceder si ambos elementos existen y no han sido ya procesados
    if (progressContainer && progressText && !progressContainer.dataset.toggleInitialized) {
        // 1. Crear un wrapper para agrupar la barra y el texto
        const wrapper = document.createElement('div');
        wrapper.className = 'progress-wrapper';
        
        // Insertar el wrapper antes de la barra de progreso
        progressContainer.parentNode.insertBefore(wrapper, progressContainer);
        
        // Mover la barra y el texto dentro del nuevo wrapper
        wrapper.appendChild(progressContainer);
        wrapper.appendChild(progressText);

        // 2. Añadir el evento de clic a todo el wrapper (incluyendo la línea indicadora)
        wrapper.addEventListener('click', () => {
            progressText.classList.toggle('visible');
        });

        // 3. Marcar como inicializado para no repetir
        progressContainer.dataset.toggleInitialized = 'true';
    }
}

// INICIO
updateMainTitle();
renderAll();
initProgressToggle(); // Lo llamamos aquí para asegurar que se ejecute

function setupHeaderMenu() {
    const header = document.querySelector('#view-today .samsung-header');
    const headerActions = header ? header.querySelector('.header-actions') : null;
    // Si el menú ya fue creado, no hacemos nada.
    if (!header || !headerActions || document.getElementById('moreOptionsBtn')) {
        return;
    }

    // 1. Identificamos los elementos que vamos a mover o dejar.
    const searchWrapper = headerActions.querySelector('.search-wrapper');
    const calendarBtn = headerActions.querySelector('#openCalendarBtn');
    const categoryBtn = headerActions.querySelector('#addNewCategoryBtn');
    const categoryLabel = header.querySelector('#activeCategoryLabel');

    // 2. Creamos el contenedor del menú desplegable.
    const dropdown = document.createElement('div');
    dropdown.id = 'headerMenuDropdown';
    dropdown.className = 'header-menu-dropdown';
    header.appendChild(dropdown);

    // 3. Movemos los elementos deseados DENTRO del menú.
    // El label de la categoría va primero y en su propio contenedor.
    if (categoryLabel) {
        const labelWrapper = document.createElement('div');
        labelWrapper.className = 'header-menu-label-item';
        labelWrapper.appendChild(categoryLabel);
        dropdown.appendChild(labelWrapper);
    }
    if (calendarBtn) {
        calendarBtn.innerHTML += '<span>Ver Calendario</span>';
        dropdown.appendChild(calendarBtn);
    }
    if (categoryBtn) {
        categoryBtn.innerHTML += '<span>Añadir Categoría</span>';
        dropdown.appendChild(categoryBtn);
    }

    // 4. Limpiamos el contenedor original de acciones y restauramos el buscador.
    headerActions.innerHTML = '';
    if (searchWrapper) headerActions.appendChild(searchWrapper);

    // --- NUEVO: Botón Organizar Tareas (Idea) ---
    const organizeBtn = document.createElement('button');
    organizeBtn.id = 'openOrganizeBtn';
    organizeBtn.className = 'action-btn';
    organizeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`;
    headerActions.appendChild(organizeBtn);

    // 5. Creamos y añadimos el nuevo botón de tres puntos.
    const moreOptionsBtn = document.createElement('button');
    moreOptionsBtn.id = 'moreOptionsBtn';
    moreOptionsBtn.className = 'action-btn more-options-btn';
    moreOptionsBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>`;
    if (currentFilter !== 'all') moreOptionsBtn.style.color = 'var(--accent)';
    headerActions.appendChild(moreOptionsBtn);

    // 6. Añadimos los listeners para que el menú funcione.
    moreOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (dropdown.classList.contains('active') && !dropdown.contains(e.target) && !moreOptionsBtn.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // --- NUEVO: Botón Buscar Tarea en menú ---
    const searchMenuBtn = document.createElement('button');
    searchMenuBtn.className = 'action-btn';
    searchMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Buscar Tarea</span>`;
    dropdown.appendChild(searchMenuBtn);

    searchMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        const wrapper = document.getElementById('taskSearchWrapper');
        if (wrapper) {
            wrapper.classList.add('expanded');
            setTimeout(() => document.getElementById('taskSearchInput').focus(), 100);
        }
    });

    // --- NUEVO: Botón Historial de Tareas ---
    const historyMenuBtn = document.createElement('button');
    historyMenuBtn.className = 'action-btn';
    historyMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Historial </span>`;
    dropdown.appendChild(historyMenuBtn);

    historyMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        document.getElementById('view-today').style.display = 'none';
        document.getElementById('view-history').style.display = 'flex';
        document.getElementById('tabOverdue')?.click(); 
        if (typeof renderHistoryView === 'function') renderHistoryView();
    });
}
document.addEventListener('DOMContentLoaded', setupHeaderMenu);

// --- EVENTOS PARA ORGANIZAR TAREAS ---
document.addEventListener('click', (e) => {
    const btn = e.target.closest('#openOrganizeBtn');
    if (btn) {
        document.getElementById('view-today').style.display = 'none';
        document.getElementById('view-organize').style.display = 'block';
        document.getElementById('newTaskListBtn')?.click(); // Autoselecciona "Nueva Lista"
    }
});

const closeOrganizeBtn = document.getElementById('closeOrganizeBtn');
if (closeOrganizeBtn) {
    closeOrganizeBtn.onclick = () => {
        document.getElementById('view-organize').style.display = 'none';
        document.getElementById('view-today').style.display = 'block';
    };
}

// --- LÓGICA INTERNA DE ORGANIZAR TAREAS (ESTILO TICKTICK) ---
const newTaskListBtn = document.getElementById('newTaskListBtn');
const viewPendingTasksBtn = document.getElementById('viewPendingTasksBtn');
const organizeNewList = document.getElementById('organizeNewList');
const organizePending = document.getElementById('organizePending');

if (newTaskListBtn && viewPendingTasksBtn) {
    newTaskListBtn.addEventListener('click', () => {
        organizeNewList.style.display = 'flex';
        organizePending.style.display = 'none';
        
        newTaskListBtn.classList.add('active');
        viewPendingTasksBtn.classList.remove('active');
        
        const carousel = document.getElementById('planCardsCarousel');
        if (carousel.children.length === 0) {
            if (!loadDailyPlan()) {
                addPlanCard(); // Si está vacío y no hay guardado, crea una por defecto
            }
        }
    });

    viewPendingTasksBtn.addEventListener('click', () => {
        organizeNewList.style.display = 'none';
        organizePending.style.display = 'flex';
        
        viewPendingTasksBtn.classList.add('active');
        newTaskListBtn.classList.remove('active');
        
        renderPendingCarousel(); // Cargamos las tareas del día
    });
}

const addPlanCardBtn = document.getElementById('addPlanCardBtn');
if (addPlanCardBtn) addPlanCardBtn.addEventListener('click', () => addPlanCard());

function addPlanCard() {
    const carousel = document.getElementById('planCardsCarousel');
    const cardId = Date.now() + Math.floor(Math.random() * 100);
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.id = `plan-card-${cardId}`;
    card.innerHTML = `
        <input type="text" class="plan-card-title" placeholder="Ej: Mañana, Tarde, Noche..." oninput="saveDailyPlan()">
        <div class="plan-items-container" id="items-${cardId}"></div>
        <div class="add-check-item" onclick="addPlanItem(${cardId})">
            <span style="font-size: 22px; color: var(--accent); font-weight: bold;">+</span> Añadir subtarea
        </div>
        <button class="btn-text" style="margin-top: auto; padding-top: 15px; font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center;" onclick="this.closest('.plan-card').remove(); saveDailyPlan();">✓ Lista completada</button>
    `;
    carousel.appendChild(card);
    addPlanItem(cardId); // Añade el primer input automáticamente
    saveDailyPlan();
    
    setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 50);
}

window.addPlanItem = (cardId) => {
    const container = document.getElementById(`items-${cardId}`);
    if (!container) return;
    const itemId = Date.now() + Math.floor(Math.random() * 1000);
    const itemDiv = document.createElement('div');
    itemDiv.className = 'plan-check-item';
    itemDiv.id = `plan-item-${itemId}`;
    itemDiv.innerHTML = `
        <div class="plan-check-box" onclick="togglePlanItem(${itemId})"></div>
        <input type="text" placeholder="Escribe algo..." oninput="saveDailyPlan()" onkeydown="if(event.key === 'Enter') { event.preventDefault(); addPlanItem(${cardId}); }">
        <button onclick="this.parentElement.remove(); saveDailyPlan();" style="background:transparent; color:var(--error); border:none; padding:0 5px; font-size:18px; opacity:0.5;">✕</button>
    `;
    container.appendChild(itemDiv);
    itemDiv.querySelector('input[type="text"]').focus(); // Foco automático para seguir escribiendo
    saveDailyPlan();
};

window.togglePlanItem = (itemId) => {
    document.getElementById(`plan-item-${itemId}`).classList.toggle('done');
    saveDailyPlan();
};

window.saveDailyPlan = () => {
    const title = document.getElementById('planMainTitle')?.value || '';
    const desc = document.getElementById('planMainDesc')?.value || '';
    const cards = [];

    document.querySelectorAll('.plan-card').forEach(card => {
        const cardId = card.id.replace('plan-card-', '');
        const cardTitle = card.querySelector('.plan-card-title').value;
        const items = [];
        card.querySelectorAll('.plan-check-item').forEach(item => {
            const itemId = item.id.replace('plan-item-', '');
            const text = item.querySelector('input[type="text"]').value;
            const done = item.classList.contains('done');
            items.push({ id: itemId, text, done });
        });
        cards.push({ id: cardId, title: cardTitle, items });
    });

    localStorage.setItem('dailyPlan', JSON.stringify({ title, desc, cards }));
};

window.loadDailyPlan = () => {
    const dataStr = localStorage.getItem('dailyPlan');
    if (!dataStr) return false;
    
    const data = JSON.parse(dataStr);
    if (!data) return false;

    const mainTitle = document.getElementById('planMainTitle');
    const mainDesc = document.getElementById('planMainDesc');
    if (mainTitle) mainTitle.value = data.title || '';
    if (mainDesc) mainDesc.value = data.desc || '';

    if (!data.cards || data.cards.length === 0) return false;

    const carousel = document.getElementById('planCardsCarousel');
    if (!carousel) return false;
    carousel.innerHTML = '';

    data.cards.forEach(cardData => {
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.id = `plan-card-${cardData.id}`;
        const safeTitle = (cardData.title || '').replace(/"/g, '&quot;');
        card.innerHTML = `
            <input type="text" class="plan-card-title" placeholder="Ej: Mañana, Tarde, Noche..." value="${safeTitle}" oninput="saveDailyPlan()">
            <div class="plan-items-container" id="items-${cardData.id}">
                ${cardData.items.map(item => {
                    const safeText = (item.text || '').replace(/"/g, '&quot;');
                    return `
                    <div class="plan-check-item ${item.done ? 'done' : ''}" id="plan-item-${item.id}">
                        <div class="plan-check-box" onclick="togglePlanItem(${item.id})"></div>
                        <input type="text" placeholder="Escribe algo..." value="${safeText}" oninput="saveDailyPlan()" onkeydown="if(event.key === 'Enter') { event.preventDefault(); addPlanItem(${cardData.id}); }">
                        <button onclick="this.parentElement.remove(); saveDailyPlan();" style="background:transparent; color:var(--error); border:none; padding:0 5px; font-size:18px; opacity:0.5;">✕</button>
                    </div>
                    `;
                }).join('')}
            </div>
            <div class="add-check-item" onclick="addPlanItem(${cardData.id})">
                <span style="font-size: 22px; color: var(--accent); font-weight: bold;">+</span> Añadir subtarea
            </div>
            <button class="btn-text" style="margin-top: auto; padding-top: 15px; font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center;" onclick="this.closest('.plan-card').remove(); saveDailyPlan();">✓ Lista completada</button>
        `;
        carousel.appendChild(card);
    });
    return true;
};

document.getElementById('planMainTitle')?.addEventListener('input', saveDailyPlan);
document.getElementById('planMainDesc')?.addEventListener('input', saveDailyPlan);

function renderPendingCarousel() {
    const carousel = document.getElementById('pendingCardsCarousel');
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const pending = allTasks.filter(t => !t.completed && !t.skipped && (t.date === getTodayStr() || isOverdue(t.date)));
    
    if (pending.length === 0) {
        carousel.innerHTML = `<div class="pending-task-card active-card" style="background: var(--bg-card); border: none;"><div style="font-size: 40px; margin-bottom: 15px;">🎉</div><div style="font-weight: 800; font-size: 20px; color: var(--text-main);">¡Día despejado!</div><div style="font-size: 14px; color: var(--text-sub); margin-top: 8px;">No hay tareas pendientes para hoy.</div></div>`;
        return;
    }
    
    carousel.innerHTML = pending.map((t, index) => `
        <div class="pending-task-card ${index === 0 ? 'active-card' : ''}">
            <div style="font-size: 40px; margin-bottom: 15px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));">${t.emoji || '📝'}</div>
            <div style="font-weight: 800; font-size: 20px; color: var(--text-main); margin-bottom: 15px; line-height: 1.2;">${t.text}</div>
            ${t.time ? `<div style="font-size: 14px; font-weight: 800; color: var(--accent); background: white; padding: 8px 16px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-bottom: 15px; display:inline-block;">⏰ ${t.time}</div>` : ''}
            ${isOverdue(t.date) ? `<div style="font-size: 13px; font-weight: bold; color: var(--error); margin-bottom: 10px;">(Vencida)</div>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: auto; padding-top: 15px;">
                <button class="btn-text" style="font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center; background: rgba(82, 189, 148, 0.1); border-radius: 12px; padding: 12px;" onclick="toggleTaskComplete(${t.id}); setTimeout(()=>renderPendingCarousel(), 300);">✓ Completar tarea</button>
                
                <div style="display: flex; gap: 8px; width: 100%;">
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: #d35400; background: rgba(211, 84, 0, 0.1); border-radius: 12px; padding: 10px;" onclick="window.skipTask(${t.id})">🚫 No hacer</button>
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: var(--error); background: rgba(235, 87, 87, 0.1); border-radius: 12px; padding: 10px;" onclick="deleteItem('tasks', ${t.id}); setTimeout(()=>renderPendingCarousel(), 300);">🗑️ Borrar</button>
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: var(--accent); background: rgba(84, 163, 214, 0.1); border-radius: 12px; padding: 10px;" onclick="window.showSnoozeOptions(${t.id})">⏱️ Aplazar</button>
                </div>
            </div>
            
            <div id="snooze-options-${t.id}" style="display: none; flex-direction: column; gap: 8px; width: 100%; margin-top: 10px; background: var(--bg-app); padding: 10px; border-radius: 12px;">
                <span style="font-size: 12px; font-weight: bold; color: var(--text-sub);">¿Cuándo la harás?</span>
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'later')">Más tarde</button>
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'tomorrow')">Mañana</button>
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'other')">Otro día</button>
                </div>
            </div>
        </div>
    `).join('');
    
    carousel.onscroll = () => {
        const cards = carousel.querySelectorAll('.pending-task-card');
        const center = carousel.scrollLeft + carousel.clientWidth / 2;
        cards.forEach(card => {
            const cardCenter = card.offsetLeft + card.clientWidth / 2;
            const distance = Math.abs(center - cardCenter);
            if (distance < card.clientWidth / 1.5) {
                card.classList.add('active-card');
            } else {
                card.classList.remove('active-card');
            }
        });
    };
    setTimeout(() => carousel.dispatchEvent(new Event('scroll')), 50);
}

window.skipTask = (id) => {
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks = tasks.map(t => t.id === id ? { ...t, skipped: true } : t);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderAll();
    renderPendingCarousel();
};

window.showSnoozeOptions = (id) => {
    const opts = document.getElementById(`snooze-options-${id}`);
    if (opts) {
        opts.style.display = opts.style.display === 'none' ? 'flex' : 'none';
    }
};

window.snoozeTask = (id, when) => {
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    if (when === 'later') {
        if (task.time) {
            const [h, m] = task.time.split(':').map(Number);
            let newH = (h + 2) % 24;
            task.time = `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }
        task.date = getTodayStr();
        alert("Tarea aplazada para más tarde hoy.");
    } else if (when === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = tomorrow.getDate().toString().padStart(2, '0');
        const m = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
        const y = tomorrow.getFullYear();
        task.date = `${d}/${m}/${y}`;
    } else if (when === 'other') {
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.position = 'absolute';
        dateInput.style.opacity = '0';
        document.body.appendChild(dateInput);
        
        dateInput.onchange = (e) => {
            const val = e.target.value; 
            if (val) {
                const [y, m, d] = val.split('-');
                task.date = `${d}/${m}/${y}`;
                localStorage.setItem('tasks', JSON.stringify(tasks));
                renderAll();
                renderPendingCarousel();
            }
            document.body.removeChild(dateInput);
        };
        dateInput.click();
        return; 
    }
    
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderAll();
    renderPendingCarousel();
};

// Función auxiliar para calcular urgencia
function calcularDiferenciaMinutos(h1, h2) {
    const [hor1, min1] = h1.split(':').map(Number);
    const [hor2, min2] = h2.split(':').map(Number);
    return (hor2 * 60 + min2) - (hor1 * 60 + min1);
}

// 12. EL VIGILANTE DE ALARMAS BLINDADO
// Detectamos si estamos en la Web o en el Celular
const isWeb = typeof Capacitor === 'undefined' || Capacitor.getPlatform() === 'web';

if (isWeb) {
    console.log("Modo Web detectado: Iniciando motor de notificaciones por intervalo.");
    
    setInterval(() => {
        const ahora = new Date();
        const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const lista = JSON.parse(localStorage.getItem('reminders') || '[]');
        let huboCambios = false;

        lista.forEach(r => {
            if (r.time === horaActual && !r.notified) {
                
                // Notificación de Navegador (PC)
                if (Notification.permission === "granted") {
                    new Notification("📝 Recordatorio", {
                        body: r.text,
                        icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png"
                    });
                }

                r.notified = true;
                huboCambios = true;
                
                // Solo se borra automáticamente si es un recordatorio rápido (no un hábito)
                if (!r.isHabit) {
                    setTimeout(() => { window.deleteItem('reminders', r.id); }, 20000); 
                } else {
                    setTimeout(() => { 
                        let currentList = JSON.parse(localStorage.getItem('reminders') || '[]');
                        currentList = currentList.map(item => item.id === r.id ? { ...item, notified: false } : item);
                        localStorage.setItem('reminders', JSON.stringify(currentList));
                            }, 61000); // Resetea el flag tras un minuto para que vuelva a alertar después
                }
            }
        });

        if (huboCambios) {
            localStorage.setItem('reminders', JSON.stringify(lista));
            renderAll();
        }
    }, 10000); // Revisa cada 10 segundos
}

// VIGILANTE GLOBAL PARA LOS POP-UPS EMERGENTES (Buzón)
setInterval(() => {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const todayStr = getTodayStr();

    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let tasksChanged = false;

    allTasks.forEach(t => {
        if (t.isPopup && !t.completed && !t.popupNotified && t.popupDate === todayStr && t.popupTime === horaActual) {
            if (typeof window.showPopupReminder === 'function') {
                window.showPopupReminder(t);
                t.popupNotified = true;
                tasksChanged = true;
            }
        }
    });

    if (tasksChanged) {
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        renderAll();
    }
}, 10000); // Revisa cada 10 segundos de forma eficiente



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
    localStorage.setItem('totalCreatedToday', 0);
    localStorage.setItem('completedToday', 0);
    localStorage.setItem('tasks', '[]'); 
    localStorage.setItem('reminders', '[]'); // 1. Limpiamos recordatorios también

    // 2. CANCELAMOS TODO EN EL SISTEMA OPERATIVO
    if (Notifications) {
        Notifications.cancelAll(); 
        console.log("Todas las alarmas del sistema han sido canceladas");
    }
    
    renderAll();
    updateComboUI(); 
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
        
        if (fabTask) {
            if (targetView === 'view-today') {
                fabTask.style.display = 'flex';
                fabTask.classList.remove('auto-expanded');
                clearTimeout(window.taskFabTimeout);
                clearTimeout(window.taskFabCloseTimeout);
                
                window.taskFabTimeout = setTimeout(() => {
                    fabTask.classList.add('auto-expanded');
                    window.taskFabCloseTimeout = setTimeout(() => {
                        fabTask.classList.remove('auto-expanded');
                    }, 4000); // Se contrae a los 4 segundos
                }, 1000); // Se estira tras 1 segundo
            } else {
                fabTask.style.display = 'none';
                clearTimeout(window.taskFabTimeout);
                clearTimeout(window.taskFabCloseTimeout);
            }
        }

        if (fabNote) {
            if (targetView === 'view-notes') {
                fabNote.style.display = 'flex';
                fabNote.classList.remove('auto-expanded');
                clearTimeout(window.noteFabTimeout);
                clearTimeout(window.noteFabCloseTimeout);
                
                window.noteFabTimeout = setTimeout(() => {
                    fabNote.classList.add('auto-expanded');
                    window.noteFabCloseTimeout = setTimeout(() => {
                        fabNote.classList.remove('auto-expanded');
                    }, 4000); // Se contrae a los 4 segundos
                }, 1000); // Se estira tras 1 segundo
            } else {
                fabNote.style.display = 'none';
                clearTimeout(window.noteFabTimeout);
                clearTimeout(window.noteFabCloseTimeout);
            }
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

function attachGestureEvents() {
    const cards = document.querySelectorAll('.reminder-card, .alarm-card, .habit-card, .habit-card-grid');

    cards.forEach(card => {
        if (card.dataset.gesturesAttached) return;
        card.dataset.gesturesAttached = 'true';

        let startX, startY;
        let isDragging = false;
        let isScrolling = false;
        let longPressTimer;
        
        const SWIPE_LIMIT = -90; // Píxeles que se moverá la tarjeta

        const onTouchStart = (e) => {
            if (e.target.closest('.actions')) return;

            const currentlySwiped = document.querySelector('.reminder-card.swiped');
            if (currentlySwiped && currentlySwiped !== card) {
                currentlySwiped.style.transform = 'translateX(0)';
                currentlySwiped.classList.remove('swiped');
                e.preventDefault();
                return;
            }

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = false;
            isScrolling = false;

            card.classList.add('is-dragging');

            longPressTimer = setTimeout(() => {
                if (!isDragging && !isScrolling) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    const id = parseInt(card.dataset.id);
                    const key = card.dataset.key;
                    const isHabitCard = card.classList.contains('habit-card')

                    if (isHabitCard) {
                        confirmDeleteHabit(id);
                    } else {
                        if (typeof toggleSelection === 'function') toggleSelection(card, id, key);
                    }
                }
            }, 600); 
        };

        const onTouchMove = (e) => {
            if (startX === undefined || startY === undefined) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - startX;
            const deltaY = Math.abs(currentY - startY);

            if (!isDragging && !isScrolling) {
                if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
                    if (card.closest('.swipe-container')) {
                        isDragging = true;
                        clearTimeout(longPressTimer);
                    } else {
                        // Si es una nota u otra cosa, cancelamos para no arrastrarla
                        clearTimeout(longPressTimer);
                    }
                } else if (deltaY > 10) {
                    isScrolling = true;
                    clearTimeout(longPressTimer);
                }
            }

            if (isDragging) {
                e.preventDefault();
                const isSwipedOpen = card.classList.contains('swiped');
                let moveOffset = isSwipedOpen ? SWIPE_LIMIT + deltaX : deltaX;
                const finalX = Math.max(SWIPE_LIMIT, Math.min(0, moveOffset));
                card.style.transform = `translateX(${finalX}px)`;
            }
        };

        const onTouchEnd = () => {
            clearTimeout(longPressTimer);
            card.classList.remove('is-dragging');
            startX = undefined;
            startY = undefined;

            if (!isDragging) return;

            const SWIPE_THRESHOLD = SWIPE_LIMIT / 2;
            const currentTransform = new DOMMatrix(getComputedStyle(card).transform).m41;

            if (currentTransform < SWIPE_THRESHOLD) {
                card.style.transform = `translateX(${SWIPE_LIMIT}px)`;
                card.classList.add('swiped');
            } else {
                card.style.transform = 'translateX(0)';
                card.classList.remove('swiped');
            }
        };

        card.addEventListener('touchstart', onTouchStart, { passive: false });
        card.addEventListener('touchmove', onTouchMove, { passive: false });
        card.addEventListener('touchend', onTouchEnd);
        card.addEventListener('touchcancel', onTouchEnd);
    });
}
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

// --- EVENTOS CATEGORÍAS DE NOTAS ENFOQUE ---
window.openCategoryNotes = (catName) => {
    window.currentFocusedCategory = catName;
    document.getElementById('view-notes').style.display = 'none';
    
    const catView = document.getElementById('view-category-notes');
    catView.style.display = 'flex';
    catView.classList.add('active');
    
    const title = document.getElementById('categoryNotesTitle');
    if (title) title.innerText = catName; // Sin emojis
    
    const fabNote = document.getElementById('openNoteEditorBtn');
    if (fabNote) fabNote.style.display = 'flex'; // Mantener botón para agregar notas
    
    const delBtn = document.getElementById('deleteCategoryNotesBtn');
    if (delBtn) {
        const isDefault = defaultNoteCategories.some(c => c.name === catName);
        delBtn.style.display = isDefault ? 'none' : 'flex';
        delBtn.onclick = () => confirmDeleteNoteCategory(catName);
    }

    renderCategoryNotesList(catName);
};

window.confirmDeleteNoteCategory = (catName) => {
    if (confirm(`¿Eliminar la categoría "${catName}"? Las notas que contenga se moverán a la categoría "General".`)) {
        let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
        custom = custom.filter(c => c.name !== catName);
        localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
        
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        let changed = false;
        notes = notes.map(n => {
            if (n.category === catName) {
                changed = true;
                return { ...n, category: 'General' };
            }
            return n;
        });
        if (changed) localStorage.setItem('notes', JSON.stringify(notes));
        
        closeCategoryNotes();
        renderNoteCategoriesCarousel();
        renderNotes();
    }
};

window.closeCategoryNotes = () => {
    window.currentFocusedCategory = null;
    const catView = document.getElementById('view-category-notes');
    catView.classList.remove('active');
    setTimeout(() => {
        catView.style.display = 'none';
        document.getElementById('view-notes').style.display = 'block';
        renderNotes();
    }, 200);
};

document.addEventListener('DOMContentLoaded', () => {
    const closeCatBtn = document.getElementById('closeCategoryNotesBtn');
    if (closeCatBtn) closeCatBtn.onclick = closeCategoryNotes;
});

// --- BUSCADOR Y FILTROS ---
function handleNoteSearch() {
    renderNotes();
}

// --- ADJUNTAR FOTOS (Requiere Capacitor Camera) ---
async function attachPhoto() {
    if (typeof Capacitor === 'undefined') return alert("Solo disponible en el celular");
    
    const image = await Capacitor.Plugins.Camera.getPhoto({
        quality: 60, // Bajamos la calidad para no saturar el localStorage
        resultType: 'base64'
    });
    
    const imgTag = `<img src="data:image/jpeg;base64,${image.base64String}" style="width:100%; border-radius:10px; margin: 10px 0;">`;
    noteImages.push(imgTag);
    // Añadimos visualmente al editor
    document.getElementById('noteInput').value += "\n[Imagen adjunta]\n";
}


//window.filterNotes = (cat) => {
    //currentNoteFilter = cat;
   // document.querySelectorAll('.note-cat-chip').forEach(btn => {
   //     btn.classList.toggle('active', (cat === 'all' && btn.innerText.includes('Todas')) || btn.innerText.includes(cat));
   // });
  //  renderNotes();
//};

// Actualiza tu función renderNotes para incluir el filtro

function renderNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const container = document.getElementById('notesList');
    const searchTerm = document.getElementById('noteSearchInput')?.value.toLowerCase() || "";

    if (!container) return;

    // 1. Filtrado inteligente
    const filtered = notes.filter(n => {
        const matchesSearch = (n.title?.toLowerCase().includes(searchTerm)) || 
                             (n.content?.toLowerCase().includes(searchTerm));
        const matchesCat = currentNoteFilter === 'all' || n.category === currentNoteFilter;
        return matchesSearch && matchesCat;
    });

    // --- SORTING: Anclados primero ---
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // 2. Estado vacío
    if (filtered.length === 0) {
        let msgTitle = searchTerm ? 'Sin resultados' : 'Bandeja vacía';
        let msgSub = searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'No tienes notas guardadas aquí.';
        container.innerHTML = `
            <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">${msgTitle}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">${msgSub}</p>
            </div>`;
        return;
    }

    // 3. Renderizado con tu estilo original, respetando 'content' y 'title'
    container.innerHTML = filtered.map((n, index) => {
        const pinIcon = n.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof selectedItems !== 'undefined' && selectedItems.has(`notes-${n.id}`);

        let dateInfo = '';
        if (n.createdAt) dateInfo += `Creado: ${n.createdAt}`;
        if (n.updatedAt && n.updatedAt !== n.createdAt) {
            dateInfo += (dateInfo ? ' • ' : '') + `Editado: ${n.updatedAt}`;
        }

        return `
        <div class="note-card reminder-card ${isSelected ? 'selected' : ''}" 
            data-id="${n.id}" 
            data-key="notes" 
            data-text="${n.content ? n.content.replace(/"/g, '&quot;') : ''}"
            style="animation-delay: ${index * 0.05}s;"
            onclick="handleItemClick(event, this, ${n.id}, 'notes')">
            <div class="card-info" style="display: flex; align-items: center; gap: 12px;">
                ${pinIcon}
                <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${n.title || 'Sin título'}
                    </div>
                    <div class="task-text-content" style="font-size: 12px; opacity: 0.7;">
                        ${n.content || ''}
                    </div>
                    ${n.images && n.images.length > 0 ? `
    <div style="display: flex; gap: 5px; margin-top: 8px;">
        ${n.images.map(img => `<img src="${img}" onclick="event.stopPropagation(); openImageViewer(this.src)" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; cursor: pointer;">`).join('')}
    </div>
` : ''}
                    ${dateInfo ? `<div style="font-size: 10px; color: var(--text-sub); margin-top: 6px; opacity: 0.8;">${dateInfo}</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    // ¡CRÍTICO! Llamamos a tu función para que la app no se "pegue"
    if (typeof attachGestureEvents === 'function') {
        attachGestureEvents();
    }
}

window.renderCategoryNotesList = (catName) => {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const container = document.getElementById('categoryNotesList');
    if (!container) return;

    const filtered = notes.filter(n => n.category === catName);
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">Categoría vacía</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">No tienes notas en ${catName}.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map((n, index) => {
        const pinIcon = n.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof selectedItems !== 'undefined' && selectedItems.has(`notes-${n.id}`);
        let dateInfo = '';
        if (n.createdAt) dateInfo += `Creado: ${n.createdAt}`;
        if (n.updatedAt && n.updatedAt !== n.createdAt) {
            dateInfo += (dateInfo ? ' • ' : '') + `Editado: ${n.updatedAt}`;
        }
        return `
        <div class="note-card reminder-card ${isSelected ? 'selected' : ''}" data-id="${n.id}" data-key="notes" style="animation-delay: ${index * 0.05}s;" onclick="handleItemClick(event, this, ${n.id}, 'notes')">
            <div class="card-info" style="display: flex; align-items: center; gap: 12px;">
                ${pinIcon}
                <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.title || 'Sin título'}</div>
                    <div class="task-text-content" style="font-size: 12px; opacity: 0.7;">${n.content || ''}</div>
                    ${n.images && n.images.length > 0 ? `<div style="display: flex; gap: 5px; margin-top: 8px;">${n.images.map(img => `<img src="${img}" onclick="event.stopPropagation(); openImageViewer(this.src)" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; cursor: pointer;">`).join('')}</div>` : ''}
                    ${dateInfo ? `<div style="font-size: 10px; color: var(--text-sub); margin-top: 6px; opacity: 0.8;">${dateInfo}</div>` : ''}
                </div></div></div>`;
    }).join('');
    if (typeof attachGestureEvents === 'function') attachGestureEvents();
};

window.handleNoteSearch = () => renderNotes();

window.getTaskIcon = (val, size="18") => {
    if (val === 'none' || !val) return '✨';
    const svgProps = `width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    switch(val) {
        case 'cart': return `<svg viewBox="0 0 24 24" ${svgProps}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
        case 'gym': return `<svg viewBox="0 0 24 24" ${svgProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
        case 'book': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
        case 'work': return `<svg viewBox="0 0 24 24" ${svgProps}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
        case 'health': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        case 'call': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
        case 'mail': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
        case 'finance': return `<svg viewBox="0 0 24 24" ${svgProps}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
        case 'idea': return `<svg viewBox="0 0 24 24" ${svgProps}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        case 'food': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"></path></svg>`;
        default: return '✨';
    }
};

function renderTaskOptionsUI() {
    const topContainer = document.getElementById('topTaskOptions');
    const bottomContainer = document.getElementById('bottomTaskOptions');

    let panel = document.getElementById('customTaskOptionsPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'customTaskOptionsPanel';
        panel.className = 'custom-options-panel';
        const textarea = document.getElementById('sheetTaskInput');
        if (textarea && textarea.parentNode) textarea.parentNode.insertBefore(panel, textarea);
    }
    panel.style.display = 'none';
    window.currentActivePanel = null;
    
    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
    const allCategories = [...defaultCategories.filter(c => c.filter !== 'all'), ...customCategories];

    window.getImportanceIcon = (val) => {
        if (val === 'high') return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
        if (val === 'medium') return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#F2C94C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
        if (val === 'low') return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
        return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
    };

    const defaultFolderSVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    const currentCatIcon = allCategories.find(c => c.filter === currentTaskCategory)?.icon || defaultFolderSVG;

    if (topContainer) {
        topContainer.innerHTML = `
            <div class="toolbar-item" title="Categoría" style="transform: scale(0.9);">
                <div class="icon-btn" id="categoryIconBtn" onclick="toggleTaskOptionPanel('category')">${currentCatIcon}</div>
            </div>
            <div class="toolbar-item" title="Carga Mental" style="transform: scale(0.9);">
                <div class="icon-btn" id="importanceIconBtn" onclick="toggleTaskOptionPanel('importance')">${window.getImportanceIcon(currentTaskImportance)}</div>
            </div>
            <div class="toolbar-item" title="Mensaje Emergente" style="transform: scale(0.9);">
                <div class="icon-btn ${currentTaskIsPopup ? 'active' : ''}" id="buzonIconBtn" onclick="toggleTaskOptionPanel('buzon')">📪</div>
            </div>
        `;
    }

    if (bottomContainer) {
        bottomContainer.innerHTML = `
            <div style="display: flex; gap: 12px;">
                <div class="toolbar-item" title="Añadir hora">
                    <div class="icon-btn ${currentTaskTime ? 'active' : ''}" id="timeIconBtn">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <input type="time" id="taskTimeInput" class="hidden-input-overlay" value="${currentTaskTime}" onchange="currentTaskTime = this.value; document.getElementById('timeIconBtn').classList.toggle('active', !!this.value);">
                </div>
                <div class="toolbar-item" title="Compartir tarea">
                    <button type="button" class="icon-btn" onclick="shareCurrentTask()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    </button>
                </div>
            </div>
            <button id="saveTaskBtn" class="btn-save-task" title="Guardar tarea" onclick="window.saveTaskFromSheet()">
                <svg viewBox="0 0 24 24" class="save-task-icon">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            </button>
        `;
    }
}

window.toggleTaskOptionPanel = (panelName) => {
    const panel = document.getElementById('customTaskOptionsPanel');
    if (!panel) return;
    
    if (window.currentActivePanel === panelName) {
        panel.style.display = 'none';
        window.currentActivePanel = null;
        return;
    }
    
    window.currentActivePanel = panelName;
    panel.style.display = 'flex';
    
    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
    const allCategories = [...defaultCategories.filter(c => c.filter !== 'all'), ...customCategories];
    
    if (panelName === 'category') {
        let html = `<div class="custom-option-chip ${currentTaskCategory === 'all' ? 'selected' : ''}" onclick="selectTaskOption('category', 'all', '🗂️')">🗂️ <span>Ninguna</span></div>`;
        html += allCategories.map(c => `<div class="custom-option-chip ${currentTaskCategory === c.filter ? 'selected' : ''}" onclick="selectTaskOption('category', '${c.filter}', '${c.icon}')">${c.icon} <span>${c.name}</span></div>`).join('');
        panel.innerHTML = html;
    } else if (panelName === 'importance') {
        const imp = [
            {val: 'none', label: 'Sin carga', icon: '⚪'},
            {val: 'high', label: 'Carga Alta', icon: '⭐'},
            {val: 'medium', label: 'Carga Media', icon: '🚩'},
            {val: 'low', label: 'Carga Baja', icon: '🏳️'}
        ];
        panel.innerHTML = imp.map(i => `<div class="custom-option-chip ${currentTaskImportance === i.val ? 'selected' : ''}" onclick="selectTaskOption('importance', '${i.val}')">${i.icon} <span>${i.label}</span></div>`).join('');
    } else if (panelName === 'buzon') {
        const isToday = currentTaskPopupDate === getTodayStr();
        const isTomorrow = currentTaskPopupDate === getTomorrowStr();
        const isOther = !isToday && !isTomorrow && currentTaskPopupDate !== '';
        
        panel.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: var(--text-main);">📬 Recordatorio Intrusivo (Pop-up)</span>
                    <div style="width: 48px; height: 28px; background: ${currentTaskIsPopup ? 'var(--success)' : 'var(--border-soft)'}; border-radius: 15px; position: relative; transition: all 0.3s ease; cursor: pointer;" onclick="togglePopupMode()">
                        <div style="position:absolute; top:4px; left:4px; width:20px; height:20px; background:white; border-radius:50%; transition:transform 0.3s; transform: translateX(${currentTaskIsPopup ? '20px' : '0'}); box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></div>
                    </div>
                </div>
                
                <div id="buzonOptions" style="display: ${currentTaskIsPopup ? 'flex' : 'none'}; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-soft); padding-top: 10px;">
                    <div style="font-size: 11px; color: var(--text-sub); font-weight: bold; text-transform: uppercase;">1. ¿Qué día?</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <div class="custom-option-chip ${isToday ? 'selected' : ''}" onclick="setPopupDate('today')">📅 <span>Hoy</span></div>
                        <div class="custom-option-chip ${isTomorrow ? 'selected' : ''}" onclick="setPopupDate('tomorrow')">📆 <span>Mañana</span></div>
                        <div class="custom-option-chip ${isOther ? 'selected' : ''}" style="position:relative; overflow: hidden;">
                            🗓️ <span>${isOther ? currentTaskPopupDate : 'Otro día'}</span>
                            <input type="date" style="position:absolute; top:0; left:0; width:100%; height:200%; opacity:0; cursor: pointer;" onchange="setPopupDate(this.value)">
                        </div>
                    </div>
                    
                    <div style="font-size: 11px; color: var(--text-sub); font-weight: bold; text-transform: uppercase; margin-top: 5px;">2. ¿A qué hora?</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <div class="custom-option-chip ${currentTaskPopupTime === '08:00' ? 'selected' : ''}" onclick="setPopupTime('08:00')">🌅 <span>Mañana (8am)</span></div>
                        <div class="custom-option-chip ${currentTaskPopupTime === '15:00' ? 'selected' : ''}" onclick="setPopupTime('15:00')">☀️ <span>Tarde (3pm)</span></div>
                        <div class="custom-option-chip ${currentTaskPopupTime === '20:00' ? 'selected' : ''}" onclick="setPopupTime('20:00')">🌙 <span>Noche (8pm)</span></div>
                    </div>
                </div>
            </div>
        `;
    }
};

window.selectTaskOption = (type, val, extraIcon) => {
    if (type === 'category') {
        currentTaskCategory = val;
        document.getElementById('categoryIconBtn').innerHTML = extraIcon || '🗂️';
    } else if (type === 'importance') {
        currentTaskImportance = val;
        document.getElementById('importanceIconBtn').innerHTML = window.getImportanceIcon(val);
    }
    document.getElementById('customTaskOptionsPanel').style.display = 'none';
    window.currentActivePanel = null;
    
    // Devuelve el foco al campo de texto para que el teclado no desaparezca bruscamente
    const textarea = document.getElementById('sheetTaskInput');
    if (textarea) textarea.focus();
};

window.togglePopupMode = () => {
    currentTaskIsPopup = !currentTaskIsPopup;
    if (currentTaskIsPopup && !currentTaskPopupDate) currentTaskPopupDate = getTodayStr();
    document.getElementById('buzonIconBtn')?.classList.toggle('active', currentTaskIsPopup);
    toggleTaskOptionPanel('buzon');
};

window.setPopupDate = (val) => {
    if (val === 'today') currentTaskPopupDate = getTodayStr();
    else if (val === 'tomorrow') currentTaskPopupDate = getTomorrowStr();
    else {
        const [y, m, d] = val.split('-');
        currentTaskPopupDate = `${d}/${m}/${y}`;
    }
    currentTaskIsPopup = true;
    document.getElementById('buzonIconBtn')?.classList.add('active');
    toggleTaskOptionPanel('buzon');
};

window.setPopupTime = (val) => {
    currentTaskPopupTime = val;
    currentTaskIsPopup = true;
    document.getElementById('buzonIconBtn')?.classList.add('active');
    toggleTaskOptionPanel('buzon');
};

window.showPopupReminder = (task) => {
    const modal = document.getElementById('popupReminderModal');
    const textEl = document.getElementById('popupTaskText');
    if (!modal || !textEl) return;
    activePopupTaskId = task.id;
    textEl.innerText = task.text;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
    try { new Audio('assets/ding.mp3').play().catch(()=>{}); } catch (e) {}
};

window.snoozePopupTask = () => {
    if (!activePopupTaskId) return;
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const task = tasks.find(t => t.id === activePopupTaskId);
    if (task) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 10);
        task.popupTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        task.popupNotified = false;
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
    window.closePopupReminder();
    alert("Te lo recordaré de nuevo en 10 minutos.");
};

window.completePopupTask = () => {
    if (!activePopupTaskId) return;
    window.toggleTaskComplete(activePopupTaskId);
    window.closePopupReminder();
};

window.closePopupReminder = () => {
    const modal = document.getElementById('popupReminderModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
    activePopupTaskId = null;
};

window.shareCurrentTask = () => {
    const text = document.getElementById('sheetTaskInput').value.trim();
    if (!text) {
        alert("Escribe algo para compartir primero.");
        return;
    }
    if (navigator.share) {
        navigator.share({
            title: 'Tarea',
            text: text
        }).catch(err => console.error('Error al compartir:', err));
    } else {
        alert("La función de compartir no está soportada en este navegador.");
    }
};

async function setupTaskReminder(text, timeStr, dateStr) {
    if (typeof Notifications === 'undefined' || !Notifications) return;
    if (!timeStr) return;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return;
    
    const reminderDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], hours, minutes, 0);
    
    if (reminderDate > new Date()) {
        try {
            await Notifications.schedule({
                notifications: [{
                    title: "📝 Tarea: " + text, 
                    body: "Recordatorio de tu tarea programada a las " + timeStr,
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: reminderDate, allowWhileIdle: true },
                    importance: 5,
                    sound: 'res://platform_default',
                    actionTypeId: 'REMINDER_ACTIONS'
                }]
            });
        } catch (err) {
            console.error("Fallo al programar notificación de tarea:", err);
        }
    }
}

// 1. Función para abrir el panel
function openTaskSheet(id = null) {
    const sheet = document.getElementById('taskBottomSheet');
    const input = document.getElementById('sheetTaskInput');
    const fabTask = document.getElementById('openTaskSheetBtn'); // El botón + verde
    
    // Previene el bug donde un objeto Event (clic nativo) se pasa por accidente como ID
    if (id !== null && typeof id === 'object') {
        id = null;
    }

    if (id) {
        // Modo edición
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        currentEditingTaskId = id;
        input.value = task.text;
        currentTaskImportance = task.importance || 'none';
        currentTaskCategory = task.category || 'all';
        currentTaskTime = task.time || '';
        currentTaskIsPopup = task.isPopup || false;
        currentTaskPopupDate = task.popupDate || '';
        currentTaskPopupTime = task.popupTime || '';
    } else {
        // Modo creación
        currentEditingTaskId = null;
        input.value = '';
        currentTaskImportance = 'none';
        currentTaskCategory = currentFilter !== 'all' ? currentFilter : 'all';
        currentTaskTime = '';
        currentTaskIsPopup = false;
        currentTaskPopupDate = getTodayStr(); // Por defecto hoy si se activa el buzón
        currentTaskPopupTime = '';
    }

    // Auto-ajustar la altura del textarea al abrir el panel
    setTimeout(() => {
        if (input) {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }
    }, 10);

    renderTaskOptionsUI();

    document.body.classList.add('stop-scrolling');
    document.body.style.overflow = 'hidden';
    
    if (!id) {
        input.focus();
    }

   
    sheet.classList.add('active'); // Esto dispara la transición CSS
   
    if (!id) {
        setTimeout(() => document.getElementById('sheetTaskInput').focus(), 300);
    }
    
    // OCULTAR el botón + al abrir
    if (fabTask) fabTask.style.display = 'none';

   
}

// ==========================================
// LÓGICA DEL BOTÓN + (CLICK CORTO / DICTADO POR VOZ)
// ==========================================
const fabTaskBtn = document.getElementById('openTaskSheetBtn');
if (fabTaskBtn) {
    // Evita que aparezca el menú de opciones del navegador al mantener presionado
    fabTaskBtn.addEventListener('contextmenu', e => e.preventDefault()); 

    let pressStartTime = 0;
    let longPressVisualTimer;

    const startPress = (e) => {
        pressStartTime = Date.now();
        
        // Solo damos feedback visual y háptico, NO abrimos el mic aquí para evitar bloqueos de seguridad
        longPressVisualTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            // Indicador de que ya puedes soltar para hablar
            fabTaskBtn.style.transform = 'scale(1.1)';
            fabTaskBtn.style.backgroundColor = 'var(--error)';
        }, 500); 
    };

    const cancelPress = (e) => {
        if (!pressStartTime) return; // Evitar ejecuciones duplicadas
        
        clearTimeout(longPressVisualTimer);
        fabTaskBtn.style.transform = '';
        fabTaskBtn.style.backgroundColor = '';
        
        const pressDuration = Date.now() - pressStartTime;
        pressStartTime = 0;

        // Solución: Prevenimos el "Clic Fantasma" que el navegador dispara
        // milisegundos después de soltar el dedo, evitando que toque la tarea de abajo.
        if (e && e.cancelable) e.preventDefault();

        if (pressDuration >= 500) {
            // El micrófono se abre AL SOLTAR el dedo (acción directa de usuario 100% permitida)
            startVoiceDictation(); 
        } else {
            openTaskSheet();
        }
    };

    // Eventos táctiles (Móvil)
    fabTaskBtn.addEventListener('touchstart', startPress, { passive: true });
    fabTaskBtn.addEventListener('touchend', cancelPress);

    // Eventos de ratón (PC)
    fabTaskBtn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; 
        startPress(e);
    });
    fabTaskBtn.addEventListener('mouseup', cancelPress);
    fabTaskBtn.addEventListener('mouseleave', () => {
        if (pressStartTime) {
            clearTimeout(longPressVisualTimer);
            fabTaskBtn.style.transform = '';
            fabTaskBtn.style.backgroundColor = '';
            pressStartTime = 0;
        }
    });
}

function startVoiceDictation() {
    // Detectamos si estamos en la app instalada (Celular)
    const isNativeApp = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() !== 'web';
    
    if (isNativeApp) {
        // En Android/iOS nativo, el WebView bloquea el micrófono por seguridad.
        // Lo mejor es abrir la tarea y usar el micrófono integrado en el teclado del celular.
        openTaskSheet();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Tu dispositivo o navegador no soporta el dictado por voz.");
        openTaskSheet();
        return;
    }

    const fabTaskBtn = document.getElementById('openTaskSheetBtn');
    const fabIcon = fabTaskBtn.querySelector('.fab-icon');
    const fabText = fabTaskBtn.querySelector('.fab-text');
    
    // Guardamos el estado original del botón flotante
    const originalIconHTML = fabIcon.innerHTML;
    const originalTextHTML = fabText.innerHTML;
    const originalBackground = fabTaskBtn.style.background;
    
    // Cambiamos el botón para que muestre el micrófono y evite abrir el teclado
    fabTaskBtn.classList.add('auto-expanded');
    fabTaskBtn.style.background = 'var(--error)'; // Rojo para indicar grabación
    fabIcon.innerHTML = '🎙️';
    fabText.innerText = 'Escuchando...';

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; 
    recognition.interimResults = true; 
    recognition.continuous = false; 

    let finalTranscript = '';
    let lastTranscript = '';
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
        }
        
        lastTranscript = finalTranscript + interimTranscript;
        
        // Muestra en vivo lo que estás diciendo dentro del botón expandido
        if (lastTranscript) {
            fabText.innerText = lastTranscript;
        }
    };

    recognition.onerror = (e) => {
        console.error("Error de micrófono:", e.error);
        
        if (e.error === 'not-allowed') {
            alert("Permiso denegado 🚫\n\nEl navegador o dispositivo ha bloqueado el micrófono. Si estás en el móvil, asegúrate de estar en una conexión segura (HTTPS) o permite el acceso en la configuración.");
        } else if (e.error === 'network') {
            alert("Sin conexión 🌐\nEl dictado por voz necesita internet para funcionar.");
        }
        
        restoreFabButton();
    };
    
    recognition.onend = () => {
        restoreFabButton();
        const textoGrabado = lastTranscript.trim();
        
        if (textoGrabado) {
            // Guardar automáticamente la tarea sin necesidad de confirmación
            let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
            localStorage.setItem('totalCreatedToday', total + 1);

            const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
            const taskDate = isCalendarView ? selectedCalendarDate : getTodayStr();
            
            tasks.push({ 
                id: Date.now(), 
                text: textoGrabado, 
                emoji: selectedEmoji || '📝', 
                completed: false,
                date: taskDate,
                icon: determineSmartIcon(textoGrabado)
            });
            
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderAll();
            
            if (isCalendarView) {
                renderCalendar(); 
                renderCalendarTasks(selectedCalendarDate); 
            }
        }
    };

    function restoreFabButton() {
        fabTaskBtn.style.background = originalBackground;
        fabIcon.innerHTML = originalIconHTML;
        fabText.innerHTML = originalTextHTML;
        
        // Lo dejamos expandido un ratito para que la transición de guardado sea natural
        setTimeout(() => {
            fabTaskBtn.classList.remove('auto-expanded');
        }, 1500);
    }

    recognition.start();
}

function determineSmartIcon(text) {
    const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Ignora mayúsculas y acentos
    if (/\b(estudiar|estudio|leer|libro|papel|tarea|universidad|colegio|escuela|examen|repaso|aprender)\b/.test(t)) return 'book';
    if (/\b(comprar|compra|super|mercado|despensa|tienda|abarrotes)\b/.test(t)) return 'cart';
    if (/\b(gym|gimnasio|ejercicio|entrenar|rutina|correr|pesas|deporte|entrenamiento)\b/.test(t)) return 'gym';
    if (/\b(trabajo|trabajar|oficina|reunion|meeting|jefe|proyecto|codigo|programar)\b/.test(t)) return 'work';
    if (/\b(medico|doctor|pastilla|medicina|salud|hospital|cita|clinica|dentista|terapia)\b/.test(t)) return 'health';
    if (/\b(llamar|llamada|telefono|contactar|marcar)\b/.test(t)) return 'call';
    if (/\b(correo|email|mensaje|enviar|responder|mail|escribir)\b/.test(t)) return 'mail';
    if (/\b(banco|pagar|pago|dinero|factura|tarjeta|transferencia|deuda|cobrar)\b/.test(t)) return 'finance';
    if (/\b(comer|comida|cena|almuerzo|desayuno|restaurante|cocinar|receta|hambre)\b/.test(t)) return 'food';
    if (/\b(pensar|idea|planear|organizar|crear|inventar|disenar)\b/.test(t)) return 'idea';
    return 'none';
}

window.saveTaskFromSheet = function saveTaskFromSheet() {
    const newText = document.getElementById('sheetTaskInput').value.trim();
    const fabTask = document.getElementById('openTaskSheetBtn'); // El botón + verde
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    
    if (newText) {
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const taskEmoji = currentTaskCategory !== 'all' ? currentTaskCategory : selectedEmoji;

        if (currentEditingTaskId) {
            tasks = tasks.map(t => t.id === currentEditingTaskId ? { 
                ...t, 
                text: newText,
                emoji: taskEmoji,
                importance: currentTaskImportance,
                category: currentTaskCategory,
                time: currentTaskTime,
                icon: determineSmartIcon(newText),
                isPopup: currentTaskIsPopup,
                popupDate: currentTaskPopupDate,
                popupTime: currentTaskPopupTime,
                popupNotified: false // Se resetea por si cambiaste la hora
            } : t);
        } else {
            let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
            localStorage.setItem('totalCreatedToday', total + 1);

            const taskDate = selectedViewDate;
            
            tasks.push({ 
                id: Date.now(), 
                text: newText, 
                emoji: taskEmoji, 
                completed: false,
                date: taskDate,
                importance: currentTaskImportance,
                category: currentTaskCategory,
                time: currentTaskTime,
                icon: determineSmartIcon(newText),
                isPopup: currentTaskIsPopup,
                popupDate: currentTaskPopupDate,
                popupTime: currentTaskPopupTime,
                popupNotified: false
            });
        }
        localStorage.setItem('tasks', JSON.stringify(tasks));

        if (currentTaskTime) {
            setupTaskReminder(newText, currentTaskTime, selectedViewDate);
        }
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

// ==========================================
// VISTA DE DETALLE DE HÁBITO
// ==========================================

const getDateKey = (date = new Date()) => {
    if (!(date instanceof Date) || isNaN(date)) {
        date = new Date(); // Fallback seguro para evitar cuelgues
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function openHabitDetailView(habitId) {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = reminders.find(r => r.id === habitId);
    if (!habit) return;

    const view = document.getElementById('view-habit-detail');
    if (!view) return;

    // Ocultar otras vistas y mostrar esta
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    view.style.display = 'flex';

    // Ocultar botones flotantes
    document.querySelectorAll('.fab-btn, #openTaskSheetBtn, .dynamic-reminder-bar').forEach(btn => {
        if(btn) btn.style.display = 'none';
    });

    // Calcular completados para hoy
    const todayKey = getDateKey();
    const historyForHabit = habitHistory[habitId] || [];
    const completionsToday = historyForHabit.filter(ts => getDateKey(new Date(ts)) === todayKey).length;
    const totalTimesToday = (habit.times || [habit.time]).length;
    const isFullyCompletedToday = completionsToday >= totalTimesToday;

    const colorStyle = (habit.color) ? `background: ${habit.color}; color: white;` : '';

    view.innerHTML = `
        <div class="habit-detail-header">
            <div class="habit-detail-title-wrapper">
                <div class="habit-detail-icon" style="${colorStyle}">${habit.emoji}</div>
                <h2 class="habit-detail-title">${habit.text}</h2>
            </div>
            <button id="closeHabitDetailBtn" class="action-btn">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
        </div>

        <div class="habit-detail-main">
            <div id="habitCompleteBtn" class="habit-complete-btn ${isFullyCompletedToday ? 'completed' : ''}" onclick="completeHabitInstance(${habit.id})">
                <div class="completion-burst"></div>
                <div class="habit-complete-icon">${isFullyCompletedToday ? '🎉' : '✔️'}</div>
                <div class="habit-complete-text">${isFullyCompletedToday ? '¡Logrado!' : 'Completar'}</div>
            </div>
            <div class="habit-completion-count">Completado ${completionsToday} de ${totalTimesToday} vez/veces hoy</div>
        </div>

        <div id="habitStatsContainer" class="habit-stats-container">
            <!-- Las estadísticas se renderizarán aquí -->
        </div>
    `;

    renderHabitStats(habitId, view.querySelector('#habitStatsContainer'));

    view.querySelector('#closeHabitDetailBtn').onclick = () => {
        view.style.display = 'none';
        const remindersView = document.getElementById('view-reminders');
        remindersView.style.display = 'block';
        const fabRem = document.getElementById('openReminderSheetBtn');
        if (fabRem) fabRem.style.display = 'flex';
        renderAll();
    };
}

function completeHabitInstance(habitId) {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = reminders.find(r => r.id === habitId);
    if (!habit) return;

    const todayKey = getDateKey();
    const historyForHabit = habitHistory[habitId] || [];
    const completionsToday = historyForHabit.filter(ts => getDateKey(new Date(ts)) === todayKey).length;
    const totalTimesToday = (habit.times || [habit.time]).length;

    if (completionsToday >= totalTimesToday) {
        return;
    }

    if (!habitHistory[habitId]) {
        habitHistory[habitId] = [];
    }
    habitHistory[habitId].push(Date.now());
    localStorage.setItem('habitHistory', JSON.stringify(habitHistory));

    const btn = document.getElementById('habitCompleteBtn');
    playCompletionSound();

    if (btn) {
        btn.classList.add('animating');
        setTimeout(() => {
            btn.classList.remove('animating');
            openHabitDetailView(habitId); // Recargamos la vista DESPUÉS de la animación
        }, 600);
    } else {
        openHabitDetailView(habitId);
    }
}

function renderHabitStats(habitId, container) {
    if (!container) return;

    const historyForHabit = habitHistory[habitId] || [];
    const totalCompletions = historyForHabit.length;

    let currentStreak = 0;
    let longestStreak = 0;
    if (historyForHabit.length > 0) {
        // Filtramos fechas válidas y obtenemos días únicos en formato YYYY-MM-DD a prueba de zonas horarias
        const uniqueDays = [...new Set(historyForHabit.map(ts => {
            const d = new Date(ts);
            return isNaN(d) ? null : getDateKey(d);
        }).filter(Boolean))].sort((a, b) => b.localeCompare(a)); // Orden descendente
        
        let streak = 0;
        let lastDate = null;

        for (let i = 0; i < uniqueDays.length; i++) {
            const d = new Date(uniqueDays[i] + 'T00:00:00');
            if (i === 0) {
                streak = 1;
            } else {
                const prev = new Date(lastDate + 'T00:00:00');
                const diff = Math.round((prev - d) / 86400000); // 86400000 ms = 1 día
                if (diff === 1) {
                    streak++;
                } else {
                    longestStreak = Math.max(longestStreak, streak);
                    streak = 1;
                }
            }
            lastDate = uniqueDays[i];
        }
        longestStreak = Math.max(longestStreak, streak);

        const todayStr = getDateKey(new Date());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = getDateKey(yesterdayDate);

        if (uniqueDays.length > 0 && (uniqueDays[0] === todayStr || uniqueDays[0] === yesterdayStr)) {
             currentStreak = 1;
             for (let i = 0; i < uniqueDays.length - 1; i++) {
                const prev = new Date(uniqueDays[i] + 'T00:00:00');
                const curr = new Date(uniqueDays[i+1] + 'T00:00:00');
                const diff = Math.round((prev - curr) / 86400000);
                if (diff === 1) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        } else {
            currentStreak = 0;
        }
    }

    const heatmapContainer = document.createElement('div');
    heatmapContainer.className = 'habit-heatmap-container';
    const heatmap = document.createElement('div');
    heatmap.className = 'habit-heatmap';

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 180);

    const completionsByDay = {};
    historyForHabit.forEach(ts => {
        const d = new Date(ts);
        if (!isNaN(d)) {
            const dayKey = getDateKey(d);
            completionsByDay[dayKey] = (completionsByDay[dayKey] || 0) + 1;
        }
    });

    const firstDayOfWeek = startDate.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
        heatmap.appendChild(document.createElement('div'));
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayKey = getDateKey(new Date(d));
        const count = completionsByDay[dayKey] || 0;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'heatmap-day';
        
        let level = 0;
        if (count > 0) level = 1;
        if (count > 1) level = 2;
        if (count > 3) level = 3;
        if (count > 5) level = 4;
        
        if (level > 0) {
            dayDiv.dataset.level = level;
        }
        heatmap.appendChild(dayDiv);
    }
    heatmapContainer.appendChild(heatmap);

    container.innerHTML = `
        <h3 class="section-subtitle" style="text-align: left; margin-left: 0;">Estadísticas</h3>
        <div class="habit-stats-grid">
            <div class="habit-stat-item">
                <div class="habit-stat-value">${currentStreak} días</div>
                <div class="habit-stat-label">Racha Actual</div>
            </div>
            <div class="habit-stat-item">
                <div class="habit-stat-value">${longestStreak} días</div>
                <div class="habit-stat-label">Mejor Racha</div>
            </div>
        </div>
        <h3 class="section-subtitle" style="text-align: left; margin-left: 0; margin-top: 15px;">Actividad (Últimos 6 meses)</h3>
        ${heatmapContainer.outerHTML}
    `;
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
        if (bottomNav) {
            bottomNav.style.visibility = 'hidden';
            bottomNav.style.opacity = '0';
        }
        document.body.classList.add('keyboard-open');
        const editorHeader = document.querySelector('.editor-header');
        if (editorHeader) {
            editorHeader.style.bottom = '0px'; 
        }
    } else {
        // El teclado se cerró
        if (bottomNav) {
            bottomNav.style.visibility = 'visible';
            bottomNav.style.opacity = '1';
        }
        document.body.classList.remove('keyboard-open');
    }
});

// Busca el evento de 'input' de taskSearchInput al final de app.js y cámbialo:
document.getElementById('taskSearchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const today = getTodayStr();

    // 1. Primero aplicamos el filtro de fecha (Hoy o Vencidas)
    let filtered = allTasks.filter(t => 
        t.date === today || !t.date || (!t.completed && isOverdue(t.date))
    );

    // 2. Luego aplicamos el filtro de búsqueda por texto
    if (term) {
        filtered = filtered.filter(t => t.text.toLowerCase().includes(term));
    }

    // 3. Dibujamos solo lo que pasó ambos filtros
    const pending = filtered.filter(t => !t.completed);
    drawTasks(pending, 'taskList', false, 'tasks');
});
const addNewCategoryBtn = document.getElementById('addNewCategoryBtn');
if (addNewCategoryBtn) {
    addNewCategoryBtn.onclick = () => {
        const container = document.querySelector('.filter-container');
        if (container) {
            container.classList.toggle('expanded');
            
            // Animación elástica del botón + (se gira a 45 grados como una X con rebote)
            addNewCategoryBtn.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            if (container.classList.contains('expanded')) {
                addNewCategoryBtn.style.transform = 'rotate(45deg)';
            } else {
                addNewCategoryBtn.style.transform = 'rotate(0deg)';
            }
        }
    };
}

// ==========================================
// LÓGICA DEL ESTADO DE ÁNIMO (MOOD)
// ==========================================
const moodWidget = document.getElementById('moodWidget');
const moodBtnEl = document.getElementById('moodBtn');
let moodWidgetTimeout;

if (moodWidget && moodBtnEl) {
    // Expandir/Comprimir
    moodBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = moodWidget.classList.toggle('expanded');
        
        clearTimeout(moodWidgetTimeout);
        if (isExpanded) {
            moodWidgetTimeout = setTimeout(() => {
                moodWidget.classList.remove('expanded');
            }, 5000); // Se cierra solo a los 3 segundos
        }
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!moodWidget.contains(e.target)) {
            moodWidget.classList.remove('expanded');
            clearTimeout(moodWidgetTimeout);
        }
    });

    // Al hacer clic en un emoji
    document.querySelectorAll('.mood-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            clearTimeout(moodWidgetTimeout);
            const mood = e.target.dataset.mood;
            const todayStr = getTodayStr();
            
            // --- NUEVO: Animación de emoji flotante ---
            const rect = e.target.getBoundingClientRect();
            const floater = document.createElement('div');
            floater.className = 'floating-emoji';
            floater.innerText = mood;
            floater.style.left = `${rect.left + rect.width / 2 - 15}px`; // Centrar respecto al botón presionado
            floater.style.top = `${rect.top}px`;
            document.body.appendChild(floater);
            
            setTimeout(() => {
                if (floater.parentNode) floater.remove();
            }, 1000);

            // Guardar en el localStorage
            let moods = JSON.parse(localStorage.getItem('moods') || '{}');
            moods[todayStr] = mood;
            localStorage.setItem('moods', JSON.stringify(moods));
            
            // Cerrar y actualizar la pantalla
            moodWidget.classList.remove('expanded');
            updateMoodUI();
            renderAll(); // Refresca calendario y vista semanal
        });
    });
}

function updateMoodUI() {
    const moods = JSON.parse(localStorage.getItem('moods') || '{}');
    const todayStr = getTodayStr();
    const currentMood = moods[todayStr];
    
    const btn = document.getElementById('moodBtn');
    if (btn) {
        if (currentMood) {
            btn.innerHTML = currentMood;
        } else {
            // SVG de emoji sonriente como el de reaccionar en WhatsApp
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-sub);"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`;
        }
    }
}

// Cargar el estado guardado al abrir la app
document.addEventListener('DOMContentLoaded', updateMoodUI);
updateMoodUI(); // Ejecutar inmediatamente por si el DOM ya cargó


// --- C. LÓGICA DEL CALENDARIO ---
document.getElementById('openCalendarBtn').onclick = () => {
    document.getElementById('view-today').style.display = 'none';
    document.getElementById('view-calendar').style.display = 'block';
    renderCalendar();
    
};

document.getElementById('closeCalendarBtn').onclick = () => {
    document.getElementById('view-calendar').style.display = 'none';
    document.getElementById('view-today').style.display = 'block';
    renderAll();
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

function renderWeekView() {
    const displayArea = document.getElementById('tasksDisplayArea');
    if (!displayArea) return;

    let container = document.getElementById('week-view-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'week-view-container';
        container.className = 'week-view-container';
        displayArea.appendChild(container);
    }
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);
    const todayStr = getTodayStr();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const moods = JSON.parse(localStorage.getItem('moods') || '{}');

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);

    let activeDayElement = null;

    for (let i = 0; i < 61; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        const dayStr = `${day.getDate().toString().padStart(2, '0')}/${(day.getMonth() + 1).toString().padStart(2, '0')}/${day.getFullYear()}`;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'week-day';
        if (dayStr === selectedViewDate) {
            dayDiv.classList.add('active');
            activeDayElement = dayDiv;
        }
        if (dayStr === todayStr) dayDiv.classList.add('today');

        // Añadir el emoji del estado de ánimo si existe
        const moodEmoji = moods[dayStr] ? `<span style="font-size: 10px; margin-left: 2px;">${moods[dayStr]}</span>` : '';

        dayDiv.innerHTML = `
            <div class="day-name">${dayStr === todayStr ? 'Hoy' : dayNames[day.getDay()]}</div>
            <div class="day-number" style="display: flex; align-items: center; justify-content: center;">${day.getDate()} ${moodEmoji}</div>
        `;

        let longPressTimer;
        let isLongPress = false;

        const startPress = () => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                if (navigator.vibrate) navigator.vibrate(50);

                selectedViewDate = dayStr;
                const parts = dayStr.split('/');
                calendarDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                
                document.getElementById('view-today').style.display = 'none';
                document.getElementById('view-calendar').style.display = 'block';
                renderCalendar();
                renderCalendarTasks(selectedViewDate);
            }, 700);
        };

        const cancelPress = () => clearTimeout(longPressTimer);

        dayDiv.addEventListener('touchstart', startPress, { passive: true });
        dayDiv.addEventListener('touchend', cancelPress);
        dayDiv.addEventListener('touchmove', cancelPress);

        dayDiv.onclick = () => {
            if (isLongPress) return;
            selectedViewDate = dayStr;
            renderAll();
        };
        container.appendChild(dayDiv);
    }

    if (activeDayElement) {
        setTimeout(() => {
            activeDayElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 100);
    }
}

// Identificamos el botón de menú (el de las tres rayas o puntos)


function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const monthYearText = document.getElementById('currentMonthYear');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const moods = JSON.parse(localStorage.getItem('moods') || '{}');
    container.innerHTML = '';

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    let monthStr = calendarDate.toLocaleDateString('es-ES', { month: 'long' });
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
    monthYearText.innerText = `${monthStr} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = getTodayStr();

    // Espacios vacíos
    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        container.appendChild(emptyDiv);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const d = day.toString().padStart(2, '0');
        const m = (month + 1).toString().padStart(2, '0');
        const dateKey = `${d}/${m}/${year}`;
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const currentDayOfWeek = new Date(year, month, day).getDay();
        if (currentDayOfWeek === 0) dayDiv.style.color = 'var(--error)';
        
        // Añadir el emoji del estado de ánimo si existe
        const currentMood = moods[dateKey];
        const moodEmoji = currentMood ? `<div style="font-size: 10px; position: absolute; top: -5px; right: -5px;">${currentMood}</div>` : '';
        
        dayDiv.innerHTML = `${day}${moodEmoji}`;

        // --- NUEVO: Color de fondo según el estado de ánimo ---
        if (currentMood) {
            if (currentMood === '🤩') dayDiv.classList.add('mood-amazing');
            else if (currentMood === '😊') dayDiv.classList.add('mood-happy');
            else if (currentMood === '😐') dayDiv.classList.add('mood-neutral');
            else if (currentMood === '😔') dayDiv.classList.add('mood-sad');
            else if (currentMood === '😫') dayDiv.classList.add('mood-terrible');
        }
        
        // 1. MARCADOR: Si este día tiene tareas, añadimos el puntito visual
        const hasTasks = tasks.some(t => t.date === dateKey);
        if (hasTasks) dayDiv.classList.add('has-tasks');

        // 2. HOY: Resaltar con círculo sólido si es hoy
        if (dateKey === todayStr) dayDiv.classList.add('today'); // This class is from calendar, not week-view

        // 3. SELECCIÓN: Resaltar el día que estamos viendo
        if (dateKey === selectedViewDate) dayDiv.classList.add('active');

        dayDiv.onclick = () => {
            selectedViewDate = dateKey; // Actualizamos la fecha seleccionada
            renderCalendar(); // Refresca los estilos (clase active)
            renderCalendarTasks(dateKey); // Carga las tareas de ese día
        };
        container.appendChild(dayDiv);
    }
}

// Gestos para cambiar de mes deslizando en el calendario
let calendarStartX = 0;
const calContainer = document.getElementById('calendar-container');
if (calContainer) {
    calContainer.addEventListener('touchstart', e => {
        calendarStartX = e.touches[0].clientX;
    }, { passive: true });
    
    calContainer.addEventListener('touchend', e => {
        if (!calendarStartX) return;
        const diffX = e.changedTouches[0].clientX - calendarStartX;
        if (diffX > 50) document.getElementById('prevMonth').click(); // Swipe derecha
        else if (diffX < -50) document.getElementById('nextMonth').click(); // Swipe izquierda
        calendarStartX = 0;
    });
}

// Función para dibujar las tareas de un día específico en el calendario
function renderCalendarTasks(date) {
    // 1. Función para normalizar (quitar ceros extra o ponerlos)
    // Esto convierte "16/3/2026" y "16/03/2026" en lo mismo
    const normalize = (d) => d.split('/').map(n => parseInt(n)).join('/');

    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // 2. Normalizamos la fecha que buscamos
    const buscaFecha = normalize(date);

    // 3. Filtramos comparando ambas fechas normalizadas
    const tasksForDay = allTasks.filter(t => {
        // Si por alguna razón t.date no existe, evitamos que la app explote
        if (!t.date) return false;
        return normalize(t.date) === buscaFecha;
    });

    console.log(`--- Filtro Inteligente ---`);
    console.log(`Buscando: ${buscaFecha} | Encontradas: ${tasksForDay.length}`);

    // 4. Dibujamos
    drawTasks(tasksForDay, 'calendarTaskList', false, 'tasks');
    
    const title = document.getElementById('selectedDateTitle');
    if (title) title.innerText = `Tareas para el ${date}`;
}


btnJava.onclick = (e) => {
    e.stopPropagation(); // Evita que se cierre instantáneamente al abrir
    const isExpanded = wrapper.classList.contains('expanded');
    
    if (!isExpanded) {
        wrapper.classList.add('expanded');
        inputField.focus();
    } else if (inputField.value === '') {
        // Si ya está abierta pero no has escrito nada, la cerramos al tocar la lupa
        wrapper.classList.remove('expanded');
    }
};

// 2. Al hacer clic EN CUALQUIER OTRA PARTE de la pantalla
document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target) && wrapper.classList.contains('expanded')) {
        // Si cerramos el buscador haciendo clic fuera, limpiamos también la búsqueda
        if (inputField.value !== '') {
            inputField.value = '';
            inputField.dispatchEvent(new Event('input')); 
        }
        wrapper.classList.remove('expanded');
    }
});

// 3. Al quitar el foco del teclado (Blur)
inputField.onblur = () => {
    // Si el usuario deja de escribir y no hay texto, se contrae
    setTimeout(() => { // Usamos un mini-delay para no chocar con el clic del botón
        if (inputField.value === '') {
            wrapper.classList.remove('expanded');
        }
    }, 200);
};

// Si el usuario borra la búsqueda en el código de filtrar tareas, 
// recuerda usar el nuevo ID: document.getElementById('taskSearchValue').value
function refreshApp() {
       // Actualiza la lista de hoy
    renderNotes();    // Actualiza las notas
    if (window.fullCalendarInstance) { 
        // Si usas una librería como FullCalendar, usa su método interno
        window.fullCalendarInstance.refetchEvents();
    } else {
        renderCalendar(); // Tu función manual
    }
}

function saveReminder() {
    const text = document.getElementById('reminderInput').value;
    const now = new Date();
    
    // Formato: 02:30 PM
    const timeCreated = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });

    const newReminder = {
        id: Date.now(),
        text: text,
        createdAt: timeCreated, // La "marca" de tiempo
        status: 'active'
    };

    // Guardar en tu localStorage de recordatorios
    let reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    reminders.push(newReminder);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    
    procesarAlarma();
}
let focusInterval;
let timeLeft = 1500; // 25 minutos en segundos
let initialFocusTime = 1500; // Para la animación del círculo
let isPaused = false;

document.getElementById('openFocusBtn').onclick = () => {
    switchNoteView('view-focus');
    // Si tienes un plugin de DND, aquí se activaría
    console.log("Sugerencia: Activar 'No molestar' nativo aquí.");
};

// Función que faltaba para detener y limpiar el temporizador
function stopFocusTimer() {
    clearInterval(focusInterval);
    focusInterval = null;
    isPaused = false;
    document.getElementById('startFocusBtn').innerText = "Iniciar Enfoque";
    
    const pauseBtn = document.getElementById('pauseFocusBtn');
    if (pauseBtn) {
        pauseBtn.style.display = 'none';
    }
}

document.getElementById('closeFocusBtn').onclick = () => {
    stopFocusTimer();
    switchNoteView('view-today');
};

function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    document.getElementById('focusTimer').innerText = 
        `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

document.getElementById('startFocusBtn').onclick = function() {
    if (focusInterval) return; // Ya está corriendo
    
    this.innerText = "Concentrado...";
    isPaused = false;
    
    const pauseBtn = document.getElementById('pauseFocusBtn');
    if (pauseBtn) {
        pauseBtn.style.display = 'inline-block';
        pauseBtn.innerText = "Pausar";
    }
    
    const statusElem = document.getElementById('focusStatus');
    if (statusElem) statusElem.innerText = "Apaga las distracciones";
    
    focusInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        updateZenCircle(timeLeft / initialFocusTime); // Anima el reloj
        
        if (timeLeft <= 0) {
            stopFocusTimer();
            alert("¡Sesión terminada! Buen trabajo, Henry.");
        }
    }, 1000);
};

// --- LÓGICA DEL BOTÓN PAUSAR/REANUDAR ---
const pauseBtn = document.getElementById('pauseFocusBtn');
if (pauseBtn) {
    pauseBtn.onclick = function() {
        if (isPaused) {
            // Reanudar
            isPaused = false;
            this.innerText = "Pausar";
            document.getElementById('startFocusBtn').innerText = "Concentrado...";
            
            focusInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                updateZenCircle(timeLeft / initialFocusTime);
                if (timeLeft <= 0) {
                    stopFocusTimer();
                    alert("¡Sesión terminada! Buen trabajo, Henry.");
                }
            }, 1000);
        } else {
            // Pausar
            isPaused = true;
            clearInterval(focusInterval);
            focusInterval = null;
            this.innerText = "Reanudar";
            document.getElementById('startFocusBtn').innerText = "Pausado";
        }
    };
}

// 4. LÓGICA DEL RELOJ CIRCULAR
let zenInterval;
function updateZenCircle(percent) {
    const circle = document.getElementById('timerProgress');
    const offset = 283 - (percent * 283);
    circle.style.strokeDashoffset = offset;
}

function setFocusTime(min) {
    timeLeft = min * 60;
    initialFocusTime = timeLeft;
    updateTimerDisplay();
    updateZenCircle(1);
}

// --- 5. LÓGICA PARA CAMBIAR EL FONDO DEL MODO CONCENTRACIÓN ---
const focusBackgrounds = [
    '../assets/FONDO.jpg',
    '../assets/FONDO1.jpg',
    '../assets/FONDO2.jpg',
    '../assets/FONDO3.jpg',
    '../assets/FONDO4.jpg'
];

// Recuperamos el índice guardado o iniciamos en el que usabas por defecto (índice 2)
let currentBgIndex = parseInt(localStorage.getItem('focusBgIndex') || '2');

// Aplicar el fondo guardado justo al inicio
document.getElementById('view-focus').style.backgroundImage = `url('${focusBackgrounds[currentBgIndex]}')`;

document.getElementById('changeBgBtn').onclick = () => {
    // Pasa al siguiente fondo; si llega al último, vuelve al primero
    currentBgIndex = (currentBgIndex + 1) % focusBackgrounds.length;
    localStorage.setItem('focusBgIndex', currentBgIndex);
    document.getElementById('view-focus').style.backgroundImage = `url('${focusBackgrounds[currentBgIndex]}')`;
};

// --- VISOR DE IMÁGENES ---
window.openImageViewer = (src) => {
    const modal = document.getElementById('imageViewerModal');
    const fullImg = document.getElementById('fullSizeImage');
    if (modal && fullImg) {
        fullImg.src = src;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

window.closeImageViewer = () => {
    const modal = document.getElementById('imageViewerModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// Cerrar el visor al hacer clic en el fondo oscuro
document.addEventListener('click', (e) => {
    const imageModal = document.getElementById('imageViewerModal');
    if (imageModal && e.target === imageModal) {
        closeImageViewer();
    }
});

let isDrawing = false;
let ctx;
const noteCanvas = document.getElementById('noteCanvas');

let currentBrushColor = '#000000';
let currentBrushSize = 3;
let isEraserMode = false;

// Inyectar barra de herramientas automáticamente
function setupCanvasTools() {
    const wrapper = document.getElementById('canvasWrapper');
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

// Inicializar Canvas (Llamar solo cuando el contenedor sea visible)
function initCanvas() {
    setupCanvasTools(); // Inyectar botones si no existen
    if (!noteCanvas) return;
    ctx = noteCanvas.getContext('2d');
    const container = document.getElementById('canvasWrapper');
    if (container && container.offsetWidth > 0) {
        noteCanvas.width = container.offsetWidth;
        noteCanvas.height = noteCanvas.offsetHeight || (window.innerHeight * 0.65); // Altura dinámica real de la pantalla
    }
    
    // Rellenar el fondo de blanco (evita la transparencia)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentBrushSize;
    ctx.strokeStyle = isEraserMode ? '#ffffff' : currentBrushColor;
}

// Lógica de dibujo
function startDrawing(e) {
    isDrawing = true;
    if (ctx) ctx.beginPath();
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
    if (ctx) ctx.beginPath();
}

function draw(e) {
    if (!isDrawing || !ctx) return;
    e.preventDefault(); // Evitar scroll al dibujar
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

// Eventos
if (noteCanvas) {
    noteCanvas.addEventListener('touchstart', startDrawing, { passive: false });
    noteCanvas.addEventListener('touchmove', draw, { passive: false });
    noteCanvas.addEventListener('touchend', stopDrawing);
}

// Botón para mostrar/ocultar dibujo
const toggleDrawBtn = document.getElementById('toggleDrawBtn');
if (toggleDrawBtn) {
    toggleDrawBtn.onclick = () => {
        const wrapper = document.getElementById('canvasWrapper');
        if (!wrapper) return;
        const isHidden = wrapper.style.display === 'none' || wrapper.style.display === '';
        wrapper.style.display = isHidden ? 'flex' : 'none';
        
        // Alternar la visibilidad del textarea y fotos dependiendo del lienzo
        document.getElementById('noteInput').style.display = isHidden ? 'none' : 'block';
        if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = isHidden ? 'none' : 'flex';

        if (isHidden) {
            toggleDrawBtn.classList.add('active');
            setTimeout(initCanvas, 10); // Permitimos al HTML desplegarse primero antes de medir la pantalla
        } else {
            toggleDrawBtn.classList.remove('active');
            if (ctx && noteCanvas) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
            }
        }
    };
}

// --- CONTROLES DE DIBUJO ---
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
    if (ctx) ctx.lineWidth = isEraserMode ? size * 2 : size; // Borrador más grueso
    if (btn) {
        document.querySelectorAll('.tool-size').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

window.toggleEraser = (btn) => {
    isEraserMode = true;
    if (ctx) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = currentBrushSize * 2; // El borrador es un poco más grande para ser cómodo
    }
    if (btn) {
        document.querySelectorAll('.tool-color, .tool-eraser').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

window.clearCanvas = () => { 
    if (ctx && noteCanvas) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, noteCanvas.width, noteCanvas.height);
    } 
};

// ==========================================
// NUEVO SISTEMA DE SELECCIÓN MÚLTIPLE (ANCLAR, COPIAR, BORRAR)
// ==========================================

function initMultiSelectBar() {
    if (document.getElementById('multiSelectBar')) return;
    // Crear la barra de acciones dinámicamente
    const bar = document.createElement('div');
    bar.className = 'multi-select-bar';
    bar.id = 'multiSelectBar';
    bar.innerHTML = `
        <button class="ms-btn" onclick="msCancel()"><span>❌</span>Cancelar</button>
        <button class="ms-btn" onclick="msPin()"><span>📌</span>Anclar</button>
        <button class="ms-btn" onclick="msCopy()"><span>📋</span>Copiar</button>
        <button class="ms-btn delete" onclick="msDelete()"><span>🗑️</span>Borrar <b id="msCount"></b></button>
    `;
    
    // Anexar de forma segura sin depender exclusivamente de DOMContentLoaded
    if (document.body) {
        document.body.appendChild(bar);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(bar));
    }
}

// Inicializamos la barra inmediatamente para evitar que se pierda el evento de carga
initMultiSelectBar();

window.handleItemClick = (e, element, id, type) => {
    try {
        if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection(element, id, type);
        } else {
            // Comportamiento normal (abrir/editar)
            if (type === 'notes') {
                if (typeof window.openEditNote === 'function') window.openEditNote(id);
            } else if (type === 'reminders' && element.classList.contains('rapid-card')) {
                // Solo los recordatorios rápidos se pueden editar así por ahora
                if (typeof window.expandReminderBar === 'function') window.expandReminderBar(id);
            }
            else {
                if (type === 'tasks' && typeof openTaskSheet === 'function') {
                    openTaskSheet(id);
                }
            }
        }
    } catch (err) {
        console.error("Rescate de emergencia - Error en click:", err);
        isSelectionMode = false; // Evita que la app se trabe si algo falla internamente
    }
};

function toggleSelection(element, id, type) {
    const mapKey = `${type}-${id}`;
    if (selectedItems.has(mapKey)) {
        selectedItems.delete(mapKey);
        if (element) element.classList.remove('selected');
        if (selectedItems.size === 0) exitSelectionMode();
    } else {
        selectedItems.add(mapKey);
        if (element) element.classList.add('selected');
        if (!isSelectionMode) enterSelectionMode();
    }
    updateMultiSelectBar();
}

function enterSelectionMode() {
    isSelectionMode = true;
    const bar = document.getElementById('multiSelectBar');
    if (bar) bar.classList.add('active');
    // Ocultar botones flotantes (+) para que no estorben
    document.querySelectorAll('.fab-btn, #openTaskSheetBtn').forEach(btn => { if(btn) btn.style.transform = 'scale(0)'; });
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedItems.clear();
    const bar = document.getElementById('multiSelectBar');
    if (bar) bar.classList.remove('active');
    // Quitar la clase seleccionada de todas las tarjetas
    document.querySelectorAll('.reminder-card.selected, .alarm-card.selected').forEach(el => el.classList.remove('selected'));
    // Restaurar botones flotantes
    document.querySelectorAll('.fab-btn, #openTaskSheetBtn').forEach(btn => { if(btn) btn.style.transform = 'none'; });
}

function updateMultiSelectBar() {
    const countEl = document.getElementById('msCount');
    if (countEl) countEl.innerText = `(${selectedItems.size})`;
}

window.msCancel = () => exitSelectionMode();

window.msDelete = () => {
    if (!confirm(`¿Borrar ${selectedItems.size} elemento(s)?`)) return;
    
    selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        list = list.filter(i => String(i.id) !== String(id));
        localStorage.setItem(type, JSON.stringify(list));
        
        // Eliminar alarma programada si era un recordatorio
        if (type === 'reminders' && typeof Notifications !== 'undefined' && Notifications) {
            Notifications.cancel({ notifications: [{ id: id }] });
        }
    });
    exitSelectionMode();
    renderAll();
};

// ==========================================
// NUEVO BOTÓN DINÁMICO INFERIOR PARA ALARMAS
// ==========================================

function initDynamicReminderUI() {
    if (document.getElementById('reminderBottomSheet')) return;
    
    const uiHTML = `
        <button id="openReminderSheetBtn" class="fab-btn" onclick="expandReminderBar()" style="display: none; background: #F2994A;">
            <span class="fab-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M5 3 2 6"></path><path d="M19 3l3 3"></path><path d="M12 9v4l2 2"></path></svg>
            </span>
            <span class="fab-text">Añadir alarma</span>
        </button>

        <div id="reminderBottomSheet" class="bottom-sheet">
            <div class="sheet-content" style="height: auto; max-height: 85vh;">
                <div class="sheet-handle"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <button class="action-btn" onclick="collapseReminderBar()">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <h3 id="remSheetTitle" style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main);">Nueva Alarma</h3>
                    <div style="width: 40px;"></div>
                </div>
                
                <div class="rem-input-row" style="background: transparent; border: none; padding: 0; border-bottom: 2px solid var(--border-soft); border-radius: 0; margin-bottom: 20px;">
                    <input type="text" id="remDynamicInput" placeholder="Ej: Tomar agua 15:30" autocomplete="off" style="font-size: 18px; font-weight: 600; padding: 10px 0; width: 100%; border: none; outline: none; background: transparent; color: var(--text-main);">
                </div>
                
                <h4 class="section-subtitle" style="margin-left: 0; margin-bottom: 10px;">Atajos Rápidos</h4>
                <div id="remPresetsContainer" class="rem-presets" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 25px;">
                    <!-- Se renderizan dinámicamente -->
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-soft); margin-top: auto;">
                    <div class="toolbar-item" title="Añadir hora">
                        <div class="icon-btn" onclick="openCustomTimePicker()">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                    </div>
                <button class="btn-save-task" style="background-color: var(--accent) !important; color: #ffffff !important; border-radius: 20px; width: 56px; height: 40px; border: none; box-shadow: none;" onclick="saveDynamicReminder()">
                    <svg viewBox="0 0 24 24" class="save-task-icon" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', uiHTML);

    window.renderRemPresets();

    const initialDynBar = document.getElementById('openReminderSheetBtn');
    if (initialDynBar && document.getElementById('view-reminders') && document.getElementById('view-reminders').style.display !== 'none') {
        initialDynBar.style.display = 'flex';
    }

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            const fabRem = document.getElementById('openReminderSheetBtn');
            if (fabRem) {
                if (targetView === 'view-reminders') {
                    fabRem.style.display = 'flex';
                    fabRem.classList.remove('auto-expanded');
                    
                    clearTimeout(window.remFabTimeout);
                    clearTimeout(window.remFabCloseTimeout);
                    
                    window.remFabTimeout = setTimeout(() => {
                        fabRem.classList.add('auto-expanded');
                        window.remFabCloseTimeout = setTimeout(() => {
                            fabRem.classList.remove('auto-expanded');
                        }, 4000);
                    }, 1500);
                } else {
                    fabRem.style.display = 'none';
                    clearTimeout(window.remFabTimeout);
                    clearTimeout(window.remFabCloseTimeout);
                }
            }
        });
    });

    setTimeout(() => {
        const fabRem = document.getElementById('openReminderSheetBtn');
        if (fabRem && document.getElementById('view-reminders').style.display !== 'none') {
            fabRem.classList.add('auto-expanded');
            setTimeout(() => {
                fabRem.classList.remove('auto-expanded');
            }, 4000);
        } else if (fabRem) {
            fabRem.style.display = 'none';
        }
    }, 1500);
}

window.renderRemPresets = () => {
    const container = document.getElementById('remPresetsContainer');
    if (!container) return;
    
    // Cargar los atajos, con 1 y 5 por defecto si no hay nada guardado
    const customPresets = JSON.parse(localStorage.getItem('customRemPresets') || '[1, 5]');
    
    let html = customPresets.map(min => {
        const label = min >= 60 && min % 60 === 0 ? `+${min/60} h` : `+${min.toString().padStart(2, '0')} min`;
        return `<button class="rem-preset-btn" oncontextmenu="event.preventDefault(); window.removeRemPreset(${min});" onclick="addMinutesToDynamicInput(${min})">${label}</button>`;
    }).join('');
    
    html += `<button class="rem-preset-btn" style="background: var(--pastel-blue); color: var(--accent); border-color: var(--accent); font-weight: bold; padding: 6px 16px;" title="Añadir atajo" onclick="addNewRemPreset()">+</button>`;
    container.innerHTML = html;

    // Soporte táctil para borrar (manteniendo presionado)
    const btns = container.querySelectorAll('.rem-preset-btn:not(:last-child)');
    btns.forEach((btn, idx) => {
        let timer;
        btn.ontouchstart = () => { timer = setTimeout(() => { if(navigator.vibrate) navigator.vibrate(50); window.removeRemPreset(customPresets[idx]); }, 800); };
        btn.ontouchend = () => clearTimeout(timer);
        btn.ontouchmove = () => clearTimeout(timer);
    });
};

window.addNewRemPreset = () => {
    const val = prompt("¿Cuántos minutos quieres añadir al atajo? (Ej: 10, 15, 60)");
    const mins = parseInt(val);
    if (!isNaN(mins) && mins > 0) {
        let customPresets = JSON.parse(localStorage.getItem('customRemPresets') || '[1, 5]');
        if (!customPresets.includes(mins)) {
            customPresets.push(mins);
            customPresets.sort((a,b) => a - b); // Ordenar de menor a mayor tiempo
            localStorage.setItem('customRemPresets', JSON.stringify(customPresets));
            renderRemPresets();
        }
    }
};

window.removeRemPreset = (min) => {
    if (confirm(`¿Quieres eliminar el atajo de +${min} min?`)) {
        let customPresets = JSON.parse(localStorage.getItem('customRemPresets') || '[1, 5]');
        customPresets = customPresets.filter(m => m !== min);
        localStorage.setItem('customRemPresets', JSON.stringify(customPresets));
        renderRemPresets();
    }
};

window.addMinutesToDynamicInput = (minToAdd) => {
    const input = document.getElementById('remDynamicInput');
    if (!input) return;
    
    const fecha = new Date();
    fecha.setMinutes(fecha.getMinutes() + minToAdd);
    const horaCalculada = fecha.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    let textWithoutTime = input.value.replace(/\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)?\b/gi, '').trim();
    input.value = textWithoutTime ? textWithoutTime + ' ' + horaCalculada : 'Recordatorio ' + horaCalculada;
    input.focus();
    
    if (navigator.vibrate) navigator.vibrate(50);
};

window.expandReminderBar = (id = null, isCreatingHabit = false) => {
    const sheet = document.getElementById('reminderBottomSheet');
    const input = document.getElementById('remDynamicInput');
    const title = document.getElementById('remSheetTitle');
    const fab = document.getElementById('openReminderSheetBtn');

    window.isCreatingNewHabit = isCreatingHabit;

    if (id) {
        const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        const alarm = reminders.find(r => r.id === id);
        if (!alarm) return;
        
        window.isCreatingNewHabit = false; 
        currentEditingAlarmId = id;
        let currentInputValue = `${alarm.text} ${alarm.time}`;
        if (alarm.repeat && alarm.repeat.unit) {
            currentInputValue += ` cada ${alarm.repeat.count} ${alarm.repeat.unit}`;
        }
        input.value = currentInputValue;
        title.innerText = "Editar Alarma";
    } else {
        currentEditingAlarmId = null;
        input.value = '';
        if (isCreatingHabit) {
            input.placeholder = "Ej: Meditar 08:00 cada 1 dia";
            title.innerText = "Nuevo Hábito";
        } else {
            input.placeholder = "Ej: Recordatorio rápido 15:30";
            title.innerText = "Nueva Alarma";
        }
    }

    document.body.classList.add('stop-scrolling');
    document.body.style.overflow = 'hidden';
    if (fab) fab.style.display = 'none';

    sheet.classList.add('active');
    setTimeout(() => input.focus(), 300);
};

window.collapseReminderBar = () => {
    const sheet = document.getElementById('reminderBottomSheet');
    if (sheet) sheet.classList.remove('active');
    
    document.body.classList.remove('stop-scrolling');
    document.body.style.overflow = 'auto';
    
    const currentView = document.querySelector('.nav-item.active')?.dataset.view;
    const fab = document.getElementById('openReminderSheetBtn');
    if (fab && currentView === 'view-reminders') {
        fab.style.display = 'flex';
    }

    document.getElementById('remDynamicInput').value = '';
    window.isCreatingNewHabit = false; 
    currentEditingAlarmId = null; 
};

window.onRemTimeChange = (e) => {
    const time = e.target.value; // Formato HH:MM del selector nativo
    if(time) {
        const input = document.getElementById('remDynamicInput');
        // Quita cualquier hora que se haya escrito antes para no duplicar
        let textWithoutTime = input.value.replace(/\b\d{1,2}:\d{2}\b/g, '').trim();
        
        // Si solo eligió la hora y no escribió nada, pone "Recordatorio" por defecto
        input.value = textWithoutTime ? textWithoutTime + ' ' + time : 'Recordatorio ' + time;
        input.focus();
    }
};

window.saveDynamicReminder = async () => {
    const input = document.getElementById('remDynamicInput');
    const value = input.value.trim();
    if(!value) {
        collapseReminderBar();
        return;
    }
    
    // Usa la misma expresión regular que tienes en tu app
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = value.match(timeRegex);
    
    // Nueva Regex para intervalos: "cada 1 hora", "cada 30 minutos"
    const intervalRegex = /cada\s+(\d+)\s+(minuto|hora|dia)s?/i;
    const intervalMatch = value.match(intervalRegex);

    if (match) {
        if (window.isCreatingNewHabit && !currentEditingAlarmId) {
            // --- MODO CREACIÓN DE HÁBITO ---
            let text = value.replace(match[0], '').replace(intervalRegex, '').trim();
            if (!text) text = "Nuevo Hábito";

            let horas = parseInt(match[1]);
            let minutos = match[2] ? parseInt(match[2]) : 0;
            let periodo = match[3] ? match[3].toLowerCase() : null;
            if (periodo === 'pm' && horas < 12) horas += 12;
            else if (periodo === 'am' && horas === 12) horas = 0;
            const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;

            const userEmoji = prompt("Elige un icono (emoji) para este hábito:", "💪") || "💪";

            const newHabit = {
                id: Date.now(),
                text: text,
                time: fullTime,
                emoji: userEmoji,
                isHabit: true,
                isCustom: true, // Marcador para saber que el usuario lo creó
                enabled: true,
                days: [true, true, true, true, true, true, true] // Por defecto todos los días
            };

            if (intervalMatch) {
                newHabit.repeat = { count: parseInt(intervalMatch[1]), unit: intervalMatch[2] };
                delete newHabit.days; // Si hay intervalo, no usamos los días de la semana
            }

            let list = JSON.parse(localStorage.getItem('reminders') || '[]');
            list.push(newHabit);
            localStorage.setItem('reminders', JSON.stringify(list));
            window.scheduleNotificationsForAlarm(newHabit);

        } else if (currentEditingAlarmId) {
            // --- MODO EDICIÓN ---
            let list = JSON.parse(localStorage.getItem('reminders') || '[]');
            const index = list.findIndex(r => r.id === currentEditingAlarmId);

            if (index !== -1) {
                // Extraemos la nueva hora y texto del input
                let horas = parseInt(match[1]);
                let minutos = match[2] ? parseInt(match[2]) : 0;
                let periodo = match[3] ? match[3].toLowerCase() : null;
                if (periodo === 'pm' && horas < 12) horas += 12;
                else if (periodo === 'am' && horas === 12) horas = 0;
                const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
                let text = value.replace(match[0], '').replace(intervalRegex, '').trim();
                if (!text) text = "Recordatorio";

                // Actualizamos los datos manteniendo el resto (como los días y el estado enabled)
                list[index].text = text;
                list[index].time = fullTime;

                // Actualizar o quitar la repetición por intervalo
                if (intervalMatch) {
                    list[index].repeat = { count: parseInt(intervalMatch[1]), unit: intervalMatch[2] };
                    delete list[index].days; // Un hábito no puede tener ambos
                } else {
                    delete list[index].repeat; // Si se quitó el "cada...", volvemos a la repetición por días
                }

                localStorage.setItem('reminders', JSON.stringify(list));
                window.scheduleNotificationsForAlarm(list[index]);
            }
        } else {
            // --- MODO CREACIÓN (comportamiento original) ---
            await procesarAlarma(value, match);
        }
        
        collapseReminderBar(); // Cierra y limpia el panel
        renderAll(); // Refresca la lista
    } else {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 500);
        alert("No olvidaste la hora? Usa el icono ⏰");
    }
};

// Inyectar la interfaz una vez que la app termine de dibujar las listas
setTimeout(initDynamicReminderUI, 600);

window.msCopy = () => {
    let textToCopy = [];
    selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        let found = list.find(i => i.id === id);
        if (found) {
            // Obtener el texto dependiendo de si es nota o tarea
            textToCopy.push(found.content || found.text || found.title || '');
        }
    });
    
    navigator.clipboard.writeText(textToCopy.join('\\n\\n')).then(() => {
        if (typeof showCopyToast === 'function') showCopyToast();
        exitSelectionMode();
    });
};

window.msPin = () => {
    selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        
        // Invertimos el estado de "pinned" (si estaba anclado lo desancla, y viceversa)
        list = list.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i);
        localStorage.setItem(type, JSON.stringify(list));
    });
    exitSelectionMode();
    renderAll();
};

// ==========================================
// SELECTOR DE HORA TIPO SAMSUNG (WHEEL PICKER)
// ==========================================

function initCustomTimePicker() {
    if (document.getElementById('stp-overlay')) return;

    const hours = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
    const mins = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));
    const ampms = ['AM', 'PM'];

    const createWheel = (id, items) => `
        <div class="stp-wheel" id="${id}" onscroll="onStpScroll(this)">
            <div class="stp-pad"></div>
            ${items.map(v => `<div class="stp-item" data-val="${v}" onclick="selectStpItem('${id}', '${v}')">${v}</div>`).join('')}
            <div class="stp-pad"></div>
        </div>
    `;

    const html = `
    <div id="stp-overlay" class="stp-overlay" onclick="closeCustomTimePicker(event)">
        <div class="stp-sheet" onclick="event.stopPropagation()">
            <div class="stp-header">
                <button onclick="closeCustomTimePicker()">Cancelar</button>
                <span style="font-weight:bold; color:var(--text-main); font-size: 18px;">Elegir hora</span>
                <button class="stp-save" onclick="saveCustomTimePicker()">Guardar</button>
            </div>
            <div class="stp-wheels-container">
                <div class="stp-highlight"></div>
                ${createWheel('stp-hour', hours)}
                <span style="font-size:24px; font-weight:bold; color:var(--text-main); margin-top:-4px; z-index: 3;">:</span>
                ${createWheel('stp-min', mins)}
                ${createWheel('stp-ampm', ampms)}
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.onStpScroll = (el) => {
    const index = Math.round(el.scrollTop / 50);
    const items = el.querySelectorAll('.stp-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.style.color = 'var(--accent)';
            item.style.fontSize = '28px';
            item.style.fontWeight = '700';
        } else {
            item.style.color = 'var(--text-sub)';
            item.style.fontSize = '22px';
            item.style.fontWeight = '500';
        }
    });
};

window.selectStpItem = (wheelId, val) => {
    const wheel = document.getElementById(wheelId);
    const items = Array.from(wheel.querySelectorAll('.stp-item'));
    const index = items.findIndex(item => item.dataset.val === val);
    if(index !== -1) wheel.scrollTo({ top: index * 50, behavior: 'smooth' });
};

window.openCustomTimePicker = () => {
    initCustomTimePicker(); 
    document.getElementById('remDynamicInput')?.blur(); // Ocultar teclado
    
    const overlay = document.getElementById('stp-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);

    // Poner la hora actual por defecto
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    setTimeout(() => {
        const hWheel = document.getElementById('stp-hour');
        const mWheel = document.getElementById('stp-min');
        const aWheel = document.getElementById('stp-ampm');
        
        hWheel.scrollTop = (h - 1) * 50;
        mWheel.scrollTop = m * 50;
        aWheel.scrollTop = ampm === 'AM' ? 0 : 50;
        
        onStpScroll(hWheel); onStpScroll(mWheel); onStpScroll(aWheel);
    }, 50); 
};

window.closeCustomTimePicker = (e) => {
    const overlay = document.getElementById('stp-overlay');
    if (!overlay || (e && e.target !== overlay)) return;
    
    isPickingTimeForHabit = false; // Reset 
    
    overlay.classList.remove('active');
    setTimeout(() => overlay.style.display = 'none', 300);
};

window.saveCustomTimePicker = () => {
    const getVal = (id) => {
        const el = document.getElementById(id);
        const index = Math.round(el.scrollTop / 50);
        const items = el.querySelectorAll('.stp-item');
        return items[Math.max(0, Math.min(index, items.length - 1))].dataset.val;
    };

    const hours = getVal('stp-hour');
    const mins = getVal('stp-min');
    const ampm = getVal('stp-ampm');
    
    let h = parseInt(hours);
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    
    const timeStr24 = `${h.toString().padStart(2, '0')}:${mins}`;
    const timeStr = `${hours}:${mins} ${ampm}`;

    if (isPickingTimeForHabit) {
        if (!currentConfigTimes.includes(timeStr24)) currentConfigTimes.push(timeStr24);
        renderHcTimes();
        isPickingTimeForHabit = false;
    } else {
        const input = document.getElementById('remDynamicInput');
        if (input) {
            let textWithoutTime = input.value.replace(/\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)?\b/gi, '').trim();
            input.value = textWithoutTime ? textWithoutTime + ' ' + timeStr : 'Recordatorio ' + timeStr;
            input.focus();
        }
    }
    closeCustomTimePicker();
};

// Animación automática de "Añadir tarea" al cargar la app por primera vez
setTimeout(() => {
    const fabTask = document.getElementById('openTaskSheetBtn');
    if (fabTask && document.getElementById('view-today').style.display !== 'none') {
        fabTask.classList.add('auto-expanded');
        window.taskFabCloseTimeout = setTimeout(() => {
            fabTask.classList.remove('auto-expanded');
        }, 4000);
    }
}, 1000);

// ==========================================
// LÓGICA HISTORIAL (VENCIDAS / COMPLETADAS)
// ==========================================
const tabOverdue = document.getElementById('tabOverdue');
const tabCompleted = document.getElementById('tabCompleted');
const historyOverdueList = document.getElementById('historyOverdueList');
const historyCompletedList = document.getElementById('historyCompletedList');

if (tabOverdue && tabCompleted) {
    tabOverdue.addEventListener('click', () => {
        tabOverdue.classList.add('active');
        tabCompleted.classList.remove('active');
        historyOverdueList.style.display = 'block';
        historyCompletedList.style.display = 'none';
    });

    tabCompleted.addEventListener('click', () => {
        tabCompleted.classList.add('active');
        tabOverdue.classList.remove('active');
        historyCompletedList.style.display = 'block';
        historyOverdueList.style.display = 'none';
    });
}

const closeHistoryBtn = document.getElementById('closeHistoryBtn');
if (closeHistoryBtn) {
    closeHistoryBtn.onclick = () => {
        document.getElementById('view-history').style.display = 'none';
        document.getElementById('view-today').style.display = 'block';
        renderAll();
    };
}

window.renderHistoryView = function renderHistoryView() {
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // Vencidas: No completadas, tienen fecha y es anterior a hoy
    const overdue = allTasks.filter(t => !t.completed && t.date && isOverdue(t.date));
    // Completadas
    const completed = allTasks.filter(t => t.completed);

    const renderGrouped = (list, containerId, isOverdueList) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                        <path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2-2v3M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M21 11H3M12 11v3"></path>
                    </svg>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">Historial vacío</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">No hay tareas aquí.</p>
                </div>`;
            return;
        }

        const groups = {};
        list.forEach(t => {
            const d = t.date || 'Sin fecha';
            if (!groups[d]) groups[d] = [];
            groups[d].push(t);
        });

        const sortedDates = Object.keys(groups).sort((a, b) => {
            if (a === 'Sin fecha') return 1;
            if (b === 'Sin fecha') return -1;
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(yb, mb-1, db) - new Date(ya, ma-1, da);
        });

        let html = '';
        if (!isOverdueList && list.length > 0) {
            html += `<button onclick="clearCompletedHistory()" class="btn-text" style="color: var(--error);  width: 100%; font-weight: bold; text-align: center;">🗑️ Vaciar historial </button>`;
        }

        html += sortedDates.map(date => `
            <div class="history-date-group">
                <div class="history-date-title">📅 ${date}</div>
                ${groups[date].map(item => `
                    <div class="reminder-card ${item.completed ? 'completed-task' : ''} ${isOverdueList ? 'urgent' : ''}" style="margin-bottom: 10px; border: none; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <div class="card-info">
                            ${window.getProfileCircle(item.text, item.icon)}
                            <div class="task-data-wrapper">
                                <span class="task-text-content" style="${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.text}</span>
                            </div>
                        </div>
                        <div class="actions">
                            ${isOverdueList ? `<button onclick="rescheduleToToday(${item.id}, this)" class="btn-reschedule" title="Añadir a Hoy">+</button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
        
        container.innerHTML = html;
    };

    renderGrouped(overdue, 'historyOverdueList', true);
    renderGrouped(completed, 'historyCompletedList', false);
};

window.rescheduleToToday = (id, btnElement) => {
    const executeMove = () => {
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.date = getTodayStr(); // Mover a la fecha actual
            localStorage.setItem('tasks', JSON.stringify(tasks));
            renderAll();
            if(typeof renderHistoryView === 'function') renderHistoryView();
        }
    };

    if (btnElement) {
        const card = btnElement.closest('.reminder-card');
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-15px)';
            setTimeout(executeMove, 300);
            return;
        }
    }
    executeMove();
};

window.clearCompletedHistory = () => {
    if(confirm('¿Eliminar todo el historial de tareas completadas? Esta acción no se puede deshacer.')) {
        let allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        allTasks = allTasks.filter(t => !t.completed);
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        renderAll();
        if(typeof renderHistoryView === 'function') renderHistoryView();
    }
}; 

// ==========================================
// SISTEMA DE ENERGÍA DIARIA Y CARGA MENTAL
// ==========================================
window.renderEnergySuggestion = function() {
    // Ya no inyectamos HTML de forma fija. Solo corremos si es el día de hoy
    if (selectedViewDate !== getTodayStr()) return;

    let allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let pending = allTasks.filter(t => !t.completed && t.date === selectedViewDate);
    
    // Respetar el filtro actual
    if (currentFilter !== 'all') {
        pending = pending.filter(item => item.emoji === currentFilter);
    }

    const todayBadge = document.getElementById('todayNavBadge');

    if (pending.length === 0) {
        if (todayBadge) todayBadge.classList.remove('active');
        return;
    }

    const hour = new Date().getHours();
    const completedCount = parseInt(localStorage.getItem('completedToday') || 0);

    let energyLevel, messageTitle, messageSubtitle;

    if (hour >= 5 && hour < 12 && completedCount < 5) {
        energyLevel = 'high';
        messageTitle = '🌞 Tienes la energía a tope';
        messageSubtitle = 'Momento ideal para enfocarte en una tarea de Alta Carga:';
    } else if (hour >= 18 || completedCount >= 6) {
        energyLevel = 'low';
        messageTitle = '🌙 Modo Ahorro de Energía';
        messageSubtitle = 'Te queda poca energía, ¿qué tal si terminas esta tarea de Baja Carga?';
    } else {
        energyLevel = 'medium';
        messageTitle = '☕ A buen ritmo';
        messageSubtitle = 'Ideal para avanzar de forma constante con una de Carga Media:';
    }

    // Seleccionar la mejor tarea basada en el nivel de energía detectado
    let suggestedTask;
    if (energyLevel === 'high') {
        suggestedTask = pending.find(t => t.importance === 'high') || pending.find(t => t.importance === 'medium') || pending[0];
    } else if (energyLevel === 'low') {
        suggestedTask = pending.find(t => t.importance === 'low') || pending.find(t => t.importance === 'none') || pending.find(t => t.importance === 'medium') || pending[0];
    } else {
        suggestedTask = pending.find(t => t.importance === 'medium') || pending.find(t => t.importance === 'low') || pending.find(t => t.importance === 'high') || pending[0];
    }

    let importanceClass = '';
    if (suggestedTask.importance === 'high') importanceClass = 'importance-high';
    else if (suggestedTask.importance === 'medium') importanceClass = 'importance-medium';
    else if (suggestedTask.importance === 'low') importanceClass = 'importance-low';
    else if (suggestedTask.importance === 'none') importanceClass = 'importance-none';

    // 1. Activar el Puntito Rojo en la pestaña Hoy si hay Alta Carga sugerida
    if (energyLevel === 'high' && suggestedTask.importance === 'high') {
        if (todayBadge) todayBadge.classList.add('active');
    } else {
        if (todayBadge) todayBadge.classList.remove('active');
    }

    // 2. Disparar Notificación de Sistema solo si cambió la sugerencia o nivel
    const storedEnergyState = JSON.parse(localStorage.getItem('energyState') || '{}');
    
    if (storedEnergyState.taskId !== suggestedTask.id || storedEnergyState.level !== energyLevel) {
        localStorage.setItem('energyState', JSON.stringify({ taskId: suggestedTask.id, level: energyLevel }));
        
        const notifTitle = messageTitle;
        const notifBody = `${messageSubtitle} ${suggestedTask.text}`;

        if (typeof Capacitor === 'undefined' || Capacitor.getPlatform() === 'web') {
            if ('Notification' in window && Notification.permission === "granted") {
                new Notification(notifTitle, { body: notifBody, icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png" });
            }
        } else if (typeof Notifications !== 'undefined' && Notifications) {
            Notifications.schedule({
                notifications: [{
                    title: notifTitle,
                    body: notifBody,
                    id: 888888, // ID reservado para sugerencias de Energía Diaria
                    schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
                    importance: 5,
                    sound: 'res://platform_default'
                }]
            });
        }
    }
};