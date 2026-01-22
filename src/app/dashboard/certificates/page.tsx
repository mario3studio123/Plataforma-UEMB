"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Award, Download, Calendar, Loader2 } from "lucide-react";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSidebar } from "@/context/SidebarContext";

// Importações do PDF
import { PDFDownloadLink } from '@react-pdf/renderer';
import { CertificateTemplate } from "@/components/Certificate/CertificateTemplate";

interface Certificate {
    id: string;
    courseTitle: string;
    issuedAt: string;
    validationCode: string;
    totalHours: string;
    userName: string;
}

export default function CertificatesPage() {
    const { user } = useAuth();
    const { isExpanded } = useSidebar();
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // 1. Busca Certificados
    useEffect(() => {
        if (!user) return;
        const fetchCerts = async () => {
            try {
                const q = query(
                    collection(db, "certificates"), 
                    where("userId", "==", user.uid),
                    // orderBy requer índice composto com userId, crie se o console pedir
                    // Por enquanto faremos sort no client para evitar erro de índice imediato
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data() as Certificate);
                
                // Ordenação Client-Side (Mais recente primeiro)
                data.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
                
                setCertificates(data);
            } catch (error) {
                console.error("Erro ao buscar certificados:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCerts();
    }, [user]);

    // 2. Animação
    useGSAP(() => {
        if (containerRef.current) {
            gsap.to(containerRef.current, {
                paddingLeft: isExpanded ? 440 : 160,
                duration: 0.5,
                ease: "power3.inOut"
            });
        }

        if (!loading && gridRef.current) {
            gsap.from(gridRef.current.children, {
                y: 30, opacity: 0, stagger: 0.1, duration: 0.6, ease: "back.out(1.2)"
            });
        }
    }, [isExpanded, loading]);

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.header}>
                <h1>Minhas Conquistas</h1>
                <p>Aqui ficam registrados seus certificados oficiais.</p>
            </div>

            {loading ? (
                <div className={styles.loading}>
                    <Loader2 className={styles.spin} size={40} />
                    <p>Buscando troféus...</p>
                </div>
            ) : certificates.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIconBg}><Award size={48} /></div>
                    <h3>Nenhum certificado ainda</h3>
                    <p>Conclua 100% de um curso para desbloquear seu primeiro certificado!</p>
                </div>
            ) : (
                <div className={styles.grid} ref={gridRef}>
                    {certificates.map((cert) => (
                        <div key={cert.id} className={styles.certCard}>
                            <div className={styles.certRibbon} />
                            
                            <div className={styles.certContent}>
                                <div className={styles.iconWrapper}>
                                    <Award size={32} color="#fff" />
                                </div>
                                <h3 className={styles.courseTitle}>{cert.courseTitle}</h3>
                                
                                <div className={styles.metaRow}>
                                    <Calendar size={14} />
                                    <span>{new Date(cert.issuedAt).toLocaleDateString('pt-BR')}</span>
                                    <span className={styles.dot}>•</span>
                                    <span>{cert.totalHours}</span>
                                </div>

                                <div className={styles.codeBox}>
                                    ID: {cert.validationCode}
                                </div>

                                {/* Botão de Download PDF */}
                                <PDFDownloadLink
                                    document={<CertificateTemplate data={cert} />}
                                    fileName={`Certificado-${cert.courseTitle.replace(/\s+/g, '-')}.pdf`}
                                    className={styles.downloadBtn}
                                >
                                    {/* @ts-ignore - Propriedade loading injetada pelo PDFDownloadLink */}
                                    {({ loading: pdfLoading }) => (
                                        <>
                                            {pdfLoading ? <Loader2 size={16} className={styles.spin}/> : <Download size={16} />}
                                            {pdfLoading ? "Gerando..." : "Baixar PDF"}
                                        </>
                                    )}
                                </PDFDownloadLink>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}