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
  Upload,
  Image as ImageIcon,
} from "lucide-react";

import { demo } from "@/lib/data";

import {
  loadState,
  saveState,
  type V1Country,
  type V1State,
  type CenterOverride,
} from "@/lib/v1-state";

import {
  saveCenterImage,
  validateImageFile,
} from "@/lib/image-storage";

import {
  Card,
  SectionTitle,
  Badge,
  Select,
  Button,
} from "@/components/ui";

/* =========================================================
 * TIPOS
 * ========================================================= */

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

  country: V1Country;

  address: string;
  city: string;
  province: string;

  property: string;

  manager: string;
  managerPhone: string;
  managerEmail: string;

  technicalResponsible: string;
  technicalResponsiblePhone: string;
  technicalResponsibleEmail: string;
};

/* =========================================================
 * FORMULARIO VACÍO
 * ========================================================= */

const EMPTY_FORM: NewCenterForm = {
  name: "",
  code: "",
  shortCode: "",

  country: "España",

  address: "",
  city: "",
  province: "",

  property: "",

  manager: "",
  managerPhone: "",
  managerEmail: "",

  technicalResponsible: "",
  technicalResponsiblePhone: "",
  technicalResponsibleEmail: "",
};

/* =========================================================
 * COMPONENTE PRINCIPAL
 * ========================================================= */

