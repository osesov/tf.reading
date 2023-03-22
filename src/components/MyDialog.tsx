import { Component, ComponentChild, ComponentChildren, createRef, RefObject, RenderableProps } from "preact";

import "html-native-modal";
import "html-native-modal/html-native-modal.css";

export type MyDialogOptions = RenderableProps<{
    open: boolean
    onClose: () => void
    children: ComponentChildren;
}>

export type MyDialogState = Readonly<{
    value: string;
}>

class MyDialog extends Component<MyDialogOptions, MyDialogState> {
    private options: MyDialogOptions;
    private ref: RefObject<HTMLDialogElement>

    constructor(options: MyDialogOptions) {
        super();
        this.options = options;
        this.setState({ value: "qwe" });

        this.ref = createRef<HTMLDialogElement>();
    }

    componentDidMount(): void {
        console.log("dialog: ", this.ref.current);

        this.ref.current?.addEventListener("close", this.options.onClose )
    }

    componentWillUnmount(): void {
        this.ref.current?.removeEventListener("close", this.options.onClose)
    }

    render(props : MyDialogOptions, state?: MyDialogState, context?: any): ComponentChild {
        const { children, open, onClose, ...others} = props;
        // const openAttribute = open ? {open: true} : {}
        const openAttribute = {}

        // function style: didmount/willunmount events
        // useEffect(() => {
        //     console.log("useEffect: start", this.ref.current);

        //     return () => console.log("useEffect: cleanup", this.ref.current);
        // });

        return (
            <dialog ref={this.ref} {... openAttribute} {...others}>
                <form method="dialog">
                    {children}
                </form>
            </dialog>
        );
    }
}

export default MyDialog;
