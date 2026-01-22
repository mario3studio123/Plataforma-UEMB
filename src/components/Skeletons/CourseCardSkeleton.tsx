import styles from "./styles.module.css"; // Vamos criar um CSS simples pra ele

export default function CourseCardSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonImage} ${styles.shimmer}`} />
      <div className={styles.skeletonContent}>
        <div className={`${styles.skeletonTitle} ${styles.shimmer}`} />
        <div className={`${styles.skeletonBadge} ${styles.shimmer}`} />
      </div>
    </div>
  );
}