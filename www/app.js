// 0. IMPORTACIONES
import { getTodayStr, getTomorrowStr, generateSafeId, isOverdue, getProfileCircle } from './js/core/utils.js';
import { selectedViewDate, calendarDate, setSelectedViewDate, setCalendarDate, initCalendarEvents, renderCalendar, renderWeekView, renderCalendarTasks } from './js/tasks/calendar.js';
import { drawTasks } from './js/tasks/tasks.js';
import { initOrganizeTasks } from './js/tasks/organize.js';
import './js/tasks/history.js';
import './js/alarms/habits.js';
import './js/notes/canvas.js';
import './js/notes/notes.js';
import './js/profile/profile.js';
import './js/profile/focus.js';
import { initSWListeners, registerNotificationActions, syncNotificationsWithStorage, requestPermissions } from './js/core/notifications.js';
import { attachGestureEvents, initMultiSelectBar } from './js/core/gestures.js';
import { initMoodWidget, updateMoodUI, renderEnergySuggestion } from './js/profile/mood.js';
import { updateMainTitle, updateProgress, initProgressToggle, setupHeaderMenu, initCategoryChips, initSideMenu, setupSearchLogic, initNavigation, initKeyboardHandling, initFABEvents, initImageViewer, initCapacitorBackButton } from './js/core/ui.js';

// 1. VARIABLES GLOBALES Y ESTADO
window.taskViewMode = 'today'; 
window.selectedEmoji = "📝"; 
window.currentFilter = 'all';
window.showCompleted = false;
window.isSelectionMode = false;
window.selectedItems = new Set(); 

export const defaultCategories = [
    { name: 'Todas', filter: 'all', icon: '🏠' },
    { name: 'General', filter: '📝', icon: '📝' },
    { name: 'Redes', filter: '🌐', icon: '🌐' },
    { name: 'BD', filter: '🗄️', icon: '🗄️' },
    { name: 'Física', filter: '⚛️', icon: '⚛️' },
    { name: 'Código', filter: '💻', icon: '💻' },
    { name: 'Ocio', filter: '🎮', icon: '🎮' }
];
window.defaultCategories = defaultCategories;

