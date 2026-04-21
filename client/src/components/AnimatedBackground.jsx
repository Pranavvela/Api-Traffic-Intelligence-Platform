import React from 'react';

// eslint-disable-next-line react/prop-types

export default function AnimatedBackground() {
  const twinkles = [
    { top: '12%', left: '18%', size: 4, delay: '0.2s' },
    { top: '20%', left: '62%', size: 3, delay: '1.1s' },
    { top: '28%', left: '78%', size: 5, delay: '0.5s' },
    { top: '42%', left: '26%', size: 3, delay: '1.6s' },
    { top: '52%', left: '70%', size: 4, delay: '0.9s' },
    { top: '64%', left: '12%', size: 3, delay: '1.3s' },
    { top: '72%', left: '48%', size: 4, delay: '0.4s' },
    { top: '80%', left: '82%', size: 3, delay: '1.8s' },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl animate-float" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl animate-[float_16s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl animate-[float_20s_ease-in-out_infinite]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_20%_85%,rgba(129,140,248,0.14),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.1),transparent_45%)] opacity-80" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(148,163,184,0.08),transparent_55%)] opacity-60" />

      {twinkles.map((twinkle, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-sky-100/90 shadow-[0_0_12px_rgba(56,189,248,0.9)] mix-blend-screen animate-particle"
          style={{
            top: twinkle.top,
            left: twinkle.left,
            width: twinkle.size,
            height: twinkle.size,
            animationDelay: twinkle.delay,
          }}
        />
      ))}
    </div>
  );
}
