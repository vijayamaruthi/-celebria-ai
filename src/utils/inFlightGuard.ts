/** Small synchronous guard for suppressing duplicate submissions in one component instance. */
export interface InFlightGuardState {
  inFlight: boolean;
}

export function acquireInFlightGuard(state: InFlightGuardState): boolean {
  if (state.inFlight) return false;
  state.inFlight = true;
  return true;
}

export function releaseInFlightGuard(state: InFlightGuardState): void {
  state.inFlight = false;
}
