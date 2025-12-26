import React, { useEffect, useState } from 'react';
import { useGameStore, Language } from '../stores/gameStore';

interface Category {
    id: string;
    nameDE: string;
    nameTR: string;
    icon: string;
}

interface CategorySelectProps {
    isAdmin: boolean;
    onCategoriesSelected: (categoryIds: string[]) => void;
}

const API_URL = 'http://localhost:3001';

const CategorySelect: React.FC<CategorySelectProps> = ({ isAdmin, onCategoriesSelected }) => {
    const { session, socket } = useGameStore();
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const language = (session?.language || 'de') as Language;
    const t = {
        de: {
            title: 'KATEGORIEN WÄHLEN',
            subtitle: 'Wähle mindestens 1 Kategorie',
            selected: 'ausgewählt',
            start: 'SPIEL STARTEN',
            waiting: 'Warte auf Host...',
            selectMin: 'Wähle mind. 1 Kategorie'
        },
        tr: {
            title: 'KATEGORİ SEÇ',
            subtitle: 'En az 1 kategori seç',
            selected: 'seçildi',
            start: 'OYUNU BAŞLAT',
            waiting: 'Host bekleniyor...',
            selectMin: 'En az 1 kategori seç'
        }
    }[language];

    useEffect(() => {
        loadCategories();
        setupSocketListeners();
    }, []);

    const setupSocketListeners = () => {
        if (!socket) return;

        // Listen for real-time category selection updates from host
        socket.on('category-toggled', ({ categoryId, isSelected }: { categoryId: string; isSelected: boolean }) => {
            setSelectedIds(prev => {
                if (isSelected) {
                    return prev.includes(categoryId) ? prev : [...prev, categoryId];
                } else {
                    return prev.filter(id => id !== categoryId);
                }
            });
        });
    };

    const loadCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/api/categories`);
            const data = await res.json();
            setCategories(data);
        } catch (e) {
            console.error('Failed to load categories:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCategory = (id: string) => {
        if (!isAdmin) return;

        const isCurrentlySelected = selectedIds.includes(id);

        if (isCurrentlySelected) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            // No maximum limit - can select any number of categories
            setSelectedIds([...selectedIds, id]);
        }

        // Broadcast to all players in real-time
        if (socket && session) {
            socket.emit('toggle-category', {
                sessionId: session.id,
                categoryId: id,
                isSelected: !isCurrentlySelected
            });
        }
    };

    const handleStart = () => {
        // Require at least 1 category
        if (selectedIds.length >= 1) {
            onCategoriesSelected(selectedIds);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="text-center mb-8">
                <h2 className="text-4xl font-titan text-pink-500 neon-glow mb-2">{t.title}</h2>
                <p className="text-white/60">{t.subtitle}</p>
                <div className="mt-4 inline-block glass px-6 py-2 rounded-full">
                    <span className={selectedIds.length >= 1 ? 'text-green-400' : 'text-yellow-400'}>
                        {selectedIds.length} {t.selected}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {categories.map((cat) => {
                    const isSelected = selectedIds.includes(cat.id);
                    const canSelect = isAdmin; // No limit on selection

                    return (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            disabled={!isAdmin}
                            className={`relative p-4 rounded-2xl text-center transition-all ${isSelected
                                ? 'bg-pink-500/30 border-2 border-pink-500 ring-4 ring-pink-500/30'
                                : 'glass border-2 border-white/10 hover:border-pink-500/50'
                                } ${!isAdmin ? 'cursor-default' : ''} ${!canSelect && !isSelected ? 'opacity-50' : ''}`}
                        >
                            <div className="text-4xl mb-2">{cat.icon}</div>
                            <div className="text-sm font-bold">
                                {language === 'de' ? cat.nameDE : cat.nameTR}
                            </div>
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
                                    {selectedIds.indexOf(cat.id) + 1}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {isAdmin ? (
                <button
                    onClick={handleStart}
                    disabled={selectedIds.length < 1}
                    className={`w-full py-5 font-titan text-xl rounded-full transition-all ${selectedIds.length >= 1
                        ? 'bg-green-500 hover:bg-green-400 text-white shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    {selectedIds.length >= 1 ? `🚀 ${t.start}` : t.selectMin}
                </button>
            ) : (
                <div className="text-center glass p-4 rounded-xl">
                    <div className="animate-pulse flex items-center justify-center gap-2 text-yellow-400">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                        <span>{t.waiting}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategorySelect;
