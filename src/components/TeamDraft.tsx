/**
 * TeamDraft.tsx - Team Draft Phase for Bingo
 * Players choose Team A (Red) or Team B (Blue) before the game starts
 */

import React, { useState, useMemo } from 'react';
import { useGameStore, Team } from '../stores/gameStore';

interface TeamDraftProps {
    isAdmin: boolean;
}

// Translations
const TRANSLATIONS = {
    de: {
        title: 'Team Draft',
        subtitle: 'Wähle dein Team!',
        teamA: 'Team Rot',
        teamB: 'Team Blau',
        unassigned: 'Noch nicht zugeordnet',
        waiting: 'Warte auf Spieler...',
        joinRed: '🔴 Team Rot beitreten',
        joinBlue: '🔵 Team Blau beitreten',
        confirmStart: '🎮 Teams bestätigen & Starten',
        needBothTeams: 'Jedes Team braucht mindestens 1 Spieler!',
        difficulty: 'Schwierigkeit',
        difficultyDesc: 'Wähle die Schwierigkeit der Begriffe',
        easy: 'Einfach',
        medium: 'Mittel',
        hard: 'Schwer'
    },
    tr: {
        title: 'Takım Seçimi',
        subtitle: 'Takımını Seç!',
        teamA: 'Kırmızı Takım',
        teamB: 'Mavi Takım',
        unassigned: 'Henüz atanmadı',
        waiting: 'Oyuncular bekleniyor...',
        joinRed: '🔴 Kırmızı Takıma Katıl',
        joinBlue: '🔵 Mavi Takıma Katıl',
        confirmStart: '🎮 Takımları Onayla & Başla',
        needBothTeams: 'Her takımda en az 1 oyuncu olmalı!',
        difficulty: 'Zorluk',
        difficultyDesc: 'Terimlerin zorluğunu seç',
        easy: 'Kolay',
        medium: 'Orta',
        hard: 'Zor'
    }
};

