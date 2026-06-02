import { getTodayStr, isOverdue } from '../core/utils.js';

export function initOrganizeTasks() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#openOrganizeBtn');
        if (btn) {
            document.getElementById('view-today').style.display = 'none';
            document.getElementById('view-organize').style.display = 'block';
            document.getElementById('newTaskListBtn')?.click(); 
        }
    });

    const closeOrganizeBtn = document.getElementById('closeOrganizeBtn');
    if (closeOrganizeBtn) {
        closeOrganizeBtn.onclick = () => {
            document.getElementById('view-organize').style.display = 'none';
            document.getElementById('view-today').style.display = 'block';
        };
    }

    const newTaskListBtn = document.getElementById('newTaskListBtn');
    const viewPendingTasksBtn = document.getElementById('viewPendingTasksBtn');
    const organizeNewList = document.getElementById('organizeNewList');
    const organizePending = document.getElementById('organizePending');

    if (newTaskListBtn && viewPendingTasksBtn) {
        newTaskListBtn.addEventListener('click', () => {
            organizeNewList.style.display = 'flex';
            organizePending.style.display = 'none';
            newTaskListBtn.classList.add('active');
            viewPendingTasksBtn.classList.remove('active');
            
            const carousel = document.getElementById('planCardsCarousel');
            if (carousel && carousel.children.length === 0) {
                if (!window.loadDailyPlan()) window.addPlanCard(); 
            }
        });

        viewPendingTasksBtn.addEventListener('click', () => {
            organizeNewList.style.display = 'none';
            organizePending.style.display = 'flex';
            viewPendingTasksBtn.classList.add('active');
            newTaskListBtn.classList.remove('active');
            if (window.renderPendingCarousel) window.renderPendingCarousel(); 
        });
    }

    const addPlanCardBtn = document.getElementById('addPlanCardBtn');
    if (addPlanCardBtn) addPlanCardBtn.addEventListener('click', () => window.addPlanCard());

    document.getElementById('planMainTitle')?.addEventListener('input', window.saveDailyPlan);
    document.getElementById('planMainDesc')?.addEventListener('input', window.saveDailyPlan);
}

