package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port    string
	VoidDB  VoidDBConfig
	Telegram TelegramConfig
	JWT     JWTConfig
	BitNet  BitNetConfig
	Mail    MailConfig
	Upload  UploadConfig
}

type VoidDBConfig struct {
	URL      string
	Username string
	Password string
	Token    string
}

type TelegramConfig struct {
	BotToken       string
	AllowedUserIDs []int64
}

type JWTConfig struct {
	Secret string
}

type BitNetConfig struct {
	URL string
}

type MailConfig struct {
	IMAPHost string
	IMAPPort int
	SMTPHost string
	SMTPPort int
	Domain   string
}

type UploadConfig struct {
	Dir string
}

func Load() *Config {
	cfg := &Config{
		Port: getEnv("PORT", "8090"),
		VoidDB: VoidDBConfig{
			URL:      getEnv("VOIDDB_URL", "http://localhost:7700"),
			Username: getEnv("VOIDDB_USERNAME", ""),
			Password: getEnv("VOIDDB_PASSWORD", ""),
			Token:    getEnv("VOIDDB_TOKEN", ""),
		},
		Telegram: TelegramConfig{
			BotToken:       getEnv("TELEGRAM_BOT_TOKEN", ""),
			AllowedUserIDs: parseUserIDs(getEnv("BOGDAN_TELEGRAM_USER_IDS", "")),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "changeme-secret-key"),
		},
		BitNet: BitNetConfig{
			URL: getEnv("BITNET_URL", "http://bitnet:8080"),
		},
		Mail: MailConfig{
			IMAPHost: getEnv("MAIL_IMAP_HOST", ""),
			IMAPPort: getEnvInt("MAIL_IMAP_PORT", 993),
			SMTPHost: getEnv("MAIL_SMTP_HOST", ""),
			SMTPPort: getEnvInt("MAIL_SMTP_PORT", 587),
			Domain:   getEnv("MAIL_DOMAIN", "lowkey.su"),
		},
		Upload: UploadConfig{
			Dir: getEnv("UPLOAD_DIR", "./uploads"),
		},
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func parseUserIDs(s string) []int64 {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if n, err := strconv.ParseInt(p, 10, 64); err == nil {
			ids = append(ids, n)
		}
	}
	return ids
}
