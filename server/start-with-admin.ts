/**
 * START SERVER WITH ADMIN USER
 * 
 * Creates admin user then starts the server
 * Run: npx tsx server/start-with-admin.ts
 */

import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function createAdminAndStart() {
  console.log("🔐 Creating admin user...\n");

  try {
    const existingUser = await storage.getUserByUsername("admin");
    
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        email: "admin@smartklix.com",
        role: "admin",
      });
      console.log("✅ Admin user created\n");
      console.log("📋 Credentials:");
      console.log("   Username: admin");
      console.log("   Password: admin123\n");
    } else {
      console.log("⚠️ Admin user already exists\n");
    }

    // Now import and start the server
    console.log("🚀 Starting server...\n");
    const { default: serverModule } = await import("./index");
    
  } catch (error) {
    console.error("❌ Failed to start:", error);
    process.exit(1);
  }
}

createAdminAndStart();
