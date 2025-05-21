import React from 'react';

interface FlipCardProps {
  /** 0–180 degrees */
  rotation: number;
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
}

/**
 * A CSS‐only 3D flip card.
 * Wrap this in a container that sets width/height.
 */
const FlipCard: React.FC<FlipCardProps> = ({
  rotation,
  frontContent,
  backContent,
}) => {
  const wrapper: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transform: `perspective(1000px) rotateY(${rotation}deg)`,
    transition: 'transform 0.5s ease-out',
  };
  const face: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  };
  const backFace: React.CSSProperties = {
    ...face,
    transform: 'rotateY(180deg)',
  };

  return (
    <div style={wrapper}>
      <div style={face}>{frontContent}</div>
      <div style={backFace}>{backContent}</div>
    </div>
  );
};

export default FlipCard;
