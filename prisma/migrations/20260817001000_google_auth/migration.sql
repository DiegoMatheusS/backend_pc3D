-- Login/cadastro com Google Identity Services.
-- O "sub" é o identificador estável da conta Google e não substitui o e-mail local.
ALTER TABLE "usuarios"
ADD COLUMN "google_sub" VARCHAR(255);

CREATE UNIQUE INDEX "usuarios_google_sub_key"
ON "usuarios"("google_sub");
