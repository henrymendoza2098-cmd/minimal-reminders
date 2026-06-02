export let focusInterval;
export let timeLeft = 1500; // 25 minutos en segundos
export let initialFocusTime = 1500; 
export let isPaused = false;

export function stopFocusTimer() {
    clearInterval(focusInterval);
    focusInterval = null;
    isPaused = false;
    document.getElementById('startFocusBtn').innerText = "Iniciar Enfoque";
    
    const pauseBtn = document.getElementById('pauseFocusBtn');
    if (pauseBtn) {
        pauseBtn.style.display = 'none';
    }
}
window.stopFocusTimer = stopFocusTimer;

export function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    document.getElementById('focusTimer').innerText = 
        `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
window.updateTimerDisplay = updateTimerDisplay;

export function updateZenCircle(percent) {
    const circle = document.getElementById('timerProgress');
    const offset = 283 - (percent * 283);
    circle.style.strokeDashoffset = offset;
}
window.updateZenCircle = updateZenCircle;

export function setFocusTime(min) {
    timeLeft = min * 60;
    initialFocusTime = timeLeft;
    updateTimerDisplay();
    updateZenCircle(1);
}
window.setFocusTime = setFocusTime;

document.addEventListener('DOMContentLoaded', () => {
    const openFocusBtn = document.getElementById('openFocusBtn');
    if (openFocusBtn) {
        openFocusBtn.onclick = () => {
            if (typeof window.switchNoteView === 'function') window.switchNoteView('view-focus');
            console.log("Sugerencia: Activar 'No molestar' nativo aquí.");
        };
    }

    const closeFocusBtn = document.getElementById('closeFocusBtn');
    if (closeFocusBtn) {
        closeFocusBtn.onclick = () => {
            stopFocusTimer();
            if (typeof window.switchNoteView === 'function') window.switchNoteView('view-today');
        };
    }

    const startFocusBtn = document.getElementById('startFocusBtn');
    if (startFocusBtn) {
        startFocusBtn.onclick = function() {
            if (focusInterval) return; 
            this.innerText = "Concentrado...";
            isPaused = false;
            
            const pauseBtn = document.getElementById('pauseFocusBtn');
            if (pauseBtn) {
                pauseBtn.style.display = 'inline-block';
                pauseBtn.innerText = "Pausar";
            }
            
            const statusElem = document.getElementById('focusStatus');
            if (statusElem) statusElem.innerText = "Apaga las distracciones";
            
            focusInterval = setInterval(() => {
                timeLeft--;
                updateTimerDisplay();
                updateZenCircle(timeLeft / initialFocusTime);
                if (timeLeft <= 0) {
                    stopFocusTimer();
                    alert("¡Sesión terminada! Buen trabajo, Henry.");
                }
            }, 1000);
        };
    }

    const pauseBtn = document.getElementById('pauseFocusBtn');
    if (pauseBtn) {
        pauseBtn.onclick = function() {
            if (isPaused) {
                isPaused = false;
                this.innerText = "Pausar";
                document.getElementById('startFocusBtn').innerText = "Concentrado...";
                
                focusInterval = setInterval(() => {
                    timeLeft--;
                    updateTimerDisplay();
                    updateZenCircle(timeLeft / initialFocusTime);
                    if (timeLeft <= 0) {
                        stopFocusTimer();
                        alert("¡Sesión terminada! Buen trabajo, Henry.");
                    }
                }, 1000);
            } else {
                isPaused = true;
                clearInterval(focusInterval);
                focusInterval = null;
                this.innerText = "Reanudar";
                document.getElementById('startFocusBtn').innerText = "Pausado";
            }
        };
    }

    const focusBackgrounds = [
        '../assets/FONDO.jpg', '../assets/FONDO1.jpg', '../assets/FONDO2.jpg',
        '../assets/FONDO3.jpg', '../assets/FONDO4.jpg'
    ];

    let currentBgIndex = parseInt(localStorage.getItem('focusBgIndex') || '2');
    const viewFocus = document.getElementById('view-focus');
    if (viewFocus) viewFocus.style.backgroundImage = `url('${focusBackgrounds[currentBgIndex]}')`;

    const changeBgBtn = document.getElementById('changeBgBtn');
    if (changeBgBtn) {
        changeBgBtn.onclick = () => {
            currentBgIndex = (currentBgIndex + 1) % focusBackgrounds.length;
            localStorage.setItem('focusBgIndex', currentBgIndex);
            if (viewFocus) viewFocus.style.backgroundImage = `url('${focusBackgrounds[currentBgIndex]}')`;
        };
    }
});