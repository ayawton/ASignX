import { AsyncLocalStorage } from 'node:async_hooks';
import type { Sql } from 'postgres';

export const guestConnection = new AsyncLocalStorage<{ id: string; sql: Sql }>();

// Only learner routes use this connection. Admin and catalog routes always use Postgres.
export function learnerConnection(persistent: Sql): Sql {
    return new Proxy(persistent, {
        apply(target, receiver, args) {
            return Reflect.apply(guestConnection.getStore()?.sql ?? target, receiver, args);
        },
        get(target, key) {
            const connection = guestConnection.getStore()?.sql ?? target;
            const value = Reflect.get(connection, key);
            return typeof value === 'function' ? value.bind(connection) : value;
        },
    });
}
