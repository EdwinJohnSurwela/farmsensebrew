#!/usr/bin/env node
/**
 * FarmSense Brew — Grafana Provisioning Script
 * File: config/grafana-setup.js
 *
 * Automates Grafana OSS setup via its HTTP API:
 *   1. Creates users matching FarmSense MySQL seed accounts
 *   2. Creates role-based folders (Agronomist, Farm Owner, Field Staff)
 *   3. Imports the three Grafana dashboard JSONs into their folders
 *   4. Assigns folder permissions per role
 *
 * Run:
 *   node config/grafana-setup.js
 *
 * Prerequisites:
 *   - Grafana running on GRAFANA_URL (default http://127.0.0.1:3000)
 *   - Grafana admin credentials set below (or via env)
 *   - MySQL data source "farmsense-mysql" already configured in Grafana
 */

const fs   = require("fs");
const path = require("path");

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const GRAFANA_URL   = process.env.GRAFANA_URL   || "http://127.0.0.1:3000";
const GRAFANA_ADMIN = process.env.GRAFANA_ADMIN || "admin";
const GRAFANA_PASS  = process.env.GRAFANA_PASS  || "farmsense";

const AUTH_HEADER = "Basic " + Buffer.from(`${GRAFANA_ADMIN}:${GRAFANA_PASS}`).toString("base64");

// FarmSense users to create (mirroring MySQL seeds)
const USERS = [
  { login: "agronomist_user", name: "Dr. Maria Santos",     password: "FarmSense@2025", role: "Viewer" },
  { login: "farmowner_user",  name: "Don Javier Reyes",     password: "Javier@2025",    role: "Viewer" },
  { login: "fieldstaff_user", name: "Juan dela Cruz",       password: "Staff@2025",     role: "Viewer" }
];

// Folders to create + which user gets access
const FOLDERS = [
  { uid: "folder-agronomist", title: "Agronomist Dashboards",  allowUser: "agronomist_user" },
  { uid: "folder-farmowner",  title: "Farm Owner Dashboards",  allowUser: "farmowner_user"  },
  { uid: "folder-fieldstaff", title: "Field Staff Dashboards",  allowUser: "fieldstaff_user" }
];

