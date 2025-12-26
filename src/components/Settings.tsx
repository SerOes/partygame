import React, { useState, useEffect } from 'react';
import { api, useGameStore } from '../stores/gameStore';

const API_URL = 'http://localhost:3001';

// TTS Toggle Component
const TTSToggle: React.FC = () => {
    const { session, socket } = useGameStore();
    const [ttsEnabled, setTtsEnabled] = useState(session?.ttsEnabled ?? true);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setTtsEnabled(session?.ttsEnabled ?? true);
    }, [session?.ttsEnabled]);

    const handleToggle = async () => {
        if (!session) return;

        setIsLoading(true);
        const newValue = !ttsEnabled;

        try {
            await fetch(`${API_URL}/api/sessions/${session.id}/toggle-tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newValue })
            });
            setTtsEnabled(newValue);
        } catch (e) {
            console.error('Failed to toggle TTS:', e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-white/80">
                {ttsEnabled ? '🔊 Aktiviert' : '🔇 Deaktiviert'}
            </span>
            <button
                onClick={handleToggle}
                disabled={isLoading || !session}
                className={`relative w-14 h-7 rounded-full transition-colors ${ttsEnabled ? 'bg-green-500' : 'bg-gray-600'
                    } ${isLoading ? 'opacity-50' : ''}`}
            >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${ttsEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
            </button>
        </div>
    );
};

interface SettingsProps {
    onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isRegeneratingBingo, setIsRegeneratingBingo] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { hasApiKey, setHasApiKey } = useGameStore();

    useEffect(() => {
        checkKey();
    }, []);

    const checkKey = async () => {
        const has = await api.checkApiKey();
        setHasApiKey(has);
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setError('Bitte API-Key eingeben');
            return;
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const result = await api.saveApiKey(apiKey);
            if (result.success) {
                setSuccess('API-Key erfolgreich gespeichert!');
                setHasApiKey(true);
                setApiKey('');
            } else {
                setError(result.error || 'Fehler beim Speichern');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegenerateQuestions = async () => {
        if (!hasApiKey) {
            setError('API-Key muss zuerst konfiguriert werden');
            return;
        }

        if (!confirm('Alle Fragen werden gelöscht und 1200 neue Fragen generiert (100 pro Kategorie). Dies kann mehrere Minuten dauern. Fortfahren?')) {
            return;
        }

        setIsRegenerating(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`${API_URL}/api/regenerate-all-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            setSuccess(`${data.message} (${data.categories} Kategorien)`);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleRegenerateBingoCards = async () => {
        if (!hasApiKey) {
            setError('API-Key muss zuerst konfiguriert werden');
            return;
        }

        if (!confirm('Alle Bingo-Karten werden gelöscht und ~2000 neue Karten generiert (12 Kategorien × 2 Sprachen × 85 Karten). Dies kann mehrere Minuten dauern. Fortfahren?')) {
            return;
        }

        setIsRegeneratingBingo(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`${API_URL}/api/regenerate-bingo-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setSuccess(`${data.message}`);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsRegeneratingBingo(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-titan text-pink-500 mb-6">⚙️ Einstellungen</h2>

                <div className="space-y-6">
                    {/* API Key Section */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/60 mb-2">
                                Gemini API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={hasApiKey ? '••••••••••••••••' : 'API Key eingeben...'}
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-500"
                            />
                        </div>

                        {hasApiKey && (
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                API-Key ist konfiguriert
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="w-full py-4 bg-pink-600 hover:bg-pink-500 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                        >
                            {isLoading ? 'Wird validiert...' : 'API-Key speichern'}
                        </button>

                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-center text-cyan-400 text-sm underline"
                        >
                            API-Key bei Google AI Studio erstellen →
                        </a>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white/80 mb-3">🎯 Quiz-Fragen</h3>
                        <p className="text-sm text-white/50 mb-4">
                            Generiere 100 neue Fragen pro Kategorie (1200 Fragen total) mit Gemini 3 Flash.
                        </p>
                        <button
                            onClick={handleRegenerateQuestions}
                            disabled={isRegenerating || !hasApiKey}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isRegenerating ? (
                                <>
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                    Generiere Fragen...
                                </>
                            ) : (
                                '🔄 Alle Fragen neu generieren'
                            )}
                        </button>
                        {!hasApiKey && (
                            <p className="text-xs text-red-400 mt-2">
                                API-Key muss zuerst konfiguriert werden
                            </p>
                        )}
                    </div>

                    {/* Bingo Cards Section */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white/80 mb-3">🎲 Bingo-Karten</h3>
                        <p className="text-sm text-white/50 mb-4">
                            Generiere ~2000 Taboo-Karten für Chaos Bingo (12 Kategorien × 2 Sprachen).
                        </p>
                        <button
                            onClick={handleRegenerateBingoCards}
                            disabled={isRegeneratingBingo || !hasApiKey}
                            className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isRegeneratingBingo ? (
                                <>
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                    Generiere Bingo-Karten...
                                </>
                            ) : (
                                '🎲 Alle Bingo-Karten neu generieren'
                            )}
                        </button>
                        {!hasApiKey && (
                            <p className="text-xs text-red-400 mt-2">
                                API-Key muss zuerst konfiguriert werden
                            </p>
                        )}
                    </div>

                    {/* TTS Settings */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white/80 mb-3">🔊 Sprachausgabe (TTS)</h3>
                        <p className="text-sm text-white/50 mb-4">
                            Fragen werden automatisch vorgelesen wenn aktiviert.
                        </p>
                        <TTSToggle />
                    </div>

                    {/* Status Messages */}
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-3 text-green-300 text-sm">
                            {success}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;

