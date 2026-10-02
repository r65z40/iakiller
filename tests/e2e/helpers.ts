import { expect, type Page } from "@playwright/test";

export async function signUpAndCreateOrg(page: Page, orgName: string) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.test`;
  await page.goto("/inscription");
  await page.getByLabel("Prénom et nom").fill("Alex Testeur");
  await page.getByLabel("Adresse email professionnelle").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-e2e-solide");
  await page.locator("input[name=terms]").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Vérifiez votre messagerie")).toBeVisible();
  // Boîte de réception de développement : aucun email réel n'est envoyé.
  await page.goto("/dev/emails");
  const mail = page.locator("[data-testid=dev-email]").filter({ hasText: email }).first();
  const link = (await mail.innerText()).match(/https?:\/\/\S+/)![0];
  await page.goto(link);
  await page.waitForURL(/organisations\/nouvelle/);
  await page.getByLabel("Nom de l'entreprise").fill(orgName);
  await page.getByRole("button", { name: "Créer et démarrer l'essai" }).click();
  await page.waitForURL(/\/app\?bienvenue/);
  return email;
}

export async function createCard(page: Page, title: string) {
  await page.goto("/app/cartes");
  await page.getByLabel("Nom interne de la carte").fill(title);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await page.waitForURL(/\/app\/cartes\/[A-Za-z0-9]+$/);
  return page.url();
}

export async function waitSaved(page: Page) {
  await expect(page.getByText(/Brouillon enregistré/)).toBeVisible({ timeout: 15_000 });
}
