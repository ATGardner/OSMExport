{{/* Expand the name of the chart. */}}
{{- define "osmexport.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name. Truncated at 63 chars because some Kubernetes name
fields are limited to that by the DNS naming spec.
*/}}
{{- define "osmexport.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "osmexport.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "osmexport.labels" -}}
helm.sh/chart: {{ include "osmexport.chart" . }}
{{ include "osmexport.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "osmexport.selectorLabels" -}}
app.kubernetes.io/name: {{ include "osmexport.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* The image tag defaults to the chart's appVersion, which CI pins per build. */}}
{{- define "osmexport.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}
