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
    const [currentTurnFaction, setCurrentTurnFaction] = useState<'A' | 'B'>('A'); // Faction-based turns
    const [activeCell, setActiveCell] = useState<number | null>(null);
    const [tabooCard, setTabooCard] = useState<TabooCard | null>(null);
    const [timer, setTimer] = useState(120); // 120 seconds per round
    const [timerActive, setTimerActive] = useState(false);
    const [buzzedBy, setBuzzedBy] = useState<string | null>(null);
    const [showWinner, setShowWinner] = useState<'A' | 'B' | null>(null); // Faction wins, not individual
    const [isLoading, setIsLoading] = useState(true);
    const [showHint, setShowHint] = useState(false); // Show hint after 60s
    const [roundStarted, setRoundStarted] = useState(false); // Hide term until round starts

    // Performer rotation state - only ONE player per round sees the term
    const [currentPerformerId, setCurrentPerformerId] = useState<string | null>(null);
    const [usedPerformersA, setUsedPerformersA] = useState<string[]>([]); // Players who already performed
    const [usedPerformersB, setUsedPerformersB] = useState<string[]>([]);

    // Golden Showdown state
    const [gameMode, setGameMode] = useState<'NORMAL' | 'SHOWDOWN'>('NORMAL');
    const [showdownRound, setShowdownRound] = useState(0); // 1, 2, or 3
    const [showdownScore, setShowdownScore] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
    const [showdownFinalists, setShowdownFinalists] = useState<{ teamA: Team | null; teamB: Team | null }>({ teamA: null, teamB: null });
    const [showdownPerformer, setShowdownPerformer] = useState<'A' | 'B'>('A');
    const [showdownCard, setShowdownCard] = useState<TabooCard | null>(null);
    const [showdownCards, setShowdownCards] = useState<TabooCard[]>([]); // All 3 cards for showdown
    const [showdownCellCounts, setShowdownCellCounts] = useState<{ a: number; b: number }>({ a: 0, b: 0 });

    const language = (session?.language || 'de') as 'de' | 'tr';
    const teams = session?.teams || [];

    // Group players by faction
    const factionA = teams.filter(t => t.faction === 'A');
    const factionB = teams.filter(t => t.faction === 'B');

    // My team and faction
    const myTeam = teams.find(t => t.id === currentTeamId);
    const myFaction = myTeam?.faction;

    // Check if it's my faction's turn (for cell selection)
    const isMyFactionsTurn = myFaction === currentTurnFaction;
    const isMyTurn = isMyFactionsTurn; // Alias for backwards compatibility

    // Check if game is in a state where roles matter (cell selected or performing)
    const isActiveRound = turnPhase === 'PERFORMING' || (turnPhase === 'SELECTING' && activeCell !== null);

    // Check if I am THE designated performer (only I can see the term)
    const isPerformer = currentTeamId === currentPerformerId && isActiveRound;

    // Check if I'm a teammate of the performer (I need to guess)
    const isGuesser = isMyFactionsTurn && currentTeamId !== currentPerformerId && isActiveRound;

    // Check if I'm on the opposing team (I can buzz for rule violations)
    const isJury = !isMyFactionsTurn && isActiveRound;

    // Get the current performer's info for display
    const currentPerformer = teams.find(t => t.id === currentPerformerId);

    // Active faction name for display
    const activeFactionName = currentTurnFaction === 'A'
        ? (language === 'de' ? 'Team Rot' : 'Kırmızı Takım')
        : (language === 'de' ? 'Team Blau' : 'Mavi Takım');

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

    // Timer countdown (120s) + hint trigger when 60s remaining
    useEffect(() => {
        if (!timerActive || timer <= 0) return;
        const interval = setInterval(() => {
            setTimer(t => {
                // Show hint when 60 seconds remain (after first 60s of 120s round)
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

        // Receive synchronized grid from server with performer info
        socket.on('bingo-grid-sync', (data: {
            grid: BingoCell[];
            currentTurnFaction?: 'A' | 'B';
            currentPerformerId?: string | null;
            usedPerformersA?: string[];
            usedPerformersB?: string[];
        }) => {
            console.log('📡 Received grid sync:', data.grid.length, 'cells, performer:', data.currentPerformerId);
            setGrid(data.grid);
            if (data.currentTurnFaction) setCurrentTurnFaction(data.currentTurnFaction);
            if (data.currentPerformerId !== undefined) setCurrentPerformerId(data.currentPerformerId);
            if (data.usedPerformersA) setUsedPerformersA(data.usedPerformersA);
            if (data.usedPerformersB) setUsedPerformersB(data.usedPerformersB);
            setIsLoading(false);
            setTurnPhase('SELECTING');
        });

        // Grid not ready yet - retry after delay
        socket.on('bingo-grid-pending', () => {
            console.log('⏳ Grid not ready, retrying in 1.5s...');
            setTimeout(() => {
                if (session && socket) {
                    socket.emit('bingo-request-grid', { sessionId: session.id });
                }
            }, 1500);
        });

        // Error fetching grid
        socket.on('bingo-grid-error', (data: { error: string }) => {
            console.error('❌ Grid error:', data.error);
            setIsLoading(false);
        });

        // Cell selected by active team - reset any previous active cell first
        socket.on('bingo-cell-selected', (data: { cellIndex: number; teamId: string; card: TabooCard }) => {
            setActiveCell(data.cellIndex);
            setTabooCard(data.card);
            // Reset ALL cells to their previous state, then set new one as active
            setGrid(prev => prev.map((cell, i) => {
                if (i === data.cellIndex) {
                    return { ...cell, status: 'active' };
                } else if (cell.status === 'active') {
                    // Reset previously active cell back to empty (unless it was won/locked)
                    return { ...cell, status: 'empty' };
                }
                return cell;
            }));
        });

        // Round started by host
        socket.on('bingo-round-started', () => {
            setTurnPhase('PERFORMING');
            setRoundStarted(true);
            setTimer(120); // 120 seconds per round
            setTimerActive(true);
            setBuzzedBy(null);
            setShowHint(false); // Reset hint, will show after 60 seconds
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

        // Correct answer - now receives faction instead of teamId
        socket.on('bingo-correct', (data: { cellIndex: number; faction: 'A' | 'B' }) => {
            console.log('📥 bingo-correct received:', data);
            setTimerActive(false);
            setGrid(prev => {
                const newGrid = prev.map((cell, i) =>
                    i === data.cellIndex ? { ...cell, status: 'won' as const, wonByTeamId: data.faction } : cell
                );
                console.log('📊 Grid updated, checking for winner with new grid...');
                // Check winner with the NEW grid directly (avoid closure stale state)
                setTimeout(() => checkForWinnerWithGrid(newGrid, data.faction), 100);
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

        // Winner declared - now receives faction instead of teamId
        socket.on('bingo-winner', (data: { faction: 'A' | 'B' }) => {
            setShowWinner(data.faction);
        });

        // Turn advanced - new faction and performer
        socket.on('bingo-turn-advanced', (data: {
            currentTurnFaction: 'A' | 'B';
            currentPerformerId: string | null;
            usedPerformersA: string[];
            usedPerformersB: string[];
        }) => {
            console.log(`⏭️ Turn advanced: Faction ${data.currentTurnFaction}, Performer: ${data.currentPerformerId}`);
            setCurrentTurnFaction(data.currentTurnFaction);
            setCurrentPerformerId(data.currentPerformerId);
            setUsedPerformersA(data.usedPerformersA);
            setUsedPerformersB(data.usedPerformersB);
        });

        // ========== GOLDEN SHOWDOWN LISTENERS ==========

        // Showdown started - switch to showdown mode
        socket.on('showdown-started', (data: {
            factionA: 'A' | 'B';
            factionB: 'A' | 'B';
            firstPerformer: 'A' | 'B';
            score: { a: number; b: number };
            round: number;
            cards: TabooCard[];
            factionACells: number;
            factionBCells: number;
        }) => {
            console.log('🥇 GOLDEN SHOWDOWN STARTED!', data);
            setGameMode('SHOWDOWN');
            setShowdownPerformer(data.firstPerformer);
            setShowdownScore(data.score);
            setShowdownRound(data.round);
            setShowdownCards(data.cards || []);
            setShowdownCellCounts({ a: data.factionACells, b: data.factionBCells });
            setTurnPhase('WAITING');
            setRoundStarted(false);
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

        // Showdown finished - declare winner (now receives faction)
        socket.on('showdown-finished', (data: { winnerFaction: 'A' | 'B' }) => {
            setShowWinner(data.winnerFaction);
        });
    };

    const cleanupSocketListeners = () => {
        if (!socket) return;
        socket.off('bingo-grid-sync');
        socket.off('bingo-grid-pending');
        socket.off('bingo-grid-error');
        socket.off('bingo-cell-selected');
        socket.off('bingo-round-started');
        socket.off('bingo-buzzed');
        socket.off('bingo-correct');
        socket.off('bingo-timeout');
        socket.off('bingo-winner');
        socket.off('bingo-turn-advanced'); // Cleanup for performer rotation
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
            currentTurnFaction,
            myFaction,
            currentTeamId,
            teamsCount: teams.length
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
            currentTurnFaction,
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
            faction: currentTurnFaction  // Send faction instead of individual teamId
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
        // Reset local state
        setActiveCell(null);
        setTabooCard(null);
        setBuzzedBy(null);
        setTurnPhase('SELECTING');
        setShowHint(false);
        setRoundStarted(false);

        // Tell server to advance turn and select new performer
        if (socket && session) {
            socket.emit('bingo-advance-turn', { sessionId: session.id });
        } else {
            // Fallback for local state only (shouldn't happen in normal gameplay)
            setCurrentTurnFaction(prev => prev === 'A' ? 'B' : 'A');
        }
    };

    // Check for winner using the provided grid (avoids stale closure)
    const checkForWinnerWithGrid = (currentGrid: BingoCell[], teamId: string) => {
        console.log('🏆 checkForWinnerWithGrid called:', { teamId, gridLength: currentGrid.length });

        // Make sure grid is initialized
        if (currentGrid.length !== 9) {
            console.log('⚠️ Grid not ready yet:', currentGrid.length);
            return;
        }

        // Check all 8 winning lines
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (const line of lines) {
            const cells = line.map(i => currentGrid[i]);
            // Add null check
            if (cells.some(c => !c)) {
                console.log('⚠️ Some cells undefined in line:', line);
                continue;
            }
            // Check if all cells in line are won by the same faction
            if (cells.every(c => c?.status === 'won' && c?.wonByTeamId === teamId)) {
                console.log('🏆 BINGO! Faction', teamId, 'wins with line:', line);
                setShowWinner(teamId as 'A' | 'B');
                if (socket && session) {
                    socket.emit('bingo-winner', { sessionId: session.id, faction: teamId });
                }
                return;
            }
        }

        // Check if grid is full - trigger showdown or declare winner
        const wonCells = currentGrid.filter(c => c.status === 'won').length;
        const lockedCells = currentGrid.filter(c => c.status === 'locked').length;
        const filledCells = wonCells + lockedCells;

        console.log('🔍 Grid status:', { wonCells, lockedCells, filledCells });

        if (filledCells === 9) {
            // Count cells per faction (A vs B)
            const factionACells = currentGrid.filter(c => c.status === 'won' && c.wonByTeamId === 'A').length;
            const factionBCells = currentGrid.filter(c => c.status === 'won' && c.wonByTeamId === 'B').length;
            const difference = Math.abs(factionACells - factionBCells);

            console.log('🏁 Grid full! Faction A:', factionACells, 'Faction B:', factionBCells, 'Difference:', difference);

            // Start Golden Showdown if tied OR only 1 point difference!
            if (difference <= 1 && (factionACells > 0 || factionBCells > 0)) {
                console.log('⚖️ CLOSE GAME! Starting Golden Showdown...');
                setGameMode('SHOWDOWN');
                if (socket && session) {
                    socket.emit('showdown-start', {
                        sessionId: session.id,
                        factionA: 'A',
                        factionB: 'B',
                        factionACells,
                        factionBCells
                    });
                }
                return;
            }

            // Only declare outright winner if difference is 2+ cells
            const winnerFaction = factionACells > factionBCells ? 'A' : 'B';
            console.log('🏆 Grid full - Clear winner by cell count:', winnerFaction, '(difference:', difference, ')');
            setShowWinner(winnerFaction);
            if (socket && session) {
                socket.emit('bingo-winner', { sessionId: session.id, faction: winnerFaction });
            }
        }
    };

    // Keep old function signature for backwards compatibility
    const checkForWinner = (teamId: string) => {
        checkForWinnerWithGrid(grid, teamId);
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
        const performerFaction = showdownPerformer;
        const defenderFaction = showdownPerformer === 'A' ? 'B' : 'A';
        // Check if current player's faction is the performer
        const isMyShowdownTurn = myFaction === performerFaction;

        return (
            <div className="max-w-3xl mx-auto px-4 py-6 text-center">
                {/* Dark Spotlight Header */}
                <div className="mb-6">
                    <h2 className="text-4xl font-titan text-yellow-400 neon-glow animate-pulse">
                        ⚔️ GOLDEN SHOWDOWN ⚔️
                    </h2>
                    <p className="text-lg text-white/60 mt-2">
                        {language === 'de' ? 'Best of 3 - Erster mit 2 Punkten gewinnt!' : 'Best of 3 - İlk 2 puan alan kazanır!'}
                    </p>
                    <p className="text-sm text-yellow-400/60 mt-1">
                        🏁 Grid: Team Rot {showdownCellCounts.a} - {showdownCellCounts.b} Team Blau
                    </p>
                </div>

                {/* Scoreboard - Factions */}
                <div className="flex justify-center items-center gap-8 mb-8">
                    <div className={`glass p-4 rounded-2xl min-w-[150px] ${performerFaction === 'A' ? 'ring-2 ring-yellow-400' : ''}`}>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-2xl font-titan mx-auto mb-2">
                            🔴
                        </div>
                        <p className="text-red-400 font-bold">{language === 'de' ? 'Team Rot' : 'Kırmızı'}</p>
                        <p className="text-5xl font-titan text-yellow-400">{showdownScore.a}</p>
                    </div>

                    <div className="text-4xl font-titan text-white/40">VS</div>

                    <div className={`glass p-4 rounded-2xl min-w-[150px] ${performerFaction === 'B' ? 'ring-2 ring-yellow-400' : ''}`}>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-2xl font-titan mx-auto mb-2">
                            🔵
                        </div>
                        <p className="text-blue-400 font-bold">{language === 'de' ? 'Team Blau' : 'Mavi'}</p>
                        <p className="text-5xl font-titan text-yellow-400">{showdownScore.b}</p>
                    </div>
                </div>

                {/* 3 Golden Cards */}
                <div className="flex justify-center gap-4 mb-8">
                    {[1, 2, 3].map(cardNum => {
                        const card = showdownCards[cardNum - 1];
                        const isCompleted = cardNum < showdownRound;
                        const isActive = cardNum === showdownRound;
                        return (
                            <div
                                key={cardNum}
                                className={`w-24 h-32 rounded-xl flex flex-col items-center justify-center text-3xl font-titan ${isCompleted
                                    ? 'bg-gray-600/50 text-gray-500'
                                    : isActive
                                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black animate-pulse shadow-lg shadow-yellow-500/50'
                                        : 'bg-gradient-to-br from-yellow-600 to-yellow-800 text-yellow-200'
                                    }`}
                            >
                                {cardNum}
                                {card && (
                                    <span className="text-sm mt-1">
                                        {card.type === 'PANTOMIME' ? '🎭' : card.type === 'DRAW' ? '🎨' : '🗣️'}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                {turnPhase === 'PERFORMING' && (
                    <div className={`text-6xl font-titan mb-6 ${timer <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {timer}s
                    </div>
                )}

                {/* Current Performer */}
                <div className="glass rounded-2xl p-4 mb-6">
                    <p className="text-white/60">{language === 'de' ? 'Runde' : 'Tur'} {showdownRound || 1}/3</p>
                    <p className="text-xl text-yellow-400 font-bold">
                        🎭 {performerFaction === 'A'
                            ? (language === 'de' ? 'Team Rot' : 'Kırmızı Takım')
                            : (language === 'de' ? 'Team Blau' : 'Mavi Takım')
                        } {language === 'de' ? 'führt durch' : 'oynuyor'}
                    </p>
                    {isMyShowdownTurn && (
                        <p className="text-green-400 mt-2">➡️ {language === 'de' ? 'DEIN TEAM ist dran!' : 'SİZİN TAKIM!'}</p>
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
                        {turnPhase === 'WAITING' && showdownRound < 3 && showdownCards.length > 0 && (
                            <button
                                onClick={() => {
                                    const nextRound = showdownRound + 1;
                                    const card = showdownCards[nextRound - 1]; // Get the correct card for this round
                                    if (!card) return;

                                    // Alternate performer: Round 1 = firstPerformer, Round 2 = other, Round 3 = random
                                    const nextPerformer: 'A' | 'B' = nextRound === 1
                                        ? showdownPerformer
                                        : nextRound === 2
                                            ? (showdownPerformer === 'A' ? 'B' : 'A')
                                            : (Math.random() > 0.5 ? 'A' : 'B');

                                    socket?.emit('showdown-round-start', {
                                        sessionId: session?.id,
                                        round: nextRound,
                                        card,
                                        performer: nextPerformer
                                    });
                                }}
                                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-titan text-xl rounded-full"
                            >
                                ▶ {language === 'de' ? 'Runde' : 'Tur'} {showdownRound + 1} {language === 'de' ? 'starten' : 'başlat'}
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
                                            socket?.emit('showdown-winner', { sessionId: session?.id, faction: 'A' });
                                        } else if (newScore.b >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, faction: 'B' });
                                        }
                                    }}
                                    className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✓ {language === 'de' ? 'RICHTIG!' : 'DOĞRU!'}
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
                                            socket?.emit('showdown-winner', { sessionId: session?.id, faction: 'A' });
                                        } else if (newScore.b >= 2) {
                                            socket?.emit('showdown-winner', { sessionId: session?.id, faction: 'B' });
                                        }
                                    }}
                                    className="px-8 py-4 bg-red-500 hover:bg-red-400 text-white font-titan text-xl rounded-full"
                                >
                                    ✕ {language === 'de' ? 'FALSCH!' : 'YANLIŞ!'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Sudden Death Warning */}
                <div className="mt-6 text-orange-400 text-sm">
                    ⚠️ {language === 'de' ? 'ACHTUNG: Bei Fehler geht der Punkt an den Gegner!' : 'DİKKAT: Hata yapılırsa puan rakibe gider!'}
                </div>
            </div>
        );
    }

    // Winner screen - now displays faction winner
    if (showWinner) {
        const winnerName = showWinner === 'A'
            ? (language === 'de' ? 'Team Rot' : 'Kırmızı Takım')
            : (language === 'de' ? 'Team Blau' : 'Mavi Takım');
        const winnerColor = showWinner === 'A' ? 'text-red-500' : 'text-blue-500';
        const winnerPlayers = showWinner === 'A' ? factionA : factionB;

        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center relative">
                <Confetti particleCount={150} duration={8000} />
                <div className="text-8xl mb-6 animate-bounce">🎉</div>
                <h1 className="text-5xl font-titan text-yellow-400 neon-glow mb-2">{t.winner}</h1>
                <p className="text-2xl text-white/60 mb-6">3 in einer Reihe!</p>

                <div className={`glass p-8 rounded-3xl min-w-[300px] border-4 ${showWinner === 'A' ? 'border-red-500' : 'border-blue-500'}`}>
                    <div className={`text-6xl mb-4 ${winnerColor}`}>
                        {showWinner === 'A' ? '🔴' : '🔵'}
                    </div>
                    <p className={`text-3xl font-bold ${winnerColor}`}>{winnerName}</p>

                    {/* Show winning team members */}
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {winnerPlayers.map(player => (
                            <div key={player.id} className="flex flex-col items-center">
                                {player.avatar ? (
                                    <img src={player.avatar} alt="" className="w-12 h-12 rounded-full" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-bold">
                                        {player.secretName?.[0]}
                                    </div>
                                )}
                                <span className="text-xs text-white/60 mt-1">{player.realName}</span>
                            </div>
                        ))}
                    </div>
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

            {/* Team Factions Bar - Shows 2 teams: Red vs Blue */}
            <div className="glass rounded-2xl px-4 py-3 mb-4 flex gap-4 justify-center">
                {/* Team Rot (Faction A) */}
                <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentTurnFaction === 'A'
                    ? 'bg-red-500/30 ring-2 ring-red-500'
                    : 'bg-white/5'
                    }`}>
                    <span className="text-3xl">🔴</span>
                    <div className="flex-1">
                        <p className={`font-bold ${currentTurnFaction === 'A' ? 'text-red-400' : 'text-white/60'}`}>
                            {language === 'de' ? 'Team Rot' : 'Kırmızı Takım'}
                        </p>
                        <div className="flex -space-x-2 mt-1">
                            {factionA.map(player => (
                                player.avatar ? (
                                    <img key={player.id} src={player.avatar} alt="" className="w-8 h-8 rounded-full border-2 border-red-500" />
                                ) : (
                                    <div key={player.id} className="w-8 h-8 rounded-full bg-red-500/50 flex items-center justify-center text-xs font-bold border-2 border-red-500">
                                        {player.secretName?.[0]}
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-yellow-400">
                        {grid.filter(c => c.status === 'won' && c.wonByTeamId === 'A').length}
                    </span>
                    {currentTurnFaction === 'A' && <span className="text-red-400 animate-pulse text-xl">◀</span>}
                </div>

                <div className="text-2xl font-titan text-white/40 flex items-center">VS</div>

                {/* Team Blau (Faction B) */}
                <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentTurnFaction === 'B'
                    ? 'bg-blue-500/30 ring-2 ring-blue-500'
                    : 'bg-white/5'
                    }`}>
                    <span className="text-3xl">🔵</span>
                    <div className="flex-1">
                        <p className={`font-bold ${currentTurnFaction === 'B' ? 'text-blue-400' : 'text-white/60'}`}>
                            {language === 'de' ? 'Team Blau' : 'Mavi Takım'}
                        </p>
                        <div className="flex -space-x-2 mt-1">
                            {factionB.map(player => (
                                player.avatar ? (
                                    <img key={player.id} src={player.avatar} alt="" className="w-8 h-8 rounded-full border-2 border-blue-500" />
                                ) : (
                                    <div key={player.id} className="w-8 h-8 rounded-full bg-blue-500/50 flex items-center justify-center text-xs font-bold border-2 border-blue-500">
                                        {player.secretName?.[0]}
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                    <span className="text-2xl font-bold text-yellow-400">
                        {grid.filter(c => c.status === 'won' && c.wonByTeamId === 'B').length}
                    </span>
                    {currentTurnFaction === 'B' && <span className="text-blue-400 animate-pulse text-xl">◀</span>}
                </div>
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
                        <>
                            <p className="text-xl text-orange-400 font-bold">{t.yourTurn}</p>
                            {currentPerformer && (
                                <p className="text-sm text-white/60 mt-1">
                                    🎭 {currentPerformerId === currentTeamId
                                        ? (language === 'de' ? 'DU bist der Performer!' : 'Performer SENSİN!')
                                        : `${currentPerformer.secretName} ${language === 'de' ? 'ist Performer' : 'performer'}`
                                    }
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-xl text-white/60">
                                {t.waitingFor} <span className={currentTurnFaction === 'A' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>{activeFactionName}</span> {t.toSelect}
                            </p>
                            {currentPerformer && (
                                <p className="text-sm text-white/40 mt-1">
                                    🎭 Performer: {currentPerformer.secretName}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 3x3 Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {grid.map((cell, i) => {
                    let cellClass = 'glass border-2 border-white/10';
                    let isSelectable = false;

                    // Faction colors for won cells (A = Red, B = Blue)
                    const FACTION_COLORS = {
                        'A': { bg: 'bg-red-500/30', border: 'border-red-500', text: 'text-red-400' },
                        'B': { bg: 'bg-blue-500/30', border: 'border-blue-500', text: 'text-blue-400' },
                    };

                    if (cell.status === 'won' && cell.wonByTeamId) {
                        // wonByTeamId is now 'A' or 'B' (faction ID)
                        const colors = FACTION_COLORS[cell.wonByTeamId as 'A' | 'B'];
                        if (colors) {
                            cellClass = `${colors.bg} border-2 ${colors.border}`;
                        } else {
                            cellClass = 'bg-gray-500/30 border-2 border-gray-500'; // Fallback
                        }
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

                        {/* Performer View: Show term and forbidden words */}
                        {isPerformer && (
                            <>
                                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                                    <span className="text-xs uppercase text-white/40 mb-1 block">{t.term}</span>
                                    <div className="text-3xl font-bold text-white">
                                        {roundStarted ? tabooCard.term : '???'}
                                    </div>
                                </div>

                                {/* Show forbidden words to performer (so they know what NOT to say) */}
                                {roundStarted && tabooCard.type === 'EXPLAIN' && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                        <span className="text-xs uppercase text-red-500 font-bold block mb-2">
                                            🚫 {t.forbidden}
                                        </span>
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

                        {/* Guesser View: Teammates of performer - they must guess */}
                        {isGuesser && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                                <div className="text-center">
                                    <span className="text-5xl mb-2 block">🤔</span>
                                    <span className="text-green-400 font-bold text-lg">
                                        {language === 'de' ? 'DU MUSST RATEN!' : 'TAHMİN ETMEN GEREK!'}
                                    </span>
                                    <p className="text-white/60 text-sm mt-2">
                                        {language === 'de'
                                            ? `${currentPerformer?.secretName || 'Dein Teammitglied'} erklärt den Begriff`
                                            : `${currentPerformer?.secretName || 'Takım arkadaşın'} terimi anlatıyor`
                                        }
                                    </p>
                                    <div className="text-4xl font-bold text-white/30 mt-3">???</div>
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

                        {/* Jury View: Show term AND forbidden words AFTER round starts */}
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
                                        <span className="text-xs uppercase text-red-500 font-bold block mb-2">🚫 {t.forbidden}</span>
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
