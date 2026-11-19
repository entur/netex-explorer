# Skyressursene bak de KI-genererte forklaringene: Vertex AI-tilgang for explain-jobben i
# .github/workflows/update-data.yml. Prosjektet ent-netex-prd og GitHub-identiteten kommer fra
# selvbetjeningsmanifestene i .entur/. Terraform her eier bare det plattformen ikke setter opp:
# API-aktivering og IAM-rollen som lar prd-miljøets GitHub-tjenestekonto kalle Vertex AI.
# Ingen tjeneste, ingen Kubernetes, ingen egne tjenestekontoer. Mønster: entur/ai-registry.

module "init" {
  source      = "github.com/entur/terraform-google-init//modules/init?ref=v1"
  app_id      = var.app_id
  environment = var.environment
}

# Vertex AI er ikke aktivert i nyopprettede prosjekter.
resource "google_project_service" "apis" {
  for_each = toset([
    "aiplatform.googleapis.com", # Vertex AI (Gemini) for explain-jobben
  ])
  project            = module.init.app.project_id
  service            = each.value
  disable_on_destroy = false
}

# prd-miljøets GitHub Actions-tjenestekonto (fra .entur/cicd.yaml) er identiteten explain-jobben
# kjører som (environment: prd + cloud-auth). roles/aiplatform.user står på plattformens tillatte
# rolleliste og er alt generateContent trenger.
resource "google_project_iam_member" "explain_vertex_ai_user" {
  project = module.init.app.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${var.github_service_account}"

  depends_on = [google_project_service.apis]
}
