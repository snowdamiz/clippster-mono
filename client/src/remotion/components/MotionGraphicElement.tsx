import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface MotionGraphicElementProps {
  track: AIVideoTrack;
}

export const MotionGraphicElement: React.FC<MotionGraphicElementProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mg = track.properties.motionGraphic;

  if (!mg) return null;

  const trackStartFrame = track.startTime * fps;
  const trackEndFrame = track.endTime * fps;

  // Only render if current frame is within track bounds
  if (frame < trackStartFrame || frame > trackEndFrame) {
    return null;
  }

  const localFrame = frame - trackStartFrame;
  const trackDuration = (track.endTime - track.startTime) * fps;
  const progress = Math.min(localFrame / trackDuration, 1);

  const x = typeof track.properties.x === 'number' ? track.properties.x : 50;
  const y = typeof track.properties.y === 'number' ? track.properties.y : 50;

  switch (mg.templateId) {
    case 'lowerThird':
      return <LowerThird frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'subscribeCTA':
      return <SubscribeCTA frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'titleCard':
      return <TitleCard frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'endScreen':
      return <EndScreen frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'numberCounter':
      return <NumberCounter frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'neonFrame':
      return <NeonFrame frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'logoReveal':
      return <LogoReveal frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'particleBackground':
      return <ParticleBackground frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'progressBar':
      return <ProgressBar frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'timerCountdown':
      return <TimerCountdown frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'kineticText':
      return <KineticText frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'animatedInfoCard':
      return <AnimatedInfoCard frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'dataCounter':
      return <DataCounter frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'calloutBox':
      return <CalloutBox frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'splitReveal':
      return <SplitReveal frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'glitchTitle':
      return <GlitchTitle frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'gradientWave':
      return <GradientWave frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'floatingBadge':
      return <FloatingBadge frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'animatedDivider':
      return <AnimatedDivider frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'spotlightReveal':
      return <SpotlightReveal frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    default:
      return null;
  }
};

// Shared props for all templates
interface TemplateProps {
  frame: number;
  fps: number;
  progress: number;
  mg: NonNullable<AIVideoTrack['properties']['motionGraphic']>;
  x?: number;
  y?: number;
}

