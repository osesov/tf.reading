import { Inputs, Ref, useCallback, useEffect, useRef, useState } from "preact/hooks";
import { ai, cardDataSet } from "../helpers/AIContext";
import { EWMA } from "../helpers/ewma";
import { useEventListener } from "../hooks/useEventListener";

enum GameStatus {
    NOTHING = 1,
    WAITING = 2, // waiting for word
    SUCCESS = 3, // word is presented
    HAPPINESS = 4, // time to be happy
    COMPLETE = 5,
}

interface GameProps {
    show: boolean;
    onClose: () => void; // todo?
}

interface PredictState {
    isConfident: boolean;
    key: number;
    confidence: number;
    filtered: number;
    deviation: number;
}

class Filter {
    private ewma: EWMA;
    private boundary_: number;
    private key_?: number = undefined;
    private lastConfidence_: number = 0;
    private lastDeviation_: number = Infinity;

    constructor(smoothingFactor: number, boundary: number, key?: number) {
        this.ewma = new EWMA(smoothingFactor, 0);
        this.key_ = key;
        this.boundary_ = boundary;

        // console.log("FILTER");
    }

    reset(key?: number) {
        this.key_ = key;
        this.ewma.reset();
    }

    update(key: number, confidence: number) {
        this.lastConfidence_ = confidence;
        if (this.key_ === key) this.ewma.update(confidence);
        else {
            this.ewma.reset();
            this.key_ = key;
        }

        const deviation = Math.abs(1 - this.ewma.value);
        this.lastDeviation_ = deviation;
        return Math.abs(deviation) < this.boundary_;
    }

    public get filteredConfidence() {
        return this.ewma.value;
    }

    public get lastDeviation() {
        return this.lastDeviation_;
    }

    public get lastConfidence() {
        return this.lastConfidence_;
    }
}

const usePredicting = (smoothingFactor: number, boundary: number, visible: boolean, canvasRef: Ref<HTMLCanvasElement>): [PredictState, () => void] => {
    const emptyPredicting: PredictState = { key: 0, confidence: 0, isConfident: false, deviation: 1, filtered: 0 };
    const [predictValue, setPredicting] = useState<PredictState>(emptyPredicting);

    function resetPredictValue() {
        setPredicting(emptyPredicting);
    }

    useEffect(() => {
        const filter = new Filter(smoothingFactor, boundary);
        const sub = ai.on("predict", ({ key, confidence }) => {
            const confident = filter.update(key, confidence);
            setPredicting({ key, confidence, isConfident: confident, filtered: filter.filteredConfidence, deviation: filter.lastDeviation });
        });

        return () => sub.unsubscribe();
    }, [visible]);

    return [predictValue, resetPredictValue];
};

function randomImage(): string
{
    const images = ["01.gif", "02.gif", "1C1.gif", "3cvh.gif", "7GdU.gif", "ig4.gif", "Oxyw.gif", "QhT.gif", "Qrbm.gif", "Z92i.gif", "hamster.jpg"];
    const image = images[Math.floor(Math.random() * images.length)];
    console.log("use image ", image);
    return image;
}

function randomSound(): string
{
    const files = ["Sound_06013800 1662662948.mp3"];
    const file = files[Math.floor(Math.random() * files.length)];
    console.log("use sound ", file);
    return file;
}

const useImage = (inputs: Inputs) => {
    const images = ["01.gif", "02.gif", "1C1.gif", "3cvh.gif", "7GdU.gif", "ig4.gif", "Oxyw.gif", "QhT.gif", "Qrbm.gif", "Z92i.gif", "hamster.jpg"];

    const [currentImage, setCurrentImage] = useState("");
    useEffect(() => {
        const image = images[Math.floor(Math.random() * images.length)];
        console.log("use image ", image);
        setCurrentImage(image);
    }, inputs);

    return [currentImage];
};

const Game = (props: GameProps) => {
    const maxSuccessCount = 5;

    const canvasRef = useRef<HTMLCanvasElement|null>(null);
    const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.NOTHING);
    const [currentKey, setCurrentKey] = useState<number | null>(null);
    const [predictValue, resetPredictValue] = usePredicting(0.1, 0.05, props.show, canvasRef);
    const [successCount, setSuccessCount] = useState(0);
