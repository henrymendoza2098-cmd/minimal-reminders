import { generateSafeId, getTodayStr } from '../core/utils.js';

export let currentAlarmTab = 'rapidos';
export let currentEditingAlarmId = null;
export let habitHistory = JSON.parse(localStorage.getItem('habitHistory') || '{}');
window.isCreatingNewHabit = false;

export function getNotificationIdsForAlarm(alarm) {
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
}
window.getNotificationIdsForAlarm = getNotificationIdsForAlarm;

export async function scheduleNotificationsForAlarm(alarm) {
    if (!window.Notifications) return;
    
    const allPossibleIds = getNotificationIdsForAlarm(alarm);
    await window.Notifications.cancel({ notifications: allPossibleIds.map(id => ({ id })) });
    
    if (!alarm.enabled) return;
    
    const newNotifications = [];
    const weekdayMap = [2, 3, 4, 5, 6, 7, 1]; // Android usa 1=Domingo, 2=Lunes... Nuestro UI: L=0

    let times = alarm.times;
    if (!times && alarm.time) times = [alarm.time]; // Compatibilidad con viejas

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
        await window.Notifications.schedule({ notifications: newNotifications });
    }
}
window.scheduleNotificationsForAlarm = scheduleNotificationsForAlarm;

window.switchAlarmTab = (tab) => {
    currentAlarmTab = tab;
    const btnRapidos = document.getElementById('tabRapidosBtn');
    const btnFrecuentes = document.getElementById('tabFrecuentesBtn');
    if(btnRapidos && btnFrecuentes) {
        btnRapidos.classList.toggle('active-tab', tab === 'rapidos');
        btnFrecuentes.classList.toggle('active-tab', tab === 'frecuentes');
    }
    
    const mainTitle = document.getElementById('remindersMainTitle') || document.querySelector('#view-reminders h2');
    if (mainTitle) {
        mainTitle.style.transition = 'opacity 0.15s ease';
        mainTitle.style.opacity = '0';
        
        setTimeout(() => {
            mainTitle.innerText = tab === 'frecuentes' ? 'Hábitos' : 'Recordatorios';
            mainTitle.style.opacity = '1';
        }, 150);
    }
    if (window.renderAll) window.renderAll();
};

export const PREDEFINED_HABITS = [
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

export let currentConfigHabit = null;
export let currentConfigTimes = [];
export let currentConfigDays = [true, true, true, true, true, true, true];
export let isPickingTimeForHabit = false;

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

    window.renderHcDays();
    window.renderHcTimes();
    
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

window.toggleHcDay = (i) => { currentConfigDays[i] = !currentConfigDays[i]; window.renderHcDays(); };

window.renderHcTimes = () => {
    const container = document.getElementById('hcTimesList');
    container.innerHTML = currentConfigTimes.map((t, i) => `<div class="hc-time-chip"><span>${t}</span><button onclick="removeHcTime(${i})">✕</button></div>`).join('');
};

window.removeHcTime = (i) => { currentConfigTimes.splice(i, 1); window.renderHcTimes(); };

window.openCustomTimePickerForHabit = () => { isPickingTimeForHabit = true; window.openCustomTimePicker(); };

window.saveHabitConfig = () => {
    const name = document.getElementById('hcInputName').value.trim() || currentConfigHabit.title;
    if (currentConfigTimes.length === 0) return alert('Añade al menos una hora para tu hábito.');
    
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
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
    window.closeHabitConfig(); window.closeHabitSelection(); 
    if (window.renderAll) window.renderAll();
};

export function drawAlarms(list, containerId) {
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
                const isSelected = typeof window.selectedItems !== 'undefined' && window.selectedItems.has(`reminders-${item.id}`);
                
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
    if (typeof window.attachGestureEvents === 'function') window.attachGestureEvents();
}
window.drawAlarms = drawAlarms;

export function getHabitColorClass(emoji) {
    const colorMap = {
        '💧': 'habit-color-blue', '🚿': 'habit-color-blue',
        '😴': 'habit-color-darkblue',
        '💪': 'habit-color-yellow', '🏋️': 'habit-color-yellow', '🏃': 'habit-color-yellow',
        '🧘': 'habit-color-purple', '📖': 'habit-color-purple',
        '🍎': 'habit-color-green', '🥗': 'habit-color-green'
    };
    return colorMap[emoji] || 'habit-color-default';
}

export function getNextOccurrence(alarm) {
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
    const jsToUIDay = [6, 0, 1, 2, 3, 4, 5]; 

    for (let i = 0; i < 8; i++) {
        const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const uiDay = jsToUIDay[checkDate.getDay()];
        
        if (daysActive[uiDay]) {
            for (let t of times) {
                const candidate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), t.h, t.m, 0);
                if (candidate > now) {
                    if (!next || candidate < next) next = candidate;
                }
            }
        }
    }
    return next;
}

