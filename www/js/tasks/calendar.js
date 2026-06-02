import { getTodayStr } from '../core/utils.js';

export let selectedViewDate = getTodayStr();
export let calendarDate = new Date();

window.selectedViewDate = selectedViewDate;
window.calendarDate = calendarDate;

export function setSelectedViewDate(dateStr) {
    selectedViewDate = dateStr;
    window.selectedViewDate = dateStr;
}

export function setCalendarDate(dateObj) {
    calendarDate = dateObj;
    window.calendarDate = dateObj;
}

export function initCalendarEvents() {
    const openBtn = document.getElementById('openCalendarBtn');
    const closeBtn = document.getElementById('closeCalendarBtn');
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if(openBtn) openBtn.onclick = () => {
        document.getElementById('view-today').style.display = 'none';
        document.getElementById('view-calendar').style.display = 'block';
        renderCalendar();
    };

    if(closeBtn) closeBtn.onclick = () => {
        document.getElementById('view-calendar').style.display = 'none';
        document.getElementById('view-today').style.display = 'block';
        if(window.renderAll) window.renderAll();
    };

    if(prevBtn) prevBtn.onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    };

    if(nextBtn) nextBtn.onclick = () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    };
    
    // Gestos para cambiar de mes
    let calendarStartX = 0;
    const calContainer = document.getElementById('calendar-container');
    if (calContainer) {
        calContainer.addEventListener('touchstart', e => {
            calendarStartX = e.touches[0].clientX;
        }, { passive: true });
        
        calContainer.addEventListener('touchend', e => {
            if (!calendarStartX) return;
            const diffX = e.changedTouches[0].clientX - calendarStartX;
            if (diffX > 50) document.getElementById('prevMonth').click();
            else if (diffX < -50) document.getElementById('nextMonth').click();
            calendarStartX = 0;
        });
    }
}

export function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const monthYearText = document.getElementById('currentMonthYear');
    if (!container || !monthYearText) return;

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
        
        const currentMood = moods[dateKey];
        const moodEmoji = currentMood ? `<div style="font-size: 10px; position: absolute; top: -5px; right: -5px;">${currentMood}</div>` : '';
        
        dayDiv.innerHTML = `${day}${moodEmoji}`;

        if (currentMood) {
            if (currentMood === '🤩') dayDiv.classList.add('mood-amazing');
            else if (currentMood === '😎') dayDiv.classList.add('mood-happy');
            else if (currentMood === '🫠') dayDiv.classList.add('mood-neutral');
            else if (currentMood === '🥺') dayDiv.classList.add('mood-sad');
            else if (currentMood === '🤯') dayDiv.classList.add('mood-terrible');
        }
        
        const hasTasks = tasks.some(t => t.date === dateKey);
        if (hasTasks) dayDiv.classList.add('has-tasks');

        if (dateKey === todayStr) dayDiv.classList.add('today');
        if (dateKey === selectedViewDate) dayDiv.classList.add('active');

        dayDiv.onclick = () => {
            setSelectedViewDate(dateKey);
            renderCalendar();
            renderCalendarTasks(dateKey);
        };
        container.appendChild(dayDiv);
    }
}

export function renderCalendarTasks(date) {
    const normalize = (d) => d.split('/').map(n => parseInt(n)).join('/');
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const buscaFecha = normalize(date);

    const tasksForDay = allTasks.filter(t => {
        if (!t.date) return false;
        return normalize(t.date) === buscaFecha;
    });

    if (window.drawTasks) window.drawTasks(tasksForDay, 'calendarTaskList', false, 'tasks');
    
    const title = document.getElementById('selectedDateTitle');
    if (title) title.innerText = `Tareas para el ${date}`;
}

export function renderWeekView() {
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

                setSelectedViewDate(dayStr);
                const parts = dayStr.split('/');
                setCalendarDate(new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
                
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
            setSelectedViewDate(dayStr);
            if (window.renderAll) window.renderAll();
        };
        container.appendChild(dayDiv);
    }

    if (activeDayElement) {
        setTimeout(() => {
            activeDayElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 100);
    }
}
