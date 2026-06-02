import { getTodayStr, isOverdue, getProfileCircle } from '../core/utils.js';

export function renderHistoryView() {
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    const overdue = allTasks.filter(t => !t.completed && t.date && isOverdue(t.date));
    const completed = allTasks.filter(t => t.completed);

    const renderGrouped = (list, containerId, isOverdueList) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                    <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                        <path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2-2v3M3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M21 11H3M12 11v3"></path>
                    </svg>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">Historial vacío</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">No hay tareas aquí.</p>
                </div>`;
            return;
        }

        const groups = {};
        list.forEach(t => {
            const d = t.date || 'Sin fecha';
            if (!groups[d]) groups[d] = [];
            groups[d].push(t);
        });

        const sortedDates = Object.keys(groups).sort((a, b) => {
            if (a === 'Sin fecha') return 1;
            if (b === 'Sin fecha') return -1;
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(yb, mb-1, db) - new Date(ya, ma-1, da);
        });

        let html = '';
        if (!isOverdueList && list.length > 0) {
            html += `<button onclick="window.clearCompletedHistory()" class="btn-text" style="color: var(--error);  width: 100%; font-weight: bold; text-align: center;">🗑️ Vaciar historial </button>`;
        }

        html += sortedDates.map(date => `
            <div class="history-date-group">
                <div class="history-date-title">📅 ${date}</div>
                ${groups[date].map(item => `
                    <div class="reminder-card ${item.completed ? 'completed-task' : ''} ${isOverdueList ? 'urgent' : ''}" style="margin-bottom: 10px; border: none; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <div class="card-info">
                            ${getProfileCircle(item.text, item.icon)}
                            <div class="task-data-wrapper">
                                <span class="task-text-content" style="${item.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${item.text}</span>
                            </div>
                        </div>
                        <div class="actions">
                            ${isOverdueList ? `<button onclick="window.rescheduleToToday(${item.id}, this)" class="btn-reschedule" title="Añadir a Hoy">+</button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
        
        container.innerHTML = html;
    };

    renderGrouped(overdue, 'historyOverdueList', true);
    renderGrouped(completed, 'historyCompletedList', false);
}
window.renderHistoryView = renderHistoryView;

export function rescheduleToToday(id, btnElement) {
    const executeMove = () => {
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.date = getTodayStr(); 
            localStorage.setItem('tasks', JSON.stringify(tasks));
            if (window.renderAll) window.renderAll();
            renderHistoryView();
        }
    };

    if (btnElement) {
        const card = btnElement.closest('.reminder-card');
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-15px)';
            setTimeout(executeMove, 300);
            return;
        }
    }
    executeMove();
}
window.rescheduleToToday = rescheduleToToday;

export function clearCompletedHistory() {
    if(confirm('¿Eliminar todo el historial de tareas completadas? Esta acción no se puede deshacer.')) {
        let allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        allTasks = allTasks.filter(t => !t.completed);
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        if (window.renderAll) window.renderAll();
        renderHistoryView();
    }
}
window.clearCompletedHistory = clearCompletedHistory;

// EVENTOS (Se ejecutan directo porque este script es type="module" y corre después del HTML)
const tabOverdue = document.getElementById('tabOverdue');
const tabCompleted = document.getElementById('tabCompleted');
const historyOverdueList = document.getElementById('historyOverdueList');
const historyCompletedList = document.getElementById('historyCompletedList');

if (tabOverdue && tabCompleted) {
    tabOverdue.addEventListener('click', () => {
        tabOverdue.classList.add('active');
        tabCompleted.classList.remove('active');
        historyOverdueList.style.display = 'block';
        historyCompletedList.style.display = 'none';
    });

    tabCompleted.addEventListener('click', () => {
        tabCompleted.classList.add('active');
        tabOverdue.classList.remove('active');
        historyCompletedList.style.display = 'block';
        historyOverdueList.style.display = 'none';
    });
}

const closeHistoryBtn = document.getElementById('closeHistoryBtn');
if (closeHistoryBtn) {
    closeHistoryBtn.onclick = () => {
        document.getElementById('view-history').style.display = 'none';
        document.getElementById('view-today').style.display = 'block';
        if (window.renderAll) window.renderAll();
    };
}