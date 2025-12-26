import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore, Team } from '../stores/gameStore';
import Confetti from './Confetti';

interface BingoGameProps {
    isAdmin: boolean;
}

// Activity type icons and names
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

const ACTIVITY_RULES = {
    de: {
        EXPLAIN: '🗣️ Erkläre den Begriff, ohne die verbotenen Wörter zu benutzen!',
        PANTOMIME: '🎭 Stelle den Begriff nur mit Gesten dar – KEIN Sprechen!',
        DRAW: '🎨 Zeichne den Begriff – keine Buchstaben oder Zahlen!',
        HUM: '🎵 Summe die Melodie – kein Text, kein Singen!'
    },
    tr: {
        EXPLAIN: '🗣️ Yasak kelimeleri kullanmadan terimi açıkla!',
        PANTOMIME: '🎭 Sadece hareketlerle anlat – KONUŞMA YOK!',
        DRAW: '🎨 Terimi çiz – harf veya rakam yok!',
        HUM: '🎵 Melodiyi mırılda – şarkı sözü yok!'
    }
};

// Cell status types
type CellStatus = 'empty' | 'active' | 'won' | 'locked';

interface BingoCell {
    category: string;
    categoryIcon: string;
    type: 'EXPLAIN' | 'PANTOMIME' | 'DRAW' | 'HUM';
    status: CellStatus;
    wonByTeamId?: string;
}

interface TabooCard {
    term: string;
    forbiddenWords: string[];
    type: string;
    category: string;
}

// Turn phases
type TurnPhase = 'WAITING' | 'SELECTING' | 'PERFORMING' | 'RESULT';

// Category data
const CATEGORIES = [
    { id: 'tuerkei', name: { de: 'Türkei Spezial', tr: 'Türkiye Özel' }, icon: '🇹🇷' },
    { id: 'musik_hits', name: { de: 'Musik 2025', tr: 'Müzik 2025' }, icon: '🎵' },
    { id: 'filme_serien', name: { de: 'Filme & Serien', tr: 'Filmler & Diziler' }, icon: '🎬' },
    { id: 'sport', name: { de: 'Sport 2025', tr: 'Spor 2025' }, icon: '⚽' },
    { id: 'prominente', name: { de: 'Prominente', tr: 'Ünlüler' }, icon: '⭐' },
    { id: 'tech_gaming', name: { de: 'Tech & Gaming', tr: 'Teknoloji & Oyunlar' }, icon: '🎮' },
    { id: 'popkultur', name: { de: 'Popkultur', tr: 'Popüler Kültür' }, icon: '📱' },
    { id: 'essen_trinken', name: { de: 'Essen & Trinken', tr: 'Yemek & İçecek' }, icon: '🍕' },
    { id: 'silvester', name: { de: 'Silvester', tr: 'Yılbaşı' }, icon: '🎆' },
];

