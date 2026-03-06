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
    const value = taskInput.value;
    if (!value) return;

    // Detecta: 18:00, 6:00pm, 6pm, 06:30 AM
    const timeRegex = /\b(\d{1,2}(?::\d{2})?)\s*(am|pm)?\b/i;
    const match = value.match(timeRegex);

    if (match) {
        let rawTime = match[1];
        let period = match[2]; // am o pm

        // Normalización de hora (Ej: "6" -> "06:00", "6pm" -> "18:00")
        let [horas, minutos] = rawTime.includes(':') ? rawTime.split(':') : [rawTime, "00"];
        horas = parseInt(horas);

        if (period) {
            if (period.toLowerCase() === 'pm' && horas < 12) horas += 12;
            if (period.toLowerCase() === 'am' && horas === 12) horas = 0;
        }
        
        const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.padStart(2, '0')}`;
        const taskText = value.replace(match[0], '').trim();

        saveReminder({
            id: Date.now(),
            text: taskText || "Recordatorio",
            time: fullTime,
            notified: false
        });
        
        renderReminders();
        taskInput.value = '';
        taskInput.classList.remove('input-error');
    } else {
        // Feedback visual de error
        taskInput.classList.add('input-error');
        setTimeout(() => taskInput.classList.remove('input-error'), 3000);
    }
});

// --- MEJORA 2: RENDERIZADO CON URGENCIA ---
function renderReminders() {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const ahora = new Date();
    const horaActualStr = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    reminderList.innerHTML = list.map(r => {
        // Lógica de color por proximidad
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
                reg.showNotification("📝 Recordatorio", {
                    body: r.text,
                    icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png",
                    vibrate: [200, 100, 200],
                    requireInteraction: true // Se queda en pantalla hasta que la veas
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