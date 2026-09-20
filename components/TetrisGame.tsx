'use client';

import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bird,
  ChevronLeft,
  Moon,
  Pause,
  Play,
  RotateCw,
  Sun,
} from 'lucide-react';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_CELLS,
  PIECE_COLORS,
  PIECE_SIZES,
  type TetrisAction,
  createTetrisState,
  dropDistance,
  gravityDelayMs,
  tetrisReducer,
} from '@/lib/game/tetris';

interface ViewCell {
  id: number | null;
  ghost: boolean;
}

interface HighScoreSnapshot {
  high: number;
  beaten: boolean;
}

const SERVER_SNAPSHOT: HighScoreSnapshot = { high: 0, beaten: false };
let cachedSnapshot: HighScoreSnapshot = SERVER_SNAPSHOT;
const highScoreListeners = new Set<() => void>();

const highScoreStore = {
  subscribe(listener: () => void) {
    highScoreListeners.add(listener);
    return () => {
      highScoreListeners.delete(listener);
    };
  },
  getSnapshot(): HighScoreSnapshot {
    if (typeof window === 'undefined') return SERVER_SNAPSHOT;
    const high = Number(localStorage.getItem('tetris-high-score')) || 0;
    if (high !== cachedSnapshot.high) {
      cachedSnapshot = { high, beaten: false };
    }
    return cachedSnapshot;
  },
  getServerSnapshot(): HighScoreSnapshot {
    return SERVER_SNAPSHOT;
  },
  record(score: number) {
    if (typeof window === 'undefined') return;
    const high = Number(localStorage.getItem('tetris-high-score')) || 0;
    const beaten = score > high;
    if (beaten) localStorage.setItem('tetris-high-score', String(score));
    const next: HighScoreSnapshot = { high: Math.max(high, score), beaten };
    if (next.high !== cachedSnapshot.high || next.beaten !== cachedSnapshot.beaten) {
      cachedSnapshot = next;
      highScoreListeners.forEach((listener) => listener());
    }
  },
  clearBeaten() {
    if (cachedSnapshot.beaten) {
      cachedSnapshot = { ...cachedSnapshot, beaten: false };
      highScoreListeners.forEach((listener) => listener());
    }
  },
};

const KEYBINDINGS: { keys: string; action: string }[] = [
  { keys: '\u2190 \u2192', action: 'Move' },
  { keys: '\u2193', action: 'Soft drop' },
  { keys: '\u2191 / X', action: 'Rotate CW' },
  { keys: 'Z', action: 'Rotate CCW' },
  { keys: 'Space', action: 'Hard drop' },
  { keys: 'C', action: 'Hold' },
  { keys: 'P', action: 'Pause' },
  { keys: 'R', action: 'Restart' },
];

