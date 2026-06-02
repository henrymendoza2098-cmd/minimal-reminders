import { getTodayStr, getTomorrowStr, isOverdue, getProfileCircle } from '../core/utils.js';
import { selectedViewDate, renderCalendar, renderCalendarTasks } from './calendar.js';

export let currentTaskImportance = 'none';
export let currentTaskCategory = 'all';
export let currentTaskTime = '';
export let currentTaskIsPopup = false;
export let currentTaskPopupDate = '';
export let currentTaskPopupTime = '';
export let currentEditingTaskId = null;
export let activePopupTaskId = null;

export function procesarTarea(value) {
    let text = value.trim();
    if (!text) return;

    let list = JSON.parse(localStorage.getItem('tasks') || '[]');
    list.push({ id: Date.now(), text: text, emoji: window.selectedEmoji, completed: false });
    
    let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
    localStorage.setItem('totalCreatedToday', total + 1);
    
    localStorage.setItem('tasks', JSON.stringify(list));
}
window.procesarTarea = procesarTarea;

export function showCompletionToast() {
    let toast = document.querySelector('.completion-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'completion-toast';
        document.body.appendChild(toast);
    }
    
    const messages = ["¡Bien hecho!", "¡Genial!", "¡Una menos!", "¡Sigue así!", "¡Excelente!"];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    toast.innerHTML = `<span>🎉</span> ${randomMessage}`;
    
    toast.classList.remove('show');
    void toast.offsetWidth; 
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000); 
}
window.showCompletionToast = showCompletionToast;

export function playCompletionSound() {
    try {
        const audio = new Audio('assets/ding.mp3');
        audio.volume = 0.5;
        audio.play().catch(error => {
            console.log("La reproducción de sonido fue bloqueada:", error);
        });
    } catch (e) {
        console.error("No se pudo reproducir el sonido:", e);
    }
}
window.playCompletionSound = playCompletionSound;

export function toggleTaskComplete(id) {
    if (typeof window.isSelectionMode !== 'undefined' && window.isSelectionMode) return;
    
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let completedDelta = 0;
    let wasJustCompleted = false; 

    tasks = tasks.map(t => {
        if (t.id === id) {
            const newState = !t.completed;
            completedDelta = newState ? 1 : -1;
            if (newState) { 
                wasJustCompleted = true;
            }
            return { ...t, completed: newState };
        }
        return t;
    });

    let currentDone = parseInt(localStorage.getItem('completedToday') || 0);
    localStorage.setItem('completedToday', Math.max(0, currentDone + completedDelta));
    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    if (wasJustCompleted) {
        showCompletionToast();
        playCompletionSound();
    }

    if (window.renderAll) window.renderAll(); 
    
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView) {
        renderCalendar();
        renderCalendarTasks(selectedViewDate);
    }
}
window.toggleTaskComplete = toggleTaskComplete;

export function completeTask(id) {
    let completed = parseInt(localStorage.getItem('completedToday') || 0);
    localStorage.setItem('completedToday', completed + 1);
    deleteItem('tasks', id);
    if (window.renderAll) window.renderAll();
    if (window.updateComboUI) window.updateComboUI();
}
window.completeTask = completeTask;

export function deleteItem(key, id) {
    let list = JSON.parse(localStorage.getItem(key) || '[]');

    if (key === 'reminders' && typeof window.Notifications !== 'undefined' && window.Notifications) {
        const itemToDelete = list.find(i => String(i.id) === String(id));
        if (itemToDelete) {
            const idsToCancel = window.getNotificationIdsForAlarm ? window.getNotificationIdsForAlarm(itemToDelete) : [];
            idsToCancel.push(id); 
            window.Notifications.cancel({ notifications: idsToCancel.map(cancelId => ({ id: parseInt(cancelId) })) });
        }
    }

    list = list.filter(i => String(i.id) !== String(id));
    localStorage.setItem(key, JSON.stringify(list));

    if (window.renderAll) window.renderAll();
    
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    if (isCalendarView && key === 'tasks') {
        renderCalendar();
        renderCalendarTasks(selectedViewDate);
    }
}
window.deleteItem = deleteItem;

export function deleteItemWithAnimation(element, key, id) {
    const swipeContainer = element.closest('.swipe-container');
    if (swipeContainer) {
        swipeContainer.classList.add('removing');
        setTimeout(() => {
            deleteItem(key, id);
        }, 300); 
    } else {
        deleteItem(key, id);
    }
}
window.deleteItemWithAnimation = deleteItemWithAnimation;