export function renderActiveHabitsWidget() {
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
        let percent = diffMins <= 1440 ? 1 - (diffMins / 1440) : 0; 
        const dasharray = 188.5; 
        const dashoffset = dasharray - (percent * dasharray);
        
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
window.renderActiveHabitsWidget = renderActiveHabitsWidget;

setInterval(() => {
    if (document.getElementById('view-reminders')?.style.display !== 'none') {
        renderActiveHabitsWidget();
    }
}, 60000);

window.toggleHabitState = (id) => {
    if (typeof window.isSelectionMode !== 'undefined' && window.isSelectionMode) return;
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const index = list.findIndex(r => r.id === id);
    
    if (index !== -1) {
        const currentState = list[index].enabled !== false;
        list[index].enabled = !currentState;
        localStorage.setItem('reminders', JSON.stringify(list));
        scheduleNotificationsForAlarm(list[index]);
        if (window.renderAll) window.renderAll();
    }
};

window.toggleAlarmDay = (alarmId, dayIndex) => {
    if (typeof window.isSelectionMode !== 'undefined' && window.isSelectionMode) return;
    let list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const index = list.findIndex(r => r.id === alarmId);

    if (index !== -1) {
        if (!list[index].days) list[index].days = [true, true, true, true, true, true, true];
        list[index].days[dayIndex] = !list[index].days[dayIndex];
        
        localStorage.setItem('reminders', JSON.stringify(list));
        scheduleNotificationsForAlarm(list[index]);
        
        const card = document.querySelector(`.habit-card-grid[data-id="${alarmId}"]`);
        if (card) {
            const dot = card.querySelectorAll('.habit-day-dot')[dayIndex];
            if (dot) dot.classList.toggle('active', list[index].days[dayIndex]);
            renderActiveHabitsWidget();
        } else {
            if (window.renderAll) window.renderAll();
        }
    }
};

export function confirmDeleteHabit(id) {
    const list = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = list.find(h => h.id === id);
    if (!habit) return;

    if (confirm(`¿Quieres eliminar el hábito "${habit.text}"?`)) {
        if (window.deleteItem) window.deleteItem('reminders', id);
    }
}
window.confirmDeleteHabit = confirmDeleteHabit;

export async function procesarAlarma(value, match) {
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
    
    const ahora = new Date();
    const creadoEl = ahora.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    list.push({ 
        id: idUnico, text, time: fullTime, emoji: "⏰", notified: false, createdAt: creadoEl, isHabit: false 
    });
    localStorage.setItem('reminders', JSON.stringify(list));

    if (window.Notifications) {
        const fechaAlarma = new Date();
        fechaAlarma.setHours(horas, minutos, 0, 0);
        if (fechaAlarma < new Date()) fechaAlarma.setDate(fechaAlarma.getDate() + 1);

        try {
            await window.Notifications.schedule({
                notifications: [{
                    title: "🔔 " + text, body: "Recordatorio fijado a las " + fullTime,
                    id: idUnico, schedule: { at: fechaAlarma, allowWhileIdle: true },
                    importance: 5, sound: 'res://platform_default',
                    actionTypeId: 'REMINDER_ACTIONS', extra: { reminderId: idUnico }
                }]
            });
        } catch (err) {
            console.error("Fallo al programar nativa:", err);
        }
    }
}
window.procesarAlarma = procesarAlarma;

export function saveReminder() {
    const input = document.getElementById('reminderInput');
    if(!input) return;
    const text = input.value;
    const now = new Date();
    const timeCreated = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newReminder = { id: Date.now(), text: text, createdAt: timeCreated, status: 'active' };
    let reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    reminders.push(newReminder);
    localStorage.setItem('reminders', JSON.stringify(reminders));
    procesarAlarma();
}
window.saveReminder = saveReminder;

export function initDynamicReminderUI() {
    if (document.getElementById('reminderBottomSheet')) return;
    
    const uiHTML = `
        <button id="openReminderSheetBtn" class="fab-btn" onclick="expandReminderBar()" style="display: none; background: #F2994A;">
            <span class="fab-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M5 3 2 6"></path><path d="M19 3l3 3"></path><path d="M12 9v4l2 2"></path></svg>
            </span>
            <span class="fab-text">Añadir alarma</span>
        </button>

        <div id="reminderBottomSheet" class="bottom-sheet">
            <div class="sheet-content" style="height: 60svh;">
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
                <div id="remPresetsContainer" class="rem-presets" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 25px;"></div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border-soft); margin-top: auto;">
                    <div class="toolbar-item" title="Añadir hora">
                        <div class="icon-btn" onclick="openCustomTimePicker()">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                    </div>
                <button class="btn-save-task" style="background-color: #F2994A !important; color: #ffffff !important; border-radius: 20px; width: 56px; height: 40px; border: none; box-shadow: none;" onclick="saveDynamicReminder()">
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
                        window.remFabCloseTimeout = setTimeout(() => { fabRem.classList.remove('auto-expanded'); }, 4000);
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
            setTimeout(() => { fabRem.classList.remove('auto-expanded'); }, 4000);
        } else if (fabRem) {
            fabRem.style.display = 'none';
        }
    }, 1500);
}

window.renderRemPresets = () => {
    const container = document.getElementById('remPresetsContainer');
    if (!container) return;
    
    const customPresets = JSON.parse(localStorage.getItem('customRemPresets') || '[1, 5]');
    let html = customPresets.map(min => {
        const label = min >= 60 && min % 60 === 0 ? `+${min/60} h` : `+${min.toString().padStart(2, '0')} min`;
        return `<button class="rem-preset-btn" oncontextmenu="event.preventDefault(); window.removeRemPreset(${min});" onclick="addMinutesToDynamicInput(${min})">${label}</button>`;
    }).join('');
    
    html += `<button class="rem-preset-btn" style="background: var(--pastel-blue); color: var(--accent); border-color: var(--accent); font-weight: bold; padding: 6px 16px;" title="Añadir atajo" onclick="addNewRemPreset()">+</button>`;
    container.innerHTML = html;

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
            customPresets.sort((a,b) => a - b);
            localStorage.setItem('customRemPresets', JSON.stringify(customPresets));
            window.renderRemPresets();
        }
    }
};

window.removeRemPreset = (min) => {
    if (confirm(`¿Quieres eliminar el atajo de +${min} min?`)) {
        let customPresets = JSON.parse(localStorage.getItem('customRemPresets') || '[1, 5]');
        customPresets = customPresets.filter(m => m !== min);
        localStorage.setItem('customRemPresets', JSON.stringify(customPresets));
        window.renderRemPresets();
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
    const time = e.target.value; 
    if(time) {
        const input = document.getElementById('remDynamicInput');
        let textWithoutTime = input.value.replace(/\b\d{1,2}:\d{2}\b/g, '').trim();
        input.value = textWithoutTime ? textWithoutTime + ' ' + time : 'Recordatorio ' + time;
        input.focus();
    }
};

window.saveDynamicReminder = async () => {
    const input = document.getElementById('remDynamicInput');
    const value = input.value.trim();
    if(!value) {
        window.collapseReminderBar();
        return;
    }
    
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = value.match(timeRegex);
    const intervalRegex = /cada\s+(\d+)\s+(minuto|hora|dia)s?/i;
    const intervalMatch = value.match(intervalRegex);

    if (match) {
        if (window.isCreatingNewHabit && !currentEditingAlarmId) {
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
                id: Date.now(), text: text, time: fullTime, emoji: userEmoji,
                isHabit: true, isCustom: true, enabled: true,
                days: [true, true, true, true, true, true, true]
            };

            if (intervalMatch) {
                const count = parseInt(intervalMatch[1]);
                const unit = intervalMatch[2].toLowerCase();
                let generatedTimes = [fullTime];
                let currentH = horas;
                let currentM = minutos;
                
                if (unit.startsWith('hora')) {
                    for (let i = 1; i < 24 / count; i++) {
                        currentH += count;
                        if (currentH > 23) break;
                        generatedTimes.push(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
                    }
                } else if (unit.startsWith('minuto')) {
                    for (let i = 1; i < (24 * 60) / count; i++) {
                        currentM += count;
                        while (currentM >= 60) { currentM -= 60; currentH += 1; }
                        if (currentH > 23) break;
                        generatedTimes.push(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
                    }
                }
                
                newHabit.times = generatedTimes;
                newHabit.days = [true, true, true, true, true, true, true]; 
            } else {
                newHabit.times = [fullTime];
            }

            let list = JSON.parse(localStorage.getItem('reminders') || '[]');
            list.push(newHabit);
            localStorage.setItem('reminders', JSON.stringify(list));
            scheduleNotificationsForAlarm(newHabit);

        } else if (currentEditingAlarmId) {
            let list = JSON.parse(localStorage.getItem('reminders') || '[]');
            const index = list.findIndex(r => r.id === currentEditingAlarmId);

            if (index !== -1) {
                let horas = parseInt(match[1]);
                let minutos = match[2] ? parseInt(match[2]) : 0;
                let periodo = match[3] ? match[3].toLowerCase() : null;
                if (periodo === 'pm' && horas < 12) horas += 12;
                else if (periodo === 'am' && horas === 12) horas = 0;
                const fullTime = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
                let text = value.replace(match[0], '').replace(intervalRegex, '').trim();
                if (!text) text = "Recordatorio";

                list[index].text = text;
                list[index].time = fullTime;

                if (intervalMatch) {
                    const count = parseInt(intervalMatch[1]);
                    const unit = intervalMatch[2].toLowerCase();
                    let generatedTimes = [fullTime];
                    let currentH = horas;
                    let currentM = minutos;
                    
                    if (unit.startsWith('hora')) {
                        for (let i = 1; i < 24 / count; i++) {
                            currentH += count;
                            if (currentH > 23) break;
                            generatedTimes.push(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
                        }
                    } else if (unit.startsWith('minuto')) {
                        for (let i = 1; i < (24 * 60) / count; i++) {
                            currentM += count;
                            while (currentM >= 60) { currentM -= 60; currentH += 1; }
                            if (currentH > 23) break;
                            generatedTimes.push(`${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`);
                        }
                    }
                    
                    list[index].times = generatedTimes;
                    list[index].days = [true, true, true, true, true, true, true];
                    delete list[index].repeat;
                } else {
                    list[index].times = [fullTime];
                    delete list[index].repeat; 
                }

                localStorage.setItem('reminders', JSON.stringify(list));
                scheduleNotificationsForAlarm(list[index]);
            }
        } else {
            await procesarAlarma(value, match);
        }
        
        window.collapseReminderBar(); 
        if (window.renderAll) window.renderAll(); 
    } else {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 500);
        alert("No olvidaste la hora? Usa el icono ⏰");
    }
};

setTimeout(initDynamicReminderUI, 600);

export function initCustomTimePicker() {
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
    document.getElementById('remDynamicInput')?.blur(); 
    
    const overlay = document.getElementById('stp-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);

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
        
        window.onStpScroll(hWheel); window.onStpScroll(mWheel); window.onStpScroll(aWheel);
    }, 50); 
};

window.closeCustomTimePicker = (e) => {
    const overlay = document.getElementById('stp-overlay');
    if (!overlay || (e && e.target !== overlay)) return;
    
    isPickingTimeForHabit = false;
    
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
        window.renderHcTimes();
        isPickingTimeForHabit = false;
    } else {
        const input = document.getElementById('remDynamicInput');
        if (input) {
            let textWithoutTime = input.value.replace(/\b\d{1,2}:\d{2}\s*(am|pm|AM|PM)?\b/gi, '').trim();
            input.value = textWithoutTime ? textWithoutTime + ' ' + timeStr : 'Recordatorio ' + timeStr;
            input.focus();
        }
    }
    window.closeCustomTimePicker();
};

export const getDateKey = (date = new Date()) => {
    if (!(date instanceof Date) || isNaN(date)) {
        date = new Date(); 
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export function openHabitDetailView(habitId) {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = reminders.find(r => r.id === habitId);
    if (!habit) return;

    const view = document.getElementById('view-habit-detail');
    if (!view) return;

    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    view.style.display = 'flex';

    document.querySelectorAll('.fab-btn, #openTaskSheetBtn, .dynamic-reminder-bar').forEach(btn => {
        if(btn) btn.style.display = 'none';
    });

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
        </div>
    `;

    renderHabitStats(habitId, view.querySelector('#habitStatsContainer'));

    view.querySelector('#closeHabitDetailBtn').onclick = () => {
        view.style.display = 'none';
        const remindersView = document.getElementById('view-reminders');
        remindersView.style.display = 'block';
        const fabRem = document.getElementById('openReminderSheetBtn');
        if (fabRem) fabRem.style.display = 'flex';
        if (window.renderAll) window.renderAll();
    };
}
window.openHabitDetailView = openHabitDetailView;

export function completeHabitInstance(habitId) {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const habit = reminders.find(r => r.id === habitId);
    if (!habit) return;

    const todayKey = getDateKey();
    const historyForHabit = habitHistory[habitId] || [];
    const completionsToday = historyForHabit.filter(ts => getDateKey(new Date(ts)) === todayKey).length;
    const totalTimesToday = (habit.times || [habit.time]).length;

    if (completionsToday >= totalTimesToday) return;

    if (!habitHistory[habitId]) habitHistory[habitId] = [];
    
    habitHistory[habitId].push(Date.now());
    localStorage.setItem('habitHistory', JSON.stringify(habitHistory));

    const btn = document.getElementById('habitCompleteBtn');
    if (window.playCompletionSound) window.playCompletionSound();

    if (btn) {
        btn.classList.add('animating');
        setTimeout(() => {
            btn.classList.remove('animating');
            openHabitDetailView(habitId); 
        }, 600);
    } else {
        openHabitDetailView(habitId);
    }
}
window.completeHabitInstance = completeHabitInstance;

export function renderHabitStats(habitId, container) {
    if (!container) return;

    const historyForHabit = habitHistory[habitId] || [];
    
    let currentStreak = 0;
    let longestStreak = 0;
    if (historyForHabit.length > 0) {
        const uniqueDays = [...new Set(historyForHabit.map(ts => {
            const d = new Date(ts);
            return isNaN(d) ? null : getDateKey(d);
        }).filter(Boolean))].sort((a, b) => b.localeCompare(a)); 
        
        let streak = 0;
        let lastDate = null;

        for (let i = 0; i < uniqueDays.length; i++) {
            const d = new Date(uniqueDays[i] + 'T00:00:00');
            if (i === 0) {
                streak = 1;
            } else {
                const prev = new Date(lastDate + 'T00:00:00');
                const diff = Math.round((prev - d) / 86400000); 
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
                if (diff === 1) currentStreak++;
                else break;
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
        
        if (level > 0) dayDiv.dataset.level = level;
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

// EL VIGILANTE DE ALARMAS BLINDADO (Modo Navegador Web)
const isWeb = typeof Capacitor === 'undefined' || Capacitor.getPlatform() === 'web';

if (isWeb) {
    console.log("Modo Web detectado: Iniciando motor de notificaciones por intervalo.");
    setInterval(() => {
        const ahora = new Date();
        const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const lista = JSON.parse(localStorage.getItem('reminders') || '[]');
        let huboCambios = false;

        lista.forEach(r => {
            // 1. Verificamos si la hora actual coincide con la alarma o el hábito
            let timeMatch = false;
            if (r.time === horaActual) timeMatch = true;
            if (r.times && r.times.includes(horaActual)) timeMatch = true;

            // 2. Si es un hábito, verificamos que esté activo hoy y no esté apagado
            let isEnabled = r.enabled !== false;
            let dayMatch = true;
            if (r.isHabit && r.days) {
                const jsToUIDay = [6, 0, 1, 2, 3, 4, 5]; // Transforma día de JS (Dom=0) a nuestra UI (Lun=0)
                const uiDay = jsToUIDay[ahora.getDay()];
                dayMatch = r.days[uiDay];
            }

            if (timeMatch && dayMatch && isEnabled && !r.notified) {
                if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
                    new Notification(r.emoji ? `${r.emoji} ${r.isHabit ? 'Hábito' : 'Recordatorio'}` : "📝 Recordatorio", {
                        body: r.text,
                        icon: "https://cdn-icons-png.flaticon.com/512/559/559339.png"
                    });
                }
                r.notified = true;
                huboCambios = true;
                
                if (!r.isHabit) {
                    setTimeout(() => { if(window.deleteItem) window.deleteItem('reminders', r.id); }, 20000); 
                } else {
                    setTimeout(() => { 
                        let currentList = JSON.parse(localStorage.getItem('reminders') || '[]');
                        currentList = currentList.map(item => item.id === r.id ? { ...item, notified: false } : item);
                        localStorage.setItem('reminders', JSON.stringify(currentList));
                    }, 61000);
                }
            }
        });

        if (huboCambios) {
            localStorage.setItem('reminders', JSON.stringify(lista));
            if(window.renderAll) window.renderAll();
        }
    }, 10000); 
}