const TOUCH_BUTTONS: { label: string; icon: typeof ArrowLeft; action: TetrisAction }[] = [
  { label: 'Move left', icon: ArrowLeft, action: { type: 'move', dx: -1 } },
  { label: 'Move right', icon: ArrowRight, action: { type: 'move', dx: 1 } },
  { label: 'Rotate', icon: RotateCw, action: { type: 'rotate', dir: 1 } },
  { label: 'Soft drop', icon: ArrowDown, action: { type: 'softDrop' } },
  { label: 'Hard drop', icon: ArrowDownToLine, action: { type: 'hardDrop' } },
  { label: 'Hold piece', icon: ArrowLeftRight, action: { type: 'hold' } },
];

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">{label}</span>
      <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function MiniPiece({ id }: { id: number | null }) {
  if (id === null) {
    return <div className="h-12 flex items-center justify-center text-sm text-[var(--text-secondary)]">-</div>;
  }
  const size = PIECE_SIZES[id];
  const cells = PIECE_CELLS[id][0];
  return (
    <div className="h-12 flex items-center justify-center">
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, 12px)` }}>
        {Array.from({ length: size * size }, (_, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const filled = cells.some(([cr, cc]) => cr === r && cc === c);
          return filled ? (
            <div
              key={i}
              className="w-3 h-3 rounded-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.2)]"
              style={{ backgroundColor: PIECE_COLORS[id] }}
            />
          ) : (
            <div key={i} className="w-3 h-3" />
          );
        })}
      </div>
    </div>
  );
}

function TetrisCell({ cell }: { cell: ViewCell }) {
  if (cell.ghost) {
    const color = PIECE_COLORS[cell.id ?? 0] || '#888';
    return (
      <div
        className="w-6 h-6 rounded-[3px] border-2 opacity-50"
        style={{ borderColor: color, backgroundColor: `${color}1a` }}
      />
    );
  }
  if (cell.id === null) {
    return (
      <div className="w-6 h-6 rounded-[3px] bg-[var(--warm-sand)] border border-[var(--border-light)]" />
    );
  }
  return (
    <div
      className="w-6 h-6 rounded-[3px] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-2px_0_rgba(0,0,0,0.25)]"
      style={{ backgroundColor: PIECE_COLORS[cell.id] }}
    />
  );
}

export default function TetrisGame() {
  const [state, dispatch] = useReducer(tetrisReducer, undefined, createTetrisState);
  const highScore = useSyncExternalStore(
    highScoreStore.subscribe,
    highScoreStore.getSnapshot,
    highScoreStore.getServerSnapshot,
  );

  useEffect(() => {
    if (state.status !== 'over') return;
    highScoreStore.record(state.score);
  }, [state.status, state.score]);

  useEffect(() => {
    if (state.status === 'playing') highScoreStore.clearBeaten();
  }, [state.status]);

  const gravityMs = state.status === 'playing' ? gravityDelayMs(state.level) : null;

  useEffect(() => {
    if (gravityMs === null) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), gravityMs);
    return () => clearInterval(id);
  }, [gravityMs]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          dispatch({ type: 'move', dx: -1 });
          break;
        case 'ArrowRight':
          event.preventDefault();
          dispatch({ type: 'move', dx: 1 });
          break;
        case 'ArrowDown':
          event.preventDefault();
          dispatch({ type: 'softDrop' });
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          event.preventDefault();
          dispatch({ type: 'rotate', dir: 1 });
          break;
        case 'z':
        case 'Z':
          event.preventDefault();
          dispatch({ type: 'rotate', dir: -1 });
          break;
        case ' ':
          event.preventDefault();
          dispatch({ type: 'hardDrop' });
          break;
        case 'c':
        case 'C':
          event.preventDefault();
          dispatch({ type: 'hold' });
          break;
        case 'p':
        case 'P':
        case 'Escape':
          event.preventDefault();
          dispatch({ type: 'togglePause' });
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          dispatch({ type: 'reset' });
          break;
        case 'Enter':
          dispatch({ type: 'start' });
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (state.status !== 'playing') return;
    const pause = () => dispatch({ type: 'togglePause' });
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.status]);

  const view = useMemo<ViewCell[][]>(() => {
    const grid: ViewCell[][] = state.board.map((row) => row.map((id) => ({ id, ghost: false })));
    if (state.piece && state.status !== 'idle') {
      const { piece } = state;
      const dy = dropDistance(state.board, piece);
      for (const [r, c] of PIECE_CELLS[piece.id][piece.rot]) {
        const row = piece.y + dy + r;
        const col = piece.x + c;
        if (row >= 0 && row < BOARD_HEIGHT && col >= 0 && col < BOARD_WIDTH) {
          grid[row][col] = { id: null, ghost: true };
        }
      }
      for (const [r, c] of PIECE_CELLS[piece.id][piece.rot]) {
        const row = piece.y + r;
        const col = piece.x + c;
        if (row >= 0 && row < BOARD_HEIGHT && col >= 0 && col < BOARD_WIDTH) {
          grid[row][col] = { id: piece.id, ghost: false };
        }
      }
    }
    return grid;
  }, [state]);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const nextQueue = state.queue.slice(0, 3);
  const newHigh = state.status === 'over' && highScore.beaten && highScore.high === state.score;
  const overlay =
    state.status === 'idle' || state.status === 'paused' || state.status === 'over' ? state.status : null;

  return (
    <div className="min-h-screen bg-[var(--warm-cream)]">
      <header className="bg-[var(--accent-teal)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 no-underline text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-xl"
          >
            <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Bird className="w-5 h-5 text-[var(--brand-green-light)]" />
                Tetris
              </h1>
              <p className="text-sm text-white/70 hidden sm:block">
                A quick arcade break between birding trips
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            <Moon className="w-4 h-4 dark:hidden" />
            <Sun className="hidden w-4 h-4 dark:block" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="py-8 sm:py-12 flex flex-col xl:flex-row items-center xl:items-start justify-center gap-5 xl:gap-8">
          <div className="order-2 xl:order-1 flex sm:flex-row xl:flex-col gap-4 w-full xl:w-44 justify-center">
            <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-4 flex-1 xl:w-full">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                Hold
              </h2>
              <MiniPiece id={state.hold} />
            </div>
            <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-4 flex-1 xl:w-full space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                Stats
              </h2>
              <StatRow label="Score" value={state.score} />
              <StatRow label="Best" value={highScore.high} />
              <StatRow label="Level" value={state.level} />
              <StatRow label="Lines" value={state.lines} />
            </div>
          </div>

          <div className="order-1 xl:order-2 flex flex-col items-center gap-4">
            <div className="relative rounded-xl border-2 border-[var(--border-light)] bg-[var(--warm-cream)] p-1.5 shadow-lg">
              <div className="grid grid-cols-[repeat(10,24px)]">
                {view.flatMap((row, r) =>
                  row.map((cell, c) => <TetrisCell key={`${r}-${c}`} cell={cell} />),
                )}
              </div>

              {overlay && (
                <div className="absolute inset-0 rounded-lg bg-[var(--accent-teal)]/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center">
                  {state.status === 'idle' && (
                    <>
                      <h2 className="text-2xl font-bold mb-2">Ready?</h2>
                      <p className="text-sm text-white/70 mb-5">Arrow keys to move, space to drop</p>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'start' })}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
                      >
                        <Play className="w-4 h-4" />
                        Start game
                      </button>
                    </>
                  )}
                  {state.status === 'paused' && (
                    <>
                      <h2 className="text-2xl font-bold mb-2">Paused</h2>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'togglePause' })}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    </>
                  )}
                  {state.status === 'over' && (
                    <>
                      <h2 className="text-2xl font-bold mb-2">Game over</h2>
                      <p className="text-sm text-white/70 mb-1">
                        Score <span className="font-bold text-white tabular-nums">{state.score}</span>
                        {' '}&middot; {state.lines} lines &middot; level {state.level}
                      </p>
                      {newHigh && (
                        <p className="text-sm font-semibold text-[var(--brand-green-light)] mb-1">
                          New personal best!
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'start' })}
                        className="mt-3 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
                      >
                        <Play className="w-4 h-4" />
                        Play again
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div
              className="grid grid-cols-6 gap-2 w-full max-w-[264px] select-none"
              onContextMenu={(e) => e.preventDefault()}
            >
              {TOUCH_BUTTONS.map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    dispatch(action);
                  }}
                  className="h-11 rounded-xl bg-[var(--warm-sand)] border border-[var(--border-light)] hover:bg-[var(--border-light)] active:scale-95 transition flex items-center justify-center text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]"
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="order-3 flex sm:flex-row xl:flex-col gap-4 w-full xl:w-44 justify-center">
            <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-4 flex-1 xl:w-full">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                Next
              </h2>
              <div className="space-y-1">
                {nextQueue.map((id, i) => (
                  <MiniPiece key={`${i}-${id}`} id={id} />
                ))}
              </div>
            </div>
            <div className="bg-[var(--warm-sand)] border border-[var(--border-light)] rounded-2xl p-4 flex-1 xl:w-full">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                Keys
              </h2>
              <dl className="space-y-1.5">
                {KEYBINDINGS.map(({ keys, action }) => (
                  <div key={action} className="flex items-center justify-between gap-2 text-sm">
                    <dt className="font-mono text-xs bg-[var(--warm-cream)] border border-[var(--border-light)] rounded px-1.5 py-0.5 text-[var(--text-primary)]">
                      {keys}
                    </dt>
                    <dd className="text-[var(--text-secondary)]">{action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="pb-8">
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'togglePause' })}
            disabled={state.status !== 'playing' && state.status !== 'paused'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--warm-sand)] border border-[var(--border-light)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-light)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pause className="w-4 h-4" />
            {state.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'reset' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--warm-sand)] border border-[var(--border-light)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-light)] transition"
          >
            <RotateCw className="w-4 h-4" />
            Restart
          </button>
        </div>
      </footer>
    </div>
  );
}