export function drawTasks(list, containerId, isCompletedOrAlarm, key) {
    const container = containerId ? document.getElementById(containerId) : null;

    if (list.length === 0) {
       if (containerId === 'completedTaskList') {
            if (container) container.innerHTML = '';
            return container ? undefined : '';
        }

        if (containerId === 'taskList' || containerId === 'calendarTaskList' || !containerId) {
            let msgTitle = "Todo al día";
            let msgSub = window.currentFilter !== 'all' 
                ? `Sin tareas pendientes en la categoría ${window.currentFilter}` 
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

        const fallbackEmpty = `<div class="empty-state"><span>📝</span><p>No hay nada aquí.</p></div>`;
        if (container) container.innerHTML = fallbackEmpty;
        return container ? undefined : fallbackEmpty;
    }

    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    const listHtml = list.map((item, index) => {
        const isTaskOverdue = item.date && !item.completed && isOverdue(item.date);
        const urgentClass = isTaskOverdue ? 'urgent' : '';
        const pinIcon = item.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof window.selectedItems !== 'undefined' && window.selectedItems.has(`${key}-${item.id}`);
        
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
                    ${getProfileCircle(item.text, item.icon)}
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
window.drawTasks = drawTasks;

export function skipTask(id) {
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks = tasks.map(t => t.id === id ? { ...t, skipped: true } : t);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    if (window.renderAll) window.renderAll();
    if (window.renderPendingCarousel) window.renderPendingCarousel();
}
window.skipTask = skipTask;

export function showSnoozeOptions(id) {
    const opts = document.getElementById(`snooze-options-${id}`);
    if (opts) {
        opts.style.display = opts.style.display === 'none' ? 'flex' : 'none';
    }
}
window.showSnoozeOptions = showSnoozeOptions;

export function snoozeTask(id, when) {
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
        task.date = getTomorrowStr();
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
                if (window.renderAll) window.renderAll();
                if (window.renderPendingCarousel) window.renderPendingCarousel();
            }
            document.body.removeChild(dateInput);
        };
        dateInput.click();
        return; 
    }
    
    localStorage.setItem('tasks', JSON.stringify(tasks));
    if (window.renderAll) window.renderAll();
    if (window.renderPendingCarousel) window.renderPendingCarousel();
}
window.snoozeTask = snoozeTask;

export function determineSmartIcon(text) {
    const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
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
window.determineSmartIcon = determineSmartIcon;

export function startVoiceDictation() {
    const isNativeApp = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() !== 'web';
    
    if (isNativeApp) {
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
    
    const originalIconHTML = fabIcon.innerHTML;
    const originalTextHTML = fabText.innerHTML;
    const originalBackground = fabTaskBtn.style.background;
    
    fabTaskBtn.classList.add('auto-expanded');
    fabTaskBtn.style.background = 'var(--error)';
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
            let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
            localStorage.setItem('totalCreatedToday', total + 1);

            const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
            const taskDate = isCalendarView ? selectedViewDate : getTodayStr(); 
            
            tasks.push({ 
                id: Date.now(), 
                text: textoGrabado, 
                emoji: window.selectedEmoji || '📝', 
                completed: false,
                date: taskDate,
                icon: determineSmartIcon(textoGrabado)
            });
            
            localStorage.setItem('tasks', JSON.stringify(tasks));
            if (window.renderAll) window.renderAll();
            
            if (isCalendarView) {
                renderCalendar(); 
                renderCalendarTasks(selectedViewDate); 
            }
        }
    };

    function restoreFabButton() {
        fabTaskBtn.style.background = originalBackground;
        fabIcon.innerHTML = originalIconHTML;
        fabText.innerHTML = originalTextHTML;
        setTimeout(() => { fabTaskBtn.classList.remove('auto-expanded'); }, 1500);
    }

    recognition.start();
}
window.startVoiceDictation = startVoiceDictation;

export async function setupTaskReminder(text, timeStr, dateStr, taskId) {
    if (typeof window.Notifications === 'undefined' || !window.Notifications) return;
    if (!timeStr) return;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return;
    
    const reminderDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], hours, minutes, 0);
    
    if (reminderDate > new Date()) {
        try {
            await window.Notifications.schedule({
                notifications: [{
                    title: "📝 Tarea: " + text, 
                    body: "¡Es hora de tu tarea programada a las " + timeStr + "!",
                    id: taskId || Math.floor(Math.random() * 1000000),
                    schedule: { at: reminderDate, allowWhileIdle: true },
                    importance: 5,
                    sound: 'res://platform_default',
                    actionTypeId: 'REMINDER_ACTIONS',
                    extra: { isTask: true, taskId: taskId }
                }]
            });
        } catch (err) {
            console.error("Fallo al programar notificación de tarea:", err);
        }
    }
}
window.setupTaskReminder = setupTaskReminder;

