import { AI } from "../ai";
import { CardDataSetImpl } from "./database";

export const cardDataSet = new CardDataSetImpl();
export const ai = new AI(cardDataSet);
