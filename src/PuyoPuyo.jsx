import React, { useEffect, useRef, useState } from "react";

// --- Config ---
const COLS = 6;
const ROWS = 12;
const CELL = 32; // px
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const COLORS = [
  "#e74c3c", // red
  "#27ae60", // green
  "#2980b9", // blue
  "#f1c40f", // yellow
  "#9b59b6", // purple
];

// Game speeds (ms per tick)
const BASE_TICK = 700;
const SOFT_DROP_TICK = 60;

// --- Types ---
/** grid[r][c] = null | colorIndex (0..COLORS.length-1) */

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randColor() {
  return Math.floor(Math.random() * COLORS.length);
}

// child relative offsets per orientation (0: up, 1: right, 2: down, 3: left)
const CHILD_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function canPlace(grid, cells) {
  for (const { x, y } of cells) {
    if (!inBounds(x, y)) return false;
    if (grid[y][x] !== null) return false;
  }
  return true;
}

function getPieceCells(piece) {
  const { x, y, orientation, colors } = piece;
  const child = CHILD_OFFSETS[orientation];
  return [
    { x, y, color: colors[0] },
    { x: x + child.x, y: y + child.y, color: colors[1] },
  ];
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function paintPieceOnto(grid, piece) {
  const g = cloneGrid(grid);
  for (const cell of getPieceCells(piece)) {
    if (inBounds(cell.x, cell.y)) g[cell.y][cell.x] = cell.color;
  }
  return g;
}

function spawnPiece() {
  return {
    x: Math.floor(COLS / 2),
    y: 0,
    orientation: 2, // child below by default
    colors: [randColor(), randColor()],
  };
}

function findClusters(grid) {
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const clusters = [];

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const color = grid[y][x];
      if (color === null || visited[y][x]) continue;
      const stack = [[x, y]];
      const cells = [];
      visited[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx,
            ny = cy + dy;
          if (inBounds(nx, ny) && !visited[ny][nx] && grid[ny][nx] === color) {
            visited[ny][nx] = true;
            stack.push([nx, ny]);
          }
        }
      }
      if (cells.length >= 4) clusters.push({ color, cells });
    }
  }

  return clusters;
}

function clearClusters(grid, clusters) {
  const g = cloneGrid(grid);
  for (const cl of clusters) {
    for (const [x, y] of cl.cells) g[y][x] = null;
  }
  return g;
}

function applyGravity(grid) {
  const g = cloneGrid(grid);
  for (let x = 0; x < COLS; x++) {
    let write = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (g[y][x] !== null) {
        const val = g[y][x];
        g[y][x] = null;
        g[write][x] = val;
        write--;
      }
    }
  }
  return g;
}

function drawGrid(ctx, grid) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // background
  ctx.fillStyle = "#0b132b";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // cells
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = grid[y][x];
      if (v !== null) {
        const px = x * CELL;
        const py = y * CELL;
        const color = COLORS[v];
        // bubble style
        const r = CELL * 0.42;
        const cx = px + CELL / 2;
        const cy = py + CELL / 2;
        const grad = ctx.createRadialGradient(
          cx - r * 0.4,
          cy - r * 0.4,
          r * 0.2,
          cx,
          cy,
          r,
        );
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.15, color);
        grad.addColorStop(1, "#111111");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // grid line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

