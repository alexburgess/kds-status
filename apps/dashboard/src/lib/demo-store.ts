import type { StatusReport } from "./types";

const reports: StatusReport[] = [];

export function getDemoReports() {
  return [...reports].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
}

export function addDemoReport(report: StatusReport) {
  reports.unshift(report);
  return report;
}
