CREATE DATABASE IF NOT EXISTS ai_security_db;

USE ai_security_db;


-- ============================================
-- 1. USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'analyst', 'viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL
);


-- ============================================
-- 2. NETWORK TRAFFIC TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS network_traffic (
    traffic_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45) NOT NULL,
    protocol VARCHAR(20) NOT NULL,
    source_port INT NULL,
    destination_port INT NULL,
    data_size_bytes BIGINT DEFAULT 0,
    packet_count INT DEFAULT 1,
    status ENUM('NORMAL', 'SUSPICIOUS', 'BLOCKED') DEFAULT 'NORMAL'
);


-- ============================================
-- 3. INTRUSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS intrusions (
    intrusion_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45) NOT NULL,
    attack_type VARCHAR(100) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    confidence_score DECIMAL(5,2) DEFAULT NULL,
    status ENUM(
        'BLOCKED',
        'MONITORING',
        'RESOLVED',
        'INVESTIGATING'
    ) DEFAULT 'MONITORING',
    detection_method VARCHAR(100) DEFAULT 'AI/ML Model',
    description TEXT
);


-- ============================================
-- 3A. AI PREDICTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS ai_predictions (
    prediction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45) NOT NULL,
    attack_type VARCHAR(100) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL,
    model_version VARCHAR(100) NOT NULL,
    feature_distance DECIMAL(8,4) NULL,
    raw_payload JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_prediction_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);


-- ============================================
-- 4. THREAT INTELLIGENCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS threat_intelligence (
    threat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ioc_type ENUM('IP', 'DOMAIN', 'HASH', 'URL') NOT NULL,
    ioc_value VARCHAR(255) NOT NULL,
    threat_type VARCHAR(100) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    source VARCHAR(100) NOT NULL,
    description TEXT,
    first_seen DATETIME NULL,
    last_seen DATETIME NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') DEFAULT 'ACTIVE',

    UNIQUE KEY unique_ioc (ioc_type, ioc_value)
);


-- ============================================
-- 5. ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
    alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    intrusion_id BIGINT NULL,
    alert_message VARCHAR(255) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    status ENUM(
        'ACTIVE',
        'ACKNOWLEDGED',
        'RESOLVED'
    ) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME NULL,
    resolved_at DATETIME NULL,

    CONSTRAINT fk_alert_intrusion
        FOREIGN KEY (intrusion_id)
        REFERENCES intrusions(intrusion_id)
        ON DELETE SET NULL
);


-- ============================================
-- 6. REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
    report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    generated_by INT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'READY',
        'GENERATING',
        'FAILED'
    ) DEFAULT 'GENERATING',
    file_path VARCHAR(500) NULL,

    CONSTRAINT fk_report_user
        FOREIGN KEY (generated_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);


-- ============================================
-- 7. SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    email_alerts BOOLEAN DEFAULT TRUE,
    auto_block_ips BOOLEAN DEFAULT TRUE,
    session_timeout INT DEFAULT 30,

    CONSTRAINT fk_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


-- ============================================
-- SHOW TABLES
-- ============================================

SHOW TABLES;