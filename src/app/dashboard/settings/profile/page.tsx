"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, Mail, Camera, Save, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import styles from "./styles.module.css";
// Supondo que você tenha uma action para atualizar user
// import { updateUserProfileAction } from "@/app/actions/userActions"; 

export default function ProfileSettings() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(profile?.name || "");

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulação de delay ou chamada real
      await new Promise(r => setTimeout(r, 1000)); 
      // await updateUserProfileAction(user.uid, { name });
      addToast("Perfil atualizado com sucesso!", "success");
    } catch (error) {
      addToast("Erro ao atualizar perfil.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.avatarSection}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" />
            ) : (
              <span>{profile?.name?.charAt(0)}</span>
            )}
          </div>
          <button className={styles.cameraBtn}>
            <Camera size={18} />
          </button>
        </div>
        <p className={styles.roleTag}>{profile?.role === 'admin' ? 'Administrador' : 'Aluno'}</p>
      </div>

      <div className={styles.formSection}>
        <div className={styles.inputGroup}>
          <label><User size={16} /> Nome Completo</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Seu nome"
          />
        </div>

        <div className={styles.inputGroup}>
          <label><Mail size={16} /> E-mail (Não alterável)</label>
          <input 
            type="email" 
            value={profile?.email || ""} 
            disabled 
            className={styles.disabledInput}
          />
        </div>

        <div className={styles.actions}>
          <button onClick={handleSave} disabled={loading} className={styles.saveBtn}>
            {loading ? <Loader2 className={styles.spin} size={18} /> : <Save size={18} />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}