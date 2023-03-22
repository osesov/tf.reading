// import React from "preact";

import { DataObject } from "../helpers/Types";

export type IconName =
    'video'
    | 'download'
    | 'circle-check'
    | 'circle-xmark'
    | 'check'
    | 'xmark'
    ;

export interface Props extends DataObject
{
    icon: IconName
}

const MyIcon = ({icon, className, ...props}: Props) => {
    return (
        <i className={`fa fa-${icon} ` + className} {...props}></i>
    )
}

export default MyIcon;
