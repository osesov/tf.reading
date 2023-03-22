import { AI } from "../ai";
import { CardDataSet } from "./cards";
import { CardDataSetImpl } from "./database";

export const cardDataSet : CardDataSet = new CardDataSetImpl();
export const ai = new AI(cardDataSet);
