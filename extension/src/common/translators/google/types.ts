export interface GoogleTranslation {
  src: string; // detected source language
  sentences: Sentence[];
  dict?: DictionaryEntry[];
  spell?: SpellCorrection;
  alternative_translations?: AlternativeTranslation[];
  ld_result: LanguageDetectionResult;
  definitions?: DefinitionEntry[];
  synsets?: SynsetEntry[];
  examples?: ExampleEntry[];
  related_words?: RelatedWordsEntry;
}

interface Sentence {
  orig: string; // question (en->uk)
  trans: string; // запитання
  translit?: string; // zapytannya
  src_translit?: string; // ˈkwesCH(ə)n
}

interface DictionaryEntry {
  pos: string; // part of speech - noun, verb, etc.
  base_form: string; // in source lang
  terms: string[]; // translations for this word type
  entry: DictionarySubEntry[];
}

interface DictionarySubEntry {
  score: number;
  word: string; // single translation
  reverse_translation?: string[]; // in source lang
}

interface SpellCorrection {
  spell_res: string;
  spell_html_res: string;
}

interface AlternativeTranslation {
  src_phrase: string;
  raw_src_segment: string;
  start_pos: number;
  end_pos: number;
  alternative: AlternativeWord[];
}

interface AlternativeWord {
  word_postproc: string;
  score: number;
}

interface LanguageDetectionResult {
  extended_srclangs: string[];
  srclangs: string[];
  srclangs_confidences: number[];
}

interface DefinitionEntry {
  pos: string;
  base_form: string;
  entry: DefinitionSubEntry[];
}

interface DefinitionSubEntry {
  gloss: string;
  example: string;
  definition_id: string;
}

interface SynsetEntry {
  pos: string;
  base_form: string;
  entry: SynsetSubEntry[];
}

interface SynsetSubEntry {
  synonym: string[];
  definition_id: string;
}

interface ExampleEntry {
  example: ExampleDetail[];
}

interface ExampleDetail {
  text: string;
  definition_id: string;
}

interface RelatedWordsEntry {
  word: string[];
}