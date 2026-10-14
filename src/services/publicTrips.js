import { supabase } from "./supabase";

export async function listPublicTrips(companyCode) {
  if (!companyCode) throw new Error("Empresa não identificada.");

  const { data, error } = await supabase.rpc("list_public_trips", {
    p_company_code: companyCode,
  });

  if (error) throw new Error("Não foi possível carregar as viagens públicas.");
  return data || [];
}
