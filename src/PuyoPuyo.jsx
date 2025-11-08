import React, { useEffect, useState, useRef } from "react";

// PuyoPuyoGame.jsx
// Single-file React component. Tailwind CSS assumed available in the project.
// Controls: Left / Right arrows to move, Down to speed drop, Up to rotate (swap pair), Space to hard-drop.

const COLS = 6;
const ROWS = 12;
const EMPTY = null;
const PUYO_COLORS = ["#ff4d4f", "#40a9ff", "#ffd666", "#73d13d", "#9254de"]; // red, blue, yellow, green, purple

function randColor() {
  return PUYO_COLORS[Math.floor(Math.random() * PUYO_COLORS.length)];
}

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => EMPTY));
}

function EyePuyo({ color, size = 36 }) {
  // A simple circular puyo with an eyeball using SVG
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="50" cy="50" r="40" fill={color} />
        <circle cx="50" cy="42" r="18" fill="#fff" />
        <circle cx="50" cy="42" r="8" fill="#111" />
        {/* a little glint */}
        <circle cx="44" cy="36" r="3" fill="#fff" />
      </g>
    </svg>
  );
}

export default function PuyoPuyoGame() {
  const [grid, setGrid] = useState(createEmptyGrid);
  const [current, setCurrent] = useState(null); // { blocks: [{r,c,color}, ...], dir: 0 }
  const [tickInterval, setTickInterval] = useState(600);
  const [running, setRunning] = useState(true);
  const droppedRef = useRef(false);

  // spawn a new pair: primary at top middle, secondary above it or to the right depending on orientation
  function spawnNew() {
    const mid = Math.floor(COLS / 2) - 1;
    const colorA = randColor();
    const colorB = randColor();
    // position primary at row 0, col mid
    const newPair = {
      blocks: [
        { r: 0, c: mid, color: colorA }, // primary
        { r: -1, c: mid, color: colorB }, // secondary above
      ],
      dir: 0, // 0: up, 1: right, 2: down, 3: left (dir is orientation of the secondary relative to primary)
    };
    setCurrent(newPair);
  }

  // check collision if we place blocks at given positions
  function collides(blocks) {
    return blocks.some(({ r, c }) => {
      if (c < 0 || c >= COLS) return true;
      if (r >= ROWS) return true;
      if (r >= 0 && grid[r][c] !== EMPTY) return true;
      return false;
    });
  }

  // freeze current into grid
  function freezeCurrent(cur) {
    setGrid((g) => {
      const ng = g.map((row) => row.slice());
      cur.blocks.forEach(({ r, c, color }) => {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) ng[r][c] = color;
      });
      return ng;
    });
    setCurrent(null);
  }

  // apply gravity to entire grid (single step): any puyo with empty cell below falls down
  function applyGravityGrid() {
    setGrid((g) => {
      const ng = g.map((row) => row.slice());
      // start from bottom-2 upwards
      for (let r = ROWS - 2; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) {
          if (ng[r][c] !== EMPTY && ng[r + 1][c] === EMPTY) {
            ng[r + 1][c] = ng[r][c];
            ng[r][c] = EMPTY;
          }
        }
      }
      return ng;
    });
  }

  // game tick: move current down if possible, else freeze
  function tick() {
    if (!running) return;
    setCurrent((cur) => {
      if (!cur) {
        spawnNew();
        return cur;
      }
      const moved = cur.blocks.map((b) => ({ ...b, r: b.r + 1 }));
      if (!collides(moved)) {
        return { ...cur, blocks: moved };
      } else {
        // cannot move down -> freeze
        freezeCurrent(cur);
        // after freezing, let gravity act on grid a bit (so single-step falls happen)
        // we'll set a short delay to apply gravity immediately
        setTimeout(() => applyGravityGrid(), 50);
        return null;
      }
    });
  }

  // input handlers
  useEffect(() => {
    function onKey(e) {
      if (!current) return;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") {
        // try move left
        const moved = current.blocks.map((b) => ({ ...b, c: b.c - 1 }));
        if (!collides(moved)) setCurrent({ ...current, blocks: moved });
      } else if (e.key === "ArrowRight") {
        const moved = current.blocks.map((b) => ({ ...b, c: b.c + 1 }));
        if (!collides(moved)) setCurrent({ ...current, blocks: moved });
      } else if (e.key === "ArrowDown") {
        // soft drop
        const moved = current.blocks.map((b) => ({ ...b, r: b.r + 1 }));
        if (!collides(moved)) setCurrent({ ...current, blocks: moved });
      } else if (e.key === "ArrowUp") {
        // rotate clockwise: adjust secondary around primary
        // primary is blocks[0]
        const A = current.blocks[0];
        const B = current.blocks[1];
        const relR = B.r - A.r;
        const relC = B.c - A.c;
        // rotate (r,c) -> (c, -r)
        const newRelR = relC;
        const newRelC = -relR;
        const newB = { ...B, r: A.r + newRelR, c: A.c + newRelC };
        const rotated = [A, newB];
        if (!collides(rotated)) setCurrent({ ...current, blocks: rotated });
      } else if (e.key === " ") {
        // hard drop
        let temp = current.blocks.map((b) => ({ ...b }));
        while (true) {
          const moved = temp.map((b) => ({ ...b, r: b.r + 1 }));
          if (collides(moved)) break;
          temp = moved;
        }
        setCurrent((cur) => {
          if (!cur) return cur;
          freezeCurrent({ ...cur, blocks: temp });
          setTimeout(() => applyGravityGrid(), 30);
          return null;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, grid]);

  // main interval
  useEffect(() => {
    const id = setInterval(tick, tickInterval);
    return () => clearInterval(id);
  }, [tickInterval, running, grid]);

  // initial spawn
  useEffect(() => {
    spawnNew();
  }, []);

  // click board to drop single puyo at that column (for quick testing)
  function handleClickColumn(c) {
    setGrid((g) => {
      const ng = g.map((r) => r.slice());
      // find first empty from top
      for (let r = 0; r < ROWS; r++) {
        if (ng[r][c] === EMPTY) {
          ng[r][c] = randColor();
          break;
        }
      }
      return ng;
    });
  }

  return (
    <div className="p-4 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">ぷよぷよ（目玉ぷよ）</h1>
      <div className="flex gap-4">
        {/* board */}
        <div
          className="bg-slate-800 p-2 rounded-lg"
          style={{ width: COLS * 48 + 8, height: ROWS * 48 + 8 }}
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 48px)` }}>
            {Array.from({ length: ROWS }).map((_, r) =>
              Array.from({ length: COLS }).map((_, c) => {
                // determine what to render here: current block or grid
                let color = grid[r][c];
                if (current) {
                  const found = current.blocks.find((b) => b.r === r && b.c === c);
                  if (found) color = found.color;
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleClickColumn(c)}
                    className="w-12 h-12 m-1 bg-slate-700 rounded flex items-center justify-center"
                  >
                    {color ? <EyePuyo color={color} size={40} /> : <div className="w-8 h-8" />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* side panel */}
        <div className="w-48 p-3 bg-white/10 rounded">
          <div className="mb-2">Controls:</div>
          <ul className="text-sm list-disc pl-5">
            <li>← → : 左右に移動</li>
            <li>↓ : 早く落とす（ソフトドロップ）</li>
            <li>↑ : 回転</li>
            <li>Space : ハードドロップ</li>
            <li>Click column : その列に1つ落とす（テスト用）</li>
          </ul>

          <div className="mt-3">Speed:</div>
          <input
            type="range"
            min={100}
            max={1000}
            value={tickInterval}
            onChange={(e) => setTickInterval(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-3">状態</div>
          <div className="text-sm mt-1">Current: {current ? "落下中" : "なし（次で生成）"}</div>
          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-1 rounded bg-white/10"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? "Pause" : "Resume"}
            </button>
            <button
              className="px-3 py-1 rounded bg-white/10"
              onClick={() => {
                setGrid(createEmptyGrid());
                setCurrent(null);
                spawnNew();
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400">※このデモは「ぷよが下に空白があれば下に落ちる」挙動と、目玉のあるぷよの見た目を実装しています。連鎖・消去は未実装です。</div>
    </div>
  );
}
