import React, { useState, useEffect } from 'react';
import { useGameStore, api, TabooWord, Team } from '../stores/gameStore';

interface BingoGameProps {
    isAdmin: boolean;
}

// Activity type icons
const ACTIVITY_ICONS: Record<string, string> = {
    EXPLAIN: '🗣️',
    PANTOMIME: '🎭',
    DRAW: '🎨',
    HUM: '🎵'
};

const ACTIVITY_NAMES = {
    de: { EXPLAIN: 'Erklären', PANTOMIME: 'Pantomime', DRAW: 'Zeichnen', HUM: 'Summen' },
    tr: { EXPLAIN: 'Açıkla', PANTOMIME: 'Pantomim', DRAW: 'Çiz', HUM: 'Mırılda' }
};

interface BingoCell {
    category: string;
    type: 'EXPLAIN' | 'PANTOMIME' | 'DRAW' | 'HUM';
    status: 'empty' | 'active' | 'won' | 'locked';
    wonByTeamId?: string;
}

interface TabooCard {
    term: string;
    forbiddenWords: string[];
    type: string;
    category: string;
}

const BingoGame: React.FC<BingoGameProps> = ({ isAdmin }) => {
    const {
        session,
        socket,
        currentTeamId,
        setPhase
    } = useGameStore();

    const [grid, setGrid] = useState<BingoCell[]>([]);
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
    const [tabooCard, setTabooCard] = useState<TabooCard | null>(null);
    const [timer, setTimer] = useState(60);
    const [isLoading, setIsLoading] = useState(true);
    const [buzzedBy, setBuzzedBy] = useState<string | null>(null);
    const [showWinner, setShowWinner] = useState<Team | null>(null);

    const language = session?.language || 'de';
    const teams = session?.teams || [];

    const t = {
        de: {
            loading: 'Bingo wird geladen...',
            title: 'CHAOS BINGO',
            subtitle: 'Mission: Gridlock',
            yourTurn: 'Du bist dran!',
            waiting: 'warten...',
            selectCell: 'Wähle ein Feld!',
            term: 'Begriff:',
            forbidden: 'Verbotene Wörter:',
            buzzer: 'BUZZER!',
            buzzed: 'GEBUZZERT!',
            success: 'RICHTIG!',
            fail: 'FALSCH!',
            winner: 'GEWINNER!',
            seconds: 'Sekunden'
        },
        tr: {
            loading: 'Bingo yükleniyor...',
            title: 'KAOS BİNGO',
            subtitle: 'Görev: Gridlock',
            yourTurn: 'Senin sıran!',
            waiting: 'bekliyor...',
            selectCell: 'Bir hücre seç!',
            term: 'Terim:',
            forbidden: 'Yasak kelimeler:',
            buzzer: 'BUZZER!',
            buzzed: 'BUZZER BASILDI!',
            success: 'DOĞRU!',
            fail: 'YANLIŞ!',
            winner: 'KAZANAN!',
            seconds: 'saniye'
        }
    }[language];

    // Initialize grid
    useEffect(() => {
        initializeGrid();
        setupSocketListeners();

        return () => {
            if (socket) {
                socket.off('bingo-cell-selected');
                socket.off('bingo-buzzed');
                socket.off('bingo-cell-won');
                socket.off('bingo-cell-locked');
                socket.off('bingo-winner');
            }
        };
    }, []);

    // Timer countdown
    useEffect(() => {
        if (activeCell !== null && timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
        if (timer === 0 && activeCell !== null && isAdmin) {
            handleFail();
        }
    }, [activeCell, timer]);

    const initializeGrid = async () => {
        setIsLoading(true);

        // Categories for Bingo
        const categories = [
            'Filme & Serien', 'Musik & Hits', 'Sport',
            'Weltgeschehen', 'Türkei Spezial', 'Tech & Gaming',
            'Popkultur', 'Prominente', 'Silvester'
        ];

        const types: Array<'EXPLAIN' | 'PANTOMIME' | 'DRAW' | 'HUM'> = ['EXPLAIN', 'PANTOMIME', 'DRAW', 'HUM'];

        const newGrid: BingoCell[] = categories.map(cat => ({
            category: cat,
            type: types[Math.floor(Math.random() * types.length)],
            status: 'empty'
        }));

        setGrid(newGrid);
        setIsLoading(false);
    };

    const setupSocketListeners = () => {
        if (!socket) return;

        socket.on('bingo-cell-selected', (data: { cellIndex: number; teamId: string; card: TabooCard }) => {
            setActiveCell(data.cellIndex);
            setActiveTeamId(data.teamId);
            setTabooCard(data.card);
            setTimer(60);
            setBuzzedBy(null);

            const newGrid = [...grid];
            newGrid[data.cellIndex] = { ...newGrid[data.cellIndex], status: 'active' };
            setGrid(newGrid);
        });

        socket.on('bingo-buzzed', (data: { teamId: string }) => {
            setBuzzedBy(data.teamId);
            // Vibrate on all devices
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        });

        socket.on('bingo-cell-won', (data: { cellIndex: number; teamId: string }) => {
            const newGrid = [...grid];
            newGrid[data.cellIndex] = {
                ...newGrid[data.cellIndex],
                status: 'won',
                wonByTeamId: data.teamId
            };
            setGrid(newGrid);
            resetRound();
        });

        socket.on('bingo-cell-locked', (data: { cellIndex: number }) => {
            const newGrid = [...grid];
            newGrid[data.cellIndex] = { ...newGrid[data.cellIndex], status: 'locked' };
            setGrid(newGrid);
            resetRound();
        });

        socket.on('bingo-winner', (data: { teamId: string }) => {
            const winner = teams.find(t => t.id === data.teamId);
            if (winner) setShowWinner(winner);
        });
    };

    const handleCellClick = async (cellIndex: number) => {
        if (!isAdmin || grid[cellIndex].status !== 'empty' || activeCell !== null) return;
        if (!session || !socket) return;

        // Determine which team's turn (rotate through teams)
        const teamIndex = grid.filter(c => c.status !== 'empty').length % teams.length;
        const activeTeam = teams[teamIndex];
        if (!activeTeam) return;

        // Generate a random taboo card for this cell
        const card: TabooCard = {
            term: `Begriff ${cellIndex + 1}`, // Placeholder - would come from API
            forbiddenWords: ['Wort1', 'Wort2', 'Wort3', 'Wort4', 'Wort5'],
            type: grid[cellIndex].type,
            category: grid[cellIndex].category
        };

        socket.emit('bingo-select-cell', {
            sessionId: session.id,
            cellIndex,
            teamId: activeTeam.id,
            card
        });
    };

    const handleBuzz = () => {
        if (!session || !socket || !currentTeamId) return;
        if (activeTeamId === currentTeamId) return; // Can't buzz yourself

        socket.emit('bingo-buzz', {
            sessionId: session.id,
            teamId: currentTeamId
        });
    };

    const handleSuccess = () => {
        if (!session || !socket || activeCell === null) return;

        socket.emit('bingo-success', {
            sessionId: session.id,
            cellIndex: activeCell,
            teamId: activeTeamId
        });
    };

    const handleFail = () => {
        if (!session || !socket || activeCell === null) return;

        socket.emit('bingo-fail', {
            sessionId: session.id,
            cellIndex: activeCell
        });
    };

    const resetRound = () => {
        setActiveCell(null);
        setActiveTeamId(null);
        setTabooCard(null);
        setTimer(60);
        setBuzzedBy(null);
    };

    const getTeamAvatar = (teamId: string) => {
        const team = teams.find(t => t.id === teamId);
        return team?.avatar || team?.secretName?.[0] || '?';
    };

    const isMyTurn = activeTeamId === currentTeamId;
    const canBuzz = activeCell !== null && !isMyTurn && !buzzedBy;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-xl text-white/60">{t.loading}</p>
            </div>
        );
    }

    // Winner screen
    if (showWinner) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
                <div className="text-8xl mb-6 animate-bounce">🎉</div>
                <h1 className="text-5xl font-titan text-yellow-400 neon-glow mb-4">{t.winner}</h1>
                <div className="glass p-8 rounded-3xl">
                    {showWinner.avatar ? (
                        <img src={showWinner.avatar} alt="" className="w-32 h-32 rounded-full mx-auto mb-4" />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-5xl font-titan mx-auto mb-4">
                            {showWinner.secretName?.[0]}
                        </div>
                    )}
                    <p className="text-2xl font-bold text-white">{showWinner.secretName}</p>
                    <p className="text-lg text-pink-400 mt-2">({showWinner.realName})</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setPhase('LEADERBOARD')}
                        className="mt-8 px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-titan text-xl rounded-full"
                    >
                        Weiter →
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-4xl font-titan text-orange-500 neon-glow mb-2">{t.title}</h2>
                <div className="glass inline-block px-6 py-2 rounded-full text-cyan-400 font-bold">
                    {t.subtitle}
                </div>
            </div>

            {/* Timer */}
            {activeCell !== null && (
                <div className="text-center mb-4">
                    <div className={`text-5xl font-titan ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {timer} {t.seconds}
                    </div>
                </div>
            )}

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {grid.map((cell, i) => {
                    let cellClass = 'glass border-2 border-white/10';

                    if (cell.status === 'won') {
                        cellClass = 'bg-green-500/30 border-2 border-green-500';
                    } else if (cell.status === 'locked') {
                        cellClass = 'bg-red-500/20 border-2 border-red-500/50 opacity-50';
                    } else if (cell.status === 'active') {
                        cellClass = 'bg-orange-500/30 border-2 border-orange-500 ring-4 ring-orange-500/50';
                    } else if (isAdmin) {
                        cellClass += ' hover:border-orange-500 cursor-pointer';
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleCellClick(i)}
                            disabled={!isAdmin || cell.status !== 'empty' || activeCell !== null}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-3 text-center transition-all ${cellClass}`}
                        >
                            {cell.status === 'won' && cell.wonByTeamId ? (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-2xl">
                                    {getTeamAvatar(cell.wonByTeamId)}
                                </div>
                            ) : cell.status === 'locked' ? (
                                <span className="text-4xl">🔒</span>
                            ) : (
                                <>
                                    <span className="text-3xl mb-2">{ACTIVITY_ICONS[cell.type]}</span>
                                    <span className="text-xs md:text-sm font-bold leading-tight text-white/80">
                                        {cell.category}
                                    </span>
                                    <span className="text-xs text-white/40 mt-1">
                                        {ACTIVITY_NAMES[language][cell.type]}
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Round - Taboo Card */}
            {tabooCard && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Taboo Card - visible to everyone (Jury sees forbidden words!) */}
                    <div className="flex-1 glass p-6 rounded-3xl border-2 border-pink-500/30">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl">{ACTIVITY_ICONS[tabooCard.type]}</span>
                            <div>
                                <h3 className="text-pink-500 font-titan text-xl">{tabooCard.category}</h3>
                                <p className="text-white/40 text-sm">{ACTIVITY_NAMES[language][tabooCard.type as keyof typeof ACTIVITY_NAMES['de']]}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 mb-4">
                            <span className="text-xs uppercase text-white/40 mb-1 block">{t.term}</span>
                            <div className="text-3xl font-bold text-white">{tabooCard.term}</div>
                        </div>

                        {tabooCard.type === 'EXPLAIN' && (
                            <div>
                                <span className="text-xs uppercase text-red-500 font-bold block mb-2">{t.forbidden}</span>
                                <div className="flex flex-wrap gap-2">
                                    {tabooCard.forbiddenWords.map((w, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold line-through"
                                        >
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Buzzer / Controls */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        {/* Buzzer for non-active players */}
                        {canBuzz && (
                            <button
                                onClick={handleBuzz}
                                className="buzzer-button w-40 h-40 md:w-56 md:h-56 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.5)] flex items-center justify-center border-8 border-red-900 active:scale-95 transition-transform"
                            >
                                <span className="text-white font-titan text-2xl md:text-3xl">{t.buzzer}</span>
                            </button>
                        )}

                        {/* Buzzed indicator */}
                        {buzzedBy && (
                            <div className="text-center">
                                <div className="text-4xl text-red-500 font-titan animate-pulse mb-2">
                                    🚨 {t.buzzed} 🚨
                                </div>
                                <p className="text-white/60">
                                    {teams.find(t => t.id === buzzedBy)?.secretName}
                                </p>
                            </div>
                        )}

                        {/* Admin controls */}
                        {isAdmin && activeCell !== null && (
                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={handleSuccess}
                                    className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✓ {t.success}
                                </button>
                                <button
                                    onClick={handleFail}
                                    className="px-8 py-4 bg-red-500 hover:bg-red-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✕ {t.fail}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* No cell selected hint for admin */}
            {!tabooCard && isAdmin && (
                <div className="text-center text-white/40 text-lg">
                    ☝️ {t.selectCell}
                </div>
            )}
        </div>
    );
};

export default BingoGame;
