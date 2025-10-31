"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Choice = "treat" | "trick";
type ResultType = "treat" | "trick";

type GamePhase = "intro" | "play" | "final";

type MiniGameType = "ghost";

interface PlayContext {
  name?: string;
  likes: string[];
  likeFallback: string;
}

interface OutcomeDetails {
  id: string;
  choice: Choice;
  type: ResultType;
  label: string;
  message: string;
  prompt?: string;
  miniGame?: MiniGameType;
  miniGameComplete?: boolean;
  miniGameSuccess?: boolean;
  timestamp: number;
}

const MAX_TURNS = 8;
const TREAT_WEIGHT = 0.7;

const generateTurnId = (random: () => number) => {
  const segment = () => Math.floor(random() * 0xfffff)
    .toString(16)
    .padStart(5, "0");
  return `turn-${Date.now().toString(36)}-${segment()}${segment()}`;
};

const formatName = (raw?: string) => {
  const value = raw?.trim();
  if (!value) return "bạn";
  return value;
};

const extractLikes = (raw: string) => {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
};

const treatCompliments = [
  "[Tên] có nụ cười làm ngày u ám cũng sáng lên.",
  "Bạn tử tế theo cách khiến người khác muốn tốt bụng hơn.",
  "Bạn làm căn phòng ấm hơn +10° vui mỗi lần xuất hiện.",
  "Đôi mắt biết kể chuyện; hôm nay kể chuyện vui cho chính bạn nhé.",
  "Bạn là bản gốc độc nhất vô nhị – rất đáng quý.",
  "Bạn khiến điều nhỏ xíu cũng thành niềm vui to.",
  "Trái tim bạn biết lắng nghe; cảm ơn vì điều đó.",
] as const;

const treatGifts = [
  "🎟️ Voucher Ôm Ấm Áp: đổi 1 cái ôm thật chặt bất cứ lúc nào.",
  "🫶 Sticker “Bạn làm được!”: dán vào hôm nay.",
  "🌟 Một lời chúc: Bình yên, ngọt ngào, mọi điều như ý.",
] as const;

const treatCustom = [
  "[Tên] và [LIKE] – combo hoàn hảo tạo nên ngày tuyệt vời.",
  "[LIKE] làm dễ chịu, nhưng [Tên] còn làm trái tim ấm hơn.",
  "Khi nhắc đến [LIKE], mọi người sẽ nhớ đến niềm vui mà bạn lan tỏa.",
] as const;

const trickPrompts = [
  {
    message: "Nhảy lắc lư 10 giây theo nhạc trong đầu bạn.",
    prompt: "Đếm nhịp như máy arcade: 1-2-3-4, cứ thế lặp lại!",
    miniGame: false,
  },
  {
    message: "Gửi một emoji dễ thương nhất bạn có.",
    prompt: "Chọn ngay emoji khiến bạn phải mỉm cười.",
    miniGame: false,
  },
  {
    message: "Kể nhanh 1 kỷ niệm vui của hôm nay.",
    prompt: "Không có thì kể về kỷ niệm vui gần nhất cũng được!",
    miniGame: false,
  },
  {
    message: "Nói “Tôi thật tuyệt” 3 lần (nhỏ cũng được).",
    prompt: "Tặng thêm một cái gật đầu sau mỗi lần nói nhé.",
    miniGame: false,
  },
  {
    message: "Hít sâu 3 lần, nhắm mắt 5 giây rồi cười nhẹ.",
    prompt: "Gửi tiếng cười đó vào không khí để nó quay lại với bạn.",
    miniGame: false,
  },
  {
    message: "Uống một ngụm nước và vươn vai thật đã.",
    prompt: "Thêm một vòng xoay cổ nhẹ để cơ thể tỉnh táo.",
    miniGame: false,
  },
  {
    message: "Viết 1 câu cảm ơn dành cho bản thân ngay bây giờ.",
    prompt: "Có thể là “Cảm ơn mình vì đã cố gắng đến lúc này”.",
    miniGame: false,
  },
] as const;

