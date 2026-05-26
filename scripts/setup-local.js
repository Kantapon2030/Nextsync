// scripts/setup-local.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");

const envPath = path.join(__dirname, "../.env.local");

// Helper to generate random 32-byte hex string
function generateSecret() {
  return crypto.randomBytes(32).toString("hex");
}

// Parse existing .env.local if it exists
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const firstEquals = trimmed.indexOf("=");
    if (firstEquals === -1) return;
    const key = trimmed.substring(0, firstEquals).trim();
    let val = trimmed.substring(firstEquals + 1).trim();
    // Remove wrapping quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  });
  return env;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const questions = [
  {
    key: "DATABASE_URL",
    question: "DATABASE_URL (PostgreSQL connection string): ",
    defaultVal: "postgresql://postgres:postgres@localhost:5432/nextsync",
  },
  {
    key: "NEXTAUTH_URL",
    question: "NEXTAUTH_URL (NextAuth base URL): ",
    defaultVal: "http://localhost:3000",
  },
  {
    key: "NEXTAUTH_SECRET",
    question: "NEXTAUTH_SECRET (Secret for auth, press enter to auto-generate): ",
    defaultVal: () => generateSecret(),
  },
  {
    key: "GOOGLE_CLIENT_ID",
    question: "GOOGLE_CLIENT_ID (Google OAuth Client ID for student sign-in): ",
    defaultVal: "your-google-oauth-client-id.apps.googleusercontent.com",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    question: "GOOGLE_CLIENT_SECRET (Google OAuth Client Secret): ",
    defaultVal: "your-google-oauth-client-secret",
  },
  {
    key: "R2_ACCOUNT_ID",
    question: "R2_ACCOUNT_ID (Cloudflare account ID, empty for mock): ",
    defaultVal: "dummy-cloudflare-account-id",
  },
  {
    key: "R2_ACCESS_KEY_ID",
    question: "R2_ACCESS_KEY_ID (Cloudflare R2 Access Key ID): ",
    defaultVal: "dummy-r2-access-key-id",
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    question: "R2_SECRET_ACCESS_KEY (Cloudflare R2 Secret Access Key): ",
    defaultVal: "dummy-r2-secret-access-key",
  },
  {
    key: "R2_BUCKET_NAME",
    question: "R2_BUCKET_NAME (Cloudflare R2 Bucket name): ",
    defaultVal: "nextsync-thumbnails",
  },
  {
    key: "R2_PUBLIC_URL",
    question: "R2_PUBLIC_URL (Cloudflare R2 Public CDN link): ",
    defaultVal: "https://pub-dummy.r2.dev",
  },
  {
    key: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    question: "GOOGLE_SERVICE_ACCOUNT_EMAIL (Google service account email, empty for mock): ",
    defaultVal: "dummy-service-account@project.iam.gserviceaccount.com",
  },
  {
    key: "GOOGLE_PRIVATE_KEY",
    question: "GOOGLE_PRIVATE_KEY (Google service account private key, replace escapes with \\n): ",
    defaultVal: "-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----\\n",
  },
  {
    key: "GOOGLE_DRIVE_FOLDER_ID",
    question: "GOOGLE_DRIVE_FOLDER_ID (Google Drive folder ID where photos upload): ",
    defaultVal: "root-folder-id-for-nextsync-uploads",
  },
  {
    key: "ADMIN_STUDENT_ID",
    question: "ADMIN_STUDENT_ID (Default ID for system admin): ",
    defaultVal: "00000",
  },
  {
    key: "ADMIN_PASSWORD",
    question: "ADMIN_PASSWORD (Default password for system admin): ",
    defaultVal: "admin123456",
  },
  {
    key: "PHOTOGRAPHER_INVITE_CODE",
    question: "PHOTOGRAPHER_INVITE_CODE (Invite code required for photographer registration): ",
    defaultVal: "nextsync-photographer-secret-2026",
  },
];

const existingEnv = parseEnvFile(envPath);
const updatedEnv = { ...existingEnv };

let currentQuestionIndex = 0;

function askNextQuestion() {
  if (currentQuestionIndex >= questions.length) {
    saveEnvFile();
    return;
  }

  const q = questions[currentQuestionIndex];
  const currentVal = updatedEnv[q.key];
  
  // Evaluate default value if it is a function
  const fallback = typeof q.defaultVal === "function" ? q.defaultVal() : q.defaultVal;
  const defaultPrompt = currentVal ? ` (current: ${currentVal})` : ` (default: ${fallback})`;

  rl.question(`${q.question}${defaultPrompt}: `, (answer) => {
    let finalAnswer = answer.trim();
    if (!finalAnswer) {
      finalAnswer = currentVal || fallback;
    }
    updatedEnv[q.key] = finalAnswer;
    currentQuestionIndex++;
    askNextQuestion();
  });
}

function saveEnvFile() {
  let envFileContent = "# Nextsync Local Development Configurations\n\n";
  
  // Group keys nicely
  const groups = [
    { name: "Database Configuration", keys: ["DATABASE_URL"] },
    { name: "NextAuth Configuration", keys: ["NEXTAUTH_URL", "NEXTAUTH_SECRET"] },
    { name: "Google OAuth (NextAuth Login)", keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
    { name: "Cloudflare R2 Thumbnail Storage", keys: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"] },
    { name: "Google Drive Upload API", keys: ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_DRIVE_FOLDER_ID"] },
    { name: "System Administrators", keys: ["ADMIN_STUDENT_ID", "ADMIN_PASSWORD"] },
    { name: "Photographer Credentials", keys: ["PHOTOGRAPHER_INVITE_CODE"] },
  ];

  groups.forEach((g) => {
    envFileContent += `# ─────────────────────────────────────────\n# ${g.name.toUpperCase()}\n# ─────────────────────────────────────────\n`;
    g.keys.forEach((key) => {
      let val = updatedEnv[key] || "";
      // Wrap in double quotes if there are spaces, equals, or backslashes
      if (val.includes(" ") || val.includes("=") || val.includes("\\") || val.includes("\n")) {
        val = `"${val.replace(/"/g, '\\"')}"`;
      }
      envFileContent += `${key}=${val}\n`;
    });
    envFileContent += "\n";
  });

  fs.writeFileSync(envPath, envFileContent, "utf-8");
  console.log(`\n🎉 Success! .env.local file has been updated/created at: ${envPath}\n`);
  rl.close();
}

console.log("==================================================");
console.log("      NEXTSYNC LOCAL ENVIRONMENT SETUP WIZARD     ");
console.log("==================================================");
console.log("Press enter to keep the current value or fallback to default.\n");

askNextQuestion();
