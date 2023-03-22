import { DataObject } from "../helpers/Types"
// import React from "preact";

import "./MyButton.css";

const MyButton = ({props, title}: DataObject) => {
    return (
        <button className={"my-button"} {...props}>{title}</button>
    )
}

export default MyButton;
