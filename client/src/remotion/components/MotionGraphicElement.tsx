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
    case 'glassMorphCard':
      return <GlassMorphCard frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'deviceMockup':
      return <DeviceMockup frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'meshGradientBg':
      return <MeshGradientBg frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'heroGradientText':
      return <HeroGradientText frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'featureShowcase':
      return <FeatureShowcase frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'floatingMockup':
      return <FloatingMockup frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
    case 'sweepingLight':
      return <SweepingLight frame={localFrame} fps={fps} progress={progress} mg={mg} />;
    case 'animatedUnderline':
      return <AnimatedUnderline frame={localFrame} fps={fps} progress={progress} mg={mg} x={x} y={y} />;
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

// ─── Neon Frame (Cinematic with animated corners) ─────────────────────────────
const NeonFrame: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#00ffff', '#6366f1'];
  const color = colors[0];
  const color2 = colors[1] || color;
  const pulse = Math.sin(frame * 0.06) * 0.2 + 0.8;
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const cornerSize = interpolate(frame, [0, 25], [0, 40], { extrapolateRight: 'clamp' });
  const sweep = (frame * 3) % 400;

  return (
    <div style={{ position: 'absolute', inset: '2.5%', pointerEvents: 'none', opacity: fadeIn }}>
      {/* Outer glow border */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${color}33`,
          borderRadius: 20,
          boxShadow: `0 0 40px ${color}22, 0 0 80px ${color}11`,
        }}
      />
      {/* Inner bright border */}
      <div
        style={{
          position: 'absolute',
          inset: 4,
          border: `2px solid ${color}`,
          borderRadius: 16,
          opacity: pulse,
          boxShadow: `0 0 15px ${color}, 0 0 30px ${color}88, inset 0 0 20px ${color}22`,
        }}
      />
      {/* Animated corner accents */}
      {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: cornerSize,
            height: cornerSize,
            borderTop: pos.top !== undefined ? `3px solid ${color2}` : 'none',
            borderBottom: pos.bottom !== undefined ? `3px solid ${color2}` : 'none',
            borderLeft: pos.left !== undefined ? `3px solid ${color2}` : 'none',
            borderRight: pos.right !== undefined ? `3px solid ${color2}` : 'none',
            boxShadow: `0 0 10px ${color2}`,
          }}
        />
      ))}
      {/* Sweeping light effect along border */}
      <div
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: `${(sweep / 400) * 100}%`,
            width: 60,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            filter: `blur(2px)`,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
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

// ─── Particle Background (Cinematic bokeh-style) ──────────────────────────────
const ParticleBackground: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#6366f1', '#22d3ee'];
  const color1 = colors[0];
  const color2 = colors[1] || colors[0];
  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

  // Large bokeh orbs (depth layer 1 — slow, big, blurry)
  const bokeh = Array.from({ length: 12 }, (_, i) => {
    const seed = i * 137.508;
    const baseX = (seed * 7.3) % 100;
    const baseY = (seed * 13.7) % 100;
    const size = 40 + (seed % 80);
    const speed = 0.15 + (i % 3) * 0.05;
    const xDrift = Math.sin(frame * 0.01 + seed) * 8;
    const yDrift = (frame * speed * 0.3) % 140;
    const opacity = 0.06 + Math.sin(frame * 0.03 + i * 0.7) * 0.04;
    const c = i % 2 === 0 ? color1 : color2;
    return { x: baseX + xDrift, y: (baseY + yDrift) % 140 - 20, size, opacity, color: c };
  });

  // Small sharp particles (depth layer 2 — fast, tiny, bright)
  const particles = Array.from({ length: 40 }, (_, i) => {
    const seed = (i + 50) * 97.31;
    const baseX = (seed * 5.1) % 100;
    const baseY = (seed * 11.3) % 100;
    const speed = 0.4 + (seed % 1) * 0.3;
    const size = 1.5 + (seed % 3);
    const yOffset = (frame * speed * 0.6) % 130;
    const opacity = 0.15 + Math.sin(frame * 0.06 + i) * 0.12;
    const c = i % 3 === 0 ? color2 : color1;
    return { x: baseX, y: (baseY + yOffset) % 130 - 15, size, opacity, color: c };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: fadeIn }}>
      {/* Bokeh layer */}
      {bokeh.map((p, i) => (
        <div
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.color}44 0%, transparent 70%)`,
            opacity: p.opacity,
            filter: 'blur(8px)',
          }}
        />
      ))}
      {/* Sharp particles */}
      {particles.map((p, i) => (
        <div
          key={`p${i}`}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
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

// ─── Kinetic Text (Cinematic 3D spring-animated word reveal) ──────────────────
const KineticText: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'Kinetic Typography';
  const words = text.includes('|') ? text.split('|') : text.split(' ');
  const colors = mg.customColors || ['#ffffff', '#6366f1'];
  const sc = mg.springConfig || { mass: 1, damping: 12, stiffness: 100 };
  const staggerFrames = 5;

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
        gap: '4px 14px',
        maxWidth: '85%',
        perspective: mg.perspective || 1200,
      }}
    >
      {words.map((word, i) => {
        const delay = i * staggerFrames;
        const localFrame = Math.max(0, frame - delay);
        const s = spring({ frame: localFrame, fps, config: { damping: sc.damping || 12, stiffness: sc.stiffness || 100, mass: sc.mass || 1 }, durationInFrames: 22 });
        const yOff = interpolate(s, [0, 1], [50, 0]);
        const rotX = interpolate(s, [0, 1], [40, 0]);
        const blur = interpolate(s, [0, 1], [6, 0]);
        const isAccent = i % 3 === 1;
        const accentColor = colors[1] || '#6366f1';

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translateY(${yOff}px) rotateX(${rotX}deg) scale(${0.85 + s * 0.15})`,
              filter: `blur(${blur}px)`,
              color: isAccent ? accentColor : (colors[0] || '#ffffff'),
              fontSize: 60,
              fontWeight: 900,
              fontFamily: 'Inter, sans-serif',
              textShadow: isAccent
                ? `0 0 30px ${accentColor}, 0 0 60px ${accentColor}66, 0 4px 20px rgba(0,0,0,0.5)`
                : '0 4px 30px rgba(0,0,0,0.5), 0 0 10px rgba(255,255,255,0.1)',
              letterSpacing: '-0.02em',
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

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM TEMPLATES — Cinematic SaaS / Motion Graphics Quality
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Glass Morphism Card (frosted glass with backdrop blur) ──────────────────
const GlassMorphCard: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'Feature Title|Description of the feature goes here';
  const lines = text.split('|');
  const colors = mg.customColors || ['#6366f1', '#ffffff', '#a855f7'];
  const sc = mg.springConfig || { mass: 1, damping: 14, stiffness: 160 };
  const s = spring({ frame, fps, config: { damping: sc.damping || 14, stiffness: sc.stiffness || 160, mass: sc.mass || 1 }, durationInFrames: 28 });
  const yOff = interpolate(s, [0, 1], [60, 0]);
  const rotY = interpolate(s, [0, 1], [15, 0]);
  const shimmer = Math.sin(frame * 0.04) * 0.15 + 0.85;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) perspective(1200px) rotateY(${rotY}deg) translateY(${yOff}px)`,
        opacity: s,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          border: `1px solid rgba(255,255,255,${0.12 * shimmer})`,
          borderRadius: 20,
          padding: '32px 40px',
          minWidth: 340,
          maxWidth: 500,
          boxShadow: `0 24px 80px rgba(0,0,0,0.4), 0 0 40px ${colors[0]}22, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
      >
        {/* Accent line at top */}
        <div
          style={{
            width: interpolate(s, [0, 1], [0, 60]),
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${colors[0]}, ${colors[2] || colors[0]})`,
            marginBottom: 20,
            boxShadow: `0 0 12px ${colors[0]}`,
          }}
        />
        <div style={{ color: colors[1] || '#ffffff', fontSize: 28, fontWeight: 800, fontFamily: 'Inter, sans-serif', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          {lines[0]}
        </div>
        {lines[1] && (
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, fontWeight: 400, fontFamily: 'Inter, sans-serif', marginTop: 10, lineHeight: 1.5 }}>
            {lines[1]}
          </div>
        )}
        {lines[2] && (
          <div style={{ color: colors[0], fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif', marginTop: 16, textTransform: 'uppercase' as const, letterSpacing: 2 }}>
            {lines[2]}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Device Mockup (3D perspective floating device frame) ────────────────────
const DeviceMockup: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'App Preview';
  const colors = mg.customColors || ['#1e1e2e', '#6366f1', '#ffffff'];
  const sc = mg.springConfig || { mass: 1.2, damping: 16, stiffness: 120 };
  const s = spring({ frame, fps, config: { damping: sc.damping || 16, stiffness: sc.stiffness || 120, mass: sc.mass || 1.2 }, durationInFrames: 35 });
  const rotY = interpolate(s, [0, 1], [-25, 8 + Math.sin(frame * 0.02) * 3]);
  const rotX = interpolate(s, [0, 1], [15, -2 + Math.sin(frame * 0.015) * 2]);
  const scaleVal = interpolate(s, [0, 1], [0.7, 0.85]);
  const floatY = Math.sin(frame * 0.03) * 8;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${floatY}px)`,
        perspective: 1600,
        opacity: s,
      }}
    >
      <div
        style={{
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scaleVal})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Device body */}
        <div
          style={{
            width: 380,
            height: 260,
            background: `linear-gradient(145deg, ${colors[0]}, #0a0a0f)`,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: 8,
            boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 60px ${colors[1]}22, 0 0 1px rgba(255,255,255,0.2)`,
          }}
        >
          {/* Screen area */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 10,
              background: `linear-gradient(135deg, ${colors[1]}15, ${colors[1]}08)`,
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Fake UI elements */}
            <div style={{ width: '70%', height: 6, borderRadius: 3, background: `${colors[1]}44`, marginBottom: 12 }} />
            <div style={{ width: '50%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 60, height: 40, borderRadius: 8, background: `${colors[1]}${i === 1 ? '33' : '15'}`, border: `1px solid ${colors[1]}22` }} />
              ))}
            </div>
            <div style={{ color: colors[2] || '#ffffff', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', marginTop: 16, opacity: 0.7 }}>
              {text}
            </div>
            {/* Screen reflection */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)`,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
        {/* Shadow underneath */}
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            left: '10%',
            width: '80%',
            height: 20,
            background: `radial-gradient(ellipse, ${colors[1]}33 0%, transparent 70%)`,
            filter: 'blur(10px)',
            transform: 'rotateX(60deg)',
          }}
        />
      </div>
    </div>
  );
};

// ─── Mesh Gradient Background (animated multi-color mesh) ────────────────────
const MeshGradientBg: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#6366f1', '#ec4899', '#06b6d4', '#000000'];
  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const t = frame * 0.008;

  const x1 = 30 + Math.sin(t) * 20;
  const y1 = 30 + Math.cos(t * 0.7) * 20;
  const x2 = 70 + Math.sin(t * 1.3 + 2) * 20;
  const y2 = 70 + Math.cos(t * 0.9 + 1) * 20;
  const x3 = 50 + Math.sin(t * 0.6 + 4) * 25;
  const y3 = 20 + Math.cos(t * 1.1 + 3) * 15;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: fadeIn * 0.7,
        background: colors[3] || '#000000',
      }}
    >
      {/* Gradient orb 1 */}
      <div style={{ position: 'absolute', left: `${x1}%`, top: `${y1}%`, width: '60%', height: '60%', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${colors[0]}66 0%, transparent 70%)`, filter: 'blur(60px)' }} />
      {/* Gradient orb 2 */}
      <div style={{ position: 'absolute', left: `${x2}%`, top: `${y2}%`, width: '50%', height: '50%', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${colors[1]}55 0%, transparent 70%)`, filter: 'blur(50px)' }} />
      {/* Gradient orb 3 */}
      <div style={{ position: 'absolute', left: `${x3}%`, top: `${y3}%`, width: '45%', height: '45%', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${colors[2]}44 0%, transparent 70%)`, filter: 'blur(55px)' }} />
      {/* Noise/grain overlay for texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03, background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
    </div>
  );
};

// ─── Hero Gradient Text (large animated gradient-filled text) ────────────────
const HeroGradientText: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'HERO TEXT';
  const words = text.includes('|') ? text.split('|') : [text];
  const colors = mg.customColors || ['#6366f1', '#ec4899', '#f59e0b'];
  const sc = mg.springConfig || { mass: 1, damping: 14, stiffness: 100 };
  const s = spring({ frame, fps, config: { damping: sc.damping || 14, stiffness: sc.stiffness || 100, mass: sc.mass || 1 }, durationInFrames: 30 });
  const gradientAngle = 90 + frame * 0.5;
  const yOff = interpolate(s, [0, 1], [80, 0]);
  const blur = interpolate(s, [0, 1], [10, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${yOff}px)`,
        opacity: s,
        filter: `blur(${blur}px)`,
        textAlign: 'center',
      }}
    >
      {words.map((word, i) => (
        <div
          key={i}
          style={{
            fontSize: i === 0 ? 80 : 48,
            fontWeight: 900,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            background: `linear-gradient(${gradientAngle}deg, ${colors[0]}, ${colors[1] || colors[0]}, ${colors[2] || colors[0]})`,
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            marginBottom: i < words.length - 1 ? 4 : 0,
          }}
        >
          {word}
        </div>
      ))}
      {/* Glow behind text */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          background: `radial-gradient(ellipse at center, ${colors[0]}22 0%, transparent 60%)`,
          filter: 'blur(30px)',
          zIndex: -1,
        }}
      />
    </div>
  );
};

