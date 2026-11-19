terraform {
  required_version = ">= 1.15.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.1"
    }
  }

  # Tilstandsbøtta opprettes av plattformen fra .entur/netex.yaml (spec.terraform.createBackend).
  # gha-terraform bruker ett arbeidsområde per miljø, så tilstanden for prd ligger under
  # <prefix>/prd.tfstate i bøtta.
  backend "gcs" {
    bucket = "ent-gcs-tfa-netex"
    prefix = "netex-explorer"
  }
}

provider "google" {
  project = "ent-${var.app_id}-${var.environment}"
  region  = var.region

  # Ingen billing_project / user_project_override: det ville kreve serviceusage.services.use
  # for CI-tjenestekontoen og feile med USER_PROJECT_DENIED (erfaring fra entur/ai-portal).
}
