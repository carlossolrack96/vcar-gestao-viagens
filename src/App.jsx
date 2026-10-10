
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./services/firebase";
import { getCompanyProfile } from "./services/companyProfile";
import { createVehicle, listVehicles, updateVehicle } from "./services/vehicles";
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

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
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

        if (!cancelled) {
          setUser(currentUser);
          setCompanyProfile(profile);
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
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripNotice, setTripNotice] = useState("");
  const [tripError, setTripError] = useState("");
  const [tripForm, setTripForm] = useState({
    date: dateKey(new Date()),
    time: "",
    origin: "",
    destination: "",
    vehicle: "",
    driverRecordedBy: "",
    notes: "",
  });
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
      notes: "",
    });
    setShowTripForm(true);
  }

  function handleTripSubmit(event) {
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

    const newTrip = {
      ...tripForm,
      id: `${Date.now()}`,
      companyId: companyProfile.companyId,
      createdBy: user.uid,
    };

    setTrips((current) => [...current, newTrip]);
    setSelectedDate(tripForm.date);
    const chosenDate = new Date(`${tripForm.date}T12:00:00`);
    setMonth(new Date(chosenDate.getFullYear(), chosenDate.getMonth(), 1));
    setShowTripForm(false);
    setTripNotice(
      "Viagem adicionada apenas à prévia desta sessão. Ela ainda NÃO foi salva no banco de dados."
    );
    setPage("calendar");
  }

  if (!authReady) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p>Carregando sua sessão...</p>
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
            <div>
              <h1>VCAR</h1>
              <p>Gestão de Viagens</p>
            </div>
          </div>

          <div className="login-heading">
            <h2>Bem-vindo</h2>
            <p>Entre para acessar sua empresa</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="login-footer">VCAR Gestão de Viagens</div>
        </section>
      </main>
    );
  }

  const companyName =
    companyProfile.company?.name || "Empresa cadastrada";

  const monthTrips = trips.filter((trip) =>
    trip.date.startsWith(
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    )
  );

  const selectedTrips = trips.filter(
    (trip) => trip.date === selectedDate
  );

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
          <h2>Clientes</h2>
          <p className="muted-text">
            O cadastro de clientes será desenvolvido na próxima etapa.
          </p>
          <div className="empty-state">
            <div className="empty-icon">♙</div>
            <h3>Cadastro de clientes</h3>
            <p>Nome, WhatsApp e observações de cada cliente.</p>
          </div>
        </section>
      );
    }

    if (page === "finance") {
      return (
        <section className="panel">
          <h2>Financeiro</h2>
          <p className="muted-text">
            Os valores financeiros ainda não estão conectados ao banco de dados.
          </p>
          <div className="summary-grid">
            <div className="summary-card">
              <span>Receitas</span>
              <strong className="green-text">{money(0)}</strong>
            </div>
            <div className="summary-card">
              <span>Despesas</span>
              <strong className="red-text">{money(0)}</strong>
            </div>
            <div className="summary-card">
              <span>Saldo</span>
              <strong>{money(0)}</strong>
            </div>
          </div>
        </section>
      );
    }


    if (page === "vehicles") {
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id === selectedVehicleId
      );

      function maintenanceStatus(record, vehicle) {
        const today = dateKey(new Date());
        const kmDue =
          record.nextKm !== null &&
          record.nextKm !== undefined &&
          vehicle.currentKm >= record.nextKm;
        const dateDue = record.nextDate && today >= record.nextDate;

        if (kmDue || dateDue) return "Atrasada";

        const kmNear =
          record.nextKm !== null &&
          record.nextKm !== undefined &&
          record.nextKm - vehicle.currentKm <= 1000;
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + 30);
        const dateNear =
          record.nextDate &&
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
            <strong className="green-text">{money(0)}</strong>
            <small>Sem lançamentos financeiros</small>
          </div>
          <div className="summary-card">
            <span>Despesas do mês</span>
            <strong className="red-text">{money(0)}</strong>
            <small>Sem lançamentos financeiros</small>
          </div>
        </section>

        <section className="panel calendar-panel">
          <div className="calendar-heading">
            <div>
              <h2>Calendário</h2>
              <p>Selecione um dia para consultar a programação.</p>
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
                <article className="trip-row" key={trip.id}>
                  <div className="trip-dot" />
                  <div className="trip-main">
                    <strong>{trip.origin} → {trip.destination}</strong>
                    <span>
                      {trip.time || "Horário não informado"}
                      {trip.vehicle ? ` • ${trip.vehicle}` : ""}
                    </span>
                    <span>Responsável: {trip.driverRecordedBy}</span>
                    {trip.notes && <span>{trip.notes}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="daily-balance">
            <span>Saldo financeiro do dia</span>
            <strong>{money(0)}</strong>
          </div>
          <p className="muted-text small-text">
            Os dados financeiros e os marcadores de despesas serão conectados
            quando o módulo financeiro for implementado.
          </p>
        </section>
      </>
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
          <span className="company-name">{companyName}</span>
          <span className="user-email">{user.email}</span>
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
            {companyProfile.role === "admin" ? "Administrador" : "Colaborador"}
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
