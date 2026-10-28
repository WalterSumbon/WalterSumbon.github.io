import { chooseMove } from "./gomoku-logic.js";
self.onmessage = ({ data }) => self.postMessage(chooseMove(data));
