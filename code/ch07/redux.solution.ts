export type Action<Type extends string = string, Payload = unknown> = Payload extends undefined
  ? { type: Type }
  : { type: Type; payload: Payload };
export type AnyAction = { type: string; payload?: unknown };
export type Reducer<State, A extends AnyAction = AnyAction> = (state: State, action: A) => State;

export interface Store<State, A extends AnyAction = AnyAction> {
  getState(): State;
  dispatch(action: A): A;
  subscribe(listener: () => void): () => void;
  replaceReducer(next: Reducer<State, A>): void;
}

export function createStore<State, A extends AnyAction>(
  initialReducer: Reducer<State, A>,
  initialState: State,
): Store<State, A> {
  let reducer = initialReducer;
  let state = initialState;
  let dispatching = false;
  let currentListeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch(action) {
      if (dispatching) throw new Error('Reducers may not dispatch actions');
      try {
        dispatching = true;
        state = reducer(state, action);
      } finally {
        dispatching = false;
      }
      for (const listener of [...currentListeners]) listener();
      return action;
    },
    subscribe(listener) {
      currentListeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        currentListeners.delete(listener);
      };
    },
    replaceReducer(next) { reducer = next; },
  };
}

export const exerciseId = '7.1';
