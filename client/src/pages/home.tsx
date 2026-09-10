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

type ViewMode = "block" | "time";
type YearPoint = { year: number; block: number };

const DEMO_CURRENT_BLOCK = 914_280;
const DEMO_NOW = new Date("2026-09-10T00:00:00Z");
const BLOCK_INTERVAL_MS = 10 * 60 * 1000;
const WINDOW_START = new Date("2028-01-01T00:00:00Z");
const WINDOW_END = new Date("2038-01-01T00:00:00Z");
const BLOCKS_PER_YEAR = Math.round((365.25 * 24 * 60 * 60 * 1000) / BLOCK_INTERVAL_MS);

function blockForDate(date: Date) {
  return Math.round(DEMO_CURRENT_BLOCK + (date.getTime() - DEMO_NOW.getTime()) / BLOCK_INTERVAL_MS);
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

function isClaimed(block: number) {
  const claimed = [
    blockForDate(new Date("2029-07-01T00:00:00Z")),
    blockForDate(new Date("2031-11-01T00:00:00Z")),
    blockForDate(new Date("2033-06-01T00:00:00Z")),
    blockForDate(new Date("2035-03-01T00:00:00Z")),
    blockForDate(new Date("2037-09-01T00:00:00Z")),
  ];
  return claimed.some((claimedBlock) => Math.abs(claimedBlock - block) < 350);
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
  const dragRef = useRef<{ x: number; pan: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);

  const mapMin = blockForDate(WINDOW_START);
  const mapMax = blockForDate(WINDOW_END);

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

      const plotTop = 34;
      const plotBottom = height - 28;
      const plotHeight = plotBottom - plotTop;
      const range = mapMax - mapMin;
      const xForBlock = (block: number) => ((block - mapMin) / range) * width * zoom + pan;
      const blockForX = (x: number) =>
        Math.min(mapMax, Math.max(mapMin, mapMin + ((x - pan) / (width * zoom)) * range));

      ctx.fillStyle = "#111316";
      ctx.fillRect(0, 0, width, height);

      for (let year = 2028; year <= 2037; year += 1) {
        const x = xForBlock(blockForDate(new Date(`${year}-01-01T00:00:00Z`)));
        if (x < -1 || x > width + 1) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.065)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotTop);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
      }

      const nowX = xForBlock(currentBlock);
      if (nowX > -2 && nowX < width + 2) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "#f7931a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nowX, 18);
        ctx.lineTo(nowX, plotBottom + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#f7931a";
        ctx.font = "600 10px 'IBM Plex Mono', monospace";
        ctx.fillText(viewMode === "block" ? "NOW · BLOCK" : "NOW · 2026", Math.max(8, nowX - 30), 14);
      }

      const step = zoom < 1.35 ? 240 : zoom < 2.25 ? 38 : 1;
      const dotRadius = zoom < 1.35 ? 1.45 : zoom < 2.25 ? 1.8 : 2.3;
      for (let block = mapMin; block <= mapMax; block += step) {
        const x = xForBlock(block);
        if (x < -4 || x > width + 4) continue;
        const normalized = (block - mapMin) / range;
        const row = (Math.floor(block / step) * 17) % 9;
        const y = plotTop + 18 + ((row + normalized * 2) % 9) * ((plotHeight - 35) / 9);
        const past = block < currentBlock;
        const claimed = isClaimed(block);
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = claimed ? "#f7931a" : past ? "rgba(161,167,175,0.18)" : "rgba(215,220,226,0.72)";
        ctx.fill();
      }

      const selectedX = xForBlock(selectedBlock);
      if (selectedX > -8 && selectedX < width + 8) {
        ctx.strokeStyle = "#b5f36c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(selectedX, 20);
        ctx.lineTo(selectedX, plotBottom + 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(selectedX, plotTop + plotHeight * 0.45, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(181,243,108,0.9)";
        ctx.stroke();
      }

      if (hoveredBlock !== null) {
        const hoveredX = xForBlock(hoveredBlock);
        if (hoveredX > -8 && hoveredX < width + 8) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hoveredX, plotTop);
          ctx.lineTo(hoveredX, plotBottom);
          ctx.stroke();
        }
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [currentBlock, hoveredBlock, mapMax, mapMin, pan, selectedBlock, viewMode, zoom]);

  const blockFromPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return mapMin;
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    return Math.min(mapMax, Math.max(mapMin, Math.round(mapMin + ((localX - pan) / (rect.width * zoom)) * (mapMax - mapMin))));
  };

  return (
    <div className="map-canvas-shell">
      <div className="map-controls" aria-label="Map controls">
        <div className="map-control-group">
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.max(1, value / 1.35))} aria-label="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-button" onClick={() => setZoom((value) => Math.min(3.8, value * 1.35))} aria-label="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button type="button" className="icon-button" onClick={() => { setZoom(1); setPan(0); }} aria-label="Reset map">
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
          const nextZoom = Math.min(3.8, Math.max(1, zoom * (event.deltaY > 0 ? 0.88 : 1.12)));
          setPan(cursorX - (cursorX - pan) * (nextZoom / zoom));
          setZoom(nextZoom);
        }}
      >
        <canvas
          ref={canvasRef}
          className="block-canvas"
          aria-label="Interactive projected Bitcoin block map"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, pan };
          }}
          onPointerMove={(event) => {
            if (dragRef.current) {
              setPan(dragRef.current.pan + event.clientX - dragRef.current.x);
            } else {
              setHoveredBlock(blockFromPointer(event));
            }
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (drag && Math.abs(event.clientX - drag.x) < 5) {
              onSelect(blockFromPointer(event));
            }
          }}
          onPointerCancel={() => { dragRef.current = null; }}
          onPointerLeave={() => setHoveredBlock(null)}
        />
      </div>
      <div className="map-axis" aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => {
          const year = 2028 + index;
          const block = blockForDate(new Date(`${year}-01-01T00:00:00Z`));
          return (
            <span key={year} style={{ left: `${((block - mapMin) / (mapMax - mapMin)) * 100}%` }}>
              {viewMode === "block" ? formatBlock(block) : year}
            </span>
          );
        })}
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
              <span>2028 — 2038 / PROJECTED BLOCKS</span>
              <span><SlidersHorizontal size={14} /> SCROLL TO EXPLORE</span>
            </div>
            <BlockCanvas currentBlock={DEMO_CURRENT_BLOCK} selectedBlock={selectedBlock} viewMode={viewMode} onSelect={selectBlock} />
            <div className="map-card-footer">
              <span><span className="status-pip orange" /> NOW IS {formatBlock(DEMO_CURRENT_BLOCK)}</span>
              <span>~ 525,000 FUTURE BLOCKS / VISUALIZED AT MULTIPLE SCALES</span>
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