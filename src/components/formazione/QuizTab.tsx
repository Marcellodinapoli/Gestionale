"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  List,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { storageCategory } from "@/lib/formazione/courseLabels";

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

type AnswerDetail = {
  question: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
};

function shuffleOptions(question: {
  question: string;
  options: string[];
  correctIndex: number;
}): QuizQuestion {
  const options = [...question.options];
  const correctText = options[question.correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return {
    question: question.question,
    options,
    correctIndex: options.indexOf(correctText),
  };
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function QuizTab({
  courseId,
  courseTitle,
  courseLabel,
  catalogCategory,
}: {
  courseId: string;
  courseTitle: string;
  courseLabel: string;
  catalogCategory?: string;
}) {
  const { db, user } = useFormazione();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [showDetails, setShowDetails] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    async function load() {
      if (!db) return;
      const firestore = db;
      const snap = await getDoc(doc(firestore, "courses", courseId));
      if (cancelled) return;
      if (!snap.exists()) {
        setLoadError(true);
        return;
      }
      const quiz = snap.data()?.quiz as
        | { questions?: Array<{ question: string; options: string[]; correctIndex: number }> }
        | undefined;
      const list = quiz?.questions ?? [];
      if (!list.length) {
        setQuestions([]);
        return;
      }
      setQuestions(list.map(shuffleOptions));
    }

    void load().catch(() => {
      if (!cancelled) setLoadError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [db, courseId]);

  const saveProgress = useCallback(
    async (details: AnswerDetail[], elapsedSeconds: number) => {
      if (!db || !user) return;
      const total = questions.length;
      const correct = details.filter((a) => a.isCorrect).length;
      const percent = total ? Math.round((correct / total) * 100) : 0;

      await setDoc(
        doc(db, "userProgress", user.uid, "courses", courseId),
        {
          courseId,
          title: courseTitle,
          courseLabel,
          ...(catalogCategory
            ? { category: storageCategory(catalogCategory) }
            : {}),
          lastScore: percent,
          quizAttempts: increment(1),
          lastQuizDate: serverTimestamp(),
          lastQuizTime: elapsedSeconds,
          answerDetails: details,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [db, user, courseId, courseTitle, courseLabel, catalogCategory, questions.length]
  );

  const finishQuiz = useCallback(
    async (answersMap: Record<number, number>, secondsLeft: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setFinished(true);

      const details: AnswerDetail[] = questions.map((q, i) => {
        const selectedIndex = answersMap[i];
        const isCorrect = selectedIndex === q.correctIndex;
        return {
          question: q.question,
          selected:
            selectedIndex != null
              ? q.options[selectedIndex] ?? "Nessuna risposta"
              : "Nessuna risposta",
          correct: q.options[q.correctIndex] ?? "",
          isCorrect,
        };
      });

      setAnswerDetails(details);
      await saveProgress(details, 60 - secondsLeft);
    },
    [questions, saveProgress]
  );

  useEffect(() => {
    if (!started || finished) return;

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          void finishQuiz(answers, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, finished, answers, finishQuiz]);

  const score = useMemo(() => {
    if (!finished) return null;
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) correct++;
    });
    return questions.length ? Math.round((correct / questions.length) * 100) : 0;
  }, [finished, questions, answers]);

  function restartQuiz() {
    setStarted(true);
    setFinished(false);
    setCurrentIndex(0);
    setAnswers({});
    setAnswerDetails([]);
    setLocked(false);
    setRemaining(60);
    setShowDetails(false);
    setQuestions((prev) => prev.map((q) => shuffleOptions(q)));
  }

  if (loadError) {
    return (
      <p className="py-16 text-center text-sm text-black/55">
        Errore nel caricamento del quiz
      </p>
    );
  }

  if (!questions.length) {
    return (
      <p className="py-16 text-center text-sm text-black/55">
        Nessun quiz disponibile
      </p>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-[#FFA726]/10 p-5">
          <HelpCircle className="h-12 w-12 text-[#FFA726]" strokeWidth={1.75} />
        </div>
        <h3 className="mt-5 text-[22px] font-bold text-black/87">Quiz di verifica</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/55">
          Metti alla prova le tue conoscenze
          <br />
          sul corso appena seguito
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#FFA726] px-7 py-3.5 text-base font-bold text-black transition hover:bg-[#FB8C00]"
        >
          <Play className="h-5 w-5 fill-black" />
          Inizia quiz
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <>
        <div className="flex min-h-[360px] flex-col items-center justify-center py-12 text-center">
          <p className="text-[40px] font-bold text-black/87">{score}%</p>
          <div className="mt-5 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={restartQuiz}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E0E0E0] px-4 py-2.5 text-sm font-medium text-black/87 transition hover:bg-[#D5D5D5]"
            >
              <RefreshCw className="h-4 w-4" />
              Ricomincia
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E0E0E0] px-4 py-2.5 text-sm font-medium text-black/87 transition hover:bg-[#D5D5D5]"
            >
              <List className="h-4 w-4" />
              Mostra dettagli risposte
            </button>
          </div>
        </div>

        {showDetails ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowDetails(false)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[var(--line)] px-5 py-4">
                <h4 className="text-lg font-bold text-black/87">Dettaglio risposte</h4>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--line)]">
                {answerDetails.map((detail, index) => (
                  <li key={index} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-black/87">{detail.question}</p>
                      <p
                        className={`mt-1 text-sm ${
                          detail.isCorrect ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        Risposta: {detail.selected}
                      </p>
                    </div>
                    {detail.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-[var(--line)] px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-[#1565C0] hover:bg-[#1565C0]/5"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const current = questions[currentIndex]!;
  const answered = Object.keys(answers).length;
  const selected = answers[currentIndex];
  const progress = answered / questions.length;
  const timerUrgent = remaining <= 25;
  const timerHidden = timerUrgent && remaining % 2 === 0;

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col py-6">
      <div className="h-2 overflow-hidden rounded-full bg-[#E0E0E0]">
        <div
          className="h-full bg-[#FFA726] transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-black/55">
          Domanda {currentIndex + 1} di {questions.length}
        </span>
        <span
          className={`text-base font-bold tabular-nums transition-colors ${
            timerUrgent
              ? timerHidden
                ? "text-transparent"
                : "text-red-600"
              : "text-black/87"
          }`}
        >
          {formatTime(remaining)}
        </span>
      </div>

      <p className="mt-6 text-xl font-bold text-black/87">{current.question}</p>

      <div className="mt-5 space-y-2">
        {current.options.map((option, index) => {
          const isSelected = selected === index;
          return (
            <button
              key={option}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                const nextAnswers = { ...answers, [currentIndex]: index };
                setAnswers(nextAnswers);
                setLocked(true);
                window.setTimeout(() => {
                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex((i) => i + 1);
                    setLocked(false);
                  } else {
                    void finishQuiz(nextAnswers, remaining);
                  }
                }, 600);
              }}
              className={`block w-full rounded-xl border-2 px-3.5 py-3.5 text-left text-base transition disabled:opacity-70 ${
                isSelected
                  ? "border-[#FFA726] bg-[#FFA726]/15 text-black"
                  : "border-[#BDBDBD] bg-[#F5F5F5] text-[#424242] hover:border-[#FFA726]/60"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => {
            setCurrentIndex((i) => i - 1);
            setLocked(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E0E0E0] px-4 py-2.5 text-sm font-medium text-black/87 transition enabled:hover:bg-[#D5D5D5] disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </button>
        <span className="text-sm font-semibold text-black/55">
          {answered} / {questions.length} risposte date
        </span>
      </div>
    </div>
  );
}
