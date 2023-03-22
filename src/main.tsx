// preact/debug: Must be the first import
// import "preact/debug";
// Or if you just want the devtools bridge (~240B) without other
// debug code (useful for production sites)
// import "preact/devtools";

import { createRef, RefCallback, RefObject, render } from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/hooks";

// https://www.npmjs.com/package/html-native-modal
import "html-native-modal";
import "html-native-modal/html-native-modal.css";
import MyButton from "./components/MyButton";
import MyDialog from "./components/MyDialog";
import { DataObject } from "./helpers/Types";
import MyIcon from "./components/MyIcon";
import { AI, hasGetUserMedia } from "./ai";
import { ai, cardDataSet } from "./helpers/AIContext";
import { CardData, CardKey } from "./helpers/cards";

// let cards: AIElement[] = [
//     { name: "Январь" },
//     { name: "Февраль" },
//     //  { name: "Март" }, { name: "Апрель" }, { name: "Май" }, { name: "Июнь" }, { name: "Июль" }
// ];

async function seedDatabase()
{
    const data = [
        "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
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
    const [status, setStatus] = useState("");
    const [cardListVisible, setCardListState] = useState(false);

    ai.loadMobileNetFeatureModel(setStatus);

    // const webcamRef: RefCallback<HTMLVideoElement> = useCallback((x: HTMLVideoElement | null) => {
    //     if (x) ai.attach(x);
    // }, []);

    function showCardList()
    {
        ai.enableCam();
        setCardListState(true);
        editCardsRef.current.base.showModal();
    }

    function closeCardList()
    {
        setCardListState(false);
        editCardsRef.current?.base?.close();
    }

    useEffect(() => {
        // DidMount
        ai.attach(camRef.current)

        // WillUnmount
        return () => ai.attach(camRef.current);
    })

    return (
        <div>
            <h1>Обучение чтению</h1>
            <video ref={camRef} autoPlay muted></video>

            <ShowCardList ref={editCardsRef} show={cardListVisible} onClose={() => closeCardList() } />
            <button onClick={ () => ai.enableCam()}>Включить Камеру</button>
            <button onClick={ () => showCardList() }>Карточки</button>
            <button onClick={ () => cardDataSet.clear() }>Сброс данных</button>
            <button onClick={ () => ai.trainAndPredict( setStatus) }>Поехали!</button>

            <div>{status}</div>
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
