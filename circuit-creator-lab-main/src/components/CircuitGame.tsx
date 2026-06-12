import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Gamepad2, HelpCircle, LockKeyhole, RotateCcw, Sparkles, Volume2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CIRCUIT_LEVELS, partLabels, type PartType } from "@/lib/circuit-levels";
import { simulate } from "@/lib/physics/simulationEngine";
import type { CircuitGraph, CircuitComponent, CircuitEdge } from "@/lib/physics/types";
import circuitWorld from "@/assets/circuit-world.jpg";
import voltHero from "@/assets/volt-hero.png";

function matchesTarget(board: PartType[], target: string[]) {
  return board.length === target.length && board.every((part, index) => part === target[index]);
}

function SchematicSymbol({ type, powered }: { type: PartType; powered?: boolean }) {
  const color = powered ? "stroke-primary" : "stroke-muted-foreground";
  
  switch (type) {
    case "battery":
      return (
        <svg viewBox="0 0 40 40" className={`size-8 ${color} fill-none stroke-2`}>
          <line x1="15" y1="10" x2="15" y2="30" className="stroke-[3]" />
          <line x1="25" y1="15" x2="25" y2="25" className="stroke-[1]" />
          <line x1="5" y1="20" x2="15" y2="20" />
          <line x1="25" y1="20" x2="35" y2="20" />
        </svg>
      );
    case "resistor":
      return (
        <svg viewBox="0 0 40 40" className={`size-8 ${color} fill-none stroke-2`}>
          <path d="M0 20 L8 20 L11 10 L17 30 L23 10 L29 30 L32 20 L40 20" />
        </svg>
      );
    case "led":
      return (
        <svg viewBox="0 0 40 40" className={`size-8 ${color} fill-none stroke-2`}>
          <path d="M10 10 L10 30 L30 20 Z" className={powered ? "fill-primary/20" : ""} />
          <line x1="30" y1="10" x2="30" y2="30" />
          <line x1="5" y1="20" x2="10" y2="20" />
          <line x1="30" y1="20" x2="35" y2="20" />
          <path d="M22 8 L27 3 M28 12 L33 7" className="stroke-1" />
        </svg>
      );
    case "ground":
      return (
        <svg viewBox="0 0 40 40" className={`size-8 ${color} fill-none stroke-2`}>
          <line x1="20" y1="5" x2="20" y2="20" />
          <line x1="10" y1="20" x2="30" y2="20" />
          <line x1="14" y1="26" x2="26" y2="26" />
          <line x1="18" y1="32" x2="22" y2="32" />
        </svg>
      );
    case "capacitor":
      return (
        <svg viewBox="0 0 40 40" className={`size-8 ${color} fill-none stroke-2`}>
          <line x1="16" y1="12" x2="16" y2="28" />
          <line x1="24" y1="12" x2="24" y2="28" />
          <line x1="5" y1="20" x2="16" y2="20" />
          <line x1="24" y1="20" x2="35" y2="20" />
        </svg>
      );
    default:
      return <div className="text-xs">●</div>;
  }
}

