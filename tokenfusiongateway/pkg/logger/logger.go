package logger

import (
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var log *zap.Logger

// Init initializes the global zap logger with the given level and format.
// Supported formats: "console" (default, colored) and "json".
func Init(level, format string) error {
	var zapLevel zapcore.Level
	if err := zapLevel.UnmarshalText([]byte(strings.ToLower(level))); err != nil {
		return err
	}

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	encoding := "console"
	encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder

	switch strings.ToLower(format) {
	case "json":
		encoding = "json"
		encoderConfig.EncodeLevel = zapcore.LowercaseLevelEncoder
	case "console":
		encoding = "console"
		encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	cfg := zap.Config{
		Level:            zap.NewAtomicLevelAt(zapLevel),
		Development:      false,
		Encoding:         encoding,
		EncoderConfig:    encoderConfig,
		OutputPaths:      []string{"stderr"},
		ErrorOutputPaths: []string{"stderr"},
	}

	l, err := cfg.Build(zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	if err != nil {
		return err
	}
	log = l
	return nil
}

// GetLogger returns the underlying zap.Logger instance.
func GetLogger() *zap.Logger {
	return log
}

// Sync flushes any buffered log entries. It should be called before exit.
func Sync() {
	if log != nil {
		_ = log.Sync()
	}
}

// Info logs an info-level message with optional structured fields.
func Info(msg string, fields ...zap.Field) {
	if log != nil {
		log.Info(msg, fields...)
	}
}

// Warn logs a warn-level message with optional structured fields.
func Warn(msg string, fields ...zap.Field) {
	if log != nil {
		log.Warn(msg, fields...)
	}
}

// Error logs an error-level message with optional structured fields.
func Error(msg string, fields ...zap.Field) {
	if log != nil {
		log.Error(msg, fields...)
	}
}

// Debug logs a debug-level message with optional structured fields.
func Debug(msg string, fields ...zap.Field) {
	if log != nil {
		log.Debug(msg, fields...)
	}
}