const trickWithMiniGame = {
  message: "Mini-game Candy Arcade: bắt con ma 👻 trong 6 giây!",
  prompt: "Bấm trúng ma tinh nghịch để nhận 1 kẹo tưởng tượng 🍬.",
  miniGame: true,
} as const;

const useRetroAudio = () => {
  const [enabled, setEnabled] = useState(true);
  const contextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (!enabled) {
      return null;
    }
    let ctx = contextRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      contextRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }, [enabled]);

  const playTone = useCallback(
    (frequency: number, duration: number, gainValue = 0.12) => {
      const ctx = ensureContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration + 0.05,
      );

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.05);
    },
    [ensureContext],
  );

  const playCoin = useCallback(() => {
    playTone(880, 0.12);
    window.setTimeout(() => playTone(1320, 0.1, 0.1), 90);
  }, [playTone]);

  const playClick = useCallback(() => {
    playTone(440, 0.08, 0.08);
  }, [playTone]);

  const playSuccess = useCallback(() => {
    playTone(990, 0.1, 0.1);
    window.setTimeout(() => playTone(1480, 0.12, 0.09), 80);
    window.setTimeout(() => playTone(1760, 0.14, 0.08), 160);
  }, [playTone]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  // Background music - nhạc nền tự động từ file có sẵn trong public
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const [bgMusicEnabled, setBgMusicEnabled] = useState(true);

  // Khởi tạo nhạc nền từ file có sẵn trong public
  useEffect(() => {
    if (!bgMusicRef.current) {
      // Đặt đường dẫn file nhạc ở đây - đổi tên file theo file bạn có
      // Ví dụ: /background-music.mp3, /bg-music.wav, /halloween.mp3, etc.
      const musicPath = "/background-music.mp3";
      
      const audio = new Audio(musicPath);
      audio.loop = true;
      audio.volume = 0.5; // Volume mặc định 50%
      
      // Xử lý lỗi khi file không tồn tại
      audio.addEventListener("error", () => {
        console.warn("⚠️ Không tìm thấy file nhạc:", musicPath, "Vui lòng đặt file nhạc vào thư mục public/");
        bgMusicRef.current = null;
      });
      
      bgMusicRef.current = audio;

      // Thử phát nhạc ngay lập tức nếu được phép
      if (enabled && bgMusicEnabled) {
        audio.play().catch(() => {
          // Autoplay bị block hoặc file không tồn tại - không hiển thị lỗi
        });
      }
    }

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, [enabled, bgMusicEnabled]); // Chạy lại khi enabled hoặc bgMusicEnabled thay đổi

  const startBackgroundMusic = useCallback(() => {
    if (!enabled || !bgMusicEnabled) return;
    
    // Khởi tạo audio nếu chưa có
    if (!bgMusicRef.current) {
      const musicPath = "/background-music.mp3";
      const audio = new Audio(musicPath);
      audio.loop = true;
      audio.volume = 0.5;
      
      // Xử lý lỗi khi file không tồn tại
      audio.addEventListener("error", () => {
        console.warn("⚠️ Không tìm thấy file nhạc:", musicPath, "Vui lòng đặt file nhạc vào thư mục public/");
        bgMusicRef.current = null;
      });
      
      bgMusicRef.current = audio;
    }
    
    // Thử phát nhạc nếu audio tồn tại
    if (bgMusicRef.current) {
      bgMusicRef.current.play().catch(() => {
        // Autoplay bị block hoặc file không tồn tại - không hiển thị lỗi
      });
    }
  }, [enabled, bgMusicEnabled]);

  const stopBackgroundMusic = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
    }
  }, []);

  const toggleBgMusic = useCallback(() => {
    setBgMusicEnabled((prev) => {
      if (prev) {
        stopBackgroundMusic();
      } else {
        startBackgroundMusic();
      }
      return !prev;
    });
  }, [startBackgroundMusic, stopBackgroundMusic]);

  useEffect(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.volume = 0.5;
    }
  }, []);

  // Tự động bật nhạc nền khi enabled hoặc bgMusicEnabled thay đổi
  useEffect(() => {
    if (enabled && bgMusicEnabled) {
      // Thử phát nhạc ngay
      startBackgroundMusic();

      // Nếu browser block autoplay, đợi user interaction
      const handleFirstInteraction = () => {
        startBackgroundMusic();
        document.removeEventListener("click", handleFirstInteraction);
        document.removeEventListener("keydown", handleFirstInteraction);
        document.removeEventListener("touchstart", handleFirstInteraction);
      };
      
      document.addEventListener("click", handleFirstInteraction, { once: true });
      document.addEventListener("keydown", handleFirstInteraction, { once: true });
      document.addEventListener("touchstart", handleFirstInteraction, { once: true });

      return () => {
        document.removeEventListener("click", handleFirstInteraction);
        document.removeEventListener("keydown", handleFirstInteraction);
        document.removeEventListener("touchstart", handleFirstInteraction);
      };
    } else {
      stopBackgroundMusic();
    }
  }, [enabled, bgMusicEnabled, startBackgroundMusic, stopBackgroundMusic]);


  return {
    enabled,
    toggle,
    playCoin,
    playClick,
    playSuccess,
    bgMusicEnabled,
    toggleBgMusic,
  };
};

