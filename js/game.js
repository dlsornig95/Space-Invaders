class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvas.width = 800;
        this.canvas.height = 600;

        this.state = 'start';
        this.score = 0;
        this.level = 1;
        this.paused = false;

        this.leaderboard = this.loadLeaderboard();

        this.player = null;
        this.formation = null;
        this.bullets = [];
        this.explosions = [];

        this.levelTransitionTimer = 0;
        this.levelTransitionDuration = 120;

        this.initials = ['A', 'A', 'A'];
        this.currentInitialIndex = 0;
        this.initialCycleDelay = 0;

        this.setupMuteButton();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.lastTime = 0;
        this.gameLoop = this.gameLoop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }

    setupMuteButton() {
        const btn = document.getElementById('btn-mute');
        if (btn) {
            btn.addEventListener('click', () => {
                const muted = soundManager.toggleMute();
                btn.textContent = muted ? 'Sound: OFF' : 'Sound: ON';
            });
        }
    }

    loadLeaderboard() {
        const data = localStorage.getItem('spaceInvadersLeaderboard');
        if (data) {
            return JSON.parse(data);
        }
        return [
            { initials: '---', score: 0 },
            { initials: '---', score: 0 },
            { initials: '---', score: 0 }
        ];
    }

    saveLeaderboard() {
        localStorage.setItem('spaceInvadersLeaderboard', JSON.stringify(this.leaderboard));
    }

    isHighScore(score) {
        return score > this.leaderboard[2].score;
    }

    addToLeaderboard(initials, score) {
        const entry = { initials: initials.join(''), score };
        this.leaderboard.push(entry);
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 3);
        this.saveLeaderboard();
    }

    getHighScore() {
        return this.leaderboard[0].score;
    }

    cycleInitialLetter(direction) {
        if (this.initialCycleDelay > 0) return;
        this.initialCycleDelay = 8;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let currentIndex = alphabet.indexOf(this.initials[this.currentInitialIndex]);
        currentIndex = (currentIndex + direction + 26) % 26;
        this.initials[this.currentInitialIndex] = alphabet[currentIndex];
        soundManager.playTone(440, 0.05, 'square', 0.1);
    }

    confirmInitialLetter() {
        this.currentInitialIndex++;
        soundManager.playTone(660, 0.1, 'square', 0.2);

        if (this.currentInitialIndex >= 3) {
            this.addToLeaderboard(this.initials, this.score);
            this.state = 'gameover';
            this.initials = ['A', 'A', 'A'];
            this.currentInitialIndex = 0;
        }
    }

    resizeCanvas() {
        const container = document.getElementById('game-container');
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight * 0.8;

        const scale = Math.min(maxWidth / 800, maxHeight / 600);

        this.canvas.style.width = `${800 * scale}px`;
        this.canvas.style.height = `${600 * scale}px`;
    }

    startGame() {
        this.state = 'playing';
        this.score = 0;
        this.level = 1;
        this.bullets = [];
        this.explosions = [];

        this.player = new Player(this.canvas.width, this.canvas.height);
        this.formation = createFormationForLevel(this.level, this.canvas.width);

        soundManager.resumeContext();
    }

    nextLevel() {
        this.level++;
        this.state = 'levelTransition';
        this.levelTransitionTimer = this.levelTransitionDuration;
        soundManager.playLevelUp();
    }

    startNextLevel() {
        this.state = 'playing';
        this.bullets = [];
        this.formation = createFormationForLevel(this.level, this.canvas.width);
        this.player.reset(this.canvas.width, this.canvas.height);
    }

    gameOver() {
        soundManager.playGameOver();
        if (this.isHighScore(this.score)) {
            this.state = 'enterInitials';
            this.initials = ['A', 'A', 'A'];
            this.currentInitialIndex = 0;
        } else {
            this.state = 'gameover';
        }
    }

    togglePause() {
        if (this.state === 'playing') {
            this.paused = !this.paused;
        }
    }

    handleEnter() {
        if (this.state === 'start') {
            this.startGame();
        } else if (this.state === 'gameover') {
            this.startGame();
        } else if (this.state === 'enterInitials') {
            this.confirmInitialLetter();
        }
    }

    update() {
        if (this.initialCycleDelay > 0) {
            this.initialCycleDelay--;
        }

        if (this.state === 'start' || this.state === 'gameover') {
            return;
        }

        if (this.state === 'enterInitials') {
            return;
        }

        if (this.state === 'levelTransition') {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) {
                this.startNextLevel();
            }
            return;
        }

        if (this.paused) return;

        this.player.update(input, this.bullets);
        this.formation.update(this.bullets, this.canvas.width, this.canvas.height);

        for (const bullet of this.bullets) {
            bullet.update();
        }

        this.bullets = this.bullets.filter(b => b.active && !b.isOffScreen(this.canvas.height));

        checkBulletInvaderCollisions(this.bullets, this.formation, (invader) => {
            this.score += invader.getPoints();
            this.addExplosion(invader.x, invader.y);
            soundManager.playExplosion();
        });

        checkBulletPlayerCollisions(this.bullets, this.player, () => {
            const dead = this.player.hit();
            this.addExplosion(this.player.x, this.player.y);
            if (dead) {
                this.gameOver();
            }
        });

        for (const exp of this.explosions) {
            exp.timer--;
        }
        this.explosions = this.explosions.filter(e => e.timer > 0);

        if (this.formation.allDestroyed()) {
            this.nextLevel();
        }

        if (this.formation.getLowestY() > this.player.y - this.player.height) {
            this.gameOver();
        }
    }

    addExplosion(x, y) {
        this.explosions.push({
            x,
            y,
            timer: 20,
            maxTimer: 20
        });
    }

    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'start') {
            this.renderStartScreen();
            return;
        }

        if (this.state === 'gameover') {
            this.renderGameOverScreen();
            return;
        }

        if (this.state === 'enterInitials') {
            this.renderEnterInitials();
            return;
        }

        if (this.state === 'levelTransition') {
            this.renderLevelTransition();
            return;
        }

        this.player.render(this.ctx);
        this.formation.render(this.ctx);

        for (const bullet of this.bullets) {
            bullet.render(this.ctx);
        }

        this.renderExplosions();
        this.renderHUD();

        if (this.paused) {
            this.renderPauseOverlay();
        }
    }

    renderStartScreen() {
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPACE INVADERS', this.canvas.width / 2, 100);

        this.ctx.font = '24px Courier New';
        this.ctx.fillStyle = '#ff0';
        this.ctx.fillText('HIGH SCORES', this.canvas.width / 2, 170);

        this.ctx.font = '20px Courier New';
        this.ctx.fillStyle = '#0f0';
        for (let i = 0; i < 3; i++) {
            const entry = this.leaderboard[i];
            const rank = i + 1;
            const y = 210 + i * 35;
            this.ctx.fillText(`${rank}. ${entry.initials}  ${entry.score.toString().padStart(6, '0')}`, this.canvas.width / 2, y);
        }

        this.ctx.font = '18px Courier New';
        this.ctx.fillStyle = '#0f0';
        this.ctx.fillText('Controls:', this.canvas.width / 2, 340);
        this.ctx.fillText('Arrow Keys / A,D - Move', this.canvas.width / 2, 370);
        this.ctx.fillText('Space - Shoot  |  P - Pause', this.canvas.width / 2, 400);

        this.ctx.fillStyle = '#ff0';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText('Press ENTER or FIRE to Start', this.canvas.width / 2, 480);
    }

    renderGameOverScreen() {
        this.player.render(this.ctx);
        this.formation.render(this.ctx);

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#f00';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, 120);

        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText(`Score: ${this.score}  Level: ${this.level}`, this.canvas.width / 2, 180);

        this.ctx.fillStyle = '#ff0';
        this.ctx.fillText('HIGH SCORES', this.canvas.width / 2, 240);

        this.ctx.font = '20px Courier New';
        this.ctx.fillStyle = '#0f0';
        for (let i = 0; i < 3; i++) {
            const entry = this.leaderboard[i];
            const rank = i + 1;
            const y = 280 + i * 35;
            this.ctx.fillText(`${rank}. ${entry.initials}  ${entry.score.toString().padStart(6, '0')}`, this.canvas.width / 2, y);
        }

        this.ctx.fillStyle = '#ff0';
        this.ctx.font = '20px Courier New';
        this.ctx.fillText('Press ENTER or FIRE to Restart', this.canvas.width / 2, 450);
    }

    renderEnterInitials() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ff0';
        this.ctx.font = '36px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('NEW HIGH SCORE!', this.canvas.width / 2, 150);

        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '48px Courier New';
        this.ctx.fillText(this.score.toString(), this.canvas.width / 2, 220);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText('ENTER YOUR INITIALS', this.canvas.width / 2, 300);

        const spacing = 60;
        const startX = this.canvas.width / 2 - spacing;

        for (let i = 0; i < 3; i++) {
            const x = startX + i * spacing;
            const isActive = i === this.currentInitialIndex;

            if (isActive) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.fillText('^', x, 340);
            }

            this.ctx.fillStyle = isActive ? '#ff0' : '#0f0';
            this.ctx.font = '48px Courier New';
            this.ctx.fillText(this.initials[i], x, 400);

            if (isActive) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.font = '24px Courier New';
                this.ctx.fillText('v', x, 440);
            }
        }

        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '18px Courier New';
        this.ctx.fillText('UP/DOWN to change letter', this.canvas.width / 2, 500);
        this.ctx.fillText('ENTER/FIRE to confirm', this.canvas.width / 2, 530);
    }

    renderLevelTransition() {
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`LEVEL ${this.level}`, this.canvas.width / 2, this.canvas.height / 2);

        this.ctx.font = '24px Courier New';
        this.ctx.fillText('Get Ready!', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }

    renderExplosions() {
        for (const exp of this.explosions) {
            const progress = 1 - exp.timer / exp.maxTimer;
            const radius = 20 + progress * 20;
            const alpha = 1 - progress;

            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, ${Math.floor(200 * (1 - progress))}, 0, ${alpha})`;
            this.ctx.fill();
        }
    }

    renderHUD() {
        this.ctx.fillStyle = '#0f0';
        this.ctx.font = '20px Courier New';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);

        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Level: ${this.level}`, this.canvas.width / 2, 30);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`High: ${this.getHighScore()}`, this.canvas.width - 20, 30);

        this.ctx.textAlign = 'left';
        for (let i = 0; i < this.player.lives; i++) {
            const x = 20 + i * 30;
            const y = this.canvas.height - 20;
            this.ctx.fillStyle = '#0f0';
            this.ctx.beginPath();
            this.ctx.moveTo(x + 10, y - 10);
            this.ctx.lineTo(x, y + 5);
            this.ctx.lineTo(x + 20, y + 5);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    renderPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ff0';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);

        this.ctx.font = '20px Courier New';
        this.ctx.fillText('Press P or ESC to Resume', this.canvas.width / 2, this.canvas.height / 2 + 50);
    }

    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update();
        this.render();

        requestAnimationFrame(this.gameLoop);
    }
}

const game = new Game();
