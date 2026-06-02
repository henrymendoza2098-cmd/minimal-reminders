import { getTodayStr, isOverdue } from './utils.js';

export function updateMainTitle() {
    const titleEl = document.getElementById('mainDateTitle');
    const toggleBtn = document.getElementById('taskViewToggle');
    if (!titleEl || !toggleBtn || typeof window.selectedViewDate === 'undefined') return;

    const isTodayView = window.selectedViewDate === getTodayStr();
    toggleBtn.innerText = !isTodayView ? 'Hoy' : (window.taskViewMode === 'today' ? 'Todas' : 'Hoy');

    if (isTodayView) {
        titleEl.innerText = 'Hoy';
    } else {
        const parts = window.selectedViewDate.split('/');
        const selectedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const todayDate = new Date(); todayDate.setHours(0,0,0,0);
        const diffDays = Math.round((selectedDate - todayDate) / (1000 * 60 * 60 * 24));

        if (diffDays === -1) titleEl.innerText = 'Ayer';
        else if (diffDays === 1) titleEl.innerText = 'Mañana';
        else titleEl.innerText = selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
    }
}

export function updateProgress() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (progressBar) {
        progressBar.style.width = percent + "%";
        if (percent < 40) { progressBar.style.background = "linear-gradient(90deg, #ff5252, #ff8a8a)"; } 
        else if (percent < 80) { progressBar.style.background = "linear-gradient(90deg, #f2c94c, #ffd740)"; } 
        else { progressBar.style.background = "linear-gradient(90deg, #00e676, #69f0ae)"; }
    }
    if (progressText) progressText.innerText = `${percent}% completado (${done}/${total})`;
}

export function initProgressToggle() {
    const container = document.querySelector('.progress-container');
    const txt = document.getElementById('progressText');
    if (container && txt && !container.dataset.toggleInitialized) {
        const wrapper = document.createElement('div');
        wrapper.className = 'progress-wrapper';
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container); wrapper.appendChild(txt);
        wrapper.addEventListener('click', () => txt.classList.toggle('visible'));
        container.dataset.toggleInitialized = 'true';
    }
}

export function initSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const menuBtn = document.getElementById('menuBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');

    if (menuBtn && sideMenu) {
        menuBtn.onclick = () => { sideMenu.style.display = 'block'; setTimeout(() => sideMenu.classList.add('active'), 10); };
    }

    const closeMenu = () => {
        if (!sideMenu) return;
        sideMenu.classList.remove('active');
        setTimeout(() => { if (!sideMenu.classList.contains('active')) sideMenu.style.display = 'none'; }, 400);
    };

    if (closeMenuBtn) closeMenuBtn.onclick = closeMenu;
    if (sideMenu) sideMenu.onclick = (e) => { if (e.target === sideMenu) closeMenu(); };

    const themeMenu = document.getElementById('themeToggleMenu');
    if (themeMenu) {
        themeMenu.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            closeMenu(); 
        });
    }
}

export function setupSearchLogic() {
    const wrapper = document.getElementById('taskSearchWrapper');
    const btnJava = document.getElementById('taskSearchInputt');
    const inputField = document.getElementById('taskSearchInput');

    if (btnJava && wrapper && inputField) {
        btnJava.onclick = (e) => {
            e.stopPropagation(); 
            if (!wrapper.classList.contains('expanded')) { wrapper.classList.add('expanded'); inputField.focus(); }
            else if (inputField.value === '') { wrapper.classList.remove('expanded'); }
        };
        document.addEventListener('click', (e) => {
            if (wrapper && !wrapper.contains(e.target) && wrapper.classList.contains('expanded')) {
                if (inputField.value !== '') { inputField.value = ''; inputField.dispatchEvent(new Event('input')); }
                wrapper.classList.remove('expanded');
            }
        });
        inputField.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            let filtered = JSON.parse(localStorage.getItem('tasks') || '[]').filter(t => t.date === getTodayStr() || !t.date || (!t.completed && isOverdue(t.date)));
            if (term) filtered = filtered.filter(t => t.text.toLowerCase().includes(term));
            if (window.drawTasks) window.drawTasks(filtered.filter(t => !t.completed), 'taskList', false, 'tasks');
        });
    }
}

