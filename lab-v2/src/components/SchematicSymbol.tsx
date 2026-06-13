import React from "react";
import type { PartType } from "@/lib/circuit-levels";

interface SchematicSymbolProps {
  type: PartType;
  powered?: boolean;
  fault?: boolean;
  className?: string;
  size?: number;
}

export const SchematicSymbol: React.FC<SchematicSymbolProps> = ({
  type,
  powered = false,
  fault = false,
  className = "",
  size = 40,
}) => {
  const color = fault ? "#ef4444" : powered ? "#ffd700" : "#94a3b8";
  const strokeWidth = 2;

  const renderSymbol = () => {
    switch (type) {
      case "battery":
        return (
          <g>
            <line x1="5" y1="20" x2="15" y2="20" stroke={color} strokeWidth={strokeWidth} />
            <line x1="15" y1="10" x2="15" y2="30" stroke={color} strokeWidth={strokeWidth + 1} />
            <line x1="20" y1="15" x2="20" y2="25" stroke={color} strokeWidth={strokeWidth} />
            <line x1="25" y1="10" x2="25" y2="30" stroke={color} strokeWidth={strokeWidth + 1} />
            <line x1="30" y1="15" x2="30" y2="25" stroke={color} strokeWidth={strokeWidth} />
            <line x1="30" y1="20" x2="40" y2="20" stroke={color} strokeWidth={strokeWidth} />
          </g>
        );
      case "resistor":
        return (
          <polyline
            points="0,20 8,20 12,12 18,28 22,12 28,28 32,20 40,20"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      case "led":
        return (
          <g>
            <line x1="0" y1="20" x2="15" y2="20" stroke={color} strokeWidth={strokeWidth} />
            <polygon points="15,12 15,28 28,20" fill={powered ? color : "none"} stroke={color} strokeWidth={strokeWidth} />
            <line x1="28" y1="12" x2="28" y2="28" stroke={color} strokeWidth={strokeWidth} />
            <line x1="28" y1="20" x2="40" y2="20" stroke={color} strokeWidth={strokeWidth} />
            {powered && (
              <>
                <line x1="22" y1="8" x2="28" y2="2" stroke={color} strokeWidth="1.5" />
                <line x1="28" y1="8" x2="34" y2="2" stroke={color} strokeWidth="1.5" />
              </>
            )}
          </g>
        );
      case "capacitor":
        return (
          <g>
            <line x1="0" y1="20" x2="17" y2="20" stroke={color} strokeWidth={strokeWidth} />
            <line x1="17" y1="10" x2="17" y2="30" stroke={color} strokeWidth={strokeWidth + 1} />
            <line x1="23" y1="10" x2="23" y2="30" stroke={color} strokeWidth={strokeWidth + 1} />
            <line x1="23" y1="20" x2="40" y2="20" stroke={color} strokeWidth={strokeWidth} />
          </g>
        );
      case "junction":
        return <circle cx="20" cy="20" r="4" fill={color} />;
      case "ground":
        return (
          <g>
            <line x1="20" y1="5" x2="20" y2="25" stroke={color} strokeWidth={strokeWidth} />
            <line x1="10" y1="25" x2="30" y2="25" stroke={color} strokeWidth={strokeWidth} />
            <line x1="14" y1="31" x2="26" y2="31" stroke={color} strokeWidth={strokeWidth} />
            <line x1="18" y1="37" x2="22" y2="37" stroke={color} strokeWidth={strokeWidth} />
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      style={{ overflow: "visible" }}
    >
      {renderSymbol()}
    </svg>
  );
};
