interface TextProcessOptions {
  removeAiPatterns: boolean;
  varySentences: boolean;
  addNaturalImperfections: boolean;
  language: "fr" | "en" | "auto";
}

const defaultOptions: TextProcessOptions = {
  removeAiPatterns: true,
  varySentences: true,
  addNaturalImperfections: true,
  language: "auto",
};

const AI_PATTERNS_FR: [RegExp, string[]][] = [
  [/\bBien sûr\s*[!,]/gi, ["OK,", "Oui,", "Effectivement,", "Absolument,"]],
  [/\bEn tant que (modèle|assistant|intelligence artificielle|IA)\b[^.]*\./gi, [""]],
  [/\bIl est important de (noter|souligner|mentionner) que\b/gi, ["À savoir :", "D'ailleurs,", "Notons que"]],
  [/\bN'hésitez pas à\b/gi, ["Tu peux", "Vous pouvez", "Libre à vous de"]],
  [/\bVoici (quelques|une liste de|les)\b/gi, ["Quelques", "Les", ""]],
  [/\bEn résumé\s*[,:]/gi, ["Bref,", "En gros,", "Pour résumer,"]],
  [/\bEn conclusion\s*[,:]/gi, ["Au final,", "Pour conclure,", "Bref,"]],
  [/\bJe serais ravi de\b/gi, ["Je peux", "On peut", ""]],
  [/\bDans le cadre de\b/gi, ["Pour", "Concernant", "Au sujet de"]],
  [/\bIl convient de\b/gi, ["Il faut", "On doit", "Mieux vaut"]],
  [/\bCela étant dit\b/gi, ["Ceci dit,", "Mais bon,", "Après,"]],
  [/\bForce est de constater que\b/gi, ["On voit bien que", "Clairement,", ""]],
  [/\bDans cette optique\b/gi, ["Du coup,", "Donc,", "Dans ce sens,"]],
  [/\bPar ailleurs\b/gi, ["Aussi,", "En plus,", "D'autre part,"]],
  [/\bEn outre\b/gi, ["De plus,", "Aussi,", "Et puis,"]],
  [/\bAinsi\s*,/gi, ["Du coup,", "Donc,", "Et,"]],
  [/\bToutefois\b/gi, ["Mais", "Ceci dit,", "Par contre,"]],
  [/\bNéanmoins\b/gi, ["Mais", "Quand même,", "Malgré tout,"]],
  [/\bEn effet\s*,/gi, ["D'ailleurs,", "C'est vrai,", "Effectivement,"]],
  [/\bIl est à noter que\b/gi, ["Notez que", "À noter :", ""]],
  [/\bEn ce qui concerne\b/gi, ["Pour", "Au niveau de", "Côté"]],
  [/\bAfin de\b/gi, ["Pour", "Histoire de", "Dans le but de"]],
  [/\bDe manière générale\b/gi, ["En gros,", "Globalement,", ""]],
  [/\bDe plus\b/gi, ["Et puis,", "Aussi,", "En plus,"]],
  [/\bEn ce sens\b/gi, ["Comme ça,", "Donc,", "Ainsi,"]],
  [/\bNotamment\b/gi, ["surtout", "en particulier", "entre autres"]],
  [/\bÀ cet égard\b/gi, ["Là-dessus,", "Sur ce point,", ""]],
  [/\bPar conséquent\b/gi, ["Du coup,", "Donc,", "Résultat,"]],
  [/\bSuivant cette logique\b/gi, ["Du coup,", "Logiquement,", ""]],
];

const AI_PATTERNS_EN: [RegExp, string[]][] = [
  [/\bCertainly[!,]/gi, ["Sure,", "Yeah,", "Of course,", "Right,"]],
  [/\bAs an AI (language model|assistant|model)\b[^.]*\./gi, [""]],
  [/\bIt'?s (important|worth) (to note|noting|mentioning) that\b/gi, ["Note that", "Keep in mind,", ""]],
  [/\bFeel free to\b/gi, ["You can", "Go ahead and", ""]],
  [/\bHere (are|is) (a list of|some|the)\b/gi, ["Some", "The", "A few"]],
  [/\bIn summary\s*[,:]/gi, ["Basically,", "Long story short,", "TL;DR:"]],
  [/\bIn conclusion\s*[,:]/gi, ["Bottom line,", "All in all,", "So basically,"]],
  [/\bI'?d be happy to\b/gi, ["I can", "Let me", ""]],
  [/\bIt'?s worth highlighting that\b/gi, ["Also,", "Plus,", ""]],
  [/\bFurthermore\b/gi, ["Also,", "Plus,", "And,"]],
  [/\bMoreover\b/gi, ["Also,", "On top of that,", "Plus,"]],
  [/\bAdditionally\b/gi, ["Also,", "Plus,", "And,"]],
  [/\bHowever\b/gi, ["But", "Though", "That said,"]],
  [/\bNevertheless\b/gi, ["Still,", "But,", "Even so,"]],
  [/\bDelve\b/gi, ["dig", "look", "explore"]],
  [/\bLeverage\b/gi, ["use", "take advantage of", "apply"]],
  [/\bUtilize\b/gi, ["use", "work with", "apply"]],
  [/\bFacilitate\b/gi, ["help", "make easier", "enable"]],
  [/\bImplement\b/gi, ["set up", "put in place", "build"]],
  [/\bOptimize\b/gi, ["improve", "fine-tune", "make better"]],
  [/\bStreamline\b/gi, ["simplify", "smooth out", "speed up"]],
  [/\bEnhance\b/gi, ["improve", "boost", "make better"]],
  [/\bOverall\s*,/gi, ["In the end,", "All things considered,", ""]],
  [/\bConsequently\b/gi, ["So,", "Because of that,", "As a result,"]],
  [/\bTherefore\b/gi, ["So,", "That's why", "Because of this,"]],
  [/\bThus\b/gi, ["So,", "That's why", ""]],
  [/\bSpecifically\b/gi, ["In particular,", "Especially", ""]],
  [/\bEssentially\b/gi, ["Basically,", "Really,", ""]],
  [/\bFundamentally\b/gi, ["At its core,", "Basically,", "Really,"]],
  [/\bIn order to\b/gi, ["To", "So you can", "For"]],
  [/\bDue to the fact that\b/gi, ["Because", "Since", "As"]],
  [/\bIt is worth mentioning\b/gi, ["Also,", "Note that", ""]],
  [/\bIt should be noted\b/gi, ["Note that", "Keep in mind", ""]],
  [/\bIn this regard\b/gi, ["On this,", "Here,", ""]],
  [/\bWith regard to\b/gi, ["About", "On", "For"]],
  [/\bIn the context of\b/gi, ["With", "For", "In"]],
  [/\bAs previously mentioned\b/gi, ["As I said,", "Like I noted,", ""]],
  [/\bNotwithstanding\b/gi, ["Despite", "Even with", "Regardless of"]],
  [/\bPertaining to\b/gi, ["About", "Related to", "On"]],
  [/\bIn light of\b/gi, ["Given", "Considering", "Because of"]],
];

const SYNONYMS_EN: Record<string, string[]> = {
  "important": ["key", "crucial", "major", "significant", "big"],
  "significant": ["major", "big", "notable", "meaningful", "real"],
  "comprehensive": ["full", "complete", "thorough", "detailed", "in-depth"],
  "robust": ["strong", "solid", "reliable", "sturdy", "tough"],
  "innovative": ["new", "creative", "fresh", "original", "novel"],
  "efficient": ["fast", "quick", "effective", "productive", "smooth"],
  "demonstrate": ["show", "prove", "display", "reveal", "illustrate"],
  "establish": ["set up", "create", "build", "form", "start"],
  "provide": ["give", "offer", "supply", "deliver", "bring"],
  "ensure": ["make sure", "guarantee", "confirm", "secure", "verify"],
  "obtain": ["get", "gain", "acquire", "grab", "pick up"],
  "require": ["need", "call for", "demand", "take", "involve"],
  "possess": ["have", "hold", "own", "carry", "keep"],
  "commence": ["start", "begin", "kick off", "launch", "open"],
  "terminate": ["end", "stop", "finish", "close", "wrap up"],
  "sufficient": ["enough", "adequate", "plenty of", "ample", "decent"],
  "numerous": ["many", "lots of", "a bunch of", "several", "plenty of"],
  "various": ["different", "several", "multiple", "a range of", "all kinds of"],
  "approximately": ["about", "around", "roughly", "nearly", "close to"],
  "frequently": ["often", "a lot", "regularly", "usually", "commonly"],
  "immediately": ["right away", "instantly", "at once", "straight away", "now"],
  "consequently": ["so", "as a result", "because of that", "therefore", "hence"],
  "subsequently": ["then", "after that", "later", "next", "following that"],
  "previously": ["before", "earlier", "in the past", "formerly", "back then"],
  "currently": ["now", "right now", "at the moment", "these days", "today"],
  "undoubtedly": ["clearly", "obviously", "for sure", "no doubt", "definitely"],
  "particularly": ["especially", "mainly", "mostly", "in particular", "above all"],
  "extremely": ["very", "really", "super", "incredibly", "seriously"],
  "absolutely": ["totally", "completely", "fully", "100%", "definitely"],
  "ultimately": ["in the end", "finally", "at the end of the day", "eventually"],
  "effectively": ["well", "successfully", "properly", "in practice", "really"],
  "primarily": ["mainly", "mostly", "chiefly", "largely", "above all"],
  "maintain": ["keep", "hold", "preserve", "sustain", "continue"],
  "utilize": ["use", "employ", "work with", "apply", "make use of"],
  "endeavor": ["try", "attempt", "aim", "strive", "work"],
  "regarding": ["about", "on", "concerning", "when it comes to", "as for"],
  "additional": ["extra", "more", "further", "added", "other"],
  "substantial": ["big", "large", "major", "considerable", "hefty"],
  "facilitate": ["help", "make easier", "support", "enable", "assist"],
  "incorporate": ["include", "add", "bring in", "blend", "mix in"],
  "methodology": ["method", "approach", "way", "process", "technique"],
  "paradigm": ["model", "framework", "approach", "pattern", "way"],
  "multifaceted": ["complex", "varied", "diverse", "layered", "many-sided"],
};

const SYNONYMS_FR: Record<string, string[]> = {
  "important": ["clé", "crucial", "majeur", "gros", "essentiel"],
  "significatif": ["notable", "important", "réel", "marquant", "concret"],
  "complet": ["entier", "total", "intégral", "exhaustif", "global"],
  "robuste": ["solide", "fiable", "résistant", "costaud", "stable"],
  "efficace": ["performant", "rapide", "productif", "bon", "utile"],
  "démontrer": ["montrer", "prouver", "illustrer", "révéler", "faire voir"],
  "établir": ["créer", "mettre en place", "fonder", "construire", "installer"],
  "fournir": ["donner", "offrir", "apporter", "livrer", "proposer"],
  "assurer": ["garantir", "confirmer", "vérifier", "s'occuper de", "veiller à"],
  "obtenir": ["avoir", "décrocher", "recevoir", "récupérer", "gagner"],
  "nécessiter": ["demander", "avoir besoin de", "requérir", "exiger", "falloir"],
  "posséder": ["avoir", "détenir", "disposer de", "tenir", "garder"],
  "commencer": ["débuter", "lancer", "démarrer", "entamer", "ouvrir"],
  "terminer": ["finir", "achever", "conclure", "boucler", "clôturer"],
  "suffisant": ["assez", "adéquat", "correct", "convenable", "satisfaisant"],
  "nombreux": ["beaucoup de", "plein de", "pas mal de", "plusieurs", "quantité de"],
  "divers": ["différents", "variés", "multiples", "plusieurs", "de toutes sortes"],
  "approximativement": ["environ", "à peu près", "autour de", "dans les", "grosso modo"],
  "fréquemment": ["souvent", "régulièrement", "beaucoup", "couramment", "pas mal"],
  "immédiatement": ["tout de suite", "directement", "sur-le-champ", "aussitôt", "maintenant"],
  "actuellement": ["en ce moment", "maintenant", "aujourd'hui", "présentement", "là"],
  "extrêmement": ["très", "vraiment", "super", "incroyablement", "énormément"],
  "absolument": ["totalement", "complètement", "à 100%", "carrément", "tout à fait"],
  "principalement": ["surtout", "essentiellement", "avant tout", "en grande partie", "majoritairement"],
  "maintenir": ["garder", "conserver", "préserver", "continuer", "entretenir"],
  "concernant": ["au sujet de", "à propos de", "pour", "sur", "quant à"],
  "supplémentaire": ["en plus", "additionnel", "extra", "autre", "de plus"],
  "substantiel": ["gros", "important", "conséquent", "considérable", "solide"],
  "incorporer": ["intégrer", "ajouter", "inclure", "mettre", "introduire"],
  "méthodologie": ["méthode", "approche", "façon", "procédé", "technique"],
  "paradigme": ["modèle", "cadre", "approche", "schéma", "vision"],
};

function detectLanguage(text: string): "fr" | "en" {
  const frWords = ["le", "la", "les", "de", "du", "des", "et", "est", "que", "qui", "dans", "pour", "pas", "sur", "une", "avec"];
  const enWords = ["the", "is", "are", "and", "of", "to", "in", "for", "that", "with", "this", "from", "was", "have", "not"];

  const words = text.toLowerCase().split(/\s+/);
  let frScore = 0;
  let enScore = 0;

  for (const word of words) {
    if (frWords.includes(word)) frScore++;
    if (enWords.includes(word)) enScore++;
  }

  return frScore > enScore ? "fr" : "en";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function removeAiPatterns(text: string, language: "fr" | "en"): string {
  const patterns = language === "fr" ? AI_PATTERNS_FR : AI_PATTERNS_EN;

  let result = text;
  for (const [pattern, replacements] of patterns) {
    result = result.replace(pattern, () => {
      const replacement = pickRandom(replacements);
      return replacement;
    });
  }

  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/^\s+$/gm, "");

  return result;
}

function replaceSynonyms(text: string, language: "fr" | "en"): string {
  const synonyms = language === "fr" ? SYNONYMS_FR : SYNONYMS_EN;
  let result = text;

  for (const [word, alternatives] of Object.entries(synonyms)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, (match) => {
      if (Math.random() < 0.7) {
        const replacement = pickRandom(alternatives);
        if (match[0] === match[0].toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      }
      return match;
    });
  }

  return result;
}

function varySentenceStructure(text: string): string {
  const paragraphs = text.split("\n\n");

  return paragraphs
    .map((paragraph) => {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g);
      if (!sentences || sentences.length < 2) return paragraph;

      const modified = sentences.map((sentence, idx) => {
        let s = sentence;

        if (Math.random() < 0.25 && sentences.length > 3 && idx > 0 && idx < sentences.length - 1) {
          const next = sentences[idx + 1];
          if (next) {
            s = s.trim().replace(/\.$/, "") + " — " +
              next.trim().charAt(0).toLowerCase() + next.trim().slice(1);
            sentences.splice(idx + 1, 1);
          }
        }

        if (Math.random() < 0.15 && s.length > 80) {
          const commaIdx = s.indexOf(",", Math.floor(s.length * 0.3));
          if (commaIdx > 0 && commaIdx < s.length * 0.7) {
            const part2 = s.slice(commaIdx + 1).trim();
            s = s.slice(0, commaIdx) + ". " +
              part2.charAt(0).toUpperCase() + part2.slice(1);
          }
        }

        return s;
      });

      return modified.join(" ");
    })
    .join("\n\n");
}

function modifyContractions(text: string, language: "fr" | "en"): string {
  if (language !== "en") return text;

  const expansions: [RegExp, string][] = [
    [/\bdon't\b/gi, "do not"],
    [/\bcan't\b/gi, "cannot"],
    [/\bwon't\b/gi, "will not"],
    [/\bisn't\b/gi, "is not"],
    [/\baren't\b/gi, "are not"],
    [/\bdidn't\b/gi, "did not"],
    [/\bwouldn't\b/gi, "would not"],
    [/\bcouldn't\b/gi, "could not"],
    [/\bshouldn't\b/gi, "should not"],
    [/\bhasn't\b/gi, "has not"],
    [/\bhaven't\b/gi, "have not"],
    [/\bwasn't\b/gi, "was not"],
    [/\bweren't\b/gi, "were not"],
    [/\bit's\b/gi, "it is"],
    [/\bthat's\b/gi, "that is"],
    [/\bthey're\b/gi, "they are"],
    [/\bwe're\b/gi, "we are"],
    [/\byou're\b/gi, "you are"],
    [/\bI'm\b/g, "I am"],
    [/\bI've\b/g, "I have"],
    [/\bI'll\b/g, "I will"],
    [/\bI'd\b/g, "I would"],
    [/\bwe've\b/gi, "we have"],
    [/\bthey've\b/gi, "they have"],
    [/\byou've\b/gi, "you have"],
    [/\blet's\b/gi, "let us"],
    [/\bthere's\b/gi, "there is"],
    [/\bwho's\b/gi, "who is"],
    [/\bwhat's\b/gi, "what is"],
    [/\bhere's\b/gi, "here is"],
  ];

  const contractions: [RegExp, string][] = [
    [/\bdo not\b/gi, "don't"],
    [/\bcannot\b/gi, "can't"],
    [/\bwill not\b/gi, "won't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bdid not\b/gi, "didn't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bcould not\b/gi, "couldn't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bhas not\b/gi, "hasn't"],
    [/\bhave not\b/gi, "haven't"],
    [/\bwas not\b/gi, "wasn't"],
    [/\bwere not\b/gi, "weren't"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"],
    [/\bthey are\b/gi, "they're"],
    [/\bwe are\b/gi, "we're"],
    [/\byou are\b/gi, "you're"],
    [/\bI am\b/g, "I'm"],
    [/\bI have\b/g, "I've"],
    [/\bI will\b/g, "I'll"],
    [/\bI would\b/g, "I'd"],
  ];

  let result = text;

  const expandMode = Math.random() < 0.5;

  if (expandMode) {
    for (const [pattern, replacement] of expansions) {
      result = result.replace(pattern, (match) => {
        if (Math.random() < 0.6) {
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        }
        return match;
      });
    }
  } else {
    for (const [pattern, replacement] of contractions) {
      result = result.replace(pattern, (match) => {
        if (Math.random() < 0.6) {
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        }
        return match;
      });
    }
  }

  return result;
}

function addNaturalness(text: string, language: "fr" | "en"): string {
  let result = text;

  result = result.replace(/\. ([A-Z])/g, (match, letter) => {
    return Math.random() < 0.12 ? `.\n${letter}` : match;
  });

  const listPattern = /^(\d+)\.\s/gm;
  if (listPattern.test(result) && Math.random() < 0.4) {
    result = result.replace(/^(\d+)\.\s/gm, "- ");
  }

  if (language === "en") {
    result = result.replace(/\b(\w+),\s(\w+),\s(and|or)\s/g, (match, a, b, conj) => {
      return Math.random() < 0.3 ? `${a}, ${b} ${conj} ` : match;
    });
  }

  result = result.replace(/;\s/g, (match) => {
    return Math.random() < 0.25 ? ". " : match;
  });

  const fillers_en = ["Well, ", "I mean, ", "Look, ", "So, ", "Basically, ", "Honestly, ", ""];
  const fillers_fr = ["Bon, ", "Enfin, ", "Écoute, ", "Donc, ", "En fait, ", "Franchement, ", ""];

  const fillers = language === "fr" ? fillers_fr : fillers_en;
  const paragraphs = result.split("\n\n");
  result = paragraphs.map((p, idx) => {
    if (idx > 0 && Math.random() < 0.15) {
      const filler = pickRandom(fillers);
      if (filler && p.length > 0) {
        return filler + p.charAt(0).toLowerCase() + p.slice(1);
      }
    }
    return p;
  }).join("\n\n");

  return result;
}

function shuffleWordOrder(text: string, language: "fr" | "en"): string {
  let result = text;

  if (language === "en") {
    result = result.replace(/\b(very|really|extremely|quite|rather|fairly|pretty)\s+(\w+)\b/gi, (match, adv, adj) => {
      if (Math.random() < 0.4) {
        const alternatives: Record<string, string[]> = {
          "very": ["really", "quite", "pretty", "super"],
          "really": ["very", "quite", "truly", "genuinely"],
          "extremely": ["very", "really", "incredibly", "super"],
          "quite": ["pretty", "fairly", "rather", "somewhat"],
          "rather": ["quite", "fairly", "pretty", "somewhat"],
          "fairly": ["quite", "pretty", "rather", "reasonably"],
          "pretty": ["quite", "fairly", "rather", "really"],
        };
        const key = adv.toLowerCase();
        if (alternatives[key]) {
          const newAdv = pickRandom(alternatives[key]);
          return `${adv[0] === adv[0].toUpperCase() ? newAdv.charAt(0).toUpperCase() + newAdv.slice(1) : newAdv} ${adj}`;
        }
      }
      return match;
    });
  }

  if (language === "fr") {
    result = result.replace(/\b(très|vraiment|extrêmement|assez|plutôt|relativement)\s+(\w+)\b/gi, (match, adv, adj) => {
      if (Math.random() < 0.4) {
        const alternatives: Record<string, string[]> = {
          "très": ["vraiment", "bien", "super", "carrément"],
          "vraiment": ["très", "réellement", "sincèrement", "pour de vrai"],
          "extrêmement": ["très", "vraiment", "incroyablement", "super"],
          "assez": ["plutôt", "pas mal", "relativement", "suffisamment"],
          "plutôt": ["assez", "pas mal", "relativement", "passablement"],
          "relativement": ["assez", "plutôt", "pas mal", "moyennement"],
        };
        const key = adv.toLowerCase();
        if (alternatives[key]) {
          const newAdv = pickRandom(alternatives[key]);
          return `${adv[0] === adv[0].toUpperCase() ? newAdv.charAt(0).toUpperCase() + newAdv.slice(1) : newAdv} ${adj}`;
        }
      }
      return match;
    });
  }

  return result;
}

function insertUnicodeVariations(text: string): string {
  let result = text;

  const replacements: [string, string][] = [
    [" ", " "],   // non-breaking space
    ["-", "‐"],   // hyphen
    ["'", "’"],   // right single quotation (curly apostrophe)
    ["\"", "“"],  // left double quotation
  ];

  for (const [from, to] of replacements) {
    result = result.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), (match) => {
      return Math.random() < 0.08 ? to : match;
    });
  }

  const zeroWidthChars = ["​", "‌", "‍", "﻿"];
  const words = result.split(" ");
  result = words.map(w => {
    if (Math.random() < 0.03 && w.length > 4) {
      const pos = Math.floor(Math.random() * (w.length - 1)) + 1;
      return w.slice(0, pos) + pickRandom(zeroWidthChars) + w.slice(pos);
    }
    return w;
  }).join(" ");

  return result;
}

export function processText(
  text: string,
  options: Partial<TextProcessOptions> = {}
): { processed: string; changes: string[] } {
  const opts = { ...defaultOptions, ...options };

  const language =
    opts.language === "auto" ? detectLanguage(text) : opts.language;

  let result = text;
  const changes: string[] = [];

  if (opts.removeAiPatterns) {
    const before = result;
    result = removeAiPatterns(result, language);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Expressions typiques IA supprimées"
        : "Typical AI phrases removed");
    }
  }

  {
    const before = result;
    result = replaceSynonyms(result, language);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Vocabulaire diversifié"
        : "Vocabulary diversified");
    }
  }

  {
    const before = result;
    result = modifyContractions(result, language);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Formes verbales ajustées"
        : "Contractions adjusted");
    }
  }

  {
    const before = result;
    result = shuffleWordOrder(result, language);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Adverbes et modificateurs variés"
        : "Adverbs and modifiers varied");
    }
  }

  if (opts.varySentences) {
    const before = result;
    result = varySentenceStructure(result);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Structure des phrases variée"
        : "Sentence structure varied");
    }
  }

  if (opts.addNaturalImperfections) {
    const before = result;
    result = addNaturalness(result, language);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Imperfections naturelles ajoutées"
        : "Natural imperfections added");
    }
  }

  {
    const before = result;
    result = insertUnicodeVariations(result);
    if (result !== before) {
      changes.push(language === "fr"
        ? "Empreinte numérique unique générée"
        : "Unique digital fingerprint generated");
    }
  }

  if (changes.length === 0) {
    changes.push(language === "fr"
      ? "Texte analysé et retraité"
      : "Text analyzed and reprocessed");
  }

  return { processed: result, changes };
}