export function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
            document.getElementById(targetView).style.display = 'block';
            
            const fabTask = document.getElementById('openTaskSheetBtn');
            const fabNote = document.getElementById('openNoteEditorBtn');
            
            if (fabTask) {
                if (targetView === 'view-today') {
                    fabTask.style.display = 'flex';
                    fabTask.classList.remove('auto-expanded');
                    clearTimeout(window.taskFabTimeout);
                    clearTimeout(window.taskFabCloseTimeout);
                    window.taskFabTimeout = setTimeout(() => {
                        fabTask.classList.add('auto-expanded');
                        window.taskFabCloseTimeout = setTimeout(() => { fabTask.classList.remove('auto-expanded'); }, 4000); 
                    }, 1000); 
                } else {
                    fabTask.style.display = 'none';
                    clearTimeout(window.taskFabTimeout); clearTimeout(window.taskFabCloseTimeout);
                }
            }
            if (fabNote) {
                if (targetView === 'view-notes') {
                    fabNote.style.display = 'flex';
                    fabNote.classList.remove('auto-expanded');
                    clearTimeout(window.noteFabTimeout);
                    clearTimeout(window.noteFabCloseTimeout);
                    window.noteFabTimeout = setTimeout(() => {
                        fabNote.classList.add('auto-expanded');
                        window.noteFabCloseTimeout = setTimeout(() => { fabNote.classList.remove('auto-expanded'); }, 4000); 
                    }, 1000); 
                } else {
                    fabNote.style.display = 'none';
                    clearTimeout(window.noteFabTimeout); clearTimeout(window.noteFabCloseTimeout);
                }
            }
            if (targetView === 'view-profile' && window.renderStats) window.renderStats();
        });
    });
}

export function initKeyboardHandling() {
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Keyboard) {
        Capacitor.Plugins.Keyboard.addListener('keyboardWillShow', (info) => {
            document.body.classList.add('keyboard-open');
            document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
            if (document.querySelector('.bottom-nav')) document.querySelector('.bottom-nav').style.display = 'none';
        });
        Capacitor.Plugins.Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-open');
            document.body.style.setProperty('--keyboard-height', '0px');
            if (document.querySelector('.bottom-nav')) document.querySelector('.bottom-nav').style.display = 'flex';
        });
    }
}

export function initImageViewer() {
    window.openImageViewer = (src) => {
        const modal = document.getElementById('imageViewerModal');
        const fullImg = document.getElementById('fullSizeImage');
        if (modal && fullImg) {
            fullImg.src = src; modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    };
    window.closeImageViewer = () => {
        const modal = document.getElementById('imageViewerModal');
        if (modal) { modal.classList.remove('active'); setTimeout(() => modal.style.display = 'none', 300); }
    };
    document.addEventListener('click', (e) => {
        if (e.target === document.getElementById('imageViewerModal')) window.closeImageViewer();
    });
}

window.showCopyToast = function() {
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.innerHTML = '<span>📋</span>Copiado';
        document.body.appendChild(toast);
    }
    toast.classList.remove('show');
    void toast.offsetWidth; 
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 1500);
};

window.getTaskIcon = (val, size="18") => {
    if (val === 'none' || !val) return '✨';
    const svgProps = `width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    switch(val) {
        case 'cart': return `<svg viewBox="0 0 24 24" ${svgProps}><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
        case 'gym': return `<svg viewBox="0 0 24 24" ${svgProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
        case 'book': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
        case 'work': return `<svg viewBox="0 0 24 24" ${svgProps}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
        case 'health': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        case 'call': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
        case 'mail': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
        case 'finance': return `<svg viewBox="0 0 24 24" ${svgProps}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
        case 'idea': return `<svg viewBox="0 0 24 24" ${svgProps}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        case 'food': return `<svg viewBox="0 0 24 24" ${svgProps}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"></path></svg>`;
        default: return '✨';
    }
};

