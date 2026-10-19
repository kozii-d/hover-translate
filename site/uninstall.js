// The strings of the page that opens after the extension is removed (/uninstall/) and of its
// thanks page, in the extension's languages (the directories of _locales). The pages are written
// in English; this puts the browser's language in place of it. Only an improvement: without it
// the pages are in English and work the same. The reasons keep their English values in every
// language, so all the answers are read against one list.
(function () {
  var STRINGS = {
    en: {
      heading: "HoverTranslate has been removed",
      intro:
        "If you have a moment, tell us what didn't work — it's one question, and it helps us fix it for others.",
      question: "What made you remove it?",
      reasonVideos: "It didn't work on the videos I watched",
      reasonTranslations: "The translations were wrong or slow",
      reasonInTheWay: "It got in the way while watching",
      reasonDual: "I wanted dual subtitles or the whole line translated",
      reasonSites: "I need it on Netflix or other sites",
      reasonTrying: "I was only trying it out",
      reasonOther: "Something else",
      details: "Anything else we should know? (optional)",
      send: "Send",
      sentNote:
        "Your answer goes through Web3Forms, which emails it to us. As with any web request, Web3Forms also sees your IP address and browser.",
      privacyLink: "Privacy policy",
      mindChanged: "Changed your mind? Install it again:",
      bug: "Found a bug?",
      bugLink: "Tell us on GitHub",
      thanksTitle: "Thank you — HoverTranslate",
      thanksHeading: "Thank you",
      thanksText:
        "We've got your answer. It helps us decide what to fix first.",
    },
    ar: {
      heading: "تمت إزالة إضافة HoverTranslate",
      intro:
        "إذا كان لديك دقيقة، فأخبرنا بما لم ينجح. إنه سؤال واحد فقط، ويساعدنا على إصلاح المشكلة للآخرين.",
      question: "ما الذي دفعك إلى إزالتها؟",
      reasonVideos: "لم تعمل على الفيديوهات التي شاهدتها",
      reasonTranslations: "كانت الترجمات خاطئة أو بطيئة",
      reasonInTheWay: "كانت تزعجني أثناء المشاهدة",
      reasonDual: "أردت عرض الترجمة بلغتين معًا أو ترجمة السطر كاملاً",
      reasonSites: "أحتاج إليها على Netflix أو مواقع أخرى",
      reasonTrying: "كنت أجرّبها فقط",
      reasonOther: "سبب آخر",
      details: "هل هناك شيء آخر يجب أن نعرفه؟ (اختياري)",
      send: "إرسال",
      sentNote:
        "يُرسَل جوابك عبر خدمة Web3Forms التي تُحوّله إلينا بالبريد الإلكتروني. وكما في أي طلب على الويب، ترى Web3Forms أيضًا عنوان IP الخاص بك ومتصفحك.",
      privacyLink: "سياسة الخصوصية",
      mindChanged: "غيّرت رأيك؟ ثبّتها من جديد:",
      bug: "وجدت خطأً؟",
      bugLink: "أخبرنا على GitHub",
      thanksTitle: "شكرًا لك — HoverTranslate",
      thanksHeading: "شكرًا لك",
      thanksText: "وصلنا جوابك. سيساعدنا على تحديد ما نصلحه أولاً.",
    },
    cs: {
      heading: "Rozšíření HoverTranslate bylo odstraněno",
      intro:
        "Pokud máte chvilku, napište nám, co nefungovalo. Je to jen jedna otázka a pomůže nám to opravit pro ostatní.",
      question: "Proč jste rozšíření odstranili?",
      reasonVideos: "Na videích, která sleduji, nefungovalo",
      reasonTranslations: "Překlady byly špatné nebo pomalé",
      reasonInTheWay: "Při sledování překáželo",
      reasonDual: "Potřebuji dvojjazyčné titulky nebo překlad celého řádku",
      reasonSites: "Potřebuji ho na Netflixu nebo jiných webech",
      reasonTrying: "Šlo mi jen o vyzkoušení",
      reasonOther: "Něco jiného",
      details: "Chcete nám ještě něco sdělit? (nepovinné)",
      send: "Odeslat",
      sentNote:
        "Vaše odpověď jde přes službu Web3Forms, která nám ji pošle e-mailem. Jako u každého webového požadavku uvidí Web3Forms také vaši IP adresu a prohlížeč.",
      privacyLink: "Zásady ochrany soukromí",
      mindChanged: "Rozmysleli jste si to? Nainstalujte ho znovu:",
      bug: "Narazili jste na chybu?",
      bugLink: "Napište nám na GitHub",
      thanksTitle: "Děkujeme — HoverTranslate",
      thanksHeading: "Děkujeme",
      thanksText:
        "Vaši odpověď máme. Pomůže nám rozhodnout, co opravit nejdřív.",
    },
    de: {
      heading: "HoverTranslate wurde entfernt",
      intro:
        "Wenn du kurz Zeit hast, sag uns, was nicht funktioniert hat – es ist nur eine Frage, und sie hilft uns, das Problem für andere zu beheben.",
      question: "Warum hast du es entfernt?",
      reasonVideos:
        "Bei den Videos, die ich angesehen habe, hat es nicht funktioniert",
      reasonTranslations: "Die Übersetzungen waren falsch oder langsam",
      reasonInTheWay: "Es hat beim Ansehen gestört",
      reasonDual:
        "Ich wollte zweisprachige Untertitel oder eine Übersetzung der ganzen Zeile",
      reasonSites: "Ich brauche es auf Netflix oder anderen Websites",
      reasonTrying: "Ich wollte es nur ausprobieren",
      reasonOther: "Etwas anderes",
      details: "Möchtest du uns noch etwas mitteilen? (optional)",
      send: "Senden",
      sentNote:
        "Deine Antwort geht über Web3Forms, das sie uns per E-Mail weiterleitet. Wie bei jeder Anfrage im Web sieht Web3Forms dabei auch deine IP-Adresse und deinen Browser.",
      privacyLink: "Datenschutzerklärung",
      mindChanged:
        "Doch anders entschieden? Hier kannst du es wieder installieren:",
      bug: "Einen Fehler gefunden?",
      bugLink: "Melde ihn auf GitHub",
      thanksTitle: "Danke – HoverTranslate",
      thanksHeading: "Danke",
      thanksText:
        "Deine Antwort ist angekommen. Sie hilft uns zu entscheiden, was wir zuerst beheben.",
    },
    el: {
      heading: "Το HoverTranslate καταργήθηκε",
      intro:
        "Αν έχετε ένα λεπτό, πείτε μας τι δεν λειτούργησε. Είναι μία μόνο ερώτηση και μας βοηθά να το διορθώσουμε για τους άλλους.",
      question: "Γιατί το καταργήσατε;",
      reasonVideos: "Δεν λειτουργούσε στα βίντεο που έβλεπα",
      reasonTranslations: "Οι μεταφράσεις ήταν λάθος ή αργές",
      reasonInTheWay: "Με ενοχλούσε όσο έβλεπα",
      reasonDual: "Ήθελα διπλούς υπότιτλους ή μετάφραση ολόκληρης της γραμμής",
      reasonSites: "Το χρειάζομαι στο Netflix ή σε άλλους ιστότοπους",
      reasonTrying: "Απλώς το δοκίμαζα",
      reasonOther: "Κάτι άλλο",
      details: "Θέλετε να μας πείτε κάτι ακόμα; (προαιρετικό)",
      send: "Αποστολή",
      sentNote:
        "Η απάντησή σας περνά από το Web3Forms, που μας τη στέλνει με email. Όπως σε κάθε αίτημα στο διαδίκτυο, το Web3Forms βλέπει επίσης τη διεύθυνση IP και το πρόγραμμα περιήγησής σας.",
      privacyLink: "Πολιτική απορρήτου",
      mindChanged: "Αλλάξατε γνώμη; Εγκαταστήστε το ξανά:",
      bug: "Βρήκατε κάποιο σφάλμα;",
      bugLink: "Πείτε μας στο GitHub",
      thanksTitle: "Ευχαριστούμε — HoverTranslate",
      thanksHeading: "Ευχαριστούμε",
      thanksText:
        "Λάβαμε την απάντησή σας. Μας βοηθά να αποφασίσουμε τι θα διορθώσουμε πρώτα.",
    },
    es: {
      heading: "Se quitó HoverTranslate",
      intro:
        "Si tienes un momento, cuéntanos qué no funcionó. Es solo una pregunta y nos ayuda a solucionarlo para otras personas.",
      question: "¿Por qué lo quitaste?",
      reasonVideos: "No funcionó en los videos que vi",
      reasonTranslations: "Las traducciones eran incorrectas o lentas",
      reasonInTheWay: "Me molestaba mientras miraba los videos",
      reasonDual: "Quería subtítulos dobles o la línea completa traducida",
      reasonSites: "Lo necesito en Netflix o en otros sitios",
      reasonTrying: "Solo lo estaba probando",
      reasonOther: "Otro motivo",
      details: "¿Algo más que debamos saber? (opcional)",
      send: "Enviar",
      sentNote:
        "Tu respuesta pasa por Web3Forms, que nos la envía por correo electrónico. Como en cualquier solicitud web, Web3Forms también ve tu dirección IP y tu navegador.",
      privacyLink: "Política de privacidad",
      mindChanged: "¿Cambiaste de opinión? Vuelve a instalarlo:",
      bug: "¿Encontraste un error?",
      bugLink: "Cuéntanos en GitHub",
      thanksTitle: "Gracias — HoverTranslate",
      thanksHeading: "Gracias",
      thanksText:
        "Recibimos tu respuesta. Nos ayuda a decidir qué corregir primero.",
    },
    fi: {
      heading: "HoverTranslate on poistettu",
      intro:
        "Jos sinulla on hetki aikaa, kerro meille, mikä ei toiminut. Se on vain yksi kysymys, ja se auttaa meitä korjaamaan asian muille.",
      question: "Miksi poistit sen?",
      reasonVideos: "Se ei toiminut katsomissani videoissa",
      reasonTranslations: "Käännökset olivat vääriä tai hitaita",
      reasonInTheWay: "Se häiritsi katselua",
      reasonDual:
        "Halusin kaksikieliset tekstitykset tai koko rivin käännöksen",
      reasonSites: "Tarvitsen sitä Netflixissä tai muilla sivustoilla",
      reasonTrying: "Kokeilin sitä vain",
      reasonOther: "Jokin muu",
      details: "Haluatko kertoa vielä jotain? (valinnainen)",
      send: "Lähetä",
      sentNote:
        "Vastauksesi kulkee Web3Formsin kautta, joka lähettää sen meille sähköpostilla. Kuten minkä tahansa verkkopyynnön yhteydessä, Web3Forms näkee myös IP-osoitteesi ja selaimesi.",
      privacyLink: "Tietosuojakäytäntö",
      mindChanged: "Muutitko mielesi? Asenna se uudelleen:",
      bug: "Löysitkö virheen?",
      bugLink: "Kerro siitä GitHubissa",
      thanksTitle: "Kiitos – HoverTranslate",
      thanksHeading: "Kiitos",
      thanksText:
        "Vastauksesi tuli perille. Se auttaa meitä päättämään, mitä korjaamme ensin.",
    },
    fr: {
      heading: "HoverTranslate a été supprimé",
      intro:
        "Si vous avez un instant, dites-nous ce qui n'a pas fonctionné. Il n'y a qu'une question, et cela nous aide à corriger le problème pour les autres.",
      question: "Pourquoi l'avez-vous supprimé\u00a0?",
      reasonVideos: "Il ne fonctionnait pas sur les vidéos que je regardais",
      reasonTranslations: "Les traductions étaient fausses ou lentes",
      reasonInTheWay: "Il me gênait pendant le visionnage",
      reasonDual:
        "Je voulais des sous-titres bilingues ou la traduction de toute la ligne",
      reasonSites: "J'en ai besoin sur Netflix ou sur d'autres sites",
      reasonTrying: "Je voulais seulement l'essayer",
      reasonOther: "Autre chose",
      details: "Autre chose à nous dire\u00a0? (facultatif)",
      send: "Envoyer",
      sentNote:
        "Votre réponse passe par Web3Forms, qui nous la transmet par e-mail. Comme pour toute requête web, Web3Forms voit aussi votre adresse IP et votre navigateur.",
      privacyLink: "Politique de confidentialité",
      mindChanged: "Vous avez changé d'avis\u00a0? Réinstallez-le\u00a0:",
      bug: "Vous avez trouvé un bug\u00a0?",
      bugLink: "Signalez-le sur GitHub",
      thanksTitle: "Merci — HoverTranslate",
      thanksHeading: "Merci",
      thanksText:
        "Nous avons bien reçu votre réponse. Elle nous aide à décider quoi corriger en priorité.",
    },
    hi: {
      heading: "HoverTranslate निकाल दिया गया है",
      intro:
        "अगर आपके पास एक पल हो, तो हमें बताइए कि क्या ठीक से काम नहीं किया। यह बस एक सवाल है, और इससे हम दूसरों के लिए इसे ठीक कर पाएंगे।",
      question: "आपने इसे क्यों निकाला?",
      reasonVideos: "मेरे देखे वीडियो पर यह काम नहीं किया",
      reasonTranslations: "अनुवाद गलत थे या धीमे थे",
      reasonInTheWay: "वीडियो देखते समय यह रुकावट डालता था",
      reasonDual: "मुझे दोहरे सबटाइटल या पूरी लाइन का अनुवाद चाहिए था",
      reasonSites: "मुझे इसकी ज़रूरत Netflix या दूसरी साइटों पर है",
      reasonTrying: "बस आज़माने के लिए इंस्टॉल किया था",
      reasonOther: "कुछ और",
      details: "क्या कोई और बात है जो हमें जाननी चाहिए? (वैकल्पिक)",
      send: "भेजें",
      sentNote:
        "आपका जवाब Web3Forms के ज़रिए जाता है, जो इसे हमें ईमेल से भेजता है। किसी भी वेब अनुरोध की तरह, Web3Forms को आपका IP पता और ब्राउज़र भी दिखता है।",
      privacyLink: "निजता नीति",
      mindChanged: "इरादा बदल गया? इसे फिर से इंस्टॉल करें:",
      bug: "कोई गड़बड़ी मिली?",
      bugLink: "GitHub पर बताएं",
      thanksTitle: "धन्यवाद — HoverTranslate",
      thanksHeading: "धन्यवाद",
      thanksText:
        "आपका जवाब हमें मिल गया है। इससे हमें तय करने में मदद मिलती है कि पहले क्या ठीक करें।",
    },
    hu: {
      heading: "A HoverTranslate eltávolítva",
      intro:
        "Ha van egy perced, írd meg, mi nem működött. Csak egy kérdés, és segít, hogy mások számára kijavítsuk a hibát.",
      question: "Miért távolítottad el?",
      reasonVideos: "Nem működött a videókon, amelyeket néztem",
      reasonTranslations: "A fordítások rosszak vagy lassúak voltak",
      reasonInTheWay: "Zavart a videók nézése közben",
      reasonDual:
        "Kétnyelvű feliratot vagy az egész sor fordítását szerettem volna",
      reasonSites: "Netflixen vagy más oldalakon is szükségem lenne rá",
      reasonTrying: "Csak kipróbáltam",
      reasonOther: "Más ok",
      details: "Van még valami, amit tudnunk kellene? (nem kötelező)",
      send: "Küldés",
      sentNote:
        "A válaszod a Web3Formson keresztül, e-mailben jut el hozzánk. Mint bármely webes kérésnél, a Web3Forms az IP-címedet és a böngésződet is látja.",
      privacyLink: "Adatvédelmi irányelvek",
      mindChanged: "Meggondoltad magad? Telepítsd újra:",
      bug: "Hibát találtál?",
      bugLink: "Jelezd a GitHubon",
      thanksTitle: "Köszönjük – HoverTranslate",
      thanksHeading: "Köszönjük",
      thanksText:
        "Megkaptuk a válaszodat. Segít eldönteni, mit javítsunk először.",
    },
    id: {
      heading: "HoverTranslate telah dihapus",
      intro:
        "Jika Anda punya waktu sebentar, beri tahu kami apa yang tidak berfungsi. Hanya satu pertanyaan, dan ini membantu kami memperbaikinya untuk orang lain.",
      question: "Apa yang membuat Anda menghapusnya?",
      reasonVideos: "Tidak berfungsi di video yang saya tonton",
      reasonTranslations: "Terjemahannya salah atau lambat",
      reasonInTheWay: "Mengganggu saat menonton",
      reasonDual: "Saya ingin subtitle ganda atau terjemahan satu baris penuh",
      reasonSites: "Saya membutuhkannya di Netflix atau situs lain",
      reasonTrying: "Saya hanya mencobanya",
      reasonOther: "Alasan lain",
      details: "Ada hal lain yang perlu kami ketahui? (opsional)",
      send: "Kirim",
      sentNote:
        "Jawaban Anda dikirim melalui Web3Forms, yang meneruskannya kepada kami lewat email. Seperti pada permintaan web apa pun, Web3Forms juga melihat alamat IP dan browser Anda.",
      privacyLink: "Kebijakan privasi",
      mindChanged: "Berubah pikiran? Pasang lagi:",
      bug: "Menemukan bug?",
      bugLink: "Beri tahu kami di GitHub",
      thanksTitle: "Terima kasih — HoverTranslate",
      thanksHeading: "Terima kasih",
      thanksText:
        "Jawaban Anda sudah kami terima. Ini membantu kami memutuskan apa yang perlu diperbaiki lebih dulu.",
    },
    it: {
      heading: "HoverTranslate è stato rimosso",
      intro:
        "Se hai un momento, dicci cosa non ha funzionato. È una sola domanda e ci aiuta a sistemarlo per gli altri.",
      question: "Perché l'hai rimosso?",
      reasonVideos: "Non funzionava sui video che guardavo",
      reasonTranslations: "Le traduzioni erano sbagliate o lente",
      reasonInTheWay: "Mi dava fastidio durante la visione",
      reasonDual: "Volevo sottotitoli doppi o la traduzione dell'intera riga",
      reasonSites: "Mi serve su Netflix o su altri siti",
      reasonTrying: "Lo stavo solo provando",
      reasonOther: "Altro",
      details: "C'è altro che dovremmo sapere? (facoltativo)",
      send: "Invia",
      sentNote:
        "La tua risposta passa da Web3Forms, che ce la inoltra via email. Come per qualsiasi richiesta web, Web3Forms vede anche il tuo indirizzo IP e il tuo browser.",
      privacyLink: "Informativa sulla privacy",
      mindChanged: "Hai cambiato idea? Installalo di nuovo:",
      bug: "Hai trovato un bug?",
      bugLink: "Segnalacelo su GitHub",
      thanksTitle: "Grazie — HoverTranslate",
      thanksHeading: "Grazie",
      thanksText:
        "Abbiamo ricevuto la tua risposta. Ci aiuta a decidere cosa correggere per primo.",
    },
    ja: {
      heading: "HoverTranslate は削除されました",
      intro:
        "少しお時間があれば、うまくいかなかった点を教えてください。質問は 1 つだけで、ほかの方のための改善に役立てます。",
      question: "削除した理由は何ですか？",
      reasonVideos: "見ていた動画で動作しなかった",
      reasonTranslations: "翻訳が間違っていた、または遅かった",
      reasonInTheWay: "視聴の邪魔になった",
      reasonDual: "2 か国語字幕や、行全体の翻訳がほしかった",
      reasonSites: "Netflix やほかのサイトでも使いたい",
      reasonTrying: "試してみただけ",
      reasonOther: "その他",
      details: "ほかに伝えたいことはありますか？（任意）",
      send: "送信",
      sentNote:
        "回答は Web3Forms を経由して、メールで私たちに届きます。ほかのウェブ上のリクエストと同様に、Web3Forms には IP アドレスとブラウザの情報も伝わります。",
      privacyLink: "プライバシー ポリシー",
      mindChanged: "気が変わりましたか？もう一度インストールできます：",
      bug: "不具合を見つけましたか？",
      bugLink: "GitHub でお知らせください",
      thanksTitle: "ありがとうございました — HoverTranslate",
      thanksHeading: "ありがとうございました",
      thanksText:
        "回答を受け取りました。どこから直すかを決めるのに役立てます。",
    },
    ko: {
      heading: "HoverTranslate가 삭제되었습니다",
      intro:
        "잠시 시간이 있으시다면 무엇이 제대로 되지 않았는지 알려 주세요. 질문은 하나뿐이며, 다른 사용자를 위해 문제를 고치는 데 도움이 됩니다.",
      question: "삭제하신 이유는 무엇인가요?",
      reasonVideos: "시청한 동영상에서 작동하지 않음",
      reasonTranslations: "번역이 틀리거나 느림",
      reasonInTheWay: "시청할 때 방해가 됨",
      reasonDual: "이중 자막이나 한 줄 전체 번역이 필요함",
      reasonSites: "Netflix나 다른 사이트에서도 쓰고 싶음",
      reasonTrying: "한번 써 본 것뿐임",
      reasonOther: "기타",
      details: "그 밖에 알려 주실 내용이 있나요? (선택사항)",
      send: "보내기",
      sentNote:
        "답변은 Web3Forms를 거쳐 이메일로 저희에게 전달됩니다. 다른 웹 요청과 마찬가지로 Web3Forms에도 IP 주소와 브라우저 정보가 전달됩니다.",
      privacyLink: "개인정보처리방침",
      mindChanged: "마음이 바뀌셨나요? 다시 설치하기:",
      bug: "버그를 발견하셨나요?",
      bugLink: "GitHub에 알려 주세요",
      thanksTitle: "감사합니다 — HoverTranslate",
      thanksHeading: "감사합니다",
      thanksText:
        "답변을 잘 받았습니다. 무엇부터 고칠지 정하는 데 도움이 됩니다.",
    },
    pl: {
      heading: "Rozszerzenie HoverTranslate zostało usunięte",
      intro:
        "Jeśli masz chwilę, napisz nam, co nie działało. To tylko jedno pytanie, a pomoże nam naprawić to dla innych.",
      question: "Jaki był powód usunięcia?",
      reasonVideos: "Nie działało na filmach, które oglądam",
      reasonTranslations: "Tłumaczenia były błędne lub wolne",
      reasonInTheWay: "Przeszkadzało podczas oglądania",
      reasonDual: "Potrzebuję podwójnych napisów lub tłumaczenia całej linijki",
      reasonSites: "Potrzebuję go na Netflixie lub innych stronach",
      reasonTrying: "Chodziło mi tylko o wypróbowanie",
      reasonOther: "Coś innego",
      details: "Chcesz nam przekazać coś jeszcze? (opcjonalnie)",
      send: "Wyślij",
      sentNote:
        "Twoja odpowiedź trafia do nas przez Web3Forms, który przesyła ją e-mailem. Jak przy każdym żądaniu w sieci, Web3Forms widzi też Twój adres IP i przeglądarkę.",
      privacyLink: "Polityka prywatności",
      mindChanged: "Zmieniasz zdanie? Zainstaluj je ponownie:",
      bug: "Coś działa nie tak?",
      bugLink: "Zgłoś to na GitHubie",
      thanksTitle: "Dziękujemy — HoverTranslate",
      thanksHeading: "Dziękujemy",
      thanksText:
        "Twoja odpowiedź do nas dotarła. Pomoże nam zdecydować, co naprawić najpierw.",
    },
    pt_BR: {
      heading: "O HoverTranslate foi removido",
      intro:
        "Se tiver um minuto, conte para a gente o que não funcionou. É só uma pergunta, e ela nos ajuda a corrigir isso para outras pessoas.",
      question: "Por que você o removeu?",
      reasonVideos: "Não funcionou nos vídeos que eu assisti",
      reasonTranslations: "As traduções estavam erradas ou lentas",
      reasonInTheWay: "Atrapalhava enquanto eu assistia",
      reasonDual: "Eu queria legendas duplas ou a linha inteira traduzida",
      reasonSites: "Preciso dele na Netflix ou em outros sites",
      reasonTrying: "Eu só estava testando",
      reasonOther: "Outro motivo",
      details: "Quer contar mais alguma coisa? (opcional)",
      send: "Enviar",
      sentNote:
        "Sua resposta passa pelo Web3Forms, que a envia para nós por e-mail. Como em qualquer solicitação na web, o Web3Forms também vê seu endereço IP e seu navegador.",
      privacyLink: "Política de privacidade",
      mindChanged: "Mudou de ideia? Instale de novo:",
      bug: "Encontrou um bug?",
      bugLink: "Conte para a gente no GitHub",
      thanksTitle: "Obrigado — HoverTranslate",
      thanksHeading: "Obrigado",
      thanksText:
        "Recebemos sua resposta. Ela nos ajuda a decidir o que corrigir primeiro.",
    },
    pt_PT: {
      heading: "O HoverTranslate foi removido",
      intro:
        "Se tiver um momento, diga-nos o que não funcionou. É só uma pergunta e ajuda-nos a corrigir o problema para outras pessoas.",
      question: "Porque o removeu?",
      reasonVideos: "Não funcionava nos vídeos que eu via",
      reasonTranslations: "As traduções estavam erradas ou eram lentas",
      reasonInTheWay: "Atrapalhava enquanto via os vídeos",
      reasonDual: "Queria legendas duplas ou a tradução da linha inteira",
      reasonSites: "Preciso dele na Netflix ou noutros sites",
      reasonTrying: "Estava só a experimentar",
      reasonOther: "Outro motivo",
      details: "Há mais alguma coisa que devamos saber? (opcional)",
      send: "Enviar",
      sentNote:
        "A sua resposta passa pelo Web3Forms, que no-la envia por e-mail. Como em qualquer pedido na Web, o Web3Forms também vê o seu endereço IP e o seu navegador.",
      privacyLink: "Política de privacidade",
      mindChanged: "Mudou de ideias? Instale-o novamente:",
      bug: "Encontrou um erro?",
      bugLink: "Diga-nos no GitHub",
      thanksTitle: "Obrigado — HoverTranslate",
      thanksHeading: "Obrigado",
      thanksText:
        "Recebemos a sua resposta. Ajuda-nos a decidir o que corrigir primeiro.",
    },
    ru: {
      heading: "Расширение HoverTranslate удалено",
      intro:
        "Если у вас есть минута, расскажите, что не сработало. Это всего один вопрос, и он поможет нам исправить проблему для других.",
      question: "Почему вы его удалили?",
      reasonVideos: "Не работало на видео, которые я смотрю",
      reasonTranslations: "Переводы были неточными или медленными",
      reasonInTheWay: "Мешало смотреть видео",
      reasonDual: "Нужны были двойные субтитры или перевод всей строки",
      reasonSites: "Нужно на Netflix или других сайтах",
      reasonTrying: "Просто хотелось попробовать",
      reasonOther: "Другое",
      details: "Хотите рассказать что-то ещё? (необязательно)",
      send: "Отправить",
      sentNote:
        "Ваш ответ проходит через Web3Forms — сервис пересылает его нам по почте. Как и при любом запросе в интернете, Web3Forms видит также ваш IP-адрес и браузер.",
      privacyLink: "Политика конфиденциальности",
      mindChanged: "Передумали? Установите снова:",
      bug: "Нашли ошибку?",
      bugLink: "Напишите нам на GitHub",
      thanksTitle: "Спасибо — HoverTranslate",
      thanksHeading: "Спасибо",
      thanksText:
        "Ваш ответ получен. Он поможет нам решить, что исправлять в первую очередь.",
    },
    sv: {
      heading: "HoverTranslate har tagits bort",
      intro:
        "Om du har en stund, berätta vad som inte fungerade. Det är bara en fråga, och den hjälper oss att rätta till det för andra.",
      question: "Varför tog du bort det?",
      reasonVideos: "Det fungerade inte på videorna jag tittade på",
      reasonTranslations: "Översättningarna var fel eller långsamma",
      reasonInTheWay: "Det var i vägen när jag tittade",
      reasonDual: "Jag ville ha dubbla undertexter eller hela raden översatt",
      reasonSites: "Jag behöver det på Netflix eller andra webbplatser",
      reasonTrying: "Jag ville bara testa det",
      reasonOther: "Något annat",
      details: "Är det något mer vi borde veta? (valfritt)",
      send: "Skicka",
      sentNote:
        "Ditt svar går via Web3Forms, som mejlar det till oss. Som vid alla förfrågningar på webben ser Web3Forms också din IP-adress och webbläsare.",
      privacyLink: "Integritetspolicy",
      mindChanged: "Ändrat dig? Installera det igen:",
      bug: "Hittat en bugg?",
      bugLink: "Berätta på GitHub",
      thanksTitle: "Tack – HoverTranslate",
      thanksHeading: "Tack",
      thanksText:
        "Vi har fått ditt svar. Det hjälper oss att bestämma vad vi ska rätta först.",
    },
    tr: {
      heading: "HoverTranslate kaldırıldı",
      intro:
        "Bir dakikanız varsa neyin çalışmadığını bize söyleyin. Yalnızca tek bir soru; sorunu başkaları için düzeltmemize yardımcı olur.",
      question: "Neden kaldırdınız?",
      reasonVideos: "İzlediğim videolarda çalışmadı",
      reasonTranslations: "Çeviriler yanlış ya da yavaştı",
      reasonInTheWay: "İzlerken rahatsız etti",
      reasonDual: "Çift altyazı ya da satırın tamamının çevirisini istiyordum",
      reasonSites: "Netflix'te veya başka sitelerde de ihtiyacım var",
      reasonTrying: "Sadece deniyordum",
      reasonOther: "Başka bir neden",
      details: "Bilmemiz gereken başka bir şey var mı? (isteğe bağlı)",
      send: "Gönder",
      sentNote:
        "Yanıtınız Web3Forms üzerinden bize e-postayla ulaşır. Her web isteğinde olduğu gibi Web3Forms, IP adresinizi ve tarayıcınızı da görür.",
      privacyLink: "Gizlilik politikası",
      mindChanged: "Fikrinizi mi değiştirdiniz? Yeniden yükleyin:",
      bug: "Hata mı buldunuz?",
      bugLink: "GitHub'da bize bildirin",
      thanksTitle: "Teşekkürler — HoverTranslate",
      thanksHeading: "Teşekkürler",
      thanksText:
        "Yanıtınızı aldık. Önce neyi düzelteceğimize karar vermemize yardımcı oluyor.",
    },
    uk: {
      heading: "Розширення HoverTranslate видалено",
      intro:
        "Якщо маєте хвилинку, розкажіть, що не спрацювало. Це лише одне запитання, і воно допоможе нам виправити це для інших.",
      question: "Чому ви його видалили?",
      reasonVideos: "Не працювало на відео, які я дивлюся",
      reasonTranslations: "Переклади були неточними або повільними",
      reasonInTheWay: "Заважало дивитися відео",
      reasonDual: "Потрібні були подвійні субтитри або переклад усього рядка",
      reasonSites: "Потрібно на Netflix або інших сайтах",
      reasonTrying: "Просто хотілося спробувати",
      reasonOther: "Інше",
      details: "Хочете розповісти щось іще? (необов'язково)",
      send: "Надіслати",
      sentNote:
        "Ваша відповідь проходить через Web3Forms — сервіс пересилає її нам поштою. Як і під час будь-якого запиту в інтернеті, Web3Forms бачить також вашу IP-адресу та браузер.",
      privacyLink: "Політика конфіденційності",
      mindChanged: "Передумали? Установіть знову:",
      bug: "Знайшли помилку?",
      bugLink: "Напишіть нам на GitHub",
      thanksTitle: "Дякуємо — HoverTranslate",
      thanksHeading: "Дякуємо",
      thanksText:
        "Вашу відповідь отримано. Вона допоможе нам вирішити, що виправляти насамперед.",
    },
    vi: {
      heading: "Đã xóa HoverTranslate",
      intro:
        "Nếu có chút thời gian, hãy cho chúng tôi biết điều gì chưa ổn. Chỉ một câu hỏi thôi, và nó giúp chúng tôi khắc phục cho những người dùng khác.",
      question: "Vì sao bạn xóa tiện ích này?",
      reasonVideos: "Không hoạt động trên các video tôi xem",
      reasonTranslations: "Bản dịch sai hoặc chậm",
      reasonInTheWay: "Gây vướng khi xem video",
      reasonDual: "Tôi muốn có phụ đề song ngữ hoặc dịch cả dòng",
      reasonSites: "Tôi cần dùng trên Netflix hoặc các trang khác",
      reasonTrying: "Tôi chỉ dùng thử",
      reasonOther: "Lý do khác",
      details: "Bạn còn muốn chia sẻ điều gì không? (không bắt buộc)",
      send: "Gửi",
      sentNote:
        "Câu trả lời của bạn được gửi qua Web3Forms, dịch vụ này chuyển nó đến chúng tôi qua email. Như với mọi yêu cầu trên web, Web3Forms cũng thấy địa chỉ IP và trình duyệt của bạn.",
      privacyLink: "Chính sách quyền riêng tư",
      mindChanged: "Bạn đổi ý? Cài đặt lại:",
      bug: "Bạn phát hiện lỗi?",
      bugLink: "Báo cho chúng tôi trên GitHub",
      thanksTitle: "Cảm ơn bạn — HoverTranslate",
      thanksHeading: "Cảm ơn bạn",
      thanksText:
        "Chúng tôi đã nhận được câu trả lời của bạn. Nó giúp chúng tôi quyết định nên sửa gì trước.",
    },
    zh_CN: {
      heading: "HoverTranslate 已移除",
      intro:
        "如果你有一点时间，请告诉我们哪里不好用。只有一个问题，能帮我们为其他人改进。",
      question: "你为什么移除它？",
      reasonVideos: "在我看的视频上无法使用",
      reasonTranslations: "翻译不准确或太慢",
      reasonInTheWay: "看视频时碍事",
      reasonDual: "我想要双语字幕或整行翻译",
      reasonSites: "我需要在 Netflix 或其他网站上使用",
      reasonTrying: "只是试用一下",
      reasonOther: "其他原因",
      details: "还有什么想告诉我们的吗？（选填）",
      send: "发送",
      sentNote:
        "你的回答会经由 Web3Forms 通过电子邮件转给我们。和任何网络请求一样，Web3Forms 也会看到你的 IP 地址和浏览器信息。",
      privacyLink: "隐私政策",
      mindChanged: "改变主意了？重新安装：",
      bug: "发现问题了？",
      bugLink: "在 GitHub 上告诉我们",
      thanksTitle: "谢谢 — HoverTranslate",
      thanksHeading: "谢谢",
      thanksText: "我们已收到你的回答，它能帮我们决定先修复什么。",
    },
    zh_TW: {
      heading: "HoverTranslate 已移除",
      intro:
        "如果你有一點時間，請告訴我們哪裡不好用。只有一個問題，能幫我們替其他人改善。",
      question: "你為什麼移除它？",
      reasonVideos: "在我看的影片上無法使用",
      reasonTranslations: "翻譯不正確或太慢",
      reasonInTheWay: "看影片時礙事",
      reasonDual: "我想要雙語字幕或整行翻譯",
      reasonSites: "我需要在 Netflix 或其他網站上使用",
      reasonTrying: "只是試用看看",
      reasonOther: "其他原因",
      details: "還有什麼想告訴我們的嗎？（選填）",
      send: "傳送",
      sentNote:
        "你的回答會經由 Web3Forms 以電子郵件轉寄給我們。和任何網路要求一樣，Web3Forms 也會看到你的 IP 位址和瀏覽器資訊。",
      privacyLink: "隱私權政策",
      mindChanged: "改變主意了？重新安裝：",
      bug: "發現問題了嗎？",
      bugLink: "在 GitHub 上告訴我們",
      thanksTitle: "謝謝 — HoverTranslate",
      thanksHeading: "謝謝",
      thanksText: "我們已收到你的回答，它能幫我們決定先修正什麼。",
    },
  };

  // Browser tags that must not simply lose their region, as in the popup
  // (popup/src/app/config/i18n.ts): there is no pt or zh alone among the locales
  var ALIASES = {
    pt: "pt_BR",
    zh: "zh_CN",
    "zh-sg": "zh_CN",
    "zh-hans": "zh_CN",
    "zh-hk": "zh_TW",
    "zh-mo": "zh_TW",
    "zh-hant": "zh_TW",
  };

  // The locale of the first of the browser's languages that has one, its subtags dropped from
  // the right (zh-Hant-HK, zh-Hant, zh); English when none has
  function pickLocale(languages) {
    for (var i = 0; i < languages.length; i++) {
      var subtags = languages[i].toLowerCase().replace(/_/g, "-").split("-");
      for (var length = subtags.length; length > 0; length--) {
        var code = subtags.slice(0, length).join("-");
        if (ALIASES[code]) return ALIASES[code];
        for (var locale in STRINGS) {
          if (locale.toLowerCase().replace("_", "-") === code) return locale;
        }
      }
    }
    return "en";
  }

  function translate(locale) {
    if (locale === "en") return;
    var strings = STRINGS[locale];
    var root = document.documentElement;
    root.lang = locale.replace("_", "-");
    // Arabic is the one right-to-left language of the extension
    root.dir = locale === "ar" ? "rtl" : "ltr";
    var elements = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < elements.length; i++) {
      elements[i].textContent = strings[elements[i].getAttribute("data-i18n")];
    }
  }

  // In Node (scripts/check-site.test.js) it is only read
  if (typeof document === "undefined")
    module.exports = { STRINGS: STRINGS, pickLocale: pickLocale };
  else translate(pickLocale(navigator.languages || [navigator.language]));
})();