const GhostChase = ({
  onFinished,
}: {
  onFinished: (success: boolean) => void;
}) => {
  const [position, setPosition] = useState({ top: 50, left: 50 });
  const [timeLeft, setTimeLeft] = useState(6);
  const [caught, setCaught] = useState(false);
  const hasFinishedRef = useRef(false);
  const movementRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (hasFinishedRef.current) return;
      const top = 10 + Math.random() * 80;
      const left = 8 + Math.random() * 84;
      setPosition({ top, left });
    };

    movementRef.current = window.setInterval(updatePosition, 280);
    return () => {
      if (movementRef.current) {
        window.clearInterval(movementRef.current);
      }
    };
  }, []);

  useEffect(() => {
    countdownRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (!hasFinishedRef.current) {
            hasFinishedRef.current = true;
            onFinished(caught);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
    };
  }, [caught, onFinished]);

  const handleCatch = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setCaught(true);
    onFinished(true);
  };

  useEffect(() => {
    if (hasFinishedRef.current) {
      if (movementRef.current) {
        window.clearInterval(movementRef.current);
      }
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
    }
  }, [caught]);

  return (
    <div className="pixel-card mt-6 bg-[#111827]">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#22d3ee]">
        Bắt ma trong {timeLeft} giây
      </p>
      <div className="relative mt-4 h-48 w-full border-[3px] border-black bg-[#0b1120]">
        <button
          type="button"
          onClick={handleCatch}
          className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[3px] border-black bg-[#22d3ee] font-[var(--font-display)] text-lg text-black transition-transform duration-75"
          style={{
            top: `${position.top}%`,
            left: `${position.left}%`,
          }}
        >
          👻
        </button>
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.3em] text-[#f8fafc]/70">
        Bấm trúng ma để nhận kẹo tưởng tượng thơm lừng!
      </p>
    </div>
  );
};

const useRandom = () => {
  const seedRef = useRef(1);
  const next = useCallback(() => {
    const seed = seedRef.current;
    const nextSeed = (seed * 1664525 + 1013904223) % 4294967296;
    seedRef.current = nextSeed;
    return nextSeed / 4294967296;
  }, []);

  const pick = useCallback(
    <T,>(items: readonly T[]): T => {
      const value = next();
      const index = Math.floor(value * items.length);
      return items[index];
    },
    [next],
  );

  return { next, pick, seedRef };
};

