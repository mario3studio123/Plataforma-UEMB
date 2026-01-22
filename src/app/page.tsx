"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Check, Sparkles, AlertCircle } from "lucide-react";
import styles from "./page.module.css";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useToast } from "@/context/ToastContext";

// Schemas
import { LoginSchema, RegisterSchema } from "@/lib/schemas/authSchemas";

gsap.registerPlugin(useGSAP);

// --- 1. COMPONENTE: AnimatedTitle (ADICIONE ISTO AQUI) ---
const AnimatedTitle = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    // Animação de entrada dos caracteres
    gsap.fromTo(containerRef.current.children,
      { y: 100, opacity: 0, rotateX: -90 },
      {
        y: 0,
        opacity: 1,
        rotateX: 0,
        stagger: 0.03,
        duration: 0.8,
        ease: "back.out(1.7)"
      }
    );
  }, [text]);

  return (
    <div className={styles.titleWrapper} ref={containerRef}>
      {text.split("").map((char, i) => (
        <span key={i} className={styles.titleChar}>
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </div>
  );
};

// --- 2. COMPONENTE: Google Icon ---
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// --- 3. COMPONENTE: Fundo Estrelado ---
const CinematicBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    const stars = 60;

    for (let i = 0; i < stars; i++) {
      const star = document.createElement("div");
      star.classList.add(styles.star);
      containerRef.current.appendChild(star);

      const size = Math.random() * 3;
      gsap.set(star, {
        width: size, height: size,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        opacity: Math.random() * 0.5 + 0.1
      });

      gsap.to(star, {
        y: `-=${Math.random() * 100 + 50}`,
        x: `+=${Math.random() * 50 - 25}`,
        opacity: 0,
        duration: Math.random() * 3 + 2,
        repeat: -1,
        ease: "none",
        delay: Math.random() * 5
      });
    }
  }, []);

  return <div ref={containerRef} className={styles.backgroundLayer} />;
};

type Step = "intro" | "name" | "email" | "password" | "forgot";

