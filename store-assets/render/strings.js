// The headline over each shot in the stores, by listing language; *starred*
// words are in the accent colour, a [Key] is drawn as a key. The settings are
// shown on AMO only, without one.
const HEADLINES = {
  word: {
    en: "Hover over a word — see its *translation*",
    ru: "Незнакомое\u00a0слово? *Перевод* — прямо над ним",
    uk: "Незнайоме слово? *Переклад* — одразу над ним",
    ko: "모르는 단어? *번역*이 바로 위에",
    ja: "知らない単語？*翻訳*がすぐ上に",
    zh_CN: "遇到生词？*译文*就在上方",
    zh_TW: "遇到生字？*翻譯*就在上方",
    pt_BR: "Palavra nova? A\u00a0*tradução* aparece logo acima",
  },
  phrase: {
    en: "Hold [Shift] to translate a whole phrase",
    ru: "Целая фраза — с зажатой клавишей [Shift]",
    uk: "Ціла фраза — із затиснутою клавішею [Shift]",
    ko: "[Shift]를 누른 채 구절을 한 번에 번역",
    ja: "[Shift]を押しながらフレーズをまとめて翻訳",
    zh_CN: "按住 [Shift]，整个短语一起翻译",
    zh_TW: "按住 [Shift]，整個片語一起翻譯",
    pt_BR: "Segure [Shift] para traduzir a frase inteira",
  },
  context: {
    en: "*DeepL* translates words in context",
    ru: "*DeepL* переводит с учётом контекста",
    uk: "*DeepL* перекладає з\u00a0урахуванням контексту",
    ko: "*DeepL*은 문맥에 맞게 번역",
    ja: "*DeepL*は文脈に合わせて翻訳",
    zh_CN: "*DeepL* 结合上下文翻译",
    zh_TW: "*DeepL* 參考上下文翻譯",
    pt_BR: "O *DeepL* traduz conforme o contexto",
  },
  dictionary: {
    en: "Click a word to *save* it",
    ru: "Щелчок по слову — и оно в *словаре*",
    uk: "Клік по слову — і воно у *словнику*",
    ko: "단어를 클릭하면 *단어장*에 저장",
    ja: "単語をクリックして*単語帳*に保存",
    zh_CN: "点击单词，存入*生词本*",
    zh_TW: "點一下單字，存進*單字本*",
    pt_BR: "Um clique salva a palavra no *vocabulário*",
  },
  unspaced: {
    en: "Japanese and Chinese, *word by word*",
    ru: "Японский и китайский — *по словам*",
    uk: "Японська й китайська — *по словах*",
    ko: "일본어와 중국어도 *단어 단위로*",
    ja: "中国語の字幕も*単語ごと*に翻訳",
    zh_CN: "日语字幕也能*按词*翻译",
    zh_TW: "日文字幕也能*以詞為單位*翻譯",
    pt_BR: "Japonês e chinês, *palavra por palavra*",
  },
  autopause: {
    en: "The video *waits* while you read",
    ru: "Курсор на словах — видео на *паузе*",
    uk: "Курсор на словах — відео на *паузі*",
    ko: "자막에 마우스를 올리면 *일시중지*",
    ja: "字幕にマウスを重ねると*一時停止*",
    zh_CN: "悬停在字幕上，视频自动*暂停*",
    zh_TW: "滑鼠移到字幕上，影片自動*暫停*",
    pt_BR: "Mouse na legenda, vídeo em *pausa*",
  },
};

// Under a headline: the hovered word's translation without the line around
// it, struck out, then — in the accent colour — the one in the frame, which
// is taken from the tooltip when the frame is captured. `bad` is DeepL's own
// answer for the word alone (17.10.2026).
const NOTES = {
  context: {
    en: { without: "without context", bad: "weapon", with: "in context" },
    ru: { without: "без контекста", bad: "сарай", with: "с контекстом" },
    uk: { without: "без контексту", bad: "сарай", with: "з контекстом" },
    ko: { without: "문맥 없이", bad: "창고", with: "문맥 반영" },
    ja: { without: "文脈なし", bad: "小屋", with: "文脈あり" },
    zh_CN: { without: "脱离上下文", bad: "棚屋", with: "结合上下文" },
    zh_TW: { without: "不看上下文", bad: "棚屋", with: "參考上下文" },
    pt_BR: { without: "sem contexto", bad: "galpão", with: "com contexto" },
  },
};

