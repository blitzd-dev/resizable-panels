import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";

const nav = [
  { label: "Overview", active: false },
  { label: "Projects", active: true },
  { label: "Customers", active: false },
  { label: "Billing", active: false },
  { label: "Settings", active: false },
] as const;

const projects = [
  {
    name: "Acme Checkout",
    status: "Active",
    owner: "Maya Chen",
    updated: "2h ago",
  },
  {
    name: "Northwind CRM",
    status: "Active",
    owner: "Jon Park",
    updated: "Yesterday",
  },
  {
    name: "Orbit Onboarding",
    status: "Paused",
    owner: "Riley Ng",
    updated: "3d ago",
  },
  {
    name: "Ledger Export",
    status: "Active",
    owner: "Sam Ortiz",
    updated: "1w ago",
  },
] as const;

const activity = [
  { time: "14:02", text: "Maya Chen invited jon@acme.com to Acme Checkout" },
  { time: "13:41", text: "Deploy succeeded for Northwind CRM (v2.14.0)" },
  { time: "12:18", text: "Invoice #1842 paid — $2,400.00" },
  { time: "09:55", text: "Riley Ng paused Orbit Onboarding" },
] as const;

function Topbar() {
  const sidebar = usePanelControls({
    groupId: "workspace",
    panelId: "sidebar",
  });
  const activityPanel = usePanelControls({
    groupId: "main",
    panelId: "activity",
  });

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden />
        <span className="brand-name">Harbor</span>
        <span className="divider" aria-hidden />
        <span className="workspace">Acme Inc</span>
      </div>

      <label className="search">
        <span className="search-icon" aria-hidden>
          ⌕
        </span>
        <input type="search" placeholder="Search projects…" />
      </label>

      <div className="topbar-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => sidebar?.toggle()}
        >
          Sidebar
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => activityPanel?.toggle()}
        >
          Activity
        </button>
        <button type="button" className="primary">
          New project
        </button>
        <button type="button" className="avatar" aria-label="Account">
          TS
        </button>
      </div>
    </header>
  );
}

export function App() {
  return (
    <PanelProvider>
      <div className="shell">
        <Topbar />
        <div className="workspace-root">
          <PanelGroup groupId="workspace" orientation="horizontal">
            <Panel
              panelId="sidebar"
              side="start"
              defaultSize={240}
              minSize={200}
              maxSize={320}
              collapsible
              collapsedSize={0}
              className="panel"
            >
              <div className="panel-body sidebar">
                <p className="nav-label">Workspace</p>
                <nav className="nav">
                  {nav.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={item.active ? "nav-item active" : "nav-item"}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                <div className="sidebar-footer">
                  <p className="hint">
                    Built with <code>@blitzd/resizable-panels</code> from npm
                  </p>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="handle" />

            <Panel className="panel">
              <PanelGroup groupId="main" orientation="vertical">
                <Panel className="panel" minSize={240}>
                  <div className="panel-body content">
                    <div className="page-header">
                      <div>
                        <h1>Projects</h1>
                        <p className="subtitle">
                          Track active workspaces and recent updates.
                        </p>
                      </div>
                      <button type="button" className="secondary">
                        Export
                      </button>
                    </div>

                    <div className="table">
                      <div className="table-head">
                        <span>Name</span>
                        <span>Status</span>
                        <span>Owner</span>
                        <span>Updated</span>
                      </div>
                      {projects.map((project) => (
                        <div key={project.name} className="table-row">
                          <span className="project-name">{project.name}</span>
                          <span
                            className={
                              project.status === "Active"
                                ? "badge ok"
                                : "badge muted"
                            }
                          >
                            {project.status}
                          </span>
                          <span className="muted">{project.owner}</span>
                          <span className="muted">{project.updated}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle className="handle horizontal" />

                <Panel
                  panelId="activity"
                  side="end"
                  defaultSize={180}
                  minSize={120}
                  collapsible
                  collapsedSize={0}
                  className="panel"
                >
                  <div className="panel-body activity">
                    <div className="activity-header">
                      <h2>Activity</h2>
                      <span className="muted">Live</span>
                    </div>
                    <ul className="activity-list">
                      {activity.map((item) => (
                        <li key={item.time + item.text}>
                          <time>{item.time}</time>
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </PanelProvider>
  );
}
