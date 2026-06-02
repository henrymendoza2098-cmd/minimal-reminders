export let currentNotePhotos = [];
window.currentNotePhotos = currentNotePhotos;

export let currentEditingNoteId = null;
export let currentNoteFilter = 'all';
window.currentFocusedCategory = null;

export const defaultNoteCategories = [
    { name: 'Trabajo', color: '#54A3D6' },
    { name: 'Estudio', color: '#52BD94' },
    { name: 'Personal', color: '#F2994A' }
];

export function switchNoteView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';
    
    const fab = document.getElementById('openNoteEditorBtn');
    if (fab) fab.style.display = (viewId === 'view-notes') ? 'flex' : 'none';

    if(viewId === 'view-notes') {
        if (window.renderNotes) window.renderNotes();
    }
}
window.switchNoteView = switchNoteView;

export function getNotesCategories() {
    let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
    return [...defaultNoteCategories, ...custom];
}

window.renderNoteCategoriesCarousel = () => {
    const carousel = document.getElementById('notesCategoryCarousel');
    if (!carousel) return;
    
    const categories = getNotesCategories();
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    let html = '';
    
    categories.forEach(cat => {
        const catNotes = notes.filter(n => n.category === cat.name);
        const hasNotes = catNotes.length > 0;
        const firstLetter = cat.name.charAt(0).toUpperCase();
        const catColor = cat.color || 'var(--accent)';
        
        html += `
            <div class="note-category-card ${hasNotes ? 'has-notes' : ''}" onclick="openCategoryNotes('${cat.name}')" style="--cat-color: ${catColor};">
                <div class="note-category-icon-wrapper">
                    ${firstLetter}
                </div>
                <div class="note-category-name">${cat.name}</div>
            </div>
        `;
    });
    
    html += `
        <div class="note-category-card add-new" onclick="addNewNoteCategory()">
            <div class="note-category-icon-wrapper">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div class="note-category-name">Nueva</div>
        </div>
    `;
    
    carousel.innerHTML = html;
    updateNoteCategorySelect();
};

export function updateNoteCategorySelect() {
    const select = document.getElementById('noteCategorySelect');
    if (!select) return;
    const categories = getNotesCategories();
    select.innerHTML = `
        <option value="General" data-icon="G" data-color="var(--accent)">G General</option>
        ${categories.map(c => {
            const firstLetter = c.name.charAt(0).toUpperCase();
            const catColor = c.color || 'var(--accent)';
            return `<option value="${c.name}" data-icon="${firstLetter}" data-color="${catColor}">${firstLetter} ${c.name}</option>`;
        }).join('')}
    `;
}

window.addNewNoteCategory = () => {
    const name = prompt("Nombre de la nueva categoría:");
    if (!name) return;
    
    let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
    if (!custom.some(c => c.name === name) && !defaultNoteCategories.some(c => c.name === name)) {
        const newCat = { name, color: '#54A3D6' };
        custom.push(newCat);
        localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
        window.renderNoteCategoriesCarousel();
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#54A3D6';
        colorInput.style.position = 'absolute';
        colorInput.style.opacity = '0';
        document.body.appendChild(colorInput);

        colorInput.addEventListener('input', (e) => {
            newCat.color = e.target.value;
            localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
            window.renderNoteCategoriesCarousel();
        });

        colorInput.addEventListener('change', () => {
            document.body.removeChild(colorInput);
        });

        colorInput.click();
    } else {
        alert("La categoría ya existe.");
    }
};

export function renderEditorPhotos() {
    const preview = document.getElementById('notePhotosPreview');
    if (!preview) return;
    preview.style.flexDirection = 'column';
    preview.style.gap = '15px';
    preview.innerHTML = currentNotePhotos.map((src, index) => `
        <div style="position: relative; width: 100%;">
            <img src="${src}" onclick="openImageViewer(this.src)" style="width: 100%; height: auto; object-fit: cover; border-radius: 12px; cursor: pointer; display: block;">
            <button onclick="removePhoto(${index})" style="position: absolute; top: 10px; right: 10px; background: rgba(235, 87, 87, 0.9); color: white; border-radius: 50%; border: none; width: 30px; height: 30px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">×</button>
        </div>
    `).join('');
}
window.renderEditorPhotos = renderEditorPhotos;

window.removePhoto = (index) => {
    currentNotePhotos.splice(index, 1);
    renderEditorPhotos();
};