export function CircuitGame() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [unlocked, setUnlocked] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [xp, setXp] = useState(0);
  const [board, setBoard] = useState<PartType[]>([]);
  const [collected, setCollected] = useState<number[]>([]);
  const [playerX, setPlayerX] = useState(15);
  const [playerY, setPlayerY] = useState(80);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState("Components ko mission order mein board par lagao.");
  const [showHint, setShowHint] = useState(false);
  const [isPowered, setIsPowered] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [autoWalking, setAutoWalking] = useState(false);

  const level = CIRCUIT_LEVELS[levelIndex];
  const progress = useMemo(() => Math.round((completed.length / CIRCUIT_LEVELS.length) * 100), [completed]);

  const checkpointPositions = useMemo(() => {
    const corners = [
        { x: 15, y: 80 }, // Bottom Left
        { x: 15, y: 20 }, // Top Left
        { x: 85, y: 20 }, // Top Right
        { x: 85, y: 80 }  // Bottom Right
    ];
    return level.parts.map((_, index) => corners[index % corners.length]);
  }, [level.parts]);

  const selectLevel = (index: number) => {
    if (index >= unlocked) return;
    setLevelIndex(index);
    setBoard([]);
    setCollected([]);
    setPlayerX(15);
    setPlayerY(80);
    setIsPowered(false);
    setAutoWalking(false);
    setMessage("Naya mission ready. Circuit assemble karo!");
  };

  const addPart = useCallback((part: PartType, checkpointIndex?: number) => {
    if (board.length >= level.target.length) return;
    const expected = level.target[board.length];
    if (part !== expected) {
      setMessage(`Wrong pickup! Abhi ${partLabels[expected as PartType].label} chahiye.`);
      return;
    }
    setBoard((items) => [...items, part]);
    if (checkpointIndex !== undefined) setCollected((items) => [...items, checkpointIndex]);
    setMessage(`${partLabels[part].label} connected!`);
  }, [board, level.target]);

  const interact = useCallback(() => {
    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;
    checkpointPositions.forEach((pos, index) => {
      const nextDistance = Math.sqrt(Math.pow(pos.x - playerX, 2) + Math.pow(pos.y - playerY, 2));
      if (!collected.includes(index) && nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    if (nearest >= 0 && distance < 10) {
      addPart(level.parts[nearest], nearest);
    }
  }, [addPart, checkpointPositions, collected, level.parts, playerX, playerY]);

  const movePlayer = useCallback((dx: number, dy: number) => {
    setFacingLeft(dx < 0);
    setIsMoving(true);
    setPlayerX((px) => Math.min(95, Math.max(5, px + dx)));
    setPlayerY((py) => Math.min(95, Math.max(5, py + dy)));
    setTimeout(() => setIsMoving(false), 140);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft") movePlayer(-3, 0);
      if (e.key === "ArrowRight") movePlayer(3, 0);
      if (e.key === "ArrowUp") movePlayer(0, -3);
      if (e.key === "ArrowDown") movePlayer(0, 3);
      if (e.key === " " || e.key === "e") interact();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [interact, movePlayer]);

  const testCircuit = () => {
    const components: CircuitComponent[] = board.map((type, i) => ({
      id: `c-${i}`,
      type: type === 'junction' ? 'wire' : type as any,
      label: partLabels[type].label,
      position: { x: 0, y: 0 },
      value: type === 'battery' ? 9 : 220
    }));
    
    if (!components.some(c => c.type === 'ground')) {
      components.push({ id: 'gnd-auto', type: 'ground', label: 'Ground', position: { x: 0, y: 0 } });
    }

    const edges: CircuitEdge[] = components.map((c, i) => ({
      id: `e-${i}`,
      sourceId: c.id,
      targetId: components[(i + 1) % components.length].id
    }));
    
    const sim = simulate({ components, edges });

    if (!matchesTarget(board, level.target) || !sim.isValid) {
      setMessage(`Physics Fault: ${sim.faults[0]?.message || "Circuit incomplete"}`);
      setIsPowered(false);
      return;
    }

    if (!completed.includes(level.id)) {
      setCompleted((ids) => [...ids, level.id]);
      setXp((v) => v + level.reward);
    }
    setUnlocked(u => Math.max(u, levelIndex + 2));
    setIsPowered(true);
    setCurrentSpeed(sim.componentStates[0]?.currentFlow || 0.5);
    setMessage(`Mission complete! ⚡ ${sim.commentary.split('\n')[0]}`);

    if (!autoWalking) {
      setAutoWalking(true);
      let step = 0;
      const walkInterval = setInterval(() => {
        const targetPos = checkpointPositions[collected[step]];
        setPlayerX(targetPos.x);
        setPlayerY(targetPos.y);
        step = (step + 1) % collected.length;
      }, 1000);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-panel px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="size-5 text-primary" />
            <h1 className="font-display text-sm tracking-widest uppercase">CircuitSathi Quest</h1>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 font-display text-xs text-primary">{xp} XP</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[280px_1fr_310px]">
        <aside className="border-r border-border p-4 bg-panel min-h-[calc(100vh-65px)]">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Quest Map</p>
          <div className="grid gap-2">
            {CIRCUIT_LEVELS.map((item, idx) => (
              <button key={item.id} onClick={() => selectLevel(idx)} disabled={idx >= unlocked} className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${idx === levelIndex ? "border-primary bg-primary/10" : "border-border bg-surface opacity-60"}`}>
                <div className="size-8 rounded bg-muted grid place-items-center">{idx >= unlocked ? <LockKeyhole className="size-4" /> : <item.icon className="size-4" />}</div>
                <p className="text-[10px] font-display uppercase">{item.name}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="relative p-6 bg-grid overflow-hidden">
          <div className="relative z-10 h-full flex flex-col">
            <div className="mb-4">
              <p className="text-[10px] text-primary uppercase tracking-widest">Level {level.id}</p>
              <h2 className="text-2xl font-display uppercase">{level.name}</h2>
            </div>

            <div className="relative flex-1 bg-canvas border border-border rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border" style={{ backgroundImage: `url(${circuitWorld})`, backgroundSize: 'cover' }}>
                <div className="absolute inset-0 bg-black/30" />
                
                {/* 2D Path visualization */}
                {isPowered && (
                  <div className="absolute inset-[15%] border-2 border-primary/50 rounded-lg shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-pulse" />
                )}

                {level.parts.map((part, idx) => {
                  const pos = checkpointPositions[idx];
                  const isDone = collected.includes(idx);
                  return (
                    <div key={idx} className={`absolute transition-all duration-500 flex flex-col items-center gap-1`} style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                       <div className={`p-2 rounded-lg border backdrop-blur-sm ${isDone ? "border-success bg-success/20" : "border-primary/40 bg-black/60"}`}>
                         <SchematicSymbol type={part} powered={isPowered && isDone} />
                       </div>
                       <span className="text-[7px] font-bold text-white uppercase bg-black/60 px-1 rounded">{partLabels[part].label}</span>
                    </div>
                  );
                })}

                <div className={`absolute volt-player ${isMoving || autoWalking ? "volt-running" : ""}`} 
                     style={{ left: `${playerX}%`, top: `${playerY}%`, transform: 'translate(-50%, -50%)', transition: autoWalking ? "all 1s linear" : "all 0.15s linear" }}>
                  <img src={voltHero} alt="Volt" width={60} height={60} />
                </div>
              </div>

              <div className="mt-4">
                <div className="bg-black/50 p-3 rounded-xl border border-primary/20">
                  <p className="text-[9px] text-primary/60 uppercase tracking-widest mb-2">Live Schematic</p>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {board.map((p, i) => (
                      <div key={i} className="flex items-center">
                        {i > 0 && <div className={`h-0.5 w-4 ${isPowered ? "bg-primary animate-pulse" : "bg-muted"}`} />}
                        <div className="size-10 border border-primary/30 rounded flex items-center justify-center bg-panel">
                          <SchematicSymbol type={p} powered={isPowered} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`mt-3 p-2 rounded border text-xs ${isPowered ? "border-success/30 bg-success/10 text-success" : "border-border bg-panel text-muted-foreground"}`}>
                  <Sparkles className="size-4 inline mr-2" /> {message}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-l border-border p-5 bg-panel">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-6">Mission Control</p>
          <div className="border-l-2 border-primary pl-4 mb-6">
            <p className="text-xs italic leading-relaxed text-foreground">{level.description}</p>
          </div>
          <div className="grid gap-2">
            <Button variant="outline" size="sm" onClick={() => { setBoard([]); setCollected([]); setPlayerX(15); setPlayerY(80); setIsPowered(false); setAutoWalking(false); }}><RotateCcw className="size-4 mr-2" /> Reset Quest</Button>
            <Button size="sm" onClick={testCircuit} disabled={board.length < level.target.length}><Zap className="size-4 mr-2" /> Test Circuit</Button>
            <Button variant="secondary" size="sm" onClick={moveNext} disabled={!completed.includes(level.id)}>Next Level <ChevronRight className="size-4 ml-1" /></Button>
          </div>
        </aside>
      </div>
    </main>
  );
}