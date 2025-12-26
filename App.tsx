import React, { useState, useEffect } from 'react';
import { useGameStore, api, GamePhase, Language } from './src/stores/gameStore';
import Settings from './src/components/Settings';
import AdminLogin from './src/components/AdminLogin';
import AdminLobby from './src/components/AdminLobby';
import CategorySelect from './src/components/CategorySelect';
import PlayerJoin from './src/components/PlayerJoin';
import QuizGame from './src/components/QuizGame';
import BingoGame from './src/components/BingoGame';
import Leaderboard from './src/components/Leaderboard';
import Moderator from './components/Moderator';

const TRANSLATIONS = {
  de: {
    title: 'SILVESTER PARTY',
    subtitle: 'Pub Quiz & Chaos Bingo',
    players: 'Spieler',
    admin: 'Admin',
    player: 'Spieler',
    settings: 'Einstellungen',
    disconnect: 'Getrennt',
    connected: 'Verbunden',
    finished: 'Party beendet!',
    thanks: 'Danke fürs Spielen! 🎉',
    newGame: 'Neue Party starten',
    break: 'PAUSE',
    breakText: 'Kurze Verschnaufpause!'
  },
  tr: {
    title: 'YILBAŞI PARTİSİ',
    subtitle: 'Pub Quiz & Kaos Bingo',
    players: 'Oyuncular',
    admin: 'Admin',
    player: 'Oyuncu',
    settings: 'Ayarlar',
    disconnect: 'Bağlantı Kesildi',
    connected: 'Bağlandı',
    finished: 'Parti Bitti!',
    thanks: 'Oynadığınız için teşekkürler! 🎉',
    newGame: 'Yeni Parti Başlat',
    break: 'MOLA',
    breakText: 'Kısa mola!'
  }
};

const App: React.FC = () => {
  const {
    session,
    role,
    setRole,
    hasApiKey,
    setHasApiKey,
    isAuthenticated,
    setIsAuthenticated,
    moderatorText,
    setModeratorText,
    connect,
    isConnected,
    setSession,
    reset
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'login' | 'admin' | 'player'>('home');

  const language = (session?.language || 'de') as Language;
  const t = TRANSLATIONS[language];

  // Check URL for join code
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/join\/([A-Z0-9]+)/i);
    if (match) {
      setJoinCode(match[1].toUpperCase());
      setView('player');
    }
  }, []);

  // Initialize
  useEffect(() => {
    connect();
    checkApiKey();
    checkAuth();
  }, []);

  const checkApiKey = async () => {
    try {
      const has = await api.checkApiKey();
      setHasApiKey(has);
    } catch (e) {
      console.error('Failed to check API key:', e);
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      const valid = await api.verifyAdmin(token);
      if (valid) {
        setIsAuthenticated(true);
        setRole('admin');
      } else {
        localStorage.removeItem('adminToken');
      }
    }
  };

  const handleStartAdmin = () => {
    if (isAuthenticated) {
      setRole('admin');
      setView('admin');
    } else {
      setView('login');
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setRole('admin');
    setView('admin');
  };

  const handleStartGame = () => {
    if (session) {
      const { socket } = useGameStore.getState();
      if (socket) {
        socket.emit('start-game', session.id);
      }
    }
  };

  const handleCategoriesSelected = async (categoryIds: string[]) => {
    if (session) {
      await api.selectCategories(session.id, categoryIds);
    }
  };

  const handleNewGame = () => {
    reset();
    setView('home');
    window.history.pushState({}, '', '/');
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setRole('player');
    reset();
    setView('home');
  };

  const isAdmin = role === 'admin';
  const phase = session?.phase || 'LOBBY';
  console.log('🎯 [App.tsx] Current phase:', phase, '| session?.phase:', session?.phase);

  // Render game content based on phase
  const renderGameContent = () => {
    if (phase === 'FINISHED') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="text-8xl mb-6">🎊</div>
          <h1 className="text-4xl font-titan text-pink-500 neon-glow mb-4">{t.finished}</h1>
          <p className="text-xl text-cyan-400 mb-8">{t.thanks}</p>
          {isAdmin && (
            <button
              onClick={handleNewGame}
              className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-titan text-xl rounded-full"
            >
              {t.newGame}
            </button>
          )}
        </div>
      );
    }

    // Note: BREAK phase is handled inside QuizGame component with the 3-minute timer

    switch (phase) {
      case 'LOBBY':
        return isAdmin ? (
          <AdminLobby onStartGame={handleStartGame} />
        ) : (
          joinCode && <PlayerJoin joinCode={joinCode} />
        );
      case 'CATEGORY_SELECT':
        return (
          <CategorySelect
            isAdmin={isAdmin}
            onCategoriesSelected={handleCategoriesSelected}
          />
        );
      case 'QUIZ':
        return <QuizGame isAdmin={isAdmin} />;
      case 'BINGO':
        return <BingoGame isAdmin={isAdmin} />;
      case 'LEADERBOARD':
        return <Leaderboard />;
      default:
        return null;
    }
  };

  // Home view (role selection)
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="mb-10">
        <h1 className="text-5xl md:text-7xl font-titan neon-glow text-pink-500 mb-2">
          🎉 {t.title}
        </h1>
        <p className="text-xl text-cyan-400">{t.subtitle}</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <button
          onClick={handleStartAdmin}
          className="w-full py-5 bg-yellow-400 hover:bg-yellow-300 text-black font-titan text-xl rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          📺 {t.admin} (Host)
        </button>

        <div className="glass p-4 rounded-2xl">
          <p className="text-white/60 text-sm mb-3">
            {language === 'de' ? 'Oder tritt mit einem Code bei:' : 'Veya bir kod ile katıl:'}
          </p>
          <input
            type="text"
            placeholder={language === 'de' ? 'Code eingeben...' : 'Kod gir...'}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center font-mono text-xl uppercase tracking-widest placeholder-white/30 focus:outline-none focus:border-cyan-400"
            maxLength={6}
            onChange={(e) => {
              const code = e.target.value.toUpperCase();
              if (code.length === 6) {
                window.location.href = `/join/${code}`;
              }
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative pb-24">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 bg-pink-500 rounded-lg transform rotate-12 flex items-center justify-center font-titan text-xl cursor-pointer"
            onClick={() => view !== 'home' && handleNewGame()}
          >
            S
          </div>
          <span className="font-titan text-lg hidden md:inline">{t.title}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="glass px-3 py-2 rounded-full flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-white/60">
              {isConnected ? t.connected : t.disconnect}
            </span>
          </div>

          {/* Player count */}
          {session && (
            <div className="glass px-3 py-2 rounded-full text-xs text-white/60">
              {session.teams.length} {t.players}
            </div>
          )}

          {/* Logout button for admin */}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="glass px-3 py-2 rounded-full text-xs text-red-400 hover:bg-red-500/20"
            >
              Logout
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className="glass p-2 rounded-full hover:bg-white/10 transition-colors"
            title={t.settings}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {view === 'home' && renderHome()}
        {view === 'login' && <AdminLogin onSuccess={handleLoginSuccess} />}
        {view === 'admin' && renderGameContent()}
        {view === 'player' && joinCode && (
          phase === 'LOBBY' ? <PlayerJoin joinCode={joinCode} /> : renderGameContent()
        )}
      </main>

      {/* Moderator TTS - only on admin device when TTS is enabled */}
      {isAdmin && session?.ttsEnabled && moderatorText && (
        <Moderator
          text={moderatorText}
          lang={language}
          onFinished={() => setModeratorText('')}
        />
      )}

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default App;
