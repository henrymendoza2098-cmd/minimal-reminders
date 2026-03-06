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

addBtn.addEventListener('click', () => {
    const value = taskInput.value;
    if (!value) return;

    const timeRegex = /\b(\d{1,2}:\d{2})(?:\s*(am|pm))?\b/i;
    const match = value.match(timeRegex);

    if (match) {
        let fullTime = match[1]; // Extraer HH:MM
        
        // PARCHE TÉCNICO: Normalizar a HH:MM (añadir cero si falta)
        const [horas, minutos] = fullTime.split(':');
        fullTime = `${horas.padStart(2, '0')}:${minutos.padStart(2, '0')}`;

        const taskText = value.replace(match[0], '').trim();
        
        const newReminder = {
            id: Date.now(),
            text: taskText || "Recordatorio",
            time: fullTime,
            notified: false
        };

        saveReminder(newReminder);
        renderReminders();
        taskInput.value = '';
    } else {
        alert("Pon la hora así: 18:30");
    }
});

function saveReminder(reminder) {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    list.push(reminder);
    localStorage.setItem('reminders', JSON.stringify(list));
}

function renderReminders() {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    reminderList.innerHTML = list.map(r => `
        <div class="reminder-card">
            <div><strong>${r.time}</strong> - ${r.text}</div>
            <button onclick="deleteReminder(${r.id})">✕</button>
        </div>
    `).join('');
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