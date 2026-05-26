import * as faceapi from "@vladmandic/face-api";
import { loadModels } from "../lib/face";
import path from "path";
import fs from "fs";

// Mock document/window if needed, but we are running in Node
// We can use sharp to do the same pixel operations as preprocessCanvasForDetection
// and see if the resulting face descriptor is different.
async function main() {
  console.log("This is a placeholder for checking embedding differences in Node.");
}

main();
