import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeviceDetail } from "@/lib/repository";
import { formatRelativeTime } from "@/lib/format";
import { summarizeDeviceStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({
  params
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const detail = await getDeviceDetail(deviceId);

  if (!detail) {
    notFound();
  }

  const summary = summarizeDeviceStatus(detail.device, detail.latestReport);

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <Link className="back-link" href="/">
            Back to fleet
          </Link>
          <h1>{detail.device.displayName}</h1>
          <p>{detail.device.locationName} · {detail.device.role}</p>
        </div>
        <span className={`status-pill ${summary.severity}`}>{summary.label}</span>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Latest Snapshot</h2>
          <dl className="metric-list">
            <div>
              <dt>Last seen</dt>
              <dd>{detail.latestReport ? formatRelativeTime(detail.latestReport.reportedAt) : "Never"}</dd>
            </div>
            <div>
              <dt>Local IP</dt>
              <dd>{detail.latestReport?.localIp ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{detail.latestReport?.activeTransport ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Square KDS</dt>
              <dd>{detail.latestReport?.squareKds.installedVersion ?? "Not reported"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Expected Setup</h2>
          <div className="checklist">
            {detail.device.expectedSettings.map((item) => (
              <div className="checklist-row" key={`${item.section}-${item.setting}`}>
                <span>{item.section}</span>
                <strong>{item.setting}</strong>
                <em>{item.expected}</em>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel history-panel">
        <h2>Status History</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Reported</th>
              <th>IP</th>
              <th>Network</th>
              <th>Internet</th>
              <th>Printers</th>
              <th>Square KDS</th>
            </tr>
          </thead>
          <tbody>
            {detail.history.map((report) => (
              <tr key={report.id}>
                <td>{formatRelativeTime(report.reportedAt)}</td>
                <td>{report.localIp ?? "Unknown"}</td>
                <td>{report.activeTransport}</td>
                <td>{report.internet.ok ? "Reachable" : report.internet.error ?? "Failed"}</td>
                <td>
                  {report.printerChecks.filter((printer) => printer.ok).length}/{report.printerChecks.length}
                </td>
                <td>{report.squareKds.installedVersion ?? report.squareKds.versionStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