// --- FUNÇÃO PRINCIPAL ---
export default function Home() {
  const { login, loginWithGoogle, register, resetPassword, user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>("intro");
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });

  const logoRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const q = gsap.utils.selector(contentRef);

  useEffect(() => { if (user) router.push("/dashboard"); }, [user, router]);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(logoRef.current, {
      y: -150,
      opacity: 0,
      scale: 0.5,
      duration: 1.2,
      ease: "elastic.out(1, 0.6)"
    });
  }, []);

  const handleTransition = async (nextStep: Step) => {
    if (!contentRef.current) { setStep(nextStep); return; }
    await gsap.to(q(".anim-element"), { z: 500, scale: 1.5, opacity: 0, filter: "blur(20px)", duration: 0.4, stagger: 0.05, ease: "power2.in" });
    setStep(nextStep);
    setError("");
    gsap.set(q(".anim-element"), { z: -800, scale: 0.5, opacity: 0, filter: "blur(30px)", y: 0 });
    gsap.to(q(".anim-element"), { z: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.8, stagger: 0.1, ease: "elastic.out(1, 0.75)", overwrite: "auto" });
  };

  const handleNext = async () => {
    setError("");

    try {
      if (step === "name") {
        RegisterSchema.shape.name.parse(formData.name);
        handleTransition("email");
      } 
      else if (step === "email") {
        LoginSchema.shape.email.parse(formData.email);
        handleTransition("password");
      }
      else if (step === "password") {
        if(isLoginMode) {
           LoginSchema.parse({ email: formData.email, password: formData.password });
           await handleSubmit();
        } else {
           RegisterSchema.parse(formData);
           await handleSubmit();
        }
      }
      else if (step === "forgot") {
         LoginSchema.shape.email.parse(formData.email);
         await handleForgot();
      }
      else if (step === "intro") {
        handleTransition(isLoginMode ? "email" : "name");
      }
    } catch (err: any) {
      if(err.issues) {
         shakeAnimation(err.issues[0].message);
      } else {
         shakeAnimation("Verifique os dados.");
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    gsap.to(".submit-btn", { scale: 0.95, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" });

    try {
      if (isLoginMode) await login(formData.email, formData.password);
      else await register(formData.name, formData.email, formData.password);
    } catch (err: any) {
      gsap.killTweensOf(".submit-btn");
      gsap.to(".submit-btn", { scale: 1 });
      shakeAnimation(err.message);
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setLoading(true);
    try {
        await resetPassword(formData.email);
        setStep("intro");
    } catch (err: any) {
        shakeAnimation(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      try {
          await loginWithGoogle();
      } catch (error: any) {
          addToast(error.message, "error");
      }
  }

  const shakeAnimation = (msg: string) => {
    setError(msg);
    const element = contentRef.current;
    
    if (element) {
      gsap.to(element, {
        x: -10,
        duration: 0.05,
        repeat: 5,
        yoyo: true,
        ease: "sine.inOut",
        onComplete: () => {
          // As chaves {} aqui resolvem o erro de tipagem
          gsap.to(element, { x: 0, clearProps: "x", duration: 0.1 });
        }
      });
    }
  };

  const renderInput = () => {
    const config = {
      name: { title: "Qual o seu nome?", placeholder: "Nome completo", type: "text", field: "name" },
      email: { title: "Qual seu e-mail?", placeholder: "seu@email.com", type: "email", field: "email" },
      password: { title: "Digite sua senha", placeholder: "••••••••", type: "password", field: "password" },
      forgot: { title: "Recuperar Senha", placeholder: "Confirme seu e-mail", type: "email", field: "email" }
    }[step as string];

    if (!config) return null;

    return (
      <>
        <div className="anim-element">
          <AnimatedTitle text={config.title} />
        </div>

        <div className={`${styles.inputGroup} anim-element`}>
          <input
            className={styles.input}
            type={config.type}
            placeholder={config.placeholder}
            value={(formData as any)[config.field]}
            autoFocus
            onChange={(e) => setFormData({ ...formData, [config.field]: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
          />
          <button
            className={`${styles.nextBtn} submit-btn`}
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? <div className={styles.spinner} /> : step === "password" || step === "forgot" ? <Check size={28} /> : <ArrowRight size={28} />}
          </button>
        </div>

        {error && <p className={`${styles.error} anim-element`}><AlertCircle size={14}/> {error}</p>}
        
        {step === "password" && isLoginMode && (
            <p 
                className="anim-element" 
                style={{ marginTop: 15, fontSize: '0.85rem', color: '#888', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => handleTransition("forgot")}
            >
                Esqueci minha senha
            </p>
        )}
      </>
    );
  };

  return (
    <main className={`main-container ${styles.container}`}>
      <CinematicBackground />

      <div className={styles.logoArea} ref={logoRef}>
        <img src="/logo-uemb.png" alt="UE" />
      </div>

      <div className={styles.animWrapper} ref={contentRef}>
        {step === "intro" ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div className="anim-element">
              <AnimatedTitle text={isLoginMode ? "Bem-vindo de volta." : "Sua jornada começa aqui."} />
            </div>

            <button
              className={`${styles.nextBtn} anim-element`}
              onClick={() => handleNext()}
              style={{ width: 'auto', padding: '0 32px', borderRadius: 99, gap: 12 }}
            >
              <Sparkles size={20} />
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{isLoginMode ? "Entrar com E-mail" : "Criar Conta"}</span>
            </button>

          </div>
        ) : (
          renderInput()
        )}
      </div>

      <div className={styles.footerLink} onClick={() => {
          setIsLoginMode(!isLoginMode);
          setStep("intro");
          setError("");
          gsap.fromTo(".main-container", { opacity: 0.5, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.3 });
      }}>
        {isLoginMode ? (
          <>Novo por aqui? <span>Criar conta</span></>
        ) : (
          <>Já é aluno? <span>Fazer login</span></>
        )}
      </div>
    </main>
  );
}