const buildTreatOutcome = (
  ctx: PlayContext,
  pick: <T,>(items: readonly T[]) => T,
  random: () => number,
): OutcomeDetails => {
  const useCustom =
    ctx.likes.length > 0 && random() < 0.4 && treatCustom.length > 0;
  const template = useCustom
    ? pick(treatCustom)
    : pick(
        [
          ...treatCompliments,
          ...treatGifts,
        ] as const,
      );

  const like =
    ctx.likes.length > 0
      ? ctx.likes[Math.floor(random() * ctx.likes.length)]
      : ctx.likeFallback;

  const message = template
    .replace(/\[Tên\]/g, formatName(ctx.name))
    .replace(/\[LIKE\]/g, like);

  const label = template.includes("Voucher")
    ? "Voucher ngọt ngào"
    : template.includes("Sticker")
    ? "Sticker cổ vũ"
    : template.includes("lời chúc")
    ? "Chúc ấm áp"
    : "Kẹo khen ngợi";

  return {
    id: generateTurnId(random),
    choice: "treat",
    type: "treat",
    label,
    message,
    prompt: undefined,
    timestamp: Date.now(),
  };
};

const buildTrickOutcome = (
  ctx: PlayContext,
  pick: <T,>(items: readonly T[]) => T,
  includeMiniGame: boolean,
  random: () => number,
): OutcomeDetails => {
  const useMiniGame = includeMiniGame && random() < 0.4;
  const template = useMiniGame
    ? trickWithMiniGame
    : pick(trickPrompts as unknown as readonly (typeof trickPrompts[number])[]);

  return {
    id: generateTurnId(random),
    choice: "trick",
    type: "trick",
    label: template.miniGame ? "Mini-game pixel" : "Thử thách dễ thương",
    message: template.message
      .replace(/\[Tên\]/g, formatName(ctx.name))
      .replace(/\[LIKE\]/g, ctx.likeFallback),
    prompt: template.prompt,
    miniGame: template.miniGame ? "ghost" : undefined,
    timestamp: Date.now(),
  };
};

