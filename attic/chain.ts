export class CardDB
{
    private ready_ : Promise<void>;
    private db! : IDBDatabase;

    constructor()
    {
        this.ready_ = new Promise( (resolve, failure) => {
            const request = indexedDB.open(db_name, db_version);
            request.onerror = failure;

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => this.onUpdateEnd(request.result, event)
            request.onsuccess = (event) => {
                this.db = request.result;
                resolve();
            };

        });
    }

    private onUpdateEnd(db: IDBDatabase, event: IDBVersionChangeEvent)
    {
        this.db = db;
        const cardStore = db.createObjectStore(db_card_store, { keyPath: "id" });

        cardStore.transaction.oncomplete = () => {
            console.log("db created");
        };
    }

    public async loadData(): Promise<AIElement[]>
    {
        await this.ready_;
        return new Promise( (resolve, reject) => {
            const transaction = this.db.transaction(db_card_store, "readonly");
            const store = transaction.objectStore(db_card_store);

            store.getAll().onsuccess = (event) => {
                const request : IDBRequest<any[]> = event.target as IDBRequest<any[]>;
                resolve(request.result);
            }

            transaction.onerror = reject;
            // transaction.oncomplete = resolve;
        })
    }

    public async saveData(card: AIElement[])
    {
        await this.ready_;
        return new Promise( (resolve, reject) => {
            const transaction = this.db.transaction(db_card_store, "readwrite");
            const store = transaction.objectStore(db_card_store);

            store.clear();
            card.forEach((e, index) => store.add(e, index));
            transaction.onerror = reject;
            transaction.oncomplete = resolve;
        })
    }
}

export interface Chain<EmitType, HandlerType>
{
    then<U>( body: (value: HandlerType) => U): Chain<EmitType, U>
    catch( body: (reason: any) => void): Chain<EmitType, HandlerType>

    emit(value: EmitType): void
    error(reason: any): void
}

class Forwarder<EmitType, HandlerType> implements Chain<EmitType, HandlerType>
{
    private chain: {
        emitValue: (value: HandlerType) => void
        emitError: (reason: any) => void
    }[] = []

    private passValue: (value: EmitType) => void;
    private passError: (reason: any) => void;

    protected constructor(passValue: (value: EmitType) => void, passError: (reason: any) => void)
    {
        this.passValue = passValue;
        this.passError = passError;
    }

    public emit(value: EmitType)
    {
        this.passValue(value);
    }

    error(reason: any): void
    {
        this.passError(reason);
    }

    protected emitValue(value: HandlerType)
    {
        this.chain.forEach( elem => {
            try {
                elem.emitValue(value);
            }
            catch(reason: any) {
                elem.emitError(reason);
            }
        })
    }

    protected emitError(reason: any)
    {
        this.chain.forEach( elem => {
            try {
                elem.emitError(reason);
            } catch (reason: any) {
                elem.emitError(reason);
            }
        })
    }

    then<U>(body: (value: HandlerType) => U): Chain<EmitType, U> {
        const forward = new Forwarder<EmitType,U>(this.passValue, this.passError);

        this.chain.push( {
            emitValue: (value: HandlerType) => {
                try {
                    const result: U = body(value);
                    forward.emitValue(result);
                } catch(e: any) {
                    forward.emitError(e)
                }
            },
            emitError: (reason: any) => forward.emitError(reason)
        })

        return forward;
    }

    catch( body: (reason: any) => void): Chain<EmitType, HandlerType>
    {
        this.chain.push({
            emitValue: () => {},
            emitError: (reason: any) => {
                try {
                    body(reason)
                }
                catch (e: any) {
                    console.log("Exception ", e);
                }
            }
        })
        return this;
    }

}

export class ChainEmitter<T> extends Forwarder<T, T>
{
    public constructor()
    {
        super((value: T) => this.emitValue(value), (reason: any) => this.emitError(reason))
    }
}


........
    ///
    private withTransactionX<T>( mode: IDBTransactionMode, body: Chain<IDBObjectStore, T>): Promise<T> {

        return new Promise( async (resolve, reject) => {
            const transaction = this.db.transaction(db_card_store, mode);

            transaction.oncomplete = () => body.then( (data) => resolve(data));
            transaction.onerror = reject;

            let result = body.emit(transaction.objectStore(db_card_store));
        })
    }

    private async withRequest<T, U>(store: IDBObjectStore, requestor: (store: IDBObjectStore) => IDBRequest<T>, chain: Chain<T, U> ) {
        return new Promise((resolve, reject) => {
            const request = requestor(store);

            request.onsuccess = () => {
                chain.emit(request.result);
                resolve(request.result);
            };

            request.onerror = (e) => chain.error(e);
        });
    }

    public async getKeysX()
    {
        return this.withTransactionX("readonly", (new ChainEmitter<IDBObjectStore>()).then( (store) =>
            this.withRequest( store, () => store.getAllKeys(), new ChainEmitter().then( (data) => ) )
        ));
    }


    private async getAllKeysX(store: IDBObjectStore, callback ?: (keys: IDBValidKey[]) => void ): Promise<IDBValidKey[]>
    {
        return new Promise((resolve, reject) => {
            const request = store.getAllKeys();

            request.onsuccess = () => {
                if (callback)
                    callback(request.result);

                resolve(request.result);
            };

            request.onerror = (e) => { throw request.error; }
        }
    }
