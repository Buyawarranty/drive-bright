import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * Very easy, privacy-friendly spam check: a simple maths question plus a
 * hidden honeypot field. No Google, no puzzles, no third-party scripts.
 *
 * Usage:
 *   const captcha = useSimpleCaptcha();
 *   <SimpleCaptcha captcha={captcha} idPrefix="contact" />
 *   if (!captcha.verify()) { ...show error...; return; }
 *   captcha.reset(); // after a successful submit
 */
export interface SimpleCaptchaState {
  a: number;
  b: number;
  answer: string;
  honeypot: string;
  setAnswer: (v: string) => void;
  setHoneypot: (v: string) => void;
  isSolved: boolean;
  verify: () => boolean;
  reset: () => void;
}

const randomPair = () => ({
  a: 2 + Math.floor(Math.random() * 8), // 2–9
  b: 1 + Math.floor(Math.random() * 9), // 1–9
});

export function useSimpleCaptcha(): SimpleCaptchaState {
  const [pair, setPair] = useState(randomPair);
  const [answer, setAnswer] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const reset = useCallback(() => {
    setPair(randomPair());
    setAnswer('');
    setHoneypot('');
  }, []);

  const isSolved = useMemo(
    () =>
      honeypot === '' &&
      answer.trim() !== '' &&
      parseInt(answer.trim(), 10) === pair.a + pair.b,
    [answer, honeypot, pair],
  );

  const verify = useCallback(() => isSolved, [isSolved]);

  return {
    a: pair.a,
    b: pair.b,
    answer,
    honeypot,
    setAnswer,
    setHoneypot,
    isSolved,
    verify,
    reset,
  };
}

interface SimpleCaptchaProps {
  captcha: SimpleCaptchaState;
  idPrefix: string;
  className?: string;
}

const SimpleCaptcha: React.FC<SimpleCaptchaProps> = ({ captcha, idPrefix, className = '' }) => {
  const inputId = `${idPrefix}-captcha-answer`;

  return (
    <div className={`rounded-xl border border-gray-200 bg-gray-50 p-3.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-sm font-semibold text-gray-800"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        Quick security check
      </label>
      <div className="mt-2 flex items-center gap-2.5">
        <span className="text-sm text-gray-700 whitespace-nowrap">
          What is {captcha.a} + {captcha.b}?
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={captcha.answer}
          onChange={(e) => captcha.setAnswer(e.target.value.replace(/[^\d-]/g, ''))}
          className={`w-20 h-10 rounded-lg border bg-white px-3 text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 ${
            captcha.answer.trim() === ''
              ? 'border-gray-300 focus:ring-orange-200'
              : captcha.isSolved
                ? 'border-emerald-500 focus:ring-emerald-200'
                : 'border-gray-300 focus:ring-orange-200'
          }`}
          aria-describedby={`${inputId}-hint`}
        />
        <button
          type="button"
          onClick={captcha.reset}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
          aria-label="New question"
          title="New question"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        {captcha.isSolved && (
          <span className="text-xs font-semibold text-emerald-600">Correct</span>
        )}
      </div>
      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-gray-500">
        Just a quick sum so we know you're a person, not a spam robot.
      </p>

      {/* Honeypot: invisible to people, bots fill it in and fail silently */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', top: '-9999px', height: 0, overflow: 'hidden' }}
      >
        <label htmlFor={`${idPrefix}-company-website`}>Company website</label>
        <input
          id={`${idPrefix}-company-website`}
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={captcha.honeypot}
          onChange={(e) => captcha.setHoneypot(e.target.value)}
        />
      </div>
    </div>
  );
};

export default SimpleCaptcha;
