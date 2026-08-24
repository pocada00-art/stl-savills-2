/* =========================================================
 * ALMACENAMIENTO DE IMÁGENES
 * =========================================================
 *
 * Las imágenes NO se almacenan en localStorage.
 *
 * localStorage:
 *   - datos de los centros
 *   - configuración
 *   - referencias a imágenes
 *
 * IndexedDB:
 *   - archivos de imagen
 *
 * Esto evita que imágenes grandes consuman el límite de
 * localStorage.
 * ========================================================= */

const DB_NAME = "technical-management-db";
const DB_VERSION = 1;
const STORE_NAME = "images";

/* =========================================================
 * TIPOS
 * ========================================================= */

export type ImageType = "image" | "logo";

export type StoredImageReference = string;

/* =========================================================
 * ABRIR BASE DE DATOS
 * ========================================================= */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(
        new Error(
          "IndexedDB solo está disponible en el navegador."
        )
      );

      return;
    }

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            "No se pudo abrir la base de datos de imágenes."
          )
      );
    };

    request.onupgradeneeded = () => {
      const database =
        request.result;

      if (
        !database.objectStoreNames.contains(
          STORE_NAME
        )
      ) {
        database.createObjectStore(
          STORE_NAME
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/* =========================================================
 * GENERAR REFERENCIA
 * ========================================================= */

export function getImageReference(
  centerId: string,
  type: ImageType
): StoredImageReference {
  return `indexeddb://center/${encodeURIComponent(
    centerId
  )}/${type}`;
}

/* =========================================================
 * GUARDAR IMAGEN
 * =========================================================
 *
 * Recibe un File procedente del selector de archivos
 * del navegador y lo almacena directamente en IndexedDB.
 *
 * No convierte el archivo a Base64.
 * ========================================================= */

export async function saveCenterImage(
  centerId: string,
  type: ImageType,
  file: File
): Promise<StoredImageReference> {
  const database =
    await openDatabase();

  const reference =
    getImageReference(
      centerId,
      type
    );

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_NAME
        );

      const request =
        store.put(
          {
            file,
            name: file.name,
            type: file.type,
            size: file.size,
            updatedAt:
              Date.now(),
          },
          reference
        );

      request.onerror = () => {
        reject(
          request.error ||
            new Error(
              "No se pudo guardar la imagen."
            )
        );
      };

      request.onsuccess = () => {
        resolve(reference);
      };

      transaction.oncomplete = () => {
        database.close();
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error(
              "Error al guardar la imagen."
            )
        );
      };
    }
  );
}

/* =========================================================
 * RECUPERAR IMAGEN
 * =========================================================
 *
 * Devuelve un Blob URL que puede utilizarse directamente
 * en:
 *
 * <img src={url} />
 *
 * IMPORTANTE:
 * El componente que utilice esta URL debe llamar después
 * a URL.revokeObjectURL(url) cuando deje de necesitarla.
 * ========================================================= */

export async function loadCenterImage(
  reference:
    | StoredImageReference
    | null
    | undefined
): Promise<string | null> {
  if (
    !reference ||
    !reference.startsWith(
      "indexeddb://"
    )
  ) {
    return null;
  }

  const database =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readonly"
        );

      const store =
        transaction.objectStore(
          STORE_NAME
        );

      const request =
        store.get(reference);

      request.onerror = () => {
        database.close();

        reject(
          request.error ||
            new Error(
              "No se pudo recuperar la imagen."
            )
        );
      };

      request.onsuccess = () => {
        const record =
          request.result;

        if (
          !record ||
          !record.file
        ) {
          database.close();
          resolve(null);
          return;
        }

        try {
          const url =
            URL.createObjectURL(
              record.file
            );

          database.close();

          resolve(url);
        } catch (error) {
          database.close();
          reject(error);
        }
      };
    }
  );
}

/* =========================================================
 * ELIMINAR IMAGEN
 * ========================================================= */

export async function deleteCenterImage(
  centerId: string,
  type: ImageType
): Promise<void> {
  const database =
    await openDatabase();

  const reference =
    getImageReference(
      centerId,
      type
    );

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          STORE_NAME
        );

      const request =
        store.delete(reference);

      request.onerror = () => {
        database.close();

        reject(
          request.error ||
            new Error(
              "No se pudo eliminar la imagen."
            )
        );
      };

      request.onsuccess = () => {
        resolve();
      };

      transaction.oncomplete = () => {
        database.close();
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error(
              "Error al eliminar la imagen."
            )
        );
      };
    }
  );
}

/* =========================================================
 * ELIMINAR TODAS LAS IMÁGENES DE UN CENTRO
 * ========================================================= */

export async function deleteCenterImages(
  centerId: string
): Promise<void> {
  await Promise.all([
    deleteCenterImage(
      centerId,
      "image"
    ),
    deleteCenterImage(
      centerId,
      "logo"
    ),
  ]);
}

/* =========================================================
 * VALIDACIÓN DE ARCHIVO
 * ========================================================= */

export function validateImageFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): string | null {
  const maxSizeMB =
    options?.maxSizeMB ?? 10;

  const allowedTypes =
    options?.allowedTypes ?? [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    return (
      "El archivo seleccionado no es una imagen válida. " +
      "Utiliza JPG, PNG, WEBP o GIF."
    );
  }

  const maxBytes =
    maxSizeMB *
    1024 *
    1024;

  if (file.size > maxBytes) {
    return (
      `La imagen no puede superar los ${maxSizeMB} MB.`
    );
  }

  return null;
}
