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