import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

/**
 * Hook to sync a value with a URL query parameter
 * @param params Configuration object containing parameter name, codec and default value
 * @param params.paramName The name of the query parameter
 * @param params.codec Zod schema for encoding/decoding the parameter value
 * @param params.defaultValue Optional default value if parameter is not present
 * @returns [value, setValue] tuple similar to useState
 */
export function useQueryParam<T>({
  paramName,
  parser,
  defaultValue,
}: {
  paramName: string;
  parser: z.ZodType<T>;
  defaultValue: T;
}): [T, (newValue: T, method?: "push" | "replace") => void] {
  const decodeParam = useCallback(
    (param: string | null): T => {
      if (param === null) return defaultValue;
      try {
        const decoded = atob(param);
        const parsed = JSON.parse(decoded);
        const result = parser.safeParse(parsed);
        return result.success ? result.data : defaultValue;
      } catch {
        return defaultValue;
      }
    },
    [parser, defaultValue]
  );

  const encodeValue = useCallback((value: T): string => {
    const jsonStr = JSON.stringify(value);
    return btoa(jsonStr);
  }, []);

  const [value, setValue] = useState<T>(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get(paramName);
    return decodeParam(param);
  });

  // Update state when URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const param = params.get(paramName);
      setValue(decodeParam(param));
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [paramName, decodeParam]);

  // Update URL when state changes
  const updateValue = useCallback(
    (newValue: T, method: "push" | "replace") => {
      setValue(newValue);
      const params = new URLSearchParams(window.location.search);

      if (newValue === null) {
        params.delete(paramName);
      } else {
        const encoded = encodeValue(newValue);
        params.set(paramName, encoded);
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      switch (method ?? "push") {
        case "push":
          window.history.pushState({}, "", newUrl);
          break;
        case "replace":
          window.history.replaceState({}, "", newUrl);
          break;
      }
    },
    [paramName, encodeValue]
  );

  return [value, updateValue];
}
