import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Crosshair,
  Search,
  SlidersHorizontal,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  blockToCoordinate,
  blockToTimelineX,
  coordinateToBlock,
  getGridDimensions,
} from "@/lib/block-map-model";

type ViewMode = "block" | "time";
type YearPoint = { year: number; block: number };

const DEMO_CURRENT_BLOCK = 914_280;
const DEMO_NOW = new Date("2026-09-10T00:00:00Z");
const BLOCK_INTERVAL_MS = 10 * 60 * 1000;
const WINDOW_END = new Date("2038-01-01T00:00:00Z");
const BLOCKS_PER_YEAR = Math.round((365.25 * 24 * 60 * 60 * 1000) / BLOCK_INTERVAL_MS);

function blockForDate(date: Date) {
  return Math.round(DEMO_CURRENT_BLOCK + (date.getTime() - DEMO_NOW.getTime()) / BLOCK_INTERVAL_MS);
}

const MAP_START_BLOCK = DEMO_CURRENT_BLOCK;
const MAP_END_BLOCK = blockForDate(WINDOW_END);
const MAP_BLOCK_COUNT = MAP_END_BLOCK - MAP_START_BLOCK + 1;

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

function estimateBlock(block: number) {
  const blocksAhead = Math.max(0, block - DEMO_CURRENT_BLOCK);
  const likelyDate = new Date(DEMO_NOW.getTime() + blocksAhead * BLOCK_INTERVAL_MS);
  // The uncertainty grows with the square root of the number of future blocks.
  // This is deliberately a transparent Stage 1 estimate, not a promise.
  const uncertaintyDays = Math.max(45, Math.round(Math.sqrt(blocksAhead) * 0.7));
  const fiftyStart = new Date(likelyDate.getTime() - uncertaintyDays * 0.5 * 86_400_000);
  const fiftyEnd = new Date(likelyDate.getTime() + uncertaintyDays * 0.5 * 86_400_000);
  const eightyStart = new Date(likelyDate.getTime() - uncertaintyDays * 0.95 * 86_400_000);
  const eightyEnd = new Date(likelyDate.getTime() + uncertaintyDays * 0.95 * 86_400_000);

  return {
    likely: formatMonth(likelyDate),
    fifty: formatRange(fiftyStart, fiftyEnd),
    eighty: formatRange(eightyStart, eightyEnd),
  };
}

const CLAIMED_BLOCKS = [
  blockForDate(new Date("2029-07-01T00:00:00Z")),
  blockForDate(new Date("2031-11-01T00:00:00Z")),
  blockForDate(new Date("2033-06-01T00:00:00Z")),
  blockForDate(new Date("2035-03-01T00:00:00Z")),
  blockForDate(new Date("2037-09-01T00:00:00Z")),
];

function isClaimed(block: number) {
  return CLAIMED_BLOCKS.includes(block);
}

function BlockCanvas({
  currentBlock,
  selectedBlock,
  viewMode,
  onSelect,
}: {
  currentBlock: number;
  selectedBlock: number;
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

  const mapMin = MAP_START_BLOCK;
  const mapMax = MAP_END_BLOCK;
  const baseCellSize = 9;
  const defaultColumns = Math.max(24, Math.floor(viewport.width / baseCellSize));
  const blocksPerColumn = Math.ceil(MAP_BLOCK_COUNT / defaultColumns);
  const dimensions = getGridDimensions(mapMin, mapMax, blocksPerColumn);
  const selectedCoordinate = blockToCoordinate(selectedBlock, mapMin, blocksPerColumn);
  const rawNowX = blockToTimelineX(currentBlock, mapMin, blocksPerColumn, baseCellSize * zoom, pan.x);
  const visibleNowX = Math.min(viewport.width, Math.max(0, rawNowX));

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
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = isClaimed(block)
            ? "#f7931a"
            : block < currentBlock
              ? "rgba(155,161,169,0.28)"
              : "rgba(215,220,226,0.76)";
          ctx.fill();
        }
      }

      // Year divisions are vertical because chronology advances by column.
      // Labels remain exclusively on the bottom x-axis.
      for (let year = 2028; year <= 2038; year += 1) {
        const yearBlock = blockForDate(new Date(`${year}-01-01T00:00:00Z`));
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
  }, [baseCellSize, blocksPerColumn, currentBlock, dimensions.columns, dimensions.rows, hoveredBlock, mapMax, mapMin, pan, selectedBlock, selectedCoordinate.column, selectedCoordinate.row, viewMode, viewport, zoom]);

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
            const year = 2028 + index;
            const block = blockForDate(new Date(`${year}-01-01T00:00:00Z`));
            const x = blockToTimelineX(block, mapMin, blocksPerColumn, baseCellSize * zoom, pan.x);
            return <span key={year} style={{ left: `${x}px` }}>{year}</span>;
          })}
        </div>
      </div>
      {hoveredBlock !== null && (
        <div className="map-hover-readout" role="status">
          <span>{formatBlock(hoveredBlock)}</span>
          <span>{estimateBlock(hoveredBlock).likely}</span>
          <span className={isClaimed(hoveredBlock) ? "orange-text" : "green-text"}>{isClaimed(hoveredBlock) ? "CLAIMED" : "AVAILABLE"}</span>
        </div>
      )}
    </div>
  );
}

