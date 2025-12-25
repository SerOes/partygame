
export type Language = 'de' | 'tr';

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface BingoCell {
  category: string;
  claimedBy?: string; // Player ID
}

export type GameView = 'LOBBY' | 'QUIZ' | 'BINGO' | 'LEADERBOARD';

export interface GameState {
  view: GameView;
  language: Language;
  players: Player[];
  currentRound: number;
  isModeratorSpeaking: boolean;
}

export const TRANSLATIONS = {
  de: {
    title: "SILVESTER PARTY",
    subtitle: "Pub Quiz & Chaos Bingo",
    startGame: "SPIEL STARTEN",
    join: "Beitreten",
    next: "Nächste Frage",
    buzz: "BUZZER DRÜCKEN!",
    leaderboard: "Bestenliste",
    question: "Frage",
    round: "Runde",
    score: "Punkte",
    submit: "ABSENDEN",
    loading: "Moderator bereitet sich vor...",
    settings: "Einstellungen",
    playerRole: "Spieler",
    hostRole: "Moderator (Hauptgerät)",
  },
  tr: {
    title: "YILBAŞI PARTİSİ",
    subtitle: "Pub Quiz & Kaos Bingo",
    startGame: "OYUNU BAŞLAT",
    join: "Katıl",
    next: "Sıradaki Soru",
    buzz: "BUTONA BAS!",
    leaderboard: "Liderlik Tablosu",
    question: "Soru",
    round: "Tur",
    score: "Puan",
    submit: "GÖNDER",
    loading: "Sunucu hazırlanıyor...",
    settings: "Ayarlar",
    playerRole: "Oyuncu",
    hostRole: "Sunucu (Ana Ekran)",
  }
};
