/**
 * Create Test User for Authentication
 * 
 * Creates an admin user for testing purposes.
 * Run: npx tsx server/create-test-user.ts
 */

import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function createTestUser() {
  console.log("🔐 Creating test user...\n");

  try {
    // Check if user already exists
    const users = await storage.getUsers();
    const existingAdmin = users.find(u => u.username === "admin");

    if (existingAdmin) {
      console.log("⚠️ Admin user already exists");
      console.log(`   Username: admin`);
      console.log(`   Password: admin123 (if not changed)`);
      console.log(`   User ID: ${existingAdmin.id}\n`);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    const adminUser = await storage.createUser({
      username: "admin",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Test user created successfully!\n");
    console.log("📋 Login Credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   Role: admin");
    console.log(`   User ID: ${adminUser.id}\n`);
    console.log("🎯 You can now use these credentials to test authenticated endpoints.\n");

  } catch (error) {
    console.error("❌ Failed to create test user:", error);
    process.exit(1);
  }
}

createTestUser();
