"use client";

import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./styles.module.css";
// Removemos framer-motion
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function TopBar() {
  const { profile } = useAuth();
  const barRef = useRef<HTMLDivElement>(null);

  // Cálculo de XP
  const nextLevelXp = (profile?.level || 1) * 1000;
  const currentXp = profile?.xp || 0;
  const progressPercentage = Math.min((currentXp / nextLevelXp) * 100, 100);

  // Animação GSAP
  useGSAP(() => {
    if(!barRef.current) return;

    // Anima a largura e a cor (brilho ao encher)
    gsap.to(barRef.current, {
      width: `${progressPercentage}%`,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: function() {
        // Opcional: Efeito de brilho enquanto enche
        if (this.progress() < 1) {
            barRef.current!.style.filter = "brightness(1.3)";
        } else {
            barRef.current!.style.filter = "brightness(1)";
        }
      }
    });
  }, [progressPercentage]); // Reage sempre que o XP muda

  return (
    <header className={styles.header}>
      <div className={styles.statsContainer}>
        <div className={styles.levelBadge}>
          <span>LVL</span>
          <strong>{profile?.level || 1}</strong>
        </div>

        <div className={styles.xpWrapper}>
          <div className={styles.xpInfo}>
            <span>XP</span>
            <span>{currentXp} / {nextLevelXp}</span>
          </div>
          <div className={styles.progressBarBg}>
            {/* Div normal com ref para o GSAP */}
            <div 
              ref={barRef} 
              className={styles.progressBarFill} 
              style={{ width: '0%' }} 
            />
          </div>
        </div>
      </div>
    </header>
  );
}