window.openEditNote = (id) => {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const note = notes.find(n => n.id === id);
    
    if (note) {
        currentEditingNoteId = id;
        document.getElementById('noteTitleInput').value = note.title || '';
        document.getElementById('noteInput').value = note.content || '';
        
        let dateDisplay = document.getElementById('noteDateDisplay');
        if (!dateDisplay) {
            dateDisplay = document.createElement('div');
            dateDisplay.id = 'noteDateDisplay';
            dateDisplay.style.fontSize = '12px';
            dateDisplay.style.color = 'var(--text-sub)';
            dateDisplay.style.margin = '5px 0 15px 5px';
            const titleInput = document.getElementById('noteTitleInput');
            if (titleInput && titleInput.parentNode) {
                titleInput.parentNode.insertBefore(dateDisplay, titleInput.nextSibling);
            }
        }
        
        if (dateDisplay) {
            let dateText = '';
            if (note.createdAt) dateText += `Creado: ${note.createdAt}`;
            if (note.updatedAt && note.updatedAt !== note.createdAt) {
                dateText += (dateText ? ' • ' : '') + `Editado: ${note.updatedAt}`;
            }
            dateDisplay.innerText = dateText;
        }

        currentNotePhotos = note.images || []; 
        window.currentNotePhotos = currentNotePhotos;
        renderEditorPhotos(); 
        
        const wrapper = document.getElementById('canvasWrapper');
        if (note.drawing) {
            document.getElementById('noteInput').style.display = 'none';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'none';

            if (wrapper) wrapper.style.display = 'flex';
            const img = new Image();
            img.onload = () => {
                if (typeof window.initCanvas === 'function') window.initCanvas();
                setTimeout(() => {
                    const canvas = document.getElementById('noteCanvas');
                    const ctx = canvas ? canvas.getContext('2d') : null;
                    if (ctx) ctx.drawImage(img, 0, 0, img.width, img.height);
                }, 10);
            };
            img.src = note.drawing;
        } else {
            if (wrapper) wrapper.style.display = 'none';
            document.getElementById('noteInput').style.display = 'block';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'flex';
            if (typeof window.clearCanvas === 'function') window.clearCanvas();
        }

        switchNoteView('view-notes-editor');
        
        setTimeout(() => {
            const txtArea = document.getElementById('noteInput');
            if (txtArea) {
                txtArea.style.height = 'auto';
                txtArea.style.height = txtArea.scrollHeight + 'px';
            }
        }, 10);
    }
};

export function renderNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const container = document.getElementById('notesList');
    const searchTerm = document.getElementById('noteSearchInput')?.value.toLowerCase() || "";

    if (!container) return;

    const filtered = notes.filter(n => {
        const matchesSearch = (n.title?.toLowerCase().includes(searchTerm)) || 
                             (n.content?.toLowerCase().includes(searchTerm));
        const matchesCat = currentNoteFilter === 'all' || n.category === currentNoteFilter;
        return matchesSearch && matchesCat;
    });

    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (filtered.length === 0) {
        let msgTitle = searchTerm ? 'Sin resultados' : 'Bandeja vacía';
        let msgSub = searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'No tienes notas guardadas aquí.';
        container.innerHTML = `
            <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">${msgTitle}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">${msgSub}</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map((n, index) => {
        const pinIcon = n.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof window.selectedItems !== 'undefined' && window.selectedItems.has(`notes-${n.id}`);

        let dateInfo = '';
        if (n.createdAt) dateInfo += `Creado: ${n.createdAt}`;
        if (n.updatedAt && n.updatedAt !== n.createdAt) {
            dateInfo += (dateInfo ? ' • ' : '') + `Editado: ${n.updatedAt}`;
        }

        return `
        <div class="note-card reminder-card ${isSelected ? 'selected' : ''}" 
            data-id="${n.id}" 
            data-key="notes" 
            data-text="${n.content ? n.content.replace(/"/g, '&quot;') : ''}"
            style="animation-delay: ${index * 0.05}s;"
            onclick="handleItemClick(event, this, ${n.id}, 'notes')">
            <div class="card-info" style="display: flex; align-items: center; gap: 12px;">
                ${pinIcon}
                <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${n.title || 'Sin título'}
                    </div>
                    <div class="task-text-content" style="font-size: 12px; opacity: 0.7;">
                        ${n.content || ''}
                    </div>
                    ${n.images && n.images.length > 0 ? `
                        <div style="display: flex; gap: 5px; margin-top: 8px;">
                            ${n.images.map(img => `<img src="${img}" onclick="event.stopPropagation(); openImageViewer(this.src)" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; cursor: pointer;">`).join('')}
                        </div>
                    ` : ''}
                    ${dateInfo ? `<div style="font-size: 10px; color: var(--text-sub); margin-top: 6px; opacity: 0.8;">${dateInfo}</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    if (typeof window.attachGestureEvents === 'function') {
        window.attachGestureEvents();
    }
}
window.renderNotes = renderNotes;

