import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Crosshair,
  LockKeyhole,
  Search,
  SlidersHorizontal,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { SignIn, useAuth } from "@clerk/react";
import {
  blockToCoordinate,
  blockToTimelineX,
  coordinateToBlock,
  getGridDimensions,
} from "@/lib/block-map-model";
import { dateToBlock, estimateBlock, isBitcoinModelStats, modelFromFallback, type BitcoinModelStats, type BlockEstimate } from "@/lib/block-estimator";

type ViewMode = "block" | "time";
type YearPoint = { year: number; block: number };

const FALLBACK_MODEL = modelFromFallback(new Date("2026-09-10T00:00:00Z").getTime());
const WINDOW_END = new Date("2038-01-01T00:00:00Z");

function blockForDate(date: Date, model: BitcoinModelStats = FALLBACK_MODEL) {
  return dateToBlock(model, date);
}

function formatBlock(block: number) {
  return `#${Math.round(block).toLocaleString("en-US")}`;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatRange(start: Date, end: Date) {
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  return `${startLabel} — ${endLabel}`;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatEstimate(result: BlockEstimate) {
  return {
    likely: formatMonth(result.median),
    fifty: formatRange(result.p25, result.p75),
    eighty: formatRange(result.p10, result.p90),
  };
}

const CLAIMED_BLOCKS = [
  1_061_880, 1_184_712, 1_267_944, 1_359_816, 1_491_576,
];

function isDemoClaimed(block: number) {
  return CLAIMED_BLOCKS.includes(block);
}

type LockedPrediction = {
  id: number;
  blockHeight: number;
  estimatedArrival: string;
  fiftyRange: string;
  eightyRange: string;
  lockedAt: string;
};

type LockStep = "closed" | "confirm" | "email" | "payment" | "success" | "account";

function BlockCanvas({
  currentBlock,
  mapStart,
  mapEnd,
  yearPoints,
  estimate,
  selectedBlock,
  highlightedRange,
  claimedBlocks = [],
  ownedBlock,
  viewMode,
  onSelect,
}: {
  currentBlock: number;
  mapStart: number;
  mapEnd: number;
  yearPoints: YearPoint[];
  estimate: (block: number) => BlockEstimate;
  selectedBlock: number;
  highlightedRange: { startBlock: number; endBlock: number } | null;
  claimedBlocks: number[];
  ownedBlock: number | null;
  viewMode: ViewMode;
  onSelect: (block: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ width: 1200, height: 418 });

  const mapMin = mapStart;
  const mapMax = mapEnd;
  const baseCellSize = 9;
  const defaultColumns = Math.max(24, Math.floor(viewport.width / baseCellSize));
  const blocksPerColumn = Math.ceil((mapMax - mapMin + 1) / defaultColumns);
  const dimensions = getGridDimensions(mapMin, mapMax, blocksPerColumn);
  const safeSelectedBlock = Math.min(mapMax, Math.max(mapMin, selectedBlock));
  const selectedCoordinate = blockToCoordinate(safeSelectedBlock, mapMin, blocksPerColumn);
  const rawNowX = blockToTimelineX(currentBlock, mapMin, blocksPerColumn, baseCellSize * zoom, pan.x);
  const visibleNowX = Math.min(viewport.width, Math.max(0, rawNowX));
  const blockIsClaimed = (block: number) => isDemoClaimed(block) || claimedBlocks.includes(block);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [selectedBlock]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateViewport = () => {
      const rect = frame.getBoundingClientRect();
      setViewport({ width: Math.max(320, rect.width), height: Math.max(330, rect.height) });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const draw = () => {
      const rect = frame.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, rect.width);
      const height = Math.max(330, rect.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cellScreen = baseCellSize * zoom;
      const worldHeight = dimensions.rows * cellScreen;
      const originX = pan.x;
      const originY = (height - worldHeight) / 2 + pan.y;
      const xForColumn = (column: number) => originX + column * cellScreen;
      const yForRow = (row: number) => originY + row * cellScreen;

      ctx.fillStyle = "#111316";
      ctx.fillRect(0, 0, width, height);

      const visibleColumnStart = Math.max(0, Math.floor((0 - originX) / cellScreen) - 1);
      const visibleColumnEnd = Math.min(dimensions.columns - 1, Math.ceil((width - originX) / cellScreen) + 1);
      const visibleRowStart = Math.max(0, Math.floor((0 - originY) / cellScreen) - 1);
      const visibleRowEnd = Math.min(dimensions.rows - 1, Math.ceil((height - originY) / cellScreen) + 1);

      if (highlightedRange) {
        const safeRangeStart = Math.min(mapMax, Math.max(mapMin, highlightedRange.startBlock));
        const safeRangeEnd = Math.min(mapMax, Math.max(safeRangeStart, highlightedRange.endBlock));
        const rangeStart = blockToCoordinate(safeRangeStart, mapMin, blocksPerColumn);
        const rangeEnd = blockToCoordinate(safeRangeEnd, mapMin, blocksPerColumn);
        const bandStartX = xForColumn(rangeStart.column);
        const bandEndX = xForColumn(rangeEnd.column) + cellScreen;
        ctx.fillStyle = "rgba(35, 139, 255, 0.12)";
        ctx.fillRect(bandStartX, 0, Math.max(cellScreen, bandEndX - bandStartX), height);
        ctx.strokeStyle = "rgba(74, 168, 255, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bandStartX, 0, Math.max(cellScreen, bandEndX - bandStartX), height);
      }

      // The field always renders individual visible blocks. Off-screen blocks
      // retain deterministic coordinates but are virtualized.
      const dotDiameter = Math.min(12, Math.max(3, 6 * zoom));
      const dotRadius = dotDiameter / 2;
      for (let column = visibleColumnStart; column <= visibleColumnEnd; column += 1) {
        for (let row = visibleRowStart; row <= visibleRowEnd; row += 1) {
          const block = coordinateToBlock(row, column, mapMin, mapMax, blocksPerColumn);
          if (block === null) continue;
          const x = xForColumn(column) + cellScreen / 2;
          const y = yForRow(row) + cellScreen / 2;
          const inHighlightedDate = highlightedRange !== null
            && block >= highlightedRange.startBlock
            && block <= highlightedRange.endBlock;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          const isOwned = block === ownedBlock;
          ctx.fillStyle = isOwned
            ? "#9ee85f"
            : blockIsClaimed(block)
              ? "#f7931a"
            : inHighlightedDate
              ? "#238bff"
            : block < currentBlock
              ? "rgba(155,161,169,0.28)"
              : "rgba(215,220,226,0.76)";
          ctx.fill();
          if (isOwned) {
            ctx.strokeStyle = "#c8ff91";
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (inHighlightedDate && !blockIsClaimed(block)) {
            ctx.strokeStyle = "rgba(123, 194, 255, 0.95)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Year divisions are vertical because chronology advances by column.
      // Labels remain exclusively on the bottom x-axis.
      for (const { year, block: yearBlock } of yearPoints) {
        const x = blockToTimelineX(yearBlock, mapMin, blocksPerColumn, cellScreen, pan.x);
        if (x < -1 || x > width + 1) continue;
        ctx.strokeStyle = "rgba(247,147,26,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // The global NOW marker belongs to the chronological x-axis, not to a
      // density row. It is clamped to the left edge while NOW precedes 2028.
      const timelineNowX = Math.min(width, Math.max(0, blockToTimelineX(currentBlock, mapMin, blocksPerColumn, cellScreen, pan.x)));
      ctx.strokeStyle = "#f7931a";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(timelineNowX, 0);
      ctx.lineTo(timelineNowX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#f7931a";
      ctx.font = "600 9px 'IBM Plex Mono', monospace";
      ctx.fillText(currentBlock < mapMin ? "NOW · BEFORE 2028" : "NOW", Math.max(7, timelineNowX + 6), 14);

      // Claimed state is always attached to the one exact claimed block.
      for (const block of CLAIMED_BLOCKS) {
        if (block < mapMin || block > mapMax) continue;
        const coordinate = blockToCoordinate(block, mapMin, blocksPerColumn);
        const x = xForColumn(coordinate.column) + cellScreen / 2;
        const y = yForRow(coordinate.row) + cellScreen / 2;
        if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#f7931a";
        ctx.fill();
      }

      const selectedX = xForColumn(selectedCoordinate.column) + cellScreen / 2;
      const selectedY = yForRow(selectedCoordinate.row) + cellScreen / 2;
      if (selectedX > -8 && selectedX < width + 8 && selectedY > -8 && selectedY < height + 8) {
        ctx.strokeStyle = "#b5f36c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(selectedX, selectedY, dotRadius + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (hoveredBlock !== null) {
        const hoveredCoordinate = blockToCoordinate(hoveredBlock, mapMin, blocksPerColumn);
        const hoveredX = xForColumn(hoveredCoordinate.column) + cellScreen / 2;
        const hoveredY = yForRow(hoveredCoordinate.row) + cellScreen / 2;
        if (hoveredX > -8 && hoveredX < width + 8 && hoveredY > -8 && hoveredY < height + 8) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hoveredX, hoveredY, dotRadius + 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    draw();
  }, [baseCellSize, blocksPerColumn, claimedBlocks, currentBlock, dimensions.columns, dimensions.rows, estimate, highlightedRange, hoveredBlock, mapMax, mapMin, ownedBlock, pan, selectedBlock, selectedCoordinate.column, selectedCoordinate.row, viewMode, viewport, yearPoints, zoom]);

  const blockFromPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cellScreen = baseCellSize * zoom;
    const worldHeight = dimensions.rows * cellScreen;
    const originX = pan.x;
    const originY = (rect.height - worldHeight) / 2 + pan.y;
    const column = Math.floor((event.clientX - rect.left - originX) / cellScreen);
    const row = Math.floor((event.clientY - rect.top - originY) / cellScreen);
    return coordinateToBlock(row, column, mapMin, mapMax, blocksPerColumn);
  };

  return (
    <div className="map-canvas-shell">
      <div className="map-controls" aria-label="Map controls">
        <div className="map-control-group">
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.max(0.55, value / 1.25))} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="zoom-label">{zoom === 1 ? "1×" : `${zoom.toFixed(2)}×`}</span>
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.min(2, value * 1.25))} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button type="button" className="icon-button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset map">
            <Crosshair size={15} />
          </button>
        </div>
        <span className="drag-hint">Drag to explore</span>
      </div>
      <div
        className="map-canvas-frame"
        ref={frameRef}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const cursorX = event.clientX - rect.left;
          const cursorY = event.clientY - rect.top;
          const oldCell = baseCellSize * zoom;
          const oldWorldHeight = dimensions.rows * oldCell;
          const oldOriginX = pan.x;
          const oldOriginY = (rect.height - oldWorldHeight) / 2 + pan.y;
          const worldColumn = (cursorX - oldOriginX) / oldCell;
          const worldRow = (cursorY - oldOriginY) / oldCell;
          const nextZoom = Math.min(2, Math.max(0.55, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
          const nextCell = baseCellSize * nextZoom;
          const nextBaseOriginY = (rect.height - dimensions.rows * nextCell) / 2;
          setPan({
            x: cursorX - worldColumn * nextCell,
            y: cursorY - nextBaseOriginY - worldRow * nextCell,
          });
          setZoom(nextZoom);
        }}
      >
        <canvas
          ref={canvasRef}
          className="block-canvas"
          aria-label="Interactive projected Bitcoin block map"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          }}
          onPointerMove={(event) => {
            if (dragRef.current) {
              setPan({
                x: dragRef.current.panX + event.clientX - dragRef.current.x,
                y: dragRef.current.panY + event.clientY - dragRef.current.y,
              });
            } else {
              setHoveredBlock(blockFromPointer(event));
            }
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (drag && Math.abs(event.clientX - drag.x) < 5 && Math.abs(event.clientY - drag.y) < 5) {
              const block = blockFromPointer(event);
              if (block !== null) onSelect(block);
            }
          }}
          onPointerCancel={() => { dragRef.current = null; }}
          onPointerLeave={() => setHoveredBlock(null)}
        />
      </div>
      <div className="map-axis" aria-label="Estimated calendar timeline">
        <span className="axis-title">ESTIMATED TIME</span>
        <span className="now-axis-line" style={{ left: `${visibleNowX}px` }}><b>{currentBlock < mapMin ? "NOW · BEFORE 2028" : "NOW"}</b></span>
        <div className="axis-years">
          {Array.from({ length: 11 }, (_, index) => {
            const { year, block } = yearPoints[index];
            const x = blockToTimelineX(block, mapMin, blocksPerColumn, baseCellSize * zoom, pan.x);
            return <span key={year} style={{ left: `${x}px` }}>{year}</span>;
          })}
        </div>
      </div>
      {hoveredBlock !== null && (
        <div className="map-hover-readout" role="status">
          <span>{formatBlock(hoveredBlock)}</span>
          <span>{formatMonth(estimate(hoveredBlock).median)}</span>
          <span className={hoveredBlock === ownedBlock ? "green-text" : blockIsClaimed(hoveredBlock) ? "orange-text" : "green-text"}>
            {hoveredBlock === ownedBlock ? "YOUR BLOCK" : blockIsClaimed(hoveredBlock) ? "CLAIMED" : "AVAILABLE"} · $1
          </span>
        </div>
      )}
    </div>
  );
}

const distribution = [
  { year: 2028, count: 5 },
  { year: 2029, count: 11 },
  { year: 2030, count: 17 },
  { year: 2031, count: 26 },
  { year: 2032, count: 39 },
  { year: 2033, count: 52 },
  { year: 2034, count: 44 },
  { year: 2035, count: 31 },
  { year: 2036, count: 21 },
  { year: 2037, count: 12 },
  { year: 2038, count: 7 },
];

export default function Home() {
  const mapSectionRef = useRef<HTMLElement>(null);
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [model, setModel] = useState<BitcoinModelStats>(() => {
    try {
      const saved = localStorage.getItem("bitcoin-block-model-v3");
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      return isBitcoinModelStats(parsed) ? parsed : FALLBACK_MODEL;
    } catch {
      return FALLBACK_MODEL;
    }
  });
  const years = useMemo(() => Array.from({ length: 11 }, (_, index) => {
    const year = 2028 + index;
    return { year, block: blockForDate(new Date(`${year}-01-01T00:00:00Z`), model) };
  }), [model]);
  const mapStart = model.currentBlock;
  const mapEnd = blockForDate(WINDOW_END, model);
  const mapCount = mapEnd - mapStart + 1;
  const [selectedBlock, setSelectedBlock] = useState(() => years[5].block + 1000);
  const [viewMode, setViewMode] = useState<ViewMode>("block");
  const [searchValue, setSearchValue] = useState("");
  const [jumpYear, setJumpYear] = useState("2033");
  const [targetDate, setTargetDate] = useState("");
  const [highlightedRange, setHighlightedRange] = useState<{ startBlock: number; endBlock: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [claimedBlocks, setClaimedBlocks] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<LockedPrediction | null>(null);
  const [lockStep, setLockStep] = useState<LockStep>("closed");
  const [lockError, setLockError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const estimate = useMemo(() => formatEstimate(estimateBlock(model, selectedBlock)), [model, selectedBlock]);
  const selectedIsOwned = prediction?.blockHeight === selectedBlock;
  const selectedIsClaimed = isDemoClaimed(selectedBlock) || claimedBlocks.includes(selectedBlock);

  useEffect(() => {
    let active = true;
    const refresh = () => fetch("/api/bitcoin/model").then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).message || "Model unavailable");
      return response.json() as Promise<BitcoinModelStats>;
    }).then((next) => {
      localStorage.setItem("bitcoin-block-model-v3", JSON.stringify(next));
      if (active) setModel(next);
    }).catch(() => {
      if (active) setNotice("Live Bitcoin timing data is temporarily unavailable; showing the last valid model.");
    });
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#map") return;
    const frame = window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authLoaded) return;
    Promise.all([
      fetch("/api/prediction/locks", { credentials: "include" }).then((response) => response.json()),
      fetch("/api/prediction/session", { credentials: "include" }).then((response) => response.json()),
    ]).then(([locks, session]) => {
      setClaimedBlocks(Array.isArray(locks.blocks) ? locks.blocks : []);
      if (session.prediction) setPrediction(session.prediction);
    }).catch(() => {
      setNotice("The permanent-lock service is temporarily unavailable.");
    });
  }, [authLoaded, isSignedIn]);

  useEffect(() => {
    if (lockStep === "email" && isSignedIn) setLockStep("payment");
  }, [isSignedIn, lockStep]);

  const selectBlock = (block: number) => {
    setSelectedBlock(block);
    setNotice("");
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(searchValue.replace(/,/g, "").replace(/^#/, ""));
    const min = years[0].block;
    const max = years[years.length - 1].block;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setNotice(`Enter a block between ${formatBlock(min)} and ${formatBlock(max)}.`);
      return;
    }
    selectBlock(Math.round(parsed));
    setNotice(`Map focused on ${formatBlock(Math.round(parsed))}.`);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const jumpToYear = (year: string) => {
    setJumpYear(year);
    const target = years.find((item) => item.year === Number(year));
    if (target) selectBlock(target.block + 1000);
  };

  const highlightDate = (dateValue: string) => {
    setTargetDate(dateValue);
    if (!dateValue) {
      setHighlightedRange(null);
      setNotice("");
      return;
    }

    const date = new Date(`${dateValue}T00:00:00Z`);
     const centerBlock = blockForDate(new Date(date.getTime() + 12 * 60 * 60 * 1000), model);
     const halfWindowBlocks = Math.max(1, Math.round(dateToBlock(model, new Date(date.getTime() + 15.5 * 86_400_000)) - centerBlock));
     const startBlock = Math.max(mapStart, centerBlock - halfWindowBlocks);
     const endBlock = Math.min(mapEnd, centerBlock + halfWindowBlocks);
    const midpoint = Math.round((startBlock + endBlock) / 2);
    setHighlightedRange({ startBlock, endBlock });
    setSelectedBlock(midpoint);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    setNotice(`Highlighted a 31-day candidate window around ${label}. Blue dots are candidates; orange dots are already claimed.`);
  };

  const openLockFlow = () => {
    setLockError("");
    if (prediction) {
      setLockStep("account");
      return;
    }
    if (selectedIsClaimed) {
      setNotice("That block is already claimed. Choose a gray or blue available block.");
      return;
    }
    setLockStep("confirm");
  };

  const confirmSelection = () => {
    setLockError("");
    setLockStep(isSignedIn ? "payment" : "email");
  };

  const completeDemoPayment = async () => {
    setIsProcessing(true);
    setLockError("");
    try {
      const response = await apiRequest("POST", "/api/prediction/lock", {
        blockHeight: selectedBlock,
        estimatedArrival: estimate.likely,
        fiftyRange: estimate.fifty,
        eightyRange: estimate.eighty,
      });
      const locked = await response.json() as LockedPrediction;
      setPrediction(locked);
      setClaimedBlocks((blocks) => Array.from(new Set([...blocks, locked.blockHeight])));
      setLockStep("success");
    } catch (error) {
      setLockError(error instanceof Error && error.message.includes("already")
        ? "That block or account already has a permanent prediction."
        : "The demo payment could not be completed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const viewMyBlock = () => {
    if (!prediction) return;
    setSelectedBlock(prediction.blockHeight);
    setLockStep("closed");
    window.setTimeout(() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  return (
    <div className="wen-app">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Wen Bitcoin one million home">
          <span className="brand-mark">₿</span>
          <span>WEN BITCOIN <b>$1M?</b></span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a className="active" href="#map">Map</a>
          <a href="#about">About</a>
          {prediction && <button type="button" onClick={() => setLockStep("account")}>My prediction</button>}
        </nav>
        <a className="header-cta" href="#make-prediction">
          Make a prediction <ArrowRight size={15} />
        </a>
      </header>

      <main id="top">
        <section className="hero page-width">
          <div className="eyebrow"><span className="live-dot" /> LIVE PREDICTION MAP <span className="demo-chip">DEMO MODE</span></div>
          <h1>TICK TOCK.<br /><em>WHICH BLOCK?</em></h1>
          <p className="hero-copy">Which Bitcoin block will be the first to take Bitcoin to <strong>$1,000,000?</strong></p>
          <div className="hero-meta">
            <span>THE PREDICTION IS THE BLOCK HEIGHT</span>
            <span className="meta-separator" />
            <span>THE DATE IS ONLY AN ESTIMATE</span>
          </div>
        </section>

        <section className="prediction-controls page-width" id="make-prediction">
          <div className="control-intro">
            <span className="section-kicker">01 / CHOOSE YOUR BLOCK</span>
            <h2>Pick the moment.</h2>
          </div>
          <form className="block-search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              value={searchValue}
              onChange={(event) => { setSearchValue(event.target.value); setNotice(""); }}
              placeholder="Search block number"
              aria-label="Search block number"
            />
            <button type="submit">Find block</button>
          </form>
          <div className="view-controls">
            <label className="date-picker">
              <span>DATE</span>
              <input
                type="date"
                min={dateInputValue(new Date(model.currentTimestamp * 1000))}
                max="2037-12-31"
                value={targetDate}
                onChange={(event) => highlightDate(event.target.value)}
                aria-label="Highlight blocks for a date"
              />
            </label>
            <span>VIEW BY</span>
            <div className="segmented-control" role="group" aria-label="View by">
              <button type="button" className={viewMode === "block" ? "selected" : ""} onClick={() => setViewMode("block")}>Block</button>
              <button type="button" className={viewMode === "time" ? "selected" : ""} onClick={() => setViewMode("time")}>Estimated time</button>
            </div>
            <label className="jump-select">
              <span>JUMP TO</span>
              <select value={jumpYear} onChange={(event) => jumpToYear(event.target.value)} aria-label="Jump to year">
                {years.map(({ year }) => <option key={year} value={year}>{year}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
          {notice && <p className="control-notice">{notice}</p>}
        </section>

        <section className="map-section page-width" id="map" ref={mapSectionRef}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">02 / PROJECTED BLOCK FIELD</span>
              <h2>The map is the prediction.</h2>
            </div>
            <div className="map-legend">
              <span><i className="legend-dot available" /> Available</span>
              <span><i className="legend-dot date-range" /> Date range</span>
              <span><i className="legend-dot claimed" /> Claimed</span>
              <span><i className="legend-dot selected" /> Selected</span>
            </div>
          </div>
          <div className="map-card">
            <div className="map-card-topline">
              <span>NOW — 2038 / CHRONOLOGICAL BLOCK FIELD</span>
              <span><SlidersHorizontal size={14} /> SCROLL TO EXPLORE</span>
            </div>
            <BlockCanvas
              currentBlock={model.currentBlock}
              mapStart={mapStart}
              mapEnd={mapEnd}
              yearPoints={years}
              estimate={(block) => estimateBlock(model, block)}
              selectedBlock={selectedBlock}
              highlightedRange={highlightedRange}
              claimedBlocks={claimedBlocks}
              ownedBlock={prediction?.blockHeight ?? null}
              viewMode={viewMode}
              onSelect={selectBlock}
            />
            <div className="map-card-footer">
              <span><span className="status-pip orange" /> NOW IS {formatBlock(model.currentBlock)}</span>
              <span>{mapCount.toLocaleString("en-US")} UNIQUE BLOCKS / ONE DOT EACH / OFFSCREEN BLOCKS VIRTUALIZED</span>
            </div>
          </div>
        </section>

        <section className="insight-grid page-width">
          <div className="selection-card">
            <div className="card-label">
              <span className="section-kicker">{selectedIsOwned ? "03 / YOUR PREDICTION" : "03 / YOUR SELECTION"}</span>
              <span className={selectedIsOwned ? "status owned" : selectedIsClaimed ? "status claimed" : "status"}>
                {selectedIsOwned ? "🔒 LOCKED" : selectedIsClaimed ? "CLAIMED" : "AVAILABLE"}
              </span>
            </div>
            <div className="selected-block">{formatBlock(selectedBlock)}</div>
            <p className="selection-lede">Your prediction is a block, not a date.</p>
            <div className="estimate-grid">
              <div><span>ESTIMATED ARRIVAL</span><strong>{estimate.likely}</strong></div>
              <div><span>50% LIKELY RANGE</span><strong>{estimate.fifty}</strong></div>
              <div><span>80% LIKELY RANGE</span><strong>{estimate.eighty}</strong></div>
            </div>
            <p className="estimate-disclaimer">Estimated from recent Bitcoin block production and network difficulty. Actual timing will vary.</p>
            {import.meta.env.DEV && (
              <details className="estimate-disclaimer">
                <summary>MODEL DEBUG (DEVELOPMENT)</summary>
                <small>
                  Current block height: {model.currentBlock}<br />
                  Current block timestamp: {new Date(model.currentTimestamp * 1000).toISOString()}<br />
                  Recent median block interval: {model.medianInterval.toFixed(1)}s<br />
                  Recent mean block interval: {model.meanInterval.toFixed(1)}s<br />
                  Recent standard deviation: {model.standardDeviation.toFixed(1)}s<br />
                  Current difficulty: {model.difficulty.toLocaleString("en-US")}<br />
                  Blocks remaining in current difficulty epoch: {model.epochRemaining}<br />
                  Estimated next difficulty adjustment: {new Date(model.nextAdjustmentTimestamp).toISOString()} (block {model.nextAdjustment})<br />
                  Model update timestamp: {new Date(model.updatedAt).toISOString()}
                </small>
              </details>
            )}
            <div className="nearby-row">
              <span>PREDICTIONS NEARBY</span>
              <span>±10 <b>{(selectedBlock % 5) + 2}</b></span>
              <span>±100 <b>{(selectedBlock % 17) + 8}</b></span>
              <span>±1,000 <b>{(selectedBlock % 90) + 30}</b></span>
            </div>
            <button
              type="button"
              className="lock-button"
              disabled={selectedIsClaimed && !selectedIsOwned}
              onClick={selectedIsOwned ? () => setLockStep("account") : openLockFlow}
            >
              {selectedIsOwned ? "VIEW MY PREDICTION" : selectedIsClaimed ? "BLOCK ALREADY CLAIMED" : "LOCK THIS BLOCK — $1"} <ArrowRight size={16} />
            </button>
            <p className="estimate-disclaimer">
              {selectedIsOwned ? "Your prediction is permanently locked." : "Your prediction is permanent once locked. Estimated timing will vary."}
            </p>
          </div>

          <div className="distribution-card">
            <div className="card-label"><span className="section-kicker">04 / CROWD SIGNAL</span><Sparkles size={16} /></div>
            <h3>Where does the crowd think it happens?</h3>
            <p className="card-copy">A live view of where predictions are clustering across the full window.</p>
            <div className="histogram" role="img" aria-label="Mock prediction distribution from 2028 through 2038">
              {distribution.map((item) => (
                <div className="histogram-column" key={item.year}>
                  <div className="histogram-bar" style={{ height: `${(item.count / 52) * 100}%` }} title={`${item.count} predictions in ${item.year}`} />
                  <span>{item.year}</span>
                </div>
              ))}
            </div>
            <div className="crowd-stats">
              <div><span>MOST POPULAR YEAR</span><strong>2033</strong><small>32% of predictions</small></div>
              <div><span>EARLIEST</span><strong>2028</strong><small>first projected year</small></div>
              <div><span>LATEST</span><strong>2038</strong><small>last projected year</small></div>
            </div>
            <p className="mock-note">Crowd signal is simulated in demo mode.</p>
          </div>
        </section>

        <section className="about-section page-width" id="about">
          <span className="section-kicker">ABOUT THE QUESTION</span>
          <div className="about-content">
            <h2>Bitcoin makes blocks.<br /><em>We pick one.</em></h2>
            <div>
              <p>Bitcoin produces blocks continuously. We ask one question: which block will be the first to take Bitcoin to $1,000,000?</p>
              <p>The block number is the prediction. The calendar estimate is calculated separately, and it will move as real block production changes. It is never a guarantee.</p>
            </div>
          </div>
        </section>
      </main>

      {lockStep !== "closed" && (
        <div className="lock-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && lockStep !== "success") setLockStep("closed");
        }}>
          <section className="lock-modal" role="dialog" aria-modal="true" aria-labelledby="lock-modal-title">
            <div className="modal-topline">
              <span>LOCK YOUR BLOCK / TEST DEMO</span>
              {lockStep !== "success" && <button type="button" onClick={() => setLockStep("closed")} aria-label="Close">×</button>}
            </div>

            {lockStep === "confirm" && (
              <>
                <span className="modal-step">01 / REVIEW</span>
                <h2 id="lock-modal-title">LOCK YOUR PREDICTION?</h2>
                <div className="modal-block">{formatBlock(selectedBlock)}</div>
                <div className="modal-summary">
                  <div><span>ESTIMATED ARRIVAL</span><strong>{estimate.likely}</strong></div>
                  <div><span>50% LIKELY RANGE</span><strong>{estimate.fifty}</strong></div>
                </div>
                <p className="modal-warning">Once locked, this prediction cannot be changed or transferred.</p>
                <div className="modal-actions">
                  <button type="button" className="secondary-action" onClick={() => setLockStep("closed")}>← GO BACK</button>
                  <button type="button" className="primary-action" onClick={confirmSelection}>LOCK THIS BLOCK</button>
                </div>
              </>
            )}

            {lockStep === "email" && (
              <div className="clerk-lock-step">
                <span className="modal-step">02 / VERIFIED ACCOUNT</span>
                <h2 id="lock-modal-title">CREATE YOUR PREDICTION</h2>
                <p className="modal-copy">Verify your email to save this permanent prediction. Your email is private and never appears on the map.</p>
                <SignIn routing="hash" />
              </div>
            )}

            {lockStep === "payment" && (
              <>
                <span className="modal-step">03 / DEMO PAYMENT</span>
                <h2 id="lock-modal-title">LOCK {formatBlock(selectedBlock)}</h2>
                <div className="demo-price">$1.00</div>
                <div className="payment-ticket">
                  <span>YOUR PREDICTION</span><strong>{formatBlock(selectedBlock)}</strong>
                  <span>ESTIMATED</span><strong>{estimate.likely}</strong>
                </div>
                <p className="demo-auth-note">TEST / DEMO · NO CARD OR LIVE STRIPE PAYMENT</p>
                {lockError && <p className="modal-error">{lockError}</p>}
                <div className="modal-actions">
                  <button type="button" className="secondary-action" onClick={() => setLockStep("confirm")}>← GO BACK</button>
                  <button type="button" className="primary-action" disabled={isProcessing} onClick={completeDemoPayment}>
                    {isProcessing ? "LOCKING…" : "LOCK MY BLOCK — $1"}
                  </button>
                </div>
              </>
            )}

            {lockStep === "success" && prediction && (
              <div className="success-content">
                <span className="success-lock"><LockKeyhole size={30} /> BLOCK LOCKED</span>
                <h2 id="lock-modal-title">{formatBlock(prediction.blockHeight)}</h2>
                <p className="success-lede">You picked the block.</p>
                <div className="modal-summary">
                  <div><span>ESTIMATED ARRIVAL</span><strong>{prediction.estimatedArrival}</strong></div>
                  <div><span>50% LIKELY RANGE</span><strong>{prediction.fiftyRange}</strong></div>
                  <div><span>80% LIKELY RANGE</span><strong>{prediction.eightyRange}</strong></div>
                </div>
                <p className="modal-warning success">Your prediction is now permanently locked.</p>
                <button type="button" className="primary-action full" onClick={viewMyBlock}>VIEW MY BLOCK</button>
              </div>
            )}

            {lockStep === "account" && prediction && (
              <>
                <span className="modal-step">MY PREDICTION</span>
                <h2 id="lock-modal-title">YOUR PREDICTION</h2>
                <div className="modal-block">{formatBlock(prediction.blockHeight)}</div>
                <span className="account-locked"><LockKeyhole size={14} /> LOCKED</span>
                <div className="modal-summary">
                  <div><span>ESTIMATED ARRIVAL</span><strong>{prediction.estimatedArrival}</strong></div>
                  <div><span>50% LIKELY RANGE</span><strong>{prediction.fiftyRange}</strong></div>
                  <div><span>80% LIKELY RANGE</span><strong>{prediction.eightyRange}</strong></div>
                </div>
                <p className="modal-warning">This prediction cannot be changed, transferred, released, or replaced.</p>
                <button type="button" className="primary-action full" onClick={viewMyBlock}>VIEW ON MAP</button>
              </>
            )}
          </section>
        </div>
      )}

      <footer className="site-footer page-width">
        <a className="brand" href="#top"><span className="brand-mark">₿</span><span>WEN BITCOIN <b>$1M?</b></span></a>
        <div className="footer-links"><a href="#about">About</a><a href="#map">Map</a><a href="#top">Back to top</a></div>
        <span className="footer-status"><span className="status-pip green" /> LOCK FLOW / DEMO</span>
      </footer>
    </div>
  );
}