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
  const [playerX, setPlayerX] = useState(8);
  const [facingLeft, setFacingLeft] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [message, setMessage] = useState("Components ko mission order mein board par lagao.");
  const [showHint, setShowHint] = useState(false);
  const [isPowered, setIsPowered] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [autoWalking, setAutoWalking] = useState(false);

  const level = CIRCUIT_LEVELS[levelIndex];
  const progress = useMemo(() => Math.round((completed.length / CIRCUIT_LEVELS.length) * 100), [completed]);
  const current = board.length;

  const selectLevel = (index: number) => {
    if (index >= unlocked) return;
    setLevelIndex(index);
    setBoard([]);
    setCollected([]);
    setPlayerX(8);
    setShowHint(false);
    setIsPowered(false);
    setAutoWalking(false);
    setMessage("Naya mission ready. Circuit assemble karo!");
  };

  const addPart = useCallback((part: PartType, checkpointIndex?: number) => {
    if (board.length >= level.target.length) return;
    const expected = level.target[board.length];
    if (part !== expected) {
      setMessage(`Wrong pickup! Abhi ${partLabels[expected as PartType].label} chahiye — doosra checkpoint dhundo.`);
      return;
    }
    setBoard((items) => [...items, part]);
    if (checkpointIndex !== undefined) setCollected((items) => [...items, checkpointIndex]);
    setMessage(`${partLabels[part].label} connected — ${board.length + 1}/${level.target.length}`);
  }, [board, level.target]);

  const checkpointPositions = useMemo(
    () => level.parts.map((_, index) => 20 + index * (68 / Math.max(1, level.parts.length - 1))),
    [level.parts],
  );

  const interact = useCallback(() => {
    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;
    checkpointPositions.forEach((position, index) => {
      const nextDistance = Math.abs(position - playerX);
      if (!collected.includes(index) && nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    if (nearest < 0 || distance > 8) {
      setMessage("Checkpoint ke paas jao, phir SPACE ya E dabao.");
      return;
    }
    const part = level.parts[nearest];
    if (part) addPart(part, nearest);
  }, [addPart, checkpointPositions, collected, level.parts, playerX]);

  const movePlayer = useCallback((amount: number) => {
    setFacingLeft(amount < 0);
    setIsMoving(true);
    setPlayerX((position) => Math.min(93, Math.max(4, position + amount)));
    window.setTimeout(() => setIsMoving(false), 140);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") movePlayer(-3);
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") movePlayer(3);
      if (event.key === " " || event.key.toLowerCase() === "e") interact();
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
      value: type === 'battery' ? 9 : (type === 'resistor' ? 220 : undefined)
    }));
    
    if (!components.some(c => c.type === 'ground')) {
      components.push({ id: 'gnd-auto', type: 'ground', label: 'Ground', position: { x: 0, y: 0 } });
    }

    const edges: CircuitEdge[] = [];
    for (let i = 0; i < components.length - 1; i++) {
        edges.push({ id: `e-${i}`, sourceId: components[i].id, targetId: components[i + 1].id });
    }
    
    const graph: CircuitGraph = { components, edges };
    const sim = simulate(graph);

    if (!matchesTarget(board, level.target)) {
      setMessage(`Sequence Error: Level requirement not met.`);
      setIsPowered(false);
      return;
    }

    if (!sim.isValid) {
      setMessage(`Physics Fault: ${sim.faults[0]?.message || "Circuit incomplete"}`);
      setIsPowered(false);
      return;
    }

    if (!completed.includes(level.id)) {
      setCompleted((ids) => [...ids, level.id]);
      setXp((value) => value + level.reward);
    }
    const nextUnlocked = Math.min(CIRCUIT_LEVELS.length, Math.max(unlocked, levelIndex + 2));
    setUnlocked(nextUnlocked);
    setIsPowered(true);
    setCurrentSpeed(sim.componentStates[0]?.currentFlow || 0.5);
    setMessage(`Mission complete! ⚡ ${sim.commentary.split('\n')[0]}`);

    if (!autoWalking) {
      setAutoWalking(true);
      let step = 0;
      const walkInterval = setInterval(() => {
        const targetX = checkpointPositions[collected[step]];
        setPlayerX(targetX);
        step++;
        if (step >= collected.length) {
          step = 0; // Infinite Loop
        }
      }, 1200);
    }
  };

  const moveNext = () => {
    if (levelIndex + 1 >= unlocked || levelIndex === CIRCUIT_LEVELS.length - 1) return;
    selectLevel(levelIndex + 1);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-panel/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-primary/40 bg-primary/15 text-primary shadow-glow">
              <Zap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-sm uppercase tracking-[0.16em] text-primary md:text-base">CircuitSathi</h1>
              <p className="text-xs text-muted-foreground">Electronics Quest Lab</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 font-display text-[10px] text-primary">{xp} XP</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-0 lg:grid-cols-[280px_1fr_310px]">
        <aside className="border-b border-border bg-panel p-4 lg:min-h-[calc(100vh-65px)] lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Quest Map</p>
            <span className="text-xs text-primary">{completed.length}/5</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {CIRCUIT_LEVELS.map((item, index) => {
              const isLocked = index >= unlocked;
              const isActive = index === levelIndex;
              const isDone = completed.includes(item.id);
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectLevel(index)}
                  disabled={isLocked}
                  className={`group relative flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isActive ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-surface hover:border-primary/40"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <div className={`grid size-9 shrink-0 place-items-center rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {isLocked ? <LockKeyhole className="size-4" /> : isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Level {item.id}</p>
                    <p className="truncate font-display text-[9px] leading-4 text-foreground">{item.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="relative min-h-[620px] overflow-hidden bg-grid p-4 md:p-6 lg:min-h-[calc(100vh-65px)]">
          <div className="relative z-10 mx-auto flex h-full max-w-4xl flex-col">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-2 font-display text-[9px] uppercase tracking-[0.22em] text-primary">Level {level.id} · {level.subtitle}</p>
                <h2 className="font-display text-xl leading-tight text-foreground md:text-3xl">{level.name}</h2>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col justify-between rounded-2xl border border-border bg-canvas/90 p-4 shadow-2xl md:p-6">
              <div className="game-stage my-4" style={{ backgroundImage: `url(${circuitWorld})` }}>
                <div className="game-stage-shade" />
                {level.parts.map((part, index) => {
                  const isCollected = collected.includes(index);
                  return (
                    <div
                      key={`${part}-${index}`}
                      className={`game-checkpoint ${isCollected ? "game-checkpoint-collected" : ""}`}
                      style={{ left: `${checkpointPositions[index]}%` }}
                    >
                      <span className="game-checkpoint-symbol">{isCollected ? "✓" : partLabels[part].symbol}</span>
                      <span>{partLabels[part].label}</span>
                    </div>
                  );
                })}
                {isPowered && <div className="absolute bottom-[10%] left-0 right-0 h-1 bg-primary/40 shadow-[0_0_15px_var(--primary)] animate-pulse z-10" />}
                <div className={`volt-player ${isMoving || autoWalking ? "volt-running" : ""}`} style={{ left: `${playerX}%`, transform: `translateX(-50%) scaleX(${facingLeft ? -1 : 1})`, transition: "left 1s linear" }}>
                  <img src={voltHero} alt="Volt" width={100} height={100} />
                </div>
                <div className="game-ground" />
                
                {/* On-ground Schematic Path */}
                {isPowered && (
                  <div className="absolute bottom-[9%] left-0 right-0 h-12 flex items-center justify-around px-8 pointer-events-none z-10">
                    {board.map((part, idx) => (
                      <div 
                        key={`ground-sym-${idx}`} 
                        className={`flex flex-col items-center transition-all duration-500 ${Math.abs(playerX - (20 + idx * (68 / Math.max(1, board.length - 1)))) < 10 ? "scale-125 brightness-150" : "scale-100 opacity-60"}`}
                        style={{ position: 'absolute', left: `${20 + idx * (68 / Math.max(1, board.length - 1))}%`, transform: 'translateX(-50%)' }}
                      >
                         <SchematicSymbol type={part} powered={true} />
                         <span className="text-[6px] text-primary/80 font-bold tracking-tighter bg-black/40 px-1 rounded">{partLabels[part].label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex min-h-24 flex-col gap-2 rounded-xl border border-primary/20 bg-black/40 p-3">
                   <p className="text-[9px] uppercase tracking-[0.2em] text-primary/60">Schematic Diagram</p>
                   <div className="flex items-center gap-0 overflow-x-auto py-2">
                     {board.map((part, index) => (
                       <div key={`sch-${index}`} className="flex items-center shrink-0">
                         {index > 0 && <div className={`h-0.5 w-6 ${isPowered ? "bg-primary animate-pulse" : "bg-muted"}`} />}
                         <div className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${isPowered ? "text-primary font-bold" : "text-muted-foreground"}`}>
                           <SchematicSymbol type={part} powered={isPowered} />
                           <span className="text-[6px] mt-1 uppercase tracking-tighter">{partLabels[part].label}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${isPowered ? "border-success/30 bg-success/10 text-success" : "border-border bg-panel text-muted-foreground"}`}>
                  <Sparkles className="size-4 inline mr-2" /> {message}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-border bg-panel p-5 lg:min-h-[calc(100vh-65px)] lg:border-l lg:border-t-0">
          <p className="mb-5 font-display text-[10px] uppercase tracking-widest text-muted-foreground">Mission Console</p>
          <div className="mb-4 rounded-xl border border-border bg-surface p-4 text-xs leading-5 text-muted-foreground">{level.lesson}</div>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => { setBoard([]); setCollected([]); setPlayerX(8); setIsPowered(false); setAutoWalking(false); }}><RotateCcw /> Reset</Button>
            <Button onClick={testCircuit} disabled={board.length < level.target.length}><Zap /> Test circuit</Button>
            <Button variant="secondary" onClick={moveNext} disabled={!completed.includes(level.id)}>Next level <ChevronRight /></Button>
          </div>
        </aside>
      </div>
    </main>
  );
}