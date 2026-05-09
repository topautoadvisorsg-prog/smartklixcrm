/**
 * Quick Fix: Create Test User and Verify Immediately
 */

import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function createAndVerifyUser() {
  console.log("🔐 Creating test user...\n");

  try {
    // Check if user already exists
    const existingUser = await storage.getUserByUsername("admin");

    if (existingUser) {
      console.log("⚠️ Admin user already exists, updating password...\n");
      // Can't update in memory storage, just verify it works
      const hashedPassword = await bcrypt.hash("admin123", 10);
      // Memory storage doesn't support update, so we'll just note this
      console.log("⚠️ In-memory storage: Cannot update existing user");
      console.log("   The existing user may have a different password\n");
    } else {
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

      // Verify it works immediately
      const verifyUser = await storage.getUserByUsername("admin");
      if (verifyUser) {
        const isValid = await bcrypt.compare("admin123", verifyUser.password);
        if (isValid) {
          console.log("✅ VERIFIED: Login will work with these credentials\n");
        } else {
          console.log("❌ WARNING: Password verification failed!\n");
        }
      }
    }

  } catch (error) {
    console.error("❌ Failed:", error);
    process.exit(1);
  }
}

createAndVerifyUser();
