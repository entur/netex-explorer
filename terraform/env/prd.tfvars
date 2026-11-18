app_id      = "netex"
environment = "prd"

# GitHub Actions-tjenestekonto for prd-miljøet, opprettet av selvbetjeningsplattformen fra
# .entur/cicd.yaml (GitHub-miljøet prd, variabelen SERVICE_ACCOUNT). Fyll inn etter «entur apply»
# av entur/netex-explorer#7; valideringen i variables.tf stopper apply til det er gjort.
github_service_account = "FYLL-INN"