export function openTaskSheet(id = null) {
    const sheet = document.getElementById('taskBottomSheet');
    const input = document.getElementById('sheetTaskInput');
    const fabTask = document.getElementById('openTaskSheetBtn');
    
    if (id !== null && typeof id === 'object') { id = null; }

    if (id) {
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
        currentEditingTaskId = null;
        input.value = '';
        currentTaskImportance = 'none';
        currentTaskCategory = window.currentFilter !== 'all' ? window.currentFilter : 'all';
        currentTaskTime = '';
        currentTaskIsPopup = false;
        currentTaskPopupDate = getTodayStr(); 
        currentTaskPopupTime = '';
    }

    setTimeout(() => {
        if (input) {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }
    }, 10);

    renderTaskOptionsUI();

    document.body.classList.add('stop-scrolling');
    document.body.style.overflow = 'hidden';
    
    if (!id) { input.focus(); }
    sheet.classList.add('active'); 
   
    if (!id) {
        setTimeout(() => document.getElementById('sheetTaskInput').focus(), 300);
    }
    if (fabTask) fabTask.style.display = 'none';
}
window.openTaskSheet = openTaskSheet;

export function saveTaskFromSheet() {
    const newText = document.getElementById('sheetTaskInput').value.trim();
    const fabTask = document.getElementById('openTaskSheetBtn');
    const isCalendarView = document.getElementById('view-calendar').style.display === 'block';
    
    if (newText) {
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const taskEmoji = currentTaskCategory !== 'all' ? currentTaskCategory : window.selectedEmoji;
        let taskIdToSave = currentEditingTaskId || Date.now();

        if (currentEditingTaskId && typeof window.Notifications !== 'undefined' && window.Notifications) {
            window.Notifications.cancel({ notifications: [{ id: Math.abs(currentEditingTaskId % 2147483647) }] });
        }

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
                popupNotified: false
            } : t);
        } else {
            let total = parseInt(localStorage.getItem('totalCreatedToday') || 0);
            localStorage.setItem('totalCreatedToday', total + 1);

            const taskDate = currentTaskIsPopup && currentTaskPopupDate ? currentTaskPopupDate : selectedViewDate;
            
            tasks.push({ 
                id: taskIdToSave, 
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
            setupTaskReminder(newText, currentTaskTime, currentTaskIsPopup && currentTaskPopupDate ? currentTaskPopupDate : selectedViewDate, taskIdToSave);
        }
    }
    
    document.getElementById('taskBottomSheet').classList.remove('active');
    document.body.classList.remove('stop-scrolling');
    document.body.style.overflow = 'auto';
    
    const activeNav = document.querySelector('.nav-item.active');
    const currentView = activeNav ? activeNav.dataset.view : null;
    if (fabTask && currentView === 'view-today') {
        fabTask.style.display = 'flex';
    }
    
    if (window.renderAll) window.renderAll();
    if (isCalendarView) {
        renderCalendar();
        renderCalendarTasks(selectedViewDate);
    }
}
window.saveTaskFromSheet = saveTaskFromSheet;

