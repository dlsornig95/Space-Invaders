const firebaseConfig = {
    apiKey: "AIzaSyCaLC7QnUtQje6U1UnvacuB9Imc7G2R9WU",
    authDomain: "space-invaders-leaderboad-dsor.firebaseapp.com",
    projectId: "space-invaders-leaderboad-dsor",
    storageBucket: "space-invaders-leaderboad-dsor.firebasestorage.app",
    messagingSenderId: "685552109383",
    appId: "1:685552109383:web:c475cfb8bbd1b428546e62"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const leaderboardDB = {
    async getTopScores(limit = 10) {
        try {
            const snapshot = await db.collection('leaderboard')
                .orderBy('score', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    },

    async addScore(initials, score, level) {
        try {
            await db.collection('leaderboard').add({
                initials: initials,
                score: score,
                level: level,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error adding score:', error);
            return false;
        }
    },

    async isHighScore(score, topCount = 10) {
        try {
            const topScores = await this.getTopScores(topCount);
            if (topScores.length < topCount) return true;
            const lowestTopScore = topScores[topScores.length - 1].score;
            return score > lowestTopScore;
        } catch (error) {
            console.error('Error checking high score:', error);
            return true;
        }
    }
};
