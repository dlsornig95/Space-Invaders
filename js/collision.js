function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function checkBulletInvaderCollisions(bullets, formation, onHit) {
    for (const bullet of bullets) {
        if (!bullet.active || !bullet.isPlayerBullet) continue;

        const bulletBounds = {
            x: bullet.x - bullet.width / 2,
            y: bullet.y,
            width: bullet.width,
            height: bullet.height
        };

        for (const invader of formation.invaders) {
            if (!invader.active) continue;

            if (checkCollision(bulletBounds, invader.getBounds())) {
                bullet.active = false;
                invader.active = false;
                onHit(invader);
                break;
            }
        }
    }
}

function checkBulletPlayerCollisions(bullets, player, onHit) {
    if (player.invincible) return;

    for (const bullet of bullets) {
        if (!bullet.active || bullet.isPlayerBullet) continue;

        const bulletBounds = {
            x: bullet.x - bullet.width / 2,
            y: bullet.y,
            width: bullet.width,
            height: bullet.height
        };

        if (checkCollision(bulletBounds, player.getBounds())) {
            bullet.active = false;
            onHit();
            break;
        }
    }
}
