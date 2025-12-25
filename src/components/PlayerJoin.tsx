import React, { useState, useEffect } from 'react';
import { useGameStore, api } from '../stores/gameStore';

interface PlayerJoinProps {
    joinCode: string;
}

const PlayerJoin: React.FC<PlayerJoinProps> = ({ joinCode }) => {
    const { session, setSession, setRole, setCurrentTeamId, connect } = useGameStore();
    const [realName, setRealName] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');
    const [joinedTeam, setJoinedTeam] = useState<{ secretName: string; id: string; avatar?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        connect();
        loadSession();
    }, [joinCode]);

    const loadSession = async () => {
        setIsLoading(true);
        const foundSession = await api.getSession(joinCode);
        if (foundSession) {
            setSession(foundSession);
        } else {
            setError('Spiel nicht gefunden');
        }
        setIsLoading(false);
    };

    const handleJoin = async () => {
        if (!realName.trim()) {
            setError('Bitte Namen eingeben');
            return;
        }

        setIsJoining(true);
        setError('');

        try {
            const team = await api.joinSession(joinCode, realName);
            if (team) {
                setRole('player');
                setCurrentTeamId(team.id);
                setJoinedTeam({
                    secretName: team.secretName,
                    id: team.id,
                    avatar: team.avatar
                });
            } else {
                setError('Beitritt fehlgeschlagen');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsJoining(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-white/60">Lade Spiel...</p>
            </div>
        );
    }

    if (error && !session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="text-6xl mb-4">😕</div>
                <h2 className="text-2xl font-titan text-red-400 mb-2">Ups!</h2>
                <p className="text-white/60 mb-6">{error}</p>
                <a href="/" className="glass px-6 py-3 rounded-full text-cyan-400">
                    ← Zur Startseite
                </a>
            </div>
        );
    }

    // Already joined - show waiting screen with avatar
    if (joinedTeam) {
        const isGameStarted = session?.phase !== 'LOBBY';

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <div className="glass rounded-3xl p-8 max-w-md w-full space-y-6">
                    {/* Avatar display - larger but mobile-friendly */}
                    {joinedTeam.avatar ? (
                        <img
                            src={joinedTeam.avatar}
                            alt={joinedTeam.secretName}
                            className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-pink-500/50 shadow-lg shadow-pink-500/30"
                        />
                    ) : (
                        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-pink-500/50">
                            {joinedTeam.secretName[0]}
                        </div>
                    )}

                    <div>
                        <p className="text-white/60 text-sm mb-2">Deine Geheimidentität:</p>
                        <h1 className="text-3xl font-titan text-pink-500 neon-glow">
                            {joinedTeam.secretName}
                        </h1>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-1">Echter Name (nur für dich)</p>
                        <p className="text-white/80">{realName}</p>
                    </div>

                    {isGameStarted ? (
                        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4">
                            <p className="text-green-400 font-bold">🎮 Das Spiel läuft!</p>
                            <p className="text-green-300/60 text-sm">Schau auf den Hauptbildschirm</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-yellow-400">
                                <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full"></div>
                                <span>Warte auf Spielstart...</span>
                            </div>
                            <p className="text-white/40 text-sm">
                                Halte dein Handy bereit!
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Join form
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="glass rounded-3xl p-8 max-w-md w-full space-y-6">
                <div className="text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h1 className="text-2xl font-titan text-pink-500">BEITRETEN</h1>
                    <p className="text-white/60 text-sm mt-2">
                        Spiel: <span className="text-cyan-400 font-mono">{joinCode}</span>
                    </p>
                </div>

                <div>
                    <label className="block text-sm text-white/60 mb-2">
                        Team Name (z.B. "Lisa & Tom")
                    </label>
                    <input
                        type="text"
                        value={realName}
                        onChange={(e) => setRealName(e.target.value)}
                        placeholder="Euer Name..."
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-lg placeholder-white/30 focus:outline-none focus:border-pink-500"
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleJoin}
                    disabled={isJoining || !realName.trim()}
                    className="w-full py-5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 text-black font-titan text-xl rounded-full transition-all"
                >
                    {isJoining ? 'Trete bei...' : 'MITSPIELEN 🚀'}
                </button>

                <p className="text-center text-white/40 text-xs">
                    Nach dem Beitritt erhältst du eine lustige Geheimidentität!
                </p>
            </div>
        </div>
    );
};

export default PlayerJoin;