export function renderTaskOptionsUI() {
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
    const allCategories = [...(window.defaultCategories || []).filter(c => c.filter !== 'all'), ...customCategories];

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
        `;
    }

    if (bottomContainer) {
        bottomContainer.innerHTML = `
            <div style="display: flex; gap: 12px;">
                <div class="toolbar-item" title="Añadir hora">
                    <div class="icon-btn ${currentTaskIsPopup ? 'active' : ''}" id="timeIconBtn" onclick="toggleTaskOptionPanel('time')" style="${currentTaskPopupTime ? 'width: auto; padding: 0 15px; border-radius: 20px; gap: 6px;' : ''}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${currentTaskPopupTime ? `<span style="font-size: 14px; font-weight: 700;">${currentTaskPopupTime}</span>` : ''}
                    </div>
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
window.renderTaskOptionsUI = renderTaskOptionsUI;

export function toggleTaskOptionPanel(panelName) {
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
    const allCategories = [...(window.defaultCategories || []).filter(c => c.filter !== 'all'), ...customCategories];
    
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
    } else if (panelName === 'time') {
        const isToday = currentTaskPopupDate === getTodayStr();
        const isTomorrow = currentTaskPopupDate === getTomorrowStr();
        const isOther = !isToday && !isTomorrow && currentTaskPopupDate !== '';
        
        panel.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: var(--text-main);">⏰ Programar Recordatorio</span>
                    ${currentTaskIsPopup ? `<button class="btn-text" style="color: var(--error); font-size: 12px; padding: 0;" onclick="clearPopupTime()">Quitar</button>` : ''}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-soft); padding-top: 10px;">
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
                        <div class="custom-option-chip ${(currentTaskPopupTime && !['08:00','15:00','20:00'].includes(currentTaskPopupTime)) ? 'selected' : ''}" style="position:relative; overflow: hidden;">
                            ⌚ <span>${(currentTaskPopupTime && !['08:00','15:00','20:00'].includes(currentTaskPopupTime)) ? currentTaskPopupTime : 'Otra hora'}</span>
                            <input type="time" style="position:absolute; top:0; left:0; width:100%; height:200%; opacity:0; cursor: pointer;" onchange="setPopupTime(this.value)">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
window.toggleTaskOptionPanel = toggleTaskOptionPanel;

export function selectTaskOption(type, val, extraIcon) {
    if (type === 'category') {
        currentTaskCategory = val;
        document.getElementById('categoryIconBtn').innerHTML = extraIcon || '🗂️';
    } else if (type === 'importance') {
        currentTaskImportance = val;
        document.getElementById('importanceIconBtn').innerHTML = window.getImportanceIcon(val);
    }
    document.getElementById('customTaskOptionsPanel').style.display = 'none';
    window.currentActivePanel = null;
    
    const textarea = document.getElementById('sheetTaskInput');
    if (textarea) textarea.focus();
}
window.selectTaskOption = selectTaskOption;

export function setPopupDate(val) {
    if (val === 'today') currentTaskPopupDate = getTodayStr();
    else if (val === 'tomorrow') currentTaskPopupDate = getTomorrowStr();
    else if (val) {
        const [y, m, d] = val.split('-');
        currentTaskPopupDate = `${d}/${m}/${y}`;
    }
    currentTaskIsPopup = true;
    
    const wasOpen = window.currentActivePanel === 'time';
    renderTaskOptionsUI();
    if (wasOpen) toggleTaskOptionPanel('time');
}
window.setPopupDate = setPopupDate;

export function setPopupTime(val) {
    if (!val) return;
    currentTaskPopupTime = val;
    currentTaskTime = val;
    currentTaskIsPopup = true;
    if (!currentTaskPopupDate) currentTaskPopupDate = getTodayStr();
    
    const wasOpen = window.currentActivePanel === 'time';
    renderTaskOptionsUI();
    if (wasOpen) toggleTaskOptionPanel('time');
}
window.setPopupTime = setPopupTime;

export function clearPopupTime() {
    currentTaskIsPopup = false;
    currentTaskPopupTime = '';
    currentTaskPopupDate = '';
    currentTaskTime = '';
    
    const wasOpen = window.currentActivePanel === 'time';
    renderTaskOptionsUI();
    if (wasOpen) toggleTaskOptionPanel('time');
}
window.clearPopupTime = clearPopupTime;

export function showPopupReminder(task) {
    const modal = document.getElementById('popupReminderModal');
    const textEl = document.getElementById('popupTaskText');
    if (!modal || !textEl) return;
    activePopupTaskId = task.id;
    textEl.innerText = task.text;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
    try { new Audio('assets/ding.mp3').play().catch(()=>{}); } catch (e) {}
}
window.showPopupReminder = showPopupReminder;

export function snoozePopupTask() {
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
    closePopupReminder();
    alert("Te lo recordaré de nuevo en 10 minutos.");
}
window.snoozePopupTask = snoozePopupTask;

export function completePopupTask() {
    if (!activePopupTaskId) return;
    toggleTaskComplete(activePopupTaskId);
    closePopupReminder();
}
window.completePopupTask = completePopupTask;

export function closePopupReminder() {
    const modal = document.getElementById('popupReminderModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
    activePopupTaskId = null;
}
window.closePopupReminder = closePopupReminder;

export function shareCurrentTask() {
    const text = document.getElementById('sheetTaskInput').value.trim();
    if (!text) {
        alert("Escribe algo para compartir primero.");
        return;
    }
        
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Share) {
        Capacitor.Plugins.Share.share({
            title: 'Tarea',
            text: text,
            dialogTitle: 'Compartir tarea'
        }).catch(err => console.error('Error al compartir nativo:', err));
    } else if (navigator.share) {
        navigator.share({
            title: 'Tarea',
            text: text
        }).catch(err => console.error('Error al compartir:', err));
    } else {
        alert("La función de compartir requiere el plugin @capacitor/share en el teléfono.");
        navigator.clipboard.writeText(text).then(() => {
            if (typeof window.showCopyToast === 'function') window.showCopyToast();
            else alert("¡Tarea copiada al portapapeles!");
        }).catch(err => alert("No se pudo copiar la tarea."));
    }
}
window.shareCurrentTask = shareCurrentTask;