export const getLocalNotifications = () => {
    return (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) 
           ? Capacitor.Plugins.LocalNotifications 
           : null;
};
export const Notifications = getLocalNotifications();
window.Notifications = Notifications;

const isPushAvailable = typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications;

export async function requestPermissions() {
    if (isPushAvailable) {
        try {
            const permissions = await Notifications.requestPermissions();
            console.log("Estado de permisos:", permissions.display);
        } catch (e) {
            console.error("Error pidiendo permisos:", e);
        }
    }
}

export async function registerNotificationActions() {
    if (Notifications) {
        try {
            await Notifications.registerActionTypes({
                types: [{
                    id: 'REMINDER_ACTIONS',
                    actions: [
                        { id: 'done', title: '✔️ Hecho' },
                        { id: 'snooze', title: '⏰ Posponer 5 min' }
                    ]
                }]
            });
        } catch (e) {
            console.error("Error registrando acciones:", e);
        }
    }
}

export async function syncNotificationsWithStorage() {
    if (!Notifications) return;
    try {
        const pendingReqs = await Notifications.getPending();
        const pendingList = pendingReqs.notifications;
        const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
        let validIds = [];
        
        reminders.forEach(r => {
            if (r.enabled === false) return;
            if (r.isHabit) {
                validIds = validIds.concat(window.getNotificationIdsForAlarm(r));
            } else {
                validIds.push(parseInt(r.id));
            }
        });
        
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        tasks.forEach(t => {
            if (t.time && !t.completed) {
                validIds.push(parseInt(t.id));
            }
        });
        
        pendingList.forEach(notif => {
            if (notif.id === 888888) return;
            if (!validIds.includes(parseInt(notif.id))) {
                Notifications.cancel({ notifications: [{ id: notif.id }] });
            }
        });
    } catch (error) {
        console.error("Error en la sincronización de notificaciones:", error);
    }
}

export function initSWListeners() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(() => {
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        });
    }
}