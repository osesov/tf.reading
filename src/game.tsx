import { Attributes, Component, ComponentChild, ComponentChildren, createRef, Ref, RefObject, RenderableProps } from "preact";

import "html-native-modal";
import "html-native-modal/html-native-modal.css";
import { CardKey } from "./helpers/cards";
import { ai, cardDataSet } from "./helpers/AIContext";
import { useState } from "preact/hooks";
import { Unsubscribe } from "./helpers/EventEmitter";
import { EWMA } from "./helpers/ewma";

export type GameProps = Readonly<Attributes & {show: boolean, onClose: () => void} >

interface PredictState {
    key: number
    confidence : number
    filtered: number
}

type GameState = {
    predict ?: PredictState
}

export class Game extends Component<GameProps, GameState>
{
    private dialogRef: RefObject<HTMLDialogElement>
    private currentKey: CardKey | undefined
    private closeListener: () => void
    private aiSubscription: Unsubscribe | null = null
    private filter = new EWMA(0.01, 0);
    private predicted = 0;

    constructor(props: GameProps)
    {
        super()
        console.log("CREATE GAME");
        this.dialogRef = createRef();
        this.closeListener = () => {
            console.log("CLOSE");
            this.props.onClose();
        }

        this.state = {}
    }

    updateState(previousProps: {show: boolean})
    {
        if (this.props.show && !previousProps.show) {
            this.dialogRef.current!.showModal();
            this.aiSubscription = ai.on('predict', ({index, confidence}) => this.onPredict(index, confidence))
        }

        else if (!this.props.show && previousProps.show) {
            this.dialogRef.current!.close();
            this.aiSubscription?.unsubscribe();
        }
    }

    componentDidUpdate(previousProps: Readonly<Readonly<Attributes & { show: boolean; onClose: () => void; }>>, previousState: Readonly<GameState>, snapshot: any): void {
        console.log("UPDATE EVENT LISTENER: now %s, prev: %s", this.props.show, previousProps.show)
        this.updateState(previousProps);
    }

    componentDidMount(): void {
        console.log("ADD EVENT LISTENER", this.props.show);
        this.updateState({ show: false })
        this.dialogRef.current!.addEventListener("close", this.closeListener )
    }

    componentWillUnmount(): void {
        console.log("REMOVE EVENT LISTENER", this.props.show);
        this.dialogRef.current!.removeEventListener("close", this.closeListener)
        this.dialogRef.current!.close();
    }

    private onPredict(index: number, confidence: number)
    {
        if (this.currentKey === undefined)
            return;

        if (confidence < 0.5)
            return;

        if (this.predicted !== index) {
            this.filter.reset();
            this.predicted = index;
        }
        else {
            const value = this.filter.update(confidence);
            if (value > 0.99)
                console.log("PREDICT %s %s", index, confidence, value);
        }

        this.setState({
            predict: {
                key: index,
                confidence: confidence,
                filtered: this.filter.value
            }
        })
    }

    private selectCardKey()
    {
        try {
            this.currentKey = cardDataSet.getRandom()
        }
        catch(e: any) {
            console.error(e);
        }
    }

    render(props?: GameProps, state?: GameState, context?: any): ComponentChild {
        // if (!props?.show)
            // return null;

        console.log("PROPS: ", this.props);
        if (this.currentKey === undefined && props?.show) {
            this.selectCardKey();
        }

        const word = cardDataSet.getCard(this.currentKey!);
        return(
            <dialog ref={this.dialogRef}>
                <h1>Поиграем?</h1>
                Прочитай слово: <strong className={"word"}>{word?.name}</strong>

                <div>
                    Key: {this.state.predict?.key}<br />
                    confidence: {this.state.predict?.confidence.toFixed(2)}<br />
                    filtered: {this.state.predict?.filtered.toFixed(2)}<br />
                </div>
            </dialog>)
        ;
    }
}