function drawPiece(ctx, piece) {
  const cells = getPieceCells(piece);
  for (const { x, y, color } of cells) {
    if (!inBounds(x, y)) continue;
    const px = x * CELL;
    const py = y * CELL;
    const r = CELL * 0.42;
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    const base = COLORS[color];
    const grad = ctx.createRadialGradient(
      cx - r * 0.4,
      cy - r * 0.4,
      r * 0.2,
      cx,
      cy,
      r,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.15, base);
    grad.addColorStop(1, "#111111");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function within(grid, x, y) {
  return inBounds(x, y) && grid[y][x] === null;
}

function tryMove(grid, piece, dx, dy) {
  const np = { ...piece, x: piece.x + dx, y: piece.y + dy };
  const cells = getPieceCells(np).map(({ x, y }) => ({ x, y }));
  if (canPlace(grid, cells)) return np;
  return piece;
}

function tryRotate(grid, piece, dir = 1) {
  let next = { ...piece, orientation: (piece.orientation + dir + 4) % 4 };
  let cells = getPieceCells(next).map(({ x, y }) => ({ x, y }));
  if (canPlace(grid, cells)) return next;
  // simple wall kicks: try move left/right
  for (const dx of [-1, 1, -2, 2]) {
    const kicked = { ...next, x: next.x + dx };
    cells = getPieceCells(kicked).map(({ x, y }) => ({ x, y }));
    if (canPlace(grid, cells)) return kicked;
  }
  return piece;
}

export default function App() {
  const canvasRef = useRef(null);

  const [grid, setGrid] = useState(emptyGrid);
  const [piece, setPiece] = useState(spawnPiece);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [chains, setChains] = useState(0);
  const [softDrop, setSoftDrop] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawGrid(ctx, grid);
    if (!gameOver) drawPiece(ctx, piece);
  }, [grid, piece, gameOver]);

  // keyboard
  useEffect(() => {
    function onKey(e) {
      if (!running || gameOver) return;
      if (e.key === "ArrowLeft") {
        setPiece((p) => tryMove(grid, p, -1, 0));
      } else if (e.key === "ArrowRight") {
        setPiece((p) => tryMove(grid, p, 1, 0));
      } else if (e.key === "ArrowDown") {
        setSoftDrop(true);
      } else if (e.key === "ArrowUp" || e.key === "x") {
        setPiece((p) => tryRotate(grid, p, 1));
      } else if (e.key === "z") {
        setPiece((p) => tryRotate(grid, p, -1));
      } else if (e.key === " ") {
        // hard drop
        setPiece((p) => {
          let cur = p;
          while (true) {
            const moved = tryMove(grid, cur, 0, 1);
            if (moved === cur) break;
            cur = moved;
          }
          return cur;
        });
        // lock immediately next tick
      } else if (e.key === "p") {
        setRunning((r) => !r);
      } else if (e.key === "r") {
        reset();
      }
    }
    function onKeyUp(e) {
      if (e.key === "ArrowDown") setSoftDrop(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, running, gameOver]);

  // game loop
  useEffect(() => {
    if (!running || gameOver) return;
    let cancelled = false;
    const tickMs = softDrop ? SOFT_DROP_TICK : BASE_TICK;

    const tick = () => {
      if (cancelled) return;
      setPiece((p) => {
        const moved = tryMove(grid, p, 0, 1);
        if (moved === p) {
          // lock
          let g = paintPieceOnto(grid, p);
          // check clusters with cascading
          let totalCleared = 0;
          let chain = 0;
          while (true) {
            const clusters = findClusters(g);
            if (clusters.length === 0) break;
            chain += 1;
            const cleared = clusters.reduce(
              (acc, c) => acc + c.cells.length,
              0,
            );
            totalCleared += cleared;
            g = clearClusters(g, clusters);
            g = applyGravity(g);
          }
          if (chain > 0) {
            setChains(chain);
            setScore((s) => s + totalCleared * 10 * chain);
          } else {
            setChains(0);
          }
          // spawn next
          const next = spawnPiece();
          const cells = getPieceCells(next).map(({ x, y }) => ({ x, y }));
          if (!canPlace(g, cells)) {
            setGrid(g);
            setGameOver(true);
            setRunning(false);
            return p; // keep piece for draw suppression
          }
          setGrid(g);
          return next;
        }
        return moved;
      });
    };

    const id = setInterval(tick, tickMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [grid, running, softDrop, gameOver]);

  function reset() {
    setGrid(emptyGrid());
    setPiece(spawnPiece());
    setScore(0);
    setChains(0);
    setGameOver(false);
    setRunning(true);
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
        <div className="bg-slate-800 rounded-2xl p-4 shadow-xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-xl border border-slate-700"
          />
        </div>
        <div className="space-y-4 max-w-sm">
          <h1 className="text-2xl font-bold">ぷよぷよ（簡易版）</h1>
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="SCORE" value={score.toLocaleString()} />
            <InfoCard label="CHAINS" value={chains} />
            <InfoCard
              label="STATE"
              value={running ? (gameOver ? "GAME OVER" : "PLAY") : "PAUSE"}
            />
          </div>
          <div className="bg-slate-800 rounded-xl p-4 leading-relaxed text-sm border border-slate-700">
            <p className="font-semibold mb-1">操作方法</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>← → : 移動</li>
              <li>↑ / X : 右回転</li>
              <li>Z : 左回転</li>
              <li>↓ : ソフトドロップ</li>
              <li>Space : ハードドロップ</li>
              <li>P : 一時停止 / 再開</li>
              <li>R : リセット</li>
            </ul>
          </div>
          <div className="text-xs text-slate-400">
            4個以上つながると消滅。連鎖が発生するとボーナス加点されます。
          </div>
          {gameOver && (
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition shadow"
            >
              もう一度！
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-3">
      <div className="text-[10px] tracking-widest text-slate-400">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
