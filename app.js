let editId = null; // Para saber qué recordatorio estamos editando
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const reminderList = document.getElementById('reminderList');

// Registrar Service Worker y pedir permisos
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log("Service Worker Activo"));
}

if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

// --- MEJORA 1: REGEX FLEXIBLE ---
addBtn.addEventListener('click', () => {
    const value = taskInput.value.trim();
    if (!value) return;

    // Regex para extraer la hora
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = value.match(timeRegex);

    if (match) {
        // --- NORMALIZACIÓN DE HORA ---
        let horas = parseInt(match[1]);
        let minutos = match[2] ? parseInt(match[2]) : 0;
        let periodo = match[3] ? match[3].toLowerCase() : null;

        if (periodo === 'pm' && horas < 12) horas += 12;
        else if (periodo === 'am' && horas === 12) horas = 0;

        const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
        const taskText = value.replace(match[0], '').trim() || "Recordatorio";

        // --- LÓGICA DE GUARDADO (EL FILTRO) ---
        let list = JSON.parse(localStorage.getItem('reminders') || '[]');

        if (editId !== null) {
            // MODO EDICIÓN: Buscamos el ID existente y lo actualizamos
            list = list.map(r => 
                r.id === editId ? { ...r, text: taskText, time: fullTime, notified: false } : r
            );
            console.log("Editado correctamente");
            
            // Resetear estado de edición
            editId = null;
            addBtn.innerText = "Fijar";
            addBtn.style.backgroundColor = ""; // Vuelve al color original
        } else {
            // MODO CREACIÓN: Creamos uno totalmente nuevo
            const newReminder = {
                id: Date.now(),
                text: taskText,
                time: fullTime,
                notified: false
            };
            list.push(newReminder);
            console.log("Creado nuevo");
        }

        // Guardar la lista actualizada (ya sea con el editado o el nuevo)
        localStorage.setItem('reminders', JSON.stringify(list));
        
        renderReminders();
        taskInput.value = '';
        taskInput.classList.remove('input-error');

    } else {
        taskInput.classList.add('input-error');
        setTimeout(() => taskInput.classList.remove('input-error'), 300);
    }
});

function saveReminder(reminder) {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(list));
}

// --- MEJORA 2: RENDERIZADO CON URGENCIA ---
function renderReminders() {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    
    if (list.length === 0) {
        reminderList.innerHTML = `<p style="color: #666; margin-top: 20px;">No tienes pendientes. <br> ¡Disfruta tu tiempo libre! ☕</p>`;
        return;
    }
    const ahora = new Date();
    const horaActualStr = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    reminderList.innerHTML = list.map(r => {
        
        let urgencyClass = '';
        const diff = calcularDiferenciaMinutos(horaActualStr, r.time);
        
        
        
        if (diff > 0 && diff <= 10) urgencyClass = 'urgent';
        else if (diff > 0 && diff <= 60) urgencyClass = 'soon';

        return `
            <div class="reminder-card ${urgencyClass}">
                <div>
                    <span class="time-badge">${r.time}</span>
                    <span>${r.text}</span>
                </div>
                
                <button onclick="prepareEdit(${r.id})" style="background:transparent; color:#bb86fc; border:none; cursor:pointer; margin-right:10px;">✎</button>
                <button onclick="deleteReminder(${r.id})">✕</button>
            </div>
        `;
    }).join('');
}

// Función auxiliar para calcular urgencia
function calcularDiferenciaMinutos(h1, h2) {
    const [hor1, min1] = h1.split(':').map(Number);
    const [hor2, min2] = h2.split(':').map(Number);
    return (hor2 * 60 + min2) - (hor1 * 60 + min1);
}
window.deleteReminder = (id) => {
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list = list.filter(r => r.id !== id);
    localStorage.setItem('reminders', JSON.stringify(list));
    renderReminders();
};

// EL VIGILANTE MEJORADO
setInterval(() => {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const lista = JSON.parse(localStorage.getItem('reminders') || '[]');
    let huboCambios = false;

    lista.forEach(r => {
        if (r.time === horaActual && !r.notified) {
            // DISPARAR NOTIFICACIÓN DESDE EL SERVICE WORKER
            navigator.serviceWorker.ready.then(reg => {
              // Dentro del navigator.serviceWorker.ready.then...
// Dentro de navigator.serviceWorker.ready.then...
reg.showNotification("📝 Recordatorio", {
    body: r.text,
    icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png",
    tag: 'reminder-' + r.id,
    data: { reminderId: r.id, text: r.text }, // Pasamos datos al SW
    actions: [
        { action: 'done', title: '✅ Hecho' },
        { action: 'snooze', title: '⏳ +5 min' }
    ]
});
            });

            r.notified = true;
            huboCambios = true;
            // Borrado automático tras 10 segundos de notificar
            setTimeout(() => { deleteReminder(r.id); }, 10000);
        }
    });

    if (huboCambios) {
        localStorage.setItem('reminders', JSON.stringify(lista));
        renderReminders();
    }
}, 10000); // Revisa cada 10 segundos para más precisión

renderReminders();
// 1. Lleva el recordatorio al input principal
window.prepareEdit = (id) => {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const reminder = list.find(r => r.id === id);
    if (reminder) {
        taskInput.value = `${reminder.text} ${reminder.time}`;
        editId = id;
        addBtn.innerText = "Actualizar";
        taskInput.focus();
    }
};

// 2. Modifica el evento del addBtn para que sepa si está creando o editando
// Busca tu addBtn.addEventListener y envuelve la lógica así:
addBtn.addEventListener('click', () => {
    // ... (aquí va tu lógica de Regex que ya tienes para extraer texto y hora) ...
    
    if (match) {
        // ... (lógica de normalización de hora) ...

        if (editId) {
            // Lógica de Actualizar
            let list = JSON.parse(localStorage.getItem('reminders') || '[]');
            list = list.map(r => r.id === editId ? { ...r, text: taskText, time: fullTime, notified: false } : r);
            localStorage.setItem('reminders', JSON.stringify(list));
            editId = null;
            addBtn.innerText = "Fijar";
        } else {
            // Lógica de Crear (la que ya tenías)
            saveReminder(newReminder);
        }
        renderReminders();
        taskInput.value = '';
    }
});
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
        renderReminders();
        alert("Pospuesto 5 minutos");
    }
});