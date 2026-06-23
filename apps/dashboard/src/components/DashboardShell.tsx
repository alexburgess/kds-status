"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPort, formatRelativeTime } from "@/lib/format";
import type { DashboardDevice, DashboardSnapshot } from "@/lib/types";

interface DashboardShellProps {
  snapshot: DashboardSnapshot;
}

export function DashboardShell({ snapshot }: DashboardShellProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(snapshot.devices[0]?.device.deviceId ?? "");

  const selected = useMemo(
    () => snapshot.devices.find((item) => item.device.deviceId === selectedDeviceId) ?? snapshot.devices[0],
    [selectedDeviceId, snapshot.devices]
  );

  const visibleDevice = selected?.device;
  const healthyCount = snapshot.devices.filter((item) => item.summary.severity === "healthy").length;
  const attentionCount = snapshot.devices.filter((item) => item.summary.severity === "critical").length;
  const staleCount = snapshot.devices.filter((item) => item.summary.severity === "warning" || item.summary.severity === "unknown").length;

  function selectDevice(device: DashboardDevice) {
    setSelectedDeviceId(device.device.deviceId);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <KitchenIcon />
          </span>
          <div>
            <strong>KDS Status</strong>
            <small>{snapshot.mode === "local" ? "Local JSON" : "Supabase live"}</small>
          </div>
        </div>

        <nav className="nav-list">
          <a className="nav-item active" href="#fleet">
            <FleetIcon />
            Fleet
          </a>
          <Link className="nav-item" href="/definitions">
            <SettingsIcon />
            Definitions
          </Link>
        </nav>

        <div className="sidebar-note">
          <span>Device identity</span>
          <strong>Ethernet MAC address</strong>
          <p>The Android app uses its local MAC address to load the matching JSON definition.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Kitchen Display Fleet</h1>
            <p>Diagnose Android KDS screens, printer reachability, network path, and Square KDS version state.</p>
          </div>
          <div className="generated-at">Updated {formatRelativeTime(snapshot.generatedAt)}</div>
        </header>

        <section className="summary-strip" aria-label="Fleet summary">
          <SummaryTile label="Healthy" value={healthyCount} tone="healthy" />
          <SummaryTile label="Needs attention" value={attentionCount} tone="critical" />
          <SummaryTile label="Stale or missing" value={staleCount} tone="warning" />
          <SummaryTile label="Defined screens" value={snapshot.devices.length} tone="neutral" />
        </section>

        <div className="content-grid">
          <section className="panel fleet-panel" id="fleet">
            <div className="section-heading">
              <div>
                <h2>Fleet</h2>
                <p>Live status from each KDS companion app.</p>
              </div>
            </div>

            <div className="table-frame">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Screen</th>
                    <th>Status</th>
                    <th>Last seen</th>
                    <th>Local IP</th>
                    <th>Network</th>
                    <th>Printers</th>
                    <th>Square KDS</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.devices.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <span className="empty-table-message">No KDS screens defined yet. Open Definitions to add the first MAC address.</span>
                      </td>
                    </tr>
                  ) : (
                    snapshot.devices.map((item) => (
                      <tr
                        className={item.device.deviceId === selected?.device.deviceId ? "selected-row" : ""}
                        key={item.device.deviceId}
                        onClick={() => selectDevice(item)}
                      >
                        <td>
                          <button className="row-button" type="button" onClick={() => selectDevice(item)}>
                            <strong>{item.device.displayName}</strong>
                            <span>{item.device.deviceId}</span>
                          </button>
                        </td>
                        <td>
                          <span className={`status-pill ${item.summary.severity}`}>{item.summary.label}</span>
                        </td>
                        <td>{item.latestReport ? formatRelativeTime(item.latestReport.reportedAt) : "Never"}</td>
                        <td>{item.latestReport?.localIp ?? "Unknown"}</td>
                        <td>{item.latestReport?.activeTransport ?? "Unknown"}</td>
                        <td>
                          {item.latestReport
                            ? `${item.latestReport.printerChecks.filter((printer) => printer.ok).length}/${
                                item.latestReport.printerChecks.length
                              }`
                            : `${item.device.printers.length} expected`}
                        </td>
                        <td>{item.latestReport?.squareKds.installedVersion ?? item.latestReport?.squareKds.versionStatus ?? "Unknown"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selected && visibleDevice ? (
            <aside className="panel detail-panel" aria-label="Selected device">
              <div className="detail-heading">
                <div>
                  <span className="label">Selected screen</span>
                  <h2>{visibleDevice.displayName}</h2>
                  <p>{visibleDevice.locationName} · {visibleDevice.role}</p>
                </div>
                <Link className="icon-button" href={`/devices/${visibleDevice.deviceId}`} aria-label="Open status history">
                  <HistoryIcon />
                </Link>
              </div>

              <section className="detail-section">
                <h3>Current Checks</h3>
                <ul className="check-list">
                  {selected.summary.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </section>

              <section className="detail-section">
                <h3>Printers</h3>
                <div className="printer-list">
                  {visibleDevice.printers.length === 0 ? (
                    <p className="muted">No printer expected for this screen.</p>
                  ) : (
                    visibleDevice.printers.map((printer) => (
                      <div className="printer-row" key={printer.id}>
                        <span>{printer.name}</span>
                        <strong>{formatPort(printer.host, printer.port)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="detail-section">
                <h3>Definition Source</h3>
                <p className="muted">
                  Edit this screen in the JSON definitions file. The tablet will match the row whose MAC address is{" "}
                  <strong>{visibleDevice.macAddress ?? "not set"}</strong>.
                </p>
                <Link className="secondary-link" href="/definitions">
                  Open JSON definitions
                </Link>
              </section>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "healthy" | "critical" | "warning" | "neutral";
}) {
  return (
    <article className={`summary-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function KitchenIcon() {
  return <FontAwesomeIcon icon="utensils" />;
}

function FleetIcon() {
  return <FontAwesomeIcon icon="tv" />;
}

function SettingsIcon() {
  return <FontAwesomeIcon icon="gear" />;
}

function HistoryIcon() {
  return <FontAwesomeIcon icon="clock-rotate-left" />;
}

function FontAwesomeIcon({ icon }: { icon: string }) {
  return <i aria-hidden="true" className={`fa-solid fa-${icon} fa-icon`} />;
}