export function renderCategoryChips() {
    const container = document.querySelector('.filter-container');
    if (!container) return;
    const isExpanded = container.classList.contains('expanded');
    container.innerHTML = ''; 
    
    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');
    const allCategories = [...(window.defaultCategories || []), ...customCategories];

    const moreBtn = document.getElementById('moreOptionsBtn');
    if (moreBtn) moreBtn.style.color = (window.currentFilter !== 'all') ? 'var(--accent)' : '';

    const addBtnIcon = document.getElementById('addNewCategoryBtn');
    if (addBtnIcon) {
        let labelSpan = document.getElementById('activeCategoryLabel');
        if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.id = 'activeCategoryLabel';
            labelSpan.style.marginLeft = '10px'; labelSpan.style.fontWeight = '600';
            labelSpan.style.fontSize = '16px'; labelSpan.style.color = 'var(--text-main)';
            addBtnIcon.parentNode.insertBefore(labelSpan, addBtnIcon.nextSibling);
        }
        const activeCat = allCategories.find(c => c.filter === window.currentFilter) || window.defaultCategories[0];
        labelSpan.innerText = `${activeCat.icon} ${activeCat.name}`;
    }

    allCategories.forEach((cat, index) => {
        const btn = document.createElement('button');
        const isActive = window.currentFilter === cat.filter;
        btn.className = `filter-chip ${isActive ? 'active' : ''}`;
        btn.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;">${cat.icon} ${cat.name}</div>${isActive ? '<span style="font-weight: bold; font-size: 16px;">✓</span>' : ''}`;
        
        btn.onclick = () => {
            window.currentFilter = cat.filter;
            window.selectedEmoji = cat.filter === 'all' ? '📝' : cat.filter;
            container.classList.remove('expanded');
            if (addBtnIcon) { addBtnIcon.style.transition = 'transform 0.5s'; addBtnIcon.style.transform = 'rotate(0deg)'; }
            renderCategoryChips();
            if (window.renderAll) window.renderAll();
        };

        if (index >= (window.defaultCategories || []).length) {
            let timer;
            btn.ontouchstart = () => {
                timer = setTimeout(() => {
                    if (confirm(`¿Quieres eliminar la categoría "${cat.name}"?`)) {
                        let customCats = JSON.parse(localStorage.getItem('customCategories') || '[]');
                        customCats.splice(index - window.defaultCategories.length, 1);
                        localStorage.setItem('customCategories', JSON.stringify(customCats));
                        window.currentFilter = 'all'; window.selectedEmoji = '📝';
                        renderCategoryChips();
                        if (window.renderAll) window.renderAll();
                    }
                }, 800);
            };
            btn.ontouchend = () => clearTimeout(timer);
        }
        container.appendChild(btn);
    });

    const addCatBtn = document.createElement('button');
    addCatBtn.className = 'filter-chip'; addCatBtn.style.justifyContent = 'center'; addCatBtn.style.borderStyle = 'dashed';
    addCatBtn.innerHTML = `➕ Nueva Categoría...`;
    addCatBtn.onclick = () => {
        const name = prompt("Nombre de la categoría (ej: Estudios):");
        const emoji = prompt("Emoji para la categoría (ej: 📚):") || '📁';
        if (name) {
            customCategories.push({ name, filter: emoji, icon: emoji });
            localStorage.setItem('customCategories', JSON.stringify(customCategories));
            renderCategoryChips();
            const newContainer = document.querySelector('.filter-container');
            if (newContainer) newContainer.classList.add('expanded');
        }
    };
    container.appendChild(addCatBtn);
    if (isExpanded) container.classList.add('expanded');
}
window.renderCategoryChips = renderCategoryChips;

export function initCategoryChips() {
    renderCategoryChips();
    const addNewCategoryBtn = document.getElementById('addNewCategoryBtn');
    if (addNewCategoryBtn) {
        addNewCategoryBtn.onclick = () => {
            const container = document.querySelector('.filter-container');
            if (container) {
                container.classList.toggle('expanded');
                addNewCategoryBtn.style.transition = 'transform 0.5s';
                addNewCategoryBtn.style.transform = container.classList.contains('expanded') ? 'rotate(45deg)' : 'rotate(0deg)';
            }
        };
    }
}

