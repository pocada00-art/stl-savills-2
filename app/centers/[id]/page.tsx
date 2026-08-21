"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Plus,
  RotateCcw,
  CheckCircle2,
  Search,
  FileCheck2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { demo } from "@/lib/data";
import {
  Card,
  SectionTitle,
  Badge,
  Button,
  Select,
} from "@/components/ui";
import {
  loadState,
  saveState,
  reviewKey,
  reviewSummary,
  blankItem,
  type V1State,
  type V1Status,
  type Period,
} from "@/lib/v1-state";

const STATUSES: V1Status[] = [
  "APTO",
  "APTO CONDICIONADO",
  "NO APTO",
  "PENDIENTE",
  "SIN INFORMACIÓN",
];

export default function CenterDetail() {
  const params = useParams();
  const id = String(params.id);

  const center =
    demo.centers.find((c) => c.id === id) ||
    demo.centers.find((c) => encodeURIComponent(c.id) === id);

  const [state, setState] = useState<V1State>({
    role: "ADMIN",
    centers: {},
    activeItems: {},
    reviews: {},
  });

  const [period, setPeriod] = useState<Period>("S2");
  const [year, setYear] = useState(2026);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todas");
  const [saved, setSaved] = useState(false);
  const [participant, setParticipant] = useState("");
  const [installationsOpen, setInstallationsOpen] = useState(true);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    const h = () => setState(loadState());
    window.addEventListener("stl-role-change", h);

    return () => window.removeEventListener("stl-role-change", h);
  }, []);

  if (!center) {
    return (
      <Card className="p-8">
        <h2 className="text-xl font-bold">Centro no encontrado</h2>
        <Link
          href="/centers"
          className="mt-4 inline-block text-sm underline"
        >
          Volver
        </Link>
      </Card>
    );
  }

  const currentCenter = center;

  const catalog =
    center.country === "España" ? demo.esCatalog : demo.ptCatalog;

  const overrides = state.centers[center.id] || {};
  const extendedOverrides = overrides as typeof overrides & {
    city?: string;
    province?: string;
    managerPhone?: string;
    managerEmail?: string;
    technicalResponsiblePhone?: string;
    technicalResponsibleEmail?: string;
  };

  const activeMap = state.activeItems[center.id] || {};

  const activeItems = catalog.filter(
    (x: any) => activeMap[x.id] !== false
  );

  const inactiveItems = catalog.filter(
    (x: any) => activeMap[x.id] === false
  );

  const key = reviewKey(center.id, year, period);

  const review =
    state.reviews[key] || {
      year,
      period,
      confirmed: false,
      items: {},
      participants: [],
    };

  const summary = reviewSummary(
    review,
    activeItems.map((x: any) => x.id)
  );

  const categories = [
    "Todas",
    ...Array.from(
      new Set(catalog.map((x: any) => x.category).filter(Boolean))
    ),
  ];

  const visible = activeItems.filter(
    (x: any) =>
      (category === "Todas" || x.category === category) &&
      `${x.code} ${x.installation} ${x.action} ${x.category}`
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  function updateState(next: V1State) {
    setState(next);
    saveState(next);
    setSaved(true);

    setTimeout(() => setSaved(false), 1500);
  }

  function updateCenter(field: string, value: string) {
    updateState({
      ...state,
      centers: {
        ...state.centers,
        [currentCenter.id]: {
          ...overrides,
          [field]: value,
        },
      },
    });
  }

  function setActive(itemId: string, active: boolean) {
    const next = {
      ...state,
      activeItems: {
        ...state.activeItems,
        [currentCenter.id]: {
          ...activeMap,
          [itemId]: active,
        },
      },
    };

    updateState(next);
  }

  function getItem(itemId: string) {
    return review.items[itemId] || blankItem();
  }

  function updateItem(
    itemId: string,
    patch: Partial<ReturnType<typeof blankItem>>
  ) {
    const current = getItem(itemId);

    const nextReview = {
      ...review,
      items: {
        ...review.items,
        [itemId]: {
          ...current,
          ...patch,
        },
      },
    };

    updateState({
      ...state,
      reviews: {
        ...state.reviews,
        [key]: nextReview,
      },
    });
  }

  function confirmItem(itemId: string) {
    if (state.role !== "ADMIN") return;

    updateItem(itemId, {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "Administrador Demo",
    });
  }

  function confirmReview() {
    if (state.role !== "ADMIN" || summary.pendingConfirmation > 0) return;

    const nextReview = {
      ...review,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "Administrador Demo",
      participants: [
        {
          name: "Gestor Demo",
          role: "GESTOR",
          signed: true,
        },
        {
          name: "Administrador Demo",
          role: "ADMINISTRADOR",
          signed: true,
        },
        ...(review.participants || []).filter(
          (p) => p.role === "OTRO"
        ),
      ],
    };

    updateState({
      ...state,
      reviews: {
        ...state.reviews,
        [key]: nextReview,
      },
    });
  }

  function resetPeriod() {
    const next = { ...state };
    delete next.reviews[key];
    updateState(next);
  }

  function uploadImage(
    field: "imageUrl" | "logoUrl",
    file: File
  ) {
    const reader = new FileReader();

    reader.onload = () =>
      updateCenter(field, String(reader.result));

    reader.readAsDataURL(file);
  }

  const readOnly =
    state.role === "LECTURA" || center.status !== "Activo";

  const admin = state.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/centers"
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="text-sm text-slate-400">
          Centros / Ficha
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid min-h-44 grid-cols-[1fr_180px] bg-[#002A54] text-white">
          <div className="flex items-center gap-5 p-6">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
              {overrides.logoUrl ? (
                <img
                  src={overrides.logoUrl}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-2xl font-black text-[#FFCC00]">
                  {center.shortCode || center.code}
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[.18em] text-[#FFCC00]">
                {center.country} · {center.stl}
              </div>

              <h1 className="mt-2 text-3xl font-black">
                {center.name}
              </h1>

              <p className="mt-2 text-sm text-white/70">
                {overrides.address ||
                  center.address ||
                  "Dirección pendiente"}
              </p>

              <div className="mt-3 flex gap-2">
                <Badge tone="success">{center.status}</Badge>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Código {center.shortCode || "—"}
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Nº {center.code}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white/5 p-4">
            {overrides.imageUrl ? (
              <img
                src={overrides.imageUrl}
                alt={center.name}
                className="h-32 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-white/20 text-xs text-white/50">
                Imagen del centro
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Cumplimiento", `${summary.score}%`],
          ["Confirmados", `${summary.confirmed}/${summary.total}`],
          ["Pendientes", summary.pendingConfirmation],
          ["No aptos", summary.counts["NO APTO"]],
          ["Condicionados", summary.counts["APTO CONDICIONADO"]],
        ].map(([t, v]) => (
          <Card key={t} className="p-5">
            <div className="text-2xl font-black">{v}</div>
            <div className="mt-1 text-sm text-slate-500">
              {t}
            </div>
          </Card>
        ))}
      </div>

      {/* DATOS DEL CENTRO */}
      <Card className="p-6">
        <SectionTitle
          title="Datos del centro"
          subtitle="Edición disponible según perfil"
          action={
            saved ? <Badge tone="success">Guardado</Badge> : undefined
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Propiedad
            </span>

            <input
              disabled={readOnly}
              value={overrides.property ?? center.property ?? ""}
              onChange={(e) =>
                updateCenter("property", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="text-xs text-slate-400">
              Dirección
            </span>

            <input
              disabled={readOnly}
              value={overrides.address ?? center.address ?? ""}
              onChange={(e) =>
                updateCenter("address", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Ciudad
            </span>

            <input
              disabled={readOnly}
              value={extendedOverrides.city ?? ""}
              onChange={(e) =>
                updateCenter("city", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Provincia
            </span>

            <input
              disabled={readOnly}
              value={extendedOverrides.province ?? ""}
              onChange={(e) =>
                updateCenter("province", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <div className="hidden md:block" />

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Gerente
            </span>

            <input
              disabled={readOnly}
              value={overrides.manager ?? center.manager ?? ""}
              onChange={(e) =>
                updateCenter("manager", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Teléfono gerente
            </span>

            <input
              disabled={readOnly}
              value={extendedOverrides.managerPhone ?? ""}
              onChange={(e) =>
                updateCenter("managerPhone", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Email gerente
            </span>

            <input
              disabled={readOnly}
              type="email"
              value={extendedOverrides.managerEmail ?? ""}
              onChange={(e) =>
                updateCenter("managerEmail", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Responsable técnico
            </span>

            <input
              disabled={readOnly}
              value={
                overrides.technicalResponsible ?? ""
              }
              onChange={(e) =>
                updateCenter(
                  "technicalResponsible",
                  e.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Teléfono responsable técnico
            </span>

            <input
              disabled={readOnly}
              value={
                extendedOverrides.technicalResponsiblePhone ?? ""
              }
              onChange={(e) =>
                updateCenter(
                  "technicalResponsiblePhone",
                  e.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-slate-400">
              Email responsable técnico
            </span>

            <input
              disabled={readOnly}
              type="email"
              value={
                extendedOverrides.technicalResponsibleEmail ?? ""
              }
              onChange={(e) =>
                updateCenter(
                  "technicalResponsibleEmail",
                  e.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
            />
          </label>
        </div>

        {!readOnly && (
          <div className="mt-5 flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
              <ImagePlus className="mr-2 inline h-4 w-4" />
              Logo

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage("logoUrl", f);
                }}
              />
            </label>

            <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
              <ImagePlus className="mr-2 inline h-4 w-4" />
              Imagen centro

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage("imageUrl", f);
                }}
              />
            </label>
          </div>
        )}
      </Card>

      {/* HISTÓRICO */}
      <Card className="p-6">
        <SectionTitle
          title="Histórico de cumplimiento"
          subtitle="Evolución S1 / S2 y siguientes años"
        />

        <div className="grid gap-3 md:grid-cols-4">
          {[2026, 2027, 2028].flatMap((y) =>
            (["S1", "S2"] as Period[]).map((p) => {
              const r =
                state.reviews[reviewKey(center.id, y, p)];

              const sum = reviewSummary(
                r,
                catalog
                  .filter(
                    (x: any) => activeMap[x.id] !== false
                  )
                  .map((x: any) => x.id)
              );

              return (
                <div
                  key={`${y}-${p}`}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="text-xs text-slate-400">
                    {p} {y}
                  </div>

                  <div className="mt-2 text-xl font-black">
                    {r ? `${sum.score}%` : "—"}
                  </div>

                  <div className="mt-1 text-xs">
                    {r?.confirmed
                      ? "Confirmada"
                      : "Sin confirmar"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <BarChart3 className="h-4 w-4" />
          La evolución gráfica se alimentará de todas las
          revisiones confirmadas.
        </div>
      </Card>

      {/* REVISION TECNICO LEGAL */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Revisión técnico-legal
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Dos revisiones anuales con histórico independiente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
            >
              <option>2026</option>
              <option>2027</option>
              <option>2028</option>
            </Select>

            <Select
              value={period}
              onChange={(v) => setPeriod(v as Period)}
            >
              <option value="S1">S1</option>
              <option value="S2">S2</option>
            </Select>

            {admin && (
              <Button
                variant="secondary"
                onClick={resetPeriod}
              >
                <RotateCcw className="mr-2 inline h-4 w-4" />
                Reiniciar demo
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">
              Estado
            </div>

            <div className="mt-1 font-bold">
              {review.confirmed
                ? "CONFIRMADA"
                : "EN CURSO"}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">
              Elementos
            </div>

            <div className="mt-1 font-bold">
              {summary.confirmed}/{summary.total}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <div className="text-xs text-amber-700">
              Pendientes confirmar
            </div>

            <div className="mt-1 text-xl font-black text-amber-700">
              {summary.pendingConfirmation}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-xs text-emerald-700">
              Cumplimiento
            </div>

            <div className="mt-1 text-xl font-black text-emerald-700">
              {summary.score}%
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          {STATUSES.map((s) => (
            <span
              key={s}
              className="rounded-full border border-slate-200 px-3 py-1"
            >
              <b>{summary.counts[s]}</b> {s}
            </span>
          ))}
        </div>

        {summary.pendingConfirmation === 0 &&
          summary.total > 0 &&
          !review.confirmed &&
          admin && (
            <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div>
                <div className="font-bold text-emerald-800">
                  Todos los elementos están confirmados
                </div>

                <div className="text-xs text-emerald-700">
                  La revisión ya puede ser cerrada por el
                  Administrador.
                </div>
              </div>

              <Button onClick={confirmReview}>
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                Confirmar {period} {year}
              </Button>
            </div>
          )}

        {review.confirmed && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div>
              <div className="font-bold text-emerald-800">
                Revisión {period} {year} confirmada
              </div>

              <div className="text-xs text-emerald-700">
                Administrador: {review.confirmedBy} ·{" "}
                {review.confirmedAt
                  ? new Date(
                      review.confirmedAt
                    ).toLocaleString("es-ES")
                  : "—"}
              </div>
            </div>

            <Link
              href={`/centers/${center.id}/certificate?year=${year}&period=${period}`}
              className="rounded-xl bg-[#002A54] px-4 py-2 text-sm font-semibold text-white"
            >
              <FileCheck2 className="mr-2 inline h-4 w-4" />
              Ver / exportar certificado
            </Link>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-bold">
            Participantes de la revisión
          </div>

          <div className="mt-2 space-y-2">
            {(review.participants || []).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
              >
                <span>
                  {p.name} · {p.role}
                </span>

                {p.signed ? (
                  <Badge tone="success">Firmado</Badge>
                ) : admin && !review.confirmed ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const participants = [
                        ...(review.participants || []),
                      ];

                      participants[i] = {
                        ...participants[i],
                        signed: true,
                      };

                      updateState({
                        ...state,
                        reviews: {
                          ...state.reviews,
                          [key]: {
                            ...review,
                            participants,
                          },
                        },
                      });
                    }}
                  >
                    Firmar
                  </Button>
                ) : (
                  <Badge>Pendiente</Badge>
                )}
              </div>
            ))}
          </div>

          {!readOnly && !review.confirmed && (
            <div className="mt-3 flex gap-2">
              <input
                value={participant}
                onChange={(e) =>
                  setParticipant(e.target.value)
                }
                placeholder="Añadir participante"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <Button
                variant="secondary"
                onClick={() => {
                  if (!participant.trim()) return;

                  const nextReview = {
                    ...review,
                    participants: [
                      ...(review.participants || []),
                      {
                        name: participant.trim(),
                        role: "OTRO",
                        signed: false,
                      },
                    ],
                  };

                  updateState({
                    ...state,
                    reviews: {
                      ...state.reviews,
                      [key]: nextReview,
                    },
                  });

                  setParticipant("");
                }}
              >
                Añadir
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* INSTALACIONES Y ACTUACIONES */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              Instalaciones y actuaciones
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {activeItems.length} elementos activos ·{" "}
              {inactiveItems.length} elementos no activos
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setInstallationsOpen((v) => !v)
            }
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            title={
              installationsOpen
                ? "Ocultar instalaciones"
                : "Mostrar instalaciones"
            }
          >
            {installationsOpen ? (
              <>
                Ocultar
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Mostrar
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {installationsOpen && (
          <>
            <div className="mt-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar código, instalación, actuación..."
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                  />
                </div>

                <Select
                  value={category}
                  onChange={setCategory}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Instalación</th>
                      <th>Actuación</th>
                      <th>Frecuencia</th>
                      <th>Estado revisión</th>
                      <th>Fecha</th>
                      <th>Empresa</th>
                      <th>Confirmación</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map((x: any) => {
                      const item = getItem(x.id);
                      const locked =
                        readOnly ||
                        review.confirmed ||
                        item.confirmed;

                      return (
                        <tr
                          key={x.id}
                          className={
                            item.confirmed
                              ? "bg-emerald-50/40"
                              : item.status === "NO APTO"
                              ? "bg-red-50/40"
                              : item.status ===
                                "APTO CONDICIONADO"
                              ? "bg-amber-50/40"
                              : ""
                          }
                        >
                          <td className="font-mono text-xs">
                            {x.code}
                          </td>

                          <td className="font-semibold">
                            {x.installation}
                          </td>

                          <td>{x.action}</td>

                          <td>{x.frequency}</td>

                          <td>
                            <Select
                              value={item.status}
                              onChange={(v) =>
                                updateItem(x.id, {
                                  status: v as V1Status,
                                })
                              }
                            >
                              {STATUSES.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </Select>
                          </td>

                          <td>
                            <input
                              disabled={locked}
                              type="date"
                              value={item.date}
                              onChange={(e) =>
                                updateItem(x.id, {
                                  date: e.target.value,
                                })
                              }
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>

                          <td>
                            <input
                              disabled={locked}
                              value={item.company}
                              onChange={(e) =>
                                updateItem(x.id, {
                                  company: e.target.value,
                                })
                              }
                              placeholder="Empresa"
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>

                          <td>
                            {item.confirmed ? (
                              <Badge tone="success">
                                Confirmado
                              </Badge>
                            ) : admin ? (
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  confirmItem(x.id)
                                }
                              >
                                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                                Confirmar
                              </Button>
                            ) : (
                              <Badge tone="warning">
                                Pendiente
                              </Badge>
                            )}
                          </td>

                          <td>
                            {!readOnly && (
                              <button
                                onClick={() =>
                                  setActive(x.id, false)
                                }
                                title="Eliminar elemento del centro"
                                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-5">
              <SectionTitle
                title="Elementos no activos"
                subtitle="No computan, no generan vencimientos y conservan su histórico"
                action={
                  !readOnly ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (inactiveItems[0]) {
                          setActive(
                            inactiveItems[0].id,
                            true
                          );
                        }
                      }}
                    >
                      <Plus className="mr-2 inline h-4 w-4" />
                      Añadir elemento
                    </Button>
                  ) : undefined
                }
              />

              {inactiveItems.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  No hay elementos no activos.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {inactiveItems.map((x: any) => (
                    <div
                      key={x.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                    >
                      <div>
                        <b>{x.code}</b> · {x.installation} —{" "}
                        {x.action}
                      </div>

                      {!readOnly && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setActive(x.id, true)
                          }
                        >
                          Activar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
