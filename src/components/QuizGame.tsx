import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, Language, Team } from '../stores/gameStore';

interface Category {
    id: string;
    nameDE: string;
    nameTR: string;
    icon: string;
}

interface Question {
    id: string;
    question: string;
    options: string;
    categoryId: string;
    questionIndex: number;
}

interface QuizGameProps {
    isAdmin: boolean;
}

interface Reaction {
    id: string;
    emoji: string;
    teamName: string;
}

interface Message {
    id: string;
    message: string;
    teamName: string;
}

const API_URL = 'http://localhost:3001';
const TIMER_DURATION = 60;
const BREAK_DURATION = 180;

const OPTION_COLORS = [
    'from-red-500 to-red-700',
    'from-blue-500 to-blue-700',
    'from-green-500 to-green-700',
    'from-yellow-500 to-yellow-700'
];

// Party emojis for reactions
const PARTY_EMOJIS = ['🎉', '🔥', '😂', '👏', '💀', '🎊', '❤️', '🤯', '🥳', '😱'];

// Quick message options
const QUICK_MESSAGES = [
    { de: 'Prost! 🍾', tr: 'Şerefee! 🍾' },
    { de: 'Zu einfach!', tr: 'Çok kolay!' },
    { de: 'Keine Ahnung 😅', tr: 'Hiç bilmiyorum 😅' },
    { de: 'Das war knapp!', tr: 'Kıl payı!' },
    { de: 'Ich bin der Beste!', tr: 'Ben en iyisiyim!' },
    { de: 'Glückwunsch!', tr: 'Tebrikler!' }
];

