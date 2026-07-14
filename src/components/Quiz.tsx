import { useState } from 'react';
import { CheckIcon, RotateIcon, XIcon } from './icons';

export type Question = {
  q: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  explain?: string;
};

export type QuizProps = {
  questions: Question[];
  title?: string;
};

export default function Quiz({ questions, title = 'Check yourself' }: QuizProps) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const score = questions.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);
  const done = answered === questions.length;

  return (
    <section className="not-prose my-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
          {score} / {questions.length}
        </span>
      </header>

      <ol className="space-y-6">
        {questions.map((question, qi) => {
          const choice = picked[qi];
          const revealed = choice !== undefined;
          return (
            <li key={qi}>
              <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">
                {qi + 1}. {question.q}
              </p>
              <div className="space-y-1.5">
                {question.options.map((option, oi) => {
                  const isAnswer = oi === question.answer;
                  const isChoice = oi === choice;
                  let tone =
                    'border-slate-200 hover:border-brand-500 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-slate-800';
                  if (revealed && isAnswer) {
                    tone = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40';
                  } else if (revealed && isChoice) {
                    tone = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40';
                  } else if (revealed) {
                    tone = 'border-slate-200 opacity-60 dark:border-slate-700';
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={revealed}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${tone} text-slate-800 dark:text-slate-200`}
                    >
                      <span className="flex w-4 shrink-0 justify-center text-slate-400">
                        {revealed && isAnswer ? (
                          <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : revealed && isChoice ? (
                          <XIcon className="size-4 text-rose-600 dark:text-rose-400" />
                        ) : (
                          String.fromCharCode(65 + oi)
                        )}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
              {revealed && question.explain && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {question.explain}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <footer className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {score === questions.length
              ? 'Perfect — all correct.'
              : `${score} of ${questions.length} correct.`}
          </p>
          <button
            type="button"
            onClick={() => setPicked({})}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateIcon className="size-3.5" />
            Reset
          </button>
        </footer>
      )}
    </section>
  );
}
