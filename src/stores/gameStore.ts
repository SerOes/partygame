import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export type Language = 'de' | 'tr';
export type GamePhase = 'LOBBY' | 'GAME_SELECT' | 'LOBBY_DRAFT' | 'CATEGORY_SELECT' | 'QUIZ' | 'BREAK' | 'BINGO' | 'LEADERBOARD' | 'FINISHED';
export type UserRole = 'admin' | 'player';

export interface Team {
    id: string;
    realName: string;
    secretName: string;
    score: number;
    avatar?: string;
    isHost?: boolean;
    faction?: 'A' | 'B' | null; // Team A (Red) or Team B (Blue)
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    categoryId: string;
    questionIndex: number;
}

export interface TabooWord {
    word: string;
    forbidden: string[];
}

export interface GameSession {
    id: string;
    joinCode: string;
    language: Language;
    phase: GamePhase;
    currentRound: number;
    currentQuestion: number;
    currentCategory: number;
    selectedCategories: string;
    gameType: string;
    ttsEnabled: boolean;
    showAnswers: boolean;
    teams: Team[];
}

interface GameState {
    socket: Socket | null;
    isConnected: boolean;
    session: GameSession | null;
    role: UserRole;
    currentTeamId: string | null;
    isAuthenticated: boolean;
    hasApiKey: boolean;
    currentQuestion: QuizQuestion | null;
    timer: number;
    bingoCategories: string[];
    currentTaboo: TabooWord | null;
    moderatorText: string;

    connect: () => void;
    disconnect: () => void;
    setSession: (session: GameSession) => void;
    setRole: (role: UserRole) => void;
    setCurrentTeamId: (teamId: string) => void;
    setHasApiKey: (hasKey: boolean) => void;
    setIsAuthenticated: (isAuth: boolean) => void;
    setCurrentQuestion: (question: QuizQuestion | null) => void;
    setTimer: (timer: number) => void;
    setBingoCategories: (categories: string[]) => void;
    setCurrentTaboo: (taboo: TabooWord | null) => void;
    setModeratorText: (text: string) => void;
    updateTeamScore: (teamId: string, score: number) => void;
    addTeam: (team: Team) => void;
    setPhase: (phase: GamePhase, teams?: Team[]) => void;
    reset: () => void;
}

const API_URL = 'http://localhost:3001';

