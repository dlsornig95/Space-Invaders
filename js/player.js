class Player {
    constructor(canvasWidth, canvasHeight) {
        this.width = 50;
        this.height = 30;
        this.x = canvasWidth / 2;
        this.y = canvasHeight - 50;
        this.speed = 6;
        this.canvasWidth = canvasWidth;
        this.shootCooldown = 0;
        this.shootDelay = 15;
        this.lives = 3;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 120;
    }

    update(input, bullets) {
        if (input.keys.left) {
            this.x -= this.speed;
        }
        if (input.keys.right) {
            this.x += this.speed;
        }

        this.x = Math.max(this.width / 2, Math.min(this.canvasWidth - this.width / 2, this.x));

        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }

        if (input.consumeFire() && this.shootCooldown === 0) {
            this.shoot(bullets);
        }

        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }
    }

    shoot(bullets) {
        bullets.push(new Bullet(this.x, this.y - this.height / 2, -10, true));
        this.shootCooldown = this.shootDelay;
        soundManager.playShoot();
    }

    hit() {
        if (this.invincible) return false;

        this.lives--;
        soundManager.playHit();

        if (this.lives > 0) {
            this.invincible = true;
            this.invincibleTimer = this.invincibleDuration;
        }

        return this.lives <= 0;
    }

    reset(canvasWidth, canvasHeight) {
        this.x = canvasWidth / 2;
        this.y = canvasHeight - 50;
        this.invincible = true;
        this.invincibleTimer = this.invincibleDuration;
    }

    render(ctx) {
        if (this.invincible && Math.floor(this.invincibleTimer / 5) % 2 === 0) {
            return;
        }

        ctx.fillStyle = '#0f0';

        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(this.x - 3, this.y - this.height / 2 - 10, 6, 10);
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }
}
