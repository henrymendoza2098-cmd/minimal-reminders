export function getMidnightTime(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
window.getMidnightTime = getMidnightTime;

export function checkStreak() {
    const todayTime = getMidnightTime();
    const lastTime = parseInt(localStorage.getItem('lastStreakDate') || 0);
    let streak = parseInt(localStorage.getItem('streakCount') || 0);

    const ONE_DAY = 86400000; 
    const diffDays = Math.round((todayTime - lastTime) / ONE_DAY);

    if (diffDays > 1) {
        streak = 0;
        localStorage.setItem('streakCount', 0);
    }
    
    if (typeof window.updateStreakUI === 'function') {
        window.updateStreakUI(streak);
    }
}
window.checkStreak = checkStreak;

export function updateComboUI() {
    const completadasHoy = parseInt(localStorage.getItem('completedToday') || 0);
    const container = document.getElementById('streakContainer');
    const fireImg = document.getElementById('streakIcon');
    const countText = document.getElementById('streakCount');
    
    if(!container || !fireImg || !countText) return;

    countText.innerText = `${completadasHoy} ${completadasHoy === 1 ? 'tarea' : 'tareas'}`;

    if (completadasHoy === 0) {
        container.classList.remove('on-fire', 'super-fire');
        fireImg.src = 'fuego_gris.gif';          
        fireImg.style.display = 'block';         
        countText.style.color = "#a7a5a5";
    } else if (completadasHoy < 10) {
        container.classList.remove('super-fire'); 
        container.classList.add('on-fire');       
        fireImg.src = 'fuego_naranja.gif';       
        fireImg.style.display = 'block';         
        countText.style.color = "#747272";         
    } else {
        container.classList.remove('on-fire');    
        container.classList.add('super-fire');    
        fireImg.src = 'fuego_azul.gif';          
        fireImg.style.display = 'block';         
        countText.style.color = "white";         
    }
}
window.updateComboUI = updateComboUI;

export function renderStats() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length + reminders.length;
    
    const totalCompletedEl = document.getElementById('total-completed');
    if (totalCompletedEl) totalCompletedEl.innerText = completed;
    
    const activeTasksEl = document.getElementById('active-tasks');
    if (activeTasksEl) activeTasksEl.innerText = pending;

    const categoryCount = {};
    tasks.concat(reminders).forEach(item => {
        const cat = item.emoji || '📝';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const container = document.getElementById('category-bars-container');
    if (container) {
        container.innerHTML = '';
        const totalItems = tasks.length + reminders.length;
        Object.entries(categoryCount).forEach(([emoji, count]) => {
            const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
            container.innerHTML += `
                <div class="cat-stat-item">
                    <div class="cat-info">
                        <span>${emoji}</span>
                        <span>${count} items</span>
                    </div>
                    <div class="cat-bar-bg">
                        <div class="cat-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
    }
    
    renderWeeklyChart();
}
window.renderStats = renderStats;

export function renderWeeklyChart() {
    const chartContainer = document.getElementById('weekly-chart');
    if (!chartContainer) return;

    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const histHabits = JSON.parse(localStorage.getItem('habitHistory') || '{}');
    const daysData = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    let weeklyTotal = 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        
        const taskDateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const habitDateStr = `${y}-${m}-${day}`;
        
        const completedTasks = tasks.filter(t => t.completed && t.date === taskDateStr).length;
        let completedHabits = 0;
        
        Object.values(histHabits).forEach(historyArray => {
            completedHabits += historyArray.filter(ts => {
                const hd = new Date(ts);
                if (isNaN(hd)) return false;
                return `${hd.getFullYear()}-${String(hd.getMonth() + 1).padStart(2, '0')}-${String(hd.getDate()).padStart(2, '0')}` === habitDateStr;
            }).length;
        });
        
        const dailyTotal = completedTasks + completedHabits;
        weeklyTotal += dailyTotal;

        daysData.push({
            label: i === 0 ? 'Hoy' : dayNames[d.getDay()],
            total: dailyTotal,
            isToday: i === 0
        });
    }
    
    const maxVal = Math.max(...daysData.map(d => d.total), 1); 
    chartContainer.innerHTML = daysData.map(data => {
        const heightPercent = (data.total / maxVal) * 100;
        return `
            <div class="chart-bar-wrapper">
                <span class="chart-val" style="opacity: ${data.total > 0 ? 1 : 0.3}">${data.total}</span>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill ${data.isToday ? 'today' : ''}" style="height: 0%" data-target-height="${heightPercent}%"></div>
                </div>
                <span class="chart-label" style="${data.isToday ? 'color: var(--text-main); font-weight: 800;' : ''}">${data.label}</span>
            </div>
        `;
    }).join('');
    
    setTimeout(() => {
        chartContainer.querySelectorAll('.chart-bar-fill').forEach(bar => {
            bar.style.height = bar.getAttribute('data-target-height');
        });
    }, 50);

    const motivationEl = document.getElementById('weekly-motivation');
    if (motivationEl) {
        let msg = "";
        if (weeklyTotal === 0) {
            const msgs = ["¡Toda gran aventura empieza con un paso! Hoy es el día. 💪", "Un lienzo en blanco. ¡Empieza a completar tus metas! ✨", "No hay prisa, pero tampoco pausas. ¡A por ello! 🚀"];
            msg = msgs[Math.floor(Math.random() * msgs.length)];
        } else if (weeklyTotal < 10) {
            const msgs = ["¡Buen comienzo! Sigue manteniendo ese ritmo constante. 🐢", "Poco a poco se llega lejos. ¡Sigue así! 🌟", "Estás construyendo el hábito, no te detengas. 🔋"];
            msg = msgs[Math.floor(Math.random() * msgs.length)];
        } else if (weeklyTotal < 30) {
            const msgs = ["¡Excelente semana! Tu esfuerzo está dando grandes frutos. 🔥", "¡Imparable! Tienes una racha increíble. ⚡", "¡Muy bien hecho! Eres un ejemplo de constancia. 🎯"];
            msg = msgs[Math.floor(Math.random() * msgs.length)];
        } else {
            const msgs = ["¡Semana Legendaria! Has superado todas las expectativas. 👑", "¡Felicidades, eres una máquina de la productividad! 🏆", "¡Nivel Dios alcanzado! Sigue inspirando con ese ritmo. 💎"];
            msg = msgs[Math.floor(Math.random() * msgs.length)];
        }
        motivationEl.innerText = msg;
    }
}
window.renderWeeklyChart = renderWeeklyChart;

export async function checkSystemHealth() {
    const statusCard = document.getElementById('permission-status-card');
    const statusIcon = document.getElementById('status-icon');
    const statusTitle = document.getElementById('status-title');
    const statusDesc = document.getElementById('status-desc');
    const fixBtn = document.getElementById('fix-permissions-btn');

    if (!statusCard || !statusTitle) return; 

    let LocalNotifications = null;
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins) {
        LocalNotifications = Capacitor.Plugins.LocalNotifications;
    }

    if (!LocalNotifications) {
        statusTitle.innerText = "Modo Desarrollo";
        statusDesc.innerText = "Estás en el navegador. Las alarmas reales solo funcionan en el móvil.";
        statusIcon.innerText = "💻";
        return;
    }
    
    try {
        const perms = await LocalNotifications.checkPermissions();
        if (perms.display === 'granted') {
            statusCard.className = "status-card status-ok";
            statusIcon.innerText = "✅";
            statusTitle.innerText = "Alarmas Listas";
            statusDesc.innerText = "Los permisos están activos y el sistema responde.";
            fixBtn.style.display = "none";
        } else {
            statusCard.className = "status-card status-error";
            statusIcon.innerText = "⚠️";
            statusTitle.innerText = "Acción Requerida";
            statusDesc.innerText = "Las notificaciones están bloqueadas.";
            fixBtn.style.display = "block";
            fixBtn.onclick = async () => {
                await LocalNotifications.requestPermissions();
                checkSystemHealth();
            };
        }
    } catch (error) {
        statusTitle.innerText = "Error de Sistema";
        statusDesc.innerText = "No pudimos conectar con el motor de alarmas.";
    }
}
window.checkSystemHealth = checkSystemHealth;

document.addEventListener('DOMContentLoaded', () => {
    const shareChartBtn = document.getElementById('shareChartBtn');
    if (shareChartBtn) {
        shareChartBtn.addEventListener('click', async () => {
            if (typeof html2canvas === 'undefined') return alert('Cargando herramienta de captura, intenta de nuevo en unos segundos.');
            const chartCard = document.getElementById('weekly-stats-card');
            shareChartBtn.style.display = 'none';
            try {
                const canvas = await html2canvas(chartCard, { backgroundColor: '#ffffff', scale: 2, borderRadius: 16 });
                shareChartBtn.style.display = 'flex'; 
                canvas.toBlob(async (blob) => {
                    const file = new File([blob], "productividad-semanal.png", { type: "image/png" });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try { await navigator.share({ title: 'Mi Productividad', text: '¡Mira mi racha de tareas completadas! 🚀', files: [file] }); } catch(e) {}
                    } else {
                        const link = document.createElement('a'); link.download = 'productividad-semanal.png'; link.href = canvas.toDataURL(); link.click();
                    }
                }, 'image/png');
            } catch (err) {
                shareChartBtn.style.display = 'flex';
                alert("Hubo un problema generando la captura.");
            }
        });
    }
});