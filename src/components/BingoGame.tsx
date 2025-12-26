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
    DRAW: '🎨'
};

const ACTIVITY_NAMES = {
    de: { EXPLAIN: 'Erklären', PANTOMIME: 'Pantomime', DRAW: 'Zeichnen' },
    tr: { EXPLAIN: 'Açıkla', PANTOMIME: 'Pantomim', DRAW: 'Çiz' }
};

const ACTIVITY_RULES = {
    de: {
        EXPLAIN: '🗣️ Erkläre den Begriff, ohne die verbotenen Wörter zu benutzen!',
        PANTOMIME: '🎭 Stelle den Begriff nur mit Gesten dar – KEIN Sprechen!',
        DRAW: '🎨 Zeichne den Begriff – keine Buchstaben oder Zahlen!'
    },
    tr: {
        EXPLAIN: '🗣️ Yasak kelimeleri kullanmadan terimi açıkla!',
        PANTOMIME: '🎭 Sadece hareketlerle anlat – KONUŞMA YOK!',
        DRAW: '🎨 Terimi çiz – harf veya rakam yok!'
    }
};

// Cell status types
type CellStatus = 'empty' | 'active' | 'won' | 'locked';

interface BingoCell {
    category: string;
    categoryIcon: string;
    categoryImage: string;
    type: 'EXPLAIN' | 'PANTOMIME' | 'DRAW';
    status: CellStatus;
    wonByTeamId?: string;
}

interface TabooCard {
    term: string;
    forbiddenWords: string[];
    type: string;
    category: string;
    hint?: string;       // Hint shown after 60 seconds
    difficulty?: number; // 1-5 difficulty level
}

// Turn phases
type TurnPhase = 'WAITING' | 'SELECTING' | 'PERFORMING' | 'RESULT';

// Category data with generated Nano Banana images
const CATEGORIES = [
    { id: 'tuerkei', name: { de: 'Türkei Spezial', tr: 'Türkiye Özel' }, icon: '🇹🇷', image: '/images/categories/tuerkei.png' },
    { id: 'musik_hits', name: { de: 'Musik 2025', tr: 'Müzik 2025' }, icon: '🎵', image: '/images/categories/musik_hits.png' },
    { id: 'filme_serien', name: { de: 'Filme & Serien', tr: 'Filmler & Diziler' }, icon: '🎬', image: '/images/categories/filme_serien.png' },
    { id: 'sport', name: { de: 'Sport 2025', tr: 'Spor 2025' }, icon: '⚽', image: '/images/categories/sport.png' },
    { id: 'prominente', name: { de: 'Prominente', tr: 'Ünlüler' }, icon: '⭐', image: '/images/categories/prominente.png' },
    { id: 'tech_gaming', name: { de: 'Tech & Gaming', tr: 'Teknoloji & Oyunlar' }, icon: '🎮', image: '/images/categories/tech_gaming.png' },
    { id: 'popkultur', name: { de: 'Popkultur', tr: 'Popüler Kültür' }, icon: '📱', image: '/images/categories/popkultur.png' },
    { id: 'essen_trinken', name: { de: 'Essen & Trinken', tr: 'Yemek & İçecek' }, icon: '🍕', image: '/images/categories/essen_trinken.png' },
    { id: 'silvester', name: { de: 'Silvester', tr: 'Yılbaşı' }, icon: '🎆', image: '/images/categories/silvester.png' },
    { id: 'oesterreich', name: { de: 'Österreich', tr: 'Avusturya' }, icon: '🇦🇹', image: '/images/categories/oesterreich.png' },
    { id: 'weltgeschehen', name: { de: 'Weltgeschehen', tr: 'Dünya Olayları' }, icon: '🌍', image: '/images/categories/weltgeschehen.png' },
    { id: 'wissenschaft', name: { de: 'Wissenschaft', tr: 'Bilim' }, icon: '🔬', image: '/images/categories/wissenschaft.png' },
];

