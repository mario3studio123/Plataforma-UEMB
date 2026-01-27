"use client";

import { useEffect, useState, useRef } from "react";
import { Award, Download, Calendar, Loader2 } from "lucide-react";
import styles from "./styles.module.css";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// Importações do PDF
import { PDFDownloadLink } from '@react-pdf/renderer';
import { SmartCertificate } from "@/components/Certificate/DynamicCertificate";
import { CertificateTemplate, CertificateRenderData } from "@/types/certificate";
import { getUserCertificatesAction } from "@/app/actions/certificateActions";

interface Certificate {
    id: string;
    courseTitle: string;
    issuedAt: string;
    validationCode: string;
    totalHours: string;
    userName: string;
    modulesCount?: number;
    companyName?: string;
}

export default function CertificatesPage() {
    const { user } = useAuth();
    const { isExpanded } = useSidebar();
    const { addToast } = useToast();
    
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [activeTemplate, setActiveTemplate] = useState<CertificateTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // 1. Busca Certificados e Template Ativo
    useEffect(() => {
        if (!user) return;
        
        const fetchData = async () => {
            try {
                const token = await user.getIdToken();
                const result = await getUserCertificatesAction(token);
                
                if (result.success) {
                    setCertificates(result.certificates as Certificate[]);
                    setActiveTemplate(result.activeTemplate as CertificateTemplate | null);
                } else {
                    addToast(result.message || "Erro ao buscar certificados", "error");
                }
            } catch (error) {
                console.error("Erro ao buscar certificados:", error);
                addToast("Erro ao carregar certificados", "error");
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [user, addToast]);

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

    // 3. Helper para preparar dados do certificado
    const prepareCertificateData = (cert: Certificate): CertificateRenderData => {
        const completionDate = new Date(cert.issuedAt).toLocaleDateString('pt-BR');
        const issueDate = new Date(cert.issuedAt).toLocaleDateString('pt-BR');
        
        return {
            studentName: cert.userName,
            courseTitle: cert.courseTitle,
            completionDate,
            totalHours: cert.totalHours,
            validationCode: cert.validationCode,
            modulesCount: cert.modulesCount || 0,
            instructorName: "Universidade da Embalagem",
            issueDate,
            companyName: cert.companyName || "Universidade da Embalagem",
        };
    };

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
                    {certificates.map((cert) => {
                        const renderData = prepareCertificateData(cert);
                        
                        return (
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

                                    {/* Botão de Download PDF com Template Dinâmico */}
                                    <PDFDownloadLink
                                        document={
                                            <SmartCertificate 
                                                template={activeTemplate} 
                                                data={renderData} 
                                            />
                                        }
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
                        );
                    })}
                </div>
            )}
        </div>
    );
}