import React, { useEffect, useState } from 'react';

interface ConfettiProps {
    duration?: number;
    particleCount?: number;
}

interface Particle {
    id: number;
    x: number;
    color: string;
    delay: number;
    size: number;
}

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#1dd1a1', '#ff9500', '#5f27cd'];

const Confetti: React.FC<ConfettiProps> = ({ duration = 5000, particleCount = 100 }) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Generate particles
        const newParticles: Particle[] = [];
        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                delay: Math.random() * 2,
                size: Math.random() * 8 + 4
            });
        }
        setParticles(newParticles);

        // Hide after duration
        const timer = setTimeout(() => setVisible(false), duration);
        return () => clearTimeout(timer);
    }, [duration, particleCount]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="confetti"
                    style={{
                        left: `${p.x}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        animationDelay: `${p.delay}s`,
                        borderRadius: Math.random() > 0.5 ? '50%' : '0'
                    }}
                />
            ))}
        </div>
    );
};

export default Confetti;
