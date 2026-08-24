"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ArrowUpDown,
} from "lucide-react";

import { demo } from "@/lib/data";

import {
  loadState,
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

type CenterOverride = {
  name?: string;
  property?: string;
  manager?: string;
};

type CenterListItem = {
  id: string;
  name: string;
  code: string | number;
  shortCode?: string;
  country: V1Country;
  property?: string;
  manager?: string;
  stl?: string;
  status?: string;
};

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

  /*
   * Cargamos el estado guardado para poder
   * mostrar en el listado las modificaciones
   * realizadas desde la ficha de cada centro.
   *
   * Entre ellas:
   * - nombre completo
   * - propiedad
   * - responsable
   *
   * El resto de información continúa procediendo
   * de demo.centers.
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

  /*
   * Construimos la lista aplicando los valores
   * modificados en la ficha del centro.
   *
   * IMPORTANTE:
   *
   * c.code NO se modifica.
   *
   * El número de centro es el número real
   * definido para cada centro.
   */
  const list = useMemo(() => {
    const arr: CenterListItem[] =
      demo.centers
        .map((c) => {
          const overrides =
            (state.centers[c.id] ||
              {}) as CenterOverride;

          return {
            ...c,

            /*
             * Si el nombre ha sido modificado
             * desde la ficha, utilizamos ese nombre.
             */
            name:
              overrides.name ??
              c.name,

            /*
             * Propiedad y responsable también
             * respetan las modificaciones guardadas.
             */
            property:
              overrides.property ??
              c.property,

            manager:
              overrides.manager ??
              c.manager,
          };
        })
        .filter(
          (c) =>
            (
              effectiveCountry === "Todos" ||
              c.country === effectiveCountry
            ) &&
            `${c.name} ${c.code} ${
              c.shortCode || ""
            } ${c.property || ""} ${
              c.manager || ""
            }`
              .toLowerCase()
              .includes(
                q.toLowerCase()
              )
        );

    return [...arr].sort(
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

  function toggle(
    key: SortKey
  ) {
    setSort((current) => ({
      key,
      dir:
        current.key === key &&
        current.dir === "asc"
          ? "desc"
          : "asc",
    }));
  }

  /*
   * Cabecera ordenable.
   *
   * Todas las columnas mantienen la posibilidad
   * de ordenar ascendente / descendente.
   */
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
        subtitle={`${list.length} centros · datos reales iniciales`}
        action={
          <Button>
            <Plus className="mr-2 inline h-4 w-4" />
            Nuevo centro
          </Button>
        }
      />

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

      <div className="table-wrap">

        <table className="table">

          <thead>
            <tr>
              {th("code", "Nº")}
              {th("name", "Centro")}
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
              {th("stl", "STL")}
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
                    {c.stl}
                  </Badge>

                </td>

                <td>

                  <Badge tone="success">
                    {c.status}
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

    </div>
  );
}
