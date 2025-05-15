import React from 'react';

interface FlipCardProps {
  /** Rotation in degrees (0–180) */
  rotation: number;
  /** What to render on the front face */
  frontContent: React.ReactNode;
  /** What to render on the back face */
  backContent: React.ReactNode;
}

/**
 * A simple 3D CSS flip‐card for the web.
 */
const FlipCard: React.FC<FlipCardProps> = ({
  rotation,
  frontContent,
  backContent,
}) => {
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transform: `perspective(1000px) rotateY(${rotation}deg)`,
    transition: 'transform 0.5s ease-out',
  };
  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    backfaceVisibility: 'hidden',
  };
  const backStyle: React.CSSProperties = {
    ...faceStyle,
    transform: 'rotateY(180deg)',
  };

  return (
    <div style={containerStyle}>
      <div style={faceStyle}>{frontContent}</div>
      <div style={backStyle}>{backContent}</div>
    </div>
  );
};

export default FlipCard;
