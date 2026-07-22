import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileEnv = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const env = { ...fileEnv, ...process.env };
const required = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_DATABASE"];
const missing = required.filter((name) => !env[name]);
if (missing.length) throw new Error(`Missing required database settings: ${missing.join(", ")}`);

const connection = await mysql.createConnection({
  host: env.MYSQL_HOST,
  port: Number(env.MYSQL_PORT || 3306),
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD || "",
  database: env.MYSQL_DATABASE,
  connectTimeout: 15_000,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS vouchers (
    code VARCHAR(80) NOT NULL PRIMARY KEY,
    origin_city VARCHAR(100) NOT NULL,
    origin_airport VARCHAR(160) NOT NULL,
    origin_code CHAR(3) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_airport VARCHAR(160) NOT NULL,
    destination_code CHAR(3) NOT NULL,
    flight_type VARCHAR(30) NOT NULL DEFAULT 'Direct',
    duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 540,
    carry_on_kg SMALLINT UNSIGNED NOT NULL DEFAULT 7,
    checked_baggage_kg SMALLINT UNSIGNED NOT NULL DEFAULT 25,
    default_travel_date VARCHAR(10) NOT NULL,
    earliest_travel_date VARCHAR(10) NOT NULL,
    latest_travel_date VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at VARCHAR(40) NOT NULL,
    redeemed_at VARCHAR(40) NULL,
    INDEX vouchers_status_idx (status),
    INDEX vouchers_created_at_idx (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS voucher_travel_dates (
    voucher_code VARCHAR(80) NOT NULL,
    travel_date VARCHAR(10) NOT NULL,
    PRIMARY KEY (voucher_code, travel_date),
    INDEX voucher_travel_dates_date_idx (travel_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reference VARCHAR(50) NOT NULL,
    voucher_code VARCHAR(80) NOT NULL,
    origin_code CHAR(3) NOT NULL,
    destination_code CHAR(3) NOT NULL,
    travel_date VARCHAR(10) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(400) NOT NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    location_accuracy DOUBLE NULL,
    location_captured_at VARCHAR(40) NULL,
    location_consent TINYINT(1) NOT NULL,
    privacy_consent TINYINT(1) NOT NULL,
    email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    passport_ciphertext TEXT NULL,
    passport_iv TEXT NULL,
    verified_at VARCHAR(40) NULL,
    created_at VARCHAR(40) NOT NULL,
    UNIQUE KEY voucher_redemptions_reference_unique (reference),
    UNIQUE KEY voucher_redemptions_voucher_code_unique (voucher_code),
    INDEX voucher_redemptions_email_idx (email),
    INDEX voucher_redemptions_created_at_idx (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS voucher_otp_challenges (
    id CHAR(36) NOT NULL PRIMARY KEY,
    voucher_code VARCHAR(80) NOT NULL,
    email VARCHAR(200) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at VARCHAR(40) NOT NULL,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    consumed_at VARCHAR(40) NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX voucher_otp_voucher_idx (voucher_code),
    INDEX voucher_otp_email_created_idx (email, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS voucher_usage_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    voucher_code VARCHAR(80) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    ip_address VARCHAR(80) NULL,
    user_agent VARCHAR(500) NULL,
    accept_language VARCHAR(200) NULL,
    referrer VARCHAR(500) NULL,
    country VARCHAR(8) NULL,
    region VARCHAR(100) NULL,
    city VARCHAR(100) NULL,
    event_metadata TEXT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX voucher_usage_code_created_idx (voucher_code, created_at),
    INDEX voucher_usage_code_type_idx (voucher_code, event_type),
    INDEX voucher_usage_visitor_idx (visitor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS site_usage_events (
    id CHAR(36) NOT NULL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    location_accuracy DOUBLE NULL,
    location_captured_at VARCHAR(40) NULL,
    ip_address VARCHAR(80) NULL,
    user_agent VARCHAR(500) NULL,
    accept_language VARCHAR(200) NULL,
    referrer VARCHAR(500) NULL,
    country VARCHAR(8) NULL,
    region VARCHAR(100) NULL,
    city VARCHAR(100) NULL,
    event_metadata TEXT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX site_usage_type_created_idx (event_type, created_at),
    INDEX site_usage_visitor_idx (visitor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

try {
  for (const statement of statements) await connection.execute(statement);
  const [tables] = await connection.query("SHOW TABLES");
  const [oneUseIndexes] = await connection.query(
    "SHOW INDEX FROM voucher_redemptions WHERE Key_name = 'voucher_redemptions_voucher_code_unique' AND Non_unique = 0",
  );
  if (oneUseIndexes.length !== 1) {
    throw new Error("The one-use voucher constraint could not be verified.");
  }
  console.log(`Database schema ready. Verified ${tables.length} table(s).`);
  for (const row of tables) console.log(`- ${Object.values(row)[0]}`);
  console.log("One-use voucher constraint verified.");
} finally {
  await connection.end();
}
