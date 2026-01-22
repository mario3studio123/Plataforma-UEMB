// src/components/Course/VideoPlayer/index.tsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  FastForward, Rewind, X, Loader2, RotateCcw
} from "lucide-react";
import styles from "./styles.module.css";
import { formatDuration } from "@/utils/formatters"; 
import { useAuth } from "@/context/AuthContext";
import { saveVideoProgressAction } from "@/app/actions/progressActions";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  courseId: string;
  lessonId: string;
  initialTime?: number;
  onComplete?: () => void;
  onNext?: () => void;
  autoPlayNext?: boolean;
}

type FeedbackState = {
  icon: React.ReactNode;
  text?: string;
  id: number;
} | null;

export default function VideoPlayer({ 
  src, poster, courseId, lessonId, initialTime = 0, 
  onComplete, onNext, autoPlayNext = false 
}: VideoPlayerProps) {
  const { user } = useAuth();
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  
  // Controle de Estado
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  // UX States
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);

  // Autoplay Logic
  const [showAutoplay, setShowAutoplay] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false); // <--- NOVO ESTADO
  const [countdown, setCountdown] = useState(5);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Logic Flags
  const hasCompletedRef = useRef(false);
  const lastSaveTime = useRef<number>(0);

  // --- 1. Inicialização e Limpeza ---
  useEffect(() => {
    // Resetar ao mudar de aula
    hasCompletedRef.current = false;
    setIsPlaying(false);
    setShowAutoplay(false);
    setShowEndScreen(false); // <--- RESET
    setCountdown(5);
    setIsBuffering(true);

    if (videoRef.current) {
      if (initialTime > 0) {
        videoRef.current.currentTime = initialTime;
        setCurrentTime(initialTime);
      }
      videoRef.current.load();
    }
  }, [src, lessonId]); 

  // --- 2. Feedback Visual ---
  const triggerFeedback = (icon: React.ReactNode, text?: string) => {
    setFeedback({ icon, text, id: Date.now() });
  };

  useGSAP(() => {
    if (feedback && feedbackRef.current) {
      gsap.fromTo(feedbackRef.current, 
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.2, ease: "back.out(1.7)", onComplete: () => {
          gsap.to(feedbackRef.current, { opacity: 0, scale: 1.2, duration: 0.3, delay: 0.2 });
        }}
      );
    }
  }, [feedback]);

  // --- 3. Handlers de Vídeo ---
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setShowEndScreen(false); // Esconde tela final se der play
      triggerFeedback(<Play size={40} fill="white" />);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerFeedback(<Pause size={40} fill="white" />);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setShowEndScreen(false); // Esconde tela final se der seek
    }
  };

  const skip = (amount: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(Math.max(videoRef.current.currentTime + amount, 0), duration);
    handleSeek(newTime);
    triggerFeedback(amount > 0 ? <FastForward size={40}/> : <Rewind size={40}/>, `${amount > 0 ? '+' : ''}${amount}s`);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // --- 4. Lógica de Progresso e Conclusão ---
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    setCurrentTime(current);

    // A. Lógica de Conclusão Inteligente (90%)
    if (!hasCompletedRef.current && duration > 0) {
      const progressPercent = (current / duration) * 100;
      if (progressPercent >= 90) {
        hasCompletedRef.current = true;
        if (onComplete) onComplete();
      }
    }

    // B. Salvamento Periódico (Debounce 10s)
    const now = Date.now();
    if (now - lastSaveTime.current > 10000) {
      saveProgress(current);
      lastSaveTime.current = now;
    }
  };

  // --- 5. Lógica de Fim de Vídeo (CRÍTICO) ---
  const handleVideoEnded = () => {
    setIsPlaying(false);
    
    // Se tiver próxima aula válida (calculado no page.tsx)
    if (autoPlayNext) {
        setShowAutoplay(true);
    } else {
        // Se for a última aula, mostra tela estática
        setShowEndScreen(true);
    }
  };

  const saveProgress = async (seconds: number) => {
    if (!user || !videoRef.current) return;
    const token = await user.getIdToken();
    saveVideoProgressAction(token, {
      courseId,
      lessonId,
      secondsWatched: seconds,
      totalDuration: videoRef.current.duration || 0
    });
  };

  // --- 6. Eventos de Mouse/Hover ---
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    setHoverTime(percent * duration);
    setHoverPos(percent * 100);
  };

  // --- 7. Autoplay Countdown ---
  useEffect(() => {
    if (showAutoplay && autoPlayNext) {
      autoplayTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
            if (onNext) onNext();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current); };
  }, [showAutoplay, autoPlayNext, onNext]);

  return (
    <div 
      className={`${styles.videoContainer} ${isFullscreen ? styles.fullscreen : ''}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onDoubleClick={toggleFullscreen}
    >
      {/* Elemento de Vídeo */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={styles.videoElement}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { setIsPlaying(true); setIsBuffering(false); setShowEndScreen(false); }}
        onCanPlay={() => setIsBuffering(false)}
        onEnded={handleVideoEnded} // <--- Handler Atualizado
        onClick={handlePlayPause}
      />

      {/* --- CAMADA 1: FEEDBACK VISUAL --- */}
      <div className={styles.overlayLayer}>
        {isBuffering && (
          <div className={styles.bufferingSpinner}>
            <Loader2 className={styles.spin} size={48} color="#915bf5" />
          </div>
        )}

        <div ref={feedbackRef} className={styles.feedbackIcon}>
          {feedback?.icon}
          {feedback?.text && <span>{feedback.text}</span>}
        </div>

        {/* Botão Play Central */}
        {!isPlaying && !isBuffering && !showAutoplay && !showEndScreen && (
          <div className={styles.centerPlayBtn} onClick={handlePlayPause}>
            <Play size={32} fill="white" />
          </div>
        )}
      </div>

      {/* --- CAMADA 2: AUTOPLAY (Se houver próxima) --- */}
      {showAutoplay && autoPlayNext && (
        <div className={styles.autoplayOverlay}>
          <div className={styles.autoplayContent}>
            <h3>Próxima aula em {countdown}s</h3>
            <div className={styles.autoplayActions}>
              <button onClick={() => onNext && onNext()} className={styles.btnPrimary}>
                <FastForward size={18} /> Assistir Agora
              </button>
              <button onClick={() => setShowAutoplay(false)} className={styles.btnSecondary}>
                <RotateCcw size={18} /> Reassistir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CAMADA 2.5: TELA DE CONCLUSÃO (Fim do Curso/Módulo sem next) --- */}
      {showEndScreen && !autoPlayNext && (
        <div className={styles.autoplayOverlay}>
          <div className={styles.autoplayContent}>
            <div style={{ color: '#4ade80', marginBottom: 10 }}>
                <RotateCcw size={40} />
            </div>
            <h3>Aula Finalizada!</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 20 }}>
                Você concluiu este conteúdo.
            </p>
            <div className={styles.autoplayActions}>
              <button 
                onClick={() => {
                    if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play();
                        setShowEndScreen(false);
                    }
                }} 
                className={styles.btnPrimary}
              >
                <RotateCcw size={18} /> Assistir Novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CAMADA 3: CONTROLES --- */}
      <div className={`${styles.controlsWrapper} ${showControls ? styles.visible : ''}`}>
        
        {/* Timeline Inteligente */}
        <div 
          className={styles.timelineContainer}
          onMouseMove={handleTimelineHover}
          onMouseLeave={() => setHoverTime(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            handleSeek(percent * duration);
          }}
        >
          {hoverTime !== null && (
            <div className={styles.timeTooltip} style={{ left: `${hoverPos}%` }}>
              {formatDuration(hoverTime)}
            </div>
          )}
          
          <div className={styles.trackBg}>
            <div 
              className={styles.trackFill} 
              style={{ width: `${(currentTime / duration) * 100}%` }} 
            />
            <div 
              className={styles.trackThumb} 
              style={{ left: `${(currentTime / duration) * 100}%` }} 
            />
          </div>
        </div>

        <div className={styles.controlsRow}>
          {/* Esquerda */}
          <div className={styles.leftControls}>
            <button onClick={handlePlayPause} className={styles.iconBtn}>
              {isPlaying ? <Pause size={20} fill="white"/> : <Play size={20} fill="white"/>}
            </button>
            
            <button onClick={() => skip(-10)} className={styles.iconBtn} title="-10s">
              <RotateCcw size={18} />
            </button>
            <button onClick={() => skip(10)} className={styles.iconBtn} title="+10s">
              <FastForward size={18} />
            </button>

            <div className={styles.volumeGroup}>
               <button onClick={() => setVolume(prev => prev === 0 ? 1 : 0)} className={styles.iconBtn}>
                 {volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20}/>}
               </button>
               <input 
                 type="range" min={0} max={1} step={0.1}
                 value={volume}
                 onChange={(e) => {
                    const val = Number(e.target.value);
                    setVolume(val);
                    if(videoRef.current) videoRef.current.volume = val;
                 }}
                 className={styles.volumeSlider}
               />
            </div>

            <span className={styles.timeDisplay}>
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          {/* Direita */}
          <div className={styles.rightControls}>
             <button 
                className={styles.speedBtn}
                onClick={() => {
                   const speeds = [1, 1.25, 1.5, 2];
                   const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
                   setPlaybackRate(next);
                   if(videoRef.current) videoRef.current.playbackRate = next;
                }}
             >
                {playbackRate}x
             </button>
             <button onClick={toggleFullscreen} className={styles.iconBtn}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}