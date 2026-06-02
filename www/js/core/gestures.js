export function attachGestureEvents() {
    const cards = document.querySelectorAll('.reminder-card, .alarm-card, .habit-card, .habit-card-grid');
    cards.forEach(card => {
        if (card.dataset.gesturesAttached) return;
        card.dataset.gesturesAttached = 'true';
        let startX, startY, isDragging = false, isScrolling = false, longPressTimer;
        const SWIPE_LIMIT = -90; 

        const onTouchStart = (e) => {
            if (e.target.closest('.actions')) return;
            const currentlySwiped = document.querySelector('.reminder-card.swiped');
            if (currentlySwiped && currentlySwiped !== card) {
                currentlySwiped.style.transform = 'translateX(0)';
                currentlySwiped.classList.remove('swiped');
                e.preventDefault();
                return;
            }
            startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            isDragging = false; isScrolling = false;
            card.classList.add('is-dragging');

            longPressTimer = setTimeout(() => {
                if (!isDragging && !isScrolling) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    const id = parseInt(card.dataset.id);
                    const key = card.dataset.key;
                    if (card.classList.contains('habit-card')) {
                        if (window.confirmDeleteHabit) window.confirmDeleteHabit(id);
                    } else {
                        if (typeof window.toggleSelection === 'function') window.toggleSelection(card, id, key);
                    }
                }
            }, 600); 
        };

        const onTouchMove = (e) => {
            if (startX === undefined || startY === undefined) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = Math.abs(e.touches[0].clientY - startY);

            if (!isDragging && !isScrolling) {
                if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
                    if (card.closest('.swipe-container')) { isDragging = true; clearTimeout(longPressTimer); }
                    else clearTimeout(longPressTimer);
                } else if (deltaY > 10) {
                    isScrolling = true; clearTimeout(longPressTimer);
                }
            }
            if (isDragging) {
                e.preventDefault();
                let moveOffset = card.classList.contains('swiped') ? SWIPE_LIMIT + deltaX : deltaX;
                card.style.transform = `translateX(${Math.max(SWIPE_LIMIT, Math.min(0, moveOffset))}px)`;
            }
        };

        const onTouchEnd = () => {
            clearTimeout(longPressTimer);
            card.classList.remove('is-dragging');
            startX = undefined; startY = undefined;
            if (!isDragging) return;
            if (new DOMMatrix(getComputedStyle(card).transform).m41 < SWIPE_LIMIT / 2) {
                card.style.transform = `translateX(${SWIPE_LIMIT}px)`;
                card.classList.add('swiped');
            } else {
                card.style.transform = 'translateX(0)';
                card.classList.remove('swiped');
            }
        };

        card.addEventListener('touchstart', onTouchStart, { passive: false });
        card.addEventListener('touchmove', onTouchMove, { passive: false });
        card.addEventListener('touchend', onTouchEnd);
        card.addEventListener('touchcancel', onTouchEnd);
    });
}

export function initMultiSelectBar() {
    if (document.getElementById('multiSelectBar')) return;
    const bar = document.createElement('div');
    bar.className = 'multi-select-bar';
    bar.id = 'multiSelectBar';
    bar.innerHTML = `
        <button class="ms-btn" onclick="msCancel()"><span>❌</span>Cancelar</button>
        <button class="ms-btn" onclick="msPin()"><span>📌</span>Anclar</button>
        <button class="ms-btn" onclick="msCopy()"><span>📋</span>Copiar</button>
        <button class="ms-btn delete" onclick="msDelete()"><span>🗑️</span>Borrar <b id="msCount"></b></button>
    `;
    document.body ? document.body.appendChild(bar) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(bar));
}

function enterSelectionMode() {
    window.isSelectionMode = true;
    const bar = document.getElementById('multiSelectBar');
    if (bar) bar.classList.add('active');
    document.querySelectorAll('.fab-btn, #openTaskSheetBtn').forEach(btn => { if(btn) btn.style.transform = 'scale(0)'; });
}

function exitSelectionMode() {
    window.isSelectionMode = false;
    window.selectedItems.clear();
    const bar = document.getElementById('multiSelectBar');
    if (bar) bar.classList.remove('active');
    document.querySelectorAll('.reminder-card.selected, .alarm-card.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.fab-btn, #openTaskSheetBtn').forEach(btn => { if(btn) btn.style.transform = 'none'; });
}

function updateMultiSelectBar() {
    const countEl = document.getElementById('msCount');
    if (countEl) countEl.innerText = `(${window.selectedItems.size})`;
}

window.msCancel = () => exitSelectionMode();

window.msDelete = () => {
    if (!confirm(`¿Borrar ${window.selectedItems.size} elemento(s)?`)) return;
    window.selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        list = list.filter(i => String(i.id) !== String(id));
        localStorage.setItem(type, JSON.stringify(list));
        if (type === 'reminders' && typeof window.Notifications !== 'undefined' && window.Notifications) { window.Notifications.cancel({ notifications: [{ id: id }] }); }
    });
    exitSelectionMode();
    if (window.renderAll) window.renderAll();
};

window.msPin = () => {
    window.selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        list = list.map(i => i.id === id ? { ...i, pinned: !i.pinned } : i);
        localStorage.setItem(type, JSON.stringify(list));
    });
    exitSelectionMode();
    if (window.renderAll) window.renderAll();
};

window.msCopy = () => {
    let textToCopy = [];
    window.selectedItems.forEach(mapKey => {
        const [type, idStr] = mapKey.split('-');
        const id = parseInt(idStr);
        let list = JSON.parse(localStorage.getItem(type) || '[]');
        let found = list.find(i => i.id === id);
        if (found) textToCopy.push(found.content || found.text || found.title || '');
    });
    navigator.clipboard.writeText(textToCopy.join('\n\n')).then(() => {
        if (typeof window.showCopyToast === 'function') window.showCopyToast();
        exitSelectionMode();
    });
};

window.handleItemClick = (e, element, id, type) => {
    try {
        if (window.isSelectionMode) {
            e.preventDefault(); e.stopPropagation();
            if (typeof window.toggleSelection === 'function') window.toggleSelection(element, id, type);
        } else {
            if (type === 'notes' && typeof window.openEditNote === 'function') window.openEditNote(id);
            else if (type === 'reminders' && element.classList.contains('rapid-card') && typeof window.expandReminderBar === 'function') window.expandReminderBar(id);
            else if (type === 'tasks' && typeof window.openTaskSheet === 'function') window.openTaskSheet(id);
        }
    } catch (err) { window.isSelectionMode = false; }
};

export function toggleSelection(element, id, type) {
    const mapKey = `${type}-${id}`;
    if (window.selectedItems.has(mapKey)) {
        window.selectedItems.delete(mapKey);
        if (element) element.classList.remove('selected');
        if (window.selectedItems.size === 0) exitSelectionMode();
    } else {
        window.selectedItems.add(mapKey);
        if (element) element.classList.add('selected');
        if (!window.isSelectionMode) enterSelectionMode();
    }
    updateMultiSelectBar();
}
window.toggleSelection = toggleSelection;