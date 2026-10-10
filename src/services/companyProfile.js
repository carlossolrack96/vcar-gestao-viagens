import { doc, getDoc } from "firebase/firestore";
import db from "./database";

export async function getCompanyProfile(uid) {
  if (!uid) {
    throw new Error("Usuário não autenticado.");
  }

  const profileRef = doc(db, "users", uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    throw new Error(
      "Perfil não encontrado. Verifique o cadastro do usuário no VCAR."
    );
  }

  const profile = profileSnapshot.data();

  if (!profile.companyId) {
    throw new Error("O usuário não está vinculado a uma empresa.");
  }

  const companyRef = doc(db, "companies", profile.companyId);
  const companySnapshot = await getDoc(companyRef);

  if (!companySnapshot.exists()) {
    throw new Error("A empresa vinculada não foi encontrada.");
  }

  return {
    ...profile,
    company: companySnapshot.data(),
  };
}
