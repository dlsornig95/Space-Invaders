class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            fire: false
        };
        this.firePressed = false;

        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.keys.left = true;
            }
            if (e.key === 'ArrowRight' || e.key === 'd') {
                this.keys.right = true;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (typeof game !== 'undefined' && game.state === 'enterInitials') {
                    game.cycleInitialLetter(1);
                } else if (!this.firePressed) {
                    this.keys.fire = true;
                    this.firePressed = true;
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (typeof game !== 'undefined' && game.state === 'enterInitials') {
                    game.cycleInitialLetter(-1);
                }
            }
            if (e.key === ' ') {
                e.preventDefault();
                if (typeof game !== 'undefined' && game.state === 'enterInitials') {
                    game.handleEnter();
                } else if (!this.firePressed) {
                    this.keys.fire = true;
                    this.firePressed = true;
                }
            }
            if (e.key === 'p' || e.key === 'Escape') {
                if (typeof game !== 'undefined') {
                    game.togglePause();
                }
            }
            if (e.key === 'Enter') {
                if (typeof game !== 'undefined') {
                    game.handleEnter();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                this.keys.left = false;
            }
            if (e.key === 'ArrowRight' || e.key === 'd') {
                this.keys.right = false;
            }
            if (e.key === ' ' || e.key === 'ArrowUp') {
                this.keys.fire = false;
                this.firePressed = false;
            }
        });
    }

    setupTouch() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnFire = document.getElementById('btn-fire');

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                soundManager.resumeContext();
                if (typeof game !== 'undefined' && game.state === 'enterInitials') {
                    game.cycleInitialLetter(-1);
                } else {
                    this.keys.left = true;
                }
            });
            btnLeft.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.left = false;
            });
        }

        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => {
                e.preventDefault();
                soundManager.resumeContext();
                if (typeof game !== 'undefined' && game.state === 'enterInitials') {
                    game.cycleInitialLetter(1);
                } else {
                    this.keys.right = true;
                }
            });
            btnRight.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.right = false;
            });
        }

        if (btnFire) {
            btnFire.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!this.firePressed) {
                    this.keys.fire = true;
                    this.firePressed = true;
                }
                soundManager.resumeContext();
                if (typeof game !== 'undefined') {
                    game.handleEnter();
                }
            });
            btnFire.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.fire = false;
                this.firePressed = false;
            });
        }
    }

    consumeFire() {
        if (this.keys.fire) {
            this.keys.fire = false;
            return true;
        }
        return false;
    }
}

const input = new InputHandler();
