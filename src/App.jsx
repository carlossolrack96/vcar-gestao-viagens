
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./services/firebase";
import { getCompanyProfile } from "./services/companyProfile";
import { getCompanySettings, saveCompanySettings } from "./services/companySettings";
import { createVehicle, listVehicles, updateVehicle } from "./services/vehicles";
import { createTrip, listTrips, deleteTrip } from "./services/trips";
import { publishTrip } from "./services/publishTrip";
import { createTransaction, listTransactions } from "./services/transactions";
import { listPublicTrips } from "./services/publicTrips";
import { submitPublicBooking } from "./services/publicBookings";
import { createClient, listClients } from "./services/clients";
import { createBooking, listBookings, updateBookingStatus } from "./services/bookings";
import "./App.css";

const NAV_ITEMS = [
  { id: "calendar", label: "Calendário", icon: "▦" },
  { id: "trips", label: "Viagens", icon: "⇄" },
  { id: "clients", label: "Clientes", icon: "♙" },
  { id: "finance", label: "Financeiro", icon: "R$" },
  { id: "more", label: "Mais", icon: "•••" },
];

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}


function PublicReservations() {
  const params = new URLSearchParams(window.location.search);
  const companyCode = params.get("empresa") || "";
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ tripId: "", passengerName: "", whatsapp: "", passengers: "1", boarding: "", dropoff: "" });

  useEffect(() => {
    let active = true;
    listPublicTrips(companyCode)
      .then((items) => { if (active) setTrips(items); })
      .catch((err) => { if (active) setError(err.message || "Não foi possível carregar as viagens."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyCode]);

  async function sendRequest(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await submitPublicBooking({ companyCode, ...form });
      setNotice("Solicitação enviada! A empresa entrará em contato para confirmar.");
      setForm((current) => ({ ...current, passengerName: "", whatsapp: "", boarding: "", dropoff: "" }));
    } catch (err) {
      setError(err.message || "Não foi possível enviar a solicitação.");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card public-reservations">
        <div className="brand"><div className="brand-logo">V</div><div><h1>VCAR</h1><p>Reservas de viagens</p></div></div>
        <h2>Viagens disponíveis</h2>
        {!companyCode && <p className="login-error">Link inválido: falta identificar a empresa.</p>}
        {loading && <p>Carregando viagens...</p>}
        {!loading && companyCode && trips.length === 0 && !error && <p className="muted-text">Nenhuma viagem disponível no momento.</p>}
        {trips.map((trip) => (
          <button key={trip.id} type="button" className="secondary-button" style={{ width: "100%", marginBottom: 8, justifyContent: "space-between" }} onClick={() => setForm((current) => ({ ...current, tripId: trip.id }))}>
            <span>{trip.origin} → {trip.destination}<br />{trip.travel_date} {trip.travel_time || ""}</span>
            <strong>{money(trip.fare_price)}</strong>
          </button>
        ))}
        {trips.length > 0 && <form className="login-form" onSubmit={sendRequest}>
          <h3>Solicitar reserva</h3>
          <div className="field"><label>Viagem</label><select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })} required><option value="">Selecione a viagem</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.origin} → {trip.destination} — {trip.travel_date}</option>)}</select></div>
          <div className="field"><label>Nome completo</label><input value={form.passengerName} onChange={(e) => setForm({ ...form, passengerName: e.target.value })} required /></div>
          <div className="field"><label>WhatsApp</label><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} required /></div>
          <div className="field"><label>Quantidade de passageiros</label><input type="number" min="1" max="20" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: e.target.value })} required /></div>
          <div className="field"><label>Local de embarque</label><input value={form.boarding} onChange={(e) => setForm({ ...form, boarding: e.target.value })} required /></div>
          <div className="field"><label>Destino/desembarque</label><input value={form.dropoff} onChange={(e) => setForm({ ...form, dropoff: e.target.value })} required /></div>
          {error && <p className="login-error">{error}</p>}
          {notice && <p className="notice">{notice}</p>}
          <button type="submit">Solicitar reserva</button>
        </form>}
        {error && trips.length === 0 && <p className="login-error">{error}</p>}
      </section>
    </main>
  );
}

