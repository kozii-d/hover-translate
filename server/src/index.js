require("dotenv").config();
const express = require("express");
const { body, validationResult } = require("express-validator");
const cors = require("cors");

const PORT = Number(process.env.APPLICATION_PORT) || 4000;

const createServer = async () => {
  try {
    const app = express();

    app.use(cors({
      origin: "https://www.youtube.com",
      methods: ["POST"],
      allowedHeaders: ["Content-Type", "Origin", "Accept"],
      optionsSuccessStatus: 200
    }));
    app.use(express.json());

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

        if (!process.env.API_KEY) {
          return res.status(500).send("API key not found");
        }

        const url = `https://translation.googleapis.com/language/translate/v2?key=${process.env.API_KEY}`;
        const { input, sourceLocale, targetLocale } = req.body;

        try {

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: input,
              source: sourceLocale,
              target: targetLocale,
            })
          });

          const data = await response.json();
          const translations = data.data.translations.map(translation => translation.translatedText);

          if (!translations.length) {
            return res.status(500).send("No translations found");
          }

          return res.send({ translations });
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