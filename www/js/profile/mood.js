import { getTodayStr } from '../core/utils.js';

let moodWidgetTimeout;

export function initMoodWidget() {
    const moodWidget = document.getElementById('moodWidget');
    const moodBtnEl = document.getElementById('moodBtn');

    if (moodWidget && moodBtnEl) {
        moodBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('moodTooltip')?.classList.remove('show');
            const isExpanded = moodWidget.classList.toggle('expanded');
            clearTimeout(moodWidgetTimeout);
            if (isExpanded) {
                moodWidgetTimeout = setTimeout(() => { moodWidget.classList.remove('expanded'); }, 5000);
            }
        });

        document.addEventListener('click', (e) => {
            if (!moodWidget.contains(e.target)) {
                moodWidget.classList.remove('expanded');
                clearTimeout(moodWidgetTimeout);
            }
        });

        document.querySelectorAll('.mood-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                clearTimeout(moodWidgetTimeout);
                const mood = e.target.dataset.mood;
                
                const rect = e.target.getBoundingClientRect();
                const floater = document.createElement('div');
                floater.className = 'floating-emoji';
                floater.innerText = mood;
                floater.style.left = `${rect.left + rect.width / 2 - 15}px`;
                floater.style.top = `${rect.top}px`;
                document.body.appendChild(floater);
                
                setTimeout(() => {
                    if (floater.parentNode) floater.remove();
                }, 1000);

                let moods = JSON.parse(localStorage.getItem('moods') || '{}');
                moods[getTodayStr()] = mood;
                localStorage.setItem('moods', JSON.stringify(moods));
                moodWidget.classList.remove('expanded');
                updateMoodUI();
                if (window.renderAll) window.renderAll();
            });
        });
    }
    updateMoodUI();
}

export function updateMoodUI() {
    const moods = JSON.parse(localStorage.getItem('moods') || '{}');
    const currentMood = moods[getTodayStr()];
    const btn = document.getElementById('moodBtn');
    if (btn) {
        btn.innerHTML = currentMood ? currentMood : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-sub);"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`;
    }
}

export function renderEnergySuggestion() {
    if (window.selectedViewDate && window.selectedViewDate !== getTodayStr()) return;
    let pending = JSON.parse(localStorage.getItem('tasks') || '[]').filter(t => !t.completed && t.date === getTodayStr());
    if (window.currentFilter !== 'all') {
        pending = pending.filter(item => item.emoji === window.currentFilter);
    }

    const todayBadge = document.getElementById('todayNavBadge');
    if (todayBadge) {
        todayBadge.classList.toggle('active', pending.length > 0 && pending.some(t => t.importance === 'high'));
    }
}