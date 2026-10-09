"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "./api";
import { queryKeys } from "./queries";

/**
 * Invite-link pages: a browser with no session (e.g. a phone opening the
 * link) joins as a guest instead of silently becoming the default user.
 * Returns true once settled; don't load the profile before that, or the
 * default-user fallback would sign this browser in first.
 */
export function useGuestEntry(enabled = true): boolean {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    api
      .continueAsGuest()
      .catch(() => undefined) // offline etc.: the join check reports real problems
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.me });
        setReady(true);
      });
  }, [enabled, queryClient]);
  return ready;
}
