-- Create SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  message TEXT,
  status VARCHAR(32),
  provider VARCHAR(64),
  provider_response TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (phone),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
