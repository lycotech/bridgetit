import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { submitRegistration, type RegistrationResult, type Segment } from "@/lib/registrations";

/**
 * Shared submission plumbing for the four registration forms.
 *
 * Holds the mount time so the server can be told how long the form was on
 * screen. That number is one of the bot signals: a genuine person cannot read
 * and complete a fifteen-field employer form in under two seconds. It is
 * measured from mount rather than from first keystroke so an automated fill
 * cannot avoid it by typing slowly into one field.
 */
export function useRegistrationForm<T extends Record<string, unknown>>(segment: Segment) {
  const mountedAt = useRef(Date.now());
  const startedRef = useRef(false);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("registration_start", { segment });
  };

  const mutation = useMutation<RegistrationResult, unknown, T>({
    mutationFn: (values: T) => submitRegistration(segment, values, Date.now() - mountedAt.current),
    onSuccess: () => track("registration_success", { segment }),
    onError: () => track("form_error", { segment, stage: "submit" }),
  });

  const onInvalid = () => track("form_error", { segment, stage: "validation" });

  return { mutation, markStarted, onInvalid };
}
