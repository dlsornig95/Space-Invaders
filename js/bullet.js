class Bullet {
    constructor(x, y, speed, isPlayerBullet = true) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = speed;
        this.isPlayerBullet = isPlayerBullet;
        this.active = true;
    }

    update() {
        this.y += this.speed;
    }

    render(ctx) {
        ctx.fillStyle = this.isPlayerBullet ? '#0f0' : '#f00';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    }

    isOffScreen(canvasHeight) {
        return this.y < -this.height || this.y > canvasHeight;
    }
}
