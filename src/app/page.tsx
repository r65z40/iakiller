"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LanguageProvider";
import { ts } from "@/lib/i18n";

const featureIcons = [
  "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
];

export default function Home() {
  const { locale } = useLocale();
  const hero = ts("hero", locale);
  const feat = ts("features", locale);
  const st = ts("steps", locale);
  const ctaT = ts("cta", locale);
  const foot = ts("footer", locale);

  const imgFeat = ts("image" as never, locale);
  const txtFeat = ts("text" as never, locale);
  const vidFeat = ts("video" as never, locale);

  const featImage = { en: "Our algorithm analyzes and rebuilds your image pixel by pixel. All invisible signatures are erased and replaced with an authentic fingerprint.", fr: "Notre algorithme analyse et reconstruit votre image pixel par pixel. Toutes les signatures invisibles sont effacées et remplacées par une empreinte authentique." }[locale];
  const featText = { en: "Our linguistic engine detects artificial writing patterns and transforms them into natural language. The result passes all detectors.", fr: "Notre moteur linguistique détecte les schémas d'écriture artificiels et les transforme en langage naturel. Le résultat passe tous les détecteurs." }[locale];
  const featVideo = { en: "Complete reconstruction of the video file. Every frame is reprocessed to eliminate any trace of artificial origin.", fr: "Reconstruction complète du fichier vidéo. Chaque frame est retraitée pour éliminer toute trace d'origine artificielle." }[locale];

  const features = [
    { title: locale === "en" ? "Images" : "Images", description: featImage, icon: featureIcons[0] },
    { title: locale === "en" ? "Text" : "Textes", description: featText, icon: featureIcons[1] },
    { title: locale === "en" ? "Videos" : "Vidéos", description: featVideo, icon: featureIcons[2] },
  ];

  const steps = [
    { num: "01", title: locale === "en" ? "Upload" : "Uploadez", desc: locale === "en" ? "Drag your file or paste your text" : "Glissez votre fichier ou collez votre texte" },
    { num: "02", title: locale === "en" ? "Process" : "Traitez", desc: locale === "en" ? "Our algorithms clean all AI traces" : "Nos algorithmes nettoient toutes les traces IA" },
    { num: "03", title: locale === "en" ? "Download" : "Téléchargez", desc: locale === "en" ? "Get your cleaned file back" : "Récupérez votre fichier nettoyé" },
  ];

  return (
    <>
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-transparent to-transparent" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-[128px]" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-xs mb-8">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {hero.badge}
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              {hero.titleLine1}
              <br />
              <span className="gradient-text">{hero.titleHighlight}</span>
            </h1>

            <p className="text-lg sm:text-xl text-dark-400 max-w-2xl mx-auto mb-10">
              {hero.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/tool"
                className="px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold text-lg hover:opacity-90 transition-opacity glow"
              >
                {hero.cta}
              </Link>
              <a
                href="#features"
                className="px-8 py-3.5 rounded-xl border border-[#1e1e4a] text-dark-300 hover:text-white hover:border-primary-500/30 transition-colors font-medium text-lg"
              >
                {hero.learnMore}
              </a>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto text-center">
              <div>
                <div className="text-2xl font-bold gradient-text">100%</div>
                <div className="text-xs text-dark-500 mt-1">{hero.statFree}</div>
              </div>
              <div>
                <div className="text-2xl font-bold gradient-text">{hero.statInstant}</div>
                <div className="text-xs text-dark-500 mt-1">{hero.statInstantSub}</div>
              </div>
              <div>
                <div className="text-2xl font-bold gradient-text">{hero.statPrivate}</div>
                <div className="text-xs text-dark-500 mt-1">{hero.statPrivateSub}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-center mb-4">
            {feat.title}<span className="gradient-text">{feat.titleHighlight}</span>
          </h2>
          <p className="text-dark-400 text-center mb-12 max-w-xl mx-auto">
            {feat.subtitle}
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="card p-6 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-primary-600/10">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            {locale === "en" ? "As easy as " : "Simple comme "}<span className="gradient-text">1-2-3</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="text-5xl font-bold gradient-text mb-4">{step.num}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-dark-400 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="card p-12 text-center glow relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900/20 via-transparent to-primary-900/20" />
            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">
                {ctaT.title}<span className="gradient-text">{ctaT.titleHighlight}</span>?
              </h2>
              <p className="text-dark-400 mb-8 max-w-md mx-auto">{ctaT.subtitle}</p>
              <Link
                href="/tool"
                className="inline-block px-8 py-3.5 rounded-xl gradient-bg text-white font-semibold text-lg hover:opacity-90 transition-opacity"
              >
                {ctaT.button}
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#1e1e4a] py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded gradient-bg flex items-center justify-center font-bold text-white text-[10px]">
                IA
              </div>
              <span className="text-sm text-dark-500">IAKiller</span>
            </div>
            <p className="text-xs text-dark-600">
              &copy; {new Date().getFullYear()} {foot.copy}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
