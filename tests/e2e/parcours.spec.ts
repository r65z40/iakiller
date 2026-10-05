import { expect, test } from "@playwright/test";
import { createCard, signUpAndCreateOrg, waitSaved } from "./helpers";

test("inscription → carte → publication → page publique → vCard → brouillon isolé", async ({ page, browser }) => {
  await signUpAndCreateOrg(page, `Menuiserie E2E ${Date.now()}`);
  await createCard(page, "Camille E2E");
  await page.getByLabel("Prénom").fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Durand");
  await page.getByRole("button", { name: /^Coordonnées/ }).first().click();
  await page.getByRole("button", { name: "Ajouter une coordonnée" }).click();
  await page.getByLabel("Valeur").fill("06 39 98 12 34");
  await page.getByRole("button", { name: "Ajouter une coordonnée" }).click();
  await page.getByLabel("Type").nth(1).selectOption("landline");
  await page.getByLabel("Valeur").nth(1).fill("01 99 00 12 34");
  await waitSaved(page);
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText(/publiée\. La carte publique est à jour/)).toBeVisible();
  const publicUrl = (await page.getByRole("link", { name: "Voir la carte publique" }).getAttribute("href"))!;

  // Page publique, sans connexion, sur petit écran.
  const visitor = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const pub = await visitor.newPage();
  await pub.goto(publicUrl);
  await expect(pub.getByRole("heading", { name: /Camille/ })).toBeVisible();
  await expect(pub.getByRole("link", { name: "Appeler Camille" })).toHaveAttribute("href", "tel:0639981234");
  const noOverflow = await pub.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noOverflow).toBe(true);
  const vcard = await pub.request.get(`${publicUrl}/vcard`);
  const body = await vcard.text();
  expect(body).toContain("TEL;TYPE=CELL:0639981234");
  expect(body).toContain("TEL;TYPE=WORK,VOICE:0199001234");

  // Une modification non publiée ne change pas la carte publique.
  await page.getByRole("button", { name: "En-tête et identité" }).click();
  await page.getByLabel("Prénom").fill("Brouillon");
  await waitSaved(page);
  await pub.reload();
  await expect(pub.getByRole("heading", { name: /Camille/ })).toBeVisible();
  await expect(pub.getByText("Brouillon")).toHaveCount(0);
  await visitor.close();
});

test("réordonnancement des blocs au clavier et par boutons, suppression annulable", async ({ page }) => {
  await signUpAndCreateOrg(page, `Ordre E2E ${Date.now()}`);
  await createCard(page, "Ordre");
  const list = page.getByRole("list", { name: "Blocs de la carte" });
  const labels = async () => (await list.locator("li").allInnerTexts()).map((t) => t.split("\n")[0]);
  expect((await labels())[0]).toBe("Boutons de contact");

  // Bouton « Descendre » (alternative sans glisser-déposer).
  await page.getByRole("button", { name: "Descendre Boutons de contact" }).click();
  expect((await labels())[1]).toBe("Boutons de contact");

  // Glisser-déposer au clavier : Espace, flèche haut, Espace.
  const handle = page.getByRole("button", { name: /Déplacer le bloc Boutons de contact/ });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await labels())[0]).toBe("Boutons de contact");

  // Suppression puis annulation.
  await page.getByRole("button", { name: "Supprimer Liens" }).click();
  await expect(page.getByText("Bloc « Liens » supprimé.")).toBeVisible();
  await page.getByRole("button", { name: "Annuler la suppression" }).click();
  expect(await labels()).toContain("Liens");
  await waitSaved(page);
});

test("quota d'essai : la quatrième carte est refusée", async ({ page }) => {
  await signUpAndCreateOrg(page, `Quota E2E ${Date.now()}`);
  for (const t of ["Un", "Deux", "Trois"]) await createCard(page, t);
  await page.goto("/app/cartes");
  await expect(page.getByText(/Limite de 3 carte\(s\) atteinte/)).toBeVisible();
  await expect(page.getByLabel("Nom interne de la carte")).toHaveCount(0);
});

test("formulaire prospect public → visible dans l'espace", async ({ page, browser }) => {
  await signUpAndCreateOrg(page, `Prospects E2E ${Date.now()}`);
  await createCard(page, "Formulaire");
  await page.getByLabel("Prénom").fill("Lina");
  await page.getByRole("button", { name: /^\+?\s*Formulaire de contact/ }).click();
  await waitSaved(page);
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText(/publiée\. La carte publique est à jour/)).toBeVisible();
  const publicUrl = (await page.getByRole("link", { name: "Voir la carte publique" }).getAttribute("href"))!;

  const visitor = await browser.newContext();
  const pub = await visitor.newPage();
  await pub.goto(publicUrl);
  await pub.waitForTimeout(3000); // délai minimal anti-robot
  await pub.getByLabel(/^Nom/).fill("Paul Visiteur");
  await pub.getByLabel(/^Email/).fill("paul@exemple.test");
  await pub.getByLabel(/^Message/).fill("Je souhaite un devis.");
  await pub.getByRole("button", { name: "Envoyer" }).click();
  await expect(pub.getByText("Message envoyé.")).toBeVisible();
  await visitor.close();

  await page.goto("/app/prospects");
  await expect(page.getByText("Paul Visiteur")).toBeVisible();
  // La carte du pipeline ouvre la fiche détaillée, où figure le message.
  await page.getByRole("link", { name: /Paul Visiteur/ }).click();
  await expect(page.getByRole("heading", { name: "Paul Visiteur" })).toBeVisible();
  await expect(page.getByText("Je souhaite un devis.")).toBeVisible();
});

test("mini-site : création depuis un modèle et ouverture de l'éditeur", async ({ page }) => {
  await signUpAndCreateOrg(page, `Mini-site E2E ${Date.now()}`);
  await page.goto("/app/mini-sites");
  await page.getByRole("button", { name: "+ Nouveau mini-site" }).click();
  await page.getByLabel("Nom du mini-site").fill("Ma vitrine");
  await page.getByRole("button", { name: /Créer et ouvrir/ }).click();
  await page.waitForURL(/\/app\/mini-sites\/[a-z0-9]+$/i, { timeout: 40000 });
  await expect(page.getByText(/Blocs de « Accueil »/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "+ Page" })).toBeVisible();
});

test("routes protégées et QR inconnu", async ({ page }) => {
  await page.goto("/app/cartes");
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto("/r/jetonInexistant1234");
  await expect(page.getByRole("heading", { name: "Carte indisponible" })).toBeVisible();
  const res = await page.request.post("/api/stripe/webhook", { data: "{}", headers: { "stripe-signature": "t=1,v1=faux" } });
  expect([400, 503]).toContain(res.status());
});

test("annuler et rétablir une modification dans l'éditeur", async ({ page }) => {
  await signUpAndCreateOrg(page, `Historique E2E ${Date.now()}`);
  await createCard(page, "Historique");
  await page.getByLabel("Prénom").fill("Avant");
  await page.waitForTimeout(1000);
  await page.getByLabel("Prénom").fill("Après");
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByLabel("Prénom")).toHaveValue("Avant");
  await page.getByRole("button", { name: "Rétablir" }).click();
  await expect(page.getByLabel("Prénom")).toHaveValue("Après");
  await page.getByRole("radio", { name: "Ordinateur" }).click();
  await expect(page.getByRole("heading", { name: /Après/ })).toBeVisible();
});
