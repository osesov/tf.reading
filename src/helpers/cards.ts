
import tf from '@tensorflow/tfjs'
import { EventEmitter } from './EventEmitter';

export type CardKey = number;
export interface CardData
{
    readonly name: string
    readonly trainingDataInputs: tf.Tensor[]
}

export interface CardChangeEvent
{
    key: CardKey
}

export interface CardEventMap
{
    'addCard': CardChangeEvent
    'changeCard': CardChangeEvent
    'deleteCard': CardChangeEvent
    'reset': {}
}

export type CardEventTag = keyof CardEventMap;

export interface CardDataSet extends EventEmitter<CardEventMap>
{
    readonly length: number;
    readonly nextId: number;
    readonly empty: boolean;
    readonly ready: Promise<void>

    keys(): IterableIterator<CardKey>;
    values(): IterableIterator<CardData>;
    entries(): IterableIterator<[CardKey, CardData]>;

    addCard(key: CardKey, name: string): void
    setTrainingInputs(key: CardKey, data: readonly tf.Tensor[]): void;

    getCard(key: CardKey): CardData | null
    removeCard(key: CardKey): void

    clear(): void

    forEach(cb: (key: CardKey, value: CardData) => void): void
    map<T>(cb: (key: CardKey, value: CardData) => T): T[]

    getRandom(): CardKey;

    saveModel(model: tf.LayersModel): Promise<void>
    loadModel(): Promise<tf.LayersModel>
}
