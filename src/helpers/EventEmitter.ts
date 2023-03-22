
export interface Unsubscribe
{
    unsubscribe: () => void
}

export interface EventEmitter<EventMap>
{
    on<K extends keyof EventMap>(name: K, fn: (event: EventMap[K]) => void, once ?: boolean): Unsubscribe;
    once<K extends keyof EventMap>(name: K, fn: (event: EventMap[K]) => void, once ?: boolean): Unsubscribe;
    dispatchEvent<K extends keyof EventMap>(name: K, event: EventMap[K]): void;
}

export class EventEmitterImpl<EventMap> implements EventEmitter<EventMap>
{
    private listeners = new Map<keyof EventMap, {
        id: number,
        once: boolean,
        fn:(event: any)=>void}[]
        >();
    private id = 0;

    protected haveSubscriber<K extends keyof EventMap>(name: K) {}

    public on<K extends keyof EventMap>(name: K, fn: (event: EventMap[K]) => void, once ?: boolean): Unsubscribe {
        if (!this.listeners.has(name))
            this.listeners.set(name, []);

        const listeners = this.listeners.get(name);
        const id = this.id++;
        listeners?.push({ id, fn, once: once ?? false});

        Promise.resolve().then(() => this.haveSubscriber(name));

        return {
            unsubscribe: () => {
                const index = listeners?.findIndex((e: any) => e.id === id);
                if (index !== undefined && index >= 0)
                    listeners?.splice(index, 1);
            }
        }
    }

    public once<K extends keyof EventMap>(name: K, fn: (event: EventMap[K]) => void, once ?: boolean): Unsubscribe {
        return this.on(name, fn, true);
    }

    public dispatchEvent<K extends keyof EventMap>(name: K, event: EventMap[K]) {
        const listeners = this.listeners.get(name) || [];

        for (let i = listeners.length; i-- > 0; ) {
            const elem = listeners[i];
            if (elem.once)
                listeners.splice(i, 1);
            try {
                elem.fn(event)
            }

            catch (reason: any) {
                console.log(`Exception while handling ${String(name)}`, reason);
            }
        }
    }
}
