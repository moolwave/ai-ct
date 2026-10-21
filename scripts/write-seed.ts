import { mkdirSync, writeFileSync } from "fs";
import { buildDemo, demoAnswersCsv, demoQuestionsCsv } from "../src/lib/seed";

mkdirSync("data", { recursive: true });
mkdirSync("public/samples", { recursive: true });
writeFileSync("data/store.json", `${JSON.stringify({ projects: [buildDemo()] }, null, 2)}\n`);
writeFileSync("public/samples/hanbit-questions.csv", demoQuestionsCsv());
writeFileSync("public/samples/hanbit-answers.csv", demoAnswersCsv());
