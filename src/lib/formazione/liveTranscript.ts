type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Trascrizione in parallelo alla registrazione (Chrome / Edge). */
export function startLiveTranscript() {
  const Ctor = getCtor();
  let text = "";
  let rec: SpeechRecognitionLike | null = null;

  if (Ctor) {
    rec = new Ctor();
    rec.lang = "it-IT";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        if (row.isFinal) chunk += row[0].transcript;
      }
      if (chunk.trim()) text = `${text} ${chunk}`.trim();
    };
    rec.onerror = () => {
      /* ignore: fallback senza STT */
    };
    try {
      rec.start();
    } catch {
      rec = null;
    }
  }

  return {
    stop() {
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
      rec = null;
      return text.trim();
    },
  };
}
