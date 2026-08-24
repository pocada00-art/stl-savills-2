"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Search,
  Plus,
  ArrowUpDown,
  X,
} from "lucide-react";

import { demo } from "@/lib/data";

import {
  loadState,
  saveState,
  type CenterOverride,
  type V1Country,
  type V1State,
} from "@/lib/v1-state";

import {
  Card,
  SectionTitle,
  Badge,
  Select,
  Button,
} from "@/components/ui";

type SortKey =
  | "name"
  | "code"
  | "shortCode"
  | "country"
  | "property"
  | "manager"
  | "stl"
  | "status";

type CenterListItem = {
  id: string;
  name: string;
  code: string;
  shortCode?: string;
  country: string;
  property?: string | null;
  manager?: string | null;
  stl?: string;
  status?: string;
};

type NewCenterForm = {
  name: string;
  code: string;
  shortCode: string;

  address: string;
  city: string;
  province: string;

  country: V1Country;

  property: string;
  portfolio: string;

  manager: string;
  managerPhone: string;
  managerEmail: string;

  technicalResponsible: string;
  technicalResponsiblePhone: string;
  technicalResponsibleEmail: string;

  secondaryResponsible: string;
  secondaryResponsiblePhone: string;
  secondaryResponsibleEmail: string;

  contactName: string;
  contactEmail: string;
  contactPhone: string;

  registrationDate: string;

  status: string;

  framework: string;

  latitude: string;
  longitude: string;

  observations: string;
};

function getDefaultSTL(
  country: V1Country
) {
  return country === "España"
    ? "XX_STL_SAV_26 S1_ESP v4"
    : "XX_STL_SAV_26 S1_POR v4";
}

function createEmptyCenterForm(
  country: V1Country
): NewCenterForm {
  return {
    name: "",
    code: "",
    shortCode: "",

    address: "",
    city: "",
    province: "",

    country,

    property: "",
    portfolio: "",

    manager: "",
    managerPhone: "",
    managerEmail: "",

    technicalResponsible: "",
    technicalResponsiblePhone: "",
    technicalResponsibleEmail: "",

    secondaryResponsible: "",
    secondaryResponsiblePhone: "",
    secondaryResponsibleEmail: "",

    contactName: "",
    contactEmail: "",
    contactPhone: "",

    registrationDate:
      new Date()
        .toISOString()
        .slice(0, 10),

    status: "Activo",

    framework: "",

    latitude: "",
    longitude: "",

    observations: "",
  };
}

function inputClass(
  extra = ""
) {
  return `mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#002A54] ${extra}`;
}