// ─── Lower Third ───────────────────────────────────────────────────────────────
const LowerThird: React.FC<TemplateProps> = ({ frame, fps, mg, x = 10, y = 80 }) => {
  const speed = mg.animationSpeed || 1;
  const enterFrames = Math.round(15 / speed);
  const slideIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: enterFrames });
  const colors = mg.customColors || ['#6366f1', '#ffffff'];
  const text = mg.customText || 'Lower Third';
  const lines = text.split('|');

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translateX(${interpolate(slideIn, [0, 1], [-120, 0])}%)`,
        opacity: slideIn,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          background: colors[0],
          padding: '8px 24px',
          borderRadius: '4px 4px 0 0',
          color: colors[1] || '#ffffff',
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {lines[0] || text}
      </div>
      {lines[1] && (
        <div
          style={{
            background: 'rgba(0,0,0,0.7)',
            padding: '4px 24px',
            borderRadius: '0 0 4px 4px',
            color: '#cccccc',
            fontSize: 18,
            fontWeight: 400,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {lines[1]}
        </div>
      )}
    </div>
  );
};

// ─── Subscribe CTA ─────────────────────────────────────────────────────────────
const SubscribeCTA: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const speed = mg.animationSpeed || 1;
  const bounce = spring({ frame, fps, config: { damping: 120, stiffness: 200 }, durationInFrames: Math.round(20 / speed) });
  const colors = mg.customColors || ['#ef4444', '#ffffff'];
  const text = mg.customText || 'SUBSCRIBE';
  const pulse = Math.sin(frame * 0.1) * 0.03 + 1;

  return (
    <div
      style={{
        position: 'absolute',
        right: '5%',
        bottom: '12%',
        transform: `scale(${bounce * pulse})`,
        opacity: bounce,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: colors[0],
        padding: '12px 28px',
        borderRadius: 8,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill={colors[1] || '#fff'}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span
        style={{
          color: colors[1] || '#ffffff',
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ─── Title Card ────────────────────────────────────────────────────────────────
const TitleCard: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const speed = mg.animationSpeed || 1;
  const fadeIn = interpolate(frame, [0, Math.round(20 / speed)], [0, 1], { extrapolateRight: 'clamp' });
  const scaleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(25 / speed) });
  const colors = mg.customColors || ['rgba(0,0,0,0.8)', '#ffffff'];
  const text = mg.customText || 'Title';
  const lines = text.split('|');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors[0],
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          transform: `scale(${scaleIn})`,
          color: colors[1] || '#ffffff',
          fontSize: 64,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {lines[0] || text}
      </div>
      {lines[1] && (
        <div
          style={{
            transform: `scale(${scaleIn})`,
            color: colors[1] || '#ffffff',
            fontSize: 28,
            fontWeight: 400,
            fontFamily: 'Inter, sans-serif',
            opacity: 0.7,
            marginTop: 12,
          }}
        >
          {lines[1]}
        </div>
      )}
    </div>
  );
};

// ─── End Screen ────────────────────────────────────────────────────────────────
const EndScreen: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const speed = mg.animationSpeed || 1;
  const fadeIn = interpolate(frame, [0, Math.round(15 / speed)], [0, 1], { extrapolateRight: 'clamp' });
  const colors = mg.customColors || ['rgba(0,0,0,0.85)', '#ffffff', '#6366f1'];
  const text = mg.customText || 'Thanks for watching!|Subscribe for more';
  const lines = text.split('|');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors[0],
        opacity: fadeIn,
        gap: 24,
      }}
    >
      <div
        style={{
          color: colors[1] || '#ffffff',
          fontSize: 48,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
        }}
      >
        {lines[0]}
      </div>
      {lines[1] && (
        <div
          style={{
            background: colors[2] || '#6366f1',
            color: '#ffffff',
            padding: '14px 40px',
            borderRadius: 12,
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {lines[1]}
        </div>
      )}
    </div>
  );
};

// ─── Number Counter ────────────────────────────────────────────────────────────
const NumberCounter: React.FC<TemplateProps> = ({ frame, fps, progress, mg, x = 50, y = 50 }) => {
  const text = mg.customText || '1000';
  const targetNum = parseInt(text.replace(/[^0-9]/g, ''), 10) || 1000;
  const currentNum = Math.round(targetNum * Math.min(progress * 1.5, 1));
  const colors = mg.customColors || ['#fbbf24', '#ffffff'];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        opacity: fadeIn,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: colors[0],
          fontSize: 72,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}
      >
        {currentNum.toLocaleString()}
      </div>
      {text.replace(/[0-9,]/g, '').trim() && (
        <div
          style={{
            color: colors[1] || '#ffffff',
            fontSize: 24,
            fontWeight: 500,
            opacity: 0.8,
          }}
        >
          {text.replace(/[0-9,]/g, '').trim()}
        </div>
      )}
    </div>
  );
};

// ─── Neon Frame ────────────────────────────────────────────────────────────────
const NeonFrame: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#00ffff'];
  const color = colors[0];
  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        inset: '3%',
        border: `3px solid ${color}`,
        borderRadius: 16,
        opacity: fadeIn * pulse,
        boxShadow: `0 0 15px ${color}, 0 0 30px ${color}, inset 0 0 15px ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── Logo Reveal ───────────────────────────────────────────────────────────────
