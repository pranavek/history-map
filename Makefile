# history-map — task runner
#
# The site itself has no dependencies and no build step. These targets only
# wrap things you would otherwise type by hand. `make check` and `make serve`
# need nothing beyond python3 and node, both already in the devcontainer.
# `make test` drives a real browser and installs Playwright on demand, into a
# gitignored directory — nothing is added to the published site.

.DEFAULT_GOAL := help
SHELL := /bin/bash

PORT  ?= 8111
BASE  ?= http://127.0.0.1:$(PORT)
LIVE  ?= https://pranavek.com/history-map
TOOLS := .test-tools
SHOTS ?= .shots
N     ?= 40
BENCH_PORT ?= 8123
BENCH_DIR  ?= .bench

PAGES := index.html map.html about.html history
SUITES := run blocked about

.PHONY: help check serve test test-setup test-live bench index boundary stage status deploy clean

help: ## List available targets
	@echo "history-map"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Override PORT, BASE or LIVE as needed, e.g.:"
	@echo "    make test BASE=https://example.com/history-map"

check: ## Validate data, icons, selectors, links, attribution (no dependencies)
	@node tools/check.mjs

serve: index ## Serve the site locally (PORT=8111 by default)
	@echo "  serving $(CURDIR) at http://localhost:$(PORT) — ctrl-c to stop"
	@python3 -m http.server $(PORT)

$(TOOLS)/node_modules: ## (internal) Playwright, installed out of the way
	@echo "  installing Playwright into $(TOOLS)/ — this is test tooling only,"
	@echo "  it is gitignored and nothing from it ships"
	@mkdir -p $(TOOLS)
	@# npm init -y would fail here: it derives the package name from the
	@# directory, and a leading dot is not a legal npm name.
	@printf '{"name":"history-map-test-tools","private":true,"version":"0.0.0"}\n' > $(TOOLS)/package.json
	@cd $(TOOLS) && npm install --no-audit --no-fund playwright
	@cd $(TOOLS) && npx playwright install chromium
	@touch $(TOOLS)/node_modules

# ESM resolves bare imports from the importing FILE's directory, not the cwd,
# so test/*.mjs cannot see .test-tools/node_modules without this link. It is a
# target in its own right, not a step inside the install recipe: `make clean`
# removes it while leaving the install in place, and Make must be able to
# restore just the link without reinstalling the browser.
test/node_modules: | $(TOOLS)/node_modules
	@ln -sfn ../$(TOOLS)/node_modules test/node_modules

test-setup: test/node_modules ## Install the browser used by `make test`

test: check index test/node_modules ## Run every browser suite against a local server
	@mkdir -p $(SHOTS)
	@python3 -m http.server $(PORT) >/dev/null 2>&1 & echo $$! > .server.pid; \
	 sleep 2; \
	 rc=0; total=0; \
	 for s in $(SUITES); do \
	   out=$$(BASE=$(BASE) SHOTS=$(CURDIR)/$(SHOTS) node test/$$s.mjs 2>&1); \
	   code=$$?; n=$$(echo "$$out" | grep -cE '^  PASS'); total=$$((total+n)); \
	   if [ $$code -ne 0 ]; then rc=1; echo "$$out"; \
	   else printf "  %-8s %s passing\n" "$$s" "$$n"; fi; \
	 done; \
	 kill $$(cat .server.pid 2>/dev/null) 2>/dev/null || true; rm -f .server.pid; \
	 echo "  ──────── $$total checks"; \
	 exit $$rc

test-live: test/node_modules ## Run the browser suites against the deployed site
	@echo "  target: $(LIVE)"
	@BASE=$(LIVE) SHOTS=$(CURDIR)/$(SHOTS) node test/run.mjs

boundary: ## Regenerate India's outline from source, verify it, re-inline the hero
	@python3 tools/build-boundary.py
	@python3 tools/inline-svg.py

stage: check index ## Build the exact artefact CI publishes, into _site/
	@rm -rf _site && mkdir -p _site
	@cp -r $(PAGES) css js data assets _site/
	@touch _site/.nojekyll
	@echo "  staged _site/ — $$(find _site -type f | wc -l) files, $$(du -sh _site | cut -f1)"

# Generated on every serve/test/stage rather than committed: it is derived from
# data/, which changes constantly, and a stale committed copy would be worse
# than none. js/data.js still falls back to the region files if it is absent,
# so opening the site without make works - it just costs one 404 and 20 requests.
index: ## Generate data/index.json (one light request instead of one per region)
	@node tools/build-index.mjs

bench: test/node_modules ## Benchmark the map at N places per region (N=40)
	@node tools/bench-data.mjs $(BENCH_DIR) $(N)
	@cd $(BENCH_DIR) && python3 -m http.server $(BENCH_PORT) >/dev/null 2>&1 & \
	 echo $$! > .bench.pid; sleep 2; \
	 BASE=http://127.0.0.1:$(BENCH_PORT) WANT=$$(( 36 * $(N) )) node test/bench.mjs; \
	 rc=$$?; kill $$(cat .bench.pid) 2>/dev/null; rm -f .bench.pid; exit $$rc

status: ## Show the latest deploy
	@gh run list --repo pranavek/history-map --limit 3 \
	  --json headSha,status,conclusion,displayTitle \
	  --jq '.[] | "  \(.headSha[0:7])  \(.status)/\(.conclusion // "running")  \(.displayTitle)"'

deploy: check ## Push main; GitHub Actions validates and deploys
	@git push origin main

clean: ## Remove generated and downloaded artefacts (not the test browser)
	@rm -rf _site $(SHOTS) .cache .server.pid .bench .bench.pid test/node_modules
	@echo "  removed _site/ $(SHOTS)/ .cache/"
