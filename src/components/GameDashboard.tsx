import React from 'react';
import { useGameStore, GameSession } from '../stores/gameStore';

interface GameDashboardProps {
    onSelectGame: (gameType: 'QUIZ' | 'BINGO') => void;
}

const GameDashboard: React.FC<GameDashboardProps> = ({ onSelectGame }) => {
    const { session } = useGameStore();
    const language = session?.language || 'de';

    const t = {
        de: {
            title: 'SPIEL WÄHLEN',
            subtitle: 'Was spielen wir heute?',
            quizTitle: 'PUB QUIZ',
            quizSubtitle: 'Roast Battle',
            quizDesc: '10 Fragen • Teams raten • Der Letzte wird geröstet!',
            bingoTitle: 'CHAOS BINGO',
            bingoSubtitle: 'Mission: Gridlock',
            bingoDesc: 'Taboo • Pantomime • 3 Gewinnt • Buzzer Battle!',
        },
        tr: {
            title: 'OYUN SEÇ',
            subtitle: 'Bugün ne oynuyoruz?',
            quizTitle: 'PUB QUIZ',
            quizSubtitle: 'Roast Savaşı',
            quizDesc: '10 soru • Takımlar tahmin ediyor • Sonuncu roast edilir!',
            bingoTitle: 'KAOS BİNGO',
            bingoSubtitle: 'Görev: Gridlock',
            bingoDesc: 'Tabu • Pantomim • 3 Sıra Kazan • Buzzer Savaşı!',
        }
    }[language];

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-titan neon-glow text-pink-500 mb-2">
                    🎮 {t.title}
                </h1>
                <p className="text-lg text-cyan-400">{t.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
                {/* Quiz Card */}
                <button
                    onClick={() => onSelectGame('QUIZ')}
                    className="glass p-6 rounded-3xl border-2 border-yellow-400/30 hover:border-yellow-400 transition-all transform hover:scale-105 text-left group"
                >
                    <div className="text-6xl mb-4">🎤</div>
                    <h2 className="text-2xl font-titan text-yellow-400 mb-1">
                        {t.quizTitle}
                    </h2>
                    <p className="text-cyan-400 text-sm font-bold mb-2">
                        {t.quizSubtitle}
                    </p>
                    <p className="text-white/60 text-sm">
                        {t.quizDesc}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-bold">SPIELEN</span>
                        <span>→</span>
                    </div>
                </button>

                {/* Bingo Card */}
                <button
                    onClick={() => onSelectGame('BINGO')}
                    className="glass p-6 rounded-3xl border-2 border-orange-500/30 hover:border-orange-500 transition-all transform hover:scale-105 text-left group"
                >
                    <div className="text-6xl mb-4">🎲</div>
                    <h2 className="text-2xl font-titan text-orange-500 mb-1">
                        {t.bingoTitle}
                    </h2>
                    <p className="text-pink-400 text-sm font-bold mb-2">
                        {t.bingoSubtitle}
                    </p>
                    <p className="text-white/60 text-sm">
                        {t.bingoDesc}
                    </p>
                    <div className="mt-4 flex gap-3 text-2xl">
                        <span title="Erklären">🗣️</span>
                        <span title="Pantomime">🎭</span>
                        <span title="Zeichnen">🎨</span>
                        <span title="Summen">🎵</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-bold">SPIELEN</span>
                        <span>→</span>
                    </div>
                </button>
            </div>

            {/* Teams waiting */}
            {session && session.teams.length > 0 && (
                <div className="mt-8 glass rounded-2xl px-6 py-3">
                    <span className="text-white/60">
                        {session.teams.length} {language === 'de' ? 'Spieler warten...' : 'oyuncu bekliyor...'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default GameDashboard;