export default function Centers() {
  const [q, setQ] = useState("");

  const [country, setCountry] =
    useState<"Todos" | V1Country>("Todos");

  const [sort, setSort] = useState<{
    key: SortKey;
    dir: "asc" | "desc";
  }>({
    key: "code",
    dir: "asc",
  });

  const [showNewCenter, setShowNewCenter] =
    useState(false);

  const [newCenter, setNewCenter] =
    useState<NewCenterForm>(EMPTY_FORM);

  const [error, setError] = useState("");

  /* =======================================================
   * ARCHIVOS DE IMAGEN SELECCIONADOS
   * ======================================================= */

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [logoFile, setLogoFile] =
    useState<File | null>(null);

  /* =======================================================
   * PREVISUALIZACIONES
   * ======================================================= */

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [logoPreview, setLogoPreview] =
    useState<string | null>(null);

  /* =======================================================
   * ESTADO DE CARGA
   * ======================================================= */

  const [saving, setSaving] =
    useState(false);

  /*
   * Cargamos el estado persistido.
   *
   * El estado contiene:
   *
   * - centros originales modificados;
   * - centros creados mediante el nuevo sistema;
   * - elementos activos;
   * - revisiones históricas.
   */
  const state: V1State = loadState();

  const role = state.role;
  const userCountry = state.country;

  const availableCountries:
    ("Todos" | V1Country)[] =
    role === "ADMIN"
      ? ["Todos", "España", "Portugal"]
      : userCountry
        ? [userCountry]
        : ["Todos"];

  const effectiveCountry =
    role === "ADMIN"
      ? country
      : userCountry || "Todos";

  /* =======================================================
   * LIMPIAR URLS DE PREVISUALIZACIÓN
   * ======================================================= */

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      if (logoPreview) {
        URL.revokeObjectURL(
          logoPreview
        );
      }
    };
  }, [
    imagePreview,
    logoPreview,
  ]);

  /* =======================================================
   * LISTADO DE CENTROS
   * ======================================================= */

  const list = useMemo(() => {
    const arr: CenterListItem[] = [];

    /*
     * -------------------------------------------------------
     * 1. CENTROS ORIGINALES
     * -------------------------------------------------------
     */

    demo.centers.forEach((c) => {
      const overrides =
        (state.centers?.[c.id] ||
          {}) as CenterOverride;

      arr.push({
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
      });
    });

    /*
     * -------------------------------------------------------
     * 2. CENTROS CREADOS MEDIANTE EL NUEVO SISTEMA
     * -------------------------------------------------------
     */

    const demoIds = new Set(
      demo.centers.map(
        (center) => center.id
      )
    );

    Object.entries(
      state.centers || {}
    ).forEach(
      ([centerId, savedCenter]) => {
        if (demoIds.has(centerId)) {
          return;
        }

        const center =
          savedCenter as CenterOverride;

        arr.push({
          id:
            center.id ||
            centerId,

          name:
            center.name ||
            "",

          code:
            center.code ||
            "",

          shortCode:
            center.shortCode ||
            "",

          country:
            center.country ||
            "España",

          property:
            center.property ||
            "",

          manager:
            center.manager ||
            "",

          stl:
            center.stl ||
            "",

          status:
            center.status ||
            "Activo",
        });
      }
    );

    /*
     * -------------------------------------------------------
     * FILTROS
     * -------------------------------------------------------
     */

    const filtered =
      arr.filter((c) => {
        const matchesCountry =
          effectiveCountry ===
            "Todos" ||
          c.country ===
            effectiveCountry;

        const searchText =
          `${c.name} ${c.code} ${
            c.shortCode || ""
          } ${c.property || ""} ${
            c.manager || ""
          }`.toLowerCase();

        const matchesSearch =
          searchText.includes(
            q.toLowerCase()
          );

        return (
          matchesCountry &&
          matchesSearch
        );
      });

    /*
     * -------------------------------------------------------
     * ORDENACIÓN
     * -------------------------------------------------------
     */

    return [...filtered].sort(
      (a, b) => {
        const valueA =
          String(
            a[sort.key] ?? ""
          );

        const valueB =
          String(
            b[sort.key] ?? ""
          );

        return (
          valueA.localeCompare(
            valueB,
            "es",
            {
              numeric: true,
              sensitivity: "base",
            }
          ) *
          (sort.dir === "asc"
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
  ]);

  /* =======================================================
   * ORDENACIÓN
   * ======================================================= */

  function toggle(key: SortKey) {
    setSort((current) => ({
      key,

      dir:
        current.key === key &&
        current.dir === "asc"
          ? "desc"
          : "asc",
    }));
  }

  /* =======================================================
   * ACTUALIZAR FORMULARIO
   * ======================================================= */

  function updateNewCenter<
    K extends keyof NewCenterForm
  >(
    field: K,
    value: NewCenterForm[K]
  ) {
    setNewCenter((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /* =======================================================
   * SELECCIONAR IMAGEN
   * ======================================================= */

  function handleImageChange(
    file: File | null,
    type: "image" | "logo"
  ) {
    setError("");

    if (!file) {
      return;
    }

    const validationError =
      validateImageFile(
        file,
        {
          maxSizeMB: 10,
        }
      );

    if (validationError) {
      setError(validationError);
      return;
    }

    const preview =
      URL.createObjectURL(file);

    if (type === "image") {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      setImageFile(file);
      setImagePreview(preview);
    } else {
      if (logoPreview) {
        URL.revokeObjectURL(
          logoPreview
        );
      }

      setLogoFile(file);
      setLogoPreview(preview);
    }
  }

  /* =======================================================
   * GENERAR ID INTERNO
   * ======================================================= */

  function generateCenterId() {
    return (
      `center-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
    );
  }

  /* =======================================================
   * CREAR CENTRO
   * ======================================================= */

  async function createCenter() {
    if (saving) {
      return;
    }

    setError("");

    if (!newCenter.name.trim()) {
      setError(
        "El nombre del centro es obligatorio."
      );
      return;
    }

    if (!newCenter.code.trim()) {
      setError(
        "El número de centro es obligatorio."
      );
      return;
    }

    if (!newCenter.country) {
      setError(
        "El país del centro es obligatorio."
      );
      return;
    }

    /* -----------------------------------------------------
     * Evitar duplicar número oficial
     * ----------------------------------------------------- */

    const normalizedCode =
      newCenter.code
        .trim()
        .toLowerCase();

    const existingCode =
      demo.centers.some(
        (center) =>
          String(center.code)
            .trim()
            .toLowerCase() ===
          normalizedCode
      );

    const savedCode =
      Object.values(
        state.centers || {}
      ).some(
        (center) =>
          String(center.code || "")
            .trim()
            .toLowerCase() ===
          normalizedCode
      );

    if (existingCode || savedCode) {
      setError(
        "Ya existe un centro con ese número de centro."
      );
      return;
    }

    /* -----------------------------------------------------
     * STL AUTOMÁTICO SEGÚN PAÍS
     *
     * España  → STL_ES_2026_V1
     * Portugal → STL_PT_2026_V1
     * ----------------------------------------------------- */

    const stl =
      newCenter.country ===
      "España"
        ? "STL_ES_2026_V1"
        : "STL_PT_2026_V1";

    /* -----------------------------------------------------
     * TODOS LOS CENTROS NUEVOS SE CREAN ACTIVOS
     * ----------------------------------------------------- */

    const status = "Activo";

    /* -----------------------------------------------------
     * ID INTERNO
     * ----------------------------------------------------- */

    const id =
      generateCenterId();

    setSaving(true);

    try {
      /* ---------------------------------------------------
       * GUARDAR IMAGEN
       *
       * Las imágenes se almacenan en IndexedDB.
       *
       * Solo guardamos en v1-state la referencia.
       * --------------------------------------------------- */

      let imageReference:
        | string
        | undefined;

      let logoReference:
        | string
        | undefined;

      if (imageFile) {
        imageReference =
          await saveCenterImage(
            id,
            "image",
            imageFile
          );
      }

      if (logoFile) {
        logoReference =
          await saveCenterImage(
            id,
            "logo",
            logoFile
          );
      }

      /* ---------------------------------------------------
       * OVERRIDE PERSISTIDO
       * --------------------------------------------------- */

      const override: CenterOverride = {
        id,

        name:
          newCenter.name.trim(),

        code:
          newCenter.code.trim(),

        shortCode:
          newCenter.shortCode.trim(),

        address:
          newCenter.address.trim(),

        country:
          newCenter.country,

        city:
          newCenter.city.trim(),

        province:
          newCenter.province.trim(),

        stl,

        status,

        property:
          newCenter.property.trim(),

        manager:
          newCenter.manager.trim(),

        managerPhone:
          newCenter.managerPhone.trim(),

        managerEmail:
          newCenter.managerEmail.trim(),

        technicalResponsible:
          newCenter.technicalResponsible.trim(),

        technicalResponsiblePhone:
          newCenter.technicalResponsiblePhone.trim(),

        technicalResponsibleEmail:
          newCenter.technicalResponsibleEmail.trim(),

        /*
         * IMPORTANTE:
         *
         * Aquí NO guardamos Base64.
         *
         * Guardamos únicamente la referencia
         * de IndexedDB.
         */
        ...(imageReference
          ? {
              imageUrl:
                imageReference,
            }
          : {}),

        ...(logoReference
          ? {
              logoUrl:
                logoReference,
            }
          : {}),
      };

      /* ---------------------------------------------------
       * GUARDAR CENTRO
       * --------------------------------------------------- */

      const nextState: V1State = {
        ...state,

        centers: {
          ...state.centers,
          [id]: override,
        },

        activeItems: {
          ...state.activeItems,
          [id]: {},
        },
      };

      saveState(nextState);

      /* ---------------------------------------------------
       * LIMPIAR PREVISUALIZACIONES
       * --------------------------------------------------- */

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      if (logoPreview) {
        URL.revokeObjectURL(
          logoPreview
        );
      }

      setImageFile(null);
      setLogoFile(null);

      setImagePreview(null);
      setLogoPreview(null);

      setShowNewCenter(false);

      setNewCenter({
        ...EMPTY_FORM,
        country:
          userCountry ||
          "España",
      });

      /* ---------------------------------------------------
       * ABRIR FICHA
       * --------------------------------------------------- */

      window.location.href =
        `/centers/${encodeURIComponent(
          id
        )}`;
    } catch (saveError) {
      console.error(
        "Error al crear el centro:",
        saveError
      );

      setError(
        "No se ha podido crear el centro. " +
        "Comprueba que las imágenes sean válidas e inténtalo de nuevo."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
   * ABRIR MODAL NUEVO CENTRO
   * ======================================================= */

  function openNewCenter() {
    setError("");

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    if (logoPreview) {
      URL.revokeObjectURL(
        logoPreview
      );
    }

    setImageFile(null);
    setLogoFile(null);

    setImagePreview(null);
    setLogoPreview(null);

    setNewCenter({
      ...EMPTY_FORM,

      country:
        userCountry ||
        "España",
    });

    setShowNewCenter(true);
  }

  /* =======================================================
   * CERRAR MODAL
   * ======================================================= */

  function closeNewCenter() {
    if (saving) {
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    if (logoPreview) {
      URL.revokeObjectURL(
        logoPreview
      );
    }

    setImageFile(null);
    setLogoFile(null);

    setImagePreview(null);
    setLogoPreview(null);

    setError("");

    setShowNewCenter(false);
  }

  /* =======================================================
   * CABECERA ORDENABLE
   * ======================================================= */

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

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="space-y-6">

      <SectionTitle
        title="Gestión de centros comerciales"
        subtitle={`${list.length} centros`}
        action={
          <Button
            type="button"
            onClick={openNewCenter}
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Nuevo centro
          </Button>
        }
      />

      {/* ===================================================
       * FILTROS
       * =================================================== */}

      <Card className="p-4">

        <div className="flex flex-col gap-3 md:flex-row">

          <div className="relative flex-1">

            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
              placeholder="Buscar por centro, código, abreviatura, propiedad o responsable..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />

          </div>

          {role === "ADMIN" && (
            <Select
              value={country}
              onChange={(value) =>
                setCountry(
                  value as
                    | "Todos"
                    | V1Country
                )
              }
            >
              {availableCountries.map(
                (item) => (
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

          {role !== "ADMIN" &&
            userCountry && (
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold">
                {userCountry}
              </div>
            )}

        </div>

      </Card>

      {/* ===================================================
       * TABLA
       * =================================================== */}

      <div className="table-wrap">

        <table className="table">

          <thead>
            <tr>
              {th("code", "Nº")}

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

            {list.map((c) => (

              <tr
                key={c.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() =>
                  (
                    window.location.href =
                      `/centers/${encodeURIComponent(
                        c.id
                      )}`
                  )
                }
              >

                <td className="font-mono text-xs">
                  {c.code}
                </td>

                <td>

                  <Link
                    href={`/centers/${encodeURIComponent(
                      c.id
                    )}`}
                    className="block"
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  >
                    <div className="font-bold">
                      {c.name}
                    </div>
                  </Link>

                </td>

                <td className="font-mono text-xs">
                  {c.shortCode ||
                    "—"}
                </td>

                <td>
                  {c.country}
                </td>

                <td>
                  {c.property ||
                    "—"}
                </td>

                <td>
                  {c.manager ||
                    "Sin asignar"}
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
                    {c.stl ||
                      "—"}
                  </Badge>

                </td>

                <td>

                  <Badge
                    tone={
                      c.status ===
                      "Activo"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {c.status ||
                      "—"}
                  </Badge>

                </td>

              </tr>

            ))}

            {list.length === 0 && (
              <tr>

                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-sm text-slate-400"
                >
                  No hay centros que
                  coincidan con la
                  búsqueda.
                </td>

              </tr>
            )}

          </tbody>

        </table>

      </div>

      {/* ===================================================
       * MODAL NUEVO CENTRO
       * =================================================== */}

      {showNewCenter && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* ------------------------------------------------
             * CABECERA MODAL
             * ------------------------------------------------ */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Nuevo centro
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Introduce todos los datos necesarios para definir el centro.
                </p>

              </div>

              <button
                type="button"
                onClick={closeNewCenter}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <div className="space-y-6 p-6">

              {/* ------------------------------------------------
               * ERROR
               * ------------------------------------------------ */}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* =================================================
               * IDENTIFICACIÓN
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Identificación del centro
                </h3>

                <div className="grid gap-4 md:grid-cols-3">

                  <Field
                    label="Nº de centro"
                    required
                    value={
                      newCenter.code
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "code",
                        value
                      )
                    }
                  />

                  <Field
                    label="Nombre del centro"
                    required
                    value={
                      newCenter.name
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "name",
                        value
                      )
                    }
                  />

                  <Field
                    label="Código / abreviatura"
                    value={
                      newCenter.shortCode
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "shortCode",
                        value
                      )
                    }
                  />

                </div>

              </section>

              {/* =================================================
               * LOCALIZACIÓN
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Localización
                </h3>

                <div className="grid gap-4 md:grid-cols-3">

                  <div>

                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      País *
                    </label>

                    <select
                      value={
                        newCenter.country
                      }
                      onChange={(e) =>
                        updateNewCenter(
                          "country",
                          e.target
                            .value as V1Country
                        )
                      }
                      disabled={saving}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
                    >

                      <option value="España">
                        España
                      </option>

                      <option value="Portugal">
                        Portugal
                      </option>

                    </select>

                  </div>

                  <Field
                    label="Ciudad"
                    value={
                      newCenter.city
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "city",
                        value
                      )
                    }
                  />

                  <Field
                    label="Provincia"
                    value={
                      newCenter.province
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "province",
                        value
                      )
                    }
                  />

                  <div className="md:col-span-3">

                    <Field
                      label="Dirección"
                      value={
                        newCenter.address
                      }
                      onChange={(value) =>
                        updateNewCenter(
                          "address",
                          value
                        )
                      }
                    />

                  </div>

                </div>

              </section>

              {/* =================================================
               * DATOS DE GESTIÓN
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Datos de gestión
                </h3>

                <div className="grid gap-4 md:grid-cols-3">

                  <Field
                    label="Propiedad"
                    value={
                      newCenter.property
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "property",
                        value
                      )
                    }
                  />

                  {/* ---------------------------------------------
                   * STL AUTOMÁTICO
                   * --------------------------------------------- */}

                  <div>

                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      STL
                    </label>

                    <div className="flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      {newCenter.country ===
                      "España"
                        ? "STL_ES_2026_V1"
                        : "STL_PT_2026_V1"}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Se asigna automáticamente según el país.
                    </p>

                  </div>

                  {/* ---------------------------------------------
                   * ESTADO AUTOMÁTICO
                   * --------------------------------------------- */}

                  <div>

                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Estado
                    </label>

                    <div className="flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-green-700">
                      Activo
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Los centros nuevos se crean activos.
                    </p>

                  </div>

                </div>

              </section>

              {/* =================================================
               * RESPONSABLE DE GESTIÓN
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Responsable de gestión
                </h3>

                <div className="grid gap-4 md:grid-cols-3">

                  <Field
                    label="Responsable"
                    value={
                      newCenter.manager
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "manager",
                        value
                      )
                    }
                  />

                  <Field
                    label="Teléfono"
                    value={
                      newCenter.managerPhone
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "managerPhone",
                        value
                      )
                    }
                  />

                  <Field
                    label="Email"
                    type="email"
                    value={
                      newCenter.managerEmail
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "managerEmail",
                        value
                      )
                    }
                  />

                </div>

              </section>

              {/* =================================================
               * RESPONSABLE TÉCNICO
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Responsable técnico
                </h3>

                <div className="grid gap-4 md:grid-cols-3">

                  <Field
                    label="Responsable técnico"
                    value={
                      newCenter.technicalResponsible
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "technicalResponsible",
                        value
                      )
                    }
                  />

                  <Field
                    label="Teléfono"
                    value={
                      newCenter.technicalResponsiblePhone
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "technicalResponsiblePhone",
                        value
                      )
                    }
                  />

                  <Field
                    label="Email"
                    type="email"
                    value={
                      newCenter.technicalResponsibleEmail
                    }
                    onChange={(value) =>
                      updateNewCenter(
                        "technicalResponsibleEmail",
                        value
                      )
                    }
                  />

                </div>

              </section>

              {/* =================================================
               * IMAGEN Y LOGOTIPO
               * ================================================= */}

              <section>

                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Imagen y logotipo
                </h3>

                <div className="grid gap-6 md:grid-cols-2">

                  {/* ---------------------------------------------
                   * IMAGEN DEL CENTRO
                   * --------------------------------------------- */}

                  <ImageUploadField
                    label="Imagen del centro"
                    file={imageFile}
                    preview={imagePreview}
                    onChange={(file) =>
                      handleImageChange(
                        file,
                        "image"
                      )
                    }
                    disabled={saving}
                  />

                  {/* ---------------------------------------------
                   * LOGOTIPO
                   * --------------------------------------------- */}

                  <ImageUploadField
                    label="Logotipo"
                    file={logoFile}
                    preview={logoPreview}
                    onChange={(file) =>
                      handleImageChange(
                        file,
                        "logo"
                      )
                    }
                    disabled={saving}
                  />

                </div>

              </section>

            </div>

            {/* =================================================
             * BOTONES
             * ================================================= */}

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-white px-6 py-4">

              <Button
                type="button"
                onClick={closeNewCenter}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={
                  createCenter
                }
                disabled={saving}
              >
                <Plus className="mr-2 h-4 w-4" />

                {saving
                  ? "Creando centro..."
                  : "Crear centro"}
              </Button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

/* =========================================================
 * COMPONENTE FIELD
 * ========================================================= */

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>

      <label className="mb-1 block text-sm font-semibold text-slate-700">

        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}

      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      />

    </div>
  );
}

/* =========================================================
 * COMPONENTE CARGA DE IMAGEN
 * ========================================================= */

function ImageUploadField({
  label,
  file,
  preview,
  onChange,
  disabled = false,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onChange: (
    file: File | null
  ) => void;
  disabled?: boolean;
}) {
  return (
    <div>

      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        id={`file-${label
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file =
            e.target.files?.[0] ||
            null;

          onChange(file);

          /*
           * Permitimos volver a seleccionar el mismo
           * archivo posteriormente.
           */
          e.target.value = "";
        }}
      />

      <label
        htmlFor={`file-${label
          .toLowerCase()
          .replace(/\s+/g, "-")}`}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-slate-400 hover:bg-slate-100 ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : ""
        }`}
      >

        {preview ? (
          <div className="flex w-full flex-col items-center gap-3">

            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">

              <img
                src={preview}
                alt={`Vista previa de ${label}`}
                className="max-h-full max-w-full object-contain"
              />

            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">

              <Upload className="h-4 w-4" />

              Cambiar imagen

            </div>

            <p className="max-w-full truncate text-xs text-slate-400">
              {file?.name}
            </p>

          </div>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">

              <ImageIcon className="h-6 w-6 text-slate-400" />

            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">

              <Upload className="h-4 w-4" />

              Cargar {label.toLowerCase()}

            </div>

            <p className="mt-2 text-xs text-slate-400">
              JPG, PNG, WEBP o GIF · Máximo 10 MB
            </p>
          </>
        )}

      </label>

    </div>
  );
}
