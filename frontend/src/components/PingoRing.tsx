import React from "react";
import { motion } from "framer-motion";

type Props = {
  size?: number;
  color?: string;
  isHolding?: boolean;
};

export default function PingoRing({
  size = 220,
  color = "#1F4DFF",
  isHolding = false,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;  // Outer radius
  
  // Calculate arc length
  const c = 2 * Math.PI * r;
  const visible = 0.82 * c;  // How much of circle is visible
  const gap = c - visible;

  return (
    <motion.svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      initial={{ scale: 0.2 }}
      animate={{ 
        scale: isHolding ? 1 : 0.2,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.8
      }}
    >
      {/* Rotating arc */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={Math.max(10, size * 0.05)}
        strokeDasharray={`${visible} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        animate={{ rotate: isHolding ? 360 : 0 }}
        transition={{
          rotate: {
            duration: 1.6,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop"
          }
        }}
        style={{
          transformOrigin: "50% 50%",
          transformBox: "fill-box"
        }}
      />

      {/* Inner circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.8}
        fill={color}
      />
    </motion.svg>
  );
}