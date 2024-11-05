require("dotenv").config();
const express = require("express");
const { body, validationResult } = require("express-validator");
const cors = require("cors");
const deepl = require("deepl-node");

const PORT = Number(process.env.APPLICATION_PORT) || 4000;

const createServer = async () => {
  try {
    const app = express();
    const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

    app.use(cors({
      // fixme: change extension id
      origin: ["chrome-extension://pdnbehknkknfhmndgbapgdjhjhalobfm","https://www.youtube.com"],
      methods: ["POST", "GET"],
      allowedHeaders: ["Content-Type", "Origin", "Accept"],
      optionsSuccessStatus: 200
    }));
    app.use(express.json());

    app.use((req, res, next) => {
      if (!process.env.DEEPL_API_KEY) {
        return res.status(400).send("API key not found");
      }

      next();
    });

    app.get("/languages", async (req, res) => {
      try {
        const [targetLanguages, sourceLanguages] = await Promise.all([
          translator.getTargetLanguages(),
          translator.getSourceLanguages()
        ]);

        res.send({ targetLanguages, sourceLanguages });
      } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
      }
    });

    app.post("/translate",
      [
        body("input").isString().notEmpty().withMessage("Input must be a non-empty string"),
        body("sourceLocale").isString().notEmpty().withMessage("Source locale must be a non-empty string"),
        body("targetLocale").isString().notEmpty().withMessage("Target locale must be a non-empty string")
      ],
      async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const { input, sourceLocale, targetLocale } = req.body;
        try {
          const result = await translator.translateText(
            input,
            sourceLocale === "auto" ? null : sourceLocale,
            targetLocale
          );

          if (!result.text) {
            return res.status(400).send("No translations found");
          }

          return res.send({ text: result.text });
        } catch (e) {
          console.error(e);
          res.status(500).send(e.message);
        }
      });

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on port ${PORT}!`);
    });
  } catch (e) {
    console.error(e);
  }
};

createServer();