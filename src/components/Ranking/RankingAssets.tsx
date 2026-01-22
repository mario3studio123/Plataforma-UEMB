"use client";

import { useEffect, useState } from "react";
import styles from "@/app/dashboard/ranking/styles.module.css";

// --- RELÓGIO EM TEMPO REAL ---
export function LiveClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <div className={styles.clockTime}>{time}</div>;
}

// --- MEDALHA (Ouro, Prata, Bronze) ---
export function Medal({ type }: { type: "gold" | "silver" | "bronze" }) {
  const colors = {
    gold: { main: "#FFD700", shadow: "#D4AF37", gradient: "linear-gradient(135deg, #FFD700 0%, #FDB931 100%)" },
    silver: { main: "#C0C0C0", shadow: "#A9A9A9", gradient: "linear-gradient(135deg, #E0E0E0 0%, #B0B0B0 100%)" },
    bronze: { main: "#CD7F32", shadow: "#8B4513", gradient: "linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)" }
  };

  const style = colors[type];

  return (
    <div className={styles.medalWrapper}>
      {/* Fita Vermelha */}
      <div className={styles.ribbon}>
        <div className={styles.ribbonLeft}></div>
        <div className={styles.ribbonRight}></div>
      </div>
      {/* Moeda */}
      <div className={styles.coin} style={{ background: style.gradient, boxShadow: `0 4px 0 ${style.shadow}` }}>
         <div className={styles.coinInner} />
      </div>
    </div>
  );
}