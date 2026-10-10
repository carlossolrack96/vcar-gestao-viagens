import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAnh9OMCdFgBkrgelsTfD3Qq6id_4DXxpI",
  authDomain: "vcar-gestao-de-viagens.firebaseapp.com",
  projectId: "vcar-gestao-de-viagens",
  storageBucket: "vcar-gestao-de-viagens.firebasestorage.app",
  messagingSenderId: "865167347788",
  appId: "1:865167347788:web:17b97a3033c17810e0a4e9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
