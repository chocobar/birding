export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export type Coord = readonly [number, number];
export type Board = (number | null)[][];

export type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

const BASE_SHAPES: { cells: Coord[]; size: number }[] = [
  { cells: [[1, 0], [1, 1], [1, 2], [1, 3]], size: 4 },
  { cells: [[0, 0], [1, 0], [1, 1], [1, 2]], size: 3 },
  { cells: [[0, 2], [1, 0], [1, 1], [1, 2]], size: 3 },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], size: 2 },
  { cells: [[0, 1], [0, 2], [1, 0], [1, 1]], size: 3 },
  { cells: [[0, 1], [1, 0], [1, 1], [1, 2]], size: 3 },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2]], size: 3 },
];

export const PIECE_CELLS: Coord[][][] = [
  [],
  ...BASE_SHAPES.map(({ cells, size }) => {
    const rotations: Coord[][] = [cells];
    for (let i = 1; i < 4; i++) {
      rotations.push(rotations[i - 1].map(([r, c]) => [c, size - 1 - r] as Coord));
    }
    return rotations;
  }),
];

export const PIECE_SIZES: number[] = [0, ...BASE_SHAPES.map(({ size }) => size)];

export const PIECE_COLORS: string[] = [
  '',
  '#22d3ee',
  '#3b82f6',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#a855f7',
  '#ef4444',
];

const KICK_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
];

const LINE_SCORES = [0, 100, 300, 500, 800];

export interface ActivePiece {
  id: number;
  rot: number;
  x: number;
  y: number;
}

export interface TetrisState {
  board: Board;
  piece: ActivePiece | null;
  queue: number[];
  hold: number | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  status: GameStatus;
}

export type TetrisAction =
  | { type: 'start' }
  | { type: 'tick' }
  | { type: 'move'; dx: number }
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'softDrop' }
  | { type: 'hardDrop' }
  | { type: 'hold' }
  | { type: 'togglePause' }
  | { type: 'reset' };

export function createTetrisState(): TetrisState {
  return {
    board: createBoard(),
    piece: null,
    queue: [],
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    status: 'idle',
  };
}

export function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<number | null>(BOARD_WIDTH).fill(null));
}

export function gravityDelayMs(level: number): number {
  return Math.max(60, 1000 - (level - 1) * 85);
}

export function dropDistance(board: Board, piece: ActivePiece): number {
  let dy = 0;
  while (!collides(board, piece.id, piece.rot, piece.x, piece.y + dy + 1)) dy++;
  return dy;
}

export function collides(board: Board, id: number, rot: number, x: number, y: number): boolean {
  for (const [r, c] of PIECE_CELLS[id][rot]) {
    const row = y + r;
    const col = x + c;
    if (col < 0 || col >= BOARD_WIDTH || row >= BOARD_HEIGHT) return true;
    if (row >= 0 && board[row][col] !== null) return true;
  }
  return false;
}

function shuffledBag(): number[] {
  const bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function fillQueue(queue: number[]): number[] {
  const q = [...queue];
  while (q.length < 7) q.push(...shuffledBag());
  return q;
}

function spawn(board: Board, queue: number[]): { piece: ActivePiece | null; queue: number[] } {
  const q = fillQueue(queue);
  const [id, ...rest] = q;
  if (collides(board, id, 0, 3, 0)) return { piece: null, queue: rest };
  return { piece: { id, rot: 0, x: 3, y: 0 }, queue: rest };
}

function lock(state: TetrisState): TetrisState {
  const piece = state.piece;
  if (!piece) return state;

  const board = state.board.map((row) => [...row]);
  for (const [r, c] of PIECE_CELLS[piece.id][piece.rot]) {
    const row = piece.y + r;
    const col = piece.x + c;
    if (row >= 0 && row < BOARD_HEIGHT && col >= 0 && col < BOARD_WIDTH) {
      board[row][col] = piece.id;
    }
  }

  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = BOARD_HEIGHT - remaining.length;
  const newBoard: Board = [
    ...Array.from({ length: cleared }, () => Array<number | null>(BOARD_WIDTH).fill(null)),
    ...remaining,
  ];

  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = state.score + LINE_SCORES[cleared] * state.level;
  const { piece: next, queue } = spawn(newBoard, state.queue);

  return {
    ...state,
    board: newBoard,
    piece: next,
    queue,
    score,
    lines,
    level,
    canHold: true,
    status: next ? state.status : 'over',
  };
}

export function tetrisReducer(state: TetrisState, action: TetrisAction): TetrisState {
  switch (action.type) {
    case 'reset':
      return createTetrisState();

    case 'start': {
      if (state.status === 'playing' || state.status === 'paused') return state;
      const fresh = createTetrisState();
      const { piece, queue } = spawn(fresh.board, fresh.queue);
      return { ...fresh, piece, queue, status: 'playing' };
    }

    case 'togglePause': {
      if (state.status === 'playing') return { ...state, status: 'paused' };
      if (state.status === 'paused') return { ...state, status: 'playing' };
      return state;
    }

    case 'tick': {
      if (state.status !== 'playing' || !state.piece) return state;
      const { piece } = state;
      if (!collides(state.board, piece.id, piece.rot, piece.x, piece.y + 1)) {
        return { ...state, piece: { ...piece, y: piece.y + 1 } };
      }
      return lock(state);
    }

    case 'move': {
      if (state.status !== 'playing' || !state.piece) return state;
      const { piece } = state;
      if (collides(state.board, piece.id, piece.rot, piece.x + action.dx, piece.y)) return state;
      return { ...state, piece: { ...piece, x: piece.x + action.dx } };
    }

    case 'rotate': {
      if (state.status !== 'playing' || !state.piece) return state;
      const { piece } = state;
      const rot = (piece.rot + action.dir + 4) % 4;
      for (const [dx, dy] of KICK_OFFSETS) {
        if (!collides(state.board, piece.id, rot, piece.x + dx, piece.y + dy)) {
          return { ...state, piece: { ...piece, rot, x: piece.x + dx, y: piece.y + dy } };
        }
      }
      return state;
    }

    case 'softDrop': {
      if (state.status !== 'playing' || !state.piece) return state;
      const { piece } = state;
      if (collides(state.board, piece.id, piece.rot, piece.x, piece.y + 1)) return state;
      return { ...state, piece: { ...piece, y: piece.y + 1 }, score: state.score + 1 };
    }

    case 'hardDrop': {
      if (state.status !== 'playing' || !state.piece) return state;
      const { piece } = state;
      const dy = dropDistance(state.board, piece);
      return lock({ ...state, piece: { ...piece, y: piece.y + dy }, score: state.score + dy * 2 });
    }

    case 'hold': {
      if (state.status !== 'playing' || !state.piece || !state.canHold) return state;
      if (state.hold === null) {
        const { piece, queue } = spawn(state.board, state.queue);
        return { ...state, hold: state.piece.id, piece, queue, canHold: false };
      }
      const swapped: ActivePiece = { id: state.hold, rot: 0, x: 3, y: 0 };
      if (collides(state.board, swapped.id, 0, 3, 0)) return state;
      return { ...state, hold: state.piece.id, piece: swapped, canHold: false };
    }

    default:
      return state;
  }
}
