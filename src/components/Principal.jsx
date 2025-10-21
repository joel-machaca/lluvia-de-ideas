import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faThLarge, faTrophy, faUserCircle, faExclamationTriangle, faThumbsDown, faHandPointUp, faLightbulb } from '@fortawesome/free-solid-svg-icons';

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

// Config Firebase (Manteniendo la configuración que proporcionaste)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);




const VOTE_WEIGHTS = { poco: 1, importante: 5, muy: 10 };


// Definición de colores y etiquetas para cada tipo de voto
const voteTypes = [
    { type: "poco", label: "Poco Importante", weight: VOTE_WEIGHTS.poco, color: "bg-slate-800",colorh: "hover:bg-slate-600",text:"text-slate-700",bg:"bg-slate-100",count:"text-slate-800", icon: faThumbsDown },
    { type: "importante", label: "Importante", weight: VOTE_WEIGHTS.importante, color: "bg-yellow-600",colorh: "hover:bg-yellow-400",text:"text-yellow-700",bg:"bg-yellow-100",count:"text-yellow-800", icon: faHandPointUp },
    { type: "muy", label: "Muy Importante", weight: VOTE_WEIGHTS.muy, color: "bg-green-700",colorh: "hover:bg-green-600",text:"text-green-700",bg:"bg-green-100",count:"text-green-800", icon: faLightbulb },
];

const calcularPuntuacion = (votos) =>
  (votos?.poco || 0) * VOTE_WEIGHTS.poco +
  (votos?.importante || 0) * VOTE_WEIGHTS.importante +
  (votos?.muy || 0) * VOTE_WEIGHTS.muy;

