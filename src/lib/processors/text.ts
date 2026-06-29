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
];

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

function varySentenceStructure(text: string): string {
  const paragraphs = text.split("\n\n");

  return paragraphs
    .map((paragraph) => {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g);
      if (!sentences || sentences.length < 3) return paragraph;

      if (Math.random() < 0.3 && sentences.length > 3) {
        const idx = Math.floor(Math.random() * (sentences.length - 2)) + 1;
        const merged =
          sentences[idx].trim().replace(/\.$/, "") +
          " — " +
          sentences[idx + 1].trim().charAt(0).toLowerCase() +
          sentences[idx + 1].trim().slice(1);
        sentences.splice(idx, 2, merged);
      }

      return sentences.join(" ");
    })
    .join("\n\n");
}

function addNaturalness(text: string, language: "fr" | "en"): string {
  let result = text;

  if (language === "fr") {
    if (Math.random() < 0.3) {
      result = result.replace(/\. ([A-Z])/g, (match, letter) => {
        return Math.random() < 0.15 ? `.\n${letter}` : match;
      });
    }
  }

  const listPattern = /^(\d+)\.\s/gm;
  if (listPattern.test(result) && Math.random() < 0.4) {
    result = result.replace(/^(\d+)\.\s/gm, "- ");
  }

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

  if (changes.length === 0) {
    changes.push(language === "fr"
      ? "Texte analysé — aucun pattern IA détecté"
      : "Text analyzed — no AI patterns detected");
  }

  return { processed: result, changes };
}