//    const [image] = useImage([props.show, gameStatus === GameStatus.NOTHING]);
    const [image, setImage] = useState(randomImage);
    const [sound, setSound] = useState(randomSound);

    const waiting = gameStatus === GameStatus.WAITING;
    const success = [GameStatus.SUCCESS, GameStatus.HAPPINESS].includes(gameStatus);
    const thinkMore = gameStatus === GameStatus.WAITING;
    const waitingForKeydown = props.show && [GameStatus.SUCCESS, GameStatus.HAPPINESS, GameStatus.COMPLETE].includes(gameStatus);


    useEventListener(
        waitingForKeydown ? window : null,
        "keydown",
        (event: KeyboardEvent) => {
            if (gameStatus === GameStatus.HAPPINESS) nextWord();
            else if (gameStatus === GameStatus.COMPLETE) nextGame();
            else return;

            event.preventDefault();
        },
        [props.show, waitingForKeydown]
    );

    useEffect(() => {
        if (gameStatus === GameStatus.SUCCESS) {
            setGameStatus(GameStatus.HAPPINESS);
            // setTimeout(() => setGameStatus(GameStatus.NOTHING), 5000);
        }
    }, [gameStatus]);


    //// helpers
    function nextWord() {
        console.log("Next round");
        setGameStatus(GameStatus.NOTHING);
        setImage(randomImage);
        setSound(randomSound);
    }

    function nextGame() {
        setGameStatus(GameStatus.NOTHING);
        setImage(randomImage);
        setSound(randomSound);
        setCurrentKey(null);
        resetPredictValue();
        setSuccessCount(0);
        props.onClose();
    }

    //// logic
    if (!props.show) return null;

    if (gameStatus === GameStatus.COMPLETE) {
        return (
            <div class="success layout-vertical layout-vertical-center">
                <img src="img/complete.gif" />
                <button class="complete-button" onClick={() => nextGame()}>Молодец!</button>
            </div>
        );
    }
    if (gameStatus === GameStatus.NOTHING || currentKey === null) {
        setCurrentKey(cardDataSet.getRandom());
        setGameStatus(GameStatus.WAITING);
        return null;
    }

    const currentWord = cardDataSet.getCard(currentKey)?.name;
    if (!currentWord)
        /// ?
        throw new Error("No word!");

    const s = GameStatus[gameStatus];

    if (gameStatus === GameStatus.WAITING && predictValue.isConfident) {
        if (currentKey === predictValue.key) {
            if (successCount + 1 === maxSuccessCount) setGameStatus(GameStatus.COMPLETE);
            else {
                setGameStatus(GameStatus.SUCCESS);
                setSuccessCount(successCount + 1);
            }
        }
        resetPredictValue();
    }

    if (success) {
        const imageUri = "img/success/" + image;
        const soundUri = "sound/" + sound;
        const next = () => nextWord();

        return (
            <div class="success layout-vertical layout-vertical-center">
                <img src={imageUri}></img>
                <audio autoPlay={true} src={soundUri}></audio>
                <button onClick={next} autoFocus={true}>
                    Жми!
                </button>
            </div>
        );
    }

    return (
        <div class="layout-vertical">
            <div class="statistics layout-horizontal-center">
                {Array(successCount)
                    .fill(undefined)
                    .map((_) => (
                        <img class="statistics-item" src="img/star.png" />
                    ))}
            </div>
            <div class="word">{currentWord}</div>
            <div class="tech-info">
                ожидаем: {currentKey}
                <br />
                получили: {predictValue.key}
                <br />
                уверенность: {predictValue.confidence.toFixed(3)}
                <br />
                фильтр: {predictValue.filtered.toFixed(3)}
                <br />
                отклонение: {predictValue.deviation.toFixed(6)}
                <br />
                {s}
            </div>
            <button onClick={() => nextWord()}>Пропустить</button>
            <canvas style="display:none" ref={canvasRef} width="300" height="300"></canvas>
        </div>
    );
};

export default Game;
