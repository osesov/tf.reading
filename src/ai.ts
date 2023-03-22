import tf, { Tensor3D } from "@tensorflow/tfjs";
import { CardDataSet, CardKey } from "./helpers/cards";
import { DataObject } from "./helpers/Types";

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;

export function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function asTensor(tensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap): tf.Tensor {
    if (tensor instanceof tf.Tensor)
        return tensor;

    throw new Error("Single tensor expected");
}

export type EventListener<E> = (event: E) => void;

class EventEmitterImpl<E>
{
    private listeners: {
        [k: string]: { id: number, listener: EventListener<E>}[]
    } = {};

    private id: number = 0;

    private unsubscribe(name: string, id: number)
    {
        if (!(name in this.listeners))
            return;

        const listeners = this.listeners[name];
        const elem = listeners.findIndex((e) => e.id === id);
        if (elem < 0)
            return;

        delete listeners[elem];
    }

    public on(name: string, listener: EventListener<E>)
    {
        if (! (name in this.listeners)) {
            this.listeners[name] = []
        }

        const id = this.id++;
        this.listeners[name].push({ id: id, listener: (e) => listener(e) });

        return {
            unsubscribe: () => this.unsubscribe(name, id)
        }
    }

    public once(name: string, listener: EventListener<E>)
    {
        if (! (name in this.listeners)) {
            this.listeners[name] = []
        }

        const id = this.id++;
        this.listeners[name].push({
            id: id,
            listener: (e) => {
                try {
                    listener(e);
                }
                finally {
                    this.unsubscribe(name, id);
                }
            }});

        return {
            unsubscribe: () => this.unsubscribe(name, id)
        }

    }

    public dispatch(name: string, event: E)
    {
        const listeners = this.listeners[name];

        if (!listeners)
            return;

        listeners.forEach(element => {
            try {
                element.listener(event);
            }

            catch(e: any) {
                console.warn("Exception raised in handling %s", name, { exception: e, event: event})
            }
        });
    }
}

export class AI extends EventEmitterImpl<DataObject>
{
    private webcam_: HTMLVideoElement | undefined;
    private videoPlaying_ = false;
    private videoGathering = false;
    private trained = false;
    private predict = false;
    private model_ ?: tf.Sequential;
    // private elements: AIElement[] = [];
    private cardDataSet : CardDataSet
    private mobilenet_: tf.GraphModel | undefined;

    public constructor(cardDataSet: CardDataSet)
    {
        super();
        this.cardDataSet = cardDataSet;

        cardDataSet.addEventListener( 'reset', () => this.datasetChanged() )
        cardDataSet.addEventListener( 'addCard', () => this.datasetChanged() )
        cardDataSet.addEventListener( 'changeCard', () => this.datasetChanged() )
        cardDataSet.addEventListener( 'deleteCard', () => this.datasetChanged() )
    }

    public attach(webcam ?: HTMLVideoElement)
    {
        if (this.webcam_ && webcam)
            throw new Error("Cam already attached");
        this.webcam_ = webcam;
    }

    public get webcam(): HTMLVideoElement
    {
        if (!this.webcam_)
            throw Error("Cam is not attached");
        return this.webcam_;
    }

    public get webcamEnabled(): boolean
    {
        return this.videoPlaying;
    }

