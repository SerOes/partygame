import React, { useState, useEffect } from 'react';
import { useGameStore, api, TabooWord } from '../stores/gameStore';

interface BingoGameProps {
    isAdmin: boolean;
}

const BingoGame: React.FC<BingoGameProps> = ({ isAdmin }) => {
    const {
        session,
        bingoCategories,
        setBingoCategories,
        currentTaboo,
        setCurrentTaboo,
        setModeratorText,
        setPhase
    } = useGameStore();

    const [cellStatus, setCellStatus] = useState<('empty' | 'won' | 'locked')[]>(
        Array(9).fill('empty')
    );
    const [selectedCell, setSelectedCell] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showBuzzer, setShowBuzzer] = useState(false);
    const [buzzed, setBuzzed] = useState(false);

    const language = session?.language || 'de';
    const t = {
        de: {
            loading: 'Bingo-Kategorien werden geladen...',
            title: 'CHAOS BINGO',
            subtitle: 'Mission: Gridlock',
            explain: 'Der Erklärer',
            word: 'Wort zu erklären:',
            forbidden: 'Tabu-Wörter:',
            buzzer: 'BUZZER!',
            success: 'GESCHAFFT!',
            fail: 'TABU-WORT!',
            selectCell: 'Wähle ein Feld',
            finish: 'Spiel beenden'
        },
        tr: {
            loading: 'Bingo kategorileri yükleniyor...',
            title: 'KAOS BİNGO',
            subtitle: 'Görev: Kilitlenme',
            explain: 'Açıklayıcı',
            word: 'Açıklanacak kelime:',
            forbidden: 'Yasak kelimeler:',
            buzzer: 'BUZZER!',
            success: 'BAŞARILI!',
            fail: 'YASAK KELİME!',
            selectCell: 'Bir hücre seç',
            finish: 'Oyunu Bitir'
        }
    }[language];

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setIsLoading(true);
        try {
            const cats = await api.generateBingo(language);
            setBingoCategories(cats);
            setModeratorText(language === 'de'
                ? 'Zeit für Chaos-Bingo! Wählt eine Kategorie!'
                : 'Kaos Bingo zamanı! Bir kategori seçin!'
            );
        } catch (e) {
            console.error('Failed to load bingo categories:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCellClick = async (idx: number) => {
        if (cellStatus[idx] !== 'empty' || !isAdmin) return;

        setSelectedCell(idx);
        setShowBuzzer(true);
        setBuzzed(false);

        try {
            const taboo = await api.generateTaboo(bingoCategories[idx], language);
            setCurrentTaboo(taboo);
        } catch (e) {
            console.error('Failed to generate taboo word:', e);
        }
    };

    const handleBuzz = () => {
        setBuzzed(true);
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    };

    const handleSuccess = () => {
        if (selectedCell !== null) {
            const newStatus = [...cellStatus];
            newStatus[selectedCell] = 'won';
            setCellStatus(newStatus);
            checkBingo(newStatus);
        }
        resetRound();
    };

    const handleFail = () => {
        if (selectedCell !== null) {
            const newStatus = [...cellStatus];
            newStatus[selectedCell] = 'locked';
            setCellStatus(newStatus);
        }
        resetRound();
    };

    const resetRound = () => {
        setSelectedCell(null);
        setShowBuzzer(false);
        setCurrentTaboo(null);
        setBuzzed(false);
    };

    const checkBingo = (status: ('empty' | 'won' | 'locked')[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const line of lines) {
            if (line.every(i => status[i] === 'won')) {
                setModeratorText(language === 'de'
                    ? 'BINGO! Ihr habt gewonnen! 🎉'
                    : 'BİNGO! Kazandınız! 🎉'
                );
                setTimeout(() => setPhase('LEADERBOARD'), 3000);
                return;
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-xl text-white/60">{t.loading}</p>
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

            {/* Grid */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {bingoCategories.map((cat, i) => {
                    let cellClass = 'glass border-2 border-white/10 hover:border-orange-500';

                    if (cellStatus[i] === 'won') {
                        cellClass = 'bg-green-500/30 border-2 border-green-500';
                    } else if (cellStatus[i] === 'locked') {
                        cellClass = 'bg-red-500/30 border-2 border-red-500 opacity-50';
                    } else if (selectedCell === i) {
                        cellClass = 'bg-orange-500/30 border-2 border-orange-500 ring-4 ring-orange-500/50';
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleCellClick(i)}
                            disabled={cellStatus[i] !== 'empty' || !isAdmin}
                            className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-3 text-center transition-all ${cellClass}`}
                        >
                            <span className="text-xs uppercase tracking-widest text-white/50 mb-1">
                                {i + 1}
                            </span>
                            <span className="text-sm md:text-lg font-bold leading-tight">
                                {cat}
                            </span>
                            {cellStatus[i] === 'won' && (
                                <span className="text-2xl mt-1">✓</span>
                            )}
                            {cellStatus[i] === 'locked' && (
                                <span className="text-2xl mt-1">✕</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active Round - Taboo Display */}
            {showBuzzer && currentTaboo && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Taboo Card */}
                    <div className="flex-1 glass p-6 rounded-3xl border-2 border-pink-500/30">
                        <h3 className="text-pink-500 font-titan text-xl mb-4">{t.explain}</h3>

                        <div className="bg-white/5 rounded-2xl p-4 mb-4">
                            <span className="text-xs uppercase text-white/40 mb-1 block">{t.word}</span>
                            <div className="text-3xl font-bold text-white">{currentTaboo.word}</div>
                        </div>

                        <div>
                            <span className="text-xs uppercase text-red-500 font-bold block mb-2">{t.forbidden}</span>
                            <div className="flex flex-wrap gap-2">
                                {currentTaboo.forbidden.map((w, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold line-through"
                                    >
                                        {w}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Buzzer / Controls */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        {!buzzed ? (
                            <button
                                onClick={handleBuzz}
                                className="w-40 h-40 md:w-56 md:h-56 bg-red-600 rounded-full shadow-[0_0_50px_rgba(220,38,38,0.5)] flex items-center justify-center border-8 border-red-900 active:scale-95 transition-transform"
                            >
                                <span className="text-white font-titan text-2xl md:text-3xl">{t.buzzer}</span>
                            </button>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="text-3xl text-red-400 font-titan animate-pulse">
                                    🚨 BUZZED! 🚨
                                </div>
                            </div>
                        )}

                        {isAdmin && (
                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={handleSuccess}
                                    className="px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-full"
                                >
                                    {t.success}
                                </button>
                                <button
                                    onClick={handleFail}
                                    className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-full"
                                >
                                    {t.fail}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* No cell selected hint */}
            {!showBuzzer && isAdmin && (
                <div className="text-center text-white/40 text-lg">
                    ☝️ {t.selectCell}
                </div>
            )}

            {/* Finish button */}
            {isAdmin && (
                <div className="mt-8 text-center">
                    <button
                        onClick={() => setPhase('LEADERBOARD')}
                        className="glass px-8 py-3 rounded-full text-white/60 hover:text-white hover:border-white/50 transition-colors"
                    >
                        {t.finish}
                    </button>
                </div>
            )}
        </div>
    );
};

export default BingoGame;
