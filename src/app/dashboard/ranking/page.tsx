"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/types"; // <--- Importação Centralizada
import { LayoutGrid, Video, Clock, CheckCircle2 } from "lucide-react";
import { LiveClock, Medal } from "@/components/Ranking/RankingAssets";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSidebar } from "@/context/SidebarContext";

// Interface auxiliar para a UI (estende o perfil com campos formatados se necessário)
interface RankingUIUser extends UserProfile {
  // Podemos adicionar propriedades visuais extras aqui se precisar no futuro
  // Por enquanto, usaremos os dados diretos do UserProfile
}

export default function RankingPage() {
  const { isExpanded } = useSidebar();
  const [users, setUsers] = useState<RankingUIUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs para Animação
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const podiumRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- 1. BUSCA DE DADOS REAIS ---
  useEffect(() => {
    const fetchRanking = async () => {
      try {
        // Ordena por XP (quem tem mais pontos fica em cima)
        const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(50));
        const snapshot = await getDocs(q);
        
        const data = snapshot.docs.map(doc => {
          const userData = doc.data() as UserProfile;
          
          // O Firestore retorna os dados brutos. 
          // O TypeScript garante que 'stats' existe na interface, 
          // mas no banco antigo pode não existir, então usamos o operador ?. e || 0
          return {
            ...userData,
            // Garantia extra caso o campo não exista no banco ainda
            stats: {
                lessonsCompleted: userData.stats?.lessonsCompleted || 0,
                quizzesCompleted: userData.stats?.quizzesCompleted || 0,
                certificatesEarned: userData.stats?.certificatesEarned || 0,
                loginStreak: userData.stats?.loginStreak || 0
            }
          };
        });
        
        setUsers(data);
      } catch (error) {
        console.error("Erro ao buscar ranking:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, []);

  // --- 2. ANIMAÇÕES (Sidebar & Entrada) ---
  useGSAP(() => {
    if (loading || !containerRef.current) return;
    
    // Ajuste responsivo da Sidebar
    gsap.to(containerRef.current, {
      paddingLeft: isExpanded ? 480 : 130, // Ajustado para bater com seu layout
      duration: 0.5,
      ease: "power3.inOut"
    });

    // Entrada Triunfal dos elementos
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    
    tl.from(headerRef.current?.children || [], { y: -30, opacity: 0, stagger: 0.1, duration: 0.6 });
    tl.from(podiumRef.current?.children || [], { y: 50, opacity: 0, scale: 0.8, stagger: 0.15, duration: 0.8 }, "-=0.3");
    tl.from(listRef.current, { y: 50, opacity: 0, duration: 0.6 }, "-=0.5");

  }, [isExpanded, loading]);


  if (loading) return <div className={styles.loadingScreen}>Carregando Ranking...</div>;

  // Separação do Pódio
  const top1 = users[0];
  const top2 = users[1];
  const top3 = users[2];
  const restOfList = users.slice(3);

  // Totais do Sistema (Soma real dos usuários listados)
  const totalLessonsWatched = users.reduce((acc, u) => acc + (u.stats?.lessonsCompleted || 0), 0);
  const totalQuizzesPassed = users.reduce((acc, u) => acc + (u.stats?.quizzesCompleted || 0), 0);

  return (
    <div className={styles.container} ref={containerRef}>
      
      {/* SEÇÃO SUPERIOR: ESTATÍSTICAS GERAIS */}
      <div className={styles.headerGrid} ref={headerRef}>
        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <span className={styles.bigNumber}>{totalLessonsWatched}</span>
            <span className={styles.label}>Aulas Assistidas</span>
          </div>
          <div className={`${styles.iconCircle} ${styles.iconPurple}`}>
            <Video size={24} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <span className={styles.bigNumber}>{totalQuizzesPassed}</span>
            <span className={styles.label}>Provas Aprovadas</span>
          </div>
          <div className={`${styles.iconCircle} ${styles.iconPink}`}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className={`${styles.statCard} ${styles.clockCard}`}>
          <div className={styles.clockHeader}>
            <span>Ranking em tempo real 🔥</span>
          </div>
          <div className={styles.clockBody}>
            <div className={`${styles.iconCircle} ${styles.iconClock}`}>
              <Clock size={24} />
            </div>
            <LiveClock />
          </div>
          <span className={styles.dateLabel}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* SEÇÃO PÓDIO */}
      <div className={styles.podiumGrid} ref={podiumRef}>
        {/* 1º LUGAR */}
        {top1 && (
          <div className={`${styles.podiumCard} ${styles.winnerCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.avatarWrapper}>
                <div className={styles.avatar}>
                   {top1.avatarUrl ? <img src={top1.avatarUrl} alt="" /> : top1.name.charAt(0)}
                </div>
                <div className={styles.rankBadgeWhite}>1</div>
              </div>
              <div className={styles.userInfo}>
                <h3>{top1.name}</h3>
                <span>Nível {top1.level}</span>
              </div>
              <div className={styles.medalPos}>
                <Medal type="gold" />
              </div>
            </div>
            
            <div className={styles.badgePillWinner}>Líder do Ranking</div>
            
            <div className={styles.statsRowWinner}>
              <div className={styles.statItem}>
                  <span>Aulas</span>
                  <strong>{top1.stats?.lessonsCompleted || 0}</strong>
              </div>
              <div className={styles.statItem}>
                  <span>Provas</span>
                  <strong>{top1.stats?.quizzesCompleted || 0}</strong>
              </div>
              <div className={styles.statItem}>
                  <span>XP</span>
                  <strong>{top1.xp}</strong>
              </div>
            </div>
          </div>
        )}

        {/* 2º LUGAR */}
        {top2 && (
          <div className={styles.podiumCard}>
            <div className={styles.cardHeaderSmall}>
              <div className={styles.userInfoSmall}>
                <h3>{top2.name}</h3>
                <div className={styles.badgePill}>Nível {top2.level}</div>
              </div>
              <div className={styles.medalPosSmall}><Medal type="silver" /></div>
            </div>
            <div className={styles.statsRow}>
              <div className={styles.statItem}><span>Aulas</span><strong>{top2.stats?.lessonsCompleted || 0}</strong></div>
              <div className={styles.statItem}><span>XP</span><strong>{top2.xp}</strong></div>
            </div>
          </div>
        )}

        {/* 3º LUGAR */}
        {top3 && (
          <div className={styles.podiumCard}>
            <div className={styles.cardHeaderSmall}>
              <div className={styles.userInfoSmall}>
                <h3>{top3.name}</h3>
                <div className={styles.badgePill}>Nível {top3.level}</div>
              </div>
              <div className={styles.medalPosSmall}><Medal type="bronze" /></div>
            </div>
            <div className={styles.statsRow}>
              <div className={styles.statItem}><span>Aulas</span><strong>{top3.stats?.lessonsCompleted || 0}</strong></div>
              <div className={styles.statItem}><span>XP</span><strong>{top3.xp}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* LISTA GLOBAL */}
      <div className={styles.listSection} ref={listRef}>
        <h2 className={styles.listTitle}>Top 50 Global</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{width: '80px'}}>Pos</th>
                <th>Aluno</th>
                <th>Nível</th>
                <th>Aulas</th>
                <th>Provas</th>
                <th>Total XP</th>
              </tr>
            </thead>
            <tbody>
              {restOfList.map((user, index) => (
                <tr key={user.uid}>
                  <td><div className={styles.rankCircle}>{index + 4}</div></td>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.smallAvatar}>
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.charAt(0)}
                      </div>
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td><span className={styles.levelTag}>Lvl {user.level}</span></td>
                  <td>{user.stats?.lessonsCompleted || 0}</td>
                  <td>{user.stats?.quizzesCompleted || 0}</td>
                  <td className={styles.pointsCell}>{user.xp} XP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}