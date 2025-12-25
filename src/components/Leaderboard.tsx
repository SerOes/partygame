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
                {t.title}
            </h2>

            {/* Podium */}
            {sortedTeams.length >= 3 && (
                <div className="flex justify-center items-end gap-4 mb-12">
                    {[1, 0, 2].map((displayIdx) => {
                        const actualIdx = displayIdx;
                        const team = sortedTeams[actualIdx];
                        if (!team) return null;
                        const style = getPodiumStyle(actualIdx);

                        return (
                            <div key={team.id} className="flex flex-col items-center">
                                <div className={`${style.size} rounded-full ring-4 ${style.ring} mb-3 overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg`}>
                                    <span className="text-2xl font-bold">{team.secretName[0]}</span>
                                </div>

                                <div className={`${style.height} w-20 md:w-24 bg-gradient-to-t ${style.bg} rounded-t-2xl flex items-center justify-center`}>
                                    <span className="text-4xl font-titan">{actualIdx + 1}</span>
                                </div>

                                <div className="mt-3 text-center">
                                    <div className="font-bold text-white">
                                        {showRealNames ? team.realName : team.secretName}
                                    </div>
                                    <div className={`font-bold ${actualIdx === 0 ? 'text-yellow-400 text-xl' : 'text-white/60'}`}>
                                        {team.score} {t.points}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Rest of teams */}
            {sortedTeams.length > 3 && (
                <div className="space-y-3 mb-8">
                    {sortedTeams.slice(3).map((team, idx) => (
                        <div key={team.id} className="glass rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center font-bold">
                                    {idx + 4}
                                </span>
                                <span className="font-bold">
                                    {showRealNames ? team.realName : team.secretName}
                                </span>
                            </div>
                            <span className="text-white/60">{team.score} {t.points}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="space-y-4">
                <button
                    onClick={() => setShowRealNames(!showRealNames)}
                    className="w-full py-4 glass border-2 border-pink-500 rounded-full font-bold text-pink-400 hover:bg-pink-500 hover:text-white transition-all"
                >
                    🎭 {t.reveal}
                </button>

                {session?.phase === 'LEADERBOARD' && (
                    <>
                        <button
                            onClick={() => setPhase('BINGO')}
                            className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-white font-titan text-xl rounded-full transition-all"
                        >
                            {t.nextRound}
                        </button>

                        <button
                            onClick={() => setPhase('FINISHED')}
                            className="w-full py-4 glass border-2 border-white/20 rounded-full text-white/50 hover:border-white/50 hover:text-white transition-all"
                        >
                            {t.finish}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
