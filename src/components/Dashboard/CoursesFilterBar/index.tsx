import { Search, Loader2 } from "lucide-react"; // Importe Loader2
import styles from "./styles.module.css";

interface Props {
    search: string;
    onSearchChange: (val: string) => void;
    levelFilter: string;
    onLevelChange: (val: string) => void;
    isFiltering?: boolean; // Nova prop opcional
}

export default function CoursesFilterBar({ 
    search, 
    onSearchChange, 
    levelFilter, 
    onLevelChange,
    isFiltering = false 
}: Props) {
    return (
        <div className={styles.barContainer}>
            {/* Input de Busca */}
            <div className={styles.searchWrapper}>
                {/* Ícone muda se estiver filtrando/processando */}
                {isFiltering ? (
                    <Loader2 size={20} className={`${styles.searchIcon} ${styles.spin}`} />
                ) : (
                    <Search size={20} className={styles.searchIcon} />
                )}
                
                <input 
                    type="text" 
                    placeholder="Buscar curso por título..." 
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Filtros de Nível */}
            <div className={styles.filtersWrapper}>
                {["all", "Básico", "Intermediário", "Avançado"].map((lvl) => {
                    // Lógica para deixar o label mais amigável
                    const label = lvl === "all" ? "Todos" : lvl;
                    const isActive = levelFilter === lvl || (levelFilter === "" && lvl === "all");

                    return (
                        <button
                            key={lvl}
                            onClick={() => onLevelChange(lvl)}
                            className={`${styles.filterPill} ${isActive ? styles.active : ''}`}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
        </div>
    );
}