const BingoGame: React.FC<BingoGameProps> = ({ isAdmin }) => {
    const { session, socket, currentTeamId, setPhase } = useGameStore();

    // Game state
    const [grid, setGrid] = useState<BingoCell[]>([]);
    const [turnPhase, setTurnPhase] = useState<TurnPhase>('WAITING');
    const [currentTurnTeamIndex, setCurrentTurnTeamIndex] = useState(0);
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [tabooCard, setTabooCard] = useState<TabooCard | null>(null);
    const [timer, setTimer] = useState(120); // 120 seconds per round
    const [timerActive, setTimerActive] = useState(false);
    const [buzzedBy, setBuzzedBy] = useState<string | null>(null);
    const [showWinner, setShowWinner] = useState<Team | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showHint, setShowHint] = useState(false); // Show hint after 60s
    const [roundStarted, setRoundStarted] = useState(false); // Hide term until round starts

    // Golden Showdown state
    const [gameMode, setGameMode] = useState<'NORMAL' | 'SHOWDOWN'>('NORMAL');
    const [showdownRound, setShowdownRound] = useState(0); // 1, 2, or 3
    const [showdownScore, setShowdownScore] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
    const [showdownFinalists, setShowdownFinalists] = useState<{ teamA: Team | null; teamB: Team | null }>({ teamA: null, teamB: null });
    const [showdownPerformer, setShowdownPerformer] = useState<'A' | 'B'>('A');
    const [showdownCard, setShowdownCard] = useState<TabooCard | null>(null);

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

    // Initialize grid from server (host generates, others sync)
    useEffect(() => {
        if (!socket || !session) return;

        setupSocketListeners();

        // Host initializes grid, others request current state
        if (isAdmin) {
            socket.emit('bingo-init-grid', { sessionId: session.id });
        } else {
            socket.emit('bingo-request-grid', { sessionId: session.id });
        }

        return () => cleanupSocketListeners();
    }, [socket, session?.id]);

    // Timer countdown + hint trigger at 60s
    useEffect(() => {
        if (!timerActive || timer <= 0) return;
        const interval = setInterval(() => {
            setTimer(t => {
                // Show hint when timer hits 60 seconds
                if (t === 61) setShowHint(true);
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timerActive, timer]);

    // Handle timeout
    useEffect(() => {
        if (timer === 0 && timerActive) {
            handleTimeout();
        }
    }, [timer, timerActive]);

    const initializeGrid = () => {
        const types: Array<'EXPLAIN' | 'PANTOMIME' | 'DRAW'> = ['EXPLAIN', 'PANTOMIME', 'DRAW'];
        const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 9);

        const newGrid: BingoCell[] = shuffledCategories.map(cat => ({
            category: cat.id,
            categoryIcon: cat.icon,
            categoryImage: cat.image,
            type: types[Math.floor(Math.random() * types.length)],
            status: 'empty'
        }));

        setGrid(newGrid);
        setIsLoading(false);
        setTurnPhase('SELECTING');
    };

    const setupSocketListeners = () => {
        if (!socket) return;

        // Receive synchronized grid from server
        socket.on('bingo-grid-sync', (data: { grid: BingoCell[]; currentTurnTeamIndex: number }) => {
            console.log('📡 Received grid sync:', data.grid.length, 'cells');
            setGrid(data.grid);
            setCurrentTurnTeamIndex(data.currentTurnTeamIndex);
            setIsLoading(false);
            setTurnPhase('SELECTING');
        });

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
            console.log('📥 bingo-correct received:', data);
            setTimerActive(false);
            setGrid(prev => {
                const newGrid = prev.map((cell, i) =>
                    i === data.cellIndex ? { ...cell, status: 'won' as const, wonByTeamId: data.teamId } : cell
                );
                console.log('📊 Grid updated, checking for winner...');
                // Check winner after grid update - pass the new grid
                setTimeout(() => checkForWinner(data.teamId), 100);
                return newGrid;
            });
            setTimeout(() => advanceToNextTurn(), 1500);
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

        // ========== GOLDEN SHOWDOWN LISTENERS ==========

        // Showdown started - switch to showdown mode
        socket.on('showdown-started', (data: {
            teamA: Team;
            teamB: Team;
            firstPerformer: 'A' | 'B';
            score: { a: number; b: number };
            round: number;
        }) => {
            console.log('🥇 GOLDEN SHOWDOWN STARTED!');
            setGameMode('SHOWDOWN');
            setShowdownFinalists({ teamA: data.teamA, teamB: data.teamB });
            setShowdownPerformer(data.firstPerformer);
            setShowdownScore(data.score);
            setShowdownRound(data.round);
            setTurnPhase('WAITING');
        });

        // Showdown round started with card
        socket.on('showdown-round-started', (data: {
            round: number;
            card: TabooCard;
            performer: 'A' | 'B';
        }) => {
            setShowdownRound(data.round);
            setShowdownCard(data.card);
            setShowdownPerformer(data.performer);
            setTurnPhase('PERFORMING');
            setTimer(60);
            setTimerActive(true);
        });

        // Showdown point scored
        socket.on('showdown-point', (data: { winner: 'A' | 'B'; round: number }) => {
            setTimerActive(false);
            setShowdownScore(prev => ({
                a: data.winner === 'A' ? prev.a + 1 : prev.a,
                b: data.winner === 'B' ? prev.b + 1 : prev.b
            }));
            // Check for winner (first to 2)
            setTimeout(() => {
                setShowdownCard(null);
                setTurnPhase('WAITING');
            }, 2000);
        });

        // Showdown finished - declare winner
        socket.on('showdown-finished', (data: { winnerTeamId: string }) => {
            const winner = teams.find(t => t.id === data.winnerTeamId)
                || showdownFinalists.teamA?.id === data.winnerTeamId
                ? showdownFinalists.teamA
                : showdownFinalists.teamB;
            if (winner) setShowWinner(winner);
        });
    };

    const cleanupSocketListeners = () => {
        if (!socket) return;
        socket.off('bingo-grid-sync');
        socket.off('bingo-cell-selected');
        socket.off('bingo-round-started');
        socket.off('bingo-buzzed');
        socket.off('bingo-correct');
        socket.off('bingo-timeout');
        socket.off('bingo-winner');
        // Showdown listeners
        socket.off('showdown-started');
        socket.off('showdown-round-started');
        socket.off('showdown-point');
        socket.off('showdown-finished');
    };

    const playBuzzerSound = () => {
        // TODO: Play "MÖÖÖP" sound
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    };

    const handleCellSelect = async (cellIndex: number) => {
        // Send debug info to server for logging
        socket?.emit('debug-log', JSON.stringify({
            source: 'handleCellSelect',
            cellIndex,
            isMyTurn,
            turnPhase,
            activeTeamId: activeTeam?.id,
            currentTeamId,
            currentTurnTeamIndex,
            teamsCount: teams.length,
            teams: teams.map(t => ({ id: t.id, name: t.realName }))
        }));

        if (!isMyTurn || turnPhase !== 'SELECTING') {
            socket?.emit('debug-log', `BLOCKED: isMyTurn=${isMyTurn}, turnPhase=${turnPhase}`);
            return;
        }
        if (grid[cellIndex].status !== 'empty') {
            socket?.emit('debug-log', `BLOCKED: cell status=${grid[cellIndex].status}`);
            return;
        }
        if (!session || !socket) {
            return;
        }

        const cell = grid[cellIndex];

        // Send cell selection - server will fetch card from DB and broadcast
        socket.emit('bingo-select-cell', {
            sessionId: session.id,
            cellIndex,
            teamId: currentTeamId,
            category: cell.category,
            type: cell.type,
            language
        });

        // Deselect previous cell and mark new one as active
        setActiveCell(cellIndex);
        setRoundStarted(false); // Hide term until round starts
        setShowHint(false); // Reset hint
        setGrid(prev => prev.map((c, i) => {
            if (i === cellIndex) return { ...c, status: 'active' };
            // Deselect previous active cell
            if (c.status === 'active') return { ...c, status: 'empty' };
            return c;
        }));
    };

    const handleStartRound = () => {
        // Active player (isMyTurn) OR host can start the round
        if (!isMyTurn && !isAdmin) return;
        if (!session || !socket) return;

        socket.emit('bingo-start-round', { sessionId: session.id });
        setTurnPhase('PERFORMING');
        setTimer(120); // 120 seconds
        setTimerActive(true);
        setShowHint(false); // Reset hint
        setRoundStarted(true); // Now show the term
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
        console.log('✅ handleCorrect called:', {
            isAdmin,
            activeCell,
            activeTeamId: activeTeam?.id,
            turnPhase
        });
        if (!isAdmin || !socket || !session || activeCell === null) {
            console.log('❌ handleCorrect blocked - missing data');
            return;
        }
        console.log('📤 Emitting bingo-correct to server');
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
        console.log('🏆 checkForWinner called:', { teamId, gridLength: grid.length });

        // Make sure grid is initialized
        if (grid.length !== 9) {
            console.log('⚠️ Grid not ready yet:', grid.length);
            return;
        }

        // Check all 8 winning lines
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (const line of lines) {
            const cells = line.map(i => grid[i]);
            // Add null check
            if (cells.some(c => !c)) {
                console.log('⚠️ Some cells undefined in line:', line);
                continue;
            }
            if (cells.every(c => c?.status === 'won' && c?.wonByTeamId === teamId)) {
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

        // Check if grid is full - trigger showdown if tied
        const filledCells = grid.filter(c => c.status === 'won' || c.status === 'locked').length;
        if (filledCells === 9) {
            // Count cells per team
            const teamCounts = teams.map(team => ({
                team,
                count: grid.filter(c => c.status === 'won' && c.wonByTeamId === team.id).length
            })).sort((a, b) => b.count - a.count);

            const topCount = teamCounts[0]?.count || 0;
            const secondCount = teamCounts[1]?.count || 0;

            // If top 2 teams are tied, start Golden Showdown!
            if (topCount === secondCount && topCount > 0 && teamCounts.length >= 2) {
                console.log('⚖️ TIE! Starting Golden Showdown...');
                if (socket && session) {
                    socket.emit('showdown-start', {
                        sessionId: session.id,
                        teamAId: teamCounts[0].team.id,
                        teamBId: teamCounts[1].team.id
                    });
                }
                return;
            }

            // Otherwise, declare winner (team with most cells)
            const winner = teamCounts[0]?.team;
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

    // ========== GOLDEN SHOWDOWN MODE ==========
    if (gameMode === 'SHOWDOWN') {
        const performerTeam = showdownPerformer === 'A' ? showdownFinalists.teamA : showdownFinalists.teamB;
        const defenderTeam = showdownPerformer === 'A' ? showdownFinalists.teamB : showdownFinalists.teamA;
        const isMyShowdownTurn = performerTeam?.id === currentTeamId;

        return (
            <div className="max-w-3xl mx-auto px-4 py-6 text-center">
                {/* Dark Spotlight Header */}
                <div className="mb-6">
                    <h2 className="text-4xl font-titan text-yellow-400 neon-glow animate-pulse">
                        ⚔️ GOLDEN SHOWDOWN ⚔️
                    </h2>
                    <p className="text-lg text-white/60 mt-2">Best of 3 - Erster mit 2 Punkten gewinnt!</p>
                </div>

                {/* Scoreboard */}
                <div className="flex justify-center items-center gap-8 mb-8">
                    <div className={`glass p-4 rounded-2xl min-w-[150px] ${showdownPerformer === 'A' ? 'ring-2 ring-yellow-400' : ''}`}>
                        {showdownFinalists.teamA?.avatar ? (
                            <img src={showdownFinalists.teamA.avatar} alt="" className="w-16 h-16 rounded-full mx-auto mb-2" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-2xl font-titan mx-auto mb-2">
                                {showdownFinalists.teamA?.secretName?.[0]}
                            </div>
                        )}
                        <p className="text-cyan-400 font-bold">{showdownFinalists.teamA?.realName}</p>
                        <p className="text-5xl font-titan text-yellow-400">{showdownScore.a}</p>
                    </div>

                    <div className="text-4xl font-titan text-white/40">VS</div>

                    <div className={`glass p-4 rounded-2xl min-w-[150px] ${showdownPerformer === 'B' ? 'ring-2 ring-yellow-400' : ''}`}>
                        {showdownFinalists.teamB?.avatar ? (
                            <img src={showdownFinalists.teamB.avatar} alt="" className="w-16 h-16 rounded-full mx-auto mb-2" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl font-titan mx-auto mb-2">
                                {showdownFinalists.teamB?.secretName?.[0]}
                            </div>
                        )}
                        <p className="text-cyan-400 font-bold">{showdownFinalists.teamB?.realName}</p>
                        <p className="text-5xl font-titan text-yellow-400">{showdownScore.b}</p>
                    </div>
                </div>

                {/* 3 Golden Cards */}
                <div className="flex justify-center gap-4 mb-8">
                    {[1, 2, 3].map(cardNum => (
                        <div
                            key={cardNum}
                            className={`w-24 h-32 rounded-xl flex items-center justify-center text-3xl font-titan ${cardNum < showdownRound
                                ? 'bg-gray-600/50 text-gray-500'
                                : cardNum === showdownRound
                                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black animate-pulse shadow-lg shadow-yellow-500/50'
                                    : 'bg-gradient-to-br from-yellow-600 to-yellow-800 text-yellow-200'
                                }`}
                        >
                            {cardNum}
                        </div>
                    ))}
                </div>

                {/* Timer */}
                {turnPhase === 'PERFORMING' && (
                    <div className={`text-6xl font-titan mb-6 ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {timer}s
                    </div>
                )}

                {/* Current Performer */}
                <div className="glass rounded-2xl p-4 mb-6">
                    <p className="text-white/60">Runde {showdownRound}/3</p>
                    <p className="text-xl text-yellow-400 font-bold">
                        🎭 {performerTeam?.realName} führt durch
                    </p>
                    {isMyShowdownTurn && (
                        <p className="text-green-400 mt-2">➡️ DU bist dran!</p>
                    )}
                </div>

                {/* Showdown Card (if active) */}
                {showdownCard && (
                    <div className="glass p-6 rounded-3xl border-2 border-yellow-500/50 mb-6">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <span className="text-4xl">{ACTIVITY_ICONS[showdownCard.type]}</span>
                            <span className="text-2xl font-titan text-yellow-400">
                                {ACTIVITY_NAMES[language][showdownCard.type as keyof typeof ACTIVITY_NAMES['de']]}
                            </span>
                        </div>

                        {/* Performer sees only term */}
                        {isMyShowdownTurn && (
                            <div className="bg-white/10 rounded-2xl p-4">
                                <div className="text-4xl font-bold text-white">{showdownCard.term}</div>
                            </div>
                        )}

                        {/* Defender/Jury sees forbidden words */}
                        {!isMyShowdownTurn && showdownCard.type === 'EXPLAIN' && (
                            <div>
                                <div className="bg-white/10 rounded-2xl p-4 mb-4">
                                    <div className="text-4xl font-bold text-white">{showdownCard.term}</div>
                                </div>
                                <div className="text-red-400 text-sm font-bold mb-2">🚫 VERBOTEN:</div>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {showdownCard.forbiddenWords.map((w, i) => (
                                        <span key={i} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold">
                                            {w}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Buzzer for defender */}
                        {!isMyShowdownTurn && turnPhase === 'PERFORMING' && (
                            <button
                                onClick={() => socket?.emit('showdown-fail', {
                                    sessionId: session?.id,
                                    round: showdownRound,
                                    performer: showdownPerformer
                                })}
                                className="mt-6 w-32 h-32 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.5)] flex items-center justify-center border-8 border-red-900 active:scale-95 transition-transform mx-auto"
                            >
                                <span className="text-white font-titan text-xl">🚨 BUZZ!</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Host Controls */}
                {isAdmin && (
                    <div className="flex flex-wrap justify-center gap-4">
                        {turnPhase === 'WAITING' && showdownRound < 3 && (
                            <button
                                onClick={() => {
                                    const card: TabooCard = {
                                        term: `Showdown Begriff ${showdownRound + 1}`,
                                        forbiddenWords: ['Wort1', 'Wort2', 'Wort3'],
                                        type: ['PANTOMIME', 'DRAW'][Math.floor(Math.random() * 2)],
                                        category: 'showdown'
                                    };
                                    const nextPerformer = showdownRound % 2 === 0 ? 'B' : 'A';
                                    socket?.emit('showdown-round-start', {
                                        sessionId: session?.id,
                                        round: showdownRound + 1,
                                        card,
                                        performer: nextPerformer
                                    });
                                }}
                                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-titan text-xl rounded-full"
                            >
                                ▶ Runde {showdownRound + 1} starten
                            </button>
                        )}

                        {turnPhase === 'PERFORMING' && (
                            <>
                                <button
                                    onClick={() => {
                                        socket?.emit('showdown-correct', {
                                            sessionId: session?.id,
                                            round: showdownRound,
                                            winner: showdownPerformer
                                        });
                                        // Check if winner
                                        const newScore = {
                                            a: showdownPerformer === 'A' ? showdownScore.a + 1 : showdownScore.a,
                                            b: showdownPerformer === 'B' ? showdownScore.b + 1 : showdownScore.b
                                        };
                                        if (newScore.a >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, teamId: showdownFinalists.teamA?.id });
                                        } else if (newScore.b >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, teamId: showdownFinalists.teamB?.id });
                                        }
                                    }}
                                    className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✓ RICHTIG!
                                </button>
                                <button
                                    onClick={() => {
                                        socket?.emit('showdown-fail', {
                                            sessionId: session?.id,
                                            round: showdownRound,
                                            performer: showdownPerformer
                                        });
                                        // Opponent wins the point (sudden death!)
                                        const opponent = showdownPerformer === 'A' ? 'B' : 'A';
                                        const newScore = {
                                            a: opponent === 'A' ? showdownScore.a + 1 : showdownScore.a,
                                            b: opponent === 'B' ? showdownScore.b + 1 : showdownScore.b
                                        };
                                        if (newScore.a >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, teamId: showdownFinalists.teamA?.id });
                                        } else if (newScore.b >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, teamId: showdownFinalists.teamB?.id });
                                        }
                                    }}
                                    className="px-8 py-4 bg-red-500 hover:bg-red-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✕ FALSCH!
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Sudden Death Warning */}
                <div className="mt-6 text-orange-400 text-sm">
                    ⚠️ ACHTUNG: Bei Fehler geht der Punkt an den Gegner!
                </div>
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

                    // Team colors for won cells
                    const TEAM_COLORS = [
                        { bg: 'bg-cyan-500/30', border: 'border-cyan-500', text: 'text-cyan-400' },
                        { bg: 'bg-pink-500/30', border: 'border-pink-500', text: 'text-pink-400' },
                        { bg: 'bg-yellow-500/30', border: 'border-yellow-500', text: 'text-yellow-400' },
                        { bg: 'bg-purple-500/30', border: 'border-purple-500', text: 'text-purple-400' },
                        { bg: 'bg-green-500/30', border: 'border-green-500', text: 'text-green-400' },
                    ];

                    if (cell.status === 'won' && cell.wonByTeamId) {
                        const teamIndex = teams.findIndex(t => t.id === cell.wonByTeamId);
                        const colors = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
                        cellClass = `${colors.bg} border-2 ${colors.border}`;
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
                                <div className="flex flex-col items-center h-full justify-center">
                                    {getTeamById(cell.wonByTeamId)?.avatar ? (
                                        <img src={getTeamById(cell.wonByTeamId)?.avatar} alt="" className="w-16 h-16 rounded-full border-4 border-green-400" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-2xl font-bold">
                                            {getTeamById(cell.wonByTeamId)?.secretName?.[0]}
                                        </div>
                                    )}
                                    <span className="text-sm text-green-400 mt-2 font-bold truncate max-w-full">
                                        {getTeamById(cell.wonByTeamId)?.realName}
                                    </span>
                                </div>
                            ) : cell.status === 'locked' ? (
                                <div className="flex flex-col items-center h-full justify-center">
                                    <span className="text-6xl opacity-50">🔒</span>
                                    <span className="text-xs text-gray-500 mt-2">Gesperrt</span>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full w-full">
                                    {/* Top: Category + Activity labels */}
                                    <div className="text-center py-2">
                                        <span className="text-sm font-bold text-white leading-tight block">
                                            {getCategoryName(cell.category)}
                                        </span>
                                        <span className="text-xs text-cyan-400">
                                            {ACTIVITY_ICONS[cell.type]} {ACTIVITY_NAMES[language][cell.type]}
                                        </span>
                                    </div>
                                    {/* Bottom: Category image (60% height) */}
                                    <div className="flex-1 flex items-center justify-center px-2 pb-2">
                                        <img
                                            src={cell.categoryImage}
                                            alt={getCategoryName(cell.category)}
                                            className="max-h-full max-w-full object-contain rounded-xl"
                                            style={{ maxHeight: '60%' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Card & Controls - Show when a cell is selected */}
            {tabooCard && activeCell !== null && (
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

                        {/* Performer View: Show term only after round started */}
                        {isPerformer && (
                            <div className="bg-white/5 rounded-2xl p-4">
                                <span className="text-xs uppercase text-white/40 mb-1 block">{t.term}</span>
                                <div className="text-3xl font-bold text-white">
                                    {roundStarted ? tabooCard.term : '???'}
                                </div>
                            </div>
                        )}

                        {/* Hint display (after 60 seconds) - visible to all */}
                        {showHint && tabooCard.hint && (
                            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 mb-4 animate-pulse">
                                <span className="text-blue-400 font-bold">💡 HINWEIS:</span>
                                <p className="text-white text-lg mt-1">{tabooCard.hint}</p>
                            </div>
                        )}

                        {/* Jury View: Show term AND forbidden words only after round started */}
                        {(isJury || (isAdmin && !isMyTurn)) && roundStarted && (
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
