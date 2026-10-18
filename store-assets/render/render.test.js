const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SETS, SHOTS, SHOT_ORDER, scene, storeShots } = require("./sets.js");
const { HEADLINES, NOTES, AUTOPAUSE_NOTES, AMO_CAPTIONS, CREDITS } = require("./strings.js");
const { withAccent } = require("./compose.js");

// What render.js needs before it opens a browser: a missing string would
// only show up as a screenshot without its headline, after minutes of capture.

test("every shot in the stores has a headline in every listing language", () => {
  for (const shot of SHOT_ORDER.filter((name) => name !== "settings")) {
    for (const set of Object.keys(SETS)) {
      assert.ok(HEADLINES[shot]?.[set], `${shot} has no headline in ${set}`);
    }
  }
});

test("the note under a headline is complete in every language that shot has", () => {
  for (const [shot, notes] of Object.entries(NOTES)) {
    for (const set of Object.keys(SETS)) {
      const note = notes[set];
      assert.ok(note, `${shot} has no note in ${set}`);
      assert.deepEqual(Object.keys(note).sort(), ["bad", "with", "without"], `${shot} ${set}`);
    }
  }
});

test("auto-pause has its note in every language", () => {
  for (const set of Object.keys(SETS)) assert.ok(AUTOPAUSE_NOTES[set], `no auto-pause note in ${set}`);
});

test("every AMO screenshot has a caption in every listing language, within AMO's 280 characters", () => {
  for (const shot of SHOT_ORDER) {
    for (const set of Object.keys(SETS)) {
      const caption = AMO_CAPTIONS[shot]?.[set];
      assert.ok(caption, `${shot} has no AMO caption in ${set}`);
      assert.ok(caption.length <= 280, `${shot} ${set}: ${caption.length} characters`);
    }
  }
});

test("every film shown is credited, as CC BY asks", () => {
  for (const shot of SHOT_ORDER.filter((name) => SHOTS[name] && name !== "dictionary")) {
    for (const set of Object.keys(SETS)) {
      const { video } = scene(set, shot);
      assert.ok(CREDITS[video], `${shot} in ${set} shows ${video} with no credit`);
    }
  }
  assert.ok(CREDITS[SHOTS.dictionaryBackground.video]);
});

test("each set finds its scene in the language of its captions", () => {
  assert.equal(scene("en", "word").captions, "es");
  assert.equal(scene("ru", "word").captions, "en");
  // The shot of a script without spaces shows Japanese, and Chinese to the Japanese.
  assert.equal(scene("ru", "unspaced").captions, "ja");
  assert.equal(scene("ja", "unspaced").captions, "zh-Hans");
  assert.equal(scene("ja", "unspaced").word, "孤身");
  assert.equal(scene("en", "dictionary").scenes.length, SHOTS.dictionary.es.length);
});

test("a headline marks its accent and its keys, and escapes the rest", () => {
  assert.equal(withAccent("see its *translation*"), "see its <em>translation</em>");
  assert.equal(withAccent("Hold [Shift] to"), "Hold <kbd>Shift</kbd> to");
  assert.equal(withAccent("a <b> & c"), "a &#60;b&#62; &#38; c");
  // A dash never starts a line.
  assert.equal(withAccent("слово — над ним"), "слово\u00a0— над ним");
});

test("Chrome gets five screenshots and Edge six, the same five first", () => {
  for (const set of Object.keys(SETS)) {
    const { chrome, edge } = storeShots(set);
    assert.equal(chrome.length, 5, set);
    assert.equal(edge.length, 6, set);
    assert.deepEqual(edge.slice(0, 5), chrome, set);
    assert.equal(new Set(edge).size, 6, `${set} shows a shot twice`);
    for (const shot of edge) assert.ok(SHOT_ORDER.includes(shot), `${set}: no shot ${shot}`);
  }
  // Japanese words to those who may learn Japanese, auto-pause to the rest.
  assert.equal(storeShots("ko").chrome[4], "unspaced");
  assert.equal(storeShots("ru").chrome[4], "autopause");
});
