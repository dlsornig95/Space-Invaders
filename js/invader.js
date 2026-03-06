class Invader {
    constructor(x, y, type = 0) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 30;
        this.active = true;
        this.animFrame = 0;
    }

    getPoints() {
        const points = [10, 20, 30, 40, 50];
        return points[this.type] || 10;
    }

    render(ctx) {
        if (!this.active) return;

        const colors = ['#0f0', '#0ff', '#ff0', '#f0f', '#f80'];
        ctx.fillStyle = colors[this.type] || '#0f0';

        const x = this.x - this.width / 2;
        const y = this.y - this.height / 2;

        ctx.fillRect(x + 5, y, this.width - 10, this.height - 10);
        ctx.fillRect(x, y + 5, this.width, this.height - 15);

        if (this.animFrame === 0) {
            ctx.fillRect(x, y + this.height - 10, 8, 10);
            ctx.fillRect(x + this.width - 8, y + this.height - 10, 8, 10);
        } else {
            ctx.fillRect(x + 5, y + this.height - 10, 8, 10);
            ctx.fillRect(x + this.width - 13, y + this.height - 10, 8, 10);
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(x + 8, y + 8, 6, 6);
        ctx.fillRect(x + this.width - 14, y + 8, 6, 6);
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    toggleAnim() {
        this.animFrame = this.animFrame === 0 ? 1 : 0;
    }
}

class InvaderFormation {
    constructor(rows, cols, startX, startY, spacing) {
        this.invaders = [];
        this.direction = 1;
        this.baseSpeed = 1;
        this.speed = this.baseSpeed;
        this.dropDistance = 20;
        this.moveTimer = 0;
        this.moveDelay = 30;
        this.shootTimer = 0;
        this.shootDelay = 60;
        this.canvasWidth = 800;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * spacing;
                const y = startY + row * (spacing * 0.8);
                const type = Math.min(row, 4);
                this.invaders.push(new Invader(x, y, type));
            }
        }
    }

    update(bullets, canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;

        this.moveTimer++;
        if (this.moveTimer >= this.moveDelay) {
            this.moveTimer = 0;
            this.move();
        }

        this.shootTimer++;
        if (this.shootTimer >= this.shootDelay) {
            this.shootTimer = 0;
            this.tryShoot(bullets, canvasHeight);
        }

        const activeCount = this.invaders.filter(inv => inv.active).length;
        const totalCount = this.invaders.length;
        const speedMultiplier = 1 + (totalCount - activeCount) / totalCount;
        this.moveDelay = Math.max(5, 30 / speedMultiplier);
    }

    move() {
        const activeInvaders = this.invaders.filter(inv => inv.active);
        if (activeInvaders.length === 0) return;

        let hitEdge = false;
        const margin = 30;

        for (const inv of activeInvaders) {
            const nextX = inv.x + this.speed * this.direction;
            if (nextX - inv.width / 2 < margin || nextX + inv.width / 2 > this.canvasWidth - margin) {
                hitEdge = true;
                break;
            }
        }

        if (hitEdge) {
            this.direction *= -1;
            for (const inv of activeInvaders) {
                inv.y += this.dropDistance;
                inv.toggleAnim();
            }
        } else {
            for (const inv of activeInvaders) {
                inv.x += this.speed * this.direction;
                inv.toggleAnim();
            }
        }
    }

    tryShoot(bullets, canvasHeight) {
        const activeInvaders = this.invaders.filter(inv => inv.active);
        if (activeInvaders.length === 0) return;

        const columns = {};
        for (const inv of activeInvaders) {
            const col = Math.round(inv.x / 50);
            if (!columns[col] || inv.y > columns[col].y) {
                columns[col] = inv;
            }
        }

        const bottomInvaders = Object.values(columns);
        if (bottomInvaders.length > 0) {
            const shooter = bottomInvaders[Math.floor(Math.random() * bottomInvaders.length)];
            bullets.push(new Bullet(shooter.x, shooter.y + shooter.height / 2, 5, false));
        }
    }

    render(ctx) {
        for (const inv of this.invaders) {
            inv.render(ctx);
        }
    }

    getLowestY() {
        let lowest = 0;
        for (const inv of this.invaders) {
            if (inv.active && inv.y + inv.height / 2 > lowest) {
                lowest = inv.y + inv.height / 2;
            }
        }
        return lowest;
    }

    allDestroyed() {
        return this.invaders.every(inv => !inv.active);
    }

    setDifficulty(level) {
        this.baseSpeed = 1 + (level - 1) * 0.2;
        this.speed = this.baseSpeed;
        this.shootDelay = Math.max(20, 60 - (level - 1) * 5);
    }
}