// ─── Feature Showcase (staggered animated feature cards grid) ────────────────
const FeatureShowcase: React.FC<TemplateProps> = ({ frame, fps, mg }) => {
  const text = mg.customText || 'Fast|Secure|Scalable|Beautiful';
  const features = text.split('|');
  const colors = mg.customColors || ['#6366f1', '#ffffff', '#1e1e2e'];
  const stagger = 8;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 8%',
        flexWrap: 'wrap',
      }}
    >
      {features.slice(0, 6).map((feat, i) => {
        const delay = i * stagger;
        const localFrame = Math.max(0, frame - delay);
        const s = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 140 }, durationInFrames: 25 });
        const yOff = interpolate(s, [0, 1], [40, 0]);
        const icons = ['⚡', '🔒', '📈', '✨', '🎯', '🚀'];

        return (
          <div
            key={i}
            style={{
              opacity: s,
              transform: `translateY(${yOff}px) scale(${0.9 + s * 0.1})`,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '24px 28px',
              minWidth: 140,
              textAlign: 'center',
              boxShadow: `0 12px 40px rgba(0,0,0,0.3), 0 0 20px ${colors[0]}11`,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{icons[i] || '✦'}</div>
            <div style={{ color: colors[1] || '#ffffff', fontSize: 16, fontWeight: 700, fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
              {feat}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Floating Mockup (3D floating card with glow) ────────────────────────────
const FloatingMockup: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 50 }) => {
  const text = mg.customText || 'Product Name|Your tagline here';
  const lines = text.split('|');
  const colors = mg.customColors || ['#6366f1', '#ffffff', '#0f0f1a'];
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 100, mass: 1.2 }, durationInFrames: 35 });
  const floatY = Math.sin(frame * 0.025) * 10;
  const rotY = 5 + Math.sin(frame * 0.02) * 5;
  const rotX = -3 + Math.cos(frame * 0.015) * 3;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) translateY(${floatY}px)`,
        perspective: 1400,
        opacity: s,
      }}
    >
      <div
        style={{
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${interpolate(s, [0, 1], [0.8, 1])})`,
          background: `linear-gradient(145deg, ${colors[2] || '#0f0f1a'}, #000)`,
          borderRadius: 24,
          padding: '40px 48px',
          minWidth: 400,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 80px ${colors[0]}15, 0 0 1px rgba(255,255,255,0.15)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Internal glow */}
        <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '60%', height: '60%', background: `radial-gradient(circle, ${colors[0]}20 0%, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: colors[1] || '#ffffff', fontSize: 36, fontWeight: 800, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {lines[0]}
          </div>
          {lines[1] && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: 400, fontFamily: 'Inter, sans-serif', marginTop: 12, lineHeight: 1.5 }}>
              {lines[1]}
            </div>
          )}
          {lines[2] && (
            <div style={{ display: 'inline-block', marginTop: 20, background: colors[0], color: '#ffffff', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif', boxShadow: `0 4px 20px ${colors[0]}44` }}>
              {lines[2]}
            </div>
          )}
        </div>
        {/* Reflection line at top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
      </div>
    </div>
  );
};

// ─── Sweeping Light (cinematic light streak across screen) ───────────────────
const SweepingLight: React.FC<TemplateProps> = ({ frame, mg }) => {
  const colors = mg.customColors || ['#ffffff', '#6366f1'];
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const sweepPos = interpolate(frame, [0, 60], [-30, 130], { extrapolateRight: 'clamp' });
  const secondSweep = interpolate(frame, [15, 75], [-30, 130], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: fadeIn }}>
      {/* Primary light streak */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: `${sweepPos}%`,
          width: '8%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${colors[0]}15, ${colors[0]}30, ${colors[0]}15, transparent)`,
          transform: 'skewX(-15deg)',
          filter: 'blur(8px)',
        }}
      />
      {/* Secondary thinner streak */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: `${secondSweep}%`,
          width: '3%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${colors[1] || colors[0]}20, ${colors[1] || colors[0]}40, ${colors[1] || colors[0]}20, transparent)`,
          transform: 'skewX(-15deg)',
          filter: 'blur(4px)',
        }}
      />
      {/* Horizontal lens flare */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: `${sweepPos - 5}%`,
          width: '20%',
          height: 2,
          background: `linear-gradient(90deg, transparent, ${colors[0]}44, transparent)`,
          filter: 'blur(2px)',
          opacity: sweepPos > 0 && sweepPos < 100 ? 0.6 : 0,
        }}
      />
    </div>
  );
};

// ─── Animated Underline (expanding accent underline for text) ────────────────
const AnimatedUnderline: React.FC<TemplateProps> = ({ frame, fps, mg, x = 50, y = 60 }) => {
  const text = mg.customText || 'Highlighted Text';
  const colors = mg.customColors || ['#6366f1', '#ffffff', '#ec4899'];
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 25 });
  const lineWidth = interpolate(s, [0, 1], [0, 100]);
  const textOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const glow = Math.sin(frame * 0.06) * 0.3 + 0.7;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: colors[1] || '#ffffff',
          fontSize: 48,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          opacity: textOpacity,
          letterSpacing: '-0.01em',
        }}
      >
        {text}
      </div>
      {/* Animated underline */}
      <div
        style={{
          width: `${lineWidth}%`,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${colors[0]}, ${colors[2] || colors[0]})`,
          margin: '8px auto 0',
          boxShadow: `0 0 ${12 * glow}px ${colors[0]}, 0 0 ${24 * glow}px ${colors[0]}44`,
        }}
      />
    </div>
  );
};

export default MotionGraphicElement;
