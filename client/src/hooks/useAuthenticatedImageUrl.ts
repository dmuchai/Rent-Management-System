import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

const PRIVATE_PROPERTY_IMAGE_PREFIX = "/api/property-images";

export function useAuthenticatedImageUrl(
  source: string | null | undefined,
  fallback: string,
  refreshKey?: unknown,
): string {
  const [resolvedSource, setResolvedSource] = useState(() =>
    source?.startsWith(PRIVATE_PROPERTY_IMAGE_PREFIX) ? fallback : source || fallback,
  );

  useEffect(() => {
    if (!source?.startsWith(PRIVATE_PROPERTY_IMAGE_PREFIX)) {
      setResolvedSource(source || fallback);
      return;
    }

    let disposed = false;
    let objectUrl: string | null = null;
    setResolvedSource(fallback);

    void apiRequest("GET", source)
      .then((response) => response.blob())
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSource(objectUrl);
      })
      .catch(() => {
        if (!disposed) setResolvedSource(fallback);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, fallback, refreshKey]);

  return resolvedSource;
}