// The second half of auto-pause, under its headline: the video plays on once
// the pointer leaves.
const AUTOPAUSE_NOTES = {
  en: "▶ plays on once the cursor moves away",
  ru: "▶ продолжится, когда курсор уйдёт со слов",
  uk: "▶ продовжиться, щойно курсор зійде зі слів",
  ko: "▶ 마우스를 옮기면 다시 재생",
  ja: "▶ カーソルを外すと再生を再開",
  zh_CN: "▶ 移开鼠标即继续播放",
  zh_TW: "▶ 滑鼠移開就接著播放",
  pt_BR: "▶ volta a tocar ao tirar o mouse",
};

// AMO's caption under each screenshot, which there carries no headline: a
// sentence that says what the shot shows, in the words of the store
// description. AMO takes up to 280 characters. Pasted by hand from
// amo/captions.txt.
const AMO_CAPTIONS = {
  word: {
    en: "Hover over a word in YouTube subtitles, and its translation appears right above it.",
    ru: "Достаточно навести курсор на слово в субтитрах YouTube — и перевод появится прямо над ним.",
    uk: "Досить навести курсор на слово в субтитрах YouTube — і переклад з'явиться прямо над ним.",
    ko: "유튜브 자막의 단어에 마우스를 올리기만 하면 바로 위에 번역이 뜹니다.",
    ja: "YouTubeの字幕の単語にマウスカーソルを合わせるだけで、すぐ上に訳が表示されます。",
    zh_CN: "把鼠标移到 YouTube 字幕里的单词上，译文就会显示在它正上方。",
    zh_TW: "把滑鼠移到 YouTube 字幕裡的單字上，翻譯就會出現在它正上方。",
    pt_BR: "É só passar o mouse sobre uma palavra da legenda do YouTube, e a tradução aparece logo acima.",
  },
  phrase: {
    en: "Found an idiom or a set expression? Hold Shift and sweep the pointer across the words to translate the whole phrase.",
    ru: "Идиому или устойчивое выражение можно перевести целиком: зажать Shift и провести курсором по словам.",
    uk: "Ідіому чи стійкий вираз можна перекласти цілком: затиснути Shift і провести курсором по словах.",
    ko: "관용구나 자주 쓰는 표현은 Shift 키를 누른 채 마우스로 단어들을 훑으면 구절 전체가 번역됩니다.",
    ja: "イディオムや決まった言い回しは、Shiftキーを押しながら単語をカーソルでなぞれば、フレーズをまとめて訳せます。",
    zh_CN: "遇到习语或固定搭配，按住 Shift 键用鼠标划过这几个词，就能把整个短语一起翻译。",
    zh_TW: "遇到慣用語或固定用法時，按住 Shift 鍵，用滑鼠劃過這幾個字，就能把整個片語一起翻譯。",
    pt_BR: "Apareceu uma expressão idiomática? Segure Shift e passe o mouse pelas palavras para traduzir a frase inteira.",
  },
  context: {
    en: "With DeepL (you'll need your own free API key), each word is translated in the context of its subtitle line, so a word with several meanings gets the one it has there.",
    ru: "С DeepL (понадобится свой бесплатный API-ключ) слово переводится с учётом всей строки субтитров, поэтому многозначное слово получает нужное значение.",
    uk: "З DeepL (знадобиться власний безкоштовний API-ключ) слово перекладається з урахуванням усього рядка субтитрів, тож багатозначне слово отримує потрібне значення.",
    ko: "DeepL을 쓰면(본인의 무료 API 키가 필요합니다) 자막 한 줄 전체를 고려해 번역하므로, 뜻이 여러 개인 단어도 문맥에 맞는 뜻으로 옮겨집니다.",
    ja: "DeepL（ご自身の無料APIキーが必要です）なら字幕の1行全体を踏まえて訳すので、意味がいくつもある単語も文脈に合った意味で訳されます。",
    zh_CN: "使用 DeepL（需要你自己的免费 API 密钥）时，每个词都会结合整行字幕来翻译，多义词也能译出它在这里的意思。",
    zh_TW: "使用 DeepL（需要你自己的免費 API 金鑰）時，每個字都會參考整行字幕來翻譯，所以多義詞也能譯出它在這句中的意思。",
    pt_BR: "Com o DeepL (você vai precisar da sua própria chave de API gratuita), cada palavra é traduzida levando em conta a linha inteira da legenda, então uma palavra com vários sentidos recebe o significado certo.",
  },
  dictionary: {
    en: "Click a word to save it with its translation. Export the list as CSV or JSON to review your new words later.",
    ru: "Щелчок по слову сохраняет его в словарь вместе с переводом. Словарь можно выгрузить в CSV или JSON, чтобы потом повторить новые слова.",
    uk: "Клік по слову зберігає його в словник разом із перекладом. Словник можна вивантажити в CSV або JSON, щоб потім повторити нові слова.",
    ko: "단어를 클릭하면 번역과 함께 단어장에 저장됩니다. 단어장은 CSV나 JSON으로 내보내 나중에 복습할 수 있습니다.",
    ja: "単語をクリックすると、訳と一緒に単語帳に保存されます。単語帳はCSVやJSONでエクスポートして、あとで復習できます。",
    zh_CN: "点击单词，连同译文一起存入生词本。生词本可以导出为 CSV 或 JSON，方便以后复习。",
    zh_TW: "點一下單字，就會連同譯文一起存進單字本。單字本可以匯出成 CSV 或 JSON，方便之後複習。",
    pt_BR: "Um clique salva a palavra no vocabulário junto com a tradução. Exporte a lista em CSV ou JSON para revisar as palavras novas depois.",
  },
  unspaced: {
    en: "Japanese, Chinese and Thai are written without spaces between words, yet you get the translation of one word, not the whole line.",
    ru: "В японском, китайском и тайском слова пишутся без пробелов, но переводится одно слово, а не вся строка.",
    uk: "У японській, китайській і тайській слова пишуться без пробілів, але перекладається одне слово, а не весь рядок.",
    ko: "일본어, 중국어, 태국어처럼 띄어 쓰지 않는 언어도 한 줄 전체가 아니라 단어 하나만 번역합니다.",
    ja: "日本語や中国語、タイ語のように単語の間にスペースを入れない言語でも、行全体ではなく一語だけを訳します。",
    zh_CN: "日语、中文、泰语这类词与词之间不加空格的语言，也能按词翻译：翻出来的是一个词，而不是一整行。",
    zh_TW: "日文、中文、泰文這類詞與詞之間不加空格的語言，也能以詞為單位翻譯：翻出來的是一個詞，而不是一整行。",
    pt_BR: "Japonês, chinês e tailandês não usam espaço entre as palavras, e mesmo assim você recebe a tradução de uma palavra, não da linha inteira.",
  },
  autopause: {
    en: "The video pauses while you read and plays on as soon as you move the pointer away.",
    ru: "Пока курсор на субтитрах, видео стоит на паузе и продолжается, как только курсор уйдёт.",
    uk: "Поки курсор на субтитрах, відео чекає на паузі й іде далі, щойно курсор зійде з них.",
    ko: "읽는 동안에는 영상이 저절로 멈추고, 마우스를 옮기면 바로 이어서 재생됩니다.",
    ja: "読んでいる間は動画が自動で一時停止し、カーソルを外すとすぐに再生が再開されます。",
    zh_CN: "读译文时视频自动暂停，鼠标一移开就接着播放。",
    zh_TW: "閱讀譯文時影片會自動暫停，滑鼠一移開就接著播放。",
    pt_BR: "O vídeo pausa enquanto você lê e volta a tocar assim que você tira o mouse de cima.",
  },
  settings: {
    en: "Choose Google, Bing or DeepL. Google and Bing work without a key. Free, with no subscriptions and no ads.",
    ru: "Переводить можно через Google, Bing или DeepL. Google и Bing работают без ключа. Бесплатно: без подписок и рекламы.",
    uk: "Перекладати можна через Google, Bing або DeepL. Google і Bing працюють без ключа. Безкоштовно: без підписок і реклами.",
    ko: "번역기는 Google, Bing, DeepL 중에서 고를 수 있습니다. Google과 Bing은 API 키 없이 바로 쓸 수 있습니다. 구독도 광고도 없이 무료입니다.",
    ja: "翻訳エンジンはGoogle、Bing、DeepLから選べます。GoogleとBingはAPIキーなしですぐに使えます。サブスクリプションも広告もなく無料です。",
    zh_CN: "翻译引擎可选 Google、Bing 或 DeepL。Google 和 Bing 无需 API 密钥即可使用。完全免费：没有订阅，没有广告。",
    zh_TW: "可以選擇用 Google、Bing 或 DeepL 翻譯。Google 和 Bing 不需要 API 金鑰就能用。完全免費：沒有訂閱，也沒有廣告。",
    pt_BR: "Traduza com Google, Bing ou DeepL. Google e Bing funcionam sem chave de API. De graça: sem assinatura e sem anúncios.",
  },
};

// The opening and the closing card of the promo video, which is in English.
const VIDEO_LINES = {
  opening: "Translate YouTube subtitles on *hover*",
  closing: "Free · Chrome · Edge · Firefox",
};

// CC BY asks for the author and the licence wherever the film is shown.
const CREDITS = {
  _cMxraX_5RE: "Sprite Fright © Blender Studio · CC BY 4.0",
  eRsGyueVLvQ: "Sintel © Blender Foundation · durian.blender.org · CC BY 3.0",
};

module.exports = { HEADLINES, NOTES, AUTOPAUSE_NOTES, AMO_CAPTIONS, VIDEO_LINES, CREDITS };
