import type { Metadata } from 'next';
import TetrisGame from '@/components/TetrisGame';

export const metadata: Metadata = {
  title: 'Tetris',
  description: 'Play a round of Tetris — stack, clear lines, and chase your high score.',
};

export default function TetrisPage() {
  return <TetrisGame />;
}
