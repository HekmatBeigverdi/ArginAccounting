// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod password_commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:argin-accounting.db";

fn database_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initialize_database",
            sql: include_str!("../migrations/0001_initialize_database.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "company_and_branch",
            sql: include_str!("../migrations/0002_company_and_branch.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "fiscal_management",
            sql: include_str!("../migrations/0003_fiscal_management.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "security",
            sql: include_str!("../migrations/0004_security.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "audit_approval",
            sql: include_str!("../migrations/0005_audit_and_approval.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "approval_optimistic_concurrency",
            sql: include_str!("../migrations/0006_approval_optimistic_concurrency.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "background_jobs",
            sql: include_str!("../migrations/0007_background_jobs.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "notifications",
            sql: include_str!("../migrations/0008_notifications.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "background_job_context",
            sql: include_str!("../migrations/0009_background_job_context.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "chart_of_accounts",
            sql: include_str!("../migrations/0010_chart_of_accounts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "accounting_dimensions",
            sql: include_str!("../migrations/0011_accounting_dimensions.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            password_commands::hash_password,
            password_commands::verify_password,
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, database_migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running ArginAccounting");
}