export const useGameStore = create<GameState>((set, get) => ({
    socket: null,
    isConnected: false,
    session: null,
    role: 'player',
    currentTeamId: null,
    isAuthenticated: false,
    hasApiKey: false,
    currentQuestion: null,
    timer: 60,
    bingoCategories: [],
    currentTaboo: null,
    moderatorText: '',

    connect: () => {
        const socket = io(API_URL);

        socket.on('connect', () => {
            set({ isConnected: true });
            console.log('Connected to server');
        });

        socket.on('disconnect', () => {
            set({ isConnected: false });
            console.log('Disconnected from server');
        });

        socket.on('team-joined', ({ team }: { team: Team }) => {
            const { session } = get();
            if (session) {
                // Check if team already exists to prevent duplicates
                const existingTeam = session.teams.find((t: Team) => t.id === team.id);
                if (!existingTeam) {
                    set({ session: { ...session, teams: [...session.teams, team] } });
                }
            }
        });

        // Listen for team updates (faction changes during Team Draft)
        socket.on('teams-updated', ({ teams }: { teams: Team[] }) => {
            const { session } = get();
            if (session) {
                console.log('📡 [gameStore] Teams updated with factions:', teams.map(t => `${t.realName}: ${t.faction}`));
                set({ session: { ...session, teams } });
            }
        });

        socket.on('game-started', () => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, phase: 'CATEGORY_SELECT' } });
            }
        });

        socket.on('categories-selected', ({ categoryIds }: { categoryIds: string[] }) => {
            const { session } = get();
            if (session) {
                set({
                    session: {
                        ...session,
                        selectedCategories: JSON.stringify(categoryIds),
                        phase: 'QUIZ'
                    }
                });
            }
        });

        socket.on('question-changed', ({ questionIndex }: { questionIndex: number }) => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, currentQuestion: questionIndex }, timer: 60 });
            }
        });

        socket.on('break-started', ({ duration }: { duration: number }) => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, phase: 'BREAK' }, timer: duration });
            }
        });

        socket.on('break-ended', () => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, phase: 'QUIZ' } });
            }
        });

        socket.on('category-changed', ({ categoryIndex }: { categoryIndex: number }) => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, currentCategory: categoryIndex, currentQuestion: 0 } });
            }
        });

        socket.on('tts-toggled', ({ enabled }: { enabled: boolean }) => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, ttsEnabled: enabled } });
            }
        });

        socket.on('answers-revealed', ({ teams }: { teams?: Team[] }) => {
            console.log('📣 [gameStore] answers-revealed event received with teams:', teams?.length);
            const { session } = get();
            if (session) {
                console.log('📣 [gameStore] Setting phase to LEADERBOARD, current phase:', session.phase);
                // Update both phase and teams with fresh score data
                set({
                    session: {
                        ...session,
                        showAnswers: true,
                        phase: 'LEADERBOARD',
                        teams: teams || session.teams  // Use fresh teams if provided
                    }
                });
                console.log('📣 [gameStore] Phase updated to LEADERBOARD with fresh team scores');
            } else {
                console.log('❌ [gameStore] No session found in answers-revealed handler');
            }
        });

        socket.on('phase-changed', ({ phase }: { phase: GamePhase }) => {
            const { session } = get();
            if (session) {
                set({ session: { ...session, phase } });
            }
        });

        socket.on('score-updated', ({ teamId, score }: { teamId: string; score: number }) => {
            const { session } = get();
            if (session) {
                const teams = session.teams.map(t =>
                    t.id === teamId ? { ...t, score } : t
                );
                set({ session: { ...session, teams } });
            }
        });

        set({ socket });
    },

    disconnect: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false });
        }
    },

    setSession: (session: GameSession) => {
        const { socket } = get();
        if (socket && session) {
            socket.emit('join-session', session.joinCode);
        }
        set({ session });
    },

    setRole: (role: UserRole) => set({ role }),
    setCurrentTeamId: (currentTeamId: string) => set({ currentTeamId }),
    setHasApiKey: (hasApiKey: boolean) => set({ hasApiKey }),
    setIsAuthenticated: (isAuthenticated: boolean) => set({ isAuthenticated }),
    setCurrentQuestion: (currentQuestion: QuizQuestion | null) => set({ currentQuestion }),
    setTimer: (timer: number) => set({ timer }),
    setBingoCategories: (bingoCategories: string[]) => set({ bingoCategories }),
    setCurrentTaboo: (currentTaboo: TabooWord | null) => set({ currentTaboo }),
    setModeratorText: (moderatorText: string) => set({ moderatorText }),

    updateTeamScore: (teamId: string, score: number) => {
        const { session, socket } = get();
        if (session && socket) {
            socket.emit('update-score', { teamId, score, sessionId: session.id });
        }
    },

    addTeam: (team: Team) => {
        const { session } = get();
        if (session) {
            set({ session: { ...session, teams: [...session.teams, team] } });
        }
    },

    setPhase: (phase: GamePhase, teams?: Team[]) => {
        const { session, socket } = get();
        if (session) {
            // Immediately update local session phase (and optionally teams) to trigger React re-render
            console.log('📣 [gameStore.setPhase] Updating phase from', session.phase, 'to', phase, teams ? `with ${teams.length} teams` : 'without teams');
            const updatedSession = teams
                ? { ...session, phase, teams }  // Update both phase and teams
                : { ...session, phase };         // Only update phase
            set({ session: updatedSession });
            // Also notify server (for persistence)
            if (socket) {
                socket.emit('change-phase', { sessionId: session.id, phase });
            }
        }
    },

    reset: () => set({
        session: null,
        currentTeamId: null,
        currentQuestion: null,
        timer: 60,
        bingoCategories: [],
        currentTaboo: null,
        moderatorText: ''
    })
}));

// API helper functions
export const api = {
    async checkApiKey(): Promise<boolean> {
        const res = await fetch(`${API_URL}/api/settings/apikey/status`);
        const data = await res.json();
        return data.hasKey;
    },

    async saveApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
        const res = await fetch(`${API_URL}/api/settings/apikey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        return res.json();
    },

    async adminLogin(email: string, password: string): Promise<{ token: string; admin: { id: string; email: string } } | null> {
        const res = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) return null;
        return res.json();
    },

    async verifyAdmin(token: string): Promise<boolean> {
        const res = await fetch(`${API_URL}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.ok;
    },

    async createSession(language: Language): Promise<GameSession> {
        const res = await fetch(`${API_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language })
        });
        return res.json();
    },

    async getSession(joinCode: string): Promise<GameSession | null> {
        const res = await fetch(`${API_URL}/api/sessions/${joinCode}`);
        if (!res.ok) return null;
        return res.json();
    },

    async joinSession(joinCode: string, realName: string, isHost: boolean = false): Promise<Team | null> {
        const res = await fetch(`${API_URL}/api/sessions/${joinCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ realName, isHost })
        });
        if (!res.ok) return null;
        return res.json();
    },

    async selectCategories(sessionId: string, categoryIds: string[]): Promise<GameSession> {
        const res = await fetch(`${API_URL}/api/sessions/${sessionId}/select-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryIds })
        });
        return res.json();
    },

    async toggleTTS(sessionId: string, enabled: boolean): Promise<void> {
        await fetch(`${API_URL}/api/sessions/${sessionId}/toggle-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
    },

    async getResults(sessionId: string): Promise<GameSession> {
        const res = await fetch(`${API_URL}/api/sessions/${sessionId}/results`);
        return res.json();
    },

    async generateRoast(teams: Team[], language: Language): Promise<string> {
        const res = await fetch(`${API_URL}/api/ai/roast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teams, language })
        });
        const data = await res.json();
        return data.text;
    },

    async generateTTS(text: string, language: Language): Promise<string | null> {
        const res = await fetch(`${API_URL}/api/ai/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, language })
        });
        const data = await res.json();
        return data.audio;
    }
};