window.renderCategoryNotesList = (catName) => {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const container = document.getElementById('categoryNotesList');
    if (!container) return;

    const filtered = notes.filter(n => n.category === catName);
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="margin-top: 20px; padding: 40px 20px;">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--text-sub)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 12px;">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">Categoría vacía</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: var(--text-sub);">No tienes notas en ${catName}.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map((n, index) => {
        const pinIcon = n.pinned ? '<span class="pin-indicator">📌</span>' : '';
        const isSelected = typeof window.selectedItems !== 'undefined' && window.selectedItems.has(`notes-${n.id}`);
        let dateInfo = '';
        if (n.createdAt) dateInfo += `Creado: ${n.createdAt}`;
        if (n.updatedAt && n.updatedAt !== n.createdAt) {
            dateInfo += (dateInfo ? ' • ' : '') + `Editado: ${n.updatedAt}`;
        }
        return `
        <div class="note-card reminder-card ${isSelected ? 'selected' : ''}" data-id="${n.id}" data-key="notes" style="animation-delay: ${index * 0.05}s;" onclick="handleItemClick(event, this, ${n.id}, 'notes')">
            <div class="card-info" style="display: flex; align-items: center; gap: 12px;">
                ${pinIcon}
                <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${n.title || 'Sin título'}</div>
                    <div class="task-text-content" style="font-size: 12px; opacity: 0.7;">${n.content || ''}</div>
                    ${n.images && n.images.length > 0 ? `<div style="display: flex; gap: 5px; margin-top: 8px;">${n.images.map(img => `<img src="${img}" onclick="event.stopPropagation(); openImageViewer(this.src)" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; cursor: pointer;">`).join('')}</div>` : ''}
                    ${dateInfo ? `<div style="font-size: 10px; color: var(--text-sub); margin-top: 6px; opacity: 0.8;">${dateInfo}</div>` : ''}
                </div></div></div>`;
    }).join('');
    if (typeof window.attachGestureEvents === 'function') window.attachGestureEvents();
};

window.openCategoryNotes = (catName) => {
    window.currentFocusedCategory = catName;
    document.getElementById('view-notes').style.display = 'none';
    
    const catView = document.getElementById('view-category-notes');
    catView.style.display = 'flex';
    catView.classList.add('active');
    
    const title = document.getElementById('categoryNotesTitle');
    if (title) title.innerText = catName;
    
    const fabNote = document.getElementById('openNoteEditorBtn');
    if (fabNote) fabNote.style.display = 'flex';
    
    const delBtn = document.getElementById('deleteCategoryNotesBtn');
    if (delBtn) {
        const isDefault = defaultNoteCategories.some(c => c.name === catName);
        delBtn.style.display = isDefault ? 'none' : 'flex';
        delBtn.onclick = () => window.confirmDeleteNoteCategory(catName);
    }

    window.renderCategoryNotesList(catName);
};

window.confirmDeleteNoteCategory = (catName) => {
    if (confirm(`¿Eliminar la categoría "${catName}"? Las notas que contenga se moverán a la categoría "General".`)) {
        let custom = JSON.parse(localStorage.getItem('notesCustomCategories') || '[]');
        custom = custom.filter(c => c.name !== catName);
        localStorage.setItem('notesCustomCategories', JSON.stringify(custom));
        
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        let changed = false;
        notes = notes.map(n => {
            if (n.category === catName) {
                changed = true;
                return { ...n, category: 'General' };
            }
            return n;
        });
        if (changed) localStorage.setItem('notes', JSON.stringify(notes));
        
        window.closeCategoryNotes();
        window.renderNoteCategoriesCarousel();
        renderNotes();
    }
};

window.closeCategoryNotes = () => {
    window.currentFocusedCategory = null;
    const catView = document.getElementById('view-category-notes');
    catView.classList.remove('active');
    setTimeout(() => {
        catView.style.display = 'none';
        document.getElementById('view-notes').style.display = 'block';
        renderNotes();
    }, 200);
};

window.handleNoteSearch = () => renderNotes();

