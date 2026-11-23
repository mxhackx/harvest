"use client";

import { useEffect, useState } from "react";
import { ApiError, api, type Me } from "./api";

/** Charge /me. `unauthenticated` = pas de session ; `error` = API injoignable. */
export function useMe() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "unauthenticated" } | { status: "error" } | { status: "ready"; me: Me }
  >({ status: "loading" });

  useEffect(() => {
    api<Me>("/me")
      .then((me) => setState({ status: "ready", me }))
      .catch((e) => setState({ status: e instanceof ApiError && e.status === 401 ? "unauthenticated" : "error" }));
  }, []);

  return state;
}