window.addPlanCard = () => {
    const carousel = document.getElementById('planCardsCarousel');
    const cardId = Date.now() + Math.floor(Math.random() * 100);
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.id = `plan-card-${cardId}`;
    card.innerHTML = `
        <input type="text" class="plan-card-title" placeholder="Ej: Mañana, Tarde, Noche..." oninput="saveDailyPlan()">
        <div class="plan-items-container" id="items-${cardId}"></div>
        <div class="add-check-item" onclick="addPlanItem(${cardId})">
            <span style="font-size: 22px; color: var(--accent); font-weight: bold;">+</span> Añadir subtarea
        </div>
        <button class="btn-text" style="margin-top: auto; padding-top: 15px; font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center;" onclick="this.closest('.plan-card').remove(); saveDailyPlan();">✓ Lista completada</button>
    `;
    carousel.appendChild(card);
    window.addPlanItem(cardId); 
    window.saveDailyPlan();
    setTimeout(() => { card.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, 50);
};

window.addPlanItem = (cardId) => {
    const container = document.getElementById(`items-${cardId}`);
    if (!container) return;
    const itemId = Date.now() + Math.floor(Math.random() * 1000);
    const itemDiv = document.createElement('div');
    itemDiv.className = 'plan-check-item';
    itemDiv.id = `plan-item-${itemId}`;
    itemDiv.innerHTML = `
        <div class="plan-check-box" onclick="togglePlanItem(${itemId})"></div>
        <input type="text" placeholder="Escribe algo..." oninput="saveDailyPlan()" onkeydown="if(event.key === 'Enter') { event.preventDefault(); addPlanItem(${cardId}); }">
        <button onclick="this.parentElement.remove(); saveDailyPlan();" style="background:transparent; color:var(--error); border:none; padding:0 5px; font-size:18px; opacity:0.5;">✕</button>
    `;
    container.appendChild(itemDiv);
    itemDiv.querySelector('input[type="text"]').focus(); 
    window.saveDailyPlan();
};

window.togglePlanItem = (itemId) => {
    document.getElementById(`plan-item-${itemId}`).classList.toggle('done');
    window.saveDailyPlan();
};

window.saveDailyPlan = () => {
    const title = document.getElementById('planMainTitle')?.value || '';
    const desc = document.getElementById('planMainDesc')?.value || '';
    const cards = [];
    document.querySelectorAll('.plan-card').forEach(card => {
        const cardId = card.id.replace('plan-card-', '');
        const cardTitle = card.querySelector('.plan-card-title').value;
        const items = [];
        card.querySelectorAll('.plan-check-item').forEach(item => {
            const itemId = item.id.replace('plan-item-', '');
            const text = item.querySelector('input[type="text"]').value;
            const done = item.classList.contains('done');
            items.push({ id: itemId, text, done });
        });
        cards.push({ id: cardId, title: cardTitle, items });
    });
    localStorage.setItem('dailyPlan', JSON.stringify({ title, desc, cards }));
};

window.loadDailyPlan = () => {
    const dataStr = localStorage.getItem('dailyPlan');
    if (!dataStr) return false;
    
    const data = JSON.parse(dataStr);
    if (!data || !data.cards || data.cards.length === 0) return false;

    const mainTitle = document.getElementById('planMainTitle');
    const mainDesc = document.getElementById('planMainDesc');
    if (mainTitle) mainTitle.value = data.title || '';
    if (mainDesc) mainDesc.value = data.desc || '';

    const carousel = document.getElementById('planCardsCarousel');
    if (!carousel) return false;
    carousel.innerHTML = '';

    data.cards.forEach(cardData => {
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.id = `plan-card-${cardData.id}`;
        const safeTitle = (cardData.title || '').replace(/"/g, '&quot;');
        card.innerHTML = `
            <input type="text" class="plan-card-title" placeholder="Ej: Mañana, Tarde, Noche..." value="${safeTitle}" oninput="saveDailyPlan()">
            <div class="plan-items-container" id="items-${cardData.id}">
                ${cardData.items.map(item => {
                    const safeText = (item.text || '').replace(/"/g, '&quot;');
                    return `
                    <div class="plan-check-item ${item.done ? 'done' : ''}" id="plan-item-${item.id}">
                        <div class="plan-check-box" onclick="togglePlanItem(${item.id})"></div>
                        <input type="text" placeholder="Escribe algo..." value="${safeText}" oninput="saveDailyPlan()" onkeydown="if(event.key === 'Enter') { event.preventDefault(); addPlanItem(${cardData.id}); }">
                        <button onclick="this.parentElement.remove(); saveDailyPlan();" style="background:transparent; color:var(--error); border:none; padding:0 5px; font-size:18px; opacity:0.5;">✕</button>
                    </div>
                    `;
                }).join('')}
            </div>
            <div class="add-check-item" onclick="addPlanItem(${cardData.id})">
                <span style="font-size: 22px; color: var(--accent); font-weight: bold;">+</span> Añadir subtarea
            </div>
            <button class="btn-text" style="margin-top: auto; padding-top: 15px; font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center;" onclick="this.closest('.plan-card').remove(); saveDailyPlan();">✓ Lista completada</button>
        `;
        carousel.appendChild(card);
    });
    return true;
    };

window.renderPendingCarousel = () => {
    const carousel = document.getElementById('pendingCardsCarousel');
    if (!carousel) return;
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const pending = allTasks.filter(t => !t.completed && !t.skipped && (t.date === getTodayStr() || isOverdue(t.date)));
    
    if (pending.length === 0) {
        carousel.innerHTML = `<div class="pending-task-card active-card" style="background: var(--bg-card); border: none; justify-content: center;"><div style="font-size: 40px; margin-bottom: 15px;">🎉</div><div style="font-weight: 800; font-size: 20px; color: var(--text-main);">¡Día despejado!</div><div style="font-size: 14px; color: var(--text-sub); margin-top: 8px;">No hay tareas pendientes para hoy.</div></div>`;
        return;
    }
    
    carousel.innerHTML = pending.map((t, index) => `
        <div class="pending-task-card ${index === 0 ? 'active-card' : ''}">
            <div style="font-size: 36px; margin-bottom: 10px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));">${t.emoji || '📝'}</div>
            <div style="font-weight: 800; font-size: 18px; color: var(--text-main); margin-bottom: 10px; line-height: 1.2;">${t.text}</div>
            ${t.time ? `<div style="font-size: 13px; font-weight: 800; color: var(--accent); background: white; padding: 6px 14px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-bottom: 10px; display:inline-block;">⏰ ${t.time}</div>` : ''}
            ${isOverdue(t.date) ? `<div style="font-size: 12px; font-weight: bold; color: var(--error); margin-bottom: 10px;">(Vencida)</div>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: auto; padding-top: 10px;">
                <button class="btn-text" style="font-size: 14px; font-weight: 600; color: var(--success); width: 100%; text-align: center; background: rgba(82, 189, 148, 0.1); border-radius: 12px; padding: 12px;" onclick="window.toggleTaskComplete(${t.id}); setTimeout(()=>window.renderPendingCarousel(), 300);">✓ Completar tarea</button>
                
                <div style="display: flex; gap: 8px; width: 100%;">
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: #d35400; background: rgba(211, 84, 0, 0.1); border-radius: 12px; padding: 10px;" onclick="window.skipTask(${t.id})">🚫 No hacer</button>
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: var(--error); background: rgba(235, 87, 87, 0.1); border-radius: 12px; padding: 10px;" onclick="window.deleteItem('tasks', ${t.id}); setTimeout(()=>window.renderPendingCarousel(), 300);">🗑️ Borrar</button>
                    <button class="btn-text" style="flex: 1; font-size: 12px; font-weight: 600; color: var(--accent); background: rgba(84, 163, 214, 0.1); border-radius: 12px; padding: 10px;" onclick="window.showSnoozeOptions(${t.id})">⏱️ Aplazar</button>
                </div>
            </div>
            
            <div id="snooze-options-${t.id}" style="display: none; flex-direction: column; gap: 8px; width: 100%; margin-top: 10px; background: var(--bg-app); padding: 10px; border-radius: 12px;">
                <span style="font-size: 12px; font-weight: bold; color: var(--text-sub);">¿Cuándo la harás?</span>
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'later')">Más tarde</button>
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'tomorrow')">Mañana</button>
                    <button class="btn-text" style="flex: 1; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-card); border: 1px solid var(--accent); border-radius: 8px; padding: 8px;" onclick="window.snoozeTask(${t.id}, 'other')">Otro día</button>
                </div>
            </div>
        </div>
    `.trim()).join('');
    
    carousel.onscroll = () => {
        const cards = carousel.querySelectorAll('.pending-task-card');
        const center = carousel.scrollLeft + carousel.clientWidth / 2;
        cards.forEach(card => {
            const cardCenter = card.offsetLeft + card.clientWidth / 2;
            const distance = Math.abs(center - cardCenter);
            if (distance < card.clientWidth / 1.5) {
                card.classList.add('active-card');
            } else {
                card.classList.remove('active-card');
            }
        });
    };
    setTimeout(() => carousel.dispatchEvent(new Event('scroll')), 50);
};