window.toggleTaskView = function() {
    const isTodayView = selectedViewDate === getTodayStr();
    if (!isTodayView) {
        window.taskViewMode = 'today';
        setSelectedViewDate(getTodayStr()); 
        const parts = selectedViewDate.split('/');
        setCalendarDate(new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    } else if (window.taskViewMode === 'today') {
        window.taskViewMode = 'all';
    } else {
        window.taskViewMode = 'today';
    }
    renderAll();
};

window.renderList = function(key, elementId, isAlarm) {
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    
    if (key === 'tasks' && window.currentFilter !== 'all') {
        list = list.filter(item => item.emoji === window.currentFilter);
    }

    if (isAlarm) {
        if (typeof window.drawAlarms === 'function') window.drawAlarms(list, elementId);
        return;
    }

    if (!isAlarm && key === 'tasks') {
        const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const mainTaskListContainer = document.getElementById('taskList');
        const pendingTitle = document.getElementById('pendingTasksTitle');
        const completedHeader = document.getElementById('completedTasksHeader');
        const completedContainer = document.getElementById('completedTaskList');

        const completedForDate = allTasks.filter(t => t.completed && t.date === selectedViewDate);
        drawTasks(completedForDate, 'completedTaskList', true, key);
        if (completedHeader) completedHeader.style.display = completedForDate.length > 0 ? 'flex' : 'none';
        if (completedContainer) completedContainer.style.display = (completedForDate.length > 0 && window.showCompleted) ? 'block' : 'none';

        let pendingHtml = '';
        let hasPendingTasks = false;
        
        const isTodayView = selectedViewDate === getTodayStr();

        if (window.taskViewMode === 'all' && isTodayView) {
            const overdue = allTasks.filter(t => !t.completed && t.date && isOverdue(t.date));
            const notOverdue = allTasks.filter(t => !t.completed && (!t.date || !isOverdue(t.date)));

             if (notOverdue.length > 0) {
                pendingHtml += '<h3 class="section-subtitle">Próximas / Hoy</h3>';
                pendingHtml += drawTasks(notOverdue, null, false, 'tasks') || '';
                hasPendingTasks = true;
            }
            if (overdue.length > 0) {
                pendingHtml += '<h3 class="section-subtitle">Vencidas</h3>';
                pendingHtml += drawTasks(overdue, null, false, 'tasks') || '';
                hasPendingTasks = true;
            }
            if (pendingTitle) pendingTitle.style.display = 'none'; 
        } else {
            const pendingForDate = allTasks.filter(t => !t.completed && t.date === selectedViewDate);
            pendingHtml = drawTasks(pendingForDate, null, false, 'tasks') || '';
            hasPendingTasks = pendingForDate.length > 0;
            if (pendingTitle) pendingTitle.style.display = (hasPendingTasks || completedForDate.length > 0) ? 'block' : 'none';
        }

        if (!hasPendingTasks) {
            if (pendingTitle) pendingTitle.style.display = 'none';
            drawTasks([], 'taskList', false, 'tasks'); 
        } else {
            if (mainTaskListContainer) mainTaskListContainer.innerHTML = pendingHtml;
        }

        attachGestureEvents();
        return;
    }
    drawTasks(list, elementId, isAlarm, key);
};

window.renderAll = function() {
    updateMainTitle(); 
    const todayView = document.getElementById('view-today');
    if (todayView && (todayView.style.display === 'block' || todayView.style.display === '')) {
        renderWeekView();
    }
    window.renderList('reminders', 'reminderList', true);
    window.renderList('tasks', 'taskList', false);
    if (window.renderNotes) window.renderNotes();
    if (window.renderNoteCategoriesCarousel) window.renderNoteCategoriesCarousel();
    if (window.renderActiveHabitsWidget) window.renderActiveHabitsWidget();
    updateProgress();
    if (window.updateComboUI) window.updateComboUI();
    
    if (window.currentFocusedCategory) {
        if (typeof window.renderCategoryNotesList === 'function') window.renderCategoryNotesList(window.currentFocusedCategory);
    }
    
    renderEnergySuggestion();
};

window.refreshApp = function() {
    if (window.renderNotes) window.renderNotes();
    if (window.fullCalendarInstance) { 
        window.fullCalendarInstance.refetchEvents();
    } else {
        renderCalendar();
    }
};

setInterval(() => {
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const todayStr = getTodayStr();

    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    let tasksChanged = false;

    allTasks.forEach(t => {
        if (t.isPopup && !t.completed && !t.popupNotified && t.popupDate === todayStr && t.popupTime === horaActual) {
            if (typeof window.showPopupReminder === 'function') {
                window.showPopupReminder(t);
                t.popupNotified = true;
                tasksChanged = true;
            }
        }
    });

    if (tasksChanged) {
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        window.renderAll();
    }
}, 10000);

document.addEventListener('DOMContentLoaded', () => {
    initSWListeners();
    requestPermissions();
    registerNotificationActions(); 
    syncNotificationsWithStorage();
    
    initNavigation();
    initKeyboardHandling();
    initFABEvents();
    initImageViewer();
    initCapacitorBackButton();
    
    initCalendarEvents(); 
    initMultiSelectBar();
    initCategoryChips();
    initSideMenu();
    setupHeaderMenu();
    setupSearchLogic();
    initMoodWidget();
    initProgressToggle();
    initOrganizeTasks();
    
    const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
    if (toggleCompletedBtn) {
        toggleCompletedBtn.addEventListener('click', () => {
            window.showCompleted = !window.showCompleted;
            const container = document.getElementById('completedTaskList');
            if (container) container.style.display = window.showCompleted ? 'block' : 'none';
        });
    }
    
    window.renderAll();
});
