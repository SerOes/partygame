import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';

interface AdminLoginProps {
    onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
    const { setRole } = useGameStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login fehlgeschlagen');
            }

            localStorage.setItem('adminToken', data.token);
            setRole('admin');
            onSuccess();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
            <div className="glass rounded-3xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="text-5xl mb-4">🎤</div>
                    <h1 className="text-3xl font-titan text-pink-500 mb-2">HOST LOGIN</h1>
                    <p className="text-white/60 text-sm">Melde dich an, um das Spiel zu moderieren</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">Passwort</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-pink-500"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-600 text-black font-titan text-xl rounded-full transition-all"
                    >
                        {isLoading ? 'Anmelden...' : 'ANMELDEN'}
                    </button>
                </form>

                <p className="text-center text-white/40 text-xs mt-6">
                    Nur für Hosts. Spieler können ohne Login beitreten.
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
