import React, { useState, useEffect } from 'react';
import { useGameStore, api, Team } from '../stores/gameStore';

const Leaderboard: React.FC = () => {
    const { session, setPhase, setModeratorText } = useGameStore();
    // Show real names by default in final leaderboard
    const [showRealNames, setShowRealNames] = useState(true);

    const language = session?.language || 'de';
    const t = {
        de: {
            title: 'BESTENLISTE',
            reveal: 'Identitäten enthüllen',
            nextRound: 'WEITER: BINGO',
            finish: 'PARTY BEENDEN',
            points: 'Punkte'
        },
        tr: {
            title: 'LİDERLİK TABLOSU',
            reveal: 'Kimlikleri Göster',
            nextRound: 'DEVAM: BİNGO',
            finish: 'PARTİYİ BİTİR',
            points: 'Puan'
        }
    }[language];

    useEffect(() => {
        generateRoast();
    }, []);

    const generateRoast = async () => {
        if (session && session.teams.length > 0) {
            try {
                const roast = await api.generateRoast(session.teams, language);
                setModeratorText(roast);
            } catch (e) {
                console.error('Failed to generate roast:', e);
            }
        }
    };

    const sortedTeams = [...(session?.teams || [])].sort((a, b) => b.score - a.score);

    const getPodiumStyle = (rank: number) => {
        switch (rank) {
            case 0: return { height: 'h-48', bg: 'from-yellow-600 to-yellow-400', ring: 'ring-yellow-400', size: 'w-28 h-28' };
            case 1: return { height: 'h-36', bg: 'from-gray-600 to-gray-400', ring: 'ring-gray-400', size: 'w-20 h-20' };
            case 2: return { height: 'h-28', bg: 'from-orange-700 to-orange-500', ring: 'ring-orange-500', size: 'w-20 h-20' };
            default: return { height: 'h-20', bg: 'from-gray-700 to-gray-600', ring: 'ring-white/20', size: 'w-16 h-16' };
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <h2 className="text-5xl font-titan text-center text-yellow-400 neon-glow mb-10">
                🏆 {t.title}
            </h2>

            {/* Show all teams with scores */}
            {sortedTeams.length > 0 ? (
                <div className="space-y-4 mb-8">
                    {sortedTeams.map((team, idx) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                        const isWinner = idx === 0;

                        return (
                            <div
                                key={team.id}
                                className={`glass rounded-2xl p-5 flex items-center justify-between ${isWinner ? 'border-2 border-yellow-400 bg-yellow-400/10' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl">{medal}</span>
                                    {team.avatar ? (
                                        <img src={team.avatar} alt="" className="w-12 h-12 rounded-full" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                            <span className="text-xl font-bold">{team.secretName?.[0] || '?'}</span>
                                        </div>
                                    )}
                                    <div>
                                        <div className={`font-bold ${isWinner ? 'text-yellow-400 text-xl' : 'text-white'}`}>
                                            {team.realName || team.secretName}
                                        </div>
                                        <div className="text-white/50 text-sm">
                                            ({team.secretName})
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-titan text-2xl ${isWinner ? 'text-yellow-400' : 'text-cyan-400'}`}>
                                    {team.score} {t.points}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center text-white/50 mb-8">
                    Keine Teams gefunden...
                </div>
            )}

            {/* Action - just finish button */}
            <div className="mt-8">
                <button
                    onClick={() => setPhase('FINISHED')}
                    className="w-full py-4 glass border-2 border-pink-500 rounded-full text-pink-400 hover:bg-pink-500 hover:text-white font-bold transition-all"
                >
                    🎉 Neue Party starten
                </button>
            </div>
        </div>
    );
};

export default Leaderboard;
