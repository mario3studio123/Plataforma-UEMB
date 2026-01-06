"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Check } from "lucide-react"; 
import styles from "./page.module.css";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type Step = "intro" | "name" | "email" | "password";

export default function Home() {
  const { login, register, user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  
  // Estado para armazenar o passo anterior para decidir a direção da animação
  const previousStep = useRef<Step>("intro");

  const [formData, setFormData] = useState({ name: "", email: "", password: "" });

  useEffect(() => { if (user) router.push("/dashboard"); }, [user, router]);

  // 1. Animação Inicial
  useGSAP(() => {
    // Logo entra com efeito elástico
    gsap.from(logoRef.current, { y: -80, opacity: 0, duration: 1.5, ease: "elastic.out(1, 0.5)" });
  }, []);

  // 2. Animação de Mudança de Passo (O Coração da Fluidez)
  useGSAP(() => {
    if (!containerRef.current) return;

    // Configuração de "Entrada"
    // Ao entrar, o elemento vem um pouco maior (scale 1.1) e invisivel, e assenta no lugar
    
    const tl = gsap.timeline();

    // Anima o container principal
    tl.fromTo(containerRef.current, 
        { autoAlpha: 0, scale: 1.1, filter: "blur(10px)" }, // Começa borrado e grande
        { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.6, ease: "circ.out" }
    );

    // Anima os elementos internos em cascata (Stagger)
    // Seleciona inputs, titulos e botoes dentro do container
    const children = containerRef.current.children;
    if (children.length > 0) {
        tl.from(children, {
            y: 20,
            opacity: 0,
            duration: 0.4,
            stagger: 0.1, // Um após o outro
            ease: "back.out(1.7)", // Pequeno "pulo" ao entrar
        }, "-=0.4"); // Começa antes do container terminar
    }

  }, [step]); // Dispara a cada novo passo

  // Função customizada de transição
  const transitionToStep = (nextStep: Step) => {
    if (!containerRef.current) {
        setStep(nextStep);
        return;
    }

    // Animação de SAÍDA (Implosão)
    // O passo atual diminui e borra, dando espaço para o próximo
    gsap.to(containerRef.current, {
        scale: 0.9,
        opacity: 0,
        filter: "blur(10px)",
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => {
            previousStep.current = step;
            setError("");
            setStep(nextStep);
            // O useGSAP acima detecta a mudança de 'step' e roda a entrada
        }
    });
  };

  const handleNext = () => {
    setError("");
    if (step === "name" && !formData.name) return shakeAnimation();
    if (step === "email" && !formData.email.includes("@")) return shakeAnimation();
    if (step === "password" && formData.password.length < 6) return shakeAnimation();

    if (step === "intro") transitionToStep(isLoginMode ? "email" : "name");
    else if (step === "name") transitionToStep("email");
    else if (step === "email") transitionToStep("password");
    else if (step === "password") handleSubmit();
  };

  // Efeito de erro (Tremida agressiva e vermelha)
  const shakeAnimation = (msg = "Preencha corretamente") => {
    setError(msg);
    const el = containerRef.current;
    if (el) {
        gsap.timeline()
            .to(el, { x: -10, duration: 0.05 })
            .to(el, { x: 10, duration: 0.05, repeat: 3, yoyo: true })
            .to(el, { x: 0, duration: 0.05 });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    // Animação de pulso no botão enquanto carrega
    gsap.to(".submit-btn", { scale: 0.9, duration: 0.5, yoyo: true, repeat: -1 });

    try {
      if (isLoginMode) await login(formData.email, formData.password);
      else await register(formData.name, formData.email, formData.password);
    } catch (err) {
      console.error(err);
      gsap.killTweensOf(".submit-btn"); // Para animação de loading
      gsap.to(".submit-btn", { scale: 1 });
      shakeAnimation("Erro ao autenticar.");
      setLoading(false);
    }
  };

  const toggleMode = () => {
    // Rotação 3D ao trocar modo Login <-> Cadastro
    gsap.to(containerRef.current, {
        rotationY: 90, opacity: 0, duration: 0.3, onComplete: () => {
            setIsLoginMode(!isLoginMode);
            setError("");
            setFormData({ name: "", email: "", password: "" });
            setStep(isLoginMode ? "name" : "email"); 
            // Volta a rotação
            gsap.fromTo(containerRef.current, 
                { rotationY: -90, opacity: 0 },
                { rotationY: 0, opacity: 1, duration: 0.5, ease: "back.out" }
            );
        }
    });
  };

  // Helper de Renderização
  const renderInput = () => {
    // ... (Mantenha seu switch case original aqui, igual ao anterior)
    // Apenas certifique-se de adicionar a classe "submit-btn" no botão do render
    switch (step) {
      case "name": return { title: "Qual o seu nome?", placeholder: "Seu nome completo", type: "text", value: formData.name, field: "name" };
      case "email": return { title: "Qual seu e-mail?", placeholder: "seu@email.com", type: "email", value: formData.email, field: "email" };
      case "password": return { title: "Crie uma senha", placeholder: "Mínimo 6 caracteres", type: "password", value: formData.password, field: "password" };
      default: return null;
    }
  };
  const currentInput = renderInput();

  return (
    <main className={styles.container} style={{ perspective: "1000px" }}> {/* Adicionado Perspective para o 3D funcionar */}
      
      <div className={styles.logoArea} ref={logoRef}>
        <img src="/logo-uemb.png" alt="" />
      </div>

      <div className={styles.animWrapper} ref={containerRef}>
        {step === "intro" && (
            <>
                <h1 className={styles.title}>Vamos começar?</h1>
                <button 
                    className={styles.nextBtn} 
                    onClick={() => handleNext()} 
                    style={{ width: "auto", padding: "0 32px", borderRadius: 99 }}
                    onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.05, duration: 0.2 })}
                    onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })}
                >
                Começar jornada
                </button>
            </>
        )}

        {step !== "intro" && currentInput && (
            <>
                <h2 className={styles.title}>{currentInput.title}</h2>
                <div className={styles.inputGroup}>
                <input
                    className={styles.input}
                    type={currentInput.type}
                    placeholder={currentInput.placeholder}
                    value={currentInput.value}
                    autoFocus
                    onChange={(e) => setFormData({ ...formData, [currentInput.field]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                />
                <button className={`${styles.nextBtn} submit-btn`} onClick={handleNext} disabled={loading}>
                    {loading ? <div className={styles.spinner} /> : step === "password" ? <Check size={24} /> : <ArrowRight size={24} />}
                </button>
                </div>
                {error && <p className={styles.error} style={{ opacity: 0 }}>{error}</p>}
                {/* Nota: useGSAP vai animar o erro entrando se ele existir */}
            </>
        )}
      </div>

      <div className={styles.footerLink} onClick={toggleMode}>
        {isLoginMode ? <>Não tem conta? <span>Cadastre-se</span></> : <>Já possui uma conta? <span>Fazer login</span></>}
      </div>
    </main>
  );
}