const LogoReveal: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const speed = mg.animationSpeed || 1;
  const scaleIn = spring({ frame, fps, config: { damping: 150, stiffness: 180 }, durationInFrames: Math.round(25 / speed) });
  const text = mg.customText || 'LOGO';
  const colors = mg.customColors || ['#ffffff', '#6366f1'];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scaleIn})`,
          opacity: scaleIn,
          color: colors[0],
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          textShadow: `0 0 40px ${colors[1]}, 0 0 80px ${colors[1]}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── Particle Background ───────────────────────────────────────────────────────
const ParticleBackground: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#ffffff'];
  const color = colors[0];
  const particles = Array.from({ length: 30 }, (_, i) => {
    const seed = i * 137.508;
    const baseX = (seed * 7.3) % 100;
    const baseY = (seed * 13.7) % 100;
    const speed = 0.3 + (seed % 1);
    const size = 2 + (seed % 4);
    const yOffset = (frame * speed * 0.5) % 120;
    const opacity = 0.2 + (Math.sin(frame * 0.05 + i) * 0.15 + 0.15);

    return { x: baseX, y: (baseY + yOffset) % 120 - 10, size, opacity };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: color,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
};

// ─── Progress Bar ──────────────────────────────────────────────────────────────
const ProgressBar: React.FC<TemplateProps> = ({ frame, progress, mg, x = 50, y = 90 }) => {
  const colors = mg.customColors || ['#6366f1', 'rgba(255,255,255,0.2)'];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const barProgress = Math.min(progress, 1);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        width: '80%',
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 3,
          background: colors[1],
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barProgress * 100}%`,
            height: '100%',
            borderRadius: 3,
            background: colors[0],
            transition: 'width 0.1s',
          }}
        />
      </div>
    </div>
  );
};

// ─── Timer Countdown ───────────────────────────────────────────────────────────
const TimerCountdown: React.FC<TemplateProps> = ({ frame, fps, progress, mg, x = 50, y = 50 }) => {
  const text = mg.customText || '10';
  const totalSeconds = parseInt(text, 10) || 10;
  const remaining = Math.max(0, Math.ceil(totalSeconds * (1 - progress)));
  const colors = mg.customColors || ['#ffffff', '#ef4444'];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = remaining <= 3 ? Math.sin(frame * 0.3) * 0.05 + 1 : 1;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${pulse})`,
        opacity: fadeIn,
        color: remaining <= 3 ? (colors[1] || '#ef4444') : (colors[0] || '#ffffff'),
        fontSize: 80,
        fontWeight: 900,
        fontFamily: 'Inter, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 20px rgba(0,0,0,0.5)',
      }}
    >
      {display}
    </div>
  );
};

