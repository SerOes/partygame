import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore, api, Language, Team } from '../stores/gameStore';

interface AdminLobbyProps {
    onStartGame: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const AdminLobby: React.FC<AdminLobbyProps> = ({ onStartGame }) => {
    const { session, setSession, setCurrentTeamId, hasApiKey } = useGameStore();
    const [isCreating, setIsCreating] = useState(false);
    const [language, setLanguage] = useState<Language>('de');
    const [hostName, setHostName] = useState('');
    const [hasJoinedAsHost, setHasJoinedAsHost] = useState(false);

    const joinUrl = session
        ? `${window.location.origin}/join/${session.joinCode}`
        : '';

    const createSession = async () => {
        if (!hasApiKey) {
            alert('Bitte zuerst einen API-Key in den Einstellungen konfigurieren');
            return;
        }

        setIsCreating(true);
        try {
            const newSession = await api.createSession(language);
            setSession({ ...newSession, teams: [] });
        } catch (e) {
            console.error('Failed to create session:', e);
        } finally {
            setIsCreating(false);
        }
    };

    const handleHostJoin = async () => {
        if (!session || !hostName.trim()) return;

        try {
            const team = await api.joinSession(session.joinCode, hostName.trim(), true);
            if (team) {
                setCurrentTeamId(team.id);
                setHasJoinedAsHost(true);
                // Update session teams locally
                setSession({
                    ...session,
                    teams: [...session.teams, team]
                });
            }
        } catch (e) {
            console.error('Failed to join as host:', e);
        }
    };

    const handleLanguageToggle = () => {
        const newLang = language === 'de' ? 'tr' : 'de';
        setLanguage(newLang);
    };

    const canStart = session && session.teams.length >= 2 && hasJoinedAsHost;

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            {!session ? (
                // Create Session View
                <div className="text-center space-y-8 max-w-md w-full">
                    <div>
                        <h1 className="text-5xl md:text-7xl font-titan neon-glow text-pink-500 mb-4">
                            🎉 SILVESTER
                        </h1>
                        <p className="text-xl text-cyan-400">Party Game Suite</p>
                    </div>

                    <div className="glass p-6 rounded-3xl space-y-4">
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleLanguageToggle}
                                className="glass px-6 py-3 rounded-full flex items-center gap-2 hover:bg-white/10 transition-colors"
                            >
                                <span className="text-2xl">{language === 'de' ? '🇩🇪' : '🇹🇷'}</span>
                                <span className="font-bold">{language.toUpperCase()}</span>
                            </button>
                        </div>

                        <button
                            onClick={createSession}
                            disabled={isCreating || !hasApiKey}
                            className="w-full py-5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 text-black font-titan text-xl rounded-full shadow-lg transition-all transform hover:scale-105"
                        >
                            {isCreating ? 'Erstelle...' : !hasApiKey ? 'API-Key fehlt ⚙️' : 'NEUE PARTY STARTEN'}
                        </button>
                    </div>
                </div>
            ) : (
                // Lobby View with QR Code
                <div className="text-center space-y-6 max-w-lg w-full">
                    <div>
                        <h2 className="text-3xl font-titan text-pink-500 mb-2">PARTY LOBBY</h2>
                        <div className="glass inline-block px-6 py-2 rounded-full">
                            <span className="text-cyan-400 font-mono text-2xl tracking-widest">
                                {session.joinCode}
                            </span>
                        </div>
                    </div>

                    {/* Host Name Input */}
                    {!hasJoinedAsHost && (
                        <div className="glass p-4 rounded-2xl space-y-3">
                            <p className="text-sm text-white/60">Gib deinen Namen ein (als Host):</p>
                            <input
                                type="text"
                                value={hostName}
                                onChange={(e) => setHostName(e.target.value)}
                                placeholder="Dein echter Name..."
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center placeholder-white/40 focus:outline-none focus:border-pink-500"
                            />
                            <button
                                onClick={handleHostJoin}
                                disabled={!hostName.trim()}
                                className="w-full py-3 bg-pink-500 hover:bg-pink-400 disabled:bg-gray-600 text-white font-bold rounded-full"
                            >
                                Als Host beitreten
                            </button>
                        </div>
                    )}

                    {/* QR Code */}
                    <div className="bg-white p-6 rounded-3xl inline-block">
                        <QRCodeSVG
                            value={joinUrl}
                            size={200}
                            level="M"
                            includeMargin={false}
                        />
                    </div>

                    <p className="text-white/60 text-sm">
                        Scanne den QR-Code oder besuche:
                        <br />
                        <span className="text-cyan-400 font-mono">{joinUrl}</span>
                    </p>

                    {/* Teams List */}
                    <div className="glass rounded-3xl p-4">
                        <h3 className="text-lg font-bold text-white/60 mb-3">
                            Teams ({session.teams.length})
                        </h3>

                        {session.teams.length === 0 ? (
                            <p className="text-white/40 italic">Warte auf Spieler...</p>
                        ) : (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {session.teams.map((team: Team, idx: number) => (
                                    <div
                                        key={team.id}
                                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${team.isHost ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {team.avatar ? (
                                                <img src={team.avatar} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
                                            ) : (
                                                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-xl">
                                                    {team.secretName[0]}
                                                </div>
                                            )}
                                            <div className="text-left">
                                                <div className="font-bold text-white text-lg">{team.secretName}</div>
                                                {team.isHost && <div className="text-xs text-yellow-400">Host</div>}
                                            </div>
                                        </div>
                                        <div className="text-green-400 text-sm">✓ Bereit</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={onStartGame}
                        disabled={!canStart}
                        className={`w-full py-5 font-titan text-xl rounded-full transition-all transform ${canStart
                            ? 'bg-green-500 hover:bg-green-400 text-white hover:scale-105 shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {!hasJoinedAsHost
                            ? 'Zuerst als Host beitreten'
                            : canStart
                                ? '🚀 SPIEL STARTEN'
                                : 'Warte auf Spieler...'
                        }
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminLobby;
