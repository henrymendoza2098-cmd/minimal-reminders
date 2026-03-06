// Este código corre en segundo plano
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Escuchar mensajes del app.js
self.addEventListener('message', (event) => {
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification("📝 Recordatorio", {
            body: event.data.text,
            icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png",
            vibrate: [200, 100, 200]
        });
    }
});
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Este archivo permite que las notificaciones se muestren fuera de la pestaña
self.addEventListener('notificationclick', (event) => {
    const id = event.notification.data.reminderId;
    const text = event.notification.data.text;
    event.notification.close();

    if (event.action === 'snooze') {
        // Lógica de Posponer: Enviamos mensaje a la app para reprogramar
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'SNOOZE', id: id }));
        });
    } else {
        // Botón "Hecho" o clic normal: Solo cerramos (el vigilante ya lo marcó como notificado)
        console.log("Tarea completada");
    }
});