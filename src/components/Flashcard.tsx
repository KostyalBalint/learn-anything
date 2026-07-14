import { useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

export type Card = { front: string; back: string };

export type FlashcardProps = {
  /** A single card... */
  front?: string;
  back?: string;
  /** ...or a deck, which adds prev/next controls. */
  cards?: Card[];
};

export default function Flashcard({ front, back, cards }: FlashcardProps) {
  const deck: Card[] = cards ?? (front && back ? [{ front, back }] : []);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (deck.length === 0) return null;
  const card = deck[Math.min(index, deck.length - 1)]!;

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + deck.length) % deck.length);
  };

  return (
    <div className="not-prose my-6">
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show front of card' : 'Show back of card'}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="group h-48 w-full cursor-pointer [perspective:1200px] focus:outline-none"
      >
        <div
          className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <Face className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-100">
              Question
            </span>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{card.front}</p>
            <span className="mt-3 text-xs text-slate-400">click or press Enter to flip</span>
          </Face>
          <Face
            className="border-brand-500 bg-brand-50 [transform:rotateY(180deg)] dark:border-brand-500 dark:bg-slate-800"
            hidden
          >
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-100">
              Answer
            </span>
            <p className="text-slate-800 dark:text-slate-100">{card.back}</p>
          </Face>
        </div>
      </div>

      {deck.length > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" onClick={() => go(-1)} className={navButton}>
            <ArrowLeftIcon className="size-3.5" />
            Prev
          </button>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {index + 1} / {deck.length}
          </span>
          <button type="button" onClick={() => go(1)} className={navButton}>
            Next
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const navButton =
  'flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

function Face({
  children,
  className,
  hidden,
}: {
  children: React.ReactNode;
  className: string;
  hidden?: boolean;
}) {
  return (
    <div
      aria-hidden={hidden}
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-xl border p-6 text-center [backface-visibility:hidden] ${className}`}
    >
      {children}
    </div>
  );
}
