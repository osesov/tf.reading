
import tf from '@tensorflow/tfjs'

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

export interface CardDataSet
{
    readonly length: number;

    keys(): readonly string[];
    values(): readonly CardData[];
    entries(): readonly [string, CardData][]

    addCard(key: CardKey, name: string): void
    setTrainingInputs(key: CardKey, data: readonly tf.Tensor[]): void;

    getCard(key: CardKey): CardData | null
    removeCard(key: CardKey): void

    addEventListener<K extends keyof CardEventMap>(name: K, fn: (event: CardEventMap[K]) => void) : void

    clear(): void

    forEach(cb: (key: CardKey, value: CardData) => void): void
    map<T>(cb: (key: CardKey, value: CardData) => T): T[]
}