export function setupHeaderMenu() {
    const header = document.querySelector('#view-today .samsung-header');
    const headerActions = header ? header.querySelector('.header-actions') : null;
    if (!header || !headerActions || document.getElementById('moreOptionsBtn')) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'headerMenuDropdown'; dropdown.className = 'header-menu-dropdown';
    header.appendChild(dropdown);

    const categoryLabel = header.querySelector('#activeCategoryLabel');
    if (categoryLabel) {
        const labelWrapper = document.createElement('div'); labelWrapper.className = 'header-menu-label-item';
        labelWrapper.appendChild(categoryLabel); dropdown.appendChild(labelWrapper);
    }
    const calendarBtn = headerActions.querySelector('#openCalendarBtn');
    if (calendarBtn) { calendarBtn.innerHTML += '<span>Ver Calendario</span>'; dropdown.appendChild(calendarBtn); }
    const categoryBtn = headerActions.querySelector('#addNewCategoryBtn');
    if (categoryBtn) { categoryBtn.innerHTML += '<span>Añadir Categoría</span>'; dropdown.appendChild(categoryBtn); }

    const searchWrapper = headerActions.querySelector('.search-wrapper');
    headerActions.innerHTML = '';
    if (searchWrapper) headerActions.appendChild(searchWrapper);

    const organizeBtn = document.createElement('button');
    organizeBtn.id = 'openOrganizeBtn'; organizeBtn.className = 'action-btn';
    organizeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`;
    headerActions.appendChild(organizeBtn);

    const moreOptionsBtn = document.createElement('button');
    moreOptionsBtn.id = 'moreOptionsBtn'; moreOptionsBtn.className = 'action-btn more-options-btn';
    moreOptionsBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>`;
    if (window.currentFilter !== 'all') moreOptionsBtn.style.color = 'var(--accent)';
    headerActions.appendChild(moreOptionsBtn);

    moreOptionsBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('active'); });
    document.addEventListener('click', (e) => { if (dropdown.classList.contains('active') && !dropdown.contains(e.target) && !moreOptionsBtn.contains(e.target)) dropdown.classList.remove('active'); });

    const searchMenuBtn = document.createElement('button');
    searchMenuBtn.className = 'action-btn';
    searchMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Buscar Tarea</span>`;
    dropdown.appendChild(searchMenuBtn);
    searchMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); dropdown.classList.remove('active');
        const wrapper = document.getElementById('taskSearchWrapper');
        if (wrapper) { wrapper.classList.add('expanded'); setTimeout(() => document.getElementById('taskSearchInput').focus(), 100); }
    });

    const historyMenuBtn = document.createElement('button');
    historyMenuBtn.className = 'action-btn';
    historyMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"></circle></svg><span>Historial </span>`;
    dropdown.appendChild(historyMenuBtn);
    historyMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); dropdown.classList.remove('active');
        document.getElementById('view-today').style.display = 'none';
        document.getElementById('view-history').style.display = 'flex';
        document.getElementById('tabOverdue')?.click(); 
        if (typeof window.renderHistoryView === 'function') window.renderHistoryView();
    });
}