export default function Centers() {
  const [q, setQ] =
    useState("");

  const [country, setCountry] =
    useState<"Todos" | V1Country>(
      "Todos"
    );

  const [sort, setSort] =
    useState<{
      key: SortKey;
      dir: "asc" | "desc";
    }>({
      key: "code",
      dir: "asc",
    });

  const [
    state,
    setState,
  ] = useState<V1State>(() =>
    loadState()
  );

  const [
    showNewCenter,
    setShowNewCenter,
  ] = useState(false);

  const [
    newCenter,
    setNewCenter,
  ] = useState<NewCenterForm>(() =>
    createEmptyCenterForm(
      "España"
    )
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  useEffect(() => {
    setState(loadState());

    const handler = () => {
      setState(loadState());
    };

    window.addEventListener(
      "stl-state-change",
      handler
    );

    window.addEventListener(
      "stl-role-change",
      handler
    );

    return () => {
      window.removeEventListener(
        "stl-state-change",
        handler
      );

      window.removeEventListener(
        "stl-role-change",
        handler
      );
    };
  }, []);

  const role =
    state.role;

  const userCountry =
    state.country;

  const availableCountries:
    ("Todos" | V1Country)[] =
    role === "ADMIN"
      ? [
          "Todos",
          "España",
          "Portugal",
        ]
      : userCountry
        ? [userCountry]
        : ["Todos"];

  const effectiveCountry =
    role === "ADMIN"
      ? country
      : userCountry ||
        "Todos";

  /*
   * Construimos primero los centros originales.
   *
   * Después añadimos los centros creados
   * manualmente en V1State.
   *
   * Finalmente aplicamos los overrides
   * correspondientes a los centros demo.
   */
  const list =
    useMemo(() => {
      const demoCenters:
        CenterListItem[] =
        demo.centers
          .map(c => {
            const overrides =
              (state.centers[
                c.id
              ] ||
                {}) as CenterOverride;

            return {
              ...c,

              name:
                overrides.name ??
                c.name,

              code:
                overrides.code ??
                c.code,

              shortCode:
                overrides.shortCode ??
                c.shortCode,

              country:
                overrides.country ??
                c.country,

              property:
                overrides.property ??
                c.property,

              manager:
                overrides.manager ??
                c.manager,

              stl:
                overrides.stl ??
                c.stl,

              status:
                overrides.status ??
                c.status,
            };
          });

      const createdCenters:
        CenterListItem[] =
        Object.values(
          state.createdCenters ??
            {}
        ).map(center => ({
          id:
            String(
              center.id ?? ""
            ),

          name:
            String(
              center.name ?? ""
            ),

          code:
            String(
              center.code ?? ""
            ),

          shortCode:
            center.shortCode,

          country:
            String(
              center.country ?? ""
            ),

          property:
            center.property ??
            null,

          manager:
            center.manager ??
            null,

          stl:
            center.stl,

          status:
            center.status,
        }));

      const arr = [
        ...demoCenters,
        ...createdCenters,
      ];

      return arr
        .filter(
          c =>
            (
              effectiveCountry ===
                "Todos" ||
              c.country ===
                effectiveCountry
            ) &&
            `${c.name} ${
              c.code
            } ${
              c.shortCode ||
              ""
            } ${
              c.property ||
              ""
            } ${
              c.manager ||
              ""
            }`
              .toLowerCase()
              .includes(
                q.toLowerCase()
              )
        )
        .sort(
          (a, b) => {
            const valueA =
              String(
                a[
                  sort.key
                ] ?? ""
              );

            const valueB =
              String(
                b[
                  sort.key
                ] ?? ""
              );

            return (
              valueA.localeCompare(
                valueB,
                "es",
                {
                  numeric: true,
                  sensitivity:
                    "base",
                }
              ) *
              (sort.dir ===
              "asc"
                ? 1
                : -1)
            );
          }
        );
    }, [
      q,
      effectiveCountry,
      sort,
      state.centers,
      state.createdCenters,
    ]);

  function toggle(
    key: SortKey
  ) {
    setSort(current => ({
      key,

      dir:
        current.key === key &&
        current.dir === "asc"
          ? "desc"
          : "asc",
    }));
  }

  function updateNewCenter(
    field: keyof NewCenterForm,
    value: string
  ) {
    setNewCenter(
      current => ({
        ...current,
        [field]: value,
      })
    );

    setFormError("");
  }

  function changeCountry(
    value: V1Country
  ) {
    setNewCenter(
      current => ({
        ...current,

        country: value,
      })
    );

    setFormError("");
  }

  function openNewCenter() {
    const initialCountry =
      role === "ADMIN"
        ? country ===
            "España" ||
          country ===
            "Portugal"
          ? country
          : "España"
        : userCountry ||
          "España";

    setNewCenter(
      createEmptyCenterForm(
        initialCountry
      )
    );

    setFormError("");
    setShowNewCenter(true);
  }

  function closeNewCenter() {
    setShowNewCenter(false);
    setFormError("");
  }

  function createCenter() {
    if (
      role !== "ADMIN"
    ) {
      setFormError(
        "Solo un administrador puede crear un nuevo centro."
      );

      return;
    }

    const name =
      newCenter.name.trim();

    const code =
      newCenter.code.trim();

    const shortCode =
      newCenter.shortCode.trim();

    const framework =
      newCenter.framework.trim();

    const technicalResponsible =
      newCenter.technicalResponsible.trim();

    if (!name) {
      setFormError(
        "El nombre del centro es obligatorio."
      );

      return;
    }

    if (!code) {
      setFormError(
        "El número/código oficial del centro es obligatorio."
      );

      return;
    }

    if (!newCenter.country) {
      setFormError(
        "El país es obligatorio."
      );

      return;
    }

    if (!framework) {
      setFormError(
        "El marco normativo es obligatorio."
      );

      return;
    }

    if (!technicalResponsible) {
      setFormError(
        "El responsable técnico es obligatorio."
      );

      return;
    }

    const duplicateCode =
      [
        ...demo.centers.map(
          c => String(c.code)
        ),
        ...Object.values(
          state.createdCenters ??
            {}
        ).map(c =>
          String(
            c.code ?? ""
          )
        ),
      ].some(
        existingCode =>
          existingCode
            .trim()
            .toLowerCase() ===
          code
            .toLowerCase()
      );

    if (duplicateCode) {
      setFormError(
        "Ya existe un centro con ese número/código oficial."
      );

      return;
    }

    const id =
      `center-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const created: CenterOverride =
      {
        id,

        name,

        code,

        shortCode:
          shortCode ||
          undefined,

        address:
          newCenter.address.trim() ||
          undefined,

        city:
          newCenter.city.trim() ||
          undefined,

        province:
          newCenter.province.trim() ||
          undefined,

        country:
          newCenter.country,

        property:
          newCenter.property.trim() ||
          null,

        portfolio:
          newCenter.portfolio.trim() ||
          null,

        stl:
          getDefaultSTL(
            newCenter.country
          ),

        stlVersion:
          getDefaultSTL(
            newCenter.country
          ),

        framework,

        status:
          newCenter.status ||
          "Activo",

        registrationDate:
          newCenter.registrationDate,

        manager:
          newCenter.manager.trim() ||
          null,

        managerPhone:
          newCenter.managerPhone.trim() ||
          undefined,

        managerEmail:
          newCenter.managerEmail.trim() ||
          undefined,

        technicalResponsible,

        technicalResponsiblePhone:
          newCenter.technicalResponsiblePhone.trim() ||
          undefined,

        technicalResponsibleEmail:
          newCenter.technicalResponsibleEmail.trim() ||
          undefined,

        secondaryResponsible:
          newCenter.secondaryResponsible.trim() ||
          undefined,

        secondaryResponsiblePhone:
          newCenter.secondaryResponsiblePhone.trim() ||
          undefined,

        secondaryResponsibleEmail:
          newCenter.secondaryResponsibleEmail.trim() ||
          undefined,

        contactName:
          newCenter.contactName.trim() ||
          undefined,

        contactEmail:
          newCenter.contactEmail.trim() ||
          undefined,

        contactPhone:
          newCenter.contactPhone.trim() ||
          undefined,

        latitude:
          newCenter.latitude.trim() ||
          undefined,

        longitude:
          newCenter.longitude.trim() ||
          undefined,

        observations:
          newCenter.observations.trim() ||
          undefined,
      };

    const nextState: V1State =
      {
        ...state,

        createdCenters: {
          ...(state.createdCenters ??
            {}),

          [id]: created,
        },

        activeItems: {
          ...state.activeItems,

          [id]: {},
        },
      };

    saveState(nextState);

    setState(nextState);

    window.dispatchEvent(
      new Event(
        "stl-state-change"
      )
    );

    setShowNewCenter(false);

    setFormError("");
  }

  const th = (
    key: SortKey,
    label: string
  ) => (
    <th
      key={key}
      className="px-4 py-3 text-left"
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap"
        onClick={() =>
          toggle(key)
        }
      >
        {label}

        <ArrowUpDown
          className={`h-3 w-3 ${
            sort.key === key
              ? "text-[#FFCC00]"
              : "text-slate-400"
          }`}
        />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Gestión de centros comerciales"
        subtitle={`${list.length} centros · datos reales iniciales y centros creados`}
        action={
          role === "ADMIN" ? (
            <Button
              onClick={
                openNewCenter
              }
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Nuevo centro
            </Button>
          ) : undefined
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={e =>
                setQ(
                  e.target.value
                )
              }
              placeholder="Buscar por centro, código, abreviatura, propiedad o responsable..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {role ===
            "ADMIN" && (
            <Select
              value={
                country
              }
              onChange={value =>
                setCountry(
                  value as
                    | "Todos"
                    | V1Country
                )
              }
            >
              {availableCountries.map(
                item => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </Select>
          )}

          {role !==
            "ADMIN" &&
            userCountry && (
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold">
                {
                  userCountry
                }
              </div>
            )}
        </div>
      </Card>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {th(
                "code",
                "Nº"
              )}

              {th(
                "name",
                "Centro"
              )}

              {th(
                "shortCode",
                "Código"
              )}

              {th(
                "country",
                "País"
              )}

              {th(
                "property",
                "Propiedad"
              )}

              {th(
                "manager",
                "Responsable"
              )}

              {th(
                "stl",
                "STL"
              )}

              {th(
                "status",
                "Estado"
              )}
            </tr>
          </thead>

          <tbody>
            {list.map(c => (
              <tr
                key={c.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() =>
                  (window.location.href =
                    `/centers/${encodeURIComponent(
                      c.id
                    )}`)
                }
              >
                <td className="font-mono text-xs">
                  {
                    c.code
                  }
                </td>

                <td>
                  <Link
                    href={`/centers/${encodeURIComponent(
                      c.id
                    )}`}
                    className="block"
                    onClick={e =>
                      e.stopPropagation()
                    }
                  >
                    <div className="font-bold">
                      {
                        c.name
                      }
                    </div>
                  </Link>
                </td>

                <td className="font-mono text-xs">
                  {
                    c.shortCode ||
                    "—"
                  }
                </td>

                <td>
                  {
                    c.country
                  }
                </td>

                <td>
                  {
                    c.property ||
                    "—"
                  }
                </td>

                <td>
                  {
                    c.manager ||
                    "Sin asignar"
                  }
                </td>

                <td>
                  <Badge
                    tone={
                      c.country ===
                      "España"
                        ? "info"
                        : "warning"
                    }
                  >
                    {
                      c.stl
                    }
                  </Badge>
                </td>

                <td>
                  <Badge
                    tone="success"
                  >
                    {
                      c.status
                    }
                  </Badge>
                </td>
              </tr>
            ))}

            {list.length ===
              0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-sm text-slate-400"
                >
                  No hay centros
                  que coincidan
                  con la
                  búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          MODAL NUEVO CENTRO
          ===================================================== */}

      {showNewCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#002A54] px-6 py-4 text-white">
              <div>
                <h2 className="text-xl font-black">
                  Nuevo centro
                </h2>

                <p className="mt-1 text-xs text-white/70">
                  Alta de un nuevo centro
                  comercial
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeNewCenter
                }
                className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* IDENTIFICACIÓN */}
                <section>
                  <div className="mb-4">
                    <h3 className="font-bold">
                      Identificación
                    </h3>

                    <p className="text-xs text-slate-400">
                      Datos básicos del
                      centro.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Nombre *
                      </span>

                      <input
                        value={
                          newCenter.name
                        }
                        onChange={e =>
                          updateNewCenter(
                            "name",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                        autoFocus
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Nº / Código oficial *
                      </span>

                      <input
                        value={
                          newCenter.code
                        }
                        onChange={e =>
                          updateNewCenter(
                            "code",
                            e.target.value
                          )
                        }
                        className={inputClass(
                          "font-mono"
                        )}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Código / abreviatura
                      </span>

                      <input
                        value={
                          newCenter.shortCode
                        }
                        onChange={e =>
                          updateNewCenter(
                            "shortCode",
                            e.target.value
                          )
                        }
                        className={inputClass(
                          "font-mono"
                        )}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        País *
                      </span>

                      <select
                        value={
                          newCenter.country
                        }
                        onChange={e =>
                          changeCountry(
                            e.target.value as V1Country
                          )
                        }
                        className={inputClass()}
                      >
                        <option value="España">
                          España
                        </option>

                        <option value="Portugal">
                          Portugal
                        </option>
                      </select>
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        STL asignado
                      </span>

                      <input
                        value={getDefaultSTL(
                          newCenter.country
                        )}
                        readOnly
                        className={inputClass(
                          "bg-slate-50 font-semibold"
                        )}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Estado operativo
                      </span>

                      <select
                        value={
                          newCenter.status
                        }
                        onChange={e =>
                          updateNewCenter(
                            "status",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      >
                        <option value="Activo">
                          Activo
                        </option>

                        <option value="Inactivo">
                          Inactivo
                        </option>

                        <option value="Archivado">
                          Archivado
                        </option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Fecha de alta
                      </span>

                      <input
                        type="date"
                        value={
                          newCenter.registrationDate
                        }
                        onChange={e =>
                          updateNewCenter(
                            "registrationDate",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Versión STL
                      </span>

                      <input
                        value={getDefaultSTL(
                          newCenter.country
                        )}
                        readOnly
                        className={inputClass(
                          "bg-slate-50"
                        )}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Marco normativo *
                      </span>

                      <input
                        value={
                          newCenter.framework
                        }
                        onChange={e =>
                          updateNewCenter(
                            "framework",
                            e.target.value
                          )
                        }
                        placeholder="Indicar marco normativo aplicable"
                        className={inputClass()}
                      />
                    </label>
                  </div>
                </section>

                {/* LOCALIZACIÓN */}
                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4">
                    <h3 className="font-bold">
                      Localización
                    </h3>

                    <p className="text-xs text-slate-400">
                      Dirección y ubicación
                      del centro.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="text-sm md:col-span-4">
                      <span className="text-xs text-slate-400">
                        Dirección
                      </span>

                      <input
                        value={
                          newCenter.address
                        }
                        onChange={e =>
                          updateNewCenter(
                            "address",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Ciudad
                      </span>

                      <input
                        value={
                          newCenter.city
                        }
                        onChange={e =>
                          updateNewCenter(
                            "city",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Provincia
                      </span>

                      <input
                        value={
                          newCenter.province
                        }
                        onChange={e =>
                          updateNewCenter(
                            "province",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Latitud
                      </span>

                      <input
                        value={
                          newCenter.latitude
                        }
                        onChange={e =>
                          updateNewCenter(
                            "latitude",
                            e.target.value
                          )
                        }
                        placeholder="Ej.: 40.4168"
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm md:col-span-2">
                      <span className="text-xs text-slate-400">
                        Longitud
                      </span>

                      <input
                        value={
                          newCenter.longitude
                        }
                        onChange={e =>
                          updateNewCenter(
                            "longitude",
                            e.target.value
                          )
                        }
                        placeholder="Ej.: -3.7038"
                        className={inputClass()}
                      />
                    </label>
                  </div>
                </section>

                {/* PROPIEDAD / PORTFOLIO */}
                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4">
                    <h3 className="font-bold">
                      Propiedad y portfolio
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Propiedad
                      </span>

                      <input
                        value={
                          newCenter.property
                        }
                        onChange={e =>
                          updateNewCenter(
                            "property",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Portfolio
                      </span>

                      <input
                        value={
                          newCenter.portfolio
                        }
                        onChange={e =>
                          updateNewCenter(
                            "portfolio",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>
                  </div>
                </section>

                {/* RESPONSABLES */}
                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4">
                    <h3 className="font-bold">
                      Responsables
                    </h3>

                    <p className="text-xs text-slate-400">
                      El responsable técnico
                      es obligatorio.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Gerente
                      </span>

                      <input
                        value={
                          newCenter.manager
                        }
                        onChange={e =>
                          updateNewCenter(
                            "manager",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Teléfono gerente
                      </span>

                      <input
                        value={
                          newCenter.managerPhone
                        }
                        onChange={e =>
                          updateNewCenter(
                            "managerPhone",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Email gerente
                      </span>

                      <input
                        type="email"
                        value={
                          newCenter.managerEmail
                        }
                        onChange={e =>
                          updateNewCenter(
                            "managerEmail",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Responsable técnico *
                      </span>

                      <input
                        value={
                          newCenter.technicalResponsible
                        }
                        onChange={e =>
                          updateNewCenter(
                            "technicalResponsible",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Teléfono responsable técnico
                      </span>

                      <input
                        value={
                          newCenter.technicalResponsiblePhone
                        }
                        onChange={e =>
                          updateNewCenter(
                            "technicalResponsiblePhone",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Email responsable técnico
                      </span>

                      <input
                        type="email"
                        value={
                          newCenter.technicalResponsibleEmail
                        }
                        onChange={e =>
                          updateNewCenter(
                            "technicalResponsibleEmail",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Responsable secundario
                      </span>

                      <input
                        value={
                          newCenter.secondaryResponsible
                        }
                        onChange={e =>
                          updateNewCenter(
                            "secondaryResponsible",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Teléfono responsable secundario
                      </span>

                      <input
                        value={
                          newCenter.secondaryResponsiblePhone
                        }
                        onChange={e =>
                          updateNewCenter(
                            "secondaryResponsiblePhone",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Email responsable secundario
                      </span>

                      <input
                        type="email"
                        value={
                          newCenter.secondaryResponsibleEmail
                        }
                        onChange={e =>
                          updateNewCenter(
                            "secondaryResponsibleEmail",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>
                  </div>
                </section>

                {/* CONTACTO */}
                <section className="border-t border-slate-100 pt-6">
                  <div className="mb-4">
                    <h3 className="font-bold">
                      Contacto general
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Nombre
                      </span>

                      <input
                        value={
                          newCenter.contactName
                        }
                        onChange={e =>
                          updateNewCenter(
                            "contactName",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Email
                      </span>

                      <input
                        type="email"
                        value={
                          newCenter.contactEmail
                        }
                        onChange={e =>
                          updateNewCenter(
                            "contactEmail",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-xs text-slate-400">
                        Teléfono
                      </span>

                      <input
                        value={
                          newCenter.contactPhone
                        }
                        onChange={e =>
                          updateNewCenter(
                            "contactPhone",
                            e.target.value
                          )
                        }
                        className={inputClass()}
                      />
                    </label>
                  </div>
                </section>

                {/* OBSERVACIONES */}
                <section className="border-t border-slate-100 pt-6">
                  <label className="text-sm">
                    <span className="text-xs text-slate-400">
                      Observaciones generales
                    </span>

                    <textarea
                      value={
                        newCenter.observations
                      }
                      onChange={e =>
                        updateNewCenter(
                          "observations",
                          e.target.value
                        )
                      }
                      rows={4}
                      className={inputClass(
                        "resize-y"
                      )}
                    />
                  </label>
                </section>

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={
                  closeNewCenter
                }
              >
                Cancelar
              </Button>

              <Button
                onClick={
                  createCenter
                }
              >
                <Plus className="mr-2 inline h-4 w-4" />
                Crear centro
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