const BingoGame: React.FC<BingoGameProps> = ({ isAdmin }) => {
    const { session, socket, currentTeamId, setPhase } = useGameStore();

    // Game state
    const [grid, setGrid] = useState<BingoCell[]>([]);
    const [turnPhase, setTurnPhase] = useState<TurnPhase>('WAITING');
    const [currentTurnTeamIndex, setCurrentTurnTeamIndex] = useState(0);
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [tabooCard, setTabooCard] = useState<TabooCard | null>(null);
    const [timer, setTimer] = useState(60);
    const [timerActive, setTimerActive] = useState(false);
    const [buzzedBy, setBuzzedBy] = useState<string | null>(null);
    const [showWinner, setShowWinner] = useState<Team | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const language = (session?.language || 'de') as 'de' | 'tr';
    const teams = session?.teams || [];
    const activeTeam = teams[currentTurnTeamIndex];
    const isMyTurn = activeTeam?.id === currentTeamId;
    const isPerformer = isMyTurn && turnPhase === 'PERFORMING';
    const isJury = !isMyTurn && turnPhase === 'PERFORMING';

    // Translations
    const t = {
        de: {
            title: 'CHAOS BINGO',
            subtitle: 'Mission: Gridlock',
            loading: 'Spiel wird geladen...',
            yourTurn: '🎯 Du bist dran! Wähle ein Feld!',
            waitingFor: 'Warte auf',
            toSelect: 'wählt ein Feld...',
            performing: 'führt durch...',
            attention: '⚠️ ACHTUNG: KONTROLLE!',
            watchFor: 'Achte auf Regelverstöße!',
            buzzer: '🚨 BUZZER',
            buzzed: 'GEBUZZERT!',
            fieldLocked: 'Feld gesperrt!',
            correct: '✓ RICHTIG!',
            wrong: '✕ FALSCH!',
            timeUp: 'Zeit abgelaufen!',
            term: 'BEGRIFF:',
            forbidden: 'VERBOTENE WÖRTER:',
            winner: '🎉 BINGO!',
            seconds: 'Sekunden',
            startRound: 'Runde starten',
            nextTeam: 'Nächstes Team'
        },
        tr: {
            title: 'KAOS BİNGO',
            subtitle: 'Görev: Gridlock',
            loading: 'Oyun yükleniyor...',
            yourTurn: '🎯 Senin sıran! Bir hücre seç!',
            waitingFor: 'Bekleniyor',
            toSelect: 'hücre seçiyor...',
            performing: 'gösteriyor...',
            attention: '⚠️ DİKKAT: KONTROL!',
            watchFor: 'Kural ihlallerini izle!',
            buzzer: '🚨 BUZZER',
            buzzed: 'BUZZER BASILDI!',
            fieldLocked: 'Hücre kilitlendi!',
            correct: '✓ DOĞRU!',
            wrong: '✕ YANLIŞ!',
            timeUp: 'Süre doldu!',
            term: 'TERİM:',
            forbidden: 'YASAK KELİMELER:',
            winner: '🎉 BİNGO!',
            seconds: 'saniye',
            startRound: 'Turu başlat',
            nextTeam: 'Sonraki takım'
        }
    }[language];

    // Initialize grid
    useEffect(() => {
        initializeGrid();
        setupSocketListeners();
        return () => cleanupSocketListeners();
    }, []);

    // Timer countdown
    useEffect(() => {
        if (!timerActive || timer <= 0) return;
        const interval = setInterval(() => setTimer(t => t - 1), 1000);
        return () => clearInterval(interval);
    }, [timerActive, timer]);

    // Handle timeout
    useEffect(() => {
        if (timer === 0 && timerActive) {
            handleTimeout();
        }
    }, [timer, timerActive]);

    const initializeGrid = () => {
        const types: Array<'EXPLAIN' | 'PANTOMIME' | 'DRAW' | 'HUM'> = ['EXPLAIN', 'PANTOMIME', 'DRAW', 'HUM'];
        const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 9);

        const newGrid: BingoCell[] = shuffledCategories.map(cat => ({
            category: cat.id,
            categoryIcon: cat.icon,
            type: types[Math.floor(Math.random() * types.length)],
            status: 'empty'
        }));

        setGrid(newGrid);
        setIsLoading(false);
        setTurnPhase('SELECTING');
    };

    const setupSocketListeners = () => {
        if (!socket) return;

        // Cell selected by active team
        socket.on('bingo-cell-selected', (data: { cellIndex: number; teamId: string; card: TabooCard }) => {
            setActiveCell(data.cellIndex);
            setTabooCard(data.card);
            setGrid(prev => prev.map((cell, i) =>
                i === data.cellIndex ? { ...cell, status: 'active' } : cell
            ));
        });

        // Round started by host
        socket.on('bingo-round-started', () => {
            setTurnPhase('PERFORMING');
            setTimer(60);
            setTimerActive(true);
            setBuzzedBy(null);
        });

        // Buzzer pressed
        socket.on('bingo-buzzed', (data: { teamId: string; teamName: string }) => {
            setBuzzedBy(data.teamId);
            setTimerActive(false);
            // Lock the cell
            if (activeCell !== null) {
                setGrid(prev => prev.map((cell, i) =>
                    i === activeCell ? { ...cell, status: 'locked' } : cell
                ));
            }
            // Play buzzer sound
            playBuzzerSound();
            // After 2 seconds, move to next turn
            setTimeout(() => advanceToNextTurn(), 2500);
        });

        // Correct answer
        socket.on('bingo-correct', (data: { cellIndex: number; teamId: string }) => {
            setTimerActive(false);
            setGrid(prev => prev.map((cell, i) =>
                i === data.cellIndex ? { ...cell, status: 'won', wonByTeamId: data.teamId } : cell
            ));
            setTimeout(() => {
                checkForWinner(data.teamId);
                if (!showWinner) advanceToNextTurn();
            }, 1500);
        });

        // Time ran out
        socket.on('bingo-timeout', () => {
            setTimerActive(false);
            if (activeCell !== null) {
                setGrid(prev => prev.map((cell, i) =>
                    i === activeCell ? { ...cell, status: 'empty' } : cell
                ));
            }
            setTimeout(() => advanceToNextTurn(), 1500);
        });

        // Winner declared
        socket.on('bingo-winner', (data: { teamId: string }) => {
            const winner = teams.find(t => t.id === data.teamId);
            if (winner) setShowWinner(winner);
        });
    };

    const cleanupSocketListeners = () => {
        if (!socket) return;
        socket.off('bingo-cell-selected');
        socket.off('bingo-round-started');
        socket.off('bingo-buzzed');
        socket.off('bingo-correct');
        socket.off('bingo-timeout');
        socket.off('bingo-winner');
    };

    const playBuzzerSound = () => {
        // TODO: Play "MÖÖÖP" sound
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    };

    const handleCellSelect = async (cellIndex: number) => {
        if (!isMyTurn || turnPhase !== 'SELECTING') return;
        if (grid[cellIndex].status !== 'empty') return;
        if (!session || !socket) return;

        // Fetch random card from DB for this category
        const cell = grid[cellIndex];
        const card: TabooCard = {
            term: `Begriff für ${cell.category}`, // Will be replaced by API
            forbiddenWords: ['Wort1', 'Wort2', 'Wort3', 'Wort4', 'Wort5'],
            type: cell.type,
            category: cell.category
        };

        // Emit cell selection
        socket.emit('bingo-select-cell', {
            sessionId: session.id,
            cellIndex,
            teamId: currentTeamId,
            card
        });

        setActiveCell(cellIndex);
        setTabooCard(card);
        setGrid(prev => prev.map((c, i) =>
            i === cellIndex ? { ...c, status: 'active' } : c
        ));
    };

    const handleStartRound = () => {
        if (!isAdmin || !session || !socket) return;
        socket.emit('bingo-start-round', { sessionId: session.id });
        setTurnPhase('PERFORMING');
        setTimer(60);
        setTimerActive(true);
    };

    const handleBuzz = () => {
        if (!socket || !session || !currentTeamId || isMyTurn) return;
        const myTeam = teams.find(t => t.id === currentTeamId);
        socket.emit('bingo-buzz', {
            sessionId: session.id,
            teamId: currentTeamId,
            teamName: myTeam?.secretName || myTeam?.realName
        });
    };

    const handleCorrect = () => {
        if (!isAdmin || !socket || !session || activeCell === null) return;
        socket.emit('bingo-correct', {
            sessionId: session.id,
            cellIndex: activeCell,
            teamId: activeTeam?.id
        });
    };

    const handleWrong = () => {
        if (!isAdmin || !socket || !session || activeCell === null) return;
        // Lock the cell on wrong answer
        socket.emit('bingo-fail', {
            sessionId: session.id,
            cellIndex: activeCell
        });
        setGrid(prev => prev.map((cell, i) =>
            i === activeCell ? { ...cell, status: 'locked' } : cell
        ));
        setTimerActive(false);
        setTimeout(() => advanceToNextTurn(), 1500);
    };

    const handleTimeout = () => {
        if (!socket || !session) return;
        socket.emit('bingo-timeout', { sessionId: session.id });
        if (activeCell !== null) {
            setGrid(prev => prev.map((cell, i) =>
                i === activeCell ? { ...cell, status: 'empty' } : cell
            ));
        }
        setTimerActive(false);
        setTimeout(() => advanceToNextTurn(), 1500);
    };

    const advanceToNextTurn = () => {
        setActiveCell(null);
        setTabooCard(null);
        setBuzzedBy(null);
        setTurnPhase('SELECTING');
        setCurrentTurnTeamIndex(prev => (prev + 1) % teams.length);
    };

    const checkForWinner = (teamId: string) => {
        // Check all 8 winning lines
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (const line of lines) {
            const cells = line.map(i => grid[i]);
            if (cells.every(c => c.status === 'won' && c.wonByTeamId === teamId)) {
                const winner = teams.find(t => t.id === teamId);
                if (winner) {
                    setShowWinner(winner);
                    if (socket && session) {
                        socket.emit('bingo-winner', { sessionId: session.id, teamId });
                    }
                }
                return;
            }
        }

        // Check if grid is full
        const filledCells = grid.filter(c => c.status === 'won' || c.status === 'locked').length;
        if (filledCells === 9) {
            // Find team with most cells
            const teamCounts = teams.map(team => ({
                team,
                count: grid.filter(c => c.status === 'won' && c.wonByTeamId === team.id).length
            }));
            const maxCount = Math.max(...teamCounts.map(tc => tc.count));
            const winner = teamCounts.find(tc => tc.count === maxCount)?.team;
            if (winner) setShowWinner(winner);
        }
    };

    const getCategoryName = (categoryId: string): string => {
        const cat = CATEGORIES.find(c => c.id === categoryId);
        return cat ? cat.name[language] : categoryId;
    };

    const getTeamById = (teamId: string): Team | undefined => {
        return teams.find(t => t.id === teamId);
    };

    // Loading state
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
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center relative">
                <Confetti particleCount={150} duration={8000} />
                <div className="text-8xl mb-6 animate-bounce">🎉</div>
                <h1 className="text-5xl font-titan text-yellow-400 neon-glow mb-2">{t.winner}</h1>
                <p className="text-2xl text-white/60 mb-6">3 in einer Reihe!</p>

                <div className="glass p-8 rounded-3xl min-w-[300px]">
                    {showWinner.avatar ? (
                        <img src={showWinner.avatar} alt="" className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-yellow-400" />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-5xl font-titan mx-auto mb-4">
                            {showWinner.secretName?.[0]}
                        </div>
                    )}
                    <p className="text-2xl font-bold text-cyan-400">{showWinner.secretName}</p>
                    <p className="text-xl text-white mt-2">= {showWinner.realName}</p>
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
        <div className="max-w-5xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="text-center mb-4">
                <h2 className="text-4xl font-titan text-orange-500 neon-glow mb-1">{t.title}</h2>
                <div className="glass inline-block px-4 py-1 rounded-full text-cyan-400 font-bold text-sm">
                    {t.subtitle}
                </div>
            </div>

            {/* Team List Bar */}
            <div className="glass rounded-2xl px-4 py-3 mb-4 flex flex-wrap gap-3 justify-center">
                {teams.map((team, idx) => {
                    const isActive = idx === currentTurnTeamIndex;
                    const cellsWon = grid.filter(c => c.status === 'won' && c.wonByTeamId === team.id).length;
                    return (
                        <div
                            key={team.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${isActive ? 'bg-orange-500/30 ring-2 ring-orange-500' : 'bg-white/5'
                                }`}
                        >
                            {team.avatar ? (
                                <img src={team.avatar} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-lg font-bold">
                                    {team.secretName?.[0]}
                                </div>
                            )}
                            <div className="text-left">
                                <p className="text-sm font-bold text-white">{team.realName}</p>
                                <p className="text-xs text-cyan-400">{team.secretName}</p>
                            </div>
                            <span className="text-yellow-400 font-bold">{cellsWon}</span>
                            {isActive && <span className="text-orange-400 animate-pulse">◀</span>}
                        </div>
                    );
                })}
            </div>

            {/* Timer (only during PERFORMING) */}
            {turnPhase === 'PERFORMING' && (
                <div className="text-center mb-4">
                    <div className={`text-5xl font-titan ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {timer} {t.seconds}
                    </div>
                </div>
            )}

            {/* Turn Status */}
            {turnPhase === 'SELECTING' && (
                <div className="text-center mb-4 glass rounded-2xl py-3 px-6">
                    {isMyTurn ? (
                        <p className="text-xl text-orange-400 font-bold">{t.yourTurn}</p>
                    ) : (
                        <p className="text-xl text-white/60">
                            {t.waitingFor} <span className="text-cyan-400 font-bold">{activeTeam?.secretName}</span> {t.toSelect}
                        </p>
                    )}
                </div>
            )}

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {grid.map((cell, i) => {
                    let cellClass = 'glass border-2 border-white/10';
                    let isSelectable = false;

                    if (cell.status === 'won' && cell.wonByTeamId) {
                        const winTeam = getTeamById(cell.wonByTeamId);
                        cellClass = 'bg-green-500/30 border-2 border-green-500';
                    } else if (cell.status === 'locked') {
                        cellClass = 'bg-gray-800/80 border-2 border-gray-600 opacity-60';
                    } else if (cell.status === 'active') {
                        cellClass = 'bg-orange-500/30 border-2 border-orange-500 ring-4 ring-orange-500/50 animate-pulse';
                    } else if (isMyTurn && turnPhase === 'SELECTING') {
                        cellClass += ' hover:border-orange-500 hover:bg-orange-500/10 cursor-pointer';
                        isSelectable = true;
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => isSelectable && handleCellSelect(i)}
                            disabled={!isSelectable}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-3 text-center transition-all ${cellClass}`}
                        >
                            {cell.status === 'won' && cell.wonByTeamId ? (
                                <div className="flex flex-col items-center">
                                    {getTeamById(cell.wonByTeamId)?.avatar ? (
                                        <img src={getTeamById(cell.wonByTeamId)?.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-green-400" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-xl font-bold">
                                            {getTeamById(cell.wonByTeamId)?.secretName?.[0]}
                                        </div>
                                    )}
                                    <span className="text-xs text-green-400 mt-1 truncate max-w-full">
                                        {getTeamById(cell.wonByTeamId)?.realName}
                                    </span>
                                </div>
                            ) : cell.status === 'locked' ? (
                                <span className="text-4xl opacity-50">🔒</span>
                            ) : (
                                <>
                                    <span className="text-3xl mb-1">{cell.categoryIcon}</span>
                                    <span className="text-3xl mb-1">{ACTIVITY_ICONS[cell.type]}</span>
                                    <span className="text-xs font-bold leading-tight text-white/80">
                                        {getCategoryName(cell.category)}
                                    </span>
                                    <span className="text-xs text-white/40">
                                        {ACTIVITY_NAMES[language][cell.type]}
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Card & Controls */}
            {tabooCard && turnPhase !== 'SELECTING' && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Card Display */}
                    <div className="flex-1 glass p-6 rounded-3xl border-2 border-pink-500/30">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl">{ACTIVITY_ICONS[tabooCard.type]}</span>
                            <div>
                                <h3 className="text-pink-500 font-titan text-xl">{getCategoryName(tabooCard.category)}</h3>
                                <p className="text-white/40 text-sm">{ACTIVITY_NAMES[language][tabooCard.type as keyof typeof ACTIVITY_NAMES['de']]}</p>
                            </div>
                        </div>

                        {/* Rule reminder */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 text-sm text-yellow-400">
                            {ACTIVITY_RULES[language][tabooCard.type as keyof typeof ACTIVITY_RULES['de']]}
                        </div>

                        {/* Performer View: Show term, hide forbidden words */}
                        {isPerformer && (
                            <div className="bg-white/5 rounded-2xl p-4">
                                <span className="text-xs uppercase text-white/40 mb-1 block">{t.term}</span>
                                <div className="text-3xl font-bold text-white">{tabooCard.term}</div>
                            </div>
                        )}

                        {/* Jury View: Show term AND forbidden words */}
                        {(isJury || isAdmin) && (
                            <>
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                                    <span className="text-red-400 font-bold">{t.attention}</span>
                                    <p className="text-white/60 text-sm">{t.watchFor}</p>
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
                                                <span key={i} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold">
                                                    {w}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        {/* Host: Start Round button */}
                        {isAdmin && turnPhase !== 'PERFORMING' && activeCell !== null && (
                            <button
                                onClick={handleStartRound}
                                className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full shadow-lg"
                            >
                                ▶ {t.startRound}
                            </button>
                        )}

                        {/* Jury: Buzzer */}
                        {isJury && turnPhase === 'PERFORMING' && !buzzedBy && (
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
                                <p className="text-xl text-white">{t.fieldLocked}</p>
                                <p className="text-white/60">
                                    {getTeamById(buzzedBy)?.secretName}
                                </p>
                            </div>
                        )}

                        {/* Host: Correct/Wrong buttons */}
                        {isAdmin && turnPhase === 'PERFORMING' && !buzzedBy && (
                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={handleCorrect}
                                    className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                                >
                                    {t.correct}
                                </button>
                                <button
                                    onClick={handleWrong}
                                    className="px-8 py-4 bg-red-500 hover:bg-red-400 text-white font-titan text-xl rounded-full"
                                >
                                    {t.wrong}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BingoGame;