const QuizGame: React.FC<QuizGameProps> = ({ isAdmin }) => {
    const { session, socket, currentTeamId, setModeratorText } = useGameStore();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [timer, setTimer] = useState(TIMER_DURATION);
    const [isLoading, setIsLoading] = useState(true);
    const [showBreak, setShowBreak] = useState(false);
    const [breakTimer, setBreakTimer] = useState(BREAK_DURATION);
    const [currentCategoryIdx, setCurrentCategoryIdx] = useState(0);
    const [categories, setCategories] = useState<Category[]>([]);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [playerLanguage, setPlayerLanguage] = useState<Language>('de');

    // New state for features
    const [showScoreboard, setShowScoreboard] = useState(false);
    const [anonymousScores, setAnonymousScores] = useState<number[]>([]);
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [showMessageInput, setShowMessageInput] = useState(false);
    const [myTeamName, setMyTeamName] = useState('');

    const hasLoadedRef = useRef(false);

    const hostLanguage = (session?.language || 'de') as Language;

    const t = {
        de: {
            loading: 'Fragen werden geladen...',
            category: 'Kategorie',
            question: 'Frage',
            next: 'Nächste Frage',
            breakTitle: 'PAUSE',
            breakText: 'Kurze Pause - holt euch was zu trinken!',
            continue: 'WEITER',
            skipBreak: 'Pause überspringen →',
            nextCategory: 'Nächste Kategorie starten',
            finish: 'Ergebnisse zeigen',
            waiting: 'Warte auf andere...',
            speedRank: 'Platz',
            chooseLanguage: 'Sprache wählen',
            scoreboard: 'Aktuelle Punktzahlen',
            anonymous: '(Wer hat wie viel? Das bleibt geheim! 🤫)'
        },
        tr: {
            loading: 'Sorular yükleniyor...',
            category: 'Kategori',
            question: 'Soru',
            next: 'Sıradaki Soru',
            breakTitle: 'MOLA',
            breakText: 'Kısa mola - bir şeyler alın!',
            continue: 'DEVAM',
            skipBreak: 'Molayı atla →',
            nextCategory: 'Sonraki Kategoriyi Başlat',
            finish: 'Sonuçları Göster',
            waiting: 'Diğerleri bekleniyor...',
            speedRank: 'Sıra',
            chooseLanguage: 'Dil seç',
            scoreboard: 'Anlık Puanlar',
            anonymous: '(Kim ne kadar aldı? Gizli kalacak! 🤫)'
        }
    }[playerLanguage];

    const selectedCategoriesStr = session?.selectedCategories || '[]';
    const selectedCategories = JSON.parse(selectedCategoriesStr) as string[];

    useEffect(() => {
        loadCategories();
        setupSocketListeners();
        const savedLang = localStorage.getItem('playerLanguage');
        if (savedLang === 'de' || savedLang === 'tr') {
            setPlayerLanguage(savedLang);
        }
        // Get team name for reactions
        if (session?.teams && currentTeamId) {
            const myTeam = session.teams.find((t: Team) => t.id === currentTeamId);
            if (myTeam) setMyTeamName(myTeam.secretName);
        }

        // Cleanup socket listeners on unmount to prevent duplicates
        return () => {
            if (socket) {
                socket.off('answer-received');
                socket.off('question-changed');
                socket.off('break-started');
                socket.off('scores-received');
                socket.off('show-scoreboard');
                socket.off('break-ended');
                socket.off('category-changed');
                socket.off('questions-broadcast');
                socket.off('reaction-received');
                socket.off('message-received');
                socket.off('answers-revealed');
            }
        };
    }, []);

    useEffect(() => {
        if (categories.length > 0 && selectedCategories.length > 0 && !hasLoadedRef.current && isAdmin) {
            hasLoadedRef.current = true;
            loadQuestionsForCategory(selectedCategories[0]);
        }
    }, [categories.length, selectedCategoriesStr, isAdmin]);

    useEffect(() => {
        if (timer > 0 && !showBreak && !showScoreboard && questions.length > 0) {
            const interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        autoAdvance();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [timer, showBreak, showScoreboard, questions]);

    // Break timer with auto-continue
    useEffect(() => {
        if (showBreak && breakTimer > 0) {
            const interval = setInterval(() => {
                setBreakTimer((prev) => {
                    if (prev <= 1) {
                        // Auto-continue when timer reaches 0
                        if (socket && session) {
                            socket.emit('end-break', session.id);
                            // Advance to question 6 (index 5)
                            socket.emit('next-question', { sessionId: session.id, questionIndex: 5 });
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [showBreak, breakTimer]);

    // Auto-remove reactions after 3 seconds
    useEffect(() => {
        if (reactions.length > 0) {
            const timeout = setTimeout(() => {
                setReactions(prev => prev.slice(1));
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [reactions]);

    // Auto-remove messages after 4 seconds
    useEffect(() => {
        if (messages.length > 0) {
            const timeout = setTimeout(() => {
                setMessages(prev => prev.slice(1));
            }, 4000);
            return () => clearTimeout(timeout);
        }
    }, [messages]);

    const setupSocketListeners = () => {
        if (!socket) return;

        socket.on('answer-received', (data: { teamId: string; speedRank: number }) => {
            if (data.teamId === currentTeamId) {
                setMyRank(data.speedRank);
            }
        });

        socket.on('question-changed', (data: { questionIndex: number }) => {
            setCurrentIdx(data.questionIndex);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setTimer(TIMER_DURATION);
            setMyRank(null);
        });

        socket.on('break-started', () => {
            // Show scoreboard first, then break
            if (socket && session) {
                socket.emit('request-scores', session.id);
            }
            setShowScoreboard(true);
        });

        socket.on('scores-received', (data: { scores: number[] }) => {
            setAnonymousScores(data.scores.sort((a, b) => b - a));
        });

        // Show scoreboard for ALL players (broadcasted by server)
        // But only if we're not already in LEADERBOARD phase (prevents loop)
        socket.on('show-scoreboard', () => {
            const currentSession = useGameStore.getState().session;
            console.log('📊 [QuizGame] show-scoreboard event received, phase:', currentSession?.phase);
            if (currentSession?.phase !== 'LEADERBOARD') {
                console.log('📊 [QuizGame] Setting showScoreboard=true');
                setShowScoreboard(true);
            } else {
                console.log('📊 [QuizGame] BLOCKED - already in LEADERBOARD phase');
            }
        });

        socket.on('break-ended', () => {
            setShowBreak(false);
            setShowScoreboard(false);
        });

        socket.on('category-changed', (data: { categoryIndex: number }) => {
            setCurrentCategoryIdx(data.categoryIndex);
            hasLoadedRef.current = false;
            setShowScoreboard(false);
            // Clear questions and show loading for ALL players
            setQuestions([]);
            setIsLoading(true);
            setCurrentIdx(0);
            // Only host loads questions (which then broadcasts to all)
            if (isAdmin) {
                loadQuestionsForCategory(selectedCategories[data.categoryIndex]);
            }
        });

        socket.on('questions-broadcast', (data: { questions: Question[] }) => {
            console.log('Received questions via Socket:', data.questions.length);
            if (data.questions && data.questions.length > 0) {
                setQuestions(data.questions);
                setCurrentIdx(0);
                setTimer(TIMER_DURATION);
                setSelectedAnswer(null);
                setIsAnswered(false);
                setIsLoading(false);
            }
        });

        socket.on('reaction-received', (data: Reaction) => {
            setReactions(prev => [...prev, data]);
        });

        socket.on('message-received', (data: Message) => {
            setMessages(prev => [...prev, data]);
        });

        socket.on('answers-revealed', () => {
            console.log('📣 [QuizGame] answers-revealed event received');
            // Hide any overlay so App.tsx can render the Leaderboard
            setShowScoreboard(false);
            setShowBreak(false);
            // Force update isLoading to ensure proper state
            setIsLoading(false);
            console.log('📣 [QuizGame] States cleared: showScoreboard=false, showBreak=false, isLoading=false');
        });
    };

    const loadCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/api/categories`);
            const data = await res.json();
            setCategories(data);
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    };

    const toggleLanguage = () => {
        const newLang = playerLanguage === 'de' ? 'tr' : 'de';
        setPlayerLanguage(newLang);
        localStorage.setItem('playerLanguage', newLang);
    };

    const loadQuestionsForCategory = async (categoryId: string) => {
        if (!isAdmin) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/ai/generate-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session?.id,
                    categoryId,
                    language: 'both'
                })
            });
            const data = await res.json();

            if (data && data.length > 0) {
                setQuestions(data);
                setCurrentIdx(0);
                setTimer(TIMER_DURATION);
                setSelectedAnswer(null);
                setIsAnswered(false);

                if (socket && session) {
                    socket.emit('broadcast-questions', {
                        sessionId: session.id,
                        questions: data
                    });
                }

                if (session?.ttsEnabled) {
                    setModeratorText(data[0].question);
                }
            }
        } catch (e) {
            console.error('Failed to load questions:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTimeout = () => {
        setIsAnswered(true);
        if (!selectedAnswer && currentTeamId) {
            submitAnswer(-1);
        }
    };

    const autoAdvance = () => {
        if (!isAnswered) {
            handleTimeout();
        }
        setTimeout(() => {
            if (currentIdx === 4) {
                if (socket && session) {
                    socket.emit('start-break', session.id);
                }
            } else if (currentIdx < questions.length - 1) {
                const nextIdx = currentIdx + 1;
                if (socket && session) {
                    socket.emit('next-question', { sessionId: session.id, questionIndex: nextIdx });
                }
                if (isAdmin && session?.ttsEnabled && questions[nextIdx]) {
                    setModeratorText(questions[nextIdx].question);
                }
            }
        }, 1500);
    };

    const handleAnswer = (idx: number) => {
        if (isAnswered || selectedAnswer !== null) return;
        setSelectedAnswer(idx);
        setIsAnswered(true);
        submitAnswer(idx);
    };

    const submitAnswer = async (answerIndex: number) => {
        if (!currentTeamId || !questions[currentIdx]) return;
        try {
            await fetch(`${API_URL}/api/sessions/${session?.id}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: currentTeamId,
                    questionId: questions[currentIdx].id,
                    answerIndex
                })
            });
        } catch (e) {
            console.error('Failed to submit answer:', e);
        }
    };

    const handleNext = () => {
        // After question 5 (index 4) - start break
        if (currentIdx === 4) {
            if (socket && session) {
                socket.emit('start-break', session.id);
            }
        }
        // After question 10 (index 9) - end of category, show scoreboard
        else if (currentIdx === 9) {
            if (socket && session) {
                socket.emit('request-scores', session.id);
            }
            setShowScoreboard(true);
        }
        // Otherwise, go to next question
        else if (currentIdx < questions.length - 1) {
            const nextIdx = currentIdx + 1;
            if (socket && session) {
                socket.emit('next-question', { sessionId: session.id, questionIndex: nextIdx });
            }
            if (session?.ttsEnabled && questions[nextIdx]) {
                setModeratorText(questions[nextIdx].question);
            }
        }
    };

    const handleEndBreak = () => {
        if (socket && session) {
            socket.emit('end-break', session.id);
            // After break, advance to question 6 (index 5)
            const nextIdx = 5; // After break at question 5, go to question 6
            socket.emit('next-question', { sessionId: session.id, questionIndex: nextIdx });
            if (session?.ttsEnabled && questions[nextIdx]) {
                setModeratorText(questions[nextIdx].question);
            }
        }
    };

    const handleContinueFromScoreboard = () => {
        setShowScoreboard(false);
        setShowBreak(true);
        setBreakTimer(BREAK_DURATION);
    };

    const handleNextCategory = () => {
        // Immediately hide scoreboard to prevent visual loop
        setShowScoreboard(false);

        const nextCatIdx = currentCategoryIdx + 1;
        if (nextCatIdx < selectedCategories.length) {
            if (socket && session) {
                socket.emit('next-category', { sessionId: session.id, categoryIndex: nextCatIdx });
            }
        } else {
            // Last category - show final leaderboard
            console.log('🏁 Emitting reveal-answers for final leaderboard');
            if (socket && session) {
                socket.emit('reveal-answers', session.id);
            }
        }
    };

    const sendReaction = (emoji: string) => {
        if (socket && session) {
            socket.emit('send-reaction', {
                sessionId: session.id,
                emoji,
                teamName: myTeamName
            });
        }
    };

    const sendQuickMessage = (msg: { de: string; tr: string }) => {
        if (socket && session) {
            socket.emit('send-message', {
                sessionId: session.id,
                message: msg[playerLanguage],
                teamName: myTeamName
            });
        }
        setShowMessageInput(false);
    };

    const currentQuestion = questions[currentIdx];
    const currentCategory = categories.find((c) => c.id === selectedCategories[currentCategoryIdx]);

    let options: string[] = [];
    if (currentQuestion) {
        const parsedOptions = JSON.parse(currentQuestion.options);
        if (Array.isArray(parsedOptions) && parsedOptions.length > 0) {
            if (typeof parsedOptions[0] === 'object' && parsedOptions[0].de && parsedOptions[0].tr) {
                options = parsedOptions.map((opt: { de: string; tr: string }) => opt[playerLanguage]);
            } else {
                options = parsedOptions as string[];
            }
        }
    }

    const getQuestionText = () => {
        if (!currentQuestion) return '';
        try {
            const parsed = JSON.parse(currentQuestion.question);
            if (parsed.de && parsed.tr) {
                return parsed[playerLanguage];
            }
        } catch {
            // Not JSON
        }
        return currentQuestion.question;
    };

    // Anonymous scoreboard after category
    if (showScoreboard) {
        // Determine if this is end of category (after Q10) or mid-category (after Q5)
        const isEndOfCategory = currentIdx === 9;
        const isLastCategory = currentCategoryIdx >= selectedCategories.length - 1;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="glass rounded-3xl p-8 max-w-md w-full">
                    <div className="text-6xl mb-4">🏆</div>
                    <h2 className="text-3xl font-titan text-yellow-400 mb-2">{t.scoreboard}</h2>
                    <p className="text-white/50 text-sm mb-2">{t.anonymous}</p>
                    {isEndOfCategory && (
                        <p className="text-cyan-400 text-sm mb-4">
                            ✅ Kategorie {currentCategoryIdx + 1}/{selectedCategories.length} abgeschlossen!
                        </p>
                    )}

                    <div className="space-y-3 mb-8">
                        {anonymousScores.map((score, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center justify-between p-4 rounded-xl ${idx === 0 ? 'bg-yellow-500/30 border border-yellow-500' :
                                    idx === 1 ? 'bg-gray-400/30 border border-gray-400' :
                                        idx === 2 ? 'bg-orange-600/30 border border-orange-600' :
                                            'bg-white/10'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                                    </span>
                                    <span className="text-xl">???</span>
                                </div>
                                <span className="text-2xl font-titan text-cyan-400">{score} pts</span>
                            </div>
                        ))}
                    </div>

                    {isAdmin && (
                        <>
                            {isEndOfCategory ? (
                                // After Q10 - either next category or final leaderboard
                                <button
                                    onClick={handleNextCategory}
                                    className={`w-full py-4 font-titan text-xl rounded-full ${isLastCategory
                                        ? 'bg-pink-500 hover:bg-pink-400 text-white'
                                        : 'bg-green-500 hover:bg-green-400 text-white'
                                        }`}
                                >
                                    {isLastCategory ? '🏁 Endergebnis anzeigen!' : `→ Kategorie ${currentCategoryIdx + 2} starten`}
                                </button>
                            ) : (
                                // After Q5 - go to break
                                <button
                                    onClick={handleContinueFromScoreboard}
                                    className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                                >
                                    → {t.continue}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Break screen with bigger timer
    if (showBreak) {
        const mins = Math.floor(breakTimer / 60);
        const secs = breakTimer % 60;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="glass rounded-3xl p-8 max-w-md w-full">
                    <div className="text-6xl mb-4">☕</div>
                    <h2 className="text-3xl font-titan text-yellow-400 mb-4">{t.breakTitle}</h2>
                    <p className="text-white/60 mb-4">{t.breakText}</p>

                    {/* Big countdown timer */}
                    <div className={`text-7xl font-titan mb-4 ${breakTimer < 30 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {mins}:{secs.toString().padStart(2, '0')}
                    </div>

                    <p className="text-white/40 text-sm mb-8">
                        {playerLanguage === 'de'
                            ? 'Spiel geht automatisch weiter wenn Timer abläuft'
                            : 'Zamanlayıcı bittiğinde oyun otomatik devam eder'}
                    </p>

                    {isAdmin && (
                        <button
                            onClick={handleEndBreak}
                            className="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-titan text-xl rounded-full"
                        >
                            {t.skipBreak}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Loading
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-xl text-white/60">{t.loading}</p>

                {!isAdmin && (
                    <div className="mt-8">
                        <p className="text-sm text-white/40 mb-2">{t.chooseLanguage}</p>
                        <button
                            onClick={toggleLanguage}
                            className="glass px-6 py-3 rounded-full flex items-center gap-2 hover:bg-white/10"
                        >
                            <span className="text-2xl">{playerLanguage === 'de' ? '🇩🇪' : '🇹🇷'}</span>
                            <span className="font-bold">{playerLanguage.toUpperCase()}</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Category complete
    if (currentIdx >= questions.length && questions.length > 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="glass rounded-3xl p-8 max-w-md w-full">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-titan text-green-400 mb-4">
                        {currentCategory?.icon} {playerLanguage === 'de' ? currentCategory?.nameDE : currentCategory?.nameTR}
                    </h2>
                    <p className="text-white/60 mb-8">
                        {playerLanguage === 'de' ? 'Kategorie abgeschlossen!' : 'Kategori tamamlandı!'}
                    </p>
                    {isAdmin && (
                        <button
                            onClick={handleNextCategory}
                            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-titan text-xl rounded-full"
                        >
                            {currentCategoryIdx < selectedCategories.length - 1 ? t.nextCategory : t.finish}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 relative">
            {/* Floating reactions */}
            <div className="fixed top-20 right-4 space-y-2 z-50 pointer-events-none">
                {reactions.map((r) => (
                    <div
                        key={r.id}
                        className="animate-slide-in-right bg-black/60 rounded-full px-4 py-2 flex items-center gap-2"
                    >
                        <span className="text-3xl animate-bounce">{r.emoji}</span>
                        <span className="text-sm text-white/70">{r.teamName}</span>
                    </div>
                ))}
            </div>

            {/* Floating messages */}
            <div className="fixed top-20 left-4 space-y-2 z-50 pointer-events-none max-w-[200px]">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className="animate-slide-in-left bg-purple-600/80 rounded-xl px-4 py-2"
                    >
                        <div className="text-xs text-white/60">{m.teamName}</div>
                        <div className="text-sm font-bold">{m.message}</div>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-6 glass p-4 rounded-2xl">
                <div className="text-cyan-400">
                    <span className="text-xs uppercase tracking-widest">{t.category}</span>
                    <div className="text-lg font-bold flex items-center gap-2">
                        <span>{currentCategory?.icon}</span>
                        <span>{currentCategoryIdx + 1}/{selectedCategories.length}</span>
                    </div>
                </div>

                {!isAdmin && (
                    <button
                        onClick={toggleLanguage}
                        className="glass px-3 py-1 rounded-full text-sm"
                    >
                        {playerLanguage === 'de' ? '🇩🇪' : '🇹🇷'}
                    </button>
                )}

                <div className={`text-4xl font-titan ${timer < 10 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                    {timer}s
                </div>

                <div className="text-pink-500 text-right">
                    <span className="text-xs uppercase tracking-widest">{t.question}</span>
                    <div className="text-lg font-bold">{currentIdx + 1}/10</div>
                </div>
            </div>

            {/* Question */}
            <div className="glass rounded-2xl p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-bold leading-tight text-center">
                    {getQuestionText()}
                </h2>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {options.map((opt, i) => {
                    let optionClass = `bg-gradient-to-r ${OPTION_COLORS[i]}`;
                    if (isAnswered) {
                        if (i === selectedAnswer) {
                            optionClass = 'bg-white/30 ring-4 ring-white';
                        } else {
                            optionClass += ' opacity-40';
                        }
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleAnswer(i)}
                            disabled={isAnswered}
                            className={`relative min-h-[70px] md:min-h-[80px] rounded-2xl p-4 text-lg font-bold flex items-center justify-center transition-all ${optionClass} ${!isAnswered ? 'hover:scale-105 active:scale-95' : ''}`}
                        >
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
                                {String.fromCharCode(65 + i)}
                            </span>
                            <span className="ml-6">{opt}</span>
                        </button>
                    );
                })}
            </div>

            {/* Emoji reaction bar */}
            <div className="glass rounded-xl p-3 mb-4">
                <div className="flex justify-center gap-2 flex-wrap">
                    {PARTY_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => sendReaction(emoji)}
                            className="text-2xl hover:scale-125 transition-transform active:scale-90 p-1"
                        >
                            {emoji}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowMessageInput(!showMessageInput)}
                        className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                        💬
                    </button>
                </div>

                {/* Quick messages */}
                {showMessageInput && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {QUICK_MESSAGES.map((msg, idx) => (
                            <button
                                key={idx}
                                onClick={() => sendQuickMessage(msg)}
                                className="bg-purple-600/50 hover:bg-purple-500 px-3 py-1 rounded-full text-sm"
                            >
                                {msg[playerLanguage]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Answer feedback */}
            {isAnswered && (
                <div className="text-center space-y-4">
                    <div className="glass rounded-xl p-4 inline-block">
                        <span className="text-green-400 font-bold">✓ {playerLanguage === 'de' ? 'Antwort gespeichert' : 'Cevap kaydedildi'}</span>
                    </div>

                    {isAdmin && (
                        <div>
                            <button
                                onClick={handleNext}
                                className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-titan text-xl rounded-full transition-all"
                            >
                                {t.next}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuizGame;
