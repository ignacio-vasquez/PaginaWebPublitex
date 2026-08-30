export function createRequestState() {
  return { requests: [], activeId: null };
}

export function addRequest(state, values, { id, createdAt }) {
  const request = { ...values, id, createdAt };
  return { requests: [...state.requests, request], activeId: id };
}

export function selectRequest(state, id) {
  return state.requests.some((request) => request.id === id)
    ? { ...state, activeId: id }
    : state;
}

export function getActiveRequest(state) {
  return state.requests.find((request) => request.id === state.activeId) ?? null;
}

export function getOtherRequests(state) {
  return state.requests
    .filter((request) => request.id !== state.activeId)
    .reverse();
}

export function updateRequest(state, id, values) {
  const oldRequest = state.requests.find((request) => request.id === id);
  if (!oldRequest) return state;

  return {
    requests: state.requests.map((request) => request.id === id
      ? { ...oldRequest, ...values, id: oldRequest.id, createdAt: oldRequest.createdAt }
      : request),
    activeId: id,
  };
}

export function removeRequest(state, id) {
  if (!state.requests.find((request) => request.id === id)) return state;

  const remaining = state.requests.filter((request) => request.id !== id);
  return {
    requests: remaining,
    activeId: state.activeId === id ? remaining.at(-1)?.id ?? null : state.activeId,
  };
}