// Dashboard JSON files → target folders
const DASHBOARDS = [
  { file: "../dashboard/grafana_agronomist_view.json",  folderUid: "folder-agronomist" },
  { file: "../dashboard/grafana_farmowner_view.json",   folderUid: "folder-farmowner"  },
  { file: "../dashboard/grafana_fieldstaff_view.json",  folderUid: "folder-fieldstaff" }
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function grafana(method, endpoint, body) {
  const url = GRAFANA_URL + endpoint;
  const opts = {
    method,
    headers: {
      "Authorization": AUTH_HEADER,
      "Content-Type": "application/json"
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

function log(icon, msg) { console.log(`  ${icon}  ${msg}`); }

// ─── STEP 1: Create users ────────────────────────────────────────────────────
async function createUsers() {
  console.log("\n─── Step 1: Create Grafana Users ───");
  const userIds = {};
  for (const u of USERS) {
    // Check if user exists
    const { status, data } = await grafana("GET", `/api/users/lookup?loginOrEmail=${u.login}`);
    if (status === 200 && data.id) {
      log("✓", `User "${u.login}" already exists (ID: ${data.id})`);
      userIds[u.login] = data.id;
      continue;
    }
    // Create user via admin API
    const create = await grafana("POST", "/api/admin/users", {
      name: u.name,
      login: u.login,
      password: u.password,
      OrgId: 1
    });
    if (create.status === 200 || create.status === 201) {
      log("✅", `Created user "${u.login}" (ID: ${create.data.id})`);
      userIds[u.login] = create.data.id;
    } else {
      log("⚠️", `Failed to create "${u.login}": ${JSON.stringify(create.data)}`);
    }
  }
  return userIds;
}

// ─── STEP 2: Create folders ───────────────────────────────────────────────────
async function createFolders() {
  console.log("\n─── Step 2: Create Role-Based Folders ───");
  const folderIds = {};
  for (const f of FOLDERS) {
    // Check if folder exists
    const { status, data } = await grafana("GET", `/api/folders/${f.uid}`);
    if (status === 200 && data.id) {
      log("✓", `Folder "${f.title}" already exists (ID: ${data.id})`);
      folderIds[f.uid] = data.id;
      continue;
    }
    // Create folder
    const create = await grafana("POST", "/api/folders", {
      uid: f.uid,
      title: f.title
    });
    if (create.status === 200 || create.status === 201) {
      log("✅", `Created folder "${f.title}" (ID: ${create.data.id})`);
      folderIds[f.uid] = create.data.id;
    } else {
      log("⚠️", `Failed to create folder "${f.title}": ${JSON.stringify(create.data)}`);
    }
  }
  return folderIds;
}

// ─── STEP 3: Assign folder permissions ────────────────────────────────────────
async function assignPermissions(userIds, folderIds) {
  console.log("\n─── Step 3: Set Folder Permissions (Role-Based Access) ───");
  for (const f of FOLDERS) {
    const folderId = folderIds[f.uid];
    const userId = userIds[f.allowUser];
    if (!folderId || !userId) {
      log("⚠️", `Skipping permissions for ${f.title} — missing folder or user ID`);
      continue;
    }
    // Set permissions: admin keeps full access, role user gets Viewer
    const perms = await grafana("POST", `/api/folders/${f.uid}/permissions`, {
      items: [
        { role: "Editor", permission: 2 },     // Editors can edit
        { userId: userId, permission: 1 }       // Specific user = Viewer (can see)
      ]
    });
    if (perms.status === 200) {
      log("✅", `"${f.allowUser}" can view "${f.title}"`);
    } else {
      log("⚠️", `Permissions for "${f.title}": ${JSON.stringify(perms.data)}`);
    }
  }
}

// ─── STEP 4: Import dashboards ────────────────────────────────────────────────
async function importDashboards() {
  console.log("\n─── Step 4: Import Grafana Dashboards ───");
  for (const d of DASHBOARDS) {
    const filePath = path.resolve(__dirname, d.file);
    if (!fs.existsSync(filePath)) {
      log("⚠️", `Dashboard file not found: ${filePath}`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const uid = raw.uid;
    const title = raw.title;

    // Check if dashboard with this UID already exists
    const existing = await grafana("GET", `/api/dashboards/uid/${uid}`);
    if (existing.status === 200) {
      log("✓", `Dashboard "${title}" (${uid}) already exists — updating`);
    }

    // Import/overwrite dashboard into target folder
    const importPayload = {
      dashboard: {
        ...raw,
        id: existing.status === 200 ? existing.data.dashboard?.id : null,
        version: undefined
      },
      folderUid: d.folderUid,
      overwrite: true,
      message: "Imported by FarmSense provisioning script"
    };

    const result = await grafana("POST", "/api/dashboards/db", importPayload);
    if (result.status === 200) {
      log("✅", `Imported "${title}" → folder ${d.folderUid}`);
    } else {
      log("⚠️", `Import failed for "${title}": ${JSON.stringify(result.data)}`);
    }
  }
}

// ─── STEP 5: Verify data source ──────────────────────────────────────────────
async function checkDataSource() {
  console.log("\n─── Step 5: Verify MySQL Data Source ───");
  const { status, data } = await grafana("GET", "/api/datasources/name/farmsense-mysql");
  if (status === 200) {
    log("✅", `Data source "farmsense-mysql" found (type: ${data.type})`);
  } else {
    log("⚠️", `Data source "farmsense-mysql" NOT found.`);
    log("📝", `You need to add a MySQL data source named "farmsense-mysql" in Grafana:`);
    log("  ", `Host: 127.0.0.1:3306 | Database: farmsense_db | User: root`);

    // Auto-create it
    const create = await grafana("POST", "/api/datasources", {
      name: "farmsense-mysql",
      type: "mysql",
      access: "proxy",
      url: "127.0.0.1:3306",
      database: "farmsense_db",
      user: "root",
      secureJsonData: { password: "" },
      jsonData: { maxOpenConns: 10, connMaxLifetime: 14400, timezone: "Asia/Manila" },
      isDefault: true
    });
    if (create.status === 200 || create.status === 201) {
      log("✅", `Auto-created MySQL data source "farmsense-mysql"`);
    } else {
      log("⚠️", `Auto-create failed: ${JSON.stringify(create.data)}`);
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   FarmSense Brew — Grafana Provisioning             ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Target: ${GRAFANA_URL}`);
  console.log(`  Admin:  ${GRAFANA_ADMIN}`);

  // Test connectivity
  const health = await grafana("GET", "/api/health").catch(() => null);
  if (!health || health.status !== 200) {
    console.error("\n❌ Cannot reach Grafana at " + GRAFANA_URL);
    console.error("   Make sure Grafana is running and the URL is correct.");
    process.exit(1);
  }
  log("✅", "Grafana is reachable\n");

  // Verify admin auth
  const org = await grafana("GET", "/api/org");
  if (org.status !== 200) {
    console.error("❌ Admin auth failed. Check GRAFANA_ADMIN / GRAFANA_PASS.");
    console.error("   Response:", JSON.stringify(org.data));
    process.exit(1);
  }
  log("✅", `Org: ${org.data.name} (ID: ${org.data.id})\n`);

  await checkDataSource();
  const userIds = await createUsers();
  const folderIds = await createFolders();
  await assignPermissions(userIds, folderIds);
  await importDashboards();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ Grafana provisioning complete!");
  console.log("");
  console.log("  Dashboard URLs (via proxy):");
  console.log("    Agronomist:  http://127.0.0.1:3001/grafana/d/farmsense-agro-001");
  console.log("    Farm Owner:  http://127.0.0.1:3001/grafana/d/farmsense-owner-001");
  console.log("    Field Staff: http://127.0.0.1:3001/grafana/d/farmsense-staff-001");
  console.log("");
  console.log("  Or login via the FarmSense portal: http://127.0.0.1:3001/");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\n❌ Provisioning error:", err.message);
  process.exit(1);
});
