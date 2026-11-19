variable "app_id" {
  description = "Applikasjons-ID; må være lik metadata.id i .entur/netex.yaml."
  type        = string
}

variable "environment" {
  description = "Miljø: dev, tst eller prd."
  type        = string
}

variable "region" {
  description = "Standardregion for regionale ressurser (ingen her ennå). Vertex AI-kallene bruker eu-multiregionen."
  type        = string
  default     = "europe-west1"
}

variable "github_service_account" {
  description = "E-postadressen til GitHub Actions-tjenestekontoen for prd-miljøet, opprettet av plattformen fra .entur/cicd.yaml (variabelen SERVICE_ACCOUNT i GitHub-miljøet prd)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+@[a-z0-9-]+\\.iam\\.gserviceaccount\\.com$", var.github_service_account))
    error_message = "Sett github_service_account i terraform/env/prd.tfvars til SERVICE_ACCOUNT fra GitHub-miljøet prd (finnes etter «entur apply» av .entur/cicd.yaml)."
  }
}
