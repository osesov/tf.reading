import tf from '@tensorflow/tfjs';
import { CardChangeEvent, CardData, CardDataSet, CardEventMap, CardEventTag, CardKey } from "./cards";

const db_name = "learner";
const db_version = 1;
const db_card_store = "cards";

interface CardMapItem {
    name: string
    trainingDataInputs: tf.Tensor[]
}

export class CardDataSetImpl implements CardDataSet {
    private ready_: Promise<void>;
    private db!: IDBDatabase;
    private data_ = new Map<CardKey, CardMapItem>
    private id_: number = 0;

    private listeners: { [k: string]: ((event: any) => void)[] } = {}

    constructor() {
        this.ready_ = new Promise((resolve, reject) => {
            const request = indexedDB.open(db_name, db_version);

            request.onerror = reject;
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => this.createStore(request.result, event)
            request.onsuccess = async (event) => {
                this.db = request.result;
                this.openStore(this.db, resolve, reject)
            };

        })
    }

    private createStore(db: IDBDatabase, event: IDBVersionChangeEvent) {
        const cardStore = db.createObjectStore(db_card_store);
        const transaction = cardStore.transaction;

        transaction.oncomplete = () => {
            console.log("db created");
        };

        // transaction.onerror = (e) => { throw new Error(e)}
    }

    private openStore(db: IDBDatabase, resolve: () => void, reject: (reason: any) => void) {
        const transaction = db.transaction(db_card_store, "readonly");
        const store = transaction.objectStore(db_card_store);

        transaction.oncomplete = resolve;
        transaction.onerror = reject;

        const allKeysRequest = store.getAllKeys();
        allKeysRequest.onerror = reject;
        allKeysRequest.onsuccess = () => {
            const keys = (allKeysRequest.result) as number[];
            const data = Array(keys.length).fill(undefined);

            const range = keys.reduce((range, value) => {
                if (!range.lower || value < range.lower)
                    range = {...range, lower: value };

                if (!range.upper || value > range.upper)
                    range = {...range, upper: value };

                return range;
            }, {lower: undefined as number | undefined, upper: undefined as number | undefined})

            this.id_ = range.upper ?? 0;

            keys.forEach(key => {
                const getDataRequest = store.get(key);
                getDataRequest.onerror = reject;
                getDataRequest.onsuccess = () => {
                    const value = getDataRequest.result;

                    const trainingDataInputs = value.trainingDataInputs.map((e: any) => tf.tensor1d(e))
                    this.data_.set( key, {
                        name: value.name,
                        trainingDataInputs: trainingDataInputs
                    });
                }
            })
        }
    }

    public get ready() {
        return this.ready_;
    }

    ////////////////
    public get length(): number {
        return this.data_.size;
    }

    public keys(): string[] {
        return Object.keys(this.data_);
    }

    public values(): readonly CardData[] {
        return Object.values(this.data_);
    }

    public entries(): ReadonlyArray<[string, CardData]> {
        return Object.entries(this.data_);
    }

    private async mapObjectToDB(data: CardMapItem) {
        const newObject = {
            name: data.name,
            trainingDataInputs: [] as any[]
        }

        for (let i = 0; i < data.trainingDataInputs.length; ++i) {
            const elem = await data.trainingDataInputs[i].array();

            newObject.trainingDataInputs.push(elem as any);
        }

        return newObject;
    }

    private async dbClearData()
    {
        // return this.ready_;

        return this.ready_
            .then(() => new Promise<void>((resolve, reject) => {
                const transaction = this.db.transaction(db_card_store, "readwrite");
                const store = transaction.objectStore(db_card_store);

                const clearRequest = store.clear();

                clearRequest.onerror = reject;
                clearRequest.onsuccess = () => resolve();
            }))
            .then(() =>
                this.dispatchEvent("reset", {})
            );
    }

    private async dbSaveCard(key: CardKey, value: CardMapItem, evname: CardEventTag)
    {
        return this.ready_
            .then(() => this.mapObjectToDB(value))
            .then((dbValue) => new Promise<void>((resolve, reject) => {
                const transaction = this.db.transaction(db_card_store, "readwrite");
                const store = transaction.objectStore(db_card_store);

                const putRequest = store.put(dbValue, key);
                putRequest.onerror = reject;
                putRequest.onsuccess = () => resolve();
            }))
            .then(() =>
                this.dispatchEvent(evname, { key: key })
            );
    }

    private async dbRemoveCard(key: CardKey)
    {
        return this.ready_
            .then(() => new Promise<void>((resolve, reject) => {
                const transaction = this.db.transaction(db_card_store, "readwrite");
                const store = transaction.objectStore(db_card_store);

                const putRequest = store.delete(key);
                putRequest.onerror = reject;
                putRequest.onsuccess = () => resolve();
            }))
            .then(() =>
                this.dispatchEvent('deleteCard', { key: key })
            );
    }

    public addCard(key: CardKey, name: string): Promise<void> {
        const value: CardMapItem = {
            name, trainingDataInputs: []
        };

        const adding = this.data_.has(key) ? 'changeCard' : 'addCard';

        this.data_.set(key, value);
        return this.dbSaveCard(key, value, adding);
    }

    public setTrainingInputs(key: CardKey, data: readonly tf.Tensor[]): Promise<void> {
        const elem = this.data_.get(key);

        if (!elem)
            throw new Error(`Element not found: ${key}`);

        elem.trainingDataInputs = data.slice(0);

        return this.dbSaveCard(key, elem, 'changeCard');
    }

    public getCard(key: CardKey): CardData | null {
        const elem = this.data_.get(key);
        return elem ?? null;
    }

    public removeCard(key: CardKey): Promise<void> {
        const elem = this.data_.get(key);
        if (!elem)
            return Promise.resolve();

        elem.trainingDataInputs.forEach(e => e.dispose());
        this.data_.delete(key);
        return this.dbRemoveCard(key);
    }

    public addEventListener(name: string, fn: (event: CardChangeEvent) => void): void {
        if (!this.listeners[name])
            this.listeners[name] = []
        this.listeners[name].push();
    }

    private dispatchEvent<K extends CardEventTag>(name: CardEventTag, event: CardEventMap[K]) {
        const listeners = this.listeners[name] || [];

        listeners.forEach(e => {
            try {
                e(event)
            }

            catch (reason: any) {
                console.log("Exception in " + name, reason);
            }
        })

    }

    clear(): Promise<void>
    {
        this.data_.forEach( elem => {
            elem.trainingDataInputs.forEach( t => t.dispose() )
            elem.trainingDataInputs.length = 0;
        })

        this.data_.clear();
        return this.dbClearData();
    }

    // extensions
    public forEach(cb: (key: CardKey, value: CardData) => void) {
        this.data_.forEach( (value, key) => cb(key, value) );
    }

    public map<T>(cb: (key: CardKey, value: CardData) => T): T[] {
        const result: T[] = [];
        this.data_.forEach( (value, key) =>
            result.push(cb(key, value))
        );
        return result;
    }

    public get nextId(): CardKey
    {
        return ++this.id_;
    }

    public get empty(): boolean
    {
        return this.data_.size === 0;
    }

}
