const test = require('node:test');
const assert = require('node:assert/strict');

const firstValues = {
  nombre: 'Ana', empresa: 'Taller Sur', telefono: '+56 9 1111 1111',
  correo: 'ana@example.com', servicio: 'letrero',
  descripcion: 'Letrero luminoso para la fachada principal.', consentimiento: true,
};

test('añade solicitudes sin reemplazar las anteriores y activa la nueva', async () => {
  const { createRequestState, addRequest } = await import('../js/solicitudes.js');
  let state = addRequest(createRequestState(), firstValues, { id: 'q-1', createdAt: '2026-08-30T10:00:00.000Z' });
  const previous = state;
  state = addRequest(state, { ...firstValues, nombre: 'Beto' }, { id: 'q-2', createdAt: '2026-08-30T11:00:00.000Z' });
  assert.equal(previous.requests.length, 1);
  assert.deepEqual(state.requests.map(({ id }) => id), ['q-1', 'q-2']);
  assert.equal(state.activeId, 'q-2');
});

test('selecciona una solicitud existente sin cambiar la colección', async () => {
  const { createRequestState, addRequest, selectRequest } = await import('../js/solicitudes.js');
  const state = addRequest(
    addRequest(createRequestState(), firstValues, { id: 'q-1', createdAt: '2026-08-30T10:00:00.000Z' }),
    { ...firstValues, nombre: 'Beto' },
    { id: 'q-2', createdAt: '2026-08-30T11:00:00.000Z' },
  );

  const selected = selectRequest(state, 'q-1');

  assert.notEqual(selected, state);
  assert.equal(selected.requests, state.requests);
  assert.equal(selected.activeId, 'q-1');
  assert.equal(selectRequest(state, 'unknown'), state);
});

function addTwoRequests(createRequestState, addRequest) {
  const first = addRequest(
    createRequestState(),
    firstValues,
    { id: 'q-1', createdAt: '2026-08-30T10:00:00.000Z' },
  );
  return addRequest(
    first,
    { ...firstValues, nombre: 'Beto' },
    { id: 'q-2', createdAt: '2026-08-30T11:00:00.000Z' },
  );
}

test('obtiene la solicitud activa o null cuando no hay selección', async () => {
  const { createRequestState, addRequest, selectRequest, getActiveRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);

  assert.equal(getActiveRequest(state), state.requests[1]);
  assert.equal(getActiveRequest(selectRequest(state, 'q-1')), state.requests[0]);
  assert.equal(getActiveRequest(createRequestState()), null);
});

test('obtiene las otras solicitudes de la más reciente a la más antigua', async () => {
  const { createRequestState, addRequest, selectRequest, getOtherRequests } = await import('../js/solicitudes.js');
  const withTwo = addTwoRequests(createRequestState, addRequest);
  const state = addRequest(
    selectRequest(withTwo, 'q-1'),
    { ...firstValues, nombre: 'Carla' },
    { id: 'q-3', createdAt: '2026-08-30T12:00:00.000Z' },
  );
  const selected = selectRequest(state, 'q-1');

  assert.deepEqual(getOtherRequests(selected).map(({ id }) => id), ['q-3', 'q-2']);
});

test('actualiza los valores de una solicitud y conserva sus metadatos', async () => {
  const { createRequestState, addRequest, updateRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);
  const updated = updateRequest(state, 'q-1', { nombre: 'Alicia', servicio: 'vehiculo' });

  assert.notEqual(updated, state);
  assert.equal(updated.activeId, 'q-1');
  assert.deepEqual(updated.requests[0], {
    ...firstValues,
    nombre: 'Alicia',
    servicio: 'vehiculo',
    id: 'q-1',
    createdAt: '2026-08-30T10:00:00.000Z',
  });
  assert.equal(updated.requests[1], state.requests[1]);
  assert.equal(state.requests[0].nombre, 'Ana');
});

test('conserva la referencia al actualizar una solicitud inexistente', async () => {
  const { createRequestState, addRequest, updateRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);

  assert.equal(updateRequest(state, 'unknown', { nombre: 'Alicia' }), state);
});

test('elimina una solicitud no activa sin cambiar la activa', async () => {
  const { createRequestState, addRequest, removeRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);
  const remaining = removeRequest(state, 'q-1');

  assert.deepEqual(remaining.requests.map(({ id }) => id), ['q-2']);
  assert.equal(remaining.activeId, 'q-2');
});

test('al eliminar la solicitud activa selecciona la más reciente restante', async () => {
  const { createRequestState, addRequest, removeRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);
  const remaining = removeRequest(state, 'q-2');

  assert.deepEqual(remaining.requests.map(({ id }) => id), ['q-1']);
  assert.equal(remaining.activeId, 'q-1');
});

test('al eliminar la última solicitud restablece el estado vacío', async () => {
  const { createRequestState, addRequest, removeRequest } = await import('../js/solicitudes.js');
  const state = addRequest(
    createRequestState(),
    firstValues,
    { id: 'q-1', createdAt: '2026-08-30T10:00:00.000Z' },
  );

  assert.deepEqual(removeRequest(state, 'q-1'), { requests: [], activeId: null });
});

test('conserva la referencia al eliminar una solicitud inexistente', async () => {
  const { createRequestState, addRequest, removeRequest } = await import('../js/solicitudes.js');
  const state = addTwoRequests(createRequestState, addRequest);

  assert.equal(removeRequest(state, 'unknown'), state);
});