export function initCapacitorBackButton() {
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) {
        Capacitor.Plugins.App.addListener('backButton', () => {
            const editor = document.getElementById('view-notes-editor'); const sideMenu = document.getElementById('sideMenu');
            const imageViewer = document.getElementById('imageViewerModal'); const habitDetail = document.getElementById('view-habit-detail');
            const calendar = document.getElementById('view-calendar'); const organize = document.getElementById('view-organize');
            const history = document.getElementById('view-history'); const categoryNotes = document.getElementById('view-category-notes');

            if (imageViewer && imageViewer.classList.contains('active')) { if (typeof window.closeImageViewer === 'function') window.closeImageViewer(); }
            else if (habitDetail && habitDetail.style.display === 'flex') { document.getElementById('closeHabitDetailBtn')?.click(); } 
            else if (editor && (editor.style.display === 'block' || editor.style.display === 'flex' || editor.classList.contains('active'))) {
                const title = document.getElementById('noteTitleInput')?.value.trim(); const content = document.getElementById('noteInput')?.value.trim();
                const wrapper = document.getElementById('canvasWrapper'); const hasDrawing = wrapper && wrapper.style.display !== 'none';
                if (title || content || (window.currentNotePhotos && window.currentNotePhotos.length > 0) || hasDrawing) { document.getElementById('addNoteBtn')?.click(); } else { document.getElementById('cancelNoteBtn')?.click(); }
            } 
            else if (sideMenu && sideMenu.classList.contains('active')) { document.getElementById('closeMenuBtn')?.click(); } 
            else if (calendar && calendar.style.display === 'block') { document.getElementById('closeCalendarBtn')?.click(); } 
            else if (organize && organize.style.display === 'block') { document.getElementById('closeOrganizeBtn')?.click(); } 
            else if (history && history.style.display === 'flex') { document.getElementById('closeHistoryBtn')?.click(); } 
            else if (categoryNotes && categoryNotes.classList.contains('active')) { if (typeof window.closeCategoryNotes === 'function') window.closeCategoryNotes(); } 
            else { Capacitor.Plugins.App.exitApp(); }
        });
    }
}

export function initFABEvents() {
    const fabTaskBtn = document.getElementById('openTaskSheetBtn');
    if (fabTaskBtn) {
        fabTaskBtn.addEventListener('contextmenu', e => e.preventDefault()); 
        let pressStartTime = 0; let longPressVisualTimer;
        const startPress = (e) => {
            pressStartTime = Date.now();
            longPressVisualTimer = setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(50);
                fabTaskBtn.style.transform = 'scale(1.1)'; fabTaskBtn.style.backgroundColor = 'var(--error)';
            }, 500); 
        };
        const cancelPress = (e) => {
            if (!pressStartTime) return; 
            clearTimeout(longPressVisualTimer); fabTaskBtn.style.transform = ''; fabTaskBtn.style.backgroundColor = '';
            const pressDuration = Date.now() - pressStartTime; pressStartTime = 0;
            if (e && e.cancelable) e.preventDefault();
            if (pressDuration >= 500) { if (window.startVoiceDictation) window.startVoiceDictation(); } 
            else { if (window.openTaskSheet) window.openTaskSheet(); }
        };
        fabTaskBtn.addEventListener('touchstart', startPress, { passive: true });
        fabTaskBtn.addEventListener('touchend', cancelPress);
        fabTaskBtn.addEventListener('mousedown', (e) => { if (e.button !== 0) return; startPress(e); });
        fabTaskBtn.addEventListener('mouseup', cancelPress);
        fabTaskBtn.addEventListener('mouseleave', () => { if (pressStartTime) { clearTimeout(longPressVisualTimer); fabTaskBtn.style.transform = ''; fabTaskBtn.style.backgroundColor = ''; pressStartTime = 0; } });
    }

    const closeSheetBtn = document.getElementById('closeSheetBtn');
    if (closeSheetBtn) closeSheetBtn.onclick = () => { if (window.saveTaskFromSheet) window.saveTaskFromSheet(); };

    const resetDayBtn = document.getElementById('resetDayBtn');
    const customModal = document.getElementById('customModal');
    if (resetDayBtn) resetDayBtn.addEventListener('click', () => { if (customModal) customModal.classList.add('active'); });
    document.getElementById('cancelResetBtn')?.addEventListener('click', () => { if (customModal) customModal.classList.remove('active'); });
    document.getElementById('confirmResetBtn')?.addEventListener('click', () => {
        if (customModal) customModal.classList.remove('active');
        localStorage.setItem('completedToday', 0);
        let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        tasks = tasks.filter(t => !t.completed); 
        localStorage.setItem('tasks', JSON.stringify(tasks));
        if (window.renderAll) window.renderAll();
    });
}