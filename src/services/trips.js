import {
  addDoc,
  deleteDoc,
  doc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import db from "./database";

function tripsCollection(companyId) {
  if (!companyId) {
    throw new Error("Empresa não identificada.");
  }

  return collection(db, "companies", companyId, "trips");
}

export async function listTrips(companyId) {
  const tripsQuery = query(
    tripsCollection(companyId),
    orderBy("date", "desc")
  );

  const snapshot = await getDocs(tripsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function createTrip(companyId, trip) {
  if (!trip.date || !trip.origin?.trim() || !trip.destination?.trim()) {
    throw new Error("Data, origem e destino são obrigatórios.");
  }

  const tripData = {
    date: trip.date,
    time: trip.time || "",
    tripType: trip.tripType || "pontual",
    recurrenceDays: Array.isArray(trip.recurrenceDays) ? trip.recurrenceDays : [],
    recurrenceEnd: trip.recurrenceEnd || "",
    origin: trip.origin.trim(),
    destination: trip.destination.trim(),
    vehicle: trip.vehicle || "",
    driverRecordedBy: trip.driverRecordedBy.trim(),
    farePrice: Math.max(0, Number(trip.farePrice || 0)),
    publicBooking: trip.publicBooking === true,
    notes: (trip.notes || "").trim(),
    companyId,
    createdBy: trip.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(tripsCollection(companyId), tripData);

  return {
    id: result.id,
    ...tripData,
  };
}

export async function deleteTrip(companyId, tripId) {
  if (!companyId || !tripId) {
    throw new Error("Empresa ou viagem não identificada.");
  }
  await deleteDoc(doc(db, "companies", companyId, "trips", tripId));
}
