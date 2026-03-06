const LEVEL_CONFIGS = [
    { rows: 4, cols: 8, speedMod: 1.0, shootMod: 1.0 },
    { rows: 4, cols: 9, speedMod: 1.1, shootMod: 1.1 },
    { rows: 5, cols: 9, speedMod: 1.2, shootMod: 1.2 },
    { rows: 5, cols: 10, speedMod: 1.3, shootMod: 1.3 },
    { rows: 5, cols: 10, speedMod: 1.4, shootMod: 1.5 },
    { rows: 6, cols: 10, speedMod: 1.5, shootMod: 1.6 },
    { rows: 6, cols: 11, speedMod: 1.6, shootMod: 1.7 },
    { rows: 6, cols: 11, speedMod: 1.8, shootMod: 1.8 },
];

function getLevelConfig(level) {
    const index = Math.min(level - 1, LEVEL_CONFIGS.length - 1);
    const config = LEVEL_CONFIGS[index];

    if (level > LEVEL_CONFIGS.length) {
        const extraLevels = level - LEVEL_CONFIGS.length;
        config.speedMod += extraLevels * 0.1;
        config.shootMod += extraLevels * 0.1;
    }

    return config;
}

function createFormationForLevel(level, canvasWidth) {
    const config = getLevelConfig(level);
    const spacing = 55;
    const totalWidth = config.cols * spacing;
    const startX = (canvasWidth - totalWidth) / 2 + spacing / 2;
    const startY = 80;

    const formation = new InvaderFormation(
        config.rows,
        config.cols,
        startX,
        startY,
        spacing
    );

    formation.setDifficulty(level);

    return formation;
}
