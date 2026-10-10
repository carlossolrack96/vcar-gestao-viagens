import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import db from "./database";

function vehiclesCollection(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  return collection(db, "companies", companyId, "vehicles");
}

export async function listVehicles(companyId) {
  const vehiclesQuery = query(
    vehiclesCollection(companyId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(vehiclesQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function createVehicle(companyId, vehicle) {
  const vehicleData = {
    model: vehicle.model.trim(),
    plate: vehicle.plate.trim().toUpperCase(),
    year: vehicle.year || null,
    capacity: vehicle.capacity || null,
    currentKm: Number(vehicle.currentKm),
    maintenance: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(
    vehiclesCollection(companyId),
    vehicleData
  );

  return {
    id: result.id,
    ...vehicleData,
  };
}

export async function updateVehicle(companyId, vehicleId, changes) {
  const vehicleRef = doc(
    db,
    "companies",
    companyId,
    "vehicles",
    vehicleId
  );

  await updateDoc(vehicleRef, {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}