function Principal() {
  const [ideas, setIdeas] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(localStorage.getItem("usuarioActual") || "");
  const [mostrarModalAuth, setMostrarModalAuth] = useState(!localStorage.getItem("usuarioActual")); // Mostrar si no hay sesión
  const [inputIdea, setInputIdea] = useState("");
  const [inputUsuario, setInputUsuario] = useState("");
  const [orden, setOrden] = useState("newest"); // Cambiado a 'newest' para coincidir con <option>
  const [tab, setTab] = useState("ideas");
  const [rememberMe, setRememberMe] = useState(false); // Estado para "Recordar mi sesión"

  // --- FIREBASE y LÓGICA ---
  // (Mantengo tus funciones de Firebase tal cual las proporcionaste)
  // const cargarIdeas = async () => {
  //   const querySnapshot = await getDocs(collection(db, "ideas"));
  //   const listaIdeas = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  //   setIdeas(listaIdeas);
  // };

  const guardarIdeaFirebase = async (texto) => {
    await addDoc(collection(db, "ideas"), {
      texto,
      votos: { poco: 0, importante: 0, muy: 0 },
      votosUsuarios: {},
      agregadoPor: usuarioActual,
      fecha: Date.now(),
    });
    // cargarIdeas();
  };

  const actualizarVotoFirebase = async (ideaId, tipoVoto) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    const tipoActual = idea.votosUsuarios?.[usuarioActual];
    const votos = { ...idea.votos };
    const votosUsuarios = { ...idea.votosUsuarios };

    if (tipoActual === tipoVoto) {
      votos[tipoActual]--;
      delete votosUsuarios[usuarioActual];
    } else {
      if (tipoActual) votos[tipoActual]--;
      votos[tipoVoto] = (votos[tipoVoto] || 0) + 1;
      votosUsuarios[usuarioActual] = tipoVoto;
    }
    await updateDoc(doc(db, "ideas", ideaId), { votos, votosUsuarios });
    // cargarIdeas();
  };

  const eliminarIdeaFirebase = async (ideaId) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (idea?.agregadoPor !== usuarioActual) return alert("No puedes eliminar esta idea");
    if (window.confirm("¿Seguro que quieres eliminar esta idea?")) {
      await deleteDoc(doc(db, "ideas", ideaId));
      // cargarIdeas();
    }
  };

  // --- AUTENTICACIÓN ---
  const iniciarSesion = () => {
    const username = inputUsuario.trim();
    if (!username) return alert("Por favor, ingresa tu Nombre de Usuario o ID.");

    setUsuarioActual(username);
    localStorage.setItem("usuarioActual", username);
    if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
    } else {
        localStorage.removeItem("rememberMe");
    }
    setMostrarModalAuth(false);
    setInputUsuario("");
  };

  const cerrarSesion = () => {
    setUsuarioActual("");
    localStorage.removeItem("usuarioActual");
    localStorage.removeItem("rememberMe");
  };

  // --- INTERFAZ ---
  const agregarIdea = () => {
    if (!usuarioActual) return setMostrarModalAuth(true);
    if (!inputIdea.trim()) return;
    guardarIdeaFirebase(inputIdea.trim());
    setInputIdea("");
    setOrden("newest");
  };

  const votarIdea = (ideaId, tipo) => {
    if (!usuarioActual) return setMostrarModalAuth(true);
    actualizarVotoFirebase(ideaId, tipo);
  };

  const ideasOrdenadas = useMemo(() => {
    const copia = [...ideas];
    if (orden === "score") copia.sort((a, b) => calcularPuntuacion(b.votos) - calcularPuntuacion(a.votos));
    else if (orden === "newest") copia.sort((a, b) => b.fecha - a.fecha);
    else if (orden === "oldest") copia.sort((a, b) => a.fecha - b.fecha);
    return copia;
  }, [ideas, orden]);

  useEffect(() => {
    // cargarIdeas();
    const unsubscribe = onSnapshot(collection(db, "ideas"), (snapshot) => {
      const listaIdeas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIdeas(listaIdeas);
    });
    // Comprobar si la sesión debe ser recordada
    if (localStorage.getItem("rememberMe") === "true" && localStorage.getItem("usuarioActual")) {
        setUsuarioActual(localStorage.getItem("usuarioActual"));
        setMostrarModalAuth(false);
    } else if (!localStorage.getItem("usuarioActual")) {
        setMostrarModalAuth(true);
    }
    return () => unsubscribe();
  }, []);

  // Función para obtener las clases de voto
  const getVoteButtonClasses = (votoUsuario, tipo,bgcolor,bgcolorh) => {
    const baseClasses = "vote-btn rounded-full transition";
    const activeClasses = `${bgcolor} text-white ${bgcolorh}`;
    const inactiveClasses = `text-slate-600 hover:bg-slate-300`;

    return `${baseClasses} ${votoUsuario === tipo ? activeClasses : inactiveClasses}`;
  };

  const getVoteIcon = (type) => {
    if (type === 'poco') return faThumbsDown;
    if (type === 'importante') return faHandPointUp;
    if (type === 'muy') return faLightbulb;
    return null;
  };

  return (
    // Agregamos la clase scroll-smooth al div contenedor principal
    <div className="text-slate-800 scroll-smooth"> 
      {/* Modal de Autenticación */}
      <div id="authModal" className={`modal fixed inset-0 z-50 flex items-center justify-center ${mostrarModalAuth ? '' : 'hidden'}`}>
        <div className="modal-content bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Inicia Sesión para Votar</h2>
          <div className="space-y-4">
            <input
              type="text"
              id="userInput"
              placeholder="Tu Nombre de Usuario o ID"
              value={inputUsuario}
              onChange={(e) => setInputUsuario(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && iniciarSesion()}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center">
                <input 
                    type="checkbox" 
                    id="rememberMe" 
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="rememberMe" className="ml-2 text-sm text-slate-600">Recordar mi sesión</label>
            </div>
            <button
              id="loginBtn"
              onClick={iniciarSesion}
              className="w-full bg-blue-600 text-white font-semibold p-3 rounded-xl hover:bg-blue-700 transition shadow-md"
            >
              Acceder y Votar
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">⚠️ Esto es una simulación. Los datos se guardan solo en tu navegador.</p>
        </div>
      </div>
    
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Idea Grid</h1>
          <p className="text-lg text-slate-500 mt-2 max-w-2xl mx-auto">Captura, vota y visualiza tus ideas en un diseño de cuadrícula flexible.</p>
        </header>

        {/* User Status */}
        <div id="userStatus" className={`bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-4 mb-6 rounded-lg max-w-4xl mx-auto flex justify-between items-center ${usuarioActual ? '' : 'hidden'}`} role="alert">
            <div className="flex items-center">
                <FontAwesomeIcon icon={faUserCircle} className="mr-3" />
                <p className="font-bold">Sesión activa:</p>
                <span id="currentUsername" className="ml-2 font-semibold">{usuarioActual}</span>
            </div>
            <button 
                id="logoutBtn" 
                onClick={cerrarSesion} 
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition">
                Cerrar Sesión
            </button>
        </div>
        
        {/* Input de Nueva Idea */}
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-8 max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              id="ideaInput"
              placeholder="Añade una idea y presiona Enter..."
              value={inputIdea}
              onChange={(e) => setInputIdea(e.target.value)}
              disabled={!usuarioActual}
              className="grow p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow duration-200"
              onKeyPress={(e) => e.key === "Enter" && agregarIdea()}
            />
            <button
              id="addIdeaBtn"
              onClick={agregarIdea}
              disabled={!usuarioActual}
              className="bg-blue-600 text-white font-semibold px-5 py-4 rounded-xl hover:bg-blue-700 transition shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
          {!usuarioActual && (
            <p id="ideaInputHint" className="text-sm text-red-500 mt-2">¡Debes iniciar sesión para añadir ideas!</p>
          )}
        </div>

        {/* Tabs de Navegación */}
        <div className="border-b border-slate-200 mb-6">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              id="tab-ideas"
              onClick={() => setTab("ideas")}
              // Clases tab-btn y active del CSS original
              className={`tab-btn text-slate-500 font-semibold whitespace-nowrap py-4 px-6 border-b-2 border-transparent text-lg hover:border-slate-300 hover:text-slate-700 ${tab === "ideas" ? "active" : ""}`}
            >
              <FontAwesomeIcon icon={faThLarge} className="mr-2" /> Ideas (<span id="ideaCounter">{ideas.length}</span>)
            </button>
            <button
              id="tab-stats"
              onClick={() => setTab("ranking")}
              className={`tab-btn text-slate-500 font-semibold whitespace-nowrap py-4 px-6 border-b-2 border-transparent text-lg hover:border-slate-300 hover:text-slate-700 ${tab === "ranking" ? "active" : ""}`}
            >
              <FontAwesomeIcon icon={faTrophy} className="mr-2" /> Ranking
            </button>
          </nav>
        </div>

        {/* Contenido Principal */}
        <main>
          {/* Sección de Ideas */}
          <section id="ideas-section" className={tab === "ideas" ? "" : "hidden"}>
            <div className="flex justify-between items-center mb-4">
                {!usuarioActual && (
                    <span id="voteWarning" className="text-sm text-red-500 font-medium">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> ¡Inicia sesión para votar!
                    </span>
                )}
                <select 
                    id="sortSelect" 
                    className="rounded-lg border-slate-300 text-sm focus:ring-blue-500 focus:border-blue-500 ml-auto"
                    value={orden}
                    onChange={(e) => setOrden(e.target.value)}
                >
                    <option value="newest">Más Recientes</option>
                    <option value="score">Más Votadas</option>
                    <option value="oldest">Más Antiguas</option>
                </select>
            </div>
            
            <div id="ideasContainer" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {ideasOrdenadas.map((idea) => {
                const puntaje = calcularPuntuacion(idea.votos);
                const votoUsuario = idea.votosUsuarios?.[usuarioActual] || null;


                
                return (
                  // Usamos las clases del CSS externo: idea-card y fade-in
                  <div key={idea.id} className="idea-card bg-white p-5 rounded-xl shadow-md fade-in">
                    <div className="grow">
                        <p className="text-xs font-semibold text-slate-400 mb-2">Añadida por: <span className="text-blue-500">{idea.agregadoPor || 'Anónimo'}</span></p>
                        <p className="text-lg font-medium text-slate-800 wrap-break-word mb-4">{idea.texto}</p>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-4 border-t border-gray-300 pt-3">
                            <span className="text-sm font-medium text-slate-500">Puntuación Total</span>
                            <span className="text-2xl font-bold text-blue-600">{puntaje}</span>
                        </div>
                        <div className="space-y-2">
                            {voteTypes.map(({ type, label, weight,text,count,bg,color,colorh}) => (
                                <div key={type} className="flex justify-between items-center text-sm">
                                    <span className={`font-medium ${text}`}>{label} (+{weight} pts)</span>
                                    <div className={`vote-control flex items-center gap-2 ${bg} rounded-full p-1`}>
                                        <span className={`font-bold ${count} w-6 text-center`}>{idea.votos[type] || 0}</span>
                                        <button
                                            onClick={() => votarIdea(idea.id, type)}
                                            className={getVoteButtonClasses(votoUsuario, type,color,colorh)}
                                            title={`Votar ${label}`}
                                        >
                                            <FontAwesomeIcon icon={getVoteIcon(type)} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {usuarioActual === idea.agregadoPor && (
                            <button 
                                onClick={() => eliminarIdeaFirebase(idea.id)} 
                                className="delete-btn bg-red-500 mx-auto block text-white text-xs font-semibold py-1 px-3 rounded-lg mt-4 hover:bg-red-600 transition"
                            >
                                Eliminar idea
                            </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sección de Ranking */}
          <section id="stats-section" className={tab === "ranking" ? "" : "hidden"}>
            <div className="bg-white p-6 rounded-2xl shadow-lg max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Ranking de Ideas</h2>
                <div id="resultsContainer" className="space-y-3">
                    {ideasOrdenadas
                        .filter((idea) => calcularPuntuacion(idea.votos) > 0)
                        .sort((a, b) => calcularPuntuacion(b.votos) - calcularPuntuacion(a.votos))
                        .map((idea, idx, arr) => {
                            const score = calcularPuntuacion(idea.votos);
                            const maxScore = calcularPuntuacion(arr[0].votos);
                            const pct = (score / maxScore) * 100;
                            
                            let rankIcon = idx + 1;
                            let rankClass = "text-slate-600";
                            if (idx === 0) { rankIcon = "🏆"; rankClass = "text-amber-500"; }
                            else if (idx === 1) { rankIcon = "🥈"; rankClass = "text-slate-400"; }
                            else if (idx === 2) { rankIcon = "🥉"; rankClass = "text-orange-400"; }

                            return (
                                <div key={idea.id} className="p-4 rounded-lg bg-white shadow-md hover:shadow-lg transition">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xl font-bold w-6 text-center ${rankClass}`}>{rankIcon}</span>
                                            <p className="font-medium text-slate-700">{idea.texto}</p>
                                        </div>
                                        <span className="font-bold text-blue-600 text-lg">{score} pts</span>
                                    </div>
                                    <div className="ranking-bar-container"> {/* Clase del CSS externo */}
                                        <div className="ranking-bar" style={{ width: `${pct}%` }}></div> {/* Clase del CSS externo */}
                                    </div>
                                    <div className="flex justify-end text-xs text-slate-500 mt-2 space-x-3">
                                        <span>Poco: {idea.votos.poco || 0}</span>
                                        <span>Imp: {idea.votos.importante || 0}</span>
                                        <span>Muy: {idea.votos.muy || 0}</span>
                                        <span className="text-blue-500 font-semibold ml-4">Añadida por: {idea.agregadoPor || 'Anónimo'}</span>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Principal;