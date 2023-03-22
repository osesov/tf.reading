import React from "preact";

export interface ProgressBarProps
{
    bgcolor: string
    completed: number
    visible?: boolean
}

const ProgressBar = (props: ProgressBarProps) => {
    const { bgcolor, completed, visible } = props;

    const containerStyles = {
        height: 20,
        width: "90%",
        backgroundColor: "#e0e0de",
        borderRadius: 50,
        margin: "0.5lh",
        ... visible ? {} : { display: "none" }
    };

    const fillerStyles = {
        height: "100%",
        width: `${completed}%`,
        backgroundColor: bgcolor,
        borderRadius: "inherit",
        textAlign: "right",
        // animation
        transition: 'width 0.5s ease-in-out',
    };

    const labelStyles = {
        padding: 5,
        color: "white",
        fontWeight: "bold",
    };

    return (
        <div style={containerStyles}>
            <div style={fillerStyles}>
                <span style={labelStyles}>{`${completed}%`}</span>
            </div>
        </div>
    );
};

export default ProgressBar;