const VoucherPreview = ({
  name,
 
}: {
  name: string;
}) => {
  const displayName = name ? name : "Bạn";
  return (
    <div className="pixel-card bg-[#151c2f] text-[#f8fafc]">
      <h3 className="text-base">Quà tặng cuối cùng mong rằng cậu đừng chê</h3>
      <div className="mt-4 grid gap-2 text-left text-xs font-semibold uppercase tracking-[0.35em] text-[#22d3ee]">
        <span>Chủ sở hữu</span>
        <span className="pixel-card bg-[#0f172a] px-4 py-3 text-[#fb923c]">
          <p>( Rù rì )8B Đặng Tất , Ba Đình , Hà Nội</p>
          <p>( Drip Station ) - Tầng 4 khu tập thể A ngõ 70 Ngọc Khánh </p>
          <p> ( Coffe Koem )107-K2 KTT Thành Công , Ba Đình </p>
          <p> (Leo s Tavern ) 9A Bảo Khánh Hoàn Kiếm</p>
        </span>
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-[#f8fafc]/75">
        Hợp lệ vĩnh viễn • Dùng càng nhiều càng tốt
      </p>
    </div>
  );
};

const generateVoucherImage = (name: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const safeName = name ? name.trim() : "Bạn";

  // Background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.fillStyle = "#6d28d9";
  ctx.fillRect(30, 30, canvas.width - 60, canvas.height - 60);

  // Inner panel
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(70, 70, canvas.width - 140, canvas.height - 140);

  // Pixel border accent
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 8;
  ctx.strokeRect(90, 90, canvas.width - 180, canvas.height - 180);

  ctx.fillStyle = "#fb923c";
  ctx.font = "34px 'Press Start 2P', 'Fira Sans', monospace";
  ctx.textAlign = "center";
  ctx.fillText("Quà tặng cuối cùng", canvas.width / 2, 150);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "22px 'Fira Sans', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Chủ sở hữu:", 140, 240);

  ctx.fillStyle = "#22d3ee";
  ctx.font = "28px 'Press Start 2P', monospace";
  ctx.fillText(safeName.toUpperCase(), 140, 300);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "20px 'Fira Sans', sans-serif";
  ctx.fillText("Hợp lệ vĩnh viễn • Dùng càng nhiều càng tốt", 140, 360);

  ctx.fillStyle = "#fb923c";
  ctx.font = "18px 'Press Start 2P', monospace";
  ctx.fillText("Retro Candy Arcade", 140, 470);

  const link = document.createElement("a");
  const slug = safeName.toLowerCase().replace(/\s+/g, "-");
  link.download = `voucher-om-${slug || "ban"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

export default function Home() {
  const [phase, setPhase] = useState<GamePhase>("intro");
  const [playerName, setPlayerName] = useState("");
  const [likesInput, setLikesInput] = useState("");
  const [likes, setLikes] = useState<string[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [currentOutcome, setCurrentOutcome] = useState<OutcomeDetails | null>(
    null,
  );
  const [history, setHistory] = useState<OutcomeDetails[]>([]);
  const [isAnimatingDoor, setIsAnimatingDoor] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);

  const {
    enabled: soundEnabled,
    toggle: toggleSound,
    playCoin,
    playClick,
    bgMusicEnabled,
    toggleBgMusic,
  } = useRetroAudio();

  const { next: nextRandom, pick, seedRef } = useRandom();

  const ctx = useMemo<PlayContext>(() => {
    const trimmedName = playerName.trim();
    const parsedLikes = likes;
    return {
      name: trimmedName || undefined,
      likes: parsedLikes,
      likeFallback: parsedLikes[0] ?? "niềm vui pixel",
    };
  }, [playerName, likes]);

  const resetGame = useCallback(() => {
    setPhase("intro");
    setTurnCount(0);
    setCurrentOutcome(null);
    setHistory([]);
    setIsAnimatingDoor(false);
    setDoorOpen(false);
  }, []);

  const handleStart = useCallback(() => {
    setLikes(extractLikes(likesInput));
    seedRef.current =
      (Date.now() % 4294967296) || 1;
    setTurnCount(0);
    setCurrentOutcome(null);
    setHistory([]);
    setIsAnimatingDoor(false);
    setDoorOpen(false);
    setPhase("play");
    playClick();
  }, [likesInput, playClick, seedRef]);

  const handleDoorChoice = useCallback(
    (choice: Choice) => {
      if (isAnimatingDoor || turnCount >= MAX_TURNS) return;
      playClick();
      setIsAnimatingDoor(true);
      setDoorOpen(true);
      setCurrentOutcome(null);

      window.setTimeout(() => {
        const roll = nextRandom();
        const type: ResultType =
          roll < TREAT_WEIGHT ? "treat" : "trick";

        let outcome: OutcomeDetails;
        if (type === "treat") {
          outcome = buildTreatOutcome(
            { ...ctx },
            (items) => pick(items),
            nextRandom,
          );
          playCoin();
        } else {
          const includeMiniGame = turnCount < MAX_TURNS - 1;
          outcome = buildTrickOutcome(
            { ...ctx },
            (items) => pick(items),
            includeMiniGame,
            nextRandom,
          );
        }

        outcome = {
          ...outcome,
          choice,
        };

        setCurrentOutcome(outcome);
        setHistory((prev) => [outcome, ...prev].slice(0, 6));
        setTurnCount((prev) => prev + 1);
        if (outcome.type === "treat") {
          playCoin();
        }

        setIsAnimatingDoor(false);
        window.setTimeout(() => setDoorOpen(false), 260);
      }, 520);
    },
    [
      ctx,
      isAnimatingDoor,
      nextRandom,
      pick,
      playClick,
      playCoin,
      turnCount,
    ],
  );

  const handleMiniGameFinished = useCallback(
    (success: boolean) => {
      setCurrentOutcome((prev) => {
        if (!prev || !prev.miniGame || prev.miniGameComplete) return prev;
        if (success) {
          playCoin();
        }
        return {
          ...prev,
          miniGameComplete: true,
          miniGameSuccess: success,
        };
      });

      setHistory((prev) =>
        prev.map((item) =>
          item.id === currentOutcome?.id
            ? {
                ...item,
                miniGameComplete: true,
                miniGameSuccess: success,
              }
            : item,
        ),
      );
    },
    [
      currentOutcome?.id,
      playCoin,
    ],
  );

  const handleToFinal = useCallback(() => {
    playClick();
    setPhase("final");
  }, [playClick]);

  const turnsLeft = MAX_TURNS - turnCount;
  const displayName = formatName(ctx.name);

  return (
    <>
      <div className="retro-scanline" aria-hidden="true" />
      <div className="halloween-bg" aria-hidden="true">
        <div className="halloween-bg__item halloween-bg__item--1">
          <Image src="/hal.png" alt="" fill sizes="150px" className="halloween-bg__image" />
        </div>
        <div className="halloween-bg__item halloween-bg__item--2">
          <Image src="/hal2.png" alt="" fill sizes="150px" className="halloween-bg__image" />
        </div>
        <div className="halloween-bg__item halloween-bg__item--3">
          <Image src="/hal4.png" alt="" fill sizes="70px" className="halloween-bg__image" />
        </div>
        <div className="halloween-bg__item halloween-bg__item--4">
          <Image src="/hal2.png" alt="" fill sizes="60px" className="halloween-bg__image" />
        </div>
        <div className="halloween-bg__item halloween-bg__item--5">
          <Image src="/hal.png" alt="" fill sizes="65px" className="halloween-bg__image" />
        </div>
        <div className="halloween-bg__item halloween-bg__item--6">
          <Image src="/hal4.png" alt="" fill sizes="75px" className="halloween-bg__image" />
        </div>
      </div>
      <div className="sound-toggle">
        <div className="sound-toggle__group">
          <span>Âm thanh</span>
          <button type="button" onClick={toggleSound}>
            {soundEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="sound-toggle__group">
          <span>Nhạc nền</span>
          <button type="button" onClick={toggleBgMusic}>
            {bgMusicEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-16 text-center md:gap-10 md:px-10">
        {phase === "intro" && (
          <section className="pixel-card max-w-2xl bg-[#1f2937]">
            <h1 className="text-xl text-[#fb923c]">
              🎃 Trick or Treat 
          </h1>
            <div className="mt-6 grid gap-5 text-left text-sm">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.3em] text-[#f8fafc]/70">
                Tên của cậu(tuỳ chọn)
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  className="border-[3px] border-black bg-[#0f172a] px-10 py-3 font-sans text-sm text-[#f8fafc] outline-none"
                  placeholder="VD:Phạm Hồng Ánh ..."
                />
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.3em] text-[#f8fafc]/70">
                Điều cậu thích 
                <input
                  type="text"
                  value={likesInput}
                  onChange={(event) => setLikesInput(event.target.value)}
                  className="border-[3px] border-black bg-[#0f172a] px-4 py-3 font-sans text-sm text-[#f8fafc] outline-none"
                  placeholder="VD: mèo, cà phê, sách"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleStart}
                className="pixel-button pixel-button--cyan"
              >
                Bắt đầu
              </button>
            </div>
          </section>
        )}

        {phase === "play" && (
          <section className="flex w-full flex-col items-center gap-8">
            <header className="pixel-card w-full bg-[#1f2937]">
              
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f8fafc]/80">
                Mỗi lượt mở một điều bất ngờ. Cậu có tối đa 8 lượt ( hoặc hơn) và có thể dừng bất cứ lúc nào.
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">
                Đã mở: {turnCount} / {MAX_TURNS} lượt
          </p>
        </header>

            <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
              <div className="flex flex-col items-center gap-4">
                <div className="pixel-door" data-open={doorOpen || undefined}>
                  <div className="pixel-door__light" />
                  <div className="pixel-door__handle" />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f8fafc]/70">
                    Còn {Math.max(turnsLeft, 0)} lượt • Chọn một nút nhé!
                  </span>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDoorChoice("treat")}
                      disabled={isAnimatingDoor || turnCount >= MAX_TURNS}
                      className="pixel-button pixel-button--cyan"
                    >
                      Chọn Treat
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDoorChoice("trick")}
                      disabled={isAnimatingDoor || turnCount >= MAX_TURNS}
                      className="pixel-button pixel-button--purple"
                    >
                      Chọn Trick
                    </button>
                  </div>
            </div>
          </div>

              <div className="flex w-full flex-1 flex-col items-center gap-4">
                {currentOutcome ? (
                  <article className="pixel-card w-full bg-[#151c2f] text-left">
                    <div className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.35em] text-[#22d3ee]">
                      <span>
                        Bạn chọn: {currentOutcome.choice.toUpperCase()} • Kết
                        quả: {currentOutcome.type === "treat" ? "Treat" : "Trick"}
                      </span>
                      <span>{currentOutcome.label}</span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#f8fafc]">
                      {currentOutcome.message}
                    </p>
                    {currentOutcome.prompt && (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#fb923c]">
                        {currentOutcome.prompt}
                      </p>
                    )}
                  <figure className="result-figure mt-4" aria-hidden>
                    <div className="result-figure__frame">
                      <Image
                        src={currentOutcome.type === "treat" ? "/globe.svg" : "/window.svg"}
                        alt="Kết quả"
                        fill
                        sizes="240px"
                      />
                    </div>
                  </figure>
                    {currentOutcome.miniGame === "ghost" &&
                      !currentOutcome.miniGameComplete && (
                        <GhostChase onFinished={handleMiniGameFinished} />
                      )}
                    {currentOutcome.miniGame === "ghost" &&
                      currentOutcome.miniGameComplete && (
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">
                          {currentOutcome.miniGameSuccess
                            ? "Giỏi quá! Nhận thêm 1 kẹo tưởng tượng 🍬"
                            : "Ma chạy nhanh thật! Bạn vẫn giữ được một nụ cười nhé."}
                        </p>
                      )}
                    <div className="mt-6 flex flex-wrap gap-3">
                      {turnCount < MAX_TURNS && (
          <button
            type="button"
                          onClick={() => setCurrentOutcome(null)}
                          className="pixel-button pixel-button--cyan"
          >
                          Mở tiếp
          </button>
                      )}
                      <button
                        type="button"
                        onClick={handleToFinal}
                        className="pixel-button"
                      >
                        Nhận quà cuối
                      </button>
                    </div>
                  </article>
                ) : (
                  <div className="pixel-card w-full bg-[#151c2f]">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">
                      Gõ cửa để mở bất ngờ cho riêng {displayName}.
                    </p>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.3em] text-[#f8fafc]/70">
                      Cậu có thể dừng bất cứ lúc nào để nhận quà.
                    </p>
                  </div>
                )}
                {turnCount >= MAX_TURNS && (
                  <div className="pixel-card w-full bg-[#111827]">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#fb923c]">
                      Đã hết 8 lượt! Đã đến lúc nhận quà cuối cùng.
                    </p>
                    <button
                      type="button"
                      onClick={handleToFinal}
                      className="pixel-button pixel-button--purple mt-4"
                    >
                      Đến quà cuối
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {phase === "final" && (
          <section className="pixel-card max-w-2xl bg-[#1f2937] text-left">
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">
              Cảm ơn bạn đã chơi mong rằng cậu nhẹ tay =)))). 
            </p>
            <div className="mt-6 grid gap-5">
              <VoucherPreview name={playerName.trim()} />
              <div className="pixel-card bg-[#151c2f] text-xs">
                <p className="font-semibold uppercase tracking-[0.3em] text-[#f8fafc]/70">
                  Lượt bạn đã mở: {turnCount} / {MAX_TURNS}
                </p>
                <p className="mt-2 font-semibold uppercase tracking-[0.3em] text-[#22d3ee]">
                  Những điều bạn mở được:
                </p>
                <ul className="mt-3 grid gap-2 text-[11px] text-[#f8fafc]/80">
                  {history.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      • [{item.type === "treat" ? "Treat" : "Trick"}]{" "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => generateVoucherImage(playerName)}
                className="pixel-button pixel-button--cyan"
              >
                Tải PNG
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="pixel-button pixel-button--purple"
              >
                Chơi lại
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