// Event Listeners related to Notes
document.addEventListener('DOMContentLoaded', () => {
    const openNoteEditorBtn = document.getElementById('openNoteEditorBtn');
    if (openNoteEditorBtn) {
        openNoteEditorBtn.addEventListener('click', () => {
            currentEditingNoteId = null;
            currentNotePhotos = []; 
            window.currentNotePhotos = currentNotePhotos;
            document.getElementById('noteTitleInput').value = '';
            document.getElementById('noteInput').value = '';
            document.getElementById('noteInput').style.height = 'auto';

            document.getElementById('noteInput').style.display = 'block';
            if (document.getElementById('notePhotosPreview')) document.getElementById('notePhotosPreview').style.display = 'flex';
            if (document.getElementById('notePhotosPreview')) {
                document.getElementById('notePhotosPreview').innerHTML = '';
            }
            
            const wrapper = document.getElementById('canvasWrapper');
            if (wrapper) wrapper.style.display = 'none';
            if (typeof window.clearCanvas === 'function') window.clearCanvas();
            
            const catSelect = document.getElementById('noteCategorySelect');
            if (catSelect) {
                if (window.currentFocusedCategory) {
                    catSelect.value = window.currentFocusedCategory;
                } else {
                    catSelect.value = 'General';
                }
                catSelect.dispatchEvent(new Event('change'));
            }

            switchNoteView('view-notes-editor');
        });
    }

    const cancelNoteBtn = document.getElementById('cancelNoteBtn');
    if (cancelNoteBtn) {
        cancelNoteBtn.addEventListener('click', () => {
            if (window.currentFocusedCategory) {
                document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
                const catView = document.getElementById('view-category-notes');
                catView.style.display = 'flex';
                catView.classList.add('active');
                const fabNote = document.getElementById('openNoteEditorBtn');
                if (fabNote) fabNote.style.display = 'flex';
            } else {
                switchNoteView('view-notes');
            }
        });
    }

    const addPhotoBtn = document.getElementById('addPhotoBtn');
    if (addPhotoBtn) {
        addPhotoBtn.onclick = async () => {
            if (typeof Capacitor === 'undefined') return alert("Cámara solo disponible en el celular.");

            try {
                const image = await Capacitor.Plugins.Camera.getPhoto({
                    quality: 50,
                    resultType: 'base64',
                    source: 'PROMPT'
                });

                const base64Image = `data:image/jpeg;base64,${image.base64String}`;
                currentNotePhotos.push(base64Image);
                window.currentNotePhotos = currentNotePhotos;
                renderEditorPhotos();
            } catch (error) {
                console.log("Cámara cancelada o error:", error);
            }
        };
    }

    const addNoteBtn = document.getElementById('addNoteBtn');
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
            const title = document.getElementById('noteTitleInput').value.trim();
            const content = document.getElementById('noteInput').value.trim();
            const category = document.getElementById('noteCategorySelect')?.value || 'General';
            
            let drawingData = null;
            const wrapper = document.getElementById('canvasWrapper');
            const noteCanvas = document.getElementById('noteCanvas');
            if (wrapper && wrapper.style.display !== 'none' && noteCanvas) {
                drawingData = noteCanvas.toDataURL(); 
            }
            
            if (!title && !content && !drawingData && currentNotePhotos.length === 0) return;

            let notes = JSON.parse(localStorage.getItem('notes') || '[]');
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            if (currentEditingNoteId) {
                const oldNote = notes.find(n => n.id === currentEditingNoteId) || {};
                const finalDrawing = (wrapper && wrapper.style.display !== 'none') ? drawingData : oldNote.drawing;

                notes = notes.map(n => n.id === currentEditingNoteId ? 
                    { ...n, title, content, category, images: currentNotePhotos, drawing: finalDrawing, updatedAt: dateStr } : n);
            } else {
                notes.push({ 
                    id: Date.now(), 
                    title: title || 'Sin título', 
                    content, 
                    category,
                    images: currentNotePhotos,
                    drawing: drawingData,
                    createdAt: dateStr,
                    updatedAt: dateStr
                });
            }
            
            localStorage.setItem('notes', JSON.stringify(notes));
            currentNotePhotos = [];
            window.currentNotePhotos = currentNotePhotos;

            if (window.currentFocusedCategory) {
                document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
                const catView = document.getElementById('view-category-notes');
                catView.style.display = 'flex';
                catView.classList.add('active');
                const fabNote = document.getElementById('openNoteEditorBtn');
                if (fabNote) fabNote.style.display = 'flex';
                window.renderNoteCategoriesCarousel();
                window.renderCategoryNotesList(window.currentFocusedCategory);
            } else {
                switchNoteView('view-notes'); 
                window.renderNoteCategoriesCarousel();
                renderNotes(); 
            }
        });
    }

    const noteInput = document.getElementById('noteInput');
    if (noteInput) {
        noteInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    const closeCatBtn = document.getElementById('closeCategoryNotesBtn');
    if (closeCatBtn) closeCatBtn.onclick = window.closeCategoryNotes;
});