"use client";

import { useRef, useEffect } from "react";
import { Check, X, Star } from "lucide-react"; // Star para decorar
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./styles.module.css";
import { getLevelProgress, calculateXpForLevel } from "@/lib/gameRules";

interface LevelUpOverlayProps {
  data: {
    passed: boolean;
    score: number;
    xpEarned: number;
    oldXp: number;
    newXp: number;
    oldLevel: number;
    newLevel: number;
    leveledUp: boolean;
  };
  onClose: () => void;
}

export default function LevelUpOverlay({ data, onClose }: LevelUpOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Cálculos de Progresso
  // Se subiu de nível, a barra vai de X% até 100%, reseta, e vai de 0% a Y%
  const startProgress = getLevelProgress(data.oldXp);
  const endProgress = getLevelProgress(data.newXp);

  useGSAP(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Entrada Dramática (Background e Card)
    tl.to(containerRef.current, { opacity: 1, duration: 0.4 })
      .from(".anim-card", { 
        y: 100, 
        scale: 0.8, 
        opacity: 0, 
        duration: 0.8, 
        ease: "back.out(1.7)" 
      });

    // 2. Contagem de Score (Numérico)
    tl.fromTo(".anim-score", 
      { innerText: 0 }, 
      { 
        innerText: data.score, 
        duration: 1.5, 
        snap: { innerText: 1 }, // Arredonda números
        ease: "power2.out",
        onUpdate: function() {
            // @ts-ignore
            this.targets()[0].innerHTML = Math.ceil(this.targets()[0].innerText) + "%";
        }
      }, 
      "-=0.5"
    );

    if (data.passed) {
        // 3. Animação da Barra de XP
        if (data.leveledUp) {
            // Fase A: Enche até 100%
            tl.to(barRef.current, { 
                width: "100%", 
                duration: 0.8, 
                ease: "power1.in" 
            });
            
            // Fase B: EXPLOSÃO DE LEVEL UP
            tl.addLabel("levelup")
              .to(glowRef.current, { opacity: 1, scale: 2, duration: 0.3, yoyo: true, repeat: 1 }, "levelup")
              .to(".anim-card", { y: "+=10", duration: 0.1, yoyo: true, repeat: 3 }, "levelup") // Shake effect
              .set(barRef.current, { width: "0%" }) // Reseta barra instantaneamente
              
              // Fase C: Troca o Badge do Nível
              .to(".level-value", { 
                  scale: 0, duration: 0.2, 
                  onComplete: () => {
                      const el = document.querySelector(".level-value");
                      if(el) el.innerHTML = String(data.newLevel);
                  }
              }, "levelup")
              .to(".level-value", { scale: 1.5, color: "#4ade80", duration: 0.4, ease: "back.out(2)" })
              .to(".level-value", { scale: 1, color: "#fff", duration: 0.4 });

            // Fase D: Enche o restante do novo nível
            tl.to(barRef.current, { 
                width: `${endProgress}%`, 
                duration: 1, 
                delay: 0.2 
            });

        } else {
            // Apenas enche a barra normal
            tl.fromTo(barRef.current, 
                { width: `${startProgress}%` },
                { width: `${endProgress}%`, duration: 1.5, delay: 0.2 }
            );
        }

        // 4. Feedback de XP Ganhos
        tl.fromTo(".xp-pill", 
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
        );
    } else {
        // Falha (Shake e Vermelho)
        tl.to(".anim-card", { x: 5, duration: 0.1, yoyo: true, repeat: 5 });
    }

  }, { scope: containerRef });

  return (
    <div className={styles.overlay} ref={containerRef}>
      {/* Background Glow Dinâmico */}
      <div className={styles.ambientGlow} ref={glowRef} />

      <div className={`${styles.card} anim-card`}>
        
        {/* Ícone de Status */}
        <div className={`${styles.iconWrapper} ${data.passed ? styles.success : styles.fail}`}>
            {data.passed ? <Check size={40} strokeWidth={4} /> : <X size={40} strokeWidth={4} />}
        </div>

        {/* Textos Principais */}
        <h2 className={styles.title}>
            {data.passed ? (data.leveledUp ? "LEVEL UP!" : "MANDOU BEM!") : "TENTE NOVAMENTE"}
        </h2>
        
        <div className={styles.scoreWrapper}>
            <span className="anim-score">0%</span>
            <span className={styles.scoreLabel}>de acerto</span>
        </div>

        {/* Área de XP e Nível */}
        {data.passed && (
            <div className={styles.progressSection}>
                <div className={styles.levelBadge} ref={badgeRef}>
                    <span className={styles.levelLabel}>NÍVEL</span>
                    <span className="level-value" style={{ fontWeight: 800, fontSize: '1.5rem' }}>
                        {data.oldLevel}
                    </span>
                </div>

                <div className={styles.barContainer}>
                    <div className={styles.barTrack}>
                        <div className={styles.barFill} ref={barRef} style={{ width: `${startProgress}%` }} />
                        <div className={styles.barGlow} />
                    </div>
                    <div className={styles.xpInfo}>
                        <span>{data.oldXp} XP</span>
                        <div className={`${styles.xpPill} xp-pill`}>+{data.xpEarned} XP</div>
                    </div>
                </div>
            </div>
        )}

        <button onClick={onClose} className={styles.actionBtn}>
            {data.passed ? "Continuar Jornada" : "Revisar Conteúdo"}
        </button>
      </div>
    </div>
  );
}