// ─── Kinetic Text (Spring-animated word-by-word reveal) ───────────────────────
const KineticText: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'Kinetic Typography';
  const words = text.split(' ');
  const colors = mg.customColors || ['#ffffff', '#6366f1'];
  const sc = mg.springConfig || { mass: 1, damping: 12, stiffness: 100 };
  const staggerFrames = 4;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 12px',
        maxWidth: '80%',
        perspective: mg.perspective || 800,
      }}
    >
      {words.map((word, i) => {
        const delay = i * staggerFrames;
        const localFrame = Math.max(0, frame - delay);
        const s = spring({ frame: localFrame, fps, config: { damping: sc.damping || 12, stiffness: sc.stiffness || 100, mass: sc.mass || 1 }, durationInFrames: 20 });
        const yOff = interpolate(s, [0, 1], [30, 0]);
        const isAccent = i % 3 === 1;

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${yOff}px) scale(${0.8 + s * 0.2})`,
              color: isAccent ? (colors[1] || '#6366f1') : (colors[0] || '#ffffff'),
              fontSize: 56,
              fontWeight: 900,
              fontFamily: 'Inter, sans-serif',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Animated Info Card (3D flip-in card) ─────────────────────────────────────
const AnimatedInfoCard: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'Info Title|Description text here';
  const lines = text.split('|');
  const colors = mg.customColors || ['#1e1e2e', '#ffffff', '#6366f1'];
  const sc = mg.springConfig || { mass: 1, damping: 15, stiffness: 200 };
  const s = spring({ frame, fps, config: { damping: sc.damping || 15, stiffness: sc.stiffness || 200, mass: sc.mass || 1 }, durationInFrames: 25 });
  const rotY = interpolate(s, [0, 1], [90, 0]);
  const perspective = mg.perspective || 1000;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        perspective,
      }}
    >
      <div
        style={{
          background: colors[0],
          border: `2px solid ${colors[2] || '#6366f1'}`,
          borderRadius: 16,
          padding: '28px 36px',
          minWidth: 300,
          transform: `rotateY(${rotY}deg)`,
          opacity: s,
          boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${colors[2]}33`,
        }}
      >
        <div style={{ color: colors[2] || '#6366f1', fontSize: 14, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
          {lines[0]}
        </div>
        {lines[1] && (
          <div style={{ color: colors[1] || '#ffffff', fontSize: 22, fontWeight: 500, lineHeight: 1.4, fontFamily: 'Inter, sans-serif' }}>
            {lines[1]}
          </div>
        )}
        {lines[2] && (
          <div style={{ color: colors[1] || '#ffffff', fontSize: 36, fontWeight: 900, marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
            {lines[2]}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Data Counter (animated number with label + progress ring) ────────────────
const DataCounter: React.FC<TemplateProps> = ({ frame, fps, progress, mg, x = 50, y = 50 }) => {
  const text = mg.customText || '95|Completion Rate|%';
  const parts = text.split('|');
  const targetNum = parseInt(parts[0], 10) || 100;
  const label = parts[1] || '';
  const suffix = parts[2] || '';
  const colors = mg.customColors || ['#22d3ee', '#ffffff', '#1e1e2e'];
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const countProgress = interpolate(frame, [10, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const currentNum = Math.round(targetNum * countProgress);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - countProgress);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        opacity: fadeIn,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="45" fill="none" stroke={`${colors[0]}22`} strokeWidth="8" />
          <circle cx="60" cy="60" r="45" fill="none" stroke={colors[0]} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: colors[1] || '#ffffff', fontSize: 32, fontWeight: 900, fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            {currentNum}{suffix}
          </span>
        </div>
      </div>
      {label && (
        <div style={{ color: colors[1] || '#ffffff', fontSize: 16, fontWeight: 600, opacity: 0.8, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
          {label}
        </div>
      )}
    </div>
  );
};

// ─── Callout Box (animated pointer callout) ───────────────────────────────────
const CalloutBox: React.FC<TemplateProps> = ({ frame, fps, mg, x = 70, y = 30 }) => {
  const text = mg.customText || 'Important!|Check this out';
  const lines = text.split('|');
  const colors = mg.customColors || ['#fbbf24', '#000000'];
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 180 }, durationInFrames: 20 });

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${s})`,
        opacity: s,
      }}
    >
      <div
        style={{
          background: colors[0],
          color: colors[1] || '#000000',
          padding: '14px 24px',
          borderRadius: 12,
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800 }}>{lines[0]}</div>
        {lines[1] && <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.8, marginTop: 4 }}>{lines[1]}</div>}
        <div
          style={{
            position: 'absolute',
            bottom: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: `10px solid ${colors[0]}`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Split Reveal (diagonal split wipe) ──────────────────────────────────────
const SplitReveal: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const colors = mg.customColors || ['#6366f1', '#ec4899'];
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 120 }, durationInFrames: 30 });
  const split = interpolate(s, [0, 1], [100, 0]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: colors[0],
          clipPath: `polygon(0 0, ${100 - split}% 0, ${100 - split - 15}% 100%, 0 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: colors[1] || '#ec4899',
          clipPath: `polygon(${100 - split}% 0, 100% 0, 100% 100%, ${100 - split - 15}% 100%)`,
        }}
      />
    </div>
  );
};

// ─── Glitch Title (glitch effect text) ────────────────────────────────────────
const GlitchTitle: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const text = mg.customText || 'GLITCH';
  const colors = mg.customColors || ['#ffffff', '#00ffff', '#ff00ff'];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const glitchActive = Math.sin(frame * 0.7) > 0.7;
  const offsetX = glitchActive ? (Math.sin(frame * 13.7) * 4) : 0;
  const offsetY = glitchActive ? (Math.cos(frame * 17.3) * 2) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      {/* Cyan offset layer */}
      <div
        style={{
          position: 'absolute',
          color: colors[1] || '#00ffff',
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          transform: `translate(${offsetX - 3}px, ${offsetY + 1}px)`,
          opacity: glitchActive ? 0.7 : 0,
          mixBlendMode: 'screen' as const,
        }}
      >
        {text}
      </div>
      {/* Magenta offset layer */}
      <div
        style={{
          position: 'absolute',
          color: colors[2] || '#ff00ff',
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          transform: `translate(${-offsetX + 3}px, ${-offsetY - 1}px)`,
          opacity: glitchActive ? 0.7 : 0,
          mixBlendMode: 'screen' as const,
        }}
      >
        {text}
      </div>
      {/* Main text */}
      <div
        style={{
          color: colors[0] || '#ffffff',
          fontSize: 80,
          fontWeight: 900,
          fontFamily: 'Inter, sans-serif',
          textShadow: '0 0 20px rgba(255,255,255,0.3)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── Gradient Wave (animated gradient background) ─────────────────────────────
const GradientWave: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#6366f1', '#ec4899', '#f59e0b'];
  const angle = (frame * 2) % 360;
  const shift = Math.sin(frame * 0.05) * 20;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${angle}deg, ${colors[0]} ${0 + shift}%, ${colors[1] || '#ec4899'} ${50 + shift}%, ${colors[2] || '#f59e0b'} 100%)`,
        opacity: 0.4,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── Floating Badge (bouncy floating label) ───────────────────────────────────
const FloatingBadge: React.FC<TemplateProps> = ({ frame, fps, mg, x = 80, y = 15 }) => {
  const text = mg.customText || 'NEW';
  const colors = mg.customColors || ['#ef4444', '#ffffff'];
  const s = spring({ frame, fps, config: { damping: 10, stiffness: 150 }, durationInFrames: 20 });
  const float = Math.sin(frame * 0.08) * 6;
  const rotate = Math.sin(frame * 0.06) * 3;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${s}) translateY(${float}px) rotate(${rotate}deg)`,
        opacity: s,
        background: colors[0],
        color: colors[1] || '#ffffff',
        padding: '8px 20px',
        borderRadius: 20,
        fontSize: 18,
        fontWeight: 800,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: 2,
        boxShadow: `0 4px 20px ${colors[0]}66`,
        textTransform: 'uppercase' as const,
      }}
    >
      {text}
    </div>
  );
};

// ─── Animated Divider (expanding line) ────────────────────────────────────────
const AnimatedDivider: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const colors = mg.customColors || ['#6366f1'];
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 100 }, durationInFrames: 25 });
  const width = interpolate(s, [0, 1], [0, 60]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ width: `${width / 2}%`, height: 3, background: `linear-gradient(90deg, transparent, ${colors[0]})`, borderRadius: 2, minWidth: 0, transition: 'none' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[0], opacity: s, boxShadow: `0 0 12px ${colors[0]}` }} />
      <div style={{ width: `${width / 2}%`, height: 3, background: `linear-gradient(90deg, ${colors[0]}, transparent)`, borderRadius: 2, minWidth: 0, transition: 'none' }} />
    </div>
  );
};

// ─── Spotlight Reveal (radial spotlight wipe) ─────────────────────────────────
const SpotlightReveal: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 80 }, durationInFrames: 40 });
  const radius = interpolate(s, [0, 1], [0, 150]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 50%, transparent ${radius}%, rgba(0,0,0,0.95) ${radius + 5}%)`,
        pointerEvents: 'none',
      }}
    />
  );
};

export default MotionGraphicElement;