function App() {
  if (window.location.pathname === "/reservas") return <PublicReservations />;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [companySettings, setCompanySettings] = useState({});
  const [settingsForm, setSettingsForm] = useState({});
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (!cancelled) {
          setUser(null);
          setCompanyProfile(null);
          setAuthReady(true);
        }
        return;
      }

      try {
        const profile = await getCompanyProfile(currentUser.uid);
        const settings = await getCompanySettings(profile.companyId);

        if (!cancelled) {
          setUser(currentUser);
          setCompanyProfile(profile);
          setCompanySettings(settings);
          setSettingsForm({
            name: settings.name ?? profile.company.name ?? "",
            cnpj: settings.cnpj ?? profile.company.cnpj ?? "",
            phone: settings.phone ?? profile.company.phone ?? "",
            address: settings.address ?? profile.company.address ?? "",
            footer: settings.footer ?? "",
            logoDataUrl: settings.logoDataUrl ?? "",
          });
          setError("");
        }
      } catch (err) {
        console.error("Erro ao restaurar a sessão:", err);

        if (!cancelled) {
          setUser(null);
          setCompanyProfile(null);
          setError("Não foi possível recuperar o perfil da empresa. Entre novamente.");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);


  const [page, setPage] = useState("calendar");
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    clientId: "",
    boarding: "",
    dropoff: "",
    passengers: "1",
    farePrice: "",
    amountReceived: "0",
    notes: "",
  });

  const [clients, setClients] = useState([]);
  const [clientError, setClientError] = useState("");
  const [clientNotice, setClientNotice] = useState("");
  const [clientLoading, setClientLoading] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "",
    cpf: "",
    whatsapp: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    zipCode: "",
    defaultBoarding: "",
    defaultDropoff: "",
    notes: "",
  });

  const [transactions, setTransactions] = useState([]);
  const [transactionError, setTransactionError] = useState("");
  const [transactionNotice, setTransactionNotice] = useState("");
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    date: dateKey(new Date()),
    type: "income",
    amount: "",
    category: "Passagens",
    description: "",
    tripId: "",
    paymentMethod: "Pix",
  });

  const [showTripForm, setShowTripForm] = useState(false);
  const [tripNotice, setTripNotice] = useState("");
  const [tripError, setTripError] = useState("");
  const [tripForm, setTripForm] = useState({
    date: dateKey(new Date()),
    time: "",
    tripType: "pontual",
    recurrenceDays: [],
    recurrenceEnd: "",
    origin: "",
    destination: "",
    vehicle: "",
    driverRecordedBy: "",
    farePrice: "",
    publicBooking: false,
    notes: "",
  });

  useEffect(() => {
    if (!companyProfile?.companyId || !selectedTripId) {
      setBookings([]);
      setBookingError("");
      return;
    }

    let cancelled = false;

    async function loadBookings() {
      try {
        const savedBookings = await listBookings(
          companyProfile.companyId,
          selectedTripId
        );

        if (!cancelled) {
          setBookings(savedBookings);
          setBookingError("");
        }
      } catch (err) {
        console.error("Erro ao carregar agendamentos:", err);

        if (!cancelled) {
          setBookingError(
            "Não foi possível carregar os agendamentos desta viagem."
          );
        }
      }
    }

    loadBookings();

    return () => {
      cancelled = true;
    };
  }, [companyProfile?.companyId, selectedTripId]);

  useEffect(() => {
    if (!companyProfile?.companyId) {
      setClients([]);
      return;
    }

    let cancelled = false;

    async function loadClients() {
      try {
        const savedClients = await listClients(companyProfile.companyId);

        if (!cancelled) {
          setClients(savedClients);
          setClientError("");
        }
      } catch (err) {
        console.error("Erro ao carregar clientes:", err);

        if (!cancelled) {
          setClientError(
            "Não foi possível carregar os clientes. Verifique as regras do Firestore."
          );
        }
      }
    }

    loadClients();

    return () => {
      cancelled = true;
    };
  }, [companyProfile?.companyId]);

  useEffect(() => {
    if (!companyProfile?.companyId) {
      setTrips([]);
      return;
    }

    let cancelled = false;

    async function loadTrips() {
      try {
        const savedTrips = await listTrips(companyProfile.companyId);

        if (!cancelled) {
          setTrips(savedTrips);
        }
      } catch (err) {
        console.error("Erro ao carregar viagens:", err);

        if (!cancelled) {
          setTripError(
            "Não foi possível carregar as viagens. Verifique as regras e a conexão com o Firebase."
          );
        }
      }
    }

    loadTrips();

    return () => {
      cancelled = true;
    };
  }, [companyProfile?.companyId]);
  useEffect(() => {
    if (!companyProfile?.companyId) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      try {
        const savedTransactions = await listTransactions(companyProfile.companyId);

        if (!cancelled) {
          setTransactions(savedTransactions);
          setTransactionError("");
        }
      } catch (err) {
        console.error("Erro ao carregar lançamentos financeiros:", err);

        if (!cancelled) {
          setTransactionError(
            "Não foi possível carregar os lançamentos. Verifique as regras do Firestore."
          );
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [companyProfile?.companyId]);

  useEffect(() => {
    if (!companyProfile?.companyId) {
      setVehicles([]);
      return;
    }

    let cancelled = false;

    async function loadVehicles() {
      try {
        const savedVehicles = await listVehicles(companyProfile.companyId);

        if (!cancelled) {
          setVehicles(savedVehicles);
          setSelectedVehicleId((current) =>
            current && savedVehicles.some((vehicle) => vehicle.id === current)
              ? current
              : savedVehicles[0]?.id ?? null
          );
        }
      } catch (err) {
        console.error("Erro ao carregar veículos:", err);

        if (!cancelled) {
          setVehicleError(
            "Não foi possível carregar os veículos. Verifique as regras e a conexão com o Firebase."
          );
        }
      }
    }

    loadVehicles();

    return () => {
      cancelled = true;
    };
  }, [companyProfile?.companyId]);

  const [vehicles, setVehicles] = useState([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [vehicleNotice, setVehicleNotice] = useState("");
  const [vehicleError, setVehicleError] = useState("");

  const [vehicleForm, setVehicleForm] = useState({
    model: "",
    plate: "",
    year: "",
    capacity: "",
    currentKm: "",
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: "",
    date: dateKey(new Date()),
    km: "",
    nextKm: "",
    nextDate: "",
    workshop: "",
    cost: "",
    notes: "",
  });

  async function handleVehicleSubmit(event) {
    event.preventDefault();
    setVehicleError("");
    setVehicleNotice("");

    if (!companyProfile?.companyId) {
      setVehicleError("Empresa não identificada. Saia e entre novamente.");
      return;
    }

    const plate = vehicleForm.plate.trim().toUpperCase();

    if (
      !vehicleForm.model.trim() ||
      !plate ||
      vehicleForm.currentKm === "" ||
      !Number.isFinite(Number(vehicleForm.currentKm)) ||
      Number(vehicleForm.currentKm) < 0
    ) {
      setVehicleError(
        "Informe o modelo, a placa e uma quilometragem válida."
      );
      return;
    }

    if (vehicles.some((vehicle) => vehicle.plate === plate)) {
      setVehicleError("Já existe um veículo com essa placa.");
      return;
    }

    try {
      const newVehicle = await createVehicle(companyProfile.companyId, {
        ...vehicleForm,
        model: vehicleForm.model.trim(),
        plate,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
        capacity: vehicleForm.capacity ? Number(vehicleForm.capacity) : null,
        currentKm: Number(vehicleForm.currentKm),
      });

      setVehicles((current) => [...current, newVehicle]);
      setSelectedVehicleId(newVehicle.id);
      setVehicleForm({
        model: "",
        plate: "",
        year: "",
        capacity: "",
        currentKm: "",
      });
      setShowVehicleForm(false);
      setVehicleNotice("Veículo salvo no banco de dados.");
    } catch (err) {
      console.error("Erro ao salvar veículo:", err);
      setVehicleError(
        err.code === "permission-denied"
          ? "O Firebase negou o acesso. Confira o vínculo do usuário com a empresa."
          : "Não foi possível salvar o veículo. Verifique a conexão e tente novamente."
      );
    }
  }

  async function handleMileageUpdate(event, vehicleId) {
    event.preventDefault();
    setVehicleError("");
    setVehicleNotice("");

    if (!companyProfile?.companyId) {
      setVehicleError("Empresa não identificada. Entre novamente no sistema.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const km = Number(formData.get("currentKm"));
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    if (!Number.isFinite(km) || km < 0) {
      setVehicleError("Informe uma quilometragem válida.");
      return;
    }

    if (!vehicle) {
      setVehicleError("Veículo não encontrado.");
      return;
    }

    if (km < vehicle.currentKm) {
      setVehicleError("A nova quilometragem não pode ser menor que a registrada.");
      return;
    }

    try {
      const updatedAt = dateKey(new Date());

      await updateVehicle(companyProfile.companyId, vehicleId, {
        currentKm: km,
        mileageUpdatedAt: updatedAt,
      });

      setVehicles((current) =>
        current.map((item) =>
          item.id === vehicleId
            ? { ...item, currentKm: km, mileageUpdatedAt: updatedAt }
            : item
        )
      );

      setVehicleNotice("Quilometragem salva no banco de dados.");
    } catch (err) {
      console.error("Erro ao atualizar quilometragem:", err);
      setVehicleError(
        err.code === "permission-denied"
          ? "O Firebase negou a atualização. Verifique as regras de acesso."
          : "Não foi possível salvar a quilometragem. Tente novamente."
      );
    }
  }

  async function handleMaintenanceSubmit(event, vehicleId) {
    event.preventDefault();
    setVehicleError("");
    setVehicleNotice("");

    if (!companyProfile?.companyId) {
      setVehicleError("Empresa não identificada. Entre novamente no sistema.");
      return;
    }

    const vehicle = vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      setVehicleError("Selecione um veículo válido.");
      return;
    }

    if (
      !maintenanceForm.type.trim() ||
      !maintenanceForm.date ||
      maintenanceForm.km === "" ||
      !Number.isFinite(Number(maintenanceForm.km)) ||
      Number(maintenanceForm.km) < 0
    ) {
      setVehicleError(
        "Informe o serviço, a data e uma quilometragem válida."
      );
      return;
    }

    if (Number(maintenanceForm.km) > vehicle.currentKm) {
      setVehicleError(
        "A quilometragem da manutenção não pode ser maior que a quilometragem atual do veículo."
      );
      return;
    }

    if (
      maintenanceForm.nextKm !== "" &&
      Number(maintenanceForm.nextKm) < Number(maintenanceForm.km)
    ) {
      setVehicleError(
        "A próxima quilometragem deve ser igual ou maior que a quilometragem da manutenção."
      );
      return;
    }

    const record = {
      id: `${Date.now()}`,
      type: maintenanceForm.type.trim(),
      date: maintenanceForm.date,
      km: Number(maintenanceForm.km),
      nextKm:
        maintenanceForm.nextKm === ""
          ? null
          : Number(maintenanceForm.nextKm),
      nextDate: maintenanceForm.nextDate || "",
      cost: maintenanceForm.cost === "" ? 0 : Number(maintenanceForm.cost),
      workshop: maintenanceForm.workshop.trim(),
      notes: maintenanceForm.notes.trim(),
    };

    try {
      const updatedMaintenance = [...(vehicle.maintenance || []), record];

      await updateVehicle(companyProfile.companyId, vehicleId, {
        maintenance: updatedMaintenance,
      });

      setVehicles((current) =>
        current.map((item) =>
          item.id === vehicleId
            ? { ...item, maintenance: updatedMaintenance }
            : item
        )
      );

      setMaintenanceForm({
        type: "",
        date: dateKey(new Date()),
        km: "",
        nextKm: "",
        nextDate: "",
        workshop: "",
        cost: "",
        notes: "",
      });

      setVehicleNotice("Manutenção salva no banco de dados.");
    } catch (err) {
      console.error("Erro ao salvar manutenção:", err);
      setVehicleError(
        err.code === "permission-denied"
          ? "O Firebase negou a gravação. Verifique as regras de acesso."
          : "Não foi possível salvar a manutenção. Tente novamente."
      );
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setCompanyProfile(null);

    if (!email.trim() || !password) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const profile = await getCompanyProfile(result.user.uid);
      setUser(result.user);
      setCompanyProfile(profile);
    } catch (err) {
      const messages = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "Informe um e-mail válido.",
        "auth/user-disabled": "Esta conta está desativada.",
        "auth/too-many-requests":
          "Muitas tentativas. Aguarde e tente novamente.",
        "auth/network-request-failed":
          "Falha de conexão. Verifique sua internet.",
        "permission-denied":
          "O acesso ao perfil foi negado. Confira as regras do Firestore.",
      };

      setError(
        messages[err.code] ||
          err.message ||
          "Não foi possível entrar. Verifique os dados e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await signOut(auth);
      setUser(null);
      setCompanyProfile(null);
      setPassword("");
      setPage("calendar");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    }
  }

  function changeMonth(amount) {
    setMonth((current) =>
      new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  }

  function openTripForm() {
    setTripError("");
    setTripNotice("");
    setTripForm({
      date: selectedDate,
      time: "",
      origin: "",
      destination: "",
      vehicle: "",
      driverRecordedBy: "",
      farePrice: "",
      notes: "",
    });
    setShowTripForm(true);
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    setBookingError("");
    setBookingNotice("");

    if (!companyProfile?.companyId || !user?.uid || !selectedTripId) {
      setBookingError("Empresa, usuário ou viagem não identificada.");
      return;
    }

    const client = clients.find((item) => item.id === bookingForm.clientId);

    if (!client) {
      setBookingError("Selecione um cliente cadastrado.");
      return;
    }

    setBookingLoading(true);

    try {
      const savedBooking = await createBooking(
        companyProfile.companyId,
        selectedTripId,
        {
          ...bookingForm,
          clientId: client.id,
          clientName: client.name,
          whatsapp: client.whatsapp || "",
          boarding: bookingForm.boarding || client.defaultBoarding || "",
          dropoff: bookingForm.dropoff || client.defaultDropoff || "",
          createdBy: user.uid,
        }
      );

      setBookings((current) => [savedBooking, ...current]);
      setBookingForm({
        clientId: "",
        boarding: "",
        dropoff: "",
        passengers: "1",
        farePrice: "",
        amountReceived: "0",
        notes: "",
      });
      setBookingNotice("Agendamento salvo com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar agendamento:", err);
      setBookingError(
        err.code === "permission-denied"
          ? "O Firebase negou a gravação. Confira as regras do Firestore."
          : err.message || "Não foi possível salvar o agendamento."
      );
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleClientSubmit(event) {
    event.preventDefault();
    setClientError("");
    setClientNotice("");

    if (!companyProfile?.companyId || !user?.uid) {
      setClientError("Empresa ou usuário não identificado. Entre novamente.");
      return;
    }

    if (!clientForm.name.trim()) {
      setClientError("Informe o nome do cliente.");
      return;
    }

    setClientLoading(true);

    try {
      const savedClient = await createClient(
        companyProfile.companyId,
        {
          ...clientForm,
          createdBy: user.uid,
        }
      );

      setClients((current) =>
        [...current, savedClient].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "pt-BR")
        )
      );

      setClientForm({
        name: "",
        cpf: "",
        whatsapp: "",
        address: "",
        addressNumber: "",
        neighborhood: "",
        city: "",
        zipCode: "",
        defaultBoarding: "",
        defaultDropoff: "",
        notes: "",
      });
      setClientNotice("Cliente salvo nesta sessão. A gravação no Firebase depende das regras de acesso.");
    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
      setClientError(
        err.code === "permission-denied"
          ? "O Firebase negou a gravação. Precisamos atualizar as regras do Firestore."
          : err.message || "Não foi possível salvar o cliente."
      );
    } finally {
      setClientLoading(false);
    }
  }

  async function handleTransactionSubmit(event) {
    event.preventDefault();
    setTransactionError("");
    setTransactionNotice("");

    if (!companyProfile?.companyId || !user?.uid) {
      setTransactionError("Empresa ou usuário não identificado. Entre novamente.");
      return;
    }

    setTransactionLoading(true);

    try {
      const savedTransaction = await createTransaction(
        companyProfile.companyId,
        {
          ...transactionForm,
          createdBy: user.uid,
        }
      );

      setTransactions((current) =>
        [savedTransaction, ...current].sort((a, b) =>
          (b.date || "").localeCompare(a.date || "")
        )
      );

      setTransactionForm({
        date: dateKey(new Date()),
        type: "income",
        amount: "",
        category: "Passagens",
        description: "",
        tripId: "",
        paymentMethod: "Pix",
      });

      setTransactionNotice("Lançamento salvo no banco de dados.");
    } catch (err) {
      console.error("Erro ao salvar lançamento financeiro:", err);
      setTransactionError(
        err.code === "permission-denied"
          ? "O Firebase negou a gravação. As regras do Firestore precisam permitir lançamentos financeiros."
          : err.message || "Não foi possível salvar o lançamento."
      );
    } finally {
      setTransactionLoading(false);
    }
  }

  async function handleTripSubmit(event) {
    event.preventDefault();
    setTripError("");
    setTripNotice("");

    if (
      !tripForm.date ||
      !tripForm.origin.trim() ||
      !tripForm.destination.trim() ||
      !tripForm.driverRecordedBy.trim()
    ) {
      setTripError(
        "Preencha a data, a origem, o destino e o motorista responsável pelo lançamento."
      );
      return;
    }

    if (!companyProfile?.companyId || !user?.uid) {
      setTripError("Empresa ou usuário não identificado. Entre novamente no sistema.");
      return;
    }

    try {
      const savedTrip = await createTrip(companyProfile.companyId, {
        ...tripForm,
        createdBy: user.uid,
      });
      await publishTrip({
        companyId: companyProfile.companyId,
        tripId: savedTrip.id,
        publicBooking: tripForm.publicBooking === true,
      });

      setTrips((current) => [
        savedTrip,
        ...current.filter((trip) => trip.id !== savedTrip.id),
      ]);
      setSelectedDate(tripForm.date);

      const chosenDate = new Date(`${tripForm.date}T12:00:00`);
      setMonth(new Date(chosenDate.getFullYear(), chosenDate.getMonth(), 1));
      setShowTripForm(false);
      setTripNotice("Viagem salva no banco de dados.");
      setPage("calendar");
    } catch (err) {
      console.error("Erro ao salvar viagem:", err);
      setTripError(err?.message || "Não foi possível salvar ou publicar a viagem.");
    }
  }

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  const firstWeekday = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  ).getDay();

  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const monthTrips = trips.filter((trip) => {
      if (!trip.date) return false;
      const tripDate = new Date(`${trip.date}T12:00:00`);
      return (
        tripDate.getFullYear() === month.getFullYear() &&
        tripDate.getMonth() === month.getMonth()
      );
    });

  const selectedTrips = trips.filter((trip) => trip.date === selectedDate);

  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthTransactions = transactions.filter((item) => item.date?.startsWith(monthPrefix));
  const selectedTransactions = transactions.filter((item) => item.date === selectedDate);
  const sumTransactions = (items, type) => items.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const monthIncome = sumTransactions(monthTransactions, "income");
  const monthExpenses = sumTransactions(monthTransactions, "expense");
  const selectedIncome = sumTransactions(selectedTransactions, "income");
  const selectedExpenses = sumTransactions(selectedTransactions, "expense");

  const tripFormView = showTripForm ? (
    <section className="panel trip-form-panel">
      <div className="section-heading">
        <div>
          <h2>Nova viagem</h2>
          <p>Preencha os dados para visualizar o lançamento.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowTripForm(false)}
        >
          Cancelar
        </button>
      </div>

      <form className="trip-form" onSubmit={handleTripSubmit}>
        <div className="field">
          <label htmlFor="trip-date">Data da viagem *</label>
          <input
            id="trip-date"
            type="date"
            value={tripForm.date}
            onChange={(event) =>
              setTripForm({ ...tripForm, date: event.target.value })
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="trip-type">Tipo de viagem</label>
          <select
            id="trip-type"
            value={tripForm.tripType}
            onChange={(event) => setTripForm({ ...tripForm, tripType: event.target.value })}
          >
            <option value="pontual">Viagem pontual</option>
            <option value="recorrente">Viagem recorrente</option>
            <option value="excursao">Excursão</option>
          </select>
        </div>

        {tripForm.tripType === "recorrente" && (
          <>
            <div className="field full-field">
              <label>Dias da semana</label>
              {[
                ["1", "Segunda-feira"],
                ["2", "Terça-feira"],
                ["3", "Quarta-feira"],
                ["4", "Quinta-feira"],
                ["5", "Sexta-feira"],
                ["6", "Sábado"],
                ["0", "Domingo"],
              ].map(([day, label]) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={tripForm.recurrenceDays.includes(day)}
                    onChange={(event) => setTripForm({
                      ...tripForm,
                      recurrenceDays: event.target.checked
                        ? [...tripForm.recurrenceDays, day]
                        : tripForm.recurrenceDays.filter((item) => item !== day),
                    })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="field">
              <label htmlFor="recurrence-end">Repetir até</label>
              <input
                id="recurrence-end"
                type="date"
                min={tripForm.date}
                value={tripForm.recurrenceEnd}
                onChange={(event) => setTripForm({ ...tripForm, recurrenceEnd: event.target.value })}
                required
              />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="trip-time">Horário</label>
          <input
            id="trip-time"
            type="time"
            value={tripForm.time}
            onChange={(event) =>
              setTripForm({ ...tripForm, time: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="trip-origin">Origem *</label>
          <input
            id="trip-origin"
            placeholder="Cidade de saída"
            value={tripForm.origin}
            onChange={(event) =>
              setTripForm({ ...tripForm, origin: event.target.value })
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="trip-destination">Destino *</label>
          <input
            id="trip-destination"
            placeholder="Cidade de destino"
            value={tripForm.destination}
            onChange={(event) =>
              setTripForm({ ...tripForm, destination: event.target.value })
            }
            required
          />
        </div>

        <div className="field">
          <label htmlFor="trip-vehicle">Veículo</label>
          <input
            id="trip-vehicle"
            placeholder="Ex.: Sprinter 517"
            value={tripForm.vehicle}
            onChange={(event) =>
              setTripForm({ ...tripForm, vehicle: event.target.value })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="trip-fare-price">Preço padrão por passageiro (R$)</label>
          <input
            id="trip-fare-price"
            type="number"
            min="0"
            step="0.01"
            value={tripForm.farePrice}
            onChange={(event) =>
              setTripForm({ ...tripForm, farePrice: event.target.value })
            }
            placeholder="Ex.: 150,00"
          />
        </div>

        <div className="field">
          <label htmlFor="trip-driver">Motorista responsável pelo lançamento *</label>
          <input
            id="trip-driver"
            placeholder="Nome de quem está lançando"
            value={tripForm.driverRecordedBy}
            onChange={(event) =>
              setTripForm({
                ...tripForm,
                driverRecordedBy: event.target.value,
              })
            }
            required
          />
        </div>

        <div className="field full-field">
          <label>
            <input
              type="checkbox"
              checked={tripForm.publicBooking === true}
              onChange={(event) =>
                setTripForm({
                  ...tripForm,
                  publicBooking: event.target.checked,
                })
              }
            />
            Disponibilizar para reservas pelo link público
          </label>
          <small>
            Ao marcar, você autoriza a divulgação dos dados básicos desta viagem.
          </small>
        </div>

        <div className="field full-field">
          <label htmlFor="trip-notes">Observações</label>
          <textarea
            id="trip-notes"
            rows="3"
            placeholder="Informações adicionais sobre a viagem"
            value={tripForm.notes}
            onChange={(event) =>
              setTripForm({ ...tripForm, notes: event.target.value })
            }
          />
        </div>

        {tripError && (
          <p className="login-error full-field" role="alert">
            {tripError}
          </p>
        )}

        <p className="preview-warning full-field">
          Prévia de desenvolvimento: este lançamento fica somente na memória
          desta sessão. Ainda não é gravado no banco de dados.
        </p>

        <button className="primary-button full-field" type="submit">
          Adicionar à prévia
        </button>
      </form>
    </section>
  ) : null;

  function renderPage() {
    if (page === "settings") {
      const updateSettingsField = (field, value) => {
        setSettingsForm((current) => ({ ...current, [field]: value }));
      };

      const handleLogoChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          setSettingsMessage("Selecione um arquivo de imagem.");
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const image = new Image();
          image.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSide = 320;
            const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            const logoDataUrl = canvas.toDataURL("image/jpeg", 0.75);
            if (logoDataUrl.length > 700000) {
              setSettingsMessage("A logo ficou grande demais. Escolha uma imagem menor.");
              return;
            }

            updateSettingsField("logoDataUrl", logoDataUrl);
            setSettingsMessage("");
          };
          image.onerror = () => setSettingsMessage("Não foi possível ler essa imagem.");
          image.src = String(reader.result);
        };
        reader.onerror = () => setSettingsMessage("Não foi possível carregar a imagem.");
        reader.readAsDataURL(file);
      };

      const handleSaveSettings = async (event) => {
        event.preventDefault();
        setSettingsSaving(true);
        setSettingsMessage("");

        try {
          await saveCompanySettings(companyProfile.companyId, settingsForm);
          setCompanySettings({ ...settingsForm });
          setSettingsMessage("Configurações salvas com sucesso.");
        } catch (err) {
          console.error("Erro ao salvar configurações:", err);
          setSettingsMessage(
            err?.code === "permission-denied"
              ? "O Firestore ainda não permite salvar. As regras precisam ser publicadas."
              : err?.message || "Não foi possível salvar as configurações."
          );
        } finally {
          setSettingsSaving(false);
        }
      };

      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Configurações da empresa</h2>
              <p>Personalize os dados usados nos recibos e relatórios.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage("more")}
            >
              Voltar
            </button>
          </div>

          <form className="form-grid" onSubmit={handleSaveSettings}>
            <label>
              Nome da empresa
              <input
                required
                maxLength={120}
                value={settingsForm.name || ""}
                onChange={(event) => updateSettingsField("name", event.target.value)}
              />
            </label>
            <label>
              CNPJ
              <input
                maxLength={30}
                value={settingsForm.cnpj || ""}
                onChange={(event) => updateSettingsField("cnpj", event.target.value)}
              />
            </label>
            <label>
              Telefone
              <input
                maxLength={40}
                value={settingsForm.phone || ""}
                onChange={(event) => updateSettingsField("phone", event.target.value)}
              />
            </label>
            <label>
              Endereço
              <input
                maxLength={200}
                value={settingsForm.address || ""}
                onChange={(event) => updateSettingsField("address", event.target.value)}
              />
            </label>
            <label className="full-field">
              Texto no rodapé dos recibos e relatórios
              <input
                maxLength={200}
                value={settingsForm.footer || ""}
                onChange={(event) => updateSettingsField("footer", event.target.value)}
                placeholder="Ex.: Obrigado pela preferência!"
              />
            </label>

            <div className="form-section full-field">
              <h3>Logotipo da empresa</h3>
              <input type="file" accept="image/*" onChange={handleLogoChange} />
              {settingsForm.logoDataUrl && (
                <div className="settings-logo-preview">
                  <img
                    src={settingsForm.logoDataUrl}
                    alt="Prévia do logotipo"
                    style={{ maxWidth: 160, maxHeight: 100, objectFit: "contain" }}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => updateSettingsField("logoDataUrl", "")}
                  >
                    Remover logo
                  </button>
                </div>
              )}
            </div>

            <div className="form-section full-field">
              <h3>Modelos de impressão</h3>
              <p>Recibo A4 e recibo térmico de 55 mm.</p>
              <p className="muted-text">
                Os dados de identidade visual serão usados nos recibos e relatórios.
              </p>
            </div>

            {settingsMessage && (
              <p className="full-field muted-text" role="status">{settingsMessage}</p>
            )}

            <button
              className="primary-button full-field"
              type="submit"
              disabled={settingsSaving}
            >
              {settingsSaving ? "Salvando..." : "Salvar configurações"}
            </button>
          </form>
        </section>
      );
    }

    if (page === "trip-details") {
      const trip = trips.find((item) => item.id === selectedTripId);

      if (!trip) {
        return (
          <section className="panel">
            <h2>Viagem não encontrada</h2>
            <button className="secondary-button" onClick={() => setPage("calendar")}>
              Voltar ao calendário
            </button>
          </section>
        );
      }

      const tripTransactions = transactions.filter((item) => item.tripId === trip.id);
      const tripIncome = tripTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const tripExpenses = tripTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);

      return (
        <section className="panel trip-details-print">
          <div className="section-heading">
            <div>
              <h2>{trip.origin} → {trip.destination}</h2>
              <p>Detalhes da viagem</p>
            </div>
            <button className="secondary-button" onClick={() => setPage("calendar")}>
              Voltar ao calendário
            </button>
          </div>

          <div className="summary-grid">
            <div className="summary-card"><span>Data</span><strong>{trip.date}</strong></div>
            <div className="summary-card"><span>Horário</span><strong>{trip.time || "Não informado"}</strong></div>
            <div className="summary-card"><span>Veículo</span><strong>{trip.vehicle || "Não informado"}</strong></div>
          </div>

          <p><strong>Responsável:</strong> {trip.driverRecordedBy || "Não informado"}</p>
          {trip.notes && <p><strong>Observações:</strong> {trip.notes}</p>}

          <h3>Financeiro da viagem</h3>
          <div className="summary-grid">
            <div className="summary-card"><span>Receitas</span><strong className="green-text">{money(tripIncome)}</strong></div>
            <div className="summary-card"><span>Despesas</span><strong className="red-text">{money(tripExpenses)}</strong></div>
            <div className="summary-card"><span>Saldo</span><strong>{money(tripIncome - tripExpenses)}</strong></div>
          </div>

          <button className="primary-button" onClick={() => {
            setTransactionForm({ date: trip.date, type: "income", amount: "", category: "Passagens", description: "", tripId: trip.id, paymentMethod: "Pix" });
            setTransactionError("");
            setTransactionNotice("");
            setPage("finance");
          }}>
            + Lançamento financeiro nesta viagem
          </button>

          <h3>Movimentações vinculadas</h3>
          {tripTransactions.length === 0 ? (
            <p className="muted-text">Nenhuma movimentação vinculada a esta viagem.</p>
          ) : (
            <div className="trip-list">
              {tripTransactions.map((item) => (
                <article className="trip-row" key={item.id}>
                  <div className="trip-main">
                    <strong>{item.description}</strong>
                    <span>{item.date} • {item.category}</span>
                  </div>
                  <strong className={item.type === "income" ? "green-text" : "red-text"}>
                    {item.type === "expense" ? "−" : "+"}{money(Number(item.amount || 0))}
                  </strong>
                </article>
              ))}
            </div>
          )}

          <h3>Passageiros e agendamentos</h3>
          <p className="muted-text">Cadastre os passageiros desta viagem e acompanhe as confirmações.</p>

          <form className="trip-form" onSubmit={handleBookingSubmit}>
            <div className="field">
              <label htmlFor="booking-client">Cliente *</label>
              <select
                id="booking-client"
                value={bookingForm.clientId}
                onChange={(event) => {
                  const clientId = event.target.value;
                  const client = clients.find((item) => item.id === clientId);
                  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
                  setBookingForm({
                    ...bookingForm,
                    clientId,
                    boarding: client?.defaultBoarding || "",
                    dropoff: client?.defaultDropoff || "",
                    farePrice: String(selectedTrip?.farePrice ?? ""),
                    amountReceived: "0",
                  });
                }}
                required
              >
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}{client.whatsapp ? ` — ${client.whatsapp}` : ""}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="muted-text">Cadastre primeiro um cliente na seção Clientes.</p>
              )}
            </div>

            <div className="field">
              <label htmlFor="booking-boarding">Local de embarque</label>
              <input
                id="booking-boarding"
                value={bookingForm.boarding}
                onChange={(event) => setBookingForm({ ...bookingForm, boarding: event.target.value })}
                placeholder="Local de embarque nesta viagem"
              />
            </div>

            <div className="field">
              <label htmlFor="booking-dropoff">Local de desembarque</label>
              <input
                id="booking-dropoff"
                value={bookingForm.dropoff}
                onChange={(event) => setBookingForm({ ...bookingForm, dropoff: event.target.value })}
                placeholder="Local de desembarque nesta viagem"
              />
            </div>

            <div className="field">
              <label htmlFor="booking-fare-price">Preço por passageiro (R$) *</label>
              <input
                id="booking-fare-price"
                type="number"
                min="0"
                step="0.01"
                value={bookingForm.farePrice}
                onChange={(event) => setBookingForm({ ...bookingForm, farePrice: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="booking-amount-received">Valor recebido (R$)</label>
              <input
                id="booking-amount-received"
                type="number"
                min="0"
                step="0.01"
                value={bookingForm.amountReceived}
                onChange={(event) => setBookingForm({ ...bookingForm, amountReceived: event.target.value })}
              />
            </div>

            <div className="field">
              <label>Saldo pendente (R$)</label>
              <input
                type="text"
                readOnly
                value={money(Math.max(0, Number(bookingForm.farePrice || 0) * Number(bookingForm.passengers || 1) - Number(bookingForm.amountReceived || 0)))}
              />
            </div>

            <div className="field">
              <label htmlFor="booking-passengers">Quantidade de passageiros *</label>
              <input
                id="booking-passengers"
                type="number"
                min="1"
                step="1"
                value={bookingForm.passengers}
                onChange={(event) => setBookingForm({ ...bookingForm, passengers: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="booking-notes">Observações</label>
              <textarea
                id="booking-notes"
                rows="2"
                value={bookingForm.notes}
                onChange={(event) => setBookingForm({ ...bookingForm, notes: event.target.value })}
                placeholder="Informações sobre o agendamento"
              />
            </div>

            {bookingError && <p className="error-text" role="alert">{bookingError}</p>}
            {bookingNotice && <p className="success-text">{bookingNotice}</p>}

            <button className="primary-button" type="submit" disabled={bookingLoading || clients.length === 0}>
              {bookingLoading ? "Salvando..." : "Registrar agendamento"}
            </button>
          </form>

          <div className="section-heading">
            <h3>Agendamentos desta viagem ({bookings.length})</h3>
            <div className="print-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const report = document.querySelector(".trip-details-print");
                  report?.classList.remove("print-thermal");
                  window.print();
                }}
              >
                Imprimir A4
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const report = document.querySelector(".trip-details-print");
                  if (!report) return;
                  report.classList.add("print-thermal");
                  window.addEventListener("afterprint", () => {
                    report.classList.remove("print-thermal");
                  }, { once: true });
                  window.print();
                }}
              >
                Imprimir térmica 55 mm
              </button>
            </div>
          </div>
          {bookings.length > 0 && (
            <div className="print-passenger-list">
              <h3>Lista de passageiros</h3>
              <table className="print-passenger-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Documento</th>
                    <th>Telefone</th>
                    <th>Embarque</th>
                    <th>Desembarque</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const client = clients.find((item) => item.id === booking.clientId);
                    return (
                      <tr key={booking.id}>
                        <td data-label="Nome">{booking.clientName || "—"}</td>
                        <td data-label="Documento">{client?.cpf || "—"}</td>
                        <td data-label="Telefone">{booking.whatsapp || client?.whatsapp || "—"}</td>
                        <td data-label="Embarque">{booking.boarding || "—"}</td>
                        <td data-label="Desembarque">{booking.dropoff || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {bookings.length === 0 ? (
            <p className="muted-text">Nenhum agendamento registrado nesta viagem.</p>
          ) : (
            <div className="trip-list">
              {bookings.map((booking) => (
                <article className="trip-row" key={booking.id}>
                  <div className="trip-main">
                    <strong>{booking.clientName}</strong>
                    {booking.whatsapp && <span>WhatsApp: {booking.whatsapp}</span>}
                    <span>Passageiros: {booking.passengers}</span>
                    <span>Valor total: {money(booking.totalAmount ?? (Number(booking.farePrice || 0) * Number(booking.passengers || 1)))}</span>
                    <span>Valor recebido: {money(booking.amountReceived || 0)}</span>
                    <span>Saldo pendente: {money(booking.balanceDue ?? Math.max(0, Number(booking.totalAmount || 0) - Number(booking.amountReceived || 0)))}</span>
                    <span>Pagamento: {booking.paymentStatus === 'paid' ? 'Pago' : booking.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'}</span>
                    {booking.boarding && <span>Embarque: {booking.boarding}</span>}
                    {booking.dropoff && <span>Desembarque: {booking.dropoff}</span>}
                    {booking.notes && <span>Observações: {booking.notes}</span>}
                    <span>Status: {booking.status === "confirmed" ? "Confirmado" : booking.status === "cancelled" ? "Cancelado" : "Pendente"}</span>
                    <button type="button" className="secondary-button" onClick={() => setReceiptBooking(booking)}>
                      Emitir recibo
                    </button>
                  </div>
                  <div className="field">
                    <label htmlFor={`booking-status-${booking.id}`}>Situação</label>
                    <select
                      id={`booking-status-${booking.id}`}
                      value={booking.status || "pending"}
                      onChange={async (event) => {
                        const status = event.target.value;
                        setBookingError("");
                        setBookingNotice("");
                        try {
                          await updateBookingStatus(companyProfile.companyId, trip.id, booking.id, status);
                          setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status } : item));
                          setBookingNotice("Situação do agendamento atualizada.");
                        } catch (err) {
                          console.error("Erro ao atualizar agendamento:", err);
                          setBookingError(err.message || "Não foi possível atualizar a situação.");
                        }
                      }}
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
          {receiptBooking && (
            <div className="receipt-print-area">
              <div className="receipt-header">
                {(companySettings.logoDataUrl) && (
                  <img
                    src={companySettings.logoDataUrl}
                    alt="Logotipo da empresa"
                    style={{ maxWidth: 140, maxHeight: 80, objectFit: "contain" }}
                  />
                )}
                <h2>{companySettings.name || companyProfile?.company?.name || "Empresa"}</h2>
                {(companySettings.cnpj || companyProfile?.company?.cnpj) && (
                  <p>CNPJ: {companySettings.cnpj || companyProfile?.company?.cnpj}</p>
                )}
                {(companySettings.phone || companyProfile?.company?.phone) && (
                  <p>Telefone: {companySettings.phone || companyProfile?.company?.phone}</p>
                )}
                {companySettings.address && <p>{companySettings.address}</p>}
                <h3>RECIBO DE PAGAMENTO</h3>
              </div>
              <p><strong>Passageiro:</strong> {receiptBooking.clientName || "—"}</p>
              <p><strong>Viagem:</strong> {trip.origin} → {trip.destination}</p>
              <p><strong>Data:</strong> {trip.date}</p>
              <p><strong>Quantidade de passageiros:</strong> {receiptBooking.passengers || 1}</p>
              <p><strong>Embarque:</strong> {receiptBooking.boarding || "—"}</p>
              <p><strong>Desembarque:</strong> {receiptBooking.dropoff || "—"}</p>
              <hr />
              <p><strong>Valor total:</strong> {money(receiptBooking.totalAmount ?? Number(receiptBooking.farePrice || 0) * Number(receiptBooking.passengers || 1))}</p>
              <p><strong>Valor recebido:</strong> {money(receiptBooking.amountReceived || 0)}</p>
              <p><strong>Saldo pendente:</strong> {money(receiptBooking.balanceDue ?? Math.max(0, Number(receiptBooking.totalAmount || 0) - Number(receiptBooking.amountReceived || 0)))}</p>
              <p><strong>Situação:</strong> {receiptBooking.paymentStatus === "paid" ? "Pago" : receiptBooking.paymentStatus === "partial" ? "Pagamento parcial" : "Pendente"}</p>
              <p className="receipt-thanks">{companySettings.footer || "Obrigado pela preferência!"}</p>
              <div className="receipt-actions">
                <button type="button" className="primary-button" onClick={() => window.print()}>Imprimir recibo</button>
                <button type="button" className="secondary-button" onClick={() => setReceiptBooking(null)}>Fechar recibo</button>
              </div>
            </div>
          )}
        </section>
      );
    }


    if (page === "trips") {
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Viagens</h2>
              <p>Consulte os lançamentos desta sessão.</p>
            </div>
            <button className="primary-button" onClick={openTripForm}>
              + Nova viagem
            </button>
          </div>
          {tripFormView}
          {trips.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⇄</div>
              <h3>Nenhuma viagem nesta prévia</h3>
              <p>As viagens cadastradas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="trip-list">
              {trips.map((trip) => (
                <article className="trip-row" key={trip.id}>
                  <div className="trip-dot" />
                  <div className="trip-main">
                    <strong>{trip.origin} → {trip.destination}</strong>
                    <span>{trip.date}{trip.time ? ` • ${trip.time}` : ""}</span>
                    <span>Responsável pelo lançamento: {trip.driverRecordedBy}</span>
                    {trip.vehicle && <span>Veículo: {trip.vehicle}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (page === "clients") {
      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Clientes</h2>
              <p>Cadastre e consulte os contatos dos passageiros.</p>
            </div>
          </div>

          <h3>Novo cliente</h3>
          <form className="trip-form" onSubmit={handleClientSubmit}>
            <div className="field">
              <label htmlFor="client-name">Nome completo *</label>
              <input id="client-name" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} placeholder="Nome completo" required />
            </div>

            <div className="field">
              <label htmlFor="client-cpf">CPF</label>
              <input id="client-cpf" value={clientForm.cpf} onChange={(event) => setClientForm({ ...clientForm, cpf: event.target.value })} placeholder="000.000.000-00" />
            </div>

            <div className="field">
              <label htmlFor="client-whatsapp">WhatsApp</label>
              <input id="client-whatsapp" type="tel" value={clientForm.whatsapp} onChange={(event) => setClientForm({ ...clientForm, whatsapp: event.target.value })} placeholder="(99) 99999-9999" />
            </div>

            <h3>Endereço do cliente</h3>
            <div className="field">
              <label htmlFor="client-address">Rua / avenida</label>
              <input id="client-address" value={clientForm.address} onChange={(event) => setClientForm({ ...clientForm, address: event.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="client-address-number">Número / complemento</label>
              <input id="client-address-number" value={clientForm.addressNumber} onChange={(event) => setClientForm({ ...clientForm, addressNumber: event.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="client-neighborhood">Bairro</label>
              <input id="client-neighborhood" value={clientForm.neighborhood} onChange={(event) => setClientForm({ ...clientForm, neighborhood: event.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="client-city">Cidade</label>
              <input id="client-city" value={clientForm.city} onChange={(event) => setClientForm({ ...clientForm, city: event.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="client-zipcode">CEP</label>
              <input id="client-zipcode" value={clientForm.zipCode} onChange={(event) => setClientForm({ ...clientForm, zipCode: event.target.value })} placeholder="00000-000" />
            </div>

            <h3>Preferências de embarque</h3>
            <div className="field">
              <label htmlFor="client-boarding">Local padrão de embarque</label>
              <input id="client-boarding" value={clientForm.defaultBoarding} onChange={(event) => setClientForm({ ...clientForm, defaultBoarding: event.target.value })} placeholder="Ex.: rodoviária" />
            </div>

            <div className="field">
              <label htmlFor="client-dropoff">Local padrão de desembarque</label>
              <input id="client-dropoff" value={clientForm.defaultDropoff} onChange={(event) => setClientForm({ ...clientForm, defaultDropoff: event.target.value })} placeholder="Ex.: terminal de destino" />
            </div>

            <div className="field">
              <label htmlFor="client-notes">Observações</label>
              <textarea id="client-notes" value={clientForm.notes} onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })} placeholder="Informações adicionais" rows={3} />
            </div>

            {clientError && <p className="error-text">{clientError}</p>}
            {clientNotice && <p className="success-text">{clientNotice}</p>}

            <button className="primary-button" type="submit" disabled={clientLoading}>
              {clientLoading ? "Salvando..." : "Salvar cliente"}
            </button>
          </form>

          <h3>Clientes cadastrados ({clients.length})</h3>
          {clients.length === 0 ? (
            <p className="muted-text">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <div className="trip-list">
              {clients.map((client) => (
                <article className="trip-row" key={client.id}>
                  <div className="trip-main">
                    <strong>{client.name}</strong>
                    {client.cpf && <span>CPF: {client.cpf}</span>}
                    {client.whatsapp && <span>WhatsApp: {client.whatsapp}</span>}
                    {(client.address || client.addressNumber || client.neighborhood || client.city || client.zipCode) && (
                      <span>
                        Endereço: {[client.address, client.addressNumber, client.neighborhood, client.city, client.zipCode].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {client.defaultBoarding && <span>Embarque padrão: {client.defaultBoarding}</span>}
                    {client.defaultDropoff && <span>Desembarque padrão: {client.defaultDropoff}</span>}
                    {client.notes && <span>Observações: {client.notes}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (page === "finance") {
      const incomeTotal = transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const expenseTotal = transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      return (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Financeiro</h2>
              <p>Registre e acompanhe as receitas e despesas da empresa.</p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Receitas</span>
              <strong className="green-text">{money(incomeTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>Despesas</span>
              <strong className="red-text">{money(expenseTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>Saldo</span>
              <strong>{money(incomeTotal - expenseTotal)}</strong>
            </div>
          </div>

          <h3>Novo lançamento</h3>
          <form className="trip-form" onSubmit={handleTransactionSubmit}>
            <div className="field">
              <label htmlFor="transaction-type">Tipo *</label>
              <select
                id="transaction-type"
                value={transactionForm.type}
                onChange={(event) => setTransactionForm({ ...transactionForm, type: event.target.value })}
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="transaction-date">Data *</label>
              <input
                id="transaction-date"
                type="date"
                value={transactionForm.date}
                onChange={(event) => setTransactionForm({ ...transactionForm, date: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="transaction-amount">Valor (R$) *</label>
              <input
                id="transaction-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={transactionForm.amount}
                onChange={(event) => setTransactionForm({ ...transactionForm, amount: event.target.value })}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="transaction-category">Categoria</label>
              <select
                id="transaction-category"
                value={transactionForm.category}
                onChange={(event) => setTransactionForm({ ...transactionForm, category: event.target.value })}
              >
                <option>Passagens</option>
                <option>Combustível</option>
                <option>Manutenção</option>
                <option>Pedágio</option>
                <option>Alimentação</option>
                <option>Salários</option>
                <option>Outros</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="transaction-description">Descrição *</label>
              <input
                id="transaction-description"
                value={transactionForm.description}
                onChange={(event) => setTransactionForm({ ...transactionForm, description: event.target.value })}
                placeholder="Ex.: Venda de passagem ou combustível"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="transaction-trip">Viagem relacionada</label>
              <select
                id="transaction-trip"
                value={transactionForm.tripId}
                onChange={(event) => setTransactionForm({ ...transactionForm, tripId: event.target.value })}
              >
                <option value="">Nenhuma</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.date} — {trip.origin} → {trip.destination}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="transaction-payment">Forma de pagamento</label>
              <select
                id="transaction-payment"
                value={transactionForm.paymentMethod}
                onChange={(event) => setTransactionForm({ ...transactionForm, paymentMethod: event.target.value })}
              >
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Cartão</option>
                <option>Transferência</option>
                <option>Outro</option>
              </select>
            </div>

            {transactionError && <p className="login-error" role="alert">{transactionError}</p>}
            {transactionNotice && <p className="notice">{transactionNotice}</p>}

            <button type="submit" className="primary-button" disabled={transactionLoading}>
              {transactionLoading ? "Salvando..." : "Salvar lançamento"}
            </button>
          </form>

          <h3>Lançamentos registrados</h3>
          {transactions.length === 0 ? (
            <div className="empty-state">
              <h3>Nenhum lançamento registrado</h3>
              <p>Os registros salvos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="trip-list">
              {transactions.map((item) => (
                <article className="trip-row" key={item.id}>
                  <div className="trip-dot" />
                  <div className="trip-main">
                    <strong>{item.description}</strong>
                    <span>{item.date} • {item.category} • {item.paymentMethod || "Forma não informada"}</span>
                    {item.tripId && (
                      <span>
                        Viagem: {(() => {
                          const trip = trips.find((entry) => entry.id === item.tripId);
                          return trip ? `${trip.origin} → ${trip.destination}` : "Viagem vinculada";
                        })()}
                      </span>
                    )}
                  </div>
                  <strong className={item.type === "income" ? "green-text" : "red-text"}>
                    {item.type === "income" ? "+" : "−"}{money(item.amount)}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (page === "vehicles") {
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id === selectedVehicleId
      );

      function maintenanceStatus(record, vehicle) {
        const hasKmLimit =
          record.nextKm !== null &&
          record.nextKm !== undefined &&
          record.nextKm !== "";
        const hasDateLimit = Boolean(record.nextDate);

        if (!hasKmLimit && !hasDateLimit) return "Sem previsão";

        const today = dateKey(new Date());
        const kmDue =
          hasKmLimit && vehicle.currentKm >= Number(record.nextKm);
        const dateDue = hasDateLimit && today >= record.nextDate;

        if (kmDue || dateDue) return "Atrasada";

        const kmNear =
          hasKmLimit && Number(record.nextKm) - vehicle.currentKm <= 1000;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + 30);
        const dateNear =
          hasDateLimit &&
          record.nextDate <= dateKey(limitDate) &&
          record.nextDate >= today;

        if (kmNear || dateNear) return "Próxima";
        return "Em dia";
      }

      return (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Veículos da frota</h2>
                <p>Cadastro, quilometragem e manutenção preventiva.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setVehicleError("");
                  setVehicleNotice("");
                  setShowVehicleForm((value) => !value);
                  setSelectedVehicleId(null);
                }}
              >
                + Novo veículo
              </button>
            </div>

            <p className="preview-warning">
              Prévia de desenvolvimento: os registros ficam apenas nesta
              sessão e desaparecem ao recarregar a página. Ainda não são
              salvos no banco de dados.
            </p>

            {vehicleNotice && (
              <p className="preview-warning notice">{vehicleNotice}</p>
            )}

            {vehicleError && (
              <p className="login-error notice" role="alert">
                {vehicleError}
              </p>
            )}

            {showVehicleForm && (
              <form
                className="trip-form vehicle-form"
                onSubmit={handleVehicleSubmit}
              >
                <div className="field">
                  <label htmlFor="vehicle-model">Modelo *</label>
                  <input
                    id="vehicle-model"
                    placeholder="Ex.: Mercedes-Benz Sprinter 517"
                    value={vehicleForm.model}
                    onChange={(event) =>
                      setVehicleForm({
                        ...vehicleForm,
                        model: event.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="vehicle-plate">Placa *</label>
                  <input
                    id="vehicle-plate"
                    placeholder="Ex.: ABC1D23"
                    maxLength={7}
                    value={vehicleForm.plate}
                    onChange={(event) =>
                      setVehicleForm({
                        ...vehicleForm,
                        plate: event.target.value.toUpperCase(),
                      })
                    }
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="vehicle-year">Ano</label>
                  <input
                    id="vehicle-year"
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="Ex.: 2025"
                    value={vehicleForm.year}
                    onChange={(event) =>
                      setVehicleForm({
                        ...vehicleForm,
                        year: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="vehicle-capacity">
                    Capacidade de passageiros
                  </label>
                  <input
                    id="vehicle-capacity"
                    type="number"
                    min="1"
                    placeholder="Ex.: 20"
                    value={vehicleForm.capacity}
                    onChange={(event) =>
                      setVehicleForm({
                        ...vehicleForm,
                        capacity: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="vehicle-current-km">
                    Quilometragem atual *
                  </label>
                  <input
                    id="vehicle-current-km"
                    type="number"
                    min="0"
                    placeholder="Ex.: 120000"
                    value={vehicleForm.currentKm}
                    onChange={(event) =>
                      setVehicleForm({
                        ...vehicleForm,
                        currentKm: event.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="full-field">
                  <button className="primary-button" type="submit">
                    Cadastrar veículo
                  </button>
                </div>
              </form>
            )}

            {vehicles.length === 0 && !showVehicleForm ? (
              <div className="empty-state">
                <div className="empty-icon">▣</div>
                <h3>Nenhum veículo cadastrado nesta prévia</h3>
                <p>Comece cadastrando o primeiro veículo da frota.</p>
              </div>
            ) : (
              <div className="vehicle-grid">
                {vehicles.map((vehicle) => (
                  <button
                    type="button"
                    className={
                      selectedVehicleId === vehicle.id
                        ? "vehicle-card vehicle-card-selected"
                        : "vehicle-card"
                    }
                    key={vehicle.id}
                    onClick={() => {
                      setSelectedVehicleId(vehicle.id);
                      setVehicleError("");
                      setVehicleNotice("");
                      setShowVehicleForm(false);
                    }}
                  >
                    <div className="vehicle-card-top">
                      <span className="vehicle-icon">▣</span>
                      <span className="vehicle-plate">{vehicle.plate}</span>
                    </div>
                    <strong>{vehicle.model}</strong>
                    <span className="vehicle-km">
                      {vehicle.currentKm.toLocaleString("pt-BR")} km
                    </span>
                    <span className="vehicle-card-meta">
                      {vehicle.capacity
                        ? `${vehicle.capacity} passageiros`
                        : "Capacidade não informada"}
                      {vehicle.year ? ` • ${vehicle.year}` : ""}
                    </span>
                    <span className="vehicle-card-meta">
                      {vehicle.maintenance.length} manutenção(ões) registrada(s)
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedVehicle && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>{selectedVehicle.model}</h2>
                    <p>
                      Placa {selectedVehicle.plate} · Controle de manutenção
                    </p>
                  </div>
                  <span className="role-chip">
                    {selectedVehicle.currentKm.toLocaleString("pt-BR")} km
                  </span>
                </div>

                <form
                  className="trip-form"
                  onSubmit={(event) =>
                    handleMileageUpdate(event, selectedVehicle.id)
                  }
                >
                  <div className="field">
                    <label htmlFor="update-current-km">
                      Atualizar quilometragem atual
                    </label>
                    <input
                      id="update-current-km"
                      name="currentKm"
                      type="number"
                      min="0"
                      defaultValue={selectedVehicle.currentKm}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Data da leitura</label>
                    <input
                      value={dateKey(new Date())}
                      readOnly
                    />
                  </div>
                  <div className="full-field">
                    <button className="primary-button" type="submit">
                      Atualizar quilometragem
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Registrar manutenção</h2>
                    <p>
                      Guarde o serviço realizado e programe os próximos alertas.
                    </p>
                  </div>
                </div>

                <form
                  className="trip-form"
                  onSubmit={(event) =>
                    handleMaintenanceSubmit(event, selectedVehicle.id)
                  }
                >
                  <div className="field">
                    <label htmlFor="maintenance-type">Serviço realizado *</label>
                    <input
                      id="maintenance-type"
                      placeholder="Ex.: Troca de óleo e filtros"
                      value={maintenanceForm.type}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          type: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-date">Data do serviço *</label>
                    <input
                      id="maintenance-date"
                      type="date"
                      value={maintenanceForm.date}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          date: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-km">
                      Km no momento do serviço *
                    </label>
                    <input
                      id="maintenance-km"
                      type="number"
                      min="0"
                      value={maintenanceForm.km}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          km: event.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-next-km">
                      Próxima manutenção (km)
                    </label>
                    <input
                      id="maintenance-next-km"
                      type="number"
                      min="0"
                      placeholder="Ex.: 130000"
                      value={maintenanceForm.nextKm}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          nextKm: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-next-date">
                      Próxima manutenção (data)
                    </label>
                    <input
                      id="maintenance-next-date"
                      type="date"
                      value={maintenanceForm.nextDate}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          nextDate: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-workshop">Oficina</label>
                    <input
                      id="maintenance-workshop"
                      placeholder="Nome da oficina"
                      value={maintenanceForm.workshop}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          workshop: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="maintenance-cost">Custo (R$)</label>
                    <input
                      id="maintenance-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={maintenanceForm.cost}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          cost: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field full-field">
                    <label htmlFor="maintenance-notes">Observações</label>
                    <textarea
                      id="maintenance-notes"
                      rows="3"
                      placeholder="Peças trocadas, detalhes e recomendações"
                      value={maintenanceForm.notes}
                      onChange={(event) =>
                        setMaintenanceForm({
                          ...maintenanceForm,
                          notes: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="full-field">
                    <button className="primary-button" type="submit">
                      Registrar manutenção
                    </button>
                  </div>
                </form>
              </section>

              <section className="panel">
                <h2>Histórico e alertas</h2>
                <p className="muted-text">
                  Os alertas consideram a quilometragem atual e a data prevista.
                </p>

                {selectedVehicle.maintenance.length === 0 ? (
                  <div className="empty-state compact-empty">
                    <div className="empty-icon">🔧</div>
                    <h3>Nenhuma manutenção registrada</h3>
                    <p>Os serviços e seus próximos vencimentos aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="maintenance-list">
                    {[...selectedVehicle.maintenance]
                      .reverse()
                      .map((record) => {
                        const status = maintenanceStatus(
                          record,
                          selectedVehicle
                        );

                        return (
                          <article className="maintenance-row" key={record.id}>
                            <div className="maintenance-row-heading">
                              <div>
                                <strong>{record.type}</strong>
                                <p>
                                  {new Date(
                                    `${record.date}T12:00:00`
                                  ).toLocaleDateString("pt-BR")}
                                  {" · "}
                                  {record.km.toLocaleString("pt-BR")} km
                                </p>
                              </div>
                              <span
                                className={`maintenance-status ${
                                  status === "Atrasada"
                                    ? "status-overdue"
                                    : status === "Próxima"
                                      ? "status-soon"
                                      : status === "Sem previsão"
                                        ? "status-unknown"
                                        : "status-ok"
                                }`}
                              >
                                {status}
                              </span>
                            </div>

                            <div className="maintenance-details">
                              <span>Custo: {money(record.cost)}</span>
                              {record.workshop && (
                                <span>Oficina: {record.workshop}</span>
                              )}
                              {record.nextKm !== null && (
                                <span>
                                  Próxima por km:{" "}
                                  {record.nextKm.toLocaleString("pt-BR")} km
                                </span>
                              )}
                              {record.nextDate && (
                                <span>
                                  Próxima por data:{" "}
                                  {new Date(
                                    `${record.nextDate}T12:00:00`
                                  ).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                              {record.notes && <span>{record.notes}</span>}
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      );
    }

    if (page === "more") {
      return (
        <section className="panel">
          <h2>Mais opções</h2>
          <p className="muted-text">Áreas previstas para o VCAR.</p>
          <div className="more-grid">
            {[
             ["▣", "Veículos", "Frota e manutenção", "vehicles"],
              ["♙", "Motoristas", "Contatos e dados"],
              ["⇄", "Destinos", "Rotas configuráveis"],
              ["▤", "Relatórios", "PDF e impressão"],
              ["⚙", "Configurações", "Dados da empresa"],
            ].map(([icon, title, description]) => (
                            <button
                type="button"
                className="more-item"
                key={title}
                onClick={() => {
                  if (title === "Veículos") {
                    setPage("vehicles");
                    setVehicleNotice("");
                    setVehicleError("");
                  } else if (title === "Configurações") {
                    setPage("settings");
                  }
                }}
              >
                <span className="more-icon">{icon}</span>
                <div><strong>{title}</strong><p>{description}</p></div>
              </button>
            ))}
          </div>
        </section>
      );
    }

    return (
      <>
        <section className="summary-grid">
          <div className="summary-card">
            <span>Viagens no mês</span>
            <strong>{monthTrips.length}</strong>
            <small>Na prévia atual</small>
          </div>
          <div className="summary-card">
            <span>Receitas do mês</span>
            <strong className="green-text">{money(monthIncome)}</strong>
            <small>Receitas lançadas no mês</small>
          </div>
          <div className="summary-card">
            <span>Despesas do mês</span>
            <strong className="red-text">{money(monthExpenses)}</strong>
            <small>Despesas lançadas no mês</small>
          </div>
        </section>

        <section className="panel calendar-panel">
          <div className="calendar-heading">
            <div>
              <h2>Calendário</h2>
              <p>Selecione um dia para consultar a programação.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const link = `${window.location.origin}/reservas?empresa=${encodeURIComponent(companyProfile.companyId)}`;
                  navigator.clipboard.writeText(link).then(
                    () => setTripNotice("Link público copiado para compartilhar."),
                    () => setTripError("Não foi possível copiar o link.")
                  );
                }}
              >
                Compartilhar link público
              </button>
            </div>
            <div className="month-controls">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => changeMonth(-1)}
              >‹</button>
              <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => changeMonth(1)}
              >›</button>
            </div>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div className="weekday" key={day}>{day}</div>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) {
                return <div className="calendar-empty" key={`empty-${index}`} />;
              }

              const cellDate = new Date(
                month.getFullYear(),
                month.getMonth(),
                day
              );
              const key = dateKey(cellDate);
              const hasTrip = trips.some((trip) => trip.date === key);
              const dayTransactions = transactions.filter((item) => item.date === key);
              const hasExpense = dayTransactions.some((item) => item.type === "expense");
              const dayIncome = dayTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const dayExpenses = dayTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const hasPositiveBalance = dayIncome - dayExpenses > 0;
              const isToday = key === dateKey(new Date());
              const isSelected = key === selectedDate;

              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    "calendar-day",
                    isSelected ? "selected" : "",
                    isToday ? "today" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => {
                    setSelectedDate(key);
                    setTripNotice("");
                  }}
                >
                  <span>{day}</span>
                  <span className="day-markers">
                    {hasTrip && <i className="marker marker-blue" />}
                    {hasExpense && <i className="marker marker-red" />}
                    {hasPositiveBalance && <i className="marker marker-green" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="marker marker-blue" /> Viagem</span>
            <span><i className="marker marker-red" /> Despesa</span>
            <span><i className="marker marker-green" /> Saldo positivo</span>
          </div>
        </section>

        {tripNotice && (
          <p className="preview-warning notice">{tripNotice}</p>
        )}

        {tripFormView}

        <section className="panel daily-panel">
          <div className="section-heading">
            <div>
              <h2>Programação do dia</h2>
              <p>
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "long", year: "numeric" }
                )}
              </p>
            </div>
            <button className="primary-button" onClick={openTripForm}>
              + Nova viagem
            </button>
          </div>

          {selectedTrips.length === 0 ? (
            <div className="empty-state compact-empty">
              <div className="empty-icon">▦</div>
              <h3>Nenhuma viagem neste dia</h3>
              <p>Use “Nova viagem” para testar o formulário.</p>
            </div>
          ) : (
            <div className="trip-list">
              {selectedTrips.map((trip) => (
                <article className="trip-row" key={trip.id} role="button" tabIndex={0} onClick={() => { setSelectedTripId(trip.id); setPage("trip-details"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSelectedTripId(trip.id); setPage("trip-details"); } }}>
                  <div className="trip-dot" />
                  <div className="trip-main">
                    <strong>{trip.origin} → {trip.destination}</strong>
                    <span>
                      {trip.time || "Horário não informado"}
                      {trip.vehicle ? ` • ${trip.vehicle}` : ""}
                    </span>
                    <span>Responsável: {trip.driverRecordedBy}</span>
                    {trip.notes && <span>{trip.notes}</span>}
                    <button
                      type="button"
                      className="danger-button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!window.confirm("Deseja excluir esta viagem definitivamente?")) return;
                        try {
                          await deleteTrip(companyProfile.companyId, trip.id);
                          setTrips((current) => current.filter((item) => item.id !== trip.id));
                          setTripNotice("Viagem excluída com sucesso.");
                        } catch (err) {
                          setTripError(err?.message || "Não foi possível excluir a viagem.");
                        }
                      }}
                    >
                      Excluir viagem
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="daily-balance">
            <span>Saldo financeiro do dia</span>
            <strong>{money(selectedIncome - selectedExpenses)}</strong>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Receitas do dia</span>
              <strong className="green-text">{money(selectedIncome)}</strong>
            </div>
            <div className="summary-card">
              <span>Despesas do dia</span>
              <strong className="red-text">{money(selectedExpenses)}</strong>
            </div>
          </div>

          <div className="section-heading">
            <h3>Movimentações financeiras</h3>
            <button type="button" className="primary-button" onClick={() => {
              setTransactionForm({ date: selectedDate, type: "income", amount: "", category: "Passagens", description: "", tripId: "", paymentMethod: "Pix" });
              setTransactionError("");
              setTransactionNotice("");
              setPage("finance");
            }}>+ Novo lançamento</button>
          </div>

          {selectedTransactions.length === 0 ? (
            <p className="muted-text small-text">Nenhum lançamento financeiro nesta data.</p>
          ) : (
            <div className="trip-list">
              {selectedTransactions.map((item) => (
                <article className="trip-row" key={item.id}>
                  <div className="trip-dot" />
                  <div className="trip-main">
                    <strong>{item.description}</strong>
                    <span>{item.category} • {item.paymentMethod || "Forma não informada"}</span>
                  </div>
                  <strong className={item.type === "income" ? "green-text" : "red-text"}>
                    {item.type === "expense" ? "−" : "+"}{money(Number(item.amount || 0))}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  if (!authReady) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <div className="brand-logo">V</div>
            <div><h1>VCAR</h1><p>Gestão de Viagens</p></div>
          </div>
          <p className="muted-text">Verificando sua sessão...</p>
        </section>
      </main>
    );
  }

  if (!user || !companyProfile) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <div className="brand-logo">V</div>
            <div><h1>VCAR</h1><p>Gestão de Viagens</p></div>
          </div>
          <div className="login-heading">
            <h2>Bem-vindo</h2>
            <p>Entre para acessar sua empresa</p>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
          </form>
          <div className="login-footer">VCAR Gestão de Viagens</div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo">V</div>
          <div>
            <h1>VCAR</h1>
            <p>Gestão de Viagens</p>
          </div>
        </div>
        <div className="topbar-user">
          <span className="company-name">{companyProfile?.company?.name || 'VCAR Gestão de Viagens'}</span>
          <span className="user-email">{user?.email || ''}</span>
          <button type="button" className="text-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="page-title">
          <div>
            <p className="eyebrow">PAINEL DA EMPRESA</p>
            <h1>
              {page === "calendar" ? "Visão geral" :
               page === "trips" ? "Viagens" :
               page === "clients" ? "Clientes" :
               page === "finance" ? "Financeiro" : "Mais opções"}
            </h1>
            <p className="muted-text">Organize suas viagens em um só lugar.</p>
          </div>
          <span className="role-chip">
            {companyProfile?.role === "admin" ? "Administrador" : "Colaborador"}
          </span>
        </div>

        {renderPage()}
      </div>

      <nav className="bottom-nav" aria-label="Menu principal">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={page === item.id ? "nav-item active" : "nav-item"}
            onClick={() => {
              setPage(item.id);
              setTripNotice("");
              setShowTripForm(false);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

export default App;
