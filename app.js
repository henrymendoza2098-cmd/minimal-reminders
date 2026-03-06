const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const reminderList = document.getElementById('reminderList');
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker listo'))
        .catch(err => console.log('Error al registrar SW', err));
}

// 1. Solicitar permiso de notificaciones apenas cargue la web
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

// 2. Escuchar el clic del botón "Fijar"
addBtn.addEventListener('click', () => {
    const value = taskInput.value;
    if (!value) return;

    // --- LA MAGIA: EXPRESIÓN REGULAR (REGEX) ---
    // Busca patrones como 18:00, 6:30, 06:30 pm, etc.
    const timeRegex = /\b(\d{1,2}:\d{2})(?:\s*(am|pm))?\b/i;
    const match = value.match(timeRegex);

    if (match) {
        const fullTime = match[0]; // La hora encontrada (ej: "18:00")
        const taskText = value.replace(fullTime, '').trim(); // El resto es el texto
        
        const newReminder = {
            id: Date.now(), // ID único basado en milisegundos
            text: taskText || "Recordatorio sin nombre",
            time: fullTime,
            notified: false
        };

        saveReminder(newReminder);
        renderReminders();
        taskInput.value = ''; // Limpiar campo
    } else {
        alert("Por favor, incluye una hora. Ej: 'Llamar a mamá 18:00'");
    }
});

// 3. Guardar en el LocalStorage (Persistencia de datos)
function saveReminder(reminder) {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(list));
}

// 4. Mostrar los recordatorios en pantalla
function renderReminders() {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    reminderList.innerHTML = list.map(r => `
        <div class="reminder-card">
            <div>
                <strong style="color: #bb86fc;">${r.time}</strong> 
                <span>${r.text}</span>
            </div>
            <button onclick="deleteReminder(${r.id})" style="background:transparent; color:red; border:none; cursor:pointer;">✕</button>
        </div>
    `).join('');
}

// 5. Borrar recordatorios
window.deleteReminder = (id) => {
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list = list.filter(r => r.id !== id);
    localStorage.setItem('reminders', JSON.stringify(list));
    renderReminders();
};

// Cargar la lista al abrir la página
renderReminders();
// 6. El Vigilante: Revisa la hora cada 30 segundos
setInterval(() => {
    const ahora = new Date();
    // Formateamos la hora actual a HH:MM (ej: "18:30")
    const horaActual = ahora.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit'  
    });

    const lista = JSON.parse(localStorage.getItem('reminders') || '[]');
    let huboCambios = false;

    lista.forEach(r => {
        // Si la hora coincide y aún no hemos avisado...
        if (r.time === horaActual && !r.notified) {
            
            // LANZAR NOTIFICACIÓN
            if (Notification.permission === "granted") {
                                // En lugar de new Notification(), usamos esto:
                navigator.serviceWorker.ready.then(registration => {
                    registration.active.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        text: r.text
                    });
                });
            } else {
                // Si no hay permiso, al menos un alert de respaldo
                alert(`¡RECORDATORIO!: ${r.text}`);
            }

            // Marcamos como notificado para que no se repita cada 30 segundos
            r.notified = true;
            huboCambios = true;

            // OPCIONAL: Lógica de "Papel que se quema" 
            // Borramos el recordatorio automáticamente después de 5 segundos de avisar
            setTimeout(() => {
                deleteReminder(r.id);
            }, 5000);
        }
    });

    if (huboCambios) {
        localStorage.setItem('reminders', JSON.stringify(lista));
        renderReminders();
    }
}, 30000); // 30.000 ms = 30 segundos
// Registrar el Service Worker