    public enableCam() {
        if (this.videoPlaying)
            return;

        if (hasGetUserMedia()) {
            this.webcam;

            const constraints = {
                video: true,
                width: 640,
                height: 480,
            };

            // Activate the webcam stream.
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                this.webcam.srcObject = stream;
                this.webcam.addEventListener("loadeddata", () => {
                    this.videoPlaying = true;
                });
            });
        } else {
            alert("getUserMedia() is not supported by your browser");
        }
    }

    private get model(): tf.Sequential
    {
        if (this.model_)
            return this.model_;

        const numberOfClasses = this.numberOfClasses;

        let model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [1024], units: 128, activation: "relu" }));
        model.add(tf.layers.dense({ units: numberOfClasses, activation: "softmax" }));

        model.summary();

        // Compile the model with the defined optimizer and specify a loss function to use.
        model.compile({
            // Adam changes the learning rate over time which is useful.
            optimizer: "adam",
            // Use the correct loss function. If 2 classes of data, must use binaryCrossentropy.
            // Else categoricalCrossentropy is used if more than 2 classes.
            loss: numberOfClasses === 2 ? "binaryCrossentropy" : "categoricalCrossentropy",
            // As this is a classification problem you can record accuracy in the logs too!
            metrics: ["accuracy"],
        });

        this.model_ = model;
        return model;
    }

    private datasetChanged()
    {
        // recreate model on demand
        this.model_ = undefined;
        this.trained = false;
    }

    public get numberOfClasses(): number
    {
        return this.cardDataSet.length;
    }

    public get videoPlaying()
    {
        return this.videoPlaying_;
    }

    public set videoPlaying(state: boolean)
    {
        this.videoPlaying_ = state;
    }

    private get mobilenet() : tf.GraphModel
    {
        if (!this.mobilenet_)
            throw new Error("Mobilenet is not loaded yet!");

        return this.mobilenet_;
    }

    private dataGatherLoop(capture: () => void, key: CardKey, data: tf.Tensor[], status: (n: number) => void, done: () => void) {

        if (!this.videoPlaying || !this.mobilenet_) {
            return;
        }

        if (!this.videoGathering) {
            this.cardDataSet.setTrainingInputs(key, data);
            done();
            return;
        }

        let imageFeatures = tf.tidy(() => {
            let videoFrameAsTensor = tf.browser.fromPixels(this.webcam);
            let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);
            let normalizedTensorFrame = resizedTensorFrame.div(255);
            return asTensor(this.mobilenet.predict(normalizedTensorFrame.expandDims())).squeeze();
        });

        data.push(imageFeatures);

        status(data.length);
        window.requestAnimationFrame(capture);
    }

    public beginDataGather(key: CardKey, status: (n: number) => void, done: () => void): void
    {
        if (!this.videoPlaying)
            throw Error("Video is not playing");

        this.videoGathering = true;
        const data : tf.Tensor[] = [];
        const capture = () => {
            this.dataGatherLoop(capture, key, data, status, done);
        }

        capture();
    }

    public endDataGather()
    {
        if (!this.videoGathering)
            return;

        this.videoGathering = false;
    }

    public hasData(key: CardKey): boolean
    {
        const card = this.cardDataSet.getCard(key);

        return !!card
            && !!card.trainingDataInputs
            && Array.isArray(card.trainingDataInputs)
            && card.trainingDataInputs!.length > 100
            ;
    }

    private predictLoop()
    {
        if (!this.predict || !this.mobilenet) {
            return;
        }

        tf.tidy(() => {
            let videoFrameAsTensor = tf.browser.fromPixels(this.webcam).div<Tensor3D>(255);
            let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);

            let imageFeatures = asTensor(this.mobilenet.predict(resizedTensorFrame.expandDims()));
            let prediction = asTensor(this.model.predict(imageFeatures)).squeeze();
            let highestIndex = prediction.argMax().arraySync() as number;
            let predictionArray = prediction.arraySync() as number[];

            this.dispatch('predict', {
                target: this,
                index: highestIndex,
                confidence: Math.floor(predictionArray[highestIndex] * 100)
            });
        });

        window.requestAnimationFrame(() => this.predictLoop());
    }

    public async trainAndPredict(status: (status: string) => void) {
        this.predict = false;

        const trainingDataInputs : tf.Tensor[] = [];
        const trainingDataOutputs: number[] = [];
        const numberOfClasses = this.numberOfClasses;

        this.cardDataSet.forEach( (key, card) => {
            if (this.hasData(key)) {
                throw Error(`Item [${key}] ${card.name} contains not enough data`);
            }

            trainingDataInputs.push.apply(trainingDataInputs, card.trainingDataInputs);
            trainingDataOutputs.push.apply( trainingDataOutputs, Array(card.trainingDataInputs.length).fill(key));
        })

        tf.util.shuffleCombo(trainingDataInputs, trainingDataOutputs);
        let outputsAsTensor = tf.tensor1d(trainingDataOutputs, "int32");
        let oneHotOutputs = tf.oneHot(outputsAsTensor, numberOfClasses);
        let inputsAsTensor = tf.stack(trainingDataInputs);

        status('Идет обучение сети');
        const epochs = 10;

        let results = await this.model.fit(inputsAsTensor, oneHotOutputs, {
            shuffle: true,
            batchSize: 5,
            epochs: epochs,
            callbacks: {
                onEpochEnd: function(epoch, logs) {
                    status(`Обучение ${100 * epoch / epochs} %`)
                    console.log("Data for epoch " + epoch, logs);
                }
            }
        });

        outputsAsTensor.dispose();
        oneHotOutputs.dispose();
        inputsAsTensor.dispose();
        this.predict = true;
        status('Распознавание');
        this.predictLoop();
    }

    public reset()
    {
        this.predict = false;
        this.videoGathering = false;
        this.cardDataSet.clear();
        console.log("Tensors in memory: " + tf.memory().numTensors);
    }

    async loadMobileNetFeatureModel(updateStatus: (n: string) => void) {
        if (this.mobilenet_)
            return;

        const URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1";

        this.mobilenet_ = await tf.loadGraphModel(URL, { fromTFHub: true });
        updateStatus("MobileNet v3 loaded successfully!");

        // Warm up the model by passing zeros through it once.
        tf.tidy(() => {
            let answer = asTensor(this.mobilenet.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3])));
            console.log(answer.shape);
        });
    }
}
