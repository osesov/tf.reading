// preact/debug: Must be the first import
// import "preact/debug";
// Or if you just want the devtools bridge (~240B) without other
// debug code (useful for production sites)
// import "preact/devtools";

import { createRef, RefCallback, RefObject, render } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

// https://www.npmjs.com/package/html-native-modal
import MyButton from "./components/MyButton";
import MyDialog from "./components/MyDialog";
import { DataObject } from "./helpers/Types";
import MyIcon from "./components/MyIcon";
import { ai, cardDataSet } from "./helpers/AIContext";
import { CardData, CardKey } from "./helpers/cards";
import ProgressBar from "./components/ProgressBar";
import { delay, hasGetUserMedia } from "./helpers/util";
import Game from "./components/Game";
import "./style.css"

async function seedDatabase()
{
    const data = [
        // "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
        "Фон", "Телефон", "Пульт"
    ]

    await cardDataSet.clear();
    await Promise.all(data.map( elem =>
        cardDataSet.addCard(cardDataSet.nextId, elem)));
}

type StatusCallback = (status: number) => void;

const ShowCardItem = ({ dataKey, item, status }: { dataKey: CardKey, item: CardData; status: StatusCallback }) => {
    const [hasData, setHasData] = useState(ai.hasData(dataKey));

    return (
        <li>
            <button
                type="button"
                className="space-after"
                onMouseDown={() => ai.beginDataGather(dataKey, status, () => setHasData(ai.hasData(dataKey)))}
                onMouseUp={() => { ai.endDataGather(); }}
            >
                <MyIcon icon={"video"}></MyIcon>
            </button>
            <MyIcon icon={hasData ? "circle-check" : "circle-xmark"} className={hasData ? "mark mark-has-data" : "mark mark-no-data"} />
            {item.name}
        </li>
    );
};

const ShowCardList = ({ show, onClose, ...props }: DataObject) => {
    const [_, updateCardList] = useState(null);
    const [currentName, setCurrentName] = useState("");
    const [collected, setCollected] = useState(0);

    async function addCard(name: string) {
        const id = cardDataSet.nextId;
        cardDataSet.addCard(id, name)
        updateCardList(null);
        setCurrentName("");
    }

    return (
        <MyDialog {...props} open={show} onClose={onClose} >
            { show }
            <input class="card-edit" onChange={(e) => setCurrentName((e.target as HTMLInputElement)?.value )}></input>
            <button type="button" onClick={() => addCard(currentName)}>Add</button>
            <hr />
            {
                cardDataSet.empty
                    ? <strong>Нет Карточек</strong>
                    : cardDataSet.map( (key, value) =>
                        <ShowCardItem dataKey={key} item={value} status={setCollected} />
                    )
            }
            <hr />
            Collected: {collected}
        </MyDialog>
    );
};

const App = () => {
    const editCardsRef = createRef();
    const camRef = createRef();
    const [camPlaying, setCamPlaying] = useState(ai.webcamPlaying);
    const [status, setStatus] = useState("");
    const [cardListVisible, setCardListState] = useState(false);
    const [gamePlaying, setGamePlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [training, setTraining] = useState(false);

    ai.loadMobileNetFeatureModel(setStatus);

    function showCardList()
    {
        const dialog = editCardsRef.current.base;

        ai.enableCam()
        .then(() => {
            setCardListState(true);
            dialog.showModal();
        });
    }

    function closeCardList()
    {
        const dialog = editCardsRef.current.base;

        setCardListState(false);
        dialog?.close();
    }

    function enableCamProps()
    {
        if (ai.webcamPlaying != camPlaying)
            setCamPlaying(ai.webcamPlaying);

        return ai.webcamPlaying ? { className: 'hidden'} : {};
    }

    function visibleIfNotPlaying()
    {
        if (gamePlaying)
            return { className: 'hidden' }

        return {}
    }

    useEffect(() => {
        // DidMount
        // console.log("Mounted", editCardsRef.current)
        ai.attach(camRef.current)
        ai.once('playing', () => setCamPlaying(ai.webcamPlaying))

        // WillUnmount
        return () => {
            // console.log("Unmounted", editCardsRef.current)
            ai.attach(camRef.current);
        }
    })

    function beginGame()
    {
        console.log("beginGame: %s", gamePlaying);

        setTraining(true);
        const preTrained = ai.trained;

        ai.enableCam()
        .then(() =>
            ai.trainAndPredict((f) => setProgress(f*100)))
        .then(() =>
            setTraining(false))
        .then(() =>
            preTrained ? null : delay(2))
        .then(() =>
            setGamePlaying(true)
            )
        ;
    }

    function endGame()
    {
        console.log("endGame: %s", gamePlaying);
        setGamePlaying(false);
    }

    function clearData()
    {
        if (window.confirm("Точно удаляем данные?"))
            cardDataSet.clear();
    }

    function enableCam()
    {
        ai.enableCam().then( () => setStatus("Cam Enabled"));
    }

    function seedData()
    {
        seedDatabase().then( () => setStatus("Закончили!") );
    }

    return (
        <div id="app" class="app">
            <div class="layout-vertical position-relative">
                <div class="title">Обучение чтению</div>
                <video ref={camRef} autoPlay muted></video>
                <Game show={gamePlaying} onClose={() => endGame()}/>
                <div class="layout-horizontal layout-horizontal-center">
                    <ShowCardList ref={editCardsRef} show={cardListVisible} onClose={() => closeCardList() } />
                    <button {...visibleIfNotPlaying()} onClick={ () => enableCam()} {... enableCamProps()}>Включить Камеру</button>
                    <button {...visibleIfNotPlaying()} onClick={ () => showCardList() }>Карточки</button>
                    <button {...visibleIfNotPlaying()} onClick={ () => beginGame() }>Поехали!</button>
                    {/* <button {...visibleIfNotPlaying()} onClick={ () => clearData() }>Сброс данных</button> */}
                    {/* <button {...visibleIfNotPlaying()} onClick={ () => seedData() }>Добавить карточки из набора</button> */}
                </div>
                <div class="layout-horizontal-center">
                    <ProgressBar bgcolor={"#6a1b9a"} completed={progress} visible={training} />
                </div>
                <div class="status-bar">{status}</div>
            </div>
        </div>
    );
};

const LaunchApp = () => {
    const rootElement = document.getElementById("app")!;
    render(<App />, rootElement);
};

const Intro = () => {
    if (hasGetUserMedia()) {
        return (
            <div>
                <h1>Для работы программы требуется доступ к камере.</h1>
                <button onClick={() => LaunchApp()}>Нажмите, чтобы начать</button>
            </div>
        );
    } else {
        return <h1>Браузер не поддерживает доступ к камере</h1>;
    }
};

function main() {
    if (true) {
        LaunchApp();
    } else {
        const rootElement = document.getElementById("app")!;
        render(<Intro />, rootElement);
    }
}

addEventListener("DOMContentLoaded", main);
function createCallback() {
    throw new Error("Function not implemented.");
}
