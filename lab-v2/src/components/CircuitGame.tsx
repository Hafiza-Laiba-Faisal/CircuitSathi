import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Activity, Check, ChevronRight, Gamepad2, HelpCircle, LockKeyhole, RotateCcw, Sparkles, Volume2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CIRCUIT_LEVELS, partLabels, type PartType } from "@/lib/circuit-levels";
import { simulateCircuit, type SimulationResult } from "@/lib/physics/simulationEngine";
import circuitWorld from "@/assets/circuit-world.jpg";
import voltHero from "@/assets/volt-hero.png";

function matchesTarget(board: PartType[], target: string[]) {
  return board.length === target.length && board.every((part, index) => part === target[index]);
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
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [pathProgress, setPathProgress] = useState(0);

  const level = CIRCUIT_LEVELS[levelIndex];
  const progress = useMemo(() => Math.round((completed.length / CIRCUIT_LEVELS.length) * 100), [completed]);
  const current = board.length;
  const isPowered = sim?.isValid ?? false;

  const selectLevel = (index: number) => {
    if (index >= unlocked) return;
    setLevelIndex(index);
    setBoard([]);
    setCollected([]);
    setPlayerX(8);
    setShowHint(false);
    setSim(null);
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
    setSim(null);
    setMessage(`${partLabels[part].label} connected — ${board.length + 1}/${level.target.length}`);
  }, [board, level.target]);

  const checkpointPositions = useMemo(
    () => level.parts.map((_, index) => 20 + index * (68 / Math.max(1, level.parts.length - 1))),
    [level.parts],
  );

  // Closed-loop path that traces through every checkpoint along the top edge
  // and returns along the bottom. Used both for the glowing wire overlay and
  // for animating Volt around the powered circuit.
  const loopPoints = useMemo(() => {
    const top = 28;
    const bottom = 78;
    const xs = checkpointPositions;
    if (xs.length === 0) return [] as { x: number; y: number }[];
    const last = xs[xs.length - 1];
    const first = xs[0];
    return [
      ...xs.map((x) => ({ x, y: top })),
      { x: last, y: bottom },
      { x: first, y: bottom },
      { x: first, y: top },
    ];
  }, [checkpointPositions]);

  const loopPathD = useMemo(() => {
    if (loopPoints.length === 0) return "";
    return loopPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  }, [loopPoints]);

  const loopSegments = useMemo(() => {
    const segs: { ax: number; ay: number; bx: number; by: number; len: number }[] = [];
    for (let i = 0; i < loopPoints.length - 1; i += 1) {
      const a = loopPoints[i];
      const b = loopPoints[i + 1];
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len: Math.hypot(b.x - a.x, b.y - a.y) });
    }
    return segs;
  }, [loopPoints]);

  const loopLength = useMemo(() => loopSegments.reduce((s, seg) => s + seg.len, 0), [loopSegments]);

  // Stop-by-stop tour: Volt walks the loop, pausing at each component to
  // narrate what it does and the live calculation. Cycle repeats while the
  // circuit stays powered.
  const tourTimeline = useMemo(() => {
    if (!isPowered || !sim || loopPoints.length === 0) return null;
    const stops = checkpointPositions.map((x, i) => ({ x, y: 28, part: board[i] }));
    const speedScale = Math.max(0.6, Math.min(2.5, sim.currentFlow / 18));
    const msPerUnit = 70 / speedScale; // ms per 1% of stage
    const pauseMs = 2600;
    type Event =
      | { type: "move"; from: { x: number; y: number }; to: { x: number; y: number }; duration: number }
      | { type: "pause"; at: { x: number; y: number }; duration: number; info: { title: string; body: string } };
    const events: Event[] = [];
    const infoFor = (part: PartType | undefined): { title: string; body: string } => {
      const V = sim.voltage;
      const R = sim.totalResistance;
      const I = sim.currentFlow;
      switch (part) {
        case "battery":
          return { title: "Battery — 9V Source", body: `V = ${V} V supply · electrons + → − flow start.` };
        case "resistor":
          return { title: "Resistor — 220Ω", body: `Ohm's Law · I = V / R = ${V} / ${R.toFixed(0)} = ${I.toFixed(1)} mA` };
        case "led":
          return { title: "LED — Glowing!", body: `V_drop ≈ 2V · light emits at I = ${I.toFixed(1)} mA` };
        case "capacitor":
          return { title: "Capacitor — 100µF", body: `Q = C × V · charge ${(100 * V).toFixed(0)} µC store ho raha.` };
        case "junction":
          return { title: "Junction Node", body: `KCL · ΣI_in = ΣI_out · current ${sim.parallelBranches}× split.` };
        case "ground":
          return { title: "Ground — 0V Reference", body: `Return path complete · loop closed.` };
        default:
          return { title: "Component", body: "" };
      }
    };
    stops.forEach((stop, i) => {
      events.push({ type: "pause", at: stop, duration: pauseMs, info: infoFor(stop.part) });
      const next = stops[i + 1];
      if (next) {
        const len = Math.hypot(next.x - stop.x, next.y - stop.y);
        events.push({ type: "move", from: stop, to: next, duration: Math.max(400, len * msPerUnit) });
      }
    });
    if (stops.length > 0) {
      const last = stops[stops.length - 1];
      const first = stops[0];
      const br = { x: last.x, y: 78 };
      const bl = { x: first.x, y: 78 };
      events.push({ type: "move", from: last, to: br, duration: Math.max(400, Math.abs(78 - last.y) * msPerUnit) });
      events.push({ type: "move", from: br, to: bl, duration: Math.max(600, Math.abs(last.x - first.x) * msPerUnit) });
      events.push({ type: "move", from: bl, to: first, duration: Math.max(400, Math.abs(78 - first.y) * msPerUnit) });
    }
    const total = events.reduce((s, e) => s + e.duration, 0);
    return { events, total };
  }, [isPowered, sim, loopPoints.length, checkpointPositions, board]);

  const [tourPos, setTourPos] = useState<{ x: number; y: number } | null>(null);
  const [tourFacingLeft, setTourFacingLeft] = useState(false);
  const [tourInfo, setTourInfo] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!tourTimeline) {
      setTourPos(null);
      setTourInfo(null);
      setPathProgress(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const cycleT = (t - start) % tourTimeline.total;
      setPathProgress(cycleT / tourTimeline.total);
      let elapsed = cycleT;
      for (const ev of tourTimeline.events) {
        if (elapsed <= ev.duration) {
          if (ev.type === "pause") {
            setTourPos(ev.at);
            setTourInfo(ev.info);
          } else {
            const p = ev.duration === 0 ? 0 : elapsed / ev.duration;
            setTourPos({ x: ev.from.x + (ev.to.x - ev.from.x) * p, y: ev.from.y + (ev.to.y - ev.from.y) * p });
            setTourFacingLeft(ev.to.x < ev.from.x);
            setTourInfo(null);
          }
          break;
        }
        elapsed -= ev.duration;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tourTimeline]);


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
    const result = simulateCircuit(board);
    setSim(result);
    const sequenceMatches = matchesTarget(board, level.target);

    if (!result.isValid) {
      const lead = result.faults[0] ?? "Circuit unstable — physics check fail.";
      setMessage(`⚠ Fault: ${lead}`);
      return;
    }
    if (!sequenceMatches) {
      setMessage(`Circuit live hai (I = ${result.currentFlow.toFixed(1)} mA) par mission sequence match nahi hua. Hint dekho.`);
      return;
    }
    if (!completed.includes(level.id)) {
      setCompleted((ids) => [...ids, level.id]);
      setXp((value) => value + level.reward);
    }
    const nextUnlocked = Math.min(CIRCUIT_LEVELS.length, Math.max(unlocked, levelIndex + 2));
    setUnlocked(nextUnlocked);
    setMessage(`✓ Mission complete! +${level.reward} XP · ${result.commentary}`);
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
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Curriculum</p>
              <p className="font-display text-[10px] text-foreground">{progress}% COMPLETE</p>
            </div>
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
          <div className="circuit-orb circuit-orb-one" />
          <div className="circuit-orb circuit-orb-two" />
          <div className="relative z-10 mx-auto flex h-full max-w-4xl flex-col">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-2 font-display text-[9px] uppercase tracking-[0.22em] text-primary">Level {level.id} · {level.subtitle}</p>
                <h2 className="font-display text-xl leading-tight text-foreground md:text-3xl">{level.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{level.description}</p>
              </div>
              <div className="rounded-lg border border-border bg-panel/80 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</p>
                <p className="font-display text-xs text-primary">+{level.reward} XP</p>
              </div>
            </div>

            <div className="relative flex flex-1 flex-col justify-between rounded-2xl border border-border bg-canvas/90 p-4 shadow-2xl md:p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gamepad2 className="size-4 text-primary" /> 2D QUEST WORLD</div>
                <span className="font-mono text-xs text-primary">{current}/{level.target.length} CHECKPOINTS</span>
              </div>

              <div className="game-stage my-4" style={{ backgroundImage: `url(${circuitWorld})` }}>
                <div className="game-stage-shade" />
                <div className="absolute left-4 top-4 z-10 rounded-md border border-primary/30 bg-panel/80 px-3 py-2 font-mono text-[10px] text-primary backdrop-blur">
                  ← → / A D TO MOVE · SPACE / E TO COLLECT
                </div>
                {level.parts.map((part, index) => {
                  const isCollected = collected.includes(index);
                  const distance = Math.abs(checkpointPositions[index] - playerX);
                  return (
                    <button
                      key={`${part}-${index}`}
                      type="button"
                      aria-label={`${partLabels[part].label} checkpoint`}
                      onClick={() => {
                        setPlayerX(checkpointPositions[index]);
                        if (distance <= 8) addPart(part, index);
                        else setMessage(`${partLabels[part].label} checkpoint tak Volt ko le jao.`);
                      }}
                      className={`game-checkpoint ${isCollected ? "game-checkpoint-collected" : ""}`}
                      style={{ left: `${checkpointPositions[index]}%` }}
                    >
                      <span className="game-checkpoint-symbol">{isCollected ? "✓" : partLabels[part].symbol}</span>
                      <span>{partLabels[part].label}</span>
                    </button>
                  );
                })}
                {isPowered && loopPathD && (
                  <svg className="circuit-loop" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d={loopPathD} className="circuit-loop-glow" />
                    <path d={loopPathD} className="circuit-loop-wire" />
                    <path d={loopPathD} className="circuit-loop-dash" style={{ animationDuration: `${Math.max(0.8, sim!.flowDurationSec)}s` }} />
                  </svg>
                )}
                {isPowered && tourInfo && tourPos && (
                  <div
                    className="tour-info"
                    style={{ left: `${Math.min(85, Math.max(8, tourPos.x))}%`, top: `${Math.max(6, tourPos.y - 22)}%` }}
                  >
                    <p className="font-display text-[10px] uppercase tracking-wider text-primary">{tourInfo.title}</p>
                    {tourInfo.body && <p className="mt-1 font-mono text-[10px] leading-4 text-foreground">{tourInfo.body}</p>}
                  </div>
                )}
                <div
                  className={`volt-player ${isMoving ? "volt-running" : ""} ${isPowered ? "volt-on-track" : ""}`}
                  style={
                    isPowered && tourPos
                      ? { left: `${tourPos.x}%`, top: `${tourPos.y}%`, bottom: "auto", transform: `translate(-50%, -50%) scaleX(${tourFacingLeft ? -1 : 1})`, transition: "left 200ms linear, top 200ms linear" }
                      : { left: `${playerX}%`, transform: `translateX(-50%) scaleX(${facingLeft ? -1 : 1})` }
                  }
                >
                  <img src={voltHero} alt="Volt, the CircuitSathi hero" width={512} height={512} draggable={false} />
                </div>
                <div className="game-ground" />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Circuit inventory</p>
                  <div className="flex gap-2 md:hidden">
                    <Button size="icon" variant="outline" onClick={() => movePlayer(-5)} aria-label="Move Volt left"><ArrowLeft /></Button>
                    <Button size="icon" variant="outline" onClick={() => movePlayer(5)} aria-label="Move Volt right"><ArrowRight /></Button>
                    <Button size="sm" onClick={interact}>Collect</Button>
                  </div>
                </div>
                <div
                  className={`flex min-h-14 flex-wrap gap-2 rounded-xl border border-border bg-panel/70 p-2 ${sim?.isValid ? "electric-flow" : ""}`}
                  style={sim?.isValid ? ({ ["--flow-duration" as string]: `${sim.flowDurationSec}s` } as React.CSSProperties) : undefined}
                >
                  {board.length === 0 ? <span className="self-center px-2 text-xs text-muted-foreground">World explore karke components collect karo.</span> : board.map((part, index) => (
                    <div key={`${part}-${index}`} className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success backdrop-blur-sm">
                      <Check className="size-3" /> {partLabels[part].label}
                    </div>
                  ))}
                </div>
                {sim?.isValid && (
                  <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-[10px] text-primary">
                    <span>V = {sim.voltage} V</span>
                    <span>R = {sim.totalResistance.toFixed(0)} Ω</span>
                    <span>I = {sim.currentFlow.toFixed(1)} mA</span>
                    {sim.parallelBranches > 1 && <span>{sim.parallelBranches}× parallel</span>}
                    {sim.hasCapacitor && <span>Capacitor charging</span>}
                  </div>
                )}
                <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${sim && !sim.isValid && sim.faults.length > 0 ? "fault-bar" : message.startsWith("✓") ? "border-success/30 bg-success/10 text-success" : "border-border bg-panel text-muted-foreground"}`}>
                  {sim && !sim.isValid && sim.faults.length > 0 ? <AlertTriangle className="size-4 shrink-0" /> : sim?.isValid ? <Activity className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
                  <div className="flex-1">
                    <div>{message}</div>
                    {sim && sim.faults.length > 1 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 opacity-90">
                        {sim.faults.slice(1).map((fault, i) => <li key={i}>{fault}</li>)}
                      </ul>
                    )}
                    {sim && sim.commentary && !message.includes(sim.commentary) && (
                      <p className="mt-1 font-mono text-[10px] opacity-75">{sim.commentary}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-border bg-panel p-5 lg:min-h-[calc(100vh-65px)] lg:border-l lg:border-t-0">
          <p className="mb-5 font-display text-[10px] uppercase tracking-widest text-muted-foreground">Mission Console</p>
          <div className="mb-6 border-l-2 border-primary pl-4">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Objective</p>
            <p className="text-sm leading-6 text-foreground">{level.description}</p>
          </div>
          <div className="mb-4 rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground"><Zap className="size-4 text-primary" /> Physics decoded</div>
            <p className="text-xs leading-5 text-muted-foreground">{level.lesson}</p>
          </div>
          {showHint && <div className="mb-4 rounded-xl border border-accent/35 bg-accent/10 p-4 text-xs leading-5 text-accent-foreground">{level.hint}</div>}
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => setShowHint((value) => !value)}><HelpCircle /> {showHint ? "Hide hint" : "Show hint"}</Button>
            <Button variant="outline" onClick={() => { setBoard([]); setCollected([]); setPlayerX(8); setSim(null); setMessage("Quest reset. World dobara explore karo."); }}><RotateCcw /> Reset quest</Button>
            <Button onClick={testCircuit} disabled={board.length !== level.target.length}><Zap /> Test circuit</Button>
            <Button variant="secondary" onClick={moveNext} disabled={!completed.includes(level.id) || levelIndex === CIRCUIT_LEVELS.length - 1}>Next level <ChevronRight /></Button>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground"><span>Learning progress</span><span>{progress}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            <Button variant="ghost" className="mt-3 w-full text-muted-foreground"><Volume2 /> Sathi narration</Button>
          </div>
        </aside>
      </div>
    </main>
  );
}