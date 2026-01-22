// src/components/TopBar/index.tsx
"use client";

import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { getLevelProgress } from "@/lib/gameRules";
import { Coins } from "lucide-react";

export default function TopBar() {
  const { profile } = useAuth();
  const barRef = useRef<HTMLDivElement>(null);

  const currentXp = profile?.xp || 0;
  const currentCoins = profile?.wallet?.coins || 0;
  const progressPercentage = getLevelProgress(currentXp);

  useGSAP(() => {
    if(!barRef.current) return;

    gsap.to(barRef.current, {
      width: `${progressPercentage}%`,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: function() {
        if (this.progress() < 1) {
            barRef.current!.style.filter = "brightness(1.3)";
        } else {
            barRef.current!.style.filter = "brightness(1)";
        }
      }
    });
  }, [progressPercentage]);

  return (
    <header className={styles.header}>
      <div className={styles.hudContainer}>
        
        {/* GRUPO 1: NÍVEL E PROGRESSO */}
        <div className={styles.levelGroup}>
          <div className={styles.levelBadge}>
            <span>LVL</span>
            <strong>{profile?.level || 1}</strong>
          </div>

          <div className={styles.xpWrapper}>
            <div className={styles.xpInfo}>
              <span className={styles.xpLabel}>Progresso</span>
              <span className={styles.xpValue}>{currentXp} XP</span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                ref={barRef} 
                className={styles.progressBarFill} 
                style={{ width: '0%' }} 
              />
            </div>
          </div>
        </div>

        {/* Separador Vertical */}
        <div className={styles.divider} />

        {/* GRUPO 2: MOEDAS */}
        <div className={styles.coinsWrapper} title="Saldo PackCoins">
           <div className={styles.coinIconBg}>
             <Coins size={16} color="#fbbf24" strokeWidth={2.5} />
           </div>
           <span className={styles.coinValue}>{currentCoins}</span>
        </div>

      </div>
    </header>
  );
}