const years = Array.from({ length: 11 }, (_, index) => {
  const year = 2028 + index;
  return { year, block: blockForDate(new Date(`${year}-01-01T00:00:00Z`)) };
});

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
  const [selectedBlock, setSelectedBlock] = useState(() => years[5].block + Math.round(BLOCKS_PER_YEAR * 0.45));
  const [viewMode, setViewMode] = useState<ViewMode>("block");
  const [searchValue, setSearchValue] = useState("");
  const [jumpYear, setJumpYear] = useState("2033");
  const [notice, setNotice] = useState("");
  const estimate = useMemo(() => estimateBlock(selectedBlock), [selectedBlock]);
  const selectedIsClaimed = isClaimed(selectedBlock);

  useEffect(() => {
    if (window.location.hash !== "#map") return;
    const frame = window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    if (target) selectBlock(target.block + Math.round(BLOCKS_PER_YEAR * 0.45));
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
              <span><i className="legend-dot claimed" /> Claimed</span>
              <span><i className="legend-dot selected" /> Selected</span>
            </div>
          </div>
          <div className="map-card">
            <div className="map-card-topline">
              <span>NOW — 2038 / CHRONOLOGICAL BLOCK FIELD</span>
              <span><SlidersHorizontal size={14} /> SCROLL TO EXPLORE</span>
            </div>
            <BlockCanvas currentBlock={DEMO_CURRENT_BLOCK} selectedBlock={selectedBlock} viewMode={viewMode} onSelect={selectBlock} />
            <div className="map-card-footer">
              <span><span className="status-pip orange" /> NOW IS {formatBlock(DEMO_CURRENT_BLOCK)}</span>
              <span>{MAP_BLOCK_COUNT.toLocaleString("en-US")} UNIQUE BLOCKS / ONE DOT EACH / OFFSCREEN BLOCKS VIRTUALIZED</span>
            </div>
          </div>
        </section>

        <section className="insight-grid page-width">
          <div className="selection-card">
            <div className="card-label"><span className="section-kicker">03 / YOUR SELECTION</span><span className={selectedIsClaimed ? "status claimed" : "status"}>{selectedIsClaimed ? "CLAIMED" : "AVAILABLE"}</span></div>
            <div className="selected-block">{formatBlock(selectedBlock)}</div>
            <p className="selection-lede">Your prediction is a block, not a date.</p>
            <div className="estimate-grid">
              <div><span>ESTIMATED ARRIVAL</span><strong>{estimate.likely}</strong></div>
              <div><span>50% LIKELY RANGE</span><strong>{estimate.fifty}</strong></div>
              <div><span>80% LIKELY RANGE</span><strong>{estimate.eighty}</strong></div>
            </div>
            <div className="nearby-row">
              <span>PREDICTIONS NEARBY</span>
              <span>±10 <b>{(selectedBlock % 5) + 2}</b></span>
              <span>±100 <b>{(selectedBlock % 17) + 8}</b></span>
              <span>±1,000 <b>{(selectedBlock % 90) + 30}</b></span>
            </div>
            <button
              type="button"
              className="lock-button"
              onClick={() => setNotice("Locking is reserved for the Stage 4 test-payment flow. Your block is still previewed here for free.")}
            >
              LOCK THIS BLOCK FOR $1 <ArrowRight size={16} />
            </button>
            <p className="estimate-disclaimer">Estimated from recent Bitcoin block production. Actual timing will vary.</p>
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

      <footer className="site-footer page-width">
        <a className="brand" href="#top"><span className="brand-mark">₿</span><span>WEN BITCOIN <b>$1M?</b></span></a>
        <div className="footer-links"><a href="#about">About</a><a href="#map">Map</a><a href="#top">Back to top</a></div>
        <span className="footer-status"><span className="status-pip green" /> STAGE 1 / DEMO</span>
      </footer>
    </div>
  );
}