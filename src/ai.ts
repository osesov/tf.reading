import tf from "@tensorflow/tfjs";
import { CardDataSet, CardKey } from "./helpers/cards";
import { EventEmitterImpl } from "./helpers/EventEmitter";
import { hasGetUserMedia } from "./helpers/util";

const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;

function asTensor(tensor: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap): tf.Tensor {
    if (tensor instanceof tf.Tensor)
        return tensor;

    throw new Error("Single tensor expected");
}

interface AIEventMap {
    playing: {}
    predict: {
        key: number,
        confidence: number
    },
    predicting: {}
}

class MobilnetLoader {
    private ready_: Promise<tf.GraphModel>
    private resolve: (model: tf.GraphModel) => void = (e) => e;
    private reject: (reason: any) => void = e => e;
    private loading = false;

    constructor() {
        this.ready_ = new Promise<tf.GraphModel>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    public get ready() {
        return this.ready_;
    }

    public async load(updateStatus: (n: string) => void, warmup: (model: tf.GraphModel) => void): Promise<tf.GraphModel> {
        if (this.loading)
            return this.ready_;

        this.loading = true;

        updateStatus("Загрузка данных Mobilenet v3")
        const URL = "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1";

        tf.loadGraphModel(URL, { fromTFHub: true })
            // .then( this.resolve )
            // .catch( this.reject )
            .then((model) => {
                warmup(model);
                this.resolve(model);
                updateStatus("Данные Mobilenet v3 загружены");
            })

            .catch((reason) => {
                this.reject(reason);
                updateStatus("Ошибка загрузки данных " + String(reason));
            })
            ;

        return this.ready_;
    }
}

export class AI extends EventEmitterImpl<AIEventMap>
{
    private webcam_: HTMLVideoElement | undefined;
    private videoPlaying_ = false;
    private videoGathering = false;
    private trained_ = false;
    private predict = false;
    private model_?: tf.Sequential;
    private cardDataSet: CardDataSet
    private mobilenet_: MobilnetLoader;

    public constructor(cardDataSet: CardDataSet) {
        super();
        this.cardDataSet = cardDataSet;

        cardDataSet.on('reset', () => this.datasetChanged())
        cardDataSet.on('addCard', () => this.datasetChanged())
        cardDataSet.on('changeCard', () => this.datasetChanged())
        cardDataSet.on('deleteCard', () => this.datasetChanged())

        cardDataSet.ready
            .then(() => cardDataSet.loadModel())
            .then((model) => {
                this.trained_ = true;
                this.compileAndSetModel(model as tf.Sequential);
            }).catch((reason: any) => {
                this.trained_ = false;
                console.warn("Model is not loaded: ", reason);
            })

        this.mobilenet_ = new MobilnetLoader();
    }

    public attach(webcam?: HTMLVideoElement) {
        if (this.webcam_ && webcam)
            throw new Error("Cam already attached");
        this.webcam_ = webcam;
    }

    public get webcam(): HTMLVideoElement {
        if (!this.webcam_)
            throw Error("Cam is not attached");
        return this.webcam_;
    }

    public get webcamPlaying(): boolean {
        return this.videoPlaying;
    }

    protected haveSubscriber<K extends keyof AIEventMap>(name: K) {
        if (name === 'playing' && this.webcamPlaying)
            this.dispatchEvent('playing', {})
    }

    public async enableCam() {
        return new Promise<void>((resolve) => {
            if (this.videoPlaying)
                return resolve();

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
                        this.dispatchEvent("playing", {});
                        resolve();
                    });
                });
            } else {
                alert("getUserMedia() is not supported by your browser");
                return Promise.reject("getUserMedia() is not supported by your browser");
            }
        });
    }

    private compileAndSetModel(model: tf.Sequential) {
        model.summary();

        const numberOfClasses = this.numberOfClasses;

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
    }

    private get model(): tf.Sequential {
        if (this.model_)
            return this.model_;

        const numberOfClasses = this.numberOfClasses;

        let model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [1024], units: 128, activation: "relu" }));
        model.add(tf.layers.dense({ units: numberOfClasses, activation: "softmax" }));

        this.compileAndSetModel(model);
        return model;
    }

    private datasetChanged() {
        // recreate model on demand
        this.discardTraining();
    }

    public get numberOfClasses(): number {
        return this.cardDataSet.length;
    }

    public get videoPlaying() {
        return this.videoPlaying_;
    }

    public set videoPlaying(state: boolean) {
        this.videoPlaying_ = state;
    }

    private async discardTraining()
    {
        this.model_ = undefined;
        this.trained_ = false;
        await this.cardDataSet.removeModel()
    }

    private dataGatherLoop(key: CardKey, data: tf.Tensor[], status: (n: number) => void, done: () => void, mobilenet: tf.GraphModel): boolean
    {

        if (!this.videoPlaying) {
            return false;
        }

        if (!this.videoGathering) {
            this.cardDataSet.setTrainingInputs(key, data);
            done();
            return false;
        }

        let imageFeatures = tf.tidy(() => {
            let videoFrameAsTensor = tf.browser.fromPixels(this.webcam);
            let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);
            let normalizedTensorFrame = resizedTensorFrame.div(255);
            return asTensor(mobilenet.predict(normalizedTensorFrame.expandDims())).squeeze();
        });

        data.push(imageFeatures);

        status(data.length);
        return true;
    }

    public beginDataGather(key: CardKey, status: (n: number) => void, done: () => void): void {
        if (!this.videoPlaying)
            throw Error("Video is not playing");

        this.discardTraining();
        this.videoGathering = true;
        const data: tf.Tensor[] = [];

        this.mobilenet_.ready.then(mobilenet => {


            const capture = () => {
                if (this.dataGatherLoop(key, data, status, done, mobilenet)) {
                    window.requestAnimationFrame(capture);
                }
            }

            capture();
        })
    }

    public endDataGather() {
        if (!this.videoGathering)
            return;

        this.videoGathering = false;
    }

    public hasData(key: CardKey): boolean {
        const card = this.cardDataSet.getCard(key);

        return !!card
            && !!card.trainingDataInputs
            && Array.isArray(card.trainingDataInputs)
            && card.trainingDataInputs!.length > 100
            ;
    }

    private mm: tf.GraphModel | undefined
    private index: number = 0

    public execute(canvas: HTMLCanvasElement)
    {
        const mobilenet = this.mm;
        if (!mobilenet)
            return;

        tf.tidy( () => {
            let videoFrameAsTensor = tf.browser.fromPixels(this.webcam).div<tf.Tensor3D>(255);
            let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);

            const names = mobilenet.outputs.map( e => e.name);

            // const names = (mobilenet as any).artifacts.modelTopology.node.map( (e: any) => e.name );
            const result = mobilenet.execute(resizedTensorFrame.expandDims(), names);
            const arr = Array.isArray(result) ? result : [result];

            const x = arr[0].dataSync();
            const o = tf.tensor2d(x, [32,32])

            tf.browser.toPixels(o, canvas);
        });
    }

    private predictLoop(mobilenet: tf.GraphModel): boolean {
        if (!this.predict) {
            return false;
        }
        tf.tidy(() => {
            let videoFrameAsTensor = tf.browser.fromPixels(this.webcam).div<tf.Tensor3D>(255);
            let resizedTensorFrame = tf.image.resizeBilinear(videoFrameAsTensor, [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH], true);

            let imageFeatures = asTensor(mobilenet.predict(resizedTensorFrame.expandDims()));
            let prediction = asTensor(this.model.predict(imageFeatures)).squeeze();
            let highestIndex = prediction.argMax().arraySync() as number;
            let predictionArray = prediction.arraySync() as number[];

            this.dispatchEvent('predict', {
                key: highestIndex,
                confidence: predictionArray[highestIndex]
            });

            this.mm = mobilenet;
        });

        return true;
    }

    private async train(progress: (fraction: number) => void) {
        if (this.trained_)
            return;

        this.trained_ = false;
        const trainingDataInputs: tf.Tensor[] = [];
        const trainingDataOutputs: number[] = [];
        const numberOfClasses = this.numberOfClasses;

        this.cardDataSet.forEach((key, card) => {
            if (!this.hasData(key)) {
                throw Error(`Item [${key}] ${card.name} contains not enough data`);
            }

            trainingDataInputs.push.apply(trainingDataInputs, card.trainingDataInputs);
            trainingDataOutputs.push.apply(trainingDataOutputs, Array(card.trainingDataInputs.length).fill(key));
        })

        tf.util.shuffleCombo(trainingDataInputs, trainingDataOutputs);
        let outputsAsTensor = tf.tensor1d(trainingDataOutputs, "int32");
        let oneHotOutputs = tf.oneHot(outputsAsTensor, numberOfClasses);
        let inputsAsTensor = tf.stack(trainingDataInputs);

        progress(0);
        // status('Идет обучение сети');
        const epochs = 10;

        let results = await this.model.fit(inputsAsTensor, oneHotOutputs, {
            shuffle: true,
            batchSize: 5,
            epochs: epochs,
            callbacks: {
                onEpochEnd: function (epoch, logs) {
                    progress((epoch + 1) / epochs);
                    // status(`Обучение ${100 * epoch / epochs} %`)
                    console.log("Data for epoch " + epoch, logs);
                }
            }
        });
        outputsAsTensor.dispose();
        oneHotOutputs.dispose();
        inputsAsTensor.dispose();
        this.trained_ = true;

        await this.cardDataSet.saveModel(this.model);
    }

    public async trainAndPredict(progress: (fraction: number) => void) {
        this.predict = false;
        await this.train(progress);

        this.predict = true;
        // status('Распознавание');
        this.mobilenet_.ready.then( mobilenet => {

            this.dispatchEvent('predicting', {})
            const capture = () => {
                if (this.predictLoop(mobilenet)) {
                    Promise.resolve().then(() => window.requestAnimationFrame(capture));
                }
            }
            capture();
        })
    }

    public reset() {
        this.predict = false;
        this.videoGathering = false;
        this.cardDataSet.clear();
        console.log("Tensors in memory: " + tf.memory().numTensors);
    }

    async loadMobileNetFeatureModel(updateStatus: (n: string) => void) {
        return this.mobilenet_
            .load(updateStatus,
                (mobilenet) => {
                    // Warm up the model by passing zeros through it once.
                    tf.tidy(() => {
                        let answer = asTensor(mobilenet.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3])));
                        console.log(answer.shape);
                    });
                })
    }

    public get trained() {
        return this.trained_;
    }
}
