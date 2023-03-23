import dotenv from "dotenv";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";
import css from "rollup-plugin-import-css";

dotenv.config();

function getOpt(commandLineArgs, option)
{
    if (!option in commandLineArgs)
        return undefined;

    const value = commandLineArgs[option];
    delete commandLineArgs[option];
    return value;
}

export default function (commandLineArgs) {

    console.log("args %s", commandLineArgs);

    const serve = getOpt(commandLineArgs, "serve");

    return {
        input: [ "src/main.tsx" ],
        external: ["@tensorflow/tfjs", "jquery"],
        output: {
            file: ".build/rollup/bundle.js",
            format: "iife",
            sourcemap: true,
            name: "main",
            globals: {
                "@tensorflow/tfjs": "tf",
                jquery: "$",
            },
        },
        plugins: [
            typescript({
                tsconfig: "tsconfig.json",
                compilerOptions: {
                    outDir: ".build/rollup.ts",
                },
            }),
            css(),
            resolve(),
            commonjs(),
            ...getServePlugin(serve),
        ],
        watch: {
            buildDelay: 1000,
            skipWrite: false,
            clearScreen: false,
            // include: [ "lib", "browser" ],
        },
    };
}

function toBoolean(value) {
    if (!value) return false;

    return value > 0 || value === "yes" || value === "true";
}

function getServePlugin(port) {
    if (port === undefined && !toBoolean(process.env.LIVE_RELOAD)) {
        console.log("Bypass serve plugin %s", port);
        return [];
    }

    console.log("Enable serve plugin");

    return [
        serve({
            open: false,
            port: port,
            verbose: true,
            contentBase: ["src", ".build/rollup"],
            onListening: function (server) {
                const address = server.address();
                const host = address.address === "::" ? "localhost" : address.address;
                // by using a bound function, we can access options as `this`
                const protocol = this.https ? "https" : "http";
                console.log(`Server listening at ${protocol}://${host}:${address.port}/`);
            },
        }),
        livereload({
            watch: ["src", ".build/rollup"],
            verbose: true, // Disable console output

            // other livereload options
            port: 12345,
            delay: 300,
        }),
    ];
}
