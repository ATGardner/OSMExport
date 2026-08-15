# Grafana

`osmexport.json` is a dashboard for the series [src/metrics.ts](../src/metrics.ts)
exposes on the metrics listener. Import it under _Dashboards → New → Import_, or
paste the JSON into the import box, and pick a Prometheus data source — the
dashboard has no data source baked in, it asks via a template variable.

Scraping has to be on first: the chart ships it off by default, so set
`metrics.enabled=true` plus either `metrics.scrapeAnnotations=true` or
`metrics.serviceMonitor.enabled=true`, depending on how your Prometheus finds
targets. See the `metrics` block in [values.yaml](../charts/osmexport/values.yaml).

## Variables

`job`, `instance` and `route` are all multi-select with an All option, so the
dashboard works unchanged for a single pod or a fleet. `route` filters only the
HTTP panels — the OSM API, export and runtime metrics carry no route label.

## What the rows answer

- **Overview** — is it serving, how fast, and how much of the traffic is failing.
  4xx counts against the success rate deliberately: a mistyped relation id is
  still a user who got no file.
- **HTTP** — rate and latency by route and status, plus the full duration
  histogram as a heatmap. Traffic here is bimodal (a 400 returns instantly, a
  large export takes minutes), which the quantiles alone hide.
- **OSM API (upstream)** — outbound call rate split by outcome, with `not_found`
  kept apart from `error` so a bad link cannot look like an upstream outage, and
  the share of request time spent waiting on OSM. That ratio is the fastest way
  to tell "the OSM API is slow" from "we are"; event loop lag in the runtime row
  is the confirmation.
- **Exports** — delivered documents by format, their sizes, and the coordinate
  count of the relations behind them. KMZ running level with KML for the same
  relation means compression stopped happening.
- **Node runtime** — CPU, memory, event loop lag, GC pauses, handles and file
  descriptors, from `collectDefaultMetrics`.

## Loading it into Grafana automatically

The chart has no ConfigMap template for this. If your Grafana runs the dashboard
sidecar, the usual one-liner works:

```sh
kubectl create configmap osmexport-dashboard \
  --from-file=osmexport.json=grafana/osmexport.json \
  --dry-run=client -o yaml \
  | kubectl label -f - --local --dry-run=client -o yaml grafana_dashboard=1 \
  | kubectl apply -f -
```
