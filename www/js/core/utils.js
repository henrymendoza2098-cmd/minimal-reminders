export const getTodayStr = () => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
};

export const getTomorrowStr = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = tomorrow.getDate().toString().padStart(2, '0');
    const m = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const y = tomorrow.getFullYear();
    return `${d}/${m}/${y}`;
};

export function generateSafeId(baseId, timeIdx, dayIdx) {
    let str = `${baseId}-${timeIdx}-${dayIdx}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) || 1;
}

export function isOverdue(dateStr) {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const taskDate = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignorar la hora, solo comparar día
    return taskDate < today;
}

export function getProfileCircle(text, customIcon = 'none') {
    const pastelColors = ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#D4A5A5', '#E6B0AA', '#B5EAD7', '#C7CEEA', '#FFDAC1', '#FF9AA2', '#E2F0CB', '#DEC2CB', '#C5A3FF', '#85E3FF', '#A2E1DB', '#F8B195'];
    const firstLetter = (text || '?').trim().charAt(0).toUpperCase();
    const charCode = firstLetter.charCodeAt(0) || 0;
    const colorIndex = charCode % pastelColors.length;
    const circleColor = pastelColors[colorIndex];
   
    let displayContent = firstLetter;
    if (customIcon && customIcon !== 'none') {
        if (typeof window.getTaskIcon === 'function') {
            displayContent = window.getTaskIcon(customIcon, "18");
        }
    }
    
    return `<div class="task-profile-circle" style="background-color: ${circleColor}; color: #37352F; display: flex; align-items: center; justify-content: center;">${displayContent}</div>`;
}