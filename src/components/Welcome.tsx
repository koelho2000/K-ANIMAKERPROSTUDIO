import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Film, ArrowRight, Globe, User, Calendar, Tag, LogIn, LogOut, Plus, Edit2, Copy, Trash2, Loader2, Info } from "lucide-react";
import { auth, db } from "../firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, getDoc } from "firebase/firestore";
import { Project } from "../types";
import { v4 as uuidv4 } from "uuid";
import { ProjectProgressOverlay } from "./ProjectProgressOverlay";

interface WelcomeProps {
  onStart: (project?: Project) => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Welcome({ onStart }: WelcomeProps) {
  const version = "V4.0.0";
  const date = "19/03/2026";

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [dbSize, setDbSize] = useState<number>(0);

  // Overlay state
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayDescription, setOverlayDescription] = useState('');
  const [overlaySteps, setOverlaySteps] = useState<{label: string, status: 'pending'|'current'|'completed'}[]>([]);
  const [overlayTime, setOverlayTime] = useState<number | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        loadProjects(currentUser.uid);
      } else {
        setProjects([]);
        setDbSize(0);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadProjects = async (userId: string) => {
    setIsLoading(true);
    const path = `users/${userId}/projects`;
    try {
      const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      let totalSize = 0;
      const loadedProjects = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let projectSize = 0;
        if (data.chunksCount && data.chunksCount > 1) {
          projectSize = data.chunksCount * 800 * 1024; // Estimate 800KB per chunk
        } else {
          projectSize = new Blob([JSON.stringify(data)]).size;
        }
        totalSize += projectSize;
        return {
          ...data,
          id: doc.id,
          size: projectSize
        };
      });
      setProjects(loadedProjects);
      setDbSize(totalSize);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        console.log("Login popup closed by user.");
      } else {
        console.error("Login failed", error);
        alert("Ocorreu um erro ao fazer login. Por favor, tente novamente.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const generateProjectId = (title: string, director: string, author: string) => {
    const safeTitle = (title || 'SemTitulo').replace(/[^a-zA-Z0-9]/g, '');
    const safeDirector = (director || 'SemRealizador').replace(/[^a-zA-Z0-9]/g, '');
    const safeAuthor = (author || 'SemAutor').replace(/[^a-zA-Z0-9]/g, '');
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const uniqueCode = uuidv4().substring(0, 8);
    return `${safeTitle}+${safeDirector}+${safeAuthor}+${dateStr}+${uniqueCode}`;
  };

  const handleCreateProject = () => {
    onStart(); // Starts with empty project
  };

  const handleOpenProject = async (project: any) => {
    try {
      setIsOverlayOpen(true);
      setOverlayProgress(10);
      setOverlayDescription('A inicializar o carregamento...');
      setOverlaySteps([
        { label: 'A ligar à cloud', status: 'completed' },
        { label: 'A transferir dados', status: 'current' },
        { label: 'A processar projeto', status: 'pending' }
      ]);
      setOverlayTime(undefined);

      let projectDataStr = project.projectData || "{}";
      
      if (project.chunksCount && project.chunksCount > 1) {
        let fullData = "";
        for (let i = 0; i < project.chunksCount; i++) {
          const chunkDoc = await getDoc(doc(db, `users/${user?.uid}/projects/${project.id}/chunks/${i}`));
          if (chunkDoc.exists()) {
            fullData += chunkDoc.data().data;
          }
          const progress = 10 + Math.round(((i + 1) / project.chunksCount) * 60);
          setOverlayProgress(progress);
          setOverlayDescription(`A transferir parte ${i + 1} de ${project.chunksCount}...`);
        }
        projectDataStr = fullData;
      } else {
        setOverlayProgress(70);
        setOverlayDescription('A transferir dados...');
      }
      
      setOverlaySteps([
        { label: 'A ligar à cloud', status: 'completed' },
        { label: 'A transferir dados', status: 'completed' },
        { label: 'A processar projeto', status: 'current' }
      ]);
      setOverlayProgress(90);
      setOverlayDescription('A preparar o projeto...');

      const projectData = JSON.parse(projectDataStr);
      
      setOverlayProgress(100);
      setOverlaySteps([
        { label: 'A ligar à cloud', status: 'completed' },
        { label: 'A transferir dados', status: 'completed' },
        { label: 'A processar projeto', status: 'completed' }
      ]);
      setOverlayDescription('Projeto carregado com sucesso!');
      
      setTimeout(() => {
        setIsOverlayOpen(false);
        onStart(projectData);
      }, 500);
    } catch (error) {
      console.error("Failed to parse project data", error);
      alert("Erro ao abrir o projeto. Os dados podem estar corrompidos.");
      setIsOverlayOpen(false);
    }
  };

  const handleDuplicateProject = async (project: any) => {
    if (!user) return;
    
    try {
      let projectDataStr = project.projectData || "{}";
      if (project.chunksCount && project.chunksCount > 1) {
        setIsLoading(true);
        let fullData = "";
        for (let i = 0; i < project.chunksCount; i++) {
          const chunkDoc = await getDoc(doc(db, `users/${user.uid}/projects/${project.id}/chunks/${i}`));
          if (chunkDoc.exists()) {
            fullData += chunkDoc.data().data;
          }
        }
        projectDataStr = fullData;
      }
      
      const projectData = JSON.parse(projectDataStr);
      const newTitle = `${project.title} (Cópia)`;
      const newId = generateProjectId(newTitle, project.director, project.author);
      
      const newProjectData = {
        ...projectData,
        id: newId,
        title: newTitle
      };

      const newProjectDataStr = JSON.stringify(newProjectData);
      const CHUNK_SIZE = 800 * 1024;
      const chunksCount = Math.ceil(newProjectDataStr.length / CHUNK_SIZE);

      const newProjectDoc = {
        id: newId,
        userId: user.uid,
        title: newTitle,
        idea: project.idea || '',
        concept: project.concept || '',
        filmType: project.filmType || '',
        filmStyle: project.filmStyle || '',
        language: project.language || '',
        duration: project.duration || '',
        aspectRatio: project.aspectRatio || '',
        director: project.director || '',
        author: project.author || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        chunksCount,
        projectData: chunksCount === 1 ? newProjectDataStr : ""
      };

      await setDoc(doc(db, `users/${user.uid}/projects`, newId), newProjectDoc);
      
      if (chunksCount > 1) {
        for (let i = 0; i < chunksCount; i++) {
          const chunk = newProjectDataStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await setDoc(doc(db, `users/${user.uid}/projects/${newId}/chunks/${i}`), { data: chunk });
          // Add a small delay to prevent exhausting the Firestore write stream
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      await loadProjects(user.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user?.uid}/projects`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (project: any) => {
    if (!user) return;
    if (!window.confirm("Tem a certeza que deseja apagar este projeto? Esta ação não pode ser desfeita.")) return;

    const path = `users/${user.uid}/projects/${project.id}`;
    try {
      if (project.chunksCount && project.chunksCount > 1) {
        for (let i = 0; i < project.chunksCount; i++) {
          await deleteDoc(doc(db, `users/${user.uid}/projects/${project.id}/chunks/${i}`));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      await deleteDoc(doc(db, `users/${user.uid}/projects`, project.id));
      await loadProjects(user.uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Left Panel - Branding */}
      <div className="w-1/2 flex flex-col items-center justify-center p-12 relative z-10 border-r border-zinc-800/50 bg-zinc-900/20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-indigo-600 rounded-3xl mb-8 shadow-2xl shadow-indigo-500/20"
        >
          <Film className="w-12 h-12 text-white" />
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter text-center">
          K-ANIMAKER<br />
          <span className="text-indigo-500">PRO STUDIO</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-12 max-w-md mx-auto leading-relaxed text-center">
          A plataforma definitiva para realizadores de animação. 
          Gera guiões, personagens e vídeos com o poder da Inteligência Artificial.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12 w-full max-w-md">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Tag className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Versão</div>
            <div className="text-sm font-bold text-zinc-200">{version}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Calendar className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Data</div>
            <div className="text-sm font-bold text-zinc-200">{date}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <User className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Autor</div>
            <div className="text-sm font-bold text-zinc-200">Koelho2000</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
            <Globe className="w-4 h-4 text-indigo-400 mx-auto mb-2" />
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Website</div>
            <a href="https://www.koelho2000.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-400 hover:underline">
              koelho2000.com
            </a>
          </div>
        </div>
      </div>

      {/* Right Panel - Projects & Auth */}
      <div className="w-1/2 flex flex-col p-12 relative z-10 overflow-y-auto">
        <div className="flex justify-end mb-8">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />}
                <span className="text-zinc-300 text-sm">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all hover:scale-105"
            >
              <LogIn className="w-5 h-5" />
              Entrar com Google
            </button>
          )}
        </div>

        {user ? (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-white">Os Meus Projetos</h2>
                {!isLoading && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                    <span>Tamanho: {(dbSize / 1024 / 1024).toFixed(2)} MB</span>
                    <div className="relative group cursor-help">
                      <Info className="w-3.5 h-3.5 text-indigo-400" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-zinc-800 text-zinc-300 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                        O Firebase oferece 1 GiB de armazenamento gratuito. Para mais detalhes sobre custos, consulta a <a href="https://firebase.google.com/pricing?hl=pt-br" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline pointer-events-auto">página de preços do Firebase</a>.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleCreateProject}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Projeto
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-8 pr-2">
                {projects.map((proj) => (
                  <div key={proj.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 hover:border-indigo-500/50 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{proj.title || 'Projeto Sem Título'}</h3>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-zinc-500 font-mono">{proj.id}</p>
                          {proj.size !== undefined && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
                              {(proj.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenProject(proj)}
                          className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                          title="Editar Projeto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateProject(proj)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                          title="Duplicar Projeto"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(proj)}
                          className="p-2 bg-red-900/50 hover:bg-red-600 text-white rounded-lg transition-colors"
                          title="Apagar Projeto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-zinc-400">
                      <div><span className="text-zinc-500">Realizador:</span> {proj.director || '-'}</div>
                      <div><span className="text-zinc-500">Autor:</span> {proj.author || '-'}</div>
                      <div><span className="text-zinc-500">Estilo:</span> {proj.filmStyle || '-'}</div>
                      <div><span className="text-zinc-500">Atualizado:</span> {new Date(proj.updatedAt).toLocaleDateString()}</div>
                      {proj.size && <div className="col-span-2"><span className="text-zinc-500">Tamanho:</span> {(proj.size / 1024 / 1024).toFixed(2)} MB</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <Film className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg">Ainda não tem projetos.</p>
                <p className="text-sm mt-2">Crie o seu primeiro projeto para começar.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <User className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg text-center max-w-sm">
              Faça login para aceder aos seus projetos guardados na nuvem e criar novas animações.
            </p>
          </div>
        )}
      </div>
      
      <ProjectProgressOverlay
        isOpen={isOverlayOpen}
        type="load"
        progress={overlayProgress}
        description={overlayDescription}
        steps={overlaySteps}
        timeRemaining={overlayTime}
      />
    </div>
  );
}