const TeamDraft: React.FC<TeamDraftProps> = ({ isAdmin }) => {
    const { session, socket, teams, currentTeamId } = useGameStore();
    const [selectedDifficulty, setSelectedDifficulty] = useState(3);

    const language = session?.language === 'tr' ? 'tr' : 'de';
    const t = TRANSLATIONS[language];

    // Split teams by faction
    const teamA = useMemo(() => teams.filter(team => team.faction === 'A'), [teams]);
    const teamB = useMemo(() => teams.filter(team => team.faction === 'B'), [teams]);
    const unassigned = useMemo(() => teams.filter(team => !team.faction), [teams]);

    // Current player's team
    const myTeam = teams.find(t => t.id === currentTeamId);
    const myFaction = myTeam?.faction;

    const handleJoinFaction = (faction: 'A' | 'B') => {
        if (!socket || !session || !currentTeamId) return;
        socket.emit('join-faction', {
            sessionId: session.id,
            teamId: currentTeamId,
            faction
        });
    };

    const handleConfirmAndStart = () => {
        if (!socket || !session) return;
        if (teamA.length === 0 || teamB.length === 0) {
            alert(t.needBothTeams);
            return;
        }
        socket.emit('confirm-teams', {
            sessionId: session.id,
            difficulty: selectedDifficulty
        });
    };

    // Player Avatar Card
    const PlayerCard = ({ team, color }: { team: Team; color: string }) => (
        <div className={`flex flex-col items-center p-3 rounded-xl ${color} backdrop-blur-md`}>
            {team.avatar ? (
                <img src={team.avatar} alt={team.secretName} className="w-16 h-16 rounded-full border-2 border-white/50" />
            ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                    {team.secretName[0]}
                </div>
            )}
            <span className="text-sm font-bold mt-2 truncate max-w-[80px]">{team.secretName}</span>
            <span className="text-xs text-white/60">{team.realName}</span>
        </div>
    );

    // HOST VIEW (TV)
    if (isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="font-titan text-5xl text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-blue-500">
                        {t.title}
                    </h1>
                    <p className="text-white/60 mt-2">{t.subtitle}</p>
                </div>

                {/* Difficulty Selector */}
                <div className="glass rounded-xl p-4 mb-6 max-w-md mx-auto">
                    <label className="block text-white font-bold mb-2">{t.difficulty}</label>
                    <p className="text-white/60 text-sm mb-3">{t.difficultyDesc}</p>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(level => (
                            <button
                                key={level}
                                onClick={() => setSelectedDifficulty(level)}
                                className={`flex-1 py-3 rounded-lg font-bold transition-all ${selectedDifficulty === level
                                        ? 'bg-pink-500 text-white scale-110'
                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                    }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-white/40 mt-2">
                        <span>{t.easy}</span>
                        <span>{t.medium}</span>
                        <span>{t.hard}</span>
                    </div>
                </div>

                {/* Two Team Containers */}
                <div className="grid grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {/* Team A (Red) */}
                    <div className="bg-red-500/20 border-2 border-red-500 rounded-2xl p-6 min-h-[300px]">
                        <h2 className="text-center font-titan text-2xl text-red-400 mb-4">
                            🔴 {t.teamA}
                        </h2>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {teamA.length === 0 ? (
                                <p className="text-white/40 text-center">{t.waiting}</p>
                            ) : (
                                teamA.map(team => (
                                    <PlayerCard key={team.id} team={team} color="bg-red-500/30" />
                                ))
                            )}
                        </div>
                        <div className="text-center mt-4 text-2xl font-bold text-red-400">
                            {teamA.length} 👥
                        </div>
                    </div>

                    {/* Unassigned (Middle) */}
                    <div className="bg-white/5 border-2 border-white/20 rounded-2xl p-6 min-h-[300px]">
                        <h2 className="text-center font-titan text-xl text-white/60 mb-4">
                            {t.unassigned}
                        </h2>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {unassigned.length === 0 ? (
                                <p className="text-white/40 text-center">✅</p>
                            ) : (
                                unassigned.map(team => (
                                    <PlayerCard key={team.id} team={team} color="bg-white/10" />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Team B (Blue) */}
                    <div className="bg-blue-500/20 border-2 border-blue-500 rounded-2xl p-6 min-h-[300px]">
                        <h2 className="text-center font-titan text-2xl text-blue-400 mb-4">
                            🔵 {t.teamB}
                        </h2>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {teamB.length === 0 ? (
                                <p className="text-white/40 text-center">{t.waiting}</p>
                            ) : (
                                teamB.map(team => (
                                    <PlayerCard key={team.id} team={team} color="bg-blue-500/30" />
                                ))
                            )}
                        </div>
                        <div className="text-center mt-4 text-2xl font-bold text-blue-400">
                            {teamB.length} 👥
                        </div>
                    </div>
                </div>

                {/* Confirm Button */}
                <div className="text-center mt-8">
                    <button
                        onClick={handleConfirmAndStart}
                        disabled={teamA.length === 0 || teamB.length === 0}
                        className={`px-8 py-4 rounded-xl font-bold text-xl transition-all ${teamA.length > 0 && teamB.length > 0
                                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:scale-105'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {t.confirmStart}
                    </button>
                </div>
            </div>
        );
    }

    // PLAYER VIEW (Handy)
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-6">
            {/* Title */}
            <h1 className="font-titan text-4xl text-white mb-2">{t.title}</h1>
            <p className="text-white/60 mb-8">{t.subtitle}</p>

            {/* Current Team Display */}
            {myTeam && (
                <div className="mb-8 flex flex-col items-center">
                    {myTeam.avatar && (
                        <img src={myTeam.avatar} alt="" className="w-24 h-24 rounded-full border-4 border-white/30 mb-3" />
                    )}
                    <span className="text-xl font-bold text-white">{myTeam.secretName}</span>
                </div>
            )}

            {/* Faction Buttons */}
            {!myFaction ? (
                <div className="flex gap-4 w-full max-w-md">
                    <button
                        onClick={() => handleJoinFaction('A')}
                        className="flex-1 py-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white font-bold text-lg shadow-lg hover:scale-105 transition-all"
                    >
                        {t.joinRed}
                    </button>
                    <button
                        onClick={() => handleJoinFaction('B')}
                        className="flex-1 py-6 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold text-lg shadow-lg hover:scale-105 transition-all"
                    >
                        {t.joinBlue}
                    </button>
                </div>
            ) : (
                <div className={`text-center p-8 rounded-2xl ${myFaction === 'A' ? 'bg-red-500/30 border-2 border-red-500' : 'bg-blue-500/30 border-2 border-blue-500'
                    }`}>
                    <span className="text-6xl mb-4 block">{myFaction === 'A' ? '🔴' : '🔵'}</span>
                    <p className="text-white text-xl font-bold">
                        {myFaction === 'A' ? t.teamA : t.teamB}
                    </p>
                    <p className="text-white/60 mt-2">Warte auf Host...</p>

                    {/* Switch Team Buttons */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => handleJoinFaction('A')}
                            disabled={myFaction === 'A'}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold ${myFaction === 'A' ? 'bg-gray-600 text-gray-400' : 'bg-red-500/50 text-white hover:bg-red-500'
                                }`}
                        >
                            → Rot
                        </button>
                        <button
                            onClick={() => handleJoinFaction('B')}
                            disabled={myFaction === 'B'}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold ${myFaction === 'B' ? 'bg-gray-600 text-gray-400' : 'bg-blue-500/50 text-white hover:bg-blue-500'
                                }`}
                        >
                            → Blau
                        </button>
                    </div>
                </div>
            )}

            {/* Team Counts */}
            <div className="flex gap-8 mt-8">
                <div className="text-center">
                    <span className="text-red-400 text-3xl font-bold">{teamA.length}</span>
                    <p className="text-white/60 text-sm">{t.teamA}</p>
                </div>
                <div className="text-center">
                    <span className="text-blue-400 text-3xl font-bold">{teamB.length}</span>
                    <p className="text-white/60 text-sm">{t.teamB}</p>
                </div>
            </div>
        </div>
    );
};

export default TeamDraft;
