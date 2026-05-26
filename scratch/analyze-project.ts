import fs from "fs";
import path from "path";

function getTree(dir: string, indent = ""): string {
  let result = "";
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".next" || file === ".git" || file === ".venv" || file === "dist") {
      continue;
    }
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      result += `${indent}├── ${file}/\n`;
      result += getTree(fullPath, `${indent}│   `);
    } else {
      result += `${indent}├── ${file}\n`;
    }
  }
  return result;
}

function scanApiRoutes(dir: string): void {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanApiRoutes(fullPath);
    } else if (file === "route.ts" || file === "route.js") {
      console.log(`API Route File: ${fullPath}`);
    }
  }
}

async function main() {
  const root = path.resolve(".");
  console.log("Generating file tree...");
  // Write the file tree to a temp file
  const tree = `nextsync/\n${getTree(root, "")}`;
  fs.writeFileSync(path.join(root, "scratch/file-tree.txt"), tree);
  console.log("File tree generated at scratch/file-tree.txt");

  console.log("\nScanning API routes...");
  const apiDir = path.join(root, "app/api");
  if (fs.existsSync(apiDir)) {
    scanApiRoutes(apiDir);
  